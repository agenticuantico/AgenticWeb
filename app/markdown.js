/**
 * Minimal, safe Markdown → HTML renderer for chat messages.
 * Everything is HTML-escaped first; only a whitelisted subset is produced.
 * Supports: fenced code blocks (```lang), inline code, headings, bold, italic,
 * links (http/https/mailto only), ordered/unordered lists, blockquotes, hr, paragraphs.
 */
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function inline(s) {
  const codes = [];
  s = s.replace(/`([^`\n]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = s.replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/g, (_, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/(^|\W)_([^_\n]+)_(?=\W|$)/g, '$1<em>$2</em>');
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[+i]}</code>`);
  return s;
}

export function renderMarkdown(src, { copyLabel = 'Copy' } = {}) {
  const text = esc(String(src || '').replace(/\r\n/g, '\n'));
  const blocks = [];
  // Fenced code blocks first (allow unterminated fence while streaming).
  const withPh = text.replace(/```([\w+-]*)\n([\s\S]*?)(?:```|$)/g, (_, lang, code) => {
    blocks.push({ lang: lang || 'text', code: code.replace(/\n$/, '') });
    return `\n\u0001${blocks.length - 1}\u0001\n`;
  });
  const lines = withPh.split('\n');
  const out = [];
  let para = [];
  let list = null; // {type, items}
  let quote = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join('<br>'))}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<${list.type}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.type}>`); list = null; } };
  const flushQuote = () => { if (quote.length) { out.push(`<blockquote>${inline(quote.join('<br>'))}</blockquote>`); quote = []; } };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };

  for (const line of lines) {
    let m;
    if ((m = line.match(/^\u0001(\d+)\u0001$/))) {
      flushAll();
      const b = blocks[+m[1]];
      out.push(`<div class="code-block"><div class="code-head"><span>${b.lang}</span><button type="button" class="code-copy" data-copy>${esc(copyLabel)}</button></div><pre><code class="lang-${b.lang}">${b.code}</code></pre></div>`);
    } else if (/^\s*$/.test(line)) {
      flushAll();
    } else if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      flushAll();
      const lvl = Math.min(4, m[1].length + 2);
      out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`);
    } else if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      flushAll(); out.push('<hr>');
    } else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      flushPara(); flushQuote();
      if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] }; }
      list.items.push(m[1]);
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      flushPara(); flushQuote();
      if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] }; }
      list.items.push(m[1]);
    } else if ((m = line.match(/^&gt;\s?(.*)$/))) {
      flushPara(); flushList(); quote.push(m[1]);
    } else {
      flushList(); flushQuote(); para.push(line);
    }
  }
  flushAll();
  return out.join('\n');
}

/** Plain text for speech: strips code blocks and markdown symbols. */
export function toSpeech(src) {
  return String(src || '')
    .replace(/```[\s\S]*?(```|$)/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*_>]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
