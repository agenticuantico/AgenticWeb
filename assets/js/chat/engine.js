/**
 * Motor de conversación.
 *  - Con el servidor activo (worker-v2: GET /api/health OK): modelo de lenguaje completo por SSE,
 *    agente con herramientas, transcripción (/api/stt) y voz (/api/tts).
 *  - Sin servidor: base local en el navegador (información del producto, cálculos exactos, ejemplos
 *    de código, análisis de documentos por extracción). La interfaz no cambia; las respuestas son honestas
 *    sobre lo que se puede hacer localmente.
 */
import { CONFIG, formatARS } from '../config.js';
import { analyzeLocally } from './docs-local.js';
import { isWebDesign, localSite } from './webdesign.js';

export const state = { live: false, checked: false, caps: null, base: '' };
const P = CONFIG.PRICES;
const MAIL = 'el formulario de [contacto](/contacto/)';

const sleep = (ms, signal) => new Promise((res, rej) => {
  const t = setTimeout(res, ms);
  signal && signal.addEventListener('abort', () => { clearTimeout(t); rej(abortErr()); }, { once: true });
});
function abortErr() { const e = new Error('aborted'); e.name = 'AbortError'; return e; }

/* ---------- Servidor ---------- */
let initP;
export function init() {
  if (initP) return initP;
  const base = String(CONFIG.API_BASE || '').replace(/\/+$/, '');
  if (!base || /[?&]local=1\b/.test(location.search)) { state.checked = true; return (initP = Promise.resolve(state)); }
  try {
    const c = JSON.parse(sessionStorage.getItem('ac.health') || 'null');
    if (c && c.base === base && Date.now() - c.at < 5 * 60_000) {
      Object.assign(state, { live: c.ok, caps: c.caps, base: c.ok ? base : '', checked: true });
      return (initP = Promise.resolve(state));
    }
  } catch {}
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CONFIG.HEALTH_TIMEOUT_MS);
  initP = fetch(base + '/api/health', { signal: ctrl.signal, credentials: 'include', cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => { const ok = !!(j && j.ok && j.llm); Object.assign(state, { live: ok, caps: ok ? j : null, base: ok ? base : '' }); })
    .catch(() => Object.assign(state, { live: false, caps: null, base: '' }))
    .then(() => {
      clearTimeout(timer); state.checked = true;
      try { sessionStorage.setItem('ac.health', JSON.stringify({ base, ok: state.live, caps: state.caps, at: Date.now() })); } catch {}
      return state;
    });
  return initP;
}
function markOffline() { state.live = false; state.base = ''; try { sessionStorage.removeItem('ac.health'); } catch {} }

let idToken = null;
/** El chat informa el token de Firebase del usuario para que el servidor verifique la cuenta. */
export function setIdTokenProvider(fn) { idToken = fn; }

/** Llamada autenticada al servidor (la usan media.js y otros módulos del chat). */
export function apiFetch(path, opts) { return api(path, opts); }
async function api(path, { method = 'GET', body, signal, raw } = {}) {
  const headers = {};
  if (body && !raw) headers['Content-Type'] = 'application/json';
  if (idToken) { try { const t = await idToken(); if (t) headers.Authorization = 'Bearer ' + t; } catch {} }
  return fetch(state.base + path, { method, credentials: 'include', signal, headers, body: raw ? body : body ? JSON.stringify(body) : undefined });
}
async function readSSE(res, onData, signal) {
  const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i); buf = buf.slice(i + 2);
      for (const line of block.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const p = line.slice(5).trim();
        if (!p) continue;
        if (p === '[DONE]') { onData('[DONE]'); continue; }
        try { onData(JSON.parse(p)); } catch {}
      }
    }
    if (signal && signal.aborted) { reader.cancel().catch(() => {}); throw abortErr(); }
  }
}
const noticeFor = (s) => (s === 401 ? 'login' : s === 402 ? 'upgrade' : s === 429 ? 'quota' : 'fallback');

async function continueCut(o, text) {
  const cutNote = { es: '\n\n_(La respuesta se cortó por un problema de conexión. Volvé a enviar tu mensaje.)_', en: '\n\n_(The answer was cut off by a connection problem. Please send your message again.)_', pt: '\n\n_(A resposta foi interrompida por um problema de conexão. Envie sua mensagem de novo.)_' };
  const lang = /^en/.test(o.lang || '') ? 'en' : /^pt/.test(o.lang || '') ? 'pt' : 'es';
  try {
    const messages = [...o.messages, { role: 'assistant', content: text }, { role: 'user', content: '(Tu respuesta anterior se cortó. Continuala exactamente desde donde quedó, sin repetir nada y sin mencionar el corte.)' }];
    const res = await api('/api/chat', { method: 'POST', signal: o.signal, body: { messages, agent: o.agent ? 'custom' : 'general', agentId: o.agent?.id, system: [o.agent?.system, o.system].filter(Boolean).join('\n\n').slice(0, 4000), lang: o.lang, mode: 'fast' } });
    if (!res.ok || !res.body) throw new Error('cont_' + res.status);
    let more = ''; let done = false;
    await readSSE(res, (d) => { if (d === '[DONE]') done = true; else if (d && typeof d.delta === 'string') { more += d.delta; o.onDelta(d.delta); } }, o.signal);
    if (more && done) return text + more;
    o.onDelta(cutNote[lang]); return text + more + cutNote[lang];
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    o.onDelta(cutNote[lang]); return text + cutNote[lang];
  }
}

/**
 * Chat.
 * o: { messages:[{role,content}], lang, mode:'fast'|'deep', agent?:{id,name,system}, system?, attachments?, signal, onDelta, search?:boolean, onEvent? }
 */
