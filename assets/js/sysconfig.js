/**
 * Configuración del sistema publicada por el panel de administración (Firestore config/system).
 * Se lee por REST (sin SDK) y se cachea 60 s. Si las reglas aún no están publicadas o no hay red,
 * se usan valores por defecto: el sitio sigue funcionando.
 */
import { CONFIG } from './config.js';

export const DEFAULT_SYSTEM = Object.freeze({
  killSwitch: false,
  maintenance: false,
  maintenanceMessage: '',
  announcement: { active: false, text: '', level: 'info' },
  flags: { chat: true, voice: true, avatar: true, signups: true, agentMode: true, payments: true, agents247: true }
});

const KEY = 'ac.sys.v1';

/** Convierte un documento REST de Firestore a objeto plano. */
export function fromFirestore(fields = {}) {
  const val = (v) => {
    if (!v) return null;
    if ('booleanValue' in v) return v.booleanValue;
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return v.doubleValue;
    if ('timestampValue' in v) return v.timestampValue;
    if ('nullValue' in v) return null;
    if ('mapValue' in v) return fromFirestore(v.mapValue.fields || {});
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(val);
    return null;
  };
  const out = {};
  for (const [k, v] of Object.entries(fields)) out[k] = val(v);
  return out;
}

function merge(raw) {
  const s = structuredClone(DEFAULT_SYSTEM);
  if (!raw) return s;
  s.killSwitch = raw.killSwitch === true;
  s.maintenance = raw.maintenance === true;
  s.maintenanceMessage = typeof raw.maintenanceMessage === 'string' ? raw.maintenanceMessage.slice(0, 400) : '';
  if (raw.announcement && typeof raw.announcement === 'object') {
    s.announcement = { active: raw.announcement.active === true, text: String(raw.announcement.text || '').slice(0, 300), level: ['info', 'warn', 'danger'].includes(raw.announcement.level) ? raw.announcement.level : 'info' };
  }
  if (raw.flags && typeof raw.flags === 'object') for (const k of Object.keys(s.flags)) if (typeof raw.flags[k] === 'boolean') s.flags[k] = raw.flags[k];
  return s;
}

let pending;
export function getSystem({ fresh = false } = {}) {
  if (!fresh) {
    try {
      const c = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      if (c && Date.now() - c.at < 60_000) return Promise.resolve(merge(c.raw));
    } catch {}
    if (pending) return pending;
  }
  const { projectId, apiKey } = CONFIG.FIREBASE;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/config/system?key=${apiKey}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3500);
  pending = fetch(url, { signal: ctrl.signal, cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j && j.fields ? fromFirestore(j.fields) : null))
    .catch(() => null)
    .then((raw) => {
      clearTimeout(timer);
      try { sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), raw })); } catch {}
      pending = null;
      return merge(raw);
    });
  return pending;
}
export function clearSystemCache() { try { sessionStorage.removeItem(KEY); } catch {} }
