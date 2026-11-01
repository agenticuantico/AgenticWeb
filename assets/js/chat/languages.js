/** Idiomas de conversación y voz (banderas rectangulares premium en /assets/flags/rect/). */
export const LANGS = [
  { id: 'es-AR', code: 'es', short: 'ES', name: 'Español', region: 'Argentina', flag: 'ar', greeting: '¡Hola! Soy AgentiCuántico.', sub: 'Conversá conmigo, pedime código o activá el modo Agente para tareas completas.' },
  { id: 'es-ES', code: 'es', short: 'ES', name: 'Español', region: 'España', flag: 'es', greeting: '¡Hola! Soy AgentiCuántico.', sub: 'Conversá conmigo, pedime código o activá el modo Agente para tareas completas.' },
  { id: 'en-US', code: 'en', short: 'EN', name: 'English', region: 'United States', flag: 'us', greeting: 'Hi! I’m AgentiCuántico.', sub: 'Chat with me, ask for code or switch to Agent mode for complete tasks.' },
  { id: 'pt-BR', code: 'pt', short: 'PT', name: 'Português', region: 'Brasil', flag: 'br', greeting: 'Olá! Eu sou o AgentiCuántico.', sub: 'Converse comigo, peça código ou ative o modo Agente para tarefas completas.' },
  { id: 'it-IT', code: 'it', short: 'IT', name: 'Italiano', region: 'Italia', flag: 'it', greeting: 'Ciao! Sono AgentiCuántico.', sub: 'Parla con me, chiedimi codice o attiva la modalità Agente per compiti completi.' },
  { id: 'fr-FR', code: 'fr', short: 'FR', name: 'Français', region: 'France', flag: 'fr', greeting: 'Bonjour ! Je suis AgentiCuántico.', sub: 'Discutez avec moi, demandez du code ou activez le mode Agent pour des tâches complètes.' },
  { id: 'de-DE', code: 'de', short: 'DE', name: 'Deutsch', region: 'Deutschland', flag: 'de', greeting: 'Hallo! Ich bin AgentiCuántico.', sub: 'Sprich mit mir, frag nach Code oder aktiviere den Agent-Modus für ganze Aufgaben.' }
];
export const flagUrl = (l) => `/assets/flags/rect/${l.flag}.svg`;
export function getLang(id) { return LANGS.find((l) => l.id === id) || LANGS[0]; }
