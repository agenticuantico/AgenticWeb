/** /cuenta/: ingreso, registro, recuperación y panel del usuario (perfil, membresía, pagos, billetera, privacidad). */
import { h, icon, toast, confirmDialog, fmtDate, modal, hydrateIcons } from './ui.js';
import { CONFIG, formatARS } from './config.js';
import { PAYMENTS } from '../payments-config.js';
import * as auth from './auth.js';
import { getAuthApi, getStore, friendlyError } from './firebase.js';
import { mountPlans, openPayModal } from './plans.js?v=7.23.0';
import { state as engineState, init as engineInit } from './chat/engine.js';
import * as callMem from './companion/memory.js';

const root = document.getElementById('accountRoot');
const params = new URLSearchParams(location.search);
let googleNotice = null;

function err(el, msg) { el.textContent = msg || ''; el.hidden = !msg; }
function busy(btn, on, label) { btn.disabled = on; if (label) { btn.dataset.label = btn.dataset.label || btn.textContent; btn.textContent = on ? label : btn.dataset.label; } }

/* =================== Ingreso / registro =================== */
function renderAuth(tab = params.get('registro') ? 'signup' : 'login') {
  const signupsOff = window.AC_SYSTEM && window.AC_SYSTEM.flags.signups === false;
  root.innerHTML = '';
  const card = h('div', { class: 'card auth-card' });
  const wrap = h('div', { class: 'auth-wrap' },
    h('div', { class: 'auth-aside' },
      h('img', { src: '/media/avatar/face-256.webp?v=7.23.0', alt: '', width: 72, height: 72, class: 'auth-face' }),
      h('h1', {}, tab === 'signup' ? 'Crea tu cuenta' : tab === 'reset' ? 'Recupera tu acceso' : 'Te damos la bienvenida'),
      h('p', { class: 'muted' }, 'Sincroniza tus chats entre dispositivos, comparte conversaciones y elige tu plan.'),
      h('ul', { class: 'checklist' }, ...['Chats guardados en tu cuenta', 'Todas las funciones en todos los planes', 'Pagos seguros con PayPal y Mercado Pago'].map((t) => h('li', { html: icon('check') + `<span>${t}</span>` })))),
    card);
  root.append(wrap);

  const tabs = h('div', { class: 'seg', role: 'tablist', 'aria-label': 'Acceso' },
    h('button', { type: 'button', role: 'tab', 'aria-selected': String(tab === 'login'), onclick: () => renderAuth('login') }, 'Ingresar'),
    h('button', { type: 'button', role: 'tab', 'aria-selected': String(tab === 'signup'), onclick: () => renderAuth('signup') }, 'Crear cuenta'));
  card.append(tabs);
  const errorBox = h('p', { class: 'error-text', role: 'alert', hidden: true });

  if (tab === 'reset') {
    const f = h('form', { class: 'auth-form', novalidate: true },
      h('p', { class: 'muted small' }, 'Te mandamos un enlace para crear una contraseña nueva.'),
      field('Correo', h('input', { class: 'input', type: 'email', name: 'email', autocomplete: 'email', required: true })),
      errorBox, h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Enviar enlace'),
      h('button', { class: 'linklike small', type: 'button', style: 'margin-top:12px', onclick: () => renderAuth('login') }, 'Volver a ingresar'));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = f.querySelector('[type=submit]');
      busy(btn, true, 'Enviando…'); err(errorBox);
      try { await auth.resetPassword(f.email.value); f.replaceWith(h('div', { class: 'alert ok' }, h('span', { html: icon('mail') }), h('div', {}, 'Si existe una cuenta con ese correo, te llegó un enlace para restablecer la contraseña. Revisa también spam.'))); }
      catch (ex) { err(errorBox, friendlyError(ex)); busy(btn, false, 'Enviar enlace'); }
    });
    card.append(f);
    return;
  }

  const google = h('button', { class: 'btn btn-block google-btn', type: 'button', html: icon('google') + '<span>Continuar con Google</span>' });
  const termsBox = h('input', { type: 'checkbox', name: 'terms', id: 'terms', required: tab === 'signup' || null });
  const terms = h('label', { class: 'check', for: 'terms' }, termsBox, h('span', { html: 'Acepto los <a href="/legal/terminos.html" target="_blank">Términos y condiciones</a> y la <a href="/legal/privacidad.html" target="_blank">Política de privacidad</a>.' }));
  google.addEventListener('click', async () => {
    if (tab === 'signup' && !termsBox.checked) { err(errorBox, 'Para crear la cuenta tienes que aceptar los términos y la política de privacidad.'); termsBox.focus(); return; }
    busy(google, true); err(errorBox);
    try {
      const r = await auth.signInGoogle({ termsAccepted: termsBox.checked });
      if (r) { googleNotice = r; }
    } catch (ex) { err(errorBox, friendlyError(ex)); }
    busy(google, false);
  });
  card.append(google, h('div', { class: 'or' }, h('span', {}, 'o con tu correo')));

  if (tab === 'signup') {
    if (signupsOff) { card.append(h('div', { class: 'alert warn' }, 'Los registros nuevos están pausados momentáneamente.')); return; }
    const pass = h('input', { class: 'input', type: 'password', name: 'password', autocomplete: 'new-password', required: true, minlength: 8 });
    const meter = h('div', { class: 'pw-meter', 'aria-hidden': 'true' }, h('i'));
    pass.addEventListener('input', () => { const v = pass.value; const s = (v.length >= 8) + /[A-Z]/.test(v) + /[0-9]/.test(v) + /[^A-Za-z0-9]/.test(v) + (v.length >= 12); meter.firstChild.style.width = (s / 5) * 100 + '%'; meter.dataset.s = s; });
    const f = h('form', { class: 'auth-form', novalidate: true },
      field('Nombre', h('input', { class: 'input', name: 'name', autocomplete: 'name', required: true, maxlength: 80 })),
      field('Correo', h('input', { class: 'input', type: 'email', name: 'email', autocomplete: 'email', required: true })),
      field('Contraseña', pass, 'Mínimo 8 caracteres. Mejor si combinas letras, números y símbolos.'), meter,
      terms, errorBox,
      h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Crear cuenta'));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      err(errorBox);
      if (!f.name.value.trim()) return err(errorBox, 'Ingresa tu nombre.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value)) return err(errorBox, 'El correo no es válido.');
      if (pass.value.length < 8 || !/[A-Za-z]/.test(pass.value) || !/[0-9]/.test(pass.value)) return err(errorBox, 'La contraseña necesita al menos 8 caracteres, con letras y números.');
      if (!termsBox.checked) return err(errorBox, 'Tienes que aceptar los términos y la política de privacidad.');
      const btn = f.querySelector('[type=submit]');
      busy(btn, true, 'Creando cuenta…');
      try { await auth.signUpEmail({ name: f.name.value, email: f.email.value, password: pass.value, country: auth.guessCountry() }); toast('Cuenta creada. Te enviamos un correo para verificarla.', 'ok', 6000); }
      catch (ex) { err(errorBox, friendlyError(ex)); busy(btn, false, 'Crear cuenta'); }
    });
    card.append(f);
  } else {
    const f = h('form', { class: 'auth-form', novalidate: true },
      field('Correo', h('input', { class: 'input', type: 'email', name: 'email', autocomplete: 'email', required: true })),
      field('Contraseña', h('input', { class: 'input', type: 'password', name: 'password', autocomplete: 'current-password', required: true })),
      errorBox,
      h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Ingresar'),
      h('button', { class: 'linklike small', type: 'button', style: 'margin-top:12px', onclick: () => renderAuth('reset') }, '¿Olvidaste tu contraseña?'),
      h('p', { class: 'tiny muted', style: 'margin-top:14px', html: 'Al continuar aceptas los <a href="/legal/terminos.html">Términos</a> y la <a href="/legal/privacidad.html">Política de privacidad</a>.' }));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      err(errorBox);
      if (!f.email.value || !f.password.value) return err(errorBox, 'Completa correo y contraseña.');
      const btn = f.querySelector('[type=submit]');
      busy(btn, true, 'Ingresando…');
      try { await auth.signInEmail(f.email.value, f.password.value); }
      catch (ex) { err(errorBox, friendlyError(ex)); busy(btn, false, 'Ingresar'); }
    });
    card.append(f);
  }
}

