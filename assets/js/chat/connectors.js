/**
 * Conectores por usuario (Centro de control → Conectores): GitHub, Cloudflare, LinkedIn y Google (Gmail, Calendar, Drive).
 * «Conectar» lleva al inicio de sesión del proveedor en esta misma pestaña y vuelve ya conectado (OAuth).
 * Cloudflare usa inicio de sesión si el servidor tiene su cliente OAuth; el API token queda en «Opciones avanzadas».
 * Los tokens viven cifrados en el servidor; el navegador nunca los vuelve a ver.
 * Toda acción que crea, modifica o publica algo pide confirmación con una vista previa del servidor.
 */
import { h, icon, toast, modal, confirmDialog, uid } from '../ui.js';
import { state as engineState, ensureLive } from './engine.js';
import { CONFIG } from '../config.js';
import { getSiteLang } from '../i18n.js';
import { startConnect } from '../account/oauth-connect.js';

/* Frases con datos variables (las fijas las traduce el diccionario del sitio). */
const TPL = {
  repo: { 'es-AR': 'Se va a crear el repositorio {vis} {repo} en tu cuenta de GitHub.', 'es-ES': 'Se va a crear el repositorio {vis} {repo} en tu cuenta de GitHub.', 'en-US': 'A {vis} repository {repo} will be created in your GitHub account.', 'pt-BR': 'O repositório {vis} {repo} será criado na sua conta do GitHub.' },
  priv: { 'es-AR': 'privado', 'es-ES': 'privado', 'en-US': 'private', 'pt-BR': 'privado' },
  pub: { 'es-AR': 'público', 'es-ES': 'público', 'en-US': 'public', 'pt-BR': 'público' },
  over: { 'es-AR': 'Se va a reemplazar {files} en {repo} (rama {branch}).', 'es-ES': 'Se va a reemplazar {files} en {repo} (rama {branch}).', 'en-US': '{files} will be replaced in {repo} (branch {branch}).', 'pt-BR': '{files} será substituído em {repo} (branch {branch}).' },
  up: { 'es-AR': 'Se va a subir {files} a {repo} (rama {branch}).', 'es-ES': 'Se va a subir {files} a {repo} (rama {branch}).', 'en-US': '{files} will be uploaded to {repo} (branch {branch}).', 'pt-BR': '{files} será enviado para {repo} (branch {branch}).' },
  cfOver: { 'es-AR': 'Ya existe «{name}» en tu cuenta de Cloudflare y se va a reemplazar por esta versión.', 'es-ES': 'Ya existe «{name}» en tu cuenta de Cloudflare y se reemplazará por esta versión.', 'en-US': '“{name}” already exists in your Cloudflare account and will be replaced with this version.', 'pt-BR': '“{name}” já existe na sua conta da Cloudflare e será substituído por esta versão.' },
  cfNew: { 'es-AR': 'Se va a publicar «{name}» en tu cuenta de Cloudflare{url}.', 'es-ES': 'Se va a publicar «{name}» en tu cuenta de Cloudflare{url}.', 'en-US': '“{name}” will be published to your Cloudflare account{url}.', 'pt-BR': '“{name}” será publicado na sua conta da Cloudflare{url}.' },
  msg: { 'es-AR': 'Agregar {name}', 'es-ES': 'Añadir {name}', 'en-US': 'Add {name}', 'pt-BR': 'Adicionar {name}' }
};
function T(k, vars = {}) {
  let lang = 'es-AR';
  try { lang = getSiteLang(); } catch {}
  const s = (TPL[k] && (TPL[k][lang] || TPL[k]['es-AR'])) || k;
  return s.replace(/\{(\w+)\}/g, (_, n) => String(vars[n] ?? ''));
}

const CSS = '/assets/css/connectors.css?v=1.2.0';
function ensureCss() {
  if (document.querySelector('link[data-conn-css]')) return;
  document.head.append(h('link', { rel: 'stylesheet', href: CSS, 'data-conn-css': '' }));
}

const LOGO = {
  github: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="4" fill="#0a66c2"/><path fill="#fff" d="M7.1 9.4h-2.6V19h2.6zM5.8 5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM19.5 13.4c0-2.6-1.4-4.2-3.6-4.2-1.3 0-2.1.7-2.5 1.3V9.4h-2.5V19h2.6v-5.1c0-1.3.6-2.1 1.7-2.1 1 0 1.6.7 1.6 2.1V19h2.7z"/></svg>',
  cloudflare: '<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="#f38020" d="M21.9 22.6l.3-1c.3-1.1.2-2.1-.4-2.8-.5-.6-1.3-1-2.3-1.1l-11.6-.1a.3.3 0 0 1-.2-.1.3.3 0 0 1 0-.3c0-.1.1-.2.3-.2l11.7-.1c1.4-.1 2.9-1.2 3.4-2.6l.7-1.8.1-.4A7.6 7.6 0 0 0 9.3 11a3.4 3.4 0 0 0-5.4 3.6A4.9 4.9 0 0 0 0 19.4c0 .2 0 .5.1.7 0 .1.1.2.2.2h21.3c.1 0 .2-.1.3-.2z"/><path fill="#faae40" d="M25.7 14.8h-.3c-.1 0-.2.1-.2.2l-.5 1.6c-.3 1.1-.2 2.1.4 2.8.5.6 1.3 1 2.3 1.1l2.5.1c.1 0 .2.1.2.1v.3c0 .1-.1.2-.3.2l-2.6.1c-1.4.1-2.9 1.2-3.4 2.6l-.2.6c0 .1 0 .2.2.2h8.9c.1 0 .2-.1.2-.2a6.4 6.4 0 0 0-6.2-7.7z"/></svg>'
};

