#!/usr/bin/env node
/*
 * AgentiCuántico · equipo de agentes 24/7 (GitHub Actions + GitHub Models).
 *
 * Cada ejecución elige roles en rotación, lee un conjunto acotado de archivos, pide al modelo
 * mejoras pequeñas y concretas y abre una Pull Request por rol con la etiqueta agente/<rol>.
 * Nunca hace merge: el dueño aprueba cada PR desde /admin/. Nunca toca workflows, .env ni secretos.
 * Si GitHub Models no está disponible o hay límite de uso, deja un log y termina sin fallar.
 *
 * Variables (todas opcionales salvo GITHUB_TOKEN y GITHUB_REPOSITORY, que da Actions):
 *   AGENTS_REPO_KIND   dev | web                     (perfil de rutas permitidas)
 *   AGENTS_MODEL       openai/gpt-4.1-mini           (modelo de GitHub Models)
 *   AGENTS_ROLES_PER_RUN 2                           (roles por ejecución)
 *   AGENTS_MAX_FILES   3                             (archivos por PR)
 *   AGENTS_MAX_LINES   120                           (líneas agregadas+borradas por PR)
 *   AGENTS_ONLY_ROLE   <id>                          (forzar un rol)
 *   AGENTS_DRY_RUN     true|false                    (no crea ramas ni PRs)
 *   AGENTS_DISABLED    ''                            (roles apagados desde el panel, separados por coma)
 *   AGENTS_ORDER       ''                            (orden del dueño: texto del Issue agent-order)
 *   AGENTS_RESULT_FILE agents-run.json               (resumen para el job de estado)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

const env = process.env;
const KIND = env.AGENTS_REPO_KIND === 'web' ? 'web' : 'dev';
const MODEL = env.AGENTS_MODEL || 'openai/gpt-4.1-mini';
const ENDPOINT = env.AGENTS_MODELS_ENDPOINT || 'https://models.github.ai/inference/chat/completions';
const PER_RUN = clampInt(env.AGENTS_ROLES_PER_RUN, 2, 1, 4);
const MAX_FILES = clampInt(env.AGENTS_MAX_FILES, 3, 1, 6);
const MAX_LINES = clampInt(env.AGENTS_MAX_LINES, 120, 10, 400);
const DRY = env.AGENTS_DRY_RUN === 'true';
const AUTO_MERGE = false; // política: los agentes nunca mergean a main
const DISABLED = String(env.AGENTS_DISABLED || '').split(',').map((x) => x.trim()).filter(Boolean);
const ORDER = String(env.AGENTS_ORDER || '').slice(0, 3000);
const TOKEN = env.GITHUB_TOKEN || '';
const REPO = env.GITHUB_REPOSITORY || '';
const RUN_NO = Number(env.GITHUB_RUN_NUMBER || Math.floor(Date.now() / 3.6e6));
const RESULT_FILE = env.AGENTS_RESULT_FILE || 'agents-run.json';
const TODAY = new Date().toISOString().slice(0, 10);

function clampInt(v, d, lo, hi) { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; }

/* ---------- Roles ---------- */
export const ROLES = [
  { id: 'programador-fullstack', name: 'Programador Full Stack', emoji: '🧑‍💻', focus: 'coherencia entre frontend y backend, pruebas y documentación técnica' },
  { id: 'frontend', name: 'Frontend', emoji: '🖥️', focus: 'accesibilidad (ARIA, foco, contraste), textos de la interfaz e i18n' },
  { id: 'backend', name: 'Backend', emoji: '🛠️', focus: 'API del Worker, validaciones, pruebas y seguridad' },
  { id: 'ux-ui', name: 'Diseñador UX/UI', emoji: '🧭', focus: 'claridad de textos, microcopy, flujos y usabilidad' },
  { id: 'disenador-grafico', name: 'Diseñador Gráfico', emoji: '🎨', focus: 'consistencia visual, paleta y jerarquía tipográfica' },
  { id: 'disenador-web', name: 'Diseñador Web', emoji: '🌐', focus: 'CSS responsive, espaciados y estados hover/focus' },
  { id: 'ilustrador', name: 'Ilustrador', emoji: '🖌️', focus: 'íconos SVG simples, textos alternativos y descripciones de imágenes' },
  { id: 'disenador-3d', name: 'Diseñador 3D', emoji: '🧊', focus: 'escena WebGL del cerebro, rendimiento en móviles y fallback' }
];

