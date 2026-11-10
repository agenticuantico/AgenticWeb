/**
 * Planes (portada, /planes.html, /cuenta/). Elegir un plan pago:
 *  - sin sesión → /cuenta/ para ingresar o registrarse y volver al plan elegido;
 *  - con sesión → ventana de pago con resumen, Mercado Pago (ARS) y PayPal (USD).
 * Nunca se muestra "activado" antes de que el procesador confirme el pago.
 */
import { CONFIG, PLANS, formatARS } from './config.js';
import { h, icon, toast, modal } from './ui.js';

const NAMES = { gratis: 'Gratis', pro: 'Pro', empresa: 'Empresa' };

export function mountPlans(root, { user = null, profile = null, onChange } = {}) {
  root.innerHTML = '';
  const cards = h('div', { class: 'plans' });
  root.append(cards);
  const currentPlan = profile ? profile.plan || 'gratis' : null;
  const sub = profile && profile.subscription;
  for (const p of PLANS) {
    const price = CONFIG.PRICES[p.id];
    const card = h('article', { class: 'plan' + (p.featured ? ' featured' : ''), id: 'plan-' + p.id, 'aria-labelledby': 'plan-t-' + p.id });
    if (p.featured) card.append(h('span', { class: 'chip gold badge' }, 'Recomendado'));
    card.append(
      h('h3', { id: 'plan-t-' + p.id }, p.name),
      h('p', { class: 'tag' }, p.tagline),
      h('div', {}, h('div', { class: 'price' }, price.usd === 0 ? 'ARS 0' : formatARS(price.ars), price.usd ? h('small', {}, ' /mes') : null),
        h('div', { class: 'price-alt' }, price.usd === 0 ? 'Para siempre' : `o USD ${price.usd} /mes con PayPal`)),
      h('ul', {}, ...p.features.map((f) => h('li', { html: icon('check') + `<span>${f}</span>` }))));
    const pay = h('div', { class: 'pay' });
    if (p.id === 'gratis') pay.append(currentPlan === 'gratis' ? h('span', { class: 'btn btn-block', 'aria-disabled': 'true' }, 'Tu plan actual') : h('a', { class: 'btn btn-block', href: '/app/' }, 'Empezar gratis'));
    else if (currentPlan === p.id && profile.planStatus === 'active') pay.append(h('span', { class: 'btn btn-block', 'aria-disabled': 'true' }, 'Tu plan actual'));
    else if (sub && sub.status === 'pending' && sub.plan === p.id) pay.append(h('div', { class: 'alert info' }, h('span', { html: icon('clock') }), h('div', {}, h('strong', {}, 'Pago en verificación. '), 'El plan se activa cuando el procesador lo confirma.')));
    else pay.append(h('button', { class: 'btn btn-block ' + (p.featured ? 'btn-gold' : 'btn-primary'), type: 'button', onclick: () => choosePlan(p.id, user, onChange) }, `Elegir ${p.name}`));
    card.append(pay);
    cards.append(card);
  }
}

export function choosePlan(plan, user, onChange) {
  if (!user) { location.href = `/cuenta/?registro=1&siguiente=planes&plan=${plan}`; return; }
  openPayModal(plan, user, onChange);
}

export function openPayModal(plan, user, onChange) {
  const price = CONFIG.PRICES[plan];
  const p = PLANS.find((x) => x.id === plan);
  const renew = new Date(Date.now() + 30 * 86400000).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
  const mpBox = h('div', { class: 'pay-box' });
  const ppBox = h('div', { class: 'pay-box' });
  const body = h('div', { class: 'pay-modal' },
    h('div', { class: 'pay-summary' },
      h('div', {}, h('p', { class: 'eyebrow', style: 'margin:0' }, 'Plan'), h('strong', { class: 'pay-plan' }, p.name)),
      h('div', { style: 'text-align:right' }, h('strong', { class: 'pay-price' }, formatARS(price.ars)), h('small', { class: 'muted' }, ` o USD ${price.usd}`), h('div', { class: 'tiny muted' }, 'por mes'))),
    h('ul', { class: 'pay-facts' },
      h('li', { html: icon('check') + '<span><strong>Cobertura de 30 días</strong> desde la confirmación del pago.</span>' }),
      h('li', { html: icon('refresh') + `<span><strong>Renovación automática</strong> cada 30 días (próxima: ${renew} aprox.). La desactivás cuando quieras desde Mi cuenta y conservás el acceso hasta el fin del período.</span>` }),
      h('li', { html: icon('lock') + '<span><strong>Pago seguro</strong> en Mercado Pago o PayPal. AgentiCuántico nunca ve ni guarda tu tarjeta.</span>' })),
    h('div', { class: 'pay-methods' },
      h('div', {}, h('p', { class: 'label pay-label' }, h('img', { src: '/assets/brands/mercadopago-oficial.svg', alt: 'Mercado Pago', width: 77, height: 20 }), h('span', {}, 'Pesos argentinos · ' + formatARS(price.ars) + '/mes')), mpBox),
      h('div', {}, h('p', { class: 'label pay-label' }, h('img', { src: '/assets/brands/paypal-oficial.svg', alt: 'PayPal', width: 71, height: 20 }), h('span', {}, 'Dólares · USD ' + price.usd + '/mes')), ppBox)),
    h('p', { class: 'tiny muted', html: 'Al suscribirte aceptás los <a href="/legal/terminos.html" target="_blank">Términos y condiciones</a> y la política de <a href="/legal/reembolsos.html" target="_blank">Reembolsos y cancelación</a> (incluye el botón de arrepentimiento de 10 días). El plan queda «en verificación» hasta que el procesador confirma el cobro.' }));
  const m = modal({ title: 'Suscribirte a ' + p.name, body, label: 'Pago del plan ' + p.name });
  import('./payments.js').then((pm) => {
    pm.renderMercadoPago(mpBox, { plan, user });
    pm.renderPayPal(ppBox, {
      plan, user,
      onApproved: () => {
        m.close();
        modal({ title: 'Pago en verificación', body: h('div', {}, h('div', { class: 'alert info' }, h('span', { html: icon('clock') }), h('div', {}, 'PayPal aprobó tu suscripción. Estamos verificando el cobro: el plan ' + p.name + ' se activa automáticamente cuando se confirma (suele tardar minutos).')), h('p', { class: 'small muted', style: 'margin-top:12px' }, 'Podés seguir el estado en Mi cuenta → Membresía.')), actions: [{ label: 'Ir a Mi cuenta', class: 'btn-primary', onClick: () => { location.href = '/cuenta/#membresia'; } }] });
        onChange && onChange();
      },
      onError: (msg) => toast(msg, 'error', 6000)
    });
  });
}
export { NAMES };
