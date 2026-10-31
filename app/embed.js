/*
 * AgentiCuántico · chat conversacional embebido (portada).
 * Usa los mismos módulos que /app/: config.js, i18n.js, md.js, engine.js y voice.js.
 * Montaje: <div id="acEmbed"></div> + AC_EMBED.mount(document.getElementById("acEmbed")).
 */
(function () {
  "use strict";
  var CFG = window.AC_CONFIG || {}, I18N = window.AC_I18N || {}, MD = window.AC_MD, E = window.AC_ENGINE, V = window.AC_VOICE;
  var esc = MD.esc;
  var KEY = "ac.embed.v1";

  var ICONS = {
    expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    wave: '<path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/>',
    arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    speaker: '<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6Z"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z"/>',
    agent: '<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4M9 13h.01M15 13h.01M9.5 16h5"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    play: '<path d="M7 5l12 7-12 7Z"/>'
  };
  function icon(n) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n] || "") + "</svg>"; }

  var TX = {
    es: { status: "En línea · Lista", thinking: "Pensando…", writing: "Escribiendo…", speaking: "Hablando…", listening: "Escuchando…", agentRun: "Agente trabajando…", demo: "demo",
      placeholder: "Preguntá lo que quieras", placeholderAgent: "Describí la tarea para el agente", fast: "Rápido", deep: "Pensar", agent: "Agente",
      hello: "¡Hola! Soy AgentiCuántico.", helloSub: "Conversá conmigo, pedime código o activá el modo Agente para tareas completas.",
      s1: "¿Qué es AgentiCuántico?", s2: "Escribí una función en Python que ordene precios", s3: "Armá una landing page para una panadería", s4: "¿Cuánto es 15600 × 3?",
      open: "Abrir en pantalla completa", voiceTitle: "Voz e idioma", voiceNote: "Voz femenina, la de mejor calidad disponible.", voiceServer: "Voz neuronal del servidor (ElevenLabs).", voiceLocal: "Voz femenina de tu dispositivo: ",
      voiceNone: "Tu dispositivo no tiene una voz femenina para este idioma; se usa la más parecida.", test: "Probar voz", testText: "Hola, soy AgentiCuántico. Esta es mi voz.", female: "Voz femenina",
      copy: "Copiar", copied: "Copiado", read: "Leer en voz alta", stopRead: "Detener", clear: "Nuevo chat", mic: "Dictar", voiceMode: "Conversación por voz", send: "Enviar", stop: "Detener",
      micNo: "El dictado por voz no está disponible en este navegador.", steps: "{a} de {b} pasos", done: "Tarea completada", working: "El agente está trabajando", stopped: "Tarea detenida",
      view: "Ver", download: "Descargar", close: "Cerrar", notice: "Respuesta de demostración. La IA completa se activa con el servidor conectado." },
    en: { status: "Online · Ready", thinking: "Thinking…", writing: "Writing…", speaking: "Speaking…", listening: "Listening…", agentRun: "Agent working…", demo: "demo",
      placeholder: "Ask anything", placeholderAgent: "Describe the task for the agent", fast: "Fast", deep: "Think", agent: "Agent",
      hello: "Hi! I'm AgentiCuántico.", helloSub: "Chat with me, ask for code or turn on Agent mode for full tasks.",
      s1: "What is AgentiCuántico?", s2: "Write a Python function that sorts prices", s3: "Build a landing page for a bakery", s4: "What is 15600 × 3?",
      open: "Open full screen", voiceTitle: "Voice & language", voiceNote: "Female voice, the best quality available.", voiceServer: "Server neural voice (ElevenLabs).", voiceLocal: "Female voice on your device: ",
      voiceNone: "Your device has no female voice for this language; using the closest one.", test: "Test voice", testText: "Hi, I'm AgentiCuántico. This is my voice.", female: "Female voice",
      copy: "Copy", copied: "Copied", read: "Read aloud", stopRead: "Stop", clear: "New chat", mic: "Dictate", voiceMode: "Voice conversation", send: "Send", stop: "Stop",
      micNo: "Voice dictation isn't available in this browser.", steps: "{a} of {b} steps", done: "Task completed", working: "The agent is working", stopped: "Task stopped",
      view: "View", download: "Download", close: "Close", notice: "Demo answer. Full AI turns on when the server is connected." },
    pt: { status: "Online · Pronta", thinking: "Pensando…", writing: "Escrevendo…", speaking: "Falando…", listening: "Ouvindo…", agentRun: "Agente trabalhando…", demo: "demo",
      placeholder: "Pergunte o que quiser", placeholderAgent: "Descreva a tarefa para o agente", fast: "Rápido", deep: "Pensar", agent: "Agente",
      hello: "Olá! Sou a AgentiCuántico.", helloSub: "Converse comigo, peça código ou ative o modo Agente para tarefas completas.",
      s1: "O que é a AgentiCuántico?", s2: "Escreva uma função em Python que ordene preços", s3: "Crie uma landing page para uma padaria", s4: "Quanto é 15600 × 3?",
      open: "Abrir em tela cheia", voiceTitle: "Voz e idioma", voiceNote: "Voz feminina, a de melhor qualidade disponível.", voiceServer: "Voz neural do servidor (ElevenLabs).", voiceLocal: "Voz feminina do seu dispositivo: ",
      voiceNone: "Seu dispositivo não tem voz feminina para este idioma; usamos a mais parecida.", test: "Testar voz", testText: "Olá, sou a AgentiCuántico. Esta é a minha voz.", female: "Voz feminina",
      copy: "Copiar", copied: "Copiado", read: "Ler em voz alta", stopRead: "Parar", clear: "Novo chat", mic: "Ditar", voiceMode: "Conversa por voz", send: "Enviar", stop: "Parar",
      micNo: "O ditado por voz não está disponível neste navegador.", steps: "{a} de {b} passos", done: "Tarefa concluída", working: "O agente está trabalhando", stopped: "Tarefa interrompida",
      view: "Ver", download: "Baixar", close: "Fechar", notice: "Resposta de demonstração. A IA completa liga com o servidor conectado." }
  };
  var TEST_TEXT = { "it-IT": "Ciao, sono AgentiCuántico. Questa è la mia voce.", "fr-FR": "Bonjour, je suis AgentiCuántico. Voici ma voix.", "de-DE": "Hallo, ich bin AgentiCuántico. Das ist meine Stimme.", "es-ES": "Hola, soy AgentiCuántico. Esta es mi voz." };

  function uiLang() { return V.byCode(V.getLang()).ui; }
  function engineLang() { var c = V.getLang(); return c.slice(0, 2) === "es" ? "es" : c.slice(0, 2); }
  function tx(k, vars) { var d = TX[uiLang()] || TX.es, v = d[k] != null ? d[k] : TX.es[k]; if (vars) Object.keys(vars).forEach(function (n) { v = v.replace("{" + n + "}", vars[n]); }); return v; }
  if (!window.AC_T) window.AC_T = function (k) { return k === "copy" ? tx("copy") : k === "copied" ? tx("copied") : ((I18N.es || {})[k] || k); };

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function load() { try { var s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && Array.isArray(s.messages)) return s; } catch (e) { /* ignore */ } return { messages: [], mode: "fast" }; }

  function mount(root) {
    if (!root || root.__acMounted) return;
    root.__acMounted = true;
    var st = load(), ui = { ctrl: null, voiceMode: false, rec: null, dictation: null, speakingId: null, q: 0 };
    function save() { try { localStorage.setItem(KEY, JSON.stringify({ messages: st.messages.filter(function (m) { return !m.streaming; }).slice(-40), mode: st.mode })); } catch (e) { /* ignore */ } }

    root.classList.add("ace");
    root.innerHTML =
      '<div class="ace-head">' +
        '<div class="ace-id">' +
          '<div class="ace-ava" id="aceAva"><img src="/media/agenticuantico-avatar.jpg" alt="" width="40" height="40"><span class="ace-mouth" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><span class="ace-dot"></span></div>' +
          '<div class="ace-txt"><strong>AgentiCuántico</strong><small id="aceStatus"></small></div>' +
        "</div>" +
        '<div class="ace-actions">' +
          '<button class="ace-flag" id="aceLangBtn" type="button" aria-haspopup="dialog"><span class="ace-flag-emoji" id="aceFlag"></span><span class="ace-flag-code" id="aceFlagCode"></span>' + icon("chevron") + "</button>" +
          '<button class="ace-ib" id="aceClear" type="button">' + icon("trash") + "</button>" +
          '<a class="ace-ib" id="aceOpen" href="/app/">' + icon("expand") + "</a>" +
        "</div>" +
      "</div>" +
      '<div class="ace-thread" id="aceThread" aria-live="polite"></div>' +
      '<form class="ace-composer" id="aceForm" autocomplete="off">' +
        '<div class="ace-box">' +
          '<textarea id="aceInput" rows="1" enterkeyhint="send"></textarea>' +
          '<div class="ace-row">' +
            '<div class="ace-modes" role="radiogroup" id="aceModes">' +
              '<button type="button" data-mode="fast" role="radio">' + icon("bolt") + '<span data-t="fast"></span></button>' +
              '<button type="button" data-mode="deep" role="radio">' + icon("bulb") + '<span data-t="deep"></span></button>' +
              '<button type="button" data-mode="agent" role="radio">' + icon("agent") + '<span data-t="agent"></span></button>' +
            "</div>" +
            '<div class="ace-right">' +
              '<button class="ace-ib round" id="aceMic" type="button">' + icon("mic") + "</button>" +
              '<button class="ace-send voice" id="aceVoice" type="button">' + icon("wave") + "</button>" +
              '<button class="ace-send" id="aceSend" type="submit" hidden>' + icon("arrowUp") + "</button>" +
              '<button class="ace-send stop" id="aceStop" type="button" hidden>' + icon("stop") + "</button>" +
            "</div>" +
          "</div>" +
        "</div>" +
      "</form>" +
      '<div class="ace-sheet-wrap" id="aceSheetWrap" hidden><div class="ace-sheet" id="aceSheet" role="dialog" aria-modal="true" aria-labelledby="aceSheetTitle"></div></div>' +
      '<div class="ace-viewer" id="aceViewer" hidden></div>';

    var $ = function (id) { return root.querySelector("#" + id); };
    var thread = $("aceThread"), input = $("aceInput");

    /* ---------- Estado visual ---------- */
    var statusKey = "status";
    function setStatus(k) {
      statusKey = k;
      var S = E.state, demo = S.checked && !S.live;
      $("aceStatus").innerHTML = '<span class="ace-led ' + k + '"></span>' + esc(tx(k)) + (demo && k === "status" ? ' <span class="ace-demo">· ' + esc(tx("demo")) + "</span>" : "");
      $("aceAva").classList.toggle("thinking", k === "thinking" || k === "agentRun");
      $("aceAva").classList.toggle("speaking", k === "speaking");
      $("aceAva").classList.toggle("listening", k === "listening");
      if (window.setNeuralState) window.setNeuralState(k === "thinking" || k === "agentRun" || k === "writing" ? "thinking" : k === "speaking" ? "speaking" : "idle");
    }
    V.onLevel(function (lv) {
      var a = $("aceAva"); a.style.setProperty("--lvl", lv.toFixed(3));
      document.documentElement.style.setProperty("--ac-voice-level", lv.toFixed(3));
    });

    function applyTexts() {
      root.querySelectorAll("[data-t]").forEach(function (el) { el.textContent = tx(el.getAttribute("data-t")); });
      input.placeholder = st.mode === "agent" ? tx("placeholderAgent") : tx("placeholder");
      var L = V.byCode(V.getLang());
      $("aceFlag").innerHTML = V.flagSvg(L.code, 22); $("aceFlagCode").textContent = L.short;
      $("aceLangBtn").title = tx("voiceTitle") + " · " + L.name; $("aceLangBtn").setAttribute("aria-label", tx("voiceTitle") + ": " + L.name);
      [["aceClear", "clear"], ["aceOpen", "open"], ["aceMic", "mic"], ["aceVoice", "voiceMode"], ["aceSend", "send"], ["aceStop", "stop"]].forEach(function (p) { $(p[0]).title = tx(p[1]); $(p[0]).setAttribute("aria-label", tx(p[1])); });
      root.querySelectorAll("[data-mode]").forEach(function (b) { var on = b.getAttribute("data-mode") === st.mode; b.classList.toggle("on", on); b.setAttribute("aria-checked", on ? "true" : "false"); });
      setStatus(statusKey);
    }

    /* ---------- Render ---------- */
    function emptyHtml() {
      return '<div class="ace-empty"><img src="/media/agenticuantico-avatar.jpg" alt="" width="56" height="56"><h3>' + esc(tx("hello")) + "</h3><p>" + esc(tx("helloSub")) + '</p><div class="ace-sugg">' +
        ["s1", "s2", "s3", "s4"].map(function (k, i) { return '<button type="button" data-sugg="' + (i === 2 ? "agent" : "") + '">' + esc(tx(k)) + "</button>"; }).join("") + "</div></div>";
    }
    function stIcon(s) { return '<span class="ace-st ' + (s || "") + '">' + (s === "done" ? icon("check") : s === "error" ? icon("close") : "") + "</span>"; }
    function agentHtml(m) {
      var a = m.agent, done = a.steps.filter(function (s) { return s.status === "done" || s.status === "error"; }).length, total = Math.max(a.steps.length, 1);
      var running = a.status === "running";
      var steps = a.steps.length ? a.steps : [{ title: tx("thinking"), status: "running", phase: "thinking" }];
      var h = '<div class="ace-task"><div class="ace-task-h">' + stIcon(running ? "running" : a.status === "stopped" ? "error" : "done") + "<div><strong>" + esc(running ? tx("working") : a.status === "stopped" ? tx("stopped") : tx("done")) + "</strong><small>" + esc(tx("steps", { a: done, b: a.steps.length })) + '</small></div></div><div class="ace-prog"><i style="width:' + Math.round(done / total * 100) + '%"></i></div><ul>' +
        steps.map(function (s) { return '<li class="' + (s.status || "") + '">' + stIcon(s.status) + "<span>" + esc(s.title) + '</span><em class="p-' + esc(s.phase || "thinking") + '">' + esc((window.AC_I18N && (AC_I18N[uiLang()] || AC_I18N.es)["phase_" + (s.phase || "thinking")]) || s.phase || "") + "</em></li>"; }).join("") + "</ul></div>";
      if (a.artifacts.length) h += '<div class="ace-files">' + a.artifacts.map(function (f, i) {
        return '<div class="ace-file"><strong>' + esc(f.name) + "</strong><small>" + Math.max(1, Math.round(f.content.length / 1024)) + ' KB</small><button type="button" class="ace-ib" data-view="' + i + '" title="' + esc(tx("view")) + '" aria-label="' + esc(tx("view")) + '">' + icon("eye") + '</button><button type="button" class="ace-ib" data-dl="' + i + '" title="' + esc(tx("download")) + '" aria-label="' + esc(tx("download")) + '">' + icon("download") + "</button></div>";
      }).join("") + "</div>";
      return h;
    }
    function bodyHtml(m) {
      if (m.role === "user") return '<div class="ace-bubble">' + esc(m.content).replace(/\n/g, "<br>") + "</div>";
      var h = "";
      if (m.agent) h += agentHtml(m);
      if (m.pending && !m.content) h += '<div class="ace-typing"><i></i><i></i><i></i></div>';
      else if (m.content) h += '<div class="md' + (m.streaming ? " cursor-host" : "") + '">' + MD.render(m.content) + "</div>";
      if (!m.streaming && m.content) h += '<div class="ace-acts"><button type="button" class="ace-ib sm" data-copy title="' + esc(tx("copy")) + '" aria-label="' + esc(tx("copy")) + '">' + icon("copy") + '</button><button type="button" class="ace-ib sm" data-speak title="' + esc(tx("read")) + '" aria-label="' + esc(tx("read")) + '">' + icon("speaker") + "</button>" + (m.demo ? '<span class="ace-chip">' + esc(tx("demo")) + "</span>" : "") + "</div>";
      return h;
    }
    function msgEl(m) {
      var d = document.createElement("div");
      d.className = "ace-msg " + m.role; d.setAttribute("data-id", m.id);
      d.innerHTML = m.role === "assistant" ? '<img class="ace-mava" src="/media/agenticuantico-avatar.jpg" alt="" width="28" height="28"><div class="ace-body">' + bodyHtml(m) + "</div>" : bodyHtml(m);
      return d;
    }
    function renderAll() {
      thread.innerHTML = "";
      if (!st.messages.length) { thread.innerHTML = emptyHtml(); return; }
      st.messages.forEach(function (m) { thread.appendChild(msgEl(m)); });
      thread.scrollTop = thread.scrollHeight;
    }
    var rq = {};
    function update(m) {
      if (rq[m.id]) return;
      rq[m.id] = requestAnimationFrame(function () {
        delete rq[m.id];
        var el = thread.querySelector('[data-id="' + m.id + '"] .ace-body'); if (!el) return;
        var stick = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 140;
        el.innerHTML = bodyHtml(m);
        var md = el.querySelector(".cursor-host"); if (md) { var last = md.lastElementChild; if (last && !last.classList.contains("codeblock")) last.classList.add("cursor"); }
        if (stick) thread.scrollTop = thread.scrollHeight;
      });
    }

    /* ---------- Composer ---------- */
    function autosize() { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 140) + "px"; }
    function updateComposer() {
      var has = input.value.trim().length > 0, busy = !!ui.ctrl;
      $("aceStop").hidden = !busy; $("aceSend").hidden = busy || !has; $("aceVoice").hidden = busy || has;
      $("aceVoice").classList.toggle("on", ui.voiceMode);
    }
    function setMode(m) { st.mode = m; save(); applyTexts(); }

    /* ---------- Envío ---------- */
    function history() { return st.messages.filter(function (m) { return (m.role === "user" || m.role === "assistant") && m.content && !m.streaming; }).slice(-20).map(function (m) { return { role: m.role, content: m.content }; }); }
    function send(text) {
      text = String(text == null ? input.value : text).trim();
      if (!text || ui.ctrl) return;
      V.stop();
      if (!st.messages.length) thread.innerHTML = "";
      var um = { id: uid(), role: "user", content: text };
      st.messages.push(um); thread.appendChild(msgEl(um));
      input.value = ""; autosize();
      if (st.mode === "agent") runAgent(um); else runChat();
    }
    function start(am) {
      st.messages.push(am); thread.appendChild(msgEl(am)); thread.scrollTop = thread.scrollHeight;
      ui.ctrl = new AbortController(); updateComposer();
      return ui.ctrl.signal;
    }
    function finish(am) {
      am.streaming = false; am.pending = false; ui.ctrl = null; save();
      var el = thread.querySelector('[data-id="' + am.id + '"] .ace-body'); if (el) el.innerHTML = bodyHtml(am);
      updateComposer(); setStatus("status");
      if (ui.voiceMode && am.content) speakMsg(am, function () { if (ui.voiceMode) listen(); });
    }
    function runChat() {
      var mode = st.mode === "deep" ? "deep" : "fast";
      var am = { id: uid(), role: "assistant", content: "", pending: true, streaming: true };
      var hist = history();
      var sig = start(am); setStatus("thinking");
      E.chat({ messages: hist, mode: mode, lang: engineLang(), signal: sig, onDelta: function (d) {
        if (am.pending) { am.pending = false; setStatus("writing"); }
        am.content += d; update(am);
      } }).then(function (r) { am.demo = !!(r && r.demo); })
        .catch(function (e) { if (!(e && e.name === "AbortError") && !am.content) am.content = E._demoAnswer("", engineLang()); })
        .then(function () { finish(am); });
    }
    function runAgent(um) {
      var am = { id: uid(), role: "assistant", content: "", streaming: true, agent: { task: um.content, steps: [], artifacts: [], status: "running" } };
      var a = am.agent, sig = start(am); setStatus("agentRun");
      E.agent({ task: um.content, lang: engineLang(), signal: sig, onEvent: function (ev) {
        if (!ev) return;
        if (ev.type === "plan") a.steps = (ev.steps || []).map(function (s) { return { id: s.id, title: s.title, phase: s.phase, status: "pending" }; });
        else if (ev.type === "step") { var s = a.steps.find(function (x) { return x.id === ev.id; }); if (!s) { s = { id: ev.id }; a.steps.push(s); } s.status = ev.status; s.phase = ev.phase || s.phase; s.title = ev.title || s.title; }
        else if (ev.type === "artifact") a.artifacts.push({ name: ev.name, mime: ev.mime, content: String(ev.content || "") });
        else if (typeof ev.delta === "string") am.content += ev.delta;
        update(am);
      } }).then(function (r) { am.demo = !!(r && r.demo); a.status = "done"; })
        .catch(function () { a.status = "stopped"; a.steps.forEach(function (s) { if (s.status === "running") s.status = "error"; }); })
        .then(function () { finish(am); });
    }

    /* ---------- Voz ---------- */
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    function speakMsg(m, after) {
      ui.speakingId = m.id;
      V.speak(m.content, { lang: V.getLang(), onStart: function () { setStatus("speaking"); }, onEnd: function () { ui.speakingId = null; if (statusKey === "speaking") setStatus("status"); if (after) after(); } });
    }
    function listen() {
      if (!SR || !ui.voiceMode || ui.rec) return;
      var r = new SR(); r.lang = V.byCode(V.getLang()).sr; r.interimResults = true;
      var said = "";
      r.onresult = function (e) { said = ""; for (var i = 0; i < e.results.length; i++) said += e.results[i][0].transcript; input.value = said; autosize(); };
      r.onend = function () { ui.rec = null; if (said.trim() && ui.voiceMode) send(said); else if (ui.voiceMode) { setStatus("status"); } };
      r.onerror = function () { ui.rec = null; };
      try { r.start(); ui.rec = r; setStatus("listening"); } catch (e) { ui.rec = null; }
    }
    function toggleVoiceMode() {
      if (ui.voiceMode) { ui.voiceMode = false; if (ui.rec) try { ui.rec.abort(); } catch (e) { /* ignore */ } ui.rec = null; V.stop(); setStatus("status"); updateComposer(); return; }
      ui.voiceMode = true; updateComposer();
      if (!SR) { toast(tx("micNo")); var last = st.messages.slice().reverse().find(function (m) { return m.role === "assistant" && m.content; }); if (last) speakMsg(last); return; }
      listen();
    }
    function toggleDictation() {
      if (!SR) { toast(tx("micNo")); return; }
      if (ui.dictation) { ui.dictation.stop(); return; }
      var r = new SR(); r.lang = V.byCode(V.getLang()).sr; r.interimResults = true;
      var base = input.value;
      r.onresult = function (e) { var s = ""; for (var i = 0; i < e.results.length; i++) s += e.results[i][0].transcript; input.value = (base ? base + " " : "") + s; autosize(); updateComposer(); };
      r.onend = r.onerror = function () { ui.dictation = null; $("aceMic").classList.remove("on"); if (statusKey === "listening") setStatus("status"); };
      try { r.start(); ui.dictation = r; $("aceMic").classList.add("on"); setStatus("listening"); } catch (e) { ui.dictation = null; }
    }

    /* ---------- Hoja de voz e idioma ---------- */
    function voiceInfo(code) {
      if (V.ttsAvailable()) return tx("voiceServer");
      var v = V.pickVoice(code);
      if (!v) return tx("voiceNone");
      return tx("voiceLocal") + v.name.replace(/\s*\(.*?\)\s*/g, " ").trim();
    }
    function openSheet() {
      var cur = V.getLang();
      $("aceSheet").innerHTML = '<div class="ace-sheet-h"><div><strong id="aceSheetTitle">' + esc(tx("voiceTitle")) + "</strong><small>" + esc(tx("voiceNote")) + '</small></div><button type="button" class="ace-ib" data-sheet-close aria-label="' + esc(tx("close")) + '">' + icon("close") + '</button></div><div class="ace-langs" role="listbox">' +
        V.LANGS.map(function (l) { return '<button type="button" role="option" class="ace-lang' + (l.code === cur ? " on" : "") + '" data-lang="' + l.code + '" aria-selected="' + (l.code === cur) + '"><span class="fl">' + V.flagSvg(l.code, 30) + '</span><span class="nm"><strong>' + esc(l.name) + "</strong><small>♀ " + esc(tx("female")) + '</small></span><span class="ck">' + (l.code === cur ? icon("check") : "") + "</span></button>"; }).join("") +
        '</div><div class="ace-sheet-f"><small id="aceVoiceInfo">' + esc(voiceInfo(cur)) + '</small><button type="button" class="ace-test" data-test>' + icon("play") + "<span>" + esc(tx("test")) + "</span></button></div>";
      $("aceSheetWrap").hidden = false;
      var on = $("aceSheet").querySelector(".ace-lang.on"); if (on) setTimeout(function () { try { on.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30);
    }
    function closeSheet() { $("aceSheetWrap").hidden = true; try { $("aceLangBtn").focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    function testVoice() {
      var code = V.getLang(), L = V.byCode(code);
      V.speak(TEST_TEXT[code] || (TX[L.ui] || TX.es).testText, { lang: code, onStart: function () { setStatus("speaking"); }, onEnd: function () { setStatus("status"); } });
    }

    /* ---------- Visor de archivos ---------- */
    function viewFile(f) {
      var vw = $("aceViewer");
      var isHtml = f.mime === "text/html";
      vw.innerHTML = '<div class="ace-viewer-h"><strong>' + esc(f.name) + '</strong><button type="button" class="ace-ib" data-vclose aria-label="' + esc(tx("close")) + '">' + icon("close") + "</button></div>" +
        (isHtml ? '<iframe sandbox="" title="' + esc(f.name) + '"></iframe>' : '<div class="ace-viewer-b">' + (f.mime === "text/markdown" ? '<div class="md">' + MD.render(f.content) + "</div>" : MD.render("```" + (f.name.split(".").pop()) + "\n" + f.content + "\n```")) + "</div>");
      if (isHtml) vw.querySelector("iframe").srcdoc = f.content;
      vw.hidden = false;
    }
    function dl(f) {
      var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([f.content], { type: (f.mime || "text/plain") + ";charset=utf-8" })); a.download = f.name;
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }
    function copy(text) {
      try { if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text); } catch (e) { /* ignore */ }
      var ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) { /* ignore */ } ta.remove(); return Promise.resolve();
    }
    function toast(msg) {
      var t = document.createElement("div"); t.className = "ace-toast"; t.textContent = msg; root.appendChild(t);
      setTimeout(function () { t.remove(); }, 2800);
    }

    /* ---------- Pantalla completa: la conversación sigue en /app/ ---------- */
    function openFull(e) {
      var msgs = st.messages.filter(function (m) { return !m.streaming && (m.content || m.agent); });
      if (!msgs.length) return;
      e.preventDefault();
      try {
        var KEYAPP = "ac.app.v1", app = JSON.parse(localStorage.getItem(KEYAPP) || "null") || {};
        app.chats = Array.isArray(app.chats) ? app.chats : [];
        var first = msgs.find(function (m) { return m.role === "user"; });
        var title = first ? first.content.replace(/\s+/g, " ").slice(0, 42) : "AgentiCuántico";
        var id = st.appChatId && app.chats.some(function (c) { return c.id === st.appChatId; }) ? st.appChatId : uid();
        var now = Date.now();
        var chat = { id: id, title: title, createdAt: now, updatedAt: now, projectId: null, messages: msgs.map(function (m) { var c = { id: m.id, role: m.role, content: m.content || "", ts: now }; if (m.demo) c.demo = true; if (m.agent) c.agent = { task: m.agent.task, steps: m.agent.steps, logs: [], artifacts: m.agent.artifacts, status: m.agent.status === "running" ? "stopped" : m.agent.status }; return c; }) };
        app.chats = app.chats.filter(function (c) { return c.id !== id; }); app.chats.unshift(chat);
        app.mode = st.mode;
        localStorage.setItem(KEYAPP, JSON.stringify(app));
        sessionStorage.setItem("ac.app.open", id);
        st.appChatId = id; save();
      } catch (err) { /* ignore */ }
      location.href = "/app/";
    }

    /* ---------- Eventos ---------- */
    $("aceForm").addEventListener("submit", function (e) { e.preventDefault(); send(); });
    input.addEventListener("input", function () { autosize(); updateComposer(); });
    input.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !window.matchMedia("(pointer: coarse)").matches) { e.preventDefault(); send(); } });
    $("aceStop").onclick = function () { if (ui.ctrl) ui.ctrl.abort(); };
    $("aceMic").onclick = toggleDictation;
    $("aceVoice").onclick = toggleVoiceMode;
    $("aceModes").onclick = function (e) { var b = e.target.closest("[data-mode]"); if (b) setMode(b.getAttribute("data-mode")); };
    $("aceLangBtn").onclick = openSheet;
    $("aceOpen").onclick = openFull;
    $("aceClear").onclick = function () { if (ui.ctrl) ui.ctrl.abort(); V.stop(); st.messages = []; st.appChatId = null; save(); renderAll(); setStatus("status"); };
    $("aceSheetWrap").addEventListener("click", function (e) {
      if (e.target === $("aceSheetWrap") || e.target.closest("[data-sheet-close]")) { closeSheet(); return; }
      var l = e.target.closest("[data-lang]");
      if (l) { V.setLang(l.getAttribute("data-lang")); openSheet(); return; }
      if (e.target.closest("[data-test]")) testVoice();
    });
    $("aceViewer").addEventListener("click", function (e) { if (e.target.closest("[data-vclose]")) { $("aceViewer").hidden = true; $("aceViewer").innerHTML = ""; } });
    root.addEventListener("keydown", function (e) { if (e.key === "Escape") { if (!$("aceSheetWrap").hidden) closeSheet(); else if (!$("aceViewer").hidden) { $("aceViewer").hidden = true; } } });
    thread.addEventListener("click", function (e) {
      var sg = e.target.closest("[data-sugg]");
      if (sg) { if (sg.getAttribute("data-sugg") === "agent") setMode("agent"); send(sg.textContent); return; }
      var cc = e.target.closest("[data-copy-code]");
      if (cc) { copy(cc.closest(".codeblock").querySelector("code").textContent).then(function () { var sp = cc.querySelector("span"); if (sp) { sp.textContent = tx("copied"); setTimeout(function () { sp.textContent = tx("copy"); }, 1400); } }); return; }
      var el = e.target.closest(".ace-msg"); if (!el) return;
      var m = st.messages.find(function (x) { return x.id === el.getAttribute("data-id"); }); if (!m) return;
      var b;
      if ((b = e.target.closest("[data-copy]"))) copy(m.content).then(function () { b.innerHTML = icon("check"); setTimeout(function () { b.innerHTML = icon("copy"); }, 1300); });
      else if ((b = e.target.closest("[data-speak]"))) { if (ui.speakingId === m.id) { V.stop(); ui.speakingId = null; setStatus("status"); } else speakMsg(m); }
      else if ((b = e.target.closest("[data-view]"))) viewFile(m.agent.artifacts[+b.getAttribute("data-view")]);
      else if ((b = e.target.closest("[data-dl]"))) dl(m.agent.artifacts[+b.getAttribute("data-dl")]);
    });
    V.onChange(function () { applyTexts(); if (!st.messages.length) renderAll(); });
    if (window.speechSynthesis) try { speechSynthesis.addEventListener("voiceschanged", function () { var i = root.querySelector("#aceVoiceInfo"); if (i) i.textContent = voiceInfo(V.getLang()); }); } catch (e) { /* ignore */ }

    st.messages = st.messages.filter(function (m) { return m.content || m.agent; });
    st.messages.forEach(function (m) { m.streaming = false; m.pending = false; if (m.agent && m.agent.status === "running") m.agent.status = "stopped"; });
    applyTexts(); renderAll(); updateComposer();
    E.init().then(function () { setStatus("status"); window.AC_onConnection = function () { setStatus(statusKey); }; });

    return { send: send, setMode: setMode, openSheet: openSheet, focus: function () { try { input.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } };
  }

  window.AC_EMBED = { mount: mount };
})();
