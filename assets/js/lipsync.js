/**
 * Text → viseme timeline with live re-anchoring from speech boundary events.
 * Mouth shape is described by 5 channels in [0,1]:
 *   open (jaw), wide (lip stretch), round (pucker), close (lips pressed), fv (lower lip tuck)
 */
export const VISEMES = {
  rest: { open: 0.0, wide: 0.0, round: 0.0, close: 0.15, fv: 0 },
  A: { open: 0.9, wide: 0.45, round: 0.0, close: 0, fv: 0 },
  E: { open: 0.5, wide: 0.85, round: 0.0, close: 0, fv: 0 },
  I: { open: 0.28, wide: 1.0, round: 0.0, close: 0, fv: 0 },
  O: { open: 0.68, wide: 0.0, round: 0.8, close: 0, fv: 0 },
  U: { open: 0.3, wide: 0.0, round: 1.0, close: 0, fv: 0 },
  MBP: { open: 0.0, wide: 0.1, round: 0.0, close: 1.0, fv: 0 },
  FV: { open: 0.1, wide: 0.3, round: 0.0, close: 0, fv: 1.0 },
  L: { open: 0.35, wide: 0.35, round: 0.0, close: 0, fv: 0 },
  S: { open: 0.16, wide: 0.6, round: 0.0, close: 0, fv: 0 },
  C: { open: 0.26, wide: 0.2, round: 0.1, close: 0, fv: 0 }
};
export const CHANNELS = ['open', 'wide', 'round', 'close', 'fv'];

// Relative durations (units). One unit ≈ msPerUnit at rate 1.
const DUR = { vowel: 1.0, cons: 0.62, space: 0.45, comma: 3.0, stop: 5.0 };

const VOWEL_MAP = { a: 'A', á: 'A', à: 'A', â: 'A', ã: 'A', e: 'E', é: 'E', ê: 'E', i: 'I', í: 'I', y: 'I', o: 'O', ó: 'O', ô: 'O', õ: 'O', u: 'U', ú: 'U', ü: 'U' };
const CONS_MAP = { m: 'MBP', b: 'MBP', p: 'MBP', f: 'FV', v: 'FV', l: 'L', n: 'L', ñ: 'L', t: 'L', d: 'L', r: 'L', s: 'S', z: 'S', c: 'S', x: 'S', j: 'C', g: 'C', k: 'C', q: 'C', h: null, w: 'U' };

/**
 * Converts text into tokens: {v: viseme, d: duration units, i: char index}.
 */
export function textToVisemes(text) {
  const s = String(text || '').toLowerCase();
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const next = s[i + 1] || '';
    if (VOWEL_MAP[ch]) { out.push({ v: VOWEL_MAP[ch], d: DUR.vowel, i }); continue; }
    if ((ch === 'c' && next === 'h') || (ch === 's' && next === 'h') || (ch === 'l' && next === 'l')) { out.push({ v: 'S', d: DUR.cons * 1.2, i }); i++; continue; }
    if (ch === 'q' && next === 'u') { out.push({ v: 'C', d: DUR.cons, i }); i++; continue; }
    if (ch in CONS_MAP) { const v = CONS_MAP[ch]; if (v) out.push({ v, d: v === 'MBP' ? DUR.cons * 1.1 : DUR.cons, i }); continue; }
    if (/\s/.test(ch)) { if (out.length && out[out.length - 1].v !== 'rest') out.push({ v: 'rest', d: DUR.space, i }); continue; }
    if (/[,;:]/.test(ch)) { out.push({ v: 'rest', d: DUR.comma, i }); continue; }
    if (/[.!?…]/.test(ch)) { out.push({ v: 'rest', d: DUR.stop, i }); continue; }
    if (/[0-9]/.test(ch)) { out.push({ v: 'E', d: DUR.vowel * 1.4, i }, { v: 'L', d: DUR.cons, i }); continue; }
  }
  out.push({ v: 'rest', d: 1, i: s.length });
  return out;
}

/** Estimated milliseconds per unit for a language at rate=1. */
export function msPerUnitFor(lang) {
  if (lang && lang.startsWith('en')) return 70;
  if (lang && lang.startsWith('pt')) return 66;
  return 62;
}

/**
 * A timeline that can be sampled at any time and re-anchored at a char index.
 */
export class LipSyncTimeline {
  constructor(text, { lang = 'es-AR', rate = 1, durationMs = null } = {}) {
    this.tokens = textToVisemes(text);
    this.starts = [];
    let acc = 0;
    for (const t of this.tokens) { this.starts.push(acc); acc += t.d; }
    this.totalUnits = acc;
    this.msPerUnit = durationMs ? durationMs / acc : msPerUnitFor(lang) / (rate || 1);
    this.t0 = null; // performance.now() when unit 0 plays
  }
  start(now = performance.now()) { this.t0 = now; }
  get durationMs() { return this.totalUnits * this.msPerUnit; }

  /** Re-anchor so that the token at `charIndex` plays at `now`; adapts speed. */
  sync(charIndex, now = performance.now()) {
    if (this.t0 == null) { this.t0 = now; }
    const k = this.tokens.findIndex((t) => t.i >= charIndex);
    if (k < 0) return;
    const unitPos = this.starts[k];
    const elapsed = now - this.t0;
    if (unitPos > 2 && elapsed > 150) {
      const observed = elapsed / unitPos;
      // Smoothly adapt speed estimate, clamped to sane limits.
      this.msPerUnit = Math.min(140, Math.max(35, this.msPerUnit * 0.6 + observed * 0.4));
    }
    this.t0 = now - unitPos * this.msPerUnit;
  }

  /** Mouth weights at time `now`, with coarticulation blending. */
  sample(now = performance.now(), out = {}) {
    for (const c of CHANNELS) out[c] = 0;
    if (this.t0 == null) { Object.assign(out, VISEMES.rest); out.done = false; return out; }
    const u = (now - this.t0) / this.msPerUnit;
    if (u >= this.totalUnits) { Object.assign(out, VISEMES.rest); out.done = true; return out; }
    if (u < 0) { Object.assign(out, VISEMES.rest); out.done = false; return out; }
    // binary search
    let lo = 0, hi = this.starts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (this.starts[mid] <= u) lo = mid; else hi = mid - 1; }
    const tok = this.tokens[lo];
    const nxt = this.tokens[lo + 1] || tok;
    const local = (u - this.starts[lo]) / tok.d;
    const blend = local > 0.6 ? smooth((local - 0.6) / 0.4) * 0.5 : 0;
    const a = VISEMES[tok.v], b = VISEMES[nxt.v];
    for (const c of CHANNELS) out[c] = a[c] * (1 - blend) + b[c] * blend;
    out.done = false;
    return out;
  }
}

function smooth(x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }
