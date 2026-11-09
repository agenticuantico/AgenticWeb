/**
 * /admin/: panel del dueño (CEO). El acceso se controla en las reglas de Firestore/RTDB
 * (admins/{uid} o correo verificado del dueño); esta interfaz solo lo refleja.
 */
import { h, icon, esc, toast, confirmDialog, fmtDate, timeAgo, hydrateIcons } from './ui.js';
import { CONFIG } from './config.js';
import * as auth from './auth.js';
import { getStore, getRtdb, friendlyError } from './firebase.js';
import { DEFAULT_SYSTEM, clearSystemCache } from './sysconfig.js';
import { renderLeads, renderAgentsControl } from './admin-control.js?v=7.11.0';
import { revenueKpis, renderRevenueCard } from './admin-revenue.js';
import { renderGovernance } from './admin-governance.js';
import { renderTeam } from './admin-team.js?v=7.11.0';
import * as staffUi from './admin-staff.js?v=7.11.0';
import { renderWorkspace, renderPerf } from './admin-espacio.js?v=7.11.0';
import { renderKpis } from './admin-indicadores.js?v=7.11.0';

/** Roles con canales en el Espacio de trabajo (el servidor vuelve a controlar cada canal). */
const WS_ROLES = new Set(['ceo', 'coceo', 'supervisor']);

const root = document.getElementById('adminRoot');
const CC_NAMES = new Intl.DisplayNames(['es'], { type: 'region' });
const ccName = (cc) => { try { return cc === 'XX' ? 'Desconocido' : CC_NAMES.of(cc); } catch { return cc; } };
const flag = (cc) => `/assets/flags/${/^[A-Z]{2}$/.test(cc) && cc !== 'XX' ? cc.toLowerCase() : 'xx'}.svg`;
const FLAG_LABELS = { chat: 'Chat', voice: 'Voz', avatar: 'Avatar 3D', signups: 'Registros nuevos', agentMode: 'Modo agente', payments: 'Pagos', agents247: 'Agentes 24/7' };

async function logEvent(user, type, detail = '') {
  try {
    const { fs, db } = await getStore();
    await fs.addDoc(fs.collection(db, 'securityEvents'), { type, detail: String(detail).slice(0, 300), uid: user ? user.uid : null, email: user ? user.email : null, at: fs.serverTimestamp(), ua: navigator.userAgent.slice(0, 160) });
  } catch {}
}

/* =================== Acceso =================== */
async function isOwner(mail) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(mail));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('') === CONFIG.OWNER_EMAIL_SHA256;
  } catch { return false; }
}
function loginGate(msg) {
  root.innerHTML = '';
  const email = h('input', { class: 'input', type: 'email', autocomplete: 'username', required: true, placeholder: 'Correo', 'aria-label': 'Correo' });
  const pass = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', required: true, 'aria-label': 'Contraseña', placeholder: 'Contraseña' });
  const err = h('p', { class: 'error-text', hidden: true });
  const info = h('p', { class: 'small', hidden: true });
  const submit = h('button', { class: 'btn btn-primary full', type: 'submit' }, 'Ingresar');
  const form = h('form', { class: 'stack', novalidate: true }, h('label', { class: 'label' }, 'Correo'), email, h('label', { class: 'label' }, 'Contraseña'), pass, err, submit);
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); err.hidden = true;
    if (!email.value || !pass.value) { err.textContent = 'Completá correo y contraseña.'; err.hidden = false; return; }
    submit.disabled = true;
    try { await auth.signInEmail(email.value, pass.value); }
    catch (ex) { err.textContent = friendlyError(ex); err.hidden = false; }
    finally { submit.disabled = false; }
  });
  const google = h('button', { class: 'btn full', type: 'button', html: icon('google') + 'Continuar con Google' });
  google.onclick = async () => { try { await auth.signInGoogle({ termsAccepted: true }); } catch (ex) { err.textContent = friendlyError(ex); err.hidden = false; } };
  const reset = h('button', { class: 'linklike small', type: 'button' }, 'Crear contraseña / olvidé mi contraseña');
  reset.onclick = async () => {
    // Solo se envía si el correo escrito es el de la cuenta dueña; el mensaje es el mismo en cualquier caso.
    err.hidden = true;
    const v = (email.value || '').trim().toLowerCase();
    if (!v) { err.textContent = 'Escribí el correo de la cuenta.'; err.hidden = false; return; }
    try { if (await isOwner(v)) await auth.resetPassword(v); } catch {}
    info.textContent = 'Si el correo corresponde a una cuenta con acceso, te llegará un enlace para crear o cambiar la contraseña.'; info.hidden = false;
  };
  const team = h('button', { class: 'linklike small', type: 'button' }, 'Soy del equipo (Co-CEO, supervisor…): entrar con mi correo y clave');
  team.onclick = () => { sessionStorage.setItem('ac.panelMode', 'equipo'); panelGate(); };
  root.append(h('div', { class: 'card gate gate-login' }, h('span', { class: 'gate-ic', html: icon('lock') }), h('h1', {}, 'Panel de control'),
    h('p', { class: 'muted' }, msg || 'Acceso exclusivo de la cuenta dueña de AgentiCuántico.'),
    google, h('div', { class: 'or' }, h('span', {}, 'o con correo y contraseña')), form, reset, h('div', { class: 'gate-links' }, team), info,
    h('p', { class: 'tiny muted', style: 'margin-top:12px' }, 'Recomendado: verificación en dos pasos activada en la cuenta de Google.')));
}

/**
 * Acceso con clave (dueño y equipo humano). En la copia de prueba es el único acceso (PREVIEW_KEY_LOGIN);
 * en producción se activa con PANEL_LOGIN. Los permisos de cada rol los aplica el servidor en cada pedido.
 */
