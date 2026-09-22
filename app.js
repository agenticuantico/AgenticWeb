const DEFAULT_NATIVE_API='https://agenticuantico.dev.ar';
const PUBLIC_API='https://agenticweb.agenticuantico.workers.dev';
const API_BASE=(window.AGENTICUANTICO_API||(window.location.protocol==='capacitor:'?DEFAULT_NATIVE_API:PUBLIC_API)).replace(/\/$/,'');
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const state={plan:'explorer',agent:'planner',history:[],chats:[],busy:false};

const AGENTS=[
 {id:'planner',name:'AgentiCuantico Core',short:'Agente base',icon:'AQ',desc:'Conversación, planificación y coordinación segura.',plans:['explorer','creator','pro','studio'],skills:['Planificación','Memoria','Verificación']},
 {id:'fullstack-junior',name:'Full Stack',short:'Programación',icon:'</>',desc:'Construcción y mantenimiento de interfaces y funciones web.',plans:['creator','pro','studio'],skills:['HTML','CSS','JavaScript','Git']},
 {id:'web-designer',name:'Web Designer',short:'UI / UX',icon:'✦',desc:'Interfaces responsive, accesibles y sistemas visuales.',plans:['creator','pro','studio'],skills:['UX','UI','Motion','Responsive']},
 {id:'backend',name:'Backend',short:'APIs y servicios',icon:'API',desc:'APIs, persistencia, autenticación y servicios.',plans:['pro','studio'],skills:['Python','FastAPI','REST','Testing']},
 {id:'cybersecurity',name:'Security',short:'AppSec',icon:'◇',desc:'Revisión defensiva de seguridad y cadena de suministro.',plans:['pro','studio'],skills:['OWASP','Auth','Headers','Audit']},
 {id:'3d-branding-prototyping',name:'3D Studio',short:'3D / Branding',icon:'3D',desc:'Conceptos 3D, branding, prototipos y experiencias.',plans:['studio'],skills:['3D','Branding','Motion','Prototype']},
 {id:'illustrator',name:'Creative',short:'Ilustración',icon:'✧',desc:'Recursos visuales e identidad original del producto.',plans:['studio'],skills:['Iconos','Branding','Composición']}
];

function publicText(value){
  let text=String(value??'').trim();
  text=text.replace(/\bRun\s*:\s*[0-9a-f]{8}-[0-9a-f-]{27,}\.?/gi,'');
  text=text.replace(/\b(run[_ -]?id|trace[_ -]?id|correlation[_ -]?id)\s*[:=]\s*[0-9a-f-]{8,}/gi,'');
  text=text.replace(/\b(?:stack trace|internal error|provider temporarily unavailable)\b[^\n]*/gi,'');
  text=text.replace(/\n{3,}/g,'\n\n').trim();
  return text||'No recibí una respuesta utilizable. Intentá nuevamente.';
}

function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function currentAgent(){return AGENTS.find(a=>a.id===state.agent)||AGENTS[0]}
function canUse(a){return a.plans.includes(state.plan)}
function renderAgentCard(a,compact=false){
  const locked=!canUse(a);
  return '<article class="agent-card '+(a.id===state.agent?'active ':'')+(locked?'locked':'')+'">'+
    '<div class="agent-icon">'+escapeHtml(a.icon)+'</div><h3>'+escapeHtml(a.name)+'</h3><p>'+escapeHtml(a.desc)+'</p>'+
    '<footer><span>'+escapeHtml(a.skills.slice(0,2).join(' · '))+'</span><span>'+escapeHtml(a.short)+'</span></footer>'+
    '<button type="button" data-agent="'+a.id+'" '+(locked?'disabled':'')+'>'+ (locked?'Bloqueado':'Usar') +'</button></article>';
}
function renderAgents(){
  const grid=$('#agent-grid'),picker=$('#picker-grid');
  if(grid)grid.innerHTML=AGENTS.map(a=>renderAgentCard(a)).join('');
  if(picker)picker.innerHTML=AGENTS.map(a=>renderAgentCard(a,true)).join('');
  $$('.agent-card [data-agent]').forEach(b=>b.addEventListener('click',()=>selectAgent(b.dataset.agent)));
}
function selectAgent(id){
  const a=AGENTS.find(x=>x.id===id);
  if(!a)return;
  if(!canUse(a)){location.hash='plans';return}
  state.agent=id;
  $('#selected-agent-name').textContent=a.name;
  $('#selected-agent-meta').textContent=a.short+' · '+state.plan.charAt(0).toUpperCase()+state.plan.slice(1);
  const current=$('#agent-current');
  if(current)current.innerHTML='<span class="agent-orb">'+escapeHtml(a.icon)+'</span><span><b>'+escapeHtml(a.name)+'</b><small>'+escapeHtml(a.short)+' · '+escapeHtml(state.plan)+'</small></span><span>⌄</span>';
  $('#agent-picker')?.classList.remove('open');
  $('#agent-picker')?.setAttribute('aria-hidden','true');
  renderAgents();
}
function openPicker(){const m=$('#agent-picker');m?.classList.add('open');m?.setAttribute('aria-hidden','false');renderAgents()}
$$('[data-close-picker]').forEach(x=>x.addEventListener('click',()=>{$('#agent-picker')?.classList.remove('open');$('#agent-picker')?.setAttribute('aria-hidden','true')}))
$('#model-button')?.addEventListener('click',openPicker);
$('#agent-current')?.addEventListener('click',openPicker);

