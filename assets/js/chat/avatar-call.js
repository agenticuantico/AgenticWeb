/**
 * Ventana flotante de "videollamada" (estilo imagen en imagen) que aparece cuando la persona manda una
 * nota de voz: muestra el avatar 3D, que procesa (pulsos dorados hacia el cerebro) y responde hablando
 * con gestos y labios sincronizados. Se puede arrastrar, ampliar a pantalla completa o cerrar.
 */
import { AgentAvatar } from './agent-avatar.js';
import { icon } from '../ui.js';

let instance = null;
export function getAvatarCall() { return instance || (instance = new AvatarCall()); }

class AvatarCall {
  constructor() {
    const el = document.createElement('section');
    el.className = 'agent-pip';
    el.hidden = true;
    el.setAttribute('aria-label', 'Videollamada con AgentiCuántico');
    el.innerHTML = `
      <div class="agent-pip-bar" data-drag>
        <span class="agent-pip-title"><span class="agent-pip-led"></span><strong>AgentiCuántico</strong><small data-role="pipStatus">En llamada</small></span>
        <span class="agent-pip-actions">
          <button type="button" class="agent-pip-btn" data-act="framing" aria-pressed="false" aria-label="Ver cuerpo entero" title="Ver cuerpo entero">${icon('body')}</button>
          <button type="button" class="agent-pip-btn" data-act="expand" aria-label="Ampliar" title="Ampliar">${icon('expand')}</button>
          <button type="button" class="agent-pip-btn" data-act="close" aria-label="Cerrar videollamada" title="Cerrar">${icon('close')}</button>
        </span>
      </div>
      <div class="agent-pip-stage"></div>
      <div class="agent-pip-foot"><a class="agent-pip-link" href="/llamada/">Abrir llamada de voz</a></div>`;
    document.body.appendChild(el);
    this.el = el;
    this.avatar = new AgentAvatar(el.querySelector('.agent-pip-stage'), { framing: 'waist' });
    this.statusEl = el.querySelector('[data-role="pipStatus"]');
    this.onClose = null;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const act = b.dataset.act;
      if (act === 'close') this.close(true);
      else if (act === 'expand') this.toggleFull();
      else if (act === 'framing') {
        const full = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', String(full));
        b.setAttribute('aria-label', full ? 'Ver medio cuerpo' : 'Ver cuerpo entero');
        b.title = b.getAttribute('aria-label');
        this.avatar.setFraming(full ? 'full' : 'waist');
      }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && el.classList.contains('is-full')) this.toggleFull(false); });
    this._drag();
  }
  _drag() {
    const bar = this.el.querySelector('[data-drag]');
    let st = null;
    bar.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button') || this.el.classList.contains('is-full')) return;
      const r = this.el.getBoundingClientRect();
      st = { x: e.clientX, y: e.clientY, l: r.left, t: r.top, w: r.width, h: r.height };
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener('pointermove', (e) => {
      if (!st) return;
      const l = Math.max(6, Math.min(innerWidth - st.w - 6, st.l + e.clientX - st.x));
      const t = Math.max(6, Math.min(innerHeight - st.h - 6, st.t + e.clientY - st.y));
      this._moved = true;
      Object.assign(this.el.style, { left: l + 'px', top: t + 'px', right: 'auto', bottom: 'auto' });
    });
    const end = () => { st = null; };
    bar.addEventListener('pointerup', end); bar.addEventListener('pointercancel', end);
  }
  /** avoid: elemento que no debe quedar tapado (el compositor del chat que abrió la llamada). */
  open(avoid) {
    if (this.el.hidden) {
      this.el.hidden = false;
      if (!this._moved && avoid) this._dodge(avoid);
      requestAnimationFrame(() => this.el.classList.add('is-open'));
    }
    this.avatar.load();
  }
  _dodge(avoid) {
    if (this.el.classList.contains('is-full')) return;
    const a = avoid.getBoundingClientRect(), p = this.el.getBoundingClientRect();
    const hit = !(p.right < a.left || p.left > a.right || p.bottom < a.top || p.top > a.bottom);
    if (!hit) return;
    if (innerWidth >= 641) {
      // a la derecha del chat si hay lugar; si no, encima del compositor
      if (innerWidth - a.right >= p.width + 24) Object.assign(this.el.style, { left: (innerWidth - p.width - 16) + 'px', right: 'auto' });
      else if (a.top - p.height - 12 > 8) Object.assign(this.el.style, { top: (a.top - p.height - 12) + 'px', bottom: 'auto' });
      else Object.assign(this.el.style, { left: Math.max(8, a.left - p.width - 12) + 'px', right: 'auto' });
    }
  }
  close(user) {
    this.el.classList.remove('is-open', 'is-full');
    this.el.hidden = true;
    document.documentElement.classList.remove('agent-pip-lock');
    if (user && this.onClose) this.onClose();
  }
  toggleFull(force) {
    const on = force ?? !this.el.classList.contains('is-full');
    this.el.classList.toggle('is-full', on);
    document.documentElement.classList.toggle('agent-pip-lock', on);
    const b = this.el.querySelector('[data-act="expand"]');
    b.setAttribute('aria-label', on ? 'Reducir' : 'Ampliar'); b.title = b.getAttribute('aria-label');
    b.innerHTML = icon(on ? 'collapse' : 'expand');
    if (on) { this.el.style.left = this.el.style.top = this.el.style.right = this.el.style.bottom = ''; }
  }
  get isOpen() { return !this.el.hidden; }
  get state() { return this.avatar.state; }
  setState(s) {
    this.avatar.setState(s);
    this.el.dataset.state = s;
    this.statusEl.textContent = s === 'thinking' ? 'Procesando…' : s === 'talking' ? 'Hablando' : s === 'listening' ? 'Escuchando' : 'En llamada';
  }
  setVisemes(v) { this.avatar.setVisemes(v); }
  setLevel(v) { this.avatar.setLevel(v); }
  pulse() { this.avatar.pulse(); }
}
