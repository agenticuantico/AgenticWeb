/**
 * Computadora del agente: un navegador real en la nube que el agente maneja, dentro del chat.
 *  - Abre una sesión (POST /api/agent/browser/start), el agente decide cada paso (POST .../agent) y la vista
 *    muestra capturas reales (GET .../frame) con el plan, los pasos y el tiempo que queda.
 *  - Antes de comprar, pagar, postularse, enviar datos personales, publicar o mandar mensajes, se detiene y
 *    pide aprobación (Aprobar / Cancelar).
 *  - Inicios de sesión: la persona toma el control y escribe ella misma en la vista en vivo. Nada de lo que
 *    tipea se guarda ni se registra; el agente nunca ve contraseñas.
 *  - Sin servicio o sin cupo: lo dice con claridad. Nunca muestra progreso ni capturas simuladas.
 */
import { h, icon } from './ui.js';
import * as engine from './chat/engine.js';

const WEB_ACTION = /(inici[aá]r? sesi[oó]n|\blog ?in\b|ingres[aá]r? a mi cuenta|envi[aá](r|me|le)? (un |el |los )?(correo|mail|email|e-mail)s?|postul(a|á|ar|ame|arme)\b|aplic(a|á|ar) a (empleos?|trabajos?|ofertas?|puestos?)|complet(a|á|ar) (el |un |los )?formularios?|linkedin|computrabajo|bumeran|zonajobs|indeed|mercado ?libre|clasificados?|public(a|á|ar) (un )?aviso|naveg(a|á|ar) (por|en)|entr(a|á|ar) (a|en) (la )?(web|p[aá]gina|sitio)|abr(í|i|ir) (la )?(web|p[aá]gina|sitio)|busc(a|á|ar) en (google|la web|internet)|wikipedia|computadora del agente)/i;

const SITES = [
  [/linkedin/i, 'https://www.linkedin.com/'], [/computrabajo/i, 'https://ar.computrabajo.com/'], [/bumeran/i, 'https://www.bumeran.com.ar/'],
  [/zonajobs/i, 'https://www.zonajobs.com.ar/'], [/indeed/i, 'https://ar.indeed.com/'], [/mercado ?libre/i, 'https://www.mercadolibre.com.ar/'],
  [/wikipedia/i, 'https://es.wikipedia.org/'], [/gmail|correo|mail/i, 'https://mail.google.com/']
];

export function needsWebAction(text) { return WEB_ACTION.test(String(text || '')); }
export function guessUrl(text) {
  const m = /\bhttps?:\/\/[^\s<>"']{4,300}/i.exec(text) || /\b([a-z0-9-]+\.)+(com|ar|net|org|io|dev|es|mx|co|br)(\.[a-z]{2})?(\/[^\s]*)?/i.exec(text);
  if (m) return m[0].startsWith('http') ? m[0] : 'https://' + m[0];
  for (const [re, url] of SITES) if (re.test(text)) return url;
  return null;
}
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const LIVE = new Set(['starting', 'ready', 'thinking', 'acting', 'awaiting_approval', 'needs_user', 'takeover', 'done']);

/** Tarjeta de aprobación: devuelve una promesa que resuelve true solo si la persona toca «Aprobar». */
export function approvalCard(container, text, detail) {
  return new Promise((resolve) => {
    const done = (v) => { card.querySelectorAll('button').forEach((b) => { b.disabled = true; }); card.classList.add(v ? 'approved' : 'denied'); card.querySelector('.ap-result').textContent = v ? 'Aprobado' : 'Cancelado'; resolve(v); };
    const card = h('div', { class: 'ab-approval', role: 'group', 'aria-label': 'Aprobación requerida' },
      h('div', { class: 'ap-head' }, h('span', { html: icon('shield') }), h('strong', {}, 'Necesito tu aprobación')),
      h('p', { class: 'ap-what' }, text),
      detail ? h('p', { class: 'ap-why small muted', 'data-no-i18n': '' }, detail) : null,
      h('div', { class: 'row' }, h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: () => done(true) }, 'Aprobar'), h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => done(false) }, 'Cancelar'), h('span', { class: 'ap-result small muted', 'aria-live': 'polite' })));
    container.append(card);
    card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

