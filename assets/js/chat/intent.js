/**
 * Ruteo de pedidos del chat (sin DOM, se prueba con vitest desde AgenticDev).
 *  - «browser»: la computadora del agente (acciones reales en sitios: iniciar sesión, enviar, postular, formularios,
 *    abrir/navegar una página puntual, capturas, PDF o tabla de una página).
 *  - «search»: búsqueda web en vivo del chat (preguntar y leer fuentes). Mucho más rápida y sin minutos de navegador.
 *  - null: chat normal (el servidor igual decide si hace falta buscar).
 * En modo Rápido y Profundo, «Buscá en la web: …», «averiguá…», «investigá…», «con fuentes» y parecidos van a la
 * búsqueda en vivo. En modo Agente (auto) se mantiene la computadora para investigar.
 * Nota: «\b» de JS no sirve después de «á» (no es letra ASCII); por eso se usa (?![\wáéíóúñ]).
 */

/** Acciones que solo puede hacer un navegador real (en cualquier modo). */
export const BROWSER_ACTION = /(inici[aá]r? sesi[oó]n|\blog ?in\b|ingres[aá]r? a mi cuenta|envi[aá](r|me|le)? (un |el |los )?(correo|mail|email|e-mail)s?|postul(a|á|ar|ame|arme)(?![\wáéíóúñ])|aplic(a|á|ar) a (empleos?|trabajos?|ofertas?|puestos?)|complet(a|á|ar) (el |un |los )?formularios?|linkedin|computrabajo|bumeran|zonajobs|indeed|mercado ?libre|clasificados?|public(a|á|ar) (un )?aviso|naveg(a|á|ar) (por|en)|entr(a|á|ar) (a|en) (la )?(web|p[aá]gina|sitio)|abr(í|i|ir) (la )?(web|p[aá]gina|sitio)|computadora del agente|extra(e|é|er) (la |una )?tabla|(en|a) csv\b|captura de (la )?(p[aá]gina|pantalla)|pdf de (la )?p[aá]gina)/i;

/** Investigar o buscar información: en Rápido/Profundo va a la búsqueda en vivo; en Agente, a la computadora. */
export const RESEARCH = /(busc(a|á|ar) en (google|la web|internet)|busc(a|á)(me)? (la |el |los |las |info|informaci[oó]n|datos|precios?|noticias|ofertas)|wikipedia|investig(a|á|ar|ame)(?![\wáéíóúñ])|averigu(a|á|ar|ame)(?![\wáéíóúñ])|compar(a|á)(me)? (precios|ofertas|fuentes|productos)|resum(i|í)(me)? (las )?fuentes|con fuentes|fuentes y (links|enlaces)|\bresearch\b|look up|search the web|pesquis(a|ar|e)(?![\wáéíóúñ]))/i;

/** Pedido explícito de búsqueda en vivo al comienzo («Buscá en la web: …», «Search the web: …», «Pesquise na web: …»). */
export const EXPLICIT_SEARCH = /^\s*(busc[aá](me)?|busca(me)?|googlea(me)?|googl[eé][aá]|search( the web| online)?|look up|pesquis[ae]|procur[ae])\s*(en|na|no|on|in)?\s*(la |a |o )?(web|internet|google|línea|linea)?\s*[:,-]/i;

const FOLLOW = /^\s*(segu[ií]|continu[aá]|dale|sigue|retom[aá]|ahora (compar[aá]|busc[aá]|hac[eé]|arm[aá]|export[aá]|guard[aá]|pas[aá]|resum[ií]|agreg[aá])|tambi[eé]n (busc[aá]|compar[aá]|agreg[aá])|export[aá](lo)? a|pas[aá](lo)? a (csv|tabla|pdf))/i;

/** Lo mismo que antes hacía needsWebAction (acción o investigación): se mantiene para el modo Agente. */
export function needsWebAction(text) { const t = String(text || ''); return BROWSER_ACTION.test(t) || RESEARCH.test(t); }
export function isFollowUp(text) { return FOLLOW.test(String(text || '')); }

/**
 * @param {string} text
 * @param {'fast'|'deep'|'auto'|string} mode
 * @returns {'browser'|'search'|null}
 */
