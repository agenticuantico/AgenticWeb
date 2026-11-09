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
import { renderMarkdown, looksLikeMarkdown } from './md.js';
import { LANGS, getLang, flagUrl, startLang } from './languages.js';
const SITE_IDS = ['es-AR', 'es-ES', 'en-US', 'pt-BR'];
import { AGENTS, TOOLS, SKILLS, CONNECTORS, agentById, initials } from './agents.js';
import { speak, stop as stopSpeech } from './voice.js';
import { VoiceRecorder, fmtClock } from './recorder.js';
import { readFile, fmtSize } from './docs.js';
// Rendimiento (Fase 3): la computadora del agente y la videollamada se cargan recién cuando se usan.
import { needsWebAction, isFollowUp } from './intent.js';
import { decideRoute, OVERRIDES, ROUTE_LABEL } from './router.js';
import { detectMediaIntent, mediaMessage, mediaCard, isMediaMessage, runMedia as runMediaTask } from './media.js';
import { cleanArtifact, cleanThought } from './clean.js';
import { PreviewCard, LiveFrame, previewKind, previewHtml, isPreviewable } from './preview-card.js';
import { toolBlock, wantsTools } from './tool-cards.js';

const MODES = {
  fast: { label: 'Rápido', short: 'Rápido', icon: 'bolt', desc: 'Respuestas al instante' },
  deep: { label: 'Pensar', short: 'Pensar', icon: 'bulb', desc: 'Razonamiento profundo' },
  auto: { label: 'Hace todo por vos', short: 'Agente', icon: 'agent', desc: 'Planifica, usa herramientas y verifica', flagship: true }
};

const PHASES = { thinking: 'Pensando', searching: 'Buscando', coding: 'Escribiendo código', verifying: 'Verificando', reading: 'Leyendo', agent: 'Especialista', confirm: 'Confirmación' };
const FACE = '/media/agenticuantico-avatar.webp?v=2';

const SUGGESTIONS = [
  { t: '¿Qué es AgentiCuántico?', i: 'info' },
  { t: 'Armá una landing page para una cafetería', i: 'spark', mode: 'auto' },
  { t: 'Escribí una función en Python que ordene precios', i: 'code' },
  { t: '¿Cuánto es 15600 × 12?', i: 'calc' }
];

