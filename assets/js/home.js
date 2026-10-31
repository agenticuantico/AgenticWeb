/** Portada: avatar + chat embebido, planes y estado del equipo de agentes. */
import { AvatarStage } from './chat/avatar.js';
import { ChatApp } from './chat/chat.js';
import { ChatStore } from './chat/store.js';
import { mountPlans } from './plans.js';
import { watchUser, getProfile } from './auth.js';
import { esc } from './ui.js';

const avatar = new AvatarStage(document.getElementById('heroAvatar'));
const store = new ChatStore();
const chat = new ChatApp(document.getElementById('homeChat'), { variant: 'embed', avatar, store });
document.addEventListener('keydown', (e) => { if (document.activeElement && document.getElementById('homeChat').contains(document.activeElement)) chat.handleShortcut(e); });

const pm = document.getElementById('plansMount');
if (pm) mountPlans(pm, {});
watchUser(async (u) => {
  if (!u) return;
  const p = await getProfile(u.uid);
  const profile = p && !p._error ? p : null;
  chat.setUser(u, profile);
  store.attachUser(u.uid);
  if (pm) mountPlans(pm, { user: u, profile });
});

/* Equipo de agentes 24/7 */
fetch('/agents-status.json', { cache: 'no-cache' })
  .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
  .then((d) => {
    const team = document.getElementById('team');
    const label = { activo: 'Trabajando', espera: 'En espera', error: 'Con aviso', pausa: 'En pausa' };
    team.innerHTML = (d.agents || []).slice(0, 12).map((a) => `<article class="team-card"><div class="t-top"><span class="t-emoji" aria-hidden="true">${esc(a.emoji || '🤖')}</span><strong>${esc(a.name)}</strong></div><p>${esc(a.role || '')}</p><span class="chip ${a.status === 'activo' ? 'ok' : ''}">${esc(label[a.status] || a.status || 'En espera')}</span><p class="small">${esc(a.last_activity || '')}</p>${a.pr && /^https:\/\/github\.com\//.test(a.pr) ? `<a class="small" href="${esc(a.pr)}" rel="noopener" target="_blank">Ver propuesta</a>` : ''}</article>`).join('');
    const upd = Date.parse(d.updated);
    document.getElementById('teamUpdated').textContent = 'Última actualización: ' + (isNaN(upd) ? (d.updated || '—') : new Date(upd).toLocaleString('es-AR'));
  })
  .catch(() => { document.getElementById('team').innerHTML = '<p class="muted">El estado del equipo no está disponible en este momento.</p>'; });
