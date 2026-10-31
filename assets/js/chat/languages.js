/** Idiomas de conversación y voz (banderas circle-flags, MIT). */
export const LANGS = [
  { id: 'es-AR', code: 'es', short: 'ES', name: 'Español', region: 'Argentina', flag: 'ar', greeting: '¿En qué te ayudo hoy?' },
  { id: 'es-ES', code: 'es', short: 'ES', name: 'Español', region: 'España', flag: 'es', greeting: '¿En qué te ayudo hoy?' },
  { id: 'en-US', code: 'en', short: 'EN', name: 'English', region: 'United States', flag: 'us', greeting: 'How can I help you today?' },
  { id: 'pt-BR', code: 'pt', short: 'PT', name: 'Português', region: 'Brasil', flag: 'br', greeting: 'Como posso ajudar hoje?' },
  { id: 'it-IT', code: 'it', short: 'IT', name: 'Italiano', region: 'Italia', flag: 'it', greeting: 'Come posso aiutarti oggi?' },
  { id: 'fr-FR', code: 'fr', short: 'FR', name: 'Français', region: 'France', flag: 'fr', greeting: 'Comment puis-je vous aider ?' },
  { id: 'de-DE', code: 'de', short: 'DE', name: 'Deutsch', region: 'Deutschland', flag: 'de', greeting: 'Wie kann ich dir heute helfen?' }
];
export const flagUrl = (l) => `/assets/flags/${l.flag}.svg`;
export function getLang(id) { return LANGS.find((l) => l.id === id) || LANGS[0]; }
