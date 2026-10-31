/**
 * Navegador del agente: tarjeta en vivo dentro del chat.
 *  - Con el servidor y el binding BROWSER activos (GET /api/health → browser: true) abre una sesión real
 *    (POST /api/agent/browser/start), muestra capturas reales (GET .../frame), el paso actual y la línea de tiempo.
 *  - Antes de cualquier acción irreversible el servidor responde 428 y la tarjeta pide aprobación explícita.
 *  - Sin servidor o sin el binding: lo dice con claridad. Nunca muestra progreso ni capturas simuladas.
 */
import { h, icon } from './ui.js';
import * as engine from './chat/engine.js';

const WEB_ACTION = /(inici[aá]r? sesi[oó]n|\blog ?in\b|ingres[aá]r? a mi cuenta|envi[aá](r|me|le)? (un |el |los )?(correo|mail|email|e-mail)s?|postul(a|á|ar|ame|arme)\b|aplic(a|á|ar) a (empleos?|trabajos?|ofertas?|puestos?)|complet(a|á|ar) (el |un |los )?formularios?|linkedin|computrabajo|bumeran|zonajobs|indeed|mercado ?libre|clasificados?|public(a|á|ar) (un )?aviso|naveg(a|á|ar) (por|en)|entr(a|á|ar) (a|en) (la )?(web|p[aá]gina|sitio))/i;

const SITES = [
  [/linkedin/i, 'https://www.linkedin.com/'], [/computrabajo/i, 'https://ar.computrabajo.com/'], [/bumeran/i, 'https://www.bumeran.com.ar/'],
  [/zonajobs/i, 'https://www.zonajobs.com.ar/'], [/indeed/i, 'https://ar.indeed.com/'], [/mercado ?libre/i, 'https://www.mercadolibre.com.ar/'],
  [/gmail|correo|mail/i, 'https://mail.google.com/']
];

export function needsWebAction(text) { return WEB_ACTION.test(String(text || '')); }
export function guessUrl(text) {
  const m = /\bhttps?:\/\/[^\s<>"']{4,300}/i.exec(text) || /\b([a-z0-9-]+\.)+(com|ar|net|org|io|dev|es|mx|co)(\.[a-z]{2})?(\/[^\s]*)?/i.exec(text);
  if (m) return m[0].startsWith('http') ? m[0] : 'https://' + m[0];
  for (const [re, url] of SITES) if (re.test(text)) return url;
  return null;
}
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

/** Tarjeta de aprobación: devuelve una promesa que resuelve true solo si la persona toca «Aprobar». */
export function approvalCard(container, text) {
  return new Promise((resolve) => {
    const done = (v) => { card.querySelectorAll('button').forEach((b) => { b.disabled = true; }); card.classList.add(v ? 'approved' : 'denied'); card.querySelector('.ap-result').textContent = v ? 'Aprobado' : 'No aprobado'; resolve(v); };
    const card = h('div', { class: 'ab-approval', role: 'group', 'aria-label': 'Aprobación requerida' },
      h('div', { class: 'ap-head' }, h('span', { html: icon('shield') }), h('strong', {}, 'Necesito tu aprobación')),
      h('p', {}, text),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: () => done(true) }, 'Aprobar'), h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => done(false) }, 'Cancelar'), h('span', { class: 'ap-result small muted', 'aria-live': 'polite' })));
    container.append(card);
    card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

export class AgentBrowserCard {
  /**
   * @param {{ thread: HTMLElement, composer: HTMLElement, text: string, isPaid: boolean, idToken?: () => Promise<string|null>, onScroll?: () => void }} o
   */
  constructor(o) {
    this.o = o;
    this.url = guessUrl(o.text);
    this.steps = [];
    this.timer = 0;
    this.stopped = false;
    this.build();
    this.start();
  }

