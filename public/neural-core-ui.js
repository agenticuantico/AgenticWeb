const API_BASE = () => (window.AGENTICUANTICO_API_URL || "https://agenticweb.agenticuantico.workers.dev").replace(/\/$/, "");

export const AI_STATES = Object.freeze({
  READY: "READY",
  LISTENING: "LISTENING",
  UPLOADING: "UPLOADING",
  PROCESSING: "PROCESSING",
  ANALYZING: "ANALYZING",
  THINKING: "THINKING",
  GENERATING: "GENERATING",
  SPEAKING: "SPEAKING",
  DONE: "DONE",
  ERROR: "ERROR"
});

export class AIProvider {
  constructor({ endpoint = API_BASE } = {}) {
    this.endpoint = endpoint;
  }

  async chat({ message, history, conversationId, session, attachment, signal }) {
    const response = await fetch(this.endpoint() + "/v1/public/chat", {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        "X-Guest-Session": session
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        message,
        consent_to_memory: false,
        history: history.slice(-10),
        ...(attachment ? { attachments: [attachment] } : {})
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.answer) {
      throw new Error(data.message || "ai_unavailable");
    }
    return data.answer;
  }
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export function createVoiceController({ getGender, onState, onTranscript, onSpeakStart, onSpeakEnd }) {
  let recognition = null;
  let enabled = false;
  let preferredVoice = null;
  let preferredVoiceName = "";

  const getVoices = () => window.speechSynthesis?.getVoices?.() || [];
  const guessGender = v => { const n=String(v?.name||"").toLowerCase(); if(/female|woman|mujer|femen|sofia|sara|lucia|paola|camila|valentina|ana|helena|emma|olivia|aria|ava|zira/.test(n)) return "female"; if(/male|man|hombre|mascul|jorge|diego|carlos|miguel|juan|mateo|alex|daniel|thomas|george|david/.test(n)) return "male"; return "any"; };\n\n  const pickVoice = (lang = "es-AR", gender = "any") => {
    const voices = getVoices();
    const same = voices.filter(v => v.lang?.toLowerCase().startsWith(lang.slice(0,2).toLowerCase()));
    const pool = gender === "any" ? same : same.filter(v => guessGender(v) === gender);
    return pool.find(v => v.lang?.toLowerCase() === lang.toLowerCase())
      || pool[0]
      || same[0]
      || voices[0]
      || null;
  };

  const loadVoice = (lang, name = "", gender = "any") => { preferredVoiceName=name||""; preferredVoice=preferredVoiceName?(getVoices().find(v=>v.name===preferredVoiceName)||pickVoice(lang,gender)):pickVoice(lang,gender); };

  const speak = (text, { lang = "es-AR", rate = 1, volume = 1 } = {}) => {
    if (!window.speechSynthesis || !text) return false;
    window.speechSynthesis.cancel();
    preferredVoice = preferredVoiceName ? (getVoices().find(v => v.name === preferredVoiceName) || pickVoice(lang, getGender?.() || "any")) : pickVoice(lang, getGender?.() || "any");
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = preferredVoice?.lang || lang;
    utterance.voice = preferredVoice;
    utterance.rate = Math.max(.6, Math.min(1.35, Number(rate) || 1));
    utterance.volume = Math.max(0, Math.min(1, Number(volume) || 1));
    utterance.onstart = () => { onSpeakStart?.(); onState?.(AI_STATES.SPEAKING); };
    utterance.onend = () => { onSpeakEnd?.(); onState?.(AI_STATES.DONE); };
    utterance.onerror = () => { onSpeakEnd?.(); onState?.(AI_STATES.ERROR); };
    window.speechSynthesis.speak(utterance);
    return true;
  };

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel?.();
    onSpeakEnd?.();
  };

  const stopListening = () => {
    try { recognition?.stop(); } catch {}
    recognition = null;
    enabled = false;
  };

  const startListening = ({ lang = "es-AR" } = {}) => {
    if (!SpeechRecognition) {
      onState?.(AI_STATES.ERROR);
      return { ok: false, reason: "speech_recognition_unavailable" };
    }
    stopListening();
    recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    enabled = true;

    recognition.onstart = () => onState?.(AI_STATES.LISTENING);
    recognition.onresult = event => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0]?.transcript || "";
      }
      onTranscript?.(transcript.trim(), !!event.results[event.results.length - 1]?.isFinal);
    };
    recognition.onerror = () => {
      enabled = false;
      onState?.(AI_STATES.ERROR);
    };
    recognition.onend = () => {
      enabled = false;
      recognition = null;
      onState?.(AI_STATES.READY);
    };
    recognition.start();
    return { ok: true };
  };

  window.speechSynthesis?.addEventListener?.("voiceschanged", () => {
    preferredVoice = preferredVoiceName ? (getVoices().find(v => v.name === preferredVoiceName) || pickVoice("es-AR", getGender?.() || "any")) : pickVoice("es-AR", getGender?.() || "any");
  });

  loadVoice("es-AR");

  return {
    supported: !!SpeechRecognition && !!window.speechSynthesis,
    speechSupported: !!window.speechSynthesis,
    recognitionSupported: !!SpeechRecognition,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    loadVoice,
    getVoices,
    guessGender,
    isListening: () => enabled
  };
}

export function validateFile(file) {
  const maxBytes = 100 * 1024 * 1024;
  if (!file) return { ok: false, reason: "missing" };
  if (file.size > maxBytes) return { ok: false, reason: "size" };
  return { ok: true };
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return bytes + " B";
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  for (const unit of units) {
    if (value < 1024) return value.toFixed(value < 10 ? 1 : 0) + " " + unit;
    value /= 1024;
  }
  return value.toFixed(1) + " TB";
}

async function toDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(file)})}
export async function prepareAttachment(file){
  const type=file.type||"application/octet-stream";
  if(type.startsWith("image/")) return {name:file.name,type,kind:"image",data:await toDataUrl(file)};
  if(type.startsWith("text/")||/\.(json|xml|csv|md|js|ts|tsx|jsx|py|java|cpp|c|html|css)$/i.test(file.name)){
    return {name:file.name,type,kind:"text",data:(await file.text()).slice(0,120000)};
  }
  return {name:file.name,type,kind:"file",data:"Archivo recibido: "+file.name+" ("+formatBytes(file.size)+"). El procesamiento específico de este formato requiere el pipeline de archivos del backend."};
}