const ERR = {
  login_required: 'Ingresá a tu cuenta para continuar.',
  connectors_unavailable: 'Los conectores no están disponibles en este momento.',
  github_not_configured: 'La conexión con GitHub todavía no está habilitada.',
  github_device_flow_disabled: 'La conexión con GitHub todavía no está habilitada.',
  github_not_connected: 'Conectá tu cuenta de GitHub primero.',
  github_token_revoked: 'GitHub revocó el acceso. Volvé a conectar tu cuenta.',
  github_validation_failed: 'GitHub rechazó los datos (¿ya existe un repositorio con ese nombre?).',
  github_not_found: 'No encontramos ese repositorio o no tenés acceso.',
  github_forbidden: 'GitHub no permite esta acción con tus permisos.',
  github_no_push_permission: 'No tenés permiso de escritura en ese repositorio.',
  invalid_repo_name: 'Nombre de repositorio inválido. Usá letras, números, guiones o puntos.',
  invalid_path: 'Hay una ruta de archivo inválida.',
  cloudflare_token_format: 'Ese token no tiene el formato de un API token de Cloudflare.',
  cloudflare_token_invalid: 'Cloudflare no aceptó el token. Revisá que esté activo y copiado completo.',
  cloudflare_account_required: 'No pudimos ver ninguna cuenta con ese token. Agregá el permiso Account Settings: Read o indicá el Account ID.',
  cloudflare_account_format: 'El Account ID tiene 32 caracteres hexadecimales.',
  cloudflare_permission_missing: 'Al token le falta un permiso para esta acción (Workers Scripts: Edit).',
  cloudflare_not_connected: 'Conectá tu cuenta de Cloudflare primero.',
  invalid_worker_name: 'Nombre inválido: minúsculas, números y guiones (máx. 63).',
  invalid_worker_code: 'El código tiene que ser un módulo con «export default».',
  payload_too_large: 'Los archivos son demasiado grandes para publicarlos desde acá.',
  rate_limited: 'Demasiados intentos seguidos. Esperá un minuto.',
  expired: 'La autorización venció. Probá conectar de nuevo.',
  forbidden: 'Esta autorización pertenece a otra cuenta.',
  denied: 'Cancelaste la autorización en GitHub.',
  invalid_state: 'La autorización no se pudo verificar. Probá conectar de nuevo.',
  not_configured: 'La conexión con GitHub todavía no está habilitada.',
  failed: 'GitHub no completó la autorización. Probá de nuevo.',
  invalid_request: 'La autorización no se pudo verificar. Probá conectar de nuevo.',
  cloudflare_oauth_not_configured: 'El inicio de sesión con Cloudflare todavía no está habilitado. Podés conectar con un token en «Opciones avanzadas».',
  linkedin_not_configured: 'La conexión con LinkedIn todavía no está habilitada.',
  google_not_configured: 'La conexión con Gmail todavía no está habilitada.',
  gcalendar_not_configured: 'La conexión con Google Calendar todavía no está habilitada.',
  gdrive_not_configured: 'La conexión con Google Drive todavía no está habilitada.',
  invalid_return: 'No se pudo preparar la vuelta a AgentiCuántico. Recargá la página y probá de nuevo.',
  offline: 'El servidor no responde en este momento. Probá de nuevo en un rato.',
  session_expired: 'Tu sesión venció. Ingresá de nuevo para ver y conectar tus cuentas.',
  network: 'No hay conexión. Revisá internet y probá de nuevo.'
};
const errText = (code) => ERR[code] || 'No se pudo completar la acción. Probá de nuevo en unos minutos.';

/** Aviso de estado del panel: data-state = login | offline | network | error (para estilos y pruebas). */
function stateBox(kind, text, action) {
  return h('div', { class: 'alert ' + (kind === 'login' ? 'info' : 'warn') + ' conn-state-box', 'data-state': kind, role: kind === 'login' ? 'status' : 'alert' },
    h('span', { html: icon(kind === 'login' ? 'user' : 'info') }),
    h('div', { class: 'conn-state-body' }, h('p', {}, text), action ? h('div', { class: 'conn-actions' }, action) : null));
}
/* Conectores que se muestran sin cuenta (cada uno con «Ingresar para conectar»). */
const LOGGED_OUT = [
  ['github', 'GitHub', 'Repositorios: ver, crear y subir archivos.'],
  ['cloudflare', 'Cloudflare', 'Workers y sitios: ver y publicar.'],
  ['linkedin', 'LinkedIn', 'Tu perfil: datos básicos y publicaciones con tu aprobación.'],
  ['google', 'Gmail', 'Tu correo: resumir lo nuevo, preparar borradores y enviar.'],
  ['gdrive', 'Google Drive', 'Tus documentos: guardar informes en tu Drive y volver a leerlos.'],
  ['gcalendar', 'Google Calendar', 'Tu agenda: ver lo que viene y crear eventos con tu aprobación.']
];

