/**
 * Diseño web del agente (lado navegador).
 *  - isWebDesign(texto): detecta pedidos de sitio / landing / página / interfaz (es/en/pt).
 *  - pickTemplate(texto): elige la plantilla inmersiva más cercana (café, restaurante, tecnología, moda/producto, inmobiliaria).
 *  - localSite(texto, lang): sin servidor, arma el sitio con la plantilla prediseñada (nunca un informe genérico).
 * Las plantillas viven en /assets/tpl/<id>.html + <id>.json (las mismas que usa el servidor).
 */

// Misma detección que el servidor (worker-v2/src/webdesign/index.ts).
const WEB_RE = /\b(landing(\s?page)?|sitio(\s+web)?|site|website|web\s?site|web\s?page|webpage|homepage|home\s?page|one[-\s]?page|interfa(z|ces|ce)|ux\/ui|ui\/ux|frontend|front-end|maqueta|mockup|e-?commerce|tienda\s+(online|virtual|web)|loja\s+virtual|p[aá]gina\s+web)\b/i;
const PAGE_RE = /\bp[aá]gina\b/i;
const MAKE_RE = /\b(hac[eé]|hacer|haceme|hacme|cre[aá]|crear|creame|cri[ae]r?|arm[aá]|armar|armame|dise[ñn][aá]|dise[ñn]ar|dise[ñn]ame|desenh\w*|desenvolv\w*|constru\w*|gener[aá]\w*|maquet\w*|program[aá]\w*|quiero|necesito|make|build|create|design|generate|code|develop)(?![a-záéíóúñç])/i;
const NOT_WEB = /\b(informe|reporte|report|relat[oó]rio|resumen|summary|ensayo|essay|art[ií]culo|article)\b/i;

/** ¿El pedido es un diseño web? */
export function isWebDesign(text) {
  const t = String(text || '');
  if (NOT_WEB.test(t) && !/\b(landing|sitio|website|interfa)/i.test(t)) return false;
  if (WEB_RE.test(t)) return true;
  if (/\b(ui|ux)\b/i.test(t) && MAKE_RE.test(t)) return true;
  if (PAGE_RE.test(t) && (MAKE_RE.test(t) || /premium|inmersiv|scroll|hero|secciones|negocio|restaurant|tienda|empresa|marca/i.test(t))) return true;
  return false;
}

const THEMES = [
  ['coffee', /caf[eé]s?\b|cafeter|coffee|espresso|barista|granos? de caf|tostad[oe]r|torrefa|latte|capuch|cappucc/i],
  ['restaurant', /restaur|comida|gastronom|cocina|chef|parrilla|asado|pizz|sushi|burger|hamburgues|panader|pasteler|bistr|\bbar\b|cervecer|vinoteca|food|dinner|bakery|helader|delivery de comida/i],
  ['realestate', /inmobiliar|propiedad|departament|\bdepto|casas?\b|vivienda|alquiler|real ?estate|arquitect|loteo|barrio cerrado|im[oó]ve(l|is)|apartament|hotel|caba[ñn]a/i],
  ['fashion', /moda|ropa|indumentaria|fashion|boutique|zapatill|calzado|joyer|joya|reloj|cosm[eé]t|perfum|belleza|beauty|skincare|accesorio|tienda|\bshop\b|store|producto|ecommerce|e-commerce|loja|roupa|muebles|deco/i],
  ['saas', /\bapp\b|aplicaci[oó]n|software|saas|startup|tecnolog|\btech|plataforma|\bia\b|inteligencia artificial|\bai\b|fintech|cripto|crypto|\bapi\b|cloud|nube|agencia|digital|consultor|servicios?/i]
];

/** Plantilla más cercana al tema del pedido. */
export function pickTemplate(text) {
  const t = String(text || '');
  for (const [id, re] of THEMES) if (re.test(t)) return id;
  return 'saas';
}