function field(label, control, hint) {
  const id = 'f-' + (control.name || Math.random().toString(36).slice(2));
  control.id = id;
  return h('div', { class: 'field' }, h('label', { for: id }, label), control, hint ? h('span', { class: 'hint' }, hint) : null);
}

/* =================== Panel =================== */
const PLAN_NAME = { gratis: 'Gratis', pro: 'Pro', empresa: 'Empresa' };
const STATUS = { active: ['Activo', 'ok'], pending: ['Pendiente de confirmación', 'warn'], paused: ['Pausado', 'warn'], canceled: ['Cancelado', 'danger'], past_due: ['Pago vencido', 'danger'] };

async function renderPanel(user) {
  root.innerHTML = '';
  let profile = await auth.getProfile(user.uid);
  const dataError = profile && profile._error;
  if (dataError) profile = null;
  // volver de un checkout
  const ret = await import('./payments.js?v=7.23.0').then((m) => m.handleReturn(user)).catch(() => null);
  // Al volver de Mercado Pago con el id de la suscripción, se pide al servidor que la confirme YA consultando a Mercado Pago
  // (el servidor solo toma el id y lee el estado real de la API; no hace falta webhook ni clave). Sin esperar respuesta.
  if (ret && ret.ok && ret.provider === 'mercadopago' && ret.subscriptionId) {
    engineInit().then(() => engineState.live && engineState.base && fetch(engineState.base + '/api/webhooks/mp?type=subscription_preapproval&data.id=' + encodeURIComponent(ret.subscriptionId), { method: 'POST', keepalive: true })).catch(() => {});
  }
  if (ret && ret.ok) { toast('Pago en verificación: el plan se activa cuando Mercado Pago confirma el cobro.', 'ok', 8000); profile = await auth.getProfile(user.uid); }

  const name = (profile && profile.name) || user.displayName || user.email;
  const head = h('div', { class: 'acc-head' },
    user.photoURL ? h('img', { src: user.photoURL, alt: '', width: 64, height: 64, class: 'acc-photo', referrerpolicy: 'no-referrer' }) : h('span', { class: 'initial acc-photo' }, (name || '?').charAt(0).toUpperCase()),
    h('div', {}, h('h1', {}, name), h('p', { class: 'muted' }, user.email, ' ', user.emailVerified ? h('span', { class: 'chip ok' }, 'Correo verificado') : h('span', { class: 'chip warn' }, 'Correo sin verificar'))),
    h('div', { class: 'row', style: 'margin-left:auto' }, h('a', { class: 'btn', href: '/app/' }, 'Ir al chat'), h('button', { class: 'btn btn-ghost', type: 'button', onclick: async () => { await auth.signOutUser(); location.href = '/'; } }, h('span', { html: icon('logout') }), 'Salir')));
  root.append(head);

  if (googleNotice) {
    root.append(h('div', { class: 'alert ok', role: 'status' }, h('span', { html: icon('check') }), h('div', {},
      h('strong', {}, googleNotice.isNewUser ? 'Tu cuenta quedó registrada con Google.' : 'Tu cuenta de Google quedó vinculada.'),
      h('p', { style: 'margin:6px 0 0' }, 'Permisos otorgados: ', googleNotice.granted.join(' y '), '. No pedimos acceso a Gmail, Drive, Calendar ni a tus contactos. Puedes revocar el acceso cuando quieras desde ', h('a', { href: 'https://myaccount.google.com/permissions', target: '_blank', rel: 'noopener' }, 'tu cuenta de Google'), '.'))));
    googleNotice = null;
  }
  if (!user.emailVerified && user.providerData.some((p) => p.providerId === 'password')) {
    root.append(h('div', { class: 'alert warn' }, h('span', { html: icon('mail') }), h('div', {}, 'Verifica tu correo para proteger tu cuenta. ', h('button', { class: 'linklike', type: 'button', onclick: async () => { try { await auth.resendVerification(); toast('Te reenviamos el correo de verificación.'); } catch (e) { toast(friendlyError(e), 'error'); } } }, 'Reenviar correo'))));
  }
  if (dataError) root.append(h('div', { class: 'alert info' }, h('span', { html: icon('info') }), h('div', {}, 'Tu cuenta funciona, pero el perfil y la membresía todavía no se pueden cargar. Vuelve a intentar en unos minutos.')));
  if (profile && profile.suspended) root.append(h('div', { class: 'alert danger' }, 'Tu cuenta está suspendida. Escríbenos desde el ', h('a', { href: '/contacto/' }, 'formulario de contacto'), '.'));

  const nav = h('nav', { class: 'acc-tabs', role: 'tablist', 'aria-label': 'Secciones de tu cuenta' });
  const pane = h('div', { class: 'acc-pane', role: 'tabpanel' });
  root.append(h('div', { class: 'acc-layout' }, nav, pane));
  const sections = [
    ['membresia', 'Resumen', 'spark'], ['planes', 'Planes', 'card'], ['perfil', 'Perfil', 'user'],
    ['companera', 'Memoria', 'memory'], ['facturacion', 'Historial de pagos', 'file'], ['billetera', 'Billetera', 'lock'], ['seguridad', 'Seguridad', 'shield'], ['privacidad', 'Datos y privacidad', 'eye']
  ];
  for (const [id, label, ic] of sections) nav.append(h('button', { type: 'button', role: 'tab', 'data-tab': id, html: icon(ic) + `<span>${label}</span>`, onclick: () => show(id) }));
  const ctx = { user, profile, reload: () => renderPanel(user) };
  function show(id) {
    nav.querySelectorAll('[role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
    pane.innerHTML = '';
    history.replaceState(null, '', '#' + id);
    ({ membresia, planes, perfil, companera, facturacion, billetera, seguridad, privacidad })[id](pane, ctx);
  }
  const start = (location.hash || '').slice(1);
  show(sections.some(([id]) => id === start) ? start : params.get('siguiente') === 'planes' ? 'planes' : 'membresia');
}

function daysLeft(ts) {
  const d = ts && ts.toDate ? ts.toDate() : ts ? new Date(ts) : null;
  if (!d || isNaN(d)) return null;
  return Math.max(0, Math.ceil((d - Date.now()) / 86400000));
}

function membresia(pane, { user, profile, reload }) {
  const plan = (profile && profile.plan) || 'gratis';
  const sub = (profile && profile.subscription) || null;
  const status = sub ? sub.status : plan === 'gratis' ? 'free' : (profile.planStatus || 'active');
  const LABEL = { free: ['Activo', 'ok'], pending: ['Pago en verificación', 'warn'], active: ['Activo', 'ok'], paused: ['Pausado', 'warn'], canceled: ['Cancelado', 'danger'], past_due: ['Pago vencido', 'danger'] };
  const [stLabel, stClass] = LABEL[status] || [status, ''];
  const price = CONFIG.PRICES[plan];
  const end = sub && sub.currentPeriodEnd;
  const left = daysLeft(end);
  const autoRenew = sub ? sub.autoRenew !== false && status !== 'canceled' : false;
  const provName = sub ? (sub.provider === 'paypal' ? 'PayPal' : 'Mercado Pago') : '—';
  // Tablero: plan, uso de llamadas hoy, renovación y seguridad de un vistazo
  const usedMin = Math.round(callMem.usageToday() / 60);
  const limMin = callMem.LIMIT_MIN[plan] || 10;
  const tile = (label, value, sub2, tab) => h('button', { class: 'acc-tile', type: 'button', onclick: tab ? () => document.querySelector(`[data-tab="${tab}"]`).click() : null }, h('small', {}, label), h('strong', {}, value), h('span', { class: 'tiny muted' }, sub2));
  pane.append(h('div', { class: 'acc-tiles' },
    tile('Plan', PLAN_NAME[plan] || plan, stLabel, 'planes'),
    h('div', { class: 'acc-tile' }, h('small', {}, 'Llamadas hoy'), h('strong', {}, `${usedMin} / ${limMin} min`), h('span', { class: 'meter', role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': limMin, 'aria-valuenow': usedMin, 'aria-label': 'Minutos de llamada usados hoy' }, h('i', { style: `width:${Math.min(100, (usedMin / limMin) * 100).toFixed(0)}%` }))),
    tile('Renovación', sub ? (autoRenew ? 'Automática' : 'Desactivada') : '—', end ? (autoRenew ? 'Próximo cobro ' : 'Hasta ') + fmtDate(end) : 'Sin suscripción', null),
    tile('Seguridad', user.emailVerified ? 'Correo verificado' : 'Verifica tu correo', user.providerData.map((p) => (p.providerId === 'google.com' ? 'Google' : 'Contraseña')).join(' + '), 'seguridad')));
  pane.append(h('div', { class: 'card' },
    h('div', { class: 'row', style: 'justify-content:space-between' },
      h('div', {}, h('p', { class: 'eyebrow' }, 'Tu plan'), h('h2', { style: 'margin:0' }, PLAN_NAME[plan] || plan)),
      h('span', { class: 'chip ' + stClass }, stLabel)),
    h('dl', { class: 'kv' },
      h('dt', {}, 'Precio'), h('dd', {}, price.usd ? `${formatARS(price.ars)} o USD ${price.usd} por mes` : 'Sin costo'),
      h('dt', {}, autoRenew ? 'Próximo cobro' : 'Acceso hasta'), h('dd', {}, end ? fmtDate(end) : '—'),
      h('dt', {}, 'Días restantes'), h('dd', {}, left == null ? '—' : `${left} ${left === 1 ? 'día' : 'días'}`),
      h('dt', {}, 'Medio de pago'), h('dd', {}, sub ? `${provName}${sub.subscriptionId ? ' · ' + sub.subscriptionId : ''}` : '—'))));
  if (sub && sub.status === 'pending') {
    pane.append(h('div', { class: 'alert info' }, h('span', { html: icon('clock') }), h('div', {}, h('strong', {}, `Pago en verificación (${PLAN_NAME[sub.plan] || ''}, ${provName}).`), h('p', { style: 'margin:4px 0 0' }, 'El procesador recibió tu autorización. El plan se activa cuando confirmamos el cobro; recién ahí empiezan tus 30 días. Si pasan 24 h sin novedades, escríbenos desde el formulario de contacto.'))));
  }
  if (sub && ['active', 'paused', 'canceled'].includes(sub.status)) {
    const toggle = h('input', { type: 'checkbox', checked: autoRenew || null, 'aria-label': 'Renovación automática' });
    toggle.addEventListener('change', async () => { const want = toggle.checked; toggle.checked = !want; await billingAction(want ? 'resume' : 'cancel', user, profile, reload); });
    pane.append(h('div', { class: 'card renew' },
      h('label', { class: 'hub-item', style: 'border:0;padding:0' },
        h('div', {}, h('strong', {}, 'Renovación automática: ' + (autoRenew ? 'activada' : 'desactivada')),
          h('p', { class: 'muted small' }, autoRenew ? 'Se cobra cada 30 días. Si la desactivas, no se te vuelve a cobrar y conservas el acceso hasta ' + (end ? fmtDate(end) : 'el fin del período') + '.' : 'No habrá más cobros. Puedes reactivarla cuando quieras.')),
        h('span', { class: 'switch' }, toggle, h('span'))),
      sub.autoRenewRequest ? h('p', { class: 'tiny muted', style: 'margin:8px 0 0' }, `Pedido registrado: ${sub.autoRenewRequest === 'cancel' ? 'desactivar' : 'reactivar'} la renovación.`) : null));
  }
  const actions = h('div', { class: 'row' });
  if (plan === 'gratis' && !(sub && sub.status === 'pending')) actions.append(h('button', { class: 'btn btn-gold', type: 'button', onclick: () => document.querySelector('[data-tab="planes"]').click() }, 'Mejorar plan'));
  else if (plan !== 'gratis') actions.append(h('button', { class: 'btn', type: 'button', onclick: () => document.querySelector('[data-tab="planes"]').click() }, 'Cambiar de plan'));
  if (sub && sub.status === 'active') actions.append(h('button', { class: 'btn', type: 'button', onclick: () => billingAction('pause', user, profile, reload) }, 'Pausar'));
  if (sub && sub.status === 'paused') actions.append(h('button', { class: 'btn btn-primary', type: 'button', onclick: () => billingAction('resume', user, profile, reload) }, 'Reanudar'));
  pane.append(actions, h('p', { class: 'small muted' }, 'Puedes desactivar la renovación o pausar cuando quieras. Si contrataste hace menos de 10 días, puedes usar el ', h('a', { href: '/legal/reembolsos.html#arrepentimiento' }, 'botón de arrepentimiento'), ' (Res. 424/2020).'));
}

async function billingAction(action, user, profile, reload) {
  const txt = { pause: ['Pausar suscripción', 'No se te cobra el próximo período y se pausan los beneficios hasta reanudar.', 'Pausar'], cancel: ['Desactivar renovación automática', 'No se te vuelve a cobrar. Conservas los beneficios hasta el fin del período pagado.', 'Desactivar renovación'], resume: ['Reactivar', 'Se reactiva el cobro mensual con tu medio de pago.', 'Reactivar'] }[action];
  if (!(await confirmDialog({ title: txt[0], text: txt[1], ok: txt[2], danger: action === 'cancel' }))) return;
  if (action === 'cancel' && !(await confirmDialog({ title: '¿Seguro?', text: 'Confirma una vez más que quieres desactivar la renovación automática.', ok: 'Sí, desactivar', danger: true }))) return;
  await engineInit();
  // 1) Con el servidor activo, la acción se ejecuta en el procesador (worker-v2).
  if (engineState.live) {
    try {
      const token = await user.getIdToken();
      const r = await fetch(engineState.base + '/api/billing/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: '{}' });
      if (r.ok) { toast('Listo. Actualizamos tu suscripción.', 'ok'); reload(); return; }
    } catch {}
  }
  // 2) Sin servidor: registramos el pedido (lo procesa el administrador) y damos el enlace directo del procesador.
  try {
    const { fs, db } = await getStore();
    await fs.updateDoc(fs.doc(db, 'users', user.uid), { 'subscription.autoRenewRequest': action, 'subscription.autoRenewRequestAt': fs.serverTimestamp() });
  } catch {}
  const prov = profile && profile.subscription && profile.subscription.provider;
  const link = prov === 'paypal' ? 'https://www.paypal.com/myaccount/autopay/' : 'https://www.mercadopago.com.ar/subscriptions';
  modal({ title: 'Pedido registrado', body: h('div', {}, h('p', {}, 'Registramos tu pedido y lo procesamos a la brevedad. Para que sea inmediato, también puedes hacerlo tú desde el procesador:'), h('a', { class: 'btn btn-primary', href: link, target: '_blank', rel: 'noopener' }, prov === 'paypal' ? 'Abrir pagos automáticos de PayPal' : 'Abrir mis suscripciones de Mercado Pago'), h('p', { class: 'small muted', style: 'margin-top:12px' }, 'Consultas: desde el formulario de contacto (agenticuantico.dev.ar/contacto/)')) });
  reload();
}

function planes(pane, { user, profile, reload }) {
  pane.append(h('h2', {}, 'Elige tu plan'), h('p', { class: 'muted' }, 'Mercado Pago cobra en pesos y PayPal en dólares. Tu tarjeta queda en el procesador: AgentiCuántico nunca la ve.'));
  const mount = h('div', { id: 'planes' });
  pane.append(mount);
  mountPlans(mount, { user, profile, onChange: () => setTimeout(reload, 600) });
  const want = params.get('plan');
  if (['pro', 'empresa'].includes(want)) { params.delete('plan'); openPayModal(want, user, () => setTimeout(reload, 600)); }
  let mem = null;
  try { mem = JSON.parse(sessionStorage.getItem('ac.mpPending') || 'null'); } catch {}
  if (mem && Date.now() - mem.at < 3600_000 && !(profile && profile.subscription && profile.subscription.status === 'pending')) {
    pane.prepend(h('div', { class: 'alert info' }, h('div', {}, '¿Aprobaste la suscripción en Mercado Pago? ',
      h('button', { class: 'linklike', type: 'button', onclick: async () => { const m = await import('./payments.js?v=7.23.0'); try { await m.recordPending(user.uid, { provider: 'mercadopago', plan: mem.plan, subscriptionId: null }); sessionStorage.removeItem('ac.mpPending'); toast('Pago en verificación.', 'ok'); reload(); } catch (e) { toast(friendlyError(e), 'error'); } } }, 'Sí, la aprobé'))));
  }
}

function perfil(pane, { user, profile, reload }) {
  const f = h('form', { class: 'card', novalidate: true },
    h('h2', {}, 'Perfil'),
    field('Nombre', h('input', { class: 'input', name: 'name', value: (profile && profile.name) || user.displayName || '', maxlength: 80, required: true })),
    field('Correo', h('input', { class: 'input', value: user.email || '', disabled: true }), 'El correo se cambia escribiéndonos, por seguridad.'),
    field('País (código de 2 letras)', h('input', { class: 'input', name: 'country', value: (profile && profile.country) || auth.guessCountry(), maxlength: 2, pattern: '[A-Za-z]{2}', style: 'max-width:120px;text-transform:uppercase' })),
    h('dl', { class: 'kv' }, h('dt', {}, 'Ingreso con'), h('dd', {}, user.providerData.map((p) => (p.providerId === 'google.com' ? 'Google' : 'Correo y contraseña')).join(', ')), h('dt', {}, 'Cuenta creada'), h('dd', {}, fmtDate(profile && profile.createdAt ? profile.createdAt : user.metadata.creationTime))),
    h('button', { class: 'btn btn-primary', type: 'submit' }, 'Guardar cambios'));
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = f.querySelector('[type=submit]');
    busy(btn, true, 'Guardando…');
    try {
      const { fb, auth: a } = await getAuthApi();
      await fb.updateProfile(a.currentUser, { displayName: f.name.value.trim().slice(0, 80) });
      const { fs, db } = await getStore();
      await fs.updateDoc(fs.doc(db, 'users', user.uid), { name: f.name.value.trim().slice(0, 80), country: f.country.value.trim().toUpperCase().slice(0, 2) });
      toast('Perfil actualizado', 'ok');
      reload();
    } catch (ex) { toast(friendlyError(ex), 'error'); busy(btn, false, 'Guardar cambios'); }
  });
  pane.append(f);
  const sec = h('div', { class: 'card', style: 'margin-top:16px' }, h('h2', {}, 'Seguridad'));
  if (user.providerData.some((p) => p.providerId === 'password')) sec.append(h('p', { class: 'muted' }, 'Para cambiar la contraseña te enviamos un enlace a tu correo.'), h('button', { class: 'btn', type: 'button', onclick: async () => { try { await auth.resetPassword(user.email); toast('Te enviamos el enlace a ' + user.email); } catch (e) { toast(friendlyError(e), 'error'); } } }, 'Cambiar contraseña'));
  else sec.append(h('p', { class: 'muted' }, 'Ingresas con Google; la contraseña y la verificación en dos pasos se administran en tu cuenta de Google.'));
  pane.append(sec);
}

async function companera(pane, { user }) {
  const mem = await import('./companion/memory.js');
  pane.append(h('h2', {}, 'Lo que AgentiCuántico recuerda de mí'), h('p', { class: 'muted' }, 'Datos que guardó después de tus llamadas para darte continuidad. Puedes editarlos o borrarlos. Las llamadas incógnito no guardan nada.'));
  const settings = await mem.getSettings(user.uid);
  const sw = h('input', { type: 'checkbox', checked: settings.optIn === true || null, 'aria-label': 'Permitir que AgentiCuántico recuerde' });
  sw.addEventListener('change', async () => { try { await mem.saveSettings(user.uid, { optIn: sw.checked }); toast(sw.checked ? 'Memoria activada' : 'Memoria desactivada', 'ok'); } catch (e) { toast(friendlyError(e), 'error'); } });
  pane.append(h('label', { class: 'hub-item' }, h('div', {}, h('strong', {}, 'Permitir que me recuerde'), h('p', { class: 'muted small' }, 'Si lo apagas, no se guardan datos nuevos (lo ya guardado queda hasta que lo borres).')), h('span', { class: 'switch' }, sw, h('span'))));
  const list = h('div', { class: 'hub-list' }, h('div', { class: 'skeleton', style: 'height:60px' }));
  pane.append(list);
  const KIND = { nombre: 'Nombre', persona: 'Persona', 'interés': 'Interés', objetivo: 'Objetivo', 'ocupación': 'Ocupación', pendiente: 'Pendiente', 'ánimo': 'Ánimo', tema: 'Tema' };
  const draw = async () => {
    let items = [];
    try { items = await mem.listMemory(user.uid); } catch (e) { list.innerHTML = ''; list.append(h('p', { class: 'muted small' }, 'No disponible todavía: ' + friendlyError(e))); return; }
    list.innerHTML = '';
    if (!items.length) list.append(h('p', { class: 'muted small' }, 'Todavía no recuerda nada. Llámala desde ', h('a', { href: '/llamada/' }, 'Llamada'), '.'));
    for (const it of items) {
      const input = h('input', { class: 'input', value: it.text, maxlength: 200, 'aria-label': KIND[it.kind] || it.kind });
      input.addEventListener('change', async () => { try { await mem.updateMemory(user.uid, it.id, input.value.trim()); toast('Actualizado', 'ok'); } catch (e) { toast(friendlyError(e), 'error'); } });
      list.append(h('div', { class: 'hub-item' }, h('span', { class: 'chip gold' }, KIND[it.kind] || it.kind), input, h('button', { class: 'icon-btn sm', type: 'button', 'aria-label': 'Borrar', html: icon('trash'), onclick: async () => { try { await mem.deleteMemory(user.uid, it.id); draw(); } catch (e) { toast(friendlyError(e), 'error'); } } })));
    }
    if (items.length) list.append(h('button', { class: 'btn btn-danger-ghost btn-sm', type: 'button', onclick: async () => { if (await confirmDialog({ title: 'Borrar todo', text: '¿Borrar todo lo que AgentiCuántico recuerda de ti?', ok: 'Borrar todo', danger: true })) { await mem.deleteAllMemory(user.uid).catch(() => {}); draw(); } } }, 'Borrar todo'));
  };
  draw();
}

async function facturacion(pane, { user }) {
  pane.append(h('h2', {}, 'Historial de facturación'));
  const box = h('div', {}, h('div', { class: 'skeleton', style: 'height:80px' }));
  pane.append(box);
  try {
    const { fs, db } = await getStore();
    const s = await fs.getDocs(fs.query(fs.collection(db, 'users', user.uid, 'payments'), fs.orderBy('createdAt', 'desc'), fs.limit(50)));
    box.innerHTML = '';
    if (s.empty) { box.append(h('p', { class: 'muted' }, 'Todavía no hay pagos confirmados. Los cobros aparecen aquí cuando el procesador los confirma.')); return; }
    const rows = s.docs.map((d) => d.data());
    box.append(h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ...['Fecha', 'Concepto', 'Medio', 'Importe', 'Estado'].map((t) => h('th', {}, t)))),
      h('tbody', {}, ...rows.map((r) => h('tr', {}, h('td', {}, fmtDate(r.createdAt)), h('td', {}, r.description || ('Plan ' + (PLAN_NAME[r.plan] || ''))), h('td', {}, r.provider === 'paypal' ? 'PayPal' : 'Mercado Pago'), h('td', {}, `${r.currency || ''} ${Number(r.amount || 0).toLocaleString('es-AR')}`), h('td', {}, h('span', { class: 'chip ' + (r.status === 'approved' || r.status === 'COMPLETED' ? 'ok' : '') }, r.status || '—'))))))));
  } catch (e) { box.innerHTML = ''; box.append(h('p', { class: 'muted' }, 'El historial todavía no está disponible. ' + friendlyError(e))); }
}