class ApiError extends Error { constructor(status, code, body) { super(code); this.status = status; this.code = code; this.body = body; } }

/**
 * Llamada autenticada. Distingue: sin cuenta (login_required), servidor caído (offline), sin internet (network),
 * sesión vencida (session_expired: 401 aun después de renovar el token de la cuenta) y errores propios del conector.
 */
async function api(chat, path, { method = 'GET', body } = {}) {
  if (!chat.user) throw new ApiError(401, 'login_required');
  await ensureLive();
  const base = engineState.base || String(CONFIG.API_BASE || '').replace(/\/+$/, '');
  if (!base) throw new ApiError(0, 'offline');
  const send = async (force) => {
    let token;
    try { token = await chat.user.getIdToken(force); } catch { throw new ApiError(401, 'session_expired'); }
    try {
      return await fetch(base + path, { method, headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    } catch {
      throw new ApiError(0, typeof navigator !== 'undefined' && navigator.onLine === false ? 'network' : 'offline');
    }
  };
  let r = await send(false);
  // 401 con cuenta iniciada = token de la cuenta vencido: se renueva una vez antes de pedir que ingrese de nuevo.
  if (r.status === 401) r = await send(true);
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) throw new ApiError(401, 'session_expired', j);
  if (!r.ok) throw new ApiError(r.status, j.error || (r.status >= 500 ? 'offline' : 'error'), j);
  return j;
}

/** Pide la vista previa (409 confirmation_required), muestra la confirmación y repite con confirm=true. */
async function confirmed(chat, path, body, describe) {
  try { return await api(chat, path, { method: 'POST', body }); } catch (e) {
    if (!(e instanceof ApiError) || e.code !== 'confirmation_required') throw e;
    const d = describe(e.body.preview || {});
    if (!(await confirmDialog({ title: d.title, text: d.text, ok: d.ok, danger: !!d.danger }))) return null;
    return api(chat, path, { method: 'POST', body: { ...body, confirm: true } });
  }
}
/** Muestra el error dentro del formulario (los avisos flotantes quedan detrás de los diálogos) o como aviso. */
function fail(e, where) {
  const msg = errText(e && e.code);
  if (where) {
    let el = where.querySelector(':scope > .conn-err');
    if (!el) { el = h('p', { class: 'conn-err', role: 'alert' }); where.append(el); }
    el.textContent = msg;
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return;
  }
  toast(msg, 'error', 5200);
}
const clearErr = (where) => { const el = where && where.querySelector(':scope > .conn-err'); if (el) el.remove(); };

/* =================== Panel =================== */
/** Aviso de la vuelta del proveedor: se muestra DENTRO del panel (un aviso flotante quedaría detrás del diálogo). */
let hubNotice = null;
export function setHubNotice(n) { hubNotice = n; }

export async function renderConnectors(pane, chat, others) {
  ensureCss();
  if (hubNotice) {
    const n = hubNotice; hubNotice = null;
    pane.append(h('div', { class: 'alert ' + (n.ok ? 'ok' : 'warn') + ' conn-return', role: n.ok ? 'status' : 'alert' }, h('span', { html: icon(n.ok ? 'check' : 'info') }), h('div', {}, n.text)));
  }
  pane.append(h('p', { class: 'muted' }, 'Conectá tus cuentas para que el agente trabaje en tu nombre. Antes de crear, modificar o publicar algo, siempre te pide confirmación.'));
  const box = h('div', { class: 'conn-grid' });
  pane.append(box);
  const draw = async () => {
    box.innerHTML = '';
    // 1) Sin cuenta: no hace falta el servidor para mostrar los conectores; cada uno pide ingresar.
    if (!chat.user) {
      box.append(stateBox('login', 'Ingresá a tu cuenta para conectar GitHub, Cloudflare, LinkedIn, Gmail y Google Drive. Cada persona conecta sus propias cuentas.', h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => chat.loginPrompt('Ingresá a tu cuenta para conectar tus cuentas.') }, 'Ingresar')));
      for (const [id, title, desc] of LOGGED_OUT) {
        box.append(card(id, title, desc, h('div', { class: 'conn-actions' }, h('button', { class: 'btn btn-sm', type: 'button', onclick: () => chat.loginPrompt(`Ingresá a tu cuenta para conectar ${title}.`) }, 'Ingresar para conectar'))));
      }
      return;
    }
    box.append(h('div', { class: 'conn-card skeleton-card', 'aria-busy': 'true' }, h('div', { class: 'skeleton', style: 'height:18px;width:40%' }), h('div', { class: 'skeleton', style: 'height:14px;width:70%;margin-top:10px' })));
    let st;
    try { st = await api(chat, '/api/connectors'); } catch (e) {
      box.innerHTML = '';
      const code = e && e.code;
      // 2) Sesión vencida: botón para ingresar de nuevo (no es un problema del servidor).
      if (code === 'session_expired' || code === 'login_required') {
        box.append(stateBox('login', errText('session_expired'), h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => chat.loginPrompt('Tu sesión venció. Ingresá de nuevo para conectar tus cuentas.') }, 'Ingresar de nuevo')));
        return;
      }
      // 3) Sin internet o servidor caído de verdad (ya se reintentó): explicar y ofrecer reintentar.
      const retry = h('button', { class: 'btn btn-sm', type: 'button', onclick: () => draw() }, 'Reintentar');
      box.append(stateBox(code === 'network' ? 'network' : code === 'offline' ? 'offline' : 'error', errText(code), retry));
      return;
    }
    box.innerHTML = '';
    box.append(githubCard(chat, st, draw), cloudflareCard(chat, st, draw));
    for (const id of OAUTH_CARDS) { const p = (st.providers || []).find((x) => x.id === id); if (p) box.append(oauthCard(chat, p, draw)); }
  };
  await draw();
  if (others) others(pane);
}

