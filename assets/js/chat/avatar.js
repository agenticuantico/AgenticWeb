/**
 * Personaje animado de AgentiCuántico (ilustración 3D estilizada generada con IA, personaje propio).
 * Técnica 2.5D liviana, sin servicios pagos: poses completas (neutral, saludo, escuchando, pensando,
 * explicando) que se funden entre sí + capas de boca, ojos y cejas sobre la cara.
 *  - En espera: respira, parpadea y se balancea apenas.          - Escuchando: se inclina y asiente.
 *  - Pensando: mano en el mentón y mirada hacia arriba.         - Hablando: labios sincronizados con el audio
 *    de la voz (visemas de voice.js), gestos con las manos y cejas que acompañan los énfasis.
 * Con «reducir movimiento» no hay balanceo ni inclinaciones: solo cambian la pose y la boca.
 * Misma API que antes: setState(idle|listening|thinking|talking), pulse(), setVisemes(v), setLevel(l), load(), onReady().
 */
import { prefersReducedMotion } from '../ui.js';

const V = '7.7.0';
const IMG_W = 640, IMG_H = 954;
/* Capas sobre la cara (x, y, ancho, alto en % de la pose); salen de tooling/avatar/build_sprites.py */
const PATCH = {
  'm-a': [35.377, 37.975, 29.481, 16.614], 'm-e': [35.377, 37.975, 29.481, 16.614], 'm-o': [35.377, 37.975, 29.481, 16.614],
  'm-mb': [35.377, 37.975, 29.481, 16.614], 'm-f': [35.377, 37.975, 29.481, 16.614],
  'e-half': [31.84, 29.668, 36.557, 9.889], 'e-closed': [31.84, 29.668, 36.557, 9.889],
  'b-up': [34.198, 26.503, 33.019, 5.934]
};
/* Miradas para seguir el cursor (portada): izquierda→derecha, arriba y abajo; misma luz, ropa y encuadre que la neutral */
const LOOKS = ['l2', 'l1', 'r1', 'r2', 'up', 'down'];
const MOUTHS = ['m-a', 'm-e', 'm-o', 'm-mb', 'm-f'];
/* Poses donde la cara es idéntica a la neutral (las capas de boca/ojos encajan al píxel) */
const FACE_OK = new Set(['neutral', 'explain']);
const LABELS = { idle: '', listening: 'Escuchando', thinking: 'Pensando', talking: 'Hablando' };
const url = (n, ext = 'webp') => `/media/avatar/${n}.${ext}?v=${V}`;
const rnd = (a, b) => a + Math.random() * (b - a);

