/**
 * Personaje animado de AgentiCuántico (ilustración 3D estilizada generada con IA, personaje propio).
 *
 * Dos modos:
 *  - Portada (lite): solo respira, parpadea y sigue el cursor con la mirada (sin gestos ni boca).
 *  - Llamada (chat, ventana chica, ampliada y /llamada/): «rig» 2D por capas. El cuerpo es una sola imagen fija
 *    y cada antebrazo con su mano es una capa aparte que SIEMPRE está en pantalla: entre una posición y otra
 *    la mano viaja en arco alrededor del codo (rotación + escala con aceleración suave, un pequeño rebote al
 *    llegar) y la forma de la mano cambia en el camino. Nunca se cambia la pose entera, así que las manos no
 *    aparecen ni desaparecen. Gestos guiados por la voz: empiezan al comienzo de cada frase o en los énfasis,
 *    se sostienen 0,6–1,5 s y vuelven a reposo en las pausas; al quedarse en silencio, reposo.
 *  - Labios: envolvente de la voz suavizada (subida ~60 ms, bajada ~140 ms), cada forma dura al menos 100 ms,
 *    como mucho 7 cambios por segundo, fundido de ~70 ms, apertura parcial según el volumen y boca cerrada
 *    en silencios de más de 150 ms. Si se conoce el texto que se está diciendo, las vocales (A/E/O) y los
 *    cierres M-B-P salen del texto. La mandíbula acompaña apenas.
 * Con «reducir movimiento»: sin balanceo ni gestos (manos quietas en reposo), solo boca y parpadeo.
 * API: setState(idle|listening|thinking|talking), pulse(), setVisemes(v), setLevel(l), setFraming(m), load(), onReady(), greet().
 */
import { prefersReducedMotion } from '../ui.js';

const V = '7.19.1';
const IMG_W = 640, IMG_H = 954;
/* Capas sobre la cara (x, y, ancho, alto en % de la imagen); salen de tooling/avatar/build_sprites.py */
const PATCH = {
  'm-a': [35.377, 37.975, 29.481, 16.614], 'm-e': [35.377, 37.975, 29.481, 16.614], 'm-o': [35.377, 37.975, 29.481, 16.614],
  'm-mb': [35.377, 37.975, 29.481, 16.614], 'm-f': [35.377, 37.975, 29.481, 16.614],
  'e-half': [31.84, 29.668, 36.557, 9.889], 'e-closed': [31.84, 29.668, 36.557, 9.889],
  'b-up': [34.198, 26.503, 33.019, 5.934]
};
/* Brazos (tooling/avatar/arms/export.py): pivote en el codo y, por posición de mano, ángulo/radio del centro de
   la mano respecto del codo (unidades de la imagen fuente) + recuadros en % de la mano (h) y de la manga (b). */
const ARMS = {
  pivot: { L: [17.689, 96.915], R: [82.311, 96.915] },
  keys: {
    'open-L': { ang: -91.38, rad: 236.2, h: [4.127, 69.778, 27.005, 16.218], b: [0, 68.987, 36.439, 31.013] },
    'open-R': { ang: -88.32, rad: 233.2, h: [69.222, 69.858, 26.887, 16.297], b: [63.679, 68.987, 36.321, 31.013] },
    'rest-L': { ang: -51.13, rad: 256.2, h: [21.226, 74.604, 29.481, 14.478], b: [0, 68.987, 36.439, 31.013] },
    'rest-R': { ang: -129.92, rad: 258.4, h: [48.585, 74.604, 30.425, 14.161], b: [63.679, 68.987, 36.321, 31.013] },
    'point-L': { ang: -86.75, rad: 321.2, h: [8.608, 55.538, 24.764, 29.193], b: [0, 68.987, 36.439, 31.013] }
  }
};
/* Combinaciones de gestos [izquierda de la imagen, derecha] con su peso */
const GESTURES = [[['open', 'open'], 3], [['open', 'rest'], 2], [['rest', 'open'], 2], [['point', 'rest'], 1.2], [['point', 'open'], 1]];
/* Parte baja de las manos en reposo (fracción del alto): el encuadre de la llamada siempre la deja a la vista */
const HANDS_BOTTOM = 0.93, HEAD_TOP = 0.03, HANDS_SPAN = 0.95;
/* Miradas para seguir el cursor (portada): izquierda→derecha, arriba y abajo; misma luz, ropa y encuadre que la neutral */
const LOOKS = ['l2', 'l1', 'r1', 'r2', 'up', 'down'];
const MOUTHS = ['m-a', 'm-e', 'm-o', 'm-mb', 'm-f'];
const LABELS = { idle: '', listening: 'Escuchando', thinking: 'Pensando', talking: 'Hablando' };
const url = (n, ext = 'webp') => `/media/avatar/${n}.${ext}?v=${V}`;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeIO = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const ease = (dt, tau) => 1 - Math.exp(-dt / tau);

