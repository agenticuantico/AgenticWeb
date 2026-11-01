/**
 * Creación de imágenes y videos desde el chat (solo opciones gratuitas) con gobernanza de IA.
 *  - Imagen: POST /api/image. El servidor modera el pedido, genera, revisa el resultado, lo etiqueta «Generado con IA»
 *    (metadatos XMP/IPTC) y lo registra. Si el servidor no tiene motor libre, devuelve un trabajo para que este navegador
 *    use la red pública comunitaria con su propia IP; el resultado vuelve al servidor para revisión, etiqueta y bitácora.
 *  - Video con IA (3 s): POST /api/video → motor del servidor (con token gratuito) o del navegador (cuota gratuita propia
 *    de la persona). Progreso en vivo, vista previa y descarga. Si no hay capacidad gratuita, se arma un clip animado con
 *    imágenes (Ken Burns + fundidos, grabado con MediaRecorder) y se dice con honestidad que no es video generado por IA.
 * Nunca se muestran nombres de proveedores. No se guarda nada en el historial salvo el pedido (texto).
 */
import { h, icon, uid } from '../ui.js';
import * as engine from './engine.js';

/* ---------- Estilos (archivo propio para no tocar las hojas compartidas) ---------- */
(function css() {
  if (typeof document === 'undefined' || document.getElementById('ac-media-css')) return;
  const l = document.createElement('link');
  l.id = 'ac-media-css'; l.rel = 'stylesheet'; l.href = '/assets/css/media.css?v=2.0.0';
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
  failed: 'No se pudo crear la imagen. Probá de nuevo.',
  output_blocked: 'El resultado no pasó la revisión de seguridad, así que no lo muestro. Probá con otra descripción.',
  video_quota_exceeded: 'Llegaste al límite de videos con IA de hoy. Mañana se renueva.',
  video_failed: 'No se pudo crear el video. Probá de nuevo.'
};
export class MediaError extends Error { constructor(code, message) { super(code); this.code = code; this.serverMessage = message || ''; } }
export const POLICY_URL = '/gobernanza/';
export const errorText = (code) => ERRORS[code] || ERRORS.failed;

const sleep = (ms, signal) => new Promise((res, rej) => { const t = setTimeout(res, ms); signal && signal.addEventListener('abort', () => { clearTimeout(t); rej(Object.assign(new Error('aborted'), { name: 'AbortError' })); }, { once: true }); });
async function errorFrom(res) {
  let j = null; try { j = await res.json(); } catch {}
  return { code: (j && j.error) || 'failed', message: (j && j.message) || '', client: j && j.client, j };
}

/* Red pública comunitaria gratuita (sin key, sin marca de agua), usada desde este navegador cuando el servidor no tiene motor libre. */
const NET = 'https://aihorde.net/api/v2';
const NET_H = { apikey: '0000000000', 'Client-Agent': 'agenticuantico:2.5:agenticuantico.dev.ar', 'Content-Type': 'application/json' };
async function publicNetworkImage(job, { signal, onStatus } = {}) {
  const sub = await fetch(NET + '/generate/async', { method: 'POST', headers: NET_H, signal, body: JSON.stringify({ prompt: job.prompt, params: job.params, nsfw: false, censor_nsfw: true, r2: false, shared: false, models: job.models }) });
  if (!sub.ok) throw new MediaError('image_unavailable');
  const { id } = await sub.json();
  if (!id) throw new MediaError('image_unavailable');
  const t0 = Date.now();
  try {
    for (;;) {
      if (Date.now() - t0 > 180_000) throw new MediaError('image_unavailable');
      await sleep(2500, signal);
      const c = await (await fetch(`${NET}/generate/check/${id}`, { headers: NET_H, signal })).json().catch(() => ({}));
      if (c.faulted || c.is_possible === false) throw new MediaError('image_unavailable');
      onStatus && onStatus({ queue: c.queue_position || 0, wait: c.wait_time || 0, processing: !!c.processing });
      if (c.done) break;
    }
    const st = await (await fetch(`${NET}/generate/status/${id}`, { headers: NET_H, signal })).json();
    const g = st && st.generations && st.generations[0];
    if (!g || !g.img) throw new MediaError('image_unavailable');
    if (g.censored) throw new MediaError('output_blocked');
    if (/^https?:/.test(g.img)) return await (await fetch(g.img, { signal })).blob();
    const bin = atob(g.img); const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new Blob([u], { type: 'image/webp' });
  } catch (e) {
    fetch(`${NET}/generate/status/${id}`, { method: 'DELETE', headers: NET_H }).catch(() => {});
    throw e;
  }
}

/** Pide la imagen. Devuelve { blob, aiId }. o: { aspect, seed, signal, onStatus } */
export async function requestImage(prompt, { aspect = 'square', seed, signal, onStatus } = {}) {
  await engine.init();
  if (!engine.state.live) throw new MediaError('offline');
  let res;
  try {
    res = await engine.apiFetch('/api/image', { method: 'POST', signal, body: seed == null ? { prompt, aspect } : { prompt, aspect, seed } });
  } catch (e) {
    if (e && e.name === 'AbortError') throw e;
    throw new MediaError('offline');
  }
  if (!res.ok) {
    const err = await errorFrom(res);
    if (err.code === 'image_unavailable' && err.client && err.client.id) {
      // El pedido ya pasó la moderación del servidor: este navegador genera y el servidor revisa, etiqueta y registra.
      onStatus && onStatus({ phase: 'network' });
      const raw = await publicNetworkImage(err.client, { signal, onStatus });
      const fd = new FormData(); fd.append('image', raw, 'imagen.webp');
      let fin;
      try { fin = await engine.apiFetch(`/api/image/${err.client.id}/result`, { method: 'POST', signal, body: fd, raw: true }); }
      catch (e) { if (e && e.name === 'AbortError') throw e; throw new MediaError('offline'); }
      if (!fin.ok) { const e2 = await errorFrom(fin); throw new MediaError(e2.code, e2.message); }
      return { blob: await fin.blob(), aiId: fin.headers.get('X-AI-Id') || err.client.id };
    }
    throw new MediaError(err.code, err.message);
  }
  const blob = await res.blob();
  if (!blob.type.startsWith('image/') || blob.size < 500) throw new MediaError('failed');
  return { blob, aiId: res.headers.get('X-AI-Id') || '' };
}

/* ---------- Etiqueta «Generado con IA» en los metadatos (XMP/IPTC) cuando el navegador reencuadra la imagen ---------- */
const DST = 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia';
export function xmpPacket(id, kind = 'image') {
  const api = String((engine.state && engine.state.base) || '').replace(/\/+$/, '');
  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/" xmlns:aq="https://agenticuantico.dev.ar/ns/ai/1.0/" xmp:CreatorTool="AgentiCuántico" xmp:CreateDate="${new Date().toISOString()}" Iptc4xmpExt:DigitalSourceType="${DST}" aq:Label="Generado con IA" aq:Id="${id || ''}" aq:Kind="${kind}"${id && api ? ` aq:Manifest="${api}/api/ai/manifest/${id}"` : ''}><dc:description><rdf:Alt><rdf:li xml:lang="x-default">Generado con IA · AgentiCuántico</rdf:li></rdf:Alt></dc:description></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
}
export async function labelJpegBlob(blob, id) {
  const b = new Uint8Array(await blob.arrayBuffer());
  if (b[0] !== 0xff || b[1] !== 0xd8) return blob;
  const payload = new TextEncoder().encode('http://ns.adobe.com/xap/1.0/\0' + xmpPacket(id));
  const len = payload.length + 2;
  if (len > 0xffff) return blob;
  let at = 2;
  if (b[2] === 0xff && b[3] === 0xe0) at = 4 + ((b[4] << 8) | b[5]);
  return new Blob([b.subarray(0, at), new Uint8Array([0xff, 0xe1, len >> 8, len & 255]), payload, b.subarray(at)], { type: 'image/jpeg' });
}
export async function labelMp4Blob(blob, id) {
  const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
  if (String.fromCharCode(head[4], head[5], head[6], head[7]) !== 'ftyp') return blob;
  const x = new TextEncoder().encode(xmpPacket(id, 'video'));
  const size = 8 + 16 + x.length;
  const box = new Uint8Array([size >>> 24, (size >>> 16) & 255, (size >>> 8) & 255, size & 255, 0x75, 0x75, 0x69, 0x64, 0xbe, 0x7a, 0xcf, 0xcb, 0x97, 0xa9, 0x42, 0xe8, 0x9c, 0x71, 0x99, 0x94, 0x91, 0xe3, 0xaf, 0xac]);
  return new Blob([blob, box, x], { type: blob.type || 'video/mp4' });
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

async function toFormat(bitmap, aspect, original, aiId) {
  const ratio = RATIO[aspect] || 1;
  if (original && Math.abs(bitmap.width / bitmap.height - ratio) < 0.02) return { blob: original, ext: original.type === 'image/png' ? 'png' : original.type === 'image/webp' ? 'webp' : 'jpg' };
  const [W, H] = DIMS[aspect] || DIMS.square;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const r = coverRect(bitmap.width, bitmap.height, RATIO[aspect] || 1);
  g.drawImage(bitmap, r.sx, r.sy, r.sw, r.sh, 0, 0, W, H);
  const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.92));
  return { blob: blob ? await labelJpegBlob(blob, aiId) : original, ext: 'jpg' };
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

/* ---------- Video con IA (gratis): motor del servidor o del navegador ---------- */
const VIDEO_SPACE = 'https://lightricks-ltx-video-distilled.hf.space';
let fnIndexP = null;
async function spaceFnIndex(api) {
  if (!fnIndexP) fnIndexP = fetch(VIDEO_SPACE + '/config').then((r) => r.json()).catch(() => null);
  const cfg = await fnIndexP;
  const i = cfg && Array.isArray(cfg.dependencies) ? cfg.dependencies.findIndex((d) => d.api_name === api) : -1;
  if (i < 0) { fnIndexP = null; throw new MediaError('video_capacity'); }
  return i;
}
async function readEvents(res, onData, signal) {
  const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
  for (;;) {
    if (signal && signal.aborted) { reader.cancel().catch(() => {}); throw Object.assign(new Error('aborted'), { name: 'AbortError' }); }
    const { done, value } = await reader.read();
    if (done) return;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      let d; try { d = JSON.parse(line.slice(5)); } catch { continue; }
      if (onData(d) === true) { reader.cancel().catch(() => {}); return; }
    }
  }
}
/** Corre el modelo de video en el navegador con la cuota gratuita de esta persona. Devuelve el MP4 (Blob). */
async function browserVideo(job, image, { signal, onProgress }) {
  const data = job.data.slice();
  let api = 'text_to_video';
  if (image) {
    const fd = new FormData(); fd.append('files', image, 'frame.jpg');
    const up = await fetch(VIDEO_SPACE + '/gradio_api/upload', { method: 'POST', body: fd, signal });
    const paths = up.ok ? await up.json().catch(() => null) : null;
    if (paths && paths[0]) { data[2] = { path: paths[0], meta: { _type: 'gradio.FileData' } }; data[6] = 'image-to-video'; api = 'image_to_video'; }
  }
  const fn = await spaceFnIndex(api);
  const session = Math.random().toString(36).slice(2, 13);
  const join = await fetch(VIDEO_SPACE + '/gradio_api/queue/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal, body: JSON.stringify({ data, fn_index: fn, session_hash: session, event_data: null, trigger_id: null }) });
  if (!join.ok) throw new MediaError('video_capacity');
  const stream = await fetch(`${VIDEO_SPACE}/gradio_api/queue/data?session_hash=${session}`, { signal });
  if (!stream.ok || !stream.body) throw new MediaError('video_capacity');
  let out = null, fail = null, p = 0.05;
  await readEvents(stream, (m) => {
    if (m.msg === 'estimation') onProgress({ phase: 'queue', queue: m.rank || 0, eta: m.rank_eta || 0, progress: p });
    else if (m.msg === 'process_starts') { p = 0.12; onProgress({ phase: 'generating', progress: p, eta: m.eta || 0 }); }
    else if (m.msg === 'progress') { p = Math.min(0.9, p + 0.08); onProgress({ phase: 'generating', progress: p }); }
    else if (m.msg === 'heartbeat') { p = Math.min(0.9, p + 0.01); onProgress({ phase: 'generating', progress: p }); }
    else if (m.msg === 'process_completed') {
      if (m.success && m.output && m.output.data) out = m.output.data; else fail = (m.output && (m.output.error || m.output.title)) || 'error';
      return true;
    }
    return false;
  }, signal);
  if (!out) throw new MediaError(/quota|limit/i.test(String(fail || '')) ? 'video_capacity' : 'video_failed');
  const v = out[0];
  const url = typeof v === 'string' ? v : (v && v.video && (v.video.url || (v.video.path && `${VIDEO_SPACE}/gradio_api/file=${v.video.path}`))) || (v && v.url);
  if (!url) throw new MediaError('video_failed');
  onProgress({ phase: 'download', progress: 0.94 });
  const r = await fetch(url, { signal });
  if (!r.ok) throw new MediaError('video_failed');
  return r.blob();
}
async function firstFrame(blob) {
  try {
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.src = URL.createObjectURL(blob);
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = rej; setTimeout(rej, 6000); });
    v.currentTime = Math.min(0.5, (v.duration || 1) / 2);
    await new Promise((res) => { v.onseeked = res; setTimeout(res, 1500); });
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    URL.revokeObjectURL(v.src);
    return await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
  } catch { return null; }
}
async function blobToDataUrl(blob) { return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(blob); }); }

