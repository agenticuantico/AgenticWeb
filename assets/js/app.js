/** App completa /app/: barra lateral (proyectos, fijados, historial) y chat. */
import { ChatApp } from './chat/chat.js';
import { ChatStore } from './chat/store.js';
import { watchUser, getProfile } from './auth.js';
import { h, icon, esc, modal, popover, confirmDialog, uid, timeAgo } from './ui.js';
import { prefs } from './consent.js';

const $ = (id) => document.getElementById(id);
const store = new ChatStore();
const chat = new ChatApp($('appChat'), { variant: 'full', avatar: null, store });
// Conversación abierta desde el chat de la portada (botón de pantalla completa)
try { const oid = sessionStorage.getItem('ac.app.open'); if (oid) { sessionStorage.removeItem('ac.app.open'); const c = store.get(oid); if (c) chat.loadChat(c); } } catch {}

const params = new URLSearchParams(location.search);
if (params.get('modo') === 'auto') chat.setMode('auto', true);
if (params.get('q')) chat.$('input').value = params.get('q').slice(0, 2000);

const shell = $('appShell');

/* ---------- Barra lateral ---------- */
const sidebar = $('sidebar');
const backdrop = $('sbBackdrop');
function openSidebar(open) {
  const narrow = matchMedia('(max-width: 900px)').matches;
  if (narrow) { sidebar.classList.toggle('open', open); backdrop.hidden = !open; }
  else { shell.classList.toggle('sb-collapsed', !open); prefs.set('ac.sidebar', open ? '1' : '0'); }
}
if (prefs.get('ac.sidebar', '1') === '0') shell.classList.add('sb-collapsed');
$('sbClose').addEventListener('click', () => openSidebar(false));
backdrop.addEventListener('click', () => openSidebar(false));
document.addEventListener('chat:sidebar', () => openSidebar(matchMedia('(max-width: 900px)').matches ? !sidebar.classList.contains('open') : shell.classList.contains('sb-collapsed')));
$('sbNew').addEventListener('click', () => { chat.newChat(); openSidebar(false); });
$('sbSearch').addEventListener('click', () => openSearch());
$('sbAuto').addEventListener('click', () => { chat.newChat(); chat.setMode('auto'); openSidebar(false); });
$('sbHub').addEventListener('click', () => chat.openHub());
$('sbNewProject').addEventListener('click', async () => {
  const name = await promptText('Nuevo proyecto', 'Nombre del proyecto', '');
  if (!name) return;
  store.ws.projects.push({ id: uid('p'), name: name.slice(0, 60) });
  store.saveWorkspace();
});

function chatItem(c) {
  const b = h('div', { class: 'sb-chat' + (c.id === chat.chat.id ? ' active' : ''), role: 'listitem' });
  const open = h('button', { class: 'sb-chat-open', type: 'button', title: c.title }, c.pinned ? h('span', { class: 'pin', html: icon('pin') }) : null, h('span', { class: 'sb-title' }, c.title), h('small', {}, timeAgo(c.updatedAt)));
  open.addEventListener('click', () => { chat.loadChat(store.get(c.id) || c); openSidebar(false); renderSidebar(); });
  const more = h('button', { class: 'icon-btn sm sb-more', type: 'button', 'aria-label': 'Opciones de ' + c.title, html: icon('more') });
  more.addEventListener('click', (e) => { e.stopPropagation(); chatMenu(more, c); });
  b.append(open, h('span', { 'data-popover-host': '' }, more));
  return b;
}
function chatMenu(btn, c) {
  const projects = store.ws.projects;
  popover(btn, [
    { label: c.pinned ? 'Desfijar' : 'Fijar arriba', icon: 'pin', onClick: () => { c.pinned = !c.pinned; store.save(c); } },
    { label: 'Renombrar', icon: 'edit', onClick: async () => { const t = await promptText('Renombrar', 'Título', c.title); if (t) { c.title = t.slice(0, 100); store.save(c); } } },
    ...(projects.length ? [{ heading: 'Mover a proyecto' }, ...projects.map((p) => ({ label: p.name, icon: 'folder', checked: c.projectId === p.id, onClick: () => { c.projectId = c.projectId === p.id ? null : p.id; store.save(c); } }))] : []),
    'sep',
    { label: 'Eliminar', icon: 'trash', danger: true, onClick: async () => { if (await confirmDialog({ title: 'Eliminar conversación', text: `¿Eliminar «${c.title}»? No se puede deshacer.`, ok: 'Eliminar', danger: true })) { await store.remove(c.id); if (chat.chat.id === c.id) chat.newChat(); } } }
  ], { align: 'end' });
}
function renderSidebar() {
  const list = store.list();
  const pl = $('projectList');
  pl.innerHTML = '';
  if (!store.ws.projects.length) pl.append(h('p', { class: 'sb-empty' }, 'Agrupá chats por proyecto.'));
  for (const p of store.ws.projects) {
    const items = list.filter((c) => c.projectId === p.id);
    const det = h('details', { class: 'sb-project', open: items.some((c) => c.id === chat.chat.id) || null }, h('summary', { html: icon('folder') + `<span>${esc(p.name)}</span><small>${items.length}</small>` }), ...items.map(chatItem));
    const del = h('button', { class: 'icon-btn sm', type: 'button', 'aria-label': 'Eliminar proyecto ' + p.name, html: icon('trash'), onclick: async (e) => { e.preventDefault(); if (await confirmDialog({ title: 'Eliminar proyecto', text: 'Los chats quedan sin proyecto, no se borran.', ok: 'Eliminar', danger: true })) { store.ws.projects = store.ws.projects.filter((x) => x.id !== p.id); items.forEach((c) => { c.projectId = null; store.save(c); }); store.saveWorkspace(); } } });
    det.querySelector('summary').append(del);
    pl.append(det);
  }
  const pinned = list.filter((c) => c.pinned && !c.projectId);
  $('pinnedSection').innerHTML = '';
  if (pinned.length) $('pinnedSection').append(h('div', { class: 'sb-head' }, h('span', {}, 'Fijados')), h('div', { role: 'list' }, ...pinned.map(chatItem)));
  const rest = list.filter((c) => !c.pinned && !c.projectId);
  const hs = $('historySection');
  hs.innerHTML = '';
  hs.append(h('div', { class: 'sb-head' }, h('span', {}, 'Recientes')));
  if (!rest.length) hs.append(h('p', { class: 'sb-empty' }, store.uid ? 'Tus conversaciones aparecen acá.' : 'Sin cuenta, tus chats quedan solo en este dispositivo.'));
  else hs.append(h('div', { role: 'list' }, ...rest.slice(0, 80).map(chatItem)));
}
store.on(renderSidebar);
document.addEventListener('chat:changed', renderSidebar);
renderSidebar();