/* Texto que se está diciendo (voice.js avisa con el evento «ac-speech»): sirve para elegir vocales y momentos de gesto */
let SPEECH = null;
if (typeof window !== 'undefined') {
  addEventListener('ac-speech', (e) => {
    const d = e.detail || {};
    if (!d.text) { SPEECH = null; return; }
    const text = String(d.text);
    const dur = d.dur > 200 ? d.dur : text.length * 62;
    // comienzos de frase y palabras de énfasis → momentos (ms desde el inicio) en los que conviene gesticular
    const cues = [0];
    const re = /[,.;:!?¡¿…]+\s+|\n+/g; let m;
    while ((m = re.exec(text))) cues.push((m.index + m[0].length) / text.length * dur);
    const re2 = /[¡¿]|\b\d+|\b[A-ZÁÉÍÓÚÑ]{3,}\b|\b(muy|nunca|siempre|todo|nada|importante|clave|primero|segundo|además|pero)\b/gi;
    while ((m = re2.exec(text))) cues.push(m.index / text.length * dur);
    SPEECH = { text: text.toLowerCase(), start: d.start || performance.now(), dur, cues: [...new Set(cues.map((c) => Math.round(c)))].sort((a, b) => a - b) };
  });
}
function charShape(ch) {
  if ('aá'.includes(ch)) return 'm-a';
  if ('eéiíy'.includes(ch)) return 'm-e';
  if ('oóuúw'.includes(ch)) return 'm-o';
  if ('mbp'.includes(ch)) return 'm-mb';
  if ('fv'.includes(ch)) return 'm-f';
  return null;
}

