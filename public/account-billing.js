(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const API=(window.AGENTICUANTUICO_API_URL||location.origin).replace(/\/$/,"");
  const FALLBACK="https://agenticweb.agenticuantico.workers.dev";
  const TOKEN_KEY="aq_auth_v2";
  let mode="login",plans=[],me=null;

  async function api(path,options={}){
    const headers=new Headers(options.headers||{});
    headers.set("accept","application/json");
    if(options.body&&!headers.has("content-type"))headers.set("content-type","application/json");
    const token=localStorage.getItem(TOKEN_KEY);if(token)headers.set("Authorization","Bearer "+token);
    let r=await fetch(API+path,{...options,headers});
    if([404,405,502].includes(r.status)&&API!==FALLBACK)r=await fetch(FALLBACK+path,{...options,headers});
    return r;
  }
  const notify=t=>{const x=$("toast");if(!x)return;x.textContent=t;x.classList.add("show");clearTimeout(window.__aqAccountToast);window.__aqAccountToast=setTimeout(()=>x.classList.remove("show"),2600)};
  const show=el=>el?.classList.remove("hidden"),hide=el=>el?.classList.add("hidden");
  function openAccount(){show($("accountOverlay"));$("accountOverlay")?.setAttribute("aria-hidden","false");document.body.classList.add("account-open");if(me)renderDashboard();else renderAuth();loadPlans();initGoogle();}
  function closeAccount(){$("accountOverlay")?.classList.add("hidden");$("accountOverlay")?.setAttribute("aria-hidden","true");document.body.classList.remove("account-open")}
  function renderAuth(){show($("authView"));hide($("accountDashboard"));$("authMessage").textContent="";$("authSubmit").textContent=mode==="login"?"Ingresar":"Crear cuenta";$("nameField").classList.toggle("hidden",mode==="login");$("authPassword").autocomplete=mode==="login"?"current-password":"new-password";initGoogle();}
  function renderDashboard(){
    hide($("authView"));show($("accountDashboard"));
    $("accountName").textContent=me?.name||"Usuario";$("accountEmail").textContent=me?.email||"";
    const img=$("accountAvatar");if(me?.picture){img.src=me.picture;show(img)}else{img.removeAttribute("src");hide(img)}
    const p=me?.plan||{};$("accountPlanName").textContent=p.name||"Sin plan";$("accountPlanModel").textContent=p.model||"AgentiQ Basic";
    $("accountPlanBadge").textContent=p.active?"ACTIVO":"FREE";
    const expiry=Number(p.expiresAt||0);$("accountPlanExpiry").textContent=p.active?"Vigente hasta "+new Date(expiry).toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"}):"Elegí un plan para activar el modelo avanzado durante 30 días.";
    const start=expiry>0?expiry-30*86400000:0;const pct=p.active?Math.max(0,Math.min(100,(Date.now()-start)/(expiry-start)*100)):0;$("planProgress").style.width=pct+"%";
    renderPlans();
    document.querySelector(".profile-chip b")?.replaceChildren(document.createTextNode(me?.name||"Usuario"));
    const sub=document.querySelector(".profile-chip small");if(sub)sub.textContent=p.active?p.name:"Sin plan";
  }
  async function loadMe(){
    const token=localStorage.getItem(TOKEN_KEY);if(!token)return;
    try{const r=await api("/v1/auth/me");if(!r.ok){localStorage.removeItem(TOKEN_KEY);return}const d=await r.json();me=d.user;me.plan=d.plan;renderDashboard()}catch{}
  }
  async function loadPlans(){
    try{const r=await api("/v1/billing/plans");const d=await r.json();if(r.ok)plans=d.plans||[];renderPlans()}catch{}
  }
  function renderPlans(){
    const grid=$("plansGrid");if(!grid)return;
    grid.innerHTML=plans.map((p,i)=>'<article class="plan-card '+(p.id==="pro"?"featured":"")+'"><span class="plan-index">0'+(i+1)+'</span><h4>'+esc(p.name)+'</h4><p>'+esc(p.description)+'</p><div class="plan-price"><b>$'+Number(p.priceARS||0).toLocaleString("es-AR")+'</b><small>ARS / 30 días</small></div><ul>'+p.features.map(f=>'<li>✓ '+esc(f)+'</li>').join("")+'</ul><div class="plan-buttons"><button type="button" data-buy="'+esc(p.id)+'" data-provider="mercadopago">Mercado Pago</button><button type="button" data-buy="'+esc(p.id)+'" data-provider="paypal" class="paypal">PayPal</button></div></article>').join("");
    grid.querySelectorAll("[data-buy]").forEach(b=>b.addEventListener("click",()=>buy(b.dataset.buy,b.dataset.provider)));
  }
  function esc(s){return String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
  async function buy(plan,provider){
    if(!me){notify("Primero iniciá sesión");return}
    notify("Preparando checkout…");
    try{
      const r=await api("/v1/billing/checkout",{method:"POST",body:JSON.stringify({plan,provider})});const d=await r.json();
      if(!r.ok||!d.checkout_url)throw new Error(d.message||"Pasarela no disponible");
      location.href=d.checkout_url;
    }catch(e){notify(String(e.message||e))}
  }
  function initGoogle(){
    const holder=$("googleButton");if(!holder||me||holder.dataset.ready)return;
    const start=()=>{if(!window.google?.accounts?.id){setTimeout(start,500);return}
      api("/v1/auth/config").then(r=>r.json()).then(d=>{
        if(!d.enabled||!d.client_id){holder.innerHTML='<div class="google-unavailable">Google login se habilitará al configurar el Client ID.</div>';return}
        window.google.accounts.id.initialize({client_id:d.client_id,callback:handleGoogle,context:"signin",ux_mode:"popup",auto_select:false});
        holder.innerHTML="";window.google.accounts.id.renderButton(holder,{theme:"filled_black",size:"large",shape:"pill",text:mode==="login"?"signin_with":"signup_with",width:360});holder.dataset.ready="1";
      }).catch(()=>{});
    };start();
  }
  async function handleGoogle(response){
    try{
      const r=await api("/v1/auth/google",{method:"POST",body:JSON.stringify({credential:response.credential})});const d=await r.json();
      if(!r.ok)throw new Error(d.message||"No se pudo ingresar con Google");
      localStorage.setItem(TOKEN_KEY,d.token);me=d.user;me.plan=d.plan;renderDashboard();notify("Bienvenido a AgentiCuantico");
    }catch(e){$("authMessage").textContent=String(e.message||e)}
  }
  $("authForm")?.addEventListener("submit",async e=>{
    e.preventDefault();const email=$("authEmail").value.trim().toLowerCase(),password=$("authPassword").value,name=$("authName").value.trim();
    $("authMessage").textContent="";$("authSubmit").disabled=true;
    try{
      const path=mode==="login"?"/v1/auth/login":"/v1/auth/register";const r=await api(path,{method:"POST",body:JSON.stringify({email,password,name})});const d=await r.json();
      if(!r.ok)throw new Error(d.message||"No se pudo completar el acceso");
      localStorage.setItem(TOKEN_KEY,d.token);me=d.user;me.plan=d.plan;renderDashboard();notify(mode==="login"?"Sesión iniciada":"Cuenta creada");
    }catch(err){$("authMessage").textContent=String(err.message||err)}finally{$("authSubmit").disabled=false}
  });
  $("authMode")?.addEventListener("click",()=>{mode=mode==="login"?"register":"login";$("authMode").textContent=mode==="login"?"¿No tenés cuenta? Registrate":"¿Ya tenés cuenta? Ingresá";renderAuth()});
  $("accountClose")?.addEventListener("click",closeAccount);
  $("accountOverlay")?.addEventListener("click",e=>{if(e.target.id==="accountOverlay")closeAccount()});
  $("accountLogout")?.addEventListener("click",()=>{localStorage.removeItem(TOKEN_KEY);me=null;window.google?.accounts?.id?.disableAutoSelect?.();renderAuth();notify("Sesión cerrada")});
  $("openPlans")?.addEventListener("click",()=>document.querySelector(".plans-section")?.scrollIntoView({behavior:"smooth"}));
  document.addEventListener("click",e=>{
    const el=e.target.closest('[data-view="account"],.profile-chip');if(el){e.preventDefault();openAccount()}
  });
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("accountOverlay")?.classList.contains("hidden"))closeAccount()});

  async function verifyReturn(){
    const q=new URLSearchParams(location.search),provider=q.get("provider")||q.get("payment");
    const id=q.get("subscription_id")||q.get("preapproval_id")||q.get("id");
    if(!provider||!id||!localStorage.getItem(TOKEN_KEY))return;
    try{
      const r=await api("/v1/billing/verify?provider="+encodeURIComponent(provider)+"&id="+encodeURIComponent(id));
      const d=await r.json();if(d.ok){me=me||{};me.plan=d.plan;notify(d.plan?.active?"Plan activado durante 30 días":"Pago recibido; esperando confirmación de la pasarela");openAccount()}
    }catch{}
    history.replaceState({},document.title,location.pathname+location.hash);
  }
  window.AgentiCuanticoAccount={open:openAccount,close:closeAccount,load:loadMe};
  loadMe();verifyReturn();
})();