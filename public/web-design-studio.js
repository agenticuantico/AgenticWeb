(() => {
const api=window.AGENTICUANTICO_API_URL||"";
const prompt=document.getElementById("webDesignPrompt"), run=document.getElementById("webDesignRun"), publish=document.getElementById("webDesignPublish"), key=document.getElementById("webBuildKey"), frame=document.getElementById("webDesignPreview"), code=document.getElementById("webDesignCode"), status=document.getElementById("webDesignStatus");
if(!run)return;
async function generate(){
 const p=prompt.value.trim(); if(!p)return null;
 run.disabled=true; if(publish)publish.disabled=true; status.textContent="BUILD · diseñando con Qwen Coder…";
 try{
  const r=await fetch(api+"/v1/public/web-design",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({prompt:p})});
  const d=await r.json(); if(!r.ok||!d.html)throw new Error(d.message||"No se pudo generar el diseño");
  frame.srcdoc=d.html; code.value=d.html; status.textContent="BUILD · preview generado · "+(d.model||"provider");
  return d.html;
 }catch(e){status.textContent="Diseñador no disponible · "+e.message;return null}
 finally{run.disabled=false;if(publish)publish.disabled=false}
}
run.addEventListener("click",generate);
publish?.addEventListener("click",async()=>{
 const p=prompt.value.trim(); if(!p)return;
 const admin=key?.value.trim(); if(!admin){status.textContent="Falta la clave de publicación del administrador.";key?.focus();return}
 publish.disabled=true; run.disabled=true; status.textContent="BUILD · generando y publicando en GitHub…";
 try{
  const r=await fetch(api+"/v1/public/web-design/build",{method:"POST",headers:{"content-type":"application/json","X-Admin-Key":admin},body:JSON.stringify({prompt:p})});
  const d=await r.json(); if(!r.ok||!d.ok)throw new Error(d.message||"No se pudo publicar");
  if(d.html){frame.srcdoc=d.html;code.value=d.html}
  status.textContent="BUILD · GitHub actualizado · deploy en curso";
 }catch(e){status.textContent="Publicación detenida · "+e.message}
 finally{publish.disabled=false;run.disabled=false}
});
document.querySelectorAll("[data-design-prompt],[data-build-prompt]").forEach(b=>b.addEventListener("click",()=>{prompt.value=b.dataset.designPrompt||b.dataset.buildPrompt||"";generate()}));
})();