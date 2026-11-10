/**
 * /llamada/: llamada de voz manos libres con AgentiCuántico.
 * Ciclo: escuchar (detección de voz por energía) → transcribir → responder → hablar → escuchar.
 * Interrupción: si la persona habla mientras AgentiCuántico habla, se corta la voz y vuelve a escuchar.
 * No escribe nada en el chat. La transcripción en pantalla es opcional (apagada por defecto).
 */
import { h, icon, esc, toast, modal } from '../ui.js';
import { prefs } from '../consent.js';
import { AgentAvatar } from '../chat/agent-avatar.js?v=7.14.0';
import * as engine from '../chat/engine.js';
import { speak, stop as stopSpeech } from '../chat/voice.js?v=7.14.0';
import { LANGS, getLang, flagUrl, startLang } from '../chat/languages.js';
import { watchUser, getProfile } from '../auth.js';
import { systemPrompt, localReply, greeting, extractFacts, CRISIS_RE } from './brain.js';
import * as mem from './memory.js';

const $ = (id) => document.getElementById(id);
const S = {
  state: 'ready', user: null, profile: null, lang: startLang(prefs.get('ac.lang', null)),
  muted: false, incognito: false, optIn: false, memory: [], name: null, history: [], utterances: [],
  startedAt: 0, timer: 0, stream: null, ctx: null, analyser: null, raf: 0, sr: null, srText: '', turnText: '',
  speaking: false, wakeLock: null, abort: null, settings: {}, hb: 0, serverLeft: null
};
const avatar = new AgentAvatar($('callAvatar'), { label: 'AgentiCuántico, inteligencia artificial', framing: 'waist' });
(window.requestIdleCallback || ((f) => setTimeout(f, 300)))(() => avatar.load());
{
  const fb = $('callFraming');
  if (fb) fb.addEventListener('click', () => {
    const full = fb.getAttribute('aria-pressed') !== 'true';
    fb.setAttribute('aria-pressed', String(full));
    fb.setAttribute('aria-label', full ? 'Ver medio cuerpo' : 'Ver cuerpo entero');
    $('callShell').classList.toggle('framing-full', full);
    avatar.setFraming(full ? 'full' : 'waist');
  });
}

/* ---------- Preparación ---------- */
function planName() { return (S.profile && S.profile.plan) || 'gratis'; }
function limitSeconds() { return (mem.LIMIT_MIN[planName()] || 10) * 60; }
function renderLang() { $('callFlag').src = flagUrl(S.lang); $('callLangName').textContent = `${S.lang.name} · ${S.lang.region}`; $('callLang').setAttribute('aria-label', `Idioma de la llamada: ${S.lang.name} · ${S.lang.region}`); }
renderLang();
$('callLang').addEventListener('click', async () => {
  const { popover } = await import('../ui.js');
  popover($('callLang'), LANGS.map((l) => ({ label: l.name, sub: l.region, img: flagUrl(l), checked: l.id === S.lang.id, onClick: () => { S.lang = l; prefs.set('ac.lang', l.id); renderLang(); if (['es-AR', 'es-ES', 'en-US', 'pt-BR'].includes(l.id)) import('../i18n.js').then((m) => m.setSiteLang(l.id)); } })), { align: 'start' });
});
$('incogToggle').addEventListener('change', (e) => { S.incognito = e.target.checked; $('callShell').classList.toggle('is-incognito', S.incognito); });
$('startCall').addEventListener('click', startCall);
$('hangup').addEventListener('click', () => endCall('Llamada finalizada'));
$('muteBtn').addEventListener('click', toggleMute);
$('trToggle').addEventListener('click', () => {
  const on = $('transcript').hidden;
  $('transcript').hidden = !on;
  $('trToggle').setAttribute('aria-pressed', String(on));
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.state !== 'ready' && S.state !== 'ended') endCall('Llamada finalizada'); if (e.key.toLowerCase() === 'm' && e.target === document.body) toggleMute(); });

