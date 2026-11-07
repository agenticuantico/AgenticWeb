/**
 * Pestaña «Cuentas conectadas»: galería de conectores (GitHub, Gmail, Google Calendar, Google Drive, Google Cloud, LinkedIn y Cloudflare).
 * Fase 5: nivel de permiso por cuenta («Solo leer» / «Actuar pidiendo confirmación»), «Qué no permite» con fuente
 * oficial, sesiones guardadas de la computadora virtual y registro de actividad.
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
import { SERVICES, CATEGORIES, searchServices, groupServices, serviceStatus, loginUrl } from './catalog.js';

export const LOGOS = {
  github: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z"/></svg>',
  google: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#ea4335" d="M3 6.5 12 13l9-6.5V18a1.5 1.5 0 0 1-1.5 1.5H18V9.8l-6 4.3-6-4.3v9.7H4.5A1.5 1.5 0 0 1 3 18z"/><path fill="#c5221f" d="M21 6.5 12 13 3 6.5V6a1.5 1.5 0 0 1 2.4-1.2L12 9.6l6.6-4.8A1.5 1.5 0 0 1 21 6z"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="4" fill="#0a66c2"/><path fill="#fff" d="M7.1 9.4h-2.6V19h2.6zM5.8 5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM19.5 13.4c0-2.6-1.4-4.2-3.6-4.2-1.3 0-2.1.7-2.5 1.3V9.4h-2.5V19h2.6v-5.1c0-1.3.6-2.1 1.7-2.1 1 0 1.6.7 1.6 2.1V19h2.7z"/></svg>',
  // Íconos propios (dibujo genérico de calendario y carpeta), no los logos de Google.
  gcalendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16" rx="3" fill="#1a73e8"/><rect x="3" y="4.5" width="18" height="5" rx="2" fill="#174ea6"/><rect x="7" y="2.5" width="2" height="4" rx="1" fill="#174ea6"/><rect x="15" y="2.5" width="2" height="4" rx="1" fill="#174ea6"/><path fill="#fff" d="M7 12h3v3H7zm3.5 0h3v3h-3zm3.5 0h3v3h-3zM7 15.8h3v3H7zm3.5 0h3v3h-3z"/></svg>',
  gdrive: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#188038" d="M2.5 7.5A2.5 2.5 0 0 1 5 5h4.2l2 2.2H19a2.5 2.5 0 0 1 2.5 2.5v8.3A2.5 2.5 0 0 1 19 20.5H5A2.5 2.5 0 0 1 2.5 18z"/><path fill="#fff" d="M8 12.2h8v1.6H8zm0 3h5.5v1.6H8z"/></svg>',
  cloudflare: '<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="#f38020" d="M21.9 22.6l.3-1c.3-1.1.2-2.1-.4-2.8-.5-.6-1.3-1-2.3-1.1l-11.6-.1a.3.3 0 0 1-.2-.1.3.3 0 0 1 0-.3c0-.1.1-.2.3-.2l11.7-.1c1.4-.1 2.9-1.2 3.4-2.6l.7-1.8.1-.4A7.6 7.6 0 0 0 9.3 11a3.4 3.4 0 0 0-5.4 3.6A4.8 4.8 0 0 0-.5 19.6c0 .2 0 .5.1.7 0 .1.1.2.2.2h21.5c.1 0 .2-.1.3-.2z"/><path fill="#faae40" d="M25.6 14.9h-.3l-.2.1-.5 1.6c-.3 1.1-.2 2.1.4 2.8.5.6 1.3 1 2.3 1.1l2.5.1a.3.3 0 0 1 .2.1.3.3 0 0 1 0 .3c0 .1-.1.2-.3.2l-2.6.1c-1.4.1-2.9 1.2-3.4 2.6l-.2.5c0 .1 0 .2.2.2h8.9c.1 0 .2-.1.2-.2a6.4 6.4 0 0 0-7.2-9.5z"/></svg>'
};
const STATUS = {
  connected: ['ok', 'Conectada'],
  expired: ['warn', 'Hay que reconectar'],
  available: ['', 'Sin conectar'],
  not_configured: ['muted', 'Conexión no configurada']
};
// Fase 5: ícono propio y genérico para Google Cloud (una nube), no el logo de Google.
LOGOS.gcloud = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#1a73e8" d="M7 19a5 5 0 0 1-.6-9.96A6.5 6.5 0 0 1 19 10.5a4.25 4.25 0 0 1-.5 8.47V19z"/><path fill="#fff" d="M9 14.2h6v1.6H9zm1.5-3h3v1.6h-3z"/></svg>';

const LEVEL_TEXT = {
  read: ['Solo leer', 'La IA puede mirar, nunca cambiar nada.'],
  confirm: ['Actuar pidiendo confirmación', 'Puede crear, enviar o publicar, siempre después de que toques «Aprobar».']
};
const fmtDate = (t) => { try { return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(t)); } catch { return ''; } };

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
    h('p', { class: 'muted' }, 'Conectá tus cuentas y elegí qué puede hacer la IA en cada una. La IA las usa solo cuando se lo pedís en el chat, y todo lo que crea, envía, publica o cambia te muestra una vista previa con «Aprobar» o «Rechazar».')));
  if (data.encryption === false) el.append(h('p', { class: 'acc-note' }, h('span', { html: icon('info') }), 'Las conexiones no están disponibles en este momento.'));
  const rerender = () => { ctx.summary = null; el.innerHTML = ''; return renderConnections(el, ctx); };
  // Fase 5 · Catálogo con buscador: conexiones oficiales (OAuth/token) + sitios con sesión en la computadora virtual.
  let sessions = [];
  try { sessions = (await call('/api/agent/sessions')).sessions || []; } catch { /* sin sesiones guardadas disponibles */ }
  el.append(catalogSection(data.providers, sessions, ctx, rerender));
  await sessionsSection(el, rerender);
  // Accesos guardados de la computadora del agente (usuario y contraseña que la persona guardó a propósito).
  try {
    const lg = await call('/api/agent/logins');
    if (lg.logins && lg.logins.length) {
      const box = h('section', { class: 'acc-logins', 'aria-labelledby': 'accLoginsH' },
        h('h4', { class: 'acc-gal-h', id: 'accLoginsH' }, 'Accesos guardados en sitios'),
        h('p', { class: 'acc-small muted' }, 'Cuando el agente necesita entrar a un sitio con tu cuenta, te pide permiso en el chat antes de usar un acceso guardado. Se guardan cifrados y solo vos podés borrarlos.'),
        h('ul', { class: 'acc-login-list' }, ...lg.logins.map((x) => h('li', {},
          h('span', { class: 'acc-login-ic', html: icon('lock') }),
          h('span', { class: 'acc-login-t' }, h('strong', { 'data-no-i18n': '', title: x.host }, x.host), h('small', { class: 'muted' }, `${x.label || ''}${x.lastUsedAt ? ' · usado ' + timeAgo(x.lastUsedAt) : ''}`)),
          h('button', { class: 'btn btn-sm btn-danger-ghost', type: 'button', 'aria-label': `Borrar el acceso a ${x.host}`, onclick: async () => {
            if (!(await confirmDialog({ title: `Borrar el acceso a ${x.host}`, text: 'Se borra el usuario y la contraseña guardados para ese sitio. El agente te los va a pedir de nuevo si los necesita.', ok: 'Borrar', danger: true }))) return;
            try { await call('/api/agent/logins/delete', { method: 'POST', body: { host: x.host } }); toast(`Acceso a ${x.host} borrado.`); rerender(); }
            catch (e) { toast(errorText(e), 'warn'); }
          } }, 'Borrar')))));
      el.append(box);
    }
  } catch { /* la computadora del agente puede no estar disponible */ }
  await activitySection(el);
}

