/**
 * /admin/: acceso con clave (dueño y equipo humano), restablecer clave, aceptar invitación,
 * «Equipo humano» (invitar, roles, suspender, revocar) y bitácora. Los permisos los aplica el SERVIDOR;
 * acá solo se esconden los botones que tu rol no puede usar.
 */
import { h, icon, esc, toast, modal, confirmDialog, fmtDate, timeAgo } from './ui.js';
import { CONFIG } from './config.js';

const BASE = String(CONFIG.API_BASE || '').replace(/\/+$/, '');
const STORE = 'ac.panel';
export const ERR = {
  invalid_credentials: 'Clave incorrecta. Tocá «Mostrar» para revisar lo que escribiste (sin espacios de más).',
  too_many_attempts: 'Demasiados intentos. Por seguridad, esperá 15 minutos y probá de nuevo.',
  invalid_email: 'Ese correo no parece válido.', password_too_short: 'La clave tiene que tener al menos 10 caracteres.',
  password_too_long: 'La clave es demasiado larga (máximo 128).', password_too_weak: 'Esa clave es muy fácil de adivinar.',
  invalid_current_password: 'La clave actual no es correcta.', link_expired: 'El enlace venció. Pedí uno nuevo.',
  link_used: 'Ese enlace ya se usó. Pedí uno nuevo si hace falta.', link_revoked: 'Ese enlace ya no sirve (se pidió otro o se revocó).',
  invalid_link: 'El enlace no es válido. Copialo completo desde el correo.', already_member: 'Esa persona ya está en el equipo.',
  only_owner_grants_coceo: 'Solo el dueño puede dar el rol Co-CEO.', cannot_grant_role: 'Tu rol no puede dar ese rol.',
  cannot_manage_owner: 'Al dueño no lo puede modificar nadie.', cannot_manage_role: 'Tu rol no puede modificar a esa persona.',
  cannot_manage_self: 'No podés cambiarte el rol a vos mismo.', area_required: 'Elegí el área del supervisor.', owner_email: 'Ese es el correo del dueño.',
  forbidden_role: 'Tu rol no permite esta acción.', session_expired: 'Tu sesión venció: entrá de nuevo.', login_required: 'Entrá con tu clave.',
  staff_full: 'Llegaste al máximo de personas.', too_many_invites: 'Hay demasiadas invitaciones abiertas.', rate_limited: 'Demasiados pedidos seguidos; esperá un minuto.',
  forbidden_origin: 'El pedido vino de un sitio no permitido.', owner_only: 'Solo el dueño puede hacer esto.',
  api_key_required: 'Pegá la API key de Brevo.', api_key_invalid: 'Esa key no parece válida (sin espacios, 20 a 256 caracteres; las de Brevo empiezan con «xkeysib-»).',
  api_key_is_smtp: 'Esa es la clave SMTP de Brevo («xsmtpsib-»). Hace falta una API key («xkeysib-»): Brevo → SMTP y API → API keys.',
  encryption_not_ready: 'El servidor no tiene el secreto para cifrar la key.', storage_not_configured: 'El servidor no tiene almacenamiento configurado.', panel_not_configured: 'El panel no está configurado en el servidor.'
};
const msg = (e) => ERR[e && e.code] || (e && e.message) || 'No se pudo completar.';

export const session = {
  get() { try { const s = JSON.parse(localStorage.getItem(STORE) || 'null'); if (s && s.t && s.exp > Date.now()) return s; } catch {} localStorage.removeItem(STORE); return null; },
  set(t, exp) { localStorage.setItem(STORE, JSON.stringify({ t, exp })); },
  clear() { localStorage.removeItem(STORE); }
};

export async function api(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (token) headers['X-Panel-Session'] = token;
  if (body) headers['Content-Type'] = 'application/json';
  let r;
  try { r = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }); }
  catch { const e = new Error('No se pudo conectar con el servidor. Revisá tu conexión.'); e.code = 'network'; throw e; }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(ERR[j.error] || j.error || 'error_' + r.status); e.code = j.error || 'http_' + r.status; e.status = r.status; throw e; }
  return j;
}