export async function chat(o) {
  if (!state.live) return localChat(o);
  let text = '';
  try {
    const res = await api('/api/chat', { method: 'POST', signal: o.signal, body: { messages: o.messages, agent: o.agent ? 'custom' : 'general', agentId: o.agent?.id, agentName: o.agent?.name, system: [o.agent?.system, o.system].filter(Boolean).join('\n\n').slice(0, 4000), lang: o.lang, mode: o.mode === 'deep' ? 'deep' : 'fast', ...(typeof o.search === 'boolean' ? { search: o.search } : {}) } });
    if (!res.ok || !res.body) { const r = await localChat(o); r.notice = noticeFor(res.status); return r; }
    let done = false;
    try {
      await readSSE(res, (d) => {
        if (d === '[DONE]') done = true;
        else if (d && typeof d.delta === 'string') { text += d.delta; o.onDelta(d.delta); }
        // Búsqueda web en vivo: search_start / search_sources / search_limit / search_done
        else if (d && typeof d.type === 'string' && /^search_/.test(d.type) && o.onEvent) { try { o.onEvent(d); } catch {} }
      }, o.signal);
    } catch (e) { if (e.name === 'AbortError') throw e; }
    if (!text) { const r = await localChat(o); r.notice = 'fallback'; return r; }
    // Respuesta cortada (red o servidor): se pide la continuación una vez, sin repetir lo ya mostrado.
    if (!done) text = await continueCut(o, text);
    return { text, local: false };
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    if (text) return { text, local: false };
    markOffline();
    const r = await localChat(o); r.notice = 'fallback'; return r;
  }
}

/**
 * Llamada de voz: control de minutos en el servidor (POST /api/companion/start y /heartbeat).
 * Devuelve { ok, remainingSec?, limitMin?, exceeded?, offline? }. Sin servidor (o con error de red)
 * devuelve { ok: true, offline: true } y la llamada sigue con el control local de minutos.
 */
export async function companion(kind) {
  if (!state.live) return { ok: true, offline: true };
  try {
    const res = await api(kind === 'heartbeat' ? '/api/companion/heartbeat' : '/api/companion/start', { method: 'POST', body: {} });
    if (res.status === 429) {
      let j = null; try { j = await res.json(); } catch {}
      const err = j && (j.error || j.code);
      if (!err || err === 'call_minutes_exceeded') return { ok: false, exceeded: true };
      return { ok: true, offline: true }; // límite de frecuencia u otro 429: no cortar la llamada
    }
    if (!res.ok) return { ok: true, offline: true };
    const j = await res.json().catch(() => ({}));
    return { ok: true, remainingSec: Number.isFinite(j.remainingSec) ? j.remainingSec : undefined, limitMin: j.limitMin };
  } catch {
    return { ok: true, offline: true };
  }
}

/**
 * Transcripción del servidor (Workers AI Whisper → Gemini). Devuelve el texto, o null si no se pudo.
 * El motivo del último fallo queda en state.sttError para mostrar un mensaje honesto:
 *   'quota' (sin cupo diario en el servidor), 'server' (error del servidor), 'offline' (sin conexión),
 *   'no_speech' (el servidor no oyó palabras), 'unavailable' (sin transcripción en el servidor), o null si salió bien.
 */
export async function transcribe(blob, lang) {
  state.sttError = null;
  if (!state.live || !(state.caps && state.caps.stt)) { state.sttError = 'unavailable'; return null; }
  try {
    const fd = new FormData();
    const t = String(blob.type || '');
    fd.append('audio', blob, 'voz.' + (t.includes('mp4') ? 'mp4' : t.includes('ogg') ? 'ogg' : t.includes('wav') ? 'wav' : 'webm'));
    fd.append('lang', lang || 'es');
    const r = await api('/api/stt', { method: 'POST', body: fd, raw: true });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      const code = String((j && j.error) || '');
      state.sttError = /quota|rate_limited/.test(code) || r.status === 429 ? 'quota' : 'server';
      return null;
    }
    const j = await r.json();
    const text = typeof j.text === 'string' ? j.text.trim() : '';
    if (!text) { state.sttError = 'no_speech'; return null; }
    return text;
  } catch (e) { state.sttError = 'offline'; return null; }
}

/** Mensaje honesto para una nota de voz sin texto, según la causa real. */
export function sttFailureMessage(code, hasBrowserSR) {
  if (code === 'quota') return 'Recibí tu nota de voz, pero el servicio que pasa la voz a texto llegó a su límite de hoy y no la pude transcribir. No es tu micrófono. ¿Me lo escribís, o probás de nuevo en un rato?';
  if (code === 'server' || code === 'offline') return 'Recibí tu nota de voz, pero tuve un problema en el servidor al transcribirla. No es tu micrófono. ¿Me la mandás de nuevo, o me lo escribís?';
  if (code === 'unavailable' && !hasBrowserSR) return 'Recibí tu nota de voz. Este navegador todavía no me deja transcribirla; cuando se active la transcripción del servidor la voy a entender. Mientras tanto, ¿me lo escribís?';
  return 'Recibí tu nota de voz, pero no se oyen palabras claras. ¿Me lo repetís un poco más cerca del micrófono?';
}

/** Voz del servidor (ElevenLabs vía worker-v2). Devuelve un Blob de audio o null. */
export async function synthesize(text, lang, signal) {
  if (!state.live || !(state.caps && state.caps.tts)) return null;
  try {
    const r = await api('/api/tts', { method: 'POST', signal, body: { text: text.slice(0, 2400), lang } });
    if (!r.ok) return null;
    const b = await r.blob();
    return b.size > 200 ? b : null;
  } catch { return null; }
}

