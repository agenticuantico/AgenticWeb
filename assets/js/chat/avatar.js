/**
 * Escenario del avatar: carga perezosa del runtime 3D cuando el contenedor se acerca a la pantalla,
 * imagen estática si no hay WebGL, si el usuario prefiere menos movimiento o si ahorra datos.
 * Expone una API estable aunque el 3D no esté cargado (las llamadas se ignoran o se encolan).
 */
import { prefersReducedMotion } from '../ui.js';

const MODEL = '/media/avatar/agenticuantico.vrm';
const POSTER = '/media/avatar/avatar-poster.webp';

function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

export class AvatarStage {
  constructor(el, { eager = false, label = 'Avatar 3D de AgentiCuántico' } = {}) {
    this.el = el;
    this.api = null;
    this.state = 'idle';
    this.listeners = new Set();
    el.classList.add('avatar-stage');
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', label);
    el.dataset.state = 'idle';
    el.innerHTML = `<img class="avatar-poster" src="${POSTER}" alt="" width="640" height="800" decoding="async"><div class="avatar-aura" aria-hidden="true"></div><div class="avatar-signals" aria-hidden="true"></div><span class="avatar-status" aria-live="polite"></span>`;
    this.statusEl = el.querySelector('.avatar-status');
    const saveData = navigator.connection && navigator.connection.saveData;
    if (!webglOK() || prefersReducedMotion()) { el.dataset.mode = 'static'; return; }
    if (saveData && !eager) { el.dataset.mode = 'static'; this._offerLoad(); return; }
    if (eager || !('IntersectionObserver' in window)) { this.load(); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); this._idle(() => this.load()); } }, { rootMargin: '250px 0px' });
    io.observe(el);
  }

  _idle(fn) { ('requestIdleCallback' in window) ? requestIdleCallback(fn, { timeout: 1800 }) : setTimeout(fn, 300); }

  _offerLoad() {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn btn-sm avatar-load';
    b.textContent = 'Ver avatar 3D (≈3,5 MB)';
    b.onclick = () => { b.remove(); this.load(); };
    this.el.append(b);
  }

  async load() {
    if (this.loading) return this.loading;
    this.el.dataset.mode = 'loading';
    const canvas = document.createElement('canvas');
    canvas.className = 'avatar-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    this.el.prepend(canvas);
    this.loading = import('/assets/vendor/avatar-runtime.js')
      .then((m) => m.createAvatar(canvas, { url: MODEL, onProgress: (p) => this.el.style.setProperty('--load', p) }))
      .then((api) => {
        this.api = api;
        api.setState(this.state);
        this.el.dataset.mode = '3d';
        this.listeners.forEach((fn) => fn(this));
        return api;
      })
      .catch((e) => {
        console.warn('[avatar] 3D no disponible:', e && e.message);
        canvas.remove();
        this.el.dataset.mode = 'static';
      });
    return this.loading;
  }

  onReady(fn) { this.listeners.add(fn); if (this.api) fn(this); }

  /** idle | listening | thinking | talking */
  setState(s) {
    this.state = s;
    this.el.dataset.state = s;
    this.statusEl.textContent = { idle: '', listening: 'Escuchando', thinking: 'Procesando', talking: 'Hablando' }[s] || '';
    this.api && this.api.setState(s);
  }
  pulse(strength = 0.5) {
    this.api && this.api.pulse(strength);
    // también en modo estático: destello de señal
    this.el.classList.remove('pulse'); void this.el.offsetWidth; this.el.classList.add('pulse');
  }
  setVisemes(v) { this.api && this.api.setVisemes(v); }
}
