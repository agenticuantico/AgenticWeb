/**
 * Área «Tu cuenta» dentro de /app/: perfil, uso del día, planes, tareas programadas, cuentas conectadas y empleo.
 * Se abre desde la tarjeta de cuenta de la barra lateral o con #cuenta, #cuenta/uso, #cuenta/tareas,
 * #cuenta/conexiones, #cuenta/memoria, #cuenta/proyectos, #cuenta/empleo. Es un <dialog> nativo (foco atrapado, Esc cierra, accesible).
 */
import { h, icon, esc } from '../ui.js';
import { call, errorText } from './api.js';
import { renderTasks } from './tasks.js';
import { renderConnections, finishOAuthFromHash } from './connections.js';
import { renderJobs } from './jobs.js';
import { renderMemory, renderProjects } from './workspace.js';

const CSS = '/assets/css/account-area.css?v=1.3.0';
const TABS = [
  ['perfil', 'Perfil', 'user'],
  ['uso', 'Uso y plan', 'chart'],
  ['tareas', 'Tareas', 'clock'],
  ['conexiones', 'Cuentas conectadas', 'plug'],
  ['memoria', 'Memoria', 'memory'],
  ['proyectos', 'Proyectos', 'folder'],
  ['empleo', 'Empleo', 'briefcase']
];
const METERS = [
  ['messages', 'Mensajes del chat', 'El modo Agente cuenta 3 por pedido.'],
  ['webSearches', 'Búsquedas web en vivo', null],
  ['jobSearches', 'Búsquedas de empleo', null],
  ['jobDrafts', 'Borradores de CV y carta', null],
  ['toolCalls', 'Acciones con tus cuentas', 'Lecturas y acciones confirmadas en GitHub, Gmail, Cloudflare y LinkedIn.'],
  ['taskRuns', 'Ejecuciones de tareas', 'Programadas y «Ejecutar ahora».']
];
const LIMIT_ROWS = [
  ['messages', 'Mensajes por día'], ['webSearches', 'Búsquedas web por día'], ['jobSearches', 'Búsquedas de empleo por día'],
  ['jobDrafts', 'Borradores por día'], ['toolCalls', 'Acciones con cuentas por día'], ['scheduledTasks', 'Tareas activas'],
  ['taskRuns', 'Ejecuciones de tareas por día'], ['browserMinutes', 'Minutos de navegador por día']
];

function ensureCss() {
  if (!document.querySelector('link[href*="account-area.css"]')) document.head.append(h('link', { rel: 'stylesheet', href: CSS, 'data-acc-css': '' }));
}
const fmtN = (n) => new Intl.NumberFormat('es-AR').format(n);
const fmtARS = (n) => 'ARS ' + fmtN(n);

/** Barra de uso accesible (role=progressbar). Color según el nivel: normal, alto (≥75 %) y agotado (100 %). */
export function usageBar(pct, label) {
  const v = Math.max(0, Math.min(100, Math.round(pct || 0)));
  const lvl = v >= 100 ? 'full' : v >= 75 ? 'high' : 'ok';
  return h('div', { class: `acc-bar ${lvl}`, role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': v, 'aria-label': label },
    h('i', { style: `width:${v}%` }));
}

/** «Se renueva hoy a las 21:00 (hora de Argentina) · en 6 h 5 min». */
export function resetText(reset) {
  if (!reset) return '';
  const s = Math.max(0, reset.inSec | 0);
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60);
  const left = hh ? `${hh} h ${mm} min` : `${mm} min`;
  return `Se renueva a las ${reset.localTime || '21:00'} (hora de Argentina) · en ${left}`;
}

let current = null;

