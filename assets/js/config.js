/**
 * Public site configuration. Everything here is PUBLIC: never put API keys,
 * tokens or private data in this file. Secrets live only in the private backend.
 */
export const SITE_CONFIG = {
  /**
   * Optional premium voice (e.g. ElevenLabs) through a serverless proxy you control.
   * Empty = use the browser's Web Speech API voices.
   * The proxy receives POST {text, lang, voice} and returns audio (audio/mpeg).
   * If you set it, also make sure its origin is allowed by the CSP connect-src.
   */
  TTS_PROXY_URL: '',

  /** Commercial contact. The subject must stay exactly "Consulta Comercial". */
  CONTACT_EMAIL: 'agenticuantico@gmail.com',
  COMMERCIAL_MAILTO: 'mailto:agenticuantico@gmail.com?subject=Consulta%20Comercial',

  /** Voice tuning per language (rate 0.1–10, pitch 0–2). */
  VOICE_TUNING: {
    'es-AR': { rate: 1.0, pitch: 0.98 },
    en: { rate: 1.0, pitch: 1.0 },
    'pt-BR': { rate: 1.0, pitch: 1.0 }
  }
};

/**
 * ===== PRICING (edit here) =====
 * Prices are monthly. USD is the reference. ARS is derived from USD_ARS and
 * rounded to the nearest ARS_ROUNDING, unless `arsFixed` is set for a plan.
 * Mercado Pago charges ARS. PayPal charges USD.
 * Keep the backend values (wrangler.toml PRICE_* vars and PayPal plans) in sync.
 */
export const PRICING = {
  USD_ARS: 1560,          // BNA official sell rate, Oct 30, 2026. Update as needed.
  ARS_ROUNDING: 100,      // ARS prices rounded to the nearest 100
  DEFAULT_CURRENCY: 'ARS',
  PLANS: [
    { id: 'free', name: 'Gratis', usd: 0, arsFixed: null, featured: false },
    { id: 'pro', name: 'Pro', usd: 10, arsFixed: null, featured: true },
    // Empresa amount is a proposed default; edit freely.
    { id: 'empresa', name: 'Empresa', usd: 30, arsFixed: null, featured: false }
  ]
};

/** Returns the ARS monthly price for a plan (fixed override or derived). */
export function arsPrice(plan, pricing = PRICING) {
  if (typeof plan.arsFixed === 'number') return plan.arsFixed;
  const raw = plan.usd * pricing.USD_ARS;
  const step = pricing.ARS_ROUNDING || 1;
  return Math.round(raw / step) * step;
}

export function formatPrice(amount, currency, locale) {
  const loc = currency === 'ARS' ? 'es-AR' : (locale || 'en-US');
  try {
    return new Intl.NumberFormat(loc, { style: 'currency', currency, maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}