function saveChats(){
  try{localStorage.setItem('aq_public_chats',JSON.stringify(state.chats.slice(-20)))}catch(_){}
}
function loadChats(){
  try{state.chats=JSON.parse(localStorage.getItem('aq_public_chats')||'[]')}catch(_){state.chats=[]}
  renderChatHistory();
}
function renderChatHistory(){
  const box=$('#chat-history');if(!box)return;
  box.innerHTML=state.chats.slice().reverse().map((c,i)=>'<button class="history-item '+(i===0?'active':'')+'" data-chat="'+escapeHtml(c.id)+'">'+escapeHtml(c.title)+'</button>').join('')||'<span class="history-item">Todavía no hay chats</span>';
}
function newChat(){
  state.history=[];state.busy=false;
  const box=$('#messages');
  if(box)box.innerHTML='<div class="welcome"><div class="welcome-orb">AQ</div><h2>Nuevo chat.</h2><p>Contame qué querés construir, resolver o mejorar.</p><div class="suggestions"><button data-suggestion="Analizá mi proyecto y proponé mejoras concretas.">Analizar mi proyecto</button><button data-suggestion="Quiero crear una web moderna y premium.">Crear una web</button><button data-suggestion="Quiero que un agente revise mi código.">Revisar código</button></div></div>';
  bindSuggestions();
  $('#prompt')?.focus();
}
$('#new-chat')?.addEventListener('click',newChat);

