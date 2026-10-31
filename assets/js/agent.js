/**
 * Agent controller: binds the voice engine, the lip-sync timeline and the 3D avatar.
 * Shared by the landing page demo and the /app/ assistant.
 */
import { VoiceEngine } from './tts.js';

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

export function createAgentController({ canvas, fallbackEl, loadingEl, lang, proxyUrl = '', tuning = {}, reducedMotion = false, onStatus = () => {} }) {
  const voice = new VoiceEngine({ lang, proxyUrl, tuning });
  let avatar = null;
  let loading = null;

  async function ensureAvatar() {
    if (avatar) return avatar;
    if (loading) return loading;
    loading = (async () => {
      if (!canvas || !webglAvailable()) throw new Error('webgl-unavailable');
      const mod = await import('./avatar.js');
      avatar = mod.createAvatar(canvas, { reducedMotion });
      avatar.setSource(mouthSource);
      return avatar;
    })().catch((err) => {
      console.info('[agent] 3D avatar unavailable, using static fallback:', err && err.message);
      if (fallbackEl) fallbackEl.hidden = false;
      if (canvas) canvas.hidden = true;
      return null;
    }).finally(() => { if (loadingEl) loadingEl.hidden = true; });
    return loading;
  }

  // Mouth source: reads whatever timeline the voice engine is currently playing.
  const mouthSource = (now) => {
    const cur = voice.current;
    if (!cur.timeline) return null;
    const w = cur.timeline.sample(now);
    if (cur.amplitude) w.amp = cur.amplitude();
    return w;
  };

  voice.on((type) => {
    if (type === 'start') { onStatus('speaking'); if (avatar) avatar.setSpeaking(true); }
    if (type === 'end') { onStatus('idle'); if (avatar) avatar.setSpeaking(false); }
  });

  async function speak(text) {
    await ensureAvatar();
    await voice.speak(text);
  }

  return {
    voice,
    get avatar() { return avatar; },
    ensureAvatar,
    speak,
    stop() { voice.cancel(); },
    setLang(l) { voice.setLang(l); },
    setMuted(m) { voice.setMuted(m); }
  };
}
