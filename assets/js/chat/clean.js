/**
 * Limpieza de lo que devuelve el modelo antes de mostrarlo, copiarlo o descargarlo.
 *  - cleanArtifact: quita bloques de código Markdown (```html, ```HTML, ``` con o sin cierre), backticks sueltos
 *    antes de <!DOCTYPE> y, en HTML, cualquier texto antes de <!DOCTYPE/<html> o después de </html>.
 *  - cleanThought: quita el encabezado de razonamiento filtrado ("thought Crea…", "thought\n…", <thought>…</thought>).
 */
export function cleanArtifact(raw, name = '') {
  let s = String(raw == null ? '' : raw).replace(/\r\n?/g, '\n');
  const fenced = s.match(/```[ \t]*[\w.+#-]*[ \t]*\n([\s\S]*?)\n?[ \t]*```/);
  if (fenced && (fenced[1].length > s.length * 0.4 || /<!doctype|<html/i.test(fenced[1]))) s = fenced[1];
  s = s.replace(/^\s*```[ \t]*[\w.+#-]*[ \t]*\n?/, '').replace(/\n?[ \t]*```\s*$/, '');
  const isHtml = /\.html?$/i.test(name) || /<!doctype html|<html[\s>]/i.test(s);
  if (isHtml) {
    const start = s.search(/<!doctype html|<html[\s>]/i);
    if (start > 0) s = s.slice(start);
    const end = s.search(/<\/html>/i);
    if (end >= 0) s = s.slice(0, end + 7);
    s = s.replace(/^[`'\s]+(?=<)/, '');
  }
  return s.trim() + '\n';
}

export function cleanThought(text) {
  let s = String(text == null ? '' : text).replace(/<(thought|thinking)>[\s\S]*?<\/\1>/gi, '');
  if (/^\s*thought\s*$/.test(s)) return '';
  return s.replace(/^(\s*)\**thought\**(?:\s*\n|\s*:\s*|\s+(?=[\p{Lu}¿¡"«“]))/u, '$1');
}
