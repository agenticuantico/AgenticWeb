/**
 * AgentiCuántico app: chat assistant UI.
 * - Demo mode (APP_CONFIG.API_BASE empty): answers from the local public FAQ,
 *   simulated streaming, conversations in localStorage, payments disabled.
 * - Backend mode: streaming /api/chat, magic-link/Google auth, plan gating and
 *   Mercado Pago / PayPal subscriptions handled by the private Worker.
 */
import { createI18n, LANGS } from '../assets/js/i18n.js';
import { FLAGS } from '../assets/js/flags.js';
import { renderPricing, mountCurrencyToggle, getCurrency } from '../assets/js/pricing.js';
import { APP_CONFIG, isDemo } from './config.js';
import { renderMarkdown, toSpeech } from './markdown.js';
import { api } from './api.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const i18n = createI18n({ base: '/assets/i18n/', extraBases: ['/app/i18n/'] });
const t = (k, v) => i18n.t(k, v);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const desktop = () => matchMedia('(min-width: 1024px)').matches;
document.documentElement.classList.add('js');

// ---------------- State ----------------
const state = {
  convs: [], currentId: null, agent: 'general',
  settings: { readAloud: false, showAvatar: false },
  user: null, plan: 'free', busy: false, abort: null, attachments: [], kb: null, brain: null, controller: null
};

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(APP_CONFIG.STORAGE_KEY) || '{}');
    state.convs = Array.isArray(raw.convs) ? raw.convs : [];
    Object.assign(state.settings, raw.settings || {});
    if (raw.agent) state.agent = raw.agent;
  } catch { /* corrupted storage: start fresh */ }
}
function save() {
  try { localStorage.setItem(APP_CONFIG.STORAGE_KEY, JSON.stringify({ convs: state.convs.slice(0, 200), settings: state.settings, agent: state.agent })); }
  catch { toast(t('app.storageFull')); }
}
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const current = () => state.convs.find((c) => c.id === state.currentId) || null;

// ---------------- Elements ----------------
const el = {
  app: $('[data-app]'), sidebar: $('#sidebar'), scrim: $('[data-scrim]'), list: $('[data-conv-list]'), search: $('[data-search]'),
  thread: $('[data-thread]'), wrap: $('[data-thread-wrap]'), empty: $('[data-empty]'), starters: $('[data-starters]'),
  form: $('[data-composer]'), prompt: $('[data-prompt]'), send: $('[data-send-btn]'), voice: $('[data-voice-btn]'), file: $('[data-file-input]'),
  atts: $('[data-attachments]'), hint: $('[data-composer-hint]'),
  agentBtn: $('[data-agent-btn]'), agentList: $('[data-agent-list]'), agentName: $('[data-agent-name]'), agentIco: $('[data-agent-ico]'),
  demo: $('[data-demo-badge]'), avatarPanel: $('[data-avatar-panel]'), avatarStatus: $('[data-avatar-status]'),
  settings: $('[data-settings]'), login: $('[data-login]'), toast: $('[data-toast]'),
  accountBtn: $('[data-account-btn]'), accountMenu: $('[data-account-menu]'),
  views: { chat: $('[data-view="chat"]'), plans: $('[data-view="plans"]') }, pricing: $('[data-app-pricing]'), plansNotice: $('[data-plans-notice]')
};

let toastTimer = 0;
function toast(msg) {
  el.toast.textContent = msg; el.toast.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.toast.hidden = true; }, 3200);
}

// ---------------- Sidebar ----------------
function openSidebar(open) {
  if (desktop()) return;
  el.sidebar.classList.toggle('is-open', open);
  el.scrim.hidden = !open;
  $('[data-open-sidebar]').setAttribute('aria-expanded', String(open));
  if (open) el.sidebar.querySelector('.new-chat').focus();
}
$('[data-open-sidebar]').addEventListener('click', () => openSidebar(true));
$('[data-close-sidebar]').addEventListener('click', () => openSidebar(false));
el.scrim.addEventListener('click', () => openSidebar(false));
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (el.sidebar.classList.contains('is-open')) openSidebar(false);
  closeMenus();
});

