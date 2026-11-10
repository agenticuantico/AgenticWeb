/**
 * /admin/ → «Analítica» (solo el dueño). Datos reales del servidor (GET /api/panel/analytics):
 * vistas y visitantes por día, países con bandera y mapa, quién está ahora (últimos 5 min), páginas, dispositivo,
 * navegador, sistema, origen y horario. Todo agregado: sin IP ni datos personales. Sin datos = «Todavía sin datos».
 */
import { h, icon, esc } from './ui.js';
import { api } from './admin-staff.js';

const PALETTE = ['#2563eb', '#7c3aed', '#ea580c', '#0d9488', '#db2777', '#15803d', '#b45309', '#0284c7', '#dc2626', '#4f46e5', '#65a30d', '#9333ea'];
const DEVICE = { mobile: ['Teléfono', '#2563eb'], desktop: ['Computadora', '#7c3aed'], tablet: ['Tablet', '#ea580c'] };
const BROWSER_C = { Chrome: '#2563eb', Safari: '#0284c7', Firefox: '#ea580c', Edge: '#0d9488', Samsung: '#7c3aed', Opera: '#dc2626', Otro: '#64748b' };
const OS_C = { Android: '#15803d', iOS: '#334155', Windows: '#2563eb', macOS: '#7c3aed', Linux: '#b45309', ChromeOS: '#0d9488', Otro: '#64748b' };
const EMPTY = 'Todavía sin datos';
const nf = new Intl.NumberFormat('es-AR');
const CC = new Intl.DisplayNames(['es'], { type: 'region' });
export const ccName = (cc) => { if (!cc || cc === 'XX') return 'Desconocido'; try { return CC.of(cc) || cc; } catch { return cc; } };
export const flagSrc = (cc) => `/assets/flags/${/^[A-Z]{2}$/.test(cc || '') && cc !== 'XX' ? cc.toLowerCase() : 'xx'}.svg`;
const pageLabel = (k) => (k === 'inicio' ? 'Inicio (/)' : k === 'otra' ? 'Otra' : '/' + String(k).replace(/_/g, '/'));
const refLabel = (k) => (k === 'directo' ? 'Directo / sin origen' : String(k).replace(/_/g, '.'));
const sorted = (o) => Object.entries(o || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
const total = (o) => Object.values(o || {}).reduce((a, v) => a + (Number(v) || 0), 0);
const pct = (v, t) => (t ? Math.round((v / t) * 100) : 0);
const hhmm = (t) => new Date(t).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Argentina/Buenos_Aires' });
const dm = (d) => d.slice(8, 10) + '/' + d.slice(5, 7);

/** Barras horizontales de colores; con bandera si `flags`. */
export function colorBars(entries, { labeler = (k) => k, colorOf = (_k, i) => PALETTE[i % PALETTE.length], flags = false, max = 8, sum } = {}) {
  const list = entries.slice(0, max);
  if (!list.length) return `<p class="an-empty">${EMPTY}</p>`;
  const t = sum || list.reduce((a, [, v]) => a + v, 0) || 1;
  const top = list[0][1] || 1;
  return '<ul class="an-bars">' + list.map(([k, v], i) => {
    const c = colorOf(k, i);
    return `<li><span class="an-bar-label">${flags ? `<img class="an-flag" src="${flagSrc(k)}" alt="" width="22" height="16" loading="lazy" decoding="async">` : `<i class="an-dot" style="background:${c}"></i>`}<span>${esc(labeler(k))}</span></span>`
      + `<span class="an-track" aria-hidden="true"><i style="width:${Math.max(3, (v / top) * 100).toFixed(1)}%;background:${c}"></i></span>`
      + `<span class="an-val">${nf.format(v)} <small>${pct(v, t)}%</small></span></li>`;
  }).join('') + '</ul>';
}

/** Dona con total al centro y leyenda con porcentajes. */
export function donutChart(entries, { labelOf = (k) => k, colorOf = (_k, i) => PALETTE[i % PALETTE.length], title = 'Distribución' } = {}) {
  const t = entries.reduce((a, [, v]) => a + v, 0);
  if (!t) return `<p class="an-empty">${EMPTY}</p>`;
  const r = 50, c = 2 * Math.PI * r; let acc = 0;
  const segs = entries.map(([k, v], i) => { const len = (v / t) * c; const s = `<circle r="${r}" cx="70" cy="70" fill="none" stroke="${colorOf(k, i)}" stroke-width="24" stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}" transform="rotate(-90 70 70)"><title>${esc(labelOf(k))}: ${nf.format(v)}</title></circle>`; acc += len; return s; }).join('');
  const aria = entries.map(([k, v]) => `${labelOf(k)} ${pct(v, t)}%`).join(', ');
  return `<div class="an-donut"><svg viewBox="0 0 140 140" role="img" aria-label="${esc(title + ': ' + aria)}">${segs}<text x="70" y="68" text-anchor="middle" class="an-donut-n">${nf.format(t)}</text><text x="70" y="86" text-anchor="middle" class="an-donut-s">total</text></svg>`
    + `<ul>${entries.map(([k, v], i) => `<li><i style="background:${colorOf(k, i)}"></i><span>${esc(labelOf(k))}</span><b>${pct(v, t)}%</b><small>${nf.format(v)}</small></li>`).join('')}</ul></div>`;
}

/** Área doble (vistas y visitantes) por día. */
function trendChart(series, width = 720) {
  if (!series.some((p) => p.views || p.visitors)) return `<p class="an-empty">${EMPTY}</p>`;
  const w = Math.round(width), hh = w < 520 ? 190 : 240, px = 34, py = 18;
  const max = Math.max(1, ...series.map((p) => p.views));
  const x = (i) => px + (i * (w - px * 2)) / Math.max(1, series.length - 1);
  const y = (v) => hh - py - 18 - (v / max) * (hh - py * 2 - 18);
  const path = (k) => series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join('');
  const area = (k) => `${path(k)}L${x(series.length - 1).toFixed(1)},${y(0).toFixed(1)}L${x(0).toFixed(1)},${y(0).toFixed(1)}Z`;
  const ticks = [0, Math.round(max / 2), max];
  const step = Math.ceil(series.length / (w < 520 ? 4 : 8));
  const single = series.length === 1;
  return `<svg viewBox="0 0 ${w} ${hh}" class="an-trend" role="img" aria-label="Vistas y visitantes por día: ${series.reduce((a, p) => a + p.views, 0)} vistas en total">
    <defs><linearGradient id="anV" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#2563eb" stop-opacity=".32"/><stop offset="1" stop-color="#2563eb" stop-opacity="0"/></linearGradient>
    <linearGradient id="anU" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#7c3aed" stop-opacity=".28"/><stop offset="1" stop-color="#7c3aed" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map((t) => `<line x1="${px}" x2="${w - px}" y1="${y(t)}" y2="${y(t)}" class="an-grid"/><text x="${px - 6}" y="${y(t) + 4}" text-anchor="end" class="an-axis">${nf.format(t)}</text>`).join('')}
    ${single ? '' : `<path d="${area('views')}" fill="url(#anV)"/><path d="${area('visitors')}" fill="url(#anU)"/>
    <path d="${path('views')}" fill="none" stroke="#2563eb" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="${path('visitors')}" fill="none" stroke="#7c3aed" stroke-width="2.2" stroke-dasharray="5 4" stroke-linejoin="round"/>`}
    ${series.map((p, i) => `<g><circle cx="${single ? w / 2 : x(i)}" cy="${y(p.views)}" r="${single ? 7 : 3.4}" fill="#2563eb"><title>${dm(p.day)}: ${p.views} vistas · ${p.visitors} visitantes</title></circle></g>`).join('')}
    ${series.map((p, i) => (i % step === 0 || i === series.length - 1 ? `<text x="${single ? w / 2 : x(i)}" y="${hh - 6}" text-anchor="middle" class="an-axis">${dm(p.day)}</text>` : '')).join('')}</svg>
    <p class="an-legend"><span><i style="background:#2563eb"></i>Vistas</span><span><i class="dash" style="border-color:#7c3aed"></i>Visitantes</span></p>`;
}

/** Columnas por hora (convertidas de UTC a hora de Argentina, UTC−3). */
function hoursChart(hourUTC) {
  const ar = Array.from({ length: 24 }, (_, i) => Number((hourUTC || {})[String((i + 3) % 24).padStart(2, '0')] || 0));
  const m = Math.max(...ar);
  if (!m) return `<p class="an-empty">${EMPTY}</p>`;
  const peak = ar.indexOf(m);
  return `<div class="an-hours" role="img" aria-label="Visitas por hora de Argentina; pico a las ${peak} h">${ar.map((v, i) => `<i style="height:${Math.max(3, (v / m) * 100)}%;background:hsl(${220 - (i / 23) * 190} 75% ${i === peak ? 42 : 50}%)" title="${i} h: ${v}"></i>`).join('')}</div>
    <div class="an-hours-axis"><span>0 h</span><span>6 h</span><span>12 h</span><span>18 h</span><span>23 h</span></div>
    <p class="an-note">Pico: <b>${peak} h</b> (hora de Argentina) · ${nf.format(m)} vistas</p>`;
}

let worldP;
async function worldMap(counts, { live = false } = {}) {
  worldP = worldP || fetch('/assets/data/world.json').then((r) => r.json());
  const w = await worldP;
  const max = Math.max(1, ...Object.values(counts || {}));
  const fill = (v) => { if (!v) return '#e8ebf2'; const t = Math.sqrt(v / max); return live ? `color-mix(in srgb, #16a34a ${Math.round(35 + t * 65)}%, #dcfce7)` : `color-mix(in srgb, #4338ca ${Math.round(25 + t * 75)}%, #dbeafe)`; };
  return `<svg viewBox="${w.viewBox}" class="an-world" role="img" aria-label="Mapa de ${live ? 'visitantes en vivo' : 'visitas'} por país">${Object.entries(w.paths).map(([cc, d]) => `<path d="${d}" fill="${fill((counts || {})[cc] || 0)}"><title>${esc(ccName(cc))}: ${nf.format((counts || {})[cc] || 0)}</title></path>`).join('')}</svg>`;
}

function trendChip(cur, prev) {
  if (!prev && !cur) return h('span', { class: 'an-trend-chip flat' }, 'sin cambios');
  if (!prev) return h('span', { class: 'an-trend-chip up' }, 'nuevo');
  const d = Math.round(((cur - prev) / prev) * 100);
  return h('span', { class: 'an-trend-chip ' + (d > 0 ? 'up' : d < 0 ? 'down' : 'flat') }, (d > 0 ? '▲ +' : d < 0 ? '▼ ' : '') + d + '% vs. período anterior');
}

function tile(label, value, sub, cls, ic) {
  return h('div', { class: 'an-tile ' + cls }, h('span', { class: 'an-tile-ic', html: icon(ic) }), h('div', {}, h('small', {}, label), h('strong', {}, value), sub || null));
}
const card = (title, cls = '', extra = null) => h('section', { class: 'card panel an-card ' + cls }, h('div', { class: 'panel-head' }, h('h2', {}, title), extra));

export async function renderAnalytics(box, token) {
  let days = Number(sessionStorage.getItem('ac.an.days') || 30) || 30;
  let liveTimer = null;
  const seg = h('div', { class: 'seg seg-sm an-seg', role: 'tablist', 'aria-label': 'Período' });
  const stamp = h('span', { class: 'muted small' }, '');
  const refresh = h('button', { class: 'btn btn-sm', type: 'button', html: icon('refresh') + 'Actualizar' });
  const head = h('div', { class: 'admin-head sub an-head' }, h('div', {}, h('h2', {}, 'Analítica del sitio'), h('p', { class: 'muted small' }, 'Países, en vivo, páginas y dispositivos. Datos agregados: sin IP ni datos personales.')), h('div', { class: 'row' }, seg, stamp, refresh));
  const body = h('div', { class: 'stack-lg' }, h('div', { class: 'skeleton', style: 'height:320px' }));
  box.replaceChildren(head, body);
  for (const [d, l] of [[1, 'Hoy'], [7, '7 días'], [30, '30 días'], [90, '90 días']]) seg.append(h('button', { type: 'button', role: 'tab', 'data-d': d, onclick: () => { days = d; sessionStorage.setItem('ac.an.days', String(d)); load(); } }, l));

  const liveParts = {};
  const drawLive = (lv) => {
    if (!liveParts.n) return;
    liveParts.n.textContent = nf.format(lv.count);
    liveParts.tile.textContent = nf.format(lv.count);
    liveParts.at.textContent = 'actualizado ' + hhmm(lv.at);
    liveParts.lists.innerHTML = lv.count
      ? `<div><h3>Desde dónde</h3>${colorBars(sorted(lv.country), { labeler: ccName, flags: true, max: 6 })}</div>`
        + `<div><h3>Qué miran</h3>${colorBars(sorted(lv.page), { labeler: pageLabel, max: 6 })}</div>`
        + `<div><h3>Con qué</h3>${colorBars(sorted(lv.device), { labeler: (k) => (DEVICE[k] || [k])[0], colorOf: (k, i) => (DEVICE[k] || [0, PALETTE[i]])[1] })}</div>`
      : `<p class="an-empty">Nadie en el sitio en este momento (últimos ${lv.windowMin} min).</p>`;
    worldMap(lv.country, { live: true }).then((svg) => { liveParts.map.innerHTML = svg; });
  };
  const pollLive = async () => {
    if (box.closest('[hidden]') || document.visibilityState !== 'visible') return;
    try { const j = await api('/api/panel/analytics/live', { token }); drawLive(j.live); }
    catch (e) { if (liveParts.at) liveParts.at.textContent = 'sin conexión'; if (e.status === 401) clearInterval(liveTimer); }
  };

  async function load() {
    seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(Number(b.dataset.d) === days)));
    refresh.disabled = true;
    let d;
    try { d = await api('/api/panel/analytics?days=' + days, { token }); }
    catch (e) { body.replaceChildren(h('div', { class: 'alert warn' }, h('span', { html: icon('warn') }), h('div', {}, 'No se pudo leer la analítica: ' + e.message))); refresh.disabled = false; return; }
    refresh.disabled = false;
    stamp.textContent = 'Actualizado ' + hhmm(d.generatedAt);
    const T = d.totals; const countries = sorted(d.dims.country);
    const tiles = h('div', { class: 'an-tiles' },
      (() => { const t = tile('En vivo ahora', nf.format(d.live.count), h('span', { class: 'an-sub' }, h('i', { class: 'an-pulse' }), `últimos ${d.live.windowMin} min`), 't-live', 'globe'); liveParts.tile = t.querySelector('strong'); return t; })(),
      tile(days === 1 ? 'Vistas hoy' : `Vistas (${days} días)`, nf.format(T.views), trendChip(T.views, T.prev.views), 't-views', 'eye'),
      tile('Visitantes', nf.format(T.visitors), trendChip(T.visitors, T.prev.visitors), 't-users', 'users'),
      tile('Países', nf.format(countries.filter(([k]) => k !== 'XX').length), h('span', { class: 'an-sub' }, countries[0] ? 'más visitas: ' + ccName(countries[0][0]) : EMPTY), 't-geo', 'flag'),
      tile('Registros', nf.format(T.signups), h('span', { class: 'an-sub' }, 'cuentas nuevas'), 't-sign', 'userPlus'));

    const tw = Math.max(300, Math.min(1180, (body.clientWidth || 720) - 38));
    const trend = card('Visitas por día', 'an-wide'); trend.insertAdjacentHTML('beforeend', trendChart(d.series, tw));

    const liveCard = card('En vivo ahora', 'an-wide an-live', h('span', { class: 'chip ok' }, h('span', { class: 'dot' }), 'cada 20 s'));
    liveParts.n = h('strong', { class: 'an-live-n' }, '0'); liveParts.at = h('span', { class: 'muted small' }, '');
    liveParts.map = h('div', { class: 'an-map' }, h('div', { class: 'skeleton', style: 'height:200px' }));
    liveParts.lists = h('div', { class: 'an-live-lists' });
    liveCard.append(h('div', { class: 'an-live-grid' }, h('div', { class: 'an-live-big' }, liveParts.n, h('span', {}, 'personas en el sitio'), liveParts.at, liveParts.map), liveParts.lists));

    const geo = card('Países que visitaron', 'an-wide');
    const map = h('div', { class: 'an-map' }, h('div', { class: 'skeleton', style: 'height:260px' }));
    geo.append(h('div', { class: 'an-geo' }, map, h('div', { html: colorBars(countries, { labeler: ccName, flags: true, max: 12, sum: total(d.dims.country) }) })));
    worldMap(d.dims.country).then((svg) => { map.innerHTML = countries.length ? svg : `<p class="an-empty">${EMPTY}</p>`; });

    const dev = card('Dispositivo'); dev.insertAdjacentHTML('beforeend', donutChart(sorted(d.dims.device), { title: 'Dispositivo', labelOf: (k) => (DEVICE[k] || [k])[0], colorOf: (k, i) => (DEVICE[k] || [0, PALETTE[i]])[1] }));
    const br = card('Navegador'); br.insertAdjacentHTML('beforeend', donutChart(sorted(d.dims.browser), { title: 'Navegador', colorOf: (k, i) => BROWSER_C[k] || PALETTE[i] }));
    const os = card('Sistema operativo'); os.insertAdjacentHTML('beforeend', donutChart(sorted(d.dims.os), { title: 'Sistema operativo', colorOf: (k, i) => OS_C[k] || PALETTE[i] }));
    const pages = card('Dónde visitaron (páginas)', 'an-span2'); pages.insertAdjacentHTML('beforeend', colorBars(sorted(d.dims.page), { labeler: pageLabel, max: 10, sum: total(d.dims.page) }));
    const ref = card('De dónde llegan'); ref.insertAdjacentHTML('beforeend', colorBars(sorted(d.dims.ref), { labeler: refLabel, max: 8, colorOf: (_k, i) => PALETTE[(i + 3) % PALETTE.length] }));
    const hrs = card('Horario de visitas', 'an-wide'); hrs.insertAdjacentHTML('beforeend', hoursChart(d.dims.hour));

    const src = d.sources || {};
    const note = h('p', { class: 'tiny muted an-foot' }, 'Fuente: contadores agregados del sitio (solo con cookies de analítica aceptadas). País según Cloudflare; dispositivo, navegador y sistema según el navegador. «En vivo» = activo en los últimos 5 minutos. Días en hora UTC.'
      + (src.d1Since ? ` Registro en el servidor desde el ${dm(src.d1Since)}; antes, historial de Firestore.` : ' Historial de Firestore.')
      + (src.firestore && !src.firestore.ok ? ' (El historial de Firestore no respondió: se muestra solo lo del servidor.)' : ''));
    body.replaceChildren(tiles, h('div', { class: 'an-grid' }, trend, liveCard, geo, dev, br, os, pages, ref, hrs), note);
    drawLive(d.live);
  }
  refresh.onclick = load;
  await load();
  liveTimer = setInterval(pollLive, 20_000);
  document.addEventListener('visibilitychange', pollLive);
}
