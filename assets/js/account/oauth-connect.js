/**
 * Conectar una cuenta (GitHub, Gmail, LinkedIn) con redirección de página completa:
 *   «Conectar» → pantalla de permiso del proveedor (en la misma pestaña, sin ventanas emergentes) →
 *   la persona aprueba allí → vuelve a /app/?cuenta=conectada&proveedor=<p> (o ?cuenta=error&…&motivo=<m>).
 * Si el pedido salió del chat («revisá mis mails»), se guarda el pedido pendiente en esta pestaña
 * (sessionStorage, 15 min) y al volver el chat lo retoma solo.
 * La sesión de la cuenta (Firebase) vive en este navegador y no se toca durante la redirección.
 */
import { call } from './api.js';

const RESUME_KEY = 'ac.connect.resume';
const RESUME_TTL = 15 * 60_000;
export const PROVIDER_LABEL = { github: 'GitHub', google: 'Gmail', gcalendar: 'Google Calendar', gdrive: 'Google Drive', gcloud: 'Google Cloud', linkedin: 'LinkedIn', cloudflare: 'Cloudflare' };

/** Dirección de vuelta: siempre /app/ de este mismo sitio (el servidor la valida contra su lista permitida). */
export const returnUrl = () => `${location.origin}/app/`;

/**
 * Empieza la conexión. `resume` = { chatId, text } para retomar un pedido del chat al volver.
 * Devuelve { mode: 'device', … } solo si GitHub está en modo código (sin secreto del servidor); si no, navega.
 */
export async function startConnect(provider, { resume, level } = {}) {
  // Fase 5: nivel de permiso elegido («read» = Solo leer, «confirm» = Actuar pidiendo confirmación).
  const r = await call(`/api/connectors/${provider}/start`, { method: 'POST', body: { return: returnUrl(), ...(level ? { level } : {}) } });
  if (r.url) {
    try {
      if (resume && resume.text) sessionStorage.setItem(RESUME_KEY, JSON.stringify({ provider, chatId: resume.chatId || null, text: String(resume.text).slice(0, 4000), at: Date.now() }));
      else sessionStorage.removeItem(RESUME_KEY);
    } catch { /* modo privado sin almacenamiento: se conecta igual, sin retomar */ }
    location.assign(r.url);
    return { mode: 'redirect' };
  }
  return r;
}

/** Lee y LIMPIA de la barra de direcciones el resultado de la vuelta (?cuenta=…&proveedor=…&motivo=…). */
export function readConnectReturn() {
  const q = new URLSearchParams(location.search);
  const status = q.get('cuenta');
  if (status !== 'conectada' && status !== 'error') return null;
  const provider = q.get('proveedor') || '';
  const reason = q.get('motivo') || '';
  ['cuenta', 'proveedor', 'motivo'].forEach((k) => q.delete(k));
  const rest = q.toString();
  history.replaceState(null, '', location.pathname + (rest ? `?${rest}` : '') + location.hash);
  if (!/^[a-z]{3,12}$/.test(provider)) return null;
  return { ok: status === 'conectada', provider, label: PROVIDER_LABEL[provider] || provider, reason };
}

/** Pedido del chat que quedó esperando esta conexión (se consume una sola vez). */
export function takeResume(provider) {
  try {
    const raw = sessionStorage.getItem(RESUME_KEY);
    sessionStorage.removeItem(RESUME_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw);
    if (r.provider !== provider || Date.now() - r.at > RESUME_TTL || !r.text) return null;
    return r;
  } catch { return null; }
}

/** Mensaje en castellano simple para la vuelta. */
export function returnMessage(ret) {
  if (ret.ok) return `${ret.label} conectada.`;
  return ({
    denied: `Cancelaste la conexión con ${ret.label}. No se guardó nada.`,
    not_configured: `La conexión con ${ret.label} todavía no está habilitada.`,
    expired: 'El enlace venció. Tocá «Conectar» de nuevo.',
    invalid_state: 'La conexión no se pudo verificar (pasó mucho tiempo o se abrió en otro navegador). Probá de nuevo.',
    profile_failed: `${ret.label} no devolvió los datos de la cuenta. Probá de nuevo.`
  })[ret.reason] || `No se pudo conectar ${ret.label}. Probá de nuevo.`;
}