function addMessage(role,text,options={}){
  const box=$('#messages');if(!box)return;
  box.querySelector('.welcome')?.remove();
  const item=document.createElement('div');item.className='message '+role;
  const safe=publicText(text);
  const avatar=role==='user'?'TÚ':'AQ';
  item.innerHTML='<div class="avatar">'+avatar+'</div><div class="message-body"><div class="message-author">'+(role==='user'?'Vos':'AgentiCuantico')+'</div><div class="message-text"></div>'+(role==='assistant'?'<div class="message-actions"><button data-copy>Copiar</button><button data-feedback="positive">Útil</button><button data-feedback="negative">No me sirve</button></div>':'')+'</div>';
  item.querySelector('.message-text').textContent=safe;
  box.appendChild(item);
  box.scrollTop=box.scrollHeight;
  if(role==='assistant'){
    item.querySelector('[data-copy]')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(safe)}catch(_){}});
    item.querySelector('[data-feedback="positive"]')?.addEventListener('click',()=>sendFeedback('positive',state.lastMessageId));
    item.querySelector('[data-feedback="negative"]')?.addEventListener('click',()=>sendFeedback('negative',state.lastMessageId));
  }
  return item;
}
function addTyping(){
  const box=$('#messages'),item=document.createElement('div');item.className='message assistant';
  item.innerHTML='<div class="avatar">AQ</div><div class="message-body"><div class="message-author">AgentiCuantico</div><div class="message-text typing-dots">Procesando <span>.</span><span>.</span><span>.</span></div></div>';
  box.appendChild(item);box.scrollTop=box.scrollHeight;return item;
}
function setBusy(v){
  state.busy=v;$('#prompt').disabled=v;$('#send').disabled=v;
  $('#task-indicator').textContent=v?'Trabajando…':'Listo';
  $('#brain-state').textContent=v?'Procesando objetivo':'Online · listo';
}
async function checkHealth(){
  try{
    const r=await fetch(API_BASE+'/health',{credentials:'include',cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    if(r.ok&&d.status==='ok'){
      $('#connection-pill').innerHTML='<i></i> Online';
      $('#brain-state').textContent='Online · listo';
    }else throw new Error();
  }catch(_){
    $('#connection-pill').innerHTML='<i class="degraded-dot"></i> Degradado';
    $('#brain-state').textContent='Conexión limitada';
  }
}
async function sendFeedback(feedback,messageId){
  try{await fetch(API_BASE+'/v1/conversations/feedback',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({feedback,message_id:messageId})})}catch(_){}
}

async function sendMessage(text){
  if(!text||state.busy)return;
  addMessage('user',text);$('#prompt').value='';autoGrow();
  setBusy(true);const typing=addTyping();
  try{
    const r=await fetch(API_BASE+'/v1/conversations/messages',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({message:text,history:state.history.slice(-12),agent_id:state.agent})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error('request_failed');
    typing.remove();
    const answer=publicText(d.message);
    state.lastMessageId=d.conversation_id||null;
    addMessage('assistant',answer);
    state.history.push({role:'user',content:text},{role:'assistant',content:answer});
    while(state.history.length>12)state.history.shift();
    if(d.task_status)$('#task-indicator').textContent='Trabajo iniciado';
    const title=text.length>42?text.slice(0,42)+'…':text;
    if(!state.chats.some(c=>c.title===title))state.chats.push({id:crypto.randomUUID?.()||String(Date.now()),title,agent:state.agent});
    saveChats();renderChatHistory();
  }catch(_){
    typing.remove();addMessage('assistant','No pude conectar con el cerebro en este momento. La interfaz sigue disponible; probá nuevamente en unos instantes.');
  }finally{setBusy(false)}
}
$('#chat-form')?.addEventListener('submit',e=>{e.preventDefault();sendMessage($('#prompt').value.trim())});
function autoGrow(){const el=$('#prompt');if(!el)return;el.style.height='auto';el.style.height=Math.min(el.scrollHeight,160)+'px'}
$('#prompt')?.addEventListener('input',autoGrow);
$('#prompt')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage(e.currentTarget.value.trim())}});
function bindSuggestions(){$$('[data-suggestion]').forEach(b=>b.onclick=()=>{const v=b.dataset.suggestion;$('#prompt').value=v;autoGrow();sendMessage(v)})}
bindSuggestions();

