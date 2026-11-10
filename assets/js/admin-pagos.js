/**
 * /admin/ → «Pagos» (solo el dueño). GET /api/panel/payments (D1: billing_payments / billing_subscriptions).
 * Mercado Pago en pesos (ARS) y PayPal en dólares (USD), cada pasarela con su estado, su moneda y su gráfico.
 * Nunca se suman monedas: el total convertido a ARS es una referencia aparte, plegada y rotulada con la cotización.
 * Últimos cobros sin datos personales (sin usuario, correo ni número de operación).
 */
import { h, icon } from './ui.js';
import { api } from './admin-staff.js';
import { money } from './admin-revenue.js';

const nf = new Intl.NumberFormat('es-AR');
const tAR = (t, o = { dateStyle: 'short', timeStyle: 'short' }) => new Date(t).toLocaleString('es-AR', { ...o, hourCycle: 'h23', timeZone: 'America/Argentina/Buenos_Aires' });
const GW = {
  mercadopago: { name: 'Mercado Pago', cur: 'ARS', curLabel: 'Pesos argentinos (ARS)', color: '#0a7cc2', soft: '#e6f4fc', logo: '/assets/brands/mercadopago-oficial.svg', lw: 130, lh: 34 },
  paypal: { name: 'PayPal', cur: 'USD', curLabel: 'Dólares (USD)', color: '#1d4ed8', soft: '#eaf0ff', logo: '/assets/brands/paypal-oficial.svg', lw: 106, lh: 30 }
};
const STATUS = { activa: ['Activa', 'ok'], parcial: ['Activa sin avisos automáticos', 'warn'], sin_configurar: ['Sin configurar', 'off'] };
const SUB_L = { active: 'activas', pending: 'pendientes', paused: 'pausadas', canceled: 'canceladas' };
const PAY_L = { approved: 'Aprobado', refund: 'Reembolso parcial', refunded: 'Reembolsado', reversed: 'Revertido' };
const dm = (d) => d.slice(8, 10) + '/' + d.slice(5, 7);

function dailyBars(rows, cur, color) {
  const max = Math.max(0, ...rows.map((r) => r.cents));
  if (!max) return h('p', { class: 'an-empty' }, 'Todavía sin cobros en los últimos 30 días.');
  const w = 600, hh = 120, pad = 6, bw = (w - pad * 2) / rows.length;
  const svg = `<svg viewBox="0 0 ${w} ${hh + 18}" class="pg-bars" role="img" aria-label="Cobrado por día en ${cur}, últimos 30 días">${rows.map((r, i) => { const v = Math.max(0, r.cents); const bh = v ? Math.max(3, (v / max) * hh) : 0; return `<rect x="${(pad + i * bw + 1).toFixed(1)}" y="${(hh - bh).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="${color}"><title>${dm(r.day)}: ${money(r.cents, cur)} · ${r.count} cobros</title></rect>`; }).join('')}`
    + `<text x="${pad}" y="${hh + 15}" class="an-axis">${dm(rows[0].day)}</text><text x="${w - pad}" y="${hh + 15}" text-anchor="end" class="an-axis">${dm(rows[rows.length - 1].day)}</text></svg>`;
  return h('div', { html: svg });
}

function gatewayCard(id, d) {
  const g = GW[id]; const p = d.providers[id]; const s = d.gateways[id];
  const [stLabel, stCls] = STATUS[s.status] || STATUS.sin_configurar;
  const fact = (label, ok, extra = '') => h('li', { class: ok ? 'on' : 'off' }, h('span', { 'aria-hidden': 'true' }, ok ? '✓' : '—'), h('span', {}, label + (extra ? ': ' + extra : '')));
  const subs = Object.entries(s.subscriptions || {}).filter(([, n]) => n > 0);
  const stat = (label, value, cls = '') => h('div', { class: 'pg-stat ' + cls }, h('small', {}, label), h('b', { 'data-no-i18n': '' }, value));
  return h('article', { class: 'card pg-gw', style: `--gw:${g.color};--gw-soft:${g.soft}`, 'data-provider': id },
    h('header', { class: 'pg-gw-head' },
      h('span', { class: 'pg-logo' }, h('img', { src: g.logo, alt: g.name, width: g.lw, height: g.lh, decoding: 'async' })),
      h('div', {}, h('h3', {}, g.name), h('span', { class: 'pg-cur' }, g.curLabel)),
      h('span', { class: 'pg-status ' + stCls }, h('i', {}), stLabel)),
    h('div', { class: 'pg-hero' },
      h('div', {}, h('small', {}, 'Cobrado este mes'), h('strong', { 'data-no-i18n': '' }, money(p.monthCents, g.cur))),
      h('div', {}, h('small', {}, 'Hoy'), h('strong', { class: 'pg-today', 'data-no-i18n': '' }, money(p.todayCents, g.cur))),
      h('div', {}, h('small', {}, 'Total histórico'), h('strong', { class: 'pg-today', 'data-no-i18n': '' }, money(p.totalCents, g.cur)))),
    h('div', { class: 'pg-stats' },
      stat('Cobros del mes', nf.format(p.monthPayments)),
      stat('Suscripciones activas', nf.format(p.activeSubscriptions)),
      stat('Pagas', nf.format(p.paidSubscriptions)),
      stat('Mensual recurrente', money(p.mrrCents, g.cur))),
    h('div', {}, h('p', { class: 'pg-sec' }, 'Últimos 30 días (' + g.cur + ')'), dailyBars(d.series[id], g.cur, g.color)),
    h('ul', { class: 'pg-facts' },
      fact('Credenciales', s.configured, s.mode ? 'modo ' + s.mode : ''),
      fact('Avisos automáticos (webhook)', s.webhook),
      fact('Planes configurados', s.plans > 0, nf.format(s.plans) + ' de 2')),
    h('p', { class: 'tiny muted' },
      subs.length ? 'Suscripciones: ' + subs.map(([k, n]) => nf.format(n) + ' ' + (SUB_L[k] || k)).join(' · ') + '. ' : 'Sin suscripciones registradas. ',
      p.lastPaymentAt ? 'Último cobro: ' + tAR(p.lastPaymentAt) + '.' : 'Sin cobros registrados todavía.',
      s.lastWebhookAt ? ' Último aviso: ' + tAR(s.lastWebhookAt) + '.' : ''),
    (p.otherCurrencies || []).some((o) => o.monthCents) ? h('p', { class: 'tiny muted' }, 'Cobros en otra moneda (aparte, sin convertir): ' + p.otherCurrencies.filter((o) => o.monthCents).map((o) => money(o.monthCents, o.currency)).join(', ')) : null);
}

