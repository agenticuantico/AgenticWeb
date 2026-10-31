/**
 * /app configuration (PUBLIC). Never put secrets here.
 *
 * API_BASE: URL of the deployed backend (Cloudflare Worker), e.g.
 *   'https://api.agenticuantico.dev.ar'  or  'https://agenticuantico-api.<account>.workers.dev'
 * Empty string = DEMO MODE: the app answers from the local public FAQ, stores
 * conversations in localStorage and payments are disabled.
 */
import { SITE_CONFIG, PRICING, arsPrice, formatPrice } from '../assets/js/config.js';

export const APP_CONFIG = {
  API_BASE: '',
  TTS_PROXY_URL: SITE_CONFIG.TTS_PROXY_URL,
  VOICE_TUNING: SITE_CONFIG.VOICE_TUNING,
  STORAGE_KEY: 'ac.app.v1',
  /** Agents (modes). `plan` = minimum plan required when a backend is connected. */
  AGENTS: [
    { id: 'general', plan: 'free', icon: '✦' },
    { id: 'comercial', plan: 'pro', icon: '◆' },
    { id: 'tecnico', plan: 'pro', icon: '⌘' },
    { id: 'analista', plan: 'pro', icon: '◎' }
  ]
};

export { PRICING, arsPrice, formatPrice };
export const isDemo = () => !APP_CONFIG.API_BASE;