watchUser(async (u) => {
  S.user = u;
  if (!u) { updateQuota(); return; }
  const p = await getProfile(u.uid);
  S.profile = p && !p._error ? p : null;
  S.settings = await mem.getSettings(u.uid);
  S.optIn = S.settings.optIn === true;
  $('memNote').textContent = S.optIn ? 'Recuerda lo que le contás (podés verlo y borrarlo en Mi cuenta).' : 'La memoria está apagada.';
  updateQuota();
});
function updateQuota() {
  const left = Math.max(0, limitSeconds() - mem.usageToday());
  $('quota').textContent = `Te quedan ${Math.ceil(left / 60)} min hoy (plan ${({ gratis: 'Gratis', pro: 'Pro', empresa: 'Empresa' })[planName()]})`;
  return left;
}
updateQuota();

/* ---------- Ciclo de la llamada ---------- */
async function startCall() {
  if (window.AC_SYSTEM && (window.AC_SYSTEM.killSwitch || window.AC_SYSTEM.flags.voice === false)) { toast('Las llamadas están pausadas momentáneamente.'); return; }
  if (updateQuota() <= 0) {
    modal({ title: 'Llegaste al límite de hoy', body: `<p class="muted">El plan Gratis incluye ${mem.LIMIT_MIN.gratis} minutos de llamada por día. Con Pro tenés ${mem.LIMIT_MIN.pro} y con Empresa ${mem.LIMIT_MIN.empresa}.</p>`, actions: [{ label: 'Ahora no', class: 'btn-ghost' }, { label: 'Ver planes', class: 'btn-gold', onClick: () => { location.href = '/planes.html'; } }] });
    return;
  }
  // AudioContext creado DENTRO del toque en «Llamar»: en Chrome para Android, si se crea después de varias
  // esperas (permiso, red) nace «suspended» y el detector de voz lee silencio absoluto (la llamada no te oye).
  try { const AC = window.AudioContext || window.webkitAudioContext; if (!S.ctx || S.ctx.state === 'closed') S.ctx = new AC(); S.ctx.resume && S.ctx.resume().catch(() => {}); } catch {}
  // Permiso de memoria la primera vez (solo con cuenta)
  if (S.user && !S.incognito && S.settings.optIn === undefined) {
    const ok = await modal({ title: '¿Querés que te recuerde?', body: '<p class="muted">Si lo permitís, después de cada llamada guardo datos útiles que me cuentes (tu nombre, personas importantes, intereses, objetivos, cómo te sentís) para darte continuidad día a día. Los ves, editás y borrás en <strong>Mi cuenta → Memoria de llamadas</strong>. Podés cambiarlo cuando quieras o llamar en modo incógnito.</p>', actions: [{ label: 'No, gracias', value: false, class: 'btn-ghost' }, { label: 'Sí, recordame', value: true, class: 'btn-primary' }] }).done;
    S.optIn = ok === true;
    S.settings.optIn = S.optIn;
    mem.saveSettings(S.user.uid, { optIn: S.optIn }).catch(() => {});
  }
  setState('connecting');
  try {
    S.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (e) {
    setState('ready');
    const denied = e && e.name === 'NotAllowedError';
    modal({ title: denied ? 'Necesito permiso para el micrófono' : 'No encontré un micrófono', body: `<p class="muted">${denied ? 'Para hablar conmigo, habilitá el micrófono desde el candado de la barra de direcciones y volvé a tocar «Llamar».' : 'Conectá un micrófono o probá desde tu teléfono.'}</p><p class="small muted">También podés escribirme en el <a href="/app/">chat</a>.</p>` });
    return;
  }
  try { S.wakeLock = await navigator.wakeLock?.request('screen'); } catch {}
  await engine.init();
  // Control de minutos en el servidor (si está activo). Sin servidor sigue el control local.
  const gate = await engine.companion('start');
  if (gate.exceeded) {
    S.stream.getTracks().forEach((t) => t.stop());
    try { S.wakeLock && S.wakeLock.release(); } catch {}
    setState('ready');
    modal({ title: 'Llegaste al límite de hoy', body: '<p class="muted">Usaste todos los minutos de llamada de tu plan por hoy. Podés seguir por el <a href="/app/">chat</a> o ver los <a href="/planes.html">planes</a>.</p>' });
    return;
  }
  S.serverLeft = Number.isFinite(gate.remainingSec) ? gate.remainingSec : null;
  if (S.user && S.optIn && !S.incognito) {
    try { S.memory = await mem.listMemory(S.user.uid); } catch { S.memory = []; }
  }
  S.name = (S.memory.find((m) => m.kind === 'nombre') || {}).text || (S.profile && S.profile.name ? S.profile.name.split(' ')[0] : null) || (S.user && S.user.displayName ? S.user.displayName.split(' ')[0] : null);
  S.history = []; S.utterances = []; S.sttWarned = false;
  S.startedAt = Date.now();
  document.body.classList.add('in-call');
  $('callShell').dataset.phase = 'call';
  S.timer = setInterval(tick, 500);
  if (!gate.offline) S.hb = setInterval(heartbeat, 30_000);
  setupAudio();
  setupSpeech();
  const hello = await firstLine();
  await say(hello);
  listen();
}

function tick() {
  const s = Math.floor((Date.now() - S.startedAt) / 1000);
  $('callTimer').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  if (mem.usageToday() + s >= limitSeconds() || (S.serverLeft !== null && s >= S.serverLeft)) endCall('Se terminaron los minutos de hoy. ¡Hablamos mañana!');
}

async function heartbeat() {
  if (S.state === 'ended' || S.state === 'ready') return;
  const r = await engine.companion('heartbeat');
  if (r.exceeded) { endCall('Se terminaron los minutos de hoy. ¡Hablamos mañana!'); return; }
  if (r.offline) { clearInterval(S.hb); S.hb = 0; return; } // el servidor dejó de responder: queda el control local
  if (Number.isFinite(r.remainingSec)) S.serverLeft = r.remainingSec + Math.floor((Date.now() - S.startedAt) / 1000);
}

async function firstLine() {
  if (engine.state.live) {
    const r = await ask('[La llamada recién empieza: saludá breve y con continuidad si corresponde.]', true).catch(() => null);
    if (r) return r;
  }
  return greeting({ name: S.name, memory: S.memory, lang: S.lang.code });
}

function setState(st) {
  S.state = st;
  $('callShell').dataset.state = st;
  const label = { ready: 'Lista para hablar', connecting: 'Conectando…', listening: S.muted ? 'Micrófono en silencio' : 'Te escucho…', thinking: 'Pensando…', speaking: 'Hablando', ended: 'Llamada finalizada' }[st];
  $('callStatus').textContent = label;
  avatar.setState(st === 'listening' ? 'listening' : st === 'thinking' ? 'thinking' : st === 'speaking' ? 'talking' : 'idle');
}

/* ---------- Audio: detección de voz y forma de onda ---------- */
function setupAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!S.ctx || S.ctx.state === 'closed') S.ctx = new AC();
  if (S.ctx.state !== 'running') {
    S.ctx.resume().catch(() => {});
    // Respaldo: el próximo toque en la pantalla la reanuda (Android puede negarla sin gesto reciente).
    const wake = () => { if (S.ctx && S.ctx.state !== 'running') S.ctx.resume().catch(() => {}); };
    document.addEventListener('pointerdown', wake, { passive: true });
    document.addEventListener('touchend', wake, { passive: true });
  }
  const src = S.ctx.createMediaStreamSource(S.stream);
  S.analyser = S.ctx.createAnalyser();
  S.analyser.fftSize = 1024;
  src.connect(S.analyser);
  const buf = new Uint8Array(S.analyser.fftSize);
  const canvas = $('callWave');
  const g = canvas.getContext('2d');
  let floor = 0.01, speechMs = 0, silenceMs = 0, inSpeech = false, last = performance.now(), bargeMs = 0;
  const loop = () => {
    S.raf = requestAnimationFrame(loop);
    const now = performance.now(); const dt = now - last; last = now;
    S.analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
    const rms = S.muted ? 0 : Math.sqrt(sum / buf.length);
    drawWave(g, canvas, buf, rms);
    const thr = Math.max(0.022, floor * 3.2);
    if (!inSpeech && rms < thr) floor = floor * 0.98 + rms * 0.02;
    if (S.state === 'speaking') {
      // interrupción: voz sostenida por encima del umbral (más alto por el eco del parlante)
      if (rms > thr * 1.9) bargeMs += dt; else bargeMs = Math.max(0, bargeMs - dt);
      if (bargeMs > 320) { bargeMs = 0; bargeIn(); }
      return;
    }
    if (S.state !== 'listening') return;
    if (rms > thr) { speechMs += dt; silenceMs = 0; if (!inSpeech && speechMs > 140) { inSpeech = true; onSpeechStart(); } }
    else { silenceMs += dt; if (silenceMs > 250) speechMs = 0; if (inSpeech && silenceMs > 950) { inSpeech = false; onSpeechEnd(); } }
  };
  loop();
}
function drawWave(g, c, buf, rms) {
  const w = c.clientWidth, hh = c.clientHeight;
  if (!w) return;
  const dpr = Math.min(2, devicePixelRatio || 1);
  if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(hh * dpr); }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, hh);
  const bars = Math.floor(w / 6);
  const speaking = S.state === 'speaking';
  g.fillStyle = speaking ? '#e7c26a' : '#f4efe4';
  for (let i = 0; i < bars; i++) {
    const v = speaking ? (Math.sin(performance.now() / 120 + i * 0.6) * 0.5 + 0.5) * (S.level || 0.3) : Math.abs((buf[Math.floor((i / bars) * buf.length)] - 128) / 128) * 2.2 + rms;
    const bh = Math.max(3, Math.min(hh, v * hh * 1.6));
    g.globalAlpha = 0.35 + Math.min(0.65, v * 2);
    g.fillRect(i * 6, (hh - bh) / 2, 3, bh);
  }
  g.globalAlpha = 1;
}

