/**
 * Avatar de AgentiCuántico: retrato fijo (cerebro dorado) como póster y respaldo, y avatar 3D realista
 * (medio cuerpo, gestos, labios sincronizados, secuencia neuronal) que se carga solo cuando se usa.
 * API compatible con AvatarStage: setState, setVisemes, setLevel, pulse, load, onReady, state.
 */
import { AvatarStage } from './avatar.js?v=7.20.0';

const LABELS = { idle: '', listening: 'Escuchando', thinking: 'Procesando…', talking: 'Hablando' };
const MODEL = '/media/avatar/agente.glb?v=7.20.0';

/** ¿Conviene el 3D en este dispositivo? (WebGL, sin movimiento reducido, sin ahorro de datos ni poca memoria) */
export function canUse3D() {
  try {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    if (navigator.connection && navigator.connection.saveData) return false;
    if (navigator.deviceMemory && navigator.deviceMemory < 2) return false;
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

export class AgentAvatar {
  constructor(el, { label = 'AgentiCuántico, inteligencia artificial', framing = 'waist' } = {}) {
    this.el = el;
    this.state = 'idle';
    this.framing = framing;
    this.a3 = null;
    el.classList.add('agent-av');
    el.innerHTML = '<div class="agent-av-poster"></div><div class="agent-av-3d" aria-hidden="true"></div><span class="agent-av-status" aria-live="polite"></span><span class="agent-av-load" hidden></span>';
    this.portrait = new AvatarStage(el.querySelector('.agent-av-poster'), { label });
    this.holder = el.querySelector('.agent-av-3d');
    this.statusEl = el.querySelector('.agent-av-status');
    this.loadEl = el.querySelector('.agent-av-load');
    this._ready = [];
    el._agentAvatar = this;
  }

  /* El personaje animado (2.5D) ya está listo: el modelo 3D anterior quedó fuera de uso (otro personaje). */
  load() {
    if (!this._allow3d) return Promise.resolve(null);
    if (this._p) return this._p;
    if (!canUse3D()) { this.el.classList.add('no-3d'); this._p = Promise.resolve(null); return this._p; }
    this.loadEl.hidden = false; this.loadEl.textContent = 'Cargando avatar…';
    this._p = import('../../vendor/a3d/agent3d.js?v=7.20.0')
      .then((m) => m.createAgent3D(this.holder, {
        modelUrl: MODEL, framing: this.framing,
        onProgress: (p) => { this.loadEl.textContent = `Cargando avatar… ${Math.round(p * 100)}%`; },
      }))
      .then((a) => {
        this.a3 = a;
        a.setState(this.state);
        this.el.classList.add('is-3d');
        this.loadEl.hidden = true;
        this._ready.splice(0).forEach((fn) => fn(this));
        return a;
      })
      .catch((e) => { console.warn('avatar 3D no disponible', e && e.message); this.el.classList.add('no-3d'); this.loadEl.hidden = true; return null; });
    return this._p;
  }
  onReady(fn) { if (this.a3) fn(this); else this._ready.push(fn); }

  setState(s) {
    this.state = s;
    this.el.dataset.state = s;
    this.statusEl.textContent = LABELS[s] || '';
    this.portrait.setState(s);
    this.a3 && this.a3.setState(s);
  }
  setVisemes(v) { this.portrait.setVisemes(v); this.a3 && this.a3.setVisemes(v); }
  setLevel(lv) { this.portrait.setLevel(lv); this.a3 && this.a3.setLevel(lv); }
  pulse() { this.portrait.pulse(); this.a3 && this.a3.pulse(); }
  setFraming(m) { this.framing = m; this.portrait.setFraming && this.portrait.setFraming(m); this.a3 && this.a3.setFraming(m); }
}
