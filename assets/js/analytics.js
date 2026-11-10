/**
 * Analítica propia y respetuosa (solo con consentimiento "analíticas").
 *  - Una escritura agregada por vista en stats_daily/{AAAA-MM-DD} (contadores, sin IP ni identificadores).
 *  - País aproximado desde https://www.cloudflare.com/cdn-cgi/trace (campo loc) o el idioma del navegador.
 *  - Presencia en vivo en Realtime Database (/presence/{sesión}), se borra sola al desconectarse.
 *  - Desde 2026-11-10 también al servidor propio (POST /api/t): vista agregada + latido de presencia cada 60 s mientras
 *    la pestaña está visible. El país lo pone Cloudflare (request.cf); sin IP, sin correo, sin cookies.
 */
import { getStore, getRtdb } from './firebase.js';
import { CONFIG } from './config.js';

export function parseUA(ua = navigator.userAgent) {
  const isTablet = /iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  const isMobile = !isTablet && /Mobi|iPhone|iPod|Android.*Mobile|Opera Mini|IEMobile/i.test(ua);
  const os = /Windows/i.test(ua) ? 'Windows' : /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua)) ? 'iOS' : /Mac OS X|Macintosh/i.test(ua) ? 'macOS' : /CrOS/i.test(ua) ? 'ChromeOS' : /Linux/i.test(ua) ? 'Linux' : 'Otro';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Otro';
  return { device: isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop', os, browser };
}

export function pageKey(path = location.pathname) {
  const p = path.replace(/index\.html$/, '').replace(/\.html$/, '').replace(/\/+$/, '') || '/';
  if (p === '/') return 'inicio';
  return p.slice(1).replace(/[^a-z0-9-]+/gi, '_').slice(0, 40) || 'otra';
}

function refKey() {
  try {
    if (!document.referrer) return 'directo';
    const u = new URL(document.referrer);
    if (u.host === location.host) return null;
    return u.host.replace(/^www\./, '').replace(/[^a-z0-9-]+/gi, '_').slice(0, 40);
  } catch { return 'directo'; }
}

export async function getCountry() {
  try {
    const c = sessionStorage.getItem('ac.cc');
    if (c) return c;
  } catch {}
  let cc = '';
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    const txt = await fetch('https://www.cloudflare.com/cdn-cgi/trace', { signal: ctrl.signal, cache: 'no-store' }).then((r) => r.text());
    clearTimeout(t);
    cc = (/^loc=([A-Z]{2})$/m.exec(txt) || [])[1] || '';
  } catch {}
  if (!cc) cc = ((navigator.language || '').split('-')[1] || 'XX').toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) cc = 'XX';
  try { sessionStorage.setItem('ac.cc', cc); } catch {}
  return cc;
}

let tracked = false;
export async function trackPageView() {
  if (tracked) return; tracked = true;
  if (navigator.webdriver && !/[?&]track=1/.test(location.search)) return; // no contar robots de prueba
  const [cc, { fs, db }] = await Promise.all([getCountry(), getStore()]);
  const { device, os, browser } = parseUA();
  const day = new Date().toISOString().slice(0, 10);
  let newVisitor = false;
  try { if (localStorage.getItem('ac.seen') !== day) { localStorage.setItem('ac.seen', day); newVisitor = true; } } catch {}
  const inc = fs.increment(1);
  const data = {
    views: inc,
    country: { [cc]: inc },
    device: { [device]: inc },
    os: { [os]: inc },
    browser: { [browser]: inc },
    page: { [pageKey()]: inc },
    hour: { [String(new Date().getUTCHours()).padStart(2, '0')]: inc }
  };
  const ref = refKey();
  if (ref) data.ref = { [ref]: inc };
  if (newVisitor) data.visitors = inc;
  await fs.setDoc(fs.doc(db, 'stats_daily', day), data, { merge: true });
}

let presenceStarted = false;
export async function startPresence() {
  if (presenceStarted) return; presenceStarted = true;
  const [{ rt, db }, cc] = await Promise.all([getRtdb(), getCountry()]);
  const { device, os } = parseUA();
  let sid = sessionStorage.getItem('ac.sid');
  if (!sid) { sid = 's' + Math.random().toString(36).slice(2, 12); sessionStorage.setItem('ac.sid', sid); }
  const r = rt.ref(db, 'presence/' + sid);
  const conn = rt.ref(db, '.info/connected');
  rt.onValue(conn, async (snap) => {
    if (snap.val() !== true) return;
    try {
      await rt.onDisconnect(r).remove();
      await rt.set(r, { c: cc, d: device, o: os, p: pageKey(), t: rt.serverTimestamp() });
    } catch (e) { console.warn('[presencia] no disponible', e && e.code); rt.goOffline(db); }
  });
}

/* ---------- Servidor propio: vistas agregadas y presencia de 5 minutos ---------- */
const API = String(CONFIG.API_BASE || '').replace(/\/+$/, '');
function tabSid() {
  try { let s = sessionStorage.getItem('ac.sid'); if (!s) { s = 's' + Math.random().toString(36).slice(2, 12); sessionStorage.setItem('ac.sid', s); } return s; }
  catch { return 's' + Math.random().toString(36).slice(2, 12); }
}
function beacon(k, extra = {}) {
  if (!API) return;
  const body = JSON.stringify({ k, sid: tabSid(), p: pageKey(), ...extra });
  try {
    // text/plain: sin preflight. keepalive: llega aunque se cierre la pestaña.
    fetch(API + '/api/t', { method: 'POST', body, headers: { 'Content-Type': 'text/plain' }, keepalive: true, credentials: 'omit', cache: 'no-store' }).catch(() => {});
  } catch {}
}
let serverStarted = false;
export function startServerAnalytics() {
  if (serverStarted || !API) return; serverStarted = true;
  if (navigator.webdriver && !/[?&]track=1/.test(location.search)) return; // no contar robots de prueba
  const day = new Date().toISOString().slice(0, 10);
  let nv = 0;
  try { if (localStorage.getItem('ac.seen2') !== day) { localStorage.setItem('ac.seen2', day); nv = 1; } } catch {}
  // ¿Volvió? Solo se guarda la FECHA de la primera visita en este navegador (nada más) y se manda 0/1, nunca la fecha.
  let rv = 0;
  try { const first = localStorage.getItem('ac.first'); if (!first) localStorage.setItem('ac.first', day); else if (first !== day) rv = 1; } catch {}
  const r = refKey();
  beacon('v', { nv, ...(nv ? { rv } : {}), ...(r ? { r } : {}), tm: navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent) ? 1 : 0 });
  let beats = 0;
  const t = setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    if (++beats > 60) { clearInterval(t); return; }   // como mucho 1 hora de latidos por página
    beacon('p');
  }, 60_000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') beacon('p'); });
  addEventListener('pagehide', () => beacon('x'));
}

export function initAnalytics() {
  const run = () => {
    startServerAnalytics();
    trackPageView().catch((e) => console.warn('[analítica] no disponible', e && e.code));
    startPresence().catch(() => {});
  };
  ('requestIdleCallback' in window) ? requestIdleCallback(run, { timeout: 4000 }) : setTimeout(run, 1500);
}