/* ---------- Reconocimiento de voz ---------- */
let utterRec = null, utterChunks = [];
function setupSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { $('srNote').hidden = false; return; }
  const r = new SR();
  r.lang = S.lang.id; r.continuous = true; r.interimResults = true;
  r.onresult = (e) => {
    let fin = '', interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) fin += t + ' '; else interim += t; }
    S.turnText += fin;
    S.srText = (S.turnText + interim).trim();
    if (!$('transcript').hidden) liveLine(S.srText);
  };
  r.onerror = (e) => { if (e.error === 'not-allowed') $('srNote').hidden = false; };
  r.onend = () => { if (S.state === 'listening' && !S.muted) { try { r.start(); } catch {} } };
  S.sr = r;
}
function srStart() { if (S.sr) { try { S.sr.lang = S.lang.id; S.sr.start(); } catch {} } }
function srStop() { if (S.sr) { try { S.sr.stop(); } catch {} } }

function recMime() {
  const MR = window.MediaRecorder;
  if (!MR || !MR.isTypeSupported) return '';
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((t) => MR.isTypeSupported(t)) || '';
}
const serverStt = () => !!(engine.state.live && engine.state.caps && engine.state.caps.stt && window.MediaRecorder);
/** Graba el turno desde que empieza a escuchar (así no se pierde el comienzo de la frase mientras el detector decide). */
function recStart() {
  recDiscard();
  if (!serverStt() || S.muted) return;
  try {
    const mime = recMime();
    utterChunks = [];
    utterRec = mime ? new MediaRecorder(S.stream, { mimeType: mime, audioBitsPerSecond: 32000 }) : new MediaRecorder(S.stream);
    utterRec.ondataavailable = (e) => e.data && e.data.size && utterChunks.push(e.data);
    utterRec.start(1000);
    S.recAt = Date.now();
  } catch { utterRec = null; }
}
function recDiscard() { if (utterRec) { try { utterRec.ondataavailable = null; utterRec.stop(); } catch {} utterRec = null; utterChunks = []; } }
function listen() {
  if (S.state === 'ended') return;
  S.turnText = ''; S.srText = '';
  setState('listening');
  if (S.ctx && S.ctx.state === 'suspended') S.ctx.resume().catch(() => {});
  if (!S.muted) { srStart(); recStart(); }
}
function onSpeechStart() {
  // Si se escuchó mucho rato sin hablar, se reinicia la grabación para no mandar minutos de silencio.
  if (!utterRec || Date.now() - (S.recAt || 0) > 25_000) recStart();
}
async function onSpeechEnd() {
  setState('thinking');
  await new Promise((r) => setTimeout(r, 350)); // último resultado del reconocedor
  srStop();
  let text = S.srText.trim();
  let sttErr = null;
  if (utterRec) {
    const rec = utterRec; const chunks = utterChunks;
    utterRec = null;
    const blob = await new Promise((res) => { rec.onstop = () => res(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })); try { rec.stop(); } catch { res(null); } });
    if (blob && blob.size > 2000) { const server = await engine.transcribe(blob, S.lang.code); if (server) text = server; else sttErr = engine.state.sttError; }
  }
  if (S.state === 'ended') return;
  if (!text) {
    if (!S.sr && !(engine.state.caps && engine.state.caps.stt)) { await say('Te escucho, pero este navegador todavía no me deja entender las palabras. Probá desde Chrome o Edge, o escribime en el chat.'); }
    else if ((sttErr === 'quota' || sttErr === 'server' || sttErr === 'offline') && !S.sttWarned) {
      // Causa real, una sola vez por llamada: no es el micrófono de la persona.
      S.sttWarned = true;
      await say(sttErr === 'quota' ? 'Te oigo, pero el servicio que pasa tu voz a texto llegó a su límite de hoy, así que ahora no entiendo las palabras. No es tu micrófono. Podés escribirme en el chat.' : 'Te oigo, pero tuve un problema en el servidor para entender las palabras. No es tu micrófono. Probá de nuevo en un momento.');
    }
    listen();
    return;
  }
  addTranscript('Vos', text);
  S.utterances.push(text);
  if (CRISIS_RE.test(text)) showCrisis();
  const reply = await ask(text);
  if (S.state === 'ended') return;
  if (reply) { await say(reply); }
  if (/^(chau|adi[oó]s|hasta ma[ñn]ana|nos vemos)\b/i.test(text.trim())) { endCall('¡Hasta la próxima!'); return; }
  listen();
}

