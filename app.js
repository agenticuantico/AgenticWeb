const API = window.AGENTICUANTICO_API || "https://brain-api.agenticuantico.dev.ar";
let token = localStorage.getItem("aq_session"); let conversationId = crypto.randomUUID();

const $=id=>document.getElementById(id);
function setState(s){$("status").textContent=s}
function add(role,text){const d=document.createElement("div");d.className="msg "+role;d.textContent=text;$("messages").appendChild(d);$("messages").scrollTop=$("messages").scrollHeight}
async function login(response){
  try{
    const r=await fetch(API+"/v1/auth/google",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential:response.credential})});
    if(!r.ok) throw new Error("login");
    const data=await r.json(); token=data.token; localStorage.setItem("aq_session",token); await boot();
  }catch(e){setState("No se pudo iniciar sesión");}
}
async function boot(){
  if(!token)return;
  const r=await fetch(API+"/v1/me",{headers:{Authorization:"Bearer "+token}});
  if(!r.ok){localStorage.removeItem("aq_session");token=null;return}
  const u=await r.json(); $("login").classList.add("hidden"); $("chat").classList.remove("hidden"); $("user").textContent=u.name||u.email; setState("En línea");
  add("assistant","Hola. Soy AgentiCuantico. ¿En qué trabajamos?");
}
window.addEventListener("load",()=>{
  if(window.google){google.accounts.id.initialize({client_id:window.GOOGLE_CLIENT_ID||"__GOOGLE_CLIENT_ID__",callback:login});google.accounts.id.renderButton($("googleBtn"),{theme:"filled_black",size:"large",shape:"pill",text:"continue_with"});}
  boot();
});
$("composer").addEventListener("submit",async e=>{
  e.preventDefault(); const input=$("input"), msg=input.value.trim(); if(!msg||!token)return; input.value=""; add("user",msg);
  const pending=document.createElement("div");pending.className="msg assistant";pending.textContent="Pensando…";$("messages").appendChild(pending);
  try{
    const r=await fetch(API+"/v1/chat",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({conversation_id:conversationId,message:msg,consent_to_memory:$("memoryConsent").checked})});
    const data=await r.json(); if(!r.ok) throw new Error(data.detail||"error"); pending.textContent=data.answer;
  }catch(e){pending.textContent=e.message==="daily_limit_reached"?"Llegaste al límite diario del plan gratuito.": "No pude responder ahora. Intentá nuevamente en unos segundos."}
});
$("newChat").addEventListener("click",()=>{conversationId=crypto.randomUUID();$("messages").innerHTML="";add("assistant","Nueva conversación iniciada.");});
