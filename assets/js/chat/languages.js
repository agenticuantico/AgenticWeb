/** Idiomas de conversación y voz (banderas rectangulares premium en /assets/flags/rect/). */
export const LANGS = [
  { id: 'es-AR', code: 'es', short: 'ES', name: 'Español', region: 'Argentina', flag: 'ar', greeting: '¡Hola! Soy AgentiCuántico.', sub: 'Conversá conmigo, pedime código o una tarea completa: yo me encargo.' },
  { id: 'es-ES', code: 'es', short: 'ES', name: 'Español', region: 'España', flag: 'es', greeting: '¡Hola! Soy AgentiCuántico.', sub: 'Conversa conmigo, pídeme código o una tarea completa: yo me encargo.' },
  { id: 'en-US', code: 'en', short: 'EN', name: 'English', region: 'United States', flag: 'us', greeting: 'Hi! I’m AgentiCuántico.', sub: 'Chat with me, ask for code or a complete task: I’ll handle it.' },
  { id: 'pt-BR', code: 'pt', short: 'PT', name: 'Português', region: 'Brasil', flag: 'br', greeting: 'Olá! Eu sou o AgentiCuántico.', sub: 'Converse comigo, peça código ou uma tarefa completa: eu cuido disso.' },
  { id: 'it-IT', code: 'it', short: 'IT', name: 'Italiano', region: 'Italia', flag: 'it', greeting: 'Ciao! Sono AgentiCuántico.', sub: 'Parla con me, chiedimi codice o un compito completo: ci penso io.' },
  { id: 'fr-FR', code: 'fr', short: 'FR', name: 'Français', region: 'France', flag: 'fr', greeting: 'Bonjour ! Je suis AgentiCuántico.', sub: 'Discutez avec moi, demandez du code ou une tâche complète : je m’en occupe.' },
  { id: 'de-DE', code: 'de', short: 'DE', name: 'Deutsch', region: 'Deutschland', flag: 'de', greeting: 'Hallo! Ich bin AgentiCuántico.', sub: 'Sprich mit mir, frag nach Code oder einer ganzen Aufgabe: Ich kümmere mich darum.' }
];
export const flagUrl = (l) => `/assets/flags/rect/${l.flag}.svg`;
export function getLang(id) { return LANGS.find((l) => l.id === id) || LANGS[0]; }

/** Idioma inicial de la conversación: sigue al idioma del sitio cuando se eligió uno. */
export function startLang(saved) {
  let site = null;
  try { site = localStorage.getItem('ac.siteLang') || new URLSearchParams(location.search).get('lang'); } catch {}
  const SITE = ['es-AR', 'es-ES', 'en-US', 'pt-BR'];
  if (site && SITE.includes(site) && (!saved || (SITE.includes(saved) && saved !== site))) return getLang(site);
  return getLang(saved || 'es-AR');
}
