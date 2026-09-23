(() => {
  "use strict";

  const AGENTS_KEY = "aq_agents_v5";
  const TEAMS_KEY = "aq_teams_v5";
  const ACTIVE_AGENT_KEY = "aq_active_agent_v1";
  const ACTIVE_TEAM_KEY = "aq_active_team_v1";

  const defaultAgents = [
    {id:"general",name:"AgentiQ",role:"Coordinador general",skills:["conversación","planificación","síntesis"],knowledge:["productividad","investigación"]},
    {id:"programador",name:"Programador",role:"Ingeniero de software",skills:["JavaScript","Python","GitHub","debugging"],knowledge:["frontend","backend","APIs","arquitectura"]},
    {id:"disenador",name:"Diseñador 3D",role:"UI/UX y experiencias inmersivas",skills:["UI/UX","3D","WebGL","motion"],knowledge:["branding","responsive","accesibilidad"]},
    {id:"investigador",name:"Investigador",role:"Investigación y análisis",skills:["búsqueda","análisis","síntesis"],knowledge:["documentación","comparación","evidencia"]}
  ];

  const load = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return Array.isArray(value) && value.length ? value : fallback;
    } catch { return fallback; }
  };
  let agents = load(AGENTS_KEY, defaultAgents);
  let teams = load(TEAMS_KEY, []);
  let activeAgentId = localStorage.getItem(ACTIVE_AGENT_KEY) || "general";
  let activeTeamId = localStorage.getItem(ACTIVE_TEAM_KEY) || "";

  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
  const save = () => {
    localStorage.setItem(AGENTS_KEY, JSON.stringify(agents));
    localStorage.setItem(TEAMS_KEY, JSON.stringify(teams));
    if (activeAgentId) localStorage.setItem(ACTIVE_AGENT_KEY, activeAgentId);
    else localStorage.removeItem(ACTIVE_AGENT_KEY);
    if (activeTeamId) localStorage.setItem(ACTIVE_TEAM_KEY, activeTeamId);
    else localStorage.removeItem(ACTIVE_TEAM_KEY);
  };

  window.__aqWorkspaceSelection = () => ({
    agent: agents.find(a => a.id === activeAgentId) || null,
    team: (() => {
      const t = teams.find(x => x.id === activeTeamId);
      if (!t) return null;
      return { ...t, members: (t.members || []).map(id => agents.find(a => a.id === id)?.name).filter(Boolean) };
    })()
  });

  // Inject the selected agent/team into the existing chat API request.
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    try {
      const url = typeof input === "string" ? input : input?.url || "";
      if (url.includes("/v1/public/chat") && init?.body && typeof init.body === "string") {
        const body = JSON.parse(init.body);
        const selection = window.__aqWorkspaceSelection();
        if (selection.agent) body.agent = selection.agent;
        if (selection.team) body.team = selection.team;
        init = { ...init, body: JSON.stringify(body) };
      }
    } catch {}
    return nativeFetch(input, init);
  };

  const modal = document.createElement("div");
  modal.id = "agentWorkspace";
  modal.className = "aq-workspace hidden";
  modal.innerHTML = `
    <div class="aq-workspace-backdrop" data-close-workspace></div>
    <section class="aq-workspace-panel" role="dialog" aria-modal="true" aria-labelledby="aqWorkspaceTitle">
      <header class="aq-workspace-header">
        <div><span class="aq-eyebrow">AGENTIC WORKSPACE</span><h2 id="aqWorkspaceTitle">Agentes y equipos</h2><p>Creá especialistas y combiná sus capacidades para trabajar sobre una misma conversación.</p></div>
        <button class="aq-close" type="button" data-close-workspace aria-label="Cerrar">×</button>
      </header>
      <div class="aq-workspace-tabs">
        <button class="active" data-tab="agents">Mis agentes</button>
        <button data-tab="teams">Equipos</button>
        <button data-tab="create-agent">+ Nuevo agente</button>
        <button data-tab="create-team">+ Nuevo equipo</button>
      </div>
      <div class="aq-workspace-body">
        <div class="aq-workspace-section" data-section="agents"></div>
        <div class="aq-workspace-section hidden" data-section="teams"></div>
        <div class="aq-workspace-section hidden" data-section="create-agent"></div>
        <div class="aq-workspace-section hidden" data-section="create-team"></div>
      </div>
    </section>`;
  document.body.appendChild(modal);

  const toast = msg => {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(window.__aqWorkspaceToast);
    window.__aqWorkspaceToast = setTimeout(() => t.classList.remove("show"), 2200);
  };

  const renderAgents = () => {
    const el = modal.querySelector('[data-section="agents"]');
    el.innerHTML = `
      <div class="aq-section-head"><div><b>Especialistas</b><small>Elegí quién lidera la próxima conversación.</small></div><span>${agents.length} agentes</span></div>
      <div class="aq-agent-grid">
        ${agents.map(a => `
          <article class="aq-agent-card ${a.id === activeAgentId && !activeTeamId ? "selected":""}">
            <div class="aq-agent-icon">${esc((a.name||"A").slice(0,1))}</div>
            <div class="aq-agent-main"><b>${esc(a.name)}</b><small>${esc(a.role)}</small><div class="aq-tags">${(a.skills||[]).slice(0,5).map(s=>'<span>'+esc(s)+'</span>').join("")}</div></div>
            <button type="button" class="aq-select" data-select-agent="${esc(a.id)}">${a.id === activeAgentId && !activeTeamId ? "Activo" : "Usar"}</button>
          </article>`).join("")}
      </div>`;
    el.querySelectorAll("[data-select-agent]").forEach(b => b.onclick = () => {
      activeAgentId = b.dataset.selectAgent;
      activeTeamId = "";
      save(); renderAll(); toast("Agente activo: " + (agents.find(a=>a.id===activeAgentId)?.name || ""));
    });
  };

  const renderTeams = () => {
    const el = modal.querySelector('[data-section="teams"]');
    el.innerHTML = `
      <div class="aq-section-head"><div><b>Equipos de agentes</b><small>Un equipo recibe tu orden y coordina a sus especialistas con una sola respuesta.</small></div><span>${teams.length} equipos</span></div>
      ${teams.length ? '<div class="aq-team-grid">'+teams.map(t => `
        <article class="aq-team-card ${t.id===activeTeamId?"selected":""}">
          <div class="aq-team-orbit"><i></i><i></i><i></i></div>
          <div><b>${esc(t.name)}</b><small>${esc(t.goal || "Trabajo colaborativo")}</small></div>
          <div class="aq-members">${(t.members||[]).map(id=>{const a=agents.find(x=>x.id===id);return a?'<span>'+esc(a.name)+'</span>':""}).join("")}</div>
          <button type="button" class="aq-select" data-select-team="${esc(t.id)}">${t.id===activeTeamId?"Equipo activo":"Usar equipo"}</button>
        </article>`).join("")+'</div>' : '<div class="aq-empty">Todavía no creaste equipos. Empezá con “Nuevo equipo”.</div>'}`;
    el.querySelectorAll("[data-select-team]").forEach(b => b.onclick = () => {
      activeTeamId = b.dataset.selectTeam;
      save(); renderAll(); toast("Equipo activo");
    });
  };

  const renderCreateAgent = () => {
    const el = modal.querySelector('[data-section="create-agent"]');
    el.innerHTML = `
      <form class="aq-form" id="aqCreateAgent">
        <div class="aq-section-head"><div><b>Crear agente</b><small>Definí su identidad y especialidad.</small></div></div>
        <label>Nombre<input name="name" required placeholder="Ej. Arquitecto Web"></label>
        <label>Rol<input name="role" required placeholder="Ej. Arquitecto frontend y backend"></label>
        <label>Habilidades<input name="skills" placeholder="React, Three.js, APIs, testing"></label>
        <label>Conocimientos<input name="knowledge" placeholder="Web 3D, UX, Cloudflare, seguridad"></label>
        <button class="aq-primary" type="submit">Crear agente</button>
      </form>`;
    el.querySelector("form").onsubmit = e => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const a = {id:"agent-"+Date.now(),name:String(f.get("name")).trim(),role:String(f.get("role")).trim(),skills:String(f.get("skills")||"").split(",").map(x=>x.trim()).filter(Boolean).slice(0,12),knowledge:String(f.get("knowledge")||"").split(",").map(x=>x.trim()).filter(Boolean).slice(0,12)};
      agents.push(a); activeAgentId=a.id; activeTeamId=""; save(); renderAll(); switchTab("agents"); toast("Agente creado");
    };
  };

  const renderCreateTeam = () => {
    const el = modal.querySelector('[data-section="create-team"]');
    el.innerHTML = `
      <form class="aq-form" id="aqCreateTeam">
        <div class="aq-section-head"><div><b>Crear equipo</b><small>Seleccioná dos o más agentes para trabajar en conjunto.</small></div></div>
        <label>Nombre del equipo<input name="name" required placeholder="Ej. Estudio Web 3D"></label>
        <label>Objetivo<input name="goal" placeholder="Crear y mejorar mi sitio web"></label>
        <div class="aq-check-grid">
          ${agents.map(a=>'<label class="aq-check"><input type="checkbox" name="member" value="'+esc(a.id)+'"><span><b>'+esc(a.name)+'</b><small>'+esc(a.role)+'</small></span></label>').join("")}
        </div>
        <button class="aq-primary" type="submit">Crear y activar equipo</button>
      </form>`;
    el.querySelector("form").onsubmit = e => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const members = f.getAll("member");
      if (members.length < 2) { toast("Elegí al menos 2 agentes"); return; }
      const t = {id:"team-"+Date.now(),name:String(f.get("name")).trim(),goal:String(f.get("goal")||"").trim(),members};
      teams.push(t); activeTeamId=t.id; save(); renderAll(); switchTab("teams"); toast("Equipo creado y activo");
    };
  };

  function switchTab(tab) {
    modal.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("active", b.dataset.tab===tab));
    modal.querySelectorAll("[data-section]").forEach(s=>s.classList.toggle("hidden", s.dataset.section!==tab));
  }

  function renderAll() { renderAgents(); renderTeams(); renderCreateAgent(); renderCreateTeam(); }

  function open() { renderAll(); switchTab("agents"); modal.classList.remove("hidden"); document.body.classList.add("aq-workspace-open"); }
  function close() { modal.classList.add("hidden"); document.body.classList.remove("aq-workspace-open"); }

  modal.addEventListener("click", e => {
    if (e.target.closest("[data-close-workspace]")) close();
    const tab = e.target.closest("[data-tab]");
    if (tab) switchTab(tab.dataset.tab);
  });
  document.addEventListener("keydown", e => { if (e.key==="Escape" && !modal.classList.contains("hidden")) close(); });

  const bindNavigation = () => {
    document.querySelectorAll('[data-view="agents"],[data-view="teams"],[data-quick="agents"],[data-quick="teams"]').forEach(el => {
      el.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); open(); switchTab(el.dataset.view==="teams"||el.dataset.quick==="teams"?"teams":"agents"); });
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindNavigation, {once:true}); else bindNavigation();

  // The voice UI already uses the browser speech engine. This adds explicit language routing.
  document.querySelectorAll(".language-row").forEach(row => row.addEventListener("click", () => {
    document.querySelectorAll(".language-row").forEach(x=>x.classList.remove("active"));
    row.classList.add("active");
    const label = row.querySelector("b")?.textContent || "";
    const lang = /Estados Unidos/i.test(label) ? "en-US" : /Reino Unido/i.test(label) ? "en-GB" : /España/i.test(label) ? "es-ES" : "es-AR";
    window.__aqPreferredSpeechLang = lang;
    localStorage.setItem("aq_voice_lang", lang);
    if (window.recognition) window.recognition.lang = lang;
    toast("Idioma de voz: " + label);
  });

  window.__aqWorkspace = {open,close,agents:()=>agents,teams:()=>teams,selection:window.__aqWorkspaceSelection};
})();