async function panelGate() {
  sessionStorage.removeItem('ac.previewKey');   // clave vieja de la copia de prueba: ya no se usa
  const hash = new URLSearchParams(location.hash.slice(1));
  const start = () => panelGate();
  if (hash.get('restablecer')) return staffUi.resetGate(root, hash.get('restablecer'), () => { history.replaceState(null, '', location.pathname); start(); });
  if (hash.get('invitacion')) return staffUi.inviteGate(root, hash.get('invitacion'), (t, me) => renderPanel(t, me));
  const s = staffUi.session.get();
  if (s) {
    try { const me = await staffUi.api('/api/panel/me', { token: s.t }); return renderPanel(s.t, me); }
    catch (e) { if (e.code !== 'network') staffUi.session.clear(); else return staffUi.loginGate(root, renderPanel, e.message); }
  }
  staffUi.loginGate(root, renderPanel);
  if (CONFIG.PREVIEW_KEY_LOGIN !== true) {   // producción: el dueño sigue entrando con Google
    const g = h('button', { class: 'linklike small', type: 'button' }, 'Soy el dueño: entrar con Google');
    g.onclick = () => { sessionStorage.removeItem('ac.panelMode'); location.reload(); };
    root.querySelector('.gate-links')?.append(g);
  }
}
function renderPanel(token, me) {
  root.innerHTML = '';
  const perms = new Set(me.perms || []);
  const hdr = { 'X-Panel-Session': token };
  const u = me.user || {};
  const out = async () => { try { await staffUi.api('/api/panel/logout', { method: 'POST', token, body: {} }); } catch {} staffUi.session.clear(); panelGate(); };
  root.append(h('div', { class: 'admin-head' },
    h('div', {}, h('p', { class: 'eyebrow' }, (u.owner ? 'Panel del CEO' : 'Panel del equipo') + (CONFIG.PREVIEW_KEY_LOGIN === true ? ' · copia de prueba' : '')), h('h1', {}, 'AgentiCuántico · Control'),
      h('p', { class: 'small muted panel-who' }, (u.name || u.email || '') + ' · ' + (u.roleLabel || u.role || ''))),
    h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', html: icon('lock') + 'Cambiar clave', onclick: () => staffUi.changeKeyDialog(token) }), h('button', { class: 'btn btn-ghost', type: 'button', html: icon('logout') + 'Salir', onclick: out }))));
  if (!perms.has('team.order')) root.append(h('div', { class: 'alert' }, h('span', { html: icon('info') }), h('div', {}, 'Tu rol es de solo lectura en el equipo de agentes: podés mirar, pero no dar órdenes ni aprobar.')));
  const tabBar = h('nav', { class: 'admin-tabs', role: 'tablist', 'aria-label': 'Secciones del panel' });
  const TABS = [['equipo', 'Equipo', 'users'], ['agentes', 'Agentes', 'spark']];
  if (WS_ROLES.has(u.role)) TABS.push(['espacio', 'Espacio de trabajo', 'send']);
  if (perms.has('audit.view')) TABS.push(['indicadores', 'Indicadores', 'chart']);
  TABS.push(['rendimiento', 'Rendimiento', 'bolt']);
  if (perms.has('staff.view')) TABS.push(['humano', 'Equipo humano', 'user']);
  if (perms.has('audit.view')) TABS.push(['bitacora', 'Bitácora', 'clock']);
  if (perms.has('owner.settings') && u.owner) TABS.push(['configuracion', 'Configuración', 'settings']);
  const panes = {}; const boxes = {};
  for (const [id] of TABS) { boxes[id] = h('div', { class: 'stack-lg' }); panes[id] = h('div', { role: 'tabpanel', hidden: true }, boxes[id]); }
  const loaded = {};
  const show = (id) => {
    if (!panes[id]) id = 'equipo';
    for (const [kk, el] of Object.entries(panes)) el.hidden = kk !== id;
    tabBar.querySelectorAll('[role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
    history.replaceState(null, '', '#' + id);
    if (loaded[id]) return; loaded[id] = 1;
    if (id === 'equipo') renderTeam(boxes.equipo, null, { extraHeaders: hdr, owner: u.role === 'ceo' });
    if (id === 'agentes') import('./admin-agents.js?v=7.11.0').then((m) => m.renderAutonomy(boxes.agentes, null, { extraHeaders: hdr }));
    if (id === 'espacio') renderWorkspace(boxes.espacio, token, me);
    if (id === 'rendimiento') renderPerf(boxes.rendimiento, token, me);
    if (id === 'indicadores') renderKpis(boxes.indicadores, token, me);
    if (id === 'humano') staffUi.renderStaff(boxes.humano, token, me);
    if (id === 'bitacora') staffUi.renderAudit(boxes.bitacora, token);
    if (id === 'configuracion') staffUi.renderSettings(boxes.configuracion, token);
  };
  for (const [id, label, ic] of TABS) tabBar.append(h('button', { type: 'button', role: 'tab', 'data-tab': id, html: icon(ic) + `<span>${label}</span>`, onclick: () => show(id) }));
  root.append(tabBar, ...Object.values(panes));
  show(location.hash.slice(1) || 'equipo');
}

const wantsPanel = () => { const hs = new URLSearchParams(location.hash.slice(1)); return !!(hs.get('restablecer') || hs.get('invitacion') || staffUi.session.get() || sessionStorage.getItem('ac.panelMode') === 'equipo'); };
if (CONFIG.PREVIEW_KEY_LOGIN === true || CONFIG.PANEL_LOGIN === true || wantsPanel()) panelGate();
else {
auth.completeGoogleRedirect?.().catch(() => {});
auth.watchUser(async (user) => {
  if (!user) { loginGate(); return; }
  const isOwnerEmail = await isOwner((user.email || '').toLowerCase());
  const ok = isOwnerEmail && (await auth.isAdmin(user));
  if (!ok && isOwnerEmail && user.emailVerified) {
    root.innerHTML = '';
    const btn = h('button', { class: 'btn btn-primary', type: 'button' }, 'Activar acceso de dueño');
    btn.onclick = async () => { btn.disabled = true; try { await auth.bootstrapOwner(user); logEvent(user, 'admin_bootstrap'); location.reload(); } catch (e) { btn.disabled = false; toast('No se pudo activar: ' + friendlyError(e) + ' Verificá que las reglas estén publicadas.', 'error', 8000); } };
    root.append(h('div', { class: 'card gate' }, h('span', { class: 'gate-ic', html: icon('shield') }), h('h1', {}, 'Primer ingreso del dueño'), h('p', { class: 'muted' }, 'Tu cuenta todavía no tiene el rol de administración. Se crea una sola vez (admins/' + user.uid.slice(0, 6) + '…) y las reglas lo verifican con el token de tu correo verificado.'), btn));
    return;
  }
  if (!ok && isOwnerEmail && !user.emailVerified) {
    loginGate('Verificá el correo de la cuenta dueña (el enlace de «Crear contraseña» también lo verifica) y volvé a ingresar.');
    return;
  }
  if (!ok) {
    logEvent(user, 'admin_denied', location.pathname);
    root.innerHTML = '';
    root.append(h('div', { class: 'card gate' }, h('span', { class: 'gate-ic', html: icon('shield') }), h('h1', {}, 'Acceso denegado'), h('p', { class: 'muted' }, 'Esta cuenta no tiene permisos de administración. El intento quedó registrado.'),
      h('div', { class: 'row', style: 'justify-content:center' }, h('a', { class: 'btn', href: '/' }, 'Volver al inicio'), h('button', { class: 'btn btn-ghost', type: 'button', onclick: async () => { await auth.signOutUser(); location.reload(); } }, 'Cambiar de cuenta'))));
    return;
  }
  if (!sessionStorage.getItem('ac.adminLogged')) { sessionStorage.setItem('ac.adminLogged', '1'); logEvent(user, 'admin_login'); }
  renderDashboard(user);
}, { force: true });
}

/* =================== Gráficos SVG livianos =================== */
function areaChart(points, { height = 180 } = {}) {
  const w = 640, hgt = height, pad = 28;
  const max = Math.max(1, ...points.map((p) => p.v));
  const x = (i) => pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1);
  const y = (v) => hgt - pad - (v / max) * (hgt - pad * 2);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const area = `${line}L${x(points.length - 1)},${hgt - pad}L${x(0)},${hgt - pad}Z`;
  const ticks = [0, Math.round(max / 2), max];
  return `<svg viewBox="0 0 ${w} ${hgt}" class="chart" role="img" aria-label="Visitas por día"><defs><linearGradient id="ga" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#d9b25f" stop-opacity=".45"/><stop offset="1" stop-color="#d9b25f" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map((t) => `<line x1="${pad}" x2="${w - pad}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${pad - 6}" y="${y(t) + 4}" text-anchor="end" class="axis">${t}</text>`).join('')}
    <path d="${area}" fill="url(#ga)"/><path d="${line}" fill="none" stroke="#b8892f" stroke-width="2.2" stroke-linejoin="round"/>
    ${points.map((p, i) => (i % Math.ceil(points.length / 6) === 0 || i === points.length - 1 ? `<text x="${x(i)}" y="${hgt - 8}" text-anchor="middle" class="axis">${esc(p.label)}</text>` : '')).join('')}
    ${points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.v)}" r="3" fill="#b8892f"><title>${esc(p.label)}: ${p.v}</title></circle>`).join('')}</svg>`;
}
function bars(entries, { total, labeler = (k) => k, max = 8, flagged = false } = {}) {
  const list = entries.sort((a, b) => b[1] - a[1]).slice(0, max);
  const sum = total || list.reduce((a, [, v]) => a + v, 0) || 1;
  if (!list.length) return '<p class="muted small">Sin datos todavía.</p>';
  return '<div class="bars">' + list.map(([k, v]) => `<div class="bar-row">${flagged ? `<img class="flag" src="${flag(k)}" alt="" width="20" height="20" loading="lazy">` : ''}<span class="bar-label">${esc(labeler(k))}</span><span class="bar-track"><i style="width:${((v / sum) * 100).toFixed(1)}%"></i></span><span class="bar-val">${v.toLocaleString('es-AR')} <small>${Math.round((v / sum) * 100)}%</small></span></div>`).join('') + '</div>';
}
function donut(entries, labels = {}) {
  const colors = ['#b8892f', '#16151a', '#8fd41b', '#2f5fd0', '#c2362b', '#7c3aed', '#0d9488'];
  const total = entries.reduce((a, [, v]) => a + v, 0);
  if (!total) return '<p class="muted small">Sin datos todavía.</p>';
  let acc = 0;
  const r = 52, c = 2 * Math.PI * r;
  const segs = entries.map(([k, v], i) => { const len = (v / total) * c; const s = `<circle r="${r}" cx="70" cy="70" fill="none" stroke="${colors[i % colors.length]}" stroke-width="22" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-acc}" transform="rotate(-90 70 70)"><title>${esc(labels[k] || k)}: ${v}</title></circle>`; acc += len; return s; }).join('');
  const legend = entries.map(([k, v], i) => `<li><i style="background:${colors[i % colors.length]}"></i>${esc(labels[k] || k)} <strong>${Math.round((v / total) * 100)}%</strong></li>`).join('');
  return `<div class="donut"><svg viewBox="0 0 140 140" role="img" aria-label="Distribución">${segs}<text x="70" y="76" text-anchor="middle" class="donut-total">${total.toLocaleString('es-AR')}</text></svg><ul>${legend}</ul></div>`;
}
let worldP;
async function worldMap(countryCounts) {
  worldP = worldP || fetch('/assets/data/world.json').then((r) => r.json());
  const w = await worldP;
  const max = Math.max(1, ...Object.values(countryCounts));
  const color = (v) => { if (!v) return 'var(--surface-3)'; const t = Math.sqrt(v / max); return `color-mix(in srgb, #b8892f ${Math.round(18 + t * 82)}%, #f6efe0)`; };
  return `<svg viewBox="${w.viewBox}" class="world" role="img" aria-label="Mapa de visitas por país">${Object.entries(w.paths).map(([cc, d]) => `<path d="${d}" fill="${color(countryCounts[cc] || 0)}"><title>${esc(ccName(cc))}: ${(countryCounts[cc] || 0).toLocaleString('es-AR')}</title></path>`).join('')}</svg>`;
}
const sumMaps = (days, key) => { const out = {}; for (const d of days) for (const [k, v] of Object.entries(d[key] || {})) out[k] = (out[k] || 0) + (Number(v) || 0); return out; };