/** Intenta un video con IA. Devuelve { blob, ext, aiId } o lanza MediaError (video_unavailable/video_capacity → caer al clip). */
async function aiVideo(st, { signal, onProgress }) {
  await engine.init();
  if (!engine.state.live) throw new MediaError('video_unavailable');
  const body = { prompt: st.prompt, aspect: st.aspect };
  if (st.fromImage) { const d = await blobToDataUrl(st.fromImage); if (d && d.length < 3_900_000) body.image = d; }
  let res;
  try { res = await engine.apiFetch('/api/video', { method: 'POST', signal, body }); }
  catch (e) { if (e && e.name === 'AbortError') throw e; throw new MediaError('video_unavailable'); }
  if (!res.ok) { const e = await errorFrom(res); throw new MediaError(e.code === 'video_unavailable' ? 'video_unavailable' : e.code, e.message); }
  const job = await res.json();
  const base = engine.state.base;
  try {
    if (job.engine === 'server') {
      const s = await engine.apiFetch(`/api/video/${job.id}/stream`, { signal });
      let done = null, err = null;
      await readEvents(s, (d) => {
        if (d.status === 'done') { done = d; return true; }
        if (d.status === 'error') { err = d.error; return true; }
        onProgress({ phase: d.status === 'queued' || d.status === 'waiting' ? 'queue' : 'generating', progress: d.progress || 0 });
        return false;
      }, signal);
      if (!done) throw new MediaError(err === 'video_capacity' ? 'video_capacity' : 'video_failed');
      const f = await fetch(done.url, { signal });
      return { blob: await f.blob(), ext: 'mp4', aiId: job.id };
    }
    const raw = await browserVideo(job, st.fromImage || null, { signal, onProgress });
    onProgress({ phase: 'label', progress: 0.97 });
    const fd = new FormData(); fd.append('video', raw, 'video.mp4');
    const frame = await firstFrame(raw); if (frame) fd.append('frame', frame, 'frame.jpg');
    const fin = await engine.apiFetch(`/api/video/${job.id}/result`, { method: 'POST', signal, body: fd, raw: true });
    if (!fin.ok) { const e = await errorFrom(fin); throw new MediaError(e.code, e.message); }
    const j = await fin.json();
    const f = await fetch(j.url, { signal });
    return { blob: f.ok ? await f.blob() : await labelMp4Blob(raw, job.id), ext: 'mp4', aiId: job.id };
  } catch (e) {
    if (!(e && e.name === 'AbortError') && !(e && e.code === 'output_blocked')) engine.apiFetch(`/api/video/${job.id}/fail`, { method: 'POST', body: { code: (e && e.code) || 'failed' } }).catch(() => {});
    void base;
    throw e;
  }
}

