/**
 * Cliente del área «Cuenta» (worker /api/account, /api/connectors, /api/jobs, /api/tasks, /api/tools).
 * Usa el mismo canal autenticado que el chat (token de Firebase). Nunca recibe ni guarda tokens de terceros.
 */
import { init, apiFetch, state } from '../chat/engine.js';

export class ApiError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

/** GET/POST JSON. Lanza ApiError con el código del servidor («login_required», «task_limit_reached», …). */
export async function call(path, { method = 'GET', body } = {}) {
  await init();
  if (!state.live) throw new ApiError(0, 'offline');
  let res;
  try { res = await apiFetch(path, { method, body }); } catch { throw new ApiError(0, 'network'); }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, j.error || 'error');
  return j;
}

/** Mensajes en castellano simple para cada código de error. */
const MSG = {
  offline: 'El servidor no responde en este momento. Probá de nuevo en un rato.',
  network: 'No hay conexión. Revisá internet y probá de nuevo.',
  login_required: 'Ingresá a tu cuenta para ver esta sección.',
  rate_limited: 'Demasiados pedidos seguidos. Esperá unos segundos.',
  maintenance: 'Estamos haciendo mantenimiento. Volvé en unos minutos.',
  connectors_unavailable: 'Los conectores no están disponibles en este momento.',
  github_not_configured: 'La conexión con GitHub todavía no está configurada.',
  google_not_configured: 'La conexión con Gmail todavía no está configurada.',
  linkedin_not_configured: 'La conexión con LinkedIn todavía no está configurada.',
  google_not_connected: 'Conectá tu Gmail primero (Cuentas conectadas).',
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