/** Campo de clave con botón Mostrar/Ocultar y sin autocorrección (Android pone mayúscula o corrige palabras). */
function passField(label, { autocomplete = 'current-password', id } = {}) {
  const input = h('input', { class: 'input', type: 'password', id, autocomplete, autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false', 'aria-label': label, required: true, maxlength: '128' });
  const btn = h('button', { class: 'btn btn-ghost pass-toggle', type: 'button', 'aria-pressed': 'false', 'aria-label': 'Mostrar la clave' }, 'Mostrar');
  btn.onclick = () => { const show = input.type === 'password'; input.type = show ? 'text' : 'password'; btn.textContent = show ? 'Ocultar' : 'Mostrar'; btn.setAttribute('aria-pressed', String(show)); btn.setAttribute('aria-label', show ? 'Ocultar la clave' : 'Mostrar la clave'); input.focus(); };
  return { input, el: h('div', { class: 'pass-wrap' }, input, btn) };
}
const errBox = () => h('p', { class: 'error-text', role: 'alert', hidden: true });
const showErr = (el, e) => { el.textContent = typeof e === 'string' ? e : msg(e); el.hidden = false; };
const card = (title, sub, ...kids) => h('div', { class: 'card gate gate-login panel-gate' }, h('span', { class: 'gate-ic', html: icon('lock') }), h('h1', {}, title), sub ? h('p', { class: 'muted' }, sub) : null, ...kids);

/** Pantalla de ingreso. `onIn(token, me)` cuando entra. */
export function loginGate(root, onIn, note = '', prefill = '') {
  root.replaceChildren();
  const email = h('input', { class: 'input', type: 'email', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', 'aria-label': 'Correo', placeholder: 'tu@correo.com' });
  const emailRow = h('div', { class: 'stack', hidden: true }, h('label', { class: 'label' }, 'Correo'), email);
  const pw = passField('Clave');
  const err = errBox(); const info = h('p', { class: 'small', role: 'status', hidden: true });
  const submit = h('button', { class: 'btn btn-primary full', type: 'submit' }, 'Entrar');
  const form = h('form', { class: 'stack', novalidate: true }, emailRow, h('label', { class: 'label', for: 'pk' }, 'Clave'), pw.el, err, submit);
  pw.input.id = 'pk';
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); err.hidden = true; info.hidden = true;
    const key = pw.input.value;
    if (!key.trim()) { showErr(err, 'Escribí tu clave.'); return; }
    submit.disabled = true; submit.textContent = 'Entrando…';
    try {
      const r = await api('/api/panel/login', { method: 'POST', body: { key: key.trim(), ...(emailRow.hidden ? {} : { email: email.value.trim() }) } });
      session.set(r.token, r.expiresAt); onIn(r.token, { user: r.user, perms: r.perms });
    } catch (ex) { showErr(err, ex); pw.input.select(); }
    finally { submit.disabled = false; submit.textContent = 'Entrar'; }
  });
  const who = h('button', { class: 'linklike small', type: 'button' }, 'Soy del equipo: entrar con mi correo');
  who.onclick = () => { emailRow.hidden = !emailRow.hidden; who.textContent = emailRow.hidden ? 'Soy del equipo: entrar con mi correo' : 'Soy el dueño: entrar solo con la clave'; (emailRow.hidden ? pw.input : email).focus(); };
  const forgot = h('button', { class: 'linklike small', type: 'button' }, '¿Olvidaste la clave?');
  forgot.onclick = async () => {
    err.hidden = true; info.hidden = true;
    if (!emailRow.hidden) { info.textContent = 'Si sos del equipo, pedile al dueño o a un Co-CEO que te mande un enlace para elegir clave nueva.'; info.hidden = false; return; }
    const ok = await confirmDialog({ title: 'Restablecer la clave del dueño', text: 'Te mandamos un enlace de un solo uso (vence en 30 minutos) al correo de la cuenta dueña. Solo se envía a ese correo.', ok: 'Enviar enlace' });
    if (!ok) return;
    forgot.disabled = true;
    try {
      const r = await api('/api/panel/forgot', { method: 'POST', body: {} });
      info.textContent = r.mail && r.mail.sent ? `Listo: te mandamos el enlace a ${r.to}. Revisá también Spam. Vence en 30 minutos.`
        : r.mail && r.mail.reason === 'not_configured' ? 'El envío de correos todavía no está activado en el servidor, así que no salió ningún correo. Mientras tanto, la clave se cambia desde la terminal del dueño.'
          : `No se pudo enviar el correo ahora (${esc(r.mail ? r.mail.reason || 'error' : 'error')}). Probá más tarde.`;
      info.hidden = false;
    } catch (ex) { showErr(err, ex); }
    finally { forgot.disabled = false; }
  };
  root.append(card('Panel de control', note || 'Entrá con tu clave.', form, h('div', { class: 'gate-links' }, forgot, who), info,
    h('p', { class: 'tiny muted', style: 'margin-top:10px' }, 'Por seguridad: 5 intentos cada 15 minutos.')));
  if (prefill) { email.value = prefill; emailRow.hidden = false; who.textContent = 'Soy el dueño: entrar solo con la clave'; setTimeout(() => pw.input.focus(), 0); }
  setTimeout(() => pw.input.focus(), 50);
}

/** Enlace del correo: #restablecer=TOKEN */
export function resetGate(root, token, done) {
  root.replaceChildren();
  const a = passField('Clave nueva', { autocomplete: 'new-password' }); const b = passField('Repetí la clave nueva', { autocomplete: 'new-password' });
  const err = errBox(); const submit = h('button', { class: 'btn btn-primary full', type: 'submit' }, 'Guardar clave nueva');
  const form = h('form', { class: 'stack', novalidate: true }, h('label', { class: 'label' }, 'Clave nueva (mínimo 10 caracteres)'), a.el, h('label', { class: 'label' }, 'Repetila'), b.el, err, submit);
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); err.hidden = true;
    if (a.input.value !== b.input.value) { showErr(err, 'Las dos claves no coinciden.'); return; }
    submit.disabled = true;
    try { await api('/api/panel/reset', { method: 'POST', body: { token, next: a.input.value } }); history.replaceState(null, '', location.pathname); toast('Clave cambiada. Entrá con la nueva.', 'success'); done(); }
    catch (ex) { showErr(err, ex); submit.disabled = false; }
  });
  root.append(card('Elegí una clave nueva', 'El enlace sirve una sola vez. Al guardar, se cierran las sesiones abiertas.', form));
}

