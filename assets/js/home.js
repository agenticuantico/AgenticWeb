/** Portada: chat embebido (con el hero neuronal sincronizado), planes y estado del equipo de agentes. */
import { ChatApp } from './chat/chat.js';
import { ChatStore } from './chat/store.js';
import { mountPlans } from './plans.js';
import { watchUser, getProfile } from './auth.js';
import { setIdTokenProvider } from './chat/engine.js';
import { esc } from './ui.js';

import { AvatarStage } from './chat/avatar.js';

/* Portada: personaje en vivo, liviano: sigue el cursor (o el último toque), respira y parpadea. Nada más.
   Los gestos completos (poses, manos, cejas) y los labios sincronizados con la voz van en la videollamada
   del chat (ventana minimizada), que recibe los estados del chat: escuchando → pensando → hablando. */
const heroEl = document.getElementById('heroChar');
if (heroEl) new AvatarStage(heroEl, { label: 'AgentiCuántico, asistente de inteligencia artificial', fit: 'contain', track: true, lite: true });
/* El chat de la portada no tiene avatar propio: este objeto solo refleja el estado en el cartel del hero. */
const avatar = { state: 'idle', setState(st) { this.state = st; }, pulse() {}, setVisemes() {}, setLevel() {}, load() { return Promise.resolve(); } };
const store = new ChatStore();
const chat = new ChatApp(document.getElementById('homeChat'), { variant: 'embed', avatar, store });
document.addEventListener('keydown', (e) => { if (document.activeElement && document.getElementById('homeChat').contains(document.activeElement)) chat.handleShortcut(e); });

const pm = document.getElementById('plansMount');
if (pm) mountPlans(pm, {});
watchUser(async (u) => {
  // El token va primero: un mensaje enviado mientras carga el perfil ya sale con la cuenta (no como invitado).
  setIdTokenProvider(u ? () => u.getIdToken() : null);
  if (!u) return;
  const p = await getProfile(u.uid);
  const profile = p && !p._error ? p : null;
  chat.setUser(u, profile);
  store.attachUser(u.uid);
  if (pm) mountPlans(pm, { user: u, profile });
});

/* Cartel del hero: estado del chat (mismos textos que antes, ya traducidos) */
{
  const HUD = {
    idle: ['Vías neuronales activas · En espera', 'Conectado al chat', '#9fff00'],
    listening: ['Vías neuronales activas · En espera', 'Conectado al chat', '#9fff00'],
    thinking: ['Razonamiento en proceso…', 'Análisis multi-agente', '#a855f7'],
    talking: ['Respondiendo', 'Texto y voz femenina', '#22c55e']
  };
  const st = document.getElementById('heroHudStatus'), dt = document.getElementById('heroHudDetail'), dot = document.getElementById('heroHudDot');
  const orig = avatar.setState.bind(avatar);
  avatar.setState = (s) => {
    orig(s);
    const h = HUD[s] || HUD.idle;
    if (st && st.textContent !== h[0]) st.textContent = h[0];
    if (dt && dt.textContent !== h[1]) dt.textContent = h[1];
    if (dot) dot.style.background = h[2];
  };
  const stage = document.getElementById('heroVisualWrapper');
  if (stage) stage.addEventListener('click', () => { const c = document.getElementById('chat'); c && c.scrollIntoView({ behavior: 'smooth' }); setTimeout(() => { const i = document.querySelector('#homeChat textarea'); i && i.focus({ preventScroll: true }); }, 500); });
}

/* Equipo de agentes 24/7 (tarjetas clásicas) */
function ago(iso) {
  const t = Date.parse(iso); if (!t) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 90) return 'hace instantes';
  if (s < 3600) return 'hace ' + Math.round(s / 60) + ' min';
  if (s < 86400) return 'hace ' + Math.round(s / 3600) + ' h';
  return 'hace ' + Math.round(s / 86400) + ' d';
}
fetch('/agents-status.json', { cache: 'no-cache' })
  .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
  .then((d) => {
    const grid = document.getElementById('teamGrid');
    grid.innerHTML = (d.agents || []).slice(0, 12).map((a) => {
      const st = a.status === 'activo' ? 'activo' : a.status === 'revision' ? 'revision' : 'espera';
      const label = st === 'activo' ? 'Activo' : st === 'revision' ? 'En revisión' : 'En espera';
      const link = '';
      return `<article class="agent-card"><div class="agent-top"><span class="agent-emoji agent-initials" aria-hidden="true">${esc(String(a.name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase())}</span><div class="agent-name">${esc(a.name)}<small>${esc(a.role || '')}</small></div><span class="agent-state ${st}">${label}</span></div><p class="agent-last">${esc(a.last_activity || 'Listo para su primera tarea programada.')}</p>${a.last_run || link ? `<div class="agent-meta"><span>${esc(ago(a.last_run))}</span>${link}</div>` : ''}</article>`;
    }).join('');
    document.getElementById('teamUpdated').innerHTML = `<span class="hero-hud-dot"></span><span>Actualizado ${esc(ago(d.updated) || '')}</span>`;
  })
  .catch(() => { document.getElementById('teamUpdated').innerHTML = '<span class="hero-hud-dot"></span><span>Estado no disponible</span>'; });
