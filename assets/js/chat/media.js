/**
 * Creación de imágenes y clips animados desde el chat (gratis).
 *  - Imagen: POST /api/image del servidor. Se muestra una tarjeta «Creando imagen…» y luego la imagen con «Descargar».
 *  - Clip animado: 2–4 imágenes generadas + movimiento Ken Burns (zoom/paneo) + fundidos, dibujado en <canvas>
 *    y grabado en el navegador con MediaRecorder (MP4 si el navegador lo permite, si no WebM). No es video con IA.
 * No se guarda nada en el historial salvo el pedido (texto): las imágenes y los clips viven solo en esta pestaña.
 */
import { h, icon, uid } from '../ui.js';
import * as engine from './engine.js';

/* ---------- Estilos (archivo propio para no tocar las hojas compartidas) ---------- */
(function css() {
  if (typeof document === 'undefined' || document.getElementById('ac-media-css')) return;
  const l = document.createElement('link');
  l.id = 'ac-media-css'; l.rel = 'stylesheet'; l.href = '/assets/css/media.css?v=1.0.0';
  document.head.appendChild(l);
})();

/* ---------- Detección del pedido (es / en / pt) ---------- */
const VERB = String.raw`(?:cre[aá](?:me|r)?|gener[aá](?:me|r)?|dibuj[aá](?:me|r)?|hac[eé](?:me)?|haceme|hacer|pint[aá](?:me)?|arm[aá](?:me)?|mostr[aá](?:me)?|dise[ñn][aá](?:me)?|quiero|necesito|make|create|generate|draw|paint|render|design|produce|i want|crie|criar|cria|gere|gerar|gera|fa[cç]a|fazer|faz|desenhe|desenhar|desenha|quero|preciso)`;
const IMG_NOUN = String.raw`(?:im[aá]gen(?:es)?|imagem|imagens|image|images|picture|pic|foto(?:grafía|grafia)?s?|photo|ilustraci[oó]n|ilustra[cç][aã]o|illustration|dibujo|desenho|drawing|logo(?:tipo)?|p[oó]ster|poster|wallpaper|fondo de pantalla|papel de parede|retrato|portrait|avatar|icono|ícone|icon|arte|artwork)`;
const VID_NOUN = String.raw`(?:v[ií]deos?|clip(?: animado)?|animaci[oó]n|anima[cç][aã]o|animation|reel|slideshow)`;
const LINK = String.raw`(?:\s+(?:de|del|de la|con|sobre|que muestre|mostrando|para|of|showing|about|with|for|com|do|da|dos|das|pra))?`;
const B = String.raw`(?![\p{L}\p{N}])`;

const RE_VIDEO = new RegExp(String.raw`^\s*(?:por favor\s+|please\s+|pode\s+|podr[ií]as\s+|can you\s+)?${VERB}${B}[^\n]{0,30}?(?<![\p{L}])(?:(?:un|una|me|a|an|um|uma|el|la|o)\s+)?(?:corto\s+|peque[ñn]o\s+|short\s+|little\s+|breve\s+)?${VID_NOUN}${B}${LINK}\s*([\s\S]*)$`, 'iu');
const RE_IMAGE = new RegExp(String.raw`^\s*(?:por favor\s+|please\s+|pode\s+|podr[ií]as\s+|can you\s+)?${VERB}${B}[^\n]{0,30}?(?<![\p{L}])(?:(?:un|una|me|a|an|um|uma|el|la|o)\s+)?${IMG_NOUN}${B}${LINK}\s*([\s\S]*)$`, 'iu');
const RE_DRAW = /^\s*(?:por favor\s+|please\s+)?(?:dibuj[aá](?:me)?|draw(?: me)?|desenh[ae](?:-me)?)\s+([\s\S]{2,})$/i;