function openSearch() {
  const input = h('input', { class: 'input', type: 'search', placeholder: 'Buscar en tus conversaciones…', 'aria-label': 'Buscar' });
  const results = h('div', { class: 'search-results', role: 'list' });
  const draw = () => {
    const q = input.value.trim().toLowerCase();
    results.innerHTML = '';
    const items = store.list().filter((c) => !q || c.title.toLowerCase().includes(q) || c.messages.some((m) => String(m.content || '').toLowerCase().includes(q))).slice(0, 30);
    if (!items.length) results.append(h('p', { class: 'muted small' }, 'Sin resultados.'));
    for (const c of items) results.append(h('button', { class: 'menu-item', type: 'button', role: 'listitem', onclick: () => { m.close(); chat.loadChat(c); renderSidebar(); } }, h('span', { html: icon('search') }), h('span', { class: 'meta' }, h('span', {}, c.title), h('small', {}, timeAgo(c.updatedAt)))));
  };
  input.addEventListener('input', draw);
  const m = modal({ title: 'Buscar conversaciones', body: h('div', { class: 'stack' }, input, results) });
  draw();
  input.focus();
}
function promptText(title, label, value) {
  const input = h('input', { class: 'input', value, maxlength: 100, 'aria-label': label });
  const m = modal({ title, body: h('div', { class: 'field' }, h('label', {}, label), input), actions: [{ label: 'Cancelar', class: 'btn-ghost', value: null }, { label: 'Guardar', class: 'btn-primary', onClick: () => { m.result = input.value.trim(); } }] });
  setTimeout(() => input.focus(), 30);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { m.result = input.value.trim(); m.close('ok'); } });
  return m.done.then(() => m.result || null);
}

/* ---------- Atajos ---------- */
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); return; }
  chat.handleShortcut(e);
});

/* ---------- Cuenta ---------- */
watchUser(async (u) => {
  if (!u) { store.attachUser(null); return; }
  const profile = await getProfile(u.uid);
  const p = profile && !profile._error ? profile : null;
  chat.setUser(u, p);
  await store.attachUser(u.uid);
  const name = u.displayName || u.email || 'Mi cuenta';
  $('sbName').textContent = name;
  $('sbPlan').textContent = 'Plan ' + ({ gratis: 'Gratis', pro: 'Pro', empresa: 'Empresa' }[p ? p.plan : 'gratis'] || 'Gratis') + (p && p.subscription && p.subscription.status === 'pending' ? ' · pago en verificación' : '');
  const ini = $('sbInitial');
  if (u.photoURL) ini.replaceWith(h('img', { src: u.photoURL, alt: '', width: 30, height: 30, class: 'sb-photo', referrerpolicy: 'no-referrer' }));
  else ini.textContent = name.charAt(0).toUpperCase();
  if (p && ['pro', 'empresa'].includes(p.plan)) $('sbUpgrade').hidden = true;
}, { force: false });