export class AvatarStage {
  /**
   * @param {HTMLElement} el
   * @param {{label?: string, fit?: 'cover'|'contain', focus?: number, greet?: boolean}} opts
   *   fit cover = recorta como una videollamada (cara arriba); contain = personaje entero (portada).
   */
  constructor(el, { label = 'AgentiCuántico, asistente de inteligencia artificial', fit = 'cover', focus = 0.12, greet = false, track = false, lite = false } = {}) {
    this.lite = lite; // portada: solo seguir el cursor, respirar y parpadear (sin poses, gestos ni boca: más liviano)
    this.track = track && !prefersReducedMotion();
    this.el = el;
    this.fit = fit; this.focus = focus;
    this.state = 'idle';
    this.level = 0; this.vis = null;
    this.reduce = prefersReducedMotion();
    el.classList.add('avatar-stage', 'portrait-stage', 'char-stage');
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', label);
    el.dataset.state = 'idle';
    el.dataset.mode = 'portrait';
    const first = greet && !lite && !this.reduce ? 'wave' : 'neutral';
    const pose = (n, eager) => `<picture class="ch-pose" data-p="${n}"${n === first ? ' data-on' : ''}><source type="image/avif" srcset="${eager ? url('pose-' + n, 'avif') : ''}" data-srcset="${url('pose-' + n, 'avif')}"><source type="image/webp" srcset="${eager ? url('pose-' + n) : ''}" data-srcset="${url('pose-' + n)}"><img src="${eager ? url('pose-' + n, n === 'neutral' || n === 'wave' ? 'jpg' : 'webp') : 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='}" data-src="${url('pose-' + n)}" alt="" width="${IMG_W}" height="${IMG_H}" decoding="async"${eager ? ' fetchpriority="high"' : ''}></picture>`;
    const layers = Object.entries(PATCH).filter(([n]) => !lite || n.startsWith('e-')).map(([n, [x, y, w, h]]) => `<img class="ch-layer" data-l="${n}" data-src="${url(n)}" alt="" decoding="async" style="left:${x}%;top:${y}%;width:${w}%;height:${h}%">`).join('');
    el.innerHTML = `<div class="ch-body"><div class="ch-figure">${(lite ? ['neutral'] : ['neutral', 'wave', 'listen', 'think', 'explain']).map((n) => pose(n, n === 'neutral' || n === first)).join('')}${this.track ? LOOKS.map((k) => `<img class="ch-look" data-k="${k}" data-src="${url('look-' + k)}" alt="" width="${IMG_W}" height="${IMG_H}" decoding="async" style="opacity:0">`).join('') : ''}<div class="ch-face">${layers}</div></div></div><span class="avatar-status" aria-live="polite"></span>`;
    this.statusEl = el.querySelector('.avatar-status');
    this.body = el.querySelector('.ch-body');
    this.fig = el.querySelector('.ch-figure');
    this.faceEl = el.querySelector('.ch-face');
    this.poses = {}; el.querySelectorAll('.ch-pose').forEach((p) => { this.poses[p.dataset.p] = p; });
    this.looks = {}; el.querySelectorAll('.ch-look').forEach((i) => { this.looks[i.dataset.k] = i; });
    this.lookOp = Object.fromEntries(LOOKS.map((k) => [k, 0]));
    this.gaze = { x: 0, y: 0, until: 0, idleNext: 0, frame: 'c' };
    if (this.track) this._bindTracking();
    this.layer = {}; el.querySelectorAll('.ch-layer').forEach((i) => { this.layer[i.dataset.l] = i; });
    this.op = Object.fromEntries(Object.keys(this.layer || PATCH).map((k) => [k, 0]));
    this.pose = first;
    this.mouth = 'closed'; this.mouthSince = 0; this.lastOpen = 0;
    this.blink = { next: performance.now() + rnd(1500, 3500), t: -1, double: false };
    this.brow = { until: 0, next: 0 };
    this.gesture = { next: 0 };
    this.nod = { next: 0, t: -1 };
    this._loadRest();
    this._layout();
    if (first === 'wave') this._greetTimer = setTimeout(() => { if (this.state === 'idle') this._setPose('neutral'); }, 2600);
    this._loop();
  }

  /* El resto de las poses y capas se bajan cuando el navegador está libre (la primera pinta enseguida). */
  _loadRest() {
    const go = () => {
      this.el.querySelectorAll('[data-srcset]').forEach((s) => { if (!s.srcset) s.srcset = s.dataset.srcset; });
      this.el.querySelectorAll('img[data-src]').forEach((i) => { const cur = i.getAttribute('src'); if (!cur || cur.startsWith('data:')) i.src = i.dataset.src; });
    };
    (window.requestIdleCallback || ((f) => setTimeout(f, 600)))(go, { timeout: 2500 });
  }

  _layout() {
    const fit = () => {
      const W = Math.max(1, this.el.clientWidth), H = Math.max(1, this.el.clientHeight);
      const s = this.fit === 'contain' ? Math.min(W / IMG_W, H / IMG_H) : Math.max(W / IMG_W, H / IMG_H);
      const w = IMG_W * s, h = IMG_H * s;
      const f = this.fig.style;
      f.width = w + 'px'; f.height = h + 'px';
      f.left = (W - w) / 2 + 'px';
      f.top = (this.fit === 'contain' ? H - h : Math.min(0, (H - h) * this.focus)) + 'px';
    };
    fit();
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(this.el); else addEventListener('resize', fit);
  }