/* =================== Panel =================== */
async function renderDashboard(user) {
  root.innerHTML = '';
  const head = h('div', { class: 'admin-head' },
    h('div', {}, h('p', { class: 'eyebrow' }, 'Panel del CEO'), h('h1', {}, 'AgentiCuántico · Control')),
    h('div', { class: 'row' },
      h('select', { class: 'select', id: 'range', 'aria-label': 'Período', style: 'width:auto' }, h('option', { value: '7' }, 'Últimos 7 días'), h('option', { value: '30', selected: true }, 'Últimos 30 días'), h('option', { value: '90' }, 'Últimos 90 días')),
      h('button', { class: 'btn', type: 'button', onclick: () => renderDashboard(user), html: icon('refresh') + 'Actualizar' }),
      h('button', { class: 'btn btn-danger', type: 'button', id: 'killBtn', html: icon('power') + 'Parada de emergencia' })));
  root.append(head);
  const TABS = [['analitica', 'Analítica', 'chart'], ['equipo', 'Equipo', 'users'], ['espacio', 'Espacio de trabajo', 'send'], ['indicadores', 'Indicadores', 'chart'], ['rendimiento', 'Rendimiento', 'bolt'], ['leads', 'Leads', 'users'], ['agentes', 'Agentes', 'spark'], ['humano', 'Equipo humano', 'user'], ['bitacora', 'Bitácora', 'clock'], ['gobernanza', 'Gobernanza IA', 'flag'], ['operacion', 'Operación', 'shield'], ['configuracion', 'Configuración', 'settings']];
  const tabBar = h('nav', { class: 'admin-tabs', role: 'tablist', 'aria-label': 'Secciones del panel' });
  const panes = {};
  const kpis = h('div', { class: 'kpis' });
  const grid = h('div', { class: 'admin-grid' });
  const opsGrid = h('div', { class: 'admin-grid' });
  const leadsBox = h('div', { class: 'stack-lg' });
  const agentsBox = h('div', { class: 'stack-lg' });
  const govBox = h('div', { class: 'stack-lg gov-admin' });
  const teamBox = h('div', { class: 'stack-lg' });
  panes.analitica = h('div', { role: 'tabpanel' }, kpis, grid);
  panes.equipo = h('div', { role: 'tabpanel', hidden: true }, teamBox);
  panes.leads = h('div', { role: 'tabpanel', hidden: true }, leadsBox);
  panes.agentes = h('div', { role: 'tabpanel', hidden: true }, agentsBox);
  panes.gobernanza = h('div', { role: 'tabpanel', hidden: true }, govBox);
  panes.operacion = h('div', { role: 'tabpanel', hidden: true }, opsGrid);
  const extra = {};
  for (const id of ['espacio', 'indicadores', 'rendimiento', 'humano', 'bitacora', 'configuracion']) { extra[id] = h('div', { class: 'stack-lg' }); panes[id] = h('div', { role: 'tabpanel', hidden: true }, extra[id]); }
  // Secciones del equipo humano: la cuenta Google del dueño se cambia por una sesión del panel (el servidor verifica el token).
  let panelP = null;
  const panelSession = () => (panelP ||= (async () => {
    const s0 = staffUi.session.get();
    if (s0) { try { const me = await staffUi.api('/api/panel/me', { token: s0.t }); if (me.user && me.user.owner) return { token: s0.t, me }; } catch {} }
    const idt = await user.getIdToken();
    const r = await fetch(String(CONFIG.API_BASE || '').replace(/\/+$/, '') + '/api/panel/login/google', { method: 'POST', headers: { Authorization: 'Bearer ' + idt, 'Content-Type': 'application/json' }, body: '{}', cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(staffUi.ERR[j.error] || j.error || 'error_' + r.status);
    staffUi.session.set(j.token, j.expiresAt);
    return { token: j.token, me: { user: j.user, perms: j.perms } };
  })().catch((e) => { panelP = null; throw e; }));
  const withPanel = (box, fn) => { box.replaceChildren(h('div', { class: 'skeleton', style: 'height:120px' })); panelSession().then(({ token, me }) => fn(box, token, me)).catch((e) => box.replaceChildren(h('div', { class: 'alert warn' }, h('span', { html: icon('warn') }), h('div', {}, 'No se pudo abrir esta sección: ' + e.message)))); };
  const loaded = {};
  const showTab = (id) => {
    for (const [k, el] of Object.entries(panes)) el.hidden = k !== id;
    tabBar.querySelectorAll('[role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
    history.replaceState(null, '', '#' + id);
    if (id === 'equipo' && !loaded.equipo) { loaded.equipo = 1; renderTeam(teamBox, user, { owner: true }); }
    if (extra[id] && !loaded[id]) {
      loaded[id] = 1;
      if (id === 'espacio') withPanel(extra[id], renderWorkspace);
      if (id === 'rendimiento') withPanel(extra[id], renderPerf);
      if (id === 'indicadores') withPanel(extra[id], renderKpis);
      if (id === 'humano') withPanel(extra[id], (b, t, me) => staffUi.renderStaff(b, t, me));
      if (id === 'bitacora') withPanel(extra[id], (b, t) => staffUi.renderAudit(b, t));
      if (id === 'configuracion') withPanel(extra[id], (b, t) => staffUi.renderSettings(b, t));
    }
    if (id === 'leads' && !loaded.leads) { loaded.leads = 1; renderLeads(leadsBox, user); }
    if (id === 'agentes' && !loaded.agentes) { loaded.agentes = 1; renderAgentsControl(agentsBox, user); }
    if (id === 'gobernanza' && !loaded.gobernanza) { loaded.gobernanza = 1; renderGovernance(govBox, user); }
  };
  for (const [id, label, ic] of TABS) tabBar.append(h('button', { type: 'button', role: 'tab', 'data-tab': id, html: icon(ic) + `<span>${label}</span>`, onclick: () => showTab(id) }));
  root.append(tabBar, ...Object.values(panes));
  const card = (title, cls = '', extra = null) => { const c = h('section', { class: 'card panel ' + cls }, h('div', { class: 'panel-head' }, h('h2', {}, title), extra)); grid.append(c); return c; };

  const { fs, db } = await getStore();
  const days = Number(document.getElementById('range').value || 30);
  document.getElementById('range').onchange = () => renderDashboard(user);

  // --- Estadísticas diarias ---
  const start = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  let stats = [];
  let statsErr = null;
  try {
    const s = await fs.getDocs(fs.query(fs.collection(db, 'stats_daily'), fs.where(fs.documentId(), '>=', start)));
    stats = s.docs.map((d) => ({ day: d.id, ...d.data() }));
  } catch (e) { statsErr = friendlyError(e); }
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const row = stats.find((x) => x.day === d);
    series.push({ label: d.slice(8, 10) + '/' + d.slice(5, 7), v: row ? Number(row.views || 0) : 0, u: row ? Number(row.visitors || 0) : 0, s: row ? Number(row.signups || 0) : 0 });
  }
  const today = series[series.length - 1];
  const totalViews = series.reduce((a, p) => a + p.v, 0);
  const totalVisitors = series.reduce((a, p) => a + p.u, 0);
  const totalSignups = series.reduce((a, p) => a + p.s, 0);

  // --- Usuarios y planes ---
  const counts = {};
  try {
    const col = fs.collection(db, 'users');
    const [all, pro, emp] = await Promise.all([fs.getCount(col), fs.getCount(fs.query(col, fs.where('plan', '==', 'pro'))), fs.getCount(fs.query(col, fs.where('plan', '==', 'empresa')))]);
    counts.all = all.data().count; counts.pro = pro.data().count; counts.empresa = emp.data().count; counts.gratis = Math.max(0, counts.all - counts.pro - counts.empresa);
  } catch (e) { counts.err = friendlyError(e); }

  const kpi = (label, value, sub, ic) => h('div', { class: 'kpi' }, h('span', { class: 'kpi-ic', html: icon(ic) }), h('div', {}, h('small', {}, label), h('strong', {}, value), sub ? h('span', { class: 'muted tiny' }, sub) : null));
  const liveEl = h('strong', {}, '—');
  kpis.append(
    kpi('Visitas hoy', today.v.toLocaleString('es-AR'), `${totalViews.toLocaleString('es-AR')} en ${days} días`, 'eye'),
    kpi('Visitantes únicos', totalVisitors.toLocaleString('es-AR'), 'por día, sumados', 'users'),
    h('div', { class: 'kpi live' }, h('span', { class: 'kpi-ic', html: icon('globe') }), h('div', {}, h('small', {}, 'En línea ahora'), liveEl, h('span', { class: 'muted tiny' }, 'presencia en tiempo real'))),
    kpi('Registros', totalSignups.toLocaleString('es-AR'), (typeof counts.all === 'number' ? counts.all.toLocaleString('es-AR') : '—') + ' usuarios en total', 'userPlus'),
    ...revenueKpis(user));
  // Ingresos reales por moneda (Mercado Pago ARS · PayPal USD), desde el Worker (D1)
  renderRevenueCard(grid, user);
  if (statsErr) grid.append(h('div', { class: 'alert warn wide' }, h('span', { html: icon('warn') }), h('div', {}, 'No se pudieron leer las estadísticas: ', statsErr, ' Publicá las reglas de Firestore (firebase/firestore.rules).')));

  card('Visitas por día', 'span-2').insertAdjacentHTML('beforeend', areaChart(series));
  const countries = sumMaps(stats, 'country');
  const mapCard = card('Visitantes por país', 'span-2');
  const mapWrap = h('div', { class: 'map-wrap' }, h('div', { class: 'skeleton', style: 'height:260px' }));
  mapCard.append(h('div', { class: 'map-grid' }, mapWrap, h('div', { html: bars(Object.entries(countries), { labeler: ccName, flagged: true, max: 10 }) })));
  worldMap(countries).then((svg) => { mapWrap.innerHTML = svg; });
  card('Dispositivos').insertAdjacentHTML('beforeend', donut(Object.entries(sumMaps(stats, 'device')), { mobile: 'Teléfono', desktop: 'Computadora', tablet: 'Tablet' }));
  card('Sistemas operativos').insertAdjacentHTML('beforeend', bars(Object.entries(sumMaps(stats, 'os'))));
  card('Navegadores').insertAdjacentHTML('beforeend', bars(Object.entries(sumMaps(stats, 'browser'))));
  card('Páginas más vistas').insertAdjacentHTML('beforeend', bars(Object.entries(sumMaps(stats, 'page')), { labeler: (k) => (k === 'inicio' ? '/' : '/' + k.replace(/_/g, '/')) }));
  card('Origen del tráfico').insertAdjacentHTML('beforeend', bars(Object.entries(sumMaps(stats, 'ref')), { labeler: (k) => k.replace(/_/g, '.') }));
  card('Planes').insertAdjacentHTML('beforeend', counts.err ? `<p class="muted small">${esc(counts.err)}</p>` : donut([['gratis', counts.gratis], ['pro', counts.pro], ['empresa', counts.empresa]], { gratis: 'Gratis', pro: 'Pro', empresa: 'Empresa' }));
  const hours = sumMaps(stats, 'hour');
  card('Horario de visitas (UTC)').insertAdjacentHTML('beforeend', `<div class="hours">${Array.from({ length: 24 }, (_, i) => { const k = String(i).padStart(2, '0'); const v = hours[k] || 0; const m = Math.max(1, ...Object.values(hours)); return `<i style="height:${Math.max(4, (v / m) * 100)}%" title="${k}h: ${v}"></i>`; }).join('')}</div><div class="hours-axis"><span>0h</span><span>12h</span><span>23h</span></div>`);

  // --- En vivo (RTDB) ---
  const liveCard = card('En vivo', '', h('span', { class: 'chip ok' }, h('span', { class: 'dot' }), 'tiempo real'));
  const liveBody = h('div', {}, h('p', { class: 'muted small' }, 'Conectando…'));
  liveCard.append(liveBody);
  const liveMapCard = card('Mapa en vivo', 'span-2', h('span', { class: 'chip ok' }, h('span', { class: 'dot' }), 'ahora'));
  const liveMap = h('div', { class: 'map-wrap' }, h('div', { class: 'skeleton', style: 'height:220px' }));
  liveMapCard.append(liveMap);
  getRtdb().then(({ rt, db: rdb }) => {
    rt.onValue(rt.ref(rdb, 'presence'), (snap) => {
      const v = snap.val() || {};
      const list = Object.values(v).filter((p) => p && Date.now() - (p.t || 0) < 6 * 3600_000);
      liveEl.textContent = list.length.toLocaleString('es-AR');
      const byC = {}, byD = {}, byP = {};
      list.forEach((p) => { byC[p.c] = (byC[p.c] || 0) + 1; byD[p.d] = (byD[p.d] || 0) + 1; byP[p.p] = (byP[p.p] || 0) + 1; });
      worldMap(byC).then((svg) => { liveMap.innerHTML = svg; });
      liveBody.innerHTML = `<p style="font-size:2rem;font-weight:700;margin:0">${list.length}</p><p class="muted small">usuarios conectados</p>` + bars(Object.entries(byC), { labeler: ccName, flagged: true, max: 6 }) + bars(Object.entries(byD), { labeler: (k) => ({ mobile: 'Teléfono', desktop: 'Computadora', tablet: 'Tablet' }[k] || k) }) + bars(Object.entries(byP), { labeler: (k) => (k === 'inicio' ? '/' : '/' + k), max: 5 });
    }, (e) => { liveBody.innerHTML = `<p class="muted small">Presencia no disponible: ${esc(friendlyError(e))} Publicá firebase/database.rules.json.</p>`; liveMap.innerHTML = '<p class="muted small">Sin datos de presencia.</p>'; });
  }).catch(() => { liveBody.innerHTML = '<p class="muted small">Realtime Database no disponible.</p>'; });

  // --- Ranking de países por período (todo / 7 días / hoy) ---
  const rankCard = card('Ranking de países', 'span-2');
  const rankSeg = h('div', { class: 'seg seg-sm', role: 'tablist', 'aria-label': 'Período del ranking' });
  const rankBody = h('div', {});
  rankCard.querySelector('.panel-head').append(rankSeg);
  rankCard.append(rankBody);
  let allStats = null;
  const drawRank = async (period) => {
    rankSeg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.p === period)));
    let src = [];
    if (period === 'hoy') src = stats.filter((d) => d.day === new Date().toISOString().slice(0, 10));
    else if (period === '7d') { const from = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10); src = stats.filter((d) => d.day >= from); }
    else {
      if (!allStats) { try { const q = await fs.getDocs(fs.collection(db, 'stats_daily')); allStats = q.docs.map((d) => ({ day: d.id, ...d.data() })); } catch { allStats = stats; } }
      src = allStats;
    }
    rankBody.innerHTML = bars(Object.entries(sumMaps(src, 'country')), { labeler: ccName, flagged: true, max: 15 });
  };
  for (const [p, l] of [['todo', 'Histórico'], ['7d', '7 días'], ['hoy', 'Hoy']]) rankSeg.append(h('button', { type: 'button', role: 'tab', 'data-p': p, onclick: () => drawRank(p) }, l));
  drawRank('7d');

  // --- Herramientas ---
  renderSystemTools(opsGrid, user, fs, db);
  renderSubscriptions(opsGrid, user, fs, db);
  renderUsers(opsGrid, user, fs, db);
  renderPaymentsLog(opsGrid, fs, db);
  renderAgents(opsGrid);
  renderSecurity(opsGrid, user, fs, db);
  hydrateIcons(root);
  const startTab = (location.hash || '').slice(1);
  showTab(TABS.some(([id]) => id === startTab) ? startTab : 'analitica');
}

