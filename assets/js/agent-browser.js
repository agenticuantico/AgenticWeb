/**
 * Ordenador virtual (antes «Computadora del agente»): un navegador en la nube dentro de un escritorio propio tipo
 * escritorio remoto (fondo, íconos, ventana del navegador con controles, barra de tareas con reloj) y un puntero que
 * muestra cada clic, campo y desplazamiento REAL del agente (coordenadas medidas por el navegador; ver
 * chat/computer-pointer.js y worker-v2/src/browser/pointer.ts). Antes: ventana tipo escritorio remoto
 * (barra de título, barra de direcciones, pantalla en vivo, acción actual, pasos, tiempo, Detener, plegar, pantalla
 * completa y «Qué hice» al final, solo con pasos reales). Se enciende solo cuando el pedido lo necesita o cuando la
 * persona dice «en el ordenador» / «usá el ordenador»; la sesión es de su cuenta y nadie más la ve.
 * Modo híbrido: el agente planifica y trabaja solo hasta terminar.
 *  - Por defecto trabaja en «modo lectura»: busca y lee páginas como texto (rápido y sin gastar minutos de
 *    navegador). La vista muestra la página leída (título, dirección, texto) o los resultados de búsqueda.
 *  - Abre el navegador real solo cuando hace falta (clics, formularios, inicios de sesión) y lo cierra en cuanto
 *    deja de necesitarlo. Si se usaron los minutos del día, sigue en modo lectura. Si todos los navegadores están
 *    ocupados, la tarea queda en fila y muestra el puesto.
 *  - Tarjetas en el chat: aprobación (Aprobar / Rechazar) antes de comprar, pagar, enviar, publicar o postularse;
 *    formulario seguro de inicio de sesión (el servidor lo completa en la página; el agente no ve nada);
 *    preguntas con opciones. «Tomar el control» queda como alternativa. Nunca completa datos de tarjetas.
 *  - Archivos: informes, tablas (CSV/MD), documentos, capturas y PDF aparecen en el chat con vista previa.
 *  - Mismo contexto en la conversación: «seguí», «ahora compará…» continúan con lo ya reunido. Se puede retomar.
 */
import { h, icon } from './ui.js';
import * as engine from './chat/engine.js';
import { needsWebAction, isFollowUp, wantsComputer, stripComputer } from './chat/intent.js?v=7.17.0';
import { statusLine, visitedSites, summaryMeta, workMode, workSteps, VPC_NAME, VPC_HELP, elapsedText, taskElapsed, quotaText, addressText, whatIDid } from './chat/computer-status.js?v=7.17.0';
import { fitRect, toView, followY, newEvents, changedEvents, eventFits, pointerText, travelMs, fromView, parsePosY } from './chat/computer-pointer.js?v=7.19.0';
/** Reexportadas para el código que ya las importaba desde acá (la lógica vive en chat/intent.js, sin DOM). */
export { needsWebAction, isFollowUp };

(function css() {
  if (typeof document === 'undefined' || document.getElementById('ac-ab2-css')) return;
  const l = document.createElement('link');
  l.id = 'ac-ab2-css'; l.rel = 'stylesheet'; l.href = '/assets/css/agent-browser.css?v=7.19.0';
  document.head.appendChild(l);
})();

const SITES = [
  [/linkedin/i, 'https://www.linkedin.com/'], [/computrabajo/i, 'https://ar.computrabajo.com/'], [/bumeran/i, 'https://www.bumeran.com.ar/'],
  [/zonajobs/i, 'https://www.zonajobs.com.ar/'], [/indeed/i, 'https://ar.indeed.com/'], [/mercado ?libre/i, 'https://www.mercadolibre.com.ar/'],
  [/gmail|correo|mail/i, 'https://mail.google.com/']
];

/** Pedido de búsqueda explícito en el ordenador sin sitio puntual: arranca en un buscador con el pedido. */
export function computerStartUrl(text) {
  const q = stripComputer(text).replace(/^(busc[aá](me)?|fijate|mir[aá]|averigu[aá]|decime|mostrame)\s+/i, '').slice(0, 200).trim();
  if (!q) return null;
  // Clima: fuente abierta de pronóstico (los buscadores bloquean navegadores automáticos).
  const w = /(clima|tiempo|pron[oó]stico|temperatura|lluvia)\s+(?:de|en|para|hoy en)?\s*(.+)$/i.exec(q);
  if (w && w[2]) return 'https://wttr.in/' + encodeURIComponent(w[2].replace(/[?.!]+$/, '').trim()) + '?lang=es&m';
  // Resto: el agente busca desde el servidor y abre el resultado en la pantalla.
  return null;
}

export function guessUrl(text) {
  const m = /\bhttps?:\/\/[^\s<>"']{4,300}/i.exec(text) || /\b([a-z0-9-]+\.)+(com|ar|net|org|io|dev|es|mx|co|br)(\.[a-z]{2})?(\/[^\s]*)?/i.exec(text);
  if (m) return m[0].startsWith('http') ? m[0] : 'https://' + m[0];
  for (const [re, url] of SITES) if (re.test(text)) return url;
  return null;
}
/** Texto del modo lectura sin restos de formato (marcas de títulos, «null» de páginas sin título). */
export const readable = (t) => String(t == null ? '' : t).replace(/^\s*(null|undefined)\s*/i, '').replace(/^#{1,6}\s*/gm, '').replace(/\n{3,}/g, '\n\n').trim();
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const human = (ms) => { const m = Math.round(ms / 60000); return ms >= 3_600_000 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : mmss(ms); };
const LIVE = new Set(['starting', 'ready', 'thinking', 'acting', 'awaiting_approval', 'needs_user', 'queued', 'takeover', 'done']);
const WORKING = new Set(['ready', 'thinking', 'acting']);

/** Tarjeta de aprobación: resuelve true solo si la persona toca «Aprobar». */
export function approvalCard(container, text, detail) {
  return new Promise((resolve) => {
    const done = (v) => { card.querySelectorAll('button').forEach((b) => { b.disabled = true; }); card.classList.add(v ? 'approved' : 'denied'); card.querySelector('.ap-result').textContent = v ? 'Aprobado' : 'Rechazado'; resolve(v); };
    const card = h('div', { class: 'ab-approval ab-form-card', role: 'group', 'aria-label': 'Aprobación requerida' },
      h('div', { class: 'ap-head' }, h('span', { class: 'abf-ic', html: icon('shield') }), h('strong', {}, 'Necesito tu aprobación')),
      h('p', { class: 'ap-what', 'data-no-i18n': '' }, text),
      detail ? h('p', { class: 'ap-why small muted', 'data-no-i18n': '' }, detail) : null,
      h('div', { class: 'abf-row' }, h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: () => done(true) }, h('span', { html: icon('check') }), 'Aprobar'), h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => done(false) }, 'Rechazar'), h('span', { class: 'ap-result small muted', 'aria-live': 'polite' })));
    container.append(card);
    card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

const STATUS_TEXT = {
  starting: 'Encendiendo el ordenador virtual', ready: 'Trabajando', thinking: 'Pensando el siguiente paso', acting: 'Trabajando',
  awaiting_approval: 'Esperando tu aprobación', needs_user: 'Necesita tu acción', queued: 'En fila', takeover: 'Tenés el control', done: 'Tarea terminada', ended: 'Sesión cerrada', error: 'No disponible'
};

/** Puntero propio (flecha redondeada con borde claro y punto de acento). */
const CURSOR_SVG = '<svg viewBox="0 0 28 28" width="26" height="26" aria-hidden="true"><path d="M5 3.2 22.4 13.6l-7.3 1.7 4.2 7.6-3.3 1.8-4.2-7.6-5.6 5.1z" fill="#16151a" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/><circle cx="5" cy="3.2" r="1.9" fill="#9fff00"/></svg>';
const clampN = (n, a, b) => Math.min(b, Math.max(a, n));
const pause = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

export class AgentBrowserCard {
  /**
   * @param {{ thread: HTMLElement, composer: HTMLElement, text: string, conv?: string, lang?: string, isPaid?: boolean,
   *   idToken?: () => Promise<string|null>, onScroll?: () => void, onFiles?: (files: {name:string,mime:string,content:string}[]) => void }} o
   */
  constructor(o) {
    this.o = o;
    this.goal = String(o.text || '').trim();
    // «…en el ordenador» / «usá el ordenador»: se abre el navegador en la nube desde el primer paso (vista en vivo).
    this.explicit = wantsComputer(this.goal);
    this.url = guessUrl(this.goal) || (this.explicit ? computerStartUrl(this.goal) : null);
    this.state = null;
    this.timer = 0; this.tick = 0;
    this.stopped = false; this.stepping = false; this.approving = false; this.askKey = '';
    this.fileSeen = new Map();
    // Puntero y pantalla en vivo: eventos ya mostrados, cola de animaciones, captura mostrada / recibida, conexión.
    this.seen = null; this.lastSeq = 0; this.evq = []; this.animating = false; this.pendingFrame = null;
    this.shownAt = 0; this.haveAt = 0; this.skew = 0; this.posY = 0; this.netFails = 0; this.polling = false;
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.device = window.matchMedia('(max-width: 700px)').matches ? 'mobile' : 'desktop';
    this.build();
    this.start();
  }

  build() {
    this.pill = h('span', { class: 'ab-pill' }, h('span', { class: 'ab-dot' }), h('span', { class: 'ab-pill-text' }, 'Encendiendo la computadora'));
    this.clock = h('span', { class: 'ab-clock', title: 'Tiempo de navegador real', hidden: true }, h('span', { html: icon('clock') }), h('b', { 'data-no-i18n': '' }, ''));
    this.fullBtn = h('button', { class: 'ab-btn', type: 'button', 'aria-label': 'Achicar', title: 'Achicar', html: icon('collapse'), onclick: () => this.toggleFull(false) });
    this.stopBtn = h('button', { class: 'ab-btn ab-stop', type: 'button', 'aria-label': 'Detener', title: 'Detener', html: icon('stop'), onclick: () => this.stop() });
    this.modeBar = h('div', { class: 'ab-mode', hidden: true });
    this.view = h('div', { class: 'ab-view' }, this.loader());
    this.addr = h('div', { class: 'ab-addr', hidden: true }, h('span', { html: icon('lock') }), h('span', { class: 'ab-addr-t', 'data-no-i18n': '' }, ''));
    this.planBox = h('div', { class: 'ab-plan', hidden: true });
    this.timeline = h('ol', { class: 'ab-steps' });
    this.stepsBox = h('details', { class: 'ab-timeline', hidden: true, open: true }, h('summary', {}, 'Pasos'), this.timeline);
    this.notice = h('div', { class: 'ab-notice', hidden: true });
    this.approvals = h('div', { class: 'ab-approvals' });
    this.asks = h('div', { class: 'ab-asks' });
    this.filesBox = h('div', { class: 'ab-files', hidden: true });
    this.result = h('div', { class: 'ab-result', hidden: true });
    this.takeBtn = h('button', { class: 'ab-tbtn', type: 'button', onclick: () => this.setTakeover(!(this.state && this.state.status === 'takeover')) }, h('span', { html: icon('keyboard') }), h('span', { class: 'ab-tbtn-t' }, 'Tomar el control'));
    this.toolsBtn = h('details', { class: 'ab-tools' }, h('summary', { class: 'ab-tbtn' }, h('span', { html: icon('download') }), 'Guardar'),
      h('div', { class: 'ab-tools-m' },
        h('button', { type: 'button', onclick: () => this.capture('page') }, h('span', { html: icon('file') }), 'Texto de la página'),
        h('button', { type: 'button', onclick: () => this.capture('screenshot') }, h('span', { html: icon('image') }), 'Captura de pantalla'),
        h('button', { type: 'button', onclick: () => this.capture('pdf') }, h('span', { html: icon('print') }), 'PDF de la página')));
    this.controls = h('div', { class: 'ab-controls', hidden: true }, this.takeBtn, this.toolsBtn,
      h('button', { class: 'ab-tbtn ab-tbtn-stop', type: 'button', onclick: () => this.stop() }, h('span', { html: icon('stop') }), 'Detener'));
    this.kb = this.keyboardBar();
    // Pantalla en vivo: tocarla abre la vista completa (con «Tomar el control»). La ✕ detiene al agente.
    this.badge = h('span', { class: 'cc-badge', 'data-no-i18n': '' }, 'Modo lectura');
    this.screen = h('div', { class: 'cc-screen', role: 'button', tabindex: '0', 'aria-label': 'Ver el ordenador virtual en pantalla completa' },
      this.view, this.badge, h('span', { class: 'cc-zoom', 'aria-hidden': 'true', html: icon('expand') }));
    this.screen.addEventListener('click', (e) => { if (!this.el.classList.contains('is-full')) { e.preventDefault(); this.toggleFull(true); } });
    this.screen.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !this.el.classList.contains('is-full') && e.target === this.screen) { e.preventDefault(); this.toggleFull(true); } });
    this.xBtn = h('button', { class: 'cc-x', type: 'button', 'aria-label': 'Detener al agente', title: 'Detener', html: icon('close'), onclick: (e) => { e.stopPropagation(); this.stop(); } });
    this.lineText = h('span', { class: 'cc-text', 'data-no-i18n': '' }, 'Encendiendo el ordenador virtual…');
    this.line = h('div', { class: 'cc-line', role: 'status', 'aria-live': 'polite' }, h('span', { class: 'cc-dot', 'aria-hidden': 'true' }), this.lineText, this.clock);
    this.modeNote = h('p', { class: 'cc-note', hidden: true });
    this.sum = h('div', { class: 'cc-sum', hidden: true });
    this.head = h('header', { class: 'ab-head' }, h('span', { class: 'ab-title', html: icon('monitor') + '<span>' + VPC_NAME + '</span>' }), this.pill, h('span', { class: 'ab-actions' }, this.fullBtn, this.stopBtn));
    this.buildWindow();
    this.buildDesktop();
    this.el = h('section', { class: 'ab-card cc vpc vpc-os', 'aria-label': VPC_NAME, 'data-status': 'starting' },
      this.head, this.desk, this.task, this.help,
      this.modeNote, this.miniSteps, this.foot, this.sum,
      this.modeBar, this.addr, this.kb, this.controls, this.notice, this.asks, this.approvals, this.planBox, this.stepsBox, this.filesBox, this.result);
    this.o.thread.append(this.el);
    this.o.onScroll && this.o.onScroll();
  }

  /** Ventana tipo escritorio remoto: barra de título (tiempo, ayuda, plegar, pantalla completa, Detener) y dirección. */
  buildWindow() {
    const hid = 'vpc-help-' + Math.random().toString(36).slice(2, 8);
    this.elapsed = h('span', { class: 'vpc-time', title: 'Tiempo de la tarea' }, h('span', { html: icon('clock') }), h('b', { 'data-no-i18n': '', 'aria-label': 'Tiempo de la tarea' }, '0:00'));
    this.helpBtn = h('button', { class: 'vpc-btn', type: 'button', 'aria-label': '¿Qué es el ordenador virtual?', title: '¿Qué es?', 'aria-expanded': 'false', 'aria-controls': hid, html: icon('info'), onclick: () => this.toggleHelp() });
    this.foldBtn = h('button', { class: 'vpc-btn', type: 'button', 'aria-label': 'Plegar', title: 'Plegar', 'aria-expanded': 'true', html: icon('collapse'), onclick: () => this.toggleFold() });
    this.maxBtn = h('button', { class: 'vpc-btn', type: 'button', 'aria-label': 'Pantalla completa', title: 'Pantalla completa', html: icon('expand'), onclick: () => this.toggleFull() });
    this.vStop = h('button', { class: 'vpc-btn vpc-stop', type: 'button', 'aria-label': 'Detener', title: 'Detener', onclick: () => this.stop() }, h('span', { html: icon('stop') }), h('span', { class: 'vpc-stop-t' }, 'Detener'));
    // Barra de título de la ventana del navegador: pestaña con el sitio actual y controles propios (plegar, pantalla
    // completa, Detener). Sin formas ni íconos de otros sistemas operativos.
    this.tabIc = h('i', { class: 'vpc-tab-ic', 'aria-hidden': 'true' }, '·');
    this.tabText = h('strong', { class: 'vpc-tab-t', 'data-no-i18n': '' }, VPC_NAME);
    this.bar = h('header', { class: 'vpc-bar' },
      h('span', { class: 'vpc-app', 'aria-hidden': 'true', html: icon('globe') }),
      h('span', { class: 'vpc-title vpc-tab' }, this.tabIc, this.tabText),
      h('span', { class: 'vpc-acts' }, this.helpBtn, this.foldBtn, this.maxBtn, this.vStop));
    this.addrText = h('span', { class: 'vpc-url', 'data-no-i18n': '' }, this.url || 'Preparando…');
    this.modeTag = h('span', { class: 'vpc-mode' }, 'Lectura');
    this.load = h('i', { class: 'vpc-load', 'aria-hidden': 'true' });
    this.vAddr = h('div', { class: 'vpc-addr', role: 'group', 'aria-label': 'Dirección actual' }, h('span', { class: 'vpc-lock', html: icon('lock') }), this.addrText, this.modeTag, this.load);
    this.help = h('p', { class: 'vpc-help', id: hid, hidden: true }, VPC_HELP);
    this.miniSteps = h('ol', { class: 'vpc-steps', 'aria-label': 'Pasos', hidden: true });
    this.quota = h('span', { class: 'vpc-quota', 'aria-live': 'polite' }, '');
    this.logoutBtn = h('button', { class: 'vpc-link', type: 'button', hidden: true, onclick: () => this.logoutSessions() }, h('span', { html: icon('logout') }), h('span', { class: 'vpc-link-t' }, 'Cerrar sesiones'));
    this.foot = h('div', { class: 'vpc-foot' }, this.quota, this.logoutBtn);
  }

  /**
   * Escritorio propio del ordenador virtual: fondo, accesos (Navegador, Archivos, Pasos, Ayuda), la ventana del
   * navegador y la barra de tareas (inicio, ventana abierta, estado en vivo, conexión, tiempo y reloj local).
   * El puntero vive en una capa sobre la captura y solo se mueve con acciones reales (ver onPointer).
   */
  buildDesktop() {
    this.cursor = h('span', { class: 'vpc-cursor', html: CURSOR_SVG });
    this.field = h('span', { class: 'vpc-field' }, h('i', { class: 'vpc-caret' }));
    this.bubble = h('span', { class: 'vpc-bubble', 'data-no-i18n': '' });
    this.scrollChip = h('span', { class: 'vpc-scroll' }, h('i', { class: 'vpc-wheel' }), h('b', { 'data-no-i18n': '' }));
    this.ptr = h('div', { class: 'vpc-ptr', 'aria-hidden': 'true' }, this.field, this.scrollChip, this.cursor, this.bubble);
    // Texto alternativo del paso actual para lectores de pantalla (lo mismo que dice el globo del puntero).
    this.ptrLive = h('span', { class: 'sr-only', 'aria-live': 'polite', 'data-no-i18n': '' });
    this.screen.append(this.ptr, this.ptrLive);
    const ico = (ic, label, on) => h('button', { class: 'vpc-ico', type: 'button', onclick: on }, h('span', { class: 'vpc-ico-g', html: icon(ic) }), h('span', { class: 'vpc-ico-t' }, label));
    this.icoFiles = ico('folder', 'Archivos', () => this.openPanel(this.filesBox));
    this.icoFiles.hidden = true;
    this.icons = h('nav', { class: 'vpc-icons', 'aria-label': 'Accesos del escritorio' },
      ico('globe', 'Navegador', () => this.toggleFull(true)), this.icoFiles,
      ico('check', 'Pasos', () => this.openPanel(this.stepsBox)), ico('info', 'Ayuda', () => this.toggleHelp(true)));
    this.win = h('div', { class: 'vpc-win' }, this.bar, this.vAddr, h('div', { class: 'cc-frame' }, this.screen, this.xBtn));
    this.desk = h('div', { class: 'vpc-desk' }, h('div', { class: 'vpc-wall', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), this.icons, this.win);
    this.clockT = h('time', { class: 'vpc-clock-t', 'data-no-i18n': '' }, '');
    this.net = h('span', { class: 'vpc-net', 'data-state': 'ok', role: 'img', 'aria-label': 'Conexión estable', title: 'Conexión estable' }, h('i'), h('i'), h('i'));
    this.startBtn = h('button', { class: 'vpc-start', type: 'button', 'aria-label': '¿Qué es el ordenador virtual?', title: '¿Qué es?', 'aria-expanded': 'false', 'aria-controls': this.help.id, onclick: () => this.toggleHelp() },
      h('span', { class: 'vpc-orb', 'aria-hidden': 'true' }, h('i'), h('i')));
    this.taskWin = h('button', { class: 'vpc-twin', type: 'button', 'aria-label': 'Ventana del navegador: pantalla completa', onclick: () => this.toggleFull() }, h('span', { html: icon('globe') }), h('span', { class: 'vpc-twin-t', 'data-no-i18n': '' }, 'Navegador'));
    this.task = h('footer', { class: 'vpc-task' }, this.startBtn, this.taskWin, this.line,
      h('span', { class: 'vpc-tray' }, this.net, this.elapsed, h('span', { class: 'vpc-clock', title: 'Hora local' }, this.clockT)));
    this.renderTaskClock();
    // La capa del puntero sigue a la pantalla si cambia de tamaño (girar el celular, pantalla completa).
    if (typeof ResizeObserver === 'function') { this._ro = new ResizeObserver(() => { this.ptr.classList.remove('has-bubble'); this.placeCursor(); }); this._ro.observe(this.screen); }
    this._online = () => this.kick();
    this._vis = () => { if (!document.hidden) this.kick(); };
    window.addEventListener('online', this._online);
    document.addEventListener('visibilitychange', this._vis);
  }

  /** Abre la pantalla completa y lleva a un panel (Archivos, Pasos). */
  openPanel(el) {
    this.toggleFull(true);
    if (!el || el.hidden) return;
    if (el.tagName === 'DETAILS') el.open = true;
    setTimeout(() => { el.scrollIntoView({ block: 'start', behavior: this.reduced ? 'auto' : 'smooth' }); const f = el.querySelector('summary, button, a'); if (f) f.focus({ preventScroll: true }); }, 60);
  }

  /** Reloj de la barra de tareas (hora local de la persona). */
  renderTaskClock() {
    if (!this.clockT) return;
    const d = new Date(Date.now() + (this.skew || 0));
    const t = d.toLocaleTimeString(this.o.lang || 'es', { hour: '2-digit', minute: '2-digit' });
    if (this.clockT.textContent !== t) { this.clockT.textContent = t; this.clockT.dateTime = d.toISOString(); }
  }

  /** Pestaña de la ventana: título de la página (o el sitio) y su inicial. */
  renderTab(s) {
    const hst = s.host || host(s.url || '') || (s.reader && s.reader.host) || '';
    const title = String((s.mode === 'browser' ? s.title : s.reader && s.reader.title) || '').replace(/^\s*(null|undefined)\s*$/i, '').trim();
    this.tabText.textContent = title || hst || VPC_NAME;
    this.tabText.title = title && hst ? `${title} · ${hst}` : title || hst;
    this.tabIc.textContent = (hst || 'o').charAt(0).toUpperCase();
    this.taskWin.querySelector('.vpc-twin-t').textContent = hst || 'Navegador';
    this.icoFiles.hidden = !(s.files || []).length;
    const n = (s.files || []).length;
    this.icoFiles.querySelector('.vpc-ico-t').textContent = n ? `Archivos (${n})` : 'Archivos';
  }

  /** Estado de la conexión con el servidor (barra de tareas). */
  setNet(state) {
    if (!this.net || this.net.dataset.state === state) return;
    const t = state === 'ok' ? 'Conexión estable' : state === 'retry' ? 'Reconectando…' : 'Sin conexión';
    this.net.dataset.state = state; this.net.setAttribute('aria-label', t); this.net.title = t;
  }

  /* ---------- Pantalla en vivo: capturas sin parpadeo ---------- */

  /** Nueva captura: se decodifica antes de mostrarla y espera a que el puntero termine sobre la anterior. */
  setFrame(src, at) {
    if (!src || !this.img) return;
    if (at && (at === this.shownAt || (this.pendingFrame && this.pendingFrame.at === at))) return;
    if (!at && this.img.getAttribute('src') === src) return;
    this.haveAt = Math.max(this.haveAt, at || 0);
    this.pendingFrame = { src, at: at || 0 };
    if (!this.animating) this.flushFrame();
  }

  async flushFrame() {
    const f = this.pendingFrame;
    if (!f || !this.img) return;
    this.pendingFrame = null;
    try { const im = new Image(); im.src = f.src; if (im.decode) await im.decode(); } catch { /* se muestra igual */ }
    if (f.at && f.at < this.shownAt) return;   // llegó una más nueva mientras se decodificaba
    this.img.src = f.src; this.shownAt = f.at;
    this.view.classList.add('has-frame');
  }

  /* ---------- Puntero: solo acciones reales ---------- */

  /** Eventos del servidor (pointer.ts): nuevos o que cambiaron de estado → cola de animación en orden. */
  onPointer(s) {
    const evs = Array.isArray(s.pointer) ? s.pointer : [];
    if (this.seen && evs.length && evs[evs.length - 1].seq < this.lastSeq) this.seen = null;   // sesión nueva en el servidor
    if (!this.seen) {   // lo anterior a abrir esta tarjeta no se anima
      this.seen = new Map(evs.map((e) => [e.seq, e.status]));
      this.lastSeq = evs.reduce((m, e) => Math.max(m, e.seq), 0);
      return;
    }
    const fresh = newEvents(evs, this.lastSeq), changed = changedEvents(evs, this.seen);
    if (!fresh.length && !changed.length) return;
    for (const e of [...changed, ...fresh]) this.seen.set(e.seq, e.status);
    if (fresh.length) this.lastSeq = fresh[fresh.length - 1].seq;
    for (const k of this.seen.keys()) if (k < this.lastSeq - 40) this.seen.delete(k);
    this.evq.push(...[...changed, ...fresh].sort((a, b) => a.seq - b.seq));
    if (this.evq.length > 6) this.evq = this.evq.slice(-6);   // si quedó atrás, muestra lo último
    if (!this.animating) this.drain();
  }

  async drain() {
    this.animating = true;
    try {
      while (this.evq.length) {
        const ev = this.evq.shift();
        try { await this.animate(ev, this.evq.length > 2); } catch { /* sigue con el próximo */ }
      }
    } finally { this.animating = false; }
    this.flushFrame();
  }

  /** Geometría de la captura dentro de la capa del puntero (object-fit/position reales). */
  geom() {
    const img = this.img;
    if (!img || !this.ptr) return null;
    const r = img.getBoundingClientRect(), pr = this.ptr.getBoundingClientRect();
    if (!r.width || !r.height || !pr.width) return null;
    const vp = (this.state && this.state.viewport) || { width: 1024, height: 640 };
    const nat = { w: img.naturalWidth || vp.width, h: img.naturalHeight || vp.height };
    const cs = getComputedStyle(img);
    const fit = cs.objectFit === 'cover' ? 'cover' : 'contain';
    const imgBox = { w: r.width, h: r.height };
    const rect = fitRect(nat, imgBox, fit, parsePosY(cs.objectPosition));
    rect.left += r.left - pr.left; rect.top += r.top - pr.top;
    return { rect, box: { w: pr.width, h: pr.height }, nat, fit, imgBox };
  }

  /** Celular (captura recortada): mueve la «cámara» para que el objetivo quede a la vista. */
  async follow(y, g) {
    const py = followY(y, g.nat, g.imgBox);
    if (Math.abs(py - this.posY) < 0.01) return;
    this.posY = py;
    this.img.style.objectPosition = `50% ${Math.round(py * 1000) / 10}%`;
    await pause(this.reduced ? 0 : 380);
  }

  placeCursor() {
    if (!this.cursorAt || !this.cursorShown) return;
    const g = this.geom(); if (!g) return;
    const p = toView(this.cursorAt, g.rect, g.box);
    this.cursor.style.transitionDuration = '0ms';
    this.cursor.style.transform = `translate(${p.x}px, ${p.y}px)`;
    this.cx = p.x; this.cy = p.y;
    this.ptr.classList.toggle('has-cursor', p.visible);
    if (this.fieldBox && this.field.classList.contains('on')) this.placeField(this.fieldBox, g);
  }

  async moveCursor(pt, p, quick) {
    const dur = this.reduced || quick || !this.cursorShown ? 0 : travelMs(p.x - (this.cx || 0), p.y - (this.cy || 0));
    this.cursor.style.transitionDuration = dur + 'ms';
    this.cursor.style.transform = `translate(${p.x}px, ${p.y}px)`;
    this.cx = p.x; this.cy = p.y; this.cursorAt = { x: pt.x, y: pt.y }; this.cursorShown = true;
    this.ptr.classList.add('has-cursor');
    await pause(dur);
  }

  placeField(b, g) {
    const r = g.rect;
    Object.assign(this.field.style, { left: `${r.left + b.x * r.width - 3}px`, top: `${r.top + b.y * r.height - 3}px`, width: `${b.w * r.width + 6}px`, height: `${b.h * r.height + 6}px` });
  }

  showBubble(text, p, g) {
    if (!text) return;
    this.bubble.textContent = text;
    this.ptr.classList.add('has-bubble');
    const w = this.bubble.offsetWidth || 160, hh = this.bubble.offsetHeight || 28;
    const bw = g ? g.box.w : this.ptr.clientWidth, bh = g ? g.box.h : this.ptr.clientHeight;
    const x = p ? clampN(p.x + 16, 6, Math.max(6, bw - w - 6)) : 10;
    const y = p ? (p.y + 30 + hh < bh ? p.y + 30 : Math.max(6, p.y - hh - 12)) : Math.max(6, bh - hh - 10);
    this.bubble.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    clearTimeout(this._bubbleT);
    this._bubbleT = setTimeout(() => this.ptr.classList.remove('has-bubble'), 2600);
  }

  ring(p, cls = '') {
    const r = h('i', { class: 'vpc-ring ' + cls, style: `left:${p.x}px;top:${p.y}px` });
    this.ptr.append(r);
    setTimeout(() => r.remove(), 700);
  }

  /** Imagen: texto alternativo con el sitio y el paso actual. */
  setAlt(text) {
    if (!this.img) return;
    const hst = (this.state && (this.state.host || host(this.state.url || ''))) || '';
    this.img.alt = `Pantalla del ordenador virtual${hst ? ' en ' + hst : ''}${text ? '. Ahora: ' + text : ''}`;
  }

  /**
   * Muestra UN evento real: globo y texto alternativo siempre; el puntero solo si hay coordenadas medidas sobre la
   * captura que se ve (eventFits). Clic: viaje + presión mientras corre + onda al terminar. Escribir: campo
   * resaltado con cursor de texto. Desplazamiento: indicador con la dirección. Navegación: barra de carga.
   */
  async animate(ev, quick = false) {
    const text = pointerText(ev);
    if (text) { this.ptrLive.textContent = text; this.setAlt(text); }
    if (ev.frame && this.pendingFrame && this.pendingFrame.at === ev.frame) await this.flushFrame();
    const browser = this.state && this.state.mode === 'browser';
    if (ev.kind === 'goto' || ev.kind === 'back') {
      this.load.classList.toggle('on', ev.status === 'running');
      if (ev.status !== 'running') { this.field.classList.remove('on'); }
      this.showBubble(text, null, null);
      return;
    }
    if (ev.kind === 'scroll') {
      this.scrollChip.querySelector('b').textContent = text;
      this.scrollChip.dataset.dir = Number(ev.dy) > 0 ? 'down' : 'up';
      this.scrollChip.classList.remove('on'); void this.scrollChip.offsetWidth; this.scrollChip.classList.add('on');
      clearTimeout(this._scrollT); this._scrollT = setTimeout(() => this.scrollChip.classList.remove('on'), 1400);
      if (ev.status !== 'running') { this.field.classList.remove('on'); await pause(quick || this.reduced ? 0 : 450); }
      return;
    }
    const g0 = browser && eventFits(ev, this.shownAt) ? this.geom() : null;
    if (!g0) { if (ev.status === 'error') this.cursor.classList.remove('is-press'); this.showBubble(text, null, null); return; }
    let g = g0, p = toView(ev, g.rect, g.box);
    if (!p.visible && g.fit === 'cover') { await this.follow(ev.y, g); g = this.geom() || g; p = toView(ev, g.rect, g.box); }
    if (!p.visible) { this.showBubble(text, null, null); return; }
    const already = this.cursorAt && Math.abs(this.cursorAt.x - ev.x) < 0.002 && Math.abs(this.cursorAt.y - ev.y) < 0.002;
    if (!already) await this.moveCursor(ev, p, quick || ev.by === 'user');
    this.showBubble(text, p, g);
    if (ev.kind === 'click') {
      this.cursor.classList.toggle('is-press', ev.status === 'running');
      if (ev.status === 'done') { this.ring(p, ev.by === 'user' ? 'is-user' : ''); await pause(quick || this.reduced ? 0 : 560); }   // la onda termina antes de mostrar la página nueva
    } else if (ev.kind === 'type') {
      if (ev.box) { this.fieldBox = ev.box; this.placeField(ev.box, g); }
      this.field.classList.toggle('on', !!ev.box && ev.status !== 'error');
      this.field.classList.toggle('is-typing', ev.status === 'running');
      this.field.classList.toggle('is-done', ev.status === 'done');
      if (ev.status === 'done') { clearTimeout(this._fieldT); this._fieldT = setTimeout(() => this.field.classList.remove('on', 'is-done'), 1400); await pause(quick || this.reduced ? 0 : 260); }
    } else if (ev.kind === 'key') {
      if (ev.status === 'done') { this.ring(p, 'is-key'); await pause(quick || this.reduced ? 0 : 220); }
    }
  }

  /** Sin tarea activa: se apagan los indicadores en curso (el puntero queda donde estuvo el último clic real). */
  calmPointer() {
    this.cursor.classList.remove('is-press');
    this.field.classList.remove('is-typing');
    this.load.classList.remove('on');
  }

  toggleHelp(force) {
    const on = typeof force === 'boolean' ? force : this.help.hidden;
    this.help.hidden = !on;
    this.helpBtn.setAttribute('aria-expanded', String(on));
    if (this.startBtn) this.startBtn.setAttribute('aria-expanded', String(on));
  }

  toggleFold(force) {
    const fold = typeof force === 'boolean' ? force : !this.el.classList.contains('is-folded');
    this.el.classList.toggle('is-folded', fold);
    this.foldBtn.setAttribute('aria-expanded', String(!fold));
    this.foldBtn.setAttribute('aria-label', fold ? 'Desplegar' : 'Plegar');
    this.foldBtn.title = fold ? 'Desplegar' : 'Plegar';
    this.foldBtn.innerHTML = icon(fold ? 'expand' : 'collapse');
    this.o.onScroll && this.o.onScroll();
  }

  /** Barra de dirección, modo, pasos cortos, tiempo, cupo y sesiones guardadas. */
  renderWindow(s) {
    const addr = addressText(s);
    this.addrText.textContent = addr || (s.mode === 'browser' ? 'Página en blanco' : 'Sin página abierta todavía');
    this.addrText.title = addr;
    const browser = s.mode === 'browser';
    this.modeTag.textContent = browser ? 'En vivo' : 'Lectura';
    this.modeTag.classList.toggle('is-live', browser);
    this.modeTag.title = browser ? 'Navegador en la nube abierto' : 'Leo la página como texto (no gasta minutos)';
    const steps = (s.steps || []).slice(-3);
    this.miniSteps.hidden = !steps.length;
    this.miniSteps.replaceChildren(...steps.map((x) => h('li', { class: 'st-' + x.status }, h('span', { class: 'st-ic', 'aria-hidden': 'true' }), h('span', { 'data-no-i18n': '' }, x.label))));
    this.quota.textContent = quotaText(s);
    const hosts = Array.isArray(s.jarHosts) ? s.jarHosts : [];
    this.logoutBtn.hidden = !hosts.length;
    if (hosts.length) { this.logoutBtn.title = 'Sesiones guardadas (cifradas): ' + hosts.join(', '); this.logoutBtn.querySelector('.vpc-link-t').textContent = `Cerrar sesiones (${hosts.length})`; }
    this.renderElapsed();
  }

  renderElapsed() {
    const b = this.elapsed && this.elapsed.querySelector('b');
    if (b) b.textContent = elapsedText(taskElapsed(this.state, Date.now() + this.skew));
  }

  /** «Cerrar sesiones»: borra las cookies guardadas (cifradas) de los sitios. Pide un segundo toque para confirmar. */
  async logoutSessions() {
    const t = this.logoutBtn.querySelector('.vpc-link-t');
    if (!this._logoutArm) { this._logoutArm = true; t.textContent = '¿Cerrar todas? Tocá de nuevo'; setTimeout(() => { if (this._logoutArm) { this._logoutArm = false; if (this.state) this.renderWindow(this.state); } }, 4000); return; }
    this._logoutArm = false;
    this.logoutBtn.disabled = true;
    try {
      const s = await this.api('/api/agent/browser/logout', { body: {} });
      if (s && s.status && s.status !== 'none') this.apply(s);
      if (this.state) this.state.jarHosts = [];
      this.logoutBtn.hidden = true;
      this.showNotice('Listo: cerré tus sesiones guardadas. La próxima vez cada sitio te va a pedir iniciar sesión de nuevo.', 'info');
    } catch { this.showNotice('No pude cerrar las sesiones. Probá de nuevo en un momento.', 'warn'); }
    finally { this.logoutBtn.disabled = false; }
  }

  /** Línea única de estado y nota del modo (navegador real / modo lectura). */
  renderLine(s) {
    const st = statusLine(s);
    this.lineText.textContent = st.text;
    this.line.dataset.kind = st.kind;
    const wm = workMode(s);
    this.badge.textContent = wm.label;
    this.badge.classList.toggle('is-browser', s && s.mode === 'browser');
    const showNote = !!wm.note && s && s.mode !== 'browser' && !['done', 'ended'].includes(s.status) && /Sin minutos/.test(wm.note);
    this.modeNote.hidden = !showNote;
    if (showNote) this.modeNote.textContent = wm.note;
  }

  /** Al terminar, la tarjeta se pliega en un resumen: qué hizo (pasos) y dónde (sitios). */
  renderSummary(s, ended = false) {
    const sites = visitedSites(s);
    const steps = workSteps(s);
    const did = whatIDid(s);
    const meta = summaryMeta(s);
    this.el.classList.toggle('is-done', !ended);
    this.el.classList.toggle('is-ended', ended);
    const resume = ended && s.canResume !== false ? h('button', { class: 'cc-act', type: 'button', onclick: () => this.resume() }, h('span', { html: icon('refresh') }), 'Retomar') : null;
    const again = h('button', { class: 'cc-act', type: 'button', onclick: () => this.toggleFull(true) }, h('span', { html: icon('monitor') }), 'Ver la pantalla');
    this.sum.hidden = false;
    this.sum.replaceChildren(...[
      h('div', { class: 'cc-sum-h' },
        h('span', { class: 'cc-sum-ic' + (ended ? ' off' : ''), html: icon(ended ? 'power' : 'check') }),
        h('span', { class: 'cc-sum-t' }, h('strong', {}, ended ? (s.endedReason === 'idle' ? 'La archivé por inactividad' : s.endedReason === 'detached' ? 'Pasé a tu nuevo pedido' : 'Detuviste al agente') : 'Listo'), h('small', { 'data-no-i18n': '' }, meta + (s.mode === 'browser' || (s.browserMs || 0) > 0 ? ' · navegador real' : ' · modo lectura')))),
      !ended && s.summary ? h('p', { class: 'cc-sum-p', 'data-no-i18n': '' }, s.summary) : null,
      sites.length ? h('div', { class: 'cc-sites', 'aria-label': 'Sitios visitados' }, ...sites.map((x) => h('span', { class: 'cc-site', 'data-no-i18n': '' }, h('i', { 'aria-hidden': 'true' }, x.charAt(0).toUpperCase()), x))) : null,
      did.length ? h('div', { class: 'cc-did' }, h('strong', { class: 'cc-did-h' }, 'Qué hice'),
        h('ol', {}, ...did.slice(-12).map((x) => h('li', { class: x.ok ? 'ok' : 'err' }, h('span', { class: 'cc-did-ic', 'aria-hidden': 'true', html: icon(x.ok ? 'check' : 'close') }), h('span', { 'data-no-i18n': '' }, x.label), x.ok ? null : h('span', { class: 'sr-only' }, ' (no salió)')))),
        did.length > 12 ? h('small', { class: 'muted' }, `y ${did.length - 12} pasos antes`) : null) : null,
      steps.length && !did.length ? h('p', { class: 'cc-hint muted' }, 'No llegué a completar ningún paso.') : null,
      (s.sources || []).length && !ended ? h('div', { class: 'cc-srcs' }, h('small', { class: 'muted' }, 'Fuentes'), ...(s.sources || []).slice(0, 6).map((x, i) => h('a', { href: x.url, target: '_blank', rel: 'noopener noreferrer', 'data-no-i18n': '' }, `${i + 1}. ${x.title || host(x.url)}`))) : null,
      h('div', { class: 'cc-sum-acts' }, resume, this.state && (this.img && this.img.src || this.state.reader) ? again : null),
      !ended ? h('small', { class: 'cc-hint muted' }, 'Podés seguir acá: por ejemplo «ahora compará…» o «pasalo a una tabla».') : null].filter(Boolean));
  }

  loader(text = 'Encendiendo el ordenador virtual') {
    return h('div', { class: 'ab-loader' }, h('div', { class: 'ab-orbit', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), h('p', {}, text), this.url ? h('small', { 'data-no-i18n': '' }, host(this.url)) : null);
  }

  /** Barra del modo «tomar el control»: lo que escribís va directo a la página y no se guarda. */
  keyboardBar() {
    const input = h('input', { class: 'ab-kb-in', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'send', 'aria-label': 'Escribir en la página', placeholder: 'Escribí acá y tocá Enviar' });
    const pw = h('button', { class: 'ab-kb-eye', type: 'button', 'aria-label': 'Ocultar lo que escribo', html: icon('eye'), onclick: () => { input.type = input.type === 'password' ? 'text' : 'password'; } });
    const send = async (withEnter) => { const v = input.value; input.value = ''; if (v) await this.input({ kind: 'type', text: v }); if (withEnter) await this.input({ kind: 'key', key: 'Enter' }); input.focus({ preventScroll: true }); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(false); } });
    const key = (k, label, ic) => h('button', { class: 'ab-key', type: 'button', 'aria-label': label, title: label, html: ic ? icon(ic) : '', onclick: () => this.input({ kind: 'key', key: k }) }, ic ? null : label);
    return h('div', { class: 'ab-kb', hidden: true },
      h('p', { class: 'ab-kb-tip' }, h('span', { html: icon('lock') }), 'Tocá la pantalla para elegir un campo y escribí. Lo que escribís va directo a la página: no lo guardamos ni lo ve el agente.'),
      h('div', { class: 'ab-kb-row' }, input, pw, h('button', { class: 'btn btn-sm btn-primary ab-kb-send', type: 'button', onclick: () => send(false) }, 'Enviar')),
      h('div', { class: 'ab-kb-keys' }, key('Enter', 'Enter'), key('Tab', 'Tab'), key('Backspace', 'Borrar'),
        h('button', { class: 'ab-key', type: 'button', 'aria-label': 'Subir', title: 'Subir', html: icon('send'), onclick: () => this.input({ kind: 'scroll', dy: -500 }) }),
        h('button', { class: 'ab-key ab-key-down', type: 'button', 'aria-label': 'Bajar', title: 'Bajar', html: icon('send'), onclick: () => this.input({ kind: 'scroll', dy: 500 }) })));
  }

  setPill(text, kind = 'run') { this.pill.dataset.kind = kind; this.pill.querySelector('.ab-pill-text').textContent = text; }

  async api(path, { method = 'POST', body } = {}) {
    const headers = {};
    // `since`: la captura que ya tenemos; si no cambió, el servidor responde sin imagen (menos datos por consulta).
    if (this.haveAt && method !== 'GET' && body && typeof body === 'object' && !('since' in body)) body = { ...body, since: this.haveAt };
    if (method !== 'GET') headers['Content-Type'] = 'application/json';
    const t = this.o.idToken ? await this.o.idToken().catch(() => null) : null;
    if (t) headers.Authorization = 'Bearer ' + t;
    const r = await fetch(engine.state.base + path, { method, credentials: 'include', headers, body: method !== 'GET' ? JSON.stringify(body || {}) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || 'error'); e.status = r.status; e.code = j.error; e.state = j.state; throw e; }
    return j;
  }

  /** Estado honesto cuando no se puede usar: sin pasos ni capturas simuladas. */
  unavailable(title, text, action) {
    this.setPill('No disponible', 'off');
    this.el.dataset.status = 'error'; this.el.classList.add('is-off');
    this.lineText.textContent = title; this.line.dataset.kind = 'off';
    this.xBtn.hidden = true; this.stopBtn.hidden = true; this.vStop.hidden = true; this.controls.hidden = true; this.clock.hidden = true; this.foot.hidden = true; this.vAddr.hidden = true;
    this.view.replaceChildren(h('div', { class: 'ab-off' }, h('span', { class: 'ab-off-ic', html: icon('monitor') }), h('strong', {}, title), h('p', {}, text), ...(action ? [action] : [])));
  }

  explain(e) {
    const ok = h('button', { class: 'btn btn-sm', type: 'button', onclick: () => this.el.remove() }, 'Entendido');
    if (e.status === 401) return this.unavailable('Ingresá con tu cuenta', 'El ordenador virtual se abre con tu cuenta, así tu sesión es privada y nadie más la ve.', h('a', { class: 'btn btn-sm', href: '/cuenta/' }, 'Ingresar'));
    if (e.status === 503) return this.unavailable('El ordenador virtual no está disponible', 'El servicio está en mantenimiento. No se realizó ninguna acción.', ok);
    if (e.status === 429) return this.unavailable('Hay muchos pedidos en este momento', 'Esperá unos segundos y volvé a pedírmelo. No se realizó ninguna acción.', ok);
    const retry = h('button', { class: 'btn btn-sm', type: 'button', onclick: () => this.restart() }, h('span', { html: icon('refresh') }), 'Reintentar');
    return this.unavailable('No pude encender el ordenador virtual', 'Se cortó la conexión o el servicio tardó demasiado. No se realizó ninguna acción.', retry);
  }

  /** «Reintentar» después de un error al encender: vuelve a la pantalla de carga y prueba otra vez. */
  restart() {
    this.el.classList.remove('is-off'); this.el.dataset.status = 'starting';
    this.xBtn.hidden = false; this.vStop.hidden = false; this.foot.hidden = false; this.vAddr.hidden = false;
    this.view.replaceChildren(this.loader());
    this.lineText.textContent = 'Encendiendo el ordenador virtual…'; this.line.dataset.kind = 'run';
    this.start();
  }

  async start() {
    const [st] = await Promise.all([engine.init(), new Promise((r) => setTimeout(r, 250))]);
    if (this.stopped) return;
    if (!st.live || !st.caps || !st.caps.browser) {
      this.unavailable('El ordenador virtual no está disponible', 'No pude conectarme al servicio. Mientras tanto te guío para que lo hagas vos, sin compartir contraseñas.', h('button', { class: 'btn btn-sm', type: 'button', onclick: () => this.el.remove() }, 'Entendido'));
      return;
    }
    try {
      const s = await this.api('/api/agent/browser/start', { body: { goal: this.goal, url: this.url || undefined, device: this.device, conv: this.o.conv || undefined, lang: this.o.lang || undefined, ...(this.explicit ? { mode: 'browser' } : {}) } });
      this.img = h('img', { class: 'ab-frame', alt: 'Pantalla en vivo del ordenador virtual', decoding: 'async', draggable: 'false' });
      this.img.addEventListener('click', (ev) => this.onScreenClick(ev));
      this.reader = h('div', { class: 'ab-reader' });
      this.view.replaceChildren(this.reader, this.img, h('div', { class: 'ab-scan', 'aria-hidden': 'true' }));
      this.view.classList.add('is-live');
      this.img.alt = 'Pantalla en vivo del ordenador virtual';
      this.view.dataset.device = s.device || this.device;
      this.controls.hidden = false; this.stepsBox.hidden = false;
      this.apply(s);
      this.tick = setInterval(() => { this.renderClock(); this.renderElapsed(); this.renderTaskClock(); }, 1000);
      this.poll();
      this.loop();
    } catch (e) { this.explain(e); }
  }

  /** Bucle autónomo: mientras la sesión esté lista, pide el siguiente paso. Se pausa en aprobaciones, formularios o control manual. */
  async loop() {
    if (this.stepping) return;
    this.stepping = true;
    try {
      while (!this.stopped && this.state && (this.state.status === 'ready' || this.state.status === 'queued') && this.goal) {
        if (this.state.status === 'ready') { this.setPill('Pensando el siguiente paso', 'run'); this.view.classList.add('is-busy'); }
        const s = await this.api('/api/agent/browser/agent', { body: {} });
        if (this.loopFails) { this.loopFails = 0; this.noticeSticky = false; this.notice.hidden = true; this.setNet('ok'); }
        this.apply(s);
        if (s.status === 'queued') await new Promise((r) => setTimeout(r, 4000));
        else await new Promise((r) => setTimeout(r, 120));
      }
    } catch (e) {
      if (e.code === 'no_session' || e.code === 'session_closed') { this.ended(e.state); this.stepping = false; return; }
      // Reconexión: espera creciente (2,5 s → 20 s), más larga si el servidor pidió frenar; sin red, espera a «online».
      this.loopFails = (this.loopFails || 0) + 1;
      const wait = e.status === 429 ? 8000 : Math.min(20_000, 2500 * 2 ** Math.min(3, this.loopFails - 1));
      this.setNet(navigator.onLine === false ? 'off' : 'retry');
      this.showNotice(navigator.onLine === false ? 'Sin conexión a internet. Sigo apenas vuelva.' : 'Se cortó la conexión con el ordenador virtual. Reintentando…', 'warn',
        h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => this.kick(true) }, 'Reintentar ahora'));
      this.noticeSticky = true;
      if (!this.stopped) { clearTimeout(this.loopT); this.loopT = setTimeout(() => { this.stepping = false; this.loop(); }, wait); }
      return;
    } finally { this.view.classList.remove('is-busy'); }
    if (this.loopFails) { this.loopFails = 0; this.noticeSticky = false; this.notice.hidden = true; this.setNet('ok'); }
    this.stepping = false;
  }

  apply(s) {
    if (!s || !s.status) return;
    this.state = s;
    const browser = s.mode === 'browser';
    this.view.classList.toggle('is-reader', !browser);
    this.view.classList.toggle('is-browser', browser);
    if (typeof s.now === 'number') this.skew = s.now - Date.now();   // reloj del servidor (sin desfase del dispositivo)
    if (s.image && this.img && browser) this.setFrame(s.image, s.shotAt);
    if (s.viewport && browser) this.view.style.setProperty('--ab-ar', `${s.viewport.width} / ${s.viewport.height}`);
    if (!browser) this.renderReader(s);
    if (s.url) { this.addr.hidden = false; this.addr.querySelector('.ab-addr-t').textContent = s.host || host(s.url); }
    this.renderMode(s);
    // Estado
    const kind = s.status === 'done' ? 'ok' : s.status === 'awaiting_approval' || s.status === 'needs_user' || s.status === 'queued' ? 'wait' : s.status === 'ended' ? 'off' : s.status === 'takeover' ? 'you' : 'run';
    const label = s.status === 'queued' && s.queue ? `En fila · puesto ${s.queue.position}` : (s.status === 'acting' || s.status === 'ready') && !browser ? 'Leyendo' : STATUS_TEXT[s.status] || s.status;
    this.setPill(label, kind);
    this.el.dataset.status = s.status;
    this.renderLine(s);
    this.renderWindow(s);
    this.renderTab(s);
    if (this.img) { this.onPointer(s); if (!WORKING.has(s.status) || s.status === 'ready') this.calmPointer(); if (!this.animating && !this.ptrLive.textContent) this.setAlt(''); }
    this.vStop.hidden = s.status === 'done' || s.status === 'ended';
    this.renderClock();
    this.renderPlan(s);
    this.renderSteps(s.steps || []);
    // Control manual
    const take = s.status === 'takeover';
    this.kb.hidden = !take;
    this.view.classList.toggle('is-takeover', take);
    this.takeBtn.querySelector('.ab-tbtn-t').textContent = take ? 'Devolver el control' : 'Tomar el control';
    this.takeBtn.classList.toggle('on', take);
    // Tarjetas
    if (s.status === 'awaiting_approval' && s.pending && !this.approving) this.askApproval(s.pending);
    if (s.status === 'needs_user' && s.ask) this.renderAsk(s.ask);
    else if (s.status === 'needs_user' && !s.ask) this.renderAsk({ kind: 'info', message: s.message || 'Necesito tu ayuda para seguir.' });
    else { this.asks.replaceChildren(); this.askKey = ''; }
    // Avisos
    if (s.status === 'queued') this.showNotice(`Todos los navegadores están ocupados: estás en el puesto ${s.queue ? s.queue.position : 1}. Sigo apenas se libere uno.`, 'info');
    // Sin minutos: lo dice la nota corta bajo la línea de estado (cc-note); el aviso largo queda para pantalla completa.
    else if (s.notice === 'light_fallback' && !browser && s.status !== 'done' && this.el.classList.contains('is-full')) this.showNotice('Sigo en modo lectura: hoy ya se usaron los minutos de navegador real. Solo freno si un paso exige hacer clic.', 'info');
    else if (!this.noticeSticky) this.notice.hidden = true;
    this.renderFiles(s.files || []);
    // Resultado
    if (s.status === 'done') this.renderSummary(s);
    else if (s.status !== 'ended') { this.sum.hidden = true; this.el.classList.remove('is-done', 'is-ended'); }
    if (s.status === 'done' && s.summary) {
      this.result.hidden = false;
      this.result.replaceChildren(...[h('div', { class: 'ab-res-h' }, h('span', { html: icon('check') }), h('strong', {}, 'Resultado')), h('p', { class: 'ab-res-t', 'data-no-i18n': '' }, s.summary),
        (s.sources || []).length ? h('div', { class: 'ab-srcs' }, h('small', { class: 'muted' }, 'Fuentes'), ...(s.sources || []).slice(0, 8).map((x, i) => h('a', { href: x.url, target: '_blank', rel: 'noopener noreferrer', 'data-no-i18n': '' }, `${i + 1}. ${x.title || host(x.url)}`))) : null,
        h('small', { class: 'muted' }, 'Podés seguir en esta conversación: por ejemplo «ahora compará…» o «pasalo a una tabla».')].filter(Boolean));
    } else if (s.status !== 'ended') this.result.hidden = true;
    if (s.status === 'ended') this.ended(s);
    this.o.onScroll && this.o.onScroll();
  }

  renderMode(s) {
    this.modeBar.hidden = false;
    const browser = s.mode === 'browser';
    const left = Math.max(s.browserLeftMs || 0, s.remoteLeftMs || 0);
    this.modeBar.replaceChildren(...[
      h('span', { class: 'ab-mode-chip' + (browser ? ' is-browser' : '') }, h('span', { html: icon(browser ? 'monitor' : 'file') }), browser ? 'Navegador real' : 'Modo lectura'),
      h('span', { class: 'ab-mode-meta muted' }, browser ? '' : `${Math.round((s.browserMs || 0) / 1000)} s de navegador`),
      h('span', { class: 'ab-mode-left muted' }, left > 0 ? `Te quedan ${human(left)} de ordenador hoy` : 'Sin minutos de ordenador hoy'),
      // Tareas que actúan en sitios: cuánto entra hoy con los minutos reales y aviso honesto sobre verificaciones.
      s.budget ? h('span', { class: 'ab-mode-budget', 'data-no-i18n': '' }, s.budget) : null,
      s.task && s.task !== 'read' ? h('span', { class: 'ab-mode-note muted' }, 'Algunos sitios no permiten automatizar o piden verificación: ahí te paso el control. Nunca salteo captchas.') : null].filter(Boolean));
  }

  renderReader(s) {
    if (!this.reader) return;
    const r = s.reader || { kind: 'none' };
    if (r.kind === 'results') {
      this.reader.replaceChildren(h('div', { class: 'abr-head' }, h('span', { html: icon('search') }), h('strong', { 'data-no-i18n': '' }, `«${r.query}»`)),
        h('ol', { class: 'abr-results' }, ...(r.results || []).map((x) => h('li', {}, h('a', { href: x.url, target: '_blank', rel: 'noopener noreferrer', 'data-no-i18n': '' }, x.title), h('small', { 'data-no-i18n': '' }, x.host), h('p', { 'data-no-i18n': '' }, x.snippet)))));
    } else if (r.kind === 'page') {
      this.reader.replaceChildren(...[h('div', { class: 'abr-head' }, h('span', { html: icon('globe') }), h('div', { class: 'abr-t' }, h('strong', { 'data-no-i18n': '' }, r.title), h('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer', 'data-no-i18n': '' }, r.host))),
        readable(r.description) ? h('p', { class: 'abr-desc', 'data-no-i18n': '' }, readable(r.description)) : null,
        h('div', { class: 'abr-text', 'data-no-i18n': '' }, readable(r.excerpt).slice(0, 1400)),
        h('small', { class: 'abr-foot muted' }, `Parte ${r.part} de ${r.parts}${r.tables ? ` · ${r.tables} tablas` : ''}`)].filter(Boolean));
    } else {
      this.reader.replaceChildren(h('div', { class: 'ab-loader' }, h('div', { class: 'ab-orbit', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), h('p', {}, WORKING.has(s.status) ? 'Armando el plan' : 'Lista')));
    }
  }

  renderClock() {
    const s = this.state;
    if (!s || !s.deadline || s.mode !== 'browser' || !LIVE.has(s.status)) { this.clock.hidden = true; return; }
    const left = s.deadline - (Date.now() + this.skew);
    this.clock.hidden = false;
    this.clock.querySelector('b').textContent = mmss(left);
    this.clock.classList.toggle('low', left < 30_000);
  }

  renderPlan(s) {
    const plan = s.plan || [];
    if (!plan.length) { this.planBox.hidden = true; return; }
    this.planBox.hidden = false;
    // Tarea de empleo: el servidor marca el plan con hechos (no se completa solo por terminar si no se postuló).
    const done = s.status === 'done' && s.task !== 'job' ? plan.length : Math.min(s.planDone || 0, s.status === 'awaiting_approval' ? plan.length - 1 : plan.length);
    this.planBox.replaceChildren(
      h('div', { class: 'ab-plan-h' }, h('strong', {}, 'Plan'), h('span', { class: 'muted', 'data-no-i18n': '' }, `${Math.min(done, plan.length)}/${plan.length}`)),
      h('ul', {}, ...plan.map((p, i) => h('li', { class: i < done ? 'ok' : i === done && LIVE.has(s.status) && s.status !== 'done' ? 'cur' : '' },
        h('span', { class: 'ab-ck', html: i < done ? icon('check') : '' }), h('span', { 'data-no-i18n': '' }, p)))));
  }

  renderSteps(steps) {
    this.timeline.replaceChildren(...steps.slice(-14).map((s) => h('li', { class: 'st-' + s.status }, h('span', { class: 'st-ic', 'aria-hidden': 'true' }), h('span', {}, s.label), s.mode === 'browser' ? h('span', { class: 'st-mode', title: 'Navegador real', html: icon('monitor') }) : null)));
  }

  showNotice(text, kind = 'info', action = null) {
    this.notice.hidden = false;
    this.notice.dataset.kind = kind;
    this.notice.replaceChildren(h('span', { html: icon(kind === 'help' ? 'user' : kind === 'warn' ? 'warn' : 'info') }), h('p', {}, text), ...(action ? [action] : []));
  }

  /* ---------- Tarjetas: inicio de sesión, pregunta, dato ---------- */

  renderAsk(ask) {
    const key = JSON.stringify(ask);
    if (key === this.askKey) return;
    this.askKey = key;
    this.notice.hidden = true;
    if (ask.kind === 'login') return this.asks.replaceChildren(this.loginCard(ask));
    if (ask.kind === 'question' && ask.choices) return this.asks.replaceChildren(this.questionCard(ask));
    this.asks.replaceChildren(this.infoCard(ask));
  }

  loginCard(ask) {
    // Formulario seguro (camino principal): los datos van por HTTPS directo al servidor, que los escribe en la página.
    // No pasan por el modelo, no quedan en el chat ni en los pasos, y solo se guardan (cifrados) si se tilda «Recordar en este sitio».
    const uid = 'abf' + Math.random().toString(36).slice(2, 8);
    const inp = (name, attrs) => h('input', { id: `${uid}-${name}`, name, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', ...attrs });
    const user = inp('username', { placeholder: 'tu@correo.com o tu usuario' });
    const pass = inp('password', { type: 'password', autocomplete: 'new-password', placeholder: 'Tu contraseña' });
    const phone = inp('phone', { type: 'tel', inputmode: 'tel', placeholder: '+54 9 291 000 0000', maxlength: '30' });
    const code = inp('code', { inputmode: 'numeric', autocomplete: 'one-time-code', placeholder: '123456', maxlength: '12' });
    const save = h('input', { type: 'checkbox', name: 'save', id: `${uid}-save` });   // opcional: sin tildar
    const eye = h('button', { class: 'abf-eye', type: 'button', 'aria-label': 'Mostrar contraseña', 'aria-controls': `${uid}-password`, html: icon('eye'), onclick: () => { pass.type = pass.type === 'password' ? 'text' : 'password'; eye.setAttribute('aria-label', pass.type === 'password' ? 'Mostrar contraseña' : 'Ocultar contraseña'); } });
    const status = h('span', { class: 'abf-status small muted', 'aria-live': 'polite' });
    const field = (label, el, extra) => h('div', { class: 'abf-field' }, h('label', { for: el.id }, label), extra || el);
    const onlyCode = !!ask.needCode && !ask.needUser && !ask.needPassword && !ask.needPhone;
    const showUser = !onlyCode && ask.needUser !== false;
    const showPass = !onlyCode && ask.needPassword !== false;
    const showPhone = !!ask.needPhone;
    const showCode = !!ask.needCode;
    const host = ask.host || 'este sitio';
    const take = () => { this.setTakeover(true); this.toggleFull(true); };
    const form = h('form', { class: 'ab-form-card abf-login', autocomplete: 'off', 'aria-label': `Iniciar sesión en ${host}` },
      h('div', { class: 'ap-head' }, h('span', { class: 'abf-ic', html: icon('lock') }), h('strong', {}, onlyCode ? 'Código de verificación' : 'Iniciar sesión'), ask.host ? h('span', { class: 'abf-host', 'data-no-i18n': '' }, ask.host) : null),
      h('p', { class: 'small abf-lead' }, onlyCode
        ? `${host} te mandó un código. Escribilo acá y lo cargo yo en la página.`
        : `Escribí tus datos acá y los cargo yo en ${host}. Van cifrados directo al servidor: el agente no los ve y no quedan en el chat.`),
      ask.saved && !onlyCode
        ? h('div', { class: 'abf-consent' },
          h('p', { class: 'small' }, `Tenés una cuenta guardada para ${host}. Solo la uso si tocás «Usar la guardada».`),
          h('div', { class: 'abf-row' },
            h('button', { class: 'btn btn-sm btn-primary abf-saved', type: 'button', onclick: () => this.sendLogin({ useSaved: true }, form, status) }, h('span', { html: icon('check') }), 'Usar la guardada'),
            h('button', { class: 'btn btn-sm btn-ghost abf-forget', type: 'button', onclick: (e) => this.forgetLogin(ask.host, e.currentTarget, status) }, 'Olvidar la guardada')))
        : null,
      showUser ? field('Correo o usuario', user) : null,
      showPhone ? field('Celular', phone) : null,
      showPass ? field('Contraseña', pass, h('div', { class: 'abf-pw' }, pass, eye)) : null,
      showCode ? field('Código de verificación', code) : null,
      onlyCode ? null : h('div', { class: 'abf-check' }, save, h('label', { for: save.id }, h('span', {}, 'Recordar en este sitio'), h('small', { class: 'muted' }, ' (cifrado, solo para vos; lo borrás cuando quieras)'))),
      h('div', { class: 'abf-row abf-actions' }, h('button', { class: 'btn btn-sm btn-primary abf-submit', type: 'submit' }, h('span', { html: icon('check') }), onlyCode ? 'Enviar código' : 'Ingresar'), status),
      h('p', { class: 'abf-alt-take small muted' }, '¿Preferís escribirlo vos en la pantalla? ',
        h('button', { class: 'abf-link', type: 'button', onclick: take }, 'Tomar el control')),
      h('p', { class: 'abf-fine muted' }, 'Nunca escribo datos de tarjetas. Las cuentas recordadas se borran en Tu cuenta → Cuentas conectadas.'));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const body = { username: showUser ? user.value : '', password: showPass ? pass.value : '', phone: showPhone ? phone.value.trim() : '', code: showCode ? code.value.replace(/\s+/g, '') : '', save: !onlyCode && save.checked, host: ask.host };
      user.value = ''; pass.value = ''; phone.value = ''; code.value = '';
      if (!body.username && !body.password && !body.phone && !body.code) { status.textContent = 'Completá los datos.'; return; }
      this.sendLogin(body, form, status);
    });
    setTimeout(() => { const first = form.querySelector('input:not([type=checkbox])'); if (first && !matchMedia('(max-width: 600px)').matches) first.focus({ preventScroll: true }); }, 50);
    return form;
  }

  async forgetLogin(host, btn, status) {
    btn.disabled = true;
    try {
      const r = await this.api('/api/agent/logins/delete', { body: { host, match: true } });
      status.textContent = r && r.ok ? 'Listo: borré la cuenta guardada de este sitio.' : 'No había una cuenta guardada.';
      const box = btn.closest('.abf-consent'); if (box) box.remove();
    } catch { btn.disabled = false; status.textContent = 'No pude borrarla. Probá desde Tu cuenta → Cuentas conectadas.'; }
  }

  async sendLogin(body, form, status) {
    form.querySelectorAll('button,input').forEach((x) => { x.disabled = true; });
    status.textContent = 'Ingresando…';
    try {
      const s = await this.api('/api/agent/browser/login', { body });
      this.askKey = '';
      this.apply(s);
      this.loop();
    } catch (e) {
      form.querySelectorAll('button,input').forEach((x) => { x.disabled = false; });
      status.textContent = e.code === 'browser_busy' ? 'Esperando un navegador libre…' : 'No pude completarlo. Probá de nuevo o tocá «Tomar el control».';
    }
  }

  questionCard(ask) {
    const other = h('input', { class: 'abf-other', placeholder: 'Otra respuesta', 'aria-label': 'Otra respuesta' });
    const card = h('div', { class: 'ab-form-card abf-q', role: 'group' },
      h('div', { class: 'ap-head' }, h('span', { class: 'abf-ic', html: icon('bulb') }), h('strong', {}, 'Elegí una opción')),
      h('p', { 'data-no-i18n': '' }, ask.message),
      h('div', { class: 'abf-choices' }, ...ask.choices.map((c) => h('button', { class: 'abf-choice', type: 'button', 'data-no-i18n': '', onclick: () => this.answer(c, card) }, c))),
      h('form', { class: 'abf-row', onsubmit: (e) => { e.preventDefault(); if (other.value.trim()) this.answer(other.value.trim(), card); } }, other, h('button', { class: 'btn btn-sm', type: 'submit' }, 'Enviar')));
    return card;
  }

  infoCard(ask) {
    const inp = h('input', { class: 'abf-other', placeholder: 'Escribí tu respuesta', 'aria-label': 'Tu respuesta' });
    const card = h('div', { class: 'ab-form-card abf-info', role: 'group' },
      h('div', { class: 'ap-head' }, h('span', { class: 'abf-ic', html: icon(ask.kind === 'captcha' ? 'shield' : 'user') }), h('strong', {}, ask.kind === 'captcha' ? 'Verificación humana' : 'Necesito un dato')),
      h('p', { 'data-no-i18n': '' }, ask.message),
      ask.kind === 'captcha' ? null : h('form', { class: 'abf-row', onsubmit: (e) => { e.preventDefault(); if (inp.value.trim()) this.answer(inp.value.trim(), card); } }, inp, h('button', { class: 'btn btn-sm btn-primary', type: 'submit' }, 'Enviar')),
      h('div', { class: 'abf-row' }, h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => this.setTakeover(true) }, h('span', { html: icon('keyboard') }), 'Tomar el control')));
    return card;
  }

  async answer(text, card) {
    card.querySelectorAll('button,input').forEach((x) => { x.disabled = true; });
    try { const s = await this.api('/api/agent/browser/answer', { body: { text } }); this.askKey = ''; this.apply(s); this.loop(); }
    catch { card.querySelectorAll('button,input').forEach((x) => { x.disabled = false; }); }
  }

  async askApproval(pending) {
    this.approving = true;
    this.approvals.replaceChildren();
    const ok = await approvalCard(this.approvals, pending.label, pending.reason);
    try {
      this.setPill(ok ? 'Trabajando' : 'Rechazado', ok ? 'run' : 'off');
      const s = await this.api('/api/agent/browser/approve', { body: { decision: ok ? 'approve' : 'cancel' } });
      this.approving = false;
      setTimeout(() => this.approvals.replaceChildren(), 1500);
      this.apply(s);
      this.loop();
    } catch (e) { this.approving = false; if (e.code === 'no_session') this.ended(); }
  }

  /* ---------- Archivos ---------- */

  renderFiles(files) {
    if (!files.length) { this.filesBox.hidden = true; return; }
    this.filesBox.hidden = false;
    this.filesBox.replaceChildren(h('div', { class: 'ab-files-h' }, h('span', { html: icon('folder') }), h('strong', {}, 'Archivos')),
      ...files.map((f) => h('div', { class: 'ab-file' }, h('span', { class: 'ab-file-n', 'data-no-i18n': '' }, f.name), h('small', { class: 'muted', 'data-no-i18n': '' }, f.size > 1024 ? `${Math.round(f.size / 1024)} KB` : `${f.size} B`),
        h('button', { class: 'ab-ib', type: 'button', title: 'Descargar', 'aria-label': 'Descargar ' + f.name, html: icon('download'), onclick: () => this.download(f) }))));
    // Archivos nuevos o actualizados → al chat, con vista previa automática.
    const fresh = files.filter((f) => this.fileSeen.get(f.name) !== f.at);
    if (!fresh.length) return;
    fresh.forEach((f) => this.fileSeen.set(f.name, f.at));
    Promise.all(fresh.map((f) => this.fetchFile(f).catch(() => null))).then((list) => {
      const ok = list.filter(Boolean);
      if (ok.length && this.o.onFiles) this.o.onFiles(ok);
    });
  }

  async fetchFile(f) {
    const j = await this.api('/api/agent/browser/file', { body: { name: f.name } });
    return { name: j.name, mime: j.mime, content: j.content, url: j.binary ? j.content : undefined };
  }

  async download(f) {
    const j = await this.fetchFile(f).catch(() => null);
    if (!j) return;
    const blob = /^data:/.test(j.content) ? await (await fetch(j.content)).blob() : new Blob([j.content], { type: j.mime + ';charset=utf-8' });
    const a = h('a', { href: URL.createObjectURL(blob), download: j.name });
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  async capture(kind) {
    this.toolsBtn.open = false;
    this.setPill(kind === 'pdf' ? 'Creando el PDF' : kind === 'screenshot' ? 'Sacando la captura' : 'Guardando el texto', 'run');
    try { this.apply(await this.api('/api/agent/browser/capture', { body: { kind } })); }
    catch (e) { this.showNotice(e.code === 'nothing_to_capture' ? 'Todavía no hay una página abierta para guardar.' : e.status === 429 ? 'Para la captura o el PDF hace falta el navegador real y hoy no hay minutos. Probá «Texto de la página».' : 'No pude guardarlo. Probá de nuevo.', 'warn'); if (this.state) this.apply(this.state); }
  }

  /* ---------- Control manual ---------- */

  async setTakeover(on) {
    try {
      const s = await this.api('/api/agent/browser/takeover', { body: { on } });
      this.apply(s);
      if (on && s.status === 'takeover') { this.notice.hidden = true; this.asks.replaceChildren(); this.kb.querySelector('.ab-kb-in').focus({ preventScroll: true }); }
      else if (!on || s.status === 'queued') this.loop();
    } catch (e) {
      if (e.code === 'no_session') return this.ended();
      this.showNotice(e.code === 'browser_quota_user' || e.code === 'browser_quota_global' ? 'Hoy no quedan minutos de navegador real para tomar el control. Se renuevan mañana.' : 'Todos los navegadores están ocupados. Probá en un minuto.', 'warn');
    }
  }

  onScreenClick(ev) {
    if (!this.state || this.state.status !== 'takeover') return;
    // Misma geometría que el puntero (object-fit y object-position reales): antes se suponía la imagen centrada y,
    // con la captura alineada arriba, el toque caía corrido hacia abajo.
    const g = this.geom(); if (!g) return;
    const pr = this.ptr.getBoundingClientRect();
    const px = ev.clientX - pr.left, py = ev.clientY - pr.top;
    const pt = fromView(px, py, g.rect);
    if (!pt) return;
    const dot = h('i', { class: 'ab-tap', style: `left:${px}px;top:${py}px` });
    this.ptr.append(dot); setTimeout(() => dot.remove(), 600);
    this.input({ kind: 'click', x: pt.x, y: pt.y });
  }

  async input(inp) {
    try { this.apply(await this.api('/api/agent/browser/input', { body: { input: inp } })); }
    catch (e) { if (e.code === 'no_session') this.ended(); }
  }

  /**
   * Mientras el agente trabaja, el estado se consulta seguido: los pasos y el puntero aparecen en vivo.
   * Manda `since` (la captura que ya tiene) para no recibir la misma imagen; con errores espera cada vez más
   * (hasta 15 s) y vuelve enseguida al recuperar la red o la pestaña. Al terminar deja de consultar.
   */
  async poll() {
    if (this.stopped || this.polling) return;
    this.polling = true; clearTimeout(this.timer);
    let ok = true;
    try {
      const s = await this.api('/api/agent/browser/frame' + (this.haveAt ? `?since=${this.haveAt}` : ''), { method: 'GET' });
      if (this.netFails) { this.netFails = 0; this.setNet('ok'); if (!this.loopFails && this.noticeSticky) { this.noticeSticky = false; this.notice.hidden = true; } }
      if (!this.approving) this.apply(s);
    } catch (e) {
      if (e.status === 404 || e.code === 'no_session') { this.polling = false; this.ended(); return; }
      ok = false; this.netFails++;
      if (this.netFails >= 2) this.setNet(navigator.onLine === false ? 'off' : 'retry');
    } finally { this.polling = false; }
    if (this.stopped) return;
    const st = this.state && this.state.status;
    // Terminada: ya no cambia nada (antes se seguía consultando cada 8 s para siempre).
    if (st === 'done' && !this.stepping && ok) return;
    const fast = st === 'takeover' || st === 'acting' || st === 'thinking' || this.stepping;
    // Pantalla en vivo: cada ~1,2 s mientras trabaja (el servidor saca una captura nueva cada 1,5 s); 2 s en espera.
    const base = document.hidden ? 6000 : fast ? 1200 : st === 'queued' ? 4000 : 2000;
    const wait = ok ? base : Math.min(15_000, 1500 * 2 ** Math.min(4, this.netFails - 1));
    this.timer = setTimeout(() => this.poll(), wait);
  }

  /** Volvió la red, la pestaña o la persona tocó «Reintentar ahora»: consulta ya, sin esperar el próximo turno. */
  kick(loopToo = false) {
    if (this.stopped) return;
    clearTimeout(this.timer);
    this.poll();
    if ((loopToo || this.loopFails) && !this.approving) { clearTimeout(this.loopT); this.stepping = false; this.loop(); }
  }

  /** Suelta escuchas globales (red, pestaña, tamaño) cuando la tarjeta deja de estar activa. */
  unlisten() {
    window.removeEventListener('online', this._online);
    document.removeEventListener('visibilitychange', this._vis);
    clearTimeout(this.loopT);
    this.evq = [];
    if (this.cursor) this.calmPointer();
  }

  /** Otra tarjeta toma la conversación: esta deja de consultar (la sesión del servidor sigue). */
  detach() {
    this.stopped = true; clearTimeout(this.timer); clearInterval(this.tick); this.unlisten();
    if (this.el.classList.contains('is-full')) this.toggleFull(false);
    this.el.classList.add('is-detached'); this.controls.hidden = true; this.stopBtn.hidden = true; this.vStop.hidden = true; this.xBtn.hidden = true;
    if (this.state && !['done', 'ended'].includes(this.state.status)) this.renderSummary({ ...this.state, status: 'ended', endedReason: 'detached', canResume: false }, true);
  }

  ended(s) {
    if (this.stopped && this._endedShown) return;
    this.stopped = true; this._endedShown = true;
    clearTimeout(this.timer); clearInterval(this.tick); this.unlisten();
    this.kb.hidden = true; this.controls.hidden = true; this.clock.hidden = true; this.stopBtn.hidden = true; this.vStop.hidden = true; this.asks.replaceChildren();
    this.view.classList.remove('is-takeover', 'is-busy');
    this.setPill('Detenida', 'off');
    const st = s || this.state || {};
    const reason = st.endedReason || '';
    const txt = reason === 'idle' ? 'La archivé por inactividad.' : reason === 'time_limit' ? 'Llegó al tiempo máximo de la tarea.' : 'Detuviste el ordenador virtual.';
    const resume = (st.canResume !== false) ? h('button', { class: 'btn btn-sm', type: 'button', onclick: () => this.resume() }, h('span', { html: icon('refresh') }), 'Retomar') : null;
    this.result.hidden = false;
    this.result.replaceChildren(h('div', { class: 'ab-res-h' }, h('span', { html: icon('power') }), h('strong', {}, 'Detenida')), h('p', {}, txt), ...(resume ? [resume] : []));
    this.el.dataset.status = 'ended'; this.xBtn.hidden = true;
    this.renderLine({ ...st, status: 'ended' });
    this.renderSummary({ ...st, status: 'ended' }, true);
    this.o.onScroll && this.o.onScroll();
  }

  async resume() {
    try {
      const s = await this.api('/api/agent/browser/resume', { body: {} });
      this.stopped = false; this._endedShown = false;
      window.addEventListener('online', this._online); document.addEventListener('visibilitychange', this._vis);
      this.controls.hidden = false; this.stopBtn.hidden = false; this.vStop.hidden = false; this.result.hidden = true; this.xBtn.hidden = false;
      this.apply(s);
      clearInterval(this.tick);
      this.tick = setInterval(() => { this.renderClock(); this.renderElapsed(); this.renderTaskClock(); }, 1000);
      this.netFails = 0; this.seen = null;
      this.poll(); this.loop();
    } catch (e) { this.showNotice('No pude retomar la tarea. Pedímela de nuevo.', 'warn'); }
  }

  async stop() {
    if (this.stopped) { this.el.remove(); return; }
    clearTimeout(this.timer);
    try { const s = await this.api('/api/agent/browser/stop'); this.ended(s); } catch { this.ended(); }
  }

  /** Pantalla completa: pantalla grande, «Tomar el control», guardar, plan y pasos. Escape o «Achicar» vuelven al chat. */
  toggleFull(force) {
    const f = typeof force === 'boolean' ? force : !this.el.classList.contains('is-full');
    if (f === this.el.classList.contains('is-full')) return;
    this.el.classList.toggle('is-full', f);
    this.el.setAttribute('role', f ? 'dialog' : 'region');
    if (f) this.el.setAttribute('aria-modal', 'true'); else this.el.removeAttribute('aria-modal');
    this.screen.setAttribute('tabindex', f ? '-1' : '0');
    document.body.classList.toggle('ab-lock', f);
    this.maxBtn.innerHTML = icon(f ? 'collapse' : 'expand');
    this.maxBtn.setAttribute('aria-label', f ? 'Salir de pantalla completa' : 'Pantalla completa'); this.maxBtn.title = f ? 'Salir de pantalla completa' : 'Pantalla completa';
    if (f && this.el.classList.contains('is-folded')) this.toggleFold(false);
    if (f) {
      // Escape cierra; Tab queda dentro de la ventana (diálogo modal).
      this._esc = (e) => {
        if (e.key === 'Escape') return this.toggleFull(false);
        if (e.key !== 'Tab') return;
        const list = [...this.el.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]):not([type=hidden]), summary, [tabindex="0"]')].filter((x) => x.offsetParent !== null || x === document.activeElement);
        if (!list.length) return;
        const first = list[0], last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || !this.el.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
      };
      document.addEventListener('keydown', this._esc); setTimeout(() => this.maxBtn.focus({ preventScroll: true }), 30);
    }
    else { document.removeEventListener('keydown', this._esc); this.screen.focus({ preventScroll: true }); this.o.onScroll && this.o.onScroll(); }
    requestAnimationFrame(() => this.placeCursor());
  }
}
