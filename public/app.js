import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import {GLTFLoader} from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";

const API=(window.AGENTICUANTICO_API_URL||"https://agenticweb.agenticuantico.workers.dev").replace(/\/$/,"");
const K={chat:"aq_chat_v7",conversations:"aq_conversations_v1",active:"aq_active_v1",session:"aq_guest_v6",agents:"aq_agents_v5",teams:"aq_teams_v5",profile:"aq_profile_v5",auth:"aq_auth_v1",improvement:"aq_improvement_consent_v1"};
let conversations=JSON.parse(localStorage.getItem(K.conversations)||"[]");
let currentId=localStorage.getItem(K.active)||"";
let history=[];
let guest=localStorage.getItem(K.session)||crypto.randomUUID();
let agents=JSON.parse(localStorage.getItem(K.agents)||"null")||[
{name:"Asistente",role:"Asistente general",skills:["conversación","organización"],knowledge:["español","productividad"]},
{name:"Programador",role:"Ingeniero de software",skills:["Python","JavaScript","GitHub","debugging"],knowledge:["backend","frontend","APIs","arquitectura"]},
{name:"Diseñador",role:"Diseñador UI/UX y 3D",skills:["UI/UX","3D","branding"],knowledge:["interfaces","responsive","experiencia de usuario"]}
];
let teams=JSON.parse(localStorage.getItem(K.teams)||"[]");
let activeAgent=null,activeTeam=null,busy=false,conversation=currentId||crypto.randomUUID(),activeModel="AgentiQ";
let authToken=localStorage.getItem(K.auth)||"",authUser=null,pendingAttachments=[];
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