async function ask(text, isSystem = false) {
  const sys = systemPrompt({ lang: `${S.lang.name} (${S.lang.region})`, name: S.name, memory: S.optIn && !S.incognito ? S.memory : [], since: S.settings.lastCallAt ? new Date(S.settings.lastCallAt.toMillis ? S.settings.lastCallAt.toMillis() : S.settings.lastCallAt).toLocaleString('es-AR') : null });
  if (engine.state.live) {
    S.abort = new AbortController();
    try {
      const msgs = [...S.history.slice(-16), { role: 'user', content: text }];
      const r = await engine.chat({ messages: msgs, lang: S.lang.code, mode: 'fast', system: sys + '\nRespondé en 1 a 3 oraciones, para ser dichas en voz alta, sin listas ni formato.', agent: { id: 'companera', name: 'AgentiCuántico', system: sys }, signal: S.abort.signal, onDelta: () => {} });
      if (!r.local) { if (!isSystem) S.history.push({ role: 'user', content: text }); S.history.push({ role: 'assistant', content: r.text }); return r.text; }
    } catch (e) { if (e.name === 'AbortError') return null; }
    if (isSystem) return null;
  }
  if (isSystem) return null;
  const ctx = { name: S.name, memory: S.memory };
  const r = localReply(text, ctx);
  if (ctx.name && ctx.name !== S.name) S.name = ctx.name;
  S.history.push({ role: 'user', content: text }, { role: 'assistant', content: r.text });
  return r.text;
}

