/**
 * Consentimiento de cookies y almacenamiento (Ley 25.326 / RGPD).
 * Categorías: necesarias (siempre), analíticas y preferencias (opt-in).
 * "Rechazar todo" está al mismo nivel que "Aceptar todo".
 */
import { h, icon } from './ui.js';

const KEY = 'ac.consent.v1';
const VERSION = 1;

export function getConsent() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null');
    return c && c.version === VERSION ? c : null;
  } catch { return null; }
}
export function hasConsent(cat) { const c = getConsent(); return cat === 'necessary' ? true : !!(c && c[cat]); }

function save(analytics, preferences) {
  const c = { version: VERSION, necessary: true, analytics: !!analytics, preferences: !!preferences, at: new Date().toISOString() };
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* modo privado */ }
  if (!preferences) { try { ['ac.theme', 'ac.lang', 'ac.voice'].forEach((k) => localStorage.removeItem(k)); } catch {} }
  window.dispatchEvent(new CustomEvent('ac:consent', { detail: c }));
  return c;
}

/** Preferencias: en localStorage solo con consentimiento; si no, duran la sesión. */
export const prefs = {
  get(k, d = null) { try { return localStorage.getItem(k) ?? sessionStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) {
    try {
      if (hasConsent('preferences')) localStorage.setItem(k, v); else sessionStorage.setItem(k, v);
    } catch {}
  }
};

let banner;
export function showConsent(force = false) {
  if (!force && getConsent()) return;
  if (banner) banner.remove();
  const c = getConsent() || { analytics: false, preferences: false };
  banner = h('section', { class: 'consent', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'consentTitle' });
  banner.innerHTML = `
    <h2 id="consentTitle">Tu privacidad, tus reglas</h2>
    <p>Usamos almacenamiento <strong>necesario</strong> para que el sitio funcione. Con tu permiso, también medimos visitas de forma agregada (sin guardar tu IP) y recordamos tus preferencias. <a href="/legal/cookies.html">Política de cookies</a>.</p>
    <div class="consent-details" hidden>
      <div class="consent-cat"><span><strong>Necesarias</strong><span class="muted">Sesión, seguridad, tu elección de cookies y chats de invitado en tu dispositivo.</span></span><span class="chip">Siempre</span></div>
      <div class="consent-cat"><span><strong>Analíticas</strong><span class="muted">Visitas, país (aproximado), tipo de dispositivo y usuarios en línea. Sin IP.</span></span><label class="switch"><input type="checkbox" id="cAnalytics" ${c.analytics ? 'checked' : ''} aria-label="Analíticas"><span></span></label></div>
      <div class="consent-cat"><span><strong>Preferencias</strong><span class="muted">Tema, idioma y voz elegidos.</span></span><label class="switch"><input type="checkbox" id="cPrefs" ${c.preferences ? 'checked' : ''} aria-label="Preferencias"><span></span></label></div>
    </div>
    <div class="actions">
      <button class="btn btn-sm" type="button" data-act="reject">Rechazar todo</button>
      <button class="btn btn-sm btn-primary" type="button" data-act="accept">Aceptar todo</button>
      <button class="btn btn-sm btn-ghost full" type="button" data-act="custom">Configurar</button>
    </div>`;
  banner.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'reject') { save(false, false); close(); }
    if (act === 'accept') { save(true, true); close(); }
    if (act === 'custom') {
      const det = banner.querySelector('.consent-details');
      if (det.hidden) { det.hidden = false; e.target.textContent = 'Guardar selección'; }
      else { save(banner.querySelector('#cAnalytics').checked, banner.querySelector('#cPrefs').checked); close(); }
    }
  });
  document.body.append(banner);
  if (force) banner.querySelector('[data-act="custom"]').click();
  function close() { banner.remove(); banner = null; }
}