let avatar3d=null;
function makeAvatarMaterial(color,roughness=.55,metalness=0){return new THREE.MeshStandardMaterial({color,roughness,metalness})}
function capsule(radius,length,material){const g=new THREE.CapsuleGeometry(radius,length,8,16);return new THREE.Mesh(g,material)}
function createHumanoid3D(gender="female"){
 const root=new THREE.Group(), skin=makeAvatarMaterial(gender==="female"?0xf0b8a0:0xc9947e,.68), dark=makeAvatarMaterial(0x10172a,.38,.55), hair=makeAvatarMaterial(gender==="female"?0x251b3b:0x172033,.42,.12), white=makeAvatarMaterial(0xeaf8ff,.22,.15), iris=makeAvatarMaterial(0x73dfff,.2,.65), lip=makeAvatarMaterial(0xc95e86,.42,.05), glow=makeAvatarMaterial(0x66eaff,.2,.7);
 const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.72,.95,10,20),dark);torso.scale.set(1.05,1.05,.62);torso.position.y=-1.05;root.add(torso);
 const neck=new THREE.Mesh(new THREE.CylinderGeometry(.18,.23,.34,16),skin);neck.position.y=-.25;root.add(neck);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.78,32,24),skin);head.scale.set(.84,1.08,.78);head.position.y=.58;root.add(head);root.userData.head=head;
 const hairCap=new THREE.Mesh(new THREE.SphereGeometry(.82,32,20,0,Math.PI*2,0,Math.PI*.62),hair);hairCap.scale.set(.87,1.02,.83);hairCap.position.set(0,.78,-.02);root.add(hairCap);
 if(gender==="female"){const lockL=new THREE.Mesh(new THREE.SphereGeometry(.33,20,16),hair);lockL.scale.set(.7,1.55,.55);lockL.position.set(-.65,.42,-.02);root.add(lockL);const lockR=lockL.clone();lockR.position.x=.65;root.add(lockR)}
 for(const x of[-.29,.29]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.115,20,14),white);eye.scale.z=.42;eye.position.set(x,.64,.68);root.add(eye);const p=new THREE.Mesh(new THREE.SphereGeometry(.055,16,12),iris);p.position.set(x,.64,.775);root.add(p)}
 const nose=new THREE.Mesh(new THREE.CapsuleGeometry(.045,.18,6,10),skin);nose.position.set(0,.39,.72);nose.rotation.x=Math.PI/2;root.add(nose);
 const mouth=new THREE.Mesh(new THREE.TorusGeometry(.15,.028,8,24,Math.PI),lip);mouth.position.set(0,.20,.70);mouth.rotation.z=Math.PI;mouth.scale.set(1,.75,1);root.add(mouth);root.userData.mouth=mouth;
 for(const x of[-.46,.46]){const arm=capsule(.17,.72, dark);arm.position.set(x,-1.05,0);arm.rotation.z=x<0?-.12:.12;root.add(arm);const hand=new THREE.Mesh(new THREE.SphereGeometry(.2,16,12),skin);hand.position.set(x*1.08,-1.72,.02);root.add(hand)}
 const core=new THREE.Mesh(new THREE.SphereGeometry(.15,20,16),glow);core.position.set(0,-.98,.42);root.add(core);
 root.userData.blink=0;root.userData.gender=gender;
 return root
}
async function initAvatar3D(){
 const canvas=$("avatarCanvas");if(!canvas)return;
 try{
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setSize(canvas.clientWidth||500,canvas.clientHeight||420,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(28,1,.1,100);camera.position.set(0,.1,6.2);
  scene.add(new THREE.AmbientLight(0x9ccfff,1.5));const key=new THREE.DirectionalLight(0xffffff,2.5);key.position.set(-2,4,5);scene.add(key);const rim=new THREE.PointLight(0x735cff,16,8);rim.position.set(2,1,-1);scene.add(rim);const cyan=new THREE.PointLight(0x5feeff,12,7);cyan.position.set(-2,.2,2);scene.add(cyan);
  const group=new THREE.Group();scene.add(group);
  const loadUrl=window.AGENTICUANTICO_AVATAR_GLB||localStorage.getItem("aq_avatar_glb")||"";
  const build=gender=>{group.clear();avatar3d.model=createHumanoid3D(gender);group.add(avatar3d.model)};
  avatar3d={renderer,scene,camera,group,model:null,speaking:false,gender:"female",mouthLevel:0,setSpeaking(v){this.speaking=!!v},setMouth(v){this.mouthLevel=Math.max(0,Math.min(1,v))},setGender(g){this.gender=g;build(g)},setGlb(url){new GLTFLoader().load(url,g=>{group.clear();avatar3d.model=g.scene;group.add(g.scene);$("avatarRigStatus").textContent="GLB · cargado";},undefined,()=>{$("avatarRigStatus").textContent="3D · fallback humanoide"})}};
  build("female");
  if(loadUrl){avatar3d.setGlb(loadUrl)} else $("avatarRigStatus").textContent="3D · humanoide";
  const clock=new THREE.Clock(),resize=()=>{const w=canvas.clientWidth||500,h=canvas.clientHeight||420;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()};new ResizeObserver(resize).observe(canvas);resize();
  const animate=()=>{const t=clock.getElapsedTime(),m=avatar3d.model;if(m){m.rotation.y=Math.sin(t*.42)*.08;m.position.y=Math.sin(t*1.15)*.035;if(avatar3d.speaking)avatar3d.mouthLevel=.35+.65*(.5+.5*Math.sin(t*22));const mouth=m.userData.mouth;if(mouth)mouth.scale.y=.7+avatar3d.mouthLevel*2.4;const head=m.userData.head;if(head){head.rotation.z=Math.sin(t*.7)*.018;head.rotation.x=Math.sin(t*.53)*.012}}renderer.render(scene,camera);requestAnimationFrame(animate)};animate();
 }catch(e){const st=$("avatarRigStatus");if(st)st.textContent="3D · navegador no compatible"}
}

function state(x){$("status").textContent=x;$("sideStatus").textContent=x;const c=document.getElementById("chatContext");if(c)c.textContent=x}
function modelLabel(){return "AgentiQ"}
function updateModelBadge(){activeModel="AgentiQ";const pill=document.querySelector(".pill");if(pill)pill.textContent="AgentiQ · Cerebro";const cm=document.getElementById("contextModel");if(cm)cm.textContent="AgentiQ · Cerebro";}
async function loadModelInfo(){
 try{
  const r=await fetch(API+"/v1/public/model",{headers:{"Accept":"application/json"}});
  const d=await r.json();
  if(d?.ok){activeModel=d.model||activeModel;updateModelBadge(activeModel);state("Cerebro listo · "+modelLabel(activeModel))}
 }catch{}
}
function toast(x){$("toast").textContent=x;$("toast").classList.add("show");clearTimeout(window.__toast);window.__toast=setTimeout(()=>$("toast").classList.remove("show"),2200)}
function currentVoice(){return voiceProfiles.find(v=>v.id===selectedVoiceId)||voiceProfiles[0]}
function bestDeviceVoice(profile){const target=profile.lang.toLowerCase(),base=target.split("-")[0],pool=deviceVoices||[],used=voiceProfiles.filter(v=>v!==profile&&v.__voice).map(v=>v.__voice);const v=pool.find(v=>v.lang.toLowerCase()===target&&profile.hints?.some(h=>v.name.toLowerCase().includes(h.toLowerCase())))||pool.find(v=>v.lang.toLowerCase()===target&&!used.includes(v.name))||pool.find(v=>v.lang.toLowerCase().startsWith(base)&&!used.includes(v.name))||pool.find(v=>v.lang.toLowerCase().startsWith(base))||pool.find(v=>v.default)||null;if(v)profile.__voice=v.name;return v}
function setSpeaking(on,label){window.__avatar3d?.setSpeaking(on);const av=$("robotAvatar"),vs=$("voiceStatus"),st=$("avatarState");if(av)av.classList.toggle("speaking",!!on);if(vs)vs.textContent=label||(on?"Hablando…":"Voz lista");if(st)st.textContent=on?"Hablando · sincronización visual activa":"En línea · listo para hablar"}
function speechText(text){return String(text||"").replace(/<[^>]*>/g," ").replace(/\*{1,3}/g,"").replace(/[_~#>`]/g,"").replace(/\[([^\]]+)\]\([^\)]+\)/g,"$1").replace(/\s{2,}/g," ").trim()}
function speak(text){const clean=speechText(text);if(!clean||typeof speechSynthesis==="undefined")return;const p=currentVoice(),v=bestDeviceVoice(p);speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(clean.slice(0,12000));u.lang=p.lang;u.pitch=p.pitch;u.rate=.98;u.volume=1;if(v)u.voice=v;u.onstart=()=>setSpeaking(true,"Hablando…");u.onboundary=()=>{const av=$("robotAvatar");if(av){av.classList.remove("mouth-a","mouth-b");void av.offsetWidth;av.classList.add(Math.random()>.5?"mouth-a":"mouth-b")}window.__avatar3d?.setMouth(.8)};u.onend=()=>{setSpeaking(false,"Voz lista");const av=$("robotAvatar");if(av)av.classList.remove("mouth-a","mouth-b")};u.onerror=()=>setSpeaking(false,"Voz no disponible");speechSynthesis.speak(u)}
function populateDeviceVoices(){deviceVoices=typeof speechSynthesis!=="undefined"?speechSynthesis.getVoices():[];renderVoiceList()}
function renderVoiceList(){const box=$("voiceList");if(!box)return;const list=voiceProfiles.filter(v=>v.gender===voiceGender);box.innerHTML=list.map(v=>`<button class="voice-option ${v.id===selectedVoiceId?"active":""}" data-voice="${v.id}"><span class="voice-avatar">${v.gender==="female"?"♀":"♂"}</span><span><b>${esc(v.name)}</b><small>${esc(v.label)}</small></span><i>${v.id===selectedVoiceId?"✓":"▶"}</i></button>`).join("");box.querySelectorAll("[data-voice]").forEach(b=>b.onclick=()=>selectVoice(b.dataset.voice))}
function selectVoice(id){const p=voiceProfiles.find(v=>v.id===id);if(!p)return;window.__avatar3d?.setGender(p.gender);selectedVoiceId=id;voiceGender=p.gender;const avatar=$("robotAvatar");if(avatar)avatar.dataset.gender=p.gender;localStorage.setItem("aq_voice",id);const name=$("voiceName");if(name)name.textContent=p.name+" · "+p.label;const gp=$("genderPicker");if(gp)gp.innerHTML="◈ Avatar <small>"+(p.gender==="female"?"Femenino":"Masculino")+"</small>";renderVoiceList();toast("Voz seleccionada · "+p.name)}
function openVoicePanel(){voiceGender=currentVoice().gender;$("voicePanel").classList.remove("hidden");renderVoiceList()}
function toggleRecognition(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){toast("Este navegador no habilita reconocimiento de voz");return}if(listening){recognition?.stop();return}recognition=new SR();recognition.lang=currentVoice().lang;recognition.interimResults=true;recognition.continuous=false;recognition.onstart=()=>{listening=true;$("voiceInput").classList.add("recording");$("voiceStatus").textContent="Escuchando…";$("avatarState").textContent="Escuchando · hablá ahora"};recognition.onresult=e=>{let final="";for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal)final+=e.results[i][0].transcript}recognition.__final=(recognition.__final||"")+final};recognition.onerror=()=>{listening=false;$("voiceInput").classList.remove("recording");$("voiceStatus").textContent="Voz lista"};recognition.onend=()=>{listening=false;$("voiceInput").classList.remove("recording");$("voiceStatus").textContent="Voz lista";const t=(recognition.__final||"").trim();recognition.__final="";$("input").value="";if(t&&!busy)send(t,{silentUser:true})};recognition.start()}

function persist(){const c=conversations.find(x=>x.id===currentId);if(c){c.messages=history.slice(-100);c.updatedAt=Date.now();const first=history.find(x=>x.role==="user"&&x.content);if(first)c.title=String(first.content).replace(/\s+/g," ").slice(0,52)+(String(first.content).length>52?"…":"")}localStorage.setItem(K.conversations,JSON.stringify(conversations.slice(-50)));localStorage.setItem(K.active,currentId);if(authToken&&!window.__syncing)syncRemoteConversations()}
function ensureConversation(){if(!conversations.length){const old=JSON.parse(localStorage.getItem("aq_chat_v7")||"[]");if(old.length){currentId=crypto.randomUUID();conversation=currentId;conversations.push({id:currentId,title:"Conversación anterior",createdAt:Date.now(),updatedAt:Date.now(),messages:old.slice(-100)});persist()}}if(!conversations.find(x=>x.id===currentId)){currentId=crypto.randomUUID();conversation=currentId;conversations.push({id:currentId,title:"Nueva conversación",createdAt:Date.now(),updatedAt:Date.now(),messages:[]});persist()}}
function renderConversationList(){const box=$("conversationList");if(!box)return;const sorted=[...conversations].sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,20);box.innerHTML=sorted.map(c=>'<div class="conversation-row '+(c.id===currentId?"active":"")+'"><button class="conversation-open" data-conversation="'+c.id+'"><span class="conversation-dot"></span><span>'+esc(c.title||"Nueva conversación")+'</span></button><button class="conversation-delete" data-delete-conversation="'+c.id+'" aria-label="Borrar conversación">×</button></div>').join("");box.querySelectorAll("[data-conversation]").forEach(b=>b.onclick=()=>selectConversation(b.dataset.conversation));box.querySelectorAll("[data-delete-conversation]").forEach(b=>b.onclick=()=>deleteConversation(b.dataset.deleteConversation))}
function selectConversation(id){if(id===currentId)return;persist();const c=conversations.find(x=>x.id===id);if(!c)return;currentId=id;conversation=id;history=(c.messages||[]).slice();$("messages").innerHTML="";ensureConversation();history=(conversations.find(c=>c.id===currentId)?.messages||[]).slice();history.forEach(x=>add(x.role,x.content,false));renderConversationList();renderConversationList();showChat();state("Cerebro listo")}
function newConversation(){persist();currentId=crypto.randomUUID();conversation=currentId;history=[];conversations.push({id:currentId,title:"Nueva conversación",createdAt:Date.now(),updatedAt:Date.now(),messages:[]});$("messages").innerHTML="";activeAgent=null;activeTeam=null;persist();renderConversationList();showChat();state("Cerebro listo");toast("Nueva conversación")}
function deleteConversation(id){if(!confirm("¿Borrar esta conversación? Esta acción no se puede deshacer."))return;conversations=conversations.filter(x=>x.id!==id);if(!conversations.length){currentId="";ensureConversation()}if(id===currentId){currentId=conversations[0].id;conversation=currentId;history=(conversations[0].messages||[]).slice();$("messages").innerHTML="";history.forEach(x=>add(x.role,x.content,false))}persist();renderConversationList();toast("Conversación borrada")}
async function remote(text,attachments=[]){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),45000);
 try{
  const r=await fetch(API+"/v1/public/chat",{method:"POST",signal:c.signal,headers:{"Content-Type":"application/json","X-Guest-Session":guest,...(authToken?{"Authorization":"Bearer "+authToken}:{})},
   body:JSON.stringify({conversation_id:conversation,message:text,consent_to_memory:localStorage.getItem(K.improvement)==="true",history:history.slice(-12),agent:agents.find(a=>a.name===activeAgent)||null,team:teams.find(a=>a.name===activeTeam)||null,attachments:attachments.map(a=>({name:a.name,type:a.type,kind:a.kind,data:a.data}))})});
  const d=await r.json().catch(()=>({}));if(!r.ok||!d.answer)throw Error(d.message||"ai_unavailable");return d.answer
 }finally{clearTimeout(t)}
}
async function send(text,opts={}){
 if(busy)return;busy=true;$("send").disabled=true;if(!opts.silentUser)add("user",text);else{history.push({role:"user",content:text});persist()}
 const p=add("assistant","Pensando…",false);state("Conectando con AgentiQ…");const attachments=pendingAttachments.slice();pendingAttachments=[];renderAttachments();
 try{const a=await remote(text,attachments);p.innerHTML=esc(a).replace(/\n/g,"<br>");history.push({role:"assistant",content:a});persist();speak(a);state(activeTeam?"Equipo conectado · AgentiQ":activeAgent?activeAgent+" · AgentiQ":"Cerebro conectado · AgentiQ")}
 catch(e){p.textContent=e.name==="AbortError"?"AgentiQ está tardando demasiado. Probá nuevamente.":"No pude conectar con AgentiQ. Intentá nuevamente.";persist();state("Cerebro no disponible");toast("No se pudo conectar con el cerebro")}
 finally{busy=false;$("send").disabled=false}
}

