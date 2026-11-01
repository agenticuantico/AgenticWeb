/**
 * Traducción de todo el sitio (es-AR es el idioma de origen): es-ES, en-US y pt-BR.
 * Recorre los textos visibles, atributos (placeholder, alt, aria-label, title) y metadatos,
 * y traduce también lo que la interfaz agrega después (MutationObserver).
 * Las respuestas de la IA no se traducen: ya llegan en el idioma elegido.
 */
export const SITE_LANGS = [
  { id: 'es-AR', short: 'ES', name: 'Español', region: 'Argentina', flag: 'ar' },
  { id: 'es-ES', short: 'ES', name: 'Español', region: 'España', flag: 'es' },
  { id: 'en-US', short: 'EN', name: 'English', region: 'United States', flag: 'us' },
  { id: 'pt-BR', short: 'PT', name: 'Português', region: 'Brasil', flag: 'br' },
];
const KEY = 'ac.siteLang';
const VERSION = '7.2.0';
const ATTRS = ['placeholder', 'alt', 'aria-label', 'title'];
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA', 'SVG', 'svg']);
const NO = '[data-no-i18n], .msg .md, .msg-body .md, .bubble .md, .ace-bubble .md, .canvas-code, .cm-editor, .transcript p';

function detect() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && SITE_LANGS.some((l) => l.id === saved)) return saved;
    const q = new URLSearchParams(location.search).get('lang');
    if (q && SITE_LANGS.some((l) => l.id === q)) return q;
  } catch {}
  return 'es-AR';
}
let current = detect();
let dict = null;
const origText = new Map(); // Text -> original
const origAttr = new Map(); // Element -> {attr: original}
let observer = null;
const norm = (s) => s.replace(/\s+/g, ' ').trim();

export function getSiteLang() { return current; }
export function siteLangInfo(id = current) { return SITE_LANGS.find((l) => l.id === id) || SITE_LANGS[0]; }