async function say(text) {
  if (S.state === 'ended') return;
  srStop();
  setState('speaking');
  addTranscript('AgentiCuántico', text);
  S.speaking = true;
  await speak(text, {
    lang: S.lang.id,
    onStart: () => setState('speaking'),
    onViseme: (v) => { avatar.setVisemes(v); S.level = v ? Math.min(1, (v.aa || 0) + (v.oh || 0) + (v.ee || 0) + 0.15) : 0; },
    onEnd: () => { avatar.setVisemes(null); },
    onUnavailable: () => { if (!S.voiceNote || Date.now() - S.voiceNote > 60000) { S.voiceNote = Date.now(); toast('Voz no disponible por un momento: la respuesta está en la transcripción.'); if ($('transcript').hidden) $('trToggle').click(); } }
  });
  S.speaking = false;
}
function bargeIn() {
  stopSpeech();
  avatar.setVisemes(null);
  addTranscript('—', '(interrumpiste)');
  listen();
}
function toggleMute() {
  if (S.state === 'ready' || S.state === 'ended') return;
  S.muted = !S.muted;
  S.stream && S.stream.getAudioTracks().forEach((t) => { t.enabled = !S.muted; });
  $('muteBtn').setAttribute('aria-pressed', String(S.muted));
  $('muteBtn').innerHTML = icon(S.muted ? 'micOff' : 'mic') + `<span>${S.muted ? 'Activar micrófono' : 'Silenciar'}</span>`;
  $('callShell').classList.toggle('is-muted', S.muted);
  if (S.muted) { srStop(); recDiscard(); } else if (S.state === 'listening') { srStart(); recStart(); }
  if (S.state === 'listening') setState('listening');
}