function groupLabel(ts) {
  const d = new Date(ts), now = new Date();
  const days = Math.floor((new Date(now.toDateString()) - new Date(d.toDateString())) / 86400000);
  if (days <= 0) return t('app.today');
  if (days === 1) return t('app.yesterday');
  if (days < 7) return t('app.last7');
  return t('app.older');
}

function renderList() {
  const q = el.search.value.trim().toLowerCase();
  const convs = [...state.convs].sort((a, b) => b.updatedAt - a.updatedAt)
    .filter((c) => !q || c.title.toLowerCase().includes(q) || c.messages.some((m) => m.content.toLowerCase().includes(q)));
  el.list.innerHTML = '';
  if (!convs.length) { const p = document.createElement('p'); p.className = 'conv-empty'; p.textContent = q ? t('app.noResults') : t('app.noConvs'); el.list.appendChild(p); return; }
  let lastGroup = '';
  for (const c of convs) {
    const g = groupLabel(c.updatedAt);
    if (g !== lastGroup) { const h = document.createElement('div'); h.className = 'conv-group'; h.textContent = g; el.list.appendChild(h); lastGroup = g; }
    const row = document.createElement('div');
    row.className = 'conv' + (c.id === state.currentId ? ' is-active' : '');
    const a = document.createElement('a');
    a.href = `#/c/${c.id}`; a.textContent = c.title || t('app.untitled');
    if (c.id === state.currentId) a.setAttribute('aria-current', 'page');
    const more = document.createElement('button');
    more.type = 'button'; more.className = 'icon-btn conv-more'; more.setAttribute('aria-haspopup', 'menu'); more.setAttribute('aria-expanded', 'false');
    more.setAttribute('aria-label', t('app.convOptions'));
    more.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg>';
    more.addEventListener('click', (e) => { e.stopPropagation(); convMenu(row, c, more); });
    row.append(a, more);
    el.list.appendChild(row);
  }
}
el.search.addEventListener('input', renderList);

