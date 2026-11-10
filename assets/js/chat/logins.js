/**
 * Cuentas guardadas de la computadora del agente (Centro de control → Conectores → Cuentas).
 * La persona guarda usuario y contraseña de un sitio; el servidor los cifra y solo los usa para completar el
 * formulario de inicio de sesión de ese sitio. Aquí solo se muestra el sitio y el usuario enmascarado. Nunca se
 * devuelven las contraseñas ni las ve el agente.
 */
import { h, icon, toast, confirmDialog } from '../ui.js';
import { state as engineState, ensureLive } from './engine.js';
import { CONFIG } from '../config.js';

async function api(chat, path, body) {
  if (!chat.user) throw Object.assign(new Error('login_required'), { code: 'login_required' });
  await ensureLive();
  const base = engineState.base || String(CONFIG.API_BASE || '').replace(/\/+$/, '');
  const send = async (force) => {
    let t;
    try { t = await chat.user.getIdToken(force); } catch { throw Object.assign(new Error('session_expired'), { code: 'session_expired' }); }
    try { return await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + t, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }); } catch {
      throw Object.assign(new Error('offline'), { code: navigator.onLine === false ? 'network' : 'offline' });
    }
  };
  let r = await send(false);
  if (r.status === 401) r = await send(true);
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) throw Object.assign(new Error('session_expired'), { code: 'session_expired' });
  if (!r.ok) { const e = new Error(j.error || 'error'); e.code = j.error || (r.status >= 500 ? 'offline' : 'error'); throw e; }
  return j;
}

const ERR = { vault_unavailable: 'La bóveda de cuentas no está disponible en este momento.', invalid_host: 'Escribe un sitio válido, por ejemplo mercadolibre.com.ar.', invalid_credentials: 'Completa el usuario y la contraseña.', login_required: 'Ingresa a tu cuenta para guardar cuentas.', session_expired: 'Tu sesión venció. Ingresa de nuevo para ver tus cuentas guardadas.', offline: 'El servidor no responde en este momento.', network: 'No hay conexión a internet.' };

export async function renderLogins(pane, chat) {
  const sec = h('section', { class: 'lg-sec' },
    h('h3', { class: 'conn-subtitle' }, h('span', { html: icon('lock') }), 'Cuentas para la computadora del agente'),
    h('p', { class: 'muted small' }, 'Guarda tus inicios de sesión: cuando un sitio los pida, el agente los completa solo. Se guardan cifrados, nunca se muestran y el agente no los ve.'));
  const list = h('div', { class: 'lg-list' });
  sec.append(list);
  pane.append(sec);
  const draw = async () => {
    list.replaceChildren(h('div', { class: 'skeleton', style: 'height:44px;border-radius:12px' }));
    if (!chat.user) { list.replaceChildren(h('button', { class: 'btn btn-sm', type: 'button', onclick: () => chat.loginPrompt('Ingresa para guardar tus cuentas.') }, 'Ingresar')); return; }
    let st;
    try { st = await api(chat, '/api/agent/logins'); } catch (e) {
      const again = e.code === 'session_expired'
        ? h('button', { class: 'btn btn-sm', type: 'button', onclick: () => chat.loginPrompt('Tu sesión venció. Ingresa de nuevo.') }, 'Ingresar de nuevo')
        : h('button', { class: 'btn btn-sm', type: 'button', onclick: () => draw() }, 'Reintentar');
      list.replaceChildren(h('p', { class: 'muted small', 'data-state': e.code || 'error' }, ERR[e.code] || 'No pude cargar tus cuentas.'), again);
      return;
    }
    const rows = (st.logins || []).map((l) => h('div', { class: 'lg-row' },
      h('span', { class: 'lg-ic', html: icon('globe') }),
      h('div', { class: 'lg-who' }, h('strong', { 'data-no-i18n': '' }, l.host), h('small', { class: 'muted', 'data-no-i18n': '' }, l.label)),
      h('button', { class: 'ace-ib', type: 'button', title: 'Eliminar', 'aria-label': 'Eliminar ' + l.host, html: icon('trash'), onclick: async () => {
        if (!(await confirmDialog({ title: 'Eliminar cuenta', text: `¿Eliminar la cuenta guardada de ${l.host}?`, ok: 'Eliminar', danger: true }))) return;
        try { await api(chat, '/api/agent/logins/delete', { host: l.host }); toast('Cuenta eliminada'); draw(); } catch (e) { toast(ERR[e.code] || 'No se pudo eliminar'); }
      } })));
    list.replaceChildren(...(rows.length ? rows : [h('p', { class: 'muted small lg-empty' }, 'Todavía no guardaste cuentas.')]), addForm(chat, draw, st.ready !== false));
  };
  await draw();
}

function addForm(chat, done, ready) {
  const f = h('form', { class: 'lg-form', autocomplete: 'off' },
    h('div', { class: 'lg-grid' },
      h('label', {}, h('span', {}, 'Sitio'), h('input', { name: 'host', placeholder: 'mercadolibre.com.ar', required: true, autocapitalize: 'off', spellcheck: 'false', inputmode: 'url' })),
      h('label', {}, h('span', {}, 'Usuario o correo'), h('input', { name: 'username', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', required: true })),
      h('label', {}, h('span', {}, 'Contraseña'), h('input', { name: 'password', type: 'password', autocomplete: 'new-password', required: true }))),
    h('button', { class: 'btn btn-sm btn-primary', type: 'submit', disabled: ready ? null : true }, h('span', { html: icon('lock') }), 'Guardar cifrada'));
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = new FormData(f);
    const body = { host: String(d.get('host') || ''), username: String(d.get('username') || ''), password: String(d.get('password') || '') };
    f.reset();
    try { await api(chat, '/api/agent/logins', body); toast('Cuenta guardada'); done(); } catch (er) { toast(ERR[er.code] || 'No se pudo guardar'); }
  });
  return f;
}