function renderAttachments(){const box=$("attachmentTray");if(!box)return;box.innerHTML=pendingAttachments.map((a,i)=>'<div class="attachment-chip"><span>'+ (a.kind==="image"?"▧":"◫") +'</span><b>'+esc(a.name)+'</b><button type="button" data-remove-attachment="'+i+'">×</button></div>').join("");box.classList.toggle("hidden",!pendingAttachments.length);box.querySelectorAll("[data-remove-attachment]").forEach(b=>b.onclick=()=>{pendingAttachments.splice(+b.dataset.removeAttachment,1);renderAttachments()})}
function readFile(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;if(file.type.startsWith("image/"))r.readAsDataURL(file);else if(file.type.startsWith("text/")||/\.(md|json|js|ts|css|html|py|txt|csv|xml|yaml|yml)$/i.test(file.name))r.readAsText(file);else resolve(null)})}
async function handleFiles(files){for(const file of [...files].slice(0,5)){if(file.size>5*1024*1024){toast("Archivo demasiado grande: "+file.name);continue}const data=await readFile(file);if(data===null){toast("Formato no compatible: "+file.name);continue}pendingAttachments.push({name:file.name,type:file.type,kind:file.type.startsWith("image/")?"image":"file",data})}renderAttachments()}
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
async function loadAuth(){try{const r=await fetch(API+"/v1/auth/config");const d=await r.json();window.__googleClientId=d.client_id||"";setTimeout(setupGoogle,0)}catch{}if(authToken){try{const r=await fetch(API+"/v1/auth/me",{headers:{Authorization:"Bearer "+authToken}});const d=await r.json();if(d.ok){authUser=d.user;syncRemoteConversations()}else{authToken="";localStorage.removeItem(K.auth)}}catch{}}}
async function syncRemoteConversations(){if(!authToken||window.__syncing)return;window.__syncing=true;try{const r=await fetch(API+"/v1/user/conversations",{headers:{Authorization:"Bearer "+authToken}});if(r.ok){const d=await r.json();const remote=Array.isArray(d.conversations)?d.conversations:[];const map=new Map([...remote,...conversations].map(c=>[c.id,c]));conversations=[...map.values()].sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,50);localStorage.setItem(K.conversations,JSON.stringify(conversations));if(!conversations.find(c=>c.id===currentId)){currentId=conversations[0]?.id||"";conversation=currentId}renderConversationList()}if(conversations.length){await fetch(API+"/v1/user/conversations",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+authToken},body:JSON.stringify({conversations})})}}catch{}finally{window.__syncing=false}}

