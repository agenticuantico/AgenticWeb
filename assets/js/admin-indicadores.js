/**
 * /admin/ → «Indicadores»: KPI con datos reales (agentes, personas, tráfico y, solo para el dueño, negocio: ingresos,
 * clientes, ticket, churn, LTV, CAC, LTV/CAC, payback), gráficos, filtro de período, descargas CSV/XLSX, gasto de
 * marketing (para el CAC) y token de solo lectura para Power BI. Sin datos = se dice, nunca se inventa.
 */
import { h, icon, toast, confirmDialog } from './ui.js';
import { api } from './admin-staff.js';
import { CONFIG } from './config.js';

const BASE = String(CONFIG.API_BASE || '').replace(/\/+$/, '');
const ERRK = { owner_only: 'Solo el dueño puede hacer esto.', invalid_month: 'Elegí el mes.', invalid_amount: 'El monto no es válido.', invalid_currency: 'Elegí la moneda.', invalid_period: 'El período no es válido.', forbidden_role: 'Tu rol no ve los indicadores.' };
const fail = (e) => toast(ERRK[e && e.code] || (e && e.message) || 'No se pudo completar.', 'danger');
const GROUPS = [['agentes', 'Agentes'], ['personas', 'Personas'], ['trafico', 'Tráfico y leads'], ['negocio', 'Negocio (solo el dueño)']];
const fmt = (m) => (m.value == null ? '—' : (m.unit === 'ARS' ? '$ ' : '') + Number(m.value).toLocaleString('es-AR', { maximumFractionDigits: 2 }) + (m.unit === '%' ? ' %' : m.unit === 'ARS' ? '' : ''));