  build() {
    this.chip = h('div', { class: 'ab-chip', role: 'status' }, h('span', { class: 'ab-spin', 'aria-hidden': 'true' }), 'Cargando un navegador');
    this.o.composer.prepend(this.chip);
    this.pill = h('span', { class: 'ab-pill' }, h('span', { class: 'ab-dot' }), h('span', { class: 'ab-pill-text' }, 'Cargando un navegador'));
    this.minBtn = h('button', { class: 'ab-btn', type: 'button', 'aria-label': 'Minimizar', html: icon('chevron'), onclick: () => this.toggleMin() });
    this.fullBtn = h('button', { class: 'ab-btn', type: 'button', 'aria-label': 'Pantalla completa', html: icon('expand'), onclick: () => this.toggleFull() });
    this.stopBtn = h('button', { class: 'ab-btn', type: 'button', 'aria-label': 'Detener navegador', html: icon('close'), onclick: () => this.stop('Detenido por vos') });
    this.view = h('div', { class: 'ab-view' }, this.loader());
    this.timeline = h('ol', { class: 'ab-steps' });
    this.stepsBox = h('details', { class: 'ab-timeline' }, h('summary', {}, 'Pasos'), this.timeline);
    this.result = h('div', { class: 'ab-result', hidden: true });
    this.approvals = h('div', { class: 'ab-approvals' });
    this.el = h('section', { class: 'ab-card', 'aria-label': 'Navegador del agente' },
      h('header', { class: 'ab-head' }, h('span', { class: 'ab-title', html: icon('globe') + '<span>Navegador del agente</span>' }), this.pill, h('span', { class: 'ab-actions' }, this.minBtn, this.fullBtn, this.stopBtn)),
      this.view, this.stepsBox, this.approvals, this.result);
    this.o.thread.append(this.el);
    this.o.onScroll && this.o.onScroll();
  }

