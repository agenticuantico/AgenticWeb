/**
 * Ordenador virtual · escritorio de sistema operativo propio de AgentiCuántico (diseño propio: sin logos, íconos,
 * fondos ni nombres de otros sistemas operativos).
 *  - Fondo e íconos de escritorio solo de aplicaciones reales (Navegador, Archivos, Tareas, Actividad).
 *  - Ventanas con barra de título (minimizar, maximizar/restaurar, cerrar). En compu y tablet se arrastran por la
 *    barra de título y se redimensionan desde los bordes; en celular se abren a pantalla completa.
 *  - Barra de tareas: botón de inicio, ventanas abiertas, estado del agente, conexión, tiempo, reloj con fecha y
 *    pantalla completa. Menú de inicio con las aplicaciones, el cupo del día, «Cerrar sesiones» y «Detener».
 * Los cálculos de posición viven en computer-wm.js (sin DOM, con pruebas).
 */
import { h, icon } from '../ui.js';
import { isCompact, clampRect, dragRect, resizeRect, defaultRect, raise, activeWindow, dateLabel } from './computer-wm.js?v=7.23.0';

/** Glifos propios de los controles de ventana (trazo redondeado, sin formas de otros sistemas). */
const G = {
  min: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 11.5h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>',
  max: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="3.2" y="3.2" width="9.6" height="9.6" rx="2.6" stroke="currentColor" stroke-width="1.7" fill="none"/></svg>',
  restore: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="2.8" y="5.2" width="8" height="8" rx="2.2" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M5.6 3.4c.2-.4.6-.6 1-.6h5.6c.6 0 1 .4 1 1v5.6c0 .4-.2.8-.6 1" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>',
  close: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  notes: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="3" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M8.5 9l1.5 1.5 3-3M8.5 15h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
};

/**
 * Aplicaciones del escritorio: solo las que hacen algo real.
 *  - Navegador: el navegador en la nube que maneja el agente (capturas reales, «Tomar el control»).
 *  - Archivos: los entregables reales de la tarea (informes, tablas, capturas, PDF) para descargar.
 *  - Tareas: las tareas programadas reales de la cuenta (/api/tasks): ver, ejecutar ahora, administrar.
 *  - Actividad: el registro real del agente (pedido, plan, pasos, resultado, modo y minutos del día).
 */
export const APPS = [
  { id: 'browser', name: 'Navegador', ic: () => icon('globe'), tone: 'lime' },
  { id: 'files', name: 'Archivos', ic: () => icon('folder'), tone: 'amber' },
  { id: 'tasks', name: 'Tareas', ic: () => icon('clock'), tone: 'sky' },
  { id: 'activity', name: 'Actividad', ic: () => G.notes, tone: 'violet' },
];
const HELP_APP = { id: 'help', name: 'Ayuda', ic: () => icon('info'), tone: 'teal' };
const appOf = (id) => APPS.find((a) => a.id === id) || (id === 'help' ? HELP_APP : null);

export class VirtualDesktop {
  /**
   * @param {{ lang?: string, reduced?: boolean, line: HTMLElement, net: HTMLElement, elapsed: HTMLElement,
   *   onExpand: () => void, onStop: () => void, isFull: () => boolean, onOpen?: (id: string) => void }} o
   */
  constructor(o) {
    this.o = o;
    this.wins = {};           // id → { el, rect, open, min, max, auto, title }
    this.order = [];          // apilado (último = arriba)
    this.compact = true;
    this.bounds = { w: 0, h: 0 };
    this.build();
  }

