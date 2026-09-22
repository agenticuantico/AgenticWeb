const API=(window.AGENTICUANTICO_API_URL||"https://agenticweb.agenticuantico.workers.dev").replace(/\/$/,"");
const K={chat:"aq_chat_v7",session:"aq_guest_v5",agents:"aq_agents_v4",teams:"aq_teams_v4",profile:"aq_profile_v4"};
let history=JSON.parse(localStorage.getItem(K.chat)||"[]");
let guest=localStorage.getItem(K.session)||crypto.randomUUID();
let agents=JSON.parse(localStorage.getItem(K.agents)||"null")||[
{name:"Asistente",role:"Asistente general",skills:["conversación","organización"],knowledge:["español","productividad"]},
{name:"Programador",role:"Ingeniero de software",skills:["Python","JavaScript","GitHub","debugging"],knowledge:["backend","frontend","APIs","arquitectura"]},
{name:"Diseñador",role:"Diseñador UI/UX y 3D",skills:["UI/UX","3D","branding"],knowledge:["interfaces","responsive","experiencia de usuario"]}
];
let teams=JSON.parse(localStorage.getItem(K.teams)||"[]");
let activeAgent=null,activeTeam=null,busy=false,conversation=crypto.randomUUID(),activeModel="Qwen/Qwen3.8-27B";
localStorage.setItem(K.session,guest);

const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const icon=(name)=>({chat:"<svg viewBox='0 0 24 24'><path d='M5 6.5h14v9H9l-4 3v-12Z'/><path d='M8 10h8M8 13h5'/></svg>",projects:"<svg viewBox='0 0 24 24'><path d='M4 7.5h6l1.5 2H20v9H4z'/><path d='M4 7.5V5h6l1.5 2'/></svg>",agents:"<svg viewBox='0 0 24 24'><circle cx='12' cy='8' r='3'/><path d='M6 19c.6-3.2 2.7-5 6-5s5.4 1.8 6 5'/><path d='M4 12h3M17 12h3'/></svg>",teams:"<svg viewBox='0 0 24 24'><circle cx='8' cy='9' r='2.5'/><circle cx='16' cy='9' r='2.5'/><path d='M3.5 18c.5-2.5 2-4 4.5-4s4 1.5 4.5 4M11.5 18c.5-2.5 2-4 4.5-4s4 1.5 4.5 4'/></svg>",code:"<svg viewBox='0 0 24 24'><path d='m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16'/></svg>",user:"<svg viewBox='0 0 24 24'><circle cx='12' cy='8' r='3'/><path d='M5 20c.7-4 3-6 7-6s6.3 2 7 6'/></svg>",spark:"<svg viewBox='0 0 24 24'><path d='m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7Z'/><path d='m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7Z'/></svg>"}[name]||"");

function state(x){$("status").textContent=x;$("sideStatus").textContent=x}
function modelLabel(model){
 const m=String(model||"Qwen/Qwen3.8-27B").replace(":fastest","");
 const parts=m.split("/");
 const name=parts[parts.length-1];
 return name.replace(/^Qwen/i,"Qwen");
}
function updateModelBadge(model){
 activeModel=model||activeModel;
 const pill=document.querySelector(".pill");
 if(pill)pill.textContent=modelLabel(activeModel)+" · HF";
}
async function loadModelInfo(){
 try{
  const r=await fetch(API+"/v1/public/model",{headers:{"Accept":"application/json"}});
  const d=await r.json();
  if(d?.ok){activeModel=d.model||activeModel;updateModelBadge(activeModel);state("Cerebro listo · "+modelLabel(activeModel))}
 }catch{}
}
function toast(x){$("toast").textContent=x;$("toast").classList.add("show");clearTimeout(window.__toast);window.__toast=setTimeout(()=>$("toast").classList.remove("show"),2200)}
function persist(){localStorage.setItem(K.chat,JSON.stringify(history.slice(-20)))}
function add(role,text,save=true){
 const d=document.createElement("div");d.className="msg "+role;
 d.innerHTML=role==="assistant"?esc(text).replace(/\n/g,"<br>"):esc(text);
 $("messages").appendChild(d);$("messages").scrollTop=$("messages").scrollHeight;
 if(save){history.push({role,content:text});persist()}
 return d
}
async function remote(text){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),35000);
 try{
  const r=await fetch(API+"/v1/public/chat",{method:"POST",signal:c.signal,headers:{"Content-Type":"application/json","X-Guest-Session":guest},
   body:JSON.stringify({conversation_id:conversation,message:text,consent_to_memory:false,history:history.slice(-10),agent:agents.find(a=>a.name===activeAgent)||null,team:teams.find(a=>a.name===activeTeam)||null})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.answer)throw Error(d.message||"ai_unavailable");
  activeModel=d.model||activeModel; updateModelBadge(activeModel); return d.answer;
 }finally{clearTimeout(t)}
}
async function send(text){
 if(busy)return;
 busy=true;$("send").disabled=true;
 add("user",text);
 const p=add("assistant","Pensando…",false);
 state("Conectando con el cerebro…");
 try{
  const a=await remote(text);
  p.innerHTML=esc(a).replace(/\n/g,"<br>");
  history.push({role:"assistant",content:a});persist();
  state(activeTeam?"Equipo conectado · Qwen":activeAgent?activeAgent+" · Qwen":"Cerebro conectado · Qwen");
 }catch(e){
  p.textContent=e.name==="AbortError"?"El cerebro está tardando demasiado. Probá nuevamente.":"No pude conectar con el cerebro. Intentá nuevamente.";
  state("Cerebro no disponible");toast("No se pudo conectar con el cerebro");
 }finally{busy=false;$("send").disabled=false}
}