export function aspectFrom(text) {
  const t = String(text || '').toLowerCase();
  if (/\b(vertical|retrato|portrait|9:16|historia|story|stories|reel|tiktok|celular)\b/.test(t)) return 'portrait';
  if (/\b(cuadrad[ao]|quadrad[ao]|square|1:1|instagram post)\b/.test(t)) return 'square';
  if (/\b(horizontal|paisaje|landscape|16:9|panor[aá]mic[ao]|wide|banner|portada|youtube)\b/.test(t)) return 'landscape';
  return null;
}
function captionFrom(text) {
  const m = /(?:con (?:el )?(?:texto|t[ií]tulo|leyenda)|with (?:the )?(?:caption|text|title)|com (?:o )?(?:texto|t[ií]tulo|legenda))\s*[:]?\s*["“«']([^"”»']{1,80})["”»']/i.exec(text);
  return m ? m[1].trim() : '';
}
function secondsFrom(text) {
  const m = /(\d{1,2})\s*(?:s|seg(?:undos?)?|sec(?:onds?)?|segundos?)\b/i.exec(text);
  return m ? Math.max(5, Math.min(10, Number(m[1]))) : 8;
}
function scenesFrom(text) {
  const m = /(\d)\s*(?:escenas|im[aá]genes|imagens|scenes|images|cenas)/i.exec(text);
  return m ? Math.max(2, Math.min(4, Number(m[1]))) : 3;
}
function cleanSubject(s) {
  return String(s || '')
    .replace(/(?:con (?:el )?(?:texto|t[ií]tulo|leyenda)|with (?:the )?(?:caption|text|title)|com (?:o )?(?:texto|t[ií]tulo|legenda))\s*:?\s*["“«'][^"”»']*["”»']/gi, '')
    .replace(/\b(?:de|of|com)?\s*\d{1,2}\s*(?:s|seg(?:undos?)?|sec(?:onds?)?)\b/gi, '')
    .replace(/\b(?:en|in|em)?\s*(?:formato\s+)?(?:vertical|horizontal|cuadrad[ao]|square|portrait|landscape|16:9|9:16|1:1)\b/gi, '')
    .replace(/\s+/g, ' ').replace(/^[\s,.:;-]+|[\s,.:;?!-]+$/g, '').trim()
    .replace(/^(?:de|del|sobre|con|para|of|about|with|for|com|do|da|sobre)\s+/i, '').trim();
}

/** Devuelve { kind:'image'|'video', prompt, aspect, caption?, seconds?, scenes? } o null. */
export function detectMediaIntent(text) {
  const t = String(text || '').trim();
  if (!t || t.length > 700) return null;
  let m = RE_VIDEO.exec(t);
  if (m) {
    const prompt = cleanSubject(m[1]);
    if (prompt.length < 2) return null;
    return { kind: 'video', prompt, aspect: aspectFrom(t) || 'landscape', caption: captionFrom(t), seconds: secondsFrom(t), scenes: scenesFrom(t) };
  }
  m = RE_IMAGE.exec(t) || RE_DRAW.exec(t);
  if (m) {
    let prompt = cleanSubject(m[1]);
    // «un logo para…», «un póster de…»: el tipo de pieza es parte de lo que hay que dibujar
    const head = t.slice(0, t.length - m[1].length);
    const kind = /(logo(?:tipo)?|p[oó]ster|wallpaper|fondo de pantalla|papel de parede|icono|ícone|icon|retrato|portrait|avatar|ilustraci[oó]n|illustration|ilustra[cç][aã]o|dibujo|drawing|desenho)(?![\p{L}])/iu.exec(head);
    if (kind) prompt = cleanSubject(t.slice(kind.index)) || prompt;
    if (prompt.length < 2) return null;
    return { kind: 'image', prompt, aspect: aspectFrom(t) || 'square' };
  }
  return null;
}

/* ---------- Servidor ---------- */
const ERRORS = {
  offline: 'La creación de imágenes necesita conexión con el servidor. Probá de nuevo en un rato.',
  image_quota_exceeded: 'Llegaste al límite de imágenes de hoy. Mañana se renueva.',
  rate_limited: 'Hiciste muchos pedidos seguidos. Esperá un minuto y probá de nuevo.',
  prompt_blocked: 'No puedo crear esa imagen. Probá con otra descripción.',
  bad_prompt: 'Contame qué querés ver en la imagen.',
  image_unavailable: 'La creación de imágenes no está disponible en este momento. Probá más tarde.',
  turnstile_required: 'Iniciá sesión para crear imágenes.',
  maintenance: 'La creación de imágenes está pausada momentáneamente.',
  no_recorder: 'Este navegador no permite grabar el clip. Probá con Chrome, Edge o Safari actualizados.',
  stopped: 'Creación detenida.',
  failed: 'No se pudo crear la imagen. Probá de nuevo.'
};
export class MediaError extends Error { constructor(code) { super(code); this.code = code; } }
export const errorText = (code) => ERRORS[code] || ERRORS.failed;

