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
  offline: 'El servidor no responde en este momento. Probá de nuevo en un rato.',
  network: 'No hay conexión. Revisá internet y probá de nuevo.',
  login_required: 'Ingresá a tu cuenta para ver esta sección.',
  session_expired: 'Tu sesión venció. Ingresá de nuevo.',
  rate_limited: 'Demasiados pedidos seguidos. Esperá unos segundos.',
  maintenance: 'Estamos haciendo mantenimiento. Volvé en unos minutos.',
  connectors_unavailable: 'Los conectores no están disponibles en este momento.',
  github_not_configured: 'La conexión con GitHub todavía no está configurada.',
  google_not_configured: 'La conexión con Gmail todavía no está configurada.',
  linkedin_not_configured: 'La conexión con LinkedIn todavía no está configurada.',
  google_not_connected: 'Conectá tu Gmail primero (Cuentas conectadas).',
  gcalendar_not_configured: 'La conexión con Google Calendar todavía no está configurada.',
  gdrive_not_configured: 'La conexión con Google Drive todavía no está configurada.',
  gcalendar_not_connected: 'Conectá tu Google Calendar primero (Cuentas conectadas).',
  gdrive_not_connected: 'Conectá tu Google Drive primero (Cuentas conectadas).',
  gcalendar_permission_missing: 'Falta el permiso de calendario. Volvé a conectar Google Calendar.',
  gdrive_permission_missing: 'AgentiCuántico solo ve los archivos que creó en tu Drive.',
  gdrive_unsupported_type: 'Ese archivo no es de texto: no lo puedo leer.',
  invalid_event_time: 'Revisá la fecha y la hora del evento.',
  invalid_event_duration: 'El evento tiene que durar entre 5 minutos y 24 horas.',
  invalid_event_attendees: 'Revisá los correos de los invitados (hasta 10).',
  invalid_memory: 'Escribí el dato que querés que recuerde.',
  memory_too_long: 'Ese dato es muy largo: hasta 300 caracteres.',
  memory_sensitive: 'Por seguridad no guardo contraseñas, códigos, tarjetas ni CBU en la memoria.',
  memory_limit_reached: 'Llegaste a 200 datos guardados. Borrá alguno para agregar otro.',
  memory_not_found: 'Ese dato ya no está. Actualizá la lista.',
  invalid_project_name: 'Escribí un nombre para el proyecto.',
  project_limit_reached: 'Llegaste a 50 proyectos. Borrá alguno para crear otro.',
  project_not_found: 'Ese proyecto ya no existe. Actualizá la lista.',
  invalid_task_hour: 'Elegí una hora válida.',
  task_not_found: 'Esa tarea ya no existe. Actualizá la lista.',
  storage_unavailable: 'El guardado no está disponible en este momento. Probá en un rato.',
  expired: 'El enlace venció. Volvé a tocar «Conectar».',
  invalid_return: 'No se pudo preparar la vuelta a la app. Recargá la página y probá de nuevo.',
  forbidden: 'Esa conexión la empezó otra cuenta.',
  cloudflare_token_format: 'Ese texto no tiene el formato de un API token de Cloudflare.',
  cloudflare_token_invalid: 'Cloudflare no aceptó el token. Revisá que esté activo y copiado completo.',
  cloudflare_account_required: 'Con ese token no se ve ninguna cuenta. Agregá el permiso «Account Settings: Read».',
  task_limit_reached: 'Llegaste al máximo de tareas activas de tu plan. Pausá o borrá una, o mirá «Uso y plan».',
  task_runs_quota_exceeded: 'Llegaste al límite diario de ejecuciones. Se renueva a las 21:00 (hora de Argentina).',
  invalid_task_query: 'Escribí qué querés buscar (por ejemplo «atención al cliente remoto»).',
  job_searches_quota_exceeded: 'Llegaste al límite diario de búsquedas de empleo. Se renueva a las 21:00 (hora de Argentina).',
  job_drafts_quota_exceeded: 'Llegaste al límite diario de borradores. Se renueva a las 21:00 (hora de Argentina).',
  tool_calls_quota_exceeded: 'Llegaste al límite diario de acciones con tus cuentas. Se renueva a las 21:00 (hora de Argentina).',
  job_profile_required: 'Completá tu perfil de empleo primero (pestaña Empleo).',
  job_profile_name_required: 'Escribí tu nombre en el perfil.',
  job_query_required: 'Escribí qué trabajo buscás.',
  invalid_email: 'Revisá el correo: no parece válido.',
  invalid_recipient: 'Revisá el correo del destinatario.',
  action_expired: 'Esta acción venció (30 min). Pedila de nuevo en el chat.',
  action_already_decided: 'Esta acción ya se confirmó o se canceló.',
  offer_not_found: 'Esa oferta ya no está en tu última búsqueda. Buscá de nuevo.'
};
export function errorText(e) {
  const code = e && e.code ? e.code : 'error';
  if (MSG[code]) return MSG[code];
  if (/_reconnect$/.test(code)) return 'El permiso venció o se revocó. Volvé a conectar la cuenta.';
  if (/_quota_exceeded$/.test(code)) return 'Llegaste al límite diario de tu plan. Se renueva a las 21:00 (hora de Argentina).';
  return 'Algo falló. Probá de nuevo.';
}
