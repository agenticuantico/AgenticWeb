/**
 * Tiny i18n engine shared by the site and the app.
 * - Dictionaries are flat JSON files: { "section.key": "text" }.
 * - Elements: data-i18n="key" (textContent), data-i18n-html="key" (trusted markup
 *   from our own dictionaries only), data-i18n-attr="attr:key;attr2:key2".
 * - Language priority: ?lang= param > localStorage > browser language > es-AR.
 */
import { FLAGS } from './flags.js';

export const LANGS = [
  { code: 'es-AR', short: 'ES', label: 'Español (Argentina)', og: 'es_AR' },
  { code: 'en', short: 'EN', label: 'English', og: 'en_US' },
  { code: 'pt-BR', short: 'PT', label: 'Português (Brasil)', og: 'pt_BR' }
];
export const DEFAULT_LANG = 'es-AR';
const STORAGE_KEY = 'ac.lang';

export function normalizeLang(input) {
  if (!input) return null;
  const v = String(input).toLowerCase();
  if (v.startsWith('es')) return 'es-AR';
  if (v.startsWith('pt')) return 'pt-BR';
  if (v.startsWith('en')) return 'en';
  return null;
}

export function detectLang() {
  try {
    const p = new URLSearchParams(location.search).get('lang');
    const fromParam = normalizeLang(p);
    if (fromParam) return fromParam;
  } catch { /* ignore */ }
  try {
    const stored = normalizeLang(localStorage.getItem(STORAGE_KEY));
    if (stored) return stored;
  } catch { /* storage may be blocked */ }
  // Default is always Spanish (Argentina); visitors switch with the flag selector.
  return DEFAULT_LANG;
}

export function createI18n({ base = '/assets/i18n/', extraBases = [] } = {}) {
  const cache = new Map();
  const listeners = new Set();
  let dict = {};
  let lang = detectLang();

  async function load(code) {
    if (cache.has(code)) return cache.get(code);
    const urls = [base, ...extraBases].map((b) => `${b}${code}.json`);
    const parts = await Promise.all(urls.map((u) => fetch(u).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))));
    const merged = Object.assign({}, ...parts);
    cache.set(code, merged);
    return merged;
  }

  function t(key, vars) {
    let s = dict[key];
    if (s == null) return key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : `{${k}}`));
    return s;
  }

  function apply(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const v = dict[el.dataset.i18n];
      if (v != null) el.textContent = v;
    });
    root.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const v = dict[el.dataset.i18nHtml];
      if (v != null) el.innerHTML = v; // trusted: our own static dictionaries
    });
    root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      el.dataset.i18nAttr.split(';').forEach((pair) => {
        const [attr, key] = pair.split(':').map((s) => s && s.trim());
        if (attr && key && dict[key] != null) el.setAttribute(attr, dict[key]);
      });
    });
  }

  async function setLang(code, { persist = true } = {}) {
    const next = normalizeLang(code) || DEFAULT_LANG;
    dict = await load(next);
    lang = next;
    document.documentElement.lang = next;
    if (dict['meta.title'] && document.body.dataset.page === 'home') document.title = dict['meta.title'];
    const desc = document.querySelector('meta[name="description"]');
    if (desc && dict['meta.description'] && document.body.dataset.page === 'home') desc.setAttribute('content', dict['meta.description']);
    if (persist) { try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ } }
    apply();
    listeners.forEach((cb) => cb(next));
    return next;
  }

  return {
    get lang() { return lang; },
    t, apply, setLang, load,
    onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); }
  };
}

/** Accessible language selector (button + listbox). */
export function mountLangSwitcher(container, i18n) {
  if (!container) return;
  const btn = container.querySelector('.lang-btn');
  const list = container.querySelector('.lang-list');
  const flagEl = container.querySelector('[data-current-flag]');
  const codeEl = container.querySelector('[data-current-code]');
  let active = 0;

  list.innerHTML = '';
  LANGS.forEach((l, i) => {
    const li = document.createElement('li');
    li.id = `lang-opt-${l.code}`;
    li.setAttribute('role', 'option');
    li.dataset.code = l.code;
    li.innerHTML = `<span class="flag" aria-hidden="true">${FLAGS[l.code]}</span><span lang="${l.code}"></span>`;
    li.lastChild.textContent = l.label;
    li.addEventListener('click', () => choose(l.code));
    li.addEventListener('mousemove', () => highlight(i));
    list.appendChild(li);
  });

  function render() {
    const cur = LANGS.find((l) => l.code === i18n.lang) || LANGS[0];
    flagEl.innerHTML = FLAGS[cur.code];
    codeEl.textContent = cur.short;
    list.querySelectorAll('li').forEach((li) => li.setAttribute('aria-selected', String(li.dataset.code === cur.code)));
  }
  function highlight(i) {
    active = (i + LANGS.length) % LANGS.length;
    list.querySelectorAll('li').forEach((li, j) => li.classList.toggle('is-active', j === active));
    list.setAttribute('aria-activedescendant', `lang-opt-${LANGS[active].code}`);
  }
  function open() {
    list.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    highlight(Math.max(0, LANGS.findIndex((l) => l.code === i18n.lang)));
    list.focus();
  }
  function close(focusBtn = true) {
    list.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    if (focusBtn) btn.focus();
  }
  async function choose(code) {
    close();
    await i18n.setLang(code);
  }
  btn.addEventListener('click', () => (list.hidden ? open() : close()));
  list.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); highlight(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(active - 1); }
    else if (e.key === 'Home') { e.preventDefault(); highlight(0); }
    else if (e.key === 'End') { e.preventDefault(); highlight(LANGS.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(LANGS[active].code); }
    else if (e.key === 'Escape' || e.key === 'Tab') { close(e.key === 'Escape'); }
  });
  document.addEventListener('click', (e) => { if (!container.contains(e.target) && !list.hidden) close(false); });
  i18n.onChange(render);
  render();
}
