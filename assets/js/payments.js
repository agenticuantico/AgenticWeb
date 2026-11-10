/**
 * Cobros sin backend (por ahora):
 *  - PayPal Subscriptions (USD) con el JS SDK oficial (vault=true&intent=subscription). Funciona hoy.
 *    Al aprobar, se registra la suscripción en users/{uid}.subscription con status 'pending' ("Pago en verificación").
 *    La activación definitiva del plan la hace el servidor (worker-v2) al validar el webhook firmado.
 *  - Mercado Pago Suscripciones (ARS): enlace al checkout del plan (init_point) cuando esté configurado.
 * Nunca se ve ni se guarda un número de tarjeta: todo ocurre en las ventanas del procesador.
 */
import { PAYMENTS, paypalReady, mpReady } from '../payments-config.js';
import { getStore, friendlyError } from './firebase.js';
import { h, icon } from './ui.js';

let ppP;
export function loadPayPal() {
  if (window.paypal && window.paypal.Buttons) return Promise.resolve(window.paypal);
  if (ppP) return ppP;
  ppP = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(PAYMENTS.paypal.CLIENT_ID)}&vault=true&intent=subscription&components=buttons&currency=USD`;
    s.async = true;
    s.setAttribute('data-sdk-integration-source', 'button-factory');
    s.onload = () => (window.paypal ? resolve(window.paypal) : reject(new Error('paypal-missing')));
    s.onerror = () => { ppP = null; reject(new Error('paypal-blocked')); };
    document.head.append(s);
  });
  return ppP;
}

/** Guarda la suscripción pendiente en el perfil del usuario (las reglas solo permiten este campo). */
export async function recordPending(uid, data) {
  const { fs, db } = await getStore();
  await fs.updateDoc(fs.doc(db, 'users', uid), {
    subscription: { provider: data.provider, plan: data.plan, subscriptionId: data.subscriptionId || null, status: 'pending', autoRenew: true, createdAt: fs.serverTimestamp() }
  });
}

/**
 * Renderiza el botón de suscripción de PayPal.
 * opts: { plan: 'pro'|'empresa', user, onApproved(subscriptionID), onError(msg) }
 */
export async function renderPayPal(container, { plan, user, onApproved, onError }) {
  container.innerHTML = '';
  if (!paypalReady(plan)) { container.append(h('p', { class: 'muted small' }, 'PayPal en configuración.')); return; }
  if (!user) {
    container.append(h('a', { class: 'btn btn-block', href: '/cuenta/?registro=1&siguiente=planes' }, 'Ingresa para pagar con PayPal'));
    return;
  }
  const slot = h('div', { class: 'pp-slot', 'aria-busy': 'true' }, h('div', { class: 'skeleton', style: 'height:46px;border-radius:999px' }));
  container.append(slot);
  try {
    const paypal = await loadPayPal();
    slot.innerHTML = '';
    slot.removeAttribute('aria-busy');
    await paypal.Buttons({
      style: { shape: 'pill', color: 'gold', layout: 'vertical', label: 'subscribe', height: 46 },
      createSubscription: (data, actions) => actions.subscription.create({
        plan_id: PAYMENTS.paypal.plans[plan],
        custom_id: user.uid, // vincula la suscripción con la cuenta para el webhook
        application_context: { brand_name: 'AgentiCuántico', shipping_preference: 'NO_SHIPPING', user_action: 'SUBSCRIBE_NOW' }
      }),
      onApprove: async (data) => {
        try {
          await recordPending(user.uid, { provider: 'paypal', plan, subscriptionId: String(data.subscriptionID || '').slice(0, 60) });
        } catch (e) {
          console.warn('[pagos] no se pudo registrar en el perfil', e && e.code);
        }
        onApproved && onApproved(data.subscriptionID);
      },
      onCancel: () => onError && onError('Cancelaste el pago en PayPal. No se cobró nada.'),
      onError: (err) => { console.warn('[paypal]', err); onError && onError('PayPal no pudo procesar la suscripción. Prueba de nuevo o con otro medio.'); }
    }).render(slot);
  } catch (e) {
    slot.innerHTML = '';
    slot.append(h('div', { class: 'alert warn' }, h('span', { html: icon('warn') }), h('div', {}, 'No se pudo cargar PayPal (puede estar bloqueado por una extensión o la red). ', h('button', { class: 'linklike', type: 'button', onclick: () => renderPayPal(container, { plan, user, onApproved, onError }) }, 'Reintentar'))));
  }
}

/** Botón de Mercado Pago (ARS) o aviso de "muy pronto". */
export function renderMercadoPago(container, { plan, user }) {
  container.innerHTML = '';
  if (!mpReady(plan)) {
    container.append(h('button', { class: 'btn btn-block', type: 'button', disabled: true, title: 'Estamos terminando la configuración de Mercado Pago' }, h('span', {}, 'Mercado Pago muy pronto')));
    return;
  }
  if (!user) { container.append(h('a', { class: 'btn btn-block', href: '/cuenta/?registro=1&siguiente=planes' }, 'Ingresa para pagar con Mercado Pago')); return; }
  const a = h('a', { class: 'btn btn-block btn-mp', href: PAYMENTS.mercadopago.checkout[plan], rel: 'noopener', 'aria-label': 'Pagar con Mercado Pago', html: '<span>Pagar con</span><img src="/assets/brands/mercadopago-blanco.svg" alt="Mercado Pago" width="92" height="24">' });
  // El checkout de planes no acepta referencias propias: recordamos el plan elegido para registrar
  // la suscripción como pendiente al volver (back_url /cuenta/?preapproval_id=...).
  a.addEventListener('click', () => { try { sessionStorage.setItem('ac.mpPending', JSON.stringify({ plan, uid: user.uid, at: Date.now() })); } catch {} });
  container.append(a, h('p', { class: 'tiny muted', style: 'margin:0;text-align:center' }, 'Se abre Mercado Pago (app o web) para aprobar la suscripción.'));
}

/** Al volver del checkout (/cuenta/?pago=mp&plan=pro&preapproval_id=...), registrar como pendiente. */
export async function handleReturn(user) {
  if (!user) return null;
  const q = new URLSearchParams(location.search);
  let mem = null;
  try { mem = JSON.parse(sessionStorage.getItem('ac.mpPending') || 'null'); } catch {}
  const id = (q.get('preapproval_id') || q.get('subscription_id') || '').replace(/[^\w-]/g, '').slice(0, 60);
  const fromMp = q.has('preapproval_id') || q.has('status') || q.get('pago') === 'mp' || (mem && Date.now() - mem.at < 3 * 3600_000 && mem.uid === user.uid && q.toString() !== '');
  if (!fromMp && !q.get('pago')) return null;
  const plan = ['pro', 'empresa'].includes(q.get('plan')) ? q.get('plan') : mem && ['pro', 'empresa'].includes(mem.plan) ? mem.plan : null;
  if (!plan) return null;
  const provider = q.get('pago') === 'paypal' ? 'paypal' : 'mercadopago';
  try {
    sessionStorage.removeItem('ac.mpPending');
    await recordPending(user.uid, { provider, plan, subscriptionId: id || null });
    history.replaceState(null, '', location.pathname);
    return { ok: true, plan, provider, subscriptionId: id || null };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}