async function billetera(pane, { user }) {
  pane.append(h('h2', {}, 'Billetera'), h('p', { class: 'muted' }, 'Tus medios de pago para el débito automático se guardan tokenizados en Mercado Pago o PayPal. Aquí solo mostramos la marca y los últimos 4 dígitos; nunca el número completo ni el código de seguridad.'));
  const list = h('div', { class: 'hub-list' }, h('div', { class: 'skeleton', style: 'height:60px' }));
  pane.append(list);
  try {
    const { fs, db } = await getStore();
    const s = await fs.getDocs(fs.collection(db, 'users', user.uid, 'paymentMethods'));
    list.innerHTML = '';
    if (s.empty) list.append(h('p', { class: 'muted small' }, 'No hay medios de pago guardados. Se agregan al suscribirte con PayPal o Mercado Pago.'));
    s.docs.forEach((d) => { const m = d.data(); list.append(h('div', { class: 'hub-item' }, h('span', { class: 'hub-ic', html: icon('card') }), h('div', {}, h('strong', {}, `${m.brand || 'Tarjeta'} •••• ${m.last4 || '----'}`), h('p', { class: 'muted small' }, (m.provider === 'paypal' ? 'PayPal' : 'Mercado Pago') + (m.expMonth ? ` · vence ${m.expMonth}/${m.expYear}` : ''))))); });
  } catch { list.innerHTML = ''; list.append(h('p', { class: 'muted small' }, 'La billetera todavía no está disponible.')); }
  await engineInit();
  const add = h('div', { class: 'card', style: 'margin-top:16px' }, h('h3', {}, 'Agregar tarjeta para débito automático'));
  if (engineState.live && engineState.caps && engineState.caps.billing && engineState.caps.billing.mercadopago && PAYMENTS.mercadopago.PUBLIC_KEY) {
    add.append(h('p', { class: 'muted small' }, 'Carga la tarjeta en el formulario seguro de Mercado Pago (Card Payment Brick).'), h('button', { class: 'btn btn-primary', type: 'button', onclick: () => openCardBrick(user) }, 'Agregar tarjeta'));
  } else {
    add.append(h('p', { class: 'muted small' }, 'Para guardar una tarjeta fuera de una suscripción hace falta el servidor de pagos, que se está activando. Mientras tanto, la tarjeta queda guardada en Mercado Pago o PayPal al suscribirte desde «Planes».'), h('button', { class: 'btn', type: 'button', disabled: true }, 'Agregar tarjeta (muy pronto)'));
  }
  pane.append(add);
}