function card(id, title, desc, ...rest) {
  const on = rest.some((x) => x && x.classList && x.classList.contains('conn-who'));
  return h('section', { class: 'conn-card' + (on ? ' is-on' : ''), 'data-conn': id },
    h('div', { class: 'conn-head' },
      h('span', { class: 'conn-logo conn-' + id, html: LOGO[id] }),
      h('div', { class: 'conn-title' }, h('div', { class: 'conn-title-row' }, h('strong', {}, title), on ? h('span', { class: 'chip ok conn-state' }, 'Conectado') : null), h('p', { class: 'muted small' }, desc))),
    ...rest);
}
function who(conn, label) {
  return h('div', { class: 'conn-who' },
    conn.avatar ? h('img', { src: conn.avatar, alt: '', width: 32, height: 32, loading: 'lazy', referrerpolicy: 'no-referrer', onerror: (e) => e.target.replaceWith(h('span', { class: 'conn-ava', html: icon('user') })) }) : h('span', { class: 'conn-ava', html: icon('user') }),
    h('div', {}, h('small', { class: 'muted' }, label), h('strong', { 'data-no-i18n': '', title: conn.login || '' }, conn.login ? (conn.provider === 'github' ? '@' + conn.login : conn.login) : '')));
}

/* ---------- GitHub ---------- */
function githubCard(chat, st, redraw) {
  const c = st.github;
  const avail = st.available && st.available.github;
  if (c) {
    return card('github', 'GitHub', 'Repositorios: ver, crear y subir archivos.', who(c, 'Conectado como'),
      h('div', { class: 'conn-actions' },
        h('button', { class: 'btn btn-sm', type: 'button', onclick: () => reposDialog(chat) }, 'Ver repositorios'),
        h('button', { class: 'btn btn-sm', type: 'button', onclick: () => createRepoDialog(chat) }, 'Crear repositorio'),
        h('button', { class: 'btn btn-sm btn-danger-ghost', type: 'button', onclick: async () => {
          if (!(await confirmDialog({ title: 'Desconectar GitHub', text: 'Se borra el acceso guardado y el agente deja de poder usar tu cuenta de GitHub.', ok: 'Desconectar', danger: true }))) return;
          try { await api(chat, '/api/connectors/github/disconnect', { method: 'POST', body: {} }); toast('GitHub desconectado'); redraw(); } catch (e) { fail(e); }
        } }, 'Desconectar')));
  }
  if (!avail) {
    return card('github', 'GitHub', 'Repositorios: ver, crear y subir archivos.', h('p', { class: 'muted small conn-note' }, h('span', { class: 'conn-inline-ic', html: icon('info') }), 'La conexión con GitHub todavía no está habilitada en AgentiCuántico.'));
  }
  const btn = h('button', { class: 'btn btn-primary btn-sm', type: 'button' }, h('span', { class: 'conn-btn-ic', html: LOGO.github }), 'Conectar con GitHub');
  let cardEl;
  btn.addEventListener('click', async () => {
    btn.disabled = true; btn.setAttribute('aria-busy', 'true'); clearErr(cardEl);
    try {
      // Misma vuelta que los demás conectores: /app/ y de nuevo al Centro de control con el aviso.
      const r = await startConnect('github', { from: 'hub' });
      if (r && r.mode === 'redirect') return;
      if (r && r.mode === 'web' && r.url) { location.assign(r.url); return; }
      if (r && r.userCode) deviceDialog(chat, r, redraw);
    } catch (e) { fail(e, cardEl); }
    btn.disabled = false; btn.removeAttribute('aria-busy');
  });
  cardEl = card('github', 'GitHub', 'Repositorios: ver, crear y subir archivos.',
    h('ul', { class: 'conn-points' }, h('li', {}, 'Iniciás sesión en GitHub, autorizás el acceso y volvés acá ya conectado.'), h('li', {}, 'Podés desconectarlo cuando quieras.')),
    h('div', { class: 'conn-actions' }, btn));
  return cardEl;
}