export function routeWebIntent(text, mode) {
  const t = String(text || '').trim();
  if (!t) return null;
  // Fase 6: pedidos sobre el propio sistema/código o «no me pidas conectar» no abren la computadora del agente
  // por nombrar un sitio («arreglá la conexión con LinkedIn»). El chat (o el modo desarrollador) los responde.
  const si = classifyServiceIntent(t);
  if (si.dev || si.optOut || (si.kind === 'system' && si.mentioned.length)) return null;
  if (mode === 'auto') return needsWebAction(t) ? 'browser' : null;
  // Rápido / Profundo: un pedido explícito de búsqueda manda, aunque nombre un sitio («Buscá en la web: ofertas en LinkedIn»).
  if (EXPLICIT_SEARCH.test(t)) return 'search';
  if (BROWSER_ACTION.test(t)) return 'browser';
  if (RESEARCH.test(t)) return 'search';
  return null;
}

/* ============================================================================================================
 * Fase 6 · ¿El pedido necesita ACTUAR sobre una cuenta, o solo nombra un servicio? (espejo exacto de
 * worker-v2/src/intent/service.ts; un test compara los dos). Nombrar LinkedIn/Gmail/GitHub en un pedido sobre el
 * propio sistema, el código o un error NO pide conectar; «no me pidas conectar» se respeta en toda la conversación.
 * ========================================================================================================== */
/** Cómo se nombra cada servicio (es/en/pt). Mencionarlo NO alcanza para pedir conexión. */
export const SERVICE_NAMES = [
  ['gcalendar', /(google calendar|calendario|agenda(?![\wáéíóúñ])|calendar(?![\wáéíóúñ]))/i],
  ['gcloud', /(google cloud|\bgcp\b|cloud console)/i],
  ['gdrive', /(\bdrive\b|google docs?)/i],
  ['google', /(\bgmail\b|\be-?mails?\b|\bmails?\b|\bcorreos?\b|\bbandeja\b|\binbox\b|\be-mails?\b)/i],
  ['github', /(\bgithub\b|\brepos?\b|\brepositorios?\b|\bissues?\b|\bcommits?\b|pull request)/i],
  ['linkedin', /\blinked ?in\b/i],
  ['cloudflare', /(\bcloudflare\b|\bworkers?\b(?!\s+(remotos?|de\s)))/i]
];

const V = '(?:le[eé]|leer|leeme|revis[aá]|mir[aá]|list[aá]|listar|mostr[aá]|mostrame|abr[ií]|public[aá]|publicar|poste[aá]|compart[ií]|mand[aá]|mandale|mandame|envi[aá]|enviar|respond[eé]|cre[aá]|crear|agend[aá]|agendame|agendar|guard[aá]|guardalo|guardala|sub[ií]|borr[aá]|activ[aá]|commite[aá]|chequea|cheque[aá]|fijate en|consult[aá]|read|list|show|check|post|send|create|save|upload|leia|liste|mostre|publique|envie|crie|salve)';
/** Verbo de acción hasta 45 caracteres antes del servicio, en la misma oración. */
const VERB_BEFORE = new RegExp(`(^|[^\\wáéíóúñ])${V}(?![\\wáéíóúñ])[^.?!\\n]{0,45}$`, 'i');
/** Posesivo pegado al servicio: «mi LinkedIn», «mis correos», «mi perfil de LinkedIn», «my inbox», «meu Gmail». */
const POSSESSIVE_BEFORE = /(^|[^\wáéíóúñ])(mi|mis|tu cuenta de|my|meu|minha|meus|minhas)\s+([\wáéíóúñ]+\s+){0,3}$/i;
/** «conectá (mi) LinkedIn», «connect my GitHub»: pedido explícito de conexión. */
const CONNECT_BEFORE = /(conect[aá]\w*|vincul[aá]\w*|connect|conecte)\s+(mi |mis |a |con |my |o |a minha |meu )?$/i;
/** «¿qué Workers tengo?» */
const HAVE_AFTER = /^[^.?!\n]{0,25}(?<![\wáéíóúñ])(tengo|ten[eé]s|tenho|do i have)(?![\wáéíóúñ])/i;
/** «agendame…», «agendá…» (sin nombrar el calendario). */
const IMPLICIT = [['gcalendar', /(^|[^\wáéíóúñ])agend[aá](me|r|lo|la)?(?![\wáéíóúñ])/i]];