  _setPose(n) {
    if (n === this.pose || !this.poses[n]) return;
    this.poses[this.pose].removeAttribute('data-on');
    this.poses[n].setAttribute('data-on', '');
    this.pose = n;
    this.el.dataset.pose = n;
  }

  _pickMouth(now) {
    const v = this.vis;
    if (this.state !== 'talking' || !v || !FACE_OK.has(this.pose) || this._lookSum > 0.05) return 'closed';
    const open = (v.aa || 0) + (v.oh || 0) + (v.ou || 0) * 0.6 + (v.ee || 0) + (v.ih || 0) * 0.4;
    if (open < 0.09) return now - this.lastOpen < 110 ? 'm-mb' : 'closed'; // cierre de labios entre sílabas (m/b/p)
    this.lastOpen = now;
    const round = (v.oh || 0) + (v.ou || 0) * 1.4, wide = (v.ee || 0) + (v.ih || 0) * 0.8, aa = v.aa || 0;
    if (open < 0.22) return wide > (aa + round) * 1.1 ? 'm-f' : 'm-mb'; // fricativas suaves (f/v/s) o labios casi juntos
    if (round > aa * 1.05 && round >= wide) return 'm-o';
    if (wide > aa * 1.1) return 'm-e';
    return 'm-a';
  }

  _blinkFrame(now) {
    const b = this.blink;
    if (!FACE_OK.has(this.pose) || this._lookSum > 0.05) { if (now > b.next) b.next = now + rnd(800, 1600); return null; }
    if (b.t < 0) { if (now < b.next) return null; b.t = now; }
    const d = now - b.t;
    if (d < 50) return 'e-half'; if (d < 125) return 'e-closed'; if (d < 180) return 'e-half';
    b.t = -1;
    if (!b.double && Math.random() < 0.15) { b.double = true; b.next = now + 120; }
    else { b.double = false; b.next = now + rnd(2600, 6200) * (this.state === 'talking' ? 0.8 : 1); }
    return null;
  }

