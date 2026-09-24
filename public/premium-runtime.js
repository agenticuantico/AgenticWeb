/* AgentiCuantico premium runtime — chat-first UI, 3D neural brain, voice and attachments. */
(() => {
  "use strict";

  const productionOrigin=/^https?:$/i.test(location.protocol)?location.origin:"";
  const API=(productionOrigin&&productionOrigin!=="null"?productionOrigin:"https://agenticweb.agenticuantico.workers.dev").replace(/\/$/,"");
  const API_FALLBACK="https://agenticweb.agenticuantico.workers.dev";
  const $=id=>document.getElementById(id);
  const input=$("input"),send=$("send"),messages=$("messages"),attach=$("attachInput");
  const mic=$("voiceInput"),stop=$("stopVoice"),status=$("voiceStatus"),voiceName=$("voiceName"),tray=$("attachmentTray");
  const brain=()=>window.__aqBrain;
  const HISTORY_KEY="aq_conversations_v2";
  const ACTIVE_KEY="aq_active_v2";
  const AUTH_KEY="aq_auth_v1";
  const SESSION_KEY="aq_guest_v6";
  let busy=false,listening=false,recognition=null,selectedVoice=null,browserVoices=[];\n  let speechOutput=localStorage.getItem("aq_speech_output")!== "off";\n  let voiceGender=localStorage.getItem("aq_voice_gender")||"female";\n  let voiceLocale=localStorage.getItem("aq_voice_locale")||"es-AR";
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

  const setThinking=v=>{brain()?.setThinking?.(v);brain()?.setThinkingState?.();if(status&&v)status.textContent="AgentiQ está razonando…"};\n  const setListeningState=v=>{brain()?.setListening?.(v);if(status)status.textContent=v?"Escuchando…":"Voz lista";};
  const setDisabled=v=>{if(send)send.disabled=v;if(input)input.disabled=v};

  function renderAttachments(files){
    if(!tray)return;tray.classList.toggle("hidden",!files.length);
    tray.innerHTML=files.map(f=>'<span class="attachment-chip">◉ '+escapeHTML(f.name)+' <small>'+Math.ceil(f.size/1024)+' KB</small></span>').join("");
  }
  async function fileToText(file){
    const type=file.type||"";
    if(type.startsWith("text/")||/\.(txt|md|json|js|ts|css|html|py|csv|xml|yaml|yml)$/i.test(file.name))return (await file.text()).slice(0,120000);
    if(type.startsWith("image/"))return "[Imagen adjunta: "+file.name+", "+file.type+", "+file.size+" bytes].";
    return "[Archivo adjunto: "+file.name+", tipo "+(file.type||"desconocido")+", "+file.size+" bytes].";
  }
  async function filePayload(file){
    if((file.type||"").startsWith("image/")){
      const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});
      return {name:file.name,kind:"image",data:String(data)};
    }
    return {name:file.name,kind:"file",data:await fileToText(file)};
  }

  async function ask(text,files=[]){
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
      const selectedAgent=window.__aqActiveAgent||null;\n      const selectedTeam=window.__aqActiveTeam||null;\n      const payload={message:prompt,history,attachments:filePayloads,conversation_id:c.id,model:"AgentiQ",guest_session:guestId(),agent:selectedAgent,team:selectedTeam};
      const requestOptions={method:"POST",headers:{"content-type":"application/json","accept":"application/json"},body:JSON.stringify(payload)};
      let res=await fetch(API+"/v1/public/chat",requestOptions);
      if((res.status===405||res.status===404||res.status===502)&&API!==API_FALLBACK)res=await fetch(API_FALLBACK+"/v1/public/chat",requestOptions);
      let data={};try{data=await res.json()}catch{}
      if(!res.ok||!data.answer)throw new Error(data.error||data.message||("HTTP "+res.status));
      thinking.remove();
      appendMessage("assistant",data.answer,data.model?String(data.model):"AgentiQ");
      saveTurn("assistant",data.answer);
      if(speechOutput)speak(data.answer);
    }catch(err){
      thinking.remove();
      const detail=String(err?.message||err||"error de conexión");
      const fallback="No pude completar la respuesta. Verificá la conexión del motor e intentá nuevamente.";
      appendMessage("assistant",fallback);
      saveTurn("assistant",fallback);
      notify("AgentiQ no respondió: "+detail);
    }finally{busy=false;setDisabled(false);setThinking(false);input?.focus()}
  }

  function loadVoices(){
    if(!("speechSynthesis" in window))return;
    browserVoices=window.speechSynthesis.getVoices()||[];
    if(!browserVoices.length)return;
    const preferred=browserVoices.filter(v=>/^es(-|_)(AR|MX|ES)/i.test(v.lang));
    const localeMatches=browserVoices.filter(v=>String(v.lang||"").toLowerCase()===voiceLocale.toLowerCase());\n    const genderHint=voiceGender==="male"?/male|man|jorge|diego|mateo|bruno|alex|james/i:/female|woman|female|clara|luna|sophie|samantha|aria|zira/i;\n    const genderMatches=browserVoices.filter(v=>genderHint.test(v.name));\n    selectedVoice=localeMatches[0]||genderMatches.find(v=>String(v.lang||"").toLowerCase().startsWith(voiceLocale.slice(0,2).toLowerCase()))||preferred[0]||browserVoices[0];
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
    const u=new SpeechSynthesisUtterance(String(text));u.voice=selectedVoice||null;u.lang=voiceLocale;u.rate=.96;u.pitch=1.02;u.volume=1;
    u.onstart=()=>{brain()?.setSpeaking?.(true);if(status)status.textContent="AgentiQ está hablando…"};
    u.onend=()=>{brain()?.setSpeaking?.(false);if(status)status.textContent="Voz lista"};
    u.onerror=()=>{brain()?.setSpeaking?.(false);if(status)status.textContent="Voz no disponible en este navegador"};
    window.speechSynthesis.speak(u);
  }
  window.AgentiCuanticoVoice={speak,stop:()=>window.speechSynthesis?.cancel(),loadVoices};

  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(mic&&SpeechRecognition){
    recognition=new SpeechRecognition();window.recognition=recognition;recognition.lang=voiceLocale;recognition.continuous=false;recognition.interimResults=true;
    recognition.onstart=()=>{listening=true;mic.classList.add("active");setListeningState(true);setThinking(false);$("micModeToggle")?.classList.add("active");$("micModeToggle")?.setAttribute("aria-pressed","true");$("micModeToggle")&&( $("micModeToggle").textContent="🎙️ Micrófono activo" );};
    recognition.onresult=e=>{let finalText="";for(let i=e.resultIndex;i<e.results.length;i++)finalText+=e.results[i][0].transcript;if(input)input.value=finalText};
    recognition.onerror=e=>{listening=false;mic.classList.remove("active");setListeningState(false);if(status)status.textContent="Voz lista";$("micModeToggle")?.classList.remove("active");$("micModeToggle")?.setAttribute("aria-pressed","false");if($("micModeToggle"))$("micModeToggle").textContent="🎙️ Micrófono apagado";notify("No pude acceder al micrófono: "+e.error)};
    recognition.onend=()=>{listening=false;mic.classList.remove("active");setListeningState(false);$("micModeToggle")?.classList.remove("active");$("micModeToggle")?.setAttribute("aria-pressed","false");if($("micModeToggle"))$("micModeToggle").textContent="🎙️ Micrófono apagado";if(input?.value.trim()){const t=input.value.trim();input.value="";ask(t)}};
    mic.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();if(listening){recognition.stop();return}try{recognition.start()}catch{}},true);
  }else if(mic)mic.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();notify("Este navegador no habilita reconocimiento de voz. Probá Chrome/Edge con permiso de micrófono.")},true);

  stop?.addEventListener("click",()=>{window.speechSynthesis?.cancel();if(listening)recognition?.stop();brain()?.setSpeaking?.(false);if(status)status.textContent="Voz detenida"});\n  $("speechOutputToggle")?.addEventListener("click",()=>{speechOutput=!speechOutput;localStorage.setItem("aq_speech_output",speechOutput?"on":"off");$("speechOutputToggle").classList.toggle("active",speechOutput);$("speechOutputToggle").setAttribute("aria-pressed",String(speechOutput));$("speechOutputToggle").textContent=speechOutput?"🔊 Respuestas habladas":"🔇 Solo texto";notify(speechOutput?"Respuestas por voz activadas":"Respuestas solo por texto")});\n  $("micModeToggle")?.addEventListener("click",()=>{if(!recognition){notify("Este navegador no admite reconocimiento de voz");return}if(listening){recognition.stop();return}recognition.lang=voiceLocale;try{recognition.start()}catch{}});\n  document.querySelectorAll(".voice-tab").forEach(tab=>tab.addEventListener("click",()=>{voiceGender=tab.dataset.voiceGender||"female";localStorage.setItem("aq_voice_gender",voiceGender);document.querySelectorAll(".voice-tab").forEach(t=>t.classList.toggle("active",t===tab));loadVoices()}));\n  document.querySelectorAll(".language-row").forEach(row=>row.addEventListener("click",()=>{const text=row.innerText.toLowerCase();voiceLocale=text.includes("argentina")?"es-AR":text.includes("españa")?"es-ES":text.includes("estados unidos")?"en-US":"en-GB";localStorage.setItem("aq_voice_locale",voiceLocale);document.querySelectorAll(".language-row").forEach(r=>r.classList.toggle("active",r===row));if(recognition)recognition.lang=voiceLocale;loadVoices();notify("Idioma de voz: "+row.innerText.replace("›","").trim())}));
  $("attachButton")?.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();attach?.click()},true);
  attach?.addEventListener("change",async e=>{e.stopImmediatePropagation();const files=[...(attach.files||[])];renderAttachments(files);if(files.length)await ask("",files);attach.value="";setTimeout(()=>renderAttachments([]),900)},true);
  send?.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();const t=input?.value.trim();if(t){input.value="";ask(t)}},true);
  input?.addEventListener("keydown",e=>{e.stopImmediatePropagation();if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();const t=input.value.trim();if(t){input.value="";ask(t)}}},true);
  $("composer")?.addEventListener("submit",e=>{e.preventDefault();const t=input?.value.trim();if(t){input.value="";ask(t)}},true);

  window.addEventListener("load",()=>{if($("speechOutputToggle")){ $("speechOutputToggle").classList.toggle("active",speechOutput);$("speechOutputToggle").setAttribute("aria-pressed",String(speechOutput));$("speechOutputToggle").textContent=speechOutput?"🔊 Respuestas habladas":"🔇 Solo texto";}loadVoices();window.speechSynthesis?.addEventListener?.("voiceschanged",loadVoices);if(status&&!status.textContent)status.textContent="Voz lista";notify("AgentiQ listo")},{once:true});
})();