export class AvatarStage {
  /**
   * @param {HTMLElement} el
   * @param {{label?: string, fit?: 'cover'|'contain', focus?: number, greet?: boolean, track?: boolean, lite?: boolean}} opts
   *   fit cover = encuadre de videollamada (cabeza y manos siempre a la vista); contain = personaje entero.
   */
  constructor(el, { label = 'AgentiCuántico, asistente de inteligencia artificial', fit = 'cover', focus = 0.12, greet = false, track = false, lite = false } = {}) {
    this.lite = lite; // portada: solo seguir el cursor, respirar y parpadear (sin gestos ni boca: más liviano)
    this.rig = !lite;
    this.track = track && !prefersReducedMotion();
    this.el = el;
    this.fit = fit; this.focus = focus;
    this.state = 'idle';
    this.level = 0; this.vis = null;
    this.reduce = prefersReducedMotion();
    el.classList.add('avatar-stage', 'portrait-stage', 'char-stage');
    if (this.rig) el.classList.add('char-rig');
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', label);
    el.dataset.state = 'idle';
    el.dataset.mode = 'portrait';
    const base = `<picture class="ch-pose" data-p="neutral" data-on><source type="image/avif" srcset="${url('pose-neutral', 'avif')}"><source type="image/webp" srcset="${url('pose-neutral')}"><img src="${url('pose-neutral', 'jpg')}" alt="" width="${IMG_W}" height="${IMG_H}" decoding="async" fetchpriority="high"></picture>`;
    const layers = Object.entries(PATCH).filter(([n]) => !lite || n.startsWith('e-')).map(([n, [x, y, w, h]]) => `<img class="ch-layer${MOUTHS.includes(n) ? ' ch-mouth' : ''}" data-l="${n}" data-src="${url(n)}" alt="" decoding="async" style="left:${x}%;top:${y}%;width:${w}%;height:${h}%">`).join('');
    const looks = this.track ? LOOKS : this.rig ? ['up'] : [];
    let arms = '';
    if (this.rig) {
      const box = ([x, y, w, h]) => `left:${x}%;top:${y}%;width:${w}%;height:${h}%`;
      const keys = Object.entries(ARMS.keys);
      arms = '<div class="ch-arms">' +
        keys.map(([n, k]) => `<img class="ch-armb" data-a="${n}" data-src="${url('arm-' + n + '-b')}" alt="" decoding="async" style="${box(k.b)};opacity:${n.startsWith('rest') ? 1 : 0}">`).join('') +
        keys.map(([n, k]) => {
          const [px, py] = ARMS.pivot[n.slice(-1)];
          const ox = ((px - k.h[0]) / k.h[2] * 100).toFixed(2), oy = ((py - k.h[1]) / k.h[3] * 100).toFixed(2);
          return `<img class="ch-armh" data-a="${n}" data-src="${url('arm-' + n + '-h')}" alt="" decoding="async" style="${box(k.h)};transform-origin:${ox}% ${oy}%;opacity:${n.startsWith('rest') ? 1 : 0}">`;
        }).join('') + '</div>';
    }
    el.innerHTML = `<div class="ch-body"><div class="ch-figure">${base}${looks.map((k) => `<img class="ch-look" data-k="${k}" data-src="${url('look-' + k)}" alt="" width="${IMG_W}" height="${IMG_H}" decoding="async" style="opacity:0">`).join('')}<div class="ch-face">${layers}</div>${arms}</div></div><span class="avatar-status" aria-live="polite"></span>`;
    this.statusEl = el.querySelector('.avatar-status');
    this.body = el.querySelector('.ch-body');
    this.fig = el.querySelector('.ch-figure');
    this.looks = {}; el.querySelectorAll('.ch-look').forEach((i) => { this.looks[i.dataset.k] = i; });
    this.lookKeys = Object.keys(this.looks);
    this.lookOp = Object.fromEntries(this.lookKeys.map((k) => [k, 0]));
    this._lookSum = 0;
    this.gaze = { x: 0, y: 0, sx: 0, sy: 0, until: 0, idleNext: 0, frame: 'c' };
    if (this.track) this._bindTracking();
    this.layer = {}; el.querySelectorAll('.ch-layer').forEach((i) => { this.layer[i.dataset.l] = i; });
    this.op = Object.fromEntries(Object.keys(this.layer).map((k) => [k, 0]));
    this.mouthEls = MOUTHS.map((n) => this.layer[n]).filter(Boolean);
    this.mouth = 'closed'; this.mouthSince = 0; this.mouthChanges = [];
    this.lip = { env: 0, silent: 999, shape: 'closed' };
    this.blink = { next: performance.now() + rnd(1500, 3500), t: -1, double: false };
    this.brow = { until: 0, next: 0 };
    this.nod = { next: 0, t: -1 };
    if (this.rig) this._initArms();
    this._loadRest();
    this._layout();
    if (greet && this.rig) this._greetTimer = setTimeout(() => this.greet(1400), 500);
    this._loop();
  }

  /* El resto de las capas se bajan cuando el navegador está libre (la imagen base pinta enseguida). */
  _loadRest() {
    const go = () => {
      this.el.querySelectorAll('img[data-src]').forEach((i) => { const cur = i.getAttribute('src'); if (!cur || cur.startsWith('data:')) i.src = i.dataset.src; });
    };
    // las manos en reposo se piden enseguida: tienen que estar desde el primer momento
    this.el.querySelectorAll('.ch-armh[data-a^="rest"], .ch-armb[data-a^="rest"]').forEach((i) => { i.src = i.dataset.src; });
    (window.requestIdleCallback || ((f) => setTimeout(f, 600)))(go, { timeout: 2500 });
  }