/* ---------- Mini Mustache (igual que el servidor) ---------- */
export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function lookup(stack, path) {
  if (path === '.') return stack[stack.length - 1];
  const parts = path.split('.');
  for (let i = stack.length - 1; i >= 0; i--) {
    const c = stack[i];
    if (c && typeof c === 'object' && parts[0] in c) {
      let v = c;
      for (const k of parts) v = v && typeof v === 'object' ? v[k] : undefined;
      return v;
    }
  }
  return undefined;
}
const truthy = (v) => (Array.isArray(v) ? v.length > 0 : !!v);
function vars(s, stack, index) {
  return s
    .replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, k) => String(lookup(stack, k) ?? ''))
    .replace(/\{\{\s*(@i|[\w.]+)\s*\}\}/g, (_, k) => (k === '@i' ? String(index) : escapeHtml(lookup(stack, k))));
}
function renderIn(tpl, stack, index) {
  let out = '', i = 0;
  const open = /\{\{([#^])\s*([\w.@]+)\s*\}\}/g;
  while (i < tpl.length) {
    open.lastIndex = i;
    const m = open.exec(tpl);
    if (!m) { out += vars(tpl.slice(i), stack, index); break; }
    out += vars(tpl.slice(i, m.index), stack, index);
    const [tag, kind, name] = m;
    const re = new RegExp(`\\{\\{([#^/])\\s*${name.replace(/[.@]/g, '\\$&')}\\s*\\}\\}`, 'g');
    re.lastIndex = m.index + tag.length;
    let depth = 1, close = null, mm;
    while ((mm = re.exec(tpl))) { if (mm[1] === '/') { if (--depth === 0) { close = mm; break; } } else depth++; }
    if (!close) throw new Error('template: ' + name);
    const inner = tpl.slice(m.index + tag.length, close.index);
    const v = lookup(stack, name);
    if (kind === '^') { if (!truthy(v)) out += renderIn(inner, stack, index); }
    else if (Array.isArray(v)) v.forEach((item, k) => { out += renderIn(inner, [...stack, item], k + 1); });
    else if (v && typeof v === 'object') out += renderIn(inner, [...stack, v], index);
    else if (v) out += renderIn(inner, stack, index);
    i = close.index + close[0].length;
  }
  return out;
}
export function renderTemplate(tpl, data) { return renderIn(tpl, [data], 0); }
export function scriptJson(v) {
  return JSON.stringify(v ?? null).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

/** Prepara los datos derivados que usan las plantillas. */
export function finalizeData(data) {
  const d = { ...data };
  d.uiJson = scriptJson(d.ui || {});
  d.thanksJson = scriptJson((d.footer && d.footer.newsletterThanks) || '');
  d.dataJson = scriptJson({ theme: d.theme, palette: d.palette, ui: d.ui });
  d.heroJson = scriptJson((d.hero && d.hero.images) || []);
  if (d.steps && Array.isArray(d.steps.items)) d.steps = { ...d.steps, count: d.steps.items.length };
  return d;
}

/* ---------- Nombre de marca a partir del pedido (sin modelo) ---------- */
const STOP = new Set('un una unos unas el la los las de del para mi tu su que con y o en sobre relacionado relacionada premium moderna moderno profesional inmersivo inmersiva feed interfaz sitio web página pagina landing page site website a an the for my of with and or about'.split(' '));
export function brandFromTask(text) {
  const t = String(text || '');
  const q = t.match(/[«"“']([^"”»']{2,40})[»"”']/);
  if (q) return q[1].trim();
  const n = t.match(/\b(?:llamad[oa]|se llama|named|called|chamad[oa]|marca)\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ&' -]{1,30})/);
  if (n) return n[1].trim().replace(/\s+(que|y|con|para|and|with)\b.*$/i, '');
  return '';
}
export function markOf(brand) {
  const w = String(brand || '').replace(/[^\p{L}\p{N}& ]/gu, '').split(/\s+/).filter(Boolean);
  if (!w.length) return '';
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return w.slice(0, 3).map((x) => (x === '&' ? '&' : x[0].toUpperCase())).join('');
}

/** Sitio completo sin servidor: plantilla prediseñada del tema, con la marca del pedido si la nombró. */
export async function localSite(task, lang = 'es', base = '/assets/tpl/') {
  const id = pickTemplate(task);
  const file = id === 'coffee' ? 'coffee' : 'immersive';
  const [tpl, data] = await Promise.all([
    fetch(base + file + '.html', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error('tpl'); return r.text(); }),
    fetch(base + id + '.json', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error('tpl'); return r.json(); })
  ]);
  const brand = brandFromTask(task);
  if (brand) {
    const old = data.brand;
    data.brand = brand; data.brandMark = markOf(brand) || data.brandMark;
    data.title = String(data.title || '').replace(old, brand);
    const swap = (o) => { for (const k in o) { if (typeof o[k] === 'string') o[k] = o[k].split(old).join(brand); else if (o[k] && typeof o[k] === 'object') swap(o[k]); } };
    swap(data);
  }
  return { id, html: renderTemplate(tpl, finalizeData(data)), data };
}
