/**
 * AgentiCuántico · configuración pública del sitio.
 * Todo lo que está acá es público por diseño (va al navegador). Nunca pongas secretos.
 */
import FIREBASE from './firebase-config.js';

export const CONFIG = Object.freeze({
  SITE_URL: 'https://agenticuantico.dev.ar',
  /** Backend (Cloudflare Worker worker-v2). Se usa solo si GET /api/health responde OK. */
  API_BASE: 'https://agenticuantico-api.agenticuantico.workers.dev',
  HEALTH_TIMEOUT_MS: 2500,
  CONTACT_EMAIL: 'agenticuantico@gmail.com',
  COMMERCIAL_SUBJECT: 'Consulta Comercial',
  /**
   * Cuenta dueña. El acceso al panel NO se decide por este texto: lo da el documento admins/{uid}
   * (verificado por las reglas). Se usa solo para ofrecer el alta inicial (bootstrap) de ese documento,
   * que las reglas permiten una única vez y solo con el token verificado de esta cuenta de Google.
   */
  /** SHA-256 del correo de la cuenta dueña (la verificación real la hacen las reglas de Firestore). */
  OWNER_EMAIL_SHA256: 'c924e30c258733cdb4731c608665b842e9855fa6c71564bb258ed732f7aa036f',
  FIREBASE,
  GITHUB: {
    ACTIONS_DEV: 'https://github.com/agenticuantico/AgenticDev/actions',
    ACTIONS_WEB: 'https://github.com/agenticuantico/AgenticWeb/actions'
  },
  /** Precios: tipo de cambio BNA vendedor 1560 (31/10/2026), ARS redondeado a 100. */
  PRICES: {
    gratis: { usd: 0, ars: 0 },
    pro: { usd: 10, ars: 15600 },
    empresa: { usd: 30, ars: 46800 }
  },
  /** Fase 1: todas las funciones en todos los planes; los planes solo cambian el uso diario (igual que el servidor). */
  ALL_FEATURES_ALL_PLANS: true,
  /** Cloudflare Turnstile (anti-bot). Vacío = desactivado. */
  TURNSTILE_SITE_KEY: ''
});

/**
 * Fase 1: TODAS las funciones están en todos los planes. Lo único que cambia es cuánto se usa por día
 * (mismos números que el servidor: worker-v2/src/billing/limits.ts y wrangler.toml). Se renueva 21:00 (Argentina).
 */
export const PLANS = [
  {
    id: 'gratis', name: 'Gratis', tagline: 'Todas las funciones, para probar con calma.',
    features: ['Todas las funciones de AgentiCuántico', '20 mensajes por día', '8 búsquedas web en vivo por día', '3 búsquedas de empleo y 3 postulaciones automáticas por día', '30 acciones con tus cuentas conectadas por día', '2 tareas programadas activas']
  },
  {
    id: 'pro', name: 'Pro', tagline: 'Para profesionales y creadores.', featured: true,
    features: ['Todas las funciones de AgentiCuántico', '500 mensajes por día', '60 búsquedas web en vivo por día', '30 búsquedas de empleo y 15 postulaciones automáticas por día', '300 acciones con tus cuentas conectadas por día', '10 tareas programadas activas']
  },
  {
    id: 'empresa', name: 'Empresa', tagline: 'Para equipos y uso intensivo.',
    features: ['Todas las funciones de AgentiCuántico', '3000 mensajes por día', '200 búsquedas web en vivo por día', '100 búsquedas de empleo y 40 postulaciones automáticas por día', '1500 acciones con tus cuentas conectadas por día', '30 tareas programadas activas y soporte prioritario por correo']
  }
];

export function formatARS(n) { return 'ARS ' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n); }
export function formatUSD(n) { return 'USD ' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n); }
export function mailtoCommercial() {
  return `mailto:${CONFIG.CONTACT_EMAIL}?subject=${encodeURIComponent(CONFIG.COMMERCIAL_SUBJECT)}`;
}
