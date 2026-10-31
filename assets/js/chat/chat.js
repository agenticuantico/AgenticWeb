/**
 * AgentiCuántico · componente de chat (portada embebida y app completa /app/).
 *
 * Reglas de voz:
 *  - Si el usuario HABLA (nota de voz), la respuesta se muestra y además se dice en voz alta con el avatar.
 *  - Si el usuario ESCRIBE, la respuesta es solo texto (puede escucharla con el botón de altavoz).
 *  - Conversación manos libres: graba, envía, responde con voz y vuelve a escuchar, por turnos.
 */
import { h, icon, esc, toast, modal, popover, uid } from '../ui.js';
import { CONFIG, PLANS, formatARS, mailtoCommercial } from '../config.js';
import { prefs } from '../consent.js';
import * as engine from './engine.js';
import { renderMarkdown } from './md.js';
import { LANGS, getLang, flagUrl } from './languages.js';
import { AGENTS, TOOLS, SKILLS, CONNECTORS, agentById, initials } from './agents.js';
import { speak, stop as stopSpeech } from './voice.js';
import { VoiceRecorder, fmtClock } from './recorder.js';
import { readFile, fmtSize } from './docs.js';
import { needsWebAction, AgentBrowserCard } from '../agent-browser.js';

const MODES = {
  fast: { label: 'Rápido', short: 'Rápido', icon: 'bolt', desc: 'Respuestas al instante' },
  deep: { label: 'Pensar', short: 'Pensar', icon: 'bulb', desc: 'Razonamiento profundo' },
  auto: { label: 'Hace todo por vos', short: 'Agente', icon: 'spark', desc: 'Planifica, usa herramientas y verifica', flagship: true }
};

const SUGGESTIONS = [
  { t: '¿Qué es AgentiCuántico?', i: 'info' },
  { t: 'Armá una landing page para una cafetería', i: 'spark', mode: 'auto' },
  { t: 'Escribí una función en Python que ordene precios', i: 'code' },
  { t: '¿Cuánto es 15600 × 12?', i: 'calc' }
];

export class ChatApp {
  constructor(root, { variant = 'embed', avatar = null, store, onRequestLogin } = {}) {
    this.root = root;
    this.variant = variant;
    this.avatar = avatar;
    this.store = store;
    this.onRequestLogin = onRequestLogin;
    this.user = null;
    this.profile = null;
    this.lang = getLang(prefs.get('ac.lang', 'es-AR'));
    this.mode = 'fast';
    this.chat = this.newChatObject();
    this.busy = null;
    this.pendingFiles = [];
    this.handsFree = false;
    this.system = window.AC_SYSTEM || null;
    this.render();
    this.bind();
    engine.init().then(() => this.updateStatus());
    window.addEventListener('ac:system', (e) => { this.system = e.detail; this.applyFlags(); });
    if (this.system) this.applyFlags();
  }

  /* =================== Estado =================== */
  newChatObject(incognito = false) {
    return { id: uid('c'), title: 'Nueva conversación', createdAt: Date.now(), updatedAt: Date.now(), messages: [], agents: [], projectId: null, pinned: false, incognito };
  }
  get plan() { return (this.profile && this.profile.plan) || 'gratis'; }
  get isPaid() { return ['pro', 'empresa'].includes(this.plan) && (!this.profile || ['active', 'pending'].includes(this.profile.planStatus || 'active')); }
  flag(name) { return !this.system || this.system.flags[name] !== false; }

  setUser(user, profile) {
    this.user = user; this.profile = profile;
    engine.setIdTokenProvider(user ? () => user.getIdToken() : null);
    this.renderParticipants();
  }

  /* =================== Render base =================== */
  render() {
    const r = this.root;
    r.classList.add('chat');
    r.dataset.variant = this.variant;
    r.innerHTML = `
      <header class="chat-head">
        ${this.variant === 'full' ? `<button class="icon-btn only-narrow" type="button" data-act="sidebar" aria-label="Abrir historial">${icon('sidebar')}</button>` : ''}
        <div class="chat-id">
          <span class="chat-face"><img src="/media/agenticuantico-avatar.jpg" alt="" width="40" height="40"><i class="dot" aria-hidden="true"></i></span>
          <span class="chat-id-text"><strong>AgentiCuántico</strong><span class="chat-status" data-role="status">En línea</span></span>
        </div>
        <div class="chat-participants" data-role="participants" aria-label="Agentes en la conversación"></div>
        <div class="chat-actions">
          <div class="lang-picker" data-popover-host>
            <button class="lang-btn" type="button" data-act="lang" aria-haspopup="menu" aria-expanded="false" aria-label="Idioma y voz">
              <img class="flag" alt="" width="26" height="26" data-role="flag"><span data-role="langShort"></span>${icon('chevron')}
            </button>
          </div>
          <a class="icon-btn" href="/llamada/" aria-label="Llamar a la Compañera" title="Llamada de voz con la Compañera">${icon('phone')}</a>
          <button class="icon-btn" type="button" data-act="incognito" aria-pressed="false" aria-label="Chat incógnito" title="Chat incógnito (no se guarda)">${icon('ghost')}</button>
          <div data-popover-host><button class="icon-btn" type="button" data-act="more" aria-haspopup="menu" aria-expanded="false" aria-label="Más opciones">${icon('more')}</button></div>
        </div>
      </header>
      <div class="incognito-bar" data-role="incognitoBar" hidden>${icon('ghost')}<span><strong>Chat incógnito.</strong> No se guarda en el historial, la memoria ni la nube.</span></div>
      <div class="chat-body">
        <div class="chat-thread" data-role="thread" role="log" aria-live="polite" aria-relevant="additions" tabindex="0" aria-label="Conversación">
          <div class="thread-inner" data-role="inner"></div>
        </div>
        <div class="chat-empty" data-role="empty">
          <p class="chat-greeting" data-role="greeting"></p>
          <div class="suggestions" data-role="suggestions"></div>
        </div>
        <button class="scroll-down icon-btn" type="button" data-act="scrollDown" aria-label="Ir al final" hidden>${icon('arrowDown')}</button>
      </div>
      <form class="composer" data-role="form" autocomplete="off">
        <div class="mode-strip-wrap" data-role="modeWrap">
          <div class="mode-strip" data-role="modeStrip" role="radiogroup" aria-label="Modo de respuesta">${Object.entries(MODES).map(([id, m]) => `<button class="mode-chip" type="button" role="radio" aria-checked="false" data-act="setmode" data-mode="${id}" title="${m.desc}">${icon(m.icon)}<span>${m.short}</span></button>`).join('')}</div>
        </div>
        <div class="composer-box" data-role="box">
          <div class="composer-files" data-role="files" hidden></div>
          <label class="sr-only" for="${this.variant}-input">Mensaje</label>
          <textarea id="${this.variant}-input" data-role="input" rows="1" placeholder="Escribí o tocá el micrófono para hablar" enterkeyhint="send"></textarea>
          <div class="composer-row">
            <div class="composer-left" data-popover-host>
              <button class="icon-btn round" type="button" data-act="plus" aria-haspopup="menu" aria-expanded="false" aria-label="Adjuntar, cámara y herramientas">${icon('plus')}</button>
              <button class="icon-btn round" type="button" data-act="invite" aria-label="Invitar agente" title="Invitar agente (@)">${icon('userPlus')}</button>
            </div>
            <div class="composer-right">
              <button class="icon-btn round" type="button" data-act="mic" aria-label="Grabar nota de voz" title="Grabar nota de voz">${icon('mic')}</button>
              <button class="send-btn" type="button" data-act="handsfree" aria-label="Conversación por voz" title="Conversación por voz (manos libres)">${icon('wave')}</button>
              <button class="send-btn" type="submit" data-role="send" aria-label="Enviar" hidden>${icon('send')}</button>
              <button class="send-btn stop" type="button" data-act="stop" aria-label="Detener" hidden>${icon('stop')}</button>
            </div>
          </div>
          <div class="recording" data-role="rec" hidden>
            <button class="icon-btn" type="button" data-act="recCancel" aria-label="Cancelar grabación">${icon('trash')}</button>
            <span class="rec-dot" aria-hidden="true"></span><span class="rec-time" data-role="recTime">0:00</span>
            <canvas class="rec-wave" data-role="recWave" aria-hidden="true"></canvas>
            <span class="rec-hint" data-role="recHint">Deslizá a la izquierda para cancelar</span>
            <button class="send-btn" type="button" data-act="recStop" aria-label="Enviar nota de voz">${icon('send')}</button>
          </div>
        </div>
        <p class="composer-note">AgentiCuántico puede equivocarse. Verificá la información importante. <a href="/legal/uso-aceptable.html">Uso responsable</a></p>
        <input type="file" data-role="file" multiple hidden accept=".pdf,.docx,.xlsx,.csv,.tsv,.txt,.md,.json,.js,.ts,.py,.html,.css,.sql,.xml,.yaml,.yml,text/*,image/*">
        <input type="file" data-role="cameraFallback" accept="image/*" capture="environment" hidden>
      </form>`;
    this.$ = (role) => r.querySelector(`[data-role="${role}"]`);
    this.renderLang();
    this.renderMode();
    this.renderEmpty();
    this.renderParticipants();
  }