async function renderSystemTools(grid, user, fs, db) {
  const c = h('section', { class: 'card panel span-2' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Sistema'), h('a', { class: 'btn btn-sm btn-ghost', href: CONFIG.GITHUB.ACTIONS_DEV, target: '_blank', rel: 'noopener', html: icon('external') + 'Actions (privado)' }), h('a', { class: 'btn btn-sm btn-ghost', href: CONFIG.GITHUB.ACTIONS_WEB, target: '_blank', rel: 'noopener', html: icon('external') + 'Actions (sitio)' })));
  grid.prepend(c);
  let sys = structuredClone(DEFAULT_SYSTEM);
  let readErr = null;
  try { const s = await fs.getDoc(fs.doc(db, 'config', 'system')); if (s.exists()) sys = { ...sys, ...s.data(), flags: { ...sys.flags, ...(s.data().flags || {}) }, announcement: { ...sys.announcement, ...(s.data().announcement || {}) } }; }
  catch (e) { readErr = friendlyError(e); }
  const save = async (patch, label) => {
    try {
      await fs.setDoc(fs.doc(db, 'config', 'system'), { ...patch, updatedAt: fs.serverTimestamp(), updatedBy: user.email }, { merge: true });
      clearSystemCache();
      logEvent(user, 'config_change', label);
      toast('Guardado: ' + label, 'ok');
    } catch (e) { toast(friendlyError(e), 'error', 6000); }
  };
  if (readErr) c.append(h('div', { class: 'alert warn' }, 'Configuración no disponible: ', readErr));
  if (sys.killSwitch) c.append(h('div', { class: 'alert danger' }, h('span', { html: icon('power') }), h('div', {}, h('strong', {}, 'Parada de emergencia ACTIVA. '), 'El sitio muestra mantenimiento, el chat y los registros están apagados y los agentes 24/7 y de seguridad saltean sus ejecuciones. ', h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => { if (await confirmDialog({ title: 'Reactivar el sitio', text: '¿Desactivar la parada de emergencia?', ok: 'Reactivar' })) { await save({ killSwitch: false }, 'killSwitch=false'); renderDashboard(user); } } }, 'Reactivar'))));
  const flagsBox = h('div', { class: 'flags' });
  for (const [k, label] of Object.entries(FLAG_LABELS)) {
    const input = h('input', { type: 'checkbox', checked: sys.flags[k] !== false || null, 'aria-label': label });
    input.addEventListener('change', () => save({ flags: { [k]: input.checked } }, `${label}: ${input.checked ? 'encendido' : 'apagado'}`));
    flagsBox.append(h('label', { class: 'flag-row' }, h('span', {}, label), h('span', { class: 'switch' }, input, h('span'))));
  }
  const annText = h('input', { class: 'input', value: sys.announcement.text || '', maxlength: 300, placeholder: 'Texto del anuncio', 'aria-label': 'Texto del anuncio' });
  const annLevel = h('select', { class: 'select', 'aria-label': 'Tipo de anuncio', style: 'width:auto' }, ...[['info', 'Informativo'], ['warn', 'Aviso'], ['danger', 'Urgente']].map(([v, l]) => h('option', { value: v, selected: sys.announcement.level === v || null }, l)));
  const annOn = h('input', { type: 'checkbox', checked: sys.announcement.active || null, 'aria-label': 'Mostrar anuncio' });
  const mtOn = h('input', { type: 'checkbox', checked: sys.maintenance || null, 'aria-label': 'Modo mantenimiento' });
  const mtMsg = h('input', { class: 'input', value: sys.maintenanceMessage || '', maxlength: 400, placeholder: 'Mensaje de mantenimiento', 'aria-label': 'Mensaje de mantenimiento' });
  c.append(h('div', { class: 'sys-grid' },
    h('div', {}, h('h3', {}, 'Funciones'), flagsBox),
    h('div', { class: 'stack' },
      h('h3', {}, 'Anuncio en el sitio'), annText, h('div', { class: 'row' }, annLevel, h('label', { class: 'check' }, annOn, h('span', {}, 'Mostrar')), h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: () => save({ announcement: { text: annText.value.trim(), level: annLevel.value, active: annOn.checked } }, 'anuncio') }, 'Publicar')),
      h('h3', { style: 'margin-top:16px' }, 'Mantenimiento'), mtMsg, h('div', { class: 'row' }, h('label', { class: 'check' }, mtOn, h('span', {}, 'Sitio en mantenimiento')), h('button', { class: 'btn btn-sm', type: 'button', onclick: () => save({ maintenance: mtOn.checked, maintenanceMessage: mtMsg.value.trim() }, `mantenimiento=${mtOn.checked}`) }, 'Guardar')))));
  document.getElementById('killBtn').onclick = async () => {
    if (!(await confirmDialog({ title: 'Parada de emergencia', text: 'Pone todo el sitio en mantenimiento, apaga chat y registros y detiene los agentes automáticos. ¿Continuar?', ok: 'Continuar', danger: true }))) return;
    if (!(await confirmDialog({ title: 'Confirmación final', text: 'Confirmá la PARADA DE EMERGENCIA. Se puede revertir desde este panel.', ok: 'Activar parada', danger: true }))) return;
    await save({ killSwitch: true, flags: { chat: false, signups: false, agents247: false }, agents: { state: 'detenido', updatedBy: user.email } }, 'killSwitch=true (agentes detenidos)');
    renderDashboard(user);
  };
}

async function renderUsers(grid, user, fs, db) {
  const c = h('section', { class: 'card panel span-2' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Usuarios')));
  grid.append(c);
  const q = h('input', { class: 'input', type: 'search', placeholder: 'Buscar por correo (empieza con…)', 'aria-label': 'Buscar usuarios', style: 'max-width:360px' });
  const box = h('div', { class: 'table-wrap' });
  c.append(q, h('div', { style: 'height:12px' }), box);
  const load = async () => {
    box.innerHTML = '<div class="skeleton" style="height:120px"></div>';
    try {
      const col = fs.collection(db, 'users');
      const term = q.value.trim().toLowerCase();
      const query = term ? fs.query(col, fs.where('email', '>=', term), fs.where('email', '<=', term + '\uf8ff'), fs.limit(50)) : fs.query(col, fs.orderBy('createdAt', 'desc'), fs.limit(50));
      const s = await fs.getDocs(query);
      const rows = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      box.innerHTML = '';
      const table = h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ...['Usuario', 'País', 'Alta', 'Último acceso', 'Plan', 'Estado', ''].map((t) => h('th', {}, t)))));
      const tb = h('tbody');
      for (const u of rows) {
        const plan = h('select', { class: 'select', style: 'min-height:34px;padding:4px 8px;width:auto', 'aria-label': 'Plan de ' + u.email }, ...['gratis', 'pro', 'empresa'].map((p) => h('option', { value: p, selected: u.plan === p || null }, p)));
        plan.addEventListener('change', async () => {
          if (!(await confirmDialog({ title: 'Cambiar plan', text: `¿Pasar a ${u.email} al plan ${plan.value}?`, ok: 'Cambiar' }))) { plan.value = u.plan; return; }
          try { await fs.updateDoc(fs.doc(db, 'users', u.id), { plan: plan.value, planStatus: 'active', planChangedBy: user.email, planChangedAt: fs.serverTimestamp() }); logEvent(user, 'plan_change', `${u.email} → ${plan.value}`); toast('Plan actualizado', 'ok'); u.plan = plan.value; }
          catch (e) { toast(friendlyError(e), 'error'); plan.value = u.plan; }
        });
        const susp = h('button', { class: 'btn btn-sm ' + (u.suspended ? '' : 'btn-danger-ghost'), type: 'button' }, u.suspended ? 'Reactivar' : 'Suspender');
        susp.addEventListener('click', async () => {
          const to = !u.suspended;
          if (!(await confirmDialog({ title: to ? 'Suspender usuario' : 'Reactivar usuario', text: `${u.email}`, ok: to ? 'Suspender' : 'Reactivar', danger: to }))) return;
          try { await fs.updateDoc(fs.doc(db, 'users', u.id), { suspended: to }); logEvent(user, to ? 'user_suspended' : 'user_reactivated', u.email); u.suspended = to; susp.textContent = to ? 'Reactivar' : 'Suspender'; susp.classList.toggle('btn-danger-ghost', !to); toast('Listo', 'ok'); }
          catch (e) { toast(friendlyError(e), 'error'); }
        });
        tb.append(h('tr', {},
          h('td', {}, h('strong', {}, u.name || '—'), h('br'), h('span', { class: 'muted tiny' }, u.email || u.id)),
          h('td', {}, u.country ? h('span', { class: 'row', style: 'gap:6px' }, h('img', { class: 'flag', src: flag(u.country), alt: '', width: 18, height: 18 }), u.country) : '—'),
          h('td', {}, fmtDate(u.createdAt)), h('td', {}, u.lastSeen && u.lastSeen.toMillis ? timeAgo(u.lastSeen.toMillis()) : '—'),
          h('td', {}, plan, u.subscription ? h('div', { class: 'tiny muted' }, `${u.subscription.status}: ${u.subscription.plan} (${u.subscription.provider})`) : null),
          h('td', {}, h('span', { class: 'chip ' + (u.suspended ? 'danger' : 'ok') }, u.suspended ? 'Suspendido' : 'Activo')),
          h('td', {}, susp)));
      }
      if (!rows.length) tb.append(h('tr', {}, h('td', { colspan: 7, class: 'muted' }, 'Sin resultados.')));
      table.append(tb);
      box.append(table);
    } catch (e) { box.innerHTML = ''; box.append(h('p', { class: 'muted small', style: 'padding:12px' }, 'No se pudo cargar: ' + friendlyError(e))); }
  };
  let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(load, 350); });
  load();
}

async function renderSecurity(grid, user, fs, db) {
  const c = h('section', { class: 'card panel span-2' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Seguridad'), h('a', { class: 'btn btn-sm btn-ghost', href: '/legal/seguridad.html', html: icon('shield') + 'Política' })));
  grid.append(c);
  const status = h('div', { class: 'sec-status' }, h('div', { class: 'skeleton', style: 'height:60px' }));
  const events = h('div', { class: 'table-wrap' });
  c.append(status, h('h3', { style: 'margin-top:18px' }, 'Eventos recientes'), events);
  fetch('/security-status.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((s) => {
    status.innerHTML = '';
    if (!s) { status.append(h('p', { class: 'muted small' }, 'El agente de ciberseguridad todavía no publicó su estado.')); return; }
    const chipFor = (v) => (v === 'ok' ? 'ok' : v === 'warn' ? 'warn' : v === 'fail' ? 'danger' : '');
    status.append(h('p', { class: 'small muted' }, `Último análisis: ${s.updated ? new Date(s.updated).toLocaleString('es-AR') : '—'} · resultado general `, h('span', { class: 'chip ' + chipFor(s.overall) }, s.overall || '—')),
      h('div', { class: 'checks' }, ...Object.entries(s.checks || {}).map(([k, v]) => h('span', { class: 'chip ' + chipFor(v.status) }, `${k}: ${v.status}${v.findings ? ' (' + v.findings + ')' : ''}`))));
  }).catch(() => { status.innerHTML = '<p class="muted small">Estado de seguridad no disponible.</p>'; });
  try {
    const s = await fs.getDocs(fs.query(fs.collection(db, 'securityEvents'), fs.orderBy('at', 'desc'), fs.limit(30)));
    const rows = s.docs.map((d) => d.data());
    events.append(h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ...['Cuándo', 'Evento', 'Cuenta', 'Detalle'].map((t) => h('th', {}, t)))),
      h('tbody', {}, ...(rows.length ? rows.map((r) => h('tr', {}, h('td', {}, r.at && r.at.toMillis ? timeAgo(r.at.toMillis()) : '—'), h('td', {}, h('span', { class: 'chip ' + (/denied|fail/.test(r.type) ? 'danger' : '') }, r.type)), h('td', {}, r.email || '—'), h('td', { class: 'tiny' }, r.detail || ''))) : [h('tr', {}, h('td', { colspan: 4, class: 'muted' }, 'Sin eventos.'))]))));
  } catch (e) { events.append(h('p', { class: 'muted small', style: 'padding:12px' }, 'No disponible: ' + friendlyError(e))); }
}

/* =================== Suscripciones (confirmación manual hasta que el servidor valide webhooks) =================== */
async function renderSubscriptions(grid, user, fs, db) {
  const c = h('section', { class: 'card panel span-2' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Suscripciones'), h('span', { class: 'chip warn' }, 'Confirmación manual hasta activar el servidor')));
  grid.append(c);
  const box = h('div', { class: 'table-wrap' }, h('div', { class: 'skeleton', style: 'height:80px' }));
  c.append(h('p', { class: 'muted small' }, 'Antes de confirmar, verificá el cobro en Mercado Pago (Tu negocio → Suscripciones) o en PayPal (Actividad). Confirmar activa el plan por 30 días.'), box);
  const load = async () => {
    try {
      const col = fs.collection(db, 'users');
      const [pend, act] = await Promise.all([fs.getDocs(fs.query(col, fs.where('subscription.status', '==', 'pending'), fs.limit(50))), fs.getDocs(fs.query(col, fs.where('subscription.status', 'in', ['active', 'paused']), fs.limit(100)))]);
      const rows = [...pend.docs, ...act.docs].map((d) => ({ id: d.id, ...d.data() }));
      box.innerHTML = '';
      const tb = h('tbody');
      for (const u of rows) {
        const s = u.subscription;
        const confirm = h('button', { class: 'btn btn-sm btn-primary', type: 'button' }, s.status === 'pending' ? 'Confirmar pago' : 'Renovar 30 días');
        confirm.onclick = async () => {
          if (!(await confirmDialog({ title: 'Confirmar pago', text: `¿Verificaste el cobro de ${u.email} (${s.plan}, ${s.provider})? Se activa el plan por 30 días.`, ok: 'Sí, confirmar' }))) return;
          try {
            const base = s.currentPeriodEnd && s.currentPeriodEnd.toMillis && s.currentPeriodEnd.toMillis() > Date.now() ? s.currentPeriodEnd.toMillis() : Date.now();
            const end = fs.Timestamp.fromMillis(base + 30 * 86400000);
            const price = CONFIG.PRICES[s.plan] || { ars: 0, usd: 0 };
            const pay = { uid: u.id, email: u.email || null, plan: s.plan, provider: s.provider, subscriptionId: s.subscriptionId || null, amount: s.provider === 'paypal' ? price.usd : price.ars, currency: s.provider === 'paypal' ? 'USD' : 'ARS', status: 'confirmado-manual', confirmedBy: user.email, createdAt: fs.serverTimestamp() };
            const b = fs.writeBatch(db);
            b.update(fs.doc(db, 'users', u.id), { plan: s.plan, planStatus: 'active', renewsAt: end, 'subscription.status': 'active', 'subscription.currentPeriodEnd': end, 'subscription.verifiedBy': user.email, 'subscription.verifiedAt': fs.serverTimestamp() });
            b.set(fs.doc(fs.collection(db, 'payments')), pay);
            b.set(fs.doc(fs.collection(db, 'users', u.id, 'payments')), { ...pay, description: 'Plan ' + s.plan + ' (30 días)' });
            await b.commit();
            logEvent(user, 'payment_confirmed', `${u.email} ${s.plan} ${s.provider}`);
            toast('Plan activado', 'ok'); load();
          } catch (e) { toast(friendlyError(e), 'error'); }
        };
        const cancel = h('button', { class: 'btn btn-sm btn-danger-ghost', type: 'button' }, s.status === 'pending' ? 'Rechazar' : 'Cancelar');
        cancel.onclick = async () => {
          if (!(await confirmDialog({ title: s.status === 'pending' ? 'Rechazar suscripción' : 'Cancelar suscripción', text: `${u.email}: ${s.status === 'pending' ? 'el plan no se activa.' : 'conserva el acceso hasta el fin del período; cancelá también en el procesador.'}`, ok: 'Confirmar', danger: true }))) return;
          try {
            const patch = { 'subscription.status': 'canceled', 'subscription.autoRenew': false, 'subscription.canceledBy': user.email, 'subscription.canceledAt': fs.serverTimestamp() };
            if (s.status === 'pending') Object.assign(patch, { plan: 'gratis', planStatus: 'active' });
            await fs.updateDoc(fs.doc(db, 'users', u.id), patch);
            logEvent(user, 'subscription_canceled', `${u.email} ${s.plan}`);
            toast('Actualizado', 'ok'); load();
          } catch (e) { toast(friendlyError(e), 'error'); }
        };
        tb.append(h('tr', {}, h('td', {}, h('strong', {}, u.email || u.id)), h('td', {}, s.plan), h('td', {}, s.provider === 'paypal' ? 'PayPal' : 'Mercado Pago', h('div', { class: 'tiny muted' }, s.subscriptionId || '—')),
          h('td', {}, h('span', { class: 'chip ' + (s.status === 'active' ? 'ok' : 'warn') }, s.status), s.autoRenewRequest ? h('div', { class: 'tiny muted' }, 'pide: ' + s.autoRenewRequest) : null),
          h('td', {}, s.currentPeriodEnd ? fmtDate(s.currentPeriodEnd) : '—'), h('td', {}, h('div', { class: 'row', style: 'gap:6px' }, confirm, cancel))));
      }
      if (!rows.length) tb.append(h('tr', {}, h('td', { colspan: 6, class: 'muted' }, 'No hay suscripciones pendientes ni activas.')));
      box.append(h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ...['Usuario', 'Plan', 'Procesador', 'Estado', 'Vence', ''].map((t) => h('th', {}, t)))), tb));
    } catch (e) { box.innerHTML = ''; box.append(h('p', { class: 'muted small', style: 'padding:12px' }, 'No disponible: ' + friendlyError(e))); }
  };
  load();
}

