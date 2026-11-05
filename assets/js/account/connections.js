/**
 * Pestaña «Cuentas conectadas»: galería de conectores (GitHub, Gmail, LinkedIn y Cloudflare).
 * - OAuth (GitHub, Gmail, LinkedIn): «Conectar» lleva directo a la pantalla de permiso del proveedor en esta misma
 *   pestaña; al aprobar, el servidor guarda la conexión cifrada y vuelve a /app/?cuenta=conectada&proveedor=…
 *   Los tokens quedan cifrados en el servidor y nunca llegan acá.
 * - Cada cuenta conectada tiene «Usar en el chat» (activar/desactivar sin borrarla) y «Desconectar».
 * - Cloudflare: se pega un API token con permisos acotados; el servidor lo verifica antes de guardarlo.
 * - Si el dueño todavía no cargó las credenciales de un proveedor, se muestra «Conexión no configurada».
 */
import { h, icon, toast, confirmDialog, timeAgo } from '../ui.js';
import { call, errorText } from './api.js';
import { startConnect } from './oauth-connect.js';

export const LOGOS = {
  github: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z"/></svg>',
  google: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#ea4335" d="M3 6.5 12 13l9-6.5V18a1.5 1.5 0 0 1-1.5 1.5H18V9.8l-6 4.3-6-4.3v9.7H4.5A1.5 1.5 0 0 1 3 18z"/><path fill="#c5221f" d="M21 6.5 12 13 3 6.5V6a1.5 1.5 0 0 1 2.4-1.2L12 9.6l6.6-4.8A1.5 1.5 0 0 1 21 6z"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="4" fill="#0a66c2"/><path fill="#fff" d="M7.1 9.4h-2.6V19h2.6zM5.8 5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM19.5 13.4c0-2.6-1.4-4.2-3.6-4.2-1.3 0-2.1.7-2.5 1.3V9.4h-2.5V19h2.6v-5.1c0-1.3.6-2.1 1.7-2.1 1 0 1.6.7 1.6 2.1V19h2.7z"/></svg>',
  cloudflare: '<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="#f38020" d="M21.9 22.6l.3-1c.3-1.1.2-2.1-.4-2.8-.5-.6-1.3-1-2.3-1.1l-11.6-.1a.3.3 0 0 1-.2-.1.3.3 0 0 1 0-.3c0-.1.1-.2.3-.2l11.7-.1c1.4-.1 2.9-1.2 3.4-2.6l.7-1.8.1-.4A7.6 7.6 0 0 0 9.3 11a3.4 3.4 0 0 0-5.4 3.6A4.8 4.8 0 0 0-.5 19.6c0 .2 0 .5.1.7 0 .1.1.2.2.2h21.5c.1 0 .2-.1.3-.2z"/><path fill="#faae40" d="M25.6 14.9h-.3l-.2.1-.5 1.6c-.3 1.1-.2 2.1.4 2.8.5.6 1.3 1 2.3 1.1l2.5.1a.3.3 0 0 1 .2.1.3.3 0 0 1 0 .3c0 .1-.1.2-.3.2l-2.6.1c-1.4.1-2.9 1.2-3.4 2.6l-.2.5c0 .1 0 .2.2.2h8.9c.1 0 .2-.1.2-.2a6.4 6.4 0 0 0-7.2-9.5z"/></svg>'
};
const STATUS = {
  connected: ['ok', 'Conectada'],
  expired: ['warn', 'Hay que reconectar'],
  available: ['', 'Sin conectar'],
  not_configured: ['muted', 'Conexión no configurada']
};

/** Aviso de la vuelta del proveedor: se muestra DENTRO del panel (un aviso flotante quedaría detrás del diálogo). */
let notice = null;
export function setConnectNotice(n) { notice = n; }

