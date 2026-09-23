(() => {
  const mount=document.getElementById("aiDesignMount");
  if(!mount)return;
  fetch("./generated-design.html?v=20260923-01",{cache:"no-store"}).then(r=>r.ok?r.text():"").then(html=>{
    if(html.trim()) mount.innerHTML=html;
  }).catch(()=>{});
  document.getElementById("aiDesignChat")?.addEventListener("click",()=>document.getElementById("input")?.focus());
  document.getElementById("aiDesignStudio")?.addEventListener("click",()=>document.getElementById("openWebStudio")?.click());
})();