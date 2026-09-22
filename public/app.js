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
const voiceProfiles=[
{id:"clara",name:"Clara",gender:"female",lang:"es-AR",label:"Español (Argentina)",pitch:1.05},
{id:"luna",name:"Luna",gender:"female",lang:"es-AR",label:"Español (Argentina)",pitch:1.12},
{id:"valentina",name:"Valentina",gender:"female",lang:"es-ES",label:"Español (España)",pitch:1.02},
{id:"alexa",name:"Alexa",gender:"female",lang:"en-US",label:"English (United States)",pitch:1.02},
{id:"sophie",name:"Sophie",gender:"female",lang:"en-US",label:"English (United States)",pitch:1.08},
{id:"mateo",name:"Mateo",gender:"male",lang:"es-AR",label:"Español (Argentina)",pitch:.9},
{id:"bruno",name:"Bruno",gender:"male",lang:"es-AR",label:"Español (Argentina)",pitch:.84},
{id:"diego",name:"Diego",gender:"male",lang:"es-ES",label:"Español (España)",pitch:.9},
{id:"alex",name:"Alex",gender:"male",lang:"en-US",label:"English (United States)",pitch:.88},
{id:"james",name:"James",gender:"male",lang:"en-US",label:"English (United States)",pitch:.82}
];
let selectedVoiceId=localStorage.getItem("aq_voice")||"clara";
let voiceGender="female",deviceVoices=[],recognition=null,listening=false;
localStorage.setItem(K.session,guest);

const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const icon=(name)=>({chat:"<svg viewBox='0 0 24 24'><path d='M5 6.5h14v9H9l-4 3v-12Z'/><path d='M8 10h8M8 13h5'/></svg>",projects:"<svg viewBox='0 0 24 24'><path d='M4 7.5h6l1.5 2H20v9H4z'/><path d='M4 7.5V5h6l1.5 2'/></svg>",agents:"<svg viewBox='0 0 24 24'><circle cx='12' cy='8' r='3'/><path d='M6 19c.6-3.2 2.7-5 6-5s5.4 1.8 6 5'/><path d='M4 12h3M17 12h3'/></svg>",teams:"<svg viewBox='0 0 24 24'><circle cx='8' cy='9' r='2.5'/><circle cx='16' cy='9' r='2.5'/><path d='M3.5 18c.5-2.5 2-4 4.5-4s4 1.5 4.5 4M11.5 18c.5-2.5 2-4 4.5-4s4 1.5 4.5 4'/></svg>",code:"<svg viewBox='0 0 24 24'><path d='m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16'/></svg>",user:"<svg viewBox='0 0 24 24'><circle cx='12' cy='8' r='3'/><path d='M5 20c.7-4 3-6 7-6s6.3 2 7 6'/></svg>",spark:"<svg viewBox='0 0 24 24'><path d='m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7Z'/><path d='m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7Z'/></svg>"}[name]||"");

