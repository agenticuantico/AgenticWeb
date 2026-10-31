/**
 * End-to-end checks with headless Chromium (Playwright).
 *   npm i -D playwright sharp && npx playwright install chromium
 *   node tools/e2e.mjs [screens-dir]
 * Checks: console errors, horizontal overflow, i18n switch, mailto, avatar render +
 * mouth movement (mocked speechSynthesis), app demo chat, markdown code block,
 * mobile drawer, plans/currency, legal pages, 404, service worker.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { serve } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.resolve(process.argv[2] || path.join(ROOT, '..', 'screens'));
fs.mkdirSync(SHOTS, { recursive: true });
const MAILTO = 'mailto:agenticuantico@gmail.com?subject=Consulta%20Comercial';
const VIEWPORTS = [
  { name: 'phone-375x812', width: 375, height: 812, mobile: true },
  { name: 'tablet-768x1024', width: 768, height: 1024, mobile: true },
  { name: 'laptop-1280x800', width: 1280, height: 800 },
  { name: 'notebook-1366x768', width: 1366, height: 768 },
  { name: 'desktop-1920x1080', width: 1920, height: 1080 }
];
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

const MOCK_TTS = () => {
  const voices = [
    { name: 'Google español de Estados Unidos', lang: 'es-US', localService: false, default: false, voiceURI: 'g-es-us' },
    { name: 'Google español', lang: 'es-ES', localService: false, default: false, voiceURI: 'g-es' },
    { name: 'Español (Argentina) Natural', lang: 'es-AR', localService: false, default: false, voiceURI: 'n-es-ar' },
    { name: 'Google US English', lang: 'en-US', localService: false, default: true, voiceURI: 'g-en' },
    { name: 'Google português do Brasil', lang: 'pt-BR', localService: false, default: false, voiceURI: 'g-pt' }
  ];
  const synth = {
    speaking: false, pending: false, paused: false,
    getVoices: () => voices, addEventListener() {}, removeEventListener() {}, pause() {}, resume() {},
    cancel() { if (this._cancel) this._cancel(); },
    speak(u) {
      (window.__spoken = window.__spoken || []).push({ text: u.text, lang: u.lang, voice: u.voice && u.voice.name });
      const words = [...u.text.matchAll(/\S+/g)];
      let i = 0, cancelled = false;
      this._cancel = () => { cancelled = true; u.onerror && u.onerror({ error: 'canceled' }); };
      setTimeout(() => {
        if (cancelled) return;
        u.onstart && u.onstart({});
        const tick = () => {
          if (cancelled) return;
          if (i < words.length) { u.onboundary && u.onboundary({ name: 'word', charIndex: words[i].index }); i++; setTimeout(tick, 200); }
          else u.onend && u.onend({});
        };
        tick();
      }, 40);
    }
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = function (text) { this.text = text; this.lang = ''; this.voice = null; this.rate = 1; this.pitch = 1; this.volume = 1; };
};

const results = [];
const ok = (name, pass, info = '') => { results.push({ name, pass, info }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };

// CSP-safe polling (page.waitForFunction needs eval, which our CSP forbids).
async function waitFor(page, fn, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await page.evaluate(fn).catch(() => false)) return true; await page.waitForTimeout(150); }
  throw new Error('waitFor timeout: ' + fn.toString().slice(0, 80));
}
async function imageStd(buf) { const s = await sharp(buf).stats(); return s.channels.slice(0, 3).reduce((a, c) => a + c.stdev, 0) / 3; }

const { srv, url } = await serve(ROOT);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function newPage(vp, { mockTTS = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, isMobile: !!vp.mobile, hasTouch: !!vp.mobile, locale: 'en-US', serviceWorkers: 'block' });
  if (mockTTS) await ctx.addInitScript(MOCK_TTS);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/nonexistent')) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  return { ctx, page, errors };
}

async function overflow(page) {
  return page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > w + 1 || r.left < -1) && getComputedStyle(e).position !== 'fixed' && !e.closest('.chips,.code-block pre,.sidebar,.hero-bg,.lang-list,.agent-list,.thread-wrap .code-block'); }).slice(0, 5).map((e) => e.tagName + '.' + (e.className || '').toString().slice(0, 40));
    return { scrollW: document.documentElement.scrollWidth, w, offenders };
  });
}

for (const vp of VIEWPORTS) {
  if (ONLY && !ONLY.includes(vp.name)) continue;
  // ---------------- Landing ----------------
  {
    const { ctx, page, errors } = await newPage(vp);
    await page.goto(url + '/', { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    const lang0 = await page.evaluate(() => document.documentElement.lang);
    ok(`[${vp.name}] default language es-AR`, lang0 === 'es-AR', lang0);
    await page.screenshot({ path: `${SHOTS}/${vp.name}-home-hero.png` });
    const heroReady = await page.evaluate(() => document.getElementById('hero-canvas').classList.contains('is-ready'));
    ok(`[${vp.name}] hero 3D initialised`, heroReady);
    const of = await overflow(page);
    ok(`[${vp.name}] no horizontal overflow (home)`, of.scrollW <= of.w && of.offenders.length === 0, JSON.stringify(of));
    const hrefs = await page.$$eval('.cta-commercial', (as) => as.map((a) => a.getAttribute('href')));
    ok(`[${vp.name}] commercial CTA mailto (${hrefs.length} buttons)`, hrefs.length >= 3 && hrefs.every((h) => h === MAILTO));
    const ctaVisible = await page.locator('.cta-commercial').first().isVisible().catch(() => false) || await page.locator('.hero .cta-commercial').isVisible();
    ok(`[${vp.name}] commercial CTA visible above the fold`, ctaVisible);

    // Agent section
    await page.locator('#agente').scrollIntoViewIfNeeded();
    await waitFor(page, () => !!(window.agentiAgent && window.agentiAgent.avatar)).catch(() => {});
    await page.waitForTimeout(1500);
    await page.evaluate(() => document.getElementById('agente').scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(800);
    const wrap = page.locator('.agent-canvas-wrap');
    const std = await imageStd(await wrap.screenshot());
    ok(`[${vp.name}] avatar renders (pixel stdev ${std.toFixed(1)})`, std > 8);
    const box = await wrap.boundingBox();
    ok(`[${vp.name}] avatar framed inside viewport width`, box && box.x >= 0 && box.x + box.width <= vp.width + 1, JSON.stringify(box));
    // speak() with mocked speechSynthesis
    const samples = await page.evaluate(async () => {
      const a = window.agentiAgent;
      const p = a.speak('Hola, soy el Agente de AgentiCuántico. Te muestro cómo muevo la boca mientras hablo.');
      const out = [];
      for (let i = 0; i < 24; i++) { await new Promise((r) => setTimeout(r, 120)); out.push(a.avatar.state.mouth.open); }
      const gestures = a.avatar.state.gesture.slice();
      return { out, gestures, spoken: window.__spoken, voice: await a.voice.describeVoice(), p: !!p };
    });
    const mx = Math.max(...samples.out), mn = Math.min(...samples.out);
    ok(`[${vp.name}] mouth moves during speak() (open ${mn.toFixed(2)}–${mx.toFixed(2)})`, mx - mn > 0.15);
    ok(`[${vp.name}] es-AR voice chosen`, /es-AR/.test(samples.voice), samples.voice);
    await page.screenshot({ path: `${SHOTS}/${vp.name}-home-agent.png` });
    await page.evaluate(() => window.agentiAgent.stop());

    // Ask via the form
    await page.fill('#agent-input', '¿Cuánto cuesta?');
    await page.click('[data-chat-form] button[type=submit]');
    await page.waitForTimeout(600);
    const lastBot = await page.locator('.msg-bot').last().textContent();
    ok(`[${vp.name}] FAQ answer uses config prices`, /15\.600/.test(lastBot) && /10/.test(lastBot), lastBot.slice(0, 90));
    await page.evaluate(() => window.agentiAgent.stop());

    // Language switch
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.click('.lang-btn');
    await page.click('#lang-opt-en');
    await page.waitForTimeout(500);
    const en = await page.evaluate(() => ({ lang: document.documentElement.lang, h1: document.querySelector('#hero-title').textContent, cta: document.querySelector('.hero .cta-commercial span').textContent, href: document.querySelector('.hero .cta-commercial').getAttribute('href'), stored: localStorage.getItem('ac.lang'), voice: window.agentiAgent.voice.lang }));
    ok(`[${vp.name}] switch to English`, en.lang === 'en' && /AI agents/.test(en.h1) && en.cta === 'Business inquiry' && en.href === MAILTO && en.stored === 'en' && en.voice === 'en', JSON.stringify(en));
    await page.click('.lang-btn'); await page.click('#lang-opt-pt-BR'); await page.waitForTimeout(500);
    const pt = await page.evaluate(() => ({ lang: document.documentElement.lang, h1: document.querySelector('#hero-title').textContent }));
    ok(`[${vp.name}] switch to Português`, pt.lang === 'pt-BR' && /pensam/.test(pt.h1), JSON.stringify(pt));
    // Keyboard on the language list
    await page.focus('.lang-btn'); await page.keyboard.press('Enter'); await page.keyboard.press('Home'); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
    ok(`[${vp.name}] keyboard language selection back to es-AR`, (await page.evaluate(() => document.documentElement.lang)) === 'es-AR');

    // Pricing + currency toggle
    await page.locator('#precios').scrollIntoViewIfNeeded();
    const ars = await page.locator('[data-plan="pro"] [data-price]').textContent();
    await page.click('[data-currency-toggle] [data-currency="USD"]');
    const usd = await page.locator('[data-plan="pro"] [data-price]').textContent();
    const emp = await page.locator('[data-plan="empresa"] [data-price]').textContent();
    ok(`[${vp.name}] pricing ARS/USD toggle`, /15\.600/.test(ars) && /10/.test(usd) && /30/.test(emp), `${ars} | ${usd} | ${emp}`);
    await page.click('[data-currency-toggle] [data-currency="ARS"]');
    await page.locator('#precios').screenshot({ path: `${SHOTS}/${vp.name}-home-pricing.png` });

    // Mobile nav
    if (vp.width < 1340) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.click('.nav-toggle');
      await page.waitForTimeout(300);
      const open = await page.evaluate(() => document.querySelector('#main-nav').classList.contains('is-open'));
      ok(`[${vp.name}] mobile menu opens`, open);
      await page.screenshot({ path: `${SHOTS}/${vp.name}-home-menu.png` });
      await page.keyboard.press('Escape');
    }
    await page.screenshot({ path: `${SHOTS}/${vp.name}-home-full.png`, fullPage: true });
    const of2 = await overflow(page);
    ok(`[${vp.name}] no horizontal overflow after interactions`, of2.scrollW <= of2.w, JSON.stringify(of2));
    ok(`[${vp.name}] no console errors (home)`, errors.length === 0, errors.join(' | ').slice(0, 400));
    await ctx.close();
  }

  // ---------------- App ----------------
  {
    const { ctx, page, errors } = await newPage(vp);
    await page.goto(url + '/app/', { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    ok(`[${vp.name}] app demo badge visible`, await page.locator('[data-demo-badge]').isVisible());
    await page.screenshot({ path: `${SHOTS}/${vp.name}-app-empty.png` });
    await page.fill('[data-prompt]', '¿Qué es AgentiCuántico?');
    await page.click('[data-send-btn]');
    await page.waitForTimeout(300); await waitFor(page, () => !window.agentiApp.state.busy, 20000);
    const reply = await page.locator('.m-bot .md').last().textContent();
    ok(`[${vp.name}] app demo reply`, /plataforma/i.test(reply), reply.slice(0, 80));
    // code block via starter-like question
    await page.fill('[data-prompt]', '¿Cómo integro la API?');
    await page.click('[data-send-btn]');
    await page.waitForTimeout(300); await waitFor(page, () => !window.agentiApp.state.busy, 20000);
    ok(`[${vp.name}] markdown code block rendered`, (await page.locator('.m-bot .code-block').count()) >= 1);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ac.app.v1')).convs[0].messages.length);
    ok(`[${vp.name}] conversation saved to localStorage`, stored === 4, String(stored));
    const ofa = await overflow(page);
    ok(`[${vp.name}] no horizontal overflow (app)`, ofa.scrollW <= ofa.w, JSON.stringify(ofa));
    await page.screenshot({ path: `${SHOTS}/${vp.name}-app-chat.png` });
    // Avatar panel
    await page.click('.topbar [data-toggle-avatar]');
    await waitFor(page, () => !!(window.agentiAgent && window.agentiAgent.avatar)).catch(() => {});
    await page.waitForTimeout(1200);
    const pbox = await page.locator('[data-avatar-panel]').boundingBox();
    ok(`[${vp.name}] app avatar panel within viewport`, pbox && pbox.x >= 0 && pbox.x + pbox.width <= vp.width + 1 && pbox.y + pbox.height <= vp.height + 1, JSON.stringify(pbox));
    const astd = await imageStd(await page.locator('[data-avatar-panel]').screenshot());
    ok(`[${vp.name}] app avatar renders (stdev ${astd.toFixed(1)})`, astd > 8);
    await page.screenshot({ path: `${SHOTS}/${vp.name}-app-avatar.png` });
    await page.click('.topbar [data-toggle-avatar]');
    // Drawer (mobile/tablet)
    if (vp.width < 1024) {
      await page.click('[data-open-sidebar]'); await page.waitForTimeout(350);
      ok(`[${vp.name}] sidebar drawer opens`, await page.evaluate(() => document.getElementById('sidebar').classList.contains('is-open')));
      await page.screenshot({ path: `${SHOTS}/${vp.name}-app-drawer.png` });
      await page.click('[data-scrim]', { position: { x: vp.width - 10, y: 200 } }); await page.waitForTimeout(300);
    }
    // Language via settings
    await page.click('[data-open-settings]');
    await page.click('.lang-opt:has(input[value="en"])');
    await page.waitForTimeout(500);
    const appEn = await page.evaluate(() => ({ lang: document.documentElement.lang, ph: document.querySelector('[data-prompt]').placeholder }));
    ok(`[${vp.name}] app language switch to English`, appEn.lang === 'en' && /Type a message/.test(appEn.ph), JSON.stringify(appEn));
    await page.screenshot({ path: `${SHOTS}/${vp.name}-app-settings.png` });
    await page.keyboard.press('Escape');
    // Plans
    await page.evaluate(() => window.agentiApp.go('#/plans?plan=pro'));
    await page.waitForTimeout(500);
    const plans = await page.evaluate(() => ({
      mp: document.querySelector('[data-plan="pro"] .btn-mp')?.textContent, pp: document.querySelector('[data-plan="pro"] .btn-pp')?.textContent,
      empMp: document.querySelector('[data-plan="empresa"] .btn-mp')?.textContent
    }));
    ok(`[${vp.name}] plans: MP in ARS, PayPal in USD`, /15\.600/.test(plans.mp) && /10/.test(plans.pp) && /46\.800/.test(plans.empMp), JSON.stringify(plans));
    await page.click('[data-plan="pro"] .btn-mp');
    const notice = await page.locator('[data-plans-notice]').textContent();
    ok(`[${vp.name}] demo checkout shows backend notice`, /backend/i.test(notice), notice.slice(0, 80));
    await page.screenshot({ path: `${SHOTS}/${vp.name}-app-plans.png`, fullPage: false });
    ok(`[${vp.name}] no console errors (app)`, errors.length === 0, errors.join(' | ').slice(0, 400));
    await ctx.close();
  }
}

// ---------------- Secondary pages ----------------
{
  const vp = VIEWPORTS[0];
  const { ctx, page, errors } = await newPage(vp);
  for (const p of ['/legal/privacidad.html', '/legal/terminos.html', '/legal/cookies.html']) {
    await page.goto(url + p, { waitUntil: 'load' }); await page.waitForTimeout(300);
    const h1 = await page.locator('h1').textContent();
    ok(`legal page ${p}`, h1.length > 5, h1);
  }
  await page.click('.lang-btn'); await page.click('#lang-opt-en'); await page.waitForTimeout(400);
  ok('legal page translates', /Cookie policy/.test(await page.locator('h1').textContent()));
  await page.screenshot({ path: `${SHOTS}/legal-cookies-en-375.png`, fullPage: true });
  const r = await page.goto(url + '/nonexistent/page', { waitUntil: 'load' });
  ok('404 page served', r.status() === 404 && /404/.test(await page.locator('h1').textContent()));
  ok('no console errors (legal/404)', errors.filter((e) => !/404/.test(e)).length === 0, errors.join(' | '));
  await ctx.close();
}
{ // Service worker + manifest (SW allowed here)
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await page.goto(url + '/', { waitUntil: 'load' });
  const sw = await page.evaluate(async () => { const reg = await navigator.serviceWorker.ready; return !!reg.active; }).catch((e) => String(e));
  ok('service worker active (PWA)', sw === true, String(sw));
  const man = await page.evaluate(async () => (await fetch('/manifest.webmanifest')).json());
  ok('manifest has 192/512 + maskable icons', man.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable') && man.icons.some((i) => i.sizes === '192x192'));
  // Fallback: no WebGL → static avatar fallback
  await ctx.close();
  const ctx2 = await browser.newContext({ viewport: { width: 375, height: 812 } });
  await ctx2.addInitScript(() => { const orig = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { if (/webgl/.test(t)) return null; return orig.call(this, t, ...a); }; });
  const p2 = await ctx2.newPage(); const errs2 = []; p2.on('pageerror', (e) => errs2.push(e.message));
  await p2.goto(url + '/#agente', { waitUntil: 'load' }); await p2.waitForTimeout(1500);
  const fb = await p2.evaluate(() => !document.querySelector('[data-agent-fallback]').hidden);
  ok('no-WebGL fallback shows static avatar', fb && errs2.length === 0, errs2.join('|'));
  await p2.screenshot({ path: `${SHOTS}/fallback-no-webgl-375.png` });
  await ctx2.close();
}

await browser.close();
srv.close();
const failed = results.filter((r) => !r.pass);
fs.writeFileSync(path.join(SHOTS, `e2e-results${ONLY ? '-' + ONLY.join('_') : ''}.json`), JSON.stringify(results, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