export async function requestImage(prompt, { aspect = 'square', seed, signal } = {}) {
  await engine.init();
  if (!engine.state.live) throw new MediaError('offline');
  let res;
  try {
    res = await engine.apiFetch('/api/image', { method: 'POST', signal, body: { prompt, aspect, seed } });
  } catch (e) {
    if (e && e.name === 'AbortError') throw e;
    throw new MediaError('offline');
  }
  if (!res.ok) {
    let code = 'failed';
    try { const j = await res.json(); code = (j && j.error) || code; } catch {}
    throw new MediaError(code);
  }
  const blob = await res.blob();
  if (!blob.type.startsWith('image/') || blob.size < 500) throw new MediaError('failed');
  return blob;
}

/* ---------- Imagen: recorte al formato pedido ---------- */
export const DIMS = { square: [1080, 1080], landscape: [1280, 720], portrait: [720, 1280] };
const RATIO = { square: 1, landscape: 16 / 9, portrait: 9 / 16 };

export async function loadBitmap(blob) {
  if (typeof createImageBitmap === 'function') { try { return await createImageBitmap(blob); } catch {} }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image(); img.decoding = 'async'; img.src = url;
    await img.decode();
    return img;
  } finally { setTimeout(() => URL.revokeObjectURL(url), 2000); }
}

/** Zona de recorte «cover» al formato pedido. */
export function coverRect(sw, sh, ratio) {
  const r = sw / sh;
  if (Math.abs(r - ratio) < 0.01) return { sx: 0, sy: 0, sw, sh };
  if (r > ratio) { const w = sh * ratio; return { sx: (sw - w) / 2, sy: 0, sw: w, sh }; }
  const hh = sw / ratio;
  return { sx: 0, sy: (sh - hh) / 2, sw, sh: hh };
}

async function toFormat(bitmap, aspect) {
  const [W, H] = DIMS[aspect] || DIMS.square;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const r = coverRect(bitmap.width, bitmap.height, RATIO[aspect] || 1);
  g.drawImage(bitmap, r.sx, r.sy, r.sw, r.sh, 0, 0, W, H);
  const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.92));
  return blob;
}

/* ---------- Clip animado (Ken Burns + fundidos) ---------- */
export function pickRecorderMime() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return null;
  // MP4 solo con H.264 (se reproduce en todos lados); si no, WebM; «video/mp4» genérico al final (Safari).
  const list = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
  return list.find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }) || null;
}
export const canMakeClips = () => typeof document !== 'undefined' && !!pickRecorderMime() && typeof HTMLCanvasElement !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream;

const ease = (x) => x * x * (3 - 2 * x);
/** Movimiento de cada escena: alterna acercar/alejar y la dirección del paneo. */
export function kenBurns(i, p) {
  const zoomIn = i % 2 === 0;
  const s = zoomIn ? 1.04 + 0.14 * p : 1.18 - 0.14 * p;
  const dirs = [[-1, -0.5], [1, 0.4], [0.6, 1], [-0.8, -1]];
  const [dx, dy] = dirs[i % dirs.length];
  return { s, x: dx * (p - 0.5) * 0.06, y: dy * (p - 0.5) * 0.05 };
}
/** Opacidad de cada escena en el tiempo t (s): fundido cruzado de `fade` segundos. */
export function sceneAlpha(i, t, n, seg, fade) {
  const start = i * seg, end = start + seg;
  if (t < start - fade || t > end + (i === n - 1 ? 1 : 0)) return 0;
  if (i > 0 && t < start) return ease((t - (start - fade)) / fade);
  if (i < n - 1 && t > end - fade) return 1; // la siguiente se funde encima
  return 1;
}