function deviceDialog(chat, r, redraw) {
  let stop = false;
  const status = h('p', { class: 'muted small', 'aria-live': 'polite' }, 'Esperando la autorización…');
  const code = h('div', { class: 'conn-code', 'data-no-i18n': '' }, r.userCode);
  const body = h('div', { class: 'conn-device' },
    h('p', {}, 'Abrí GitHub, ingresá este código y autorizá el acceso:'), code,
    h('div', { class: 'conn-actions' },
      h('a', { class: 'btn btn-primary btn-sm', href: r.verificationUri, target: '_blank', rel: 'noopener' }, 'Abrir GitHub'),
      h('button', { class: 'btn btn-sm', type: 'button', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(r.userCode).then(() => toast('Código copiado')); } }, 'Copiar código')),
    status);
  const m = modal({ title: 'Conectar con GitHub', body });
  m.done.then(() => { stop = true; });
  let wait = (r.interval || 5) * 1000;
  const tick = async () => {
    if (stop) return;
    try {
      const p = await api(chat, '/api/connectors/github/device/poll', { method: 'POST', body: { id: r.id } });
      if (p.status === 'connected') { stop = true; m.close(true); toast('GitHub conectado'); redraw(); return; }
      if (p.status === 'slow_down') wait = (p.interval || 10) * 1000;
      if (p.status === 'expired' || p.status === 'denied') { status.textContent = p.status === 'denied' ? 'Cancelaste la autorización en GitHub.' : 'El código venció. Cerrá y probá de nuevo.'; return; }
    } catch (e) { status.textContent = errText(e.code); return; }
    setTimeout(tick, wait);
  };
  setTimeout(tick, wait);
}

async function reposDialog(chat) {
  const list = h('div', { class: 'conn-list' }, h('div', { class: 'skeleton', style: 'height:44px' }), h('div', { class: 'skeleton', style: 'height:44px' }));
  modal({ title: 'Tus repositorios', body: list, wide: true });
  try {
    const { repos } = await api(chat, '/api/connectors/github/repos');
    list.innerHTML = '';
    if (!repos.length) list.append(h('p', { class: 'muted' }, 'Todavía no tenés repositorios.'));
    for (const r of repos) list.append(h('a', { class: 'conn-row', href: r.url, target: '_blank', rel: 'noopener' },
      h('span', { class: 'conn-row-main' }, h('strong', { 'data-no-i18n': '' }, r.fullName), r.description ? h('small', { class: 'muted', 'data-no-i18n': '' }, r.description) : null),
      h('span', { class: 'chip' + (r.private ? '' : ' info') }, r.private ? 'Privado' : 'Público')));
  } catch (e) { list.innerHTML = ''; list.append(h('p', { class: 'muted' }, errText(e.code))); }
}

function createRepoDialog(chat) {
  const form = h('form', { class: 'conn-form' },
    field('Nombre del repositorio', h('input', { class: 'input', name: 'name', required: true, maxlength: 100, pattern: '[A-Za-z0-9._-]+', placeholder: 'mi-proyecto', autocomplete: 'off' })),
    field('Descripción (opcional)', h('input', { class: 'input', name: 'description', maxlength: 300 })),
    h('label', { class: 'conn-check' }, h('input', { type: 'checkbox', name: 'private', checked: true }), h('span', {}, 'Privado (solo vos lo ves)')),
    h('div', { class: 'conn-actions end' }, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Continuar')));
  const m = modal({ title: 'Crear repositorio', body: form });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    try {
      const r = await confirmed(chat, '/api/connectors/github/repos', { name: String(f.get('name')).trim(), description: String(f.get('description') || ''), private: f.get('private') === 'on' },
        (p) => ({ title: 'Confirmar creación', text: T('repo', { vis: T(p.private ? 'priv' : 'pub'), repo: p.repo }), ok: 'Crear repositorio' }));
      if (!r) return;
      m.close(true);
      toast('Repositorio creado');
      window.open(r.repo.url, '_blank', 'noopener');
    } catch (err) { fail(err, form); }
  });
}

