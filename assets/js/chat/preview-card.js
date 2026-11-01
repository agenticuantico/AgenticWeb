/**
 * Vista previa automática de los entregables del agente (HTML, SVG, imágenes, Markdown y clips).
 *  - previewKind(art): 'html' | 'svg' | 'image' | 'video' | 'markdown' | null (no previsualizable).
 *  - previewHtml(art): documento HTML autocontenido para el iframe aislado (/app/preview.html, sandbox, sin red).
 *  - PreviewCard: tarjeta dentro del mensaje con la vista previa en vivo ajustada al ancho, «Expandir»,
 *    «Código», «Descargar» y «Publicar». Se reutiliza entre renders del mensaje (no recarga el iframe) y,
 *    mientras el agente escribe el archivo, vuelve a dibujar con un retardo corto (debounce) a medida que llega.
 * Las tarjetas se arman desde m.artifacts, que ya se guarda en el historial: al reabrir la conversación aparecen solas.
 */
import { h, icon } from '../ui.js';
import { renderMarkdown, escapeHtml } from './md.js';
import { cleanArtifact } from './clean.js';

(function css() {
  if (typeof document === 'undefined' || document.getElementById('ac-preview-css')) return;
  const l = document.createElement('link');
  l.id = 'ac-preview-css'; l.rel = 'stylesheet'; l.href = '/assets/css/preview-card.css?v=1.0.0';
  document.head.appendChild(l);
})();

const isDataOrBlob = (s) => /^(data:|blob:)/i.test(String(s || '').trim());

export function previewKind(art) {
  if (!art) return null;
  const name = String(art.name || '').toLowerCase(), mime = String(art.mime || '').toLowerCase();
  const c = String(art.content || '');
  if (mime === 'image/svg+xml' || /\.svg$/.test(name) || (/^\s*<svg[\s>]/i.test(c) && !/<html/i.test(c))) return 'svg';
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|avif)$/.test(name)) return (art.url || isDataOrBlob(c)) ? 'image' : null;
  if (mime.startsWith('video/') || /\.(mp4|webm|mov)$/.test(name)) return (art.url || isDataOrBlob(c)) ? 'video' : null;
  if (mime === 'text/html' || /\.html?$/.test(name)) return 'html';
  if (mime === 'text/markdown' || /\.(md|markdown)$/.test(name)) return 'markdown';
  return null;
}
export const isPreviewable = (art) => !!previewKind(art);

const PAGE = (body, css = '') => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#fff}${css}</style></head><body>${body}</body></html>`;
const MD_CSS = 'body{font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;color:#18181b;padding:20px 22px;max-width:820px;margin:0 auto;overflow-wrap:anywhere}h1,h2,h3{line-height:1.2;margin:1.1em 0 .5em}h1{font-size:1.7em}h2{font-size:1.3em}table{border-collapse:collapse;width:100%;display:block;overflow-x:auto}td,th{border:1px solid #e4e4e7;padding:6px 10px;text-align:left}pre{background:#f4f4f5;padding:12px;border-radius:10px;overflow-x:auto}code{font-family:ui-monospace,monospace;font-size:.92em}a{color:#3f6212}img{max-width:100%}blockquote{margin:0;padding-left:14px;border-left:3px solid #d4d4d8;color:#52525b}';

/** Documento HTML para mostrar el entregable en el iframe aislado. */
export function previewHtml(art) {
  const k = previewKind(art);
  const c = String(art.content || '');
  if (k === 'html') return cleanArtifact(c, art.name || 'index.html');
  if (k === 'svg') return PAGE(cleanArtifact(c, art.name || 'imagen.svg').replace(/<script[\s\S]*?<\/script>/gi, ''), 'body{display:grid;place-items:center;min-height:100vh}svg{max-width:100%;height:auto;max-height:100vh}');
  if (k === 'markdown') return PAGE(renderMarkdown(cleanArtifact(c, art.name || 'doc.md')), MD_CSS);
  const src = escapeHtml(art.url || c.trim());
  if (k === 'image') return PAGE(`<img src="${src}" alt="">`, 'body{display:grid;place-items:center;min-height:100vh;background:#f4f4f5}img{max-width:100%;max-height:100vh;object-fit:contain}');
  if (k === 'video') return PAGE(`<video src="${src}" controls autoplay muted loop playsinline></video>`, 'body{display:grid;place-items:center;min-height:100vh;background:#111}video{max-width:100%;max-height:100vh}');
  return PAGE(`<pre style="white-space:pre-wrap;font:14px/1.5 ui-monospace,monospace;padding:16px">${escapeHtml(c)}</pre>`);
}