/* Patrones con partes variables */
const PATTERNS = {
  'en-US': [[/^hace instantes$/, 'just now'], [/^hace (\d+) min$/, '$1 min ago'], [/^hace (\d+) h$/, '$1 h ago'], [/^hace (\d+) d$/, '$1 d ago'], [/^Actualizado (.+)$/, 'Updated $1'], [/^Cargando avatar… (\d+)%$/, 'Loading avatar… $1%'], [/^Idioma: (.+)$/, 'Language: $1'], [/^Te respondo en (.+) con voz femenina\.$/, 'I’ll answer in $1 with a female voice.'], [/^Abrir ([a-z0-9.-]+\.[a-z]{2,})$/, 'Open $1'], [/^Tocar «(.+)»$/, 'Tap “$1”'], [/^Escribir en «(.+)»$/, 'Type in “$1”'], [/^Cancelado por vos: (.+)$/, 'Canceled by you: $1'], [/^(.+) \(aprobado\)$/, '$1 (approved)'], [/^En fila · puesto (\d+)$/, 'In line · position $1'], [/^Todos los navegadores están ocupados: estás en el puesto (\d+)\. Sigo apenas se libere uno\.$/, 'All browsers are busy: you’re number $1 in line. I’ll continue as soon as one frees up.'], [/^Te quedan (.+) de navegador hoy$/, '$1 of browser time left today'], [/^(\d+) s de navegador$/, '$1 s of browser time'], [/^Parte (\d+) de (\d+)$/, 'Part $1 of $2'], [/^Parte (\d+) de (\d+) · (\d+) tablas$/, 'Part $1 of $2 · $3 tables'], [/^Buscar «(.+)»$/, 'Search “$1”'], [/^Leer (.+)$/, 'Read $1'], [/^Crear (.+)$/, 'Create $1'], [/^Guardar tabla (\d+) \((\w+)\)$/, 'Save table $1 ($2)'], [/^Guardé (.+)$/, 'Saved $1'], [/^Respondiste: (.+)$/, 'You answered: $1'], [/^Abrir el navegador real: (.+)$/, 'Open the real browser: $1'], [/^Guardé el texto de (.+)$/, 'Saved the text of $1'], [/^Guardé una captura de (.+)$/, 'Saved a screenshot of $1'], [/^Guardé (.+) en PDF$/, 'Saved $1 as PDF'], [/^¿Eliminar la cuenta guardada de (.+)\?$/, 'Delete the saved account for $1?']],
  'pt-BR': [[/^hace instantes$/, 'agora mesmo'], [/^hace (\d+) min$/, 'há $1 min'], [/^hace (\d+) h$/, 'há $1 h'], [/^hace (\d+) d$/, 'há $1 d'], [/^Actualizado (.+)$/, 'Atualizado $1'], [/^Cargando avatar… (\d+)%$/, 'Carregando avatar… $1%'], [/^Idioma: (.+)$/, 'Idioma: $1'], [/^Te respondo en (.+) con voz femenina\.$/, 'Vou responder em $1 com voz feminina.'], [/^Abrir ([a-z0-9.-]+\.[a-z]{2,})$/, 'Abrir $1'], [/^Tocar «(.+)»$/, 'Tocar em “$1”'], [/^Escribir en «(.+)»$/, 'Digitar em “$1”'], [/^Cancelado por vos: (.+)$/, 'Cancelado por você: $1'], [/^(.+) \(aprobado\)$/, '$1 (aprovado)'], [/^En fila · puesto (\d+)$/, 'Na fila · posição $1'], [/^Todos los navegadores están ocupados: estás en el puesto (\d+)\. Sigo apenas se libere uno\.$/, 'Todos os navegadores estão ocupados: você está na posição $1. Continuo assim que um liberar.'], [/^Te quedan (.+) de navegador hoy$/, 'Restam $1 de navegador hoje'], [/^(\d+) s de navegador$/, '$1 s de navegador'], [/^Parte (\d+) de (\d+)$/, 'Parte $1 de $2'], [/^Parte (\d+) de (\d+) · (\d+) tablas$/, 'Parte $1 de $2 · $3 tabelas'], [/^Buscar «(.+)»$/, 'Pesquisar “$1”'], [/^Leer (.+)$/, 'Ler $1'], [/^Crear (.+)$/, 'Criar $1'], [/^Guardar tabla (\d+) \((\w+)\)$/, 'Salvar tabela $1 ($2)'], [/^Guardé (.+)$/, 'Salvei $1'], [/^Respondiste: (.+)$/, 'Você respondeu: $1'], [/^Abrir el navegador real: (.+)$/, 'Abrir o navegador real: $1'], [/^Guardé el texto de (.+)$/, 'Salvei o texto de $1'], [/^Guardé una captura de (.+)$/, 'Salvei uma captura de $1'], [/^Guardé (.+) en PDF$/, 'Salvei $1 em PDF'], [/^¿Eliminar la cuenta guardada de (.+)\?$/, 'Excluir a conta salva de $1?']],
  'es-ES': [[/^Te respondo en (.+) con voz femenina\.$/, 'Te respondo en $1 con voz femenina.']],
};
function tr(s) {
  if (!dict) return null;
  const k = norm(s);
  if (!k) return null;
  if (dict[k] !== undefined) return dict[k];
  for (const [re, rep] of PATTERNS[current] || []) if (re.test(k)) return k.replace(re, (...m) => rep.replace(/\$(\d)/g, (_, i) => (m[i] && tr(m[i])) || m[i]));
  return null;
}
function excluded(el) { return !!(el && el.closest && el.closest(NO)); }

