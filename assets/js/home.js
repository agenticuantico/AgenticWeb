/** Portada: chat embebido (con el personaje sincronizado), ejemplos que rellenan el chat y planes. */
import { ChatApp } from './chat/chat.js?v=7.20.0';
import { ChatStore } from './chat/store.js';
import { mountPlans } from './plans.js?v=7.20.0';
import { watchUser, getProfile } from './auth.js';
import { setIdTokenProvider } from './chat/engine.js';

import { AvatarStage } from './chat/avatar.js?v=7.20.0';

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
    idle: ['En espera · escribe en el chat', 'Conectado al chat', '#9fff00'],
    listening: ['Te escucho', 'Habla cuando quieras', '#9fff00'],
    thinking: ['Pensando…', 'Preparando la respuesta', '#a855f7'],
    talking: ['Respondiendo', 'Por escrito y con voz', '#22c55e']
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

/* «Qué le puedes pedir hoy»: el ejemplo se escribe en el chat de arriba (no se envía solo) para que la persona lo ajuste. */
document.querySelectorAll('[data-ask]').forEach((b) => b.addEventListener('click', () => {
  const input = document.querySelector('#homeChat textarea');
  const c = document.getElementById('chat');
  if (!input) return;
  // Texto visible (ya traducido al idioma elegido), sin las comillas de cita.
  const shown = (b.querySelector('.hn-ask-t')?.textContent || '').trim().replace(/^[«“"]\s*|\s*[»”"]$/g, '');
  input.value = shown || b.getAttribute('data-ask') || '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  c && c.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'end' });
  setTimeout(() => { input.focus({ preventScroll: true }); try { input.setSelectionRange(input.value.length, input.value.length); } catch {} }, 450);
}));
