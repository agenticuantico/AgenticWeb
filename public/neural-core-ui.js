const API_BASE=()=>{
  if(window.AGENTICUANTICO_API_URL) return String(window.AGENTICUANTICO_API_URL).replace(/\/$/,"");
  const host=String(window.location?.hostname||"").toLowerCase();
  if(host==="agenticuantico.dev.ar"||host.endsWith(".agenticuantico.dev.ar")) return window.location.origin;
  return "https://agenticweb.agenticuantico.workers.dev";
};
export const AI_STATES=Object.freeze({READY:"READY",LISTENING:"LISTENING",UPLOADING:"UPLOADING",PROCESSING:"PROCESSING",ANALYZING:"ANALYZING",THINKING:"THINKING",GENERATING:"GENERATING",SPEAKING:"SPEAKING",DONE:"DONE",ERROR:"ERROR"});
export class AIProvider{
  constructor({endpoint=API_BASE}={}){this.endpoint=endpoint}
  async chat({message,history,conversationId,session,attachment,signal}){
    const r=await fetch(this.endpoint()+"/v1/public/chat",{
      method:"POST",
      signal,
      headers:{"Content-Type":"application/json","X-Guest-Session":session},
      body:JSON.stringify({
        conversation_id:conversationId,
        message,
        consent_to_memory:false,
        history:Array.isArray(history)?history.slice(-10):[],
        ...(attachment?{attachments:[attachment]}:{})
      })
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.answer) throw new Error(d.message||"ai_unavailable");
    return {answer:d.answer,provider:d.provider||"AI Engine",model:d.model||"active"};
  }
  async generate(args){ return this.chat(args); }
  async health(){
    const r=await fetch(this.endpoint()+"/health",{cache:"no-store"});
    const d=await r.json().catch(()=>({}));
    return {ok:r.ok&&d.ok===true,...d};
  }
  abortableChat(args){
    const controller=new AbortController();
    return {controller,promise:this.chat({...args,signal:controller.signal})};
  }
}

const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
export function createVoiceController({getGender,onState,onTranscript,onSpeakStart,onSpeakEnd}){let recognition=null,enabled=false,preferredVoice=null,preferredVoiceName="";const getVoices=()=>window.speechSynthesis?.getVoices?.()||[];const guessGender=v=>{const n=String(v?.name||"").toLowerCase();if(/female|woman|mujer|femen|sofia|sara|lucia|paola|camila|valentina|ana|helena|emma|olivia|aria|ava|zira/.test(n))return"female";if(/male|man|hombre|mascul|jorge|diego|carlos|miguel|juan|mateo|alex|daniel|thomas|george|david/.test(n))return"male";return"any"};const pickVoice=(lang="es-AR",gender="any")=>{const voices=getVoices(),base=voices.filter(v=>v.lang?.toLowerCase().startsWith(lang.slice(0,2).toLowerCase())),pool=gender==="any"?base:base.filter(v=>guessGender(v)===gender);return pool.find(v=>v.lang?.toLowerCase()===lang.toLowerCase())||pool[0]||base[0]||voices[0]||null};const loadVoice=(lang,name="",gender="any")=>{preferredVoiceName=name||"";preferredVoice=preferredVoiceName?(getVoices().find(v=>v.name===preferredVoiceName)||pickVoice(lang,gender)):pickVoice(lang,gender)};const speak=(text,{lang="es-AR",rate=1,volume=1}={})=>{if(!window.speechSynthesis||!text)return false;window.speechSynthesis.cancel();preferredVoice=preferredVoiceName?(getVoices().find(v=>v.name===preferredVoiceName)||pickVoice(lang,getGender?.()||"any")):pickVoice(lang,getGender?.()||"any");const u=new SpeechSynthesisUtterance(text);u.lang=preferredVoice?.lang||lang;u.voice=preferredVoice;u.rate=Math.max(.6,Math.min(1.35,Number(rate)||1));u.volume=Math.max(0,Math.min(1,Number(volume)||1));u.onstart=()=>{onSpeakStart?.();onState?.(AI_STATES.SPEAKING)};u.onend=()=>{onSpeakEnd?.();onState?.(AI_STATES.DONE)};u.onerror=()=>{onSpeakEnd?.();onState?.(AI_STATES.ERROR)};window.speechSynthesis.speak(u);return true};const stopSpeaking=()=>{window.speechSynthesis?.cancel?.();onSpeakEnd?.()};const stopListening=()=>{try{recognition?.stop()}catch{}recognition=null;enabled=false};const startListening=({lang="es-AR"}={})=>{if(!SpeechRecognition){onState?.(AI_STATES.ERROR);return{ok:false,reason:"speech_recognition_unavailable"}}stopListening();recognition=new SpeechRecognition();recognition.lang=lang;recognition.continuous=false;recognition.interimResults=true;recognition.maxAlternatives=1;enabled=true;recognition.onstart=()=>onState?.(AI_STATES.LISTENING);recognition.onresult=e=>{let t="";for(let i=e.resultIndex;i<e.results.length;i++)t+=e.results[i][0]?.transcript||"";onTranscript?.(t.trim(),!!e.results[e.results.length-1]?.isFinal)};recognition.onerror=()=>{enabled=false;onState?.(AI_STATES.ERROR)};recognition.onend=()=>{enabled=false;recognition=null;onState?.(AI_STATES.READY)};try{recognition.start();return{ok:true}}catch{enabled=false;onState?.(AI_STATES.ERROR);return{ok:false,reason:"start_failed"}}};window.speechSynthesis?.addEventListener?.("voiceschanged",()=>{preferredVoice=preferredVoiceName?(getVoices().find(v=>v.name===preferredVoiceName)||pickVoice("es-AR",getGender?.()||"any")):pickVoice("es-AR",getGender?.()||"any")});loadVoice("es-AR");return{supported:!!SpeechRecognition&&!!window.speechSynthesis,speechSupported:!!window.speechSynthesis,recognitionSupported:!!SpeechRecognition,startListening,stopListening,speak,stopSpeaking,loadVoice,getVoices,guessGender,isListening:()=>enabled}}
export function validateFile(file){const maxBytes=100*1024*1024;return file?(file.size>maxBytes?{ok:false,reason:"size"}:{ok:true}):{ok:false,reason:"missing"}}
export function formatBytes(bytes){if(!Number.isFinite(bytes))return"";if(bytes<1024)return bytes+" B";const u=["KB","MB","GB"];let v=bytes/1024;for(const x of u){if(v<1024)return v.toFixed(v<10?1:0)+" "+x;v/=1024}return v.toFixed(1)+" TB"}
async function toDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(file)})}
export async function prepareAttachment(file){const type=file.type||"application/octet-stream";if(type.startsWith("image/"))return{name:file.name,type,kind:"image",data:await toDataUrl(file)};if(type.startsWith("text/")||/\.(json|xml|csv|md|js|ts|tsx|jsx|py|java|cpp|c|html|css)$/i.test(file.name))return{name:file.name,type,kind:"text",data:(await file.text()).slice(0,120000)};throw new Error("unsupported_file_format")}