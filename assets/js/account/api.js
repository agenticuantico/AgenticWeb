/**
 * Cliente del área «Cuenta» (worker /api/account, /api/connectors, /api/jobs, /api/tasks, /api/tools).
 * Usa el mismo canal autenticado que el chat (token de Firebase). Nunca recibe ni guarda tokens de terceros.
 */
import { ensureLive, apiFetch, state } from '../chat/engine.js';

export class ApiError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

/** GET/POST JSON. Lanza ApiError con el código del servidor («login_required», «task_limit_reached», …). */
export async function call(path, { method = 'GET', body } = {}) {
  // Si el servidor figuraba caído (p. ej. un /api/health lento en el celular), se vuelve a comprobar antes de rendirse.
  await ensureLive();
  if (!state.live) throw new ApiError(0, typeof navigator !== 'undefined' && navigator.onLine === false ? 'network' : 'offline');
  let res;
  try { res = await apiFetch(path, { method, body }); } catch { throw new ApiError(0, typeof navigator !== 'undefined' && navigator.onLine === false ? 'network' : 'offline'); }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, j.error || 'error');
  return j;
}

/** Mensajes en castellano simple para cada código de error. */
const MSG = {
  offline: 'El servidor no responde en este momento. Prueba de nuevo en un rato.',
  network: 'No hay conexión. Revisa internet y prueba de nuevo.',
  login_required: 'Ingresa a tu cuenta para ver esta sección.',
  session_expired: 'Tu sesión venció. Ingresa de nuevo.',
  rate_limited: 'Demasiados pedidos seguidos. Espera unos segundos.',
  maintenance: 'Estamos haciendo mantenimiento. Vuelve en unos minutos.',
  connectors_unavailable: 'Los conectores no están disponibles en este momento.',
  github_not_configured: 'La conexión con GitHub todavía no está configurada.',
  google_not_configured: 'La conexión con Gmail todavía no está configurada.',
  linkedin_not_configured: 'La conexión con LinkedIn todavía no está configurada.',
  google_not_connected: 'Conecta tu Gmail primero (Cuentas conectadas).',
  gcalendar_not_configured: 'La conexión con Google Calendar todavía no está configurada.',
  gdrive_not_configured: 'La conexión con Google Drive todavía no está configurada.',
  gcalendar_not_connected: 'Conecta tu Google Calendar primero (Cuentas conectadas).',
  gdrive_not_connected: 'Conecta tu Google Drive primero (Cuentas conectadas).',
  gcalendar_permission_missing: 'Falta el permiso de calendario. Vuelve a conectar Google Calendar.',
  gdrive_permission_missing: 'AgentiCuántico solo ve los archivos que creó en tu Drive.',
  gdrive_unsupported_type: 'Ese archivo no es de texto: no lo puedo leer.',
  invalid_event_time: 'Revisa la fecha y la hora del evento.',
  invalid_event_duration: 'El evento tiene que durar entre 5 minutos y 24 horas.',
  invalid_event_attendees: 'Revisa los correos de los invitados (hasta 10).',
  invalid_memory: 'Escribe el dato que quieres que recuerde.',
  memory_too_long: 'Ese dato es muy largo: hasta 300 caracteres.',
  memory_sensitive: 'Por seguridad no guardo contraseñas, códigos, tarjetas ni CBU en la memoria.',
  memory_limit_reached: 'Llegaste a 200 datos guardados. Borra alguno para agregar otro.',
  memory_not_found: 'Ese dato ya no está. Actualiza la lista.',
  invalid_project_name: 'Escribe un nombre para el proyecto.',
  project_limit_reached: 'Llegaste a 50 proyectos. Borra alguno para crear otro.',
  project_not_found: 'Ese proyecto ya no existe. Actualiza la lista.',
  invalid_task_hour: 'Elige una hora válida.',
  task_not_found: 'Esa tarea ya no existe. Actualiza la lista.',
  storage_unavailable: 'El guardado no está disponible en este momento. Prueba en un rato.',
  expired: 'El enlace venció. Vuelve a tocar «Conectar».',
  invalid_return: 'No se pudo preparar la vuelta a la app. Recarga la página y prueba de nuevo.',
  forbidden: 'Esa conexión la empezó otra cuenta.',
  cloudflare_token_format: 'Ese texto no tiene el formato de un API token de Cloudflare.',
  cloudflare_token_invalid: 'Cloudflare no aceptó el token. Revisa que esté activo y copiado completo.',
  cloudflare_account_required: 'Con ese token no se ve ninguna cuenta. Agrega el permiso «Account Settings: Read».',
  task_limit_reached: 'Llegaste al máximo de tareas activas de tu plan. Pausa o borra una, o mira «Uso y plan».',
  task_runs_quota_exceeded: 'Llegaste al límite diario de ejecuciones. Se renueva a las 21:00 (hora de Argentina).',
  invalid_task_query: 'Escribe qué quieres buscar (por ejemplo «atención al cliente remoto»).',
  job_searches_quota_exceeded: 'Llegaste al límite diario de búsquedas de empleo. Se renueva a las 21:00 (hora de Argentina).',
  job_drafts_quota_exceeded: 'Llegaste al límite diario de borradores. Se renueva a las 21:00 (hora de Argentina).',
  tool_calls_quota_exceeded: 'Llegaste al límite diario de acciones con tus cuentas. Se renueva a las 21:00 (hora de Argentina).',
  job_profile_required: 'Completa tu perfil de empleo primero (pestaña Empleo).',
  job_profile_name_required: 'Escribe tu nombre en el perfil.',
  job_query_required: 'Escribe qué trabajo buscas.',
  invalid_email: 'Revisa el correo: no parece válido.',
  invalid_recipient: 'Revisa el correo del destinatario.',
  action_expired: 'Esta acción venció (30 min). Pídela de nuevo en el chat.',
  action_already_decided: 'Esta acción ya se confirmó o se canceló.',
  offer_not_found: 'Esa oferta ya no está en tu última búsqueda. Busca de nuevo.'
};
export function errorText(e) {
  const code = e && e.code ? e.code : 'error';
  if (MSG[code]) return MSG[code];
  if (/_reconnect$/.test(code)) return 'El permiso venció o se revocó. Vuelve a conectar la cuenta.';
  if (/_quota_exceeded$/.test(code)) return 'Llegaste al límite diario de tu plan. Se renueva a las 21:00 (hora de Argentina).';
  return 'Algo falló. Prueba de nuevo.';
}
