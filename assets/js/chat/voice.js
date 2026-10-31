/**
 * Voz de AgentiCuántico (siempre femenina) + sincronización labial.
 *  1) ElevenLabs a través del servidor (POST /api/tts): voz natural; los visemas salen de analizar el audio.
 *  2) Respaldo del navegador (speechSynthesis): se elige la voz femenina más natural disponible
 *     (Natural/Neural/Online/Google/Premium/Enhanced) y los visemas salen de los eventos de palabra
 *     más una temporización por letras.
 */
import { synthesize } from './engine.js';
import { toSpeech } from './md.js';

const FEMALE = /(female|mujer|femenina|woman|paulina|m[oó]nica|helena|elvira|dalia|francisca|sabina|camila|elena|luc[ií]a|isabel|isabela|laura|paloma|marisol|valentina|ximena|sof[ií]a|lupe|pen[eé]lope|conchita|samantha|victoria|karen|moira|tessa|fiona|serena|allison|ava|susan|zira|jenny|aria|sonia|libby|michelle|emma|olivia|natasha|clara|luciana|fernanda|francisca|joana|raquel|let[ií]cia|thalita|vit[oó]ria|alice|elsa|federica|isabella|gianna|chiara|amelie|am[eé]lie|audrey|aurelie|marie|denise|eloise|vivienne|katja|anna|petra|marlene|hedda|vicki|amala|seraphina|google (espa[ñn]ol|us english|portugu[eê]s|italiano|fran[cç]ais|deutsch))/i;
const MALE = /(male\b|hombre|jorge|diego|pablo|ra[uú]l|tom[aá]s|enrique|[aá]lvaro|daniel|juan|carlos|antonio|david|mark|guy|fred|alex\b|thomas|luca|paul\b|henri|stefan|cosimo|reed|rocko|eddy|grandpa|ralph|arthur|aaron|gordon|oliver|ryan|brian|christopher|eric|roger|andrew|brandon|davis|tony|federico|giuseppe|diego|claude|jean|conrad|killian|ricardo|jo[aã]o|ant[oô]nio|duarte|humberto|felipe)/i;

/** Puntaje de naturalidad de una voz (más alto = mejor). */
export function scoreVoice(v, langId) {
  const [lang, region] = langId.split('-');
  const vl = (v.lang || '').replace('_', '-');
  if (!vl.toLowerCase().startsWith(lang)) return -1;
  if (MALE.test(v.name) && !FEMALE.test(v.name)) return -1;
  let s = 0;
  if (vl.toLowerCase() === langId.toLowerCase()) s += 30;
  else if (lang === 'es' && region === 'AR' && /-(419|US|MX|CO|CL|UY|PE)$/i.test(vl)) s += 18; // acento latino
  else s += 6;
  if (FEMALE.test(v.name)) s += 25;
  if (/natural/i.test(v.name)) s += 40;
  if (/neural|online/i.test(v.name)) s += 34;
  if (/premium|enhanced|mejorada|siri/i.test(v.name)) s += 30;
  if (/google/i.test(v.name)) s += 22;
  if (/microsoft/i.test(v.name) && !/natural|online/i.test(v.name)) s -= 8; // voces SAPI clásicas, más robóticas
  if (/compact|espeak|robot/i.test(v.name)) s -= 40;
  if (!v.localService) s += 4;
  return s;
}

let voicesP;
function loadVoices() {
  if (!('speechSynthesis' in window)) return Promise.resolve([]);
  if (voicesP) return voicesP;
  voicesP = new Promise((res) => {
    const got = () => { const v = speechSynthesis.getVoices(); if (v.length) { res(v); return true; } return false; };
    if (got()) return;
    speechSynthesis.addEventListener('voiceschanged', () => got(), { once: true });
    setTimeout(() => res(speechSynthesis.getVoices()), 1500);
  });
  return voicesP;
}
export async function bestVoice(langId) {
  const vs = await loadVoices();
  const ranked = vs.map((v) => ({ v, s: scoreVoice(v, langId) })).filter((x) => x.s >= 0).sort((a, b) => b.s - a.s);
  return ranked.length ? ranked[0].v : null;
}

/* ---------- Visemas ---------- */
const ZERO = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
function letterViseme(ch) {
  switch (ch) {
    case 'a': case 'á': return { aa: 0.9 };
    case 'e': case 'é': return { ee: 0.75, aa: 0.15 };
    case 'i': case 'í': case 'y': return { ih: 0.8 };
    case 'o': case 'ó': return { oh: 0.85 };
    case 'u': case 'ú': case 'w': return { ou: 0.85 };
    case 'm': case 'b': case 'p': return { ...ZERO };
    case 'f': case 'v': return { ih: 0.25 };
    case 'l': case 'n': case 't': case 'd': case 's': case 'r': return { aa: 0.25, ih: 0.15 };
    default: return { aa: 0.2 };
  }
}

/**
 * Habla un texto. opts: { lang, onViseme(v), onStart(), onEnd(), signal, preferServer=true }
 * Devuelve una promesa que resuelve al terminar.
 */
