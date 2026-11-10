/** /planes.html: planes con login previo y ventana de pago (Mercado Pago y PayPal). */
import { mountPlans, openPayModal } from './plans.js?v=7.20.0';
import { watchUser, getProfile, mightBeSignedIn } from './auth.js';

const mount = document.getElementById('plansFull');
let user = null, profile = null;
const draw = () => mountPlans(mount, { user, profile, onChange: refresh });
async function refresh() { if (user) { const p = await getProfile(user.uid); profile = p && !p._error ? p : null; } draw(); }
draw();
watchUser(async (u) => {
  if (!u) return;
  user = u;
  await refresh();
  const want = new URLSearchParams(location.search).get('plan');
  if (['pro', 'empresa'].includes(want)) openPayModal(want, user, refresh);
}, { force: mightBeSignedIn() });
if (location.hash) setTimeout(() => document.getElementById('plan-' + location.hash.slice(1))?.scrollIntoView({ block: 'center' }), 400);