function closeMenus() {
  $$('.conv-menu').forEach((m) => m.remove());
  $$('.conv-more[aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  el.accountMenu.hidden = true; el.accountBtn.setAttribute('aria-expanded', 'false');
  el.agentList.hidden = true; el.agentBtn.setAttribute('aria-expanded', 'false');
}
document.addEventListener('click', (e) => { if (!e.target.closest('.conv-menu, .conv-more, .account, .agent-select')) closeMenus(); });

function convMenu(row, conv, btn) {
  const open = btn.getAttribute('aria-expanded') === 'true';
  closeMenus();
  if (open) return;
  btn.setAttribute('aria-expanded', 'true');
  const m = document.createElement('div');
  m.className = 'menu conv-menu'; m.setAttribute('role', 'menu');
  const rename = document.createElement('button'); rename.type = 'button'; rename.setAttribute('role', 'menuitem'); rename.textContent = t('app.rename');
  const del = document.createElement('button'); del.type = 'button'; del.setAttribute('role', 'menuitem'); del.className = 'danger'; del.textContent = t('app.delete');
  rename.addEventListener('click', () => {
    const name = prompt(t('app.renamePrompt'), conv.title);
    if (name && name.trim()) { conv.title = name.trim().slice(0, 80); save(); renderList(); }
    closeMenus();
  });
  del.addEventListener('click', () => {
    if (!confirm(t('app.deleteConfirm'))) return closeMenus();
    state.convs = state.convs.filter((c) => c.id !== conv.id);
    if (state.currentId === conv.id) { state.currentId = null; location.hash = '#/'; }
    save(); renderList(); renderThread(); closeMenus();
  });
  m.append(rename, del);
  row.appendChild(m);
  rename.focus();
}

// ---------------- Agents ----------------
function agentLabel(id) { return t(`app.agent.${id}.name`); }
function renderAgentPicker() {
  const a = APP_CONFIG.AGENTS.find((x) => x.id === state.agent) || APP_CONFIG.AGENTS[0];
  el.agentName.textContent = agentLabel(a.id);
  el.agentIco.textContent = a.icon;
  el.agentList.innerHTML = '';
  APP_CONFIG.AGENTS.forEach((ag, i) => {
    const li = document.createElement('li');
    li.setAttribute('role', 'option'); li.id = `agent-${ag.id}`; li.dataset.id = ag.id;
    li.setAttribute('aria-selected', String(ag.id === state.agent));
    li.innerHTML = `<span class="ai" aria-hidden="true"></span><strong></strong>${ag.plan !== 'free' ? '<span class="tier">PRO</span>' : '<span></span>'}<small></small>`;
    li.querySelector('.ai').textContent = ag.icon;
    li.querySelector('strong').textContent = agentLabel(ag.id);
    li.querySelector('small').textContent = t(`app.agent.${ag.id}.desc`);
    li.addEventListener('click', () => chooseAgent(ag.id));
    li.addEventListener('mousemove', () => highlightAgent(i));
    el.agentList.appendChild(li);
  });
}
let agentActive = 0;
function highlightAgent(i) {
  const items = $$('li', el.agentList);
  agentActive = (i + items.length) % items.length;
  items.forEach((li, j) => li.classList.toggle('is-active', j === agentActive));
  el.agentList.setAttribute('aria-activedescendant', items[agentActive].id);
}
function chooseAgent(id) {
  const ag = APP_CONFIG.AGENTS.find((a) => a.id === id);
  if (!isDemo() && ag.plan !== 'free' && planRank(state.plan) < planRank(ag.plan)) {
    closeMenus(); toast(t('app.needsPro')); go('#/plans?plan=pro'); return;
  }
  state.agent = id; save(); renderAgentPicker(); closeMenus(); el.agentBtn.focus();
  const c = current(); if (c) { c.agent = id; save(); }
}
el.agentBtn.addEventListener('click', () => {
  const open = el.agentList.hidden;
  closeMenus();
  if (open) { el.agentList.hidden = false; el.agentBtn.setAttribute('aria-expanded', 'true'); highlightAgent(APP_CONFIG.AGENTS.findIndex((a) => a.id === state.agent)); el.agentList.focus(); }
});
el.agentList.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); highlightAgent(agentActive + 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); highlightAgent(agentActive - 1); }
  else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseAgent(APP_CONFIG.AGENTS[agentActive].id); }
  else if (e.key === 'Escape') { closeMenus(); el.agentBtn.focus(); }
});
const planRank = (p) => ({ free: 0, pro: 1, empresa: 2 }[p] ?? 0);

// ---------------- Thread ----------------
const BOT_ICON = '<svg viewBox="0 0 48 48" aria-hidden="true"><use href="/assets/img/sprite.svg#logo"/></svg>';
const ICONS = {
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/></svg>',
  speak: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"/></svg>',
  regen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 10-2.3 5.7M20 5v6h-6"/></svg>'
};

function msgNode(m, idx, isLastBot) {
  const li = document.createElement('li');
  li.className = `m m-${m.role === 'user' ? 'user' : 'bot'}`;
  li.dataset.idx = idx;
  if (m.role === 'user') {
    const b = document.createElement('div'); b.className = 'bubble'; b.textContent = m.content;
    if (m.files && m.files.length) { const s = document.createElement('div'); s.className = 'fineprint'; s.textContent = '📎 ' + m.files.join(', '); b.appendChild(s); }
    li.appendChild(b);
  } else {
    li.innerHTML = `<div class="m-ico">${BOT_ICON}</div><div class="m-body"><div class="md"></div><div class="m-actions"></div></div>`;
    li.querySelector('.md').innerHTML = renderMarkdown(m.content, { copyLabel: t('app.copy') });
    const actions = li.querySelector('.m-actions');
    const mk = (icon, label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'icon-btn'; b.innerHTML = ICONS[icon]; b.setAttribute('aria-label', label); b.title = label; b.addEventListener('click', fn); actions.appendChild(b); };
    mk('copy', t('app.copy'), () => copyText(m.content));
    mk('speak', t('app.readAloudOne'), () => speak(m.content));
    if (isLastBot) mk('regen', t('app.regenerate'), regenerate);
  }
  return li;
}

