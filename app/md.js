/* AgentiCuántico · Markdown seguro (escapa todo el HTML; solo enlaces http/https/mailto) */
(function () {
  "use strict";
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }

  var KW = /\b(const|let|var|function|return|if|else|elif|for|while|import|from|export|default|class|def|async|await|new|try|catch|except|finally|raise|throw|True|False|None|true|false|null|undefined|print|in|of|and|or|not|lambda|with|as|pass|break|continue|switch|case|typeof|this|self|SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|JOIN|ON|GROUP|BY|ORDER|LIMIT|CREATE|TABLE)\b/;

  function highlight(code, lang) {
    lang = (lang || "").toLowerCase();
    var hashComments = /^(py|python|sh|bash|shell|yaml|yml|toml|rb|ruby|r)$/.test(lang);
    var re = new RegExp(
      "(" + (hashComments ? "#[^\\n]*|" : "") + "\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/|<!--[\\s\\S]*?-->)" + // 1 comments
      "|(\"(?:\\\\.|[^\"\\\\\\n])*\"|'(?:\\\\.|[^'\\\\\\n])*'|`(?:\\\\.|[^`\\\\])*`)" + // 2 strings
      "|\\b(\\d+(?:\\.\\d+)?)\\b" + // 3 numbers
      "|" + KW.source, "g");
    var out = "", last = 0, m;
    while ((m = re.exec(code))) {
      out += esc(code.slice(last, m.index));
      var cls = m[1] ? "c" : m[2] ? "s" : m[3] ? "n" : "k";
      out += '<span class="tk-' + cls + '">' + esc(m[0]) + "</span>";
      last = re.lastIndex;
      if (m[0].length === 0) re.lastIndex++;
    }
    return out + esc(code.slice(last));
  }

  function safeUrl(u) {
    u = String(u || "").trim();
    return /^(https?:\/\/|mailto:)/i.test(u) ? u : null;
  }

  function inline(s) {
    // s is raw text; protect inline code first
    var codes = [];
    s = s.replace(/`([^`\n]+)`/g, function (_, c) { codes.push(c); return "\u0000" + (codes.length - 1) + "\u0000"; });
    var links = [];
    s = s.replace(/\[([^\]\n]{1,200})\]\(([^)\s]{1,500})\)/g, function (all, t, u) {
      var url = safeUrl(u); if (!url) return all;
      links.push('<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(t) + "</a>");
      return "\u0001" + (links.length - 1) + "\u0001";
    });
    s = esc(s);
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;:!?])/g, function (_, pre, u) { return pre + '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + u + "</a>"; });
    s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>").replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<em>$2</em>").replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
    s = s.replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s).,;:!?])/g, "$1<em>$2</em>");
    s = s.replace(/\u0001(\d+)\u0001/g, function (_, i) { return links[+i]; });
    s = s.replace(/\u0000(\d+)\u0000/g, function (_, i) { return "<code>" + esc(codes[+i]) + "</code>"; });
    return s;
  }

  function codeBlock(code, lang, open) {
    var label = esc(lang || "code");
    return '<div class="codeblock' + (open ? " streaming" : "") + '"><div class="codehead"><span>' + label + '</span><button type="button" class="copy-code" data-copy-code><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg><span>' + esc((window.AC_T && window.AC_T("copy")) || "Copiar") + "</span></button></div><pre><code>" + highlight(code, lang) + "</code></pre></div>";
  }

  function render(src) {
    src = String(src || "").replace(/\r\n?/g, "\n");
    var lines = src.split("\n"), html = [], i = 0;
    var para = [];
    function flush() { if (para.length) { html.push("<p>" + para.map(inline).join("<br>") + "</p>"); para = []; } }
    while (i < lines.length) {
      var line = lines[i];
      var fence = line.match(/^\s*```\s*([\w+#.-]*)\s*$/);
      if (fence) {
        flush();
        var buf = []; i++;
        while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
        var closed = i < lines.length; i++;
        html.push(codeBlock(buf.join("\n"), fence[1], !closed));
        continue;
      }
      if (/^\s*$/.test(line)) { flush(); i++; continue; }
      var h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) { flush(); var lv = Math.min(h[1].length + 1, 5); html.push("<h" + lv + ">" + inline(h[2]) + "</h" + lv + ">"); i++; continue; }
      if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flush(); html.push("<hr>"); i++; continue; }
      if (/^\s*>/.test(line)) {
        flush(); var q = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) { q.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
        html.push("<blockquote>" + render(q.join("\n")) + "</blockquote>"); continue;
      }
      if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        flush();
        var row = function (l) { return l.trim().replace(/^\||\|$/g, "").split("|").map(function (c) { return c.trim(); }); };
        var head = row(line); i += 2; var body = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { body.push(row(lines[i])); i++; }
        html.push('<div class="tablewrap"><table><thead><tr>' + head.map(function (c) { return "<th>" + inline(c) + "</th>"; }).join("") + "</tr></thead><tbody>" +
          body.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + inline(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>");
        continue;
      }
      var li = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
      if (li) {
        flush();
        var ordered = /\d/.test(li[1]), items = [];
        while (i < lines.length) {
          var m2 = lines[i].match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
          if (m2 && /\d/.test(m2[1]) === ordered) { items.push(m2[2]); i++; }
          else if (lines[i].match(/^\s{2,}\S/) && items.length) { items[items.length - 1] += "\n" + lines[i].trim(); i++; }
          else break;
        }
        var tag = ordered ? "ol" : "ul";
        html.push("<" + tag + ">" + items.map(function (t) {
          var task = t.match(/^\[( |x)\]\s+(.*)$/i);
          return "<li>" + (task ? '<span class="chk">' + (task[1] === " " ? "☐" : "☑") + "</span> " + inline(task[2]) : t.split("\n").map(inline).join("<br>")) + "</li>";
        }).join("") + "</" + tag + ">");
        continue;
      }
      para.push(line); i++;
    }
    flush();
    return html.join("");
  }

  window.AC_MD = { render: render, esc: esc, highlight: highlight };
})();