  _layout() {
    const fit = () => {
      const W = Math.max(1, this.el.clientWidth), H = Math.max(1, this.el.clientHeight);
      let s, top;
      if (this.fit === 'contain' || this.framing === 'full') {
        s = Math.min(W / IMG_W, H / IMG_H); top = H - IMG_H * s;
      } else {
        s = Math.max(W / IMG_W, H / IMG_H);
        // en la llamada las manos tienen que verse siempre (también abiertas a los costados): si el recorte las
        // tapa, se aleja la cámara; el resto del cuadro se completa con el mismo fondo
        if (this.rig) s = Math.min(s, W / (IMG_W * HANDS_SPAN), H / (IMG_H * (HANDS_BOTTOM - HEAD_TOP)));
        const h0 = IMG_H * s;
        if (h0 <= H) top = H - h0;
        else {
          top = Math.min(0, (H - h0) * this.focus);
          if (this.rig) top = clamp(top, H - h0 * HANDS_BOTTOM, -h0 * HEAD_TOP);
        }
      }
      const w = IMG_W * s, h = IMG_H * s;
      const f = this.fig.style;
      f.width = w + 'px'; f.height = h + 'px';
      f.left = (W - w) / 2 + 'px';
      f.top = top + 'px';
      this.el.classList.toggle('ch-narrow', w < W - 2);
      this.el.classList.toggle('ch-short', top > 1);
      this.figH = h;
    };
    this._fit = fit;
    fit();
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(this.el); else addEventListener('resize', fit);
  }

  /* ---------- Brazos ---------- */
  _initArms() {
    this.armB = {}; this.armH = {};
    this.el.querySelectorAll('.ch-armb').forEach((i) => { this.armB[i.dataset.a] = i; });
    this.armH = {}; this.el.querySelectorAll('.ch-armh').forEach((i) => { this.armH[i.dataset.a] = i; });
    const now = performance.now();
    this.arm = {
      L: { from: 'rest', to: 'rest', t0: 0, dur: 1, settleT: -1, settleA: 0, beatT: -1, beatAmp: 0 },
      R: { from: 'rest', to: 'rest', t0: 0, dur: 1, settleT: -1, settleA: 0, beatT: -1, beatAmp: 0 }
    };
    this.gest = { phase: 'rest', until: 0, nextAllowed: now + 400, last: [], cueIdx: 0, talkSince: 0, lastEnd: now, beatNext: 0, prevEnv: 0 };
  }
  /* Lleva una mano a otra posición: si estaba a mitad de camino, primero termina el tramo actual. */
  _armTo(side, key, now, dur) {
    const a = this.arm[side];
    if (!ARMS.keys[`${key}-${side}`]) key = 'open';
    if (a.to === key) return;
    if (a.from !== a.to && now - a.t0 < a.dur) { a.queued = key; return; }
    const ka = ARMS.keys[`${a.to}-${side}`], kb = ARMS.keys[`${key}-${side}`];
    a.from = a.to; a.to = key; a.t0 = now;
    // más lejos = más tiempo (como una persona): 300–520 ms
    const dAng = Math.abs(kb.ang - ka.ang);
    a.dur = this.reduce ? 1 : (dur || clamp(300 + dAng * 4.5, 300, 520)) * rnd(0.92, 1.1);
    a.queued = null;
  }
  _armsFrame(now, t, breath) {
    for (const side of ['L', 'R']) {
      const a = this.arm[side];
      const ka = ARMS.keys[`${a.from}-${side}`], kb = ARMS.keys[`${a.to}-${side}`];
      let p = a.from === a.to ? 1 : clamp((now - a.t0) / a.dur, 0, 1);
      if (p >= 1 && a.from !== a.to) {
        // llegó: rebote chico en la dirección del movimiento (seguimiento natural)
        a.settleT = now; a.settleA = clamp((kb.ang - ka.ang) * 0.07, -3, 3);
        a.from = a.to; p = 1;
        if (a.queued) { const q = a.queued; a.queued = null; this._armTo(side, q, now); }
      }
      const q = easeIO(p);
      const dAng = kb.ang - ka.ang, rho = kb.rad / ka.rad;
      // movimiento propio constante (nunca un bucle exacto): ruido suave + respiración en los hombros
      let micro = 0, beat = 0;
      if (!this.reduce) {
        micro = (Math.sin(t * 0.83 + (side === 'L' ? 0 : 2.1)) * 0.6 + Math.sin(t * 1.91 + (side === 'L' ? 1.3 : 0.4)) * 0.35) * (a.to === 'rest' ? 0.5 : 1.1);
        if (a.settleT > 0) { const d = now - a.settleT; if (d < 700) micro += a.settleA * Math.exp(-d / 170) * Math.cos(d / 95); else a.settleT = -1; }
        if (a.beatT > 0) { const d = now - a.beatT; if (d < 320) beat = Math.sin(d / 320 * Math.PI) * a.beatAmp; else a.beatT = -1; }
      }
      const lift = this.reduce ? 0 : breath * 0.35; // los hombros suben apenas al inhalar (en % del alto de la mano)
      const ty = (beat * 4 - lift).toFixed(2);
      const sameKey = a.from === a.to;
      // manga: fundido en el lugar (no se mueve); mano: viaja en arco alrededor del codo
      for (const k of ['rest', 'open', 'point']) {
        const n = `${k}-${side}`;
        const hb = this.armB[n], hh = this.armH[n];
        if (!hb) continue;
        let ob = 0, oh = 0, tr = '';
        if (sameKey) {
          if (k === a.to) { ob = 1; oh = 1; tr = `translate3d(0,${ty}%,0) rotate(${micro.toFixed(2)}deg)`; }
        } else if (k === a.from) {
          ob = 1 - ss(0.3, 0.8, p); oh = 1 - ss(0.5, 0.92, p);
          tr = `translate3d(0,${ty}%,0) rotate(${(dAng * q + micro).toFixed(2)}deg) scale(${(1 + (rho - 1) * q).toFixed(4)})`;
        } else if (k === a.to) {
          ob = ss(0.2, 0.7, p); oh = ss(0.12, 0.6, p);
          tr = `translate3d(0,${ty}%,0) rotate(${(-dAng * (1 - q) + micro).toFixed(2)}deg) scale(${(1 / rho + (1 - 1 / rho) * q).toFixed(4)})`;
        }
        if (hb._o !== ob) { hb.style.opacity = ob.toFixed(3); hb._o = ob; }
        if (hh._o !== oh) { hh.style.opacity = oh.toFixed(3); hh._o = oh; }
        if (oh > 0 && hh._t !== tr) { hh.style.transform = tr; hh._t = tr; }
      }
    }
  }
  /* Gestos según la voz: comienzo de frase/énfasis → gesto; pausa → reposo; silencio → quieta. */
  _gestureFrame(now, env, silent) {
    const g = this.gest;
    if (this.reduce) return;
    if (this.state !== 'talking') {
      if (g.phase !== 'rest') { g.phase = 'rest'; this._armTo('L', 'rest', now); this._armTo('R', 'rest', now); }
      g.talkSince = 0;
      return;
    }
    if (!g.talkSince) g.talkSince = now;
    // momentos sugeridos por el texto (comienzo de frase, signos, números, palabras de énfasis)
    let cue = false;
    if (SPEECH) {
      if (g.speech !== SPEECH) { g.speech = SPEECH; g.cueIdx = 0; }
      const tt = now - SPEECH.start;
      while (g.cueIdx < SPEECH.cues.length && SPEECH.cues[g.cueIdx] <= tt) { if (tt - SPEECH.cues[g.cueIdx] < 250) cue = true; g.cueIdx++; }
    }
    const rising = env - g.prevEnv; g.prevEnv = env;
    const onset = env > 0.32 && rising > 0.004 && g.wasSilent;
    if (silent > 120) g.wasSilent = true; else if (env > 0.32) g.wasSilent = false;
    if (g.phase === 'rest') {
      const long = now - g.lastEnd > rnd(1500, 2600) && silent < 60 && env > 0.25;
      if (now >= g.nextAllowed && (cue || onset || long) && silent < 120) {
        if (Math.random() < (long ? 0.9 : 0.72)) this._startGesture(now);
        else g.nextAllowed = now + rnd(300, 700);
      }
    } else {
      // golpecitos de énfasis mientras sostiene el gesto
      if (env > 0.58 && rising > 0.01 && now > g.beatNext) {
        for (const s of ['L', 'R']) { const a = this.arm[s]; if (a.to !== 'rest') { a.beatT = now + (s === 'R' ? 30 : 0); a.beatAmp = rnd(0.6, 1); } }
        g.beatNext = now + rnd(380, 720);
      }
      if (silent > 260 || now > g.until) {
        if (silent < 120 && env > 0.3 && Math.random() < 0.35) this._startGesture(now); // encadena otro gesto
        else { g.phase = 'rest'; g.lastEnd = now; g.nextAllowed = now + rnd(350, 900); this._armTo('L', 'rest', now); this._armTo('R', 'rest', now); }
      }
    }
  }
  _startGesture(now) {
    const g = this.gest;
    const cur = `${this.arm.L.to}|${this.arm.R.to}`;
    const pool = GESTURES.filter(([c]) => { const k = c.join('|'); return k !== cur && !g.last.includes(k); });
    const list = pool.length ? pool : GESTURES;
    let r = Math.random() * list.reduce((s, [, w]) => s + w, 0), pick = list[0][0];
    for (const [c, w] of list) { r -= w; if (r <= 0) { pick = c; break; } }
    g.last = [pick.join('|'), ...g.last].slice(0, 2);
    // una mano arranca apenas antes que la otra (superposición natural)
    const lead = Math.random() < 0.5 ? 'L' : 'R';
    this._armTo(lead, pick[lead === 'L' ? 0 : 1], now);
    setTimeout(() => this._armTo(lead === 'L' ? 'R' : 'L', pick[lead === 'L' ? 1 : 0], performance.now()), rnd(40, 110));
    g.phase = 'gest';
    g.until = now + rnd(600, 1500) + 420;
    this.nod.t = now; // la cabeza acompaña el comienzo del gesto
  }