const STATUS_TEXT = {
  starting: 'Encendiendo la computadora', ready: 'Lista', thinking: 'Pensando el siguiente paso', acting: 'Trabajando en la página',
  awaiting_approval: 'Esperando tu aprobación', needs_user: 'Necesita tu ayuda', takeover: 'Tenés el control', done: 'Tarea terminada', ended: 'Sesión cerrada', error: 'No disponible'
};

export class AgentBrowserCard {
  /**
   * @param {{ thread: HTMLElement, composer: HTMLElement, text: string, isPaid?: boolean, idToken?: () => Promise<string|null>, onScroll?: () => void }} o
   */
  constructor(o) {
    this.o = o;
    this.goal = String(o.text || '').trim();
    this.url = guessUrl(this.goal);
    this.state = null;
    this.timer = 0; this.tick = 0;
    this.stopped = false; this.stepping = false; this.approving = false;
    this.device = window.matchMedia('(max-width: 700px)').matches ? 'mobile' : 'desktop';
    this.build();
    this.start();
  }

  build() {
    this.chip = h('div', { class: 'ab-chip', role: 'status' }, h('span', { class: 'ab-spin', 'aria-hidden': 'true' }), 'Encendiendo la computadora');
    this.o.composer.prepend(this.chip);
    this.pill = h('span', { class: 'ab-pill' }, h('span', { class: 'ab-dot' }), h('span', { class: 'ab-pill-text' }, 'Encendiendo la computadora'));
    this.clock = h('span', { class: 'ab-clock', title: 'Tiempo restante de la sesión', hidden: true }, h('span', { html: icon('clock') }), h('b', { 'data-no-i18n': '' }, ''));
    this.minBtn = h('button', { class: 'ab-btn', type: 'button', 'aria-label': 'Minimizar', html: icon('chevron'), onclick: () => this.toggleMin() });
    this.fullBtn = h('button', { class: 'ab-btn', type: 'button', 'aria-label': 'Pantalla completa', html: icon('expand'), onclick: () => this.toggleFull() });
    this.stopBtn = h('button', { class: 'ab-btn ab-stop', type: 'button', 'aria-label': 'Detener', title: 'Detener', html: icon('stop'), onclick: () => this.stop() });
    this.view = h('div', { class: 'ab-view' }, this.loader());
    this.addr = h('div', { class: 'ab-addr', hidden: true }, h('span', { html: icon('lock') }), h('span', { class: 'ab-addr-t', 'data-no-i18n': '' }, ''));
    this.planBox = h('div', { class: 'ab-plan', hidden: true });
    this.timeline = h('ol', { class: 'ab-steps' });
    this.stepsBox = h('details', { class: 'ab-timeline', hidden: true }, h('summary', {}, 'Pasos'), this.timeline);
    this.notice = h('div', { class: 'ab-notice', hidden: true });
    this.approvals = h('div', { class: 'ab-approvals' });
    this.result = h('div', { class: 'ab-result', hidden: true });
    this.takeBtn = h('button', { class: 'ab-tbtn', type: 'button', onclick: () => this.setTakeover(!(this.state && this.state.status === 'takeover')) }, h('span', { html: icon('keyboard') }), h('span', { class: 'ab-tbtn-t' }, 'Tomar el control'));
    this.controls = h('div', { class: 'ab-controls', hidden: true }, this.takeBtn,
      h('button', { class: 'ab-tbtn ab-tbtn-stop', type: 'button', onclick: () => this.stop() }, h('span', { html: icon('stop') }), 'Detener'));
    this.kb = this.keyboardBar();
    this.el = h('section', { class: 'ab-card', 'aria-label': 'Computadora del agente' },
      h('header', { class: 'ab-head' }, h('span', { class: 'ab-title', html: icon('monitor') + '<span>Computadora del agente</span>' }), this.pill, this.clock, h('span', { class: 'ab-actions' }, this.minBtn, this.fullBtn, this.stopBtn)),
      this.addr, this.view, this.kb, this.controls, this.notice, this.approvals, this.planBox, this.stepsBox, this.result);
    this.o.thread.append(this.el);
    this.o.onScroll && this.o.onScroll();
  }