/* ---------- Tarjeta en el chat ---------- */
function slug(s) { return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'agenticuantico'; }
function save(url, name) { const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); }
const PREFIX = { image: 'Imagen creada: ', video: 'Video: ' };

/** Mensaje de asistente para un pedido de imagen o video (solo el texto del pedido se guarda en el historial). */
export function mediaMessage(intent) {
  const { fromImage, ...rest } = intent;
  const m = { id: uid('m'), role: 'assistant', kind: intent.kind, content: PREFIX[intent.kind] + intent.prompt, at: Date.now(), _media: { ...rest, status: 'idle' } };
  if (fromImage) m._media.fromImage = fromImage;
  return m;
}
export const isMediaMessage = (m) => m && m.role === 'assistant' && (m.kind === 'image' || m.kind === 'video');

const REPORT_REASONS = [['sexual', 'Contenido sexual'], ['menores', 'Involucra a menores'], ['persona_real', 'Persona real sin consentimiento'], ['violencia', 'Violencia'], ['odio', 'Odio o discriminación'], ['ilegal', 'Actividad ilegal'], ['error', 'Resultado incorrecto'], ['otro', 'Otro motivo']];
function reportBox(st, onDone) {
  const sel = h('select', { class: 'select mc-rep-sel', 'aria-label': 'Motivo del reporte' }, ...REPORT_REASONS.map(([v, l]) => h('option', { value: v }, l)));
  const txt = h('input', { class: 'input mc-rep-txt', type: 'text', maxlength: '300', placeholder: 'Detalle (opcional)', 'aria-label': 'Detalle del reporte' });
  const msg = h('small', { class: 'mc-rep-msg', role: 'status' });
  const send = h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: async () => {
    send.disabled = true;
    try {
      const r = await engine.apiFetch('/api/ai/report', { method: 'POST', body: { reason: sel.value, details: txt.value, id: st.aiId || undefined } });
      if (!r.ok) throw new Error();
      msg.textContent = 'Gracias. Lo revisa una persona del equipo.'; setTimeout(onDone, 1800);
    } catch { msg.textContent = 'No se pudo enviar. Escribinos a agenticuantico@gmail.com.'; send.disabled = false; }
  } }, 'Enviar reporte');
  return h('div', { class: 'mc-rep' }, h('strong', {}, 'Reportar este resultado'), sel, txt, h('div', { class: 'mc-rep-row' }, send, h('button', { class: 'btn btn-sm', type: 'button', onclick: onDone }, 'Cancelar')), msg);
}