/** Pedido sobre el propio sistema, el código o un error (es/en/pt). */
export const SYSTEM_REQUEST = new RegExp([
  'auto-?corr[ei]g\\w*', 'auto-?correc\\w*', 'automotric\\w*\\s+(tus|sus)', 'self-?(correct|fix|heal)\\w*',
  '(tus|sus|los|el|este|ese|mis|propios?)\\s+(propios?\\s+)?(errores|error|bugs?|fallas?|fallos?)(?![\\wáéíóúñ])',
  '\\bbugs?\\b', 'arregl[aáe]\\w*', 'correg[ií]\\w*', 'corrij\\w*', 'conserte\\w*', 'depur[aá]\\w*', '\\bdebug\\w*', '\\bfix(es|ed)?\\b',
  'refactor\\w*', '(el|tu|este|del)\\s+c[oó]digo', '(the|your)\\s+code',
  '(no|todav[ií]a no|a[uú]n no|not|isn.t)\\s+(est[aá]\\s+|is\\s+|est[aá] )?(configurad[ao]|configured|configurad)',
  'n[aã]o est[aá] configurad', 'no funciona', "(doesn.t|does not|isn.t) work", 'not working',
  '(hac[eé]|haz|hace|hagas|fa[cç]a)\\s+que\\s+(empiece\\s+a\\s+|vuelva\\s+a\\s+|comece\\s+a\\s+)?funcion', 'make it work',
  'mejor[aá]\\w*\\s+(el|tu|la|los|las|este|esta|tus)\\s+(propi[oa]s?\\s+)?(sistema|chat|c[oó]digo|sitio|app|agente|prompt|cerebro|conector|conexi[oó]n|integraci[oó]n|worker|respuestas?)',
  'tu\\s+(propio\\s+)?(sistema|c[oó]digo|cerebro|prompt)', '\\bconector(es)?\\b', 'integraci[oó]n', 'la conexi[oó]n (con|de|a)', '\\bdeploy\\w*', 'despleg[aá]\\w*',
  'modo desarrollador', 'pull request'
].join('|'), 'i');

/** «No me pidas / pases / mandes a conectar», «sin conectar», «don't ask me to connect». */
export const OPT_OUT_CONNECT = /(no\s+me\s+(pidas|pases|mandes|mand[eé]s|hagas|derives|lleves|ofrezcas|muestres)\s+[^.?!\n]{0,25}conect|sin\s+(pedirme\s+)?(que\s+)?conect|no\s+(quiero|necesito|voy a)\s+conect|(don.t|do not)\s+(ask|make)\s+me\s+(to\s+)?connect|without connecting|n[aã]o\s+me\s+(pe[cç]a|mande)\s+[^.?!\n]{0,20}conect)/i;

const stripUrls = (t) => String(t || '').replace(/\bhttps?:\/\/\S+/gi, ' ');

/** Servicios cuya CUENTA hay que usar para este pedido (no basta con nombrarlos). */
export function accountServices(text) {
  const t = stripUrls(text);
  const out = new Set();
  for (const [id, re] of SERVICE_NAMES) {
    const g = new RegExp(re.source, 'gi');
    let m;
    while ((m = g.exec(t))) {
      const before = t.slice(Math.max(0, m.index - 60), m.index);
      const after = t.slice(m.index + m[0].length, m.index + m[0].length + 40);
      if (VERB_BEFORE.test(before) || POSSESSIVE_BEFORE.test(before) || CONNECT_BEFORE.test(before) || HAVE_AFTER.test(after)) { out.add(id); break; }
      if (m[0].length === 0) g.lastIndex++;
    }
  }
  for (const [id, re] of IMPLICIT) if (re.test(t)) out.add(id);
  return [...out];
}

export function mentionedServices(text) {
  const t = stripUrls(text);
  return SERVICE_NAMES.filter(([, re]) => re.test(t)).map(([id]) => id);
}

export const isSystemRequest = (text) => SYSTEM_REQUEST.test(stripUrls(text));
export const optsOutOfConnect = (text) => OPT_OUT_CONNECT.test(String(text || ''));