async function loadAccount(){
  try{
    const r=await fetch(API_BASE+'/v1/auth/me',{credentials:'include'});
    const d=await r.json();
    state.plan=d.user?.plan||'explorer';
  }catch(_){state.plan='explorer'}
  const allowed=AGENTS.find(a=>a.id===state.agent&&canUse(a))?state.agent:'planner';
  state.agent=allowed;
  selectAgent(allowed);renderAgents();
}
$$('[data-plan]').forEach(btn=>btn.addEventListener('click',async()=>{
  const plan=btn.dataset.plan;
  if(plan==='explorer'){location.hash='chat';return}
  const email=window.prompt('Correo para la suscripción:');if(!email)return;
  const provider=window.prompt('Pasarela: 1 = Mercado Pago, 2 = PayPal','1')==='2'?'paypal':'mercadopago';
  const old=btn.textContent;btn.disabled=true;btn.textContent='Preparando…';
  try{
    const r=await fetch(API_BASE+'/v1/billing/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan,provider,email})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.checkout_url)throw new Error('checkout');
    location.href=d.checkout_url;
  }catch(_){btn.disabled=false;btn.textContent=old;alert('El checkout todavía no está disponible para este plan.')}
}));

let authMode='login';
$$('.auth-tab').forEach(tab=>tab.addEventListener('click',()=>{authMode=tab.dataset.auth;$$('.auth-tab').forEach(x=>x.classList.toggle('active',x===tab));$('#auth-submit').textContent=authMode==='login'?'Ingresar':'Crear cuenta'}));
$('#auth-form')?.addEventListener('submit',async e=>{
  e.preventDefault();const email=$('#auth-email').value.trim(),password=$('#auth-password').value;
  try{
    const r=await fetch(API_BASE+(authMode==='login'?'/v1/auth/login':'/v1/auth/register'),{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({email,password})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error('auth');
    if(d.requires_otp){alert('La cuenta requiere una verificación adicional. Completala desde el flujo de acceso.')}
    else if(authMode==='login'){await loadAccount();alert('Sesión iniciada.')}
    else alert('Cuenta creada. Ahora podés ingresar.');
  }catch(_){alert('No se pudo completar el acceso. Revisá los datos e intentá nuevamente.')}
});

function initBrain(){
  const canvas=$('#brain-canvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');let nodes=[],rx=-.1,ry=.3,drag=null,pulse=0;
  function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,r.width*d);canvas.height=Math.max(1,r.height*d);ctx.setTransform(d,0,0,d,0,0);nodes=Array.from({length:190},(_,i)=>{const z=Math.random()*2-1,a=Math.random()*Math.PI*2,s=Math.sqrt(1-z*z);return{x:Math.cos(a)*s*(.88+Math.random()*.12),y:z*(.9+Math.random()*.1),z:Math.sin(a)*s,phase:Math.random()*6.28,e:.3+Math.random()*.7}})}
  function project(p,w,h){const cy=Math.cos(ry),sy=Math.sin(ry),cx=Math.cos(rx),sx=Math.sin(rx);let x=p.x*cy-p.z*sy,z=p.x*sy+p.z*cy;let y=p.y*cx-z*sx;z=p.y*sx+z*cx;const scale=Math.min(w,h)*.34,per=1/(1.7-z*.62);return{x:w/2+x*scale*per,y:h/2+y*scale*per,z,per}}
  function draw(t=0){const w=canvas.clientWidth,h=canvas.clientHeight;ctx.clearRect(0,0,w,h);const cx=w/2,cy=h/2,R=Math.min(w,h)*.35;const g=ctx.createRadialGradient(cx,cy,5,cx,cy,R*1.3);g.addColorStop(0,'rgba(105,231,255,.15)');g.addColorStop(.5,'rgba(157,131,255,.06)');g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,R*1.4,0,Math.PI*2);ctx.fill();
    const pts=nodes.map(p=>{const wv=.025*Math.sin(t*.001+p.phase);return{...project({x:p.x*(1+wv),y:p.y*(1+wv),z:p.z*(1+wv)},w,h),p}}).sort((a,b)=>a.z-b.z);
    for(let i=0;i<pts.length;i+=2){const a=pts[i],b=pts[(i+11)%pts.length],dx=a.x-b.x,dy=a.y-b.y;if(dx*dx+dy*dy<4200){ctx.strokeStyle='rgba(105,231,255,.09)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}}
    for(const q of pts){const a=.5+.5*Math.sin(t*.002+q.p.phase),s=(1+2.8*a)*q.per;ctx.globalAlpha=Math.max(.16,Math.min(.9,(.25+q.p.e*.65)*q.per));ctx.fillStyle=q.z>.05?'#69e7ff':'#9d83ff';ctx.beginPath();ctx.arc(q.x,q.y,s,0,Math.PI*2);ctx.fill()}
    if(pulse){ctx.globalAlpha=pulse;ctx.strokeStyle='#69e7ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,R*(1.02+(1-pulse)*.28),0,Math.PI*2);ctx.stroke();pulse=Math.max(0,pulse-.02)}
    ctx.globalAlpha=1;requestAnimationFrame(draw)}
  canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture?.(e.pointerId)});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;ry+=(e.clientX-drag.x)*.006;rx=Math.max(-.75,Math.min(.75,rx+(e.clientY-drag.y)*.006));drag={x:e.clientX,y:e.clientY}});
  canvas.addEventListener('pointerup',()=>{drag=null;pulse=1});canvas.addEventListener('pointercancel',()=>drag=null);canvas.addEventListener('wheel',e=>{e.preventDefault();pulse=1},{passive:false});
  addEventListener('resize',resize);resize();draw();
}
initBrain();loadChats();checkHealth();loadAccount();renderAgents();
