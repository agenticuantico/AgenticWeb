/**
 * Computadora del agente en el chat: textos de la línea de estado y del resumen final (sin DOM, se prueba con vitest).
 * Una sola línea debajo de la pantalla: «Recorriendo dominio…», «Leyendo dominio…», «Escribiendo…», etc.
 */

export const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

const TYPING = /(escrib|complet|tipe|redact|cargu[eé] el texto|llen)/i;
const READ_LABEL = /^(Leer|Leí|Leo)\s+(.+)$/i;

/**
 * @param {any} s estado público de la sesión (worker: publicState + image)
 * @returns {{ text: string, kind: 'run'|'wait'|'you'|'ok'|'off', mode: 'browser'|'reader'|null }}
 */
export function statusLine(s) {
  if (!s || !s.status) return { text: 'Encendiendo la computadora…', kind: 'run', mode: null };
  const browser = s.mode === 'browser';
  const mode = browser ? 'browser' : 'reader';
  const host = s.host || hostOf(s.url) || (s.reader && s.reader.host) || '';
  const steps = Array.isArray(s.steps) ? s.steps : [];
  const cur = [...steps].reverse().find((x) => x.status === 'running') || steps[steps.length - 1];
  switch (s.status) {
    case 'starting': return { text: 'Encendiendo la computadora…', kind: 'run', mode };
    case 'queued': return { text: `En fila para un navegador · puesto ${(s.queue && s.queue.position) || 1}`, kind: 'wait', mode };
    case 'thinking': return { text: 'Pensando el siguiente paso…', kind: 'run', mode };
    case 'awaiting_approval': return { text: 'Esperando tu aprobación', kind: 'wait', mode };
    case 'needs_user': return { text: s.ask && s.ask.kind === 'login' ? `Necesito que inicies sesión${host ? ' en ' + host : ''}` : 'Necesito tu ayuda para seguir', kind: 'wait', mode };
    case 'takeover': return { text: 'Tenés el control', kind: 'you', mode };
    case 'done': return { text: 'Listo', kind: 'ok', mode };
    case 'ended': return { text: 'Detenida', kind: 'off', mode };
    case 'error': return { text: 'No disponible', kind: 'off', mode };
    default: break;
  }
  // ready / acting
  if (cur && cur.status === 'running' && TYPING.test(cur.label || '')) return { text: 'Escribiendo…', kind: 'run', mode };
  if (!browser) {
    const r = s.reader || {};
    if (r.kind === 'results' && r.query) return { text: `Buscando «${String(r.query).slice(0, 48)}»…`, kind: 'run', mode };
    const rl = cur && READ_LABEL.exec(cur.label || '');
    const h = (r.kind === 'page' && r.host) || (rl && rl[2].split(',')[0].trim()) || host;
    return { text: h ? `Leyendo ${h}…` : 'Leyendo…', kind: 'run', mode };
  }
  return { text: host ? `Recorriendo ${host}…` : 'Recorriendo la web…', kind: 'run', mode };
}

/** Sitios que visitó (dirección actual, fuentes y pasos «Leer …»), sin repetir, en orden. */
export function visitedSites(s) {
  const out = [];
  const add = (h) => { h = String(h || '').trim().replace(/^www\./, '').toLowerCase(); if (h && /\./.test(h) && !out.includes(h) && out.length < 12) out.push(h); };
  for (const st of (s && s.steps) || []) { const m = READ_LABEL.exec(st.label || ''); if (m) m[2].split(',').forEach(add); }
  for (const x of (s && s.sources) || []) add(hostOf(x.url));
  if (s && s.url) add(hostOf(s.url));
  return out;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Pasos que cuentan como trabajo (no los avisos internos). */
export function workSteps(s) {
  return ((s && s.steps) || []).filter((x) => x.status !== 'skipped' && !/^(Tarea terminada|Nuevo pedido|Sigo con la tarea|Retomé la tarea|La sesión se cerró|Archivada por inactividad)$/.test(x.label || ''));
}

/** «5 pasos · 2 sitios» para el resumen plegado. */
export function summaryMeta(s) {
  const n = workSteps(s).length;
  const sites = visitedSites(s).length;
  return [plural(n, 'paso', 'pasos'), sites ? plural(sites, 'sitio', 'sitios') : null].filter(Boolean).join(' · ');
}

/** Cómo se trabajó: navegador real o modo lectura (honesto cuando no quedan minutos). */
export function workMode(s) {
  if (!s) return { label: 'Modo lectura', note: '' };
  if (s.mode === 'browser') return { label: 'Navegador real', note: '' };
  const left = Math.max(s.browserLeftMs || 0, s.remoteLeftMs || 0);
  const noMinutes = s.notice === 'light_fallback' || !!s.browserBlocked || (typeof s.browserLeftMs === 'number' && left <= 0);
  return { label: 'Modo lectura', note: noMinutes ? 'Sin minutos de navegador hoy: leo las páginas como texto.' : 'Leo las páginas como texto (más rápido, sin gastar minutos).' };
}