export function openAccount(tab = 'perfil', opts = {}) {
  ensureCss();
  if (current) { current.show(tab); return current; }
  const nav = h('div', { class: 'acc-nav', role: 'tablist', 'aria-label': 'Secciones de tu cuenta', 'aria-orientation': 'vertical' });
  const pane = h('section', { class: 'acc-pane', role: 'tabpanel', tabindex: '-1', 'aria-live': 'polite' });
  const closeBtn = h('button', { class: 'icon-btn acc-close', type: 'button', 'aria-label': 'Cerrar tu cuenta', html: icon('close') });
  const d = h('dialog', { class: 'acc-dialog', 'aria-labelledby': 'accTitle' },
    h('div', { class: 'acc-shell' },
      h('header', { class: 'acc-head' },
        h('div', { class: 'acc-head-t' }, h('span', { class: 'acc-orb', 'aria-hidden': 'true' }), h('h2', { id: 'accTitle' }, 'Tu cuenta')),
        closeBtn),
      h('div', { class: 'acc-body' }, nav, pane)));
  const buttons = TABS.map(([id, label, ic]) => {
    const b = h('button', { type: 'button', role: 'tab', id: `acc-tab-${id}`, 'aria-controls': 'accPane', 'aria-selected': 'false', tabindex: '-1', 'data-tab': id, html: icon(ic) + `<span>${esc(label)}</span>` });
    b.addEventListener('click', () => show(id, true));
    nav.append(b);
    return b;
  });
  pane.id = 'accPane';
  // Flechas para moverse entre pestañas (patrón ARIA de tabs).
  nav.addEventListener('keydown', (e) => {
    const i = buttons.indexOf(document.activeElement);
    if (i < 0) return;
    const k = e.key;
    const next = k === 'ArrowDown' || k === 'ArrowRight' ? (i + 1) % buttons.length : k === 'ArrowUp' || k === 'ArrowLeft' ? (i - 1 + buttons.length) % buttons.length : k === 'Home' ? 0 : k === 'End' ? buttons.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault(); buttons[next].focus(); show(buttons[next].dataset.tab, true);
  });
  const ctx = { summary: null, refresh: async () => { ctx.summary = null; await load(); }, show: (t) => show(t, true), chat: opts.chat || null };

  async function load() {
    if (ctx.summary) return ctx.summary;
    ctx.summary = await call('/api/account/summary');
    return ctx.summary;
  }
  let token = 0;
  async function show(id, fromUser) {
    if (!TABS.some((t) => t[0] === id)) id = 'perfil';
    buttons.forEach((b) => { const on = b.dataset.tab === id; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    pane.setAttribute('aria-labelledby', `acc-tab-${id}`);
    const my = ++token;
    pane.innerHTML = '';
    pane.append(h('div', { class: 'acc-loading' }, h('span', { class: 'acc-spin', 'aria-hidden': 'true' }), 'Cargando…'));
    try {
      const view = { perfil: viewProfile, uso: viewUsage, tareas: renderTasks, conexiones: renderConnections, memoria: renderMemory, proyectos: renderProjects, empleo: renderJobs }[id];
      const el = h('div', { class: 'acc-view' });
      await view(el, ctx, load);
      if (my !== token) return;
      pane.innerHTML = ''; pane.append(el);
    } catch (e) {
      if (my !== token) return;
      pane.innerHTML = '';
      pane.append(e && e.code === 'login_required' ? signedOut() : h('div', { class: 'acc-empty' }, h('span', { class: 'acc-empty-ic', html: icon('warn') }), h('p', {}, errorText(e)), h('button', { class: 'btn btn-sm', type: 'button', onclick: () => { ctx.summary = null; show(id); } }, 'Reintentar')));
    }
    const hash = id === 'perfil' ? '#cuenta' : `#cuenta/${id}`;
    if (fromUser && location.hash !== hash && !/^#conectar=/.test(location.hash)) history.replaceState(null, '', hash);
  }
  function close() {
    if (!d.open) return;
    d.close(); d.remove(); current = null;
    if (/^#(cuenta|conectar=)/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
    document.dispatchEvent(new CustomEvent('account:closed'));
  }
  closeBtn.addEventListener('click', close);
  d.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  document.body.append(d);
  d.showModal();
  current = { show: (t) => show(t, true), close, dialog: d, ctx };
  // Vuelta de un proveedor OAuth (#conectar=…): se completa y se muestra la pestaña de conexiones.
  if (/^#conectar=/.test(location.hash)) { show('conexiones'); finishOAuthFromHash(ctx).then(() => show('conexiones')); }
  else show(tab);
  return current;
}

function signedOut() {
  return h('div', { class: 'acc-empty' },
    h('span', { class: 'acc-empty-ic', html: icon('lock') }),
    h('h3', {}, 'Ingresá para ver tu cuenta'),
    h('p', { class: 'muted' }, 'Tu uso, tus tareas y tus cuentas conectadas se guardan con tu cuenta.'),
    h('a', { class: 'btn btn-primary', href: '/cuenta/?volver=' + encodeURIComponent('/app/#cuenta') }, 'Ingresar'));
}

/* ------------------------------- Perfil ------------------------------- */
async function viewProfile(el, ctx, load) {
  const s = await load();
  const p = s.profile;
  const initial = (p.email || '?').charAt(0).toUpperCase();
  el.append(
    h('div', { class: 'acc-hero' },
      h('span', { class: 'acc-avatar', 'aria-hidden': 'true' }, initial),
      h('div', { class: 'acc-hero-t' },
        h('h3', {}, p.email || 'Tu cuenta'),
        h('p', { class: 'muted' }, p.owner ? 'Cuenta dueña · sin tope diario' : `Plan ${p.planName}`))),
    planCard(s, ctx),
    h('div', { class: 'acc-tiles' },
      tile('clock', 'Tareas activas', `${s.tasks.active} de ${s.tasks.max}`, () => ctx.show('tareas')),
      tile('plug', 'Cuentas conectadas', `${s.connectors.filter((c) => c.status === 'connected').length} de ${s.connectors.length}`, () => ctx.show('conexiones')),
      tile('memory', 'Memoria', 'Ver y editar', () => ctx.show('memoria')),
      tile('folder', 'Proyectos', 'Agrupar chats', () => ctx.show('proyectos')),
      tile('briefcase', 'Empleo', 'Ofertas y CV', () => ctx.show('empleo'))),
    voiceLine(),
    h('div', { class: 'acc-links' },
      h('a', { class: 'btn btn-ghost btn-sm', href: '/cuenta/' }, h('span', { html: icon('card') }), 'Suscripción y seguridad'),
      h('a', { class: 'btn btn-ghost btn-sm', href: '/planes.html' }, h('span', { html: icon('spark') }), 'Ver planes')));
}

/** Voz del chat: qué hay disponible. Las opciones con proveedor propio solo aparecen si están activas. */
function voiceLine() {
  const box = h('p', { class: 'acc-note acc-voice', 'aria-live': 'polite' }, h('span', { html: icon('mic') }), h('span', {}, 'Voz del chat: revisando…'));
  call('/api/voice').then((v) => {
    const txt = !v.stt.available && !v.tts.available ? 'Voz del chat: no disponible en este momento. Podés escribir igual.'
      : v.elevenlabs ? 'Voz del chat: voz natural premium activa.'
      : v.deepgram ? 'Voz del chat: voz neural Deepgram activa, con respaldo gratis.'
      : 'Voz del chat: voz neural gratis (con un tope diario; si se agota, usa la voz de tu navegador).';
    box.lastChild.textContent = txt;
  }).catch(() => { box.remove(); });
  return box;
}

function tile(ic, title, value, onClick) {
  return h('button', { class: 'acc-tile', type: 'button', onclick: onClick },
    h('span', { class: 'acc-tile-ic', html: icon(ic) }),
    h('span', { class: 'acc-tile-t' }, h('small', {}, title), h('strong', {}, value)),
    h('span', { class: 'acc-tile-go', html: icon('chevron') }));
}

function planCard(s, ctx) {
  const p = s.profile;
  const main = METERS.map(([k]) => ({ k, ...s.usage[k] })).sort((a, b) => b.pct - a.pct)[0];
  const label = METERS.find((m) => m[0] === main.k)[1];
  return h('div', { class: 'acc-plan' },
    h('div', { class: 'acc-plan-top' },
      h('div', {}, h('small', { class: 'acc-eyebrow' }, 'Tu plan'), h('strong', { class: 'acc-plan-name' }, p.owner ? 'Dueño' : p.planName)),
      h('span', { class: 'acc-pct', 'aria-hidden': 'true' }, `${s.usagePct}%`)),
    usageBar(s.usagePct, `Uso de hoy: ${s.usagePct} por ciento`),
    h('p', { class: 'acc-plan-meta' },
      p.owner ? 'Sin tope diario.' : main.pct ? `Lo más usado hoy: ${label.toLowerCase()} (${fmtN(main.used)} de ${fmtN(main.limit)}).` : 'Todavía no usaste nada hoy.'),
    h('p', { class: 'acc-reset' }, h('span', { html: icon('clock') }), resetText(s.reset)),
    h('div', { class: 'acc-plan-acts' },
      h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => ctx.show('uso') }, 'Ver uso y planes'),
      p.plan === 'free' && !p.owner ? h('a', { class: 'btn btn-sm', href: '/planes.html' }, 'Más uso con Pro') : null));
}

/* ----------------------------- Uso y plan ----------------------------- */
async function viewUsage(el, ctx, load) {
  const s = await load();
  const owner = s.profile.owner;
  el.append(h('div', { class: 'acc-section-h' }, h('h3', {}, 'Uso de hoy'), h('p', { class: 'muted' }, resetText(s.reset))));
  const list = h('ul', { class: 'acc-meters' });
  for (const [k, label, hint] of METERS) {
    const u = s.usage[k];
    list.append(h('li', { class: 'acc-meter' },
      h('div', { class: 'acc-meter-t' }, h('span', {}, label), h('strong', {}, owner || u.limit === null ? `${fmtN(u.used)} · sin tope` : `${fmtN(u.used)} de ${fmtN(u.limit)}`)),
      usageBar(u.pct, `${label}: ${u.pct} por ciento`),
      hint ? h('small', { class: 'muted' }, hint) : null));
  }
  if (s.browser) {
    const b = s.browser;
    const pctB = b.limitSec ? Math.round(((b.limitSec - b.leftSec) / b.limitSec) * 100) : 0;
    list.append(h('li', { class: 'acc-meter' },
      h('div', { class: 'acc-meter-t' }, h('span', {}, 'Navegador del agente'), h('strong', {}, `${Math.ceil(b.leftSec / 60)} de ${Math.round(b.limitSec / 60)} min libres`)),
      usageBar(pctB, `Navegador del agente: ${pctB} por ciento`),
      h('small', { class: 'muted' }, b.note)));
  }
  el.append(list);

  el.append(h('div', { class: 'acc-section-h' }, h('h3', {}, 'Planes'), h('p', { class: 'muted' }, 'Todas las funciones están en todos los planes. Cada plan da más uso por día.')));
  const grid = h('div', { class: 'acc-plans' });
  for (const pl of s.plans) {
    const mine = pl.id === s.profile.plan && !owner;
    grid.append(h('article', { class: 'acc-plan-col' + (mine ? ' mine' : '') + (pl.id === 'pro' ? ' featured' : ''), 'aria-label': `Plan ${pl.name}${mine ? ', tu plan' : ''}` },
      h('header', {},
        h('h4', {}, pl.name, mine ? h('span', { class: 'acc-badge' }, 'Tu plan') : null),
        h('p', { class: 'acc-price' }, pl.price.ars ? h('strong', {}, fmtARS(pl.price.ars)) : h('strong', {}, 'Gratis'), pl.price.ars ? h('span', {}, ` /mes · USD ${pl.price.usd}`) : null)),
      h('dl', { class: 'acc-limits' }, ...LIMIT_ROWS.flatMap(([k, label]) => [h('dt', {}, label), h('dd', {}, fmtN(pl.limits[k]))])),
      mine || pl.id === 'free' ? null : h('a', { class: 'btn btn-sm' + (pl.id === 'pro' ? ' btn-primary' : ''), href: `/planes.html#${pl.id}` }, `Elegir ${pl.name}`)));
  }
  el.append(grid);
  el.append(h('details', { class: 'acc-features' },
    h('summary', {}, 'Qué incluye cada plan'),
    h('ul', { class: 'acc-check' }, ...(s.plans[0]?.features || []).map((f) => h('li', {}, h('span', { html: icon('check') }), f)))));
  el.append(h('p', { class: 'acc-note' }, h('span', { html: icon('info') }),
    'El navegador real del agente usa un cupo diario compartido por toda la plataforma (plan gratis de Cloudflare: 10 minutos por día en total). Cuando se agota, el agente sigue trabajando en modo lectura.'));
}
