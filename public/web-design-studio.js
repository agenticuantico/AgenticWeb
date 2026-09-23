(() => {
const api=window.AGENTICUANTICO_API_URL||"";
const prompt=document.getElementById("webDesignPrompt"), run=document.getElementById("webDesignRun"), frame=document.getElementById("webDesignPreview"), code=document.getElementById("webDesignCode"), status=document.getElementById("webDesignStatus");
if(!run)return;
run.addEventListener("click",async()=>{
 const p=prompt.value.trim(); if(!p)return;
 run.disabled=true; status.textContent="STARK-WEB · diseñando…";
 try{
  const r=await fetch(api+"/v1/public/web-design",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({prompt:p})});
  const d=await r.json(); if(!r.ok||!d.html)throw new Error(d.message||"No se pudo generar el diseño");
  frame.srcdoc=d.html; code.value=d.html; status.textContent="STARK-WEB · diseño generado";
 }catch(e){status.textContent="Diseñador no disponible · "+e.message}
 finally{run.disabled=false}
});
document.querySelectorAll("[data-design-prompt]").forEach(b=>b.addEventListener("click",()=>{prompt.value=b.dataset.designPrompt;run.click()}));
})();