async function openCardBrick(user) {
  const m = modal({ title: 'Agregar tarjeta', body: h('div', { id: 'cardBrick' }, h('div', { class: 'skeleton', style: 'height:280px' })) });
  try {
    await new Promise((res, rej) => { if (window.MercadoPago) return res(); const s = document.createElement('script'); s.src = 'https://sdk.mercadopago.com/js/v2'; s.onload = res; s.onerror = rej; document.head.append(s); });
    const mp = new window.MercadoPago(PAYMENTS.mercadopago.PUBLIC_KEY, { locale: 'es-AR' });
    m.body.querySelector('#cardBrick').innerHTML = '';
    await mp.bricks().create('cardPayment', 'cardBrick', {
      initialization: { amount: 1 },
      customization: { paymentMethods: { maxInstallments: 1 }, visual: { hideFormTitle: true } },
      callbacks: {
        onReady: () => {},
        onError: () => toast('Mercado Pago no pudo cargar el formulario.', 'error'),
        onSubmit: async (data) => {
          // solo viaja el token de la tarjeta al servidor; jamás el número ni el CVV
          const token = await user.getIdToken();
          const r = await fetch(engineState.base + '/api/billing/mercadopago/card', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ token: data.token, payment_method_id: data.payment_method_id, issuer_id: data.issuer_id }) });
          if (!r.ok) throw new Error('card');
          toast('Tarjeta guardada en Mercado Pago', 'ok');
          m.close();
        }
      }
    });
  } catch { toast('No se pudo abrir el formulario de Mercado Pago.', 'error'); m.close(); }
}

