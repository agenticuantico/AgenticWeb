/* AgentiCuantico Immersive Neural Core v4 */
(()=>{"use strict";
const THREE_URL="https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
let renderer,scene,camera,group,raf=0,coreState="IDLE",destroyed=false;
const $=s=>document.querySelector(s);
function ui(){
 if($("#aqImmersive")) return;
 document.body.classList.add("aq-immersive-active");
 const root=document.createElement("div");root.id="aqImmersive";
 root.innerHTML=`
 <div class="aq-ambient"></div><div class="aq-noise"></div>
 <nav class="aq-nav"><div class="aq-brand"><span class="aq-mark"></span><span>AGENTICUANTICO</span></div>
 <div class="aq-navlinks"><button data-aq-nav="core">Core</button><button data-aq-nav="intelligence">Intelligence</button><button data-aq-nav="agents">Agents</button><button data-aq-nav="technology">Technology</button></div>
 <button class="aq-enter" data-aq-enter>Entrar al cerebro</button><button class="aq-menu" aria-label="Menú">☰</button></nav>
 <main>
 <section class="aq-hero" id="aq-core"><div class="aq-copy"><div class="aq-kicker">NEURAL INTELLIGENCE / 01</div><h1 class="aq-title"><span>INTELLIGENCE</span><span>THAT EVOLVES.</span></h1><p class="aq-lead">Un espacio inteligente para conversar, crear, programar y coordinar agentes. Explora el núcleo neuronal y entra en la conversación real cuando estés listo.</p><div class="aq-actions"><button class="aq-primary" data-aq-enter>INICIAR CONVERSACIÓN</button><button class="aq-secondary" data-aq-scroll="aq-intelligence">EXPLORAR SISTEMA</button></div><div class="aq-status"><i></i>SYSTEM ONLINE · NEURAL CORE READY</div></div>
 <div class="aq-core-wrap"><canvas id="aqCoreCanvas" class="aq-canvas"></canvas><div class="aq-hud"><div>STATE <strong id="aqState">IDLE</strong></div><div>NODES <strong id="aqNodes">0</strong></div><div>INTERACTION <strong>ACTIVE</strong></div></div></div><div class="aq-scrollcue">SCROLL TO ENTER THE SYSTEM</div></section>
 <section class="aq-section" id="aq-intelligence"><div class="aq-section-grid"><div><div class="aq-eyebrow">02 / INTELLIGENCE LAYER</div><h2>Un sistema que conecta contexto, herramientas y agentes.</h2><p>La interfaz separa la experiencia visual del motor de IA para que el producto pueda evolucionar sin reconstruir toda la aplicación.</p></div><div class="aq-stack"><div class="aq-card"><b>REASONING</b><span>Procesamiento y coordinación de tareas cuando el backend lo soporta.</span></div><div class="aq-card"><b>MEMORY</b><span>Contexto y conversaciones gestionadas por las capacidades existentes.</span></div><div class="aq-card"><b>VERIFICATION</b><span>Estados de ejecución y resultados diferenciados de simples animaciones.</span></div></div></div></section>
 <section class="aq-section" id="aq-agents"><div class="aq-section-grid"><div class="aq-stack"><div class="aq-card"><b>CODE AGENT</b><span>Programación y análisis de código.</span></div><div class="aq-card"><b>WEB AGENT</b><span>Diseño y desarrollo web.</span></div><div class="aq-card"><b>RESEARCH AGENT</b><span>Investigación y análisis.</span></div><div class="aq-card"><b>AUTOMATION AGENT</b><span>Automatización de tareas.</span></div></div><div><div class="aq-eyebrow">03 / AUTONOMOUS AGENTS</div><h2>Agentes como extensiones del núcleo.</h2><p>La interfaz prepara el espacio para agentes especializados sin presentar como disponibles capacidades que todavía no estén conectadas al backend.</p></div></div></section>
 <section class="aq-section" id="aq-technology"><div class="aq-section-grid"><div><div class="aq-eyebrow">04 / TECHNOLOGY</div><h2>Quantum-inspired. Real-world focused.</h2><p>El lenguaje visual está inspirado en sistemas neuronales y computación avanzada. No se presenta como computación cuántica real mientras esa capacidad no exista en el backend.</p></div><div class="aq-card"><b>FRONTEND → WORKER → AI → TOOLS → AGENTS</b><span>La experiencia conserva la arquitectura real de AgenticWeb y la prepara para futuras capas del motor AgentiCuantico.</span></div></div></section>
 </main><footer class="aq-footer"><span>AGENTICUANTICO</span><span>AI · AGENTS · NEURAL INTERFACE</span></footer></div>`;
 document.body.appendChild(root);
 bindUI();init3D().catch(()=>fallback());
}
function bindUI(){
 document.querySelectorAll("[data-aq-enter]").forEach(b=>b.addEventListener("click",enterApp));
 document.querySelectorAll("[data-aq-scroll]").forEach(b=>b.addEventListener("click",()=>document.getElementById(b.dataset.aqScroll)?.scrollIntoView({behavior:"smooth"})));
 document.querySelectorAll("[data-aq-nav]").forEach(b=>b.addEventListener("click",()=>document.getElementById("aq-"+b.dataset.aqNav)?.scrollIntoView({behavior:"smooth"})));
}
function enterApp(){
 document.body.classList.remove("aq-immersive-active");document.body.classList.add("aq-app-open");
 const r=$("#aqImmersive");if(r){r.classList.add("aq-hidden");setTimeout(()=>r.remove(),650)}
 window.scrollTo(0,0);
 const chat=document.querySelector('[data-view="chat"]');if(chat)chat.click();
}
async function init3D(){
 const THREE=await import(THREE_URL);if(destroyed)return;
 const canvas=$("#aqCoreCanvas"),wrap=canvas.parentElement;
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(42,wrap.clientWidth/wrap.clientHeight,.1,100);camera.position.set(0,0,7.8);
 renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:innerWidth>700});
 renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.25:1.7));renderer.setSize(wrap.clientWidth,wrap.clientHeight,false);
 group=new THREE.Group();scene.add(group);
 const count=innerWidth<600?650:1100;$("#aqNodes").textContent=count;
 const pos=new Float32Array(count*3),cols=new Float32Array(count*3);
 for(let i=0;i<count;i++){const t=Math.random()*Math.PI*2, u=Math.random()*2-1, r=Math.sqrt(1-u*u),x=r*Math.cos(t),y=u,z=r*Math.sin(t);const bulge=1.0+0.28*Math.cos(t*2);pos[i*3]=x*2.0*bulge;pos[i*3+1]=y*2.45;pos[i*3+2]=z*1.35;cols[i*3]=.25+.3*Math.random();cols[i*3+1]=.65+.3*Math.random();cols[i*3+2]=1;}
 const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.BufferAttribute(pos,3));geo.setAttribute("color",new THREE.BufferAttribute(cols,3));
 const mat=new THREE.PointsMaterial({size:innerWidth<600?.035:.045,vertexColors:true,transparent:true,opacity:.82,blending:THREE.AdditiveBlending,depthWrite:false});group.add(new THREE.Points(geo,mat));
 const linePos=new Float32Array(320*6);for(let i=0;i<320;i++){const a=Math.floor(Math.random()*count),b=Math.floor(Math.random()*count);for(let k=0;k<3;k++){linePos[i*6+k]=pos[a*3+k];linePos[i*6+3+k]=pos[b*3+k]}}
 const lg=new THREE.BufferGeometry();lg.setAttribute("position",new THREE.BufferAttribute(linePos,3));const lm=new THREE.LineBasicMaterial({color:0x66eaff,transparent:true,opacity:.08,blending:THREE.AdditiveBlending});group.add(new THREE.LineSegments(lg,lm));
 const core=new THREE.Mesh(new THREE.IcosahedronGeometry(1.05,4),new THREE.MeshBasicMaterial({color:0x624fff,wireframe:true,transparent:true,opacity:.12}));group.add(core);
 const clock=new THREE.Clock();let targetX=0,targetY=0;
 addEventListener("pointermove",e=>{targetX=(e.clientX/innerWidth-.5)*.7;targetY=(e.clientY/innerHeight-.5)*.35},{passive:true});
 addEventListener("touchmove",e=>{if(e.touches[0]){targetX=(e.touches[0].clientX/innerWidth-.5)*.55;targetY=(e.touches[0].clientY/innerHeight-.5)*.3}},{passive:true});
 function loop(){if(destroyed)return;raf=requestAnimationFrame(loop);const t=clock.getElapsedTime();group.rotation.y+=(targetX-group.rotation.y)*.025;group.rotation.x+=(targetY-group.rotation.x)*.025;group.rotation.y+=.0012;core.rotation.z=t*.08;const s=coreState==="THINKING"?1.18:coreState==="RESPONDING"?1.08:1;core.scale.setScalar(s+.04*Math.sin(t*2));renderer.render(scene,camera)}
 loop();new ResizeObserver(()=>{if(!renderer)return;const w=wrap.clientWidth,h=wrap.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)}).observe(wrap);
}
function fallback(){const c=$("#aqCoreCanvas");if(c)c.style.background="radial-gradient(circle at 50% 50%,rgba(114,239,255,.16),transparent 45%)"}
window.addEventListener("visibilitychange",()=>{if(document.hidden&&raf){cancelAnimationFrame(raf);raf=0}});
window.AQNeuralState=(state)=>{coreState=String(state||"IDLE").toUpperCase();const el=$("#aqState");if(el)el.textContent=coreState};
ui();
})();