function drawScene(g, bm, W, H, kb, alpha) {
  if (alpha <= 0) return;
  const r = coverRect(bm.width, bm.height, W / H);
  const dw = W * kb.s, dh = H * kb.s;
  g.globalAlpha = alpha;
  g.drawImage(bm, r.sx, r.sy, r.sw, r.sh, (W - dw) / 2 + kb.x * W, (H - dh) / 2 + kb.y * H, dw, dh);
  g.globalAlpha = 1;
}
function drawCaption(g, W, H, text, a) {
  if (!text || a <= 0) return;
  const grad = g.createLinearGradient(0, H * 0.62, 0, H);
  grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, `rgba(0,0,0,${0.55 * a})`);
  g.fillStyle = grad; g.fillRect(0, H * 0.62, W, H * 0.38);
  const size = Math.round(Math.min(W, H) * 0.06);
  g.font = `600 ${size}px Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillStyle = `rgba(255,255,255,${a})`;
  g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = size * 0.4;
  const words = text.split(/\s+/); const lines = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > W * 0.84 && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  lines.slice(-2).forEach((l, i, all) => g.fillText(l, W / 2, H - size * 0.9 - (all.length - 1 - i) * size * 1.25));
  g.shadowBlur = 0;
}

/**
 * Dibuja y graba el clip en tiempo real. Devuelve { blob, mime, ext }.
 * bitmaps: ImageBitmap|HTMLImageElement[]; o: { aspect, seconds, caption, fps, onProgress, signal }
 */
export async function buildClip(bitmaps, o = {}) {
  const mime = pickRecorderMime();
  if (!mime || !bitmaps.length) throw new MediaError('no_recorder');
  const [W, H] = DIMS[o.aspect] || DIMS.landscape;
  const seconds = Math.max(5, Math.min(10, o.seconds || 8));
  const fps = o.fps || 30;
  const n = bitmaps.length, seg = seconds / n, fade = Math.min(0.9, seg * 0.35);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  // Lienzo en CPU: la captura con MediaRecorder es estable en todos los navegadores (con GPU algunos descartan cuadros).
  const g = c.getContext('2d', { alpha: false, willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  const frame = (t) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < n; i++) {
      const a = sceneAlpha(i, t, n, seg, fade);
      if (!a) continue;
      const p = Math.max(0, Math.min(1, (t - (i * seg - fade)) / (seg + fade)));
      drawScene(g, bitmaps[i], W, H, kenBurns(i, p), a);
    }
    // fundido de entrada y salida en negro
    const edge = Math.min(1, t / 0.5, (seconds - t) / 0.5);
    if (edge < 1) { g.fillStyle = `rgba(0,0,0,${1 - Math.max(0, edge)})`; g.fillRect(0, 0, W, H); }
    drawCaption(g, W, H, o.caption, Math.max(0, Math.min(1, (t - 0.4) / 0.6, (seconds - t) / 0.5)));
  };
  frame(0);
  // captureStream(0) + requestFrame(): un cuadro por dibujo, aunque la pestaña no esté pintando (segundo plano, headless).
  let stream = c.captureStream(0);
  let track = stream.getVideoTracks()[0];
  const manual = !!(track && typeof track.requestFrame === 'function');
  if (!manual) { stream.getTracks().forEach((tr) => tr.stop()); stream = c.captureStream(fps); track = stream.getVideoTracks()[0]; }
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const done = new Promise((res, rej) => { rec.onstop = res; rec.onerror = (e) => rej(e.error || new Error('recorder')); });
  rec.start(250);
  const t0 = performance.now();
  await new Promise((resolve, reject) => {
    const tick = () => {
      if (o.signal && o.signal.aborted) { reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); return; }
      const t = (performance.now() - t0) / 1000;
      frame(Math.min(t, seconds));
      if (manual) track.requestFrame();
      o.onProgress && o.onProgress(Math.min(1, t / seconds));
      if (t >= seconds) { resolve(); return; }
      // setTimeout (no rAF) para que siga grabando aunque la pestaña quede en segundo plano
      setTimeout(tick, 1000 / fps);
    };
    tick();
  }).finally(() => { try { rec.state !== 'inactive' && rec.stop(); } catch {} stream.getTracks().forEach((tr) => tr.stop()); });
  await done;
  const type = mime.split(';')[0];
  const blob = new Blob(chunks, { type });
  if (blob.size < 1000) throw new MediaError('no_recorder');
  return { blob, mime: type, ext: type === 'video/mp4' ? 'mp4' : 'webm' };
}

/* ---------- Variaciones de escena para el clip ---------- */
const SHOTS = ['plano general, luz cinematográfica', 'primer plano con detalle', 'otro ángulo, profundidad de campo', 'vista amplia al atardecer'];
export function scenePrompts(prompt, n) { return Array.from({ length: n }, (_, i) => `${prompt}, ${SHOTS[i % SHOTS.length]}`); }

/* ---------- Tarjeta en el chat ---------- */
function slug(s) { return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'agenticuantico'; }
function save(url, name) { const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); }
const PREFIX = { image: 'Imagen creada: ', video: 'Clip animado: ' };

/** Mensaje de asistente para un pedido de imagen o clip (solo el texto del pedido se guarda en el historial). */
export function mediaMessage(intent) {
  return { id: uid('m'), role: 'assistant', kind: intent.kind, content: PREFIX[intent.kind] + intent.prompt, at: Date.now(), _media: { ...intent, status: 'idle' } };
}
export const isMediaMessage = (m) => m && m.role === 'assistant' && (m.kind === 'image' || m.kind === 'video');

/**
 * Devuelve (y reutiliza) el nodo de la tarjeta del mensaje. `chat` es la instancia de ChatApp
 * (para recrear con «Otra versión» usa chat.runMedia).
 */
export function mediaCard(m, chat) {
  if (m._card) return m._card;
  const st = m._media || { kind: m.kind, prompt: String(m.content || '').replace(/^(Imagen creada|Clip animado): /, ''), aspect: m.kind === 'video' ? 'landscape' : 'square', status: 'stored' };
  m._media = st;
  const isVideo = st.kind === 'video';
  const card = h('div', { class: 'mc' + (isVideo ? ' mc-video' : ''), role: 'group', 'aria-label': isVideo ? 'Clip animado' : 'Imagen creada' });
  const head = h('div', { class: 'mc-h' }, h('span', { class: 'mc-ic', html: icon(isVideo ? 'play' : 'image') }), h('span', { class: 'mc-t' }, h('strong', {}, isVideo ? 'Clip animado' : 'Imagen'), h('small', { 'data-no-i18n': '' }, st.prompt)));
  const [W, H] = DIMS[st.aspect] || DIMS.square;
  const stage = h('div', { class: 'mc-stage', style: `aspect-ratio:${W}/${H}` });
  const acts = h('div', { class: 'mc-acts' });
  const note = isVideo ? h('p', { class: 'mc-note' }, 'Clip animado hecho con imágenes generadas, con movimiento y transiciones. No es un video generado por IA.') : null;
  card.append(head, stage, acts);
  if (note) card.append(note);
  m._card = card;

  card._render = () => {
    stage.innerHTML = ''; acts.innerHTML = '';
    if (st.status === 'loading') {
      stage.classList.add('is-loading');
      stage.append(h('div', { class: 'mc-load' }, h('span', { class: 'mc-spin', 'aria-hidden': 'true' }), h('strong', {}, st.label || (isVideo ? 'Creando clip animado…' : 'Creando imagen…')), st.sub ? h('small', {}, st.sub) : null,
        isVideo ? h('span', { class: 'mc-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round((st.progress || 0) * 100) }, h('i', { style: `width:${Math.round((st.progress || 0) * 100)}%` })) : null));
      return;
    }
    stage.classList.remove('is-loading');
    if (st.status === 'done' && st.url) {
      if (isVideo) stage.append(h('video', { class: 'mc-media', src: st.url, controls: '', autoplay: '', muted: '', loop: '', playsinline: '', 'aria-label': 'Vista previa del clip animado' }));
      else stage.append(h('img', { class: 'mc-media', src: st.url, alt: st.prompt }));
      if (isVideo) {
        const v = stage.querySelector('video'); v.muted = true;
        // WebM grabado en el navegador no trae duración: se calcula una vez para que la barra de tiempo funcione.
        v.addEventListener('loadedmetadata', () => {
          if (v.duration !== Infinity) return;
          const back = () => { v.removeEventListener('timeupdate', back); v.currentTime = 0; v.play && v.play().catch(() => {}); };
          v.addEventListener('timeupdate', back); v.currentTime = 1e101;
        }, { once: true });
        v.play && v.play().catch(() => {});
      }
      acts.append(
        h('button', { class: 'btn btn-sm btn-primary mc-dl', type: 'button', onclick: () => save(st.url, `${slug(st.prompt)}.${st.ext || 'jpg'}`) }, h('span', { html: icon('download') }), isVideo ? (st.ext === 'mp4' ? 'Descargar MP4' : 'Descargar WebM') : 'Descargar'),
        h('button', { class: 'btn btn-sm mc-again', type: 'button', disabled: chat && chat.busy ? '' : null, onclick: () => chat && chat.runMedia && chat.runMedia(m, { again: true }) }, h('span', { html: icon('refresh') }), 'Otra versión'));
      return;
    }
    const msg = st.status === 'error' ? errorText(st.error) : 'Las imágenes y los clips no se guardan en el historial.';
    stage.append(h('div', { class: 'mc-empty' + (st.status === 'error' ? ' err' : '') }, h('span', { html: icon(st.status === 'error' ? 'warn' : 'image') }), h('p', {}, msg)));
    if (st.error !== 'prompt_blocked') acts.append(h('button', { class: 'btn btn-sm mc-again', type: 'button', onclick: () => chat && chat.runMedia && chat.runMedia(m, { again: true }) }, h('span', { html: icon('refresh') }), st.status === 'error' ? 'Reintentar' : 'Volver a crear'));
  };
  card._render();
  return card;
}

/**
 * Ejecuta el pedido de la tarjeta: imagen (1 llamada) o clip (2–4 imágenes + grabación).
 * o: { signal, onScroll }
 */
export async function runMedia(m, o = {}) {
  const st = m._media;
  const render = () => m._card && m._card._render();
  if (st.url) { try { URL.revokeObjectURL(st.url); } catch {} st.url = null; }
  st.error = null; st.status = 'loading'; st.progress = 0; st.sub = '';
  const seedBase = Math.floor(Math.random() * 1e6);
  try {
    if (st.kind === 'image') {
      st.label = 'Creando imagen…'; render();
      const blob = await requestImage(st.prompt, { aspect: st.aspect, seed: seedBase, signal: o.signal });
      const bm = await loadBitmap(blob);
      const out = await toFormat(bm, st.aspect);
      st.url = URL.createObjectURL(out || blob); st.ext = 'jpg';
    } else {
      if (!canMakeClips()) throw new MediaError('no_recorder');
      const n = st.scenes || 3;
      const prompts = scenePrompts(st.prompt, n);
      let ok = 0;
      st.label = 'Creando las escenas…'; st.sub = `0 / ${n}`; render();
      // Una escena por vez (respeta el límite por minuto). Si una falla después de tener al menos una,
      // el clip se arma con las que hay: con una sola imagen igual hay zoom/paneo.
      const blobs = [];
      let firstErr = null;
      for (let i = 0; i < n; i++) {
        try {
          blobs.push(await requestImage(prompts[i], { aspect: st.aspect, seed: seedBase + i * 7919, signal: o.signal }));
          ok++; st.sub = `${ok} / ${n}`; st.progress = (ok / n) * 0.4; render();
        } catch (e) {
          if (e && e.name === 'AbortError') throw e;
          firstErr = firstErr || e;
          if (blobs.length || (e && /quota|blocked|offline|turnstile|maintenance/.test(e.code || ''))) break;
        }
      }
      if (o.signal && o.signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      if (!blobs.length) throw firstErr || new MediaError('failed');
      const bitmaps = await Promise.all(blobs.map(loadBitmap));
      st.label = 'Animando el clip…'; st.sub = 'Movimiento y transiciones'; render();
      const clip = await buildClip(bitmaps, { aspect: st.aspect, seconds: st.seconds, caption: st.caption, signal: o.signal, onProgress: (p) => { st.progress = 0.4 + p * 0.6; const bar = m._card && m._card.querySelector('.mc-bar i'); if (bar) bar.style.width = Math.round(st.progress * 100) + '%'; } });
      st.url = URL.createObjectURL(clip.blob); st.ext = clip.ext;
    }
    st.status = 'done';
  } catch (e) {
    st.status = 'error';
    st.error = e && e.name === 'AbortError' ? 'stopped' : (e && e.code) || 'failed';
  }
  render();
  o.onScroll && o.onScroll();
  return st.status === 'done';
}