function seguridad(pane, { user }) {
  const providers = user.providerData.map((p) => p.providerId);
  const hasPass = providers.includes('password');
  const row = (title, text, action) => h('div', { class: 'hub-item' }, h('div', {}, h('strong', {}, title), h('p', { class: 'muted small' }, text)), action || null);
  pane.append(h('div', { class: 'card stack' }, h('h2', { style: 'margin:0' }, 'Seguridad de la cuenta'),
    row('Correo', user.email + (user.emailVerified ? ' · verificado' : ' · sin verificar'), user.emailVerified ? h('span', { class: 'chip ok' }, 'Verificado') : h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => { try { await auth.resendVerification(); toast('Te enviamos el correo de verificación.'); } catch (e) { toast(friendlyError(e), 'error'); } } }, 'Verificar')),
    row('Métodos de ingreso', providers.map((p) => (p === 'google.com' ? 'Google' : p === 'password' ? 'Correo y contraseña' : p)).join(' · ') || '—'),
    row(hasPass ? 'Contraseña' : 'Crear contraseña', hasPass ? 'Te enviamos un enlace seguro para cambiarla.' : 'Agrega una contraseña para ingresar también sin Google.', h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => { try { await auth.resetPassword(user.email); toast('Revisa tu correo: te enviamos el enlace.', 'ok'); } catch (e) { toast(friendlyError(e), 'error'); } } }, hasPass ? 'Cambiar' : 'Crear')),
    row('Cerrar sesión', 'Salir de esta cuenta en este dispositivo.', h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: async () => { await auth.signOutUser(); location.href = '/'; } }, 'Salir')),
    h('p', { class: 'tiny muted' }, 'Nunca te vamos a pedir la contraseña por correo ni por chat. Ante cualquier actividad extraña, escríbenos desde el ', h('a', { href: '/contacto/' }, 'formulario de contacto'), '.')));
}