function state(x){$("status").textContent=x;$("sideStatus").textContent=x;const c=document.getElementById("chatContext");if(c)c.textContent=x}
function modelLabel(model){
 const m=String(model||"Qwen/Qwen3.8-27B").replace(":fastest","");
 const parts=m.split("/");
 const name=parts[parts.length-1];
 return name.replace(/^Qwen/i,"Qwen");
}
function updateModelBadge(model){
 activeModel=model||activeModel;
 const pill=document.querySelector(".pill");
 if(pill)pill.textContent=modelLabel(activeModel)+" · HF"; const cm=document.getElementById("contextModel"); if(cm)cm.textContent=modelLabel(activeModel)+" · HF";
}
async function loadModelInfo(){
 try{
  const r=await fetch(API+"/v1/public/model",{headers:{"Accept":"application/json"}});
  const d=await r.json();
  if(d?.ok){activeModel=d.model||activeModel;updateModelBadge(activeModel);state("Cerebro listo · "+modelLabel(activeModel))}
 }catch{}
}
function toast(x){$("toast").textContent=x;$("toast").classList.add("show");clearTimeout(window.__toast);window.__toast=setTimeout(()=>$("toast").classList.remove("show"),2200)}
function currentVoice(){return voiceProfiles.find(v=>v.id===selectedVoiceId)||voiceProfiles[0]}
function bestDeviceVoice(profile){const target=profile.lang.toLowerCase(),base=target.split("-")[0],pool=deviceVoices||[];return pool.find(v=>v.lang.toLowerCase()===target)||pool.find(v=>v.lang.toLowerCase().startsWith(base)&&v.localService)||pool.find(v=>v.lang.toLowerCase().startsWith(base))||pool.find(v=>v.default)||null}
function setSpeaking(on,label){const av=$("robotAvatar"),vs=$("voiceStatus"),st=$("avatarState");if(av)av.classList.toggle("speaking",!!on);if(vs)vs.textContent=label||(on?"Hablando…":"Voz lista");if(st)st.textContent=on?"Hablando · sincronización visual activa":"En línea · listo para hablar"}
function speak(text){if(!text||typeof speechSynthesis==="undefined")return;const p=currentVoice(),v=bestDeviceVoice(p);speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(String(text).slice(0,12000));u.lang=p.lang;u.pitch=p.pitch;u.rate=.98;u.volume=1;if(v)u.voice=v;u.onstart=()=>setSpeaking(true,"Hablando…");u.onboundary=()=>{const av=$("robotAvatar");if(av){av.classList.remove("mouth-a","mouth-b");void av.offsetWidth;av.classList.add(Math.random()>.5?"mouth-a":"mouth-b")}};u.onend=()=>{setSpeaking(false,"Voz lista");const av=$("robotAvatar");if(av)av.classList.remove("mouth-a","mouth-b")};u.onerror=()=>setSpeaking(false,"Voz no disponible");speechSynthesis.speak(u)}
function populateDeviceVoices(){deviceVoices=typeof speechSynthesis!=="undefined"?speechSynthesis.getVoices():[];renderVoiceList()}
function renderVoiceList(){const box=$("voiceList");if(!box)return;const list=voiceProfiles.filter(v=>v.gender===voiceGender);box.innerHTML=list.map(v=>`<button class="voice-option ${v.id===selectedVoiceId?"active":""}" data-voice="${v.id}"><span class="voice-avatar">${v.gender==="female"?"♀":"♂"}</span><span><b>${esc(v.name)}</b><small>${esc(v.label)}</small></span><i>${v.id===selectedVoiceId?"✓":"▶"}</i></button>`).join("");box.querySelectorAll("[data-voice]").forEach(b=>b.onclick=()=>selectVoice(b.dataset.voice))}
function selectVoice(id){const p=voiceProfiles.find(v=>v.id===id);if(!p)return;selectedVoiceId=id;voiceGender=p.gender;localStorage.setItem("aq_voice",id);const name=$("voiceName");if(name)name.textContent=p.name+" · "+p.label;const gp=$("genderPicker");if(gp)gp.innerHTML="◈ Avatar <small>"+(p.gender==="female"?"Femenino":"Masculino")+"</small>";renderVoiceList();toast("Voz seleccionada · "+p.name)}
function openVoicePanel(){voiceGender=currentVoice().gender;voicePanel.classList.remove("hidden");renderVoiceList()}
function toggleRecognition(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){toast("Este navegador no habilita reconocimiento de voz");return}if(listening){recognition?.stop();return}recognition=new SR();recognition.lang=currentVoice().lang;recognition.interimResults=true;recognition.continuous=false;recognition.onstart=()=>{listening=true;$("voiceInput").classList.add("recording");$("voiceStatus").textContent="Escuchando…";$("avatarState").textContent="Escuchando · hablá ahora"};recognition.onresult=e=>{let final="";for(let i=e.resultIndex;i<e.results.length;i++)final+=e.results[i][0].transcript;$("input").value=final;$("input").dispatchEvent(new Event("input"))};recognition.onerror=()=>{listening=false;$("voiceInput").classList.remove("recording");$("voiceStatus").textContent="Voz lista"};recognition.onend=()=>{listening=false;$("voiceInput").classList.remove("recording");$("voiceStatus").textContent="Voz lista";const t=$("input").value.trim();if(t&&!busy)send(t)};recognition.start()}

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
  history.push({role:"assistant",content:a});persist(); speak(a);
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
 $("title").textContent=({projects:"Proyectos",agents:"Agentes",teams:"Equipos de trabajo",coder:"CodQ",account:"Registro / perfil",skills:"Skills"})[view]||"AgentiCuantico";
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
 $("panel").innerHTML=`<div class="codq-workspace">
  <div class="codq-head"><div><span class="eyebrow">CODQ · AGENTIC WORKSPACE</span><h2>Workspace</h2><p>Programación, UI/UX, ilustración 3D y QA coordinados desde un mismo espacio.</p></div><div class="codq-head-actions"><span class="workspace-state">● Workspace listo</span><button class="primary" id="codqRun">Ejecutar análisis</button></div></div>
  <div class="codq-toolbar"><input id="cr" value="agenticuantico/AgenticWeb" aria-label="Repositorio"><button class="tool-tab active" data-codq-tab="editor">Editor</button><button class="tool-tab" data-codq-tab="preview">Preview</button><button class="tool-tab" data-codq-tab="terminal">Terminal</button><button class="tool-tab" data-codq-tab="agents">Equipo</button></div>
  <div class="codq-grid">
   <aside class="codq-files card"><div class="pane-title">PROYECTO <span>main</span></div><div class="tree"><button class="tree-file active">▾ <b>public</b></button><button class="tree-file indent">◇ index.html</button><button class="tree-file indent active-file">◇ app.js</button><button class="tree-file indent">◇ styles.css</button><button class="tree-file indent">◇ favicon.svg</button><button class="tree-file">▾ <b>.github</b></button><button class="tree-file indent">◇ workflows</button><button class="tree-file">◇ wrangler.jsonc</button><button class="tree-file">◇ README.md</button></div><div class="repo-meta"><span>Repositorio</span><b id="repoMeta">AgenticWeb</b><small>Secretos protegidos en backend</small></div></aside>
   <section class="codq-editor card"><div class="editor-top"><div><span id="editorFile">app.js</span><small id="editorLang">JavaScript · Agentic UI</small></div><div class="editor-actions"><button class="ghost mini" id="copyPlan">Copiar plan</button><button class="ghost mini" id="applyPatch">Aplicar cambio</button></div></div><pre id="editorCode" class="code-editor"><code><span class="kw">const</span> workspace = {
  <span class="key">frontend</span>: <span class="str">"AgentiCuantico"</span>,
  <span class="key">agents</span>: [<span class="str">"programación"</span>, <span class="str">"UI/UX"</span>, <span class="str">"3D"</span>, <span class="str">"QA"</span>],
  <span class="key">workflow</span>: [<span class="str">"analizar"</span>, <span class="str">"diseñar"</span>, <span class="str">"implementar"</span>, <span class="str">"revisar"</span>]
};</code></pre><div id="codqOutput" class="codq-output"><b>CodQ está listo.</b><span>Definí un objetivo y ejecutá el análisis para convertirlo en un plan de trabajo.</span></div></section>
   <aside class="codq-crew card"><div class="pane-title">EQUIPO AGENTIC <span>4 roles</span></div><div class="crew"><div class="crew-item"><i>⌘</i><div><b>Programador</b><small>Código · APIs · GitHub</small></div><em>ON</em></div><div class="crew-item"><i>✦</i><div><b>UI/UX</b><small>Arquitectura visual · responsive</small></div><em>ON</em></div><div class="crew-item"><i>◇</i><div><b>3D / Ilustración</b><small>Avatar · motion · identidad</small></div><em>ON</em></div><div class="crew-item"><i>✓</i><div><b>QA / Seguridad</b><small>Validación · secretos · regresión</small></div><em>ON</em></div></div><div class="goal-box"><label>Objetivo del trabajo</label><textarea id="cg" placeholder="Ej.: llevar el sitio al diseño 3D de referencia y convertir CodQ en un workspace profesional."></textarea><small>CodQ analiza el repositorio real antes de proponer cambios.</small></div></aside>
  </div>
 </div>`;
 const output=$("codqOutput"),run=$("codqRun");
 async function runCodQ(){const repo=$("cr").value.trim(),task=$("cg").value.trim()||"Analizá el proyecto y prepará la siguiente evolución del workspace CodQ, UI/UX 3D, voz y experiencia de agentes.";run.disabled=true;run.textContent="Analizando…";output.innerHTML="<b>CodQ trabajando…</b><span>Inspeccionando repositorio + preparando plan de implementación.</span>";try{const r=await fetch(API+"/v1/public/codex",{method:"POST",headers:{"Content-Type":"application/json","X-Guest-Session":guest},body:JSON.stringify({repo,task})});const d=await r.json();if(!r.ok||!d.ok)throw Error(d.message||"codex_failed");activeModel=d.model||activeModel;updateModelBadge(activeModel);$("repoMeta").textContent=String(d.repo).split("/").pop();output.innerHTML="<b>CodQ · análisis completado</b><small>"+esc(d.branch)+" · "+d.files.length+" archivos revisados · "+esc(modelLabel(d.model))+"</small><div class='codq-answer'>"+esc(d.answer).replace(/\n/g,"<br>")+"</div>";toast("Plan CodQ generado")}catch(e){output.innerHTML="<b>CodQ no pudo completar el análisis.</b><span>"+esc(e.message)+"</span>";toast("Error de análisis")}finally{run.disabled=false;run.textContent="Ejecutar análisis"}}
 run.onclick=runCodQ;$("copyPlan").onclick=()=>{navigator.clipboard?.writeText($("codqOutput").innerText||"");toast("Plan copiado")};$("applyPatch").onclick=()=>toast("Aplicación protegida: requiere autorización del workspace");document.querySelectorAll("[data-codq-tab]").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tool-tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");toast(b.textContent+" listo")});
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
 if(typeof speechSynthesis!=="undefined"){populateDeviceVoices();speechSynthesis.addEventListener?.("voiceschanged",populateDeviceVoices)}
 selectVoice(selectedVoiceId);
 $("voiceInput").onclick=toggleRecognition;
 $("stopVoice").onclick=()=>{speechSynthesis?.cancel();setSpeaking(false,"Voz lista")};
 $("voicePicker").onclick=openVoicePanel;$("langPicker").onclick=openVoicePanel;
 $("genderPicker").onclick=()=>{const p=currentVoice();selectVoice(p.gender==="female"?"mateo":"clara")};
 $("closeVoice").onclick=()=>$("voicePanel").classList.add("hidden");
 document.querySelectorAll(".voice-tab").forEach(b=>b.onclick=()=>{voiceGender=b.dataset.voiceGender;document.querySelectorAll(".voice-tab").forEach(x=>x.classList.toggle("active",x===b));renderVoiceList()});

});