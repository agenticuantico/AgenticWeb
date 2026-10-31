/**
 * Análisis local de documentos (sin servidor): resumen extractivo, estadísticas y búsqueda de pasajes.
 * Con el servidor activo, el texto extraído se envía al modelo y la respuesta es generativa.
 */
const STOP = new Set('de la que el en y a los del se las por un para con no una su al lo como más pero sus le ya o este sí porque esta entre cuando muy sin sobre también me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto mí antes algunos qué unos yo otro otras otra él tanto esa estos mucho quienes nada muchos cual poco ella estar estas algunas algo nosotros mi mis tú te ti tu tus ellas nosotras vosotros vosotras os mío mía the of and to in is that for it as with was on are be this by from or an at which not have has were his her they their its you your we our can will would there been more also than then them these those about into only other some such what when who how all any each most de da do em um uma os as para com não por mais dos das ao à são'.split(' '));

function sentences(text) {
  return String(text).replace(/\s+/g, ' ').split(/(?<=[.!?¿¡])\s+(?=[A-ZÁÉÍÓÚÑ0-9"“])/).map((s) => s.trim()).filter((s) => s.length > 30 && s.length < 600);
}
function words(text) { return (String(text).toLowerCase().match(/[a-záéíóúñü0-9]{3,}/g) || []).filter((w) => !STOP.has(w)); }

export function summarize(text, n = 5) {
  const sents = sentences(text);
  if (!sents.length) return [];
  const freq = new Map();
  for (const w of words(text)) freq.set(w, (freq.get(w) || 0) + 1);
  const scored = sents.map((s, i) => {
    const ws = words(s);
    const score = ws.reduce((a, w) => a + (freq.get(w) || 0), 0) / Math.sqrt(ws.length + 1) + (i < 3 ? 2 : 0);
    return { s, i, score };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, n).sort((a, b) => a.i - b.i).map((x) => x.s);
}
export function keywords(text, n = 8) {
  const freq = new Map();
  for (const w of words(text)) freq.set(w, (freq.get(w) || 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([w]) => w);
}
function findPassages(text, q, n = 3) {
  const qs = words(q).filter((w) => w.length > 3);
  if (!qs.length) return [];
  return sentences(text).map((s) => ({ s, hit: qs.filter((w) => s.toLowerCase().includes(w)).length })).filter((x) => x.hit).sort((a, b) => b.hit - a.hit).slice(0, n).map((x) => x.s);
}

function tableStats(rows) {
  if (!rows || rows.length < 2) return '';
  const head = rows[0];
  const body = rows.slice(1);
  const lines = [`**${body.length} filas × ${head.length} columnas.**`, '', '| Columna | Tipo | Resumen |', '|---|---|---|'];
  head.slice(0, 12).forEach((h, c) => {
    const vals = body.map((r) => r[c]).filter((v) => v !== undefined && v !== '');
    const nums = vals.map((v) => Number(String(v).replace(/\./g, '').replace(',', '.'))).filter((v) => Number.isFinite(v));
    if (nums.length >= vals.length * 0.8 && nums.length) {
      const sum = nums.reduce((a, b) => a + b, 0);
      lines.push(`| ${String(h || 'Col ' + (c + 1)).replace(/\|/g, '/')} | número | suma ${sum.toLocaleString('es-AR')} · promedio ${(sum / nums.length).toLocaleString('es-AR', { maximumFractionDigits: 2 })} · mín ${Math.min(...nums).toLocaleString('es-AR')} · máx ${Math.max(...nums).toLocaleString('es-AR')} |`);
    } else {
      const uniq = new Set(vals).size;
      lines.push(`| ${String(h || 'Col ' + (c + 1)).replace(/\|/g, '/')} | texto | ${uniq} valores distintos |`);
    }
  });
  return lines.join('\n');
}

/** Devuelve markdown o null si no hay nada que analizar. */
export function analyzeLocally(docs, question = '', lang = 'es') {
  const usable = docs.filter((d) => !d.error);
  if (!usable.length) return null;
  const q = String(question || '').trim();
  const wantsSummary = !q || /resum|summary|resumo|de qu[eé] trata|analiz|qu[eé] dice|explic/i.test(q);
  const out = [];
  for (const d of usable) {
    out.push(`### ${d.name}`);
    if (d.kind === 'image') { out.push(`Imagen de ${d.width || '?'}×${d.height || '?'} px. La descripción del contenido de imágenes se hace con el modelo de visión del servidor; mientras tanto, la imagen queda adjunta al chat.`); continue; }
    if (d.table && d.table.length) out.push(tableStats(d.table));
    if (!d.text || d.text.length < 20) { if (!d.table) out.push('No encontré texto seleccionable (puede ser un escaneo).'); continue; }
    out.push(`${d.pages ? d.pages + ' páginas · ' : ''}${d.text.split(/\s+/).length.toLocaleString('es-AR')} palabras · temas: ${keywords(d.text).join(', ')}`);
    if (wantsSummary && !d.table) {
      const s = summarize(d.text, 5);
      if (s.length) out.push('', '**Puntos principales (extraídos del texto):**', ...s.map((x) => '- ' + x));
    } else if (!wantsSummary) {
      const p = findPassages(d.text, q);
      out.push('', p.length ? `**Pasajes que responden a «${q.slice(0, 80)}»:**` : `No encontré pasajes que mencionen «${q.slice(0, 80)}».`, ...p.map((x) => '> ' + x));
    }
  }
  out.push('', '_Análisis hecho en tu dispositivo por extracción de texto. Preguntame por un tema puntual del documento para buscar pasajes._');
  return out.join('\n');
}
