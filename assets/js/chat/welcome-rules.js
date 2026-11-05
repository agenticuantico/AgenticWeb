/** Reglas de la bienvenida de primera visita (sin DOM, se prueban con vitest). */
export const WELCOME_KEY = 'ac.welcome.v1';
/**
 * ¿Mostrar la bienvenida? Solo la primera vez en /app/, y nunca cuando la persona llega con algo que hacer
 * (pregunta precargada ?q=, vuelta de conectar una cuenta, #cuenta…). ?bienvenida=1 la fuerza (para verla de nuevo).
 * @param {{ seen?: string|null, search?: string, hash?: string }} o
 */
export function shouldShowWelcome({ seen = null, search = '', hash = '' } = {}) {
  const q = new URLSearchParams(search || '');
  if (q.get('bienvenida') === '1') return true;
  if (seen) return false;
  if (q.get('q') || q.get('cuenta') || q.get('modo')) return false;
  if (/^#(cuenta|conectar=)/.test(hash || '')) return false;
  return true;
}
export const WELCOME_STEPS = [
  { id: 'ask', icon: 'spark', title: 'Preguntá lo que necesites', text: 'Escribí o hablá como con una persona. Para datos de hoy, empezá con «Buscá en la web:» y te respondo con fuentes.', examples: ['Buscá en la web: dólar oficial hoy', 'Armame un plan de estudio semanal', 'Resumime este texto en 5 puntos'] },
  { id: 'connect', icon: 'plug', title: 'Conectá una cuenta', text: 'Sumá tu correo, tu agenda o tus repositorios. El chat solo los usa cuando se lo pedís, y antes de enviar o publicar algo te pide «Confirmar».', action: { label: 'Ver cuentas conectadas', tab: 'conexiones' } },
  { id: 'task', icon: 'clock', title: 'Creá una tarea', text: 'Dejá algo andando solo: por ejemplo, buscar empleo remoto todos los días a las 9. Los resultados quedan en Tu cuenta.', action: { label: 'Crear una tarea', tab: 'tareas' } }
];
