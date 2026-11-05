/**
 * Computadora del agente (modo híbrido): el agente planifica y trabaja solo hasta terminar.
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
import { needsWebAction, isFollowUp } from './chat/intent.js';
/** Reexportadas para el código que ya las importaba desde acá (la lógica vive en chat/intent.js, sin DOM). */
export { needsWebAction, isFollowUp };

(function css() {
  if (typeof document === 'undefined' || document.getElementById('ac-ab2-css')) return;
  const l = document.createElement('link');
  l.id = 'ac-ab2-css'; l.rel = 'stylesheet'; l.href = '/assets/css/agent-browser.css?v=2.0.1';
  document.head.appendChild(l);
})();

const SITES = [
  [/linkedin/i, 'https://www.linkedin.com/'], [/computrabajo/i, 'https://ar.computrabajo.com/'], [/bumeran/i, 'https://www.bumeran.com.ar/'],
  [/zonajobs/i, 'https://www.zonajobs.com.ar/'], [/indeed/i, 'https://ar.indeed.com/'], [/mercado ?libre/i, 'https://www.mercadolibre.com.ar/'],
  [/gmail|correo|mail/i, 'https://mail.google.com/']
];

export function guessUrl(text) {
  const m = /\bhttps?:\/\/[^\s<>"']{4,300}/i.exec(text) || /\b([a-z0-9-]+\.)+(com|ar|net|org|io|dev|es|mx|co|br)(\.[a-z]{2})?(\/[^\s]*)?/i.exec(text);
  if (m) return m[0].startsWith('http') ? m[0] : 'https://' + m[0];
  for (const [re, url] of SITES) if (re.test(text)) return url;
  return null;
}
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
  starting: 'Encendiendo la computadora', ready: 'Trabajando', thinking: 'Pensando el siguiente paso', acting: 'Trabajando',
  awaiting_approval: 'Esperando tu aprobación', needs_user: 'Necesita tu acción', queued: 'En fila', takeover: 'Tenés el control', done: 'Tarea terminada', ended: 'Sesión cerrada', error: 'No disponible'
};

export class AgentBrowserCard {
  /**
   * @param {{ thread: HTMLElement, composer: HTMLElement, text: string, conv?: string, lang?: string, isPaid?: boolean,
   *   idToken?: () => Promise<string|null>, onScroll?: () => void, onFiles?: (files: {name:string,mime:string,content:string}[]) => void }} o
   */
  constructor(o) {
    this.o = o;
    this.goal = String(o.text || '').trim();
    this.url = guessUrl(this.goal);
    this.state = null;
    this.timer = 0; this.tick = 0;
    this.stopped = false; this.stepping = false; this.approving = false; this.askKey = '';
    this.fileSeen = new Map();
    this.device = window.matchMedia('(max-width: 700px)').matches ? 'mobile' : 'desktop';
    this.build();
    this.start();
  }

  build() {
    this.pill = h('span', { class: 'ab-pill' }, h('span', { class: 'ab-dot' }), h('span', { class: 'ab-pill-text' }, 'Encendiendo la computadora'));
    this.clock = h('span', { class: 'ab-clock', title: 'Tiempo de navegador real', hidden: true }, h('span', { html: icon('clock') }), h('b', { 'data-no-i18n': '' }, ''));
    this.minBtn = h('button', { class: 'ab-btn', type: 'button', 'aria-label': 'Minimizar', html: icon('chevron'), onclick: () => this.toggleMin() });
    this.fullBtn = h('button', { class: 'ab-btn', type: 'button', 'aria-label': 'Pantalla completa', html: icon('expand'), onclick: () => this.toggleFull() });
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
    this.el = h('section', { class: 'ab-card', 'aria-label': 'Computadora del agente' },
      h('header', { class: 'ab-head' }, h('span', { class: 'ab-title', html: icon('monitor') + '<span>Computadora del agente</span>' }), this.pill, this.clock, h('span', { class: 'ab-actions' }, this.minBtn, this.fullBtn, this.stopBtn)),
      this.modeBar, this.addr, this.view, this.kb, this.controls, this.notice, this.asks, this.approvals, this.planBox, this.stepsBox, this.filesBox, this.result);
    this.o.thread.append(this.el);
    this.o.onScroll && this.o.onScroll();
  }

  loader(text = 'Encendiendo la computadora') {
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
    this.fullBtn.hidden = true; this.stopBtn.hidden = true; this.controls.hidden = true; this.clock.hidden = true;
    this.view.replaceChildren(h('div', { class: 'ab-off' }, h('span', { class: 'ab-off-ic', html: icon('monitor') }), h('strong', {}, title), h('p', {}, text), action || null));
  }

  explain(e) {
    const ok = h('button', { class: 'btn btn-sm', type: 'button', onclick: () => this.el.remove() }, 'Entendido');
    if (e.status === 401) return this.unavailable('Ingresá con tu cuenta', 'La computadora del agente necesita una cuenta para proteger tus sesiones.', h('a', { class: 'btn btn-sm', href: '/cuenta/' }, 'Ingresar'));
    if (e.status === 503) return this.unavailable('La computadora del agente no está disponible', 'El servicio está en mantenimiento. No se realizó ninguna acción.', ok);
    if (e.status === 429) return this.unavailable('Hay muchos pedidos en este momento', 'Esperá unos segundos y volvé a pedírmelo. No se realizó ninguna acción.', ok);
    return this.unavailable('No pude encender la computadora', 'Probá de nuevo en unos minutos. No se realizó ninguna acción.', ok);
  }

  async start() {
    const [st] = await Promise.all([engine.init(), new Promise((r) => setTimeout(r, 250))]);
    if (this.stopped) return;
    if (!st.live || !st.caps || !st.caps.browser) {
      this.unavailable('La computadora del agente no está disponible', 'No pude conectarme al servicio. Mientras tanto te guío para que lo hagas vos, sin compartir contraseñas.', h('button', { class: 'btn btn-sm', type: 'button', onclick: () => this.el.remove() }, 'Entendido'));
      return;
    }
    try {
      const s = await this.api('/api/agent/browser/start', { body: { goal: this.goal, url: this.url || undefined, device: this.device, conv: this.o.conv || undefined, lang: this.o.lang || undefined } });
      this.img = h('img', { class: 'ab-frame', alt: 'Vista en vivo de la computadora del agente', decoding: 'async', draggable: 'false' });
      this.img.addEventListener('click', (ev) => this.onScreenClick(ev));
      this.reader = h('div', { class: 'ab-reader' });
      this.view.replaceChildren(this.reader, this.img, h('div', { class: 'ab-scan', 'aria-hidden': 'true' }));
      this.view.classList.add('is-live');
      this.view.dataset.device = s.device || this.device;
      this.controls.hidden = false; this.stepsBox.hidden = false;
      this.apply(s);
      this.tick = setInterval(() => this.renderClock(), 1000);
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
        this.apply(s);
        if (s.status === 'queued') await new Promise((r) => setTimeout(r, 4000));
        else await new Promise((r) => setTimeout(r, 120));
      }
    } catch (e) {
      if (e.code === 'no_session' || e.code === 'session_closed') { this.ended(e.state); this.stepping = false; return; }
      this.showNotice('Se cortó la conexión. Reintentando…', 'warn');
      if (!this.stopped) setTimeout(() => { this.stepping = false; this.loop(); }, 2500);
      return;
    } finally { this.view.classList.remove('is-busy'); }
    this.stepping = false;
  }

  apply(s) {
    if (!s || !s.status) return;
    this.state = s;
    const browser = s.mode === 'browser';
    this.view.classList.toggle('is-reader', !browser);
    this.view.classList.toggle('is-browser', browser);
    if (s.image && this.img && browser) this.img.src = s.image;
    if (s.viewport && browser) this.view.style.setProperty('--ab-ar', `${s.viewport.width} / ${s.viewport.height}`);
    if (!browser) this.renderReader(s);
    if (s.url) { this.addr.hidden = false; this.addr.querySelector('.ab-addr-t').textContent = s.host || host(s.url); }
    this.renderMode(s);
    // Estado
    const kind = s.status === 'done' ? 'ok' : s.status === 'awaiting_approval' || s.status === 'needs_user' || s.status === 'queued' ? 'wait' : s.status === 'ended' ? 'off' : s.status === 'takeover' ? 'you' : 'run';
    const label = s.status === 'queued' && s.queue ? `En fila · puesto ${s.queue.position}` : (s.status === 'acting' || s.status === 'ready') && !browser ? 'Leyendo' : STATUS_TEXT[s.status] || s.status;
    this.setPill(label, kind);
    this.el.dataset.status = s.status;
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
    else if (s.notice === 'light_fallback' && !browser && s.status !== 'done') this.showNotice('Sigo en modo lectura: hoy ya se usaron los minutos de navegador real. Solo freno si un paso exige hacer clic.', 'info');
    else if (!this.noticeSticky) this.notice.hidden = true;
    this.renderFiles(s.files || []);
    // Resultado
    if (s.status === 'done' && s.summary) {
      this.result.hidden = false;
      this.result.replaceChildren(h('div', { class: 'ab-res-h' }, h('span', { html: icon('check') }), h('strong', {}, 'Resultado')), h('p', { class: 'ab-res-t', 'data-no-i18n': '' }, s.summary),
        (s.sources || []).length ? h('div', { class: 'ab-srcs' }, h('small', { class: 'muted' }, 'Fuentes'), ...(s.sources || []).slice(0, 8).map((x, i) => h('a', { href: x.url, target: '_blank', rel: 'noopener noreferrer', 'data-no-i18n': '' }, `${i + 1}. ${x.title || host(x.url)}`))) : null,
        h('small', { class: 'muted' }, 'Podés seguir en esta conversación: por ejemplo «ahora compará…» o «pasalo a una tabla».'));
    } else if (s.status !== 'ended') this.result.hidden = true;
    if (s.status === 'ended') this.ended(s);
    this.o.onScroll && this.o.onScroll();
  }

  renderMode(s) {
    this.modeBar.hidden = false;
    const browser = s.mode === 'browser';
    const left = Math.max(s.browserLeftMs || 0, s.remoteLeftMs || 0);
    this.modeBar.replaceChildren(
      h('span', { class: 'ab-mode-chip' + (browser ? ' is-browser' : '') }, h('span', { html: icon(browser ? 'monitor' : 'file') }), browser ? 'Navegador real' : 'Modo lectura'),
      h('span', { class: 'ab-mode-meta muted' }, browser ? '' : `${Math.round((s.browserMs || 0) / 1000)} s de navegador`),
      h('span', { class: 'ab-mode-left muted' }, left > 0 ? `Te quedan ${human(left)} de navegador hoy` : 'Sin minutos de navegador hoy'));
  }

  renderReader(s) {
    if (!this.reader) return;
    const r = s.reader || { kind: 'none' };
    if (r.kind === 'results') {
      this.reader.replaceChildren(h('div', { class: 'abr-head' }, h('span', { html: icon('search') }), h('strong', { 'data-no-i18n': '' }, `«${r.query}»`)),
        h('ol', { class: 'abr-results' }, ...(r.results || []).map((x) => h('li', {}, h('a', { href: x.url, target: '_blank', rel: 'noopener noreferrer', 'data-no-i18n': '' }, x.title), h('small', { 'data-no-i18n': '' }, x.host), h('p', { 'data-no-i18n': '' }, x.snippet)))));
    } else if (r.kind === 'page') {
      this.reader.replaceChildren(h('div', { class: 'abr-head' }, h('span', { html: icon('globe') }), h('div', { class: 'abr-t' }, h('strong', { 'data-no-i18n': '' }, r.title), h('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer', 'data-no-i18n': '' }, r.host))),
        r.description ? h('p', { class: 'abr-desc', 'data-no-i18n': '' }, r.description) : null,
        h('div', { class: 'abr-text', 'data-no-i18n': '' }, (r.excerpt || '').slice(0, 1400)),
        h('small', { class: 'abr-foot muted' }, `Parte ${r.part} de ${r.parts}${r.tables ? ` · ${r.tables} tablas` : ''}`));
    } else {
      this.reader.replaceChildren(h('div', { class: 'ab-loader' }, h('div', { class: 'ab-orbit', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), h('p', {}, WORKING.has(s.status) ? 'Armando el plan' : 'Lista')));
    }
  }

  renderClock() {
    const s = this.state;
    if (!s || !s.deadline || s.mode !== 'browser' || !LIVE.has(s.status)) { this.clock.hidden = true; return; }
    const left = s.deadline - Date.now();
    this.clock.hidden = false;
    this.clock.querySelector('b').textContent = mmss(left);
    this.clock.classList.toggle('low', left < 30_000);
  }

  renderPlan(s) {
    const plan = s.plan || [];
    if (!plan.length) { this.planBox.hidden = true; return; }
    this.planBox.hidden = false;
    const done = s.status === 'done' ? plan.length : Math.min(s.planDone || 0, s.status === 'awaiting_approval' ? plan.length - 1 : plan.length);
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
    const user = h('input', { name: 'username', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Usuario o correo', placeholder: 'tu@correo.com' });
    const pass = h('input', { name: 'password', type: 'password', autocomplete: 'new-password', 'aria-label': 'Contraseña', placeholder: 'Tu contraseña' });
    const code = h('input', { name: 'code', inputmode: 'numeric', autocomplete: 'one-time-code', 'aria-label': 'Código de verificación', placeholder: '123456', maxlength: '12' });
    const save = h('input', { type: 'checkbox', name: 'save' });   // guardar es opcional: casilla sin tildar
    const eye = h('button', { class: 'abf-eye', type: 'button', 'aria-label': 'Mostrar contraseña', html: icon('eye'), onclick: () => { pass.type = pass.type === 'password' ? 'text' : 'password'; } });
    const status = h('span', { class: 'abf-status small muted', 'aria-live': 'polite' });
    const form = h('form', { class: 'ab-form-card abf-login', autocomplete: 'off' },
      h('div', { class: 'ap-head' }, h('span', { class: 'abf-ic', html: icon('lock') }), h('strong', {}, 'Iniciar sesión'), ask.host ? h('span', { class: 'abf-host', 'data-no-i18n': '' }, ask.host) : null),
      ask.saved && !ask.needCode
        ? h('div', { class: 'abf-consent' }, h('p', { class: 'small' }, `Tenés una cuenta guardada para ${ask.host || 'este sitio'}. ¿Te doy permiso para usarla ahora? Solo la cargo si tocás «Sí, usarla».`),
          h('div', { class: 'abf-row' }, h('button', { class: 'btn btn-sm btn-primary abf-saved', type: 'button', onclick: () => this.sendLogin({ useSaved: true }, form, status) }, h('span', { html: icon('check') }), 'Sí, usarla'),
            h('span', { class: 'small muted' }, 'o escribí otros datos abajo')))
        : null,
      h('p', { class: 'small' }, 'Completá tus datos: los cargo yo en la página. Van directo al servidor, se guardan cifrados solo si lo elegís y el agente nunca los ve.'),
      ask.needUser !== false ? h('label', { class: 'abf-field' }, h('span', {}, 'Usuario o correo'), user) : null,
      ask.needPassword !== false ? h('label', { class: 'abf-field' }, h('span', {}, 'Contraseña'), h('div', { class: 'abf-pw' }, pass, eye)) : null,
      ask.needCode ? h('label', { class: 'abf-field' }, h('span', {}, 'Código de verificación'), code) : null,
      ask.needCode ? null : h('label', { class: 'abf-check' }, save, h('span', {}, 'Guardar esta cuenta para la próxima (cifrada)')),
      h('div', { class: 'abf-row' }, h('button', { class: 'btn btn-sm btn-primary', type: 'submit' }, h('span', { html: icon('check') }), 'Ingresar'),
        h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => this.setTakeover(true) }, 'Lo hago yo'), status),
      h('p', { class: 'abf-fine muted' }, 'Nunca escribo datos de tarjetas. Podés borrar tus accesos guardados en Tu cuenta → Cuentas conectadas.'));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const body = { username: user.value, password: pass.value, code: code.value.replace(/\s+/g, ''), save: !ask.needCode && save.checked, host: ask.host };
      user.value = ''; pass.value = ''; code.value = '';
      if (!body.username && !body.password && !body.code) { status.textContent = 'Completá los datos.'; return; }
      this.sendLogin(body, form, status);
    });
    setTimeout(() => (ask.needCode ? code : ask.needUser !== false ? user : pass).focus({ preventScroll: true }), 50);
    return form;
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
      status.textContent = e.code === 'browser_busy' ? 'Esperando un navegador libre…' : 'No pude completarlo. Probá «Lo hago yo».';
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
    const r = this.img.getBoundingClientRect();
    const vw = this.state.viewport?.width || 1024, vh = this.state.viewport?.height || 640;
    const scale = Math.min(r.width / vw, r.height / vh);
    const w = vw * scale, hh = vh * scale, ox = (r.width - w) / 2, oy = (r.height - hh) / 2;
    const x = (ev.clientX - r.left - ox) / w, y = (ev.clientY - r.top - oy) / hh;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    const dot = h('i', { class: 'ab-tap', style: `left:${ev.clientX - r.left}px;top:${ev.clientY - r.top}px` });
    this.view.append(dot); setTimeout(() => dot.remove(), 600);
    this.input({ kind: 'click', x, y });
  }

  async input(inp) {
    try { this.apply(await this.api('/api/agent/browser/input', { body: { input: inp } })); }
    catch (e) { if (e.code === 'no_session') this.ended(); }
  }

  /** Mientras el agente trabaja, el estado se consulta seguido: los pasos aparecen en vivo. */
  async poll() {
    if (this.stopped) return;
    try { const s = await this.api('/api/agent/browser/frame', { method: 'GET' }); if (!this.approving) this.apply(s); }
    catch (e) { if (e.status === 404 || e.code === 'no_session') { this.ended(); return; } }
    const st = this.state && this.state.status;
    const fast = st === 'takeover' || st === 'acting' || st === 'thinking' || this.stepping;
    this.timer = setTimeout(() => this.poll(), document.hidden ? 6000 : fast ? 900 : st === 'queued' ? 4000 : 2500);
  }

  /** Otra tarjeta toma la conversación: esta deja de consultar (la sesión del servidor sigue). */
  detach() { this.stopped = true; clearTimeout(this.timer); clearInterval(this.tick); this.el.classList.add('is-min', 'is-detached'); this.controls.hidden = true; this.stopBtn.hidden = true; }

  ended(s) {
    if (this.stopped && this._endedShown) return;
    this.stopped = true; this._endedShown = true;
    clearTimeout(this.timer); clearInterval(this.tick);
    this.kb.hidden = true; this.controls.hidden = true; this.clock.hidden = true; this.stopBtn.hidden = true; this.asks.replaceChildren();
    this.view.classList.remove('is-takeover', 'is-busy');
    this.setPill('Detenida', 'off');
    const st = s || this.state || {};
    const reason = st.endedReason || '';
    const txt = reason === 'idle' ? 'La archivé por inactividad.' : 'Detuviste la computadora del agente.';
    const resume = (st.canResume !== false) ? h('button', { class: 'btn btn-sm', type: 'button', onclick: () => this.resume() }, h('span', { html: icon('refresh') }), 'Retomar') : null;
    this.result.hidden = false;
    this.result.replaceChildren(h('div', { class: 'ab-res-h' }, h('span', { html: icon('power') }), h('strong', {}, 'Detenida')), h('p', {}, txt), resume);
  }

  async resume() {
    try {
      const s = await this.api('/api/agent/browser/resume', { body: {} });
      this.stopped = false; this._endedShown = false;
      this.controls.hidden = false; this.stopBtn.hidden = false; this.result.hidden = true;
      this.apply(s);
      this.tick = setInterval(() => this.renderClock(), 1000);
      this.poll(); this.loop();
    } catch (e) { this.showNotice('No pude retomar la tarea. Pedímela de nuevo.', 'warn'); }
  }

  async stop() {
    if (this.stopped) { this.el.remove(); return; }
    clearTimeout(this.timer);
    try { const s = await this.api('/api/agent/browser/stop'); this.ended(s); } catch { this.ended(); }
  }

  toggleMin() { const m = this.el.classList.toggle('is-min'); this.minBtn.setAttribute('aria-label', m ? 'Expandir' : 'Minimizar'); }
  toggleFull() {
    const f = this.el.classList.toggle('is-full');
    this.fullBtn.setAttribute('aria-label', f ? 'Salir de pantalla completa' : 'Pantalla completa');
    this.fullBtn.innerHTML = icon(f ? 'collapse' : 'expand');
    document.body.classList.toggle('ab-lock', f);
    if (f) { this._esc = (e) => { if (e.key === 'Escape') this.toggleFull(); }; document.addEventListener('keydown', this._esc); }
    else document.removeEventListener('keydown', this._esc);
  }
}