function doText(node) {
  const p = node.parentNode;
  if (!p || SKIP.has(p.nodeName) || excluded(p)) return;
  const src = origText.has(node) ? origText.get(node) : node.nodeValue;
  const t = tr(src);
  if (t == null) return;
  if (!origText.has(node)) origText.set(node, src);
  const lead = src.match(/^\s*/)[0], trail = src.match(/\s*$/)[0];
  const v = lead + t + trail;
  if (node.nodeValue !== v) node.nodeValue = v;
}
function doAttrs(el) {
  if (excluded(el)) return;
  for (const a of ATTRS) {
    if (!el.hasAttribute(a)) continue;
    const rec = origAttr.get(el) || {};
    const src = rec[a] !== undefined ? rec[a] : el.getAttribute(a);
    const t = tr(src);
    if (t == null) continue;
    rec[a] = src; origAttr.set(el, rec);
    if (el.getAttribute(a) !== t) el.setAttribute(a, t);
  }
}
function walk(root) {
  if (!root) return;
  if (root.nodeType === 3) { doText(root); return; }
  if (root.nodeType === 1 && root.nodeName === 'TEXTAREA') { doAttrs(root); return; }
  if (root.nodeType !== 1 || SKIP.has(root.nodeName)) return;
  if (excluded(root)) return;
  doAttrs(root);
  root.querySelectorAll && root.querySelectorAll('[placeholder],[alt],[aria-label],[title]').forEach(doAttrs);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) doText(n);
}
function doMeta() {
  const t = document.querySelector('title');
  if (t) { if (!t.dataset.src) t.dataset.src = t.textContent; const v = tr(t.dataset.src); document.title = v || t.dataset.src; }
  document.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"]').forEach((m) => {
    if (!m.dataset.src) m.dataset.src = m.getAttribute('content');
    const v = tr(m.dataset.src); m.setAttribute('content', v || m.dataset.src);
  });
}
function restore() {
  for (const [node, src] of origText) if (node.isConnected) node.nodeValue = src;
  for (const [el, rec] of origAttr) if (el.isConnected) for (const a in rec) el.setAttribute(a, rec[a]);
  origText.clear(); origAttr.clear();
}
function observe() {
  if (observer) return;
  observer = new MutationObserver((muts) => {
    if (!dict) return;
    for (const m of muts) {
      if (m.type === 'childList') m.addedNodes.forEach(walk);
      else if (m.type === 'characterData') { if (!origText.has(m.target) || norm(m.target.nodeValue) !== norm(tr(origText.get(m.target)) || '')) { origText.delete(m.target); doText(m.target); } }
      else if (m.type === 'attributes' && ATTRS.includes(m.attributeName)) {
        const rec = origAttr.get(m.target); const val = m.target.getAttribute(m.attributeName);
        if (rec && rec[m.attributeName] !== undefined && val === tr(rec[m.attributeName])) continue;
        if (rec) delete rec[m.attributeName];
        doAttrs(m.target);
      }
    }
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

async function loadDict(id) {
  if (id === 'es-AR') return null;
  const r = await fetch(`/assets/i18n/${id}.json?v=${VERSION}`, { cache: 'force-cache' });
  if (!r.ok) throw new Error('i18n ' + r.status);
  return r.json();
}

/** Aplica el idioma guardado (se llama al cargar cada página). */
export async function initI18n() {
  document.documentElement.lang = current;
  if (current === 'es-AR') return;
  try { dict = await loadDict(current); } catch { dict = null; return; }
  walk(document.body); doMeta(); observe();
  document.documentElement.classList.add('i18n-ready');
}

/** Cambia el idioma del sitio (y el de la conversación y la voz). */
export async function setSiteLang(id) {
  if (!SITE_LANGS.some((l) => l.id === id)) return;
  try { localStorage.setItem(KEY, id); localStorage.setItem('ac.lang', id); } catch {}
  restore();
  current = id;
  document.documentElement.lang = id;
  try { dict = await loadDict(id); } catch { dict = null; }
  if (dict) { walk(document.body); observe(); }
  doMeta();
  document.dispatchEvent(new CustomEvent('site:lang', { detail: { id } }));
}

/** Traduce un texto suelto (para mensajes generados por código, por ejemplo toasts). */
export function t(s) { return tr(s) ?? s; }
