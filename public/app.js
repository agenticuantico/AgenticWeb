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
 const root=new THREE.Group();
 const skin=makeAvatarMaterial(gender==="female"?0xf0b8a0:0xc9947e,.68);
 const dark=makeAvatarMaterial(0x0b1224,.34,.68);
 const hair=makeAvatarMaterial(gender==="female"?0x241638:0x111a2b,.4,.18);
 const white=makeAvatarMaterial(0xf4fbff,.18,.2);
 const iris=makeAvatarMaterial(0x67ddff,.12,.82);
 const lip=makeAvatarMaterial(0xd95f8b,.36,.12);
 const glow=makeAvatarMaterial(0x52eaff,.18,.78);
 const emissive=makeAvatarMaterial(0x4d6cff,.25,.72);
 const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.72,.98,12,24),dark);
 torso.scale.set(1.08,1.08,.64);torso.position.y=-1.05;root.add(torso);root.userData.torso=torso;
 const neck=new THREE.Mesh(new THREE.CylinderGeometry(.18,.23,.34,20),skin);neck.position.y=-.25;root.add(neck);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.78,36,28),skin);head.scale.set(.84,1.08,.78);head.position.y=.58;root.add(head);root.userData.head=head;
 const hairCap=new THREE.Mesh(new THREE.SphereGeometry(.82,36,24,0,Math.PI*2,0,Math.PI*.64),hair);hairCap.scale.set(.88,1.04,.84);hairCap.position.set(0,.78,-.03);root.add(hairCap);
 if(gender==="female"){
   for(const x of[-.65,.65]){const lock=new THREE.Mesh(new THREE.SphereGeometry(.34,24,18),hair);lock.scale.set(.72,1.65,.58);lock.position.set(x,.4,-.03);root.add(lock)}
   const back=new THREE.Mesh(new THREE.SphereGeometry(.7,28,18),hair);back.scale.set(1.05,1.45,.5);back.position.set(0,.25,-.42);root.add(back)
 }
 root.userData.eyes=[];
 for(const x of[-.29,.29]){
   const eye=new THREE.Mesh(new THREE.SphereGeometry(.115,24,16),white);eye.scale.z=.42;eye.position.set(x,.64,.68);root.add(eye);
   const pupil=new THREE.Mesh(new THREE.SphereGeometry(.058,18,14),iris);pupil.position.set(x,.64,.785);root.add(pupil);root.userData.eyes.push(pupil)
 }
 const nose=new THREE.Mesh(new THREE.CapsuleGeometry(.045,.18,8,12),skin);nose.position.set(0,.39,.72);nose.rotation.x=Math.PI/2;root.add(nose);
 const mouth=new THREE.Mesh(new THREE.TorusGeometry(.15,.029,10,28,Math.PI),lip);mouth.position.set(0,.20,.70);mouth.rotation.z=Math.PI;mouth.scale.set(1,.75,1);root.add(mouth);root.userData.mouth=mouth;
 for(const x of[-.46,.46]){
   const upper=capsule(.17,.74,dark);upper.position.set(x,-1.0,0);upper.rotation.z=x<0?-.16:.16;root.add(upper);
   const fore=capsule(.15,.65,dark);fore.position.set(x*1.04,-1.55,.08);fore.rotation.z=x<0?-.08:.08;root.add(fore);
   const hand=new THREE.Mesh(new THREE.SphereGeometry(.2,18,14),skin);hand.position.set(x*1.1,-1.98,.18);root.add(hand);
   root.userData.arms??=[];root.userData.arms.push({upper,fore,hand,side:x<0?-1:1})
 }
 const core=new THREE.Mesh(new THREE.SphereGeometry(.15,22,18),glow);core.position.set(0,-.98,.43);root.add(core);
 const coreRing=new THREE.Mesh(new THREE.TorusGeometry(.23,.018,8,32),emissive);coreRing.position.set(0,-.98,.44);root.add(coreRing);
 root.userData.blink=0;root.userData.gender=gender;root.userData.talkPhase=0;
 return root
}
async function initAvatar3D(){
 const canvas=$("avatarCanvas");if(!canvas)return;
 try{
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(30,1,.1,100);camera.position.set(0,.02,6.1);
  scene.add(new THREE.AmbientLight(0x9ccfff,1.45));
  const key=new THREE.DirectionalLight(0xffffff,2.8);key.position.set(-2,4,5);scene.add(key);
  const rim=new THREE.PointLight(0x735cff,18,9);rim.position.set(2,1,-1);scene.add(rim);
  const cyan=new THREE.PointLight(0x5feeff,14,8);cyan.position.set(-2,.2,2);scene.add(cyan);
  const particleCount=1450,positions=new Float32Array(particleCount*3),sizes=new Float32Array(particleCount);
  for(let i=0;i<particleCount;i++){const r=2.2+Math.random()*2.9,theta=Math.random()*Math.PI*2,phi=Math.acos(2*Math.random()-1);positions[i*3]=Math.sin(phi)*Math.cos(theta)*r;positions[i*3+1]=Math.cos(phi)*r*.72;positions[i*3+2]=Math.sin(phi)*Math.sin(theta)*r;sizes[i]=.018+Math.random()*.045}
  const pg=new THREE.BufferGeometry();pg.setAttribute("position",new THREE.BufferAttribute(positions,3));pg.setAttribute("size",new THREE.BufferAttribute(sizes,1));
  const pm=new THREE.PointsMaterial({color:0x45dfff,size:.035,transparent:true,opacity:.62,blending:THREE.AdditiveBlending,depthWrite:false});
  const particles=new THREE.Points(pg,pm);scene.add(particles);
  const group=new THREE.Group();scene.add(group);
  const loadUrl=window.AGENTICUANTICO_AVATAR_GLB||localStorage.getItem("aq_avatar_glb")||"";
  const build=gender=>{group.clear();avatar3d.model=createHumanoid3D(gender);group.add(avatar3d.model)};
  avatar3d={renderer,scene,camera,group,model:null,speaking:false,gender:"female",mouthLevel:0,mouseX:0,mouseY:0,
   setSpeaking(v){this.speaking=!!v},setMouth(v){this.mouthLevel=Math.max(0,Math.min(1,v))},
   setGender(g){this.gender=g;build(g)},
   setGlb(url){new GLTFLoader().load(url,g=>{group.clear();avatar3d.model=g.scene;group.add(g.scene);$("avatarRigStatus").textContent="GLB · cargado";},undefined,()=>{$("avatarRigStatus").textContent="3D · fallback WebGL"})}};
  build("female");if(loadUrl)avatar3d.setGlb(loadUrl);else $("avatarRigStatus").textContent="WEBGL · humanoide";
  canvas.addEventListener("pointermove",e=>{const r=canvas.getBoundingClientRect();avatar3d.mouseX=((e.clientX-r.left)/r.width-.5)*2;avatar3d.mouseY=((e.clientY-r.top)/r.height-.5)*2});
  const resize=()=>{const w=canvas.clientWidth||500,h=canvas.clientHeight||420;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()};new ResizeObserver(resize).observe(canvas);resize();
  const clock=new THREE.Clock(),animate=()=>{
   const t=clock.getElapsedTime(),m=avatar3d.model;
   particles.rotation.y=t*.035;particles.rotation.x=Math.sin(t*.17)*.05;
   if(m){
    m.rotation.y+=((avatar3d.mouseX*.11+Math.sin(t*.42)*.035)-m.rotation.y)*.035;
    m.rotation.x+=((avatar3d.mouseY*.035)-m.rotation.x)*.035;
    m.position.y=Math.sin(t*1.15)*.025;
    const talk=avatar3d.speaking?.35+.65*(.5+.5*Math.sin(t*20)):0;
    avatar3d.mouthLevel=avatar3d.speaking?talk:Math.max(0,avatar3d.mouthLevel-.06);
    const mouth=m.userData.mouth;if(mouth)mouth.scale.y=.72+avatar3d.mouthLevel*2.1;
    if(m.userData.eyes)for(const eye of m.userData.eyes){eye.position.x+=(Math.max(-.04,Math.min(.04,avatar3d.mouseX*.035))-(eye.position.x-(eye===m.userData.eyes[0]?-0.29:0.29)))*.08}
    if(m.userData.arms)for(const a of m.userData.arms){const wave=avatar3d.speaking?Math.sin(t*2.1+a.side)*.07:Math.sin(t*.8+a.side)*.025;a.upper.rotation.z=a.side*(.13+wave);a.fore.rotation.z=a.side*(.08-wave*.7);a.hand.position.y=-1.98+Math.sin(t*1.6+a.side)*.018}
    const blink=Math.sin(t*.43)*.5+.5;if(blink>.985){m.userData.blink=Math.min(1,m.userData.blink+.18)}else m.userData.blink=Math.max(0,m.userData.blink-.25);
    m.traverse(o=>{if(o.isMesh&&o.morphTargetDictionary&&o.morphTargetInfluences){for(const [name,idx] of Object.entries(o.morphTargetDictionary)){if(/mouth|jaw|viseme|phoneme|open/i.test(name))o.morphTargetInfluences[idx]=avatar3d.mouthLevel*.78;if(/blink|eye.?close/i.test(name))o.morphTargetInfluences[idx]=m.userData.blink}}})
   }
   renderer.render(scene,camera);requestAnimationFrame(animate)

import "./avatar-webgpu.js";



/* Cinematic hero interactions */
(()=>{
  const hero=document.getElementById("cinematicHero");
  if(!hero) return;
  const video=document.getElementById("heroScrubVideo");
  const pinBg=document.getElementById("pinBackgroundImage");
  const typeEl=document.getElementById("heroTypewriter");
  const actions=document.getElementById("heroActions");
  const mobileMenu=document.getElementById("heroMobileMenu");
  const menuButton=hero.querySelector(".hero-menu");
  let prevX=null,targetTime=0,seeking=false;

  if(pinBg){
    pinBg.addEventListener("error",()=>{pinBg.src="./assets/background/quantum-world.svg";},{once:false});
  }

  const intro="Estoy lista para conversar, crear, programar y transformar ideas en resultados.";
  let i=0;
  window.setTimeout(()=>{
    const timer=window.setInterval(()=>{
      if(!typeEl){clearInterval(timer);return}
      typeEl.textContent=intro.slice(0,++i);
      if(i>=intro.length){clearInterval(timer);typeEl.classList.add("done")}
    },38);
  },600);
  window.setTimeout(()=>actions?.classList.add("is-visible"),400);

  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const requestSeek=()=>{
    if(!video||!Number.isFinite(video.duration)||video.duration<=0||seeking)return;
    seeking=true;
    video.currentTime=clamp(targetTime,0,video.duration);
  };
  video?.addEventListener("loadedmetadata",()=>{targetTime=video.currentTime||0});
  video?.addEventListener("seeked",()=>{
    seeking=false;
    if(Math.abs(video.currentTime-targetTime)>.015) requestSeek();
  });
  window.addEventListener("mousemove",(e)=>{
    if(hero.classList.contains("is-hidden"))return;
    if(prevX===null){prevX=e.clientX;return}
    const delta=e.clientX-prevX;prevX=e.clientX;
    if(video&&Number.isFinite(video.duration)&&video.duration>0){
      targetTime=clamp(targetTime+(delta/window.innerWidth)*.8*video.duration,0,video.duration);
      requestSeek();
    }
  },{passive:true});
  window.addEventListener("mouseleave",()=>{prevX=null},{passive:true});

  const closeMenu=()=>{
    mobileMenu?.classList.remove("is-open");
    mobileMenu?.setAttribute("aria-hidden","true");
    menuButton?.classList.remove("is-open");
    menuButton?.setAttribute("aria-expanded","false");
  };
  menuButton?.addEventListener("click",()=>{
    const open=!mobileMenu.classList.contains("is-open");
    mobileMenu.classList.toggle("is-open",open);
    mobileMenu.setAttribute("aria-hidden",String(!open));
    menuButton.classList.toggle("is-open",open);
    menuButton.setAttribute("aria-expanded",String(open));
  });

  const enter=()=>{
    closeMenu();
    hero.classList.add("is-hidden");
    document.body.classList.remove("hero-active");
    window.setTimeout(()=>hero.remove(),600);
  };
  hero.querySelectorAll("[data-enter-app]").forEach(b=>b.addEventListener("click",enter));

  hero.querySelectorAll("[data-copy-email]").forEach(b=>b.addEventListener("click",async()=>{
    try{
      await navigator.clipboard.writeText("agenticuantico@gmail.com");
      const old=b.innerHTML;b.innerHTML="Copiado ✓";
      window.setTimeout(()=>b.innerHTML=old,1200);
    }catch{
      b.setAttribute("aria-label","No se pudo copiar el correo");
    }
  }));

  hero.querySelectorAll("[data-hero-action]").forEach(b=>b.addEventListener("click",()=>{
    const view=b.dataset.heroAction;
    closeMenu();enter();
    const nav=document.querySelector(`.nav-item[data-view="${view}"]`);
    if(nav)window.setTimeout(()=>nav.click(),100);
  }));
})();
