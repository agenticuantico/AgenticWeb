/* AgentiCuántico · utilidades de interfaz: íconos, avisos, diálogos, menús. */

const P = {
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  chevronRight: '<path d="M9 6l6 6-6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  send: '<path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  wave: '<path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/>',
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="7" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  speaker: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  sidebar: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/>',
  agent: '<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16.5h5"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  bolt: '<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  ghost: '<path d="M5 21V10a7 7 0 0 1 14 0v11l-2.3-1.7L14.3 21 12 19.3 9.7 21l-2.4-1.7z"/><circle cx="9.5" cy="10.5" r="1" fill="currentColor"/><circle cx="14.5" cy="10.5" r="1" fill="currentColor"/>',
  share: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19h14"/>',
  pin: '<path d="M9 4h6l-1 6 4 3v2H6v-2l4-3z"/><path d="M12 15v5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  paperclip: '<path d="M20 11.5l-8.3 8.3a5 5 0 0 1-7.1-7.1l8.8-8.8a3.5 3.5 0 0 1 5 5l-8.8 8.8a2 2 0 0 1-2.8-2.8l8.1-8.1"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  code: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 18h.01M12 18h4"/>',
  tools: '<path d="M14.5 6.5a4 4 0 0 0 5 5L13 18a2.1 2.1 0 0 1-3-3z"/><path d="M4 20l5-5"/>',
  plug: '<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  brain: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3h1V4z"/><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3h-1V4z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  userPlus: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 7.3 19.8l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.4 14H3a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 4.2 7.3l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.7 3.4V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  warn: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4.5M12 17.5h.01"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
  more: '<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>',
  arrowDown: '<path d="M12 5v14M5.5 12.5L12 19l6.5-6.5"/>',
  arrowRight: '<path d="M5 12h14M12.5 5.5L19 12l-6.5 6.5"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6l8.5 7 8.5-7"/>',
  google: '',
  memory: '<path d="M4 6h16M4 12h10M4 18h7"/><circle cx="18" cy="16" r="3"/>',
  canvas: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M13 4v16"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4"/>',
  power: '<path d="M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  flag: '<path d="M5 21V4h11l-1.5 4L16 12H5"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  micOff: '<path d="M9 9v2a3 3 0 0 0 5.1 2.1M15 10V6a3 3 0 0 0-5.7-1.3M5.5 11a6.5 6.5 0 0 0 10.9 4.8M18.5 11a6.5 6.5 0 0 1-.4 2.2M12 17.5V21M3 3l18 18"/>',
  upload: '<path d="M12 16V5M7.5 9.5L12 5l4.5 4.5M5 19h14"/>'
};

export function icon(name, cls = '') {
  if (name === 'google') {
    return '<svg class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>';
  }
  return '<svg class="' + cls + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || '') + '</svg>';
}

/** Reemplaza <i data-icon="x"></i> por el SVG correspondiente. */
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    if (el.dataset.hydrated) return;
    el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon));
    el.dataset.hydrated = '1';
  });
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Crea un elemento: h('button', { class: 'btn', onclick }, 'Texto', child) */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}

let toastRoot;
export function toast(msg, type = '', ms = 3800) {
  if (!toastRoot) {
    toastRoot = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(toastRoot);
  }
  const t = h('div', { class: 'toast ' + type }, msg);
  toastRoot.append(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 320); }, ms);
}