function renderThread() {
  const c = current();
  el.thread.innerHTML = '';
  const msgs = c ? c.messages : [];
  el.empty.hidden = msgs.length > 0;
  const lastBot = msgs.map((m) => m.role).lastIndexOf('assistant');
  msgs.forEach((m, i) => el.thread.appendChild(msgNode(m, i, i === lastBot && !state.busy)));
  scrollToEnd(false);
}
function scrollToEnd(smooth = true) { el.wrap.scrollTo({ top: el.wrap.scrollHeight, behavior: smooth && !reducedMotion ? 'smooth' : 'auto' }); }

function renderStarters() {
  el.starters.innerHTML = '';
  for (let i = 1; i <= 4; i++) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'starter';
    b.innerHTML = '<strong></strong><span></span>';
    b.querySelector('strong').textContent = t(`app.starter${i}t`);
    b.querySelector('span').textContent = t(`app.starter${i}p`);
    b.addEventListener('click', () => send(t(`app.starter${i}q`)));
    el.starters.appendChild(b);
  }
}

el.thread.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-copy]');
  if (!btn) return;
  const code = btn.closest('.code-block').querySelector('code').textContent;
  copyText(code); btn.textContent = t('app.copied'); setTimeout(() => { btn.textContent = t('app.copy'); }, 1500);
});
async function copyText(s) {
  try { await navigator.clipboard.writeText(s); toast(t('app.copied')); }
  catch { toast(t('app.copyFail')); }
}

// ---------------- Composer ----------------
function autosize() { el.prompt.style.height = 'auto'; el.prompt.style.height = Math.min(el.prompt.scrollHeight, innerHeight * 0.4) + 'px'; }
el.prompt.addEventListener('input', () => { autosize(); updateSend(); });
el.prompt.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !matchMedia('(pointer: coarse)').matches) { e.preventDefault(); el.form.requestSubmit(); }
});
function updateSend() {
  el.send.classList.toggle('is-busy', state.busy);
  el.send.setAttribute('aria-label', state.busy ? t('app.stop') : t('app.send'));
  el.send.title = el.send.getAttribute('aria-label');
  el.send.disabled = !state.busy && !el.prompt.value.trim();
}
el.form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (state.busy) { stopGeneration(); return; }
  const text = el.prompt.value.trim();
  if (!text) return;
  el.prompt.value = ''; autosize();
  send(text);
});

// Attachments (sent to backend when available; demo shows them only)
el.file.addEventListener('change', () => {
  for (const f of el.file.files) { if (state.attachments.length < 5) state.attachments.push(f); }
  el.file.value = ''; renderAttachments();
  if (isDemo()) toast(t('app.attachDemo'));
});
$('[data-attach-btn]').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.file.click(); } });
function renderAttachments() {
  el.atts.innerHTML = '';
  el.atts.hidden = !state.attachments.length;
  state.attachments.forEach((f, i) => {
    const s = document.createElement('span'); s.className = 'att';
    s.innerHTML = '<span></span><button type="button">×</button>';
    s.firstChild.textContent = f.name;
    s.lastChild.setAttribute('aria-label', t('app.removeFile', { name: f.name }));
    s.lastChild.addEventListener('click', () => { state.attachments.splice(i, 1); renderAttachments(); });
    el.atts.appendChild(s);
  });
}

// Voice dictation (Web Speech API recognition)
const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
if (!Rec) { el.voice.disabled = true; el.voice.title = t('app.voiceUnsupported'); }
el.voice.addEventListener('click', () => {
  if (!Rec) return toast(t('app.voiceUnsupported'));
  if (rec) { rec.stop(); return; }
  rec = new Rec();
  rec.lang = i18n.lang === 'en' ? 'en-US' : i18n.lang;
  rec.interimResults = true; rec.continuous = false;
  const base = el.prompt.value ? el.prompt.value + ' ' : '';
  rec.onresult = (ev) => { let s = ''; for (const r of ev.results) s += r[0].transcript; el.prompt.value = base + s; autosize(); updateSend(); };
  rec.onend = () => { rec = null; el.voice.setAttribute('aria-pressed', 'false'); el.hint.textContent = ''; el.prompt.focus(); };
  rec.onerror = (ev) => { if (ev.error === 'not-allowed') toast(t('app.micDenied')); };
  el.voice.setAttribute('aria-pressed', 'true'); el.hint.textContent = t('app.listening');
  rec.start();
});

// ---------------- Sending ----------------
function ensureConv(firstText) {
  let c = current();
  if (!c) {
    c = { id: uid(), title: firstText.slice(0, 60), agent: state.agent, createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
    state.convs.unshift(c); state.currentId = c.id;
    history.replaceState(null, '', `#/c/${c.id}`);
  }
  return c;
}

async function send(text) {
  if (state.busy) return;
  const c = ensureConv(text);
  const files = state.attachments.map((f) => f.name);
  c.messages.push({ role: 'user', content: text, ts: Date.now(), ...(files.length ? { files } : {}) });
  state.attachments = []; renderAttachments();
  c.updatedAt = Date.now(); save(); renderList(); renderThread();
  await generate(c);
}

async function generate(c) {
  state.busy = true; updateSend();
  const bot = { role: 'assistant', content: '', ts: Date.now() };
  c.messages.push(bot);
  const li = msgNode(bot, c.messages.length - 1, false);
  const md = li.querySelector('.md');
  md.innerHTML = '<span class="typing" aria-label="…"><i></i><i></i><i></i></span>';
  li.querySelector('.m-actions').hidden = true;
  el.empty.hidden = true; el.thread.appendChild(li); scrollToEnd();
  const ctrl = new AbortController(); state.abort = ctrl;
  const onDelta = (_d, full) => { bot.content = full; md.innerHTML = renderMarkdown(full, { copyLabel: t('app.copy') }); md.lastElementChild?.classList.add('cursor'); scrollToEnd(false); };
  try {
    if (isDemo()) await demoStream(c, onDelta, ctrl.signal);
    else await api.chat({ messages: c.messages.slice(0, -1).map(({ role, content }) => ({ role, content })), agent: c.agent || state.agent, lang: i18n.lang }, onDelta, ctrl.signal);
  } catch (err) {
    if (err.name !== 'AbortError') {
      if (err.status === 401) { bot.content = t('app.errLogin'); openLogin(); }
      else if (err.status === 402 || err.status === 403) { bot.content = t('app.errPlan'); }
      else if (err.status === 429) { bot.content = t('app.errRate'); }
      else bot.content = t('app.errGeneric');
    }
  } finally {
    if (!bot.content) bot.content = t('app.stopped');
    state.busy = false; state.abort = null;
    c.updatedAt = Date.now(); save(); renderThread(); updateSend(); renderList();
    if (state.settings.readAloud || state.settings.showAvatar) speak(bot.content);
  }
}
function stopGeneration() { if (state.abort) state.abort.abort(); }
function regenerate() {
  const c = current(); if (!c || state.busy) return;
  if (c.messages.at(-1)?.role === 'assistant') c.messages.pop();
  renderThread(); generate(c);
}

// ---------------- Demo brain ----------------
async function ensureKB() {
  if (!state.brain) state.brain = await import('../assets/js/brain.js');
  if (!state.kb || state.kb.lang !== i18n.lang) state.kb = await state.brain.loadKnowledge(i18n.lang);
  return state.kb;
}
const CODE_RE = /\b(api|codigo|código|code|integrar|integración|integracion|integration|integração|javascript|curl|webhook)\b/i;
async function demoReply(c) {
  const kb = await ensureKB();
  const userMsg = c.messages.filter((m) => m.role === 'user').at(-1).content;
  const agent = c.agent || state.agent;
  if (CODE_RE.test(userMsg)) return t('app.demoCode');
  const res = state.brain.answer(kb, userMsg);
  let out = res.text;
  const tail = t(`app.agent.${agent}.tail`);
  if (tail && !tail.startsWith('app.')) out += `\n\n${tail}`;
  if (res.id !== 'fallback' && res.suggestions?.length) out += `\n\n**${t('app.related')}**\n${res.suggestions.map((s) => `- ${s}`).join('\n')}`;
  if (c.messages.filter((m) => m.role === 'assistant').length <= 1) out += `\n\n> ${t('app.demoNote')}`;
  return out;
}
async function demoStream(c, onDelta, signal) {
  const text = await demoReply(c);
  await new Promise((r) => setTimeout(r, 350 + Math.random() * 300));
  const parts = text.split(/(\s+)/);
  let full = '';
  for (const p of parts) {
    if (signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    full += p; onDelta(p, full);
    if (p.trim()) await new Promise((r) => setTimeout(r, reducedMotion ? 4 : 14 + Math.random() * 22));
  }
}

// ---------------- Voice + avatar ----------------
async function getController() {
  if (state.controller) return state.controller;
  const { createAgentController } = await import('../assets/js/agent.js');
  state.controller = createAgentController({
    canvas: $('#app-avatar-canvas'), fallbackEl: $('[data-app-avatar-fallback]'), loadingEl: $('[data-app-avatar-loading]'),
    lang: i18n.lang, proxyUrl: APP_CONFIG.TTS_PROXY_URL, tuning: APP_CONFIG.VOICE_TUNING, reducedMotion,
    onStatus: (s) => {
      const key = s === 'speaking' ? 'agent.statusSpeaking' : 'agent.statusIdle';
      el.avatarStatus.dataset.i18n = key; el.avatarStatus.textContent = t(key);
      el.avatarPanel.classList.toggle('is-speaking', s === 'speaking');
    }
  });
  window.agentiAgent = state.controller;
  return state.controller;
}
async function speak(md) {
  const text = toSpeech(md);
  if (!text) return;
  const c = await getController();
  if (state.settings.showAvatar) await c.speak(text); else await c.voice.speak(text);
}
async function setAvatar(show) {
  state.settings.showAvatar = !!show; save();
  el.avatarPanel.hidden = !show;
  $$('[data-toggle-avatar]').forEach((b) => b.setAttribute('aria-pressed', String(!!show)));
  const box = $('[data-setting="showAvatar"]'); if (box) box.checked = !!show;
  if (show) { const c = await getController(); const av = await c.ensureAvatar(); av && av.fit(); }
  else if (state.controller) state.controller.stop();
}
$$('[data-toggle-avatar]').forEach((b) => b.addEventListener('click', () => setAvatar(!state.settings.showAvatar)));
$('[data-avatar-stop]').addEventListener('click', () => state.controller && state.controller.stop());

// ---------------- Account / auth ----------------
function renderAccount() {
  const name = state.user ? state.user.email : t('app.guest');
  $('[data-account-name]').textContent = name;
  $('[data-initial]').textContent = state.user ? state.user.email[0].toUpperCase() : '?';
  $('[data-plan-badge]').textContent = ({ free: 'Gratis', pro: 'Pro', empresa: 'Empresa' })[state.plan] || 'Gratis';
  $('[data-action="login"]').hidden = !!state.user;
  $('[data-action="logout"]').hidden = !state.user;
  el.demo.hidden = !isDemo();
  el.demo.title = t('app.demoTip');
}
el.accountBtn.addEventListener('click', () => {
  const open = el.accountMenu.hidden; closeMenus();
  if (open) { el.accountMenu.hidden = false; el.accountBtn.setAttribute('aria-expanded', 'true'); el.accountMenu.querySelector('[role="menuitem"]:not([hidden])').focus(); }
});
el.accountMenu.addEventListener('keydown', (e) => {
  const items = $$('[role="menuitem"]:not([hidden])', el.accountMenu);
  const i = items.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  if (e.key === 'Escape') { closeMenus(); el.accountBtn.focus(); }
});
el.accountMenu.addEventListener('click', async (e) => {
  const a = e.target.closest('[data-action]'); if (!a) return;
  closeMenus();
  if (a.dataset.action === 'login') openLogin();
  if (a.dataset.action === 'plans') go('#/plans');
  if (a.dataset.action === 'settings') openSettings();
  if (a.dataset.action === 'logout') { try { await api.logout(); } catch { /* ignore */ } state.user = null; state.plan = 'free'; renderAccount(); toast(t('app.loggedOut')); }
});

function openLogin() {
  const n = $('[data-login-notice]'); n.hidden = true;
  if (isDemo()) { n.hidden = false; n.className = 'notice'; n.textContent = t('app.loginDemo'); }
  el.login.showModal();
}
$('[data-close-dialog]').addEventListener('click', () => el.login.close());
$('[data-login-form]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const n = $('[data-login-notice]'); n.hidden = false;
  if (isDemo()) { n.className = 'notice'; n.textContent = t('app.loginDemo'); return; }
  try { await api.magicLink($('[data-login-email]').value.trim(), i18n.lang); n.className = 'notice ok'; n.textContent = t('app.linkSent'); }
  catch (err) { n.className = 'notice'; n.textContent = err.status === 429 ? t('app.errRate') : t('app.errGeneric'); }
});
$('[data-google-login]').addEventListener('click', () => {
  if (isDemo()) { const n = $('[data-login-notice]'); n.hidden = false; n.className = 'notice'; n.textContent = t('app.loginDemo'); return; }
  location.href = api.googleStartUrl();
});

// ---------------- Settings ----------------
function openSettings() {
  const box = $('[data-lang-options]'); box.innerHTML = '';
  LANGS.forEach((l) => {
    const lab = document.createElement('label'); lab.className = 'lang-opt';
    lab.innerHTML = `<input type="radio" name="lang" value="${l.code}"><span class="flag" aria-hidden="true">${FLAGS[l.code]}</span><span lang="${l.code}"></span>`;
    lab.lastChild.textContent = l.label;
    const input = lab.querySelector('input'); input.checked = l.code === i18n.lang;
    input.addEventListener('change', () => i18n.setLang(l.code));
    box.appendChild(lab);
  });
  $$('[data-setting]').forEach((cb) => { cb.checked = !!state.settings[cb.dataset.setting]; });
  $('[data-mode-info]').textContent = isDemo() ? t('app.modeDemo') : t('app.modeLive');
  getController().then((c) => c.voice.describeVoice()).then((v) => { $('[data-voice-info]').textContent = t('app.voiceInfo', { voice: v }); }).catch(() => {});
  el.settings.showModal();
}
$('[data-open-settings]').addEventListener('click', openSettings);
$$('[data-setting]').forEach((cb) => cb.addEventListener('change', () => {
  if (cb.dataset.setting === 'showAvatar') setAvatar(cb.checked);
  else { state.settings[cb.dataset.setting] = cb.checked; save(); }
}));
$('[data-clear-all]').addEventListener('click', () => {
  if (!confirm(t('app.clearConfirm'))) return;
  state.convs = []; state.currentId = null; save(); renderList(); renderThread(); el.settings.close(); location.hash = '#/';
});

// ---------------- Plans ----------------
let currency = getCurrency();
function drawPlans() {
  renderPricing(el.pricing, { t, lang: i18n.lang, currency, mode: 'app', currentPlan: state.plan, onCheckout: checkout });
}
mountCurrencyToggle($('[data-currency-toggle]', el.views.plans), (c) => { currency = c; drawPlans(); });
async function checkout(plan, provider, btn) {
  if (isDemo()) { showPlansNotice(t('app.payDemo'), false); return; }
  if (!state.user) { toast(t('app.loginFirst')); openLogin(); return; }
  btn.disabled = true; const old = btn.textContent; btn.textContent = t('app.redirecting');
  try {
    const { url } = await api.subscribe(provider, plan);
    if (!/^https:\/\//.test(url)) throw new Error('bad url');
    location.href = url;
  } catch (err) {
    showPlansNotice(err.status === 401 ? t('app.errLogin') : t('app.payError'), false);
    btn.disabled = false; btn.textContent = old;
  }
}
function showPlansNotice(msg, ok) { el.plansNotice.hidden = false; el.plansNotice.className = 'notice' + (ok ? ' ok' : ''); el.plansNotice.textContent = msg; }
$('[data-go-plans]').addEventListener('click', () => go('#/plans'));
$('[data-back-chat]').addEventListener('click', () => go(state.currentId ? `#/c/${state.currentId}` : '#/'));

// ---------------- Router ----------------
function go(hash) { if (location.hash === hash) route(); else location.hash = hash; openSidebar(false); }
function showView(name) {
  Object.entries(el.views).forEach(([k, v]) => { v.hidden = k !== name; });
}
function route() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  const params = new URLSearchParams(qs || '');
  closeMenus();
  if (path === '/plans') {
    showView('plans'); el.plansNotice.hidden = true;
    const status = params.get('status');
    if (status === 'success') showPlansNotice(t('app.paySuccess'), true);
    else if (status === 'pending') showPlansNotice(t('app.payPending'), false);
    else if (status === 'failure') showPlansNotice(t('app.payFailure'), false);
    else if (isDemo()) showPlansNotice(t('app.payDemo'), false);
    drawPlans();
    const want = params.get('plan');
    if (want) requestAnimationFrame(() => { const card = el.pricing.querySelector(`[data-plan="${want}"]`); card && card.scrollIntoView({ block: 'center' }); card && card.querySelector('button:not([disabled])')?.focus({ preventScroll: true }); });
    return;
  }
  showView('chat');
  if (path === '/new') { state.currentId = null; history.replaceState(null, '', '#/'); }
  else if (path.startsWith('/c/')) { const id = path.slice(3); state.currentId = state.convs.some((c) => c.id === id) ? id : null; const c = current(); if (c && c.agent) { state.agent = c.agent; renderAgentPicker(); } }
  else state.currentId = null;
  renderList(); renderThread(); updateSend();
  openSidebar(false);
  if (!matchMedia('(pointer: coarse)').matches) el.prompt.focus();
}
addEventListener('hashchange', route);
$$('[data-new-chat]').forEach((b) => b.addEventListener('click', () => { state.currentId = null; go('#/new'); }));

// ---------------- i18n ----------------
i18n.onChange((lang) => {
  renderAgentPicker(); renderStarters(); renderList(); renderThread(); renderAccount(); updateSend();
  if (!el.views.plans.hidden) drawPlans();
  if (state.controller) { state.controller.stop(); state.controller.setLang(lang); }
  if (rec) rec.stop();
});

// ---------------- Boot ----------------
(async () => {
  load();
  await i18n.setLang(i18n.lang, { persist: false });
  if (!isDemo()) {
    try { const me = await api.me(); state.user = me.user || null; state.plan = (me.user && me.user.plan) || 'free'; } catch { state.user = null; }
  }
  renderAgentPicker(); renderStarters(); renderAccount();
  route();
  if (state.settings.showAvatar) setAvatar(true);
})();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
window.agentiApp = { state, send, go, i18n };
