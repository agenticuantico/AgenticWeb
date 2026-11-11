/**
 * Un solo chat, sin selector de modos: decide por mensaje cómo responder (sin DOM, se prueba con vitest).
 *
 *  - «fast»    respuesta rápida (preguntas simples, charla, cuentas cortas).
 *  - «think»   razonamiento a fondo (por qué, compara, paso a paso, código, problemas con varios datos, textos largos).
 *  - «search»  búsqueda web en vivo con fuentes (consultas: «Busca en la web: …», precios, clima, noticias, «hoy»).
 *  - «browser» computadora del agente (acciones en sitios: iniciar sesión, postular, formularios, abrir una página).
 *  - «agent»   el agente arma un entregable (sitio, landing, informe, planilla, presentación, documento, CV…).
 *  - «tools» y «media» los decide quien llama (cuentas conectadas, imágenes y videos).
 *
 * Ajuste manual opcional (escondido en «Ajustes de respuesta», apagado por defecto):
 *  'smart' (automático) | 'fast' | 'deep' | 'auto' (agente). Con un modo fijo se respeta el comportamiento anterior.
 */
import { EXPLICIT_SEARCH, BROWSER_ACTION, RESEARCH, routeWebIntent, needsWebAction, wantsComputer } from './intent.js?v=7.23.0';
import { isIterateOrder } from './iterate.js?v=7.23.0';

const W = '(?![\\wáéíóúñ])';

/** Consultas de datos que cambian (van a la búsqueda en vivo aunque no digan «busca»). */
export const LOOKUP = new RegExp([
  `(cotizaci[oó]n|precio|valor) (del?|de la) (d[oó]lar|euro|real|bitcoin|btc|nafta|acci[oó]n)`,
  `d[oó]lar (blue|oficial|mep|hoy|tarjeta|cripto)`,
  `\\bclima\\b|pron[oó]stico (del tiempo|extendido)|va a llover`,
  `noticias|[uú]ltimas novedades|qu[eé] pas[oó] (con|en|hoy|ayer)`,
  `qui[eé]n gan[oó]|resultado del partido|c[oó]mo (sali[oó]|va) (river|boca|el partido)`,
  `horario de (atenci[oó]n|apertura)|est[aá] abierto`,
  `pr[oó]ximo feriado|feriados? de (este|20\\d\\d)`
].join('|'), 'i');

/** Entregables que arma el agente (verbo de hacer + tipo de entregable). */
const MAKE = `(arm[aá]|arma|cre[aá]|crea|hac[eé]|hazme|hac[eé]me|dise[nñ][aá]|genera|gener[aá]|constru[ií]|desarroll[aá]|prepar[aá]|redact[aá]|escrib[ií]|program[aá]|make|build|create|design|write|crie|fa[cç]a|monte)(me|nos)?${W}`;
const DELIVERABLE = `(landing|p[aá]gina web|p[aá]gina|sitio( web)?|web ?site|\\bweb\\b|tienda online|e-?commerce|app|aplicaci[oó]n|juego|dashboard|panel|informe|reporte|report|documento|planilla|excel|hoja de c[aá]lculo|presentaci[oó]n|diapositivas|slides|cv|curr[ií]culum|plan de negocios|business plan|propuesta comercial|contrato|manual|ebook|newsletter|campa[nñ]a|calendario de contenidos|proyecto)`;
export const AGENT_BUILD = new RegExp(`${MAKE}.{0,60}?${DELIVERABLE}`, 'i');

/** Pedidos que piden razonar (no buscar): explicar, comparar, planificar, resolver, programar. */
export const THINK = new RegExp([
  `por ?qu[eé]${W}`, `\\bexplic[aá](me)?${W}`, `analiz[aá](me)?${W}`, `compar[aá](me)?${W}`, `paso a paso`,
  `demostr[aá]`, `resolv[eé]`, `razon[aá]`, `pros y contras`, `ventajas y desventajas`, `diferencias? entre`,
  `estrategia`, `plan de`, `\\bdeber[ií]a\\b`, `qu[eé] me conviene`, `convien[e]`, `optimiz[aá]`,
  `\\b(funci[oó]n|c[oó]digo|script|algoritmo|bug|error|excepci[oó]n|consulta sql|regex|typescript|javascript|python)\\b`,
  `\\bwhy\\b`, `\\bexplain\\b`, `step by step`, `\\bcompare\\b`, `\\bpor que\\b`, `explique`
].join('|'), 'i');

/** «¿Cuánto es 15600 × 12?» y parecidos: cuenta corta, respuesta rápida. */
const SHORT_MATH = /^[¿\s]*(cu[aá]nto (es|da)|calcul[aá]|how much is)?[\s\d.,+\-*/×x÷%()^=?¿]{3,40}\??\s*$/i;

/** Nombrar un sitio no alcanza para abrir la computadora: hace falta un verbo de acción sobre él. */
const SITE_NAME = /^(linkedin|computrabajo|bumeran|zonajobs|indeed|mercado ?libre|clasificados?)$/i;
const ACT_VERB = /(entr[aá]|abr[ií]|naveg[aá]|postul|aplic[aá]|public[aá]|busc[aá](me)?|encontr[aá](me)?|revis[aá]|mir[aá]|compr[aá]|vend[eé]|carg[aá]|sub[ií]|envi[aá]|mand[aá]|contest[aá]|respond[eé]|actualiz[aá])/i;
/** «Entra a ejemplo.com.ar…», «abre https://…»: ir a un sitio puntual es trabajo de la computadora. */
const GO_SITE = /(entr[aá]|abr[ií]|naveg[aá]|visit[aá]|and[aá]|ingres[aá]|metete|open|go to|abra|acesse)(r)?\s+(a|en|al|to|o)?\s*(\bhttps?:\/\/\S+|\b([a-z0-9-]+\.)+(com|ar|net|org|io|dev|es|mx|co|br|gob|edu)\b)/i;
export function isBrowserAction(text) {
  const t = String(text || '');
  if (GO_SITE.test(t)) return true;
  const m = BROWSER_ACTION.exec(t);
  if (!m) return false;
  return SITE_NAME.test(m[0].trim()) ? ACT_VERB.test(t) : true;
}

/** Seguimiento corto de una tarea del agente («sigue», «ahora compara…»). */
const FOLLOW = /^\s*(segu[ií]|continu[aá]|dale|sigue|retom[aá]|ahora (compar[aá]|busc[aá]|hac[eé]|arm[aá]|export[aá]|guard[aá]|pas[aá]|resum[ií]|agreg[aá])|tambi[eé]n (busc[aá]|compar[aá]|agreg[aá])|export[aá](lo)? a|pas[aá](lo)? a (csv|tabla|pdf))/i;

/** Confirmación corta de una acción que quedó pendiente («está todo en el CV, puedes hacerlo», «dale», «hazlo»). */
export const CONFIRM = /^\s*(s[ií]|dale|ok|okey|hacelo|hazlo|hac[eé]lo vos|pod[eé]s hacerlo|segu[ií]|adelante|av[aá]nz[aá]|confirmo|de una|go ahead|do it|yes|pode fazer|fa[cç]a|est[aá] todo en (el|mi) (cv|curr[ií]culum)|todo est[aá] en (el|mi) (cv|curr[ií]culum)|us[aá] (el|mi) (cv|curr[ií]culum)|con (el|mi) (cv|curr[ií]culum))(?![\wáéíóúñ])/i;

export const OVERRIDES = {
  smart: { label: 'Automático', desc: 'Elijo solo cómo responder (recomendado)' },
  fast: { label: 'Siempre rápido', desc: 'Respuestas al instante' },
  deep: { label: 'Siempre pensar', desc: 'Razonamiento a fondo en cada mensaje' },
  auto: { label: 'Siempre agente', desc: 'Planifica, usa herramientas y verifica' }
};

/** Etiqueta del estado mientras responde, según la decisión. */
export const ROUTE_LABEL = {
  fast: 'Escribiendo…', think: 'Pensando a fondo…', search: 'Buscando en la web…', browser: 'Encendiendo el ordenador virtual…',
  agent: 'Trabajando en tu pedido…', tools: 'Usando tus cuentas…', media: 'Creando…'
};

/**
 * @param {string} text
 * @param {{ override?: 'smart'|'fast'|'deep'|'auto', followBrowser?: boolean, hasFiles?: boolean, hasArtifact?: boolean }} [o]
 * @returns {{ kind: 'fast'|'think'|'search'|'browser'|'agent', mode: 'fast'|'deep'|'auto', why: string }}
 */
export function decideRoute(text, o = {}) {
  const t = String(text || '').trim();
  const ov = o.override && o.override !== 'smart' && OVERRIDES[o.override] ? o.override : 'smart';
  if (!t) return { kind: 'fast', mode: 'fast', why: 'empty' };
  if (o.followBrowser && FOLLOW.test(t)) return { kind: 'browser', mode: ov === 'smart' ? 'fast' : ov, why: 'follow' };
  // Acción pendiente (faltaba el CV o un dato, o el chat derivó a la computadora): la confirmación la retoma con el
  // pedido original, en vez de ir al chat rápido (que podría «decir que lo hizo»).
  if (o.pending && o.pending.text && CONFIRM.test(t) && t.length <= 160) return { kind: o.pending.route === 'apply' ? 'tools' : 'browser', mode: 'fast', why: 'resume', resume: o.pending.text };
  // «…en el ordenador», «usa el ordenador»: la persona pide ver la tarea en el ordenador virtual (manda sobre la búsqueda).
  if (wantsComputer(t)) return { kind: 'browser', mode: ov === 'smart' ? 'fast' : ov, why: 'computer' };
  // Orden sobre el diseño que ya está en la conversación («impleméntalo y mejóralo», «agrega panel admin 3D»):
  // la ejecuta el agente con ese archivo como base (nunca una respuesta solo en texto).
  if (o.hasArtifact && !EXPLICIT_SEARCH.test(t) && !isBrowserAction(t) && isIterateOrder(t)) return { kind: 'agent', mode: 'auto', why: 'iterate' };
  // Modo fijo elegido a mano: mismo comportamiento que tenían Rápido / Pensar / Agente.
  if (ov !== 'smart') {
    // «Busca en la web: …» es siempre la búsqueda en vivo (antes, en Agente, abría la computadora: error conocido).
    if (EXPLICIT_SEARCH.test(t)) return { kind: 'search', mode: ov === 'auto' ? 'fast' : ov, why: 'explicit-search' };
    const web = routeWebIntent(t, ov);
    if (web) return { kind: web, mode: ov, why: 'override' };
    return { kind: ov === 'auto' ? 'agent' : ov === 'deep' ? 'think' : 'fast', mode: ov, why: 'override' };
  }
  // 1) Pedido explícito de búsqueda: manda aunque nombre un sitio («Busca en la web: ofertas en LinkedIn»).
  if (EXPLICIT_SEARCH.test(t)) return { kind: 'search', mode: 'fast', why: 'explicit-search' };
  // 2) Acciones que solo puede hacer un navegador real.
  if (isBrowserAction(t)) return { kind: 'browser', mode: 'fast', why: 'browser-action' };
  // 3) Entregables: el agente con su computadora (vista previa en vivo del archivo).
  if (AGENT_BUILD.test(t)) return { kind: 'agent', mode: 'auto', why: 'deliverable' };
  // 4) Investigar o consultar datos que cambian: búsqueda en vivo (rápida, sin minutos de navegador).
  if (RESEARCH.test(t) || LOOKUP.test(t)) return { kind: 'search', mode: THINK.test(t) && t.length > 140 ? 'deep' : 'fast', why: 'lookup' };
  // 5) Cuenta corta → rápido. Razonar, programar, textos largos o varias preguntas → pensar.
  if (SHORT_MATH.test(t)) return { kind: 'fast', mode: 'fast', why: 'short-math' };
  const questions = (t.match(/\?/g) || []).length;
  if (THINK.test(t) || t.length > 280 || questions >= 2 || (o.hasFiles && t.length > 40)) return { kind: 'think', mode: 'deep', why: 'reasoning' };
  return { kind: 'fast', mode: 'fast', why: 'simple' };
}

export { needsWebAction };