/** Enlace de invitación: #invitacion=TOKEN */
export async function inviteGate(root, token, onIn) {
  root.replaceChildren(card('Invitación', 'Revisando el enlace…', h('div', { class: 'skeleton', style: 'height:80px' })));
  let info;
  try { info = await api('/api/panel/invite/info', { method: 'POST', body: { token } }); }
  catch (ex) { root.replaceChildren(card('Invitación', msg(ex), h('a', { class: 'btn', href: '/admin/' }, 'Ir al panel'))); return; }
  const name = h('input', { class: 'input', type: 'text', autocomplete: 'name', maxlength: '60', value: info.name || '', 'aria-label': 'Tu nombre' });
  const a = passField('Elegí tu clave', { autocomplete: 'new-password' }); const b = passField('Repetí tu clave', { autocomplete: 'new-password' });
  const err = errBox(); const submit = h('button', { class: 'btn btn-primary full', type: 'submit' }, 'Aceptar y entrar');
  const form = h('form', { class: 'stack', novalidate: true },
    h('p', { class: 'small' }, 'Correo: ', h('strong', {}, info.email), ' · Rol: ', h('strong', {}, info.roleLabel + (info.area ? ` (${AREA[info.area] || info.area})` : ''))),
    h('label', { class: 'label' }, 'Tu nombre'), name, h('label', { class: 'label' }, 'Tu clave (mínimo 10 caracteres)'), a.el, h('label', { class: 'label' }, 'Repetila'), b.el, err, submit);
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); err.hidden = true;
    if (a.input.value !== b.input.value) { showErr(err, 'Las dos claves no coinciden.'); return; }
    submit.disabled = true;
    try { const r = await api('/api/panel/invite/accept', { method: 'POST', body: { token, name: name.value, password: a.input.value } }); history.replaceState(null, '', location.pathname); session.set(r.token, r.expiresAt); onIn(r.token, { user: r.user, perms: r.perms }); }
    catch (ex) { showErr(err, ex); submit.disabled = false; }
  });
  root.replaceChildren(card('Te sumaron al equipo', `Vence ${fmtDate(new Date(info.expiresAt), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}.`, form));
}