/** Iframe aislado que se actualiza sin recargarse por cada evento (debounce). */
export class LiveFrame {
  constructor(cls, title) {
    this.html = ''; this.sent = null; this.ready = false; this.t = 0;
    this.el = h('iframe', { class: cls, title: title || 'Vista previa', sandbox: 'allow-scripts', src: '/app/preview.html', referrerpolicy: 'no-referrer', loading: 'eager', tabindex: '-1' });
    this.el.addEventListener('load', () => { this.ready = true; this.sent = null; this.flush(); });
  }
  set(html, { wait = 0 } = {}) {
    this.html = html;
    // Mientras se escribe: como mucho un redibujo cada `wait` ms (no se posterga indefinidamente).
    if (wait) { if (!this.t) this.t = setTimeout(() => { this.t = 0; this.flush(); }, wait); return; }
    clearTimeout(this.t); this.t = 0; this.flush();
  }
  flush() {
    if (!this.ready || !this.el.contentWindow || this.sent === this.html || !this.html) return;
    this.sent = this.html;
    this.el.contentWindow.postMessage({ type: 'ac-preview', html: this.html, fit: true }, '*');
  }
}

/**
 * Tarjeta de vista previa dentro del mensaje.
 * opts: { onExpand(file), onCode(), onDownload(), onPublish() }
 */
export class PreviewCard {
  constructor(art, opts = {}) {
    this.opts = opts; this.art = art;
    this.kind = previewKind(art);
    this.frame = new LiveFrame('pvc-frame', art.name);
    this.nameEl = h('strong', { class: 'pvc-name', 'data-no-i18n': '' }, art.name || '');
    this.stateEl = h('span', { class: 'pvc-state' });
    const expand = () => this.opts.onExpand && this.opts.onExpand({ name: this.art.name, mime: 'text/html', content: previewHtml(this.art) });
    const stage = h('div', { class: 'pvc-stage', role: 'button', tabindex: '0', title: 'Expandir', 'aria-label': 'Expandir vista previa', onclick: expand,
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); expand(); } } }, this.frame.el,
      h('span', { class: 'pvc-max', 'aria-hidden': 'true', html: icon('expand') }));
    const btn = (ic, label, fn, cls = '') => h('button', { class: 'pvc-btn ' + cls, type: 'button', onclick: fn }, h('span', { html: icon(ic) }), h('span', { class: 'pvc-lbl' }, label));
    this.acts = h('div', { class: 'pvc-acts' },
      btn('expand', 'Expandir', expand, 'pvc-primary'),
      (this.kind === 'image' || this.kind === 'video') ? null : btn('code', 'Código', () => this.opts.onCode && this.opts.onCode()),
      btn('download', 'Descargar', () => this.opts.onDownload && this.opts.onDownload()),
      btn('upload', 'Publicar', () => this.opts.onPublish && this.opts.onPublish()));
    this.el = h('div', { class: 'pvc pvc-' + this.kind, role: 'group', 'aria-label': 'Vista previa' },
      h('div', { class: 'pvc-h' }, h('span', { class: 'pvc-ic', html: icon(this.kind === 'markdown' ? 'file' : 'eye') }), this.nameEl, this.stateEl),
      stage, this.acts);
    this.update(art);
  }
  /** Nuevo contenido (o el mismo); mientras se escribe, re-render con debounce. */
  update(art, { writing = false } = {}) {
    this.art = art;
    this.nameEl.textContent = art.name || '';
    this.el.classList.toggle('is-writing', !!writing);
    this.stateEl.textContent = writing ? 'Escribiendo el archivo…' : '';
    this.acts.hidden = !!writing;
    const html = previewHtml(art);
    this.frame.set(html, { wait: writing ? 450 : 0 });
  }
}