  build() {
    const uid = Math.random().toString(36).slice(2, 8);
    this.layer = h('div', { class: 'vos-layer' });
    this.icons = h('nav', { class: 'vos-icons', 'aria-label': 'Escritorio' }, ...APPS.map((a) => this.deskIcon(a)));
    // Menú de inicio
    this.menuId = 'vos-menu-' + uid;
    this.quota = h('p', { class: 'vos-menu-quota', 'aria-live': 'polite' });
    this.menuExtra = h('div', { class: 'vos-menu-extra' });
    this.fullItem = h('button', { class: 'vos-mfoot', type: 'button', onclick: () => { this.toggleStart(false); this.o.onExpand(); } }, h('span', { html: icon('expand') }), h('span', { class: 'vos-mfoot-t' }, 'Pantalla completa'));
    this.stopItem = h('button', { class: 'vos-mfoot vos-mfoot-stop', type: 'button', onclick: () => { this.toggleStart(false); this.o.onStop(); } }, h('span', { html: icon('power') }), h('span', {}, 'Detener'));
    this.stopItem.setAttribute('aria-label', 'Detener al agente');
    this.menu = h('div', { class: 'vos-menu', id: this.menuId, role: 'dialog', 'aria-label': 'Menú de inicio', hidden: true },
      h('div', { class: 'vos-menu-h' }, h('span', { class: 'vos-orb vos-orb-lg', 'aria-hidden': 'true' }, h('i'), h('i')),
        h('span', { class: 'vos-menu-ht' }, h('strong', {}, 'AgentiCuántico'), h('small', {}, 'Ordenador virtual · navegador en la nube'))),
      h('p', { class: 'vos-menu-l' }, 'Aplicaciones'),
      h('div', { class: 'vos-menu-apps' }, ...[...APPS, HELP_APP].map((a) => h('button', { class: 'vos-mapp', type: 'button', 'data-app': a.id, onclick: () => { this.toggleStart(false); this.open(a.id); } },
        h('span', { class: 'vos-tile vos-t-' + a.tone, html: a.ic() }), h('span', { class: 'vos-mapp-t' }, a.name)))),
      this.quota, this.menuExtra,
      h('div', { class: 'vos-menu-f' }, this.fullItem, this.stopItem));
    this.menu.addEventListener('keydown', (e) => this.menuKeys(e));
    this.toasts = h('div', { class: 'vos-toasts', 'aria-live': 'polite' });
    this.desk = h('div', { class: 'vos-desk vpc-desk is-compact' },
      h('div', { class: 'vos-wall', 'aria-hidden': 'true' }, h('i', { class: 'vos-w1' }), h('i', { class: 'vos-w2' }), h('i', { class: 'vos-w3' })),
      this.icons, this.layer, this.menu, this.toasts);
    // Barra de tareas
    this.startBtn = h('button', { class: 'vos-start vpc-start', type: 'button', 'aria-label': 'Inicio', title: 'Inicio', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': this.menuId, onclick: () => this.toggleStart() },
      h('span', { class: 'vos-orb', 'aria-hidden': 'true' }, h('i'), h('i')));
    this.apps = h('div', { class: 'vos-apps', role: 'group', 'aria-label': 'Ventanas abiertas' });
    this.clockT = h('time', { class: 'vos-clock-t', 'data-no-i18n': '' }, '');
    this.dateT = h('span', { class: 'vos-date', 'data-no-i18n': '' }, '');
    this.expandBtn = h('button', { class: 'vos-tray-btn', type: 'button', 'aria-label': 'Pantalla completa', title: 'Pantalla completa', html: icon('expand'), onclick: () => this.o.onExpand() });
    this.bar = h('footer', { class: 'vos-bar vpc-task' }, this.startBtn, this.apps, this.o.line,
      h('span', { class: 'vos-tray vpc-tray' }, this.o.net, this.o.elapsed, h('span', { class: 'vos-clock vpc-clock', title: 'Hora local' }, this.clockT, this.dateT), this.expandBtn));
    this.renderClock();
    this._docDown = (e) => { if (!this.menu.hidden && !this.menu.contains(e.target) && !this.startBtn.contains(e.target)) this.toggleStart(false); };
    document.addEventListener('pointerdown', this._docDown, true);
    if (typeof ResizeObserver === 'function') { this._ro = new ResizeObserver(() => this.layout()); this._ro.observe(this.layer); }
  }

  deskIcon(a) {
    const b = h('button', { class: 'vos-ico vpc-ico', type: 'button', 'data-app': a.id, onclick: () => this.open(a.id) },
      h('span', { class: 'vos-tile vos-t-' + a.tone, html: a.ic() }), h('span', { class: 'vos-ico-t vpc-ico-t' }, a.name), h('b', { class: 'vos-badge', hidden: true, 'data-no-i18n': '' }));
    return b;
  }

  /** Número sobre un ícono (por ejemplo, archivos nuevos). */
  setBadge(id, n) {
    const b = this.icons.querySelector(`[data-app="${id}"] .vos-badge`);
    if (!b) return;
    b.hidden = !n; b.textContent = n > 9 ? '9+' : String(n || '');
    const ico = b.parentElement; const a = appOf(id);
    ico.setAttribute('aria-label', n ? `${a.name} (${n})` : a.name);
  }

  /** Registra una ventana (cerrada hasta que se abra). */
  addWindow(id, { title, body, label }) {
    const a = appOf(id) || { name: title, ic: () => icon('monitor'), tone: 'slate' };
    const t = h('strong', { class: 'vos-tb-t', 'data-no-i18n': id === 'browser' ? '' : null }, title || a.name);
    const btn = (k, lab, fn) => h('button', { class: 'vos-wbtn vos-wbtn-' + k, type: 'button', 'aria-label': lab, title: lab, html: G[k], onclick: (e) => { e.stopPropagation(); fn(); } });
    const minB = btn('min', 'Minimizar', () => this.minimize(id));
    const maxB = btn('max', 'Maximizar', () => this.toggleMax(id));
    const closeB = btn('close', id === 'browser' ? 'Cerrar ventana (el agente sigue trabajando)' : 'Cerrar', () => this.close(id));
    const tb = h('header', { class: 'vos-tb' }, h('span', { class: 'vos-tb-ic vos-t-' + a.tone, 'aria-hidden': 'true', html: a.ic() }), t, h('span', { class: 'vos-tb-acts' }, minB, maxB, closeB));
    const el = h('section', { class: 'vos-win vpc-win', 'data-win': id, role: 'region', 'aria-label': label || a.name, hidden: true },
      tb, h('div', { class: 'vos-wb' }, body),
      ...['e', 's', 'w', 'se', 'sw'].map((edge) => h('i', { class: 'vos-rs vos-rs-' + edge, 'data-edge': edge, 'aria-hidden': 'true' })));
    el.addEventListener('pointerdown', () => this.focus(id), true);
    tb.addEventListener('pointerdown', (e) => this.startDrag(e, id));
    tb.addEventListener('dblclick', (e) => { if (!e.target.closest('button') && !this.compact) this.toggleMax(id); });
    el.querySelectorAll('.vos-rs').forEach((r) => r.addEventListener('pointerdown', (e) => this.startResize(e, id, r.dataset.edge)));
    this.layer.append(el);
    const tbtn = h('button', { class: 'vos-app', type: 'button', 'data-app': id, 'aria-pressed': 'false', title: a.name, onclick: () => this.taskClick(id) },
      h('span', { class: 'vos-app-ic', html: a.ic() }), h('span', { class: 'vos-app-t', 'data-no-i18n': id === 'browser' ? '' : null }, title || a.name));
    tbtn.hidden = true;
    this.apps.append(tbtn);
    this.wins[id] = { el, tb, t, maxB, tbtn, rect: null, open: false, min: false, max: false, auto: true };
    return this.wins[id];
  }

  /** Título visible de una ventana (y de su botón en la barra de tareas). */
  setTitle(id, text, full) {
    const w = this.wins[id]; if (!w) return;
    w.t.textContent = text; w.t.title = full || text;
    w.tbtn.querySelector('.vos-app-t').textContent = text; w.tbtn.title = full || text;
  }

  open(id) {
    const w = this.wins[id]; if (!w) return;
    const wasHidden = !w.open || w.min;
    if (!w.open) { w.open = true; w.min = false; if (!w.rect) w.auto = true; }
    w.min = false;
    this.focus(id);
    this.layout();
    this.sync();
    if (wasHidden && this.o.onOpen) this.o.onOpen(id);
    if (wasHidden && !this.o.reduced) { w.el.classList.remove('is-pop'); void w.el.offsetWidth; w.el.classList.add('is-pop'); }
  }

  minimize(id) { const w = this.wins[id]; if (!w) return; w.min = true; this.sync(); this.focusTop(); }

  /** Cerrar: el navegador solo se oculta (el agente sigue); las demás ventanas se cierran. */
  close(id) {
    const w = this.wins[id]; if (!w) return;
    if (id === 'browser') { w.min = true; this.toast('El agente sigue trabajando. Abre «Navegador» para volver a verlo.'); }
    else { w.open = false; w.min = false; }
    this.sync(); this.focusTop();
  }

  toggleMax(id) {
    const w = this.wins[id]; if (!w || this.compact) return;
    w.max = !w.max; this.focus(id); this.sync();
  }

  taskClick(id) {
    const w = this.wins[id]; if (!w) return;
    if (!w.open || w.min) return this.open(id);
    if (activeWindow(this.order, this.wins) === id) return this.minimize(id);
    this.focus(id); this.sync();
  }

  focus(id) {
    if (!this.wins[id]) return;
    this.order = raise(this.order, id);
    this.order.forEach((k, i) => { this.wins[k].el.style.zIndex = String(10 + i); });
    this.sync();
  }

  focusTop() { const top = activeWindow(this.order, this.wins); if (top) this.focus(top); }

  /** Refleja el estado de cada ventana en el DOM (visible, máxima, activa) y en la barra de tareas. */
  sync() {
    const act = activeWindow(this.order, this.wins);
    for (const [id, w] of Object.entries(this.wins)) {
      w.el.hidden = !w.open || w.min;
      w.el.classList.toggle('is-max', !!w.max || this.compact);
      w.el.classList.toggle('is-active', id === act);
      w.maxB.innerHTML = w.max ? G.restore : G.max;
      const lab = w.max ? 'Restaurar' : 'Maximizar';
      w.maxB.setAttribute('aria-label', lab); w.maxB.title = lab;
      w.tbtn.hidden = !w.open && id !== 'browser';
      w.tbtn.classList.toggle('is-open', w.open);
      w.tbtn.classList.toggle('is-min', w.open && w.min);
      w.tbtn.setAttribute('aria-pressed', String(id === act));
      w.tbtn.setAttribute('aria-label', `${w.t.textContent}${w.open && w.min ? ' (minimizada)' : ''}`);
      if (w.rect && !this.compact && !w.max) Object.assign(w.el.style, { left: w.rect.x + 'px', top: w.rect.y + 'px', width: w.rect.w + 'px', height: w.rect.h + 'px' });
      else Object.assign(w.el.style, { left: '', top: '', width: '', height: '' });
    }
    this.desk.classList.toggle('has-window', !!act);
  }

  /** Recalcula el modo (compacto o ventanas) y mantiene cada ventana dentro del escritorio. */
  layout() {
    const b = { w: this.layer.clientWidth, h: this.layer.clientHeight };
    if (!b.w || !b.h) return;
    this.bounds = b;
    const compact = isCompact(b.w);
    if (compact !== this.compact) { this.compact = compact; this.desk.classList.toggle('is-compact', compact); }
    let n = 0;
    for (const [id, w] of Object.entries(this.wins)) {
      if (!w.open) continue;
      w.rect = w.auto || !w.rect ? defaultRect(id, b, id === 'browser' ? 0 : n++) : clampRect(w.rect, b);
    }
    this.sync();
  }

  startDrag(e, id) {
    const w = this.wins[id];
    if (!w || this.compact || w.max || e.button > 0 || e.target.closest('button')) return;
    e.preventDefault();
    const r0 = { ...w.rect }, x0 = e.clientX, y0 = e.clientY, tb = w.tb;
    tb.setPointerCapture && tb.setPointerCapture(e.pointerId);
    w.el.classList.add('is-moving');
    const move = (ev) => { w.rect = dragRect(r0, ev.clientX - x0, ev.clientY - y0, this.bounds); w.auto = false; this.sync(); };
    const up = () => { tb.removeEventListener('pointermove', move); tb.removeEventListener('pointerup', up); tb.removeEventListener('pointercancel', up); w.el.classList.remove('is-moving'); };
    tb.addEventListener('pointermove', move); tb.addEventListener('pointerup', up); tb.addEventListener('pointercancel', up);
  }

  startResize(e, id, edge) {
    const w = this.wins[id];
    if (!w || this.compact || w.max || e.button > 0) return;
    e.preventDefault(); e.stopPropagation();
    const r0 = { ...w.rect }, x0 = e.clientX, y0 = e.clientY, t = e.currentTarget;
    t.setPointerCapture && t.setPointerCapture(e.pointerId);
    w.el.classList.add('is-moving');
    const move = (ev) => { w.rect = resizeRect(r0, ev.clientX - x0, ev.clientY - y0, this.bounds, edge); w.auto = false; this.sync(); };
    const up = () => { t.removeEventListener('pointermove', move); t.removeEventListener('pointerup', up); t.removeEventListener('pointercancel', up); w.el.classList.remove('is-moving'); };
    t.addEventListener('pointermove', move); t.addEventListener('pointerup', up); t.addEventListener('pointercancel', up);
  }

  toggleStart(force) {
    const on = typeof force === 'boolean' ? force : this.menu.hidden;
    this.menu.hidden = !on;
    this.startBtn.setAttribute('aria-expanded', String(on));
    this.startBtn.classList.toggle('is-on', on);
    if (on) setTimeout(() => { const f = this.menu.querySelector('.vos-mapp'); if (f) f.focus({ preventScroll: true }); }, 20);
  }

  menuKeys(e) {
    if (e.key === 'Escape') { e.stopPropagation(); this.toggleStart(false); this.startBtn.focus({ preventScroll: true }); return; }
    if (!/^Arrow(Up|Down|Left|Right)$/.test(e.key)) return;
    const list = [...this.menu.querySelectorAll('button:not([hidden])')];
    const i = list.indexOf(document.activeElement); if (i < 0) return;
    e.preventDefault();
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
    list[(i + step + list.length) % list.length].focus();
  }

  /** Aviso corto en la esquina del escritorio. */
  toast(text, ms = 3200) {
    const t = h('div', { class: 'vos-toast', 'data-no-i18n': '' }, h('span', { class: 'vos-orb vos-orb-sm', 'aria-hidden': 'true' }, h('i'), h('i')), h('span', {}, text));
    this.toasts.append(t);
    setTimeout(() => t.remove(), ms);
  }

  /** Pantalla completa: cambia el botón de la barra de tareas y el del menú. */
  setFull(f) {
    const lab = f ? 'Salir de pantalla completa' : 'Pantalla completa';
    this.expandBtn.innerHTML = icon(f ? 'collapse' : 'expand');
    this.expandBtn.setAttribute('aria-label', lab); this.expandBtn.title = lab;
    this.fullItem.querySelector('.vos-mfoot-t').textContent = lab;
    this.fullItem.querySelector('span').innerHTML = icon(f ? 'collapse' : 'expand');
    requestAnimationFrame(() => this.layout());
  }

  renderClock(now = new Date(), lang = this.o.lang || 'es') {
    const t = now.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit', ...(/^en/i.test(lang) ? {} : { hourCycle: 'h23' }) });
    if (this.clockT.textContent !== t) { this.clockT.textContent = t; this.clockT.dateTime = now.toISOString(); }
    const d = dateLabel(now, lang);
    if (this.dateT.textContent !== d) this.dateT.textContent = d;
  }

  destroy() {
    document.removeEventListener('pointerdown', this._docDown, true);
    if (this._ro) this._ro.disconnect();
  }
}
