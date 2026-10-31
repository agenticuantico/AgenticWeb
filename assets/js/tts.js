/**
 * Pluggable text-to-speech with lip-sync timelines.
 *
 * Providers:
 *  - WebSpeechProvider: browser voices (Web Speech API). Default.
 *  - ProxyProvider: premium voice via YOUR serverless proxy (TTS_PROXY_URL).
 *    The proxy holds the API key; the browser never sees it. Lip sync is driven
 *    by an AnalyserNode (amplitude) + the text viseme timeline scaled to the audio.
 *  - SilentProvider: no audio (muted / unsupported), the avatar still animates.
 */
import { LipSyncTimeline } from './lipsync.js';

const LANG_PREFS = {
  'es-AR': ['es-ar', 'es-419', 'es-us', 'es-mx', 'es-co', 'es-cl', 'es-uy', 'es-es', 'es'],
  en: ['en-us', 'en-gb', 'en-au', 'en-ca', 'en'],
  'pt-BR': ['pt-br', 'pt-pt', 'pt']
};

function normTag(tag) { return String(tag || '').replace('_', '-').toLowerCase(); }

/** Scores a voice for the requested language: higher is better. */
export function scoreVoice(voice, lang) {
  const prefs = LANG_PREFS[lang] || [lang.toLowerCase()];
  const tag = normTag(voice.lang);
  let idx = prefs.findIndex((p) => tag === p);
  if (idx < 0) idx = prefs.findIndex((p) => tag.startsWith(p.split('-')[0]) && p.length === 2);
  if (idx < 0) return -1;
  let score = 100 - idx * 8;
  const name = (voice.name || '').toLowerCase();
  if (/natural|neural|wavenet|premium|enhanced/.test(name)) score += 22;
  if (name.includes('google')) score += 15;
  if (name.includes('online')) score += 8;
  if (voice.localService === false) score += 4;
  if (/compact|espeak/.test(name)) score -= 30;
  return score;
}

export function pickVoice(voices, lang) {
  let best = null, bestScore = -1;
  for (const v of voices || []) {
    const s = scoreVoice(v, lang);
    if (s > bestScore) { best = v; bestScore = s; }
  }
  return best;
}

/** Splits long text into speakable chunks (Chrome may cut utterances > ~15 s). */
export function chunkText(text, max = 170) {
  const sentences = String(text).replace(/\s+/g, ' ').trim().match(/[^.!?…]+[.!?…]*\s*/g) || [String(text)];
  const chunks = [];
  let cur = '';
  for (const s of sentences) {
    if ((cur + s).length > max && cur) { chunks.push(cur.trim()); cur = ''; }
    if (s.length > max) {
      const parts = s.split(/(?<=[,;:])\s+/);
      for (const p of parts) {
        if ((cur + p).length > max && cur) { chunks.push(cur.trim()); cur = ''; }
        cur += p + ' ';
      }
    } else cur += s;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

class SilentProvider {
  get name() { return 'silent'; }
  available() { return true; }
  speakChunk(text, { lang, rate, onStart, signal }) {
    return new Promise((resolve) => {
      const tl = new LipSyncTimeline(text, { lang, rate });
      tl.start();
      onStart(tl, null);
      const id = setTimeout(resolve, tl.durationMs + 60);
      signal.addEventListener('abort', () => { clearTimeout(id); resolve(); }, { once: true });
    });
  }
}

class WebSpeechProvider {
  constructor() { this.voices = []; this._keep = []; this._ready = this._loadVoices(); }
  get name() { return 'webspeech'; }
  available() { return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function'; }
  _loadVoices() {
    if (!this.available()) return Promise.resolve([]);
    return new Promise((resolve) => {
      const done = () => { this.voices = speechSynthesis.getVoices() || []; resolve(this.voices); };
      const now = speechSynthesis.getVoices();
      if (now && now.length) { this.voices = now; resolve(now); return; }
      const onChange = () => { speechSynthesis.removeEventListener?.('voiceschanged', onChange); done(); };
      speechSynthesis.addEventListener?.('voiceschanged', onChange);
      setTimeout(done, 1500);
    });
  }
  async voiceFor(lang) {
    await this._ready;
    if (!this.voices.length) this.voices = speechSynthesis.getVoices() || [];
    return pickVoice(this.voices, lang);
  }
  async speakChunk(text, { lang, rate, pitch, onStart, signal }) {
    const voice = await this.voiceFor(lang);
    return new Promise((resolve) => {
      if (signal.aborted) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = voice ? voice.lang.replace('_', '-') : lang;
      if (voice) u.voice = voice;
      u.rate = rate; u.pitch = pitch; u.volume = 1;
      const tl = new LipSyncTimeline(text, { lang, rate });
      let started = false, finished = false;
      const begin = () => { if (!started) { started = true; tl.start(); onStart(tl, null); } };
      const finish = () => { if (finished) return; finished = true; clearTimeout(fallbackStart); clearTimeout(watchdog); this._keep = this._keep.filter((x) => x !== u); resolve(); };
      u.onstart = begin;
      u.onboundary = (e) => { begin(); if (!e.name || e.name === 'word') tl.sync(e.charIndex); };
      u.onend = finish;
      u.onerror = finish;
      // Some Android builds never fire onstart/onend: estimate.
      const fallbackStart = setTimeout(begin, 700);
      const watchdog = setTimeout(finish, tl.durationMs * 2.5 + 5000);
      signal.addEventListener('abort', () => { try { speechSynthesis.cancel(); } catch { /* ignore */ } finish(); }, { once: true });
      this._keep.push(u); // prevent GC from dropping events (Chrome bug)
      speechSynthesis.speak(u);
    });
  }
  cancel() { try { speechSynthesis.cancel(); } catch { /* ignore */ } }
}

class ProxyProvider {
  constructor(url) { this.url = url; this.ctx = null; this.analyser = null; this.buf = null; }
  get name() { return 'proxy'; }
  available() { return !!this.url && typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext); }
  _ctx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.connect(this.ctx.destination);
      this.buf = new Uint8Array(this.analyser.fftSize);
    }
    return this.ctx;
  }
  amplitude = () => {
    if (!this.analyser) return 0;
    this.analyser.getByteTimeDomainData(this.buf);
    let sum = 0;
    for (let i = 0; i < this.buf.length; i++) { const v = (this.buf[i] - 128) / 128; sum += v * v; }
    return Math.min(1, Math.sqrt(sum / this.buf.length) * 4.5);
  };
  async speakChunk(text, { lang, onStart, signal }) {
    const ctx = this._ctx();
    if (ctx.state === 'suspended') await ctx.resume();
    const res = await fetch(this.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, lang }), signal });
    if (!res.ok) throw new Error(`TTS proxy HTTP ${res.status}`);
    const audio = await ctx.decodeAudioData(await res.arrayBuffer());
    return new Promise((resolve) => {
      const src = ctx.createBufferSource();
      src.buffer = audio;
      src.connect(this.analyser);
      const tl = new LipSyncTimeline(text, { lang, durationMs: audio.duration * 1000 });
      src.onended = () => resolve();
      signal.addEventListener('abort', () => { try { src.stop(); } catch { /* ignore */ } resolve(); }, { once: true });
      src.start();
      tl.start();
      onStart(tl, this.amplitude);
    });
  }
  cancel() { /* handled via AbortSignal */ }
}

