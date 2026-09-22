const DEFAULT_NATIVE_API='https://agenticuantico.dev.ar';
const isNative=window.location.protocol==='capacitor:';
const API_BASE=(window.AGENTICUANTICO_API||(isNative?DEFAULT_NATIVE_API:window.location.origin)).replace(/\/$/,'');
const form=document.querySelector('#chat-form'),prompt=document.querySelector('#prompt'),messages=document.querySelector('#messages'),status=document.querySelector('#chat-status'),brainState=document.querySelector('#brain-state');
const history=[];
let lastMessageId=null;

function addMessage(role,text,meta=''){
  const item=document.createElement('div');
  item.className='message '+role;
  item.innerHTML='<div class="avatar">'+(role==='user'?'TÚ':'AQ')+'</div><div><b>'+(role==='user'?'Tú':'AgentiCuantico')+'</b><p></p>'+(meta?'<small class="message-meta"></small>':'')+'</div>';
  item.querySelector('p').textContent=text;
  if(meta)item.querySelector('.message-meta').textContent=meta;
  messages.appendChild(item);
  messages.scrollTop=messages.scrollHeight;
  return item;
}
function setBusy(b){
  prompt.disabled=b;
  form.querySelector('button').disabled=b;
  status.textContent=b?'AgentiCuantico está pensando…':'Listo para conversar';
  if(brainState)brainState.textContent=b?'PROCESANDO · MEMORIA + CEREBRO':'CEREBRO LISTO · MEMORIA ACTIVA';
}
function addTyping(){
  const item=document.createElement('div');
  item.className='message assistant typing';
  item.innerHTML='<div class="avatar">AQ</div><div><b>AgentiCuantico</b><p>Estoy pensando<span>.</span><span>.</span><span>.</span></p></div>';
  messages.appendChild(item);
  messages.scrollTop=messages.scrollHeight;
  return item;
}
async function sendFeedback(feedback,messageId){
  try{
    await fetch(API_BASE+'/v1/conversations/feedback',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({feedback,message_id:messageId})});
  }catch(_){}
}
form?.addEventListener('submit',async e=>{
  e.preventDefault();
  const text=prompt.value.trim();
  if(!text||prompt.disabled)return;
  addMessage('user',text);
  prompt.value='';
  setBusy(true);
  const typing=addTyping();
  try{
    const r=await fetch(API_BASE+'/v1/conversations/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      credentials:'include',
      body:JSON.stringify({message:text,history:history.slice(-12)})
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.detail||d.error||('HTTP '+r.status));
    typing.remove();
    const answer=d.message||'No recibí contenido del cerebro.';
    const item=addMessage('assistant',answer,d.model?('Modelo: '+d.model):'');
    lastMessageId=d.conversation_id||null;
    const feedback=document.createElement('div');
    feedback.className='message-feedback';
    feedback.innerHTML='<button type="button">✓ Útil</button><button type="button">✕ No me sirve</button>';
    feedback.children[0].onclick=()=>{sendFeedback('positive',lastMessageId);feedback.remove()};
    feedback.children[1].onclick=()=>{sendFeedback('negative',lastMessageId);feedback.remove()};
    item.appendChild(feedback);
    history.push({role:'user',content:text},{role:'assistant',content:answer});
    while(history.length>12)history.shift();
    status.textContent=d.guest_memory?'Memoria de esta conversación activa':'Conversación y memoria activas';
  }catch(err){
    typing.remove();
    const detail=String(err.message||'error');
    addMessage('assistant','No pude llegar al cerebro ahora mismo. '+detail+'. No voy a fingir que recibí tu mensaje. Cuando la API vuelva a estar disponible, podemos continuar.');
    status.textContent='Conexión con el cerebro no disponible';
    console.error(err);
  }finally{setBusy(false)}
});
document.querySelectorAll('[data-plan]').forEach(btn=>btn.addEventListener('click',async()=>{const plan=btn.dataset.plan;if(plan==='explorer'){location.hash='chat';return}const email=prompt('Ingresá el email que usarás para la suscripción:');if(!email)return;const choice=prompt('Elegí la pasarela: 1 = Mercado Pago, 2 = PayPal','1');const provider=choice==='2'?'paypal':'mercadopago';btn.disabled=true;btn.textContent='Preparando checkout…';try{const r=await fetch(API_BASE+'/v1/billing/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan,provider,email})});const d=await r.json().catch(()=>({}));if(!r.ok||!d.checkout_url)throw new Error(d.detail||d.error||'checkout_unavailable');window.location.href=d.checkout_url}catch(e){btn.disabled=false;btn.textContent='Elegir '+plan.charAt(0).toUpperCase()+plan.slice(1);alert('El checkout no está disponible todavía. Configurá las credenciales y los IDs de planes en el backend.')}}));
const canvas=document.querySelector('#brain-canvas');
const ctx=canvas?.getContext('2d');
let nodes=[];
let rotation={x:-0.08,y:0.25};
let drag={active:false,x:0,y:0};
let pulse=0;
function resize3D(){
  if(!canvas)return;
  const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.max(1,Math.floor(r.width*d));
  canvas.height=Math.max(1,Math.floor(r.height*d));
  ctx.setTransform(d,0,0,d,0,0);
  nodes=Array.from({length:150},()=> {
    const z=Math.random()*2-1, a=Math.random()*Math.PI*2, s=Math.sqrt(1-z*z);
    return {x:Math.cos(a)*s,y:z,z:Math.sin(a)*s,phase:Math.random()*Math.PI*2,energy:.35+Math.random()*.65};
  });
}
function project3D(p,w,h,t){
  const cy=Math.cos(rotation.y),sy=Math.sin(rotation.y),cx=Math.cos(rotation.x),sx=Math.sin(rotation.x);
  let x=p.x*cy-p.z*sy, z=p.x*sy+p.z*cy;
  let y=p.y*cx-z*sx; z=p.y*sx+z*cx;
  const scale=Math.min(w,h)*.34;
  const perspective=1/(1.65-z*.62);
  return {x:w/2+x*scale*perspective,y:h/2+y*scale*perspective,z,scale:perspective};
}
function draw3D(t=0){
  if(!canvas)return;
  const w=canvas.clientWidth,h=canvas.clientHeight;
  ctx.clearRect(0,0,w,h);
  const cx=w/2,cy=h/2,R=Math.min(w,h)*.36;
  const glow=ctx.createRadialGradient(cx,cy,10,cx,cy,R);
  glow.addColorStop(0,'rgba(101,231,255,.12)');
  glow.addColorStop(.55,'rgba(155,124,255,.06)');
  glow.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=glow;ctx.beginPath();ctx.arc(cx,cy,R*1.25,0,Math.PI*2);ctx.fill();
  const points=nodes.map((p,i)=>{
    const wobble=.025*Math.sin(t*.001+p.phase);
    const q={x:p.x*(1+wobble),y:p.y*(1+wobble),z:p.z*(1+wobble)};
    return {...project3D(q,w,h,t),p,i};
  }).sort((a,b)=>a.z-b.z);
  ctx.lineWidth=1;
  for(let i=0;i<points.length;i+=3){
    const a=points[i],b=points[(i+7)%points.length];
    const dx=a.x-b.x,dy=a.y-b.y;
    if(dx*dx+dy*dy<5200){
      ctx.strokeStyle='rgba(101,231,255,.12)';
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    }
  }
  for(const q of points){
    const active=.5+.5*Math.sin(t*.002+q.p.phase);
    const size=(1.2+2.6*active)*q.scale;
    ctx.globalAlpha=Math.max(.18,Math.min(.95,.3+q.p.energy*.7))*q.scale;
    ctx.fillStyle=q.p.z>.1?'#65e7ff':'#9b7cff';
    ctx.beginPath();ctx.arc(q.x,q.y,size,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=.7;
  ctx.strokeStyle='rgba(101,231,255,.18)';
  ctx.lineWidth=1;
  for(let i=0;i<3;i++){
    ctx.beginPath();
    ctx.ellipse(cx,cy,R*(.72+i*.12),R*(.32+i*.07),rotation.y+i*.65,0,Math.PI*2);
    ctx.stroke();
  }
  if(pulse>0){
    ctx.globalAlpha=pulse;
    ctx.strokeStyle='#65e7ff';
    ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(cx,cy,R*(1.02+(1-pulse)*.32),0,Math.PI*2);ctx.stroke();
    pulse=Math.max(0,pulse-.018);
  }
  ctx.globalAlpha=1;
  requestAnimationFrame(draw3D);
}
canvas?.addEventListener('pointerdown',e=>{drag.active=true;drag.x=e.clientX;drag.y=e.clientY;canvas.setPointerCapture?.(e.pointerId)});
canvas?.addEventListener('pointermove',e=>{if(!drag.active)return;rotation.y+=(e.clientX-drag.x)*.006;rotation.x=Math.max(-.8,Math.min(.8,rotation.x+(e.clientY-drag.y)*.006));drag.x=e.clientX;drag.y=e.clientY});
canvas?.addEventListener('pointerup',()=>{drag.active=false;pulse=1});
canvas?.addEventListener('pointercancel',()=>{drag.active=false});
canvas?.addEventListener('wheel',e=>{e.preventDefault();pulse=1},{passive:false});
addEventListener('resize',resize3D);
resize3D();
draw3D();
let authMode='login';
document.querySelectorAll('.auth-tab').forEach(tab=>tab.addEventListener('click',()=>{authMode=tab.dataset.auth;document.querySelectorAll('.auth-tab').forEach(x=>x.classList.toggle('active',x===tab));document.querySelector('#auth-submit').textContent=authMode==='login'?'Ingresar':'Crear cuenta';document.querySelector('#password-wrap input').autocomplete=authMode==='login'?'current-password':'new-password'}));
document.querySelector('#auth-form')?.addEventListener('submit',async e=>{e.preventDefault();const email=document.querySelector('#auth-email').value.trim(),phone=document.querySelector('#auth-phone').value.trim(),password=document.querySelector('#auth-password').value;try{const r=await fetch(API_BASE+(authMode==='login'?'/v1/auth/login':'/v1/auth/register'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,phone,password})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.detail||'auth_error');if(d.requires_otp){const code=prompt('Te enviamos un código de seguridad. Ingresalo para continuar:');if(!code)return;const v=await fetch(API_BASE+'/v1/auth/verify-phone',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({challenge_id:d.challenge_id,code})});const vd=await v.json();if(!v.ok)throw new Error(vd.detail||'otp_error')}if(d.session)sessionStorage.setItem('aq_session',d.session);alert(authMode==='login'?'Bienvenido a AgentiCuantico.':'Cuenta creada. Bienvenido.');location.hash='account'}catch(err){alert('No se pudo completar el acceso. Revisá los datos e intentá nuevamente.');console.error(err)}});
window.handleGoogleCredential=async response=>{try{const r=await fetch(API_BASE+'/v1/auth/google',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential:response.credential})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.detail||'google_auth_error');if(d.session)sessionStorage.setItem('aq_session',d.session);location.hash='account'}catch(err){alert('No se pudo iniciar sesión con Google.');console.error(err)}};
document.querySelector('#passkey-button')?.addEventListener('click',()=>alert('Passkey preparada para integrarse con WebAuthn en el backend. En Android se recomienda abrir el flujo mediante el navegador del sistema.'));

const toolCatalog=["repository.read","repository.write_branch","repository.write_file","repository.create_pr","tests.run","git.diff","preview.capture","asset.create","asset.optimize"];
const builderForm=document.querySelector('#agent-builder-form');
function renderTools(){const box=document.querySelector('#agent-tools');if(!box)return;box.innerHTML=toolCatalog.map(t=>'<label class="tool-check"><input type="checkbox" value="'+t+'"> '+t+'</label>').join('')}
function fillTemplate(t){if(!t)return;document.querySelector('#agent-name').value=t.name||'';document.querySelector('#agent-role').value=t.role||'';document.querySelector('#agent-description').value=t.description||'';document.querySelector('#agent-skills').value=(t.skills||[]).join(', ');document.querySelector('#agent-autonomy').value=t.autonomy_level||'supervised';(t.tools||[]).forEach(v=>{const el=document.querySelector('#agent-tools input[value="'+v+'"]');if(el)el.checked=true});previewBuilder()}
async function loadTemplates(){try{const r=await fetch(API_BASE+'/v1/account/agents/templates',{credentials:'include'});if(!r.ok)return;const d=await r.json();const box=document.querySelector('#agent-templates');box.innerHTML=(d.templates||[]).map(t=>'<button type="button" class="template-chip" data-template="'+t.id+'">'+t.name+'</button>').join('');box.querySelectorAll('[data-template]').forEach(b=>b.addEventListener('click',()=>fillTemplate(d.templates.find(t=>t.id===b.dataset.template))))}catch(e){}}
function previewBuilder(){const name=document.querySelector('#agent-name')?.value||'Tu nuevo agente',role=document.querySelector('#agent-role')?.value||'rol personalizado',mission=document.querySelector('#agent-mission')?.value||'Definí una misión y el agente aparecerá aquí.';document.querySelector('#preview-name').textContent=name;document.querySelector('#preview-role').textContent=role;document.querySelector('#preview-mission').textContent=mission;document.querySelector('#preview-meta').textContent=document.querySelector('#agent-autonomy')?.selectedOptions[0]?.text+' · '+document.querySelector('#agent-memory')?.selectedOptions[0]?.text}
['#agent-name','#agent-role','#agent-mission','#agent-autonomy','#agent-memory'].forEach(s=>document.querySelector(s)?.addEventListener('input',previewBuilder));
async function loadMyAgents(){const box=document.querySelector('#my-agents');if(!box)return;try{const r=await fetch(API_BASE+'/v1/account/agents',{credentials:'include'});if(!r.ok){box.innerHTML='<span class="muted">Iniciá sesión para cargar tus agentes.</span>';return}const d=await r.json();box.innerHTML=(d.agents||[]).map(a=>'<div class="agent-item"><b>'+escapeHtml(a.avatar||'◈')+' '+escapeHtml(a.name)+'</b><small>'+escapeHtml(a.role)+' · '+escapeHtml(a.autonomy_level)+'</small><button data-delete-agent="'+a.id+'">Desactivar</button></div>').join('')||'<span class="muted">Todavía no tenés agentes.</span>';box.querySelectorAll('[data-delete-agent]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('¿Desactivar este agente?'))return;await fetch(API_BASE+'/v1/account/agents/'+b.dataset.deleteAgent,{method:'DELETE',credentials:'include'});loadMyAgents()}))}catch(e){}}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
builderForm?.addEventListener('submit',async e=>{e.preventDefault();const status=document.querySelector('#builder-status');status.textContent='Creando…';const body={name:document.querySelector('#agent-name').value.trim(),role:document.querySelector('#agent-role').value.trim(),description:document.querySelector('#agent-description').value.trim(),mission:document.querySelector('#agent-mission').value.trim(),skills:document.querySelector('#agent-skills').value.split(',').map(x=>x.trim()).filter(Boolean),tools:[...document.querySelectorAll('#agent-tools input:checked')].map(x=>x.value),autonomy_level:document.querySelector('#agent-autonomy').value,memory_policy:document.querySelector('#agent-memory').value,credit_limit:Number(document.querySelector('#agent-credit').value||0),success_criteria:document.querySelector('#agent-success').value.trim(),instructions:document.querySelector('#agent-instructions').value.trim(),workspace:document.querySelector('#agent-workspace').value.trim()};try{const r=await fetch(API_BASE+'/v1/account/agents',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.detail||'No se pudo crear');status.textContent='Agente creado correctamente.';loadMyAgents()}catch(err){status.textContent=err.message||'Error al crear el agente.'}});
renderTools();loadTemplates();loadMyAgents();previewBuilder();

async function loadAdminPanel(){const section=document.querySelector('#admin');if(!section)return;try{const me=await fetch(API_BASE+'/v1/auth/me',{credentials:'include'});const md=await me.json();if(md.user?.role!=='admin')return;section.classList.add('visible');const [ur,ar]=await Promise.all([fetch(API_BASE+'/v1/admin/users',{credentials:'include'}),fetch(API_BASE+'/v1/admin/agents',{credentials:'include'})]);const users=(await ur.json()).users||[],agents=(await ar.json()).agents||[];section.querySelector('.admin-grid').innerHTML='<span>👥 <b>'+users.length+'</b> usuarios</span><span>🤖 <b>'+agents.length+'</b> agentes</span><span>◈ Suscripciones y créditos</span><span>🛡 Seguridad y sesiones</span><span>⌁ Auditoría y operaciones</span><span>▦ Métricas y estado del cerebro</span>'}catch(e){console.debug('admin panel unavailable',e)}}
loadAdminPanel();

function addAdminMessage(role,text){const box=document.querySelector('#admin-messages');if(!box)return;const item=document.createElement('div');item.className='message '+role;item.innerHTML='<div class="avatar">'+(role==='user'?'ADM':'AQ')+'</div><div><b>'+(role==='user'?'Admin':'AgentiCuantico')+'</b><p></p></div>';item.querySelector('p').textContent=text;box.appendChild(item);box.scrollTop=box.scrollHeight}
const adminHistory=[];
document.querySelector('#admin-chat-form')?.addEventListener('submit',async e=>{e.preventDefault();const input=document.querySelector('#admin-prompt'),st=document.querySelector('#admin-chat-status'),text=input.value.trim();if(!text)return;addAdminMessage('user',text);input.value='';st.textContent='Procesando orden…';try{const r=await fetch(API_BASE+'/v1/admin/chat',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({message:text,history:adminHistory.slice(-12)})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.detail||'HTTP '+r.status);const answer=d.message||'Orden recibida.';addAdminMessage('assistant',answer);adminHistory.push({role:'user',content:text},{role:'assistant',content:answer});while(adminHistory.length>12)adminHistory.shift();if(d.requires_confirmation)st.textContent='Acción sensible detectada: requiere confirmación antes de ejecutar.';else st.textContent='Control administrativo listo'}catch(err){addAdminMessage('assistant','No pude procesar la orden administrativa. Verificá que tu sesión tenga rol administrador.');st.textContent='Acceso administrativo no disponible';console.error(err)}});