/* ---------- Perfiles de rutas ---------- */
const PROFILES = {
  dev: {
    allow: ['brain/', 'docs/', 'knowledge/', 'agents/prompts/', 'agents/README.md', 'evals/', 'worker-v2/test/', 'web/app/i18n.js', 'web/app/embed.css', 'web/como-funciona.html', 'web/nosotros.html', 'web/404.html'],
    context: {
      'programador-fullstack': ['docs/architecture.md', 'worker-v2/README.md', 'brain/README.md'],
      frontend: ['web/app/i18n.js'],
      backend: ['worker-v2/README.md', 'worker-v2/test/tts.test.ts', 'docs/SECURITY.md'],
      'ux-ui': ['web/nosotros.html', 'web/como-funciona.html'],
      'disenador-grafico': ['web/app/embed.css'],
      'disenador-web': ['web/app/embed.css'],
      ilustrador: ['web/404.html', 'brain/README.md'],
      'disenador-3d': ['tools/cerebro-3d/README.md', 'brain/README.md']
    },
    journal: true
  },
  web: {
    allow: ['index.html', 'como-funciona.html', 'nosotros.html', 'planes.html', '404.html', 'app/i18n.js', 'app/embed.css', 'app/app.css', 'robots.txt'],
    context: {
      'programador-fullstack': ['404.html', 'robots.txt'],
      frontend: ['app/i18n.js'],
      backend: ['robots.txt', '404.html'],
      'ux-ui': ['nosotros.html', 'como-funciona.html'],
      'disenador-grafico': ['app/embed.css'],
      'disenador-web': ['app/embed.css'],
      ilustrador: ['404.html', 'nosotros.html'],
      'disenador-3d': ['index.html#cerebro']
    },
    journal: false
  }
};
const DENY = [/^\.github\//, /(^|\/)\.env/, /(^|\/)\.dev\.vars/, /wrangler\.toml$/, /package(-lock)?\.json$/, /(^|\/)CNAME$/, /\.(pem|key|p12|jks|keystore)$/i, /node_modules\//, /(^|\/)secrets?\//, /agents-status\.json$/];
const SECRET_PATTERNS = [/gh[pousr]_[A-Za-z0-9]{20,}/, /github_pat_[A-Za-z0-9_]{20,}/, /sk-[A-Za-z0-9]{20,}/, /AKIA[0-9A-Z]{16}/, /xox[abpr]-[A-Za-z0-9-]{10,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /APP_USR-[0-9a-f-]{10,}/i, ...blockedWords()];
// Palabras y datos que nunca deben publicarse (armados en tiempo de ejecución para no escribirlos literalmente).
function blockedWords() {
  const rev = (x) => x.split('').reverse().join('');
  const phone = ['192', '914', '8324'].map(rev);
  return [new RegExp('\\+?54\\s*9?\\s*' + phone[0] + '\\s*' + phone[1] + '[\\s-]*' + phone[2]), new RegExp('\\b' + String.fromCharCode(104, 97, 114, 107) + '\\b', 'i')];
}

export function pathAllowed(p, kind = KIND) {
  const n = normalize(String(p || '')).replace(/^\.\/+/, '');
  if (!n || n.startsWith('..') || n.startsWith('/') || n.includes('\0')) return false;
  if (DENY.some((re) => re.test(n))) return false;
  return PROFILES[kind].allow.some((a) => (a.endsWith('/') ? n.startsWith(a) : n === a));
}
export function hasSecret(text) { return SECRET_PATTERNS.some((re) => re.test(String(text || ''))); }
export function unsafeWebContent(text) { return /<script\b|javascript:|\son[a-z]+\s*=|<iframe\b|<object\b|<embed\b/i.test(String(text || '')); }

export function pickRoles(runNo, perRun, only) {
  if (only) { const r = ROLES.find((x) => x.id === only); return r ? [r] : []; }
  const out = [];
  for (let i = 0; i < perRun; i++) out.push(ROLES[(runNo * perRun + i) % ROLES.length]);
  return out;
}

/* ---------- Utilidades ---------- */
function sh(cmd, args, opts = {}) { return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim(); }
function git(...a) { return sh('git', a); }
function readSafe(p, max = 7000) {
  const [file, anchor] = p.split('#');
  if (!existsSync(file) || !statSync(file).isFile()) return null;
  let t = readFileSync(file, 'utf8');
  if (anchor) { const i = t.indexOf(`id="${anchor}"`); if (i >= 0) t = t.slice(Math.max(0, i - 400), i + max); }
  return t.length > max ? t.slice(0, max) + '\n…(recortado)…' : t;
}
function log(...a) { console.log('[agentes]', ...a); }

async function gh(path, opts = {}) {
  const r = await fetch(`https://api.github.com${path}`, { method: opts.method || 'GET', headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', 'User-Agent': 'agenticuantico-agentes' }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* texto */ }
  return { ok: r.ok, status: r.status, json, text };
}

/* ---------- GitHub Models ---------- */
export class ModelsUnavailable extends Error { constructor(status, detail) { super(`GitHub Models ${status}: ${detail}`); this.status = status; this.detail = detail; } }
const FALLBACK_ENDPOINT = 'https://models.inference.ai.azure.com/chat/completions';
async function postModel(url, model, messages, fetchFn) {
  return fetchFn(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
    body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 2500, response_format: { type: 'json_object' } })
  });
}
/** Llama a GitHub Models (endpoint principal y, si responde algo que no es JSON o 404, el endpoint alternativo). */
export async function callModel(messages, { fetchFn = fetch, retries = 2 } = {}) {
  const targets = [[ENDPOINT, MODEL], [FALLBACK_ENDPOINT, MODEL.replace(/^[^/]+\//, '')]];
  let last = null;
  for (const [url, model] of targets) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      let r, text;
      try { r = await postModel(url, model, messages, fetchFn); text = await r.text(); }
      catch (e) { last = new ModelsUnavailable(0, `${url} fetch failed: ${(e.cause && e.cause.code) || e.message}`); log(`modelo no disponible: ${last.message}`); break; }
      const ctype = (r.headers && r.headers.get && r.headers.get('content-type')) || '';
      let j = null; try { j = JSON.parse(text); } catch { /* no es JSON */ }
      if (r.ok && j && j.choices) return String(j.choices[0]?.message?.content || '');
      if (r.status === 429 && attempt < retries) {
        const wait = Math.min(60, Number(r.headers.get('retry-after')) || 20 * (attempt + 1));
        log(`límite de uso (429) en ${url}, reintento en ${wait}s`);
        await new Promise((res) => setTimeout(res, wait * 1000));
        continue;
      }
      last = new ModelsUnavailable(r.status, `${url} [${ctype}] ${text.slice(0, 300).replace(/\s+/g, ' ')}`);
      log(`modelo no disponible: ${last.message}`);
      if (r.status === 429) throw last;
      break;
    }
  }
  throw last || new ModelsUnavailable(0, 'sin respuesta');
}

export function parsePlan(raw) {
  const s = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const j = JSON.parse(s);
  const changes = Array.isArray(j.changes) ? j.changes : [];
  return { title: String(j.title || '').slice(0, 90), summary: String(j.summary || '').slice(0, 1200), changes };
}

/** Aplica cambios validados; devuelve lista de archivos tocados o lanza Error con el motivo. */
export function applyChanges(changes, { kind = KIND, maxFiles = MAX_FILES, root = '.' } = {}) {
  if (!changes.length) throw new Error('sin cambios');
  if (changes.length > maxFiles) throw new Error(`demasiados archivos (${changes.length} > ${maxFiles})`);
  const touched = [];
  for (const c of changes) {
    const p = normalize(String(c.path || '')).replace(/^\.\/+/, '');
    if (!pathAllowed(p, kind)) throw new Error(`ruta no permitida: ${p}`);
    const full = join(root, p);
    const payload = [c.content, c.replace, c.find].filter((x) => typeof x === 'string').join('\n');
    if (hasSecret(payload)) throw new Error(`contenido bloqueado por seguridad en ${p}`);
    if (kind === 'web' && unsafeWebContent([c.content, c.replace].filter(Boolean).join('\n'))) throw new Error(`HTML/JS no permitido en ${p}`);
    if (c.action === 'edit') {
      if (!existsSync(full)) throw new Error(`no existe ${p}`);
      const cur = readFileSync(full, 'utf8');
      const find = String(c.find || '');
      if (!find || find.length < 8) throw new Error(`edición sin texto a buscar en ${p}`);
      const n = cur.split(find).length - 1;
      if (n !== 1) throw new Error(`el texto a reemplazar aparece ${n} veces en ${p}`);
      writeFileSync(full, cur.replace(find, String(c.replace ?? '')));
    } else if (c.action === 'create') {
      if (existsSync(full)) throw new Error(`ya existe ${p}`);
      const content = String(c.content || '');
      if (!content.trim() || content.length > 12000) throw new Error(`contenido inválido para ${p}`);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content.endsWith('\n') ? content : content + '\n');
    } else throw new Error(`acción desconocida: ${c.action}`);
    touched.push(p);
  }
  return touched;
}

function systemPrompt(role, kind) {
  return [
    `Sos "${role.name}", un integrante del equipo de agentes de IA de AgentiCuántico (plataforma argentina de IA agéntica).`,
    `Tu foco: ${role.focus}.`,
    ...(ORDER ? [`Orden prioritaria del dueño (cumplila dentro de tus límites): ${ORDER}`] : []),
    'Proponé UNA mejora pequeña, concreta y verificable sobre los archivos que te muestro. Español rioplatense en textos visibles.',
    'Reglas estrictas:',
    `- Máximo ${MAX_FILES} archivos y ${MAX_LINES} líneas cambiadas en total.`,
    `- Solo podés tocar estas rutas: ${PROFILES[kind].allow.join(', ')}.`,
    '- Nunca toques workflows, .env, configuración de despliegue ni secretos. Nunca escribas claves, tokens, teléfonos ni datos personales.',
    kind === 'web' ? '- Sitio público: no agregues <script>, iframes, manejadores on*= ni URLs javascript:. Solo texto, HTML semántico, atributos ARIA y CSS.' : '- Preferí documentación del cerebro (brain/), prompts, pruebas y textos de UI.',
    '- Para editar un archivo existente usá {"action":"edit","path":...,"find":"texto EXACTO que aparece una sola vez","replace":"texto nuevo"}.',
    '- Para un archivo nuevo usá {"action":"create","path":...,"content":"..."} (máx. 12000 caracteres).',
    'Respondé SOLO un objeto JSON: {"title":"título corto de la PR","summary":"qué cambiaste y por qué (2-4 oraciones)","changes":[...]}.',
    'Si no hay una mejora segura, devolvé {"title":"","summary":"motivo","changes":[]}.'
  ].join('\n');
}

function userPrompt(role, kind, files) {
  const brain = kind === 'dev' ? readSafe('brain/README.md', 2500) : null;
  const parts = [`Fecha: ${TODAY}. Repositorio: ${REPO || '(local)'}.`];
  if (brain) parts.push(`--- brain/README.md ---\n${brain}`);
  for (const [p, t] of files) parts.push(`--- ${p} ---\n${t}`);
  return parts.join('\n\n');
}

async function ensureLabel(name) {
  const r = await gh(`/repos/${REPO}/labels/${encodeURIComponent(name)}`);
  if (r.ok) return;
  await gh(`/repos/${REPO}/labels`, { method: 'POST', body: { name, color: '9fff00', description: 'Propuesta de un agente de IA (requiere revisión humana)' } });
}

/** Descarta cambios del rol: restaura archivos versionados y borra solo los archivos nuevos que no son el resumen. */
function discard() {
  git('checkout', '-q', '--', '.');
  git('ls-files', '--others', '--exclude-standard').split('\n').filter((f) => f && f !== RESULT_FILE).forEach((f) => { try { sh('rm', ['-f', '--', f]); } catch { /* ignore */ } });
}

function diffStats() {
  const out = git('diff', '--numstat');
  let lines = 0, files = 0;
  for (const l of out.split('\n').filter(Boolean)) { const [a, d, f] = l.split('\t'); if (/brain\/journal\//.test(f)) continue; files++; lines += (Number(a) || 0) + (Number(d) || 0); }
  return { lines, files };
}

async function runRole(role, base) {
  const prof = PROFILES[KIND];
  const files = (prof.context[role.id] || []).map((p) => [p.split('#')[0], readSafe(p)]).filter(([, t]) => t != null);
  const rec = { role: role.id, name: role.name, emoji: role.emoji, at: new Date().toISOString(), status: 'skipped', title: '', summary: '', pr: null };
  if (!files.length) { rec.summary = 'Sin archivos de contexto disponibles.'; return rec; }
  git('checkout', '-q', base);
  git('reset', '-q', '--hard', `origin/${base}`);
  let plan;
  try {
    const raw = await callModel([{ role: 'system', content: systemPrompt(role, KIND) }, { role: 'user', content: userPrompt(role, KIND, files) }]);
    plan = parsePlan(raw);
  } catch (e) {
    if (e instanceof ModelsUnavailable) throw e;
    rec.status = 'invalid'; rec.summary = `Respuesta del modelo inválida: ${String(e.message).slice(0, 160)}`; return rec;
  }
  rec.title = plan.title; rec.summary = plan.summary;
  if (!plan.changes.length) { rec.status = 'no-change'; return rec; }
  let touched;
  try { touched = applyChanges(plan.changes); } catch (e) { discard(); rec.status = 'rejected'; rec.summary = `Cambio rechazado por las reglas: ${e.message}`; return rec; }
  const st = diffStats();
  const untracked = git('ls-files', '--others', '--exclude-standard').split('\n').filter((f) => f && f !== RESULT_FILE && !/brain\/journal\//.test(f));
  const newLines = untracked.reduce((n, f) => n + readFileSync(f, 'utf8').split('\n').length, 0);
  if (st.lines + newLines > MAX_LINES) { discard(); rec.status = 'rejected'; rec.summary = `Cambio rechazado: ${st.lines + newLines} líneas > ${MAX_LINES}.`; return rec; }
  if (prof.journal) {
    const jp = `brain/journal/${TODAY}.md`;
    mkdirSync(dirname(jp), { recursive: true });
    const head = existsSync(jp) ? '' : `# Diario del equipo de agentes · ${TODAY}\n\n`;
    writeFileSync(jp, (existsSync(jp) ? readFileSync(jp, 'utf8') : head) + `## ${new Date().toISOString().slice(11, 16)} UTC · ${role.emoji} ${role.name}\n\n**${plan.title || 'Mejora'}**\n\n${plan.summary}\n\nArchivos: ${touched.map((t) => '`' + t + '`').join(', ')}\n\n`);
  }
  if (DRY) { rec.status = 'dry-run'; rec.files = touched; discard(); return rec; }
  const branch = `agente/${role.id}/${TODAY}-${RUN_NO}`;
  git('checkout', '-q', '-b', branch);
  git('add', '-A', '--', ...touched, ...(prof.journal ? ['brain/journal'] : []));
  git('-c', 'user.name=agentes-agenticuantico[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com', 'commit', '-q', '-m', `${role.name}: ${plan.title || 'mejora'}`.slice(0, 100));
  git('push', '-q', 'origin', branch);
  const label = `agente/${role.id}`;
  await ensureLabel(label);
  const body = `### ${role.emoji} ${role.name}\n\n${plan.summary}\n\n**Archivos:** ${touched.map((t) => '`' + t + '`').join(', ')}\n\n---\nPropuesta automática del equipo de agentes (modelo \`${MODEL}\`). Límite: ${MAX_FILES} archivos / ${MAX_LINES} líneas. Requiere revisión y aprobación humana antes del merge.`;
  const pr = await gh(`/repos/${REPO}/pulls`, { method: 'POST', body: { title: `[${role.name}] ${plan.title || 'Mejora'}`.slice(0, 120), head: branch, base, body, maintainer_can_modify: true } });
  if (!pr.ok) { rec.status = 'pr-failed'; rec.summary += ` (No se pudo abrir la PR: ${pr.status} ${pr.json?.message || ''})`; return rec; }
  await gh(`/repos/${REPO}/issues/${pr.json.number}/labels`, { method: 'POST', body: { labels: [label, 'agentes'] } });
  rec.status = 'pr-opened'; rec.pr = pr.json.html_url; rec.files = touched;
  if (AUTO_MERGE) {
    const m = await gh(`/repos/${REPO}/pulls/${pr.json.number}/merge`, { method: 'PUT', body: { merge_method: 'squash' } });
    rec.merged = m.ok;
  }
  git('checkout', '-q', base);
  return rec;
}

export async function main() {
  const base = env.AGENTS_BASE || (env.GITHUB_REF_NAME && !env.GITHUB_REF_NAME.startsWith('agente/') ? env.GITHUB_REF_NAME : 'main');
  const roles = pickRoles(RUN_NO, PER_RUN, env.AGENTS_ONLY_ROLE).filter((r) => !DISABLED.includes(r.id));
  const result = { at: new Date().toISOString(), repo: REPO, kind: KIND, model: MODEL, run: RUN_NO, status: 'ok', roles: [] };
  log(`perfil=${KIND} modelo=${MODEL} roles=${roles.map((r) => r.id).join(',')} dry=${DRY} automerge=${AUTO_MERGE}`);
  if (!TOKEN) { result.status = 'no-token'; log('Sin GITHUB_TOKEN: no-op.'); }
  else {
    try { git('fetch', '-q', 'origin', base); } catch (e) { log('fetch falló:', e.message); }
    for (const role of roles) {
      try {
        const rec = await runRole(role, base);
        log(`${role.id}: ${rec.status}${rec.pr ? ' → ' + rec.pr : ''} · ${rec.summary.slice(0, 160)}`);
        result.roles.push(rec);
      } catch (e) {
        if (e instanceof ModelsUnavailable) {
          result.status = e.status === 429 ? 'rate-limited' : 'models-unavailable';
          result.error = `${e.status} ${e.detail}`;
          console.log(`::warning::GitHub Models no disponible (${e.status}): ${e.detail}`);
          result.roles.push({ role: role.id, name: role.name, emoji: role.emoji, at: new Date().toISOString(), status: result.status, summary: 'Esperando acceso al modelo.' });
          break;
        }
        log(`${role.id}: error ${e.message}`);
        result.roles.push({ role: role.id, name: role.name, emoji: role.emoji, at: new Date().toISOString(), status: 'error', summary: String(e.message).slice(0, 200) });
      }
    }
  }
  writeFileSync(RESULT_FILE, JSON.stringify(result, null, 2));
  if (env.GITHUB_STEP_SUMMARY) {
    const lines = [`## Equipo de agentes · ${result.at}`, '', `Modelo: \`${MODEL}\` · estado: **${result.status}**${result.error ? ' · `' + result.error.slice(0, 200) + '`' : ''}`, '', '| Rol | Resultado | PR |', '|---|---|---|', ...result.roles.map((r) => `| ${r.emoji || ''} ${r.name} | ${r.status} | ${r.pr || '—'} |`)];
    writeFileSync(env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n', { flag: 'a' });
  }
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.log(`::warning::Equipo de agentes: ${e.message}`); try { writeFileSync(RESULT_FILE, JSON.stringify({ at: new Date().toISOString(), status: 'error', error: String(e.message) })); } catch { /* ignore */ } process.exit(0); });
}