async function renderPaymentsLog(grid, fs, db) {
  const c = h('section', { class: 'card panel span-2' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Registro de pagos')));
  grid.append(c);
  try {
    const s = await fs.getDocs(fs.query(fs.collection(db, 'payments'), fs.orderBy('createdAt', 'desc'), fs.limit(30)));
    const rows = s.docs.map((d) => d.data());
    c.append(h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ...['Fecha', 'Usuario', 'Plan', 'Importe', 'Estado'].map((t) => h('th', {}, t)))),
      h('tbody', {}, ...(rows.length ? rows.map((r) => h('tr', {}, h('td', {}, fmtDate(r.createdAt)), h('td', {}, r.email || r.uid), h('td', {}, r.plan), h('td', {}, `${r.currency} ${Number(r.amount || 0).toLocaleString('es-AR')}`), h('td', {}, h('span', { class: 'chip ok' }, r.status)))) : [h('tr', {}, h('td', { colspan: 5, class: 'muted' }, 'Sin pagos registrados.'))])))));
  } catch (e) { c.append(h('p', { class: 'muted small' }, 'No disponible: ' + friendlyError(e))); }
}

async function renderAgents(grid) {
  const c = h('section', { class: 'card panel span-2' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Agentes y workflows'), h('a', { class: 'btn btn-sm btn-ghost', href: CONFIG.GITHUB.ACTIONS_DEV, target: '_blank', rel: 'noopener', html: icon('external') + 'Ver ejecuciones' })));
  grid.append(c);
  try {
    const d = await fetch('/agents-status.json', { cache: 'no-cache' }).then((r) => r.json());
    c.append(h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ...['Agente', 'Estado', 'Última actividad'].map((t) => h('th', {}, t)))),
      h('tbody', {}, ...(d.agents || []).map((a) => h('tr', {}, h('td', {}, `${a.emoji || ''} ${a.name}`), h('td', {}, h('span', { class: 'chip ' + (a.status === 'activo' ? 'ok' : '') }, a.status)), h('td', { class: 'tiny' }, a.last_activity || '')))))),
      h('p', { class: 'tiny muted', style: 'margin-top:8px' }, 'Actualizado: ' + (d.updated || '—')));
  } catch { c.append(h('p', { class: 'muted small' }, 'Estado de agentes no disponible.')); }
}