/** Cambiar la propia clave (con sesión pide la actual). */
export function changeKeyDialog(token, { needCurrent = true } = {}) {
  const cur = passField('Clave actual'); const a = passField('Clave nueva', { autocomplete: 'new-password' }); const b = passField('Repetí la clave nueva', { autocomplete: 'new-password' });
  const err = errBox();
  const body = h('div', { class: 'stack' }, needCurrent ? h('label', { class: 'label' }, 'Clave actual') : null, needCurrent ? cur.el : null, h('label', { class: 'label' }, 'Clave nueva (mínimo 10 caracteres)'), a.el, h('label', { class: 'label' }, 'Repetila'), b.el, err,
    h('p', { class: 'tiny muted' }, 'Se cierran tus otras sesiones abiertas.'));
  modal({ title: 'Cambiar clave', body, actions: [{ label: 'Cancelar', class: 'btn-ghost' }, { label: 'Guardar', class: 'btn-primary', onClick: async () => {
    err.hidden = true;
    if (a.input.value !== b.input.value) { showErr(err, 'Las dos claves no coinciden.'); return false; }
    try { await api('/api/panel/password', { method: 'POST', token, body: { current: cur.input.value, next: a.input.value } }); toast('Clave cambiada.', 'success'); return true; }
    catch (ex) { showErr(err, ex); return false; }
  } }] });
}

const AREA = { dev: 'Desarrollo', soporte: 'Soporte', diseno: 'Diseño', crecimiento: 'Crecimiento' };
const PERM_TXT = {
  'panel.view': 'Ver panel, organigrama y cola', 'team.order': 'Dar órdenes a agentes', 'team.decide.small': 'Aprobar cambios chicos', 'team.decide.all': 'Aprobar planes y contrataciones',
  'team.edit': 'Editar organigrama', 'team.layout': 'Mover nodos', 'team.tick': 'Hacer trabajar un turno', 'agents.run': 'Hacer trabajar agentes', 'agents.state': 'Pausar / parada de emergencia',
  'pr.view': 'Ver propuestas (PR)', 'pr.decide': 'Aprobar / rechazar PR', 'gh.order': 'Órdenes en GitHub', 'support.inbox': 'Bandeja de soporte', 'ai.view': 'Ver gobernanza IA', 'ai.edit': 'Editar gobernanza IA',
  'neurons.view': 'Ver cupo de IA', 'billing.view': 'Ingresos y pagos', 'staff.view': 'Ver equipo humano', 'staff.invite': 'Invitar personas', 'staff.manage': 'Cambiar rol / suspender / revocar',
  'staff.grant_coceo': 'Dar rol Co-CEO', 'audit.view': 'Ver bitácora', 'owner.settings': 'Ajustes del dueño'
};
const ACTION_TXT = { mail_key_set: 'Guardó la key de envío de mails', mail_key_deleted: 'Borró la key de envío de mails', mail_test: 'Probó el envío de mails', login: 'Entró', login_failed: 'Intento fallido de ingreso', logout: 'Salió', password_changed: 'Cambió su clave', password_change_failed: 'Falló el cambio de clave', reset_requested: 'Pidió restablecer la clave', reset_done: 'Restableció la clave', invite_created: 'Invitó', invite_accepted: 'Aceptó la invitación', invite_revoked: 'Revocó una invitación', role_changed: 'Cambió el rol de', suspended: 'Suspendió a', reactivated: 'Reactivó a', access_revoked: 'Quitó el acceso a', member_reset_link: 'Mandó enlace de clave a', owner_key_set: 'Se fijó la clave del dueño', denied: 'Intentó sin permiso', admin_post: 'Acción', admin_patch: 'Edición', admin_delete: 'Borrado' };

