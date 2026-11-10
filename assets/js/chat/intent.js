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

/**
 * Pedido explícito del ordenador virtual («buscá el clima en el ordenador», «usá el ordenador para…», «abrí el ordenador
 * virtual»). Manda sobre la búsqueda en vivo: la persona quiere ver la tarea en la pantalla.
 */
export const EXPLICIT_COMPUTER = /((us[aá](r|me|lo)?|abr[ií](r|me)?|prend[eé](r)?|encend[eé](r)?)\s+(el|tu)\s+(ordenador|computadora)(?![\wáéíóúñ])|(en|con|desde|por)\s+(el|tu)\s+ordenador(?![\wáéíóúñ])|(ordenador|computadora)\s+(virtual|del agente))/i;
export function wantsComputer(text) { return EXPLICIT_COMPUTER.test(String(text || '')); }

/** Saca la mención del ordenador para usar el resto como búsqueda («buscá el clima de Bahía Blanca»). */
export function stripComputer(text) {
  return String(text || '')
    .replace(/\s*,?\s*((us[aá](r|me|lo)?|abr[ií](r|me)?|prend[eé](r)?|encend[eé](r)?)\s+(el|tu)\s+(ordenador|computadora)(\s+(virtual|del agente))?|(en|con|desde|por)\s+(el|tu)\s+(ordenador|computadora)(\s+(virtual|del agente))?)(\s+(para|y))?(?![\wáéíóúñ])/ig, ' ')
    .replace(/\s{2,}/g, ' ').replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, '').trim();
}

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
  if (wantsComputer(t)) return 'browser';
  if (mode === 'auto') return needsWebAction(t) ? 'browser' : null;
  // Rápido / Profundo: un pedido explícito de búsqueda manda, aunque nombre un sitio («Buscá en la web: ofertas en LinkedIn»).
  if (EXPLICIT_SEARCH.test(t)) return 'search';
  if (BROWSER_ACTION.test(t)) return 'browser';
  if (RESEARCH.test(t)) return 'search';
  return null;
}