/* ---------- Cloudflare ---------- */
function cloudflareCard(chat, st, redraw) {
  const c = st.cloudflare;
  if (c) {
    const warn = c.meta && c.meta.workers === false ? h('div', { class: 'alert warn' }, h('span', { html: icon('info') }), h('div', {}, 'Al token le falta el permiso Workers Scripts: Edit, así que todavía no se puede publicar.')) : null;
    return card('cloudflare', 'Cloudflare', 'Workers y sitios: ver y publicar.', who(c, 'Cuenta'), warn,
      h('div', { class: 'conn-actions' },
        h('button', { class: 'btn btn-sm', type: 'button', onclick: () => workersDialog(chat) }, 'Ver Workers'),
        h('button', { class: 'btn btn-sm btn-danger-ghost', type: 'button', onclick: async () => {
          if (!(await confirmDialog({ title: 'Desconectar Cloudflare', text: 'Se borra el token guardado. Para anularlo del todo, eliminalo también en Cloudflare → API Tokens.', ok: 'Desconectar', danger: true }))) return;
          try { await api(chat, '/api/connectors/cloudflare/disconnect', { method: 'POST', body: {} }); toast('Cloudflare desconectado'); redraw(); } catch (e) { fail(e); }
        } }, 'Desconectar')));
  }
  const tokenId = uid('cft'), accId = uid('cfa');
  const cfp = (st.providers || []).find((x) => x.id === 'cloudflare') || {};
  const oauthReady = !!((st.available && st.available.cloudflareOAuth) || cfp.oauth);
  const form = h('form', { class: 'conn-form', autocomplete: 'off' },
    h('ol', { class: 'conn-steps' },
      h('li', {}, 'Abrí ', h('a', { href: 'https://dash.cloudflare.com/profile/api-tokens', target: '_blank', rel: 'noopener' }, 'dash.cloudflare.com/profile/api-tokens'), ' y tocá «Create Token» → «Create Custom Token».'),
      h('li', {}, 'Agregá estos permisos:',
        h('ul', { class: 'conn-perms', 'data-no-i18n': '' },
          h('li', {}, h('code', {}, 'Account · Workers Scripts · Edit')),
          h('li', {}, h('code', {}, 'Account · Account Settings · Read')),
          h('li', {}, h('code', {}, 'Account · Cloudflare Pages · Edit ', h('em', {}, '(opt.)'))),
          h('li', {}, h('code', {}, 'User · User Details · Read ', h('em', {}, '(opt.)'))))),
      h('li', {}, 'En «Account Resources» elegí tu cuenta, creá el token y copialo.')),
    h('div', { class: 'field' }, h('label', { for: tokenId }, 'API token'), h('input', { class: 'input', id: tokenId, name: 'token', type: 'password', required: true, minlength: 30, maxlength: 200, autocomplete: 'off', spellcheck: 'false', placeholder: 'Pegá tu API token' })),
    h('div', { class: 'field' }, h('label', { for: accId }, 'Account ID (opcional)'), h('input', { class: 'input', id: accId, name: 'accountId', maxlength: 32, pattern: '[a-fA-F0-9]{32}', autocomplete: 'off', spellcheck: 'false' })),
    h('p', { class: 'muted small' }, 'Se guarda cifrado y nunca se muestra de nuevo. Podés revocarlo cuando quieras desde Cloudflare o desconectarlo acá.'),
    h('div', { class: 'conn-actions' }, h('button', { class: 'btn btn-sm', type: 'submit' }, 'Verificar y conectar')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const b = form.querySelector('button[type=submit]');
    const f = new FormData(form);
    clearErr(form);
    b.disabled = true;
    try {
      const r = await api(chat, '/api/connectors/cloudflare', { method: 'POST', body: { token: String(f.get('token')).trim(), accountId: String(f.get('accountId') || '').trim() } });
      form.reset();
      toast(r.warnings && r.warnings.length ? 'Conectado, pero falta el permiso para publicar Workers' : 'Cloudflare conectado', r.warnings && r.warnings.length ? 'warn' : '');
      redraw();
    } catch (err) { fail(err, form); } finally { b.disabled = false; }
  });
  // Respaldo: el token queda plegado en «Opciones avanzadas»; el camino principal es iniciar sesión en Cloudflare.
  const adv = h('details', { class: 'conn-adv conn-collapse' }, h('summary', {}, 'Opciones avanzadas: conectar con un API token'), form);
  const note = h('p', { class: 'muted small conn-note', role: 'status', hidden: true }, 'El inicio de sesión directo con Cloudflare todavía no está habilitado. Mientras tanto podés conectar con un API token acá abajo.');
  const btn = h('button', { class: 'btn btn-primary btn-sm', type: 'button' }, h('span', { class: 'conn-btn-ic', html: LOGO.cloudflare }), 'Conectar con Cloudflare');
  btn.addEventListener('click', async () => {
    if (!oauthReady) { note.hidden = false; adv.open = true; form.token.focus(); return; }
    await goConnect(btn, 'cloudflare', 'Cloudflare', wrapCard);
  });
  const wrapCard = card('cloudflare', 'Cloudflare', 'Workers y sitios: ver y publicar.',
    h('ul', { class: 'conn-points' }, h('li', {}, 'Tocás «Conectar», iniciás sesión en Cloudflare, aprobás el acceso y volvés acá ya conectado.'), h('li', {}, 'Podés desconectarlo cuando quieras.')),
    h('div', { class: 'conn-actions' }, btn), note, adv);
  return wrapCard;
}

/* ---------- LinkedIn y Google (OAuth por redirección) ---------- */
const OAUTH_CARDS = ['linkedin', 'google', 'gcalendar', 'gdrive'];
const OAUTH_BLURB = {
  linkedin: 'Tu perfil: datos básicos y publicaciones con tu aprobación.',
  google: 'Tu correo: resumir lo nuevo, preparar borradores y enviar.',
  gcalendar: 'Tu agenda: ver lo que viene y crear eventos con tu aprobación.',
  gdrive: 'Tus documentos: guardar informes en tu Drive y volver a leerlos.'
};
const GOOGLE_LOGO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>';
for (const id of ['google', 'gcalendar', 'gdrive']) LOGO[id] = GOOGLE_LOGO;