  renderLang() {
    this.$('flag').src = flagUrl(this.lang);
    this.$('langShort').textContent = this.lang.short;
    this.$('greeting').textContent = this.lang.greeting;
    this.root.querySelector('[data-act="lang"]').setAttribute('aria-label', `Idioma: ${this.lang.name} (${this.lang.region})`);
  }
  renderMode() {
    const m = MODES[this.mode];
    this.root.querySelectorAll('.mode-chip').forEach((b) => {
      const on = b.dataset.mode === this.mode;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && b.parentElement.scrollWidth > b.parentElement.clientWidth) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    this.$('modeStrip').dataset.mode = this.mode;
    this.$('modeStrip').setAttribute('aria-label', 'Modo de respuesta: ' + m.label);
  }
  renderEmpty() {
    const box = this.$('suggestions');
    box.innerHTML = '';
    for (const s of SUGGESTIONS) {
      box.append(h('button', { class: 'suggestion', type: 'button', onclick: () => { if (s.mode) this.setMode(s.mode, true); this.send(s.t); } }, h('span', { html: icon(s.i) }), s.t));
    }
    this.syncEmpty();
  }
  syncEmpty() {
    const empty = !this.chat.messages.length;
    this.$('empty').hidden = !empty;
    this.$('thread').classList.toggle('is-empty', empty);
  }
  renderParticipants() {
    const box = this.$('participants');
    if (!box) return;
    box.innerHTML = '';
    for (const id of this.chat.agents) {
      const a = agentById(id, this.store.ws.customAgents);
      if (!a) continue;
      box.append(h('button', { class: 'participant', type: 'button', title: `${a.name} · tocá para quitar`, style: `--c:${a.color || '#888'}`, onclick: () => this.removeAgent(id) }, h('span', { class: 'p-badge' }, initials(a.name)), h('span', { class: 'p-name' }, a.name)));
    }
    box.hidden = !this.chat.agents.length;
  }
  updateStatus() {
    const st = this.$('status');
    st.textContent = this.busy ? (this.busy.label || 'Escribiendo…') : 'En línea';
    this.root.dataset.live = engine.state.live ? '1' : '0';
  }
  applyFlags() {
    const sys = this.system;
    if (!sys) return;
    this.root.querySelector('[data-act="mic"]').hidden = !this.flag('voice');
    this.root.querySelector('[data-act="handsfree"]').hidden = !this.flag('voice');
    if (!this.flag('chat') || sys.killSwitch) {
      this.$('input').disabled = true;
      this.$('input').placeholder = 'El chat está pausado momentáneamente.';
    }
  }

  /* =================== Eventos =================== */
  bind() {
    const r = this.root;
    this.bindModeStrip();
    const input = this.$('input');
    const form = this.$('form');
    r.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || !r.contains(b)) return;
      const act = b.dataset.act;
      const fn = this['act_' + act];
      if (fn) { e.preventDefault(); fn.call(this, b, e); }
    });
    // botones de código dentro de mensajes
    r.addEventListener('click', (e) => {
      const b = e.target.closest('[data-code-action]');
      if (!b) return;
      const code = r.querySelector('#' + CSS.escape(b.dataset.target));
      if (!code) return;
      if (b.dataset.codeAction === 'copy') navigator.clipboard.writeText(code.textContent).then(() => toast('Código copiado'));
      if (b.dataset.codeAction === 'canvas') this.openCanvas({ name: 'codigo.' + (b.closest('figure').dataset.lang || 'txt'), content: code.textContent, mime: b.closest('figure').dataset.lang === 'html' ? 'text/html' : 'text/plain' });
    });
    form.addEventListener('submit', (e) => { e.preventDefault(); this.submit(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !matchMedia('(pointer: coarse)').matches) { e.preventDefault(); this.submit(); }
    });
    let lastPulse = 0;
    input.addEventListener('input', () => {
      this.autosize();
      this.syncSend();
      const now = performance.now();
      if (this.avatar && now - lastPulse > 140) { lastPulse = now; this.avatar.pulse(Math.min(1, input.value.length / 120 + 0.3)); if (!this.busy) this.avatar.setState('listening'); }
      clearTimeout(this._idleT);
      this._idleT = setTimeout(() => { if (!this.busy && this.avatar && this.avatar.state === 'listening') this.avatar.setState('idle'); }, 1800);
      if (/(^|\s)@\w*$/.test(input.value)) this.act_invite(r.querySelector('[data-act="invite"]'), null, true);
    });
    input.addEventListener('paste', (e) => {
      const files = Array.from(e.clipboardData && e.clipboardData.files || []);
      if (files.length) { e.preventDefault(); this.addFiles(files); }
    });
    this.$('file').addEventListener('change', (e) => { this.addFiles(Array.from(e.target.files)); e.target.value = ''; });
    this.$('cameraFallback').addEventListener('change', (e) => { this.addFiles(Array.from(e.target.files)); e.target.value = ''; });
    // arrastrar y soltar
    r.addEventListener('dragover', (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) { e.preventDefault(); r.classList.add('dragging'); } });
    r.addEventListener('dragleave', (e) => { if (!r.contains(e.relatedTarget)) r.classList.remove('dragging'); });
    r.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) { e.preventDefault(); r.classList.remove('dragging'); this.addFiles(Array.from(e.dataTransfer.files)); } });
    // desplazamiento
    const thread = this.$('thread');
    thread.addEventListener('scroll', () => {
      const atBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 80;
      r.querySelector('[data-act="scrollDown"]').hidden = atBottom;
      this.stick = atBottom;
    }, { passive: true });
    this.stick = true;
    // grabación: deslizar para cancelar
    const rec = this.$('rec');
    let sx = null;
    rec.addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) sx = e.clientX; });
    rec.addEventListener('pointermove', (e) => { if (sx != null) { const dx = Math.min(0, e.clientX - sx); rec.style.transform = `translateX(${dx}px)`; if (dx < -90) { sx = null; rec.style.transform = ''; this.act_recCancel(); } } });
    rec.addEventListener('pointerup', () => { sx = null; rec.style.transform = ''; });
    rec.addEventListener('pointercancel', () => { sx = null; rec.style.transform = ''; });
  }

  autosize() {
    const t = this.$('input');
    t.style.height = 'auto';
    t.style.height = Math.min(t.scrollHeight, this.variant === 'full' ? 240 : 160) + 'px';
  }
  syncSend() {
    const has = this.$('input').value.trim().length > 0 || this.pendingFiles.length > 0;
    const busy = !!this.busy;
    this.$('send').hidden = !has || busy;
    this.root.querySelector('[data-act="handsfree"]').hidden = has || busy || !this.flag('voice');
    this.root.querySelector('[data-act="stop"]').hidden = !busy;
  }

  /* =================== Acciones de encabezado =================== */
  act_lang(btn) {
    popover(btn, [{ heading: 'Idioma y voz de la respuesta' }, ...LANGS.map((l) => ({
      label: l.name, sub: l.region, img: flagUrl(l), checked: l.id === this.lang.id,
      onClick: () => { this.lang = l; prefs.set('ac.lang', l.id); this.renderLang(); toast(`Te respondo en ${l.name} (${l.region}) con voz femenina.`); }
    }))], { align: 'end', className: 'lang-menu' });
  }
  act_incognito(btn) { this.setIncognito(!this.chat.incognito); btn.focus(); }
  setIncognito(on) {
    if (on && this.chat.messages.length && !this.chat.incognito) this.newChat(true);
    else this.chat.incognito = on;
    if (!on && this.chat.incognito) this.newChat(false);
    this.root.querySelector('[data-act="incognito"]').setAttribute('aria-pressed', String(!!this.chat.incognito));
    this.$('incognitoBar').hidden = !this.chat.incognito;
    this.root.classList.toggle('is-incognito', !!this.chat.incognito);
    if (on) toast('Chat incógnito activado: nada se guarda.');
  }
  act_more(btn) {
    const items = [
      { label: 'Nueva conversación', icon: 'edit', onClick: () => this.newChat() },
      { label: 'Centro de control', sub: 'Agentes, herramientas, memoria…', icon: 'settings', onClick: () => this.openHub() },
      { label: this.chat.incognito ? 'Salir de incógnito' : 'Chat incógnito', icon: 'ghost', onClick: () => this.setIncognito(!this.chat.incognito) },
      'sep',
      { label: 'Compartir (solo lectura)', icon: 'share', onClick: () => this.shareChat(), disabled: !this.chat.messages.length },
      { label: 'Exportar Markdown', icon: 'download', onClick: () => this.exportMd(), disabled: !this.chat.messages.length },
      { label: 'Exportar PDF', icon: 'print', onClick: () => this.exportPdf(), disabled: !this.chat.messages.length },
      'sep',
      { label: 'Atajos de teclado', icon: 'keyboard', onClick: () => this.showShortcuts() },
      { label: document.documentElement.dataset.theme === 'dark' ? 'Tema claro' : 'Tema oscuro', icon: document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', onClick: () => document.querySelector('[data-theme-toggle]')?.click() || toggleTheme() }
    ];
    if (this.variant === 'embed') items.splice(2, 0, { label: 'Abrir app completa', icon: 'expand', onClick: () => { location.href = '/app/'; } });
    popover(btn, items, { align: 'end' });
  }
  act_scrollDown() { this.scrollToEnd(true); }
  act_sidebar() { this.root.dispatchEvent(new CustomEvent('chat:sidebar', { bubbles: true })); }

  /* =================== Composer =================== */
  act_plus(btn) {
    popover(btn, [
      { label: 'Subir archivo', sub: 'PDF, Word, Excel, CSV, texto o imagen', icon: 'paperclip', onClick: () => this.$('file').click() },
      { label: 'Abrir cámara', sub: 'Foto o escaneo de documento', icon: 'camera', onClick: () => this.openCamera() },
      'sep',
      { label: 'Herramientas', icon: 'tools', onClick: () => this.openHub('herramientas') },
      { label: 'Habilidades', icon: 'spark', onClick: () => this.openHub('habilidades') },
      { label: 'Conectores', icon: 'plug', onClick: () => this.openHub('conectores') },
      { label: 'Automatizaciones', icon: 'clock', onClick: () => this.openHub('automatizaciones') },
      { label: 'Memoria', icon: 'memory', onClick: () => this.openHub('memoria') }
    ], { place: 'top' });
  }
  act_setmode(btn) { this.setMode(btn.dataset.mode, true); }
  /** Bordes difuminados del selector de modos cuando hay más opciones a los costados. */
  bindModeStrip() {
    const strip = this.$('modeStrip'), wrap = this.$('modeWrap');
    if (!strip || !wrap) return;
    const upd = () => {
      wrap.classList.toggle('fade-l', strip.scrollLeft > 2);
      wrap.classList.toggle('fade-r', strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 2);
    };
    strip.addEventListener('scroll', upd, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(upd).observe(strip);
    strip.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const ids = Object.keys(MODES); const i = ids.indexOf(this.mode);
      const next = ids[(i + (e.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length];
      e.preventDefault(); this.setMode(next, true);
      strip.querySelector(`[data-mode="${next}"]`)?.focus();
    });
    upd();
  }
  act_mode(btn) {
    popover(btn, Object.entries(MODES).map(([id, m]) => ({
      label: m.label, sub: m.desc, icon: m.icon, checked: id === this.mode, badge: m.flagship ? 'Insignia' : null, badgeClass: 'gold',
      onClick: () => this.setMode(id)
    })), { place: 'top' });
  }
  setMode(m, silent) {
    if (m === 'auto' && !this.flag('agentMode')) { toast('El modo agente está pausado momentáneamente.'); return; }
    this.mode = m; this.renderMode();
    if (!silent) this.$('input').focus();
  }
  act_invite(btn, e, fromMention = false) {
    if (!this.isPaid) { if (!fromMention) this.paywall('Los agentes invitables'); return; }
    const all = [...AGENTS, ...(this.store.ws.customAgents || [])];
    popover(btn, [{ heading: 'Invitar especialista a la conversación' }, ...all.map((a) => ({
      label: a.name, sub: a.role, icon: a.icon || 'user', checked: this.chat.agents.includes(a.id),
      onClick: () => {
        if (fromMention) { const inp = this.$('input'); inp.value = inp.value.replace(/@\w*$/, '@' + a.name.split(' ')[0] + ' '); inp.focus(); }
        this.toggleAgent(a.id);
      }
    })), 'sep', { label: 'Crear agente propio…', icon: 'plus', onClick: () => this.openHub('agentes') }], { place: 'top' });
  }
  toggleAgent(id) {
    if (this.chat.agents.includes(id)) return this.removeAgent(id);
    this.chat.agents.push(id);
    const a = agentById(id, this.store.ws.customAgents);
    this.addNotice(`${a.name} se sumó a la conversación.`);
    this.renderParticipants();
    this.persist();
  }
  removeAgent(id) {
    const a = agentById(id, this.store.ws.customAgents);
    this.chat.agents = this.chat.agents.filter((x) => x !== id);
    if (a) this.addNotice(`${a.name} salió de la conversación.`);
    this.renderParticipants();
    this.persist();
  }
  act_stop() {
    if (this.busy && this.busy.ctrl) this.busy.ctrl.abort();
    stopSpeech();
    this.handsFree = false;
    this.root.classList.remove('hands-free');
  }

  /* =================== Archivos y cámara =================== */
  async addFiles(files) {
    const box = this.$('files');
    for (const f of files.slice(0, 6)) {
      const chip = h('div', { class: 'file-chip loading' }, h('span', { class: 'fc-icon', html: icon(f.type.startsWith('image/') ? 'image' : 'file') }), h('span', { class: 'fc-name' }, f.name), h('small', {}, 'Leyendo…'));
      box.append(chip); box.hidden = false;
      const doc = await readFile(f, (p) => { chip.querySelector('small').textContent = `Leyendo… ${Math.round(p * 100)}%`; });
      chip.classList.remove('loading');
      if (doc.url) { const im = h('img', { src: doc.url, alt: '', class: 'fc-thumb' }); chip.querySelector('.fc-icon').replaceWith(im); }
      chip.querySelector('small').textContent = doc.error || `${fmtSize(doc.size)}${doc.pages ? ' · ' + doc.pages + ' pág.' : ''}${doc.table ? ' · ' + doc.table.length + ' filas' : ''}`;
      if (doc.error) chip.classList.add('error');
      const rm = h('button', { class: 'icon-btn sm', type: 'button', 'aria-label': 'Quitar ' + f.name, html: icon('close'), onclick: () => { this.pendingFiles = this.pendingFiles.filter((d) => d !== doc); chip.remove(); box.hidden = !this.pendingFiles.length; this.syncSend(); } });
      chip.append(rm);
      if (!doc.error) this.pendingFiles.push(doc);
    }
    this.syncSend();
  }

  async openCamera() {
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { this.$('cameraFallback').click(); return; }
    let stream;
    let facing = 'environment';
    const video = h('video', { class: 'cam-video', playsinline: true, autoplay: true, muted: true });
    const body = h('div', { class: 'cam' }, video, h('p', { class: 'muted small cam-hint' }, 'Encuadrá el documento con buena luz. La foto se adjunta al chat; no se sube a ningún lado hasta que envíes.'));
    const start = async () => {
      stream && stream.getTracks().forEach((t) => t.stop());
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      video.srcObject = stream;
    };
    const m = modal({
      title: 'Cámara', body, wide: true,
      actions: [
        { label: 'Cambiar cámara', class: 'btn-ghost', onClick: async () => { facing = facing === 'environment' ? 'user' : 'environment'; try { await start(); } catch {} return false; } },
        { label: 'Sacar foto', class: 'btn-primary', onClick: async () => {
          const c = document.createElement('canvas');
          c.width = video.videoWidth || 1280; c.height = video.videoHeight || 720;
          const g = c.getContext('2d'); g.drawImage(video, 0, 0, c.width, c.height);
          const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.9));
          if (blob) this.addFiles([new File([blob], `foto-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`, { type: 'image/jpeg' })]);
        } }
      ]
    });
    m.done.then(() => stream && stream.getTracks().forEach((t) => t.stop()));
    try { await start(); } catch (e) {
      const denied = e && e.name === 'NotAllowedError';
      body.innerHTML = `<div class="alert warn">${icon('warn')}<div><strong>${denied ? 'No tenemos permiso para usar la cámara.' : 'No encontramos una cámara disponible.'}</strong><br>${denied ? 'Habilitala desde el candado de la barra de direcciones y volvé a intentar.' : 'Podés elegir una foto desde tu galería.'}</div></div>`;
      body.append(h('button', { class: 'btn', type: 'button', style: 'margin-top:12px', onclick: () => { m.close(); this.$('cameraFallback').click(); } }, 'Elegir foto'));
    }
  }

  /* =================== Voz: notas de voz =================== */
  async act_mic() {
    if (this.recorder) return;
    if (!this.flag('voice')) { toast('La voz está pausada momentáneamente.'); return; }
    if (!VoiceRecorder.supported()) { this.addNotice('Este navegador no permite grabar audio. Probá con Chrome, Edge o Safari actualizados.', 'warn'); return; }
    stopSpeech();
    const rec = new VoiceRecorder({
      lang: this.lang.id,
      autoStop: this.handsFree,
      onLevel: (lv) => this.drawLevel(lv),
      onTick: (ms) => { this.$('recTime').textContent = fmtClock(ms / 1000); },
      onTranscript: (t) => { this.$('recHint').textContent = t ? '“' + t.slice(-60) + '”' : 'Escuchando…'; }
    });
    this.recorder = rec;
    this.levels = [];
    try {
      await rec.start();
    } catch (e) {
      this.recorder = null;
      if (e.code === 'denied') this.addNotice('No tengo permiso para usar el micrófono. Habilitalo desde el candado de la barra de direcciones y volvé a tocar el micrófono.', 'warn');
      else if (e.code === 'nomic') this.addNotice('No encontré un micrófono en este dispositivo.', 'warn');
      else this.addNotice('No pude iniciar la grabación. Probá de nuevo.', 'warn');
      this.handsFree = false; this.root.classList.remove('hands-free');
      return;
    }
    this.$('rec').hidden = false;
    this.root.classList.add('recording-on');
    this.$('recHint').textContent = VoiceRecorder.speechSupported() ? 'Escuchando… deslizá a la izquierda para cancelar' : 'Grabando… deslizá a la izquierda para cancelar';
    this.avatar && this.avatar.setState('listening');
    // corte automático por silencio (manos libres) → enviar
    const watch = setInterval(() => { if (rec.state === 'stopping' || rec.state === 'done') { clearInterval(watch); if (this.recorder === rec) this.act_recStop(); } if (rec.state === 'cancelled') clearInterval(watch); }, 120);
  }
  drawLevel(lv) {
    const c = this.$('recWave');
    if (!c) return;
    const w = c.clientWidth, hgt = c.clientHeight;
    if (!w) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (c.width !== w * dpr) { c.width = w * dpr; c.height = hgt * dpr; }
    this.levels.push(lv);
    const bars = Math.floor(w / 5);
    if (this.levels.length > bars) this.levels.splice(0, this.levels.length - bars);
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, hgt);
    g.fillStyle = getComputedStyle(this.root).getPropertyValue('--wave') || '#16151a';
    this.levels.forEach((v, i) => { const bh = Math.max(3, v * hgt); g.beginPath(); g.roundRect ? g.roundRect(w - (this.levels.length - i) * 5, (hgt - bh) / 2, 3, bh, 1.5) : g.rect(w - (this.levels.length - i) * 5, (hgt - bh) / 2, 3, bh); g.fill(); });
  }
  act_recCancel() {
    if (!this.recorder) return;
    this.recorder.cancel();
    this.recorder = null;
    this.$('rec').hidden = true;
    this.root.classList.remove('recording-on');
    this.handsFree = false; this.root.classList.remove('hands-free');
    this.avatar && this.avatar.setState('idle');
    toast('Grabación descartada');
  }
  async act_recStop() {
    const rec = this.recorder;
    if (!rec) return;
    this.recorder = null;
    const res = await rec.stop();
    this.$('rec').hidden = true;
    this.root.classList.remove('recording-on');
    if (!res || res.duration < 0.6) { this.avatar && this.avatar.setState('idle'); if (this.handsFree) this.act_mic(); return; }
    this.sendVoice(res);
  }
  act_handsfree() {
    this.handsFree = !this.handsFree;
    this.root.classList.toggle('hands-free', this.handsFree);
    if (this.handsFree) { toast('Conversación por voz: hablá y te respondo. Tocá ■ para terminar.'); this.act_mic(); }
    else { this.act_recCancel(); stopSpeech(); }
  }

  async sendVoice(res) {
    const msg = { id: uid('m'), role: 'user', kind: 'voice', at: Date.now(), content: '', voice: { url: res.url, duration: res.duration, peaks: res.peaks, transcript: res.transcript } };
    this.pushMessage(msg);
    // transcripción del servidor si está disponible (más precisa)
    const server = await engine.transcribe(res.blob, this.lang.code);
    if (server) msg.voice.transcript = server;
    msg.content = msg.voice.transcript;
    this.updateMessage(msg);
    if (!msg.content) {
      const text = VoiceRecorder.speechSupported()
        ? 'Recibí tu nota de voz, pero no llegué a entender las palabras. ¿Me lo repetís un poco más cerca del micrófono?'
        : 'Recibí tu nota de voz. Este navegador todavía no me deja transcribirla; cuando se active la transcripción del servidor la voy a entender. Mientras tanto, ¿me lo escribís?';
      const a = { id: uid('m'), role: 'assistant', content: text, at: Date.now() };
      this.pushMessage(a);
      this.persist();
      await this.say(text);
      if (this.handsFree) this.act_mic();
      return;
    }
    await this.respond(msg, { voice: true });
  }

  /* =================== Envío =================== */
  submit() {
    if (this.busy) return;
    const text = this.$('input').value.trim();
    if (!text && !this.pendingFiles.length) return;
    this.send(text || 'Analizá estos archivos');
  }
  async send(text) {
    if (this.busy) return;
    if (this.system && (!this.flag('chat') || this.system.killSwitch)) { toast('El chat está pausado momentáneamente.'); return; }
    const input = this.$('input');
    input.value = ''; this.autosize();
    const files = this.pendingFiles.splice(0);
    this.$('files').innerHTML = ''; this.$('files').hidden = true;
    const msg = { id: uid('m'), role: 'user', kind: 'text', content: text, at: Date.now(), attachments: files.map((f) => ({ name: f.name, kind: f.kind, size: f.size, url: f.url })) };
    msg._docs = files;
    this.pushMessage(msg);
    this.syncSend();
    // Acciones en la web (iniciar sesión, enviar correos, postular, formularios): tarjeta del navegador del agente.
    if (needsWebAction(text)) {
      this.browserCard = new AgentBrowserCard({ thread: this.$('inner'), composer: this.$('form'), text, isPaid: this.isPaid, idToken: this.user ? () => this.user.getIdToken() : null, onScroll: () => this.scrollToEnd(true) });
    }
    // "Recordá que…" → memoria explícita
    const mem = /^(record[aá]|acordate|guard[aá] en (tu )?memoria)( que)?\s+(.{4,300})$/i.exec(text);
    if (mem && !this.chat.incognito && this.store.ws.memoryOn) {
      this.store.ws.memory.push({ id: uid('mem'), text: mem[4].trim(), at: Date.now() });
      this.store.saveWorkspace();
    }
    await this.respond(msg, { voice: false });
  }

  /** Arma el contexto (instrucciones, habilidades, memoria) para el modelo. */
  systemContext() {
    const ws = this.store.ws;
    const parts = [];
    if (ws.instructions) parts.push('Instrucciones del usuario: ' + ws.instructions.slice(0, 1500));
    const skills = SKILLS.filter((s) => (ws.skills || []).includes(s.id));
    if (skills.length) parts.push('Habilidades activas: ' + skills.map((s) => `${s.name} (${s.desc})`).join('; '));
    if (ws.memoryOn && !this.chat.incognito && ws.memory.length) parts.push('Memoria del usuario: ' + ws.memory.slice(-30).map((m) => '- ' + m.text).join('\n'));
    parts.push(`Idioma de respuesta: ${this.lang.name} (${this.lang.region}).`);
    return parts.join('\n\n');
  }

  history() {
    return this.chat.messages.filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content).slice(-24).map((m) => ({ role: m.role, content: (m.agent ? `[${m.agent.name}] ` : '') + m.content + (m._docs && m._docs.length ? '\n\n' + m._docs.filter((d) => d.text).map((d) => `[Documento ${d.name}]\n${d.text.slice(0, 20000)}`).join('\n\n') : '') }));
  }

  mentionedAgents(text) {
    const all = [...AGENTS, ...(this.store.ws.customAgents || [])];
    const out = [];
    for (const m of String(text).matchAll(/@([\wáéíóúñ]+)/gi)) {
      const a = all.find((x) => x.name.toLowerCase().startsWith(m[1].toLowerCase()) || x.id.startsWith(m[1].toLowerCase()));
      if (a && !out.includes(a)) out.push(a);
    }
    return out;
  }

  async respond(userMsg, { voice }) {
    const ctrl = new AbortController();
    this.busy = { ctrl, label: this.mode === 'auto' ? 'Trabajando…' : this.mode === 'deep' ? 'Pensando…' : 'Escribiendo…' };
    this.updateStatus(); this.syncSend();
    this.avatar && (this.avatar.pulse(1), this.avatar.setState('thinking'));
    const mentioned = this.mentionedAgents(userMsg.content);
    if (mentioned.length && !this.isPaid) { this.finish(); this.paywall('Mencionar agentes especialistas'); return; }
    for (const a of mentioned) if (!this.chat.agents.includes(a.id)) { this.chat.agents.push(a.id); this.renderParticipants(); }
    const invited = this.isPaid ? this.chat.agents.map((id) => agentById(id, this.store.ws.customAgents)).filter(Boolean) : [];
    const docs = this.chat.messages.flatMap((m) => m._docs || []);
    let finalText = '';
    try {
      // Pedidos de acción en la web sin navegador en la nube: respuesta honesta (guía), sin pasos simulados.
      const webOnly = needsWebAction(userMsg.content) && !(engine.state.live && engine.state.caps && engine.state.caps.browser);
      if (this.mode === 'auto' && !webOnly) {
        finalText = await this.runAuto(userMsg, invited, docs, ctrl);
      } else {
        const onlyAgents = mentioned.length && userMsg.content.trim().startsWith('@');
        if (!onlyAgents) {
          const a = { id: uid('m'), role: 'assistant', content: '', at: Date.now(), streaming: true };
          this.pushMessage(a);
          const r = await engine.chat({ messages: this.history(), lang: this.lang.code, mode: this.mode, system: this.systemContext(), docs, signal: ctrl.signal, onDelta: (d) => { a.content += d; this.updateMessage(a); } });
          a.streaming = false; a.content = r.text; if (r.notice) a.notice = r.notice;
          this.updateMessage(a);
          finalText = r.text;
        }
        const responders = mentioned.length ? mentioned : invited;
        for (const ag of responders) {
          const m = { id: uid('m'), role: 'assistant', content: '', at: Date.now(), streaming: true, agent: { id: ag.id, name: ag.name, color: ag.color } };
          this.pushMessage(m);
          const r = await engine.chat({ messages: this.history(), lang: this.lang.code, mode: this.mode, agent: ag, system: this.systemContext(), signal: ctrl.signal, onDelta: (d) => { m.content += d; this.updateMessage(m); } });
          m.streaming = false; m.content = r.text; this.updateMessage(m);
          finalText = finalText || r.text;
        }
      }
      if (this.chat.title === 'Nueva conversación') this.chat.title = (userMsg.content || 'Nota de voz').replace(/\s+/g, ' ').slice(0, 60);
      this.persist();
    } catch (e) {
      if (e.name !== 'AbortError') { console.error(e); this.addNotice('Algo falló al responder. Probá de nuevo.', 'warn'); }
      else this.chat.messages.filter((m) => m.streaming).forEach((m) => { m.streaming = false; m.content += m.content ? '\n\n_(detenido)_' : '_(detenido)_'; this.updateMessage(m); });
    }
    this.finish();
    if (voice && finalText && !ctrl.signal.aborted) {
      await this.say(finalText);
      if (this.handsFree) this.act_mic();
    }
  }
  finish() {
    this.busy = null;
    this.updateStatus(); this.syncSend();
    this.avatar && this.avatar.setState('idle');
  }

  async say(text) {
    if (!this.flag('voice')) return;
    const av = this.avatar;
    av && av.setState('thinking');
    await speak(text, {
      lang: this.lang.id,
      onStart: () => av && av.setState('talking'),
      onViseme: (v) => av && av.setVisemes(v),
      onEnd: () => { av && (av.setVisemes(null), av.setState('idle')); }
    });
  }

  async runAuto(userMsg, agents, docs, ctrl) {
    const a = { id: uid('m'), role: 'assistant', content: '', at: Date.now(), streaming: true, steps: [], logs: {}, artifacts: [], auto: true };
    this.pushMessage(a);
    await engine.autoRun({
      task: userMsg.content, lang: this.lang.code, agents, docs, signal: ctrl.signal,
      confirm: (q) => this.inlineConfirm(a, q),
      onEvent: (ev) => {
        if (ev.type === 'plan') a.steps = ev.steps.map((s) => ({ ...s, status: 'pending' }));
        else if (ev.type === 'step') { const s = a.steps.find((x) => x.id === ev.id); if (s) s.status = ev.status; else a.steps.push({ id: ev.id, title: ev.title, phase: ev.phase, status: ev.status }); this.busy && (this.busy.label = ev.title + '…', this.updateStatus()); this.avatar && this.avatar.pulse(0.4); }
        else if (ev.type === 'log') { (a.logs[ev.id] = a.logs[ev.id] || []).push(ev.text); }
        else if (ev.type === 'agent') { (a.logs[ev.id] = a.logs[ev.id] || []).push(`${ev.agent.name}: listo.`); this.pushMessage({ id: uid('m'), role: 'assistant', content: ev.text, at: Date.now(), agent: ev.agent }); }
        else if (ev.type === 'artifact') a.artifacts.push({ name: ev.name, mime: ev.mime, content: ev.content });
        else if (typeof ev.delta === 'string') a.content += ev.delta;
        else if (ev.type === 'error') a.content += '\n\n' + (ev.message || 'Hubo un error en un paso.');
        this.updateMessage(a);
      }
    });
    a.streaming = false;
    this.updateMessage(a);
    // mantener el mensaje principal al final
    const idx = this.chat.messages.indexOf(a);
    if (idx > -1 && idx !== this.chat.messages.length - 1) { this.chat.messages.splice(idx, 1); this.chat.messages.push(a); this.$('inner').append(this.msgEl(a)); }
    return a.content;
  }

  inlineConfirm(msg, question) {
    return new Promise((resolve) => {
      const el = this.root.querySelector(`[data-msg="${msg.id}"] .msg-body`);
      const card = h('div', { class: 'confirm-card', role: 'group', 'aria-label': 'Confirmación requerida' },
        h('p', {}, h('strong', {}, 'Necesito tu confirmación. '), question),
        h('div', { class: 'row' },
          h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: () => { card.remove(); resolve(true); } }, 'Sí, continuar'),
          h('button', { class: 'btn btn-sm', type: 'button', onclick: () => { card.remove(); resolve(false); } }, 'No, solo el borrador')));
      (el || this.$('inner')).append(card);
      this.avatar && this.avatar.setState('listening');
      this.scrollToEnd();
    });
  }

  /* =================== Mensajes =================== */
  pushMessage(m) {
    this.chat.messages.push(m);
    this.$('inner').append(this.msgEl(m));
    this.syncEmpty();
    this.scrollToEnd(m.role === 'user');
  }
  updateMessage(m) {
    const old = this.root.querySelector(`[data-msg="${m.id}"]`);
    const el = this.msgEl(m);
    if (old) old.replaceWith(el); else this.$('inner').append(el);
    this.scrollToEnd();
  }
  addNotice(text, type = '') {
    const m = { id: uid('n'), role: 'notice', content: text, type, at: Date.now() };
    this.chat.messages.push(m);
    this.$('inner').append(this.msgEl(m));
    this.syncEmpty();
    this.scrollToEnd();
  }
  scrollToEnd(force) {
    const t = this.$('thread');
    if (force || this.stick) requestAnimationFrame(() => { t.scrollTop = t.scrollHeight; });
  }

  msgEl(m) {
    if (m.role === 'notice') return h('div', { class: 'msg-notice ' + (m.type || ''), 'data-msg': m.id }, m.content);
    if (m.role === 'user') {
      const el = h('div', { class: 'msg user', 'data-msg': m.id });
      if (m.kind === 'voice') el.append(this.voiceBubble(m));
      else el.append(h('div', { class: 'bubble' }, m.content));
      if (m.attachments && m.attachments.length) {
        el.append(h('div', { class: 'msg-files' }, ...m.attachments.map((a) => a.url ? h('img', { src: a.url, alt: a.name, class: 'msg-thumb' }) : h('span', { class: 'chip' }, h('span', { html: icon('file') }), a.name))));
      }
      return el;
    }
    const ag = m.agent;
    const el = h('div', { class: 'msg assistant' + (m.streaming ? ' streaming' : '') + (ag ? ' by-agent' : ''), 'data-msg': m.id, style: ag ? `--c:${ag.color}` : null });
    const who = ag
      ? h('div', { class: 'msg-who' }, h('span', { class: 'p-badge' }, initials(ag.name)), h('strong', {}, ag.name), h('span', { class: 'chip' }, 'agente'))
      : h('div', { class: 'msg-who' }, h('img', { src: '/media/agenticuantico-avatar.jpg', alt: '', width: 24, height: 24 }), h('strong', {}, 'AgentiCuántico'));
    const body = h('div', { class: 'msg-body' });
    if (m.steps && m.steps.length) body.append(this.timeline(m));
    const md = h('div', { class: 'md' });
    md.innerHTML = m.content ? renderMarkdown(m.content) : (m.streaming && !(m.steps && m.steps.length) ? '<span class="typing" aria-label="Escribiendo"><i></i><i></i><i></i></span>' : '');
    body.append(md);
    for (const art of m.artifacts || []) body.append(this.artifactCard(art));
    if (m.notice === 'login') body.append(h('div', { class: 'alert info' }, 'Iniciá sesión para seguir con el modelo completo. ', h('a', { href: '/cuenta/' }, 'Ingresar')));
    if (m.notice === 'upgrade' || m.notice === 'quota') body.append(h('div', { class: 'alert info' }, 'Llegaste al límite de tu plan por hoy. ', h('a', { href: '/planes.html' }, 'Ver planes')));
    el.append(who, body);
    if (!m.streaming && m.content) {
      el.append(h('div', { class: 'msg-actions' },
        h('button', { class: 'icon-btn sm', type: 'button', 'aria-label': 'Copiar respuesta', title: 'Copiar', html: icon('copy'), onclick: () => navigator.clipboard.writeText(m.content).then(() => toast('Copiado')) }),
        h('button', { class: 'icon-btn sm', type: 'button', 'aria-label': 'Escuchar respuesta', title: 'Escuchar', html: icon('speaker'), onclick: () => this.say(m.content) })));
    }
    return el;
  }

  voiceBubble(m) {
    const v = m.voice || {};
    const bars = (v.peaks && v.peaks.length ? v.peaks : Array(40).fill(0.2));
    const wave = h('span', { class: 'vb-wave', 'aria-hidden': 'true' }, ...bars.map((p) => h('i', { style: `height:${Math.round(12 + p * 88)}%` })));
    const play = h('button', { class: 'vb-play', type: 'button', 'aria-label': 'Reproducir nota de voz', html: icon('play'), disabled: v.url ? null : true });
    const time = h('span', { class: 'vb-time' }, fmtClock(v.duration || 0));
    const bubble = h('div', { class: 'bubble voice' }, h('div', { class: 'vb-row' }, play, wave, time));
    if (v.url) {
      let audio;
      play.addEventListener('click', () => {
        if (!audio) {
          audio = new Audio(v.url);
          audio.addEventListener('timeupdate', () => {
            const p = audio.currentTime / (audio.duration && isFinite(audio.duration) ? audio.duration : v.duration || 1);
            wave.querySelectorAll('i').forEach((b, i, all) => b.classList.toggle('on', i / all.length <= p));
            time.textContent = fmtClock(audio.currentTime);
          });
          audio.addEventListener('ended', () => { play.innerHTML = icon('play'); time.textContent = fmtClock(v.duration || 0); wave.querySelectorAll('i').forEach((b) => b.classList.remove('on')); });
        }
        if (audio.paused) { audio.play(); play.innerHTML = icon('pause'); play.setAttribute('aria-label', 'Pausar'); }
        else { audio.pause(); play.innerHTML = icon('play'); play.setAttribute('aria-label', 'Reproducir nota de voz'); }
      });
    }
    const tr = v.transcript;
    const det = h('details', { class: 'vb-transcript' }, h('summary', {}, tr ? 'Transcripción' : 'Sin transcripción'), h('p', {}, tr || 'No se pudo transcribir el audio en este navegador.'));
    if (tr && tr.length < 140) det.open = true;
    bubble.append(det);
    return bubble;
  }

  timeline(m) {
    const done = m.steps.filter((s) => s.status === 'done').length;
    const wrap = h('div', { class: 'timeline' });
    const head = h('div', { class: 'tl-head' }, h('span', { html: icon('spark') }), h('strong', {}, 'Hace todo por vos'), h('span', { class: 'tl-count' }, `${done}/${m.steps.length} pasos`));
    const prog = h('div', { class: 'tl-progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': m.steps.length, 'aria-valuenow': done }, h('i', { style: `width:${(done / m.steps.length) * 100}%` }));
    const list = h('ol', { class: 'tl-list' });
    for (const s of m.steps) {
      const logs = (m.logs && m.logs[s.id]) || [];
      const li = h('li', { class: 'tl-step ' + s.status, 'data-phase': s.phase },
        h('span', { class: 'tl-dot', html: s.status === 'done' ? icon('check') : '' }),
        h('span', { class: 'tl-title' }, s.title));
      if (logs.length) li.append(h('details', { class: 'tl-log' }, h('summary', {}, 'Ver detalle'), h('pre', {}, logs.join('\n'))));
      list.append(li);
    }
    const computer = h('details', { class: 'vm' }, h('summary', {}, h('span', { html: icon('monitor') }), 'Computadora del agente'),
      h('pre', { class: 'vm-screen' }, ['$ agente --plan', ...m.steps.map((s) => `${s.status === 'done' ? '✔' : s.status === 'running' ? '…' : '·'} ${s.title}`), ...Object.values(m.logs || {}).flat().slice(-6).map((l) => '  ' + String(l).split('\n')[0])].join('\n')));
    if (m.streaming) computer.open = this.variant === 'full';
    wrap.append(head, prog, list, computer);
    return wrap;
  }

  artifactCard(art) {
    return h('div', { class: 'artifact' },
      h('span', { class: 'artifact-icon', html: icon(art.mime === 'text/html' ? 'globe' : art.mime === 'text/markdown' ? 'file' : 'code') }),
      h('span', { class: 'artifact-meta' }, h('strong', {}, art.name), h('small', {}, `${(art.content.length / 1024).toFixed(1)} KB`)),
      h('button', { class: 'btn btn-sm', type: 'button', onclick: () => this.openCanvas(art) }, 'Abrir en lienzo'),
      h('button', { class: 'icon-btn sm', type: 'button', 'aria-label': 'Descargar ' + art.name, html: icon('download'), onclick: () => download(art.name, art.content, art.mime) }));
  }

  /* =================== Lienzo (código / documentos con vista previa aislada) =================== */
  openCanvas(art) {
    const isHtml = art.mime === 'text/html' || /\.html?$/.test(art.name);
    const ta = h('textarea', { class: 'canvas-code', spellcheck: 'false', 'aria-label': 'Contenido editable' });
    ta.value = art.content;
    const frame = h('iframe', { class: 'canvas-frame', title: 'Vista previa aislada', sandbox: 'allow-scripts allow-modals', src: '/app/preview.html', referrerpolicy: 'no-referrer' });
    const preview = h('div', { class: 'canvas-preview' }, frame);
    const tabs = h('div', { class: 'canvas-tabs', role: 'tablist' });
    const setTab = (t) => { tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t))); ta.hidden = t !== 'code'; preview.hidden = t !== 'preview'; if (t === 'preview') send(); };
    const send = () => frame.contentWindow && frame.contentWindow.postMessage({ type: 'ac-preview', html: isHtml ? ta.value : `<pre style="white-space:pre-wrap;font:14px/1.5 ui-monospace,monospace;padding:16px">${esc(ta.value)}</pre>` }, '*');
    frame.addEventListener('load', send);
    tabs.append(h('button', { type: 'button', role: 'tab', 'data-tab': 'code', onclick: () => setTab('code') }, 'Código'), h('button', { type: 'button', role: 'tab', 'data-tab': 'preview', onclick: () => setTab('preview') }, 'Vista previa'));
    const body = h('div', { class: 'canvas' }, tabs, ta, preview);
    modal({
      title: art.name, body, wide: true, label: 'Lienzo',
      actions: [
        { label: 'Copiar', class: 'btn-ghost', onClick: () => { navigator.clipboard.writeText(ta.value); toast('Copiado'); return false; } },
        { label: 'Descargar', class: 'btn-primary', onClick: () => { download(art.name, ta.value, art.mime || 'text/plain'); return false; } }
      ]
    });
    setTab(isHtml ? 'preview' : 'code');
  }

  /* =================== Conversaciones =================== */
  newChat(incognito = false) {
    stopSpeech();
    if (this.busy) this.act_stop();
    this.chat = this.newChatObject(incognito);
    this.$('inner').innerHTML = '';
    this.renderParticipants();
    this.syncEmpty();
    this.root.querySelector('[data-act="incognito"]').setAttribute('aria-pressed', String(incognito));
    this.$('incognitoBar').hidden = !incognito;
    this.root.classList.toggle('is-incognito', incognito);
    this.root.dispatchEvent(new CustomEvent('chat:changed', { bubbles: true, detail: this.chat }));
    this.$('input').focus({ preventScroll: true });
  }
  loadChat(c) {
    stopSpeech();
    this.chat = c;
    this.$('inner').innerHTML = '';
    for (const m of c.messages) this.$('inner').append(this.msgEl(m));
    this.renderParticipants();
    this.syncEmpty();
    this.setIncognito(false);
    this.scrollToEnd(true);
    this.root.dispatchEvent(new CustomEvent('chat:changed', { bubbles: true, detail: this.chat }));
  }
  persist() {
    if (this.chat.incognito || !this.chat.messages.some((m) => m.role === 'user')) return;
    this.store.save(this.chat);
    this.root.dispatchEvent(new CustomEvent('chat:changed', { bubbles: true, detail: this.chat }));
  }

  async shareChat() {
    if (this.chat.incognito) { toast('Los chats incógnito no se pueden compartir.'); return; }
    if (!this.user) { this.loginPrompt('Para compartir un chat necesitás una cuenta.'); return; }
    try {
      const url = await this.store.share(this.chat, this.user);
      const input = h('input', { class: 'input', readonly: true, value: url, 'aria-label': 'Enlace para compartir' });
      modal({ title: 'Enlace de solo lectura', body: h('div', {}, h('p', { class: 'muted' }, 'Cualquiera con el enlace puede ver esta conversación (sin poder escribir). Podés dejar de compartirla cuando quieras.'), input), actions: [
        { label: 'Dejar de compartir', class: 'btn-danger-ghost', onClick: async () => { await this.store.unshare(this.chat); toast('Enlace desactivado'); } },
        { label: 'Copiar enlace', class: 'btn-primary', onClick: () => { navigator.clipboard.writeText(url); toast('Enlace copiado'); return false; } }
      ] });
    } catch (e) {
      console.warn(e);
      toast('No se pudo crear el enlace todavía: el almacenamiento compartido se está habilitando.', 'error');
    }
  }
  exportMd() {
    const lines = [`# ${this.chat.title}`, '', `_Exportado de AgentiCuántico · ${new Date().toLocaleString('es-AR')}_`, ''];
    for (const m of this.chat.messages) {
      if (m.role === 'notice') continue;
      const who = m.role === 'user' ? 'Vos' : m.agent ? m.agent.name : 'AgentiCuántico';
      lines.push(`**${who}:**`, '', m.kind === 'voice' ? `🎙️ _Nota de voz_ — ${m.voice?.transcript || ''}` : m.content, '');
    }
    download(slug(this.chat.title) + '.md', lines.join('\n'), 'text/markdown');
  }
  exportPdf() {
    document.body.classList.add('print-chat');
    this.root.classList.add('print-target');
    const done = () => { document.body.classList.remove('print-chat'); this.root.classList.remove('print-target'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => { window.print(); setTimeout(done, 1500); }, 50);
  }
  showShortcuts() {
    const rows = [['Ctrl + Shift + O', 'Nueva conversación'], ['Ctrl + K', 'Buscar conversaciones'], ['Ctrl + Shift + I', 'Chat incógnito'], ['Ctrl + Shift + E', 'Exportar Markdown'], ['Ctrl + /', 'Ver atajos'], ['Enter', 'Enviar'], ['Shift + Enter', 'Nueva línea'], ['Esc', 'Detener respuesta o grabación']];
    modal({ title: 'Atajos de teclado', body: '<div class="table-wrap"><table class="table"><tbody>' + rows.map(([k, v]) => `<tr><td><span class="kbd">${esc(k)}</span></td><td>${esc(v)}</td></tr>`).join('') + '</tbody></table></div>' });
  }
  handleShortcut(e) {
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Escape') { if (this.recorder) this.act_recCancel(); else if (this.busy) this.act_stop(); else stopSpeech(); return; }
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (e.shiftKey && k === 'o') { e.preventDefault(); this.newChat(); }
    else if (e.shiftKey && k === 'i') { e.preventDefault(); this.setIncognito(!this.chat.incognito); }
    else if (e.shiftKey && k === 'e') { e.preventDefault(); if (this.chat.messages.length) this.exportMd(); }
    else if (k === '/') { e.preventDefault(); this.showShortcuts(); }
  }

  /* =================== Paywall y login =================== */
  paywall(feature) {
    const p = CONFIG.PRICES;
    const body = h('div', { class: 'paywall' },
      h('p', { class: 'muted' }, `${feature} son parte de los planes Pro y Empresa. Invitá especialistas a cualquier chat, usá «Hace todo por vos» con herramientas y creá agentes propios.`),
      h('div', { class: 'paywall-plans' }, ...PLANS.filter((x) => x.id !== 'gratis').map((pl) => h('div', { class: 'pw-plan' + (pl.featured ? ' featured' : '') },
        h('strong', {}, pl.name), h('span', { class: 'pw-price' }, formatARS(p[pl.id].ars), h('small', {}, ' /mes')), h('span', { class: 'muted small' }, `o USD ${p[pl.id].usd} /mes con PayPal`),
        h('ul', {}, ...pl.features.slice(1, 4).map((f) => h('li', {}, f)))))));
    modal({ title: 'Disponible en Pro y Empresa', body, actions: [
      { label: 'Ahora no', class: 'btn-ghost' },
      { label: this.user ? 'Elegir plan' : 'Crear cuenta y elegir plan', class: 'btn-gold', onClick: () => { location.href = this.user ? '/cuenta/#planes' : '/cuenta/?registro=1&siguiente=planes'; } }
    ] });
  }
  loginPrompt(text) {
    modal({ title: 'Necesitás una cuenta', body: `<p class="muted">${esc(text)}</p>`, actions: [{ label: 'Cancelar', class: 'btn-ghost' }, { label: 'Ingresar o registrarme', class: 'btn-primary', onClick: () => { location.href = '/cuenta/'; } }] });
  }

  /* =================== Centro de control =================== */
  openHub(tab = 'agentes') {
    import('./hub.js').then((m) => m.openHub(this, tab));
  }
}

export function download(name, content, mime = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime + ';charset=utf-8' });
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function slug(s) { return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'chat'; }
function toggleTheme() { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; prefs.set('ac.theme', t); }
export { mailtoCommercial, TOOLS, CONNECTORS };