export async function renderConnections(el, ctx) {
  const data = await call('/api/connectors');
  if (notice) {
    const n = notice; notice = null;
    el.append(h('div', { class: 'alert ' + (n.ok ? 'ok' : 'warn') + ' acc-return', role: n.ok ? 'status' : 'alert' },
      h('span', { html: icon(n.ok ? 'check' : 'info') }), h('span', {}, n.text)));
  }
  el.append(h('div', { class: 'acc-section-h' },
    h('h3', {}, 'Cuentas conectadas'),
    h('p', { class: 'muted' }, 'Sumá tus apps con un toque y pedile al chat cosas como «revisá mis correos de hoy» o «listá mis repos». El asistente las usa solo cuando se lo pedís, y todo lo que crea, envía o publica te pide «Confirmar» antes.')));
  const mine = data.providers.filter((p) => p.status === 'connected' || p.status === 'expired');
  const rest = data.providers.filter((p) => !mine.includes(p));
  if (mine.length) {
    el.append(h('h4', { class: 'acc-gal-h' }, 'Tus conexiones'));
    el.append(h('div', { class: 'acc-conns' }, ...mine.map((p) => card(p, ctx, el))));
  }
  if (rest.length) {
    el.append(h('h4', { class: 'acc-gal-h' }, mine.length ? 'Más conectores' : 'Conectores disponibles'));
    el.append(h('div', { class: 'acc-conns' }, ...rest.map((p) => card(p, ctx, el))));
  }
  // Accesos guardados de la computadora del agente (inicios de sesión en sitios): se ven sitio y usuario enmascarado.
  try {
    const lg = await call('/api/agent/logins');
    const box = h('section', { class: 'acc-logins', 'aria-labelledby': 'accLoginsH' },
      h('h4', { class: 'acc-gal-h', id: 'accLoginsH' }, 'Accesos guardados en sitios'),
      h('p', { class: 'acc-small muted' }, 'Cuando el agente necesita entrar a un sitio con tu cuenta, te pide permiso en el chat antes de usar un acceso guardado. Se guardan cifrados y solo vos podés borrarlos.'));
    if (!lg.logins || !lg.logins.length) box.append(h('p', { class: 'acc-small' }, 'No tenés accesos guardados.'));
    else box.append(h('ul', { class: 'acc-login-list' }, ...lg.logins.map((x) => h('li', {},
      h('span', { class: 'acc-login-ic', html: icon('lock') }),
      h('span', { class: 'acc-login-t' }, h('strong', { 'data-no-i18n': '' }, x.host), h('small', { class: 'muted' }, `${x.label || ''}${x.lastUsedAt ? ' · usado ' + timeAgo(x.lastUsedAt) : ''}`)),
      h('button', { class: 'btn btn-sm btn-danger-ghost', type: 'button', onclick: async () => {
        if (!(await confirmDialog({ title: `Borrar el acceso a ${x.host}`, text: 'Se borra el usuario y la contraseña guardados para ese sitio. El agente te los va a pedir de nuevo si los necesita.', ok: 'Borrar', danger: true }))) return;
        try { await call('/api/agent/logins/delete', { method: 'POST', body: { host: x.host } }); toast(`Acceso a ${x.host} borrado.`); el.innerHTML = ''; renderConnections(el, ctx); }
        catch (e) { toast(errorText(e), 'warn'); }
      } }, 'Borrar')))));
    el.append(box);
  } catch { /* la computadora del agente puede no estar disponible */ }
  // Actividad reciente (bitácora): qué se hizo y cuándo, sin contenidos.
  try {
    const a = await call('/api/connectors/audit');
    if (a.events && a.events.length) {
      el.append(h('details', { class: 'acc-features' }, h('summary', {}, 'Actividad reciente'),
        h('ul', { class: 'acc-audit' }, ...a.events.slice(0, 12).map((x) => h('li', {}, h('span', { class: 'acc-chip ' + (x.outcome === 'ok' ? 'ok' : x.outcome === 'error' || x.outcome === 'denied' ? 'warn' : '') }, x.outcome), ` ${labelFor(x.provider)} · ${actionLabel(x.action)} · `, h('span', { class: 'muted' }, timeAgo(x.at)))))));
    }
  } catch { /* opcional */ }
}

const BLURB = {
  github: 'Tus repositorios y archivos: listar, leer y guardar cambios.',
  google: 'Tu correo: resumir lo nuevo, preparar borradores y enviar.',
  linkedin: 'Tu perfil: datos básicos y publicaciones con tu aprobación.',
  cloudflare: 'Tus Workers: ver su estado y publicar nuevas versiones.'
};
const labelFor = (p) => ({ github: 'GitHub', google: 'Gmail', linkedin: 'LinkedIn', cloudflare: 'Cloudflare', jobs: 'Empleo', tools: 'Herramientas' })[p] || p;
const actionLabel = (a) => ({ chat_enable: 'activó en el chat', chat_disable: 'desactivó en el chat', connect: 'conectó', connect_start: 'empezó a conectar', disconnect: 'desconectó', refresh: 'renovó el permiso', gmail_send: 'envío de correo', gmail_create_draft: 'borrador', github_create_issue: 'issue', github_commit_file: 'commit', linkedin_post: 'publicación', cloudflare_worker_health: 'estado de Worker', deploy_worker: 'publicó un Worker', open_apply_link: 'abrió una oferta' })[a] || a;