/** Modo desarrollador (solo dueño): pedido de arreglar o mejorar EL PROPIO sistema (objeto + verbo). */
export const DEV_TARGET = /((tus|sus)\s+(propi[oa]s\s+)?(errores|error|fallas?|fallos?|bugs?|c[oó]digo|sistema|respuestas|prompt|cerebro)|(el|este|tu|del|al|en el)\s+(sistema|chat|c[oó]digo|sitio|worker|agente|cerebro|prompt|conector|router|backend|frontend)(?![\wáéíóúñ])|agenticu[aá]ntico|\bconector(es)?\b|la conexi[oó]n (con|de|a)|integraci[oó]n|(no|todav[ií]a no|a[uú]n no)\s+est[aá]\s+configurad|la tarjeta|el bot[oó]n|\b(intent|chat|tool-cards|runner|registry|agents)\.(js|ts)\b|worker-v2|agenticdev|agenticweb|your (own )?(code|system|errors|bugs)|seu (pr[oó]prio )?(c[oó]digo|sistema))/i;
export const DEV_VERB = /(auto-?corr\w*|automotric\w*|arregl\w*|correg\w*|corrij\w*|mejor[aá]\w*|program[aá](r|lo|la)?(?![\wáéíóúñ])|implement[aá]\w*|solucion[aá]\w*|(hac[eé]|haz|hace)\s+que\s+(empiece\s+a\s+|vuelva\s+a\s+)?funcion|\bfix\w*|\bdebug\w*|depur[aá]\w*|refactor\w*|modific[aá]\w*|cambi[aá]\s+el\s+c[oó]digo|abr[ií]\s+(un|una)\s+(pr(?![\wáéíóúñ])|pull request)|propon[eé]\s+un\s+cambio|make it work|improve|corrija|conserte|melhore)/i;
export const isDevRequest = (text) => { const t = stripUrls(text); return DEV_TARGET.test(t) && DEV_VERB.test(t); };

/**
 * @param text   último pedido
 * @param earlier pedidos anteriores de la persona en esta conversación (para respetar «no me pidas conectar»)
 */
export function classifyServiceIntent(text, earlier = []) {
  const optOut = optsOutOfConnect(text) || earlier.slice(-6).some(optsOutOfConnect);
  const mentioned = mentionedServices(text);
  const acting = accountServices(text);
  const dev = isDevRequest(text);
  const system = dev || isSystemRequest(text);
  // «No me pidas conectar»: nunca se ofrece conectar, pero las cuentas YA conectadas se pueden usar si la tarea lo pide.
  if (optOut) {
    if (dev || (system && !acting.length)) return { kind: 'system', services: [], mentioned, optOut, dev };
    return { kind: acting.length ? 'account' : 'chat', services: acting, mentioned, optOut, dev };
  }
  // Arreglar/mejorar el propio sistema: nombrar LinkedIn, GitHub o Gmail no pide conectar. Única excepción:
  // «creá un issue en mi repo sobre el error» (actúa sobre la cuenta de GitHub).
  if (dev) {
    const issue = acting.includes('github') && /(cre[aá]|abr[ií]|open|create)\w*\s+(un |an? )?issue/i.test(text);
    return issue ? { kind: 'account', services: ['github'], mentioned, optOut, dev: false } : { kind: 'system', services: [], mentioned, optOut, dev };
  }
  if (acting.length) return { kind: 'account', services: acting, mentioned, optOut, dev };
  return { kind: system ? 'system' : 'chat', services: [], mentioned, optOut, dev };
}

/**
 * ¿El pedido es para las herramientas con cuentas (correo, GitHub, Cloudflare, LinkedIn, calendario, Drive) o de empleo?
 * Fase 6: nombrar un servicio no alcanza; tiene que actuar sobre la cuenta («leé mis correos», «publicá en mi
 * LinkedIn»). Pedidos sobre el propio sistema o el código, y «no me pidas conectar», no van acá.
 * @param {string} text
 * @param {string[]} [earlier] pedidos anteriores de la persona en esta conversación
 */
export function wantsTools(text, earlier = []) {
  // Las direcciones web no cuentan («…workers.dev/…» no es un pedido sobre Cloudflare Workers).
  const t = String(text || '').replace(/\bhttps?:\/\/\S+/gi, ' ');
  const si = classifyServiceIntent(t, earlier);
  if (si.kind === 'account') return true;
  if (si.kind === 'system') return false;
  return /((busc|encontr)\S*\s[^.?!]{0,40}(trabajo|empleo|ofertas?|vacantes?|laburo)|ofertas? de (trabajo|empleo)|\bpostul)/i.test(t);
}
