/**
 * AgentiCuántico · configuración de cobros (PÚBLICA, sin secretos).
 *
 * Completa estos valores cuando tengas los planes creados:
 *
 * Mercado Pago (ARS) — Suscripciones con plan asociado (preapproval_plan):
 *   1. En Mercado Pago → Tu negocio → Suscripciones, crea un plan por cada nivel (Pro y Empresa).
 *   2. Copia el link de pago del plan (init_point), p. ej.
 *      https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=2c93808...
 *   3. Configura como back_url:  https://agenticuantico.dev.ar/cuenta/?pago=mp&plan=pro  (o plan=empresa)
 *   4. PUBLIC_KEY (opcional): clave pública de la app de Mercado Pago (APP_USR-...), para guardar
 *      tarjetas con el Card Payment Brick cuando el servidor (worker-v2) esté activo.
 *
 * PayPal (USD) — Subscriptions:
 *   1. developer.paypal.com → Apps & Credentials → tu app LIVE → Client ID (es público).
 *   2. Crea un producto y dos planes (Pro USD 10/mes, Empresa USD 30/mes) y copia sus plan_id (P-...).
 *
 * Nunca se guarda número de tarjeta ni CVV en AgentiCuántico: el cobro y la tarjeta quedan en el
 * procesador. La activación definitiva del plan la confirma el servidor con los webhooks firmados.
 */
export const PAYMENTS = Object.freeze({
  mercadopago: {
    // Clave pública (MERCADOPAGO_PUBLIC_KEY): pública por diseño. El Access Token
    // (MERCADOPAGO_ACCESS_TOKEN) es secreto y vive SOLO en el servidor worker-v2.
    ENABLED: true,
    PUBLIC_KEY: 'APP_USR-bcd9bf1d-55ed-4c68-8286-8c275917cb44',
    // Planes de Suscripciones (preapproval_plan), ARS mensuales, back_url https://agenticuantico.dev.ar/cuenta/
    plans: {
      pro: '7461f35cf2ef4e45a804d30cfc39160d',      // ARS 15.600 / mes
      empresa: 'd74cfde5cd01402094276e5660be0ac6'   // ARS 46.800 / mes
    },
    checkout: {
      pro: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=7461f35cf2ef4e45a804d30cfc39160d',
      empresa: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=d74cfde5cd01402094276e5660be0ac6'
    }
  },
  paypal: {
    // Credenciales LIVE públicas (el Client ID es público por diseño). El secreto NUNCA va aquí:
    // vive solo en el servidor como variable PAYPAL_CLIENT_SECRET (wrangler secret put).
    CLIENT_ID: 'BAAVb151UeAXrpmiSFW4edo5HEEq02mx80g4eEJ21q0dz9OJu0BY8ewqPR8o8j9wzkkDrAV7REtbilN0NE',
    PRODUCT_ID: 'PROD-0WM85076V9857451H',
    plans: {
      pro: 'P-4XC87513LL1618724NLTANOY',      // USD 10 / mes
      empresa: 'P-7F877411LX287864FNLTAN4Q'   // USD 30 / mes
    }
  }
});

export function mpReady(plan) { return PAYMENTS.mercadopago.ENABLED && /^https:\/\/(www\.)?mercadopago\.com(\.ar)?\//.test(PAYMENTS.mercadopago.checkout[plan] || ''); }
export function paypalReady(plan) { return !!(/^[A-Za-z0-9_-]{20,}$/.test(PAYMENTS.paypal.CLIENT_ID) && /^P-[A-Z0-9]+$/.test(PAYMENTS.paypal.plans[plan] || '')); }
export function anyPaymentReady() { return ['pro', 'empresa'].some((p) => mpReady(p) || paypalReady(p)); }