function setupGoogle(){const box=$("googleButton"),client=window.__googleClientId;if(!box||!client||!window.google?.accounts?.id)return;box.innerHTML="";window.google.accounts.id.initialize({client_id:client,color_scheme:"dark",callback:handleGoogleCredential});window.google.accounts.id.renderButton(box,{theme:"filled_black",size:"large",shape:"pill",text:"continue_with",locale:"es",width:330})}
async function handleGoogleCredential(response){try{const r=await fetch(API+"/v1/auth/google",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential:response.credential})});const d=await r.json();if(!r.ok||!d.ok)throw Error(d.message||"No se pudo iniciar sesión");authToken=d.token;authUser=d.user;localStorage.setItem(K.auth,authToken);localStorage.setItem(K.profile,JSON.stringify({name:authUser.name,email:authUser.email,picture:authUser.picture||""}));toast("Cuenta conectada con Google");accountPanel()}catch(e){toast(e.message||"No se pudo iniciar sesión con Google")}}
function accountPanel(){const p=JSON.parse(localStorage.getItem(K.profile)||"{}"),u=authUser||p;if(authUser){$("panel").innerHTML='<div class="head"><div><span class="eyebrow">CUENTA</span><h2>Tu cuenta</h2><p>Sesión activa y acceso al espacio completo.</p></div></div><div class="card account-card"><div class="account-user"><div class="account-photo">'+(u.picture?'<img src="'+esc(u.picture)+'" alt="">':"AQ")+'</div><div><b>'+esc(u.name||"Usuario")+'</b><span>'+esc(u.email||"")+'</span></div></div><div class="benefits"><b>Acceso habilitado</b><span>Conversaciones, agentes, equipos, CodQ, adjuntos y estudio de voz.</span></div><label class="consent-row"><input id="improvementConsent" type="checkbox" '+(localStorage.getItem(K.improvement)==="true"?"checked":"")+'><span>Permitir usar mis conversaciones de forma agregada para mejorar AgentiCuantico. Podés cambiar esta opción cuando quieras.</span></label><button class="ghost" id="logout">Cerrar sesión</button></div>';$("improvementConsent").onchange=e=>localStorage.setItem(K.improvement,String(e.target.checked));$("logout").onclick=()=>{authToken="";authUser=null;localStorage.removeItem(K.auth);window.google?.accounts?.id?.disableAutoSelect?.();accountPanel();toast("Sesión cerrada")}}else{$("panel").innerHTML='<div class="head"><div><span class="eyebrow">CUENTA</span><h2>Registro e inicio de sesión</h2><p>Registrate o iniciá sesión con tu cuenta de Google para acceder a los beneficios.</p></div></div><div class="card auth-card"><div class="auth-orb">AQ</div><h3>Tu cuenta de AgentiCuantico</h3><p>Un acceso para conservar tu perfil y configuración de agentes y voz.</p><div id="googleButton" class="google-button"></div><div class="auth-note">Google autentica tu cuenta; AgentiCuantico no necesita tu contraseña de Google.</div><div class="auth-consent"><b>Privacidad</b><span>El historial se guarda localmente. El uso agregado para mejora requiere tu permiso explícito.</span></div></div>';setTimeout(setupGoogle,0)}}
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
$("composer").onsubmit=e=>{e.preventDefault();const t=$("input").value.trim();if((t||pendingAttachments.length)&&!busy){$("input").value="";send(t||"Analizá los archivos adjuntos.")}};
$("input").oninput=()=>{$("input").style.height="auto";$("input").style.height=Math.min($("input").scrollHeight,140)+"px"};
$("input").onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("composer").requestSubmit()}};
$("newChat").onclick=newConversation;$("clearHistory").onclick=()=>{if(!confirm("¿Borrar todo el historial local?"))return;conversations=[];currentId="";history=[];ensureConversation();$("messages").innerHTML="";renderConversationList();toast("Historial borrado")};
window.addEventListener("load",()=>{
 document.querySelectorAll(".nav-icon[data-icon]").forEach(el=>el.innerHTML=icon(el.dataset.icon));
 history.forEach(x=>add(x.role,x.content,false));
 for(let i=0;i<45;i++){const p=document.createElement("i");p.style.setProperty("--x",(Math.random()*260-130)+"px");p.style.setProperty("--y",(Math.random()*260-130)+"px");p.style.setProperty("--z",(Math.random()*260-130)+"px");$("particles").appendChild(p)}
 applyTilt();
 if(typeof speechSynthesis!=="undefined"){populateDeviceVoices();speechSynthesis.addEventListener?.("voiceschanged",populateDeviceVoices)}
 selectVoice(selectedVoiceId);initAvatar3D();loadAuth();
 $("attachButton").onclick=()=>$("attachInput").click();$("attachInput").onchange=e=>{handleFiles(e.target.files);e.target.value=""};$("voiceInput").onclick=toggleRecognition;
 $("stopVoice").onclick=()=>{window.speechSynthesis?.cancel();setSpeaking(false,"Voz lista")};
 $("voicePicker").onclick=openVoicePanel;$("langPicker").onclick=openVoicePanel;
 $("genderPicker").onclick=()=>{const p=currentVoice();selectVoice(p.gender==="female"?"mateo":"clara")};
 $("closeVoice").onclick=()=>$("voicePanel").classList.add("hidden");
 document.querySelectorAll(".voice-tab").forEach(b=>b.onclick=()=>{voiceGender=b.dataset.voiceGender;document.querySelectorAll(".voice-tab").forEach(x=>x.classList.toggle("active",x===b));renderVoiceList()});

});