/* ---------- Catálogo de servicios con buscador (Fase 5) ---------- */
const VIA = { oauth: 'Conexión oficial', session: 'Con tu sesión' };
const LEAD = {
  oauth: 'Permiso oficial del servicio. Elegís qué puede hacer la IA y lo podés revocar cuando quieras.',
  session: 'Iniciás sesión vos, en la página oficial, desde la computadora virtual. La IA nunca ve tu contraseña.'
};
let catSeq = 0;

/** Logo local (lazy, sin bloquear el render). Sin logo oficial con permiso de uso: inicial en una ficha neutra. */
function logoEl(sv) {
  const box = h('span', { class: 'acc-svc-logo' });
  const mono = () => h('span', { class: 'acc-svc-mono', 'aria-hidden': 'true' }, sv.name.charAt(0));
  if (!sv.logo) { box.classList.add('is-mono'); box.append(mono()); return box; }
  const img = h('img', { src: sv.logo, alt: `Logo de ${sv.name}`, width: 24, height: 24, loading: 'lazy', decoding: 'async', 'data-no-i18n': '' });
  img.addEventListener('error', () => { box.classList.add('is-mono'); img.replaceWith(mono()); }, { once: true });
  box.append(img);
  return box;
}

function catalogSection(providers, sessions, ctx, rerender) {
  const statusOf = (sv) => serviceStatus(sv, providers, sessions);
  const uid = 'cat' + (++catSeq);
  const rows = new Map(SERVICES.map((sv) => [sv.id, serviceRow(sv, statusOf(sv), ctx, rerender)]));
  const input = h('input', { class: 'input acc-cat-in', id: uid + 'q', type: 'search', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'search', placeholder: 'Buscar cuentas', 'aria-describedby': uid + 'n', 'aria-controls': uid + 'l' });
  const clear = h('button', { class: 'acc-cat-x', type: 'button', 'aria-label': 'Borrar la búsqueda', hidden: true, html: icon('close') });
  const count = h('p', { class: 'acc-cat-n', id: uid + 'n', role: 'status', 'aria-live': 'polite' });
  const lists = h('div', { class: 'acc-cat-groups', id: uid + 'l' });
  const empty = h('div', { class: 'acc-cat-empty', hidden: true });
  const group = (title, items, hint) => items.length ? h('section', { class: 'acc-cat-g', 'aria-label': title },
    h('h4', { class: 'acc-gal-h' }, title, h('span', { class: 'acc-cat-gn', 'aria-hidden': 'true' }, String(items.length))),
    hint ? h('p', { class: 'acc-small muted acc-cat-hint' }, hint) : null,
    h('ul', { class: 'acc-svc-list' }, ...items.map((sv) => rows.get(sv.id)))) : null;
  const paint = () => {
    const q = input.value;
    const found = searchServices(SERVICES, q);
    const g = groupServices(found, statusOf);
    lists.replaceChildren(...[
      group('Conectadas', g.connected),
      group('Conexión oficial', g.official, LEAD.oauth),
      group('Con tu sesión en la computadora virtual', g.session, LEAD.session)
    ].filter(Boolean));
    clear.hidden = !q;
    const n = found.length;
    count.textContent = q.trim() ? (n ? `${n} ${n === 1 ? 'resultado' : 'resultados'}` : 'Sin resultados') : `${SERVICES.length} servicios · ${g.connected.length} ${g.connected.length === 1 ? 'conectada' : 'conectadas'}`;
    empty.hidden = n > 0;
    if (!n) empty.replaceChildren(h('span', { class: 'acc-empty-ic', html: icon('search') }),
      h('p', {}, h('strong', {}, 'No encontramos ese servicio.'), h('small', { class: 'muted' }, 'Probá con otro nombre o una categoría («música», «pagos», «empleo»). Para cualquier otro sitio, pedile al agente en el chat que lo abra y usá «Tomar el control».')),
      h('button', { class: 'btn btn-sm', type: 'button', onclick: () => { input.value = ''; paint(); input.focus(); } }, 'Ver todos'));
  };
  input.addEventListener('input', paint);
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape' && input.value) { e.stopPropagation(); e.preventDefault(); input.value = ''; paint(); } });
  clear.addEventListener('click', () => { input.value = ''; paint(); input.focus(); });
  paint();
  return h('section', { class: 'acc-cat', 'aria-labelledby': uid + 'h' },
    h('h4', { class: 'sr-only', id: uid + 'h' }, 'Servicios para conectar'),
    h('div', { class: 'acc-cat-search', role: 'search' },
      h('label', { class: 'sr-only', for: uid + 'q' }, 'Buscar cuentas'),
      h('span', { class: 'acc-cat-ic', html: icon('search') }), input, clear),
    count, lists, empty,
    h('p', { class: 'acc-cat-legal' }, 'Las marcas y logos pertenecen a sus dueños; no estamos afiliados.'));
}

