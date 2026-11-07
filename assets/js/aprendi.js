/** /aprendi/: «Qué aprendí hoy» — lee GET /api/kb/today (público, solo fuentes abiertas) y lo muestra. */
import { CONFIG } from './config.js';
import { h } from './ui.js';

const base = String(CONFIG.API_BASE || '').replace(/\/+$/, '');
const NAMES = {
  'wikipedia-es': 'Wikipedia en español', 'gob-economia': 'Argentina.gob.ar · Economía', 'gob-salud': 'Argentina.gob.ar · Salud', 'gob-capital-humano': 'Argentina.gob.ar · Capital Humano',
  bcra: 'BCRA · Principales variables', dolarapi: 'DolarApi', jobicy: 'Jobicy · empleo remoto'
};
const STATUS = { ok: 'Leída', pending: 'Pendiente', skipped: 'Salteada', error: 'No respondió' };
const DETAIL = {
  robots_disallow: 'su robots.txt no lo permite', content_signal: 'pidió no usarse con IA', daily_write_cap: 'tope diario alcanzado',
  no_items: 'sin novedades', robots_unreachable: 'no pude leer su robots.txt', unknown_source: 'fuente desconocida'
};
const $ = (s) => document.querySelector(s);
const state = (txt, kind = '') => { const el = $('#kbState'); el.textContent = txt; el.className = 'kb-state' + (kind ? ' ' + kind : ''); el.hidden = !txt; };
const fmtDate = (v) => { const t = typeof v === 'number' ? v : Date.parse(v); return Number.isFinite(t) ? new Date(t).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }) : ''; };
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

function render(d) {
  const ok = (d.runs || []).filter((r) => r.status === 'ok').length;
  const set = (k, v) => { const el = document.querySelector(`#kbStats [data-k="${k}"]`); if (el) el.textContent = v; };
  set('new', String((d.learned || []).length)); set('sources', String(ok)); set('total', String(d.total || 0));
  set('votes', `${d.feedback?.up || 0} / ${d.feedback?.down || 0}`);
  const list = $('#kbList'); list.textContent = '';
  const groups = new Map();
  for (const it of d.learned || []) { if (!groups.has(it.source)) groups.set(it.source, []); groups.get(it.source).push(it); }
  const SHOW = 4;
  for (const [src, items] of groups) {
    const ul = h('ul', { id: 'kb-' + src }, ...items.map((it, i) => h('li', { class: 'kb-item', hidden: i >= SHOW ? '' : null },
        h('a', { href: it.url, target: '_blank', rel: 'noopener noreferrer nofollow', 'data-no-i18n': '' }, it.title),
        h('p', { 'data-no-i18n': '' }, it.summary),
        h('small', { 'data-no-i18n': '' }, [it.license, fmtDate(it.sourceDate || it.fetchedAt), host(it.url)].filter(Boolean).join(' · ')))));
    const more = items.length > SHOW ? h('button', { class: 'kb-more', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'kb-' + src, onclick: (e) => {
      const open = e.currentTarget.getAttribute('aria-expanded') !== 'true';
      ul.querySelectorAll('.kb-item').forEach((li, i) => { if (i >= SHOW) li.hidden = !open; });
      e.currentTarget.setAttribute('aria-expanded', String(open));
      e.currentTarget.textContent = open ? 'Ver menos' : `Ver ${items.length - SHOW} más`;
    } }, `Ver ${items.length - SHOW} más`) : null;
    list.append(h('section', { class: 'kb-group', 'aria-label': NAMES[src] || src },
      h('h2', { class: 'kb-gt' }, NAMES[src] || src, h('span', { class: 'kb-count' }, ` · ${items.length}`)), ul, more));
  }
  const tb = $('#kbRuns tbody'); tb.textContent = '';
  for (const r of d.runs || []) {
    const why = r.detail ? (DETAIL[r.detail] || (/^http_/.test(r.detail) ? 'la fuente no respondió' : '')) : '';
    tb.append(h('tr', {}, h('td', {}, NAMES[r.source] || r.source), h('td', {}, STATUS[r.status] || r.status, why ? h('small', {}, ` (${why})`) : null), h('td', {}, String(r.added || 0))));
  }
  if (!(d.runs || []).length) tb.append(h('tr', {}, h('td', { colspan: '3' }, 'La lectura diaria empieza a las 6:00 (hora de Argentina).')));
  state((d.learned || []).length ? '' : 'Todavía no aprendí nada nuevo hoy. La lectura diaria empieza a las 6:00 (hora de Argentina) y sigue de a una fuente cada 15 minutos.', (d.learned || []).length ? '' : 'empty');
}

async function load() {
  if (!base) { state('La base de conocimiento no está disponible en esta copia del sitio.', 'error'); return; }
  try {
    const r = await fetch(base + '/api/kb/today', { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    const d = await r.json();
    if (!d.enabled) { state('La base de conocimiento todavía no está activa.', 'empty'); return; }
    render(d);
  } catch { state('No pude cargar la base ahora. Probá de nuevo en unos minutos.', 'error'); }
}
load();
