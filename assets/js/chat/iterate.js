/**
 * Órdenes de seguimiento sobre un diseño que ya está en la conversación («impleméntalo y mejóralo»,
 * «agrega panel admin 3D…», «cambia el color a violeta»). Misma detección que el servidor
 * (worker-v2/src/webdesign/iterate.ts · isIterateOrder). Sin DOM: se prueba con vitest.
 */
const EDIT_VERB = /(^|[^\p{L}])(implement\p{L}*|mejor\p{L}*|agreg\p{L}*|agrega|sum\p{L}*|a[ñn]ad\p{L}*|incorpor\p{L}*|integr\p{L}*|cambi\p{L}*|modific\p{L}*|actualiz\p{L}*|ampli\p{L}*|complet\p{L}*|pon[eé]\p{L}*|pone(le|lo)|sac\p{L}*|quit\p{L}*|elimin\p{L}*|reemplaz\p{L}*|convert\p{L}*|transform\p{L}*|hacelo|hac[eé]le|hacele|hazlo|segu[ií]|continu\p{L}*|desarroll\p{L}*|program\p{L}*|constru\p{L}*|termin\p{L}*|pul\p{L}*|refin\p{L}*|optimiz\p{L}*|improve|implement|add|change|update|make it|build|melhor\p{L}*|adicion\p{L}*|acrescent\p{L}*|mud\p{L}*)(?=$|[^\p{L}])/iu;
const PART = /(panel(\s+de)?\s+(admin\p{L}*|control|gesti[oó]n)|\badmin\p{L}*|dashboard|backoffice|cat[aá]logo|tienda|carrito|checkout|ficha|producto|productos|secci[oó]n|p[aá]gina|men[uú]|header|footer|hero|portada|\b3d\b|inmersiv\p{L}*|premium|animaci\p{L}*|colou?r|paleta|tipograf\p{L}*|t[ií]tulo|logo|bot[oó]n|versi[oó]n|dise[ñn]o|login|registro|blog|contacto|formulario|filtros?|buscador|pedidos|inventario|stock)/iu;
const NEW_SITE = /((otr[oa]|nuev[oa]|distint[oa])\s+(sitio|p[aá]gina|landing|web|dise[ñn]o|proyecto))|(desde cero|from scratch)/iu;
const QUESTION_ONLY = /^\s*¿?\s*(qu[eé]|c[oó]mo|por\s?qu[eé]|cu[aá]nto|cu[aá]l|d[oó]nde|explic\p{L}*)(?![\p{L}])[^]*\?\s*$/iu;

/** ¿Es una orden de construir / editar sobre el diseño que ya existe? */
export function isIterateOrder(text) {
  const t = String(text || '').trim();
  if (!t || t.length > 2000) return false;
  if (NEW_SITE.test(t)) return false;
  if (QUESTION_ONLY.test(t) && !/\b(pod[eé]s|podr[ií]as|can you)\b/i.test(t)) return false;
  if (EDIT_VERB.test(t)) return true;
  return PART.test(t) && t.split(/\s+/).length <= 14;
}

const isHtmlArt = (a) => a && a.content && !a.writing && (String(a.mime || '').toLowerCase() === 'text/html' || /\.html?$/i.test(String(a.name || '')));

/** Último diseño HTML de la conversación (el que se va a mejorar), con su versión. */
export function lastWebArtifact(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const arts = (list[i] && list[i].artifacts) || [];
    for (let k = arts.length - 1; k >= 0; k--) {
      const a = arts[k];
      if (isHtmlArt(a)) {
        const m = String(a.content).match(/<!--\s*ac:version\s+(\d+)\s*-->/);
        return { name: a.name || 'index.html', content: String(a.content), version: Number(a.version) || (m ? Number(m[1]) : 1) };
      }
    }
  }
  return null;
}