async function privacidad(pane, { user }) {
  pane.append(h('h2', {}, 'Datos y privacidad'),
    h('p', { class: 'muted' }, 'Ejerce tus derechos de acceso, rectificación y supresión (Ley 25.326). También puedes escribirnos desde el ', h('a', { href: '/contacto/' }, 'formulario de contacto'), '.'));
  const exp = h('button', { class: 'btn', type: 'button' }, h('span', { html: icon('download') }), 'Descargar mis datos (JSON)');
  exp.addEventListener('click', async () => {
    busy(exp, true);
    try {
      const { fs, db } = await getStore();
      const out = { exportado: new Date().toISOString(), uid: user.uid, email: user.email };
      const p = await fs.getDoc(fs.doc(db, 'users', user.uid)); out.perfil = p.exists() ? p.data() : null;
      const c = await fs.getDocs(fs.collection(db, 'users', user.uid, 'chats')); out.chats = c.docs.map((d) => d.data());
      const w = await fs.getDoc(fs.doc(db, 'users', user.uid, 'private', 'workspace')); out.espacio = w.exists() ? w.data() : null;
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: 'agenticuantico-mis-datos.json' }); document.body.append(a); a.click(); a.remove();
    } catch (e) { toast(friendlyError(e), 'error'); }
    busy(exp, false);
  });
  const delChats = h('button', { class: 'btn btn-danger-ghost', type: 'button', onclick: async () => {
    if (!(await confirmDialog({ title: 'Borrar todas las conversaciones', text: 'Se borran de tu cuenta y de este dispositivo. No se puede deshacer.', ok: 'Borrar todo', danger: true }))) return;
    const { ChatStore } = await import('./chat/store.js'); const s = new ChatStore(); await s.attachUser(user.uid); await s.clearAll(); toast('Conversaciones borradas', 'ok');
  } }, 'Borrar todas mis conversaciones');
  const delAcc = h('button', { class: 'btn btn-danger', type: 'button', onclick: async () => {
    if (!(await confirmDialog({ title: 'Eliminar cuenta', text: 'Se elimina tu acceso y tus datos de perfil y chats. Si tienes una suscripción activa, cancélala primero.', ok: 'Continuar', danger: true }))) return;
    if (!(await confirmDialog({ title: 'Confirmación final', text: 'Esta acción es permanente. ¿Eliminar la cuenta ' + user.email + '?', ok: 'Eliminar definitivamente', danger: true }))) return;
    try {
      const { fs, db } = await getStore();
      const c = await fs.getDocs(fs.collection(db, 'users', user.uid, 'chats'));
      const b = fs.writeBatch(db); c.docs.slice(0, 400).forEach((d) => b.delete(d.ref)); b.delete(fs.doc(db, 'users', user.uid, 'private', 'workspace')); await b.commit();
      await fs.updateDoc(fs.doc(db, 'users', user.uid), { deletionRequested: fs.serverTimestamp() });
    } catch {}
    try { const { fb, auth: a } = await getAuthApi(); await fb.deleteUser(a.currentUser); toast('Cuenta eliminada'); location.href = '/'; }
    catch (e) { toast(friendlyError(e), 'error', 7000); }
  } }, 'Eliminar mi cuenta');
  pane.append(h('div', { class: 'stack' }, h('div', { class: 'card' }, h('h3', {}, 'Tus datos'), h('p', { class: 'muted small' }, 'Perfil, conversaciones y configuración en un archivo.'), exp), h('div', { class: 'card' }, h('h3', {}, 'Zona de peligro'), h('div', { class: 'row' }, delChats, delAcc))));
}

/* =================== Inicio =================== */
(async () => {
  try { const r = await auth.completeGoogleRedirect(); if (r) googleNotice = r; } catch (e) { console.warn(e); }
  if (params.get('verificado')) toast('¡Correo verificado! Gracias.', 'ok');
  auth.watchUser((u) => {
    if (u) renderPanel(u).catch((e) => { console.error(e); root.innerHTML = '<div class="alert danger">No pudimos cargar tu cuenta. Recarga la página.</div>'; });
    else renderAuth();
    hydrateIcons(root);
  }, { force: true }).catch(() => renderAuth());
})();
