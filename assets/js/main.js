/**
 * Landing page bootstrap. Order: i18n → UI wiring → (after first paint) 3D.
 */
import { createI18n, mountLangSwitcher } from './i18n.js';
import { SITE_CONFIG } from './config.js';
import { renderPricing, mountCurrencyToggle, getCurrency } from './pricing.js';

document.documentElement.classList.add('js');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const i18n = createI18n();
window.agentiI18n = i18n;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// Commercial CTAs always point to the exact mailto (subject must stay "Consulta Comercial").
$$('.cta-commercial').forEach((a) => { a.href = SITE_CONFIG.COMMERCIAL_MAILTO; });

// ---------- Mobile nav ----------
const navBtn = $('.nav-toggle');
const nav = $('#main-nav');
if (navBtn && nav) {
  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    navBtn.setAttribute('aria-expanded', String(open));
    navBtn.setAttribute('aria-label', i18n.t(open ? 'nav.close' : 'nav.toggle'));
  };
  navBtn.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); navBtn.focus(); } });
}

// ---------- Reveal on scroll ----------
const revealIO = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); revealIO.unobserve(e.target); } });
}, { rootMargin: '0px 0px -8% 0px' }) : null;
$$('.reveal').forEach((el) => (revealIO ? revealIO.observe(el) : el.classList.add('is-in')));

// ---------- Pricing ----------
const pricingEl = $('[data-pricing]');
let currency = getCurrency();
const drawPricing = () => pricingEl && renderPricing(pricingEl, { t: i18n.t, lang: i18n.lang, currency, mode: 'site' });
mountCurrencyToggle($('[data-currency-toggle]'), (c) => { currency = c; drawPricing(); });

// ---------- Agent demo ----------
const stage = $('[data-agent-stage]');
const log = $('[data-chat-log]');
const form = $('[data-chat-form]');
const input = $('#agent-input');
const sugg = $('[data-chat-suggestions]');
const statusEl = $('[data-agent-status]');
let kb = null;
let controller = null;
let brainMod = null;

function setStatus(kind) {
  const key = { idle: 'agent.statusIdle', speaking: 'agent.statusSpeaking', thinking: 'agent.statusThinking' }[kind] || 'agent.statusIdle';
  statusEl.dataset.i18n = key;
  statusEl.textContent = i18n.t(key);
  stage.classList.toggle('is-speaking', kind === 'speaking');
}

function addMsg(role, text) {
  const li = document.createElement('li');
  li.className = `msg msg-${role}`;
  li.textContent = text;
  log.appendChild(li);
  log.scrollTop = log.scrollHeight;
  return li;
}

async function getController() {
  if (controller) return controller;
  const { createAgentController } = await import('./agent.js');
  controller = createAgentController({
    canvas: $('#agent-canvas'),
    fallbackEl: $('[data-agent-fallback]'),
    loadingEl: $('[data-agent-loading]'),
    lang: i18n.lang,
    proxyUrl: SITE_CONFIG.TTS_PROXY_URL,
    tuning: SITE_CONFIG.VOICE_TUNING,
    reducedMotion,
    onStatus: setStatus
  });
  window.agentiAgent = controller; // handy for debugging/tests; exposes no private data
  return controller;
}

async function loadKB() {
  brainMod = brainMod || await import('./brain.js');
  kb = await brainMod.loadKnowledge(i18n.lang);
  renderSuggestions(kb.suggestions.slice(0, 4));
  return kb;
}

function renderSuggestions(list) {
  sugg.innerHTML = '';
  list.forEach((q) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.setAttribute('role', 'listitem'); b.textContent = q;
    b.addEventListener('click', () => ask(q));
    sugg.appendChild(b);
  });
}

async function ask(q) {
  q = String(q || '').trim();
  if (!q) return;
  addMsg('user', q);
  setStatus('thinking');
  if (!kb) await loadKB();
  const res = brainMod.answer(kb, q);
  addMsg('bot', res.text);
  renderSuggestions(res.suggestions);
  const c = await getController();
  c.speak(res.text).catch((e) => console.warn('[agent] speak failed', e));
}

if (form) {
  form.addEventListener('submit', (e) => { e.preventDefault(); const q = input.value; input.value = ''; ask(q); });
  $('[data-agent-greet]').addEventListener('click', async () => { if (!kb) await loadKB(); addMsg('bot', kb.greeting); (await getController()).speak(kb.greeting); });
  $('[data-agent-stop]').addEventListener('click', async () => (await getController()).stop());
  const muteBtn = $('[data-agent-mute]');
  muteBtn.addEventListener('click', async () => {
    const on = muteBtn.getAttribute('aria-pressed') !== 'true';
    muteBtn.setAttribute('aria-pressed', String(on));
    (await getController()).setMuted(on);
  });
  // Lazy: wake the avatar when its section approaches the viewport.
  const wake = async () => {
    const c = await getController();
    await c.ensureAvatar();
    if (!kb) { await loadKB(); if (!log.children.length) addMsg('bot', kb.greeting); }
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); wake(); } }, { rootMargin: '300px 0px' });
    io.observe(stage);
  } else wake();
}

// ---------- Language ----------
i18n.onChange(async (lang) => {
  drawPricing();
  if (controller) { controller.stop(); controller.setLang(lang); }
  if (kb) { await loadKB(); }
  setStatus('idle');
});

// ---------- Boot ----------
(async () => {
  await i18n.setLang(i18n.lang, { persist: false });
  mountLangSwitcher($('[data-lang-switcher]'), i18n);
  drawPricing();
})();

// Hero 3D after first paint, when the browser is idle.
function startHero() {
  const canvas = $('#hero-canvas');
  const saveData = navigator.connection && navigator.connection.saveData;
  if (!canvas || saveData) return;
  import('./agent.js').then(({ webglAvailable }) => {
    if (!webglAvailable()) return; // static CSS gradient stays as fallback
    return import('./hero3d.js').then((m) => { window.agentiHero = m.initHero(canvas, { reducedMotion }); });
  }).catch((e) => console.info('[hero] 3D disabled:', e && e.message));
}
const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
if (document.readyState === 'complete') idle(startHero, { timeout: 1500 });
else addEventListener('load', () => idle(startHero, { timeout: 1500 }), { once: true });

// ---------- PWA ----------
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch((e) => console.info('[sw]', e && e.message)));
}
