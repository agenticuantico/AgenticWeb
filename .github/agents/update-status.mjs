#!/usr/bin/env node
/*
 * Actualiza agents-status.json (solo datos públicos) con la última actividad de cada agente.
 * Fuentes: el resumen de la última ejecución (agents-run.json) y las PRs con etiqueta agente/<rol>.
 * Nunca publica rutas internas ni contenido de repositorios privados.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { ROLES } from './run-agents.mjs';

const env = process.env;
const FILE = env.STATUS_FILE || 'agents-status.json';
const RUN = env.AGENTS_RESULT_FILE || 'agents-run.json';
const REPO = env.GITHUB_REPOSITORY || '';
const TOKEN = env.GITHUB_TOKEN || '';
const ROLE_INFO = {
  'programador-fullstack': 'Integra frontend, backend y pruebas',
  frontend: 'Interfaz, accesibilidad y rendimiento',
  backend: 'API, datos y seguridad',
  'ux-ui': 'Flujos, textos y usabilidad',
  'disenador-grafico': 'Identidad visual y piezas',
  'disenador-web': 'Maquetación responsive y CSS',
  ilustrador: 'Ilustraciones e íconos SVG',
  'disenador-3d': 'Modelos GLB y escenas WebGL'
};

export function describe(rec) {
  const t = String(rec.title || '').slice(0, 90);
  switch (rec.status) {
    case 'pr-opened': return `Propuso una mejora: ${t || 'cambio pequeño'} (en revisión).`;
    case 'no-change': return 'Revisó su área y no encontró cambios necesarios.';
    case 'rejected': return 'Descartó una propuesta que no cumplía las reglas de seguridad.';
    case 'dry-run': return `Ensayo sin publicar: ${t || 'mejora'}.`;
    case 'models-unavailable': return 'En espera: el modelo de IA no está disponible en este momento.';
    case 'rate-limited': return 'En espera por límite de uso del modelo; reintenta en la próxima ronda.';
    case 'pr-failed': return 'Preparó una mejora pero no pudo abrir la PR; reintenta en la próxima ronda.';
    case 'invalid': return 'La respuesta del modelo no fue válida; reintenta en la próxima ronda.';
    default: return 'Preparando su próxima tarea.';
  }
}

export function merge(current, run, prs, now = Date.now()) {
  const byId = Object.fromEntries((current.agents || []).map((a) => [a.id, a]));
  const agents = ROLES.map((r) => {
    const prev = byId[r.id] || {};
    const a = { id: r.id, name: r.name, role: ROLE_INFO[r.id] || prev.role || '', emoji: r.emoji, status: prev.status || 'espera', last_activity: prev.last_activity || 'Listo para su primera tarea programada.', last_run: prev.last_run || null, pr: prev.pr || null };
    const rec = (run && Array.isArray(run.roles) ? run.roles : []).find((x) => x.role === r.id);
    if (rec) { a.last_activity = describe(rec); a.last_run = rec.at || run.at; a.pr = rec.pr && /github\.com\/agenticuantico\/AgenticWeb\//.test(rec.pr) ? rec.pr : null; }
    const pr = (prs || []).filter((p) => (p.labels || []).some((l) => l.name === `agente/${r.id}`)).sort((x, y) => Date.parse(y.created_at) - Date.parse(x.created_at))[0];
    if (pr && (!a.last_run || Date.parse(pr.created_at) > Date.parse(a.last_run))) { a.last_activity = `Propuso una mejora: ${String(pr.title).replace(/^\[[^\]]+\]\s*/, '').slice(0, 90)} (en revisión).`; a.last_run = pr.created_at; a.pr = pr.html_url; }
    const openPr = pr && pr.state === 'open';
    const fresh = a.last_run && now - Date.parse(a.last_run) < 6 * 3600e3;
    a.status = openPr ? 'revision' : fresh && rec && /pr-opened|no-change|rejected|dry-run/.test(rec.status) ? 'activo' : 'espera';
    return a;
  });
  return { updated: new Date(now).toISOString(), source: 'agentes-24-7', note: 'Estado público del equipo de agentes. Lo actualiza el workflow Agentes 24/7 (solo datos).', agents };
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
