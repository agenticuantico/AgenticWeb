import {initQuantumBrain3D} from "./brain-3d.js";

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

async function initAvatar3D(){
  const canvas=document.getElementById("avatarCanvas");
  if(!canvas)return;
  avatar3d=initQuantumBrain3D(canvas);
  window.__aqBrain=avatar3d;
}

/* Real-time voice + facial bridge. Uses ARKit/Oculus morph names when the GLB exposes them. */
window.AgentiCuanticoAvatar={
  speak(text,opts={}){
    const value=String(text||"").trim();
    if(!value||!window.speechSynthesis)return;
    window.speechSynthesis.cancel();
    const utter=new SpeechSynthesisUtterance(value);
    utter.lang=opts.lang||"es-AR";
    utter.rate=opts.rate||1;
    utter.pitch=opts.pitch||1.05;
    const start=performance.now();
    const duration=Math.max(650,(value.length/13)*1000);
    const visemes=[
      ["A",/a/i],["E",/e/i],["I",/i/i],["O",/o/i],["U",/u/i]
    ];
    let raf=0;
    const tick=()=>{
      if(!avatar3d)return;
      const elapsed=performance.now()-start;
      const progress=Math.min(1,elapsed/duration);
      const ch=value[Math.min(value.length-1,Math.floor(progress*value.length))]||"";
      let level=/[aeiouáéíóú]/i.test(ch)?0.82:/[bmpfv]/i.test(ch)?0.48:/[szcjx]/i.test(ch)?0.34:0.58;
      avatar3d.speaking=true;avatar3d.mouthLevel=level;
      avatar3d.morphText=ch;
      if(progress<1&& !utter.__ended){raf=requestAnimationFrame(tick)}
    };
    utter.onstart=()=>{if(avatar3d)avatar3d.speaking=true;tick()};
    utter.onend=()=>{utter.__ended=true;cancelAnimationFrame(raf);if(avatar3d){avatar3d.speaking=false;avatar3d.mouthLevel=0}};
    utter.onerror=utter.onend;
    window.speechSynthesis.speak(utter);
    return utter;
  },
  stop(){window.speechSynthesis?.cancel();if(avatar3d){avatar3d.speaking=false;avatar3d.mouthLevel=0}}
};

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


/* Single avatar bootstrap. */
window.addEventListener("load",()=>{try{initAvatar3D()}catch(e){console.error("[AgentiCuantico] bootstrap:",e)}},{once:true});
