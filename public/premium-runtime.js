/* AgentiCuantico premium interaction runtime.
 * This module is intentionally independent from app.js so chat, voice and uploads
 * remain usable even if an optional visual/3D module fails.
 */
(() => {
  "use strict";
  const API=(window.AGENTICUANTICO_API_URL||"https://agenticweb.agenticuantico.workers.dev").replace(/\/$/,"");
  const $=id=>document.getElementById(id);
  const input=$("input"), send=$("send"), messages=$("messages"), attach=$("attachInput");
  const mic=$("voiceInput"), stop=$("stopVoice"), status=$("voiceStatus"), voiceName=$("voiceName");
  const tray=$("attachmentTray"), brain=()=>window.__aqBrain;
  let busy=false, listening=false, selectedVoice=null, browserVoices=[];

  const escapeHTML=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const notify=(text)=>{
    const t=$("toast"); if(!t)return;
    t.textContent=text;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2400);
  };
  const addMessage=(role,text,meta="")=>{
    if(!messages)return null;
    const el=document.createElement("div");
    el.className="msg "+(role==="user"?"user":"assistant");
    el.innerHTML=escapeHTML(text).replace(/\n/g,"<br>")+(meta?'<small class="msg-meta">'+escapeHTML(meta)+"</small>":"");
    messages.appendChild(el);messages.scrollTop=messages.scrollHeight;return el;
  };
  const setThinking=v=>{
    brain()?.setThinking?.(v);
    brain()?.setThinkingState?.();
    if(status)status.textContent=v?"AgentiQ está razonando…":"Voz lista";
  };
  const setDisabled=v=>{if(send)send.disabled=v;if(input)input.disabled=v};

  function renderAttachments(files){
    if(!tray)return;
    tray.classList.toggle("hidden",!files.length);
    tray.innerHTML=files.map(f=>'<span class="attachment-chip">◉ '+escapeHTML(f.name)+' <small>'+Math.ceil(f.size/1024)+' KB</small></span>').join("");
  }

  async function fileToText(file){
    const type=file.type||"";
    if(type.startsWith("text/")||/\.(txt|md|json|js|ts|css|html|py|csv|xml|yaml|yml)$/i.test(file.name)){
      const text=await file.text();
      return text.slice(0,120000);
    }
    if(type.startsWith("image/")){
      return "[Imagen adjunta: "+file.name+", "+file.type+", "+file.size+" bytes]. Analizá esta imagen si el modelo visual está habilitado; si no, explicá claramente que se recibió la imagen pero este canal textual no puede inspeccionarla.";
    }
    return "[Archivo adjunto: "+file.name+", tipo "+(file.type||"desconocido")+", "+file.size+" bytes].";
  }

  async function ask(text,files=[]){
    text=String(text||"").trim();
    if((!text&&files.length===0)||busy)return;
    const fileContext=[];
    for(const f of files){
      try{fileContext.push("### "+f.name+"\n"+await fileToText(f));}
      catch(e){fileContext.push("### "+f.name+"\nNo se pudo leer el archivo en el navegador.");}
    }
    const prompt=[text,...fileContext].filter(Boolean).join("\n\n");
    addMessage("user",text||("Analizá "+files.map(f=>f.name).join(", ")));
    busy=true;setDisabled(true);setThinking(true);
    const thinking=addMessage("assistant","Procesando…");
    try{
      const history=[...messages.querySelectorAll(".msg")].slice(-12).map(el=>({
        role:el.classList.contains("user")?"user":"assistant",
        content:el.textContent.replace(/^Procesando…$/,"").trim()
      })).filter(x=>x.content&&x.content!=="Procesando…");
      const res=await fetch(API+"/v1/public/chat",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({message:prompt,history,conversation_id:crypto.randomUUID(),model:"AgentiQ"})
      });
      let data={};try{data=await res.json()}catch{}
      if(!res.ok||!data.answer)throw new Error(data.error||("HTTP "+res.status));
      thinking.innerHTML=escapeHTML(data.answer).replace(/\n/g,"<br>");
      speak(data.answer);
    }catch(err){
      thinking.innerHTML=escapeHTML("No pude completar la respuesta. El motor está reintentando. Detalle: "+err.message);
      notify("El motor no respondió; revisá la conexión.");
    }finally{
      busy=false;setDisabled(false);setThinking(false);input?.focus();
    }
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
      const female=/female|woman|mujer|clara|luna|samantha|monica|paulina|helena|zira/i;
      const names=[...browserVoices].filter(v=>/^es|^en/i.test(v.lang)).slice(0,20);
      list.innerHTML=names.map((v,i)=>'<button type="button" class="voice-option" data-voice-index="'+i+'"><b>'+escapeHTML(v.name)+'</b><small>'+escapeHTML(v.lang)+'</small></button>').join("");
      list.querySelectorAll("[data-voice-index]").forEach((b,i)=>b.onclick=()=>{selectedVoice=names[i];if(voiceName)voiceName.textContent=selectedVoice.name+" · "+selectedVoice.lang;});
    }
  }
  function speak(text){
    if(!("speechSynthesis" in window)||!text)return;
    window.speechSynthesis.cancel();
    loadVoices();
    const u=new SpeechSynthesisUtterance(String(text));
    u.voice=selectedVoice||null;u.lang=selectedVoice?.lang||"es-AR";u.rate=.96;u.pitch=1.02;u.volume=1;
    u.onstart=()=>{brain()?.setSpeaking?.(true);if(status)status.textContent="AgentiQ está hablando…"};
    u.onend=()=>{brain()?.setSpeaking?.(false);if(status)status.textContent="Voz lista"};
    u.onerror=()=>{brain()?.setSpeaking?.(false);if(status)status.textContent="Voz no disponible en este navegador"};
    window.speechSynthesis.speak(u);
  }
  window.AgentiCuanticoVoice={speak,stop:()=>window.speechSynthesis?.cancel(),loadVoices};

  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(mic&&SpeechRecognition){
    recognition=new SpeechRecognition();
    recognition.lang="es-AR";recognition.continuous=false;recognition.interimResults=true;
    recognition.onstart=()=>{listening=true;mic.classList.add("active");if(status)status.textContent="Escuchando…";setThinking(true)};
    recognition.onresult=e=>{
      let finalText="";
      for(let i=e.resultIndex;i<e.results.length;i++)finalText+=e.results[i][0].transcript;
      if(input)input.value=finalText;
    };
    recognition.onerror=e=>{listening=false;mic.classList.remove("active");setThinking(false);if(status)status.textContent="Voz lista";notify("No pude acceder al micrófono: "+e.error)};
    recognition.onend=()=>{
      listening=false;mic.classList.remove("active");setThinking(false);
      if(input?.value.trim())ask(input.value.trim());
    };
    mic.onclick=()=>{if(listening){recognition.stop();return}try{recognition.start()}catch{}};
  }else if(mic){
    mic.onclick=()=>notify("Este navegador no habilita reconocimiento de voz. Probá Chrome/Edge con permiso de micrófono.");
  }
  stop?.addEventListener("click",()=>{window.speechSynthesis?.cancel();if(listening)recognition?.stop();brain()?.setSpeaking?.(false);if(status)status.textContent="Voz detenida"});

  $("attachButton")?.addEventListener("click",()=>attach?.click());
  attach?.addEventListener("change",async()=>{
    const files=[...(attach.files||[])];
    renderAttachments(files);
    if(!files.length)return;
    // Selecting files is an action: process immediately instead of waiting for Send.
    await ask("",files);
    attach.value="";
    setTimeout(()=>renderAttachments([]),300);
  });
  send?.addEventListener("click",()=>{const t=input?.value.trim();if(t){input.value="";ask(t)}});
  input?.addEventListener("keydown",e=>{
    if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();const t=input.value.trim();if(t){input.value="";ask(t)}}
  });

  window.addEventListener("load",()=>{
    loadVoices();window.speechSynthesis?.addEventListener?.("voiceschanged",loadVoices);
    // Make every visible send/mic control usable even when the legacy app failed.
    if(status&&!status.textContent)status.textContent="Voz lista";
    notify("AgentiQ listo");
  },{once:true});
})();