export class ChatApp {
  constructor(root, { variant = 'embed', avatar = null, store, onRequestLogin } = {}) {
    this.root = root;
    root._chat = this;
    this.variant = variant;
    const host = avatar, self = this;
    /* El avatar del anfitrión (si hay) y la videollamada flotante reciben los mismos estados. */
    const pip = () => (self._call && self._call.isOpen ? self._call : null);
    this.avatar = {
      get state() { return host ? host.state : (self._call ? self._call.state : 'idle'); },
      setState(st) { host && host.setState(st); pip() && pip().setState(st); },
      setVisemes(v) { host && host.setVisemes(v); pip() && pip().setVisemes(v); },
      setLevel(v) { host && host.setLevel && host.setLevel(v); pip() && pip().setLevel(v); },
      pulse(x) { host && host.pulse(x); pip() && pip().pulse(x); },
      load() { return Promise.resolve(); },
    };
    this.store = store;
    this.onRequestLogin = onRequestLogin;
    this.user = null;
    this.profile = null;
    this.lang = startLang(prefs.get('ac.lang', null));
    document.addEventListener('site:lang', (e) => { const id = e.detail && e.detail.id; if (id && id !== this.lang.id) { this.lang = getLang(id); prefs.set('ac.lang', id); if (this.$) this.renderLang(); } });
    /* Un solo chat: cada mensaje decide cómo responder (router.js). this.mode es el modo del turno en curso.
       El ajuste manual (Ajustes de respuesta) está apagado por defecto: 'smart'. */
    this.mode = 'fast';
    this.override = OVERRIDES[prefs.get('ac.modeOverride', 'smart')] ? prefs.get('ac.modeOverride', 'smart') : 'smart';
    this.forceNext = null;
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
  /** Funciones habilitadas: todas en todos los planes (Fase 1) o, si se desactiva, solo en Pro/Empresa. */
  get featuresUnlocked() { return CONFIG.ALL_FEATURES_ALL_PLANS === true || this.isPaid; }
  flag(name) { return !this.system || this.system.flags[name] !== false; }

  setUser(user, profile) {
    this.user = user; this.profile = profile;
    engine.setIdTokenProvider(user ? () => user.getIdToken() : null);
    this.renderParticipants();
    // Vuelta de un proveedor OAuth (GitHub, Gmail, LinkedIn): la completa el área «Tu cuenta».
    if (user && /^#conectar=/.test(location.hash || '')) import('../account/panel.js').then((m) => m.openAccount('conexiones', { chat: this })).catch(() => {});
  }

  /* =================== Render base =================== */
  render() {
    const r = this.root;
    r.classList.add('chat', 'ace');
    r.dataset.variant = this.variant;
    const full = this.variant === 'full';
    r.innerHTML = `
      <header class="chat-head ace-head">
        ${full ? `<button class="ace-ib only-narrow" type="button" data-act="sidebar" aria-label="Abrir historial">${icon('sidebar')}</button>` : ''}
        <div class="ace-id">
          <span class="ace-ava" data-role="face"><img src="${FACE}" alt="" width="42" height="42"><span class="ace-mouth" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span></span>
          <span class="ace-txt"><strong>AgentiCuántico</strong><small data-role="status" role="status" aria-live="polite"><span class="ace-led"></span>En línea · Lista</small></span>
        </div>
        <div class="chat-participants" data-role="participants" aria-label="Agentes en la conversación"></div>
        <div class="ace-actions">
          <div class="lang-picker" data-popover-host>
            <button class="ace-flag" type="button" data-act="lang" aria-haspopup="menu" aria-expanded="false" aria-label="Idioma y voz">
              <span class="lp-flag"><img class="ace-flag-img" alt="" width="30" height="20" data-role="flag"></span><span class="ace-flag-code" data-role="langShort"></span><svg class="lp-chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9.5l6 6 6-6"/></svg>
            </button>
          </div>
          <a class="ace-ib ace-call" href="/llamada/" aria-label="Llamada de voz" title="Llamada de voz">${icon('phone')}</a>
          ${full
            ? `<button class="ace-ib" type="button" data-act="incognito" aria-pressed="false" aria-label="Chat incógnito" title="Chat incógnito (no se guarda)">${icon('ghost')}</button>
               <div data-popover-host><button class="ace-ib" type="button" data-act="more" aria-haspopup="menu" aria-expanded="false" aria-label="Más opciones">${icon('more')}</button></div>`
            : `<button class="ace-ib" type="button" data-act="clear" aria-label="Nuevo chat" title="Nuevo chat">${icon('trash')}</button>
               <a class="ace-ib" href="/app/" data-act="expand" aria-label="Abrir en pantalla completa" title="Abrir en pantalla completa">${icon('expand')}</a>`}
        </div>
      </header>
      <div class="incognito-bar" data-role="incognitoBar" hidden>${icon('ghost')}<span><strong>Chat incógnito.</strong> No se guarda en el historial, la memoria ni la nube.</span></div>
      <div class="chat-body ace-thread-wrap">
        <div class="chat-thread ace-thread" data-role="thread" role="log" aria-live="polite" aria-relevant="additions" tabindex="0" aria-label="Conversación">
          <div class="thread-inner" data-role="inner"></div>
        </div>
        <div class="ace-empty" data-role="empty">
          <span class="ace-hello-face" aria-hidden="true"><img src="${FACE}" alt="" width="96" height="96"></span>
          <h3 class="ace-greeting" data-role="greeting"></h3>
          <p class="ace-hello-sub" data-role="greetingSub"></p>
          <div class="ace-sugg" data-role="suggestions"></div>
        </div>
        <button class="scroll-down icon-btn" type="button" data-act="scrollDown" aria-label="Ir al final" hidden>${icon('arrowDown')}</button>
      </div>
      <form class="composer ace-composer" data-role="form" autocomplete="off">
        <div class="composer-box ace-box" data-role="box">
          <div class="composer-files" data-role="files" hidden></div>
          <label class="sr-only" for="${this.variant}-input">Mensaje</label>
          <textarea id="${this.variant}-input" data-role="input" rows="1" placeholder="Preguntá lo que quieras" enterkeyhint="send"></textarea>
          <div class="ace-row">
            <div class="ace-left" data-popover-host>
              <button class="ace-ib round ace-plus" type="button" data-act="plus" aria-haspopup="menu" aria-expanded="false" aria-label="Cámara, archivos, agentes y conectores">${icon('plus')}</button>
              <button class="ace-ib round ace-web" type="button" data-act="websearch" aria-pressed="false" aria-label="Buscar en la web" title="Buscar en la web">${icon('globe')}</button>
              <button class="ace-fixed" type="button" data-act="modeSettings" data-role="fixedMode" hidden></button>
            </div>
            <div class="ace-right">
              <button class="ace-ib round" type="button" data-act="mic" aria-label="Grabar nota de voz" title="Grabar nota de voz">${icon('mic')}</button>
              <button class="ace-send voice" type="button" data-act="handsfree" aria-label="Conversación por voz" title="Conversación por voz (manos libres)">${icon('wave')}</button>
              <button class="ace-send" type="submit" data-role="send" aria-label="Enviar" hidden>${icon('send')}</button>
              <button class="ace-send stop" type="button" data-act="stop" aria-label="Detener" hidden>${icon('stop')}</button>
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
        ${full ? '<p class="composer-note">AgentiCuántico puede equivocarse. Verificá la información importante. <a href="/legal/uso-aceptable.html">Uso responsable</a></p>' : ''}
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
    if (this.$('greetingSub')) this.$('greetingSub').textContent = this.lang.sub || '';
    this.root.querySelector('[data-act="lang"]').setAttribute('aria-label', `Idioma: ${this.lang.name} (${this.lang.region})`);
  }
  renderMode() {
    const chip = this.$('fixedMode');
    const fixed = this.override !== 'smart' ? this.override : this.forceNext;
    if (chip) {
      chip.hidden = !fixed;
      if (fixed) {
        const label = this.override !== 'smart' ? OVERRIDES[fixed].label : 'Agente para el próximo mensaje';
        chip.innerHTML = `<span>${esc(label)}</span>${icon('close')}`;
        chip.setAttribute('aria-label', `${label}. Tocá para volver a automático`);
        chip.title = 'Volver a automático';
      }
    }
    this.$('input').placeholder = fixed === 'auto' ? 'Describí la tarea para el agente' : 'Preguntá o pedí una tarea';
  }
  renderEmpty() {
    const box = this.$('suggestions');
    box.innerHTML = '';
    for (const s of SUGGESTIONS) {
      box.append(h('button', { class: 'ace-sug', type: 'button', onclick: () => this.send(s.t) }, h('span', { html: icon(s.i) }), s.t));
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
    const demo = engine.state.checked && !engine.state.live;
    const k = this.busy ? (this.mode === 'auto' || this.busy.route === 'browser' ? 'agentRun' : 'thinking') : (this._face === 'speaking' ? 'speaking' : this.recorder ? 'listening' : 'status');
    const label = this.busy ? (this.busy.label || 'Escribiendo…') : k === 'speaking' ? 'Hablando…' : k === 'listening' ? 'Escuchando…' : 'En línea · Lista';
    st.innerHTML = `<span class="ace-led ${k}"></span>${esc(label)}`;
    this.setFace(this.busy ? 'thinking' : this._face || 'idle');
    this.root.dataset.live = engine.state.live ? '1' : '0';
  }
  /** Estado visual del avatar redondo de la cabecera (y del cerebro neuronal de la portada). */
  setFace(stt) {
    const f = this.$('face');
    if (!f) return;
    f.classList.toggle('thinking', stt === 'thinking');
    f.classList.toggle('speaking', stt === 'speaking');
    f.classList.toggle('listening', stt === 'listening');
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
      if (/(^|\s)@\w*$/.test(input.value)) this.act_invite(r.querySelector('[data-act="plus"]') || input, null, true);
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
    popover(btn, [{ heading: 'Idioma · voz femenina' }, ...LANGS.map((l) => ({
      label: l.name, sub: l.region + ' · ♀ Femenina', img: flagUrl(l), checked: l.id === this.lang.id,
      onClick: () => { this.lang = l; prefs.set('ac.lang', l.id); this.renderLang(); if (SITE_IDS.includes(l.id)) import('../i18n.js').then((m) => m.setSiteLang(l.id)); toast(`Te respondo en ${l.name} (${l.region}) con voz femenina.`); }
    }))], { align: 'end', className: 'lang-menu' });
  }
  act_incognito(btn) { this.setIncognito(!this.chat.incognito); btn.focus(); }
  setIncognito(on) {
    if (on && this.chat.messages.length && !this.chat.incognito) this.newChat(true);
    else this.chat.incognito = on;
    if (!on && this.chat.incognito) this.newChat(false);
    this.root.querySelector('[data-act="incognito"]')?.setAttribute('aria-pressed', String(!!this.chat.incognito));
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
      { label: 'Ajustes de respuesta', sub: OVERRIDES[this.override].label, icon: 'bolt', onClick: () => this.act_modeSettings(btn) },
      { label: 'Atajos de teclado', icon: 'keyboard', onClick: () => this.showShortcuts() }
    ];
    if (this.variant === 'embed') items.splice(2, 0, { label: 'Abrir app completa', icon: 'expand', onClick: () => { location.href = '/app/'; } });
    popover(btn, items, { align: 'end' });
  }
  act_clear() { this.newChat(); }
  act_expand() {
    this.persist();
    try { if (this.chat.messages.some((m) => m.role === 'user') && !this.chat.incognito) sessionStorage.setItem('ac.app.open', this.chat.id); } catch {}
    location.href = '/app/';
  }
  act_scrollDown() { this.scrollToEnd(true); }
  act_sidebar() { this.root.dispatchEvent(new CustomEvent('chat:sidebar', { bubbles: true })); }

  /* =================== Composer =================== */
  act_plus(btn) {
    popover(btn, [
      { label: 'Cámara', sub: 'Foto o escaneo de documento', icon: 'camera', onClick: () => this.openCamera() },
      { label: 'Subir archivo', sub: 'PDF, Word, Excel, CSV, texto o imagen', icon: 'paperclip', onClick: () => this.$('file').click() },
      'sep',
      { label: 'Equipo de agentes con rol', sub: 'Programador, Investigadora, Diseñador…', icon: 'users', onClick: () => this.act_invite(btn) },
      { label: 'Conectar GitHub', sub: 'Iniciás sesión y volvés conectado', icon: 'code', onClick: () => this.openHub('conectores') },
      { label: 'Conectar Cloudflare', sub: 'Iniciás sesión y volvés conectado', icon: 'globe', onClick: () => this.openHub('conectores') },
      { label: 'Llamada de voz en vivo', sub: 'Hablá con AgentiCuántico', icon: 'phone', onClick: () => { location.href = '/llamada/'; } },
      'sep',
      { label: 'Herramientas', icon: 'tools', onClick: () => this.openHub('herramientas') },
      { label: 'Habilidades', icon: 'spark', onClick: () => this.openHub('habilidades') },
      { label: 'Automatizaciones', icon: 'clock', onClick: () => this.openHub('automatizaciones') },
      { label: 'Memoria', icon: 'memory', onClick: () => this.openHub('memoria') },
      'sep',
      { label: 'Ajustes de respuesta', sub: OVERRIDES[this.override].label, icon: 'settings', onClick: () => this.act_modeSettings(btn) }
    ], { place: 'top' });
  }
  /** Ajustes de respuesta (escondido, apagado por defecto): automático o un modo fijo. */
  act_modeSettings(btn) {
    if (this.override === 'smart' && this.forceNext) { this.forceNext = null; this.renderMode(); toast('Vuelvo a elegir solo cómo responder.'); return; }
    if (this.override !== 'smart' && btn && btn.dataset.role === 'fixedMode') { this.setOverride('smart'); return; }
    popover(btn, [{ heading: 'Cómo respondo' }, ...Object.entries(OVERRIDES).map(([id, o]) => ({
      label: o.label, sub: o.desc, icon: id === 'smart' ? 'spark' : MODES[id].icon, checked: id === this.override,
      onClick: () => this.setOverride(id)
    }))], { place: 'top', align: 'end' });
  }
  setOverride(id) {
    if (id === 'auto' && !this.flag('agentMode')) { toast('El modo agente está pausado momentáneamente.'); return; }
    this.override = OVERRIDES[id] ? id : 'smart';
    this.forceNext = null;
    prefs.set('ac.modeOverride', this.override);
    this.renderMode();
    toast(this.override === 'smart' ? 'Listo: elijo solo cómo responder cada mensaje.' : `Modo fijo: ${OVERRIDES[this.override].label.toLowerCase()}.`);
  }
  /** Compatibilidad (?modo=auto, «Hace todo por vos»): el próximo mensaje va al agente; después vuelve a automático. */
  setMode(m, silent) {
    if (m === 'auto' && !this.flag('agentMode')) { toast('El modo agente está pausado momentáneamente.'); return; }
    this.forceNext = this.override === 'smart' && m === 'auto' ? 'auto' : null;
    this.renderMode();
    if (!silent) this.$('input').focus();
  }
  act_invite(btn, e, fromMention = false) {
    if (!this.featuresUnlocked) { if (!fromMention) this.paywall('Los agentes invitables'); return; }
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
  /** Abre la videollamada flotante con el avatar (al mandar voz o al responder con voz). */
  openCall() {
    if (!this.flag('voice')) return;
    const show = () => { const st = this.avatar.state; this._call.open(this.$('form') || this.root); this._call.setState(st); };
    if (this._call) { show(); return; }
    import('./avatar-call.js').then(({ getAvatarCall }) => {
      if (!this._call) { this._call = getAvatarCall(); this._call.onClose = () => { stopSpeech(); if (this.handsFree) this.act_handsfree(); }; }
      show();
    }).catch(() => {});
  }
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
    this.updateStatus(); this.setFace('listening');
    this.$('recHint').textContent = VoiceRecorder.speechSupported() ? 'Escuchando… deslizá a la izquierda para cancelar' : 'Grabando… deslizá a la izquierda para cancelar';
    this.openCall();
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
    this.updateStatus();
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
    this.updateStatus();
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
    if (msg.voice.transcript) msg.voice.transcript = cleanThought(msg.voice.transcript).trim();
    msg.content = msg.voice.transcript;
    this.updateMessage(msg);
    if (!msg.content) {
      msg.voice.sttError = engine.state.sttError || null;
      this.updateMessage(msg);
      const text = engine.sttFailureMessage(engine.state.sttError, VoiceRecorder.speechSupported());
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
    text = cleanThought(text).trim() || text;
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
    // También los seguimientos («seguí», «ahora compará…») de una tarea de la computadora en esta conversación.
    const follow = this.browserCard && this.browserCard.chatId === this.chat.id && isFollowUp(text);
    // Pedidos sobre las cuentas conectadas (correo, GitHub, Cloudflare, LinkedIn) o de empleo: herramientas del servidor
    // (más rápidas y sin gastar minutos de navegador). Cualquier escritura pide «Confirmar» en una tarjeta.
    // Rápido/Profundo: «Buscá en la web: …», «averiguá…», «con fuentes» → búsqueda en vivo (no la computadora del agente).
    // Un solo chat: el router decide por mensaje (rápido, pensar, búsqueda en vivo, computadora o agente).
    const forced = this.override !== 'smart' ? this.override : this.forceNext;
    const decision = decideRoute(text, { override: forced || 'smart', followBrowser: !!follow, hasFiles: files.length > 0 });
    this.forceNext = null; this.renderMode();
    this.mode = decision.mode;
    msg._route = decision.kind;
    const route = detectMediaIntent(text) ? null : decision.kind;
    if (!detectMediaIntent(text) && this.toolsReady() && wantsTools(text) && !follow) msg._tools = true;
    else if (route === 'search' && !follow) msg._search = true;
    else if (!detectMediaIntent(text) && (route === 'browser' || follow)) {
      msg._browser = true;
      if (this.browserCard) this.browserCard.detach();
      const chatId = this.chat.id;
      const { AgentBrowserCard } = await import('../agent-browser.js');
      this.browserCard = new AgentBrowserCard({
        thread: this.$('inner'), composer: this.$('form'), text, conv: chatId, lang: this.lang.code, isPaid: this.isPaid,
        idToken: this.user ? () => this.user.getIdToken() : null, onScroll: () => this.scrollToEnd(true),
        onFiles: (files) => this.browserFiles(chatId, files)
      });
      this.browserCard.chatId = chatId;
    }
    // "Recordá que…" → memoria explícita
    const mem = /^(record[aá]|acordate|guard[aá] en (tu )?memoria)( que)?\s+(.{4,300})$/i.exec(text);
    if (mem && !this.chat.incognito && this.store.ws.memoryOn) {
      // Se guarda en la cuenta (servidor) si hay; el servidor rechaza contraseñas, códigos y tarjetas.
      this.store.addMemory(mem[4].trim(), 'chat').catch((e) => import('../account/api.js').then((m) => toast(m.errorText(e), 'warn')).catch(() => {}));
    }
    await this.respond(msg, { voice: false });
  }

  /** Archivos que creó la computadora del agente → mensaje con entregables (vista previa automática y Archivos). */
  browserFiles(chatId, files) {
    if (!this.chat || this.chat.id !== chatId || !files.length) return;
    let a = this._browserFilesMsg && this.chat.messages.includes(this._browserFilesMsg) ? this._browserFilesMsg : null;
    if (!a) {
      a = { id: uid('m'), role: 'assistant', content: ({ 'en-US': 'Files from the agent computer:', 'pt-BR': 'Arquivos do computador do agente:', 'es-ES': 'Archivos del ordenador del agente:' })[this.lang.id] || 'Archivos de la computadora del agente:', at: Date.now(), artifacts: [] };
      this._browserFilesMsg = a;
      this.pushMessage(a);
    }
    for (const f of files) {
      const art = { name: f.name, mime: f.mime, content: f.content, ...(f.url ? { url: f.url } : {}) };
      const i = a.artifacts.findIndex((x) => x.name === f.name);
      if (i >= 0) a.artifacts[i] = art; else a.artifacts.push(art);
    }
    this.updateMessage(a);
    this.persist();
    this.scrollToEnd(true);
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

  /* =================== Imágenes y clips animados (en los tres modos) =================== */
  async createMedia(intent) {
    const m = mediaMessage(intent);
    this.pushMessage(m);
    await this.runMedia(m);
    if (this.chat.title === 'Nueva conversación') this.chat.title = intent.prompt.replace(/\s+/g, ' ').slice(0, 60);
    this.persist();
  }
  async runMedia(m) {
    if (this.busy) return;
    const ctrl = new AbortController();
    this.busy = { ctrl, label: m.kind === 'video' ? 'Creando video…' : 'Creando imagen…' };
    this.updateStatus(); this.syncSend();
    this.avatar && (this.avatar.pulse(1), this.avatar.setState('thinking'));
    try { await runMediaTask(m, { signal: ctrl.signal, onScroll: () => this.scrollToEnd() }); }
    finally { this.finish(); m._card && m._card._render(); }
  }

  /**
   * Retoma un pedido que esperaba una cuenta (después de conectar o activar): abre la conversación original
   * si existe y vuelve a mandar el pedido. Se llama a la vuelta del proveedor o desde la tarjeta «Activar».
   */
  async resumeRequest({ chatId, text }) {
    if (!text) return;
    try { await engine.init(); } catch { /* el envío informa si no hay servidor */ }
    if (chatId && this.chat.id !== chatId) { const c = this.store.get(chatId); if (c) this.loadChat(c); }
    for (let i = 0; i < 20 && this.busy; i++) await new Promise((r) => setTimeout(r, 250));
    this.send(text);
  }

  /** El servidor tiene herramientas y hay una cuenta iniciada. */
  toolsReady() { return !!(engine.state.live && engine.state.caps && engine.state.caps.tools && engine.hasAccount()); }

  /** Chat con herramientas (conectores y empleo): respuesta + pasos + ofertas + tarjetas de confirmación. */
  async runTools(userMsg, ctrl) {
    const a = { id: uid('m'), role: 'assistant', content: '', at: Date.now(), streaming: true };
    this.pushMessage(a);
    try {
      const res = await engine.apiFetch('/api/tools/chat', { method: 'POST', signal: ctrl.signal, body: { messages: this.history().slice(-12), lang: this.lang.code } });
      const j = await res.json().catch(() => ({}));
      if (res.ok) { a.content = j.reply || ''; a.tools = { steps: j.steps || [], actions: j.actions || [], jobs: j.jobs || null, drafts: j.drafts || null, needs: j.needs || [], batch: j.batch || null, resumeText: userMsg.content, chatId: this.chat.id }; }
      else {
        a.content = res.status === 401 ? 'Ingresá a tu cuenta para usar tus cuentas conectadas.' : res.status === 429 ? 'Llegaste al límite de hoy de tu plan. Se renueva a las 21:00 (hora de Argentina).' : 'No pude usar tus cuentas en este momento. Probá de nuevo.';
        if (res.status === 401) a.notice = 'login'; else if (res.status === 429) a.notice = 'quota';
      }
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      a.content = 'No pude usar tus cuentas en este momento. Probá de nuevo.';
    }
    a.streaming = false;
    this.updateMessage(a, { now: true });
    return a.content;
  }

  async respond(userMsg, { voice }) {
    const media = userMsg && userMsg.role === 'user' ? detectMediaIntent(userMsg.content) : null;
    if (media) { await this.createMedia(media); return; }
    if (userMsg && userMsg._tools && this.toolsReady()) {
      const ctrl = new AbortController();
      this.busy = { ctrl, label: 'Usando tus cuentas…' };
      this.updateStatus(); this.syncSend();
      this.avatar && (this.avatar.pulse(1), this.avatar.setState('thinking'));
      try {
        await this.runTools(userMsg, ctrl);
        if (this.chat.title === 'Nueva conversación') this.chat.title = (userMsg.content || '').replace(/\s+/g, ' ').slice(0, 60);
        this.persist();
      } catch (e) { if (e.name !== 'AbortError') this.addNotice('Algo falló al responder. Probá de nuevo.', 'warn'); }
      this.finish();
      return;
    }
    const ctrl = new AbortController();
    const rk = userMsg._route === 'search' || userMsg._search ? 'search' : userMsg._browser ? 'browser' : this.mode === 'auto' ? 'agent' : this.mode === 'deep' ? 'think' : 'fast';
    this.busy = { ctrl, route: rk, label: ROUTE_LABEL[rk] || 'Escribiendo…' };
    this.updateStatus(); this.syncSend();
    this.avatar && (this.avatar.pulse(1), this.avatar.setState('thinking'));
    const mentioned = this.mentionedAgents(userMsg.content);
    if (mentioned.length && !this.featuresUnlocked) { this.finish(); this.paywall('Mencionar agentes especialistas'); return; }
    for (const a of mentioned) if (!this.chat.agents.includes(a.id)) { this.chat.agents.push(a.id); this.renderParticipants(); }
    const invited = this.featuresUnlocked ? this.chat.agents.map((id) => agentById(id, this.store.ws.customAgents)).filter(Boolean) : [];
    const docs = this.chat.messages.flatMap((m) => m._docs || []);
    let finalText = '';
    try {
      // Con la computadora del agente activa, la tarea la hace el navegador real: no se pide otra respuesta al modelo
      // (evita que el chat diga que no puede navegar mientras la computadora trabaja).
      if (userMsg._browser && engine.state.live && engine.state.caps && engine.state.caps.browser) {
        const a = { id: uid('m'), role: 'assistant', content: ({
          'en-US': "On it. I'm working on the **agent computer**: I plan and do every step on my own and you see them live. I only stop to ask your approval before buying, paying, sending, posting or applying, and if a site needs a sign-in I show you a secure form.",
          'pt-BR': 'Já estou nisso. Trabalho no **computador do agente**: planejo e faço cada passo sozinho, e você vê tudo ao vivo. Só paro para pedir sua aprovação antes de comprar, pagar, enviar, publicar ou me candidatar, e se um site pedir login eu mostro um formulário seguro.',
          'es-ES': 'Me pongo con ello. Trabajo en el **ordenador del agente**: planifico y hago cada paso solo y lo ves en directo. Solo me detengo a pedir tu aprobación antes de comprar, pagar, enviar, publicar o postularme y, si un sitio pide iniciar sesión, te muestro un formulario seguro.'
        })[this.lang.id] || 'Me pongo a trabajar. Uso la **computadora del agente**: planifico y hago cada paso solo, y lo ves en vivo. Solo freno para pedirte aprobación antes de comprar, pagar, enviar, publicar o postular, y si un sitio pide iniciar sesión te muestro un formulario seguro.', at: Date.now() };
        this.pushMessage(a);
        // La tarjeta de la computadora va debajo de este aviso.
        if (this.browserCard && this.browserCard.el && this.browserCard.el.isConnected) this.$('inner').append(this.browserCard.el);
        this.persist();
        this.finish();
        return;
      }
      // Pedidos de acción en la web sin navegador en la nube: respuesta honesta (guía), sin pasos simulados.
      const webOnly = !userMsg._search && needsWebAction(userMsg.content) && !(engine.state.live && engine.state.caps && engine.state.caps.browser);
      if (this.mode === 'auto' && !webOnly) {
        finalText = await this.runAuto(userMsg, invited, docs, ctrl);
      } else {
        const onlyAgents = mentioned.length && userMsg.content.trim().startsWith('@');
        if (!onlyAgents) {
          const a = { id: uid('m'), role: 'assistant', content: '', at: Date.now(), streaming: true };
          this.pushMessage(a);
          const r = await engine.chat({ messages: this.history(), lang: this.lang.code, mode: this.mode, system: this.systemContext(), docs, signal: ctrl.signal, search: (this.webSearch || userMsg._search) ? true : undefined, onEvent: (ev) => this.onSearchEvent(a, ev), onDelta: (d) => { a.content += d; if (a.search && a.search.state !== 'writing' && a.search.state !== 'done') this.onSearchEvent(a, { type: 'search_done' }); this.updateMessage(a); } });
          a.streaming = false; a.content = r.text; if (r.notice) a.notice = r.notice;
          if (a.search) a.search.state = 'done';
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
      if (this.chat.title === 'Nueva conversación') this.chat.title = (cleanThought(userMsg.content || '').trim() || 'Nota de voz').replace(/\s+/g, ' ').slice(0, 60);
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
    this.openCall();
    const av = this.avatar;
    av && av.setState('thinking');
    const face = this.$('face');
    await speak(text, {
      lang: this.lang.id,
      onStart: () => { av && av.setState('talking'); this._face = 'speaking'; this.updateStatus(); },
      onViseme: (v) => { av && av.setVisemes(v); if (face) face.style.setProperty('--lvl', v ? Math.min(1, (v.aa || 0) + (v.oh || 0) + (v.ee || 0) + 0.1).toFixed(3) : '0'); },
      onEnd: () => { av && (av.setVisemes(null), av.setState('idle')); this._face = null; if (face) face.style.setProperty('--lvl', '0'); this.updateStatus(); },
      onUnavailable: () => { if (!this._voiceNoteAt || Date.now() - this._voiceNoteAt > 60000) { this._voiceNoteAt = Date.now(); toast('Voz no disponible por un momento: te respondo por escrito.'); } }
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
        else if (ev.type === 'artifact' || ev.type === 'artifact_delta') this.onArtifact(a, ev);
        else if (typeof ev.delta === 'string') a.content += ev.delta;
        else if (ev.type === 'error') a.content += '\n\n' + (ev.message || 'Hubo un error en un paso.');
        this.updateMessage(a);
      }
    });
    a.streaming = false;
    (a.artifacts || []).forEach((x) => { delete x.writing; });
    this.updateMessage(a);
    // Al terminar con archivos: la Computadora del agente (si está abierta) pasa sola a Archivos, en vista previa.
    if (this._panel && this._panel.m === a && a.artifacts.length) this._panel.showFiles();
    // mantener el mensaje principal al final
    const idx = this.chat.messages.indexOf(a);
    if (idx > -1 && idx !== this.chat.messages.length - 1) { this.chat.messages.splice(idx, 1); this.chat.messages.push(a); const n = this.root.querySelector(`[data-msg="${a.id}"]`); this.$('inner').append(n || this.msgEl(a)); }
    return a.content;
  }

  /**
   * Entregables del agente. {type:'artifact'} trae el archivo completo; {type:'artifact_delta', name, mime, delta}
   * (o {type:'artifact', partial:true}) lo va mandando por partes: la vista previa se redibuja mientras se escribe.
   */
  onArtifact(a, ev) {
    const name = ev.name || 'archivo';
    let art = a.artifacts.find((x) => x.name === name);
    if (!art) { art = { name, mime: ev.mime, content: '' }; a.artifacts.push(art); }
    if (ev.mime) art.mime = ev.mime;
    if (ev.type === 'artifact_delta') { art.content += String(ev.delta || ''); art.writing = true; }
    else if (ev.partial) { art.content = String(ev.content || ''); art.writing = true; }
    else { art.content = cleanArtifact(ev.content, name); delete art.writing; }
    if (this._panel && this._panel.m === a && isPreviewable(art) && !this._panel.ui.userPicked) this._panel.showFiles(a.artifacts.indexOf(art));
  }

  inlineConfirm(msg, question) {
    return new Promise((resolve) => {
      const el = this.root.querySelector(`[data-msg="${msg.id}"] .msg-body`);
      const card = h('div', { class: 'confirm-card', role: 'group', 'aria-label': 'Confirmación requerida', 'data-keep': '' },
        h('p', {}, h('strong', {}, 'Necesito tu confirmación. '), question),
        h('div', { class: 'row' },
          h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: () => { card.remove(); resolve(true); } }, 'Sí, continuar'),
          h('button', { class: 'btn btn-sm', type: 'button', onclick: () => { card.remove(); resolve(false); } }, 'No, solo el borrador')));
      (el || this.$('inner')).append(card);
      this.avatar && this.avatar.setState('listening');
      this.scrollToEnd();
    });
  }

  /* =================== Búsqueda web en vivo =================== */
  /** Botón «Buscar en la web»: la próxima respuesta (y las siguientes, hasta apagarlo) busca en la web. */
  act_websearch(btn) {
    this.webSearch = !this.webSearch;
    this.root.querySelectorAll('[data-act="websearch"]').forEach((b) => { b.setAttribute('aria-pressed', this.webSearch ? 'true' : 'false'); b.classList.toggle('on', this.webSearch); });
    toast(this.webSearch ? 'Búsqueda en la web activada' : 'Búsqueda en la web desactivada');
    this.$('input').focus({ preventScroll: true });
  }
  /** Eventos del servidor: search_start → search_sources (Leyendo N fuentes) → search_done (Redactando…). */
  onSearchEvent(a, ev) {
    const s = a.search || (a.search = { state: 'searching', query: '', sources: [] });
    if (ev.type === 'search_start') { s.state = 'searching'; s.query = String(ev.query || '').slice(0, 160); }
    else if (ev.type === 'search_limit') { s.limit = { reason: ev.reason === 'global' ? 'global' : 'plan', n: Number(ev.limit) || 0 }; }
    else if (ev.type === 'search_sources') {
      s.sources = (Array.isArray(ev.sources) ? ev.sources : []).map((x) => ({ title: String(x && x.title || '').slice(0, 160), url: String(x && x.url || '') })).filter((x) => /^https?:\/\//i.test(x.url)).slice(0, 8);
      if (typeof ev.reading === 'number') s.reading = Math.max(1, Math.min(ev.reading, s.sources.length || ev.reading));
      if (s.state === 'searching') s.state = 'reading';
    } else if (ev.type === 'search_done') { s.state = 'writing'; }
    const nr = s.reading || s.sources.length;
    const label = { searching: 'Buscando en la web…', reading: `Leyendo ${nr} ${nr === 1 ? 'fuente' : 'fuentes'}…`, writing: 'Redactando…' }[s.state];
    if (this.busy && label && this.busy.label !== label) { this.busy.label = label; this.updateStatus(); }
    this.updateMessage(a);
  }
  searchCard(m) {
    const s = m.search; const n = (s.sources || []).length; const st = m.streaming ? s.state : 'done'; const nr = s.reading || n;
    const icon2 = (k) => h('span', { class: 'ace-st ' + k, 'aria-hidden': 'true', html: k === 'done' ? icon('check') : '' });
    const steps = [
      [st === 'searching' ? 'Buscando en la web…' : 'Búsqueda en la web', st === 'searching' ? 'running' : 'done'],
      [st === 'searching' ? 'Leer las fuentes' : st === 'reading' ? `Leyendo ${nr} ${nr === 1 ? 'fuente' : 'fuentes'}…` : `${nr} ${nr === 1 ? 'fuente leída' : 'fuentes leídas'}`, st === 'searching' ? '' : st === 'reading' ? 'running' : 'done'],
      [st === 'done' ? 'Respuesta lista' : 'Redactando…', st === 'writing' ? 'running' : st === 'done' ? 'done' : '']
    ];
    const title = st === 'done' ? (n ? `Buscó en la web · ${n} ${n === 1 ? 'fuente' : 'fuentes'}` : 'Buscó en la web · sin resultados útiles') : steps.find((x) => x[1] === 'running')?.[0] || 'Buscando en la web…';
    const card = h('div', { class: 'ace-task ace-search' + (st === 'done' ? ' is-done' : ''), role: 'group', 'aria-label': 'Búsqueda en la web' },
      h('div', { class: 'ace-task-h' }, h('span', { class: 'ace-search-ic', 'aria-hidden': 'true', html: icon('globe') }),
        h('span', { class: 'ace-task-t' }, h('strong', {}, title), s.query ? h('small', { 'data-no-i18n': '' }, s.query) : null)));
    if (st !== 'done') card.append(h('ul', {}, ...steps.map(([t, k]) => h('li', { class: k }, icon2(k), h('span', { class: 'ace-step-t' }, t)))));
    if (s.limit) card.append(h('p', { class: 'ace-search-note' }, s.limit.reason === 'global'
      ? 'El buscador gratuito llegó a su límite de hoy. Respondo con datos públicos disponibles; se renueva a las 21:00 (hora de Argentina).'
      : `Usaste tus ${s.limit.n} búsquedas en la web de hoy. Respondo con datos públicos disponibles; se renueva a las 21:00 (hora de Argentina). `, s.limit.reason === 'plan' ? h('a', { href: '/planes.html' }, 'Ver planes') : null));
    return card;
  }
  sourcesList(m) {
    const src = (m.search && m.search.sources) || [];
    const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
    return h('nav', { class: 'ace-sources', 'aria-label': 'Fuentes' }, h('strong', {}, 'Fuentes'),
      h('ol', {}, ...src.map((x, i) => h('li', {}, h('a', { href: x.url, target: '_blank', rel: 'noopener noreferrer nofollow', title: x.title }, h('span', { class: 'ace-src-n' }, String(i + 1)), h('span', { class: 'ace-src-t', 'data-no-i18n': '' }, x.title || host(x.url)), h('small', {}, host(x.url)))))));
  }

  /* =================== Mensajes =================== */
  pushMessage(m) {
    this.chat.messages.push(m);
    this.$('inner').append(this.msgEl(m));
    this.syncEmpty();
    this.scrollToEnd(m.role === 'user');
  }
  /**
   * Actualiza un mensaje sin parpadeo: los tokens se juntan y se dibujan una vez por cuadro
   * (requestAnimationFrame) y el mensaje existente se parchea en el lugar. Nunca se reemplaza el nodo
   * completo: así no se reinicia la animación de entrada (.msg → rise), no se recarga el avatar
   * ni los iframes de vista previa, y el scroll queda anclado al final.
   */
  updateMessage(m, { now = false } = {}) {
    if (this._panel && this._panel.m === m) { clearTimeout(this._prT); this._prT = setTimeout(() => this._panel && this._panel.render(), 120); }
    (this._dirty || (this._dirty = new Set())).add(m);
    if (now || !m.streaming || document.hidden) { this.flushMessages(); return; }
    if (!this._raf) this._raf = requestAnimationFrame(() => this.flushMessages());
  }
  flushMessages() {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
    const list = this._dirty ? [...this._dirty] : [];
    if (this._dirty) this._dirty.clear();
    for (const m of list) {
      const old = this.root.querySelector(`[data-msg="${m.id}"]`);
      if (!old) { this.$('inner').append(this.msgEl(m)); continue; }
      this.patchMessage(old, this.msgEl(m, { slots: true }));
    }
    if (list.length) this.scrollToEnd(false, true);
  }
  /** Parchea old con el contenido de el (mismo mensaje) tocando solo los nodos que cambiaron. */
  patchMessage(old, el) {
    if (old.className !== el.className) old.className = el.className;
    if ((old.getAttribute('style') || '') !== (el.getAttribute('style') || '')) { if (el.hasAttribute('style')) old.setAttribute('style', el.getAttribute('style')); else old.removeAttribute('style'); }
    const ob = old.querySelector(':scope > .msg-body'), nb = el.querySelector(':scope > .msg-body');
    if (!ob || !nb) { old.replaceWith(el); return; }
    // Los nodos insertados aparte (tarjeta de confirmación, tarjeta de búsqueda) se conservan.
    const keepExtra = [...ob.childNodes].filter((n) => n.nodeType === 1 && n.hasAttribute('data-keep'));
    const want = [];
    for (const n of [...nb.childNodes]) {
      if (n.nodeType === 1 && n.classList.contains('pvc-slot')) { if (n._card) want.push(n._card); continue; }
      want.push(n);
    }
    const cur = [...ob.childNodes].filter((n) => !keepExtra.includes(n));
    const out = [];
    want.forEach((n, i) => {
      const o = cur[i];
      if (o === n) { out.push(o); return; }
      if (o && o.nodeType === 1 && n.nodeType === 1 && o.tagName === n.tagName && o.className === n.className && o.classList.contains('md')) { morphChildren(o, n); out.push(o); return; }
      if (o && o.isEqualNode(n)) { out.push(o); return; }
      out.push(n);
    });
    for (const n of cur) if (!out.includes(n)) n.remove();
    // Orden final: lo que corresponde al mensaje y, al final, lo conservado.
    let ref = ob.firstChild;
    for (const n of [...out, ...keepExtra]) {
      if (n === ref) { ref = n.nextSibling; continue; }
      ob.insertBefore(n, ref);
    }
  }
  addNotice(text, type = '') {
    const m = { id: uid('n'), role: 'notice', content: text, type, at: Date.now() };
    this.chat.messages.push(m);
    this.$('inner').append(this.msgEl(m));
    this.syncEmpty();
    this.scrollToEnd();
  }
  scrollToEnd(force, instant) {
    const t = this.$('thread');
    if (!(force || this.stick) || this._scrollQ) return;
    this._scrollQ = requestAnimationFrame(() => {
      this._scrollQ = 0;
      // Mientras llega la respuesta el desplazamiento es inmediato: el «smooth» del CSS reiniciado en cada token se ve como temblor.
      const top = t.scrollHeight - t.clientHeight;
      if (Math.abs(t.scrollTop - top) > 1) t.scrollTo({ top, behavior: instant || this.busy ? 'instant' : 'auto' });
    });
  }

  msgEl(m, { slots = false } = {}) {
    if (m.role === 'notice') return h('div', { class: 'msg-notice ' + (m.type || ''), 'data-msg': m.id }, m.content);
    if (m.role === 'user') {
      const el = h('div', { class: 'msg user ace-msg', 'data-msg': m.id });
      if (m.kind === 'voice') el.append(this.voiceBubble(m));
      else el.append(h('div', { class: 'bubble ace-bubble' }, m.content));
      if (m.attachments && m.attachments.length) {
        el.append(h('div', { class: 'msg-files' }, ...m.attachments.map((a) => a.url ? h('img', { src: a.url, alt: a.name, class: 'msg-thumb' }) : h('span', { class: 'chip' }, h('span', { html: icon('file') }), a.name))));
      }
      return el;
    }
    const ag = m.agent;
    const el = h('div', { class: 'msg assistant ace-msg' + (m.streaming ? ' streaming' : '') + (ag ? ' by-agent' : ''), 'data-msg': m.id, style: ag ? `--c:${ag.color}` : null });
    const face = ag ? h('span', { class: 'p-badge ace-mava-badge' }, initials(ag.name)) : h('img', { class: 'ace-mava', src: FACE, alt: '', width: 30, height: 30 });
    const body = h('div', { class: 'msg-body ace-body' });
    if (ag) body.append(h('div', { class: 'msg-who' }, h('strong', {}, ag.name), h('span', { class: 'chip' }, 'agente')));
    if (isMediaMessage(m)) { body.append(mediaCard(m, this)); el.append(face, body); return el; }
    if (m.steps && m.steps.length) body.append(this.timeline(m));
    if (m.artifacts && m.artifacts.length) {
      // Vista previa automática de cada entregable previsualizable (también al reabrir la conversación).
      for (const card of this.previewCards(m)) {
        if (slots && card.isConnected) { const slot = h('i', { class: 'pvc-slot' }); slot._card = card; body.append(slot); } else body.append(card);
      }
      const rest = m.artifacts.filter((x) => !isPreviewable(x));
      if (rest.length) body.append(this.filesList(m, rest));
    }
    if (m.search) body.append(this.searchCard(m));
    const md = h('div', { class: 'md' });
    md.innerHTML = m.content ? renderMarkdown(m.content) : (m.streaming && !(m.steps && m.steps.length) && !m.search ? '<span class="typing" aria-label="Escribiendo"><i></i><i></i><i></i></span>' : '');
    body.append(md);
    if (m.search && m.search.sources && m.search.sources.length && (!m.streaming || m.search.state === 'writing')) body.append(this.sourcesList(m));
    if (m.tools) {
      // Tarjetas de herramientas: un solo nodo por mensaje, conservado entre redibujos (mismo mecanismo que la vista previa).
      const blk = toolBlock(m);
      if (slots && blk.isConnected) { const slot = h('i', { class: 'pvc-slot' }); slot._card = blk; body.append(slot); } else body.append(blk);
    }
    if (m.notice === 'login') body.append(h('div', { class: 'alert info' }, 'Iniciá sesión para seguir con el modelo completo. ', h('a', { href: '/cuenta/' }, 'Ingresar')));
    if (m.notice === 'upgrade' || m.notice === 'quota') body.append(h('div', { class: 'alert info' }, 'Llegaste al límite de tu plan por hoy. ', h('a', { href: '/planes.html' }, 'Ver planes')));
    if (!m.streaming && m.content) {
      body.append(h('div', { class: 'msg-actions ace-acts' },
        h('button', { class: 'ace-ib sm', type: 'button', 'aria-label': 'Copiar respuesta', title: 'Copiar', html: icon('copy'), onclick: () => navigator.clipboard.writeText(m.content).then(() => toast('Copiado')) }),
        h('button', { class: 'ace-ib sm', type: 'button', 'aria-label': 'Escuchar respuesta', title: 'Escuchar', html: icon('speaker'), onclick: () => this.say(m.content) })));
    }
    el.append(face, body);
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
    const det = h('details', { class: 'vb-transcript' }, h('summary', {}, tr ? 'Transcripción' : 'Sin transcripción'), h('p', {}, tr || ({ quota: 'El servicio de transcripción llegó a su límite de hoy.', server: 'Error del servidor al transcribir.', offline: 'Sin conexión con el servidor al transcribir.', no_speech: 'No se oyeron palabras claras.' }[v.sttError] || 'No se pudo transcribir el audio en este navegador.')));
    if (tr && tr.length < 140) det.open = true;
    bubble.append(det);
    return bubble;
  }

  /**
   * Tarjeta del agente en el chat: mientras trabaja, una línea de estado («Escribiendo index.html…») con ✕ para detener
   * y la lista de pasos en vivo; al terminar se pliega en un resumen («Listo · 4 pasos · 1 archivo»).
   */
  timeline(m) {
    const done = m.steps.filter((x) => x.status === 'done').length;
    const total = m.steps.length;
    const running = m.streaming;
    const stopped = !running && done < total;
    const stIcon = (st) => h('span', { class: 'ace-st ' + (st || ''), html: st === 'done' ? icon('check') : st === 'error' ? icon('close') : '' });
    const cur = m.steps.find((x) => x.status === 'running') || m.steps.find((x) => x.status === 'pending');
    const files = (m.artifacts || []).length;
    const writing = (m.artifacts || []).find((x) => x.writing);
    const live = running ? (writing ? `Escribiendo ${writing.name}…` : cur ? ({ coding: 'Escribiendo', searching: 'Buscando', reading: 'Leyendo', verifying: 'Verificando', thinking: 'Pensando', agent: 'Consultando' }[cur.phase] || 'Trabajando') + ': ' + cur.title : 'Armando el plan…') : '';
    const meta = [`${done} de ${total} pasos`, files ? `${files} ${files === 1 ? 'archivo' : 'archivos'}` : null].filter(Boolean).join(' · ');
    const card = h('div', { class: 'ace-task' + (running ? ' is-running' : ' is-folded') });
    const head = h('button', { class: 'ace-task-h', type: 'button', title: 'Ver computadora del agente', onclick: () => this.openAgentPanel(m, 'plan') },
      stIcon(running ? 'running' : stopped ? 'error' : 'done'),
      h('span', { class: 'ace-task-t' }, h('strong', { 'data-no-i18n': running ? '' : null }, running ? live : stopped ? 'Tarea detenida' : 'Listo'), h('small', {}, meta)),
      h('span', { class: 'ace-task-open', html: icon('monitor') }));
    const prog = h('div', { class: 'ace-prog', role: 'progressbar', 'aria-label': 'Avance de la tarea', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': done }, h('i', { style: `width:${total ? (done / total) * 100 : 0}%` }));
    const list = h('ul', {});
    for (const st of m.steps) {
      list.append(h('li', { class: st.status || '' }, stIcon(st.status), h('span', { class: 'ace-step-t' }, st.title), h('em', { class: 'p-' + (st.phase || 'thinking') }, PHASES[st.phase] || st.phase || '')));
    }
    if (running) {
      const x = h('button', { class: 'ace-task-x', type: 'button', 'aria-label': 'Detener al agente', title: 'Detener', html: icon('close'), onclick: (e) => { e.stopPropagation(); this.act_stop(); } });
      card.append(h('div', { class: 'ace-task-top' }, head, x), prog, list);
    } else {
      card.append(head, prog, h('details', { class: 'ace-task-more' }, h('summary', {}, 'Ver los pasos'), list));
    }
    return card;
  }

  /** Tarjetas de vista previa (se reutilizan entre renders para no recargar el iframe). */
  previewCards(m) {
    const cache = m._pv || (Object.defineProperty(m, '_pv', { value: new Map(), enumerable: false, writable: true }), m._pv);
    const out = [];
    m.artifacts.forEach((art, i) => {
      if (!isPreviewable(art)) return;
      let card = cache.get(art.name);
      const opts = {
        onExpand: (f) => openDesign(f),
        onCode: () => this.openAgentPanel(m, 'files', i, { preview: false }),
        onDownload: () => this.downloadArtifact(art),
        onPublish: () => import('./connectors.js').then((mod) => mod.publishArtifact(this, art))
      };
      if (!card || card.kind !== previewKind(art)) { card = new PreviewCard(art, opts); cache.set(art.name, card); }
      else { card.opts = opts; card.update(art, { writing: !!art.writing }); }
      out.push(card.el);
    });
    return out;
  }
  downloadArtifact(art) {
    const k = previewKind(art), c = String(art.content || '').trim();
    if ((k === 'image' || k === 'video') && (art.url || /^(data:|blob:)/.test(c))) {
      const a = h('a', { href: art.url || c, download: art.name }); document.body.append(a); a.click(); a.remove(); return;
    }
    download(art.name, cleanArtifact(art.content, art.name), art.mime || 'text/plain');
  }

  filesList(m, list) {
    const box = h('div', { class: 'ace-files' });
    (list || m.artifacts).forEach((art) => {
      const i = m.artifacts.indexOf(art);
      box.append(h('div', { class: 'ace-file' },
        h('strong', {}, art.name),
        h('small', {}, `${Math.max(1, Math.round(String(art.content || '').length / 1024))} KB`),
        h('button', { class: 'ace-ib', type: 'button', title: 'Ver', 'aria-label': 'Ver ' + art.name, html: icon('eye'), onclick: () => this.openAgentPanel(m, 'files', i) }),
        h('button', { class: 'ace-ib', type: 'button', title: 'Descargar', 'aria-label': 'Descargar ' + art.name, html: icon('download'), onclick: () => this.downloadArtifact(art) }),
        h('button', { class: 'ace-ib', type: 'button', title: 'Publicar en GitHub o Cloudflare', 'aria-label': 'Publicar ' + art.name, html: icon('upload'), onclick: () => import('./connectors.js').then((mod) => mod.publishArtifact(this, art)) })));
    });
    return box;
  }
  artifactCard(art) { return this.filesList({ artifacts: [art] }); }

  /* =================== Computadora del agente (panel a pantalla completa) =================== */
  openAgentPanel(m, tab = 'plan', fileIdx = 0, { preview = true } = {}) {
    this.closeAgentPanel();
    // preview: los archivos previsualizables se abren en vista previa (no en código) salvo que se pida «Código».
    const ui = { tab, fi: fileIdx, preview, userPicked: tab === 'files' };
    let live = null, liveKey = '';
    const viewHost = h('div', { class: 'ap-view-host' });
    const wrap = h('div', { class: 'ace-panel-wrap' });
    const panel = h('div', { class: 'ace-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Computadora del agente' });
    const close = () => this.closeAgentPanel();
    const headEl = h('div', { class: 'ace-panel-h' }, h('span', { class: 'ace-panel-title' }, h('span', { html: icon('monitor') }), h('strong', {}, 'Computadora del agente')), h('button', { class: 'ace-ib', type: 'button', 'aria-label': 'Cerrar', html: icon('close'), onclick: close }));
    const body = h('div', { class: 'ace-panel-b' });
    panel.append(headEl, body); wrap.append(panel);
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    this._panelKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', this._panelKey);
    const render = () => {
      const steps = m.steps || [], arts = m.artifacts || [];
      const done = steps.filter((x) => x.status === 'done').length;
      const running = m.streaming;
      const task = (() => { const i = this.chat.messages.indexOf(m); for (let k = i - 1; k >= 0; k--) if (this.chat.messages[k].role === 'user') return this.chat.messages[k].content; return ''; })();
      // Se vacía todo menos el contenedor de la vista previa: así el iframe no se recarga en cada evento.
      for (const n of [...body.childNodes]) if (n !== viewHost) n.remove();
      const put = (n) => { if (n) body.insertBefore(n, viewHost.parentNode === body ? viewHost : null); };
      if (task) put(h('div', { class: 'ap-task' }, h('strong', {}, cleanThought(task).trim().slice(0, 220))));
      put(h('div', { class: 'ap-status' }, h('span', {}, running ? 'El agente está trabajando…' : done < steps.length ? 'Tarea detenida' : 'Tarea completada'), h('span', {}, steps.length ? `${done} de ${steps.length} pasos` : '')));
      put(h('div', { class: 'progress' }, h('i', { style: `width:${steps.length ? Math.round(done / steps.length * 100) : 0}%` })));
      const tabs = h('div', { class: 'ace-tabs', role: 'tablist' });
      [['plan', 'Plan'], ['computer', 'Computadora'], ['files', 'Archivos' + (arts.length ? ` (${arts.length})` : '')]].forEach(([id, label]) => {
        tabs.append(h('button', { class: 'ace-tab' + (ui.tab === id ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': String(ui.tab === id), onclick: () => { ui.tab = id; ui.userPicked = true; render(); } }, label));
      });
      put(tabs);
      if (ui.tab === 'plan') {
        const ul = h('ul', { class: 'plan-list' });
        for (const st of steps) {
          const logs = (m.logs && m.logs[st.id]) || [];
          ul.append(h('li', { class: st.status || '' }, h('span', { class: 'ace-st ' + (st.status || ''), html: st.status === 'done' ? icon('check') : '' }),
            h('div', { class: 'row' }, h('span', {}, st.title), h('span', { class: 'phase-tag p-' + (st.phase || 'thinking') }, PHASES[st.phase] || st.phase || '')),
            logs.length ? h('div', { class: 'log' }, String(logs[logs.length - 1]).slice(0, 400)) : null));
        }
        put(ul);
      } else if (ui.tab === 'computer') {
        const lines = [];
        for (const st of steps) {
          lines.push(h('div', { class: 'ln' }, h('span', { class: 'pr' }, '› '), h('span', { class: 'ph' }, `[${PHASES[st.phase] || st.phase || ''}] `), `${st.status === 'done' ? '✔' : st.status === 'running' ? '…' : '·'} ${st.title}`));
          for (const l of ((m.logs && m.logs[st.id]) || [])) lines.push(h('div', { class: 'ln sub' }, '  ' + String(l)));
        }
        put(h('div', { class: 'computer' }, h('div', { class: 'computer-bar' }, h('i'), h('i'), h('i'), h('span', {}, 'agente@agenticuantico: ~/tarea')), h('div', { class: 'terminal' }, ...lines, running ? h('span', { class: 'pr' }, '▍') : null)));
      } else {
        if (!arts.length) put(h('p', { class: 'ap-empty' }, 'Todavía no hay archivos.'));
        else {
          const fi = Math.min(ui.fi, arts.length - 1), src = arts[fi];
          const f = { ...src, content: src.writing ? String(src.content || '') : cleanArtifact(src.content, src.name) };
          const kind = previewKind(src);
          const canPreview = !!kind, inFrame = kind && kind !== 'markdown';
          const showPrev = canPreview && ui.preview;
          put(h('div', { class: 'file-tabs' }, ...arts.map((x, i) => h('button', { class: 'file-tab' + (i === fi ? ' on' : ''), type: 'button', onclick: () => { ui.fi = i; ui.preview = true; ui.userPicked = true; render(); } }, x.name))));
          if (src.writing) put(h('div', { class: 'ap-writing' }, 'Escribiendo el archivo…'));
          const expandFile = () => openDesign({ name: f.name, mime: 'text/html', content: previewHtml(src) });
          put(h('div', { class: 'file-acts' },
            kind === 'image' || kind === 'video' ? null : h('button', { class: 'ace-pill-btn', type: 'button', onclick: () => navigator.clipboard.writeText(f.content).then(() => toast('Copiado')) }, h('span', { html: icon('copy') }), 'Copiar'),
            h('button', { class: 'ace-pill-btn', type: 'button', onclick: () => this.downloadArtifact(src) }, h('span', { html: icon('download') }), 'Descargar'),
            canPreview && kind !== 'image' && kind !== 'video' ? h('button', { class: 'ace-pill-btn', type: 'button', onclick: () => { ui.preview = !ui.preview; ui.userPicked = true; render(); } }, h('span', { html: icon(ui.preview ? 'code' : 'eye') }), ui.preview ? 'Código' : 'Vista previa') : null,
            h('button', { class: 'ace-pill-btn', type: 'button', onclick: () => import('./connectors.js').then((mod) => mod.publishArtifact(this, src)) }, h('span', { html: icon('upload') }), 'Publicar'),
            kind === 'image' || kind === 'video' ? null : h('button', { class: 'ace-pill-btn', type: 'button', onclick: () => { close(); this.openCanvas(f); } }, h('span', { html: icon('canvas') }), 'Lienzo'),
            canPreview ? h('button', { class: 'ace-pill-btn ace-expand', type: 'button', title: 'Expandir', 'aria-label': 'Expandir', onclick: expandFile }, h('span', { html: icon('expand') }), 'Expandir') : null));
          const key = `${fi}:${src.name}:${showPrev && inFrame ? 'live' : showPrev ? 'md' : 'code'}`;
          if (showPrev && inFrame) {
            // Vista previa en vivo: el mismo iframe se actualiza (con debounce) mientras llega el contenido.
            if (!live || liveKey !== key) {
              live = new LiveFrame('preview-frame is-live', f.name);
              viewHost.className = 'file-view has-preview';
              viewHost.replaceChildren(live.el, h('button', { class: 'preview-max', type: 'button', title: 'Expandir', 'aria-label': 'Expandir', html: icon('expand'), onclick: expandFile }));
            }
            live.set(previewHtml(src), { wait: src.writing ? 450 : 0 });
          } else {
            live = null;
            viewHost.className = 'file-view';
            const d = h('div', { class: 'md' });
            d.innerHTML = showPrev ? renderMarkdown(f.content) : renderMarkdown('```' + (f.name.split('.').pop() || '') + '\n' + f.content + '\n```');
            viewHost.replaceChildren(d);
          }
          liveKey = key;
          if (viewHost.parentNode !== body) body.appendChild(viewHost);
          return;
        }
      }
      if (viewHost.parentNode === body) { viewHost.remove(); live = null; liveKey = ''; }
    };
    const showFiles = (i) => {
      const arts = m.artifacts || [];
      ui.tab = 'files';
      if (typeof i === 'number') ui.fi = i;
      else { const j = arts.findIndex((x) => isPreviewable(x)); ui.fi = j < 0 ? 0 : j; }
      ui.preview = true;
      render();
    };
    render();
    this._panel = { wrap, render, m, ui, showFiles };
    document.body.append(wrap);
    document.body.classList.add('ace-lock');
    requestAnimationFrame(() => headEl.querySelector('button').focus({ preventScroll: true }));
  }
  closeAgentPanel() {
    if (!this._panel) return;
    this._panel.wrap.remove(); this._panel = null;
    document.body.classList.remove('ace-lock');
    document.removeEventListener('keydown', this._panelKey);
  }

  /* =================== Lienzo (código / documentos con vista previa aislada) =================== */
  openCanvas(art0) {
    const art = { ...art0, content: cleanArtifact(art0.content, art0.name) };
    const isHtml = art.mime === 'text/html' || /\.html?$/.test(art.name);
    // Markdown (o texto con formato Markdown): la «Vista previa» lo muestra con formato, no con «##» crudos.
    const isMd = !isHtml && (previewKind(art) === 'markdown' || looksLikeMarkdown(art.content, art.name));
    const ta = h('textarea', { class: 'canvas-code', spellcheck: 'false', 'aria-label': 'Contenido editable' });
    ta.value = art.content;
    const frame = h('iframe', { class: 'canvas-frame', title: 'Vista previa aislada', sandbox: 'allow-scripts allow-modals', src: '/app/preview.html', referrerpolicy: 'no-referrer' });
    const preview = h('div', { class: 'canvas-preview' }, frame);
    const tabs = h('div', { class: 'canvas-tabs', role: 'tablist' });
    const setTab = (t) => { tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t))); ta.hidden = t !== 'code'; preview.hidden = t !== 'preview'; if (t === 'preview') send(); };
    const send = () => frame.contentWindow && frame.contentWindow.postMessage({ type: 'ac-preview', html: isHtml ? ta.value : isMd ? previewHtml({ name: 'doc.md', mime: 'text/markdown', content: ta.value }) : `<pre style="white-space:pre-wrap;font:14px/1.5 ui-monospace,monospace;padding:16px">${esc(ta.value)}</pre>` }, '*');
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
    setTab(isHtml || isMd ? 'preview' : 'code');
  }

  /* =================== Conversaciones =================== */
  newChat(incognito = false) {
    stopSpeech();
    if (this.busy) this.act_stop();
    this.chat = this.newChatObject(incognito);
    this.$('inner').innerHTML = '';
    this.renderParticipants();
    this.syncEmpty();
    this.root.querySelector('[data-act="incognito"]')?.setAttribute('aria-pressed', String(incognito));
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

/**
 * Diseño a pantalla completa: overlay que ocupa toda la ventana con el HTML en un iframe aislado (sandbox, sin red),
 * botón para cerrar (también Esc), abrir en una pestaña nueva y adaptación al girar el teléfono.
 */
export function openDesign(f) {
  const html = cleanArtifact(f.content, f.name);
  document.querySelector('.design-full')?.remove();
  const frame = h('iframe', { class: 'design-full-frame', title: f.name, sandbox: 'allow-scripts', src: '/app/preview.html', referrerpolicy: 'no-referrer', allow: 'fullscreen' });
  const send = (fit) => frame.contentWindow && frame.contentWindow.postMessage({ type: 'ac-preview', html, fit }, '*');
  let fit = true;
  frame.addEventListener('load', () => send(fit));
  const fitBtn = h('button', { class: 'design-full-btn', type: 'button', 'aria-pressed': 'true', title: 'Ajustar al ancho', 'aria-label': 'Ajustar al ancho', html: icon('collapse'),
    onclick: () => { fit = !fit; fitBtn.setAttribute('aria-pressed', String(fit)); send(fit); } });
  const openTab = () => {
    const w = window.open('/app/preview.html#tab', '_blank');
    if (!w) { toast('Permití las ventanas emergentes para abrir el diseño en otra pestaña.'); return; }
    const onReady = (e) => { if (e.source === w && e.data && e.data.type === 'ac-preview-ready') { w.postMessage({ type: 'ac-preview', html, fit: false }, location.origin); window.removeEventListener('message', onReady); } };
    window.addEventListener('message', onReady);
    setTimeout(() => window.removeEventListener('message', onReady), 15000);
  };
  const close = () => { wrap.remove(); document.body.classList.remove('design-lock'); document.removeEventListener('keydown', onKey, true); prevFocus && prevFocus.focus && prevFocus.focus({ preventScroll: true }); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  const prevFocus = document.activeElement;
  const bar = h('div', { class: 'design-full-bar' },
    h('span', { class: 'design-full-name', 'data-no-i18n': '' }, f.name),
    fitBtn,
    h('button', { class: 'design-full-btn', type: 'button', title: 'Abrir en una pestaña nueva', 'aria-label': 'Abrir en una pestaña nueva', html: icon('external'), onclick: openTab }),
    h('button', { class: 'design-full-btn design-full-close', type: 'button', title: 'Cerrar', 'aria-label': 'Cerrar', html: icon('close'), onclick: close }));
  const wrap = h('div', { class: 'design-full', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Diseño a pantalla completa' }, bar, frame);
  document.body.append(wrap);
  document.body.classList.add('design-lock');
  document.addEventListener('keydown', onKey, true);
  requestAnimationFrame(() => bar.querySelector('.design-full-close').focus({ preventScroll: true }));
}

export function download(name, content, mime = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime + ';charset=utf-8' });
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function slug(s) { return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'chat'; }
export { mailtoCommercial, TOOLS, CONNECTORS };

/**
 * Pasa los hijos de `to` a `from` reemplazando solo los nodos que cambiaron (en el streaming suele ser el
 * último párrafo). Evita recrear imágenes y bloques ya dibujados en cada token.
 */
function morphChildren(from, to) {
  const a = [...from.childNodes], b = [...to.childNodes];
  for (let i = 0; i < b.length; i++) {
    const o = a[i], n = b[i];
    if (o && o.isEqualNode(n)) continue;
    if (o && o.nodeType === 3 && n.nodeType === 3) { o.nodeValue = n.nodeValue; continue; }
    if (o && o.nodeType === 1 && n.nodeType === 1 && o.tagName === n.tagName && o.tagName !== 'IMG' && o.tagName !== 'IFRAME' && /^(UL|OL|TABLE|TBODY|THEAD|TR|BLOCKQUOTE|DIV)$/.test(o.tagName)) {
      for (const at of [...o.attributes]) if (!n.hasAttribute(at.name)) o.removeAttribute(at.name);
      for (const at of [...n.attributes]) if (o.getAttribute(at.name) !== at.value) o.setAttribute(at.name, at.value);
      morphChildren(o, n); continue;
    }
    if (o) from.replaceChild(n, o); else from.appendChild(n);
  }
  for (let i = b.length; i < a.length; i++) a[i].remove();
}