export class VoiceEngine {
  constructor({ lang = 'es-AR', proxyUrl = '', tuning = {} } = {}) {
    this.lang = lang;
    this.tuning = tuning;
    this.muted = false;
    this.silent = new SilentProvider();
    this.web = new WebSpeechProvider();
    this.proxy = proxyUrl ? new ProxyProvider(proxyUrl) : null;
    this.current = { timeline: null, amplitude: null, speaking: false };
    this._ctrl = null;
    this._listeners = new Set();
  }
  on(cb) { this._listeners.add(cb); return () => this._listeners.delete(cb); }
  _emit(type, data) { this._listeners.forEach((cb) => cb(type, data)); }
  setLang(lang) { this.lang = lang; }
  setMuted(m) { this.muted = !!m; }
  get providerName() {
    if (this.muted) return 'silent';
    if (this.proxy && this.proxy.available()) return 'proxy';
    if (this.web.available()) return 'webspeech';
    return 'silent';
  }
  async describeVoice() {
    if (this.providerName !== 'webspeech') return this.providerName;
    const v = await this.web.voiceFor(this.lang);
    return v ? `${v.name} (${v.lang})` : 'default';
  }
  cancel() {
    if (this._ctrl) this._ctrl.abort();
    this._ctrl = null;
    this.web.available() && this.web.cancel();
    this.current = { timeline: null, amplitude: null, speaking: false };
    this._emit('end');
  }
  async speak(text) {
    this.cancel();
    if (this.web.available() && !this.muted) await new Promise((r) => setTimeout(r, 40));
    const ctrl = new AbortController();
    this._ctrl = ctrl;
    const { rate = 1, pitch = 1 } = this.tuning[this.lang] || {};
    const lang = this.lang;
    this.current.speaking = true;
    this._emit('start', { text });
    const onStart = (timeline, amplitude) => { if (!ctrl.signal.aborted) { this.current = { timeline, amplitude, speaking: true }; this._emit('chunk', { timeline }); } };
    let provider = this.muted ? this.silent : (this.proxy && this.proxy.available() ? this.proxy : (this.web.available() ? this.web : this.silent));
    const chunks = provider === this.proxy ? [String(text)] : chunkText(text);
    try {
      for (const chunk of chunks) {
        if (ctrl.signal.aborted) break;
        try {
          await provider.speakChunk(chunk, { lang, rate, pitch, onStart, signal: ctrl.signal });
        } catch (err) {
          if (ctrl.signal.aborted) break;
          // Proxy failed: degrade gracefully to browser voice for the rest.
          console.warn('[tts] provider failed, falling back:', err && err.message);
          provider = this.web.available() ? this.web : this.silent;
          await provider.speakChunk(chunk, { lang, rate, pitch, onStart, signal: ctrl.signal });
        }
      }
    } finally {
      if (this._ctrl === ctrl) {
        this._ctrl = null;
        this.current = { timeline: null, amplitude: null, speaking: false };
        this._emit('end');
      }
    }
  }
}