export async function speak(markdown, opts = {}) {
  const text = toSpeech(markdown).slice(0, 2400);
  if (!text) return;
  stop();
  current = { cancelled: false };
  const me = current;
  if (opts.preferServer !== false) {
    const blob = await synthesize(text, opts.lang, opts.signal);
    if (me.cancelled) return;
    if (blob) return playWithAnalyser(blob, opts, me);
  }
  return speakBrowser(text, opts, me);
}

let current = null;
let audioEl = null;
let ctx = null;
export function stop() {
  if (current) current.cancelled = true;
  if (audioEl) { try { audioEl.pause(); } catch {} audioEl = null; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
export function isSpeaking() { return !!(audioEl && !audioEl.paused) || ('speechSynthesis' in window && speechSynthesis.speaking); }

function playWithAnalyser(blob, opts, me) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const a = new Audio(url);
    audioEl = a;
    let raf = 0;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      const src = ctx.createMediaElementSource(a);
      const an = ctx.createAnalyser();
      an.fftSize = 1024; an.smoothingTimeConstant = 0.5;
      src.connect(an); an.connect(ctx.destination);
      const bins = new Uint8Array(an.frequencyBinCount);
      const hz = ctx.sampleRate / an.fftSize;
      const band = (lo, hi) => { let s = 0, n = 0; for (let i = Math.floor(lo / hz); i < Math.min(bins.length, Math.ceil(hi / hz)); i++) { s += bins[i]; n++; } return n ? s / n / 255 : 0; };
      const tick = () => {
        an.getByteFrequencyData(bins);
        const low = band(150, 600), mid = band(600, 1800), high = band(1800, 5000);
        const energy = Math.min(1, (low * 0.6 + mid * 0.9 + high * 0.4) * 2.1);
        const total = low + mid + high + 1e-4;
        const v = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
        if (energy > 0.08) {
          v.aa = energy * (mid / total) * 1.6;
          v.oh = energy * (low / total) * 1.3;
          v.ou = energy * Math.max(0, low / total - 0.45) * 1.8;
          v.ee = energy * (high / total) * 1.5;
          v.ih = energy * (high / total) * 0.9;
        }
        opts.onViseme && opts.onViseme(v);
        raf = requestAnimationFrame(tick);
      };
      a.addEventListener('play', () => { opts.onStart && opts.onStart(); tick(); }, { once: true });
    } catch {
      a.addEventListener('play', () => opts.onStart && opts.onStart(), { once: true });
    }
    const end = () => { cancelAnimationFrame(raf); opts.onViseme && opts.onViseme(ZERO); URL.revokeObjectURL(url); if (audioEl === a) audioEl = null; opts.onEnd && opts.onEnd(); resolve(); };
    a.addEventListener('ended', end, { once: true });
    a.addEventListener('error', end, { once: true });
    a.play().catch(() => { end(); });
    if (me.cancelled) end();
  });
}

async function speakBrowser(text, opts, me) {
  if (!('speechSynthesis' in window)) { opts.onEnd && opts.onEnd(); return; }
  const voice = await bestVoice(opts.lang || 'es-AR');
  if (me.cancelled) return;
  // frases cortas: los motores del navegador cortan textos largos
  const chunks = text.match(/[^.!?¿¡]+[.!?]*\s*/g) || [text];
  let started = false;
  let timer = 0;
  for (const chunk of chunks) {
    if (me.cancelled) break;
    await new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(chunk.trim());
      u.lang = (voice && voice.lang) || opts.lang || 'es-AR';
      if (voice) u.voice = voice;
      u.rate = 1.02; u.pitch = 1.04;
      let boundaryOk = false;
      const animateWord = (word, dur) => {
        const letters = word.toLowerCase().replace(/[^a-záéíóúüñ]/g, '').split('');
        const step = Math.max(45, dur / Math.max(1, letters.length));
        letters.forEach((ch, i) => setTimeout(() => !me.cancelled && opts.onViseme && opts.onViseme(letterViseme(ch)), i * step));
        setTimeout(() => opts.onViseme && opts.onViseme({ aa: 0.05 }), letters.length * step);
      };
      u.onstart = () => {
        if (!started) { started = true; opts.onStart && opts.onStart(); }
        // si el motor no emite límites de palabra, animamos por tiempo estimado
        const words = chunk.trim().split(/\s+/);
        const msPerChar = 62 / u.rate;
        let t = 0;
        clearTimeout(timer);
        timer = setTimeout(function fallback() {
          if (boundaryOk) return;
          words.forEach((w) => { setTimeout(() => !boundaryOk && !me.cancelled && animateWord(w, w.length * msPerChar), t); t += (w.length + 1) * msPerChar; });
        }, 250);
      };
      u.onboundary = (e) => {
        if (e.name && e.name !== 'word') return;
        boundaryOk = true;
        const word = chunk.slice(e.charIndex).split(/\s/)[0] || '';
        animateWord(word, word.length * (60 / u.rate));
      };
      u.onend = u.onerror = () => { opts.onViseme && opts.onViseme(ZERO); resolve(); };
      speechSynthesis.speak(u);
    });
  }
  clearTimeout(timer);
  opts.onViseme && opts.onViseme(ZERO);
  opts.onEnd && opts.onEnd();
}

/** Nombre de la voz que se usaría (para mostrar en ajustes). */
export async function voiceLabel(langId) {
  const v = await bestVoice(langId);
  return v ? v.name : 'Voz del sistema';
}
