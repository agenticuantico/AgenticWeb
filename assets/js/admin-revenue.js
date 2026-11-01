/**
 * /admin/ · «Ingresos estimados» (solo dueño). Cobros reales registrados en el Worker (D1):
 * Mercado Pago en ARS y PayPal en USD, cada uno con su total; nunca se suman monedas sin convertir.
 * El estimado combinado en ARS dice siempre qué cotización usa (dolarapi.com, oficial o blue, caché 1 h).
 */
import { h, icon } from './ui.js';
import { CONFIG } from './config.js';
import { getSiteLang } from './i18n.js';

const nfARS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const nfUSD = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', currencyDisplay: 'symbol', minimumFractionDigits: 0, maximumFractionDigits: 2 });
const nfInt = new Intl.NumberFormat('es-AR');
/** Montos en centavos de su moneda. USD: «US$ 0» si es cero (nunca se oculta). */
export function money(cents, cur) {
  const v = (Number(cents) || 0) / 100;
  if (cur === 'USD') { const s = nfUSD.format(v).replace(/^US\$\s?|^\$\s?|USD\s?/, ''); return 'US$ ' + s; }
  return nfARS.format(Math.round(v)).replace(/\s/g, ' ');
}
const hhmm = (t) => { try { return new Date(t).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Argentina/Buenos_Aires' }); } catch { return ''; } };
const monthName = (label) => { try { const [y, m] = label.split('-').map(Number); let loc = 'es-AR'; try { loc = getSiteLang() || 'es-AR'; } catch {} return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(loc, { month: 'long', year: 'numeric', timeZone: 'UTC' }).replace(/^./, (c) => c.toUpperCase()); } catch { return label; } };

let cache = null;
export async function fetchRevenue(user, { force = false } = {}) {
  if (cache && !force && Date.now() - cache.at < 60_000) return cache.data;
  const base = String(CONFIG.API_BASE || '').replace(/\/+$/, '');
  const token = await user.getIdToken();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const r = await fetch(base + '/api/admin/revenue', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store', signal: ctrl.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) { const e = new Error(j.error || 'error_' + r.status); e.code = j.error || 'error_' + r.status; throw e; }
    cache = { at: Date.now(), data: j };
    return j;
  } finally { clearTimeout(t); }
}

/** KPI compacto para la fila superior: ARS del mes y USD del mes, por separado. */
export function revenueKpi(user) {
  const ars = h('strong', { class: 'rev-kpi-ars', 'data-no-i18n': '' }, '—');
  const usd = h('span', { class: 'rev-kpi-usd', 'data-no-i18n': '' }, '—');
  const el = h('div', { class: 'kpi rev-kpi' }, h('span', { class: 'kpi-ic', html: icon('card') }),
    h('div', {}, h('small', {}, 'Ingresos estimados'), ars, h('span', { class: 'muted tiny rev-kpi-sub' }, usd, h('span', {}, ' · este mes'))));
  fetchRevenue(user).then((d) => {
    ars.textContent = money(d.providers.mercadopago.monthCents, 'ARS');
    usd.textContent = money(d.providers.paypal.monthCents, 'USD');
  }).catch(() => { ars.textContent = '—'; usd.textContent = 'US$ —'; });
  return el;
}

function providerBlock(name, cur, p, logo) {
  const stat = (label, value) => h('div', { class: 'rev-stat' }, h('small', {}, label), h('b', { 'data-no-i18n': '' }, value));
  const plans = Object.entries(p.byPlan || {}).filter(([, n]) => n > 0);
  return h('article', { class: 'rev-prov', 'data-provider': name },
    h('header', { class: 'rev-prov-head' },
      h('span', { class: 'rev-logo', html: logo }),
      h('div', {}, h('h3', { class: 'sr-only' }, name === 'mercadopago' ? 'Mercado Pago' : 'PayPal'), h('span', { class: 'rev-cur' }, cur === 'ARS' ? 'Pesos argentinos (ARS)' : 'Dólares (USD)')),
      h('span', { class: 'chip ' + (p.activeSubscriptions ? 'ok' : '') }, h('span', { 'data-no-i18n': '' }, nfInt.format(p.paidSubscriptions)), h('span', {}, ' pagas'))),
    h('div', { class: 'rev-main' }, h('small', {}, 'Cobrado este mes'), h('strong', { 'data-no-i18n': '' }, money(p.monthCents, cur))),
    h('div', { class: 'rev-stats' },
      stat('Hoy', money(p.todayCents, cur)),
      stat('Cobros del mes', nfInt.format(p.monthPayments)),
      stat('Suscripciones activas', nfInt.format(p.activeSubscriptions)),
      stat('Mensual recurrente', money(p.mrrCents, cur))),
    plans.length ? h('p', { class: 'tiny muted rev-plans' }, ...plans.flatMap(([k, n], i) => [i ? h('span', {}, ' · ') : null, h('span', {}, k === 'pro' ? 'Pro' : k === 'empresa' ? 'Empresa' : k), h('span', { 'data-no-i18n': '' }, ': ' + nfInt.format(n))]).filter(Boolean)) : null,
    p.lastPaymentAt ? h('p', { class: 'tiny muted' }, h('span', {}, 'Último cobro'), h('span', { 'data-no-i18n': '' }, ' ' + new Date(p.lastPaymentAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23', timeZone: 'America/Argentina/Buenos_Aires' }))) : h('p', { class: 'tiny muted' }, 'Sin cobros registrados todavía.'));
}

const MP_LOGO = '<img src="/assets/brands/mercadopago-oficial.svg" alt="Mercado Pago" width="130" height="34" decoding="async">';
const PP_LOGO = '<img src="/assets/brands/paypal-oficial.svg" alt="PayPal" width="106" height="30" decoding="async">';

/** Tarjeta completa (ancho total del panel Analítica). */
export function renderRevenueCard(host, user) {
  const casaKey = 'ac.admin.revRate';
  let casa = (() => { try { return localStorage.getItem(casaKey) === 'blue' ? 'blue' : 'oficial'; } catch { return 'oficial'; } })();
  const seg = h('div', { class: 'seg seg-sm seg-2', role: 'tablist', 'aria-label': 'Cotización del estimado combinado' });
  const period = h('span', { class: 'chip gold', 'data-no-i18n': '' }, '…');
  const body = h('div', { class: 'rev-body' }, h('div', { class: 'skeleton', style: 'height:180px' }));
  const card = h('section', { class: 'card panel wide rev-card', 'aria-labelledby': 'revTitle' },
    h('div', { class: 'panel-head' }, h('h2', { id: 'revTitle' }, 'Ingresos estimados'), period, seg), body);
  host.append(card);
  let data = null;
  const draw = () => {
    if (!data) return;
    seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.c === casa)));
    period.textContent = monthName(data.month);
    const c = data.combined && data.combined[casa];
    const mp = data.providers.mercadopago, pp = data.providers.paypal;
    const other = [...(mp.otherCurrencies || []), ...(pp.otherCurrencies || [])].filter((o) => o.monthCents);
    body.innerHTML = '';
    body.append(...[
      h('div', { class: 'rev-grid' }, providerBlock('mercadopago', 'ARS', mp, MP_LOGO), providerBlock('paypal', 'USD', pp, PP_LOGO)),
      h('div', { class: 'rev-combined' },
        h('div', { class: 'rev-combined-main' },
          h('small', {}, 'Estimado combinado en ARS'),
          h('strong', { 'data-no-i18n': '' }, c ? money(c.monthArsCents, 'ARS') : '—'),
          h('span', { class: 'tiny muted' }, h('span', {}, 'Hoy'), h('span', { 'data-no-i18n': '' }, ' ' + (c ? money(c.todayArsCents, 'ARS') : '—')))),
        h('p', { class: 'small rev-rate' }, c
          ? [h('span', {}, casa === 'blue' ? 'Dólar blue (venta)' : 'Dólar oficial (venta)'), h('b', { 'data-no-i18n': '' }, ' ' + money(c.rate * 100, 'ARS') + ' '), h('span', { class: 'muted' }, '· dolarapi.com ·'), h('span', { class: 'muted' }, ' '), h('span', { class: 'muted' }, 'Actualizado ' + hhmm(c.fetchedAt))]
          : [h('span', {}, 'Cotización no disponible: se muestran ARS y USD por separado.')]),
        h('p', { class: 'tiny muted' }, 'ARS de Mercado Pago + USD de PayPal × cotización elegida. Es una referencia: cada procesador liquida en su propia moneda.')),
      other.length ? h('p', { class: 'tiny muted' }, h('span', {}, 'También hay cobros en otra moneda:'), h('span', { 'data-no-i18n': '' }, ' ' + other.map((o) => money(o.monthCents, o.currency)).join(', '))) : null,
      h('p', { class: 'tiny muted rev-foot' }, h('span', {}, 'Fuente: cobros aprobados registrados por los webhooks verificados y la sincronización horaria con Mercado Pago y PayPal (descontando reembolsos). Hora de Argentina.'))].filter(Boolean));
  };
  for (const [k, label] of [['oficial', 'Oficial'], ['blue', 'Blue']]) seg.append(h('button', { type: 'button', role: 'tab', 'data-c': k, onclick: () => { casa = k; try { localStorage.setItem(casaKey, k); } catch {} draw(); } }, label));
  fetchRevenue(user).then((d) => { data = d; draw(); }).catch((e) => {
    period.textContent = '—';
    body.innerHTML = '';
    body.append(h('div', { class: 'alert warn' }, h('span', { html: icon('warn') }), h('div', {}, h('span', {}, 'No se pudieron leer los ingresos del servidor.'), h('span', { class: 'muted tiny', 'data-no-i18n': '' }, ' (' + String(e.code || e.message || '').slice(0, 40) + ')'))),
      h('div', { class: 'rev-grid' },
        providerBlock('mercadopago', 'ARS', { monthCents: 0, todayCents: 0, monthPayments: 0, activeSubscriptions: 0, paidSubscriptions: 0, mrrCents: 0 }, MP_LOGO),
        providerBlock('paypal', 'USD', { monthCents: 0, todayCents: 0, monthPayments: 0, activeSubscriptions: 0, paidSubscriptions: 0, mrrCents: 0 }, PP_LOGO)));
    body.querySelectorAll('.rev-main strong, .rev-stat b').forEach((b) => { b.textContent = '—'; });
  });
  return card;
}