/** Descarga con la sesión del panel (el archivo nunca queda en una URL pública). */
export async function download(path, token, name) {
  try {
    const r = await fetch(BASE + path, { headers: { 'X-Panel-Session': token }, cache: 'no-store' });
    if (!r.ok) { const j = await r.json().catch(() => ({})); const e = new Error(ERRK[j.error] || j.error || 'error_' + r.status); e.code = j.error; throw e; }
    const blob = await r.blob(); const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch (e) { fail(e); }
}

/** Gráfico de barras SVG liviano (accesible: título + tabla oculta con los mismos datos). */
function barChart(rows, key, label, color = '#65a30d') {
  const vals = rows.map((r) => (r[key] == null ? null : Number(r[key])));
  if (vals.every((v) => v == null)) return h('p', { class: 'muted small' }, 'Sin datos para graficar.');
  const max = Math.max(1, ...vals.map((v) => v || 0)); const w = 640, hh = 150, pad = 22; const bw = (w - pad * 2) / rows.length;
  const bars = vals.map((v, i) => { const bh = ((v || 0) / max) * (hh - pad * 2); return `<rect x="${(pad + i * bw + 1).toFixed(1)}" y="${(hh - pad - bh).toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="${v == null ? '#d6d9e3' : color}"><title>${rows[i].dia}: ${v == null ? 'sin dato' : v}</title></rect>`; }).join('');
  const ticks = rows.map((r, i) => (i % Math.ceil(rows.length / 6) === 0 || i === rows.length - 1 ? `<text x="${(pad + i * bw + bw / 2).toFixed(1)}" y="${hh - 6}" text-anchor="middle" class="axis">${String(r.dia).slice(8, 10)}/${String(r.dia).slice(5, 7)}</text>` : '')).join('');
  const fig = h('figure', { class: 'kpi-chart' }, h('figcaption', { class: 'small' }, label));
  fig.insertAdjacentHTML('beforeend', `<svg viewBox="0 0 ${w} ${hh}" class="chart" role="img" aria-label="${label}, máximo ${max}"><line x1="${pad}" x2="${w - pad}" y1="${hh - pad}" y2="${hh - pad}" class="grid"/><text x="${pad}" y="12" class="axis">${max}</text>${bars}${ticks}</svg>`);
  return fig;
}

export async function renderKpis(box, token, me) {
  const root = h('div', { class: 'kpi stack-lg' }); box.replaceChildren(root);
  let period = sessionStorage.getItem('kpi-days') || '30';
  const load = async () => {
    root.replaceChildren(h('div', { class: 'card panel' }, h('div', { class: 'skeleton', style: 'height:220px' })));
    let d;
    try { d = await api('/api/panel/kpi?days=' + encodeURIComponent(period), { token }); }
    catch (e) { root.replaceChildren(h('div', { class: 'alert warn' }, h('span', { html: icon('warn') }), h('div', {}, 'No se pudieron leer los indicadores: ' + (ERRK[e.code] || e.message)))); return; }
    draw(d);
  };
  function draw(d) {
    const sel = h('select', { class: 'select', 'aria-label': 'Período', style: 'width:auto' }, ...[['1', 'Hoy'], ['7', 'Últimos 7 días'], ['30', 'Últimos 30 días'], ['90', 'Últimos 90 días'], ['365', 'Último año']].map(([v, l]) => h('option', { value: v, selected: v === period }, l)));
    sel.onchange = () => { period = sel.value; sessionStorage.setItem('kpi-days', period); load(); };
    const q = `days=${encodeURIComponent(period)}`;
    const dl = (fmtx, table) => h('button', { class: 'btn btn-sm', type: 'button', html: icon('download') + `<span>${fmtx.toUpperCase()}${table ? '' : ' (todo)'}</span>`, onclick: () => download(`/api/panel/kpi/export.${fmtx}?${q}${table ? '&table=' + table : ''}`, token, `indicadores-${d.period.from}-a-${d.period.to}${table ? '-' + table : ''}.${fmtx}`) });
    const head = h('section', { class: 'card panel' },
      h('div', { class: 'panel-head' }, h('h2', {}, 'Indicadores'), h('div', { class: 'row' }, sel, dl('xlsx'))),
      h('p', { class: 'small muted' }, `Del ${d.period.from} al ${d.period.to} (hora de Argentina). Solo datos reales: si un dato falta, se muestra «—» con el motivo.`),
      !d.traffic.ok ? h('div', { class: 'alert warn' }, h('span', { html: icon('warn') }), h('div', {}, d.traffic.reason)) : null);
    const groups = GROUPS.filter(([g]) => d.metrics.some((m) => m.group === g)).map(([g, label]) => h('section', { class: 'card panel' },
      h('div', { class: 'panel-head' }, h('h2', {}, label)),
      h('div', { class: 'kpi-grid' }, ...d.metrics.filter((m) => m.group === g).map((m) => h('div', { class: 'kpi-card' + (m.value == null ? ' empty' : '') },
        h('small', {}, m.label), h('strong', {}, fmt(m)), h('span', { class: 'tiny muted' }, m.value == null ? (m.note || 'Sin dato') : m.unit && !['ARS', '%'].includes(m.unit) ? m.unit + (m.note ? ' · ' + m.note : '') : (m.note || '')))))));
    const charts = h('section', { class: 'card panel' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Por día'), h('div', { class: 'row' }, dl('csv', 'diario'))),
      h('div', { class: 'kpi-charts' }, barChart(d.daily, 'tareas_hechas', 'Tareas de agentes hechas'), barChart(d.daily, 'gemini_equipo', 'Consultas a Gemini del equipo', '#16151a'),
        barChart(d.daily, 'visitantes', 'Visitantes', '#2f5fd0'), barChart(d.daily, 'leads', 'Leads', '#b8892f'), d.owner ? barChart(d.daily, 'ingresos_ars', 'Ingresos (ARS)', '#157a42') : null));
    const parts = [head, ...groups, charts];
    parts.push(h('section', { class: 'card panel' }, h('h2', {}, 'Descargas para Excel o Power BI'), h('p', { class: 'small muted' }, 'Cada tabla en CSV (Power BI: Obtener datos → Texto/CSV) o todo junto en XLSX (Obtener datos → Excel).'),
      h('div', { class: 'row' }, dl('csv', 'resumen'), dl('csv', 'diario'), d.owner ? dl('csv', 'gasto') : null, dl('xlsx'))));
    if (d.owner) parts.push(spendCard(d), feedCard(d));
    root.replaceChildren(...parts.filter(Boolean));
  }
  function spendCard(d) {
    const month = h('input', { class: 'input', type: 'month', 'aria-label': 'Mes', value: new Date().toISOString().slice(0, 7) });
    const amount = h('input', { class: 'input', type: 'number', min: '0', step: '0.01', inputmode: 'decimal', 'aria-label': 'Monto', placeholder: 'Monto' });
    const cur = h('select', { class: 'select', 'aria-label': 'Moneda' }, h('option', { value: 'ARS' }, 'ARS'), h('option', { value: 'USD' }, 'USD'));
    const channel = h('input', { class: 'input', maxlength: '60', 'aria-label': 'Canal (opcional)', placeholder: 'Canal (opcional): Google Ads, Meta…' });
    const save = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Guardar gasto');
    const form = h('form', { class: 'kpi-spend-form', novalidate: true }, h('label', { class: 'label' }, 'Mes', month), h('label', { class: 'label' }, 'Monto', amount), h('label', { class: 'label' }, 'Moneda', cur), h('label', { class: 'label' }, 'Canal', channel), save);
    form.addEventListener('submit', async (e) => { e.preventDefault(); save.disabled = true; try { await api('/api/panel/kpi/spend', { method: 'POST', token, body: { month: month.value, amount: Number(amount.value), currency: cur.value, channel: channel.value } }); toast('Gasto guardado', 'success'); load(); } catch (ex) { fail(ex); save.disabled = false; } });
    const rows = (d.business && d.business.spend) || [];
    return h('section', { class: 'card panel' }, h('h2', {}, 'Gasto de marketing (para el CAC)'), h('p', { class: 'small muted' }, 'Lo cargás vos a mano, por mes. Sin gasto cargado, el CAC muestra «falta dato de gasto».'), form,
      rows.length ? h('ul', { class: 'team-props' }, ...rows.map((s) => h('li', { class: 'team-prop done' }, `${s.mes} · ${s.moneda} ${Number(s.monto).toLocaleString('es-AR')}${s.canal ? ' · ' + s.canal : ''} `,
        h('button', { class: 'linklike tiny', type: 'button', onclick: async () => { if (!(await confirmDialog({ title: 'Borrar gasto', text: `¿Borrar ${s.mes} · ${s.moneda} ${s.monto}?`, ok: 'Borrar', danger: true }))) return; try { await api('/api/panel/kpi/spend/' + s.id, { method: 'DELETE', token }); load(); } catch (e) { fail(e); } } }, 'Borrar')))) : h('p', { class: 'muted small' }, 'Todavía no cargaste gasto.'));
  }
  function feedCard(d) {
    const out = h('div', { class: 'stack' });
    const urls = h('ul', { class: 'small kpi-urls' }, ...['resumen', 'diario', 'gasto'].map((t) => h('li', {}, h('code', {}, `${d.feedBase}.csv?table=${t}&days=90`))));
    const create = h('button', { class: 'btn btn-primary btn-sm', type: 'button' }, d.token ? 'Crear token nuevo (revoca el actual)' : 'Crear token para Power BI');
    create.onclick = async () => {
      if (d.token && !(await confirmDialog({ title: 'Token nuevo', text: 'El token actual deja de funcionar y vas a tener que pegar el nuevo en Power BI.', ok: 'Crear' }))) return;
      try {
        const r = await api('/api/panel/kpi/token', { method: 'POST', token, body: { label: 'Power BI' } });
        const field = h('input', { class: 'input', readonly: true, value: r.token, 'aria-label': 'Token (se muestra una sola vez)' });
        out.replaceChildren(h('div', { class: 'alert' }, h('span', { html: icon('lock') }), h('div', {}, h('strong', {}, 'Copialo ahora: no se vuelve a mostrar. '), 'Guardalo solo en Power BI (encabezado Authorization: Bearer …).')), field,
          h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(r.token); toast('Copiado', 'success'); } catch { field.select(); } } }, 'Copiar'));
      } catch (e) { fail(e); }
    };
    const revoke = d.token ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: async () => { if (!(await confirmDialog({ title: 'Revocar token', text: 'Power BI deja de poder leer los datos.', ok: 'Revocar', danger: true }))) return; try { await api('/api/panel/kpi/token', { method: 'DELETE', token }); toast('Revocado'); load(); } catch (e) { fail(e); } } }, 'Revocar') : null;
    return h('section', { class: 'card panel' }, h('h2', {}, 'Conexión con Power BI (solo lectura)'),
      h('p', { class: 'small muted' }, 'Power BI se conecta a estas direcciones con un token tuyo (Obtener datos → Web → Avanzado → encabezado Authorization: Bearer <token>). Máximo 60 lecturas por hora. Incluye ingresos: no lo compartas.'),
      h('p', { class: 'small' }, d.token ? `Token activo desde ${new Date(d.token.created_at).toLocaleString('es-AR')}${d.token.last_used_at ? ' · último uso ' + new Date(d.token.last_used_at).toLocaleString('es-AR') : ' · sin usar todavía'}.` : 'No hay token activo.'),
      urls, h('div', { class: 'row' }, create, revoke), out);
  }
  await load();
}
