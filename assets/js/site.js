/**
 * AgentiCuántico · comportamiento común a todas las páginas:
 * menú móvil, tema, consentimiento, analítica (con permiso), anuncios, modo mantenimiento y sesión.
 */
import { hydrateIcons, icon, esc } from './ui.js';
import { showConsent, hasConsent, prefs } from './consent.js';
import { getSystem } from './sysconfig.js';
import { watchUser } from './auth.js';
import { initI18n, setSiteLang, getSiteLang, siteLangInfo, SITE_LANGS } from './i18n.js';

hydrateIcons();
export const i18nReady = initI18n();

/* ---------- Selector de idioma (píldora blanca con bandera, a la izquierda del menú) ---------- */
const FLAG = (l) => `/assets/flags/rect/${l.flag}.svg`;
function renderLangPill(btn) {
  const l = siteLangInfo();
  const img = btn.querySelector('.lp-flag img');
  if (img) { img.src = FLAG(l); img.alt = ''; }
  btn.setAttribute('aria-label', `Idioma: ${l.name} (${l.region})`);
}
function closeLangMenus() { document.querySelectorAll('.site-lang-menu').forEach((m) => { if (m._btn) m._btn.setAttribute('aria-expanded', 'false'); m.remove(); }); }
function openLangMenu(btn) {
  const open = document.querySelector('.site-lang-menu');
  closeLangMenus();
  if (open && open._btn === btn) return;
  const menu = document.createElement('div');
  menu.className = 'site-lang-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('data-no-i18n', '');
  menu._btn = btn;
  const cur = getSiteLang();
  menu.innerHTML = SITE_LANGS.map((l) => `<button type="button" role="menuitemradio" aria-checked="${l.id === cur}" data-lang="${l.id}" lang="${l.id}"><span class="lp-flag"><img src="${FLAG(l)}" alt="" width="30" height="20"></span><span class="lm-text"><span>${l.name}</span><small>${l.region}</small></span>${l.id === cur ? icon('check', 'lm-check') : ''}</button>`).join('');
  (btn.closest('.lang-pill-host') || btn.parentElement).append(menu);
  btn.setAttribute('aria-expanded', 'true');
  menu.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-lang]'); if (!b) return;
    e.stopPropagation(); closeLangMenus();
    await setSiteLang(b.dataset.lang);
    document.querySelectorAll('.lang-pill').forEach(renderLangPill);
    btn.focus();
  });
  menu.querySelector('[aria-checked="true"]')?.focus();
}
document.querySelectorAll('.lang-pill').forEach((btn) => {
  renderLangPill(btn);
  btn.addEventListener('click', (e) => { e.stopPropagation(); openLangMenu(btn); });
});
document.addEventListener('click', (e) => { if (!e.target.closest('.site-lang-menu')) closeLangMenus(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLangMenus(); });
document.addEventListener('site:lang', () => document.querySelectorAll('.lang-pill').forEach(renderLangPill));

/* ---------- Menú móvil ---------- */
const nav = document.getElementById('siteNav');
const toggle = document.getElementById('menuToggle');
if (nav && toggle) {
  toggle.addEventListener('click', () => {
    const open = !nav.classList.contains('open');
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.innerHTML = icon(open ? 'close' : 'menu');
  });
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); toggle.innerHTML = icon('menu'); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('open')) toggle.click(); });
}
// marcar la página actual
document.querySelectorAll('.nav a, .legal-nav a').forEach((a) => {
  const href = a.getAttribute('href');
  if (href && (href === location.pathname || (href !== '/' && location.pathname.startsWith(href.replace(/\.html$/, ''))))) a.setAttribute('aria-current', 'page');
});

/* ---------- Tema: siempre claro ---------- */
export function setTheme() {
  document.documentElement.setAttribute('data-theme', 'light');
  try { localStorage.removeItem('ac.theme'); sessionStorage.removeItem('ac.theme'); } catch {}
  window.dispatchEvent(new CustomEvent('ac:theme', { detail: 'light' }));
}
document.querySelectorAll('[data-theme-toggle]').forEach((b) => { b.hidden = true; b.remove(); });
setTheme();

/* ---------- Consentimiento + analítica ---------- */
document.querySelectorAll('[data-consent-open]').forEach((b) => b.addEventListener('click', () => showConsent(true)));
const isAdminPage = location.pathname.startsWith('/admin');
function maybeAnalytics() {
  if (hasConsent('analytics') && !isAdminPage) import('./analytics.js').then((m) => m.initAnalytics()).catch(() => {});
}
window.addEventListener('ac:consent', maybeAnalytics);
maybeAnalytics();
showConsent();

/* ---------- Configuración del sistema: anuncio y mantenimiento ---------- */
export const systemReady = getSystem().then((sys) => {
  window.AC_SYSTEM = sys;
  if ((sys.killSwitch || sys.maintenance) && !isAdminPage) showMaintenance(sys);
  else if (sys.announcement.active && sys.announcement.text) showAnnouncement(sys.announcement);
  window.dispatchEvent(new CustomEvent('ac:system', { detail: sys }));
  return sys;
});

function showAnnouncement(a) {
  const key = 'ac.ann.' + a.text.length + '.' + a.text.slice(0, 12);
  if (sessionStorage.getItem(key)) return;
  const bar = document.createElement('div');
  bar.className = 'announce ' + a.level;
  bar.setAttribute('role', 'status');
  bar.innerHTML = esc(a.text) + '<button class="icon-btn sm" type="button" aria-label="Cerrar anuncio">' + icon('close') + '</button>';
  bar.querySelector('button').onclick = () => { sessionStorage.setItem(key, '1'); bar.remove(); };
  document.body.prepend(bar);
}
function showMaintenance(sys) {
  const ov = document.createElement('div');
  ov.className = 'maintenance';
  ov.setAttribute('role', 'alertdialog');
  ov.setAttribute('aria-labelledby', 'mtTitle');
  ov.innerHTML = `<div class="card"><img src="/media/avatar/face-256.webp?v=7.7.0" alt="" width="72" height="72" style="border-radius:50%;margin:0 auto 16px">
    <h1 id="mtTitle" style="font-size:1.6rem">Estamos haciendo mantenimiento</h1>
    <p class="muted">${esc(sys.maintenanceMessage || 'AgentiCuántico vuelve en breve. Gracias por la paciencia.')}</p>
    <p class="small muted">Consultas: <a href="mailto:agenticuantico@gmail.com">agenticuantico@gmail.com</a></p></div>`;
  document.body.append(ov);
  document.body.style.overflow = 'hidden';
}

/* ---------- Estado de cuenta en el encabezado ---------- */
const acc = document.getElementById('headerAccount');
if (acc) {
  watchUser((u) => {
    if (!u) return;
    const initial = (u.displayName || u.email || '?').trim().charAt(0).toUpperCase();
    acc.innerHTML = (u.photoURL ? `<img src="${esc(u.photoURL)}" alt="" width="28" height="28" referrerpolicy="no-referrer">` : `<span class="initial">${esc(initial)}</span>`) + '<span class="hide-sm">Mi cuenta</span>';
  });
}