/* ---------- Transcripción ---------- */
function addTranscript(who, text) {
  const box = $('trList');
  box.querySelector('.live')?.remove();
  box.append(h('p', { class: who === 'Vos' ? 'me' : who === '—' ? 'sys' : 'ai' }, h('strong', {}, who + ': '), text));
  box.scrollTop = box.scrollHeight;
}
function liveLine(text) {
  const box = $('trList');
  let el = box.querySelector('.live');
  if (!el) { el = h('p', { class: 'me live' }); box.append(el); }
  el.innerHTML = '<strong>Vos: </strong>' + esc(text);
  box.scrollTop = box.scrollHeight;
}
function showCrisis() {
  /* Sin números de teléfono en pantalla: la respuesta de la IA (system prompt) sugiere ayuda profesional con calma. */
  const box = $('crisis');
  if (box) box.hidden = true;
}

/* ---------- Cierre y memoria ---------- */
async function endCall(msg) {
  if (S.state === 'ready' || S.state === 'ended') return;
  const secs = (Date.now() - S.startedAt) / 1000;
  S.state = 'ended';
  if (S.abort) S.abort.abort();
  stopSpeech(); srStop(); recDiscard();
  cancelAnimationFrame(S.raf);
  clearInterval(S.timer);
  clearInterval(S.hb); S.hb = 0;
  S.stream && S.stream.getTracks().forEach((t) => t.stop());
  try { S.ctx && S.ctx.close(); } catch {}
  try { S.wakeLock && S.wakeLock.release(); } catch {}
  avatar.setVisemes(null);
  setState('ended');
  mem.addUsage(secs);
  updateQuota();
  document.body.classList.remove('in-call');
  $('callShell').dataset.phase = 'summary';
  $('summaryMsg').textContent = msg || 'Llamada finalizada';
  $('summaryTime').textContent = `Duración: ${Math.floor(secs / 60)} min ${Math.round(secs % 60)} s`;
  let saved = '';
  if (S.user && S.optIn && !S.incognito && S.utterances.length) {
    const facts = extractFacts(S.utterances);
    if (S.name && !S.memory.some((m) => m.kind === 'nombre')) facts.unshift({ kind: 'nombre', text: S.name });
    try {
      const n = await mem.addFacts(S.user.uid, facts, S.memory);
      await mem.saveSettings(S.user.uid, { lastCallAt: new Date().toISOString() });
      saved = n ? `Guardé ${n} ${n === 1 ? 'dato nuevo' : 'datos nuevos'} para la próxima.` : 'No hubo datos nuevos para recordar.';
    } catch { saved = 'No pude guardar la memoria esta vez.'; }
  } else if (S.incognito) saved = 'Llamada incógnito: no se guardó nada.';
  else if (!S.user) saved = 'Ingresá con tu cuenta para que pueda recordarte día a día.';
  $('summaryMem').textContent = saved;
}
window.addEventListener('pagehide', () => { if (S.state !== 'ready' && S.state !== 'ended') endCall(); });
$('again').addEventListener('click', () => { $('callShell').dataset.phase = 'start'; setState('ready'); $('trList').innerHTML = ''; $('crisis').hidden = true; });
