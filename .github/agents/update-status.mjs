#!/usr/bin/env node
/*
 * Actualiza agents-status.json (solo datos públicos) con la última actividad de cada agente del sitio.
 * Fuentes: el resumen de la última ejecución (agents-run.json) y las PR con etiqueta agente/<rol>.
 * Nunca publica rutas internas ni contenido de repositorios privados.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { ROLES_BY_KIND } from './run-agents.mjs';

const env = process.env;
const FILE = env.STATUS_FILE || 'agents-status.json';
const RUN = env.AGENTS_RESULT_FILE || 'agents-run.json';
const REPO = env.GITHUB_REPOSITORY || '';
const TOKEN = env.GITHUB_TOKEN || '';
const ROLES = ROLES_BY_KIND.web;
const ROLE_INFO = {
  corrector: 'Ortografía y errores de tipeo',
  enlaces: 'Enlaces internos que funcionan',
  accesibilidad: 'Textos alternativos y nombres accesibles',
  rendimiento: 'Carga diferida de imágenes',
  'ux-textos': 'Propone textos más claros',
  'diseno-web': 'Propone ajustes de CSS responsive',
  seo: 'Propone títulos y descripciones'
};

export function describe(rec) {
  const t = String(rec.title || '').slice(0, 90);
  switch (rec.status) {
    case 'auto-published': return `Publicó un arreglo chico verificado: ${t || 'corrección'}.`;
    case 'reverted': return 'Un arreglo no pasó la verificación en vivo y se deshizo solo.';
    case 'pr-opened': return `Propuso una mejora: ${t || 'cambio pequeño'} (espera aprobación).`;
    case 'no-change': return 'Revisó su área y no encontró nada para arreglar.';
    case 'skipped': return 'Tiene una propuesta esperando aprobación.';
    case 'rejected': return 'Descartó un cambio que no pasó las pruebas o las reglas.';
    case 'dry-run': return `Ensayo sin publicar: ${t || 'mejora'}.`;
    case 'paused': return 'En pausa desde el panel.';
    case 'rate-limited': return 'Esperando cupo del modelo; sigue en la próxima ronda.';
    case 'model-unavailable': return 'El modelo no respondió; sigue en la próxima ronda.';
    case 'pr-failed': return 'No pudo abrir la propuesta; reintenta en la próxima ronda.';
    case 'invalid': return 'La respuesta del modelo no fue válida; reintenta en la próxima ronda.';
    default: return 'Preparando su próxima tarea.';
  }
}

export function merge(current, run, prs, now = Date.now()) {
  const byId = Object.fromEntries((current.agents || []).map((a) => [a.id, a]));
  const agents = ROLES.map((r) => {
    const prev = byId[r.id] || {};
    const a = { id: r.id, name: r.name, role: ROLE_INFO[r.id] || '', emoji: r.emoji, auto: !!r.auto, status: prev.status || 'espera', last_activity: prev.last_activity || 'Listo para su primera ronda.', last_run: prev.last_run || null, pr: prev.pr || null };
    const rec = (run && Array.isArray(run.roles) ? run.roles : []).find((x) => x.role === r.id);
    if (rec) { a.last_activity = describe(rec); a.last_run = rec.at || run.at; a.pr = rec.pr && /github\.com\/agenticuantico\/AgenticWeb\//.test(rec.pr) ? rec.pr : null; }
    const pr = (prs || []).filter((p) => (p.labels || []).some((l) => l.name === `agente/${r.id}`)).sort((x, y) => Date.parse(y.created_at) - Date.parse(x.created_at))[0];
    const openPr = pr && pr.state === 'open';
    const fresh = a.last_run && now - Date.parse(a.last_run) < 7 * 3600e3;
    a.status = openPr ? 'revision' : fresh && rec && /auto-published|pr-opened|no-change|dry-run/.test(rec.status) ? 'activo' : 'espera';
    return a;
  });
  return { updated: new Date(now).toISOString(), source: 'agentes-24-7', note: 'Estado público del equipo de agentes del sitio. Lo actualiza el workflow Agentes 24/7 (solo datos).', agents };
}

async function listPrs() {
  if (!TOKEN || !REPO) return [];
  const r = await fetch(`https://api.github.com/repos/${REPO}/pulls?state=all&per_page=50&sort=created&direction=desc`, { headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'agenticuantico-agentes' } });
  if (!r.ok) return [];
  const j = await r.json();
  return Array.isArray(j) ? j.filter((p) => (p.labels || []).some((l) => /^agente\//.test(l.name))) : [];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const current = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : { agents: [] };
  const run = existsSync(RUN) ? JSON.parse(readFileSync(RUN, 'utf8')) : null;
  const prs = await listPrs().catch(() => []);
  const next = merge(current, run, prs);
  writeFileSync(FILE, JSON.stringify(next, null, 2) + '\n');
  console.log(`[estado] ${next.agents.map((a) => `${a.id}:${a.status}`).join(' ')}`);
}