/** «Conectar»: un toque → pantalla de permiso del proveedor en esta pestaña → vuelve al Centro de control conectado. */
async function goConnect(btn, provider, label, where) {
  const prev = btn.innerHTML;
  btn.disabled = true; btn.setAttribute('aria-busy', 'true');
  btn.textContent = `Abriendo ${label}…`;
  clearErr(where);
  try {
    const r = await startConnect(provider, { from: 'hub' });
    if (r && r.mode === 'redirect') return;
    if (r && r.mode === 'device' && r.userCode) { toast(`Abrí ${r.verificationUri} y escribí el código ${r.userCode}`, '', 15000); window.open(r.verificationUri, '_blank', 'noopener'); }
  } catch (e) { fail(e, where); }
  btn.disabled = false; btn.removeAttribute('aria-busy'); btn.innerHTML = prev;
}

function oauthCard(chat, p, redraw) {
  const desc = OAUTH_BLURB[p.id] || '';
  if (p.status === 'connected' || p.status === 'expired') {
    const conn = p.connection || {};
    const acts = h('div', { class: 'conn-actions' });
    let c;
    if (p.status === 'expired') { const rb = h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => goConnect(rb, p.id, p.label, c) }, 'Reconectar'); acts.append(rb); }
    acts.append(h('button', { class: 'btn btn-sm btn-danger-ghost', type: 'button', onclick: async () => {
      if (!(await confirmDialog({ title: `Desconectar ${p.label}`, text: `Se borra el acceso guardado y se revoca el permiso en ${p.label}. Podés volver a conectarla cuando quieras.`, ok: 'Desconectar', danger: true }))) return;
      try { await api(chat, `/api/connectors/${p.id}/disconnect`, { method: 'POST', body: {} }); toast(`${p.label} desconectada`); redraw(); } catch (e) { fail(e, c); }
    } }, 'Desconectar'));
    c = card(p.id, p.label, desc, who({ ...conn, login: conn.login || conn.name || '' }, p.status === 'expired' ? 'El permiso venció' : 'Conectado como'), acts);
    return c;
  }
  if (p.status === 'not_configured') {
    return card(p.id, p.label, desc, h('p', { class: 'muted small conn-note' }, h('span', { class: 'conn-inline-ic', html: icon('info') }), `La conexión con ${p.label} todavía no está habilitada en AgentiCuántico.`));
  }
  const btn = h('button', { class: 'btn btn-primary btn-sm', type: 'button' }, h('span', { class: 'conn-btn-ic', html: LOGO[p.id] || '' }), `Conectar con ${p.label}`);
  let c;
  btn.addEventListener('click', () => goConnect(btn, p.id, p.label, c));
  c = card(p.id, p.label, desc,
    h('ul', { class: 'conn-points' }, h('li', {}, `Iniciás sesión en ${p.label}, aprobás el acceso y volvés acá ya conectado.`), h('li', {}, 'Todo lo que publica o envía te pide «Confirmar» antes.')),
    h('div', { class: 'conn-actions' }, btn));
  return c;
}