/** Abre un <dialog> modal. Devuelve { dialog, close, done } donde done es una promesa con el valor de cierre. */
export function modal({ title, body, actions = [], wide = false, onOpen, label } = {}) {
  const d = h('dialog', { class: 'modal' + (wide ? ' wide' : ''), 'aria-label': label || title || '' });
  const head = h('div', { class: 'modal-head' }, h('h2', {}, title || ''), h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Cerrar', html: icon('close'), onclick: () => close(null) }));
  const b = h('div', { class: 'modal-body' });
  if (typeof body === 'string') b.innerHTML = body; else if (body) b.append(body);
  d.append(head, b);
  if (actions.length) {
    const f = h('div', { class: 'modal-foot' });
    for (const a of actions) {
      f.append(h('button', { class: 'btn ' + (a.class || ''), type: 'button', onclick: async () => { if (a.onClick) { const r = await a.onClick(d); if (r === false) return; } close(a.value ?? a.label); } }, a.label));
    }
    d.append(f);
  }
  let resolve;
  const done = new Promise((r) => (resolve = r));
  function close(v) { if (!d.open) return; d.close(); d.remove(); resolve(v); }
  d.addEventListener('cancel', (e) => { e.preventDefault(); close(null); });
  d.addEventListener('click', (e) => { if (e.target === d) close(null); });
  document.body.append(d);
  d.showModal();
  onOpen && onOpen(d);
  return { dialog: d, body: b, close, done };
}

/** Confirmación accesible. danger=true pinta el botón en rojo. */
export function confirmDialog({ title, text, ok = 'Confirmar', cancel = 'Cancelar', danger = false }) {
  return modal({
    title, body: '<p class="muted">' + esc(text) + '</p>',
    actions: [{ label: cancel, value: false, class: 'btn-ghost' }, { label: ok, value: true, class: danger ? 'btn-danger' : 'btn-primary' }]
  }).done.then((v) => v === true);
}

/** Menú desplegable anclado a un botón. items: [{label, icon, onClick, checked, danger, sub}] | 'sep' | {heading} */
export function popover(anchor, items, { align = 'start', place = 'bottom', className = '' } = {}) {
  const wasOpen = [...document.querySelectorAll('.popover')].some((p) => p._anchor === anchor);
  closePopovers();
  if (wasOpen) return null; // segundo toque sobre el mismo botón: cerrar
  const wrap = anchor.closest('[data-popover-host]') || anchor.parentElement;
  wrap.style.position = wrap.style.position || 'relative';
  const pop = h('div', { class: 'popover ' + className, role: 'menu', 'data-align': align, 'data-place': place });
  for (const it of items) {
    if (it === 'sep') { pop.append(h('div', { class: 'menu-sep', role: 'separator' })); continue; }
    if (it.heading) { pop.append(h('div', { class: 'menu-label' }, it.heading)); continue; }
    const btn = h('button', { class: 'menu-item' + (it.danger ? ' danger' : ''), type: 'button', role: it.checked !== undefined ? 'menuitemradio' : 'menuitem', 'aria-checked': it.checked !== undefined ? String(!!it.checked) : null, disabled: it.disabled || null });
    if (it.img) btn.append(h('img', { class: 'flag', src: it.img, alt: '', width: 24, height: 24 }));
    else if (it.icon) btn.insertAdjacentHTML('beforeend', icon(it.icon));
    const meta = h('span', { class: 'meta' }, h('span', {}, it.label));
    if (it.sub) meta.append(h('small', {}, it.sub));
    btn.append(meta);
    if (it.badge) btn.append(h('span', { class: 'chip ' + (it.badgeClass || ''), style: 'margin-left:auto' }, it.badge));
    if (it.checked !== undefined) btn.insertAdjacentHTML('beforeend', icon('check', 'check-mark'));
    btn.addEventListener('click', (e) => { e.stopPropagation(); closePopovers(); it.onClick && it.onClick(); });
    pop.append(btn);
  }
  wrap.append(pop);
  anchor.setAttribute('aria-expanded', 'true');
  // mantener dentro de la pantalla
  requestAnimationFrame(() => {
    const r = pop.getBoundingClientRect();
    if (r.right > innerWidth - 8) { pop.style.left = 'auto'; pop.style.right = '0'; }
    if (r.left < 8) { pop.style.left = '0'; pop.style.right = 'auto'; }
    if (r.bottom > innerHeight - 8 && place === 'bottom') { pop.dataset.place = 'top'; }
    const first = pop.querySelector('.menu-item:not([disabled])');
    first && first.focus({ preventScroll: true });
  });
  pop.addEventListener('keydown', (e) => {
    const list = Array.from(pop.querySelectorAll('.menu-item:not([disabled])'));
    const i = list.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
    if (e.key === 'Escape') { closePopovers(); anchor.focus(); }
  });
  pop._anchor = anchor;
  return pop;
}
export function closePopovers() {
  document.querySelectorAll('.popover').forEach((p) => { p._anchor && p._anchor.setAttribute('aria-expanded', 'false'); p.remove(); });
}
// Cierra al tocar afuera. El clic que abrió el menú (sobre su ancla) también llega acá: se ignora.
document.addEventListener('click', (e) => {
  if (e.target.closest('.popover')) return;
  document.querySelectorAll('.popover').forEach((p) => {
    if (p._anchor && p._anchor.contains(e.target)) return;
    p._anchor && p._anchor.setAttribute('aria-expanded', 'false');
    p.remove();
  });
});

export function fmtDate(d, opts = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!d) return '—';
  const date = d.toDate ? d.toDate() : d instanceof Date ? d : new Date(d);
  if (isNaN(date)) return '—';
  return new Intl.DateTimeFormat('es-AR', opts).format(date);
}
export function timeAgo(ts) {
  const t = typeof ts === 'number' ? ts : Date.parse(ts);
  if (!t) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  const rtf = new Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' });
  if (s < 60) return 'recién';
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  return rtf.format(-Math.round(s / 86400), 'day');
}
export function uid(prefix = '') { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
export function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
export function prefersReducedMotion() { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; }
