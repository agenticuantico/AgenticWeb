/**
 * Thin client for the private backend (Cloudflare Worker). Only used when
 * APP_CONFIG.API_BASE is set. Auth uses an httpOnly session cookie set by the
 * backend, so no token is ever stored in JavaScript.
 */
import { APP_CONFIG } from './config.js';

const base = () => APP_CONFIG.API_BASE.replace(/\/$/, '');

async function json(path, opts = {}) {
  const res = await fetch(base() + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || `HTTP ${res.status}`); e.status = res.status; e.data = data; throw e; }
  return data;
}

export const api = {
  me: () => json('/api/auth/me'),
  magicLink: (email, lang) => json('/api/auth/magic-link', { method: 'POST', body: JSON.stringify({ email, lang }) }),
  logout: () => json('/api/auth/logout', { method: 'POST' }),
  googleStartUrl: () => `${base()}/api/auth/google/start?return=${encodeURIComponent(location.origin + '/app/')}`,
  subscribe: (provider, plan) => json(`/api/billing/${provider}/subscribe`, { method: 'POST', body: JSON.stringify({ plan }) }),

  /**
   * Streams a chat completion. Server sends SSE lines: `data: {"delta":"..."}` and `data: [DONE]`.
   * @returns {Promise<string>} full text
   */
  async chat({ messages, agent, lang }, onDelta, signal) {
    const res = await fetch(base() + '/api/chat', {
      method: 'POST', credentials: 'include', signal,
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ messages, agent, lang })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const e = new Error(data.error || `HTTP ${res.status}`); e.status = res.status; e.data = data; throw e;
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '', full = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const evt = buf.slice(0, i); buf = buf.slice(i + 2);
        for (const line of evt.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') return full;
          try { const d = JSON.parse(payload); if (d.delta) { full += d.delta; onDelta(d.delta, full); } if (d.error) throw new Error(d.error); } catch (err) { if (err.message && !/JSON/.test(err.message)) throw err; }
        }
      }
    }
    return full;
  }
};