/**
 * Devuelve (y reutiliza) el nodo de la tarjeta del mensaje. `chat` es la instancia de ChatApp
 * (para recrear con «Otra versión» usa chat.runMedia; para animar una imagen usa chat.createMedia).
 */
export function mediaCard(m, chat) {
  if (m._card) return m._card;
  const st = m._media || { kind: m.kind, prompt: String(m.content || '').replace(/^(Imagen creada|Clip animado|Video): /, ''), aspect: m.kind === 'video' ? 'landscape' : 'square', status: 'stored' };
  m._media = st;
  const isVideo = st.kind === 'video';
  const card = h('div', { class: 'mc' + (isVideo ? ' mc-video' : ''), role: 'group', 'aria-label': isVideo ? 'Video' : 'Imagen creada' });
  const title = h('strong', {});
  const head = h('div', { class: 'mc-h' }, h('span', { class: 'mc-ic', html: icon(isVideo ? 'play' : 'image') }), h('span', { class: 'mc-t' }, title, h('small', { 'data-no-i18n': '' }, st.prompt)));
  const [W, H] = DIMS[st.aspect] || DIMS.square;
  const stage = h('div', { class: 'mc-stage', style: `aspect-ratio:${W}/${H}` });
  const acts = h('div', { class: 'mc-acts' });
  const note = h('p', { class: 'mc-note' });
  const extra = h('div', { class: 'mc-extra' });
  card.append(head, stage, acts, note, extra);
  m._card = card;

  card._render = () => {
    stage.innerHTML = ''; acts.innerHTML = ''; note.textContent = ''; note.hidden = true;
    title.textContent = !isVideo ? 'Imagen' : st.clip ? 'Clip animado' : 'Video con IA';
    if (st.status === 'loading') {
      stage.classList.add('is-loading');
      stage.append(h('div', { class: 'mc-load' }, h('span', { class: 'mc-spin', 'aria-hidden': 'true' }), h('strong', {}, st.label || (isVideo ? 'Creando video…' : 'Creando imagen…')), st.sub ? h('small', {}, st.sub) : null,
        isVideo || st.progress ? h('span', { class: 'mc-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round((st.progress || 0) * 100) }, h('i', { style: `width:${Math.round((st.progress || 0) * 100)}%` })) : null));
      return;
    }
    stage.classList.remove('is-loading');
    if (st.status === 'done' && st.url) {
      if (isVideo) stage.append(h('video', { class: 'mc-media', src: st.url, controls: '', autoplay: '', muted: '', loop: '', playsinline: '', 'aria-label': st.clip ? 'Vista previa del clip animado' : 'Vista previa del video' }));
      else stage.append(h('img', { class: 'mc-media', src: st.url, alt: st.prompt }));
      stage.append(h('span', { class: 'mc-ai', title: 'Contenido generado con inteligencia artificial' }, h('span', { html: icon('spark') }), 'Generado con IA'));
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
        h('button', { class: 'btn btn-sm btn-primary mc-dl', type: 'button', onclick: () => save(st.url, `${slug(st.prompt)}-generado-con-ia.${st.ext || 'jpg'}`) }, h('span', { html: icon('download') }), isVideo ? (st.ext === 'mp4' ? 'Descargar MP4' : 'Descargar WebM') : 'Descargar'),
        h('button', { class: 'btn btn-sm mc-again', type: 'button', disabled: chat && chat.busy ? '' : null, onclick: () => chat && chat.runMedia && chat.runMedia(m, { again: true }) }, h('span', { html: icon('refresh') }), 'Otra versión'));
      if (!isVideo && st.blob && chat && chat.createMedia) acts.append(h('button', { class: 'btn btn-sm mc-animate', type: 'button', disabled: chat.busy ? '' : null, onclick: () => chat.createMedia({ kind: 'video', prompt: st.prompt, aspect: st.aspect === 'square' ? 'square' : st.aspect, fromImage: st.blob, seconds: 5, scenes: 1 }) }, h('span', { html: icon('play') }), 'Animar con IA'));
      acts.append(h('button', { class: 'btn btn-sm btn-ghost mc-report', type: 'button', onclick: () => { extra.innerHTML = ''; extra.append(reportBox(st, () => { extra.innerHTML = ''; })); } }, h('span', { html: icon('flag') }), 'Reportar'));
      const parts = [];
      if (isVideo && st.clip) parts.push(st.clipReason ? st.clipReason + ' ' : '', 'Clip animado hecho con imágenes generadas, con movimiento y transiciones. No es un video generado por IA.');
      else if (isVideo) parts.push('Video generado con IA. Lleva la marca «Generado con IA» en sus metadatos.');
      else parts.push('Imagen generada con IA. Lleva la marca «Generado con IA» en sus metadatos.');
      note.hidden = false;
      note.append(...parts.filter(Boolean).map((t) => document.createTextNode(t)), ' ', h('a', { href: POLICY_URL, target: '_blank', rel: 'noopener' }, 'Política de uso de IA'));
      return;
    }
    const blocked = st.error === 'prompt_blocked' || st.error === 'output_blocked';
    const msg = st.status === 'error' ? (blocked && st.serverMessage) || errorText(st.error) : 'Las imágenes y los videos no se guardan en el historial.';
    const empty = h('div', { class: 'mc-empty' + (st.status === 'error' ? ' err' : '') + (blocked ? ' blocked' : '') }, h('span', { html: icon(blocked ? 'shield' : st.status === 'error' ? 'warn' : 'image') }), h('p', {}, msg));
    if (blocked) empty.append(h('p', { class: 'mc-policy' }, h('a', { href: POLICY_URL, target: '_blank', rel: 'noopener' }, 'Ver la política de uso de IA')));
    stage.append(empty);
    if (!blocked) acts.append(h('button', { class: 'btn btn-sm mc-again', type: 'button', onclick: () => chat && chat.runMedia && chat.runMedia(m, { again: true }) }, h('span', { html: icon('refresh') }), st.status === 'error' ? 'Reintentar' : 'Volver a crear'));
  };
  card._render();
  return card;
}

const PHASE_SUB = { queue: 'En la fila de espera', generating: 'Generando los cuadros', download: 'Descargando', label: 'Revisión de seguridad y etiqueta' };

/**
 * Ejecuta el pedido de la tarjeta: imagen (1 llamada) o video (IA si hay capacidad gratuita; si no, clip animado).
 * o: { signal, onScroll, again }
 */
export async function runMedia(m, o = {}) {
  const st = m._media;
  const render = () => m._card && m._card._render();
  const bar = () => { const b = m._card && m._card.querySelector('.mc-bar i'); if (b) b.style.width = Math.round((st.progress || 0) * 100) + '%'; const s = m._card && m._card.querySelector('.mc-load small'); if (s && st.sub) s.textContent = st.sub; };
  if (st.url) { try { URL.revokeObjectURL(st.url); } catch {} st.url = null; }
  st.error = null; st.serverMessage = ''; st.status = 'loading'; st.progress = 0; st.sub = ''; st.clip = false; st.clipReason = ''; st.aiId = '';
  const again = !!o.again;
  const seedBase = Math.floor(Math.random() * 1e6);
  const netStatus = (x) => {
    if (x.phase === 'network') { st.label = 'Creando imagen…'; st.sub = 'Usando la red gratuita de respaldo (puede tardar hasta un minuto)'; st.progress = 0.1; render(); return; }
    if (typeof x.queue === 'number') { st.sub = x.processing ? 'Generando…' : x.queue > 0 ? `En la fila de espera · puesto ${x.queue}` : 'Generando…'; st.progress = Math.min(0.9, (st.progress || 0.1) + 0.05); bar(); }
  };
  try {
    if (st.kind === 'image') {
      st.label = 'Creando imagen…'; render();
      const { blob, aiId } = await requestImage(st.prompt, { aspect: st.aspect, seed: again ? seedBase : undefined, signal: o.signal, onStatus: netStatus });
      const bm = await loadBitmap(blob);
      const out = await toFormat(bm, st.aspect, blob, aiId);
      st.blob = out.blob; st.url = URL.createObjectURL(out.blob); st.ext = out.ext; st.aiId = aiId;
    } else {
      let fellBack = null;
      if (!st.clipOnly) {
        st.label = 'Creando video con IA…'; st.sub = 'Preparando'; st.progress = 0.02; render();
        try {
          const r = await aiVideo(st, { signal: o.signal, onProgress: (x) => { st.progress = Math.max(st.progress || 0, x.progress || 0); st.sub = x.phase === 'queue' && x.queue ? `En la fila de espera · puesto ${x.queue}` : PHASE_SUB[x.phase] || st.sub; bar(); } });
          st.url = URL.createObjectURL(r.blob); st.ext = r.ext; st.aiId = r.aiId; st.blob = r.blob;
        } catch (e) {
          if (e && e.name === 'AbortError') throw e;
          if (e && (e.code === 'prompt_blocked' || e.code === 'output_blocked' || e.code === 'rate_limited' || e.code === 'turnstile_required' || e.code === 'maintenance')) throw e;
          fellBack = e && e.code;
        }
      }
      if (!st.url) {
        if (!canMakeClips()) throw new MediaError('no_recorder');
        st.clip = true;
        st.clipReason = fellBack === 'video_quota_exceeded' ? 'Llegaste al límite de videos con IA de hoy.' : fellBack ? 'Ahora no hay capacidad gratuita para video con IA.' : '';
        const n = st.fromImage ? 1 : (st.scenes || 3);
        const prompts = scenePrompts(st.prompt, n);
        let ok = 0;
        st.label = 'Creando clip animado…'; st.sub = st.clipReason ? st.clipReason + ' Armo un clip con imágenes.' : `0 / ${n}`; st.progress = 0; render();
        // Una escena por vez (respeta el límite por minuto). Si una falla después de tener al menos una,
        // el clip se arma con las que hay: con una sola imagen igual hay zoom/paneo.
        const blobs = st.fromImage ? [st.fromImage] : [];
        let firstErr = null;
        for (let i = blobs.length; i < n; i++) {
          try {
            blobs.push((await requestImage(prompts[i], { aspect: st.aspect, seed: seedBase + i * 7919, signal: o.signal, onStatus: netStatus })).blob);
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
        const clip = await buildClip(bitmaps, { aspect: st.aspect, seconds: st.seconds, caption: st.caption, signal: o.signal, onProgress: (p) => { st.progress = 0.4 + p * 0.6; bar(); } });
        const labeled = clip.ext === 'mp4' ? await labelMp4Blob(clip.blob, '') : clip.blob;
        st.url = URL.createObjectURL(labeled); st.ext = clip.ext;
      }
    }
    st.status = 'done';
  } catch (e) {
    st.status = 'error';
    st.error = e && e.name === 'AbortError' ? 'stopped' : (e && e.code) || 'failed';
    st.serverMessage = (e && e.serverMessage) || '';
  }
  render();
  o.onScroll && o.onScroll();
  return st.status === 'done';
}
