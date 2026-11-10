/**
 * Bienvenida corta de primera visita en /app/: 3 pasos (pregunta, conecta una cuenta, crea una tarea), salteable.
 * Diálogo nativo (<dialog>) → foco atrapado, Esc cierra, el foco vuelve al campo del chat. Se recuerda en localStorage.
 */
import { h, icon } from '../ui.js';
import { WELCOME_KEY, WELCOME_STEPS, shouldShowWelcome } from './welcome-rules.js';

const CSS = '/assets/css/welcome.css?v=1.0.0';
const store = { get() { try { return localStorage.getItem(WELCOME_KEY); } catch { return null; } }, set() { try { localStorage.setItem(WELCOME_KEY, String(Date.now())); } catch {} } };

/**
 * @param {{ input?: HTMLTextAreaElement|null, openTab?: (tab: string) => void, force?: boolean }} o
 * @returns {boolean} si se mostró
 */
export function maybeShowWelcome(o = {}) {
  if (!o.force && !shouldShowWelcome({ seen: store.get(), search: location.search, hash: location.hash })) return false;
  if (!document.querySelector('link[href*="welcome.css"]')) document.head.append(h('link', { rel: 'stylesheet', href: CSS }));
  let i = 0;
  const titleId = 'wlcTitle', textId = 'wlcText';
  const d = h('dialog', { class: 'modal wlc', 'aria-labelledby': titleId, 'aria-describedby': textId });
  const count = h('p', { class: 'wlc-count', 'aria-live': 'polite' });
  const dots = h('ol', { class: 'wlc-dots', 'aria-hidden': 'true' }, ...WELCOME_STEPS.map(() => h('li')));
  const art = h('div', { class: 'wlc-art', 'aria-hidden': 'true' });
  const title = h('h2', { id: titleId, class: 'wlc-title', tabindex: '-1' });
  const text = h('p', { id: textId, class: 'wlc-text' });
  const extra = h('div', { class: 'wlc-extra' });
  const back = h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => go(i - 1) }, 'Anterior');
  const next = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => (i < WELCOME_STEPS.length - 1 ? go(i + 1) : close()) });
  const skip = h('button', { class: 'wlc-skip linklike', type: 'button', onclick: () => close() }, 'Saltar bienvenida');
  d.append(
    h('div', { class: 'wlc-top' }, h('span', { class: 'wlc-brand' }, 'Bienvenida'), skip),
    h('div', { class: 'wlc-body' }, art, count, title, text, extra),
    h('div', { class: 'wlc-foot' }, dots, h('div', { class: 'wlc-nav' }, back, next))
  );
  function close(after) {
    store.set();
    if (d.open) d.close();
    d.remove();
    if (after) after(); else o.input && o.input.focus();
  }
  function go(n) {
    i = Math.max(0, Math.min(WELCOME_STEPS.length - 1, n));
    const s = WELCOME_STEPS[i];
    art.innerHTML = `<span class="wlc-ring">${icon(s.icon)}</span>`;
    art.dataset.step = s.id;
    count.textContent = `Paso ${i + 1} de ${WELCOME_STEPS.length}`;
    title.textContent = s.title; text.textContent = s.text;
    extra.replaceChildren();
    if (s.examples) extra.append(h('div', { class: 'wlc-chips', role: 'group', 'aria-label': 'Ejemplos para probar' }, ...s.examples.map((ex) => h('button', { class: 'wlc-chip', type: 'button', onclick: (e) => { const shown = e.currentTarget.textContent.trim() || ex; close(() => { if (o.input) { o.input.value = shown; o.input.dispatchEvent(new Event('input', { bubbles: true })); o.input.focus(); } }); } }, ex))));
    if (s.action) extra.append(h('button', { class: 'btn wlc-act', type: 'button', onclick: () => close(() => o.openTab && o.openTab(s.action.tab)) }, h('span', { html: icon(s.icon) }), s.action.label));
    [...dots.children].forEach((li, k) => li.classList.toggle('on', k <= i));
    back.hidden = i === 0;
    next.textContent = i < WELCOME_STEPS.length - 1 ? 'Siguiente' : 'Empezar';
    if (d.open) title.focus();
  }
  d.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  go(0);
  document.body.append(d);
  d.showModal();
  next.focus();
  return true;
}