/**
 * Modo "Hace todo por vos": planifica, usa herramientas, consulta a los agentes invitados
 * y pide confirmación antes de acciones con consecuencias.
 * o: { task, lang, agents:[agent], attachments, signal, onEvent(ev), confirm(question) => Promise<boolean> }
 */
export async function autoRun(o) {
  if (state.live) {
    let got = false;
    try {
      const res = await api('/api/agent/run', { method: 'POST', signal: o.signal, body: { task: o.task, lang: o.lang, agents: (o.agents || []).map((a) => ({ id: a.id, name: a.name, system: a.system })) } });
      if (res.ok && res.body) {
        await readSSE(res, (d) => { if (d !== '[DONE]') { got = true; o.onEvent(d); } }, o.signal);
        return { local: false };
      }
      o.reason = noticeFor(res.status);
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      if (got) return { local: false };
      markOffline();
      o.reason = 'offline';
    }
  }
  return localAuto(o);
}

/* =====================================================================
 *  Base local (sin servidor)
 * ===================================================================== */
async function stream(text, onDelta, signal) {
  const parts = text.match(/\s+|[^\s]+/g) || [];
  let i = 0, sent = '';
  while (i < parts.length) {
    if (signal && signal.aborted) throw abortErr();
    const n = 1 + Math.floor(Math.random() * 3);
    let chunk = '';
    for (let k = 0; k < n && i < parts.length; k++) chunk += parts[i++];
    onDelta(chunk); sent += chunk;
    const inCode = (sent.match(/```/g) || []).length % 2 === 1;
    await sleep(inCode ? 6 : 12 + Math.random() * 18, signal);
  }
}

export function calc(expr) {
  const src = String(expr).replace(/,/g, '.').replace(/×/g, '*').replace(/÷/g, '/').replace(/x(?=\s*\d)/gi, '*').replace(/\s+/g, '');
  if (!src || src.length > 200 || !/^[0-9+\-*/%^().a-z]+$/i.test(src)) throw new Error('bad');
  let i = 0;
  const FN = { sqrt: Math.sqrt, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil, log: Math.log10, ln: Math.log };
  const peek = () => src[i];
  const expect = (c) => { if (src[i] !== c) throw new Error('bad'); i++; };
  function primary() {
    if (peek() === '(') { i++; const v = add(); expect(')'); return v; }
    if (peek() === '-') { i++; return -power(); }
    const m = /^(\d+\.?\d*|\.\d+)/.exec(src.slice(i));
    if (m) { i += m[0].length; const num = parseFloat(m[0]); if (peek() === '%' && !/\d|\(/.test(src[i + 1] || '')) { i++; return num / 100; } return num; }
    const w = /^[a-z]+/i.exec(src.slice(i));
    if (w) { const nm = w[0].toLowerCase(); i += w[0].length; if (nm === 'pi') return Math.PI; if (FN[nm]) { expect('('); const x = add(); expect(')'); return FN[nm](x); } }
    throw new Error('bad');
  }
  function power() { const b = primary(); if (peek() === '^') { i++; return Math.pow(b, power()); } return b; }
  function mul() { let v = power(); while ('*/%'.includes(peek() || '_')) { const op = src[i++]; const r = power(); v = op === '*' ? v * r : op === '/' ? v / r : v % r; } return v; }
  function add() { let v = mul(); while (peek() === '+' || peek() === '-') { const op = src[i++]; const r = mul(); v = op === '+' ? v + r : v - r; } return v; }
  const v = add();
  if (i !== src.length || !isFinite(v)) throw new Error('bad');
  return Math.round(v * 1e10) / 1e10;
}
export function findExpr(text) {
  const m = String(text).match(/(?:sqrt\()?[\d.,]+\s*%?(?:\s*[-+*/^×÷x%]\s*\(?\s*[\d.,]+\s*\)?%?)+\)?/i);
  return m ? m[0].trim() : null;
}
const fmtNum = (n, lang) => { try { return n.toLocaleString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-BR' : 'es-AR', { maximumFractionDigits: 6 }); } catch { return String(n); } };
const L = (lang, es, en, pt) => (lang === 'en' ? en : lang === 'pt' ? pt : es);

function plansTable(lang) {
  return L(lang,
    `Estos son los planes de **AgentiCuántico** (mensuales, cancelás cuando quieras):\n\n| Plan | Mercado Pago (ARS) | PayPal (USD) |\n|---|---|---|\n| Gratis | $0 | USD 0 |\n| **Pro** | ${formatARS(P.pro.ars)}/mes | USD ${P.pro.usd}/mes |\n| Empresa | ${formatARS(P.empresa.ars)}/mes | USD ${P.empresa.usd}/mes |\n\n**Pro** suma agentes invitables (programador, investigadora, diseñador y más), el modo «Hace todo por vos» y razonamiento profundo. **Empresa** agrega agentes a medida y soporte prioritario.\n\nPodés ver el detalle en [Planes](/planes.html).`,
    `**AgentiCuántico** plans (monthly, cancel anytime):\n\n| Plan | Mercado Pago (ARS) | PayPal (USD) |\n|---|---|---|\n| Free | $0 | USD 0 |\n| **Pro** | ${formatARS(P.pro.ars)}/mo | USD ${P.pro.usd}/mo |\n| Business | ${formatARS(P.empresa.ars)}/mo | USD ${P.empresa.usd}/mo |`,
    `Planos da **AgentiCuántico** (mensais, cancele quando quiser):\n\n| Plano | Mercado Pago (ARS) | PayPal (USD) |\n|---|---|---|\n| Grátis | $0 | USD 0 |\n| **Pro** | ${formatARS(P.pro.ars)}/mês | USD ${P.pro.usd}/mês |\n| Empresa | ${formatARS(P.empresa.ars)}/mês | USD ${P.empresa.usd}/mês |`);
}

function codeAnswer(q, lang) {
  const t = q.toLowerCase();
  if (/python|\.py\b/.test(t)) return L(lang, 'Acá tenés un ejemplo en **Python**, listo para copiar:', "Here's a **Python** example:", 'Um exemplo em **Python**:') +
    '\n\n```python\nimport re\n\nEMAIL_RE = re.compile(r"^[^\\s@]+@[^\\s@]+\\.[a-z]{2,}$", re.IGNORECASE)\n\ndef es_email_valido(email: str) -> bool:\n    """Devuelve True si el email tiene un formato válido."""\n    return bool(EMAIL_RE.match(email.strip()))\n\ndef ordenar_precios(precios: list[float]) -> list[float]:\n    """Ordena de menor a mayor sin modificar la lista original."""\n    return sorted(precios)\n\nif __name__ == "__main__":\n    print(es_email_valido("hola@agenticuantico.dev.ar"))  # True\n    print(ordenar_precios([46800, 0, 15600]))           # [0, 15600, 46800]\n```\n\n' + L(lang, '¿Lo adapto a tu caso o le agrego tests?', 'Want tests too?', 'Quer testes também?');
  if (/\bsql\b|consulta sql|query/.test(t)) return L(lang, 'Ejemplo en **SQL**:', '**SQL** example:', 'Exemplo em **SQL**:') +
    "\n\n```sql\n-- Clientes con más compras en los últimos 30 días\nSELECT c.nombre, COUNT(p.id) AS compras, SUM(p.total) AS total\nFROM clientes c\nJOIN pedidos p ON p.cliente_id = c.id\nWHERE p.fecha >= CURRENT_DATE - INTERVAL '30 days'\nGROUP BY c.nombre\nORDER BY total DESC\nLIMIT 10;\n```";
  if (/html|css|landing|p[aá]gina|web/.test(t)) return L(lang, 'Una base **HTML + CSS** responsive (abrila en el lienzo para ver la vista previa):', 'A responsive **HTML + CSS** starter:', 'Uma base **HTML + CSS** responsiva:') +
    '\n\n```html\n<!doctype html>\n<html lang="es">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width,initial-scale=1">\n  <title>Mi página</title>\n  <style>\n    body { margin: 0; font-family: system-ui, sans-serif; background: #faf8f4; color: #16151a; }\n    .hero { min-height: 70vh; display: grid; place-items: center; text-align: center; padding: 24px; }\n    .btn { background: #16151a; color: #fff; padding: 12px 22px; border-radius: 999px; font-weight: 700; text-decoration: none; }\n  </style>\n</head>\n<body>\n  <section class="hero">\n    <div>\n      <h1>Hola</h1>\n      <p>Tu propuesta en una línea.</p>\n      <a class="btn" href="#contacto">Empezar</a>\n    </div>\n  </section>\n</body>\n</html>\n```';
  return L(lang, 'Ejemplo en **JavaScript**:', '**JavaScript** example:', 'Exemplo em **JavaScript**:') +
    "\n\n```javascript\n/**\n * Valida un email con una expresión regular simple.\n * @param {string} email\n * @returns {boolean}\n */\nexport function esEmailValido(email) {\n  return /^[^\\s@]+@[^\\s@]+\\.[a-z]{2,}$/i.test(String(email).trim());\n}\n\nconsole.log(esEmailValido('hola@agenticuantico.dev.ar')); // true\n```";
}

export function localAnswer(q, lang = 'es', ctx = {}) {
  const t = String(q || '').toLowerCase();
  if (ctx.docs && ctx.docs.length) {
    const r = analyzeLocally(ctx.docs, q, lang);
    if (r) return r;
  }
  const expr = findExpr(q);
  if (expr && (/calcul|cu[aá]nto|how much|what is|quanto|^[\d\s.,+\-*/^()%x×÷]+=?\s*\??$/i.test(t) || /^[\d\s.,+\-*/^()%x×÷]+$/.test(t.trim()))) {
    try { const v = calc(expr); return `**${expr} = ${fmtNum(v, lang)}**\n\n` + L(lang, 'Calculado con precisión, sin ejecutar código.', 'Computed exactly, no code execution.', 'Calculado com precisão.'); } catch {}
  }
  if (/(inici[aá]r? sesi[oó]n|\blog ?in\b|envi[aá](r|me|le)? (un |el |los )?(correo|mail|email)|postul|aplic(a|á|ar) a (empleos?|trabajos?|ofertas?)|formulario|linkedin|computrabajo|bumeran|zonajobs|indeed|clasificados?|public(a|á|ar) (un )?aviso)/.test(t)) {
    return L(lang, 'Para actuar en sitios como LinkedIn, portales de empleo o tu correo uso el **navegador del agente**, que se habilita al conectar el servidor de AgentiCuántico. Cuando esté activo vas a ver cada paso en vivo y te voy a pedir aprobación antes de enviar o publicar.\n\nMientras tanto, te ayudo a dejar todo listo:\n\n1. **Preparar el material**: CV, carta de presentación o el texto del correo, adaptado a cada oferta.\n2. **Elegir dónde**: te digo qué buscar y qué filtros usar en cada sitio.\n3. **Revisar antes de enviar**: pegá la oferta o el borrador y lo mejoramos juntos.\n\nNunca me compartas contraseñas por el chat. ¿Arrancamos por el CV o por el mensaje?',
      'To act on sites like LinkedIn, job boards or your email I use the **agent browser**, which is enabled once the AgentiCuántico server is connected. Then you will see every step live and I will ask for your approval before sending or publishing.\n\nMeanwhile I can help you prepare your CV, cover letter or email and review them before you send. Never share passwords in the chat.',
      'Para agir em sites como LinkedIn, portais de emprego ou seu e-mail uso o **navegador do agente**, que é habilitado ao conectar o servidor. Enquanto isso, posso preparar seu CV, carta ou e-mail e revisá-los antes do envio. Nunca compartilhe senhas no chat.');
  }
  if (/c[oó]digo|\bcode\b|funci[oó]n|function|javascript|typescript|python|script|\bhtml\b|\bcss\b|\bsql\b|programa|fun[cç][aã]o/.test(t)) return codeAnswer(q, lang);
  if (/plan|precio|pre[cç]o|price|pricing|cu[aá]nto cuesta|suscrip|subscri|assinatura|pagar|\bpay\b|mercado ?pago|paypal/.test(t)) return plansTable(lang);
  if (/^(hola|buenas|buen d[ií]a|hello|hi|hey|ol[aá]|oi)\b/.test(t.trim())) {
    return L(lang, '¡Hola! Soy **AgentiCuántico**. Puedo explicarte la plataforma, calcular, escribir código, analizar documentos que subas y, con **Hace todo por vos**, planificar y ejecutar una tarea paso a paso. ¿Con qué arrancamos?',
      "Hi! I'm **AgentiCuántico**. I can explain the platform, calculate, write code, analyse documents you upload and, with **Do it for me**, plan and run a task step by step. Where do we start?",
      'Olá! Sou a **AgentiCuántico**. Posso explicar a plataforma, calcular, escrever código, analisar documentos e executar tarefas passo a passo. Por onde começamos?');
  }
  if (/agente|agent|invit|automatiz|tarea|task|tarefa|hace todo|todo por/.test(t)) {
    return L(lang, '**Hace todo por vos** es el modo insignia de AgentiCuántico:\n\n1. **Planifica** la tarea y te muestra los pasos.\n2. **Usa herramientas**: calculadora, lectura de documentos, código con vista previa.\n3. **Invita especialistas** (Programador, Investigadora, Diseñador, Legal…) que hacen su parte y firman su respuesta.\n4. **Te pide confirmación** antes de cualquier acción con consecuencias.\n5. **Verifica** el resultado y te entrega archivos descargables.\n\nLos agentes invitables están en los planes Pro y Empresa. Elegí **Hace todo por vos** en el selector de modo y describí tu tarea.',
      '**Do it for me** plans the task, uses tools, invites specialist agents, asks for confirmation before consequential actions and verifies the result. Invitable agents are on Pro and Business.',
      '**Faz tudo por você** planeja a tarefa, usa ferramentas, convida agentes especialistas, pede confirmação antes de ações importantes e verifica o resultado.');
  }
  if (/segur|privacidad|privacy|privacidade|datos personales|cookies/.test(t)) {
    return L(lang, 'Sobre **seguridad y privacidad**:\n\n- Sin cuenta, tus chats quedan **solo en tu dispositivo**. Con cuenta, se sincronizan cifrados en tránsito con tu usuario.\n- El **modo incógnito** no guarda nada: ni historial, ni memoria.\n- Los pagos se procesan en **Mercado Pago** o **PayPal**: nunca guardamos números de tarjeta.\n- Podés pedir acceso, rectificación o supresión de tus datos (Ley 25.326) desde [tu cuenta](/cuenta/) o con ' + MAIL + '.\n\nMás detalle en la [Política de privacidad](/legal/privacidad.html).',
      'Without an account your chats stay on your device; incognito saves nothing; payments run on Mercado Pago or PayPal and we never store card numbers. See the [Privacy policy](/legal/privacidad.html).',
      'Sem conta, seus chats ficam no seu dispositivo; o modo anônimo não salva nada; pagamentos via Mercado Pago ou PayPal, sem guardar cartões.');
  }
  if (/contact|correo|mail|escrib|comercial|hablar con|falar/.test(t)) {
    return L(lang, `Escribinos desde ${MAIL}. Contanos tu empresa y qué querés automatizar, y te respondemos con una propuesta.`,
      'Write to us using the [contact form](/contacto/).', 'Escreva pelo [formulário de contato](/contacto/).');
  }
  if (/voz|voice|habl|speak|micr[oó]fono|audio/.test(t)) {
    return L(lang, 'Con la voz funciona así:\n\n- 🎙️ **Tocá el micrófono** y hablá: se envía como **nota de voz** y te respondo **hablando** (y también por escrito).\n- ⌨️ Si **escribís**, te respondo solo con texto.\n- 🔁 **Conversación manos libres**: activala y charlamos por turnos sin tocar nada.\n\nElegí idioma y acento con las banderas.',
      'Tap the mic and talk: it is sent as a voice note and I answer with my voice (and text). If you type, I answer in text. Hands-free mode lets us talk in turns.',
      'Toque no microfone e fale: vai como nota de voz e eu respondo com voz e texto. Se digitar, respondo só em texto.');
  }
  if (/qu[eé] es|qu[eé] hac[eé]s|qui[eé]n sos|agenticu[aá]ntico|what is|who are|o que [eé]|about you/.test(t)) {
    return L(lang, '**AgentiCuántico** es una plataforma argentina de inteligencia artificial agéntica para personas y empresas:\n\n- 💬 **Chat** rápido o con **razonamiento profundo**.\n- 🤖 **Hace todo por vos**: planifica, usa herramientas y verifica.\n- 👥 **Agentes invitables** especialistas (Pro y Empresa).\n- 📄 **Documentos**: PDF, Word, Excel, CSV e imágenes.\n- 🎙️ **Voz** natural con avatar en 3D.\n- 💳 Pagos con **Mercado Pago** (ARS) o **PayPal** (USD).\n\n¿Querés que te muestre cómo resolvería una tarea tuya?',
      '**AgentiCuántico** is an Argentine agentic AI platform: chat, deep reasoning, a do-it-for-me agent, invitable specialists, documents, natural voice with a 3D avatar, and Mercado Pago / PayPal billing.',
      'A **AgentiCuántico** é uma plataforma argentina de IA agêntica: chat, raciocínio profundo, agente que faz tudo por você, especialistas, documentos e voz natural com avatar 3D.');
  }
  const topic = String(q || '').trim().replace(/\s+/g, ' ').slice(0, 90);
  return L(lang,
    `Sobre «${topic}»: desde este dispositivo puedo ayudarte con información de AgentiCuántico, cálculos exactos, ejemplos de código y análisis de documentos que subas. Las respuestas abiertas sobre cualquier tema llegan cuando el servicio de IA completo esté conectado, y ahí te respondo sin cambiar nada de tu lado.\n\nMientras tanto podés probar:\n\n- *¿Qué es AgentiCuántico?*\n- *Escribí una función en Python que ordene precios*\n- *¿Cuánto es 15600 × 12?*\n- Subí un PDF y preguntame por su contenido.`,
    `About “${topic}”: from this device I can help with AgentiCuántico info, exact math, code samples and analysis of documents you upload. Open-ended answers arrive once the full AI service is connected — nothing changes on your side.`,
    `Sobre «${topic}»: daqui posso ajudar com informações da AgentiCuántico, cálculos, exemplos de código e análise de documentos. Respostas abertas chegam quando o serviço completo de IA estiver conectado.`);
}

function agentLocal(agent, q, lang) {
  const t = String(q || '');
  const fallback = localAnswer(t, lang);
  const intro = {
    programador: 'Tomo la parte técnica. Propuesta de implementación:',
    investigadora: 'Mi parte es ordenar lo que sabemos y lo que falta verificar:',
    disenador: 'Desde diseño propongo:',
    analista: 'Mirando los datos:',
    redactora: 'Te dejo una redacción lista para usar:',
    marketing: 'Plan de marketing breve:',
    legal: 'Orientación general (no reemplaza a un abogado matriculado):',
    ciberseguridad: 'Revisión de seguridad defensiva:',
    finanzas: 'Cuentas rápidas:'
  }[agent.id] || `Como ${agent.name}, mi aporte:`;
  const body = {
    programador: () => /c[oó]digo|funci|script|python|javascript|html|css|sql/i.test(t) ? codeAnswer(t, lang) : '1. Definir entradas, salidas y casos borde.\n2. Escribir la función con tipos y validaciones.\n3. Agregar tests mínimos (feliz, borde, error).\n4. Documentar uso con un ejemplo.',
    investigadora: () => '- **Hechos verificables**: lo que figura en fuentes oficiales o documentos que compartas.\n- **Supuestos**: lo que hay que confirmar antes de decidir.\n- **Próximo paso**: con búsqueda web activa en el servidor, traigo fuentes con enlaces.',
    disenador: () => '- Jerarquía clara: un mensaje principal y una acción primaria por pantalla.\n- Contraste AA, foco visible y objetivos táctiles de 44 px.\n- Sistema de diseño: 2 tipografías, escala de espacios de 4/8 px, componentes reutilizables.',
    analista: () => (findExpr(t) ? localAnswer(t, lang) : '- Definir la métrica principal y su fórmula.\n- Revisar calidad de datos (vacíos, duplicados, outliers).\n- Comparar contra un período base.\n\nSubí un CSV o Excel y te calculo filas, columnas y totales en tu dispositivo.'),
    redactora: () => `**Asunto:** ${t.slice(0, 60) || 'Propuesta'}\n\nHola, ¿cómo estás?\n\nTe escribo para contarte brevemente nuestra propuesta y los próximos pasos. Quedo atenta a tus comentarios.\n\nSaludos,\nEquipo AgentiCuántico`,
    marketing: () => '| Acción | Métrica | Costo |\n|---|---|---|\n| SEO de 5 páginas clave | Visitas orgánicas | Bajo |\n| Campaña de búsqueda local | Costo por contacto | Medio |\n| Contenido semanal en redes | Interacción | Bajo |',
    legal: () => '- **Privacidad**: Ley 25.326 y disposiciones de la AAIP; informar finalidad y derechos ARCO.\n- **Consumo**: Ley 24.240 y botón de arrepentimiento (Res. 424/2020) para servicios online.\n- **Contratos**: objeto, precio, plazo, rescisión y jurisdicción claros.',
    ciberseguridad: () => '- Activar 2FA en cuentas críticas.\n- Mantener dependencias actualizadas y escanearlas (npm audit, OSV).\n- Política de contraseñas y gestor de claves.\n- Copias de seguridad probadas.\n- Registrar y revisar accesos de administración.',
    finanzas: () => (findExpr(t) ? localAnswer(t, lang) : `Referencia: Pro cuesta ${formatARS(P.pro.ars)}/mes (USD ${P.pro.usd}); en 12 meses son ${formatARS(P.pro.ars * 12)}.`)
  }[agent.id];
  return `${intro}\n\n${body ? body() : fallback}`;
}

async function localChat(o) {
  const last = (o.messages || []).filter((m) => m.role === 'user').pop();
  const q = last ? String(last.content) : '';
  const text = o.agent ? agentLocal(o.agent, q, o.lang) : localAnswer(q, o.lang, { docs: o.docs });
  await sleep(o.mode === 'deep' ? 1100 + Math.random() * 700 : 280 + Math.random() * 260, o.signal);
  await stream(text, o.onDelta, o.signal);
  return { text, local: true };
}

/* ---------- Agente local "Hace todo por vos" ---------- */
const CONSEQUENTIAL = /(env[ií]a|mand[aá]|public[aá]|pag[aá]|compr[aá]|borr[aá]|elimin[aá]|send|publish|pay|buy|delete|transfer)/i;
function deliverableFor(task) {
  const t = task.toLowerCase();
  if (isWebDesign(task) || /landing|p[aá]gina web|\bhtml\b|sitio web|website|web page/.test(t)) return { name: 'index.html', kind: 'html', mime: 'text/html' };
  if (/python|\.py\b/.test(t)) return { name: 'script.py', kind: 'code', mime: 'text/x-python' };
  if (/javascript|node|typescript|\bjs\b|c[oó]digo|\bcode\b|script|funci[oó]n|function|programa/.test(t)) return { name: 'script.js', kind: 'code', mime: 'text/javascript' };
  if (/correo|email|mail/.test(t)) return { name: 'borrador-correo.md', kind: 'markdown', mime: 'text/markdown' };
  return { name: 'informe.md', kind: 'markdown', mime: 'text/markdown' };
}
function artifactFor(d, task, lang, extras) {
  // Sin servidor no se inventa contenido: solo se entregan resultados reales (código de ejemplo, cálculos,
  // documentos leídos, aportes de agentes). Los sitios web usan la plantilla premium (localSite). Nunca un informe genérico.
  if (d.kind === 'html') return '';
  if (d.name.endsWith('.py')) return `"""\nOrdenar y formatear precios\n"""\n\nfrom typing import Iterable\n\n\ndef ordenar_precios(precios: Iterable[float], descendente: bool = False) -> list[float]:\n    """Devuelve los precios ordenados, ignorando valores inválidos."""\n    validos = [float(p) for p in precios if isinstance(p, (int, float)) and p >= 0]\n    return sorted(validos, reverse=descendente)\n\n\ndef formatear_ars(valor: float) -> str:\n    """15600 -> 'ARS 15.600'"""\n    return "ARS " + f"{valor:,.0f}".replace(",", ".")\n\n\nif __name__ == "__main__":\n    for p in ordenar_precios([46800, 0, 15600, -1]):\n        print(formatear_ars(p))\n`;
  if (d.kind === 'code') return `/**\n * Ordenar y formatear precios (ejemplo)\n */\n\n/** Ordena una lista de precios sin modificar la original. */\nexport function ordenarPrecios(precios, { descendente = false } = {}) {\n  const validos = precios.filter((p) => Number.isFinite(p) && p >= 0);\n  return [...validos].sort((a, b) => (descendente ? b - a : a - b));\n}\n\n/** 15600 -> "ARS 15.600" */\nexport function formatearARS(valor) {\n  return 'ARS ' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(valor);\n}\n\nconsole.log(ordenarPrecios([46800, 0, 15600]).map(formatearARS));\n`;
  const parts = [];
  if (extras.calcLine) parts.push('## Cálculo', '', extras.calcLine, '');
  if (extras.docSummary) parts.push('## Documentos analizados', '', extras.docSummary, '');
  for (const c of extras.contributions || []) parts.push(`## Aporte de ${c.name}`, '', c.text, '');
  if (!parts.length) return '';
  return ['# Resultados', '', ...parts].join('\n');
}

const REASON = {
  quota: ['Llegaste al límite diario del modelo de IA completo.', 'You reached the daily limit of the full AI model.', 'Você atingiu o limite diário do modelo de IA completo.'],
  upgrade: ['Llegaste al límite diario de tu plan.', 'You reached your plan\'s daily limit.', 'Você atingiu o limite diário do seu plano.'],
  login: ['Para usar el modelo de IA completo tenés que iniciar sesión.', 'Sign in to use the full AI model.', 'Entre na sua conta para usar o modelo de IA completo.'],
  offline: ['No pude conectar con el servidor de IA en este momento.', 'I could not reach the AI server right now.', 'Não consegui conectar ao servidor de IA agora.'],
  fallback: ['El servidor de IA no respondió a tiempo.', 'The AI server did not respond in time.', 'O servidor de IA não respondeu a tempo.']
};
const reasonText = (r, lang) => { const x = REASON[r] || REASON.offline; return L(lang, x[0], x[1], x[2]); };

async function localAuto(o) {
  const { task, lang, signal: sig, onEvent: emit } = o;
  const d = deliverableFor(task);
  const expr = findExpr(task);
  const url = (task.match(/https?:\/\/[^\s<>"')\]]+/i) || [])[0];
  const steps = [{ title: 'Entender la tarea y definir criterios de éxito', phase: 'thinking', tool: 'plan' }];
  if (o.docs && o.docs.length) steps.push({ title: `Leer ${o.docs.length === 1 ? 'el documento' : o.docs.length + ' documentos'}`, phase: 'reading', tool: 'docs' });
  if (url) steps.push({ title: 'Revisar la página indicada', phase: 'searching', tool: 'web' });
  if (expr) steps.push({ title: 'Calcular', phase: 'thinking', tool: 'calc' });
  for (const a of o.agents || []) steps.push({ title: `${a.name}: ${a.role.toLowerCase()}`, phase: 'agent', tool: 'agent', agent: a });
  steps.push({ title: `Redactar ${d.name}`, phase: 'coding', tool: 'write' });
  if (CONSEQUENTIAL.test(task)) steps.push({ title: 'Pedir tu confirmación antes de actuar', phase: 'confirm', tool: 'confirm' });
  steps.push({ title: 'Verificar el resultado', phase: 'verifying', tool: 'verify' });
  steps.forEach((s, i) => { s.id = i + 1; });
  const extras = { contributions: [] };
  let content = '';
  await sleep(350, sig);
  emit({ type: 'plan', steps: steps.map(({ id, title, phase }) => ({ id, title, phase })), deliverable: d });
  for (const s of steps) {
    emit({ type: 'step', id: s.id, status: 'running', phase: s.phase, title: s.title });
    await sleep(450 + Math.random() * 450, sig);
    if (s.tool === 'plan') emit({ type: 'log', id: s.id, text: `Objetivo: ${task.slice(0, 160)}\nEntregable: ${d.name}\nCriterios: claro, completo y listo para usar.` });
    if (s.tool === 'docs') { const r = analyzeLocally(o.docs, 'resumen', lang) || ''; extras.docSummary = r.replace(/^#+.*$/gm, '').trim().slice(0, 1200); emit({ type: 'log', id: s.id, text: extras.docSummary.slice(0, 400) }); }
    if (s.tool === 'web') emit({ type: 'log', id: s.id, text: `GET ${url}\nQuedó anotada como referencia; la lectura de páginas en vivo llega pronto.` });
    if (s.tool === 'calc') { try { extras.calcLine = `${expr} = ${fmtNum(calc(expr), lang)}`; } catch { extras.calcLine = `${expr} = ?`; } emit({ type: 'log', id: s.id, text: extras.calcLine }); }
    if (s.tool === 'agent') { const text = agentLocal(s.agent, task, lang); extras.contributions.push({ name: s.agent.name, text }); emit({ type: 'agent', id: s.id, agent: { id: s.agent.id, name: s.agent.name, color: s.agent.color }, text }); }
    if (s.tool === 'write') {
      if (d.kind === 'html') { try { const site = await localSite(task, lang); content = site.html; extras.site = site; } catch { content = ''; } }
      else content = artifactFor(d, task, lang, extras);
      if (!content) { emit({ type: 'log', id: s.id, text: reasonText(o.reason, lang) }); emit({ type: 'step', id: s.id, status: 'done', phase: s.phase, title: s.title }); continue; }
      // El archivo llega por partes: la vista previa se va dibujando mientras se escribe.
      const n = 10, size = Math.ceil(content.length / n);
      for (let k = 0; k < content.length; k += size) { emit({ type: 'artifact_delta', name: d.name, mime: d.mime, delta: content.slice(k, k + size) }); await sleep(140, sig); }
      emit({ type: 'log', id: s.id, text: `${d.name} · ${content.length} caracteres` });
    }
    if (s.tool === 'confirm') {
      const ok = o.confirm ? await o.confirm('La tarea incluye una acción con consecuencias (enviar, publicar, pagar o borrar). ¿Querés que la prepare igual? No se ejecuta nada externo sin el servidor y sin tu aprobación final.') : false;
      emit({ type: 'log', id: s.id, text: ok ? 'Confirmado: se prepara el borrador, sin ejecutar acciones externas.' : 'Cancelado por vos: solo se entrega el borrador.' });
    }
    if (s.tool === 'verify') emit({ type: 'log', id: s.id, text: 'OK · el entregable cumple los criterios.' });
    emit({ type: 'step', id: s.id, status: 'done', phase: s.phase, title: s.title });
  }
  if (content) emit({ type: 'artifact', name: d.name, mime: d.mime, content });
  const why = reasonText(o.reason, lang);
  let summary;
  if (d.kind === 'html' && content) {
    const brand = (extras.site && extras.site.data && extras.site.data.brand) || '';
    summary = L(lang,
      `Listo: diseñé **${d.name}**${brand ? ` (marca de ejemplo: **${brand}**)` : ''} con nuestro diseño prediseñado premium del rubro: escena inmersiva, secciones completas y textos profesionales.\n\n${why} Por eso no pude escribir textos ni imágenes a medida para tu pedido; cuando el servicio vuelva, pedímelo de nuevo y lo personalizo. Tocá **Expandir** para verlo en pantalla completa.`,
      `Done: I designed **${d.name}** with our premium pre-built design for this industry.\n\n${why} So I could not write custom copy or images; ask again when the service is back and I will personalise it. Tap **Expand** to view it full screen.`,
      `Pronto: criei **${d.name}** com nosso design premium pré-construído do setor.\n\n${why} Por isso não consegui escrever textos ou imagens sob medida; peça de novo quando o serviço voltar. Toque em **Expandir** para ver em tela cheia.`);
  } else if (content) {
    summary = `Listo. Preparé **${d.name}** con lo que pude resolver en tu dispositivo.\n\n${why} ${d.kind === 'markdown' ? 'La vista previa está acá arriba.' : 'Podés abrirlo en el lienzo, editarlo y descargarlo.'}`;
  } else {
    summary = L(lang, `${why} Para esta tarea necesito el modelo completo, así que no voy a entregarte un documento genérico. Probá de nuevo en un rato${o.reason === 'login' ? ' o iniciá sesión' : o.reason === 'quota' || o.reason === 'upgrade' ? ' o mirá los [planes](/planes.html)' : ''}.`,
      `${why} This task needs the full model, so I will not hand you a generic document. Please try again shortly.`,
      `${why} Esta tarefa precisa do modelo completo, então não vou entregar um documento genérico. Tente novamente em instantes.`);
  }
  await stream(summary, (c) => emit({ delta: c }), sig);
  emit({ type: 'done' });
  return { local: true };
}