  loader() {
    return h('div', { class: 'ab-loader' }, h('div', { class: 'ab-orbit', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), h('p', {}, 'Cargando un navegador'), this.url ? h('small', {}, host(this.url)) : null);
  }

  setPill(text, kind = 'run') { this.pill.dataset.kind = kind; this.pill.querySelector('.ab-pill-text').textContent = text; }
  clearChip() { this.chip && this.chip.remove(); this.chip = null; }

  async api(path, { method = 'POST', body } = {}) {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    const t = this.o.idToken ? await this.o.idToken().catch(() => null) : null;
    if (t) headers.Authorization = 'Bearer ' + t;
    const r = await fetch(engine.state.base + path, { method, credentials: 'include', headers, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || 'error'); e.status = r.status; e.code = j.error; throw e; }
    return j;
  }

  /** Estado honesto cuando el servicio no está disponible: sin pasos ni capturas simuladas. */
  unavailable(title, text, action) {
    this.clearChip();
    this.setPill('No disponible', 'off');
    this.fullBtn.hidden = true;
    this.stepsBox.hidden = true;
    this.view.replaceChildren(h('div', { class: 'ab-off' }, h('span', { class: 'ab-off-ic', html: icon('globe') }), h('strong', {}, title), h('p', {}, text), action || null));
  }

  async start() {
    const [st] = await Promise.all([engine.init(), new Promise((r) => setTimeout(r, 900))]);
    if (this.stopped) return;
    if (!st.live || !st.caps || !st.caps.browser) {
      this.unavailable('El navegador en la nube se habilita al conectar el servidor', 'Cuando esté activo, voy a poder abrir sitios, completar formularios y mostrarte cada paso en vivo, pidiéndote aprobación antes de enviar o publicar. Mientras tanto te guío para que lo hagas vos, sin compartir contraseñas.',
        h('button', { class: 'btn btn-sm', type: 'button', onclick: () => this.el.remove() }, 'Entendido'));
      return;
    }
    if (!this.o.isPaid) {
      this.unavailable('Disponible en los planes Pro y Empresa', 'El navegador del agente actúa en la web por vos, con tu aprobación en cada paso importante.', h('a', { class: 'btn btn-sm btn-gold', href: '/planes.html' }, 'Ver planes'));
      return;
    }
    try {
      const s = await this.api('/api/agent/browser/start', { body: { url: this.url || undefined } });
      this.clearChip();
      this.applySteps(s.steps);
      this.view.replaceChildren(h('img', { class: 'ab-frame', alt: 'Vista en vivo del navegador del agente', decoding: 'async' }));
      this.poll();
    } catch (e) {
      if (e.status === 503) this.unavailable('El navegador en la nube se habilita al conectar el servidor', 'El servicio de navegador todavía no está conectado. No se realizó ninguna acción.');
      else if (e.status === 402) this.unavailable('Disponible en los planes Pro y Empresa', 'Mejorá tu plan para usar el navegador del agente.', h('a', { class: 'btn btn-sm btn-gold', href: '/planes.html' }, 'Ver planes'));
      else if (e.status === 401) this.unavailable('Ingresá con tu cuenta', 'El navegador del agente necesita una cuenta para proteger tus sesiones.', h('a', { class: 'btn btn-sm', href: '/cuenta/' }, 'Ingresar'));
      else this.unavailable('No pude abrir el navegador', 'Probá de nuevo en unos minutos. No se realizó ninguna acción.');
    }
  }

  applySteps(steps = []) {
    this.steps = steps;
    this.timeline.replaceChildren(...steps.map((s) => h('li', { class: 'st-' + s.status }, h('span', { class: 'st-ic', 'aria-hidden': 'true' }), h('span', {}, s.label))));
    const cur = [...steps].reverse().find((s) => s.status === 'running') || steps[steps.length - 1];
    if (cur) this.setPill(cur.status === 'error' ? 'Paso con error: ' + cur.label : cur.label, cur.status === 'error' ? 'err' : 'run');
  }

  async poll() {
    if (this.stopped) return;
    try {
      const f = await this.api('/api/agent/browser/frame', { method: 'GET' });
      const img = this.view.querySelector('.ab-frame');
      if (img && f.image) img.src = f.image;
      this.applySteps(f.steps);
    } catch (e) { if (e.status === 404) { this.finish('La sesión terminó.'); return; } }
    this.timer = setTimeout(() => this.poll(), document.hidden ? 4000 : 1500);
  }

  /** Ejecuta un paso; si el servidor pide aprobación (428), muestra la tarjeta y reintenta solo si la persona aprueba. */
  async step(action, description) {
    try { return await this.api('/api/agent/browser/step', { body: { action } }); }
    catch (e) {
      if (e.status !== 428) throw e;
      const ok = await approvalCard(this.approvals, description || 'El siguiente paso envía o publica información. ¿Lo apruebo?');
      if (!ok) { this.setPill('Esperando tu decisión', 'off'); return null; }
      return this.api('/api/agent/browser/step', { body: { action, approved: true } });
    }
  }

  finish(summary) {
    this.stopped = true;
    clearTimeout(this.timer);
    this.clearChip();
    this.setPill('Listo', 'ok');
    this.result.hidden = false;
    this.result.replaceChildren(h('strong', {}, 'Resultado'), h('p', {}, summary));
  }

  async stop(reason) {
    if (this.stopped) { this.el.remove(); return; }
    this.stopped = true;
    clearTimeout(this.timer);
    this.clearChip();
    if (engine.state.live && engine.state.caps && engine.state.caps.browser) await this.api('/api/agent/browser/stop').catch(() => {});
    this.finish(reason || 'Navegador cerrado.');
    this.setPill('Detenido', 'off');
  }

  toggleMin() { const m = this.el.classList.toggle('is-min'); this.minBtn.setAttribute('aria-label', m ? 'Expandir' : 'Minimizar'); }
  toggleFull() {
    const f = this.el.classList.toggle('is-full');
    this.fullBtn.setAttribute('aria-label', f ? 'Salir de pantalla completa' : 'Pantalla completa');
    document.body.classList.toggle('ab-lock', f);
    if (f) { this._esc = (e) => { if (e.key === 'Escape') this.toggleFull(); }; document.addEventListener('keydown', this._esc); }
    else document.removeEventListener('keydown', this._esc);
  }
}