function closeMobile(){$("sidebar").classList.remove("open");$("backdrop").classList.add("hidden")}
function showChat(){
 $("panel").classList.add("hidden");$("chat").classList.remove("hidden");
 document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.view==="chat"));
 $("title").textContent=activeTeam||activeAgent||"AgentiCuantico";closeMobile()
}
function panel(view){
 $("chat").classList.add("hidden");$("panel").classList.remove("hidden");
 document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.view===view));
 $("title").textContent=({projects:"Proyectos",agents:"Agentes",teams:"Equipos de trabajo",coder:"Agentic Codex",account:"Registro / perfil",skills:"Skills"})[view]||"AgentiCuantico";
 closeMobile();
 if(view==="agents")agentsPanel();else if(view==="teams")teamsPanel();else if(view==="coder")coderPanel();else if(view==="account")accountPanel();else if(view==="skills")skillsPanel();else projectsPanel()
}
function agentCard(a,i){
 const avatar=a.name.slice(0,1).toUpperCase();
 return `<article class="agent tilt"><div class="avatar"><span>${esc(avatar)}</span><i></i></div><div class="info"><h3>${esc(a.name)}</h3><span>${esc(a.role)}</span><p><b>Habilidades:</b> ${a.skills.map(esc).join(" · ")||"—"}</p><p><b>Conocimientos:</b> ${a.knowledge.map(esc).join(" · ")||"—"}</p></div><button class="ghost use" data-i="${i}">Abrir chat</button></article>`
}
function agentsPanel(){
 $("panel").innerHTML=`<div class="head"><div><span class="eyebrow">AGENT FACTORY</span><h2>Agentes</h2><p>Especialistas con identidad, rol, skills y conocimientos configurables.</p></div><button class="primary" id="newAgent">＋ Crear agente</button></div><div class="cards">${agents.map(agentCard).join("")}</div>`;
 $("newAgent").onclick=agentForm;
 document.querySelectorAll(".use").forEach(b=>b.onclick=()=>{activeAgent=agents[+b.dataset.i].name;activeTeam=null;showChat();state("Agente listo · "+activeAgent);toast("Agente seleccionado")});
 applyTilt()
}
function agentForm(){
 $("panel").innerHTML=`<div class="head"><div><span class="eyebrow">AGENT FACTORY</span><h2>Crear agente</h2><p>Definí cómo querés que trabaje.</p></div></div><form id="agentForm" class="card form"><label>Nombre</label><input id="an" required placeholder="Nova"><label>Rol</label><input id="ar" required placeholder="Programador, asistente, diseñador…"><label>Habilidades</label><input id="as" placeholder="Python, GitHub, debugging"><label>Conocimientos</label><input id="ak" placeholder="backend, APIs, arquitectura"><div class="row"><button type="button" class="ghost" id="cancel">Cancelar</button><button class="primary">Crear agente</button></div></form>`;
 $("cancel").onclick=()=>panel("agents");
 $("agentForm").onsubmit=e=>{e.preventDefault();const name=$("an").value.trim();if(!name)return;agents.push({name,role:$("ar").value.trim(),skills:$("as").value.split(",").map(x=>x.trim()).filter(Boolean),knowledge:$("ak").value.split(",").map(x=>x.trim()).filter(Boolean)});localStorage.setItem(K.agents,JSON.stringify(agents));panel("agents");toast("Agente creado")}
}
function teamsPanel(){
 $("panel").innerHTML=`<div class="head"><div><span class="eyebrow">TEAM WORKSPACE</span><h2>Equipos</h2><p>Conversaciones colaborativas con varios agentes.</p></div><button class="primary" id="newTeam">＋ Crear equipo</button></div><div class="cards">${teams.length?teams.map((t,i)=>`<article class="agent tilt"><div class="avatar team-avatar">◈</div><div class="info"><h3>${esc(t.name)}</h3><span>${t.members.length} agentes</span><p>${t.members.map(esc).join(" · ")}</p></div><button class="ghost useTeam" data-i="${i}">Abrir chat</button></article>`).join(""):`<div class="card empty-state"><span class="hero-icon">◇</span><b>Todavía no hay equipos</b><small>Creá uno para coordinar varios agentes en una misma conversación.</small></div>`}</div>`;
 $("newTeam").onclick=teamForm;
 document.querySelectorAll(".useTeam").forEach(b=>b.onclick=()=>{activeTeam=teams[+b.dataset.i].name;activeAgent=null;showChat();state("Equipo listo · "+activeTeam);toast("Equipo seleccionado")});
 applyTilt()
}
function teamForm(){
 $("panel").innerHTML=`<div class="head"><div><span class="eyebrow">TEAM BUILDER</span><h2>Crear equipo</h2><p>Elegí los agentes que van a colaborar.</p></div></div><form id="teamForm" class="card form"><label>Nombre</label><input id="tn" required placeholder="Producto web"><label>Agentes</label><div class="checks">${agents.map((a,i)=>`<label><input type="checkbox" value="${esc(a.name)}" ${i<2?"checked":""}> ${esc(a.name)}</label>`).join("")}</div><div class="row"><button type="button" class="ghost" id="tc">Cancelar</button><button class="primary">Crear equipo</button></div></form>`;
 $("tc").onclick=()=>panel("teams");
 $("teamForm").onsubmit=e=>{e.preventDefault();const members=[...document.querySelectorAll(".checks input:checked")].map(x=>x.value);if(!members.length)return toast("Elegí al menos un agente");teams.push({name:$("tn").value.trim(),members});localStorage.setItem(K.teams,JSON.stringify(teams));panel("teams");toast("Equipo creado")}
}
function coderPanel(){
 $("panel").innerHTML=`<div class="head"><div><span class="eyebrow">AGENTIC CODEX</span><h2>Code Lab</h2><p>Un espacio visual para planificar, programar y revisar trabajo.</p></div></div><div class="code-grid"><div class="card form"><label>Agente programador</label><select id="ca">${agents.map(a=>`<option>${esc(a.name)}</option>`).join("")}</select><label>Repositorio</label><input id="cr" value="agenticuantico/AgenticWeb" placeholder="agenticuantico/AgenticWeb"><label>Objetivo</label><textarea id="cg" placeholder="Ej.: analizá el proyecto y proponé los cambios necesarios."></textarea><button class="primary" id="runCode">Analizar con Codex</button><div id="codexResult" class="code-result hidden"></div></div><div class="card code-flow"><div class="flow-icon">⌘</div><h3>Flujo Agentic</h3><div class="flow"><span>Objetivo</span><i>→</i><span>Plan</span><i>→</i><span>Código</span><i>→</i><span>Revisión</span></div><p>La ejecución real de herramientas y repositorios permanece en backend, sin exponer secretos al navegador.</p></div></div>`;
 $("runCode").onclick=async()=>{const g=$("cg").value.trim();const repo=$("cr").value.trim();if(!g)return toast("Escribí un objetivo");const box=$("codexResult");box.classList.remove("hidden");box.innerHTML="<b>Codex analizando…</b><br><span>Lectura de repositorio + Qwen</span>";$("runCode").disabled=true;try{const r=await fetch(API+"/v1/public/codex",{method:"POST",headers:{"Content-Type":"application/json","X-Guest-Session":guest},body:JSON.stringify({repo,task:g})});const d=await r.json();if(!r.ok||!d.ok)throw Error(d.message||"codex_failed");activeModel=d.model||activeModel;updateModelBadge(activeModel);box.innerHTML="<b>Codex · "+esc(d.repo)+"</b><br><small>"+esc(d.branch)+" · "+d.files.length+" archivos revisados</small><div class='codex-answer'>"+esc(d.answer).replace(/\n/g,"<br>")+"</div>"}catch(e){box.innerHTML="<b>No se pudo completar el análisis.</b><br><span>"+esc(e.message)+"</span>"}finally{$("runCode").disabled=false}}
}
function skillsPanel(){
 const skills=["Programación","Backend","Frontend","GitHub","Web design","UI/UX","3D","SEO","Datos","Investigación","Automatización","Asistencia"];
 $("panel").innerHTML=`<div class="head"><div><span class="eyebrow">CAPABILITIES</span><h2>Skills</h2><p>Capacidades reutilizables para tus agentes.</p></div></div><div class="skills">${skills.map((x,i)=>`<div class="skill tilt"><span class="skill-icon">${icon(["code","agents","chat","projects","spark"][i%5])}</span><b>${x}</b><span>Asignable a cualquier agente</span></div>`).join("")}</div>`;
 applyTilt()
}
function accountPanel(){
 const p=JSON.parse(localStorage.getItem(K.profile)||"{}");
 $("panel").innerHTML=`<div class="head"><div><span class="eyebrow">CUENTA</span><h2>Registro / perfil</h2><p>Base visual preparada para autenticación segura.</p></div></div><form id="profile" class="card form"><label>Nombre</label><input id="pn" value="${esc(p.name||"")}" placeholder="Tu nombre"><label>Email</label><input id="pe" value="${esc(p.email||"")}" type="email" placeholder="tu@email.com"><button class="primary">Guardar perfil</button></form>`;
 $("profile").onsubmit=e=>{e.preventDefault();localStorage.setItem(K.profile,JSON.stringify({name:$("pn").value,email:$("pe").value}));toast("Perfil guardado")}
}
function projectsPanel(){
 $("panel").innerHTML=`<div class="head"><div><span class="eyebrow">WORKSPACE</span><h2>Proyectos</h2><p>Separá trabajos y conversaciones.</p></div><button class="primary" id="project">＋ Nuevo trabajo</button></div><div class="card empty-state"><span class="hero-icon">◇</span><b>Tu espacio de proyectos</b><small>Iniciá una conversación nueva y usá agentes o equipos para cada objetivo.</small></div>`;
 $("project").onclick=()=>$("newChat").click()
}
function quick(view){
 $("quickMenu").classList.add("hidden");$("menuBtn").setAttribute("aria-expanded","false");
 if(view==="chat"){$("newChat").click();return}
 panel(view)
}
function applyTilt(){
 if(matchMedia("(pointer:coarse)").matches)return;
 document.querySelectorAll(".tilt").forEach(el=>{
  if(el.dataset.tiltBound)return;el.dataset.tiltBound="1";
  el.addEventListener("pointermove",e=>{const r=el.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;el.style.transform=`perspective(700px) rotateX(${-y*6}deg) rotateY(${x*8}deg) translateY(-2px)`});
  el.addEventListener("pointerleave",()=>el.style.transform="");
 });
}
document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>b.dataset.view==="chat"?showChat():panel(b.dataset.view));
document.querySelectorAll("[data-quick]").forEach(b=>b.onclick=()=>quick(b.dataset.quick));
$("mobileMenu").onclick=()=>{$("sidebar").classList.add("open");$("backdrop").classList.remove("hidden")};
$("backdrop").onclick=closeMobile;
$("menuBtn").onclick=e=>{e.stopPropagation();const open=$("quickMenu").classList.toggle("hidden");$("menuBtn").setAttribute("aria-expanded",String(!open))};
document.addEventListener("click",e=>{if(!$("quickMenu").contains(e.target)&&e.target!==$("menuBtn")){$("quickMenu").classList.add("hidden");$("menuBtn").setAttribute("aria-expanded","false")}});
$("composer").onsubmit=e=>{e.preventDefault();const t=$("input").value.trim();if(t&&!busy){$("input").value="";send(t)}};
$("input").oninput=()=>{$("input").style.height="auto";$("input").style.height=Math.min($("input").scrollHeight,140)+"px"};
$("input").onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("composer").requestSubmit()}};
$("newChat").onclick=()=>{conversation=crypto.randomUUID();history=[];localStorage.removeItem(K.chat);$("messages").innerHTML="";activeAgent=null;activeTeam=null;showChat();state("Cerebro listo");toast("Nueva conversación")};
window.addEventListener("load",()=>{
 document.querySelectorAll(".nav-icon[data-icon]").forEach(el=>el.innerHTML=icon(el.dataset.icon));
 history.forEach(x=>add(x.role,x.content,false));
 for(let i=0;i<45;i++){const p=document.createElement("i");p.style.setProperty("--x",(Math.random()*260-130)+"px");p.style.setProperty("--y",(Math.random()*260-130)+"px");p.style.setProperty("--z",(Math.random()*260-130)+"px");$("particles").appendChild(p)}
 applyTilt();
});