function card(p, ctx, root) {
  const [tone, label] = STATUS[p.status] || STATUS.available;
  const body = h('div', { class: 'acc-conn-body' });
  const acts = h('div', { class: 'acc-row' });
  if (p.status === 'connected' || p.status === 'expired') {
    const c = p.connection || {};
    body.append(h('div', { class: 'acc-who' },
      c.avatar ? h('img', { src: c.avatar, alt: '', width: 28, height: 28, referrerpolicy: 'no-referrer' }) : h('span', { class: 'acc-who-ava', html: icon('user') }),
      h('span', {}, h('small', { class: 'muted' }, 'Conectada como'), h('strong', {}, c.login || c.name || '—'))));
    if (p.status === 'connected') body.append(chatSwitch(p));
    if (p.status === 'expired' || p.kind === 'oauth2') acts.append(h('button', { class: 'btn btn-sm' + (p.status === 'expired' ? ' btn-primary' : ''), type: 'button', onclick: (e) => connect(p, e.currentTarget) }, p.status === 'expired' ? 'Reconectar' : 'Cambiar cuenta'));
    acts.append(h('button', { class: 'btn btn-sm btn-danger-ghost', type: 'button', onclick: async () => {
      if (!(await confirmDialog({ title: `Desconectar ${p.label}`, text: `Se borra el acceso guardado${p.kind === 'oauth2' ? ' y se revoca el permiso en ' + p.label : ''}. Podés volver a conectarla cuando quieras.`, ok: 'Desconectar', danger: true }))) return;
      try { await call(`/api/connectors/${p.id}/disconnect`, { method: 'POST', body: {} }); toast(`${p.label} desconectada.`); ctx.summary = null; root.innerHTML = ''; renderConnections(root, ctx); }
      catch (e) { toast(errorText(e), 'warn'); }
    } }, 'Desconectar'));
  } else if (p.status === 'not_configured') {
    body.append(h('p', { class: 'acc-note' }, h('span', { html: icon('info') }), 'Esta conexión todavía no está habilitada en AgentiCuántico. Va a aparecer acá apenas esté lista.'));
  } else if (p.id === 'cloudflare') {
    // Cloudflare no ofrece permiso por redirección: «Conectar» despliega el campo para pegar un token acotado.
    const btn = h('button', { class: 'btn btn-sm btn-primary', type: 'button', 'aria-expanded': 'false', onclick: () => { btn.remove(); const f = cloudflareForm(ctx, root); body.append(f); f.querySelector('input').focus(); } }, 'Conectar');
    acts.append(btn);
  } else {
    acts.append(h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: (e) => connect(p, e.currentTarget) }, 'Conectar'));
  }
  return h('article', { class: 'acc-conn ' + (p.status === 'not_configured' ? 'off' : ''), 'aria-label': `${p.label}: ${label}` },
    h('div', { class: 'acc-conn-top' },
      h('span', { class: `acc-conn-logo ${p.id}`, html: LOGOS[p.id] || icon('plug') }),
      h('div', { class: 'acc-conn-t' }, h('strong', {}, p.label), h('span', { class: `acc-chip ${tone}` }, label))),
    BLURB[p.id] ? h('p', { class: 'acc-blurb' }, BLURB[p.id]) : null,
    h('ul', { class: 'acc-perms' },
      ...p.reads.map((r) => h('li', {}, h('span', { class: 'acc-perm-ic', html: icon('eye') }), r)),
      ...p.writes.map((w) => h('li', {}, h('span', { class: 'acc-perm-ic w', html: icon('lock') }), `${w} `, h('em', {}, 'con confirmación')))),
    p.note ? h('p', { class: 'acc-small muted' }, p.note) : null,
    body, acts);
}

/** Interruptor «Usar en el chat»: apaga o prende la cuenta para el chat sin borrarla. */
function chatSwitch(p) {
  const id = 'chatsw-' + p.id;
  const input = h('input', { type: 'checkbox', id, role: 'switch' });
  input.checked = !(p.connection && p.connection.chatEnabled === false);
  const hint = h('small', { class: 'muted' }, input.checked ? 'El chat puede usarla cuando se lo pidas.' : 'Apagada: el chat no la usa.');
  input.addEventListener('change', async () => {
    const want = input.checked;
    input.disabled = true;
    try {
      await call(`/api/connectors/${p.id}/chat`, { method: 'POST', body: { enabled: want } });
      hint.textContent = want ? 'El chat puede usarla cuando se lo pidas.' : 'Apagada: el chat no la usa.';
      toast(want ? `${p.label} activada en el chat.` : `${p.label} desactivada en el chat.`, want ? 'ok' : '');
    } catch (e) { input.checked = !want; toast(errorText(e), 'warn'); }
    input.disabled = false;
  });
  return h('div', { class: 'acc-chatsw' },
    h('label', { for: id }, h('strong', {}, 'Usar en el chat'), hint),
    h('span', { class: 'switch' }, input, h('span')));
}

/** «Conectar»: un solo toque → pantalla de permiso del proveedor en esta misma pestaña. */
async function connect(p, btn) {
  if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = `Abriendo ${p.label}…`; }
  try {
    const r = await startConnect(p.id);
    if (r.mode === 'device' && r.userCode) { toast(`Abrí ${r.verificationUri} y escribí el código ${r.userCode}`, '', 15000); window.open(r.verificationUri, '_blank', 'noopener'); }
    if (r.mode !== 'redirect' && btn) { btn.disabled = false; btn.textContent = btn.dataset.label; }
  } catch (e) { toast(errorText(e), 'warn'); if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label; } }
}

function cloudflareForm(ctx, root) {
  const id = 'cfTok' + Math.random().toString(36).slice(2, 7);
  const input = h('input', { class: 'input', id, type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: 'Pegá tu API token', 'aria-describedby': id + 'h' });
  const err = h('p', { class: 'error-text', role: 'alert' });
  const btn = h('button', { class: 'btn btn-sm btn-primary', type: 'submit' }, 'Verificar y conectar');
  const f = h('form', { class: 'acc-cf' },
    h('details', { class: 'acc-help' }, h('summary', {}, 'Cómo crear el token (2 minutos)'),
      h('ol', {},
        h('li', {}, 'Entrá a ', h('a', { href: 'https://dash.cloudflare.com/profile/api-tokens', target: '_blank', rel: 'noopener noreferrer' }, 'dash.cloudflare.com → Mi perfil → API Tokens'), '.'),
        h('li', {}, 'Tocá «Create Token» y usá la plantilla «Edit Cloudflare Workers».'),
        h('li', {}, 'Para ver el estado de un Worker, sumá «Account Analytics: Read».'),
        h('li', {}, 'Copiá el token y pegalo acá. Se guarda cifrado y no se vuelve a mostrar.'))),
    h('div', { class: 'field' }, h('label', { for: id }, 'API token de Cloudflare'), input, h('small', { id: id + 'h', class: 'muted' }, 'Nunca pegues la Global API Key: usá un token con permisos acotados.')),
    err, btn);
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); err.textContent = '';
    const token = input.value.trim();
    if (!token) { err.textContent = 'Pegá el token.'; input.focus(); return; }
    btn.disabled = true; btn.textContent = 'Verificando…';
    try {
      const r = await call('/api/connectors/cloudflare', { method: 'POST', body: { token } });
      input.value = '';
      toast(`Cloudflare conectada${r.warnings && r.warnings.length ? ' (al token le falta el permiso de Workers)' : ''}.`, 'ok');
      ctx.summary = null; root.innerHTML = ''; renderConnections(root, ctx);
    } catch (e2) { err.textContent = errorText(e2); btn.disabled = false; btn.textContent = 'Verificar y conectar'; }
  });
  return f;
}

/** Vuelta del proveedor: #conectar=<proveedor>&p=<pendiente> o &error=<motivo>. */
export async function finishOAuthFromHash(ctx) {
  const q = new URLSearchParams(location.hash.slice(1));
  const prov = q.get('conectar');
  history.replaceState(null, '', location.pathname + location.search + '#cuenta/conexiones');
  if (!prov || !/^[a-z]{3,12}$/.test(prov)) return;
  const label = { github: 'GitHub', google: 'Gmail', linkedin: 'LinkedIn' }[prov] || prov;
  const err = q.get('error');
  if (err) {
    toast(({ denied: `Cancelaste la conexión con ${label}.`, not_configured: `La conexión con ${label} no está configurada.`, expired: 'El enlace venció. Probá de nuevo.' })[err] || `No se pudo conectar ${label}. Probá de nuevo.`, 'warn', 6000);
    return;
  }
  const p = q.get('p');
  if (!p || !/^[a-f0-9]{48}$/.test(p)) return;
  try { await call(`/api/connectors/${prov}/finalize`, { method: 'POST', body: { p } }); toast(`${label} conectada.`, 'ok'); ctx.summary = null; }
  catch (e) { toast(errorText(e), 'warn', 6000); }
}
