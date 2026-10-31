/* AgentiCuántico · app de chat y agente */
(function () {
  "use strict";
  var CFG = window.AC_CONFIG || {}, I18N = window.AC_I18N, MD = window.AC_MD, E = window.AC_ENGINE;
  var $ = function (id) { return document.getElementById(id); };
  var esc = MD.esc;

  /* ---------- Íconos (trazos propios) ---------- */
  var ICONS = {
    sidebar: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="M13.5 6.5l4 4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>',
    agent: '<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4M9 13h.01M15 13h.01M9.5 16h5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/><path d="M19 17l.6 1.4L21 19l-1.4.6L19 21l-.6-1.4L17 19l1.4-.6Z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    chevronRight: '<path d="M9 6l6 6-6 6"/>',
    share: '<path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    tools: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    wave: '<path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/>',
    arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    arrowDown: '<path d="M12 5v14M5 12l7 7 7-7"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    thumbUp: '<path d="M7 10v10H4V10h3Zm0 0l4-7a2 2 0 0 1 3 2l-1 5h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 20H7"/>',
    thumbDown: '<path d="M17 14V4h3v10h-3Zm0 0l-4 7a2 2 0 0 1-3-2l1-5H6a2 2 0 0 1-2-2.3l1.2-6A2 2 0 0 1 7.2 4H17"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
    speaker: '<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    more: '<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z"/>',
    bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6Z"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 18h.01M12 18h4"/>',
    code: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>',
    login: '<path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M14 17l5-5-5-5M19 12H8"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01"/>',
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>'
  };
  function icon(n) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n] || "") + "</svg>"; }
  function hydrateIcons(root) {
    (root || document).querySelectorAll("svg[data-icon]").forEach(function (s) {
      s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true");
      s.innerHTML = ICONS[s.getAttribute("data-icon")] || ""; s.removeAttribute("data-icon");
    });
  }

  /* ---------- Estado ---------- */
  var KEY = "ac.app.v1";
  function detectLang() { var l = (navigator.language || "es").slice(0, 2); return l === "en" ? "en" : l === "pt" ? "pt" : "es"; }
  var state = (function () {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { s = null; }
    s = s && typeof s === "object" ? s : {};
    s.chats = Array.isArray(s.chats) ? s.chats : [];
    s.projects = Array.isArray(s.projects) ? s.projects : [];
    s.settings = Object.assign({ theme: "light", lang: detectLang(), voice: "female" }, s.settings || {});
    s.mode = s.mode === "deep" || s.mode === "agent" ? s.mode : "fast";
    s.sbCollapsed = !!s.sbCollapsed;
    return s;
  })();
  var ui = { currentId: null, activeProject: null, ctrl: null, attachments: [], editingId: null, apMsgId: null, apTab: "plan", apFile: 0, user: null, voice: null, renderQ: {} };
  var saveTimer = null;
  function save(now) {
    clearTimeout(saveTimer);
    var doit = function () {
      try { localStorage.setItem(KEY, JSON.stringify(state)); }
      catch (e) {
        // cuota llena: soltar las imágenes adjuntas y los chats más viejos
        state.chats.forEach(function (c) { c.messages.forEach(function (m) { (m.attachments || []).forEach(function (a) { delete a.dataUrl; }); }); });
        while (state.chats.length > 20) state.chats.pop();
        try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e2) { /* sin espacio */ }
      }
    };
    if (now) doit(); else saveTimer = setTimeout(doit, 250);
  }

  function t(k, vars) {
    var d = I18N[state.settings.lang] || I18N.es, v = d[k];
    if (v == null) v = I18N.es[k];
    if (v == null) return k;
    if (vars && typeof v === "string") Object.keys(vars).forEach(function (n) { v = v.replace("{" + n + "}", vars[n]); });
    return v;
  }
  window.AC_T = t;
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function now() { return Date.now(); }
  function isMobile() { return window.matchMedia("(max-width: 767px)").matches; }
  function isWide() { return window.matchMedia("(min-width: 1100px)").matches; }
  function coarse() { return window.matchMedia("(pointer: coarse)").matches; }

  function currentChat() { return state.chats.find(function (c) { return c.id === ui.currentId; }) || null; }
  function sortChats() { state.chats.sort(function (a, b) { return b.updatedAt - a.updatedAt; }); }

  /* ---------- Tema e idioma ---------- */
  function applyTheme() {
    var th = state.settings.theme;
    if (th === "system") th = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", th);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", th === "dark" ? "#17171a" : "#EDEEF5");
  }
  function applyI18n() {
    document.documentElement.lang = state.settings.lang === "pt" ? "pt-BR" : state.settings.lang;
    document.querySelectorAll("[data-i18n]").forEach(function (el) { el.textContent = t(el.getAttribute("data-i18n")); });
    document.querySelectorAll("[data-i18n-title]").forEach(function (el) { var v = t(el.getAttribute("data-i18n-title")); el.title = v; el.setAttribute("aria-label", v); });
    updateModeUI();
  }

  /* ---------- Toasts y copiar ---------- */
  function toast(msg, ms) {
    var el = document.createElement("div"); el.className = "toast"; el.textContent = msg;
    $("toasts").appendChild(el);
    setTimeout(function () { el.remove(); }, ms || 2600);
  }
  function copyText(text) {
    var fallback = function () {
      var ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) { /* ignore */ }
      ta.remove();
    };
    try {
      if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).catch(fallback);
    } catch (e) { /* ignore */ }
    fallback(); return Promise.resolve();
  }
  function download(name, content, mime) {
    var blob = new Blob([content], { type: (mime || "text/plain") + ";charset=utf-8" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  /* ---------- Modo (Rápido / Razonamiento / Agente) ---------- */
  var MODES = [
    { id: "fast", icon: "bolt", name: "modeFast", desc: "modeFastD" },
    { id: "deep", icon: "bulb", name: "modeDeep", desc: "modeDeepD" },
    { id: "agent", icon: "agent", name: "modeAgent", desc: "modeAgentD" }
  ];
  function setMode(m) { state.mode = m; save(); updateModeUI(); renderThread(); }
  function updateModeUI() {
    var m = MODES.find(function (x) { return x.id === state.mode; });
    $("modelLabel").textContent = state.mode === "fast" ? "AgentiCuántico" : t(m.name);
    $("input").placeholder = state.mode === "agent" ? t("placeholderAgent") : t("placeholder");
    var chip = $("modeChip");
    if (state.mode === "fast") chip.hidden = true;
    else {
      chip.hidden = false;
      chip.innerHTML = icon(m.icon) + "<span>" + esc(t(m.name)) + '</span><button type="button" aria-label="' + esc(t("close")) + '">' + icon("close") + "</button>";
      chip.querySelector("button").onclick = function () { setMode("fast"); };
    }
  }
  function renderModelMenu() {
    $("modelMenu").innerHTML = MODES.map(function (m) {
      return '<button class="menu-item' + (state.mode === m.id ? " on" : "") + '" role="menuitemradio" data-mode="' + m.id + '">' + icon(m.icon) +
        '<span class="grow">' + esc(t(m.name)) + '<span class="desc">' + esc(t(m.desc)) + "</span></span>" + '<span class="check">' + icon("check") + "</span></button>";
    }).join("");
  }
  function renderToolsMenu() {
    var items = [
      ["agent", "toolAgent", function () { setMode(state.mode === "agent" ? "fast" : "agent"); }, state.mode === "agent"],
      ["bulb", "toolDeep", function () { setMode(state.mode === "deep" ? "fast" : "deep"); }, state.mode === "deep"],
      null,
      ["globe", "toolWeb", function () { setMode("agent"); insertPrefix(t("toolWebPrefix"), 5); }],
      ["calc", "toolCalc", function () { insertPrefix(t("toolCalcPrefix")); }],
      ["code", "toolFormat", function () { insertPrefix(t("toolFormatPrefix"), -5); }]
    ];
    var menu = $("toolsMenu");
    menu.innerHTML = "";
    items.forEach(function (it) {
      if (!it) { var s = document.createElement("div"); s.className = "menu-sep"; menu.appendChild(s); return; }
      var b = document.createElement("button");
      b.className = "menu-item" + (it[3] ? " on" : ""); b.type = "button"; b.setAttribute("role", "menuitem");
      b.innerHTML = icon(it[0]) + '<span class="grow">' + esc(t(it[1])) + "</span>" + (it.length > 3 ? '<span class="check">' + icon("check") + "</span>" : "");
      b.onclick = function () { closeMenus(); it[2](); };
      menu.appendChild(b);
    });
  }
  function insertPrefix(text, caretFromStart) {
    var inp = $("input");
    inp.value = text + (inp.value ? " " + inp.value : "");
    inp.focus();
    var pos = caretFromStart == null ? text.length : caretFromStart < 0 ? text.length + caretFromStart : caretFromStart + "https://".length;
    try { inp.setSelectionRange(pos, pos); } catch (e) { /* ignore */ }
    autosize(); updateComposer();
  }

  /* ---------- Menús ---------- */
  function closeMenus() {
    ["modelMenu", "toolsMenu", "accountMenu", "ctxMenu"].forEach(function (id) { $(id).hidden = true; });
    $("modelBtn").setAttribute("aria-expanded", "false");
  }
  function toggleMenu(id, beforeOpen) {
    var el = $(id), was = el.hidden;
    closeMenus();
    if (was) { if (beforeOpen) beforeOpen(); el.hidden = false; }
  }
  function placeFixed(menu, anchor, preferUp) {
    var r = anchor.getBoundingClientRect();
    menu.hidden = false;
    var mw = menu.offsetWidth, mh = menu.offsetHeight;
    var left = Math.min(Math.max(8, r.left), window.innerWidth - mw - 8);
    var top = preferUp ? r.top - mh - 6 : r.bottom + 4;
    if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6);
    if (top < 8) top = 8;
    menu.style.left = left + "px"; menu.style.top = top + "px";
  }

  /* ---------- Sidebar ---------- */
  function dayStart(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); }
  function groupOf(ts) {
    var today = dayStart(Date.now()), day = 86400000;
    if (ts >= today) return "today";
    if (ts >= today - day) return "yesterday";
    if (ts >= today - 7 * day) return "last7";
    if (ts >= today - 30 * day) return "last30";
    return "older";
  }
  function renderSidebar() {
    sortChats();
    var pl = $("projectList");
    pl.innerHTML = state.projects.map(function (p) {
      return '<div class="chat-link proj-link' + (ui.activeProject === p.id ? " active" : "") + '" role="button" tabindex="0" data-project="' + p.id + '">' + icon("folder") + '<span class="t">' + esc(p.name) + '</span><span class="more" role="button" tabindex="0" data-pmore="' + p.id + '" aria-label="…">' + icon("more") + "</span></div>";
    }).join("");
    var chats = state.chats.filter(function (c) { return !ui.activeProject || c.projectId === ui.activeProject; });
    var groups = {}, order = ["today", "yesterday", "last7", "last30", "older"];
    chats.forEach(function (c) { var g = groupOf(c.updatedAt); (groups[g] = groups[g] || []).push(c); });
    var html = '<div class="sb-head"><span>' + esc(ui.activeProject ? (state.projects.find(function (p) { return p.id === ui.activeProject; }) || {}).name || t("chats") : t("chats")) + "</span></div>";
    if (!chats.length) html += '<div class="sb-empty">' + esc(t("noChats")) + "</div>";
    order.forEach(function (g) {
      if (!groups[g]) return;
      html += '<div class="sb-group"><div class="sb-group-title">' + esc(t(g)) + "</div>" + groups[g].map(function (c) {
        return '<div class="chat-link' + (c.id === ui.currentId ? " active" : "") + '" role="button" tabindex="0" data-chat="' + c.id + '">' +
          (c.messages.some(function (m) { return m.agent; }) ? '<svg class="agent-dot" viewBox="0 0 24 24" aria-hidden="true">' + ICONS.agent + "</svg>" : "") +
          '<span class="t">' + esc(c.title || t("newChat")) + '</span><span class="more" role="button" tabindex="0" data-more="' + c.id + '" aria-label="…">' + icon("more") + "</span></div>";
      }).join("") + "</div>";
    });
    $("historySection").innerHTML = html;
  }
  function openDrawer() { $("app").classList.add("drawer-open"); $("backdrop").hidden = false; }
  function closeDrawer() { $("app").classList.remove("drawer-open"); $("backdrop").hidden = true; }
  function toggleSidebar() {
    if (isMobile()) { if ($("app").classList.contains("drawer-open")) closeDrawer(); else openDrawer(); return; }
    state.sbCollapsed = !state.sbCollapsed; save();
    $("app").classList.toggle("sb-collapsed", state.sbCollapsed);
  }

  /* ---------- Chats ---------- */
  function newChat(mode) {
    if (ui.ctrl) stopStreaming();
    ui.currentId = null; ui.editingId = null; ui.apMsgId = null;
    if (mode) state.mode = mode;
    closePanel();
    clearAttachments();
    renderAll();
    if (isMobile()) closeDrawer();
    if (!coarse()) $("input").focus();
  }
  function openChat(id) {
    if (ui.ctrl) stopStreaming();
    ui.currentId = id; ui.editingId = null;
    var c = currentChat();
    var lastAgent = c && c.messages.slice().reverse().find(function (m) { return m.agent; });
    ui.apMsgId = lastAgent ? lastAgent.id : null;
    if (!lastAgent || !isWide()) closePanel();
    renderAll();
    scrollToBottom(true);
    if (isMobile()) closeDrawer();
  }
  function createChat(firstText) {
    var c = { id: uid(), title: titleFrom(firstText), createdAt: now(), updatedAt: now(), projectId: ui.activeProject || null, messages: [] };
    state.chats.unshift(c); ui.currentId = c.id;
    return c;
  }
  function titleFrom(text) {
    var s = String(text || "").replace(/```[\s\S]*?```/g, " ").replace(/\s+/g, " ").trim();
    if (!s) return t("newChat");
    return s.length > 42 ? s.slice(0, 40).replace(/\s+\S*$/, "") + "…" : s;
  }
  function deleteChat(id) {
    state.chats = state.chats.filter(function (c) { return c.id !== id; });
    if (ui.currentId === id) { ui.currentId = null; closePanel(); }
    save(); renderAll();
  }

  /* ---------- Hilo ---------- */
  function renderAll() { renderSidebar(); renderThread(); updateTopbar(); updateComposer(); }
  function updateTopbar() {
    var c = currentChat();
    $("shareBtn").hidden = !(c && c.messages.length);
    $("computerBtn").hidden = !(c && c.messages.some(function (m) { return m.agent; })) || !$("agentPanel").hidden;
  }
  function renderThread() {
    var c = currentChat(), main = $("main");
    var empty = !c || !c.messages.length;
    main.classList.toggle("is-empty", empty);
    if (empty) {
      $("threadInner").innerHTML = "";
      $("greeting").textContent = state.mode === "agent" ? t("greetingAgent") : state.mode === "deep" ? t("greetingDeep") : t("greeting");
      var list = state.mode === "agent" ? t("suggAgent") : t("sugg");
      $("suggestions").innerHTML = list.map(function (s) { return '<button class="sugg" type="button">' + esc(s) + "</button>"; }).join("");
      $("scrollDown").hidden = true;
      return;
    }
    var inner = $("threadInner");
    inner.innerHTML = "";
    var lastA = -1;
    c.messages.forEach(function (m, i) { if (m.role === "assistant") lastA = i; });
    c.messages.forEach(function (m, i) { inner.appendChild(msgEl(m, i === lastA)); });
    hydrateIcons(inner);
  }

  function msgEl(m, isLastAssistant) {
    var el = document.createElement("div");
    el.className = "msg " + m.role + (isLastAssistant ? " last" : "");
    el.setAttribute("data-id", m.id);
    if (m.role === "user") {
      if (ui.editingId === m.id) {
        el.innerHTML = '<div class="edit-box"><textarea>' + esc(m.content) + '</textarea><div class="row"><button class="btn" type="button" data-act="cancelEdit">' + esc(t("cancel")) + '</button><button class="btn primary" type="button" data-act="saveEdit">' + esc(t("send")) + "</button></div></div>";
        setTimeout(function () { var ta = el.querySelector("textarea"); if (ta) { ta.focus(); ta.style.height = ta.scrollHeight + "px"; } }, 0);
        return el;
      }
      var files = (m.attachments || []).map(fileChip).join("");
      el.innerHTML = (files ? '<div class="files">' + files + "</div>" : "") + '<div class="bubble">' + esc(m.content) + "</div>" +
        '<div class="msg-actions">' + actBtn("copy", "copy") + actBtn("edit", "edit") + "</div>";
      return el;
    }
    el.innerHTML = '<div class="a-row"><img class="a-avatar' + (m.streaming ? " busy" : "") + '" src="/media/agenticuantico-avatar.jpg" alt="" width="30" height="30"><div class="a-body">' + bodyHtml(m) + "</div></div>" + actionsHtml(m, isLastAssistant);
    return el;
  }
  function actBtn(act, ic, on, label) { return '<button class="icon-btn' + (on ? " on" : "") + '" type="button" data-act="' + act + '" title="' + esc(t(label || act)) + '" aria-label="' + esc(t(label || act)) + '">' + icon(ic) + "</button>"; }
  function actionsHtml(m, isLast) {
    if (m.streaming) return "";
    return '<div class="msg-actions">' + actBtn("copy", "copy") + actBtn("good", "thumbUp", m.feedback === "good") + actBtn("bad", "thumbDown", m.feedback === "bad") +
      actBtn("speak", "speaker", false, "readAloud") + (isLast ? actBtn("regenerate", "refresh") : "") + "</div>";
  }
  function fileChip(a, i, removable) {
    return '<span class="file-chip">' + (a.dataUrl ? '<img src="' + esc(a.dataUrl) + '" alt="">' : icon("file")) + '<span class="nm">' + esc(a.name) + "</span>" +
      (removable === true ? '<button type="button" data-rm="' + i + '" aria-label="' + esc(t("del")) + '">' + icon("close") + "</button>" : "") + "</span>";
  }
  function bodyHtml(m) {
    var h = "";
    if (m.agent) h += taskCardHtml(m) + deliverablesHtml(m);
    else if (m.mode === "deep" && m.thinkMs != null) {
      h += '<button class="reason" type="button" data-act="toggleReason">' + esc(t("reasonedFor", { s: Math.max(1, Math.round(m.thinkMs / 1000)) })) + icon("chevronRight") + "</button>";
      h += '<div class="reason-body" hidden>' + esc(reasoningSummary(m)) + "</div>";
    }
    if (m.notice) h += noticeHtml(m.notice);
    if (m.pending && !m.agent) h += '<div class="shimmer">' + esc(t("thinking")) + "…</div>";
    if (m.content) h += '<div class="md' + (m.streaming ? " cursor-host" : "") + '">' + MD.render(m.content) + "</div>";
    if (m.stopped) h += '<div class="stopped-tag">' + esc(t("stopped")) + "</div>";
    return h;
  }
  function reasoningSummary(m) {
    var L = state.settings.lang;
    return L === "en" ? "• Understood the question and its context\n• Considered alternatives and checked assumptions\n• Structured a clear answer"
      : L === "pt" ? "• Entendi a pergunta e o contexto\n• Considerei alternativas e verifiquei suposições\n• Estruturei uma resposta clara"
      : "• Entendí la pregunta y su contexto\n• Consideré alternativas y verifiqué supuestos\n• Estructuré una respuesta clara";
  }
  function noticeHtml(n) {
    var text = n === "login" ? t("needLogin") : n === "upgrade" ? t("needUpgrade") : n === "quota" ? t("quota") : t("fallbackNote");
    var btn = n === "login" || n === "quota" ? '<button class="btn" type="button" data-act="login">' + esc(t("login")) + "</button>" : n === "upgrade" ? '<button class="btn lime" type="button" data-act="upgrade">' + esc(t("upgrade")) + "</button>" : "";
    return '<div class="notice">' + icon("help") + "<span>" + esc(text) + "</span>" + btn + "</div>";
  }

  /* --- Tarjeta de tarea del agente --- */
  function phaseLabel(p) { return t("phase_" + (p || "thinking")); }
  function stIcon(status) { return '<span class="st ' + (status || "") + '">' + (status === "done" ? icon("check") : status === "error" ? icon("close") : "") + "</span>"; }
  function agentCounts(a) { var done = a.steps.filter(function (s) { return s.status === "done" || s.status === "error"; }).length; return { done: done, total: Math.max(a.steps.length, 1) }; }
  function taskCardHtml(m) {
    var a = m.agent, cnt = agentCounts(a), running = a.status === "running";
    var cur = a.steps.find(function (s) { return s.status === "running"; });
    var title = running ? t("agentWorking") : a.status === "stopped" ? t("agentStopped") : t("agentDone");
    var sub = running && cur ? phaseLabel(cur.phase) + " · " + cur.title : running && !a.steps.length ? t("thinking") + "…" : t("stepsOf", { a: cnt.done, b: a.steps.length || 0 });
    var steps = a.steps.length ? a.steps : [{ id: 0, title: t("thinking") + "…", status: "running", phase: "thinking" }];
    return '<div class="task-card"><div class="task-head">' + stIcon(running ? "running" : a.status === "stopped" ? "error" : "done") +
      '<div class="ttl">' + esc(title) + "<small>" + esc(sub) + '</small></div></div><div class="progress"><i style="width:' + Math.round((cnt.done / cnt.total) * 100) + '%"></i></div>' +
      '<ul class="task-steps">' + steps.map(function (s) {
        return '<li class="' + (s.status || "") + '">' + stIcon(s.status) + '<span class="t">' + esc(s.title) + '</span><span class="phase-tag p-' + esc(s.phase || "thinking") + '">' + esc(phaseLabel(s.phase)) + "</span></li>";
      }).join("") + '</ul><div class="task-foot"><button class="btn" type="button" data-act="openComputer">' + icon("monitor") + esc(t("viewComputer")) + "</button></div></div>";
  }
  function deliverablesHtml(m) {
    var arts = m.agent.artifacts || [];
    if (!arts.length) return "";
    return '<div class="deliverables">' + arts.map(function (f, i) {
      return '<div class="deliv"><span class="ic">' + icon(f.mime === "text/html" ? "globe" : f.mime === "text/markdown" ? "file" : "code") + '</span><div class="meta"><strong>' + esc(f.name) + "</strong><small>" + esc(kindLabel(f)) + " · " + fmtSize(f.content.length) + '</small></div><div class="acts">' +
        '<button class="icon-btn" type="button" data-act="viewFile" data-file="' + i + '" title="' + esc(t("view")) + '" aria-label="' + esc(t("view")) + '">' + icon("eye") + "</button>" +
        '<button class="icon-btn" type="button" data-act="dlFile" data-file="' + i + '" title="' + esc(t("download")) + '" aria-label="' + esc(t("download")) + '">' + icon("download") + "</button></div></div>";
    }).join("") + "</div>";
  }
  function kindLabel(f) { return f.mime === "text/html" ? "HTML" : f.mime === "text/markdown" ? "Markdown" : f.mime === "text/x-python" ? "Python" : f.mime === "text/javascript" ? "JavaScript" : "Texto"; }
  function fmtSize(n) { return n < 1024 ? n + " B" : (n / 1024).toFixed(1) + " KB"; }

  /* --- Render incremental durante el streaming --- */
  function scheduleMsg(m) {
    if (ui.renderQ[m.id]) return;
    ui.renderQ[m.id] = requestAnimationFrame(function () {
      delete ui.renderQ[m.id];
      var el = document.querySelector('.msg[data-id="' + m.id + '"]');
      if (!el) return;
      var stick = nearBottom();
      el.querySelector(".a-body").innerHTML = bodyHtml(m);
      var md = el.querySelector(".md.cursor-host");
      if (md) { var last = md.lastElementChild; if (last && !last.classList.contains("codeblock")) last.classList.add("cursor"); }
      var av = el.querySelector(".a-avatar"); if (av) av.classList.toggle("busy", !!m.streaming);
      if (stick) scrollToBottom();
      if (m.agent && ui.apMsgId === m.id && !$("agentPanel").hidden) renderPanel();
    });
  }
  function rerenderMsg(m) {
    var c = currentChat(); if (!c) return;
    var el = document.querySelector('.msg[data-id="' + m.id + '"]');
    if (!el) return renderThread();
    var lastA = -1; c.messages.forEach(function (x, i) { if (x.role === "assistant") lastA = i; });
    var nel = msgEl(m, c.messages.indexOf(m) === lastA);
    el.replaceWith(nel); hydrateIcons(nel);
  }
  function nearBottom() { var th = $("thread"); return th.scrollHeight - th.scrollTop - th.clientHeight < 120; }
  function scrollToBottom() { var th = $("thread"); th.scrollTop = th.scrollHeight; }

  /* ---------- Envío ---------- */
  function toApi(messages) {
    return messages.filter(function (m) { return (m.role === "user" || m.role === "assistant") && (m.content || m.attachments) && !m.pending; }).slice(-30).map(function (m) {
      var content = m.content || "";
      (m.attachments || []).forEach(function (a) {
        content += a.text != null ? "\n\n[Archivo: " + a.name + "]\n```\n" + a.text.slice(0, 8000) + "\n```" : "\n\n[Imagen adjunta: " + a.name + "]";
      });
      if (m.agent && m.agent.artifacts && m.agent.artifacts.length) content += "\n\n(" + m.agent.artifacts.map(function (f) { return f.name; }).join(", ") + ")";
      return { role: m.role, content: content };
    });
  }
  function send(text) {
    text = String(text == null ? $("input").value : text).trim();
    if ((!text && !ui.attachments.length) || ui.ctrl) return;
    var c = currentChat() || createChat(text || (ui.attachments[0] && ui.attachments[0].name));
    var um = { id: uid(), role: "user", content: text, ts: now() };
    if (ui.attachments.length) um.attachments = ui.attachments.slice();
    c.messages.push(um); c.updatedAt = now();
    $("input").value = ""; clearAttachments(); autosize();
    if (state.mode === "agent") runAgent(c, um); else runChat(c);
  }
  function startRun(c, am) {
    c.messages.push(am); c.updatedAt = now();
    ui.ctrl = new AbortController();
    renderAll(); scrollToBottom(true);
    return ui.ctrl.signal;
  }
  function finishRun(c, am) {
    am.streaming = false; am.pending = false; ui.ctrl = null;
    c.updatedAt = now(); save(true);
    rerenderMsg(am); updateComposer(); updateTopbar(); renderSidebar();
    if (am.agent && ui.apMsgId === am.id && !$("agentPanel").hidden) renderPanel();
    if (ui.voice && ui.voice.active) voiceSpeak(am.content);
  }
  function runChat(c) {
    var mode = state.mode === "deep" ? "deep" : "fast";
    var am = { id: uid(), role: "assistant", content: "", mode: mode, pending: true, streaming: true, ts: now() };
    var history = toApi(c.messages);
    var signal = startRun(c, am), t0 = now();
    E.chat({ messages: history, mode: mode, lang: state.settings.lang, signal: signal, onDelta: function (d) {
      if (am.pending) { am.pending = false; am.thinkMs = now() - t0; }
      am.content += d; scheduleMsg(am);
    } }).then(function (r) {
      am.demo = !!r.demo; if (r.notice) am.notice = r.notice;
      if (r.notice === "fallback") updateConnChip();
    }).catch(function (e) {
      if (e && e.name === "AbortError") am.stopped = true;
      else if (!am.content) am.content = E._demoAnswer("", state.settings.lang);
    }).then(function () { finishRun(c, am); });
  }
  function runAgent(c, um) {
    var am = { id: uid(), role: "assistant", content: "", streaming: true, ts: now(), agent: { task: um.content, steps: [], logs: [], artifacts: [], status: "running", startedAt: now() } };
    var signal = startRun(c, am);
    ui.apMsgId = am.id; ui.apTab = "plan"; ui.apFile = 0;
    if (isWide()) openPanel();
    var a = am.agent;
    E.agent({ task: um.content + toApi([um])[0].content.slice(um.content.length), lang: state.settings.lang, signal: signal, onEvent: function (ev) {
      if (!ev) return;
      if (ev.type === "plan") a.steps = (ev.steps || []).map(function (s) { return { id: s.id, title: s.title, phase: s.phase, status: "pending" }; });
      else if (ev.type === "step") {
        var s = a.steps.find(function (x) { return x.id === ev.id; });
        if (!s) { s = { id: ev.id, title: ev.title, phase: ev.phase, status: ev.status }; a.steps.push(s); }
        s.status = ev.status; s.phase = ev.phase || s.phase; s.title = ev.title || s.title;
      } else if (ev.type === "log") a.logs.push({ id: ev.id, text: String(ev.text || "").slice(0, 4000) });
      else if (ev.type === "artifact") { a.artifacts.push({ name: ev.name, mime: ev.mime, content: String(ev.content || "") }); if (ui.apMsgId === am.id) ui.apFile = a.artifacts.length - 1; }
      else if (typeof ev.delta === "string") am.content += ev.delta;
      else if (ev.type === "done") a.status = "done";
      scheduleMsg(am);
    } }).then(function (r) {
      am.demo = !!(r && r.demo); if (r && r.notice) am.notice = r.notice;
      a.status = "done"; a.endedAt = now();
      if (r && r.notice === "fallback") updateConnChip();
    }).catch(function (e) {
      a.status = "stopped"; am.stopped = !!(e && e.name === "AbortError");
      a.steps.forEach(function (s) { if (s.status === "running") s.status = "error"; });
    }).then(function () { finishRun(c, am); if (isWide() && ui.apMsgId === am.id && a.artifacts.length) { ui.apTab = "files"; renderPanel(); } });
  }
  function stopStreaming() { if (ui.ctrl) ui.ctrl.abort(); }
  function regenerate(m) {
    var c = currentChat(); if (!c || ui.ctrl) return;
    var i = c.messages.indexOf(m); if (i < 1) return;
    var um = c.messages[i - 1];
    c.messages.splice(i);
    if (m.agent) runAgent(c, um); else runChat(c);
  }
  function saveEdit(m, text) {
    var c = currentChat(); if (!c || ui.ctrl) return;
    text = text.trim(); if (!text) return;
    var i = c.messages.indexOf(m);
    var wasAgent = c.messages[i + 1] && c.messages[i + 1].agent;
    m.content = text; ui.editingId = null;
    c.messages.splice(i + 1);
    if (i === 0) c.title = titleFrom(text);
    if (wasAgent || (!c.messages[i + 1] && state.mode === "agent")) runAgent(c, m); else runChat(c);
  }

  /* ---------- Composer ---------- */
  function autosize() { var ta = $("input"); ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, window.innerHeight * 0.4) + "px"; }
  function updateComposer() {
    var has = $("input").value.trim().length > 0 || ui.attachments.length > 0, busy = !!ui.ctrl;
    $("stopBtn").hidden = !busy;
    $("sendBtn").hidden = busy || !has;
    $("voiceBtn").hidden = busy || has;
  }
  function clearAttachments() { ui.attachments = []; renderAttachments(); }
  function renderAttachments() {
    var box = $("attachments");
    box.hidden = !ui.attachments.length;
    box.innerHTML = ui.attachments.map(function (a, i) { return fileChip(a, i, true); }).join("");
    updateComposer();
  }
  function addFiles(files) {
    Array.prototype.forEach.call(files, function (f) {
      if (/^image\//.test(f.type)) {
        var r = new FileReader();
        r.onload = function () {
          var img = new Image();
          img.onload = function () {
            var s = Math.min(1, 160 / Math.max(img.width, img.height)), cv = document.createElement("canvas");
            cv.width = Math.max(1, Math.round(img.width * s)); cv.height = Math.max(1, Math.round(img.height * s));
            cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
            ui.attachments.push({ name: f.name, size: f.size, kind: "image", dataUrl: cv.toDataURL("image/jpeg", 0.7) }); renderAttachments();
          };
          img.onerror = function () { ui.attachments.push({ name: f.name, size: f.size, kind: "image" }); renderAttachments(); };
          img.src = r.result;
        };
        r.readAsDataURL(f);
      } else {
        if (f.size > 200 * 1024) { toast(t("fileTooBig")); return; }
        var rt = new FileReader();
        rt.onload = function () { ui.attachments.push({ name: f.name, size: f.size, kind: "text", text: String(rt.result || "") }); renderAttachments(); };
        rt.readAsText(f);
      }
    });
  }

  /* ---------- Panel del agente ---------- */
  function openPanel(tab) {
    if (tab) ui.apTab = tab;
    $("agentPanel").hidden = false;
    $("app").classList.add("panel-open");
    if (!isWide()) $("backdrop").hidden = isMobile();
    renderPanel(); updateTopbar();
  }
  function closePanel() { $("agentPanel").hidden = true; $("app").classList.remove("panel-open"); if (!$("app").classList.contains("drawer-open")) $("backdrop").hidden = true; updateTopbar(); }
  function panelMsg() { var c = currentChat(); return c && c.messages.find(function (m) { return m.id === ui.apMsgId; }); }
  function renderPanel() {
    var m = panelMsg(), body = $("apBody");
    if (!m || !m.agent) { body.innerHTML = '<p class="ap-empty">' + esc(t("noFiles")) + "</p>"; return; }
    var a = m.agent, cnt = agentCounts(a), running = a.status === "running";
    var cur = a.steps.find(function (s) { return s.status === "running"; });
    var html = '<div class="ap-task"><strong>' + esc(a.task.slice(0, 220)) + "</strong></div>" +
      '<div class="ap-status"><span>' + (running ? '<span class="shimmer">' + esc(cur ? phaseLabel(cur.phase) + "…" : t("thinking") + "…") + "</span>" : esc(a.status === "stopped" ? t("agentStopped") : t("agentDone"))) + "</span><span>" + (a.steps.length ? esc(t("stepsOf", { a: cnt.done, b: a.steps.length })) : "") + "</span></div>" +
      '<div class="progress"><i style="width:' + Math.round((cnt.done / cnt.total) * 100) + '%"></i></div>' +
      '<div class="tabs" role="tablist">' + [["plan", t("plan")], ["computer", t("computerTab")], ["files", t("files") + (a.artifacts.length ? " (" + a.artifacts.length + ")" : "")]].map(function (x) {
        return '<button class="tab' + (ui.apTab === x[0] ? " on" : "") + '" type="button" role="tab" data-tab="' + x[0] + '">' + esc(x[1]) + "</button>";
      }).join("") + "</div>";
    if (ui.apTab === "plan") {
      html += '<ul class="plan-list">' + a.steps.map(function (s) {
        var logs = a.logs.filter(function (l) { return l.id === s.id; });
        var last = logs.length ? logs[logs.length - 1].text : "";
        return '<li class="' + (s.status || "") + '">' + stIcon(s.status) + '<div class="row"><span>' + esc(s.title) + '</span><span class="phase-tag p-' + esc(s.phase) + '">' + esc(phaseLabel(s.phase)) + "</span></div>" + (last ? '<div class="log">' + esc(last.slice(0, 400)) + "</div>" : "") + "</li>";
      }).join("") + "</ul>";
    } else if (ui.apTab === "computer") {
      html += '<div class="computer"><div class="computer-bar"><i></i><i></i><i></i><span>agente@agenticuantico: ~/tarea</span></div><div class="terminal" id="terminal">' +
        a.logs.map(function (l) {
          var s = a.steps.find(function (x) { return x.id === l.id; }) || {};
          return '<div class="ln"><span class="pr">›</span> <span class="ph">[' + esc(phaseLabel(s.phase)) + "]</span> " + esc(s.title || "") + "\n" + esc(l.text) + "</div>";
        }).join("") + (running ? '<span class="pr">▍</span>' : "") + "</div></div>";
    } else {
      if (!a.artifacts.length) html += '<p class="ap-empty">' + esc(t("noFiles")) + "</p>";
      else {
        var fi = Math.min(ui.apFile, a.artifacts.length - 1), f = a.artifacts[fi];
        html += '<div class="file-tabs">' + a.artifacts.map(function (x, i) { return '<button class="file-tab' + (i === fi ? " on" : "") + '" type="button" data-fi="' + i + '">' + esc(x.name) + "</button>"; }).join("") + "</div>" +
          '<div class="file-acts"><button class="btn" type="button" data-pact="copy">' + icon("copy") + esc(t("copy")) + '</button><button class="btn" type="button" data-pact="dl">' + icon("download") + esc(t("download")) + "</button>" +
          (f.mime === "text/html" ? '<button class="btn" type="button" data-pact="preview">' + icon(ui.apPreview ? "code" : "eye") + esc(ui.apPreview ? t("code") : t("preview")) + "</button>" : "") + "</div>" +
          '<div class="file-view">' + (f.mime === "text/html" && ui.apPreview ? '<iframe class="preview-frame" sandbox="" title="' + esc(f.name) + '"></iframe>' : f.mime === "text/markdown" ? '<div class="md">' + MD.render(f.content) + "</div>" : MD.render("```" + (f.name.split(".").pop() || "") + "\n" + f.content + "\n```")) + "</div>";
      }
    }
    body.innerHTML = html;
    hydrateIcons(body);
    var fr = body.querySelector(".preview-frame");
    if (fr) { var ff = a.artifacts[Math.min(ui.apFile, a.artifacts.length - 1)]; fr.srcdoc = ff.content; }
    var term = $("terminal"); if (term) term.scrollTop = term.scrollHeight;
  }

  /* ---------- Modales ---------- */
  function modal(title, bodyHtml, opts) {
    opts = opts || {};
    var root = $("modalRoot");
    root.innerHTML = '<div class="modal' + (opts.wide ? " wide" : "") + '" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><div class="modal-head"><h2>' + esc(title) + '</h2><button class="icon-btn" type="button" data-close aria-label="' + esc(t("close")) + '">' + icon("close") + '</button></div><div class="modal-body">' + bodyHtml + "</div></div>";
    root.hidden = false;
    hydrateIcons(root);
    root.onclick = function (e) { if (e.target === root || e.target.closest("[data-close]")) closeModal(); };
    var first = root.querySelector("input, textarea"); if (first && !coarse()) setTimeout(function () { first.focus(); }, 30);
    return root.querySelector(".modal");
  }
  function closeModal() { $("modalRoot").hidden = true; $("modalRoot").innerHTML = ""; }
  function promptModal(title, label, value, onOk) {
    var m = modal(title, '<form id="pmForm"><div class="field"><label for="pmInput">' + esc(label) + '</label><input class="input" id="pmInput" maxlength="80" value="' + esc(value || "") + '"></div><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" type="button" data-close>' + esc(t("cancel")) + '</button><button class="btn primary" type="submit">' + esc(t("save")) + "</button></div></form>");
    m.querySelector("#pmForm").onsubmit = function (e) { e.preventDefault(); var v = m.querySelector("#pmInput").value.trim(); if (v) { closeModal(); onOk(v); } };
  }
  function confirmModal(text, onOk) {
    var m = modal(text, '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" type="button" data-close>' + esc(t("cancel")) + '</button><button class="btn primary" type="button" id="cfOk">' + esc(t("del")) + "</button></div>");
    m.querySelector("#cfOk").onclick = function () { closeModal(); onOk(); };
  }

  function openSearch() {
    var m = modal(t("searchChats"), '<input class="input" id="srch" placeholder="' + esc(t("searchPh")) + '" type="search"><div class="search-results" id="srchRes"></div>');
    var inp = m.querySelector("#srch"), res = m.querySelector("#srchRes");
    var run = function () {
      var q = inp.value.trim().toLowerCase();
      var list = state.chats.filter(function (c) { return !q || (c.title || "").toLowerCase().indexOf(q) >= 0 || c.messages.some(function (x) { return (x.content || "").toLowerCase().indexOf(q) >= 0; }); }).slice(0, 40);
      res.innerHTML = list.length ? list.map(function (c) { return '<button class="chat-link" type="button" data-open="' + c.id + '"><span class="t">' + esc(c.title || t("newChat")) + "</span><small>" + esc(t(groupOf(c.updatedAt))) + "</small></button>"; }).join("") : '<div class="sb-empty">' + esc(t("noResults")) + "</div>";
    };
    inp.oninput = run; run();
    res.onclick = function (e) { var b = e.target.closest("[data-open]"); if (b) { closeModal(); openChat(b.getAttribute("data-open")); } };
    setTimeout(function () { inp.focus(); }, 30);
  }

  function b64urlEncode(str) { var bytes = new TextEncoder().encode(str), bin = ""; bytes.forEach(function (b) { bin += String.fromCharCode(b); }); return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function b64urlDecode(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; var bin = atob(s), bytes = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new TextDecoder().decode(bytes); }
  function transcript(c) { return c.messages.map(function (m) { return (m.role === "user" ? "Vos: " : "AgentiCuántico: ") + (m.content || ""); }).join("\n\n"); }
  function openShare() {
    var c = currentChat(); if (!c) return;
    var payload = JSON.stringify({ t: c.title, m: c.messages.filter(function (m) { return m.content; }).map(function (m) { return [m.role === "user" ? 0 : 1, m.content]; }) });
    var link = location.origin + "/app/#share=" + b64urlEncode(payload);
    var tooLong = link.length > 7000;
    var m = modal(t("shareTitle"), '<p style="margin:0 0 14px;color:var(--muted);font-size:14px">' + esc(tooLong ? t("shareTooLong") : t("shareInfo")) + "</p>" +
      (tooLong ? "" : '<div class="share-link"><input class="input" id="shareUrl" readonly value="' + esc(link) + '"><button class="btn primary" type="button" id="copyShare">' + icon("link") + esc(t("copyLink")) + "</button></div>") +
      (navigator.share ? '<button class="btn block" type="button" id="nativeShare" style="margin-top:10px">' + icon("share") + esc(t("shareNative")) + "</button>" : ""));
    if (tooLong) copyText(transcript(c));
    var cs = m.querySelector("#copyShare"); if (cs) cs.onclick = function () { copyText(link).then(function () { toast(t("copied")); }); };
    var ns = m.querySelector("#nativeShare"); if (ns) ns.onclick = function () { navigator.share({ title: c.title, text: tooLong ? transcript(c) : c.title, url: tooLong ? location.origin + "/app/" : link }).catch(function () {}); };
  }
  function importShared() {
    var h = location.hash.match(/^#share=([\w-]+)/);
    if (!h) return false;
    try {
      var d = JSON.parse(b64urlDecode(h[1]));
      var c = { id: uid(), title: String(d.t || t("sharedChat")).slice(0, 80), createdAt: now(), updatedAt: now(), projectId: null, shared: true,
        messages: (d.m || []).slice(0, 200).map(function (x) { return { id: uid(), role: x[0] === 0 ? "user" : "assistant", content: String(x[1] || "").slice(0, 50000), ts: now() }; }) };
      state.chats.unshift(c); ui.currentId = c.id; save();
      toast(t("imported"));
    } catch (e) { /* enlace inválido */ }
    history.replaceState(null, "", location.pathname + location.search);
    return true;
  }

  function seg(name, opts, val) { return '<div class="seg" data-seg="' + name + '">' + opts.map(function (o) { return '<button type="button" data-v="' + o[0] + '" class="' + (o[0] === val ? "on" : "") + '">' + esc(o[1]) + "</button>"; }).join("") + "</div>"; }
  function connRows() {
    var S = E.state, c = S.caps, live = S.live;
    function row(label, on) { var cls = on === "demo" ? "demo" : on ? "on" : ""; return '<div class="conn"><span>' + esc(label) + '</span><span class="st-dot ' + cls + '">' + esc(on === "demo" ? t("connDemo") : on ? t("connOn") : t("connOff")) + "</span></div>"; }
    return '<div class="conn-list">' +
      '<div class="conn"><span>' + esc(t("server")) + '</span><span class="st-dot ' + (live ? "on" : "demo") + '">' + esc(live ? t("live") : t("demo")) + "</span></div>" +
      row(t("connChat"), live ? !!(c && c.llm) : "demo") + row(t("connAgent"), live ? !!(c && c.agent) : "demo") +
      row(t("connEmail"), live && !!(c && c.auth && c.auth.magicLink)) + row(t("connGoogle"), live && !!(c && c.auth && c.auth.google)) +
      row(t("connMP"), live && !!(c && c.billing && c.billing.mercadopago)) + row(t("connPP"), live && !!(c && c.billing && c.billing.paypal)) + "</div>";
  }
  function openSettings(tab) {
    tab = tab || "general";
    var s = state.settings;
    var body = '<div class="tabs" style="margin-top:0">' + [["general", t("general")], ["data", t("data")], ["connection", t("connection")]].map(function (x) { return '<button class="tab' + (tab === x[0] ? " on" : "") + '" type="button" data-stab="' + x[0] + '">' + esc(x[1]) + "</button>"; }).join("") + "</div>";
    if (tab === "general") {
      body += '<div class="set-row"><span>' + esc(t("theme")) + "</span>" + seg("theme", [["light", t("light")], ["dark", t("dark")], ["system", t("system")]], s.theme) + "</div>" +
        '<div class="set-row"><span>' + esc(t("language")) + "</span>" + seg("lang", [["es", "Español"], ["en", "English"], ["pt", "Português"]], s.lang) + "</div>" +
        '<div class="set-row" style="border:0"><span>' + esc(t("voice")) + "</span>" + seg("voice", [["female", t("female")], ["male", t("male")]], s.voice) + "</div>";
    } else if (tab === "data") {
      body += '<div class="set-row"><span>' + esc(t("exportChats")) + '</span><button class="btn" type="button" id="exportBtn">' + icon("download") + esc(t("download")) + "</button></div>" +
        '<div class="set-row" style="border:0"><span>' + esc(t("deleteAll")) + '</span><button class="btn danger" type="button" id="wipeBtn">' + icon("trash") + esc(t("del")) + "</button></div>";
    } else body += connRows();
    var m = modal(t("settingsTitle"), body);
    m.onclick = function (e) {
      var st = e.target.closest("[data-stab]"); if (st) { openSettings(st.getAttribute("data-stab")); return; }
      var b = e.target.closest(".seg button"); if (b) {
        var k = b.parentNode.getAttribute("data-seg"); state.settings[k] = b.getAttribute("data-v"); save();
        if (k === "theme") applyTheme();
        if (k === "lang") { applyI18n(); renderAll(); renderAccount(); updateConnChip(); }
        openSettings(tab); return;
      }
      if (e.target.closest("#exportBtn")) download("agenticuantico-chats.json", JSON.stringify(state.chats, null, 2), "application/json");
      if (e.target.closest("#wipeBtn")) confirmModal(t("confirmDeleteAll"), function () { state.chats = []; ui.currentId = null; save(true); closePanel(); renderAll(); });
    };
  }

  function fmtArs(n) { try { return "ARS " + n.toLocaleString("es-AR"); } catch (e) { return "ARS " + n; } }
  function openUpgrade() {
    var P = CFG.PRICES || { pro: { usd: 10, ars: 15600 }, empresa: { usd: 30, ars: 46800 } };
    var plan = (ui.user && ui.user.plan) || "free";
    function feats(list) { return "<ul>" + list.map(function (f) { return "<li>" + icon("check") + "<span>" + esc(f) + "</span></li>"; }).join("") + "</ul>"; }
    function card(id, name, usd, ars, list, featured) {
      var cur = plan === id;
      return '<div class="plan-card' + (featured ? " featured" : "") + '"><h3>' + esc(name) + '</h3><div class="price">USD ' + usd + "<small>" + esc(t("perMonth")) + "</small></div>" +
        '<div class="price-alt">' + (ars ? esc(fmtArs(ars) + t("perMonth")) : "&nbsp;") + "</div>" + feats(list) +
        (id === "free" ? '<button class="btn block" type="button" disabled>' + esc(cur ? t("currentPlan") : t("free")) + "</button>" :
          cur ? '<button class="btn block" type="button" disabled>' + esc(t("currentPlan")) + "</button>" :
          '<button class="btn lime block" type="button" data-pay="mercadopago" data-plan="' + id + '" title="' + esc(t("payMP")) + '">Mercado Pago · ' + esc(fmtArs(ars)) + '</button><button class="btn block" type="button" data-pay="paypal" data-plan="' + id + '" title="' + esc(t("payPP")) + '">PayPal · USD ' + usd + "</button>") + "</div>";
    }
    var m = modal(t("plansTitle"), '<div class="plans">' + card("free", t("free"), 0, 0, t("freeF")) + card("pro", t("pro"), P.pro.usd, P.pro.ars, t("proF"), true) + card("empresa", t("business"), P.empresa.usd, P.empresa.ars, t("bizF")) + '</div><p class="pay-note">' + esc(t("payNote")) + "</p>", { wide: true });
    m.onclick = function (e) {
      var b = e.target.closest("[data-pay]"); if (!b) return;
      var mail = CFG.CONTACT_EMAIL || "agenticuantico@gmail.com";
      b.disabled = true;
      E.subscribe(b.getAttribute("data-pay"), b.getAttribute("data-plan")).then(function (r) {
        b.disabled = false;
        if (r.url) { toast(t("redirecting")); location.href = r.url; }
        else if (r.needLogin) { closeModal(); openLogin(); }
        else if (r.demo) toast(t("payDemo", { email: mail }), 5000);
        else toast(t("payNotReady", { email: mail }), 5000);
      });
    };
  }
  function openLogin() {
    var demo = !E.state.live;
    var m = modal(t("loginTitle"), (demo ? '<div class="notice">' + icon("help") + "<span>" + esc(t("loginDemo")) + "</span></div>" : "") +
      '<form id="loginForm"><div class="field"><label for="loginEmail">' + esc(t("email")) + '</label><input class="input" id="loginEmail" type="email" autocomplete="email" inputmode="email" placeholder="nombre@empresa.com"></div>' +
      '<button class="btn primary block" type="submit">' + esc(t("sendLink")) + '</button></form><div style="text-align:center;color:var(--faint);font-size:13px;margin:12px 0">—</div><button class="btn block" type="button" id="googleBtn">' + esc(t("orGoogle")) + "</button>");
    m.querySelector("#loginForm").onsubmit = function (e) {
      e.preventDefault();
      var v = m.querySelector("#loginEmail").value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v)) { toast(t("invalidEmail")); return; }
      if (demo) { toast(t("loginDemo"), 4500); return; }
      E.magicLink(v, state.settings.lang).then(function (r) { if (r.ok) { closeModal(); toast(t("linkSent"), 5000); } else toast(r.error === "rate_limited" ? "⏳" : t("fallbackNote")); });
    };
    m.querySelector("#googleBtn").onclick = function () {
      var u = E.googleUrl();
      if (u) location.href = u; else toast(demo ? t("loginDemo") : t("googleNotReady"), 4500);
    };
  }

  /* ---------- Cuenta ---------- */
  function renderAccount() {
    var u = ui.user;
    $("accountInitial").textContent = u ? u.email.charAt(0).toUpperCase() : "A";
    $("accountName").textContent = u ? u.email : t("guest");
    var plan = u ? u.plan : "free";
    $("accountPlan").textContent = plan === "pro" ? t("pro") : plan === "empresa" ? t("business") : t("free");
    $("sbUpgrade").hidden = plan === "empresa";
  }
  function openAccountMenu() {
    var menu = $("accountMenu");
    var items = [["spark", "upgrade", openUpgrade], ["gear", "settings", function () { openSettings(); }], null, ["help", "help", function () { location.href = "/como-funciona"; }], ["home", "backToSite", function () { location.href = "/"; }], null,
      ui.user ? ["logout", "logout", function () { E.logout().then(function () { ui.user = null; renderAccount(); }); }] : ["login", "login", openLogin]];
    menu.innerHTML = '<div class="menu-label">' + esc(ui.user ? ui.user.email : t("guest")) + "</div>";
    items.forEach(function (it) {
      if (!it) { var s = document.createElement("div"); s.className = "menu-sep"; menu.appendChild(s); return; }
      var b = document.createElement("button"); b.type = "button"; b.className = "menu-item"; b.setAttribute("role", "menuitem");
      b.innerHTML = icon(it[0]) + '<span class="grow">' + esc(t(it[1])) + "</span>";
      b.onclick = function () { closeMenus(); if (isMobile()) closeDrawer(); it[2](); };
      menu.appendChild(b);
    });
    menu.style.width = Math.max(240, $("accountBtn").offsetWidth) + "px";
    placeFixed(menu, $("accountBtn"), true);
  }
  function openCtx(anchor, items) {
    var menu = $("ctxMenu");
    menu.innerHTML = "";
    items.forEach(function (it) {
      var b = document.createElement("button"); b.type = "button"; b.className = "menu-item" + (it.danger ? " danger" : ""); b.setAttribute("role", "menuitem");
      b.innerHTML = icon(it.icon) + '<span class="grow">' + esc(it.label) + "</span>";
      b.onclick = function (e) { e.stopPropagation(); closeMenus(); it.run(); };
      menu.appendChild(b);
    });
    menu.style.width = "220px";
    placeFixed(menu, anchor, false);
  }
  function chatMenu(anchor, id) {
    var c = state.chats.find(function (x) { return x.id === id; }); if (!c) return;
    var items = [{ icon: "edit", label: t("rename"), run: function () { promptModal(t("rename"), t("chatTitle"), c.title, function (v) { c.title = v; save(); renderSidebar(); }); } },
      { icon: "share", label: t("share"), run: function () { openChat(id); openShare(); } }];
    if (state.projects.length) items.push({ icon: "folder", label: t("moveToProject"), run: function () { moveToProject(c); } });
    items.push({ icon: "trash", label: t("del"), danger: true, run: function () { confirmModal(t("confirmDelete"), function () { deleteChat(id); }); } });
    openCtx(anchor, items);
  }
  function moveToProject(c) {
    var opts = [{ id: "", name: t("noProject") }].concat(state.projects);
    var m = modal(t("moveToProject"), '<div class="search-results">' + opts.map(function (p) { return '<button class="chat-link' + ((c.projectId || "") === p.id ? " active" : "") + '" type="button" data-pid="' + p.id + '">' + icon("folder") + '<span class="t" style="margin-left:8px">' + esc(p.name) + "</span></button>"; }).join("") + "</div>");
    m.onclick = function (e) { var b = e.target.closest("[data-pid]"); if (b) { c.projectId = b.getAttribute("data-pid") || null; save(); closeModal(); renderSidebar(); } };
  }

  /* ---------- Voz ---------- */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function langTag() { return state.settings.lang === "en" ? "en-US" : state.settings.lang === "pt" ? "pt-BR" : "es-AR"; }
  function pickVoice() {
    if (!window.speechSynthesis) return null;
    var vs = speechSynthesis.getVoices(), lt = langTag().slice(0, 2);
    var same = vs.filter(function (v) { return (v.lang || "").toLowerCase().indexOf(lt) === 0; });
    var fem = /female|mujer|femen|paulina|monica|mónica|helena|sabina|luciana|francisca|camila|google español|zira|samantha|victoria|karen|joana|maria|elena|laura|sofia/i;
    var mal = /male|hombre|mascul|jorge|diego|juan|carlos|pablo|raul|daniel|alex|david|fred|thomas|tom|felipe|ricardo|antonio|enrique/i;
    var want = state.settings.voice === "male" ? mal : fem, avoid = state.settings.voice === "male" ? fem : mal;
    return same.find(function (v) { return want.test(v.name) && !(state.settings.voice === "male" && /female/i.test(v.name)); }) || same.find(function (v) { return !avoid.test(v.name); }) || same[0] || null;
  }
  function plainText(md) { return String(md || "").replace(/```[\s\S]*?```/g, " ").replace(/[#*_`>|~-]+/g, " ").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim(); }
  function speak(text, onEnd) {
    if (!window.speechSynthesis) { if (onEnd) onEnd(); return; }
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(plainText(text).slice(0, 2500));
    u.lang = langTag(); var v = pickVoice(); if (v) u.voice = v;
    u.pitch = state.settings.voice === "male" ? 0.9 : 1.05;
    u.onend = u.onerror = function () { if (onEnd) onEnd(); };
    speechSynthesis.speak(u);
  }
  var dictation = null;
  function toggleDictation() {
    if (!SR) { toast(t("micNo")); return; }
    if (dictation) { dictation.stop(); return; }
    var r = new SR(); r.lang = langTag(); r.interimResults = true; r.continuous = false;
    var base = $("input").value;
    r.onresult = function (e) { var s = ""; for (var i = 0; i < e.results.length; i++) s += e.results[i][0].transcript; $("input").value = (base ? base + " " : "") + s; autosize(); updateComposer(); };
    r.onend = r.onerror = function () { dictation = null; $("micBtn").classList.remove("mic-on"); };
    try { r.start(); dictation = r; $("micBtn").classList.add("mic-on"); } catch (e) { dictation = null; }
  }
  function openVoice() {
    var ov = $("voiceOverlay");
    ov.innerHTML = '<div class="orb" id="orb"><img src="/media/agenticuantico-avatar.jpg" alt=""></div><div class="voice-status" id="vStatus"></div><div class="voice-text" id="vText"></div>' +
      '<div class="voice-controls"><button type="button" id="vMic" aria-label="' + esc(t("dictate")) + '">' + icon("mic") + '</button><button type="button" class="end" id="vEnd" aria-label="' + esc(t("close")) + '">' + icon("close") + "</button></div>";
    ov.hidden = false;
    ui.voice = { active: true, rec: null };
    var setS = function (k, cls) { $("vStatus").textContent = t(k); $("orb").className = "orb " + (cls || ""); };
    if (!SR) { setS("voiceTap"); $("vText").textContent = t("voiceNo"); }
    else setS("voiceTap");
    var listen = function () {
      if (!SR || !ui.voice || !ui.voice.active) return;
      if (window.speechSynthesis) speechSynthesis.cancel();
      var r = new SR(); r.lang = langTag(); r.interimResults = true;
      var said = "";
      r.onresult = function (e) { said = ""; for (var i = 0; i < e.results.length; i++) said += e.results[i][0].transcript; $("vText").textContent = said; };
      r.onend = function () { ui.voice && (ui.voice.rec = null); if (said.trim() && ui.voice && ui.voice.active) { setS("voiceThinking"); send(said); } else if (ui.voice && ui.voice.active) setS("voiceTap"); };
      r.onerror = function () { if (ui.voice && ui.voice.active) setS("voiceTap"); };
      try { r.start(); ui.voice.rec = r; setS("voiceListening", "listening"); } catch (e) { setS("voiceTap"); }
    };
    ui.voice.listen = listen;
    ui.voice.setS = setS;
    $("vMic").onclick = function () { if (!SR) { toast(t("voiceNo"), 4000); return; } listen(); };
    $("vEnd").onclick = closeVoice;
    if (SR) listen();
  }
  function voiceSpeak(text) {
    if (!ui.voice || !ui.voice.active) return;
    ui.voice.setS("voiceSpeaking", "speaking");
    $("vText").textContent = plainText(text).slice(0, 220);
    speak(text, function () { if (ui.voice && ui.voice.active) ui.voice.listen(); });
  }
  function closeVoice() {
    if (ui.voice && ui.voice.rec) try { ui.voice.rec.abort(); } catch (e) { /* ignore */ }
    ui.voice = null;
    if (window.speechSynthesis) speechSynthesis.cancel();
    $("voiceOverlay").hidden = true; $("voiceOverlay").innerHTML = "";
  }

  /* ---------- Conexión ---------- */
  function updateConnChip() {
    var chip = $("connChip"), S = E.state;
    if (!S.checked) { chip.hidden = true; return; }
    chip.hidden = S.live;
    chip.classList.toggle("live", S.live);
    chip.innerHTML = '<span class="full">' + esc(S.live ? t("live") : t("demo")) + '</span><span class="short">demo</span>';
    chip.title = S.live ? "" : t("demoTip");
  }
  window.AC_onConnection = updateConnChip;

  /* ---------- Eventos ---------- */
  function bind() {
    $("composerForm").addEventListener("submit", function (e) { e.preventDefault(); send(); });
    var inp = $("input");
    inp.addEventListener("input", function () { autosize(); updateComposer(); });
    inp.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !coarse()) { e.preventDefault(); send(); }
    });
    inp.addEventListener("paste", function (e) { var f = e.clipboardData && e.clipboardData.files; if (f && f.length) { e.preventDefault(); addFiles(f); } });
    $("stopBtn").onclick = stopStreaming;
    $("attachBtn").onclick = function () { $("fileInput").click(); };
    $("fileInput").onchange = function () { addFiles(this.files); this.value = ""; };
    $("attachments").onclick = function (e) { var b = e.target.closest("[data-rm]"); if (b) { ui.attachments.splice(+b.getAttribute("data-rm"), 1); renderAttachments(); } };
    $("micBtn").onclick = toggleDictation;
    $("voiceBtn").onclick = openVoice;
    $("toolsBtn").onclick = function (e) { e.stopPropagation(); toggleMenu("toolsMenu", renderToolsMenu); };
    $("modelBtn").onclick = function (e) { e.stopPropagation(); toggleMenu("modelMenu", function () { renderModelMenu(); $("modelBtn").setAttribute("aria-expanded", "true"); }); };
    $("modelMenu").onclick = function (e) { var b = e.target.closest("[data-mode]"); if (b) { closeMenus(); setMode(b.getAttribute("data-mode")); } };
    $("suggestions").onclick = function (e) { var b = e.target.closest(".sugg"); if (b) send(b.textContent); };
    $("sbNew").onclick = $("railNew").onclick = $("newMobile").onclick = function () { newChat(); };
    $("sbSearch").onclick = $("railSearch").onclick = function () { if (isMobile()) closeDrawer(); openSearch(); };
    $("sbAgent").onclick = $("railAgent").onclick = function () { newChat("agent"); updateModeUI(); };
    $("sbClose").onclick = $("railOpen").onclick = toggleSidebar;
    $("menuBtn").onclick = openDrawer;
    $("backdrop").onclick = function () { closeDrawer(); if (!isWide()) closePanel(); };
    $("sbUpgrade").onclick = function () { if (isMobile()) closeDrawer(); openUpgrade(); };
    $("accountBtn").onclick = function (e) { e.stopPropagation(); var open = !$("accountMenu").hidden; closeMenus(); if (!open) openAccountMenu(); };
    $("sbNewProject").onclick = function () { promptModal(t("newProject"), t("projectName"), "", function (v) { var p = { id: uid(), name: v }; state.projects.push(p); ui.activeProject = p.id; save(); renderSidebar(); }); };
    $("shareBtn").onclick = openShare;
    $("computerBtn").onclick = function () { var c = currentChat(); var m = c && c.messages.slice().reverse().find(function (x) { return x.agent; }); if (m) { ui.apMsgId = m.id; openPanel(); } };
    $("apClose").onclick = closePanel;
    $("connChip").onclick = function () { openSettings("connection"); };

    $("sbScroll").addEventListener("click", function (e) {
      var more = e.target.closest("[data-more]"); if (more) { e.stopPropagation(); chatMenu(more, more.getAttribute("data-more")); return; }
      var pm = e.target.closest("[data-pmore]");
      if (pm) {
        e.stopPropagation();
        var p = state.projects.find(function (x) { return x.id === pm.getAttribute("data-pmore"); });
        openCtx(pm, [{ icon: "edit", label: t("rename"), run: function () { promptModal(t("rename"), t("projectName"), p.name, function (v) { p.name = v; save(); renderSidebar(); }); } },
          { icon: "trash", label: t("del"), danger: true, run: function () { state.projects = state.projects.filter(function (x) { return x !== p; }); state.chats.forEach(function (c) { if (c.projectId === p.id) c.projectId = null; }); if (ui.activeProject === p.id) ui.activeProject = null; save(); renderSidebar(); } }]);
        return;
      }
      var cl = e.target.closest("[data-chat]"); if (cl) { openChat(cl.getAttribute("data-chat")); return; }
      var pl = e.target.closest("[data-project]"); if (pl) { var id = pl.getAttribute("data-project"); ui.activeProject = ui.activeProject === id ? null : id; renderSidebar(); }
    });
    $("sbScroll").addEventListener("keydown", function (e) { if ((e.key === "Enter" || e.key === " ") && e.target.matches("[role=button]")) { e.preventDefault(); e.target.click(); } });

    $("threadInner").addEventListener("click", function (e) {
      var cc = e.target.closest("[data-copy-code]");
      if (cc) {
        var code = cc.closest(".codeblock").querySelector("code").textContent;
        copyText(code).then(function () { var sp = cc.querySelector("span"); sp.textContent = t("copied"); cc.classList.add("done"); setTimeout(function () { sp.textContent = t("copy"); cc.classList.remove("done"); }, 1500); });
        return;
      }
      var b = e.target.closest("[data-act]"); if (!b) return;
      var el = b.closest(".msg"), c = currentChat(); if (!el || !c) return;
      var m = c.messages.find(function (x) { return x.id === el.getAttribute("data-id"); }); if (!m) return;
      var act = b.getAttribute("data-act");
      if (act === "copy") copyText(m.content || "").then(function () { b.innerHTML = icon("check"); setTimeout(function () { b.innerHTML = icon("copy"); }, 1400); });
      else if (act === "edit") { if (ui.ctrl) return; ui.editingId = m.id; rerenderMsg(m); }
      else if (act === "cancelEdit") { ui.editingId = null; rerenderMsg(m); }
      else if (act === "saveEdit") saveEdit(m, el.querySelector("textarea").value);
      else if (act === "good" || act === "bad") { m.feedback = m.feedback === act ? null : act; save(); rerenderMsg(m); }
      else if (act === "speak") speak(m.content);
      else if (act === "regenerate") regenerate(m);
      else if (act === "toggleReason") { b.classList.toggle("open"); var rb = b.nextElementSibling; if (rb) rb.hidden = !rb.hidden; }
      else if (act === "openComputer") { ui.apMsgId = m.id; ui.apTab = "computer"; openPanel(); }
      else if (act === "viewFile") { ui.apMsgId = m.id; ui.apFile = +b.getAttribute("data-file"); ui.apPreview = false; openPanel("files"); }
      else if (act === "dlFile") { var f = m.agent.artifacts[+b.getAttribute("data-file")]; download(f.name, f.content, f.mime); }
      else if (act === "login") openLogin();
      else if (act === "upgrade") openUpgrade();
    });
    $("threadInner").addEventListener("keydown", function (e) {
      if (e.target.matches(".edit-box textarea") && e.key === "Enter" && !e.shiftKey && !coarse()) { e.preventDefault(); var el = e.target.closest(".msg"); var c = currentChat(); var m = c && c.messages.find(function (x) { return x.id === el.getAttribute("data-id"); }); if (m) saveEdit(m, e.target.value); }
      if (e.target.matches(".edit-box textarea") && e.key === "Escape") { ui.editingId = null; renderThread(); }
    });
    $("apBody").addEventListener("click", function (e) {
      var tb = e.target.closest("[data-tab]"); if (tb) { ui.apTab = tb.getAttribute("data-tab"); renderPanel(); return; }
      var fi = e.target.closest("[data-fi]"); if (fi) { ui.apFile = +fi.getAttribute("data-fi"); ui.apPreview = false; renderPanel(); return; }
      var cc = e.target.closest("[data-copy-code]"); if (cc) { copyText(cc.closest(".codeblock").querySelector("code").textContent).then(function () { toast(t("copied")); }); return; }
      var pa = e.target.closest("[data-pact]"); if (!pa) return;
      var m = panelMsg(); if (!m) return;
      var f = m.agent.artifacts[Math.min(ui.apFile, m.agent.artifacts.length - 1)];
      var a = pa.getAttribute("data-pact");
      if (a === "copy") copyText(f.content).then(function () { toast(t("copied")); });
      else if (a === "dl") download(f.name, f.content, f.mime);
      else if (a === "preview") { ui.apPreview = !ui.apPreview; renderPanel(); }
    });

    var th = $("thread");
    th.addEventListener("scroll", function () { $("scrollDown").hidden = nearBottom(); });
    $("scrollDown").onclick = function () { th.scrollTo({ top: th.scrollHeight, behavior: "smooth" }); };

    document.addEventListener("click", function (e) { if (!e.target.closest(".menu") && !e.target.closest("#modelBtn") && !e.target.closest("#toolsBtn") && !e.target.closest("#accountBtn")) closeMenus(); });
    document.addEventListener("keydown", function (e) {
      var mod = e.ctrlKey || e.metaKey;
      if (e.key === "Escape") { closeMenus(); if (!$("modalRoot").hidden) closeModal(); else if (ui.voice) closeVoice(); else if ($("app").classList.contains("drawer-open")) closeDrawer(); }
      if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); openSearch(); }
      if (mod && e.shiftKey && e.key.toLowerCase() === "o") { e.preventDefault(); newChat(); }
    });
    window.addEventListener("resize", function () {
      if (!isMobile()) closeDrawer();
      if (isWide() && !$("agentPanel").hidden) $("backdrop").hidden = true;
    });
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { if (state.settings.theme === "system") applyTheme(); });
    window.addEventListener("hashchange", function () { if (importShared()) renderAll(); });
    if (window.speechSynthesis) speechSynthesis.onvoiceschanged = function () { /* carga voces */ };
  }

  /* ---------- Inicio ---------- */
  function init() {
    hydrateIcons(document);
    applyTheme();
    $("app").classList.toggle("sb-collapsed", state.sbCollapsed);
    var qs = new URLSearchParams(location.search);
    if (qs.get("mode") === "agent" || qs.get("mode") === "deep") state.mode = qs.get("mode");
    importShared();
    applyI18n();
    renderAll();
    renderAccount();
    bind();
    var q = qs.get("q");
    if (q) { $("input").value = q.slice(0, 2000); autosize(); updateComposer(); }
    if (/[#&?]\/?plans\?status=success|status=success/.test(location.hash)) { toast("✓ " + t("upgrade"), 4000); history.replaceState(null, "", location.pathname); }
    if (/login=expired/.test(location.hash)) { history.replaceState(null, "", location.pathname); setTimeout(openLogin, 300); }
    E.init().then(function () {
      updateConnChip();
      return E.me();
    }).then(function (u) { if (u) { ui.user = u; renderAccount(); } }).catch(function () { updateConnChip(); });
    if (!coarse()) $("input").focus();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
