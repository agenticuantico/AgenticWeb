(() => {
  const $=s=>document.querySelector(s);
  const api=String(window.AGENTICUANTICO_API_URL||"").replace(/\/$/,"");
  const toast=$("#toast");
  const notify=(msg)=>{if(!toast)return;toast.textContent=msg;toast.classList.add("show");clearTimeout(window.__aqToast);window.__aqToast=setTimeout(()=>toast.classList.remove("show"),2600)};
  document.documentElement.classList.add("aq-enhanced");

  // Remove accidental hash navigation and keep all UI controls in-page.
  document.addEventListener("click",e=>{const a=e.target.closest('a[href="#"]');if(a){e.preventDefault();}});
  // Mobile navigation: close after selecting a view.
  document.querySelectorAll(".nav-item,[data-view]").forEach(el=>el.addEventListener("click",()=>{
    document.body.classList.remove("nav-open");
    $("#sidebar")?.classList.remove("open");
  }));
  $("#mobileMenu")?.addEventListener("click",()=>{document.body.classList.toggle("nav-open");$("#sidebar")?.classList.toggle("open")});
  // Escape closes menus/panels.
  document.addEventListener("keydown",e=>{
    if(e.key==="Escape"){document.body.classList.remove("nav-open");$("#sidebar")?.classList.remove("open");$("#quickMenu")?.classList.add("hidden")}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();document.querySelector(".top-search input")?.focus()}
  });
  // Composer grows naturally without layout jumps.
  const input=$("#input");
  input?.addEventListener("input",()=>{input.style.height="auto";input.style.height=Math.min(input.scrollHeight,180)+"px"});
  // Keep avatar stage reactive to conversation activity.
  const messages=$("#messages");
  if(messages)new MutationObserver(()=>{messages.scrollTo({top:messages.scrollHeight,behavior:"smooth"})}).observe(messages,{childList:true,subtree:true});
  // Network status is visible but never exposes provider credentials/details.
  window.addEventListener("offline",()=>notify("Sin conexión. El chat volverá a intentar cuando regreses a internet."));
  window.addEventListener("online",()=>notify("Conexión restaurada."));
  // Lightweight health check only when the browser is online; public endpoint has no secrets.
  if(api){fetch(api+"/health",{headers:{Accept:"application/json"}}).then(r=>{if(!r.ok)throw 0}).catch(()=>{});}
  // Respect reduced motion for accessibility/performance.
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("reduced-motion");
})();
