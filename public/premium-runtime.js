/* AgentiCuantico premium runtime — chat-first UI, 3D neural brain, voice and attachments. */
(() => {
  "use strict";

  const productionOrigin=/^https?:$/i.test(location.protocol)?location.origin:"";
  const API=(productionOrigin&&productionOrigin!=="null"?productionOrigin:"https://agenticweb.agenticuantico.workers.dev").replace(/\/$/,"");
  const API_FALLBACK="https://agenticweb.agenticuantico.workers.dev";
  const $=id=>document.getElementById(id);
  const input=$("input"),send=$("send"),messages=$("messages"),attach=$("attachInput");
  const mic=$("voiceInput"),stop=$("stopVoice"),status=$("voiceStatus"),voiceName=$("voiceName"),tray=$("attachmentTray"),voiceToggle=$("voiceModeToggle"),voicePanelToggle=$("voiceModePanel"),previewVoice=$("previewVoice"),imageButton=$("imageGenerateButton");
  const brain=()=>window.__aqBrain;
  const HISTORY_KEY="aq_conversations_v2";
  const ACTIVE_KEY="aq_active_v2";
  const AUTH_KEY="aq_auth_v1";
  const SESSION_KEY="aq_guest_v6";
  let busy=false,listening=false,recognition=null,selectedVoice=null,browserVoices=[],voiceEnabled=localStorage.getItem("aq_voice_enabled")==="1",pendingUploads=[];
  let conversations=loadLocal();
  let activeId=localStorage.getItem(ACTIVE_KEY)||"";
  let current=null;

  const escapeHTML=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const notify=text=>{const t=$("toast");if(!t)return;t.textContent=text;t.classList.add("show");clearTimeout(t.__timer);t.__timer=setTimeout(()=>t.classList.remove("show"),2400)};
  const authToken=()=>String(localStorage.getItem(AUTH_KEY)||"").trim();
  const guestId=()=>{let v=localStorage.getItem(SESSION_KEY);if(!v){v=crypto.randomUUID?.()||String(Date.now());localStorage.setItem(SESSION_KEY,v)}return v};

  function loadLocal(){
    try{const v=JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]");return Array.isArray(v)?v.filter(x=>x&&x.id&&Array.isArray(x.messages)).slice(-50):[]}catch{return[]}
  }
  function persistLocal(){
    localStorage.setItem(HISTORY_KEY,JSON.stringify(conversations.slice(-50)));
    if(activeId)localStorage.setItem(ACTIVE_KEY,activeId);
    renderHistory();
  }
  function normalizeConversation(c){
    return {
      id:String(c.id),
      title:String(c.title||"Nueva conversación").slice(0,80),
      createdAt:Number(c.createdAt)||Date.now(),
      updatedAt:Number(c.updatedAt)||Date.now(),
      messages:Array.isArray(c.messages)?c.messages.filter(m=>m&&["user","assistant"].includes(m.role)&&typeof m.content==="string").slice(-80):[]
    };
  }
  function createConversation(){
    const now=Date.now();
    const c={id:crypto.randomUUID?.()||String(now)+"-"+Math.random().toString(36).slice(2),title:"Nueva conversación",createdAt:now,updatedAt:now,messages:[]};
    conversations.push(c);activeId=c.id;current=c;persistLocal();renderMessages();return c;
  }
  function getCurrent(){return conversations.find(c=>c.id===activeId)||null}
  function titleFrom(text){const t=String(text||"").replace(/\s+/g," ").trim();return (t.slice(0,58)+(t.length>58?"…":""))||"Nueva conversación"}
  function renderMessages(){
    if(!messages)return;
    messages.innerHTML="";
    const c=getCurrent();
    current=c;
    if(!c||!c.messages.length){
      const el=document.createElement("div");el.className="msg assistant reference-welcome";
      el.innerHTML="<b>¡Hola! 👋 Soy AgentiQ.</b><br>Estoy listo para conversar, crear, programar y ayudarte con tus proyectos.<br><small>Podés empezar una nueva conversación cuando quieras.</small>";
      messages.appendChild(el);
    }else{
      c.messages.forEach(m=>appendMessage(m.role,m.content));
    }
    messages.scrollTop=messages.scrollHeight;
  }
  function appendMessage(role,text,meta=""){
    if(!messages)return null;
    const el=document.createElement("div");el.className="msg "+(role==="user"?"user":"assistant");
    el.innerHTML=escapeHTML(text).replace(/\n/g,"<br>")+(meta?'<small class="msg-meta">'+escapeHTML(meta)+"</small>":"");
    messages.appendChild(el);messages.scrollTop=messages.scrollHeight;return el;
  }
  function renderHistory(){
    const list=$("conversationList");if(!list)return;
    list.innerHTML="";
    const sorted=[...conversations].sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
    if(!sorted.length){list.innerHTML='<div class="history-empty">Todavía no hay conversaciones.</div>';return}
    sorted.forEach(c=>{
      const row=document.createElement("div");row.className="history-row"+(c.id===activeId?" active":"");
      const btn=document.createElement("button");btn.type="button";btn.className="history-open";
      const count=c.messages.length;btn.innerHTML='<span class="history-dot"></span><span class="history-copy"><b>'+escapeHTML(c.title)+'</b><small>'+count+' mensaje'+(count===1?"":"s")+' · '+formatDate(c.updatedAt)+'</small></span>';
      btn.addEventListener("click",()=>openConversation(c.id));
      const del=document.createElement("button");del.type="button";del.className="history-delete";del.title="Borrar conversación";del.setAttribute("aria-label","Borrar "+c.title);del.textContent="×";
      del.addEventListener("click",e=>{e.stopPropagation();deleteConversation(c.id)});
      row.append(btn,del);list.appendChild(row);
    });
  }
  function formatDate(ts){
    const d=new Date(ts||Date.now()),today=new Date();
    if(d.toDateString()===today.toDateString())return d.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
    return d.toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit"});
  }
  async function api(path,options={}){
    const headers=new Headers(options.headers||{});
    headers.set("accept","application/json");
    if(options.body&&!headers.has("content-type"))headers.set("content-type","application/json");
    const token=authToken();if(token)headers.set("Authorization","Bearer "+token);
    let res=await fetch(API+path,{...options,headers});
    if((res.status===404||res.status===405||res.status===502)&&API!==API_FALLBACK)res=await fetch(API_FALLBACK+path,{...options,headers});
    return res;
  }
  async function syncServer(){
    const token=authToken();if(!token)return;
    try{
      const r=await api("/v1/user/conversations",{method:"GET"});
      if(!r.ok)return;
      const d=await r.json();
      if(Array.isArray(d.conversations)){
        const remote=d.conversations.map(normalizeConversation);
        const map=new Map(conversations.map(c=>[c.id,c]));
        remote.forEach(c=>{const local=map.get(c.id);if(!local||c.updatedAt>=local.updatedAt)map.set(c.id,c)});
        conversations=[...map.values()].sort((a,b)=>a.updatedAt-b.updatedAt).slice(-50);
        if(!activeId&&conversations.length)activeId=conversations.at(-1).id;
        persistLocal();
        if(getCurrent())renderMessages();
      }
    }catch{}
  }
  let syncTimer=0;
  async function syncToServer(){
    if(!authToken())return;
    clearTimeout(syncTimer);
    syncTimer=setTimeout(async()=>{
      try{await api("/v1/user/conversations",{method:"POST",body:JSON.stringify({conversations:conversations.slice(-50)})})}catch{}
    },350);
  }
  async function openConversation(id){
    if(!conversations.some(c=>c.id===id))return;
    activeId=id;localStorage.setItem(ACTIVE_KEY,id);renderHistory();renderMessages();input?.focus();
  }
  async function deleteConversation(id){
    const c=conversations.find(x=>x.id===id);if(!c)return;
    if(!confirm('¿Borrar la conversación "'+c.title.replace(/"/g,"")+'"? Esta acción no se puede deshacer.'))return;
    conversations=conversations.filter(x=>x.id!==id);
    if(authToken()){try{await api("/v1/user/conversations?id="+encodeURIComponent(id),{method:"DELETE"})}catch{}}
    if(activeId===id){activeId="";localStorage.removeItem(ACTIVE_KEY);createConversation()}
    persistLocal();notify("Conversación eliminada");
  }
  async function clearAll(){
    if(!conversations.length){notify("No hay conversaciones para borrar");return}
    if(!confirm("¿Borrar todo el historial de conversaciones? Esta acción no se puede deshacer."))return;
    conversations=[];activeId="";localStorage.removeItem(ACTIVE_KEY);
    if(authToken()){try{await api("/v1/user/conversations",{method:"DELETE"})}catch{}}
    createConversation();persistLocal();notify("Historial eliminado");
  }

  const ensureCurrent=()=>getCurrent()||createConversation();
  function saveTurn(role,content){
    const c=ensureCurrent();
    c.messages.push({role,content:String(content||"").slice(0,20000),ts:Date.now()});
    c.updatedAt=Date.now();
    if(role==="user"&&(!c.title||c.title==="Nueva conversación"))c.title=titleFrom(content);
    current=c;persistLocal();syncToServer();
  }

  if(!conversations.length)createConversation();else if(!getCurrent())activeId=conversations.at(-1).id;
  renderHistory();renderMessages();
  $("newChat")?.addEventListener("click",e=>{e.preventDefault();if(busy){notify("Esperá a que termine la respuesta");return}createConversation();notify("Nueva conversación")});
  $("clearHistory")?.addEventListener("click",clearAll);
  syncServer();

  const setThinking=v=>{brain()?.setThinking?.(v);brain()?.setThinkingState?.();if(status)status.textContent=v?"AgentiQ está razonando…":"Voz lista"};
  const setDisabled=v=>{if(send)send.disabled=v;if(input)input.disabled=v};

  function renderAttachments(files){
    if(!tray)return;tray.classList.toggle("hidden",!files.length);
    tray.innerHTML=files.map(f=>'<span class="attachment-chip">↑ '+escapeHTML(f.name)+' <small>'+formatSize(f.size)+'</small></span>').join("");
  }
  function formatSize(bytes){
    const n=Number(bytes||0); if(n<1024)return n+" B"; if(n<1048576)return (n/1024).toFixed(1)+" KB"; if(n<1073741824)return (n/1048576).toFixed(1)+" MB"; return (n/1073741824).toFixed(2)+" GB";
  }
  function fileKind(file){
    const t=String(file.type||"").toLowerCase();
    if(t.startsWith("image/"))return "image"; if(t.startsWith("video/"))return "video"; if(t.startsWith("audio/"))return "audio"; if(t==="application/pdf")return "pdf"; return "file";
  }
  async function uploadFile(file){
    if(file.size>100*1024*1024)throw new Error(file.name+" supera el límite de 100 MB.");
    const headers={"X-File-Name":file.name,"X-File-Type":file.type||"application/octet-stream","X-Guest-Session":guestId(),"Content-Type":file.type||"application/octet-stream"};
    const r=await api("/v1/uploads",{method:"POST",headers,body:file});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.ok)throw new Error(d.message||"No se pudo subir "+file.name);
    return {...d,kind:fileKind(file),size:file.size};
  }
  async function fileToText(file){
    const type=file.type||"";
    if(type.startsWith("text/")||/\.(txt|md|json|js|ts|css|html|py|csv|xml|yaml|yml)$/i.test(file.name))return (await file.text()).slice(0,120000);
    if(type.startsWith("image/"))return "[Imagen adjunta: "+file.name+", "+file.type+", "+file.size+" bytes].";
    return "[Archivo adjunto: "+file.name+", tipo "+(file.type||"desconocido")+", "+file.size+" bytes].";
  }
  async function filePayload(file,uploaded){
    if((file.type||"").startsWith("image/") && file.size<=6*1024*1024){
      const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});
      return {name:file.name,kind:"image",data:String(data),storage_key:uploaded?.key||"",url:uploaded?.url||""};
    }
    return {name:file.name,kind:fileKind(file),data:await fileToText(file),storage_key:uploaded?.key||"",url:uploaded?.url||""};
  }

  async function ask(text,files=[],uploads=[]){
    text=String(text||"").trim();
    if((!text&&!files.length)||busy)return;
    const c=ensureCurrent();
    const filePayloads=[];
    for(const f of files){try{filePayloads.push(await filePayload(f))}catch{filePayloads.push({name:f.name,kind:"file",data:"No se pudo leer el archivo en el navegador."})}}
    const fileContext=filePayloads.filter(f=>f.kind!=="image").map(f=>"### "+f.name+"\n"+String(f.data).slice(0,30000));
    const prompt=[text,...fileContext].filter(Boolean).join("\n\n");
    const visibleUser=text||("Analizá "+files.map(f=>f.name).join(", "));
    appendMessage("user",visibleUser);saveTurn("user",visibleUser);
    busy=true;setDisabled(true);setThinking(true);
    const thinking=appendMessage("assistant","Procesando…");
    try{
      const history=c.messages.slice(-14).filter(m=>m.role==="user"||m.role==="assistant").map(m=>({role:m.role,content:m.content}));
      const payload={message:prompt,history,attachments:filePayloads,conversation_id:c.id,model:"AgentiQ",guest_session:guestId()};
      const requestOptions={method:"POST",headers:{"content-type":"application/json","accept":"application/json"},body:JSON.stringify(payload)};
      let res=await fetch(API+"/v1/public/chat",requestOptions);
      if((res.status===405||res.status===404||res.status===502)&&API!==API_FALLBACK)res=await fetch(API_FALLBACK+"/v1/public/chat",requestOptions);
      let data={};try{data=await res.json()}catch{}
      if(!res.ok||!data.answer)throw new Error(data.error||data.message||("HTTP "+res.status));
      thinking.remove();
      appendMessage("assistant",data.answer,data.model?String(data.model):"AgentiQ");
      saveTurn("assistant",data.answer);
      if(voiceEnabled)speak(data.answer);
    }catch(err){
      thinking.remove();
      const detail=String(err?.message||err||"error de conexión");
      const fallback="No pude completar la respuesta. Verificá la conexión del motor e intentá nuevamente.";
      appendMessage("assistant",fallback);
      saveTurn("assistant",fallback);
      notify("AgentiQ no respondió: "+detail);
    }finally{busy=false;setDisabled(false);setThinking(false);input?.focus()}
  }

  function syncVoiceToggle(){
    const label=voiceEnabled?"🔊 Voz automática: ON":"🔇 Voz automática: OFF";
    [voiceToggle,voicePanelToggle].forEach(el=>{if(!el)return;el.textContent=label;el.setAttribute("aria-pressed",String(voiceEnabled));el.title=voiceEnabled?"La IA reproducirá las respuestas automáticamente":"La IA responderá sin reproducir voz automáticamente"});
  }
  function toggleVoice(){
    voiceEnabled=!voiceEnabled;localStorage.setItem("aq_voice_enabled",voiceEnabled?"1":"0");syncVoiceToggle();
    if(!voiceEnabled){window.speechSynthesis?.cancel();brain()?.setSpeaking?.(false);if(status)status.textContent="Voz automática desactivada"}
    else if(status)status.textContent="Voz automática activada";
  }
  function loadVoices(){
    if(!("speechSynthesis" in window))return;
    browserVoices=window.speechSynthesis.getVoices()||[];
    if(!browserVoices.length)return;
    const preferred=browserVoices.filter(v=>/^es(-|_)(AR|MX|ES)/i.test(v.lang));
    selectedVoice=selectedVoice||preferred[0]||browserVoices[0];
    if(voiceName)voiceName.textContent=(selectedVoice?.name||"Voz del dispositivo")+" · "+(selectedVoice?.lang||"");
    const list=$("voiceList");
    if(list){
      const names=[...browserVoices].filter(v=>/^es|^en/i.test(v.lang)).slice(0,20);
      list.innerHTML=names.map((v,i)=>'<button type="button" class="voice-option" data-voice-index="'+i+'"><b>'+escapeHTML(v.name)+'</b><small>'+escapeHTML(v.lang)+'</small></button>').join("");
      list.querySelectorAll("[data-voice-index]").forEach((b,i)=>b.onclick=()=>{selectedVoice=names[i];if(voiceName)voiceName.textContent=selectedVoice.name+" · "+selectedVoice.lang});
    }
  }
  function speak(text){
    if(!("speechSynthesis" in window)||!text)return;
    window.speechSynthesis.cancel();loadVoices();
    const u=new SpeechSynthesisUtterance(String(text));u.voice=selectedVoice||null;u.lang=selectedVoice?.lang||"es-AR";u.rate=.96;u.pitch=1.02;u.volume=1;
    u.onstart=()=>{brain()?.setSpeaking?.(true);if(status)status.textContent="AgentiQ está hablando…"};
    u.onend=()=>{brain()?.setSpeaking?.(false);if(status)status.textContent="Voz lista"};
    u.onerror=()=>{brain()?.setSpeaking?.(false);if(status)status.textContent="Voz no disponible en este navegador"};
    window.speechSynthesis.speak(u);
  }
  window.AgentiCuanticoVoice={speak,stop:()=>window.speechSynthesis?.cancel(),loadVoices,toggle:toggleVoice,isEnabled:()=>voiceEnabled};\n  voiceToggle?.addEventListener("click",toggleVoice); voicePanelToggle?.addEventListener("click",toggleVoice);\n  previewVoice?.addEventListener("click",()=>{loadVoices();speak("Hola, soy AgentiQ. Esta es una vista previa de la voz seleccionada.");});\n  syncVoiceToggle();

  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(mic&&SpeechRecognition){
    recognition=new SpeechRecognition();window.recognition=recognition;recognition.lang="es-AR";recognition.continuous=false;recognition.interimResults=true;
    recognition.onstart=()=>{listening=true;mic.classList.add("active");if(status)status.textContent="Escuchando…";setThinking(true)};
    recognition.onresult=e=>{let finalText="";for(let i=e.resultIndex;i<e.results.length;i++)finalText+=e.results[i][0].transcript;if(input)input.value=finalText};
    recognition.onerror=e=>{listening=false;mic.classList.remove("active");setThinking(false);if(status)status.textContent="Voz lista";notify("No pude acceder al micrófono: "+e.error)};
    recognition.onend=()=>{listening=false;mic.classList.remove("active");setThinking(false);if(input?.value.trim()){const t=input.value.trim();input.value="";ask(t)}};
    mic.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();if(listening){recognition.stop();return}try{recognition.start()}catch{}},true);
  }else if(mic)mic.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();notify("Este navegador no habilita reconocimiento de voz. Probá Chrome/Edge con permiso de micrófono.")},true);

  stop?.addEventListener("click",()=>{window.speechSynthesis?.cancel();if(listening)recognition?.stop();brain()?.setSpeaking?.(false);if(status)status.textContent="Voz detenida"});
  $("attachButton")?.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();attach?.click()},true);
  attach?.addEventListener("change",async e=>{
    e.stopImmediatePropagation(); const files=[...(attach.files||[])]; if(!files.length)return;
    renderAttachments(files); busy=true;setDisabled(true);setThinking(true);
    try{
      const uploads=[];
      for(const file of files){uploads.push(await uploadFile(file));}
      pendingUploads.push(...uploads);
      const labels=uploads.map(x=>x.name).join(", ");
      appendMessage("user","Archivo subido: "+labels);
      saveTurn("user","Archivo subido: "+labels);
      notify("Subida completada: "+labels);
      const c=ensureCurrent();
      const history=c.messages.slice(-14).filter(m=>m.role==="user"||m.role==="assistant").map(m=>({role:m.role,content:m.content}));
      const payload={message:"Analizá los archivos que acabo de subir.",history,attachments:uploads.map(x=>({name:x.name,kind:x.kind,data:x.kind==="image"&&x.size<=6*1024*1024?"":("Archivo almacenado en "+x.url),storage_key:x.key,url:x.url})),conversation_id:c.id,model:"AgentiQ",guest_session:guestId()};
      const r=await fetch(API+"/v1/public/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
      const d=await r.json().catch(()=>({}));
      if(r.ok&&d.answer){appendMessage("assistant",d.answer,d.model||"AgentiQ");saveTurn("assistant",d.answer);if(voiceEnabled)speak(d.answer)}
      else notify(d.message||"El archivo quedó almacenado, pero el motor no pudo analizarlo todavía.");
    }catch(err){notify(String(err.message||err))}
    finally{busy=false;setDisabled(false);setThinking(false);attach.value="";pendingUploads=[];setTimeout(()=>renderAttachments([]),700)}
  },true);
  imageButton?.addEventListener("click",async e=>{
    e.preventDefault(); if(busy)return;
    const prompt=window.prompt("¿Qué imagen querés generar?");
    if(!prompt?.trim())return;
    busy=true;setDisabled(true);setThinking(true);const thinking=appendMessage("assistant","Generando imagen…");
    try{
      const r=await fetch(API+"/v1/public/image-generation",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({prompt:prompt.trim()})});
      const d=await r.json().catch(()=>({})); if(!r.ok||!d.image)throw new Error(d.message||"Generación no disponible");
      thinking.remove();
      const el=document.createElement("div");el.className="msg assistant";
      el.innerHTML="<b>Imagen generada</b><br><img src='"+escapeHTML(d.image)+"' alt='Imagen generada por AgentiQ' style='display:block;max-width:100%;border-radius:16px;margin-top:10px'><small>"+escapeHTML(d.model||"Cloudflare Workers AI")+"</small>";
      messages.appendChild(el);messages.scrollTop=messages.scrollHeight;
      saveTurn("assistant","Imagen generada a partir de: "+prompt.trim());
    }catch(err){thinking.remove();notify(String(err.message||err))}
    finally{busy=false;setDisabled(false);setThinking(false)}
  });\n  send?.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();const t=input?.value.trim();if(t){input.value="";ask(t)}},true);
  input?.addEventListener("keydown",e=>{e.stopImmediatePropagation();if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();const t=input.value.trim();if(t){input.value="";ask(t)}}},true);
  $("composer")?.addEventListener("submit",e=>{e.preventDefault();const t=input?.value.trim();if(t){input.value="";ask(t)}},true);

  window.addEventListener("load",()=>{loadVoices();window.speechSynthesis?.addEventListener?.("voiceschanged",loadVoices);if(status&&!status.textContent)status.textContent="Voz lista";notify("AgentiQ listo")},{once:true});
})();
