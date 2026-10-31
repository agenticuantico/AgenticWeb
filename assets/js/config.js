/**
 * AgentiCuántico · configuración pública del sitio.
 * Todo lo que está acá es público por diseño (va al navegador). Nunca pongas secretos.
 */
import FIREBASE from './firebase-config.js';

export const CONFIG = Object.freeze({
  SITE_URL: 'https://agenticuantico.dev.ar',
  /** Backend (Cloudflare Worker worker-v2). Se usa solo si GET /api/health responde OK. */
  API_BASE: 'https://api.agenticuantico.dev.ar',
  HEALTH_TIMEOUT_MS: 2500,
  CONTACT_EMAIL: 'agenticuantico@gmail.com',
  COMMERCIAL_SUBJECT: 'Consulta Comercial',
  /**
   * Cuenta dueña. El acceso al panel NO se decide por este texto: lo da el documento admins/{uid}
   * (verificado por las reglas). Se usa solo para ofrecer el alta inicial (bootstrap) de ese documento,
   * que las reglas permiten una única vez y solo con el token verificado de esta cuenta de Google.
   */
  OWNER_EMAIL: 'agenticuantico@gmail.com',
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
  /** Cloudflare Turnstile (anti-bot). Vacío = desactivado. */
  TURNSTILE_SITE_KEY: ''
});

export const PLANS = [
  {
    id: 'gratis', name: 'Gratis', tagline: 'Para conocer AgentiCuántico.',
    features: ['Chat con el asistente general', 'Voz femenina en 7 idiomas', 'Análisis de documentos en tu dispositivo', 'Historial en tu cuenta', '20 mensajes por día con el servidor activo']
  },
  {
    id: 'pro', name: 'Pro', tagline: 'Para profesionales y creadores.', featured: true,
    features: ['Todo lo de Gratis', 'Agentes invitables: programador, investigadora, diseñador y más', 'Modo «Hace todo por vos» con herramientas', 'Razonamiento profundo', 'Automatizaciones y conectores (al activarse el servidor)', '500 mensajes por día']
  },
  {
    id: 'empresa', name: 'Empresa', tagline: 'Para equipos y empresas.',
    features: ['Todo lo de Pro', 'Agentes personalizados para tu empresa', 'Prioridad en la cola de procesamiento', 'Soporte prioritario por correo', '3000 mensajes por día']
  }
];

export function formatARS(n) { return 'ARS ' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n); }
export function formatUSD(n) { return 'USD ' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n); }
export function mailtoCommercial() {
  return `mailto:${CONFIG.CONTACT_EMAIL}?subject=${encodeURIComponent(CONFIG.COMMERCIAL_SUBJECT)}`;
}