/** Una fila: logo, nombre, estado y una acción. Tocar el nombre abre el detalle (permisos, Desconectar, qué no permite). */
function serviceRow(sv, st, ctx, rerender) {
  const id = 'svc-' + sv.id + '-' + catSeq;
  const status = st.status;
  const [tone, label] = STATUS[status] || STATUS.available;
  const lv = st.provider && st.provider.level;
  const chipText = status === 'connected' && sv.kind === 'oauth' ? `${label} · ${LEVEL_TEXT[lv || 'confirm'][0]}` : label;
  const detail = h('div', { class: 'acc-svc-detail', id: id + 'd', hidden: true, role: 'region', 'aria-label': `Detalle de ${sv.name}` });
  let built = false;
  const main = h('button', { class: 'acc-svc-main', type: 'button', 'aria-expanded': 'false', 'aria-controls': id + 'd' },
    logoEl(sv),
    h('span', { class: 'acc-svc-t' }, h('strong', { 'data-no-i18n': '' }, sv.name),
      h('span', { class: 'acc-svc-meta' }, h('span', { class: `acc-chip ${tone}` }, chipText), h('small', { class: 'muted' }, CATEGORIES[sv.category], ' · ', VIA[sv.kind]))),
    h('span', { class: 'acc-svc-chev', html: icon('chevron') }));
  const toggle = (open = main.getAttribute('aria-expanded') !== 'true') => {
    if (open && !built) { built = true; detail.append(sv.kind === 'oauth' ? oauthDetail(sv, st, ctx, rerender) : sessionDetail(sv, st, rerender)); }
    main.setAttribute('aria-expanded', String(open));
    detail.hidden = !open;
    li.classList.toggle('is-open', open);
    return open;
  };
  main.addEventListener('click', () => toggle());
  let act;
  if (status === 'connected') act = h('button', { class: 'btn btn-sm acc-svc-go', type: 'button', 'aria-label': `Administrar ${sv.name}`, onclick: () => { toggle(true); detail.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }, 'Administrar');
  else if (status === 'not_configured') act = h('button', { class: 'btn btn-sm btn-ghost acc-svc-go', type: 'button', 'aria-label': `Detalles de ${sv.name}`, onclick: () => toggle() }, 'Detalles');
  else if (sv.kind === 'session') act = h('button', { class: 'btn btn-sm btn-primary acc-svc-go', type: 'button', 'aria-label': `Conectar ${sv.name}`, onclick: () => openSiteLogin(sv, rerender) }, 'Conectar');
  else if (sv.provider === 'cloudflare' && !(st.provider && st.provider.oauth)) {
    // Cloudflare con token: se abre el detalle con el formulario oficial precargado.
    act = h('button', { class: 'btn btn-sm btn-primary acc-svc-go', type: 'button', 'aria-label': `Conectar ${sv.name}`, onclick: () => {
      toggle(true);
      const b = [...detail.querySelectorAll('.acc-row .btn-primary')].find((x) => /Conectar/.test(x.textContent));
      if (b) b.click();
      const f = detail.querySelector('.acc-cf input'); if (f) f.focus();
    } }, 'Conectar');
  } else act = h('button', { class: 'btn btn-sm btn-primary acc-svc-go', type: 'button', 'aria-label': `${status === 'expired' ? 'Reconectar' : 'Conectar'} ${sv.name}`, onclick: (e) => connect(st.provider, e.currentTarget, (st.provider && st.provider.level) || 'confirm') }, status === 'expired' ? 'Reconectar' : 'Conectar');
  const li = h('li', { class: 'acc-svc', 'data-status': status, 'data-kind': sv.kind, 'data-id': sv.id },
    h('div', { class: 'acc-svc-row' }, main, act), detail);
  return li;
}

function oauthDetail(sv, st, ctx, rerender) {
  if (!st.provider) return h('p', { class: 'acc-note' }, h('span', { html: icon('info') }), 'Esta conexión todavía no está habilitada en AgentiCuántico. Va a aparecer acá apenas esté lista.');
  const c = card(st.provider, ctx, rerender);
  c.classList.add('in-cat');
  return c;
}

const fmtShort = (t) => { try { return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' }).format(new Date(t)); } catch { return ''; } };

function sessionDetail(sv, st, rerender) {
  const s = st.session;
  const box = h('div', { class: 'acc-conn in-cat acc-ses-detail' });
  if (s) box.append(h('div', { class: 'acc-who' }, h('span', { class: 'acc-who-ava', html: icon('monitor') }),
    h('span', {}, h('small', { class: 'muted' }, 'Sesión guardada'), h('strong', { 'data-no-i18n': '' }, s.host),
      h('small', { class: 'muted' }, `Vence el ${fmtDate(s.expiresAt)}${s.lastUsedAt ? ' · usada ' + timeAgo(s.lastUsedAt) : ''}`))));
  box.append(
    h('p', { class: 'acc-blurb' }, `Para ${sv.name} no hay un permiso oficial para apps como esta: entrás vos a la página de login de ${sv.name} en la computadora virtual y, si querés, guardás esa sesión.`),
    h('ul', { class: 'acc-perms', 'aria-label': 'Qué puede hacer la IA' },
      h('li', {}, h('span', { class: 'acc-perm-ic', html: icon('eye') }), h('span', {}, `Usar la sesión solo cuando tu pedido nombra ${sv.name}`)),
      h('li', {}, h('span', { class: 'acc-perm-ic w', html: icon('lock') }), h('span', {}, 'Comprar, pagar, enviar o publicar ', h('em', {}, 'con tu aprobación')))),
    h('details', { class: 'acc-cannot' }, h('summary', {}, `Qué no permite ${sv.name}`),
      h('ul', {}, h('li', {}, 'La IA no ve ni guarda tu contraseña: se guardan solo las cookies del sitio, cifradas.'),
        h('li', {}, 'No usa la sesión en otros sitios ni cuando no se lo pedís.'),
        h('li', {}, 'No completa datos de tarjetas.'),
        h('li', {}, 'Si el sitio cierra la sesión o pide un código, tenés que volver a entrar vos.'))));
  const acts = h('div', { class: 'acc-row' },
    h('button', { class: 'btn btn-sm' + (s ? '' : ' btn-primary'), type: 'button', onclick: () => openSiteLogin(sv, rerender) }, s ? 'Iniciar sesión de nuevo' : 'Conectar'));
  if (s) acts.append(h('button', { class: 'btn btn-sm btn-danger-ghost', type: 'button', onclick: async () => {
    if (!(await confirmDialog({ title: `Desconectar ${sv.name}`, text: 'Se borra la sesión guardada. El agente ya no va a poder entrar con tu cuenta hasta que vuelvas a iniciar sesión.', ok: 'Desconectar', danger: true }))) return;
    try { await call('/api/agent/sessions/delete', { method: 'POST', body: { host: s.host } }); toast(`${sv.name} desconectada.`); rerender(); }
    catch (e) { toast(errorText(e), 'warn'); }
  } }, 'Desconectar'));
  box.append(acts);
  return box;
}

/**
 * «Conectar» un sitio con sesión: abre la computadora virtual en la página de login oficial, ya con «Tomar el control».
 * Al devolver el control, la computadora ofrece guardar la sesión (flujo de Fase 5). Al cerrar, se apaga el navegador.
 */
async function openSiteLogin(sv, rerender) {
  const url = loginUrl(sv);
  if (!url) { toast(`No tengo la página de login de ${sv.name}.`, 'warn'); return; }
  const tid = 'vmT' + (++catSeq);
  const host = h('div', { class: 'acc-vm-host' });
  const closeBtn = h('button', { class: 'btn btn-icon acc-close', type: 'button', 'aria-label': 'Cerrar', html: icon('close') });
  const d = h('dialog', { class: 'acc-vm', 'aria-labelledby': tid },
    h('header', { class: 'acc-vm-head' },
      h('span', { class: 'acc-vm-t' }, logoEl(sv), h('span', {}, h('strong', { id: tid }, `Conectar ${sv.name}`), h('small', { class: 'muted', 'data-no-i18n': '' }, new URL(url).hostname))),
      closeBtn),
    h('div', { class: 'acc-vm-body' },
      h('ol', { class: 'acc-vm-steps' },
        h('li', {}, h('strong', {}, 'Iniciá sesión vos'), h('span', {}, ` en la página oficial de ${sv.name}: tocá la pantalla para elegir un campo y escribí abajo.`)),
        h('li', {}, h('strong', {}, 'Tocá «Devolver el control»'), h('span', {}, ' cuando ya estés adentro.')),
        h('li', {}, h('strong', {}, 'Guardá la sesión'), h('span', {}, ' y elegí cuándo vence (1, 7 o 30 días).'))),
      h('p', { class: 'acc-small muted acc-vm-note' }, h('span', { html: icon('lock') }), 'Lo que escribís va directo a la página: la IA no lo ve y no se guarda tu contraseña.'),
      host));
  document.body.append(d);
  let card = null;
  const close = async () => {
    d.close();
    try { if (card && !card.stopped) await card.stop(); } catch { /* sin efecto */ }
    d.remove();
    rerender();
  };
  closeBtn.addEventListener('click', close);
  d.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  d.showModal();
  closeBtn.focus();
  try {
    const { AgentBrowserCard } = await import('../agent-browser.js');
    const lang = (document.documentElement.lang || 'es-AR');
    card = new AgentBrowserCard({ thread: host, composer: d, text: '', url, takeover: true, conv: 'cuentas-' + sv.id, lang });
  } catch {
    host.append(h('div', { class: 'acc-empty' }, h('span', { class: 'acc-empty-ic', html: icon('warn') }), h('p', {}, 'No pude abrir la computadora virtual. Probá de nuevo en un rato.')));
  }
}

/* ---------- Sesiones en la computadora virtual ---------- */
async function sessionsSection(el, rerender) {
  const box = h('section', { class: 'acc-sessions', 'aria-labelledby': 'accSesH' },
    h('h4', { class: 'acc-gal-h', id: 'accSesH' }, 'Sesión en la computadora virtual'),
    h('p', { class: 'acc-small muted' }, 'Para cualquier otro sitio: pedile al agente que abra el sitio, tocá «Tomar el control» e iniciá sesión vos. Al devolver el control te ofrezco guardar esa sesión. La IA nunca ve ni guarda tu contraseña, y usa la sesión solo cuando tu pedido nombra ese sitio.'));
  el.append(box);
  let r;
  try { r = await call('/api/agent/sessions'); }
  catch (e) { box.append(h('p', { class: 'acc-note' }, h('span', { html: icon('info') }), e && e.code === 'login_required' ? 'Ingresá a tu cuenta para guardar sesiones.' : 'Las sesiones guardadas no están disponibles en este momento.')); return; }
  if (!r.sessions || !r.sessions.length) {
    box.append(h('div', { class: 'acc-ses-empty' }, h('span', { class: 'acc-empty-ic', html: icon('monitor') }),
      h('p', {}, h('strong', {}, 'Todavía no guardaste ninguna sesión.'), h('small', { class: 'muted' }, 'Probá en el chat: «Entrá a mi cuenta de…» y, cuando aparezca la computadora, tocá «Tomar el control».'))));
    return;
  }
  box.append(h('ul', { class: 'acc-login-list acc-ses-list' }, ...r.sessions.map((x) => h('li', {},
    h('span', { class: 'acc-login-ic', html: icon('monitor') }),
    h('span', { class: 'acc-login-t' }, h('strong', { 'data-no-i18n': '', title: x.host }, x.host),
      h('small', { class: 'muted' }, `Guardada el ${fmtDate(x.createdAt)} · vence el ${fmtDate(x.expiresAt)}${x.lastUsedAt ? ' · usada ' + timeAgo(x.lastUsedAt) : ''}`)),
    h('button', { class: 'btn btn-sm btn-danger-ghost', type: 'button', 'aria-label': `Borrar la sesión de ${x.host}`, onclick: async () => {
      if (!(await confirmDialog({ title: `Borrar la sesión de ${x.host}`, text: 'El agente ya no va a poder entrar a ese sitio con tu sesión. Si lo necesitás, volvés a iniciar sesión con «Tomar el control».', ok: 'Borrar', danger: true }))) return;
      try { await call('/api/agent/sessions/delete', { method: 'POST', body: { host: x.host } }); toast(`Sesión de ${x.host} borrada.`); rerender(); }
      catch (e) { toast(errorText(e), 'warn'); }
    } }, 'Borrar')))));
}

/* ---------- Registro de actividad ---------- */
const labelFor = (p) => ({ github: 'GitHub', google: 'Gmail', gcalendar: 'Google Calendar', gdrive: 'Google Drive', gcloud: 'Google Cloud', linkedin: 'LinkedIn', cloudflare: 'Cloudflare', browser: 'Computadora virtual', jobs: 'Empleo', tools: 'Herramientas' })[p] || p;
const ACTION = { chat_enable: 'activó la cuenta en el chat', chat_disable: 'desactivó la cuenta en el chat', connect: 'conectó la cuenta', connect_start: 'empezó a conectar', connect_callback: 'volvió del proveedor', connect_exchange: 'canje del permiso', disconnect: 'desconectó la cuenta', refresh: 'renovó el permiso', level_read: 'pasó a «Solo leer»', level_confirm: 'pasó a «Actuar pidiendo confirmación»', write_blocked: 'bloqueó un cambio (solo leer)', gmail_send: 'envío de correo', gmail_create_draft: 'borrador de correo', github_create_issue: 'issue en GitHub', github_commit_file: 'commit en GitHub', linkedin_post: 'publicación en LinkedIn', calendar_create_event: 'evento en el calendario', drive_create_file: 'documento en Drive', gcloud_enable_service: 'activar una API', cloudflare_worker_health: 'estado de un Worker', deploy_worker: 'publicó un Worker', open_apply_link: 'abrió una oferta', session_save: 'guardó una sesión', session_use: 'usó una sesión guardada', session_delete: 'borró una sesión' };
const OUTCOME = { ok: ['ok', 'Hecho'], pending: ['', 'Esperando tu aprobación'], cancelled: ['muted', 'Rechazado'], denied: ['warn', 'Bloqueado'], error: ['warn', 'Falló'] };
async function activitySection(el) {
  const box = h('section', { class: 'acc-activity', 'aria-labelledby': 'accActH' },
    h('h4', { class: 'acc-gal-h', id: 'accActH' }, 'Registro de actividad'),
    h('p', { class: 'acc-small muted' }, 'Qué hizo la IA, en qué cuenta y cuándo. No se guardan contenidos (correos, archivos ni contraseñas).'));
  el.append(box);
  let a;
  try { a = await call('/api/connectors/audit'); } catch { box.append(h('p', { class: 'acc-small' }, 'No pude cargar el registro ahora.')); return; }
  const ev = (a.events || []);
  if (!ev.length) { box.append(h('p', { class: 'acc-small' }, 'Todavía no hay actividad.')); return; }
  const row = (x) => {
    const [tone, txt] = OUTCOME[x.outcome] || ['', x.outcome];
    return h('li', {}, h('span', { class: 'acc-act-main' }, h('strong', {}, labelFor(x.provider)), h('span', {}, ' · ' + (ACTION[x.action] || x.action)), x.provider === 'browser' && x.detail ? h('span', { class: 'muted', 'data-no-i18n': '' }, ' · ' + String(x.detail).split(' · ')[0]) : null),
      h('span', { class: 'acc-act-meta' }, h('span', { class: 'acc-chip ' + tone }, txt), h('time', { class: 'muted', datetime: new Date(x.at).toISOString(), title: new Date(x.at).toLocaleString('es-AR') }, timeAgo(x.at))));
  };
  const list = h('ul', { class: 'acc-audit acc-act-list' }, ...ev.slice(0, 10).map(row));
  box.append(list);
  if (ev.length > 10) {
    const more = h('button', { class: 'btn btn-sm btn-ghost', type: 'button' }, 'Ver más');
    more.addEventListener('click', () => { list.append(...ev.slice(10).map(row)); more.remove(); });
    box.append(more);
  }
}

const BLURB = {
  github: 'Tus repositorios y archivos: listar, leer y guardar cambios.',
  google: 'Tu correo: resumir lo nuevo, preparar borradores y enviar.',
  gcalendar: 'Tu agenda: ver lo que viene y crear eventos.',
  gdrive: 'Tus documentos: guardar informes en tu Drive y volver a leerlos.',
  gcloud: 'Tus proyectos de Google Cloud: verlos y activar APIs.',
  linkedin: 'Tu perfil: datos básicos y publicaciones.',
  cloudflare: 'Tus Workers: ver su estado y publicar nuevas versiones.'
};

/** Selector de nivel (radio): antes de conectar elige qué se pide; conectada, lo cambia en el servidor. */
function levelPicker(p, onChange) {
  const name = 'lvl-' + p.id;
  const cur = p.level || 'confirm';
  const opts = ['read', 'confirm'].map((lv) => {
    const id = `${name}-${lv}`;
    const input = h('input', { type: 'radio', name, id, value: lv });
    input.checked = lv === cur;
    input.addEventListener('change', () => { if (input.checked) onChange(lv, input); });
    return h('label', { class: 'acc-lvl-opt', for: id }, input, h('span', {}, h('strong', {}, LEVEL_TEXT[lv][0]), h('small', { class: 'muted' }, LEVEL_TEXT[lv][1])));
  });
  return h('fieldset', { class: 'acc-lvl' }, h('legend', {}, 'Qué puede hacer la IA'), ...opts);
}

export function card(p, ctx, rerender) {
  const [tone, label] = STATUS[p.status] || STATUS.available;
  const body = h('div', { class: 'acc-conn-body' });
  const acts = h('div', { class: 'acc-row' });
  let chosen = 'confirm';
  const connectedish = p.status === 'connected' || p.status === 'expired';
  if (connectedish) {
    const c = p.connection || {};
    body.append(h('div', { class: 'acc-who' },
      c.avatar ? h('img', { src: c.avatar, alt: '', width: 28, height: 28, referrerpolicy: 'no-referrer' }) : h('span', { class: 'acc-who-ava', html: icon('user') }),
      h('span', {}, h('small', { class: 'muted' }, 'Conectada como'), h('strong', { 'data-no-i18n': '' }, c.login || c.name || '—'),
        c.connectedAt ? h('small', { class: 'muted' }, `Desde el ${fmtDate(c.connectedAt)}`) : null)));
    if (p.status === 'connected') {
      body.append(levelPicker(p, async (lv, input) => {
        const radios = body.querySelectorAll(`input[name="lvl-${p.id}"]`);
        radios.forEach((r) => { r.disabled = true; });
        try {
          const r = await call(`/api/connectors/${p.id}/level`, { method: 'POST', body: { level: lv } });
          if (r.needsReconnect) {
            radios.forEach((x) => { x.checked = x.value === (r.level || 'read'); });
            if (await confirmDialog({ title: `Dar permiso para actuar en ${p.label}`, text: `La conectaste con «Solo leer», así que ${p.label} no le dio permiso de escritura. Te llevo a ${p.label} para que lo apruebes; no se hace ningún cambio sin tu «Aprobar».`, ok: `Ir a ${p.label}` })) await connect(p, null, 'confirm');
          } else toast(lv === 'read' ? `${p.label}: ahora la IA solo puede leer.` : `${p.label}: la IA puede actuar, siempre con tu aprobación.`, 'ok');
        } catch (e) { toast(errorText(e), 'warn'); radios.forEach((x) => { x.checked = x.value === (p.level || 'confirm'); }); }
        radios.forEach((r) => { r.disabled = false; });
        void input;
      }));
      body.append(chatSwitch(p));
    }
    if (p.status === 'expired' || p.kind === 'oauth2' || (p.id === 'cloudflare' && p.oauth)) acts.append(h('button', { class: 'btn btn-sm' + (p.status === 'expired' ? ' btn-primary' : ''), type: 'button', onclick: (e) => connect(p, e.currentTarget, p.level || 'confirm') }, p.status === 'expired' ? 'Reconectar' : 'Cambiar cuenta'));
    acts.append(h('button', { class: 'btn btn-sm btn-danger-ghost', type: 'button', onclick: async () => {
      if (!(await confirmDialog({ title: `Desconectar ${p.label}`, text: `Se borra el acceso guardado${p.kind === 'oauth2' || (c.meta && c.meta.via === 'oauth') ? ' y se revoca el permiso en ' + p.label : ' (el token lo podés borrar también en el panel de ' + p.label + ')'}. Podés volver a conectarla cuando quieras.`, ok: 'Desconectar', danger: true }))) return;
      try { await call(`/api/connectors/${p.id}/disconnect`, { method: 'POST', body: {} }); toast(`${p.label} desconectada.`); rerender(); }
      catch (e) { toast(errorText(e), 'warn'); }
    } }, 'Desconectar'));
  } else if (p.status === 'not_configured') {
    body.append(h('p', { class: 'acc-note' }, h('span', { html: icon('info') }), 'Esta conexión todavía no está habilitada en AgentiCuántico. Va a aparecer acá apenas esté lista.'));
  } else {
    body.append(levelPicker(p, (lv) => { chosen = lv; const f = body.querySelector('.acc-cf'); if (f) f.dataset.level = lv; const a = body.querySelector('.acc-cf-tpl'); if (a && p.tokenTemplates) a.href = p.tokenTemplates[lv]; }));
    if (p.id === 'cloudflare' && !p.oauth) {
      // Cloudflare con token: el formulario oficial de Cloudflare se abre precargado con los permisos del nivel elegido.
      const btn = h('button', { class: 'btn btn-sm btn-primary', type: 'button', 'aria-expanded': 'false', onclick: () => { btn.remove(); const f = cloudflareForm(p, () => chosen, rerender); body.append(f); f.querySelector('input').focus(); } }, 'Conectar');
      acts.append(btn);
    } else {
      acts.append(h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: (e) => connect(p, e.currentTarget, chosen) }, 'Conectar'));
    }
  }
  const cannot = (p.cannot || []).length ? h('details', { class: 'acc-cannot' }, h('summary', {}, `Qué no permite ${p.label}`),
    h('ul', {}, ...p.cannot.map((x) => h('li', {}, x))),
    p.docs ? h('a', { href: p.docs, target: '_blank', rel: 'noopener noreferrer', class: 'acc-src' }, 'Fuente oficial', h('span', { class: 'acc-ext', html: icon('external') })) : null) : null;
  return h('article', { class: 'acc-conn ' + (p.status === 'not_configured' ? 'off' : '') + (p.status === 'connected' ? ' is-on' : ''), 'aria-label': `${p.label}: ${label}` },
    h('div', { class: 'acc-conn-top' },
      h('span', { class: `acc-conn-logo ${p.id}`, html: LOGOS[p.id] || icon('plug') }),
      h('div', { class: 'acc-conn-t' }, h('strong', {}, p.label), h('span', { class: `acc-chip ${tone}` }, connectedish && p.status === 'connected' ? `${label} · ${LEVEL_TEXT[p.level || 'confirm'][0]}` : label))),
    BLURB[p.id] ? h('p', { class: 'acc-blurb' }, BLURB[p.id]) : null,
    h('ul', { class: 'acc-perms', 'aria-label': 'Qué puede hacer la IA' },
      ...p.reads.map((r) => h('li', {}, h('span', { class: 'acc-perm-ic', html: icon('eye') }), h('span', {}, r))),
      ...p.writes.map((w) => h('li', {}, h('span', { class: 'acc-perm-ic w', html: icon('lock') }), h('span', {}, `${w} `, h('em', {}, p.level === 'read' ? 'bloqueado en Solo leer' : 'con tu aprobación'))))),
    p.note ? h('p', { class: 'acc-small muted' }, p.note) : null,
    body, cannot, acts);
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

/** «Conectar»: un solo toque → pantalla de permiso del proveedor en esta misma pestaña, con el nivel elegido. */
async function connect(p, btn, level) {
  if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = `Abriendo ${p.label}…`; }
  try {
    const r = await startConnect(p.id, { level });
    if (r.mode === 'device' && r.userCode) { toast(`Abrí ${r.verificationUri} y escribí el código ${r.userCode}`, '', 15000); window.open(r.verificationUri, '_blank', 'noopener'); }
    if (r.mode !== 'redirect' && btn) { btn.disabled = false; btn.textContent = btn.dataset.label; }
  } catch (e) { toast(errorText(e), 'warn'); if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label; } }
}

