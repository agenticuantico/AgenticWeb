/* AgentiCuantico Neural OS v3 runtime.
   No external library required. Enhances the existing app without replacing its IDs. */
(()=>{"use strict";
const boot=()=>{
 document.body.classList.add("aq-neural-os");
 document.documentElement.dataset.aqUi="neural-os-v3";
 const stage=document.querySelector(".brain-stage");
 if(stage){
   stage.setAttribute("data-ui-system","neural-os-v3");
   const top=stage.querySelector(".stage-top");
   if(top&&!top.querySelector(".aq-system-mark")){
     const mark=document.createElement("span");mark.className="aq-system-mark";mark.textContent="NEURAL OS / V3";mark.style.cssText="font:700 8px ui-monospace,monospace;letter-spacing:.16em;color:rgba(115,230,255,.72);";top.append(mark);
   }
 }
 // Keyboard-first command focus: keeps the existing search input but turns it into a command entry point.
 const search=document.querySelector(".top-search input");
 if(search){
   search.placeholder="Buscar o ejecutar una acción…";
   window.addEventListener("keydown",e=>{
     if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();search.focus()}
     if(e.key==="Escape"&&document.activeElement===search){search.blur()}
   });
 }
 // Ambient pointer depth, throttled to one animation frame.
 let raf=0,px=0,py=0;
 window.addEventListener("pointermove",e=>{
   px=(e.clientX/innerWidth-.5)*2;py=(e.clientY/innerHeight-.5)*2;
   if(raf)return;raf=requestAnimationFrame(()=>{
     document.documentElement.style.setProperty("--aq-px",(px*10).toFixed(2)+"px");
     document.documentElement.style.setProperty("--aq-py",(py*8).toFixed(2)+"px");
     const avatar=document.getElementById("robotAvatar");
     if(avatar&&!matchMedia("(prefers-reduced-motion: reduce)").matches)
       avatar.style.marginLeft=(px*5).toFixed(1)+"px";
     raf=0;
   });
 },{passive:true});
 // Add a tiny neural telemetry rail without touching the chat logic.
 const rail=document.createElement("div");rail.className="aq-telemetry";
 rail.innerHTML='<span>NEURAL LINK</span><i></i><b>ONLINE</b>';
 rail.style.cssText="position:fixed;left:clamp(14px,4vw,64px);top:18px;z-index:30;display:flex;align-items:center;gap:8px;padding:7px 9px;border:1px solid rgba(170,215,255,.12);border-radius:999px;background:rgba(4,8,16,.42);backdrop-filter:blur(16px);font:700 8px ui-monospace,monospace;letter-spacing:.14em;color:#8293a8;pointer-events:none;";
 const dot=document.createElement("i");dot.style.cssText="width:5px;height:5px;border-radius:50%;background:#a7ffe0;box-shadow:0 0 14px #a7ffe0;";rail.querySelector("i").replaceWith(dot);
 document.body.appendChild(rail);
 const messages=document.getElementById("messages");
 if(messages){
   new MutationObserver(()=>{
     const busy=[...messages.querySelectorAll(".msg")].some(x=>/Procesando|razonando/i.test(x.textContent||""));
     document.documentElement.dataset.aqState=busy?"thinking":"ready";
   }).observe(messages,{childList:true,subtree:true});
 }
};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();