  loader(text = 'Encendiendo la computadora') {
    return h('div', { class: 'ab-loader' }, h('div', { class: 'ab-orbit', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), h('p', {}, text), this.url ? h('small', { 'data-no-i18n': '' }, host(this.url)) : null);
  }

  /** Barra del modo "tomar el control": lo que escribís va directo a la página y no se guarda. */
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
  clearChip() { this.chip && this.chip.remove(); this.chip = null; }

  async api(path, { method = 'POST', body } = {}) {
    const headers = {};
    if (method !== 'GET') headers['Content-Type'] = 'application/json';
    const t = this.o.idToken ? await this.o.idToken().catch(() => null) : null;
    if (t) headers.Authorization = 'Bearer ' + t;
    const r = await fetch(engine.state.base + path, { method, credentials: 'include', headers, body: method !== 'GET' ? JSON.stringify(body || {}) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || 'error'); e.status = r.status; e.code = j.error; throw e; }
    return j;
  }

  /** Estado honesto cuando no se puede usar: sin pasos ni capturas simuladas. */
  unavailable(title, text, action) {
    this.clearChip();
    this.setPill('No disponible', 'off');
    this.fullBtn.hidden = true; this.stopBtn.hidden = true; this.controls.hidden = true; this.clock.hidden = true;
    this.view.replaceChildren(h('div', { class: 'ab-off' }, h('span', { class: 'ab-off-ic', html: icon('monitor') }), h('strong', {}, title), h('p', {}, text), action || null));
  }

  explain(e) {
    const ok = h('button', { class: 'btn btn-sm', type: 'button', onclick: () => this.el.remove() }, 'Entendido');
    if (e.status === 401) return this.unavailable('Ingresá con tu cuenta', 'La computadora del agente necesita una cuenta para proteger tus sesiones.', h('a', { class: 'btn btn-sm', href: '/cuenta/' }, 'Ingresar'));
    if (e.code === 'browser_quota_user') return this.unavailable('Usaste tus minutos de hoy', 'Tu cupo diario de la computadora del agente se renueva mañana. Con Pro o Empresa tenés más minutos.', h('a', { class: 'btn btn-sm btn-gold', href: '/planes.html' }, 'Ver planes'));
    if (e.code === 'browser_quota_global') return this.unavailable('La computadora del agente descansa por hoy', 'Se usó todo el tiempo de navegador disponible para hoy. Vuelve a estar lista mañana. No se realizó ninguna acción.', ok);
    if (e.code === 'browser_busy' || e.status === 429) return this.unavailable('Todas las computadoras están ocupadas', 'Probá de nuevo en un minuto. No se realizó ninguna acción.', ok);
    if (e.status === 503) return this.unavailable('La computadora del agente no está disponible', 'El servicio está en mantenimiento. No se realizó ninguna acción.', ok);
    return this.unavailable('No pude encender la computadora', 'Probá de nuevo en unos minutos. No se realizó ninguna acción.', ok);
  }

  async start() {
    const [st] = await Promise.all([engine.init(), new Promise((r) => setTimeout(r, 500))]);
    if (this.stopped) return;
    if (!st.live || !st.caps || !st.caps.browser) {
      this.unavailable('La computadora del agente no está disponible', 'No pude conectarme al servicio. Mientras tanto te guío para que lo hagas vos, sin compartir contraseñas.', h('button', { class: 'btn btn-sm', type: 'button', onclick: () => this.el.remove() }, 'Entendido'));
      return;
    }
    try {
      const s = await this.api('/api/agent/browser/start', { body: { goal: this.goal, url: this.url || undefined, device: this.device } });
      this.clearChip();
      this.img = h('img', { class: 'ab-frame', alt: 'Vista en vivo de la computadora del agente', decoding: 'async', draggable: 'false' });
      this.img.addEventListener('click', (ev) => this.onScreenClick(ev));
      this.view.replaceChildren(this.img, h('div', { class: 'ab-scan', 'aria-hidden': 'true' }));
      this.view.classList.add('is-live');
      this.view.dataset.device = s.device || this.device;
      this.controls.hidden = false; this.stepsBox.hidden = false;
      this.apply(s);
      this.tick = setInterval(() => this.renderClock(), 1000);
      this.poll();
      this.loop();
    } catch (e) { this.explain(e); }
  }

  /** Bucle del agente: mientras la sesión esté lista, pide el siguiente paso. Se pausa en aprobaciones, ayuda o control manual. */
  async loop() {
    if (this.stepping) return;
    this.stepping = true;
    try {
      while (!this.stopped && this.state && this.state.status === 'ready' && this.goal) {
        this.setPill('Pensando el siguiente paso', 'run');
        this.view.classList.add('is-busy');
        const s = await this.api('/api/agent/browser/agent', { body: {} });
        this.apply(s);
        await new Promise((r) => setTimeout(r, 350));
      }
    } catch (e) {
      if (e.code === 'no_session' || e.code === 'session_closed') this.ended();
      else this.showNotice('Se cortó la conexión con la computadora. Reintentando…', 'warn');
      if (!this.stopped) setTimeout(() => { this.stepping = false; this.loop(); }, 2500);
      return;
    } finally { this.view.classList.remove('is-busy'); }
    this.stepping = false;
  }

  apply(s) {
    if (!s || !s.status) return;
    this.state = s;
    if (s.image && this.img) this.img.src = s.image;
    if (s.viewport) this.view.style.setProperty('--ab-ar', `${s.viewport.width} / ${s.viewport.height}`);
    // Barra de dirección
    if (s.url) { this.addr.hidden = false; this.addr.querySelector('.ab-addr-t').textContent = s.host || host(s.url); }
    // Estado
    const kind = s.status === 'done' ? 'ok' : s.status === 'awaiting_approval' || s.status === 'needs_user' ? 'wait' : s.status === 'ended' ? 'off' : s.status === 'takeover' ? 'you' : 'run';
    this.setPill(STATUS_TEXT[s.status] || s.status, kind);
    this.el.dataset.status = s.status;
    this.renderClock();
    this.renderPlan(s);
    this.renderSteps(s.steps || []);
    // Modo control manual
    const take = s.status === 'takeover';
    this.kb.hidden = !take;
    this.view.classList.toggle('is-takeover', take);
    this.takeBtn.querySelector('.ab-tbtn-t').textContent = take ? 'Devolver el control' : 'Tomar el control';
    this.takeBtn.classList.toggle('on', take);
    // Aprobación
    if (s.status === 'awaiting_approval' && s.pending && !this.approving) this.askApproval(s.pending);
    // Necesita ayuda (login, captcha, dato)
    if (s.status === 'needs_user') this.showNotice(s.message || 'Necesito tu ayuda para seguir.', 'help', h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: () => this.setTakeover(true) }, 'Tomar el control'));
    else if (!this.noticeSticky) this.notice.hidden = true;
    // Resultado
    if (s.status === 'done' && s.summary) {
      this.result.hidden = false;
      this.result.replaceChildren(h('div', { class: 'ab-res-h' }, h('span', { html: icon('check') }), h('strong', {}, 'Resultado')), h('p', { 'data-no-i18n': '' }, s.summary),
        h('small', { class: 'muted' }, 'La computadora queda abierta unos minutos para que revises. Tocá Detener cuando termines.'));
    }
    if (s.status === 'ended') this.ended(s);
    this.o.onScroll && this.o.onScroll();
  }

  renderClock() {
    const s = this.state;
    if (!s || !s.deadline || !LIVE.has(s.status)) { this.clock.hidden = true; return; }
    const left = s.deadline - Date.now();
    this.clock.hidden = false;
    this.clock.querySelector('b').textContent = mmss(left);
    this.clock.classList.toggle('low', left < 45_000);
  }

  renderPlan(s) {
    const plan = s.plan || [];
    if (!plan.length) { this.planBox.hidden = true; return; }
    this.planBox.hidden = false;
    // Mientras espera aprobación, el último paso todavía no está hecho.
    const done = s.status === 'done' ? plan.length : Math.min(s.planDone || 0, s.status === 'awaiting_approval' ? plan.length - 1 : plan.length);
    this.planBox.replaceChildren(
      h('div', { class: 'ab-plan-h' }, h('strong', {}, 'Plan'), h('span', { class: 'muted', 'data-no-i18n': '' }, `${Math.min(done, plan.length)}/${plan.length}`)),
      h('ul', {}, ...plan.map((p, i) => h('li', { class: i < done ? 'ok' : i === done && LIVE.has(s.status) && s.status !== 'done' ? 'cur' : '' },
        h('span', { class: 'ab-ck', html: i < done ? icon('check') : '' }), h('span', { 'data-no-i18n': '' }, p)))));
  }

  renderSteps(steps) {
    this.timeline.replaceChildren(...steps.map((s) => h('li', { class: 'st-' + s.status }, h('span', { class: 'st-ic', 'aria-hidden': 'true' }), h('span', {}, s.label))));
  }

  showNotice(text, kind = 'info', action = null) {
    this.notice.hidden = false;
    this.notice.dataset.kind = kind;
    this.notice.replaceChildren(h('span', { html: icon(kind === 'help' ? 'user' : kind === 'warn' ? 'warn' : 'info') }), h('p', { 'data-no-i18n': kind === 'help' ? '' : null }, text), action);
  }

  async askApproval(pending) {
    this.approving = true;
    this.approvals.replaceChildren();
    const ok = await approvalCard(this.approvals, pending.label, pending.reason);
    try {
      this.setPill(ok ? 'Trabajando en la página' : 'Cancelado', ok ? 'run' : 'off');
      const s = await this.api('/api/agent/browser/approve', { body: { decision: ok ? 'approve' : 'cancel' } });
      this.approving = false;
      setTimeout(() => this.approvals.replaceChildren(), 1500);
      this.apply(s);
      this.loop();
    } catch (e) { this.approving = false; if (e.code === 'no_session') this.ended(); }
  }

  async setTakeover(on) {
    try {
      const s = await this.api('/api/agent/browser/takeover', { body: { on } });
      this.apply(s);
      if (on) { this.notice.hidden = true; this.kb.querySelector('.ab-kb-in').focus({ preventScroll: true }); }
      else this.loop();
    } catch (e) { if (e.code === 'no_session') this.ended(); }
  }

  onScreenClick(ev) {
    if (!this.state || this.state.status !== 'takeover') return;
    const r = this.img.getBoundingClientRect();
    const vw = this.state.viewport?.width || 1280, vh = this.state.viewport?.height || 800;
    // La imagen se muestra con object-fit: contain → calcular el área real ocupada.
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

  async poll() {
    if (this.stopped) return;
    if (!this.stepping || this.state?.status !== 'ready') {
      try { this.apply(await this.api('/api/agent/browser/frame', { method: 'GET' })); }
      catch (e) { if (e.status === 404 || e.code === 'no_session') { this.ended(); return; } }
    }
    const fast = this.state && (this.state.status === 'takeover' || this.state.status === 'acting');
    this.timer = setTimeout(() => this.poll(), document.hidden ? 5000 : fast ? 1200 : 2200);
  }

  ended(s) {
    if (this.stopped && this._endedShown) return;
    this.stopped = true; this._endedShown = true;
    clearTimeout(this.timer); clearInterval(this.tick);
    this.clearChip();
    this.kb.hidden = true; this.controls.hidden = true; this.clock.hidden = true; this.stopBtn.hidden = true;
    this.view.classList.remove('is-takeover', 'is-busy');
    this.setPill('Sesión cerrada', 'off');
    const reason = (s && s.endedReason) || (this.state && this.state.endedReason) || '';
    const txt = reason === 'time_limit' ? 'Se terminó el tiempo de esta sesión.' : reason === 'idle' ? 'La cerré por inactividad para cuidar tus minutos.' : 'Cerraste la computadora del agente.';
    if (this.result.hidden) { this.result.hidden = false; this.result.replaceChildren(h('div', { class: 'ab-res-h' }, h('span', { html: icon('power') }), h('strong', {}, 'Sesión cerrada')), h('p', {}, txt)); }
    else this.result.append(h('small', { class: 'muted ab-ended' }, txt));
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