  _loop() {
    const t0 = performance.now();
    let smooth = 0, last = t0;
    // ruido suave (suma de senos con fases al azar) para que el balanceo no se note como un bucle
    const ph = [rnd(0, 6), rnd(0, 6), rnd(0, 6), rnd(0, 6)];
    const noise = (t, k) => Math.sin(t * 0.61 + ph[k]) * 0.6 + Math.sin(t * 1.37 + ph[(k + 1) % 4]) * 0.3 + Math.sin(t * 2.13 + ph[(k + 2) % 4]) * 0.1;
    const frame = (now) => {
      const dt = Math.min(64, now - last); last = now;
      const st = this.state;
      const t = (now - t0) / 1000;
      const target = st === 'talking' ? Math.max(0.2, this.level) : st === 'thinking' ? 0.3 : st === 'listening' ? 0.25 : 0.05;
      smooth += (target - smooth) * Math.min(1, dt / 90);
      this.el.style.setProperty('--lvl', smooth.toFixed(3));

      // pose según el estado; al hablar alterna gestos (manos) cada pocos segundos
      if (st === 'talking') {
        if (now > this.gesture.next) {
          this._setPose(this.pose === 'explain' ? 'neutral' : (Math.random() < 0.65 ? 'explain' : 'neutral'));
          this.gesture.next = now + rnd(1800, 3800);
        }
      }

      // boca: forma con tiempo mínimo de 65 ms y fundido corto (sin titileo)
      const want = this._pickMouth(now);
      if (want !== this.mouth && now - this.mouthSince > 65) { this.mouth = want; this.mouthSince = now; }
      const eyes = this._blinkFrame(now);
      // cejas: suben en los picos de la voz (énfasis), como mucho una vez cada ~2 s
      if (st === 'talking' && FACE_OK.has(this.pose) && this.level > 0.62 && now > this.brow.next) { this.brow.until = now + rnd(380, 700); this.brow.next = now + rnd(1800, 3200); }
      const browOn = now < this.brow.until && FACE_OK.has(this.pose);
      const k = this.reduce ? 1 : Math.min(1, dt / 40);
      for (const n of Object.keys(this.layer)) {
        const on = MOUTHS.includes(n) ? this.mouth === n : n === 'b-up' ? browOn : eyes === n;
        const kk = n.startsWith('e-') ? 1 : n === 'b-up' ? Math.min(1, dt / 120) : k;
        const o = this.op[n] + ((on ? 1 : 0) - this.op[n]) * kk;
        this.op[n] = o < 0.01 ? 0 : o;
        this.layer[n].style.opacity = this.op[n].toFixed(3);
      }

      if (this.track) this._trackFrame(now, dt);

      // cuerpo: respiración, balanceo, inclinación al escuchar, asentir, movimiento de cabeza al hablar
      if (!this.reduce) {
        const breath = Math.sin(t * 2 * Math.PI / 4.4);
        let rot = noise(t * 0.8, 0) * 0.7, tx = noise(t * 0.7, 1) * 0.35, ty = breath * 0.45, sc = 1 + breath * 0.0045;
        if (st === 'listening') {
          sc += 0.018; ty -= 3; rot += 0.8;
          if (now > this.nod.next) { this.nod.t = now; this.nod.next = now + rnd(2200, 3600); }
          const nd = now - this.nod.t;
          if (this.nod.t > 0 && nd < 700) ty += Math.sin(nd / 700 * Math.PI) * 4;
        } else if (st === 'thinking') {
          rot = noise(t * 0.4, 2) * 0.5; tx = noise(t * 0.35, 3) * 0.5;
        } else if (st === 'talking') {
          rot += noise(t * 2.2, 2) * 1.1 * smooth; ty -= Math.abs(noise(t * 3.1, 3)) * 2.2 * smooth;
        }
        if (this.track) { tx += this.gaze.sx * 3; ty += this.gaze.sy * 2; rot += this.gaze.sx * 0.6; }
        this.body.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) rotate(${rot.toFixed(3)}deg) scale(${sc.toFixed(4)})`;
      }
      if (!document.hidden) requestAnimationFrame(frame); else setTimeout(() => requestAnimationFrame(frame), 400);
    };
    requestAnimationFrame(frame);
  }

  /* Seguimiento del cursor: el mouse (o el último toque) marca hacia dónde mira; sin puntero, mira alrededor sola. */
  _bindTracking() {
    this._lookSum = 0; this.gaze.sx = 0; this.gaze.sy = 0;
    let visible = true;
    if ('IntersectionObserver' in window) new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(this.el);
    const aim = (px, py, hold) => {
      if (!visible) return;
      const r = this.el.getBoundingClientRect();
      const fw = this.fig.offsetWidth || r.width;
      const cx = r.left + r.width / 2, cy = r.top + (parseFloat(this.fig.style.top) || 0) + (this.fig.offsetHeight || r.height) * 0.36;
      const span = Math.max(fw * 1.1, Math.min(innerWidth, 900) * 0.42);
      this.gaze.x = Math.max(-1, Math.min(1, (px - cx) / span));
      this.gaze.y = Math.max(-1, Math.min(1, (py - cy) / (span * 1.15)));
      this.gaze.until = performance.now() + hold;
    };
    addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') aim(e.clientX, e.clientY, 6000); }, { passive: true });
    addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') aim(e.clientX, e.clientY, 2600); }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => { this.gaze.until = 0; });
  }

  _trackFrame(now, dt) {
    const g = this.gaze;
    let x = g.x, y = g.y;
    if (this.state !== 'idle' || this.pose !== 'neutral') { x = 0; y = 0; }
    else if (now > g.until) {
      // sin puntero: mira alrededor con calma
      if (now > g.idleNext) { const pick = [[0, 0], [0, 0], [-0.5, 0], [0.5, 0], [-0.95, 0.1], [0.95, 0.1], [0, -0.8], [0.2, 0.7]][Math.floor(Math.random() * 8)]; g.ix = pick[0]; g.iy = pick[1]; g.idleNext = now + rnd(1800, 4200); }
      x = g.ix || 0; y = g.iy || 0;
    }
    // cuadro más cercano, con histéresis para no titilar en el borde
    const cur = g.frame;
    const pickX = (v) => (v < -0.62 ? 'l2' : v < -0.2 ? 'l1' : v > 0.62 ? 'r2' : v > 0.2 ? 'r1' : 'c');
    let f = Math.abs(y) > 0.5 && Math.abs(y) > Math.abs(x) * 1.3 ? (y < 0 ? 'up' : 'down') : pickX(x);
    if (f !== cur && cur !== 'c' && cur !== 'up' && cur !== 'down') { const m = pickX(x + (x > 0 ? -0.08 : 0.08)); if (m === cur) f = cur; }
    g.frame = f;
    const k = Math.min(1, dt / 110);
    let sum = 0;
    for (const n of LOOKS) {
      const o = this.lookOp[n] + ((n === f ? 1 : 0) - this.lookOp[n]) * k;
      this.lookOp[n] = o < 0.01 ? 0 : o > 0.995 ? 1 : o; sum += this.lookOp[n];
      this.looks[n].style.opacity = this.lookOp[n].toFixed(3);
    }
    this._lookSum = sum;
    const ks = Math.min(1, dt / 220);
    g.sx += (x - g.sx) * ks; g.sy += (y - g.sy) * ks;
  }

  /* Siempre listo: no hay modelo 3D que descargar. */
  load() { return Promise.resolve(this); }
  onReady(fn) { fn(this); }

  setState(s) {
    if (!LABELS.hasOwnProperty(s)) s = 'idle';
    const prev = this.state;
    this.state = s;
    this.el.dataset.state = s;
    this.statusEl.textContent = LABELS[s] || '';
    clearTimeout(this._greetTimer);
    if (s === 'listening') this._setPose('listen');
    else if (s === 'thinking') this._setPose('think');
    else if (s === 'talking') { if (prev !== 'talking') { this._setPose('neutral'); this.gesture.next = performance.now() + rnd(500, 1400); } }
    else this._setPose('neutral');
    if (s !== 'talking') { this.level = 0; this.vis = null; }
  }
  pulse() { this.el.classList.remove('pulse'); void this.el.offsetWidth; this.el.classList.add('pulse'); }
  /** Visemas de la voz (voice.js: aa, oh, ou, ee, ih) → forma de la boca, cejas y movimiento. */
  setVisemes(v) {
    this.vis = v || null;
    this.level = v ? Math.min(1, (v.aa || 0) + (v.oh || 0) + (v.ee || 0) + (v.ih || 0) * 0.5 + 0.1) : 0;
  }
  setLevel(lv) {
    this.level = Math.max(0, Math.min(1, lv || 0));
    if (!this.vis && this.state === 'talking' && this.level > 0.1) this.vis = { aa: this.level * 0.7 };
  }
  /** Saludo con la mano (portada, bienvenida). */
  greet(ms = 2400) {
    if (this.reduce || this.state !== 'idle') return;
    this._setPose('wave'); clearTimeout(this._greetTimer);
    this._greetTimer = setTimeout(() => { if (this.state === 'idle') this._setPose('neutral'); }, ms);
  }
}
