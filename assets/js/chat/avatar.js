/**
 * Retrato de AgentiCuántico (la IA del cerebro dorado en casco de cristal).
 * Reemplaza al antiguo avatar 3D: imagen fija + sinapsis doradas animadas en canvas,
 * brillo y "respiración" sincronizados con el nivel de la voz. Misma API que antes:
 * setState(idle|listening|thinking|talking), pulse(), setVisemes(v), load(), onReady().
 */
import { prefersReducedMotion } from '../ui.js';

const IMG_W = 614, IMG_H = 768;
/* Nodos del árbol dorado (coordenadas en la imagen recortada 614x768). */
const NODES = [
  [361, 236], [379, 205], [331, 198], [405, 178], [347, 262], [389, 252], [313, 230], [425, 224],
  [367, 290], [339, 160], [409, 145], [287, 200], [445, 196], [319, 280], [379, 320], [455, 262],
  [274, 245], [431, 300], [354, 128], [489, 230], [299, 160], [477, 170], [394, 110], [259, 210]
];
const LABELS = { idle: '', listening: 'Escuchando', thinking: 'Pensando', talking: 'Hablando' };

export class AvatarStage {
  constructor(el, { label = 'AgentiCuántico, inteligencia artificial' } = {}) {
    this.el = el;
    this.state = 'idle';
    this.level = 0;
    el.classList.add('avatar-stage', 'portrait-stage');
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', label);
    el.dataset.state = 'idle';
    el.dataset.mode = 'portrait';
    el.innerHTML = `<div class="portrait-zoom"><picture><source type="image/webp" srcset="/media/agenticuantico-portrait.webp"><img class="portrait-img" src="/media/agenticuantico-portrait.jpg" alt="" width="${IMG_W}" height="${IMG_H}" decoding="async"></picture><canvas class="portrait-canvas" aria-hidden="true"></canvas></div><div class="portrait-glow" aria-hidden="true"></div><span class="avatar-status" aria-live="polite"></span>`;
    this.statusEl = el.querySelector('.avatar-status');
    this.canvas = el.querySelector('.portrait-canvas');
    this._startCanvas();
  }

  _startCanvas() {
    const c = this.canvas, ctx = c.getContext && c.getContext('2d');
    if (!ctx) return;
    const reduce = prefersReducedMotion();
    const links = [];
    for (let i = 0; i < NODES.length; i++) for (let j = i + 1; j < NODES.length; j++) {
      if (Math.hypot(NODES[i][0] - NODES[j][0], NODES[i][1] - NODES[j][1]) < 62) links.push([i, j]);
    }
    let w = 0, h = 0, pts = [], sparks = [];
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const layout = () => {
      w = Math.max(1, c.clientWidth); h = Math.max(1, c.clientHeight);
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const s = Math.max(w / IMG_W, h / IMG_H), ox = (w - IMG_W * s) / 2, oy = (h - IMG_H * s) * 0.3;
      pts = NODES.map((n, i) => ({ x: ox + n[0] * s, y: oy + n[1] * s, ph: i * 0.77, r: 1.6 + (i % 4) * 0.6 }));
    };
    layout();
    if ('ResizeObserver' in window) new ResizeObserver(layout).observe(c); else addEventListener('resize', layout);
    const t0 = performance.now();
    let smooth = 0;
    const frame = (now) => {
      const st = this.state;
      const target = st === 'talking' ? Math.max(0.3, this.level) : st === 'thinking' ? 0.5 : st === 'listening' ? 0.22 : 0.08;
      smooth += (target - smooth) * 0.2;
      const speed = st === 'thinking' ? 2.4 : st === 'talking' ? 1.8 : 1;
      const t = (now - t0) / 1000 * speed;
      this.el.style.setProperty('--lvl', smooth.toFixed(3));
      ctx.clearRect(0, 0, w, h);
      const col = st === 'thinking' ? '196,140,255' : st === 'listening' ? '159,255,0' : '255,211,110';
      ctx.lineWidth = 1;
      for (const [a, b] of links) {
        const A = pts[a], B = pts[b];
        const al = (0.08 + 0.4 * smooth) * (0.5 + 0.5 * Math.sin(t * 2 + A.ph));
        ctx.strokeStyle = `rgba(${col},${al.toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
      }
      if (!reduce && links.length && Math.random() < 0.04 + smooth * 0.5) {
        const l = links[(Math.random() * links.length) | 0];
        sparks.push({ a: l[0], b: l[1], p: 0 });
      }
      sparks = sparks.filter((s) => (s.p += 0.03 + smooth * 0.05) < 1);
      for (const s of sparks) {
        const A = pts[s.a], B = pts[s.b];
        const x = A.x + (B.x - A.x) * s.p, y = A.y + (B.y - A.y) * s.p;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 7);
        g.addColorStop(0, `rgba(${col},.95)`); g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
      }
      for (const p of pts) {
        const a = 0.2 + 0.65 * smooth * (0.5 + 0.5 * Math.sin(t * 3 + p.ph));
        ctx.fillStyle = `rgba(${col},${a.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + smooth * 0.8), 0, Math.PI * 2); ctx.fill();
      }
      if (!document.hidden) requestAnimationFrame(frame); else setTimeout(() => requestAnimationFrame(frame), 400);
    };
    requestAnimationFrame(frame);
  }

  /* El retrato siempre está listo (no hay modelo 3D que descargar). */
  load() { return Promise.resolve(this); }
  onReady(fn) { fn(this); }

  setState(s) {
    this.state = s;
    this.el.dataset.state = s;
    this.statusEl.textContent = LABELS[s] || '';
    if (s !== 'talking') this.level = 0;
  }
  pulse() { this.el.classList.remove('pulse'); void this.el.offsetWidth; this.el.classList.add('pulse'); }
  /** Visemas de la voz → nivel de audio para el brillo y la respiración. */
  setVisemes(v) { this.level = v ? Math.min(1, (v.aa || 0) + (v.oh || 0) + (v.ee || 0) + (v.ih || 0) * 0.5 + 0.1) : 0; }
  setLevel(lv) { this.level = Math.max(0, Math.min(1, lv || 0)); }
}