function cloudflareForm(p, getLevel, rerender) {
  const id = 'cfTok' + Math.random().toString(36).slice(2, 7);
  const input = h('input', { class: 'input', id, type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: 'Pegá tu API token', 'aria-describedby': id + 'h' });
  const err = h('p', { class: 'error-text', role: 'alert' });
  const btn = h('button', { class: 'btn btn-sm btn-primary', type: 'submit' }, 'Verificar y conectar');
  const tpl = p.tokenTemplates ? p.tokenTemplates[getLevel()] : 'https://dash.cloudflare.com/profile/api-tokens';
  const f = h('form', { class: 'acc-cf' },
    h('ol', { class: 'acc-cf-steps' },
      h('li', {}, h('a', { class: 'acc-cf-tpl', href: tpl, target: '_blank', rel: 'noopener noreferrer' }, 'Abrir Cloudflare con los permisos ya elegidos', h('span', { class: 'acc-ext', html: icon('external') })), ' (se abre en otra pestaña).'),
      h('li', {}, 'Revisá los permisos, tocá «Continue to summary» y después «Create Token».'),
      h('li', {}, 'Copiá el token y pegalo acá. Se guarda cifrado y no se vuelve a mostrar.')),
    h('div', { class: 'field' }, h('label', { for: id }, 'API token de Cloudflare'), input, h('small', { id: id + 'h', class: 'muted' }, 'Nunca pegues la Global API Key: usá un token con permisos acotados.')),
    err, btn);
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); err.textContent = '';
    const token = input.value.trim();
    if (!token) { err.textContent = 'Pegá el token.'; input.focus(); return; }
    btn.disabled = true; btn.textContent = 'Verificando…';
    try {
      const r = await call('/api/connectors/cloudflare', { method: 'POST', body: { token, level: getLevel() } });
      input.value = '';
      toast(`Cloudflare conectada${r.warnings && r.warnings.length ? ' (al token le falta el permiso de Workers)' : ''}.`, 'ok');
      rerender();
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
  const label = { github: 'GitHub', google: 'Gmail', gcalendar: 'Google Calendar', gdrive: 'Google Drive', gcloud: 'Google Cloud', linkedin: 'LinkedIn', cloudflare: 'Cloudflare' }[prov] || prov;
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
