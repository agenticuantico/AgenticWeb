/**
 * Markdown seguro → HTML. Todo el texto se escapa primero; solo se generan etiquetas propias.
 * Enlaces: solo http(s) y mailto, con rel="noopener noreferrer nofollow" y target=_blank.
 * Cubierto por tests de XSS (AgenticDev tests/web/md.test.mjs).
 */
export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function safeUrl(u) {
  const url = String(u || '').trim().replace(/&amp;/g, '&');
  if (/^(https?:\/\/|mailto:)/i.test(url) && !/[\s"'<>`]/.test(url)) return escapeHtml(url);
  return null;
}
function inline(s) {
  // s ya viene escapado
  const codes = [];
  s = s.replace(/`([^`\n]+)`/g, (_, c) => { codes.push('<code>' + c + '</code>'); return '\u0000' + (codes.length - 1) + '\u0000'; });
  s = s.replace(/\[([^\]\n]{1,200})\]\(([^)\s]{1,800})\)/g, (m, text, href) => {
    const u = safeUrl(href);
    return u ? `<a href="${u}" target="_blank" rel="noopener noreferrer nofollow">${text}</a>` : text;
  });
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<]{3,400}[^\s<.,;:!?)])/g, (m, pre, href) => {
    const u = safeUrl(href);
    return u ? `${pre}<a href="${u}" target="_blank" rel="noopener noreferrer nofollow">${href}</a>` : m;
  });
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^_\w])_([^_\n]+)_(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[+i]);
  return s;
}
let blockId = 0;
export function renderMarkdown(src, { codeActions = true } = {}) {
  const text = String(src ?? '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = /^```\s*([\w+#.-]{0,20})\s*$/.exec(line);
    if (fence) {
      const lang = fence[1] || '';
      const buf = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++;
      const id = 'cb' + (++blockId);
      const code = escapeHtml(buf.join('\n'));
      out.push(`<figure class="code-block" data-lang="${escapeHtml(lang)}"><figcaption><span>${escapeHtml(lang || 'código')}</span>${codeActions ? `<span class="code-actions"><button type="button" class="code-btn" data-code-action="canvas" data-target="${id}">Abrir en lienzo</button><button type="button" class="code-btn" data-code-action="copy" data-target="${id}">Copiar</button></span>` : ''}</figcaption><pre><code id="${id}">${code}</code></pre></figure>`);
      continue;
    }
    if (/^\s*$/.test(line)) { i++; continue; }
    const hd = /^(#{1,4})\s+(.+)$/.exec(line);
    if (hd) { const n = Math.min(4, hd[1].length + 1); out.push(`<h${n}>${inline(escapeHtml(hd[2]))}</h${n}>`); i++; continue; }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    if (/^\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const row = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(escapeHtml(c.trim())));
      const head = row(line); i += 2;
      const body = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) body.push(row(lines[i++]));
      out.push('<div class="md-table"><table><thead><tr>' + head.map((c) => `<th>${c}</th>`).join('') + '</tr></thead><tbody>' + body.map((r) => '<tr>' + r.map((c) => `<td>${c}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>');
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push('<blockquote>' + inline(escapeHtml(buf.join(' '))) + '</blockquote>');
      continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]/.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
        let it = lines[i++].replace(/^\s*([-*+]|\d+[.)])\s+/, '');
        const task = /^\[( |x|X)\]\s+/.exec(it);
        let pre = '';
        if (task) { pre = `<input type="checkbox" disabled ${task[1].trim() ? 'checked' : ''}> `; it = it.slice(task[0].length); }
        items.push('<li>' + pre + inline(escapeHtml(it)) + '</li>');
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    const buf = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(```|#{1,4}\s|>\s?|\s*([-*+]|\d+[.)])\s+|\|.*\|\s*$)/.test(lines[i])) buf.push(lines[i++]);
    if (!buf.length) { buf.push(lines[i++]); }
    out.push('<p>' + buf.map((l) => inline(escapeHtml(l))).join('<br>') + '</p>');
  }
  return out.join('\n');
}
/** Texto plano para la voz: sin código, sin marcas. */
export function toSpeech(src) {
  return String(src || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/^\|.*\|$/gm, ' ')
    .replace(/[*_#>~|]/g, '')
    .replace(/^\s*[-+]\s+/gm, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
