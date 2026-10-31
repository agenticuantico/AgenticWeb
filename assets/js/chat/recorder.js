/**
 * Grabación de notas de voz (estilo mensajería): forma de onda en vivo, temporizador,
 * corte automático por silencio, cancelación y transcripción en paralelo (Web Speech API si existe).
 */
export class VoiceRecorder {
  constructor({ lang = 'es-AR', onLevel, onTick, onTranscript, silenceMs = 1700, maxMs = 120000, autoStop = true } = {}) {
    Object.assign(this, { lang, onLevel, onTick, onTranscript, silenceMs, maxMs, autoStop });
    this.peaks = [];
    this.transcript = '';
    this.state = 'idle';
  }

  static supported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder); }
  static speechSupported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }

  async start() {
    if (!VoiceRecorder.supported()) throw Object.assign(new Error('unsupported'), { code: 'unsupported' });
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
      const code = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'denied' : e && e.name === 'NotFoundError' ? 'nomic' : 'error';
      throw Object.assign(new Error(code), { code });
    }
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((m) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
    this.mime = mime || 'audio/webm';
    this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime, audioBitsPerSecond: 48000 } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = (e) => e.data && e.data.size && this.chunks.push(e.data);
    this.rec.start(250);
    this.t0 = performance.now();
    this.state = 'recording';
    this._meter();
    this._speech();
    return this;
  }

  _meter() {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    const src = this.ctx.createMediaStreamSource(this.stream);
    const an = this.ctx.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    let lastLoud = performance.now();
    let heard = false;
    let lastPeak = 0;
    const loop = () => {
      if (this.state !== 'recording') return;
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
      const rms = Math.sqrt(sum / buf.length);
      const level = Math.min(1, rms * 4.2);
      const now = performance.now();
      if (now - lastPeak > 90) { this.peaks.push(Math.round(level * 100) / 100); lastPeak = now; }
      this.onLevel && this.onLevel(level);
      const elapsed = now - this.t0;
      this.onTick && this.onTick(elapsed);
      if (level > 0.09) { lastLoud = now; heard = true; }
      if (this.autoStop && heard && now - lastLoud > this.silenceMs && elapsed > 1200) { this.stop(); return; }
      if (elapsed > this.maxMs) { this.stop(); return; }
      this.raf = requestAnimationFrame(loop);
    };
    loop();
  }

  _speech() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    try {
      const r = new SR();
      r.lang = this.lang; r.interimResults = true; r.continuous = true; r.maxAlternatives = 1;
      let finalText = '';
      r.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalText += t + ' '; else interim += t;
        }
        this.transcript = (finalText + interim).trim();
        this.onTranscript && this.onTranscript(this.transcript);
      };
      r.onerror = () => {};
      r.onend = () => { if (this.state === 'recording') { try { r.start(); } catch {} } };
      r.start();
      this.sr = r;
    } catch { this.sr = null; }
  }

  /** Detiene y devuelve { blob, url, duration, peaks, transcript, mime } */
  stop() {
    if (this.state !== 'recording') return this._done || Promise.resolve(null);
    this.state = 'stopping';
    cancelAnimationFrame(this.raf);
    this._done = new Promise((resolve) => {
      const finish = () => {
        const duration = (performance.now() - this.t0) / 1000;
        const blob = new Blob(this.chunks, { type: this.mime.split(';')[0] });
        this._cleanup();
        // dejamos un instante para el último resultado de reconocimiento
        setTimeout(() => resolve({ blob, url: URL.createObjectURL(blob), duration, peaks: compressPeaks(this.peaks, 48), transcript: this.transcript.trim(), mime: blob.type }), 350);
      };
      this.rec.onstop = finish;
      try { this.rec.stop(); } catch { finish(); }
    });
    return this._done;
  }

  cancel() {
    this.state = 'cancelled';
    cancelAnimationFrame(this.raf);
    try { this.rec && this.rec.state !== 'inactive' && this.rec.stop(); } catch {}
    this._cleanup();
  }

  _cleanup() {
    try { this.sr && this.sr.stop(); } catch {}
    this.sr = null;
    this.stream && this.stream.getTracks().forEach((t) => t.stop());
    try { this.ctx && this.ctx.close(); } catch {}
    if (this.state !== 'cancelled') this.state = 'done';
  }
}

export function compressPeaks(peaks, n) {
  if (!peaks.length) return Array(n).fill(0.05);
  const out = [];
  const step = peaks.length / n;
  for (let i = 0; i < n; i++) {
    const seg = peaks.slice(Math.floor(i * step), Math.max(Math.floor(i * step) + 1, Math.floor((i + 1) * step)));
    out.push(Math.max(0.06, Math.min(1, Math.max(...seg) * 1.15)));
  }
  return out;
}
export function fmtClock(sec) { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