  /* ---------- Labios ---------- */
  _lipFrame(now, dt) {
    const L = this.lip;
    const v = this.vis;
    const talking = this.state === 'talking' && v;
    const raw = talking ? clamp((v.aa || 0) + (v.oh || 0) + (v.ou || 0) * 0.6 + (v.ee || 0) + (v.ih || 0) * 0.4, 0, 1.2) : 0;
    L.env += (raw - L.env) * ease(dt, raw > L.env ? 60 : 140);
    L.silent = raw < 0.08 ? L.silent + dt : 0;
    let want;
    if (!talking || L.silent > 150 || this._lookSum > 0.05) want = 'closed';
    else if (L.env < 0.12) want = 'm-mb';
    else {
      want = null;
      if (SPEECH) {
        const i = Math.floor((now - SPEECH.start) / SPEECH.dur * SPEECH.text.length);
        // letra actual o la vocal más cercana de la palabra
        for (let d = 0; d < 3 && !want; d++) want = charShape(SPEECH.text[i + d] || '') || (d ? charShape(SPEECH.text[i - d] || '') : null);
        if (want === 'm-mb' && L.env > 0.5) want = null; // si suena fuerte, no es una m/b/p
      }
      if (!want) {
        const round = (v.oh || 0) + (v.ou || 0) * 1.4, wide = (v.ee || 0) + (v.ih || 0) * 0.8, aa = v.aa || 0;
        want = L.env < 0.22 ? (wide > (aa + round) * 1.1 ? 'm-f' : 'm-mb') : round > aa * 1.05 && round >= wide ? 'm-o' : wide > aa * 1.1 ? 'm-e' : 'm-a';
      }
    }
    // ritmo humano: forma mínima 100 ms y como mucho 7 cambios por segundo (el cierre por silencio pasa siempre)
    this.mouthChanges = this.mouthChanges.filter((x) => now - x < 1000);
    if (want !== this.mouth && (want === 'closed' && L.silent > 150 || (now - this.mouthSince >= 100 && this.mouthChanges.length < 7))) {
      this.mouth = want; this.mouthSince = now; this.mouthChanges.push(now);
    }
    // apertura parcial según el volumen + fundido de ~70 ms; la mandíbula baja apenas
    const k = this.reduce ? 1 : ease(dt, 70);
    const amt = this.mouth === 'closed' ? 0 : this.mouth === 'm-mb' || this.mouth === 'm-f' ? 0.92 : clamp(0.5 + L.env * 0.65, 0.5, 1);
    for (const n of MOUTHS) {
      const el = this.layer[n]; if (!el) continue;
      const o = this.op[n] + ((this.mouth === n ? amt : 0) - this.op[n]) * k;
      this.op[n] = o < 0.01 ? 0 : o;
      el.style.opacity = this.op[n].toFixed(3);
    }
    const jaw = this.reduce ? 1 : 1 + clamp(L.env, 0, 1) * 0.035;
    if (this.mouthEls.length && this._jaw !== jaw.toFixed(3)) { this._jaw = jaw.toFixed(3); const tr = `scaleY(${this._jaw})`; this.mouthEls.forEach((m) => { m.style.transform = tr; }); }
    return L.env;
  }

  _blinkFrame(now) {
    const b = this.blink;
    if (this._lookSum > 0.05) { if (now > b.next) b.next = now + rnd(800, 1600); return null; }
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
      const breath = Math.sin(t * 2 * Math.PI / 4.4);

      let env = 0;
      if (this.rig) env = this._lipFrame(now, dt);
      const target = st === 'talking' ? Math.max(0.2, env) : st === 'thinking' ? 0.3 : st === 'listening' ? 0.25 : 0.05;
      smooth += (target - smooth) * Math.min(1, dt / 90);
      this.el.style.setProperty('--lvl', smooth.toFixed(3));

      const eyes = this._blinkFrame(now);
      // cejas: suben en los picos de la voz (énfasis), como mucho una vez cada ~2 s
      if (this.rig && st === 'talking' && env > 0.62 && now > this.brow.next && this._lookSum < 0.05) { this.brow.until = now + rnd(380, 700); this.brow.next = now + rnd(1800, 3200); }
      const browOn = now < this.brow.until && this._lookSum < 0.05;
      for (const n of Object.keys(this.layer)) {
        if (MOUTHS.includes(n)) continue;
        const on = n === 'b-up' ? browOn : eyes === n;
        const kk = n.startsWith('e-') ? 1 : Math.min(1, dt / 120);
        const o = this.op[n] + ((on ? 1 : 0) - this.op[n]) * kk;
        this.op[n] = o < 0.01 ? 0 : o;
        this.layer[n].style.opacity = this.op[n].toFixed(3);
      }

      if (this.track) this._trackFrame(now, dt);
      else if (this.rig && this.looks.up) {
        // pensando: mira hacia arriba (solo cambia la cara; las manos siguen en su lugar)
        const want = st === 'thinking' && !this.reduce ? 1 : 0;
        const o = this.lookOp.up + (want - this.lookOp.up) * Math.min(1, dt / 160);
        this.lookOp.up = o < 0.01 ? 0 : o > 0.995 ? 1 : o; this._lookSum = this.lookOp.up;
        this.looks.up.style.opacity = this.lookOp.up.toFixed(3);
      }

      if (this.rig) {
        this._gestureFrame(now, env, this.lip.silent);
        this._armsFrame(now, t, breath);
      }

      // cuerpo: respiración, balanceo, inclinación al escuchar, asentir, cabeza que acompaña al hablar
      if (!this.reduce) {
        let rot = noise(t * 0.8, 0) * 0.7, tx = noise(t * 0.7, 1) * 0.35, ty = breath * 0.45, sc = 1 + breath * 0.0045;
        if (st === 'listening') {
          sc += 0.012; ty -= 2; rot += 1.1;
          if (now > this.nod.next) { this.nod.t = now; this.nod.next = now + rnd(2200, 3600); }
        } else if (st === 'thinking') {
          rot = noise(t * 0.4, 2) * 0.5 - 0.6; tx = noise(t * 0.35, 3) * 0.5;
        } else if (st === 'talking') {
          rot += noise(t * 1.6, 2) * 0.9 * smooth; ty -= Math.abs(noise(t * 2.2, 3)) * 1.4 * smooth;
        }
        const nd = now - this.nod.t;
        if (this.nod.t > 0 && nd < 650) ty += Math.sin(nd / 650 * Math.PI) * (st === 'listening' ? 4 : 2.2);
        if (this.track) { tx += this.gaze.sx * 3; ty += this.gaze.sy * 2; rot += this.gaze.sx * 0.6; }
        this.body.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) rotate(${rot.toFixed(3)}deg) scale(${sc.toFixed(4)})`;
      }
      if (!document.hidden) requestAnimationFrame(frame); else setTimeout(() => requestAnimationFrame(frame), 400);
    };
    requestAnimationFrame(frame);
  }

  /* Seguimiento del cursor: el mouse (o el último toque) marca hacia dónde mira; sin puntero, mira alrededor sola. */
  _bindTracking() {
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
    if (this.state !== 'idle') { x = 0; y = 0; }
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
    for (const n of this.lookKeys) {
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
  /** waist = encuadre de videollamada (cabeza y manos); full = personaje entero. */
  setFraming(m) { this.framing = m; this._fit && this._fit(); }

  setState(s) {
    if (!LABELS.hasOwnProperty(s)) s = 'idle';
    this.state = s;
    this.el.dataset.state = s;
    this.statusEl.textContent = LABELS[s] || '';
    clearTimeout(this._greetTimer);
    if (s !== 'talking') { this.level = 0; this.vis = null; }
    else if (this.gest) { this.gest.nextAllowed = Math.min(this.gest.nextAllowed, performance.now() + 250); this.gest.wasSilent = true; }
  }
  pulse() { this.el.classList.remove('pulse'); void this.el.offsetWidth; this.el.classList.add('pulse'); }
  /** Visemas de la voz (voice.js: aa, oh, ou, ee, ih) → forma de la boca, cejas y gestos. */
  setVisemes(v) {
    this.vis = v || null;
    this.level = v ? Math.min(1, (v.aa || 0) + (v.oh || 0) + (v.ee || 0) + (v.ih || 0) * 0.5 + 0.1) : 0;
  }
  setLevel(lv) {
    this.level = Math.max(0, Math.min(1, lv || 0));
    if (!this.vis && this.state === 'talking' && this.level > 0.1) this.vis = { aa: this.level * 0.7 };
  }
  /** Bienvenida: abre las manos un momento y vuelve a reposo (sin cambiar de pose). */
  greet(ms = 1400) {
    if (!this.rig || this.reduce || this.state !== 'idle') return;
    const now = performance.now();
    this._armTo('L', 'open', now); this._armTo('R', 'open', now + 60);
    this.nod.t = now;
    clearTimeout(this._greetTimer);
    this._greetTimer = setTimeout(() => { if (this.state === 'idle') { const n = performance.now(); this._armTo('L', 'rest', n); this._armTo('R', 'rest', n); } }, ms);
  }
}