export async function renderPayments(box, token) {
  const stamp = h('span', { class: 'muted small' }, '');
  const refresh = h('button', { class: 'btn btn-sm', type: 'button', html: icon('refresh') + 'Actualizar' });
  const body = h('div', { class: 'stack-lg' }, h('div', { class: 'skeleton', style: 'height:320px' }));
  box.replaceChildren(h('div', { class: 'admin-head sub' }, h('div', {}, h('h2', {}, 'Pagos y pasarelas'), h('p', { class: 'muted small' }, 'Cada pasarela en su moneda: Mercado Pago en pesos, PayPal en dólares. Nunca se suman.')), h('div', { class: 'row' }, stamp, refresh)), body);
  let casa = (() => { try { return localStorage.getItem('ac.admin.revRate') === 'blue' ? 'blue' : 'oficial'; } catch { return 'oficial'; } })();
  async function load() {
    refresh.disabled = true;
    let d;
    try { d = await api('/api/panel/payments', { token }); }
    catch (e) { body.replaceChildren(h('div', { class: 'alert warn' }, h('span', { html: icon('warn') }), h('div', {}, 'No se pudieron leer los pagos: ' + e.message))); refresh.disabled = false; return; }
    refresh.disabled = false;
    stamp.textContent = 'Actualizado ' + tAR(d.generatedAt, { timeStyle: 'short' });
    const mp = d.providers.mercadopago, pp = d.providers.paypal;
    const sumRow = (id) => { const g = GW[id]; const x = d.providers[id]; const st = d.gateways[id];
      return h('div', { class: 'pg-sum-row', style: `--gw:${g.color};--gw-soft:${g.soft}` },
        h('div', { class: 'pg-sum-who' }, h('img', { src: g.logo, alt: g.name, width: Math.round(g.lw * 0.7), height: Math.round(g.lh * 0.7), decoding: 'async' }), h('span', {}, g.curLabel), h('span', { class: 'pg-status ' + (STATUS[st.status] || STATUS.sin_configurar)[1] }, h('i', {}), (STATUS[st.status] || STATUS.sin_configurar)[0])),
        ...[['Hoy', money(x.todayCents, g.cur)], ['Este mes', money(x.monthCents, g.cur)], ['Total', money(x.totalCents, g.cur)], ['Cobros del mes', nf.format(x.monthPayments)], ['Suscripciones activas', nf.format(x.activeSubscriptions)]]
          .map(([l, v], i) => h('div', { class: 'pg-sum-cell' + (i === 1 ? ' main' : '') }, h('small', {}, l), h('b', { 'data-no-i18n': '' }, v)))); };
    const tiles = h('section', { class: 'card panel pg-sum' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Ingresos del sitio'), h('span', { class: 'chip' }, 'por moneda, sin mezclar')),
      sumRow('mercadopago'), sumRow('paypal'),
      !mp.totalCents && !pp.totalCents ? h('p', { class: 'small muted' }, 'Todavía sin cobros registrados: los montos aparecen en cuanto entre el primer pago aprobado.') : null);
    // Referencia convertida (plegada): dice siempre la cotización usada.
    const ref = h('div', {});
    const drawRef = () => {
      const c = d.combined && d.combined[casa];
      const seg = h('div', { class: 'seg seg-sm seg-2', role: 'tablist', 'aria-label': 'Cotización' }, ...[['oficial', 'Oficial'], ['blue', 'Blue']].map(([k, l]) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(k === casa), onclick: () => { casa = k; try { localStorage.setItem('ac.admin.revRate', k); } catch {} drawRef(); } }, l)));
      ref.replaceChildren(h('details', { class: 'card pg-ref' }, h('summary', {}, 'Referencia: todo convertido a pesos'),
        h('div', { class: 'row', style: 'justify-content:space-between;flex-wrap:wrap;gap:10px;margin-top:10px' },
          h('div', {}, h('small', { class: 'muted' }, 'Este mes'), h('strong', { class: 'pg-ref-n', 'data-no-i18n': '' }, c ? money(c.monthArsCents, 'ARS') : '—')), seg),
        h('p', { class: 'tiny muted' }, c ? `ARS de Mercado Pago + USD de PayPal × dólar ${casa} (venta) ${money(c.rate * 100, 'ARS')}, dolarapi.com, ${tAR(c.fetchedAt, { timeStyle: 'short' })}. Es solo una referencia: cada pasarela cobra y liquida en su moneda.` : 'Cotización no disponible: cada pasarela se muestra solo en su moneda.')));
    };
    drawRef();
    const rec = h('section', { class: 'card panel' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Últimos cobros')),
      d.recent.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ...['Fecha', 'Pasarela', 'Plan', 'Monto', 'Estado'].map((t) => h('th', {}, t)))),
        h('tbody', {}, ...d.recent.map((r) => h('tr', {}, h('td', {}, tAR(r.paidAt)), h('td', {}, h('span', { class: 'pg-dot', style: `background:${(GW[r.provider] || GW.mercadopago).color}` }), (GW[r.provider] || { name: r.provider }).name),
          h('td', {}, r.plan === 'pro' ? 'Pro' : r.plan === 'empresa' ? 'Empresa' : '—'), h('td', { 'data-no-i18n': '' }, money(r.amountCents, r.currency)),
          h('td', {}, h('span', { class: 'chip ' + (r.status === 'approved' ? 'ok' : 'warn') }, PAY_L[r.status] || r.status)))))))
        : h('p', { class: 'an-empty' }, 'Todavía sin cobros registrados.'));
    body.replaceChildren(tiles, h('div', { class: 'pg-grid' }, gatewayCard('mercadopago', d), gatewayCard('paypal', d)), ref, rec,
      h('p', { class: 'tiny muted' }, 'Fuente: cobros aprobados que avisan Mercado Pago y PayPal (avisos verificados) más una revisión automática cada hora, descontando reembolsos. Hora de Argentina.' + (d.lastSyncHourUTC ? ' Última revisión: ' + tAR(Date.parse(d.lastSyncHourUTC + ':00:00Z'), { timeStyle: 'short' }) + ' (aprox.).' : '')));
  }
  refresh.onclick = load;
  await load();
}