async function workersDialog(chat) {
  const list = h('div', { class: 'conn-list' }, h('div', { class: 'skeleton', style: 'height:44px' }));
  modal({ title: 'Tus Workers', body: list, wide: true });
  try {
    const r = await api(chat, '/api/connectors/cloudflare/workers');
    list.innerHTML = '';
    if (!r.workers.length && !(r.pages || []).length) list.append(h('p', { class: 'muted' }, 'Todavía no tenés Workers ni sitios.'));
    for (const w of r.workers) list.append(row(w.name, w.url, 'Worker'));
    for (const p of r.pages || []) list.append(row(p.name, p.url, 'Pages'));
  } catch (e) { list.innerHTML = ''; list.append(h('p', { class: 'muted' }, errText(e.code))); }
  function row(name, url, kind) {
    return h(url ? 'a' : 'div', { class: 'conn-row', ...(url ? { href: url, target: '_blank', rel: 'noopener' } : {}) },
      h('span', { class: 'conn-row-main' }, h('strong', { 'data-no-i18n': '' }, name), url ? h('small', { class: 'muted', 'data-no-i18n': '' }, url.replace(/^https:\/\//, '')) : null),
      h('span', { class: 'chip' }, kind));
  }
}

/* =================== Publicar un entregable del agente =================== */
export async function publishArtifact(chat, art) {
  ensureCss();
  if (!chat.user) return chat.loginPrompt('Ingresá a tu cuenta para publicar en GitHub o Cloudflare.');
  let st;
  try { st = await api(chat, '/api/connectors'); } catch (e) { return fail(e); }
  if (!st.github && !st.cloudflare) {
    const go = await confirmDialog({ title: 'Publicar', text: 'Conectá GitHub o Cloudflare en el Centro de control para publicar este archivo.', ok: 'Ir a Conectores' });
    if (go) chat.openHub('conectores');
    return;
  }
  const name = String(art.name || 'index.html');
  const content = String(art.content || '');
  const isHtml = /\.html?$/i.test(name) || /html/.test(art.mime || '');
  const body = h('div', { class: 'conn-publish' });
  const m = modal({ title: 'Publicar', body });
  body.append(h('p', { class: 'muted' }, 'Elegí dónde publicar ', h('strong', { 'data-no-i18n': '' }, name), '. Antes de hacer cambios te mostramos qué se va a crear o reemplazar.'));
  if (st.github) {
    const sel = h('select', { class: 'select', name: 'repo', required: true }, h('option', { value: '' }, 'Cargando…'));
    const fGh = h('form', { class: 'conn-form card-lite' },
      h('h3', {}, h('span', { class: 'conn-btn-ic', html: LOGO.github }), 'Subir a GitHub'),
      field('Repositorio', sel),
      field('Ruta del archivo', h('input', { class: 'input', name: 'path', value: name, required: true, maxlength: 300 })),
      field('Mensaje del commit', h('input', { class: 'input', name: 'message', value: T('msg', { name }), maxlength: 300 })),
      h('div', { class: 'conn-actions' }, h('button', { class: 'btn btn-primary btn-sm', type: 'submit' }, 'Continuar')));
    api(chat, '/api/connectors/github/repos').then(({ repos }) => {
      sel.innerHTML = '';
      sel.append(h('option', { value: '' }, 'Elegí un repositorio'));
      for (const r of repos.filter((x) => x.canPush)) sel.append(h('option', { value: r.fullName }, r.fullName));
    }).catch((e) => { sel.innerHTML = ''; sel.append(h('option', { value: '' }, errText(e.code))); });
    fGh.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(fGh);
      try {
        const r = await confirmed(chat, '/api/connectors/github/commit', { repo: f.get('repo'), message: f.get('message'), files: [{ path: String(f.get('path')).trim(), content }] },
          (p) => ({ title: p.overwrites && p.overwrites.length ? 'Reemplazar archivo' : 'Confirmar commit', text: p.overwrites && p.overwrites.length ? T('over', { files: p.overwrites.join(', '), repo: p.repo, branch: p.branch }) : T('up', { files: p.files.map((x) => x.path).join(', '), repo: p.repo, branch: p.branch }), ok: p.overwrites && p.overwrites.length ? 'Reemplazar' : 'Subir', danger: !!(p.overwrites && p.overwrites.length) }));
        if (!r) return;
        m.close(true);
        toast('Archivo subido a GitHub');
        if (r.commit && r.commit.url) window.open(r.commit.url, '_blank', 'noopener');
      } catch (err) { fail(err, fGh); }
    });
    body.append(fGh);
  }
  if (st.cloudflare) {
    const base = name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'sitio';
    const canWorker = isHtml || /export\s+default/.test(content);
    const fCf = h('form', { class: 'conn-form card-lite' },
      h('h3', {}, h('span', { class: 'conn-btn-ic', html: LOGO.cloudflare }), 'Publicar en Cloudflare'),
      field('Nombre del Worker', h('input', { class: 'input', name: 'name', value: base === 'index' ? 'mi-sitio' : base, required: true, maxlength: 63, pattern: '[a-z0-9-]+' })),
      h('p', { class: 'muted small' }, isHtml ? 'Se publica como sitio en tu subdominio workers.dev.' : 'Se publica el código como Worker.'),
      h('div', { class: 'conn-actions' }, h('button', { class: 'btn btn-primary btn-sm', type: 'submit', disabled: canWorker ? null : true }, 'Continuar')));
    if (!canWorker) fCf.append(h('p', { class: 'muted small' }, 'Este archivo no es una página HTML ni un Worker (módulo con «export default»).'));
    fCf.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(fCf);
      const payload = isHtml ? { name: f.get('name'), kind: 'static', files: [{ path: 'index.html', content }] } : { name: f.get('name'), kind: 'worker', code: content };
      try {
        const r = await confirmed(chat, '/api/connectors/cloudflare/deploy', payload,
          (p) => ({ title: p.exists ? 'Reemplazar Worker' : 'Confirmar publicación', text: p.exists ? T('cfOver', { name: p.name }) : T('cfNew', { name: p.name, url: p.url ? ' (' + p.url.replace(/^https:\/\//, '') + ')' : '' }), ok: p.exists ? 'Reemplazar' : 'Publicar', danger: !!p.exists }));
        if (!r) return;
        m.close(true);
        toast('Publicado en Cloudflare');
        if (r.url) window.open(r.url, '_blank', 'noopener');
      } catch (err) { fail(err, fCf); }
    });
    body.append(fCf);
  }
}

/* =================== Vuelta del inicio de sesión de GitHub =================== */
export async function handleReturn(chat) {
  const hash = location.hash || '';
  if (!/conectar=github/.test(hash)) return;
  const q = new URLSearchParams(hash.slice(1));
  history.replaceState(null, '', location.pathname + location.search);
  const err = q.get('error');
  if (err) { toast(errText(err), 'error', 6000); chat.openHub('conectores'); return; }
  const p = q.get('p');
  if (!p || !/^[a-f0-9]{48}$/.test(p)) return;
  try { const r = await api(chat, '/api/connectors/github/finalize', { method: 'POST', body: { p } }); if (r.connection) toast('GitHub conectado'); }
  catch (e) { fail(e); }
  chat.openHub('conectores');
}

function field(label, control) {
  const id = uid('f');
  control.id = id;
  return h('div', { class: 'field' }, h('label', { for: id }, label), control);
}
