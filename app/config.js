/*
 * AgentiCuántico · configuración de la app de chat (/app/)
 *
 * API_BASE: backend (Cloudflare Worker worker-v2).
 *   - Se usa SOLO si GET {API_BASE}/api/health responde OK en menos de 3 s.
 *   - Si está vacío, no responde o falla, la app funciona en "modo demo" local (sin errores).
 * Forzar demo: abrir /app/?demo=1
 */
window.AC_CONFIG = {
  API_BASE: "https://api.agenticuantico.dev.ar",
  HEALTH_TIMEOUT_MS: 3000,
  // Precios: deben coincidir con worker-v2/wrangler.toml (USD × 1560, redondeado a 100)
  PRICES: {
    pro: { usd: 10, ars: 15600 },
    empresa: { usd: 30, ars: 46800 }
  },
  CONTACT_EMAIL: "agenticuantico@gmail.com"
};