/** Sección «Equipo humano»: personas, invitaciones abiertas, invitar y matriz de permisos. */
export async function renderStaff(box, token, me) {
  const perms = new Set(me.perms || []);
  const root = h('div', { class: 'stack-lg staff' }); box.replaceChildren(root);
  async function load() {
    root.replaceChildren(h('div', { class: 'card panel' }, h('div', { class: 'skeleton', style: 'height:200px' })));
    let d;
    try { d = await api('/api/panel/staff', { token }); }
    catch (ex) { root.replaceChildren(h('div', { class: 'alert warn' }, h('span', { html: icon('warn') }), h('div', {}, msg(ex)))); return; }
    draw(d);
  }
  function draw(d) {
    root.replaceChildren();
    if (d.mail === 'none') root.append(h('div', { class: 'alert warn' }, h('span', { html: icon('mail') }), h('div', {}, h('strong', {}, 'Los correos todavía no salen. '), 'Falta activar el envío (clave gratuita de Brevo). Mientras tanto, al invitar vas a ver el enlace para mandarlo vos por WhatsApp o mail.')));
    const people = h('section', { class: 'card panel' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Equipo humano'), perms.has('staff.invite') ? h('button', { class: 'btn btn-primary', type: 'button', html: icon('plus') + 'Invitar', onclick: () => inviteDialog(d) }) : null));
    const list = h('ul', { class: 'staff-list', role: 'list' });
    for (const u of d.users) {
      const acts = h('div', { class: 'staff-acts' });
      if (u.canManage) {
        acts.append(h('button', { class: 'btn btn-sm', type: 'button', onclick: () => roleDialog(d, u) }, 'Rol'));
        acts.append(h('button', { class: 'btn btn-sm', type: 'button', onclick: () => act(u, u.status === 'activo' ? 'suspend' : 'reactivate', u.status === 'activo' ? `¿Suspender a ${u.email}? Se cierra su sesión y no puede entrar hasta que lo reactives.` : null) }, u.status === 'activo' ? 'Suspender' : 'Reactivar'));
        acts.append(h('button', { class: 'btn btn-sm', type: 'button', onclick: () => act(u, 'reset-link', `¿Mandar a ${u.email} un enlace para elegir clave nueva? (vence en 30 min)`) }, 'Enlace de clave'));
        acts.append(h('button', { class: 'btn btn-sm btn-danger', type: 'button', onclick: () => act(u, 'revoke', `¿Quitar el acceso a ${u.email}? Se borra su cuenta del panel (queda en la bitácora).`, true) }, 'Quitar acceso'));
      }
      list.append(h('li', { class: 'staff-row' + (u.status !== 'activo' ? ' is-off' : '') },
        h('span', { class: 'staff-av', 'aria-hidden': 'true' }, (u.name || u.email).slice(0, 1).toUpperCase()),
        h('div', { class: 'staff-main' }, h('p', { class: 'staff-name' }, u.name || u.email.split('@')[0], u.owner ? h('span', { class: 'chip' }, 'Dueño') : null, u.status !== 'activo' ? h('span', { class: 'chip warn' }, 'Suspendido') : null),
          h('p', { class: 'tiny muted staff-mail' }, u.email), h('p', { class: 'small' }, h('strong', {}, u.roleLabel), u.area ? ` · ${AREA[u.area] || u.area}` : '', u.lastLoginAt ? ` · entró ${timeAgo(u.lastLoginAt)}` : ' · todavía no entró')),
        acts));
    }
    people.append(list);
    root.append(people);
    if (d.invites && d.invites.length) {
      const inv = h('section', { class: 'card panel' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Invitaciones abiertas')));
      const ul = h('ul', { class: 'staff-list', role: 'list' });
      for (const i of d.invites) ul.append(h('li', { class: 'staff-row' }, h('span', { class: 'staff-av', 'aria-hidden': 'true', html: icon('mail') }),
        h('div', { class: 'staff-main' }, h('p', { class: 'staff-name' }, i.email), h('p', { class: 'small' }, (d.roles.find((r) => r.id === i.role) || {}).label || i.role, i.area ? ` · ${AREA[i.area]}` : '', ` · vence ${timeAgo(i.expires_at).replace('hace ', 'en ')}`)),
        perms.has('staff.invite') ? h('div', { class: 'staff-acts' }, h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => { if (!(await confirmDialog({ title: 'Revocar invitación', text: `El enlace enviado a ${i.email} deja de servir.`, ok: 'Revocar', danger: true }))) return; try { await api(`/api/panel/invites/${i.id}/revoke`, { method: 'POST', token, body: {} }); toast('Invitación revocada.'); load(); } catch (ex) { toast(msg(ex), 'danger'); } } }, 'Revocar')) : null));
      inv.append(ul); root.append(inv);
    }
    // Matriz de permisos (lo que aplica el servidor)
    const mx = h('section', { class: 'card panel' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Qué puede hacer cada rol')), h('p', { class: 'small muted' }, 'Esto lo controla el servidor en cada pedido, no solo los botones. El supervisor actúa solo sobre los agentes de su área.'));
    const roles = d.matrix.roles;
    const table = h('table', { class: 'perm-table' }, h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Permiso'), ...roles.map((r) => h('th', { scope: 'col' }, r.label.replace(' / Administrador', ''))))),
      h('tbody', {}, ...d.matrix.perms.map((p) => h('tr', {}, h('th', { scope: 'row' }, PERM_TXT[p] || p), ...roles.map((r) => { const y = r.perms.includes(p); return h('td', { class: y ? 'yes' : 'no', 'aria-label': y ? 'Sí' : 'No' }, y ? '✓' : '–'); })))));
    mx.append(h('div', { class: 'perm-scroll', tabindex: '0', role: 'region', 'aria-label': 'Tabla de permisos por rol' }, table));
    root.append(mx);
  }
  async function act(u, op, question, danger = false) {
    if (question && !(await confirmDialog({ title: 'Confirmar', text: question, ok: 'Sí, seguir', danger }))) return;
    try {
      const r = await api(`/api/panel/staff/${u.id}/${op}`, { method: 'POST', token, body: {} });
      toast(op === 'reset-link' ? (r.mail && r.mail.sent ? 'Enlace enviado.' : 'No salió el correo: el envío no está activado.') : 'Listo.', r.mail && !r.mail.sent ? 'danger' : 'success'); load();
    } catch (ex) { toast(msg(ex), 'danger'); }
  }
  function roleSelect(d, current) {
    const sel = h('select', { class: 'select', 'aria-label': 'Rol' }, ...d.roles.filter((r) => r.grantable).map((r) => h('option', { value: r.id, selected: r.id === current }, r.label)));
    const area = h('select', { class: 'select', 'aria-label': 'Área' }, ...d.areas.map((a) => h('option', { value: a.id }, a.label)));
    const areaRow = h('div', { class: 'stack' }, h('label', { class: 'label' }, 'Área del supervisor'), area);
    const sync = () => { areaRow.hidden = sel.value !== 'supervisor'; }; sel.onchange = sync; sync();
    return { sel, area, areaRow };
  }
  function inviteDialog(d) {
    const email = h('input', { class: 'input', type: 'email', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', 'aria-label': 'Correo de la persona', placeholder: 'persona@correo.com' });
    const name = h('input', { class: 'input', type: 'text', maxlength: '60', 'aria-label': 'Nombre (opcional)', placeholder: 'Nombre (opcional)' });
    const rs = roleSelect(d, 'observador'); const err = errBox();
    const body = h('div', { class: 'stack' }, h('label', { class: 'label' }, 'Correo'), email, h('label', { class: 'label' }, 'Nombre'), name, h('label', { class: 'label' }, 'Rol'), rs.sel, rs.areaRow, err,
      h('p', { class: 'tiny muted' }, 'Le llega un enlace de un solo uso que vence en 72 horas; elige su propia clave al aceptar.'));
    modal({ title: 'Invitar al equipo', body, actions: [{ label: 'Cancelar', class: 'btn-ghost' }, { label: 'Enviar invitación', class: 'btn-primary', onClick: async () => {
      err.hidden = true;
      try {
        const r = await api('/api/panel/staff/invite', { method: 'POST', token, body: { email: email.value.trim(), name: name.value.trim(), role: rs.sel.value, area: rs.sel.value === 'supervisor' ? rs.area.value : undefined } });
        if (r.mail && r.mail.sent) toast('Invitación enviada a ' + r.invite.email, 'success');
        else if (r.link) linkDialog(r.invite.email, r.link);
        load(); return true;
      } catch (ex) { showErr(err, ex); return false; }
    } }] });
  }
  function linkDialog(to, link) {
    const inp = h('input', { class: 'input', type: 'text', readonly: true, value: link, 'aria-label': 'Enlace de invitación' });
    const copy = h('button', { class: 'btn btn-primary', type: 'button', html: icon('copy') + 'Copiar enlace' });
    copy.onclick = async () => { try { await navigator.clipboard.writeText(link); toast('Enlace copiado.'); } catch { inp.select(); } };
    modal({ title: 'El correo no salió', body: h('div', { class: 'stack' }, h('p', { class: 'small' }, `El envío de correos no está activado. Mandale este enlace a ${to} vos mismo (sirve una vez, 72 h):`), inp, copy), actions: [{ label: 'Listo', class: 'btn-ghost' }] });
  }
  function roleDialog(d, u) {
    const rs = roleSelect(d, u.role); if (u.area) rs.area.value = u.area; const err = errBox();
    modal({ title: 'Rol de ' + (u.name || u.email), body: h('div', { class: 'stack' }, h('label', { class: 'label' }, 'Rol'), rs.sel, rs.areaRow, err), actions: [{ label: 'Cancelar', class: 'btn-ghost' }, { label: 'Guardar', class: 'btn-primary', onClick: async () => {
      try { await api(`/api/panel/staff/${u.id}/role`, { method: 'POST', token, body: { role: rs.sel.value, area: rs.sel.value === 'supervisor' ? rs.area.value : undefined } }); toast('Rol cambiado.', 'success'); load(); return true; } catch (ex) { showErr(err, ex); return false; }
    } }] });
  }
  load();
}

/** Bitácora: quién hizo qué. */
export async function renderAudit(box, token) {
  box.replaceChildren(h('div', { class: 'card panel' }, h('div', { class: 'skeleton', style: 'height:200px' })));
  let d;
  try { d = await api('/api/panel/audit?limit=150', { token }); }
  catch (ex) { box.replaceChildren(h('div', { class: 'alert warn' }, h('span', { html: icon('warn') }), h('div', {}, msg(ex)))); return; }
  const sec = h('section', { class: 'card panel' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Bitácora'), h('button', { class: 'btn btn-sm', type: 'button', html: icon('refresh') + 'Actualizar', onclick: () => renderAudit(box, token) })));
  if (!d.entries.length) sec.append(h('p', { class: 'muted' }, 'Todavía no hay movimientos.'));
  const ul = h('ul', { class: 'audit-list', role: 'list' });
  for (const e of d.entries) ul.append(h('li', {}, h('span', { class: 'tiny muted audit-at' }, fmtDate(new Date(e.at), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })),
    h('span', { class: 'audit-txt' }, h('strong', {}, e.actor_email || 'Alguien'), ' ', (ACTION_TXT[e.action] || e.action).toLowerCase(), e.target ? ' ' + e.target : '', e.detail && !/^admin_/.test(e.action) ? h('span', { class: 'muted' }, ' · ' + e.detail) : '')));
  sec.append(ul); box.replaceChildren(sec);
}

/* =================== Configuración (solo el dueño) =================== */
const SRC_TXT = { worker: 'secreto del servidor', panel: 'guardada en este panel (cifrada)', setup: 'cargada por la terminal (/api/setup)' };
/** «Envío de mails (Brevo)»: guardar la API key (nunca se muestra de vuelta) y probar el envío a la cuenta dueña. */
export async function renderSettings(box, token) {
  const sec = h('section', { class: 'card panel mailcfg', id: 'mailcfg', 'aria-labelledby': 'mailcfg-h' });
  box.replaceChildren(sec);
  sec.append(h('div', { class: 'skeleton', style: 'height:180px' }));
  let st;
  try { st = (await api('/api/panel/settings/mail', { token })).mail; }
  catch (ex) { sec.replaceChildren(h('div', { class: 'alert warn' }, h('span', { html: icon('warn') }), h('div', {}, msg(ex)))); return; }
  draw(st);
  function draw(st) {
    const status = h('p', { class: 'mailcfg-status', id: 'mailcfg-status', role: 'status' },
      st.configured ? h('span', { class: 'chip ok' }, `Configurada · termina en ${st.last4}`) : h('span', { class: 'chip warn' }, 'Sin configurar'),
      st.configured ? h('span', { class: 'tiny muted' }, ' ' + (SRC_TXT[st.source] || '')) : null);
    const keyIn = h('input', { class: 'input', type: 'password', id: 'brevo-api-key', name: 'brevoApiKey', autocomplete: 'off', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false', maxlength: '256', placeholder: st.configured ? 'Pegá una key nueva para reemplazarla' : 'xkeysib-…', 'aria-describedby': 'brevo-key-help' });
    const emailIn = h('input', { class: 'input', type: 'email', id: 'brevo-sender-email', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', value: st.sender.email });
    const nameIn = h('input', { class: 'input', type: 'text', id: 'brevo-sender-name', autocomplete: 'off', maxlength: '60', value: st.sender.name });
    const err = errBox(); const out = h('div', { class: 'mailcfg-result', id: 'mailcfg-result', role: 'status', 'aria-live': 'polite', hidden: true });
    const save = h('button', { class: 'btn btn-primary', type: 'submit', id: 'brevo-save' }, 'Guardar');
    const test = h('button', { class: 'btn', type: 'button', id: 'brevo-test', disabled: !st.configured, html: icon('mail') + 'Probar envío' });
    const del = st.stored ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', id: 'brevo-delete' }, 'Borrar la key guardada') : null;
    const form = h('form', { class: 'stack', id: 'brevo-form', novalidate: true },
      h('label', { class: 'label', for: 'brevo-api-key' }, 'API key de Brevo'), keyIn,
      h('p', { class: 'tiny muted', id: 'brevo-key-help' }, 'Se guarda cifrada y nunca se vuelve a mostrar. Brevo → SMTP y API → API keys → «Generate a new API key».'),
      h('div', { class: 'mailcfg-grid' },
        h('div', { class: 'stack' }, h('label', { class: 'label', for: 'brevo-sender-email' }, 'Correo remitente'), emailIn),
        h('div', { class: 'stack' }, h('label', { class: 'label', for: 'brevo-sender-name' }, 'Nombre remitente'), nameIn)),
      h('p', { class: 'tiny muted' }, 'El remitente tiene que estar verificado en Brevo (Remitentes). Al ser un Gmail, algunos correos pueden ir a Spam.'),
      err, h('div', { class: 'row mailcfg-acts' }, save, test, del));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); err.hidden = true; out.hidden = true;
      const k = keyIn.value.trim();
      if (!k && !st.stored) { showErr(err, 'Pegá la API key de Brevo.'); keyIn.focus(); return; }
      save.disabled = true; save.textContent = 'Guardando…';
      try {
        const r = await api('/api/panel/settings/mail', { method: 'POST', token, body: { ...(k ? { apiKey: k } : {}), senderEmail: emailIn.value.trim(), senderName: nameIn.value.trim() } });
        keyIn.value = ''; toast('Guardado.', 'success'); draw(r.mail);
      } catch (ex) { showErr(err, ex); }
      finally { save.disabled = false; save.textContent = 'Guardar'; }
    });
    test.onclick = async () => {
      err.hidden = true; test.disabled = true; out.hidden = false; out.className = 'mailcfg-result'; out.textContent = 'Enviando correo de prueba…';
      try {
        const r = await api('/api/panel/settings/mail/test', { method: 'POST', token, body: {} });
        const x = r.result || {};
        out.className = 'mailcfg-result ' + (x.sent ? 'ok' : 'bad');
        out.replaceChildren(...[
          h('p', {}, h('strong', {}, x.sent ? `Enviado a ${r.to}. Revisá la bandeja y Spam.` : 'Brevo no lo envió.')),
          h('p', { class: 'small', id: 'mailcfg-brevo' }, `Respuesta de ${x.provider === 'none' ? 'servidor' : 'Brevo'}: ${x.status ?? '—'}${x.code ? ' · ' + x.code : ''}${x.message ? ' · ' + x.message : ''}${x.messageId ? ' · id ' + x.messageId : ''}`),
          !x.sent && /ip/i.test(x.message || '') ? h('p', { class: 'tiny' }, 'Brevo bloquea IPs desconocidas: en Brevo → Seguridad → IPs autorizadas, desactivá el bloqueo (los servidores de Cloudflare cambian de IP).') : null,
          !x.sent && /sender/i.test((x.message || '') + (x.code || '')) ? h('p', { class: 'tiny' }, 'Verificá el remitente en Brevo → Remitentes, dominios e IPs.') : null].filter(Boolean));
      } catch (ex) { out.className = 'mailcfg-result bad'; out.textContent = msg(ex); }
      finally { test.disabled = false; }
    };
    if (del) del.onclick = async () => {
      if (!(await confirmDialog({ title: 'Borrar la key de Brevo', text: 'Los correos del panel dejan de salir hasta que cargues otra.', ok: 'Borrar', danger: true }))) return;
      try { const r = await api('/api/panel/settings/mail', { method: 'DELETE', token }); toast('Key borrada.'); draw(r.mail); } catch (ex) { showErr(err, ex); }
    };
    sec.replaceChildren(h('div', { class: 'panel-head' }, h('h2', { id: 'mailcfg-h' }, 'Envío de mails (Brevo)')),
      h('p', { class: 'small muted' }, 'Con esto salen los correos de invitación y de «¿Olvidaste la clave?». La prueba se manda solo a la cuenta dueña.'),
      status, form, out);
  }
}
