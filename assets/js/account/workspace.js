/**
 * Pestañas «Memoria» y «Proyectos» de Tu cuenta (Fase 2). Los datos viven en el servidor (D1, por persona):
 *  - Memoria: ver, agregar, editar y borrar (de a uno o todo), y prender/apagar su uso en el chat.
 *  - Proyectos: crear, renombrar, ver sus chats y borrarlos (los chats quedan sin proyecto, no se borran).
 * Después de cada cambio se avisa con «workspace:refresh» para que la barra lateral y el chat se actualicen.
 */
import { h, icon, toast, confirmDialog } from '../ui.js';
import { call, errorText } from './api.js';
import { getSiteLang } from '../i18n.js';

let seq = 0;
const fid = (p) => `${p}-${++seq}`;
const refreshApp = () => document.dispatchEvent(new CustomEvent('workspace:refresh'));
const fmtDate = (t) => new Date(t).toLocaleDateString(getSiteLang(), { timeZone: 'America/Argentina/Buenos_Aires', day: 'numeric', month: 'short', year: 'numeric' });
const SOURCE = { chat: 'desde el chat', import: 'traído del dispositivo', manual: 'agregado a mano' };

/* --------------------------------- Memoria --------------------------------- */
export async function renderMemory(el, ctx) {
  const w = await call('/api/workspace');
  el.append(h('div', { class: 'acc-section-h' },
    h('h3', {}, 'Memoria'),
    h('p', { class: 'muted' }, 'Datos cortos que el chat recuerda entre conversaciones. Son tuyos: los puedes cambiar o borrar cuando quieras. Nunca se guardan contraseñas, códigos, tarjetas ni CBU.')));

  const swId = fid('memsw');
  const sw = h('input', { type: 'checkbox', id: swId, role: 'switch' });
  sw.checked = w.memoryOn !== false;
  const swHint = h('small', { class: 'muted' }, sw.checked ? 'El chat usa estos datos para responderte mejor.' : 'Apagada: el chat no los usa (no se borran).');
  sw.addEventListener('change', async () => {
    const want = sw.checked; sw.disabled = true;
    try { await call('/api/workspace/settings', { method: 'POST', body: { memoryOn: want } }); swHint.textContent = want ? 'El chat usa estos datos para responderte mejor.' : 'Apagada: el chat no los usa (no se borran).'; refreshApp(); }
    catch (e) { sw.checked = !want; toast(errorText(e), 'warn'); }
    sw.disabled = false;
  });
  el.append(h('div', { class: 'acc-chatsw acc-card' }, h('label', { for: swId }, h('strong', {}, 'Usar la memoria en el chat'), swHint), h('span', { class: 'switch' }, sw, h('span'))));

  const list = h('ul', { class: 'acc-mem-list', 'aria-label': 'Datos guardados' });
  const count = h('p', { class: 'muted acc-small', 'aria-live': 'polite' });
  const draw = (items) => {
    list.innerHTML = '';
    count.textContent = items.length ? `${items.length} de 200 datos guardados.` : '';
    if (!items.length) { list.append(h('li', { class: 'acc-empty sm' }, h('span', { class: 'acc-empty-ic', html: icon('memory') }), h('p', {}, 'Todavía no hay datos. Agrega uno abajo o dile al chat «Recuerda que…».'))); return; }
    for (const m of items) list.append(memItem(m, items, draw));
    clearBtn.hidden = !items.length;
  };
  const items = [...w.memory];
  const clearBtn = h('button', { class: 'btn btn-sm btn-danger-ghost', type: 'button', onclick: async () => {
    if (!(await confirmDialog({ title: 'Borrar toda la memoria', text: `Se borran los ${items.length} datos guardados. No se puede deshacer.`, ok: 'Borrar todo', danger: true }))) return;
    try { await call('/api/memory/clear', { method: 'POST', body: {} }); items.length = 0; draw(items); toast('Memoria borrada.'); refreshApp(); }
    catch (e) { toast(errorText(e), 'warn'); }
  } }, h('span', { html: icon('trash') }), 'Borrar todo');

  const inputId = fid('memnew');
  const input = h('input', { class: 'input', id: inputId, maxlength: 300, autocomplete: 'off', placeholder: 'Ej.: Trabajo desde el celular', 'aria-describedby': inputId + 'h' });
  const err = h('p', { class: 'error-text', role: 'alert' });
  const addBtn = h('button', { class: 'btn btn-primary', type: 'submit' }, h('span', { html: icon('plus') }), 'Agregar');
  const form = h('form', { class: 'acc-card acc-form', novalidate: true },
    h('div', { class: 'field' }, h('label', { for: inputId }, 'Nuevo dato'), input, h('small', { id: inputId + 'h', class: 'muted' }, 'Hasta 300 caracteres.')),
    err, h('div', { class: 'acc-row' }, addBtn));
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); err.textContent = '';
    const v = input.value.trim();
    if (v.length < 2) { err.textContent = 'Escribe el dato que quieres que recuerde.'; input.focus(); return; }
    addBtn.disabled = true;
    try {
      const r = await call('/api/memory', { method: 'POST', body: { text: v } });
      if (!items.some((x) => x.id === r.memory.id)) items.push(r.memory);
      input.value = ''; draw(items); toast('Dato guardado.', 'ok'); refreshApp();
    } catch (e2) { err.textContent = errorText(e2); }
    addBtn.disabled = false; input.focus();
  });
  draw(items);
  el.append(form, h('div', { class: 'acc-row acc-mem-head' }, count, clearBtn), list);
}

function memItem(m, items, draw) {
  const text = h('p', { class: 'acc-mem-t' }, m.text);
  const srcEl = h('span', {}, SOURCE[m.source] || '');
  const dateEl = h('span', {}, fmtDate(m.updatedAt || m.createdAt));
  const meta = h('small', { class: 'muted' }, dateEl, ' · ', srcEl);
  const li = h('li', { class: 'acc-mem' });
  const editBtn = h('button', { class: 'icon-btn sm', type: 'button', 'aria-label': `Editar: ${m.text}`, html: icon('edit') });
  const delBtn = h('button', { class: 'icon-btn sm', type: 'button', 'aria-label': `Borrar: ${m.text}`, html: icon('trash') });
  const view = h('div', { class: 'acc-mem-view' }, h('div', { class: 'acc-mem-body' }, text, meta), h('div', { class: 'acc-mem-acts' }, editBtn, delBtn));
  li.append(view);
  editBtn.addEventListener('click', () => {
    const id = fid('memedit');
    const inp = h('input', { class: 'input', id, maxlength: 300, value: m.text, autocomplete: 'off' });
    const err = h('p', { class: 'error-text', role: 'alert' });
    const save = h('button', { class: 'btn btn-sm btn-primary', type: 'submit' }, 'Guardar');
    const cancel = h('button', { class: 'btn btn-sm btn-ghost', type: 'button' }, 'Cancelar');
    const f = h('form', { class: 'acc-mem-edit', novalidate: true }, h('label', { class: 'sr-only', for: id }, 'Editar dato'), inp, err, h('div', { class: 'acc-row' }, save, cancel));
    const close = () => { f.replaceWith(view); editBtn.focus(); };
    cancel.addEventListener('click', close);
    f.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } });
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); err.textContent = '';
      save.disabled = true;
      try { const r = await call(`/api/memory/${encodeURIComponent(m.id)}/edit`, { method: 'POST', body: { text: inp.value } }); Object.assign(m, r.memory); text.textContent = m.text; dateEl.textContent = fmtDate(m.updatedAt); srcEl.textContent = SOURCE[m.source] || ''; editBtn.setAttribute('aria-label', `Editar: ${m.text}`); delBtn.setAttribute('aria-label', `Borrar: ${m.text}`); close(); toast('Dato actualizado.', 'ok'); refreshApp(); }
      catch (e2) { err.textContent = errorText(e2); save.disabled = false; }
    });
    view.replaceWith(f); inp.focus(); inp.select();
  });
  delBtn.addEventListener('click', async () => {
    if (!(await confirmDialog({ title: 'Borrar dato', text: `¿Borrar «${m.text}»?`, ok: 'Borrar', danger: true }))) return;
    try { await call(`/api/memory/${encodeURIComponent(m.id)}/delete`, { method: 'POST', body: {} }); const i = items.indexOf(m); if (i >= 0) items.splice(i, 1); draw(items); toast('Dato borrado.'); refreshApp(); }
    catch (e) { toast(errorText(e), 'warn'); }
  });
  return li;
}

/* -------------------------------- Proyectos -------------------------------- */
export async function renderProjects(el, ctx) {
  const w = await call('/api/workspace');
  const store = ctx.chat && ctx.chat.store ? ctx.chat.store : null;
  el.append(h('div', { class: 'acc-section-h' },
    h('h3', {}, 'Proyectos'),
    h('p', { class: 'muted' }, 'Agrupa tus chats por tema: un trabajo, una mudanza, un estudio. Para mover un chat, toca «⋯» al lado del chat en la barra lateral.')));
  const list = h('div', { class: 'acc-projects' });
  const titleOf = (chatId) => { const c = store && store.get(chatId); return c ? c.title : null; };
  const draw = () => {
    list.innerHTML = '';
    if (!w.projects.length) { list.append(h('div', { class: 'acc-empty sm' }, h('span', { class: 'acc-empty-ic', html: icon('folder') }), h('p', {}, 'Todavía no tienes proyectos. Crea el primero abajo.'))); return; }
    for (const p of w.projects) list.append(projectCard(p, w, titleOf, draw, ctx));
  };
  draw();
  el.append(list, projectForm(w, draw));
}

function projectCard(p, w, titleOf, draw, ctx) {
  const chats = Object.entries(w.chats).filter(([, pid]) => pid === p.id).map(([cid]) => cid);
  const card = h('article', { class: 'acc-project', 'aria-label': `Proyecto ${p.name}` });
  const name = h('strong', {}, p.name);
  const desc = h('p', { class: 'muted acc-small' }, p.description || '');
  desc.hidden = !p.description;
  const chatList = h('ul', { class: 'acc-proj-chats' }, ...(chats.length ? chats.slice(0, 20).map((cid) => {
    const t = titleOf(cid);
    return h('li', {}, t ? h('button', { class: 'linklike', type: 'button', onclick: () => openChat(cid, ctx) }, t) : h('span', { class: 'muted' }, 'Chat guardado en otro dispositivo'));
  }) : [h('li', { class: 'muted' }, 'Sin chats todavía.')]));
  const editBtn = h('button', { class: 'btn btn-sm', type: 'button' }, h('span', { html: icon('edit') }), 'Editar');
  const delBtn = h('button', { class: 'btn btn-sm btn-danger-ghost', type: 'button' }, 'Borrar');
  const view = h('div', {},
    h('div', { class: 'acc-task-top' }, h('span', { class: 'acc-task-ic', html: icon('folder') }), h('div', { class: 'acc-task-t' }, name, h('small', { class: 'muted' }, `${chats.length} ${chats.length === 1 ? 'chat' : 'chats'}`))),
    desc, chatList, h('div', { class: 'acc-row' }, editBtn, delBtn));
  card.append(view);
  editBtn.addEventListener('click', () => {
    const f = projectFields(p);
    const err = h('p', { class: 'error-text', role: 'alert' });
    const save = h('button', { class: 'btn btn-sm btn-primary', type: 'submit' }, 'Guardar');
    const cancel = h('button', { class: 'btn btn-sm btn-ghost', type: 'button' }, 'Cancelar');
    const form = h('form', { class: 'acc-form', novalidate: true, 'aria-label': `Editar ${p.name}` }, f.el, err, h('div', { class: 'acc-row' }, save, cancel));
    const close = () => { form.replaceWith(view); editBtn.focus(); };
    cancel.addEventListener('click', close);
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); err.textContent = '';
      if (!f.name.value.trim()) { err.textContent = 'Escribe un nombre para el proyecto.'; f.name.focus(); return; }
      save.disabled = true;
      try { const r = await call(`/api/projects/${encodeURIComponent(p.id)}/edit`, { method: 'POST', body: { name: f.name.value, description: f.desc.value } }); Object.assign(p, r.project); toast('Proyecto actualizado.', 'ok'); refreshApp(); draw(); }
      catch (e2) { err.textContent = errorText(e2); save.disabled = false; }
    });
    view.replaceWith(form); f.name.focus();
  });
  delBtn.addEventListener('click', async () => {
    if (!(await confirmDialog({ title: `Borrar «${p.name}»`, text: 'Se borra el proyecto. Sus chats no se borran: quedan sin proyecto.', ok: 'Borrar proyecto', danger: true }))) return;
    try { await call(`/api/projects/${encodeURIComponent(p.id)}/delete`, { method: 'POST', body: {} }); w.projects = w.projects.filter((x) => x.id !== p.id); for (const k of Object.keys(w.chats)) if (w.chats[k] === p.id) delete w.chats[k]; toast('Proyecto borrado.'); refreshApp(); draw(); }
    catch (e) { toast(errorText(e), 'warn'); }
  });
  return card;
}

function projectFields(p = null) {
  const nid = fid('pname'), did = fid('pdesc');
  const name = h('input', { class: 'input', id: nid, maxlength: 60, autocomplete: 'off', required: true, value: p ? p.name : '' });
  const desc = h('input', { class: 'input', id: did, maxlength: 300, autocomplete: 'off', value: p && p.description ? p.description : '', placeholder: 'Opcional' });
  return { name, desc, el: h('div', { class: 'acc-form-grid' }, h('div', { class: 'field' }, h('label', { for: nid }, 'Nombre'), name), h('div', { class: 'field' }, h('label', { for: did }, 'Descripción'), desc)) };
}

function projectForm(w, draw) {
  const f = projectFields();
  const err = h('p', { class: 'error-text', role: 'alert' });
  const submit = h('button', { class: 'btn btn-primary', type: 'submit' }, h('span', { html: icon('plus') }), 'Crear proyecto');
  const form = h('form', { class: 'acc-card acc-form', novalidate: true }, h('h4', {}, 'Nuevo proyecto'), f.el, err, h('div', { class: 'acc-row' }, submit));
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); err.textContent = '';
    if (!f.name.value.trim()) { err.textContent = 'Escribe un nombre para el proyecto.'; f.name.focus(); return; }
    submit.disabled = true;
    try { const r = await call('/api/projects', { method: 'POST', body: { name: f.name.value, description: f.desc.value } }); w.projects.push(r.project); f.name.value = ''; f.desc.value = ''; toast('Proyecto creado.', 'ok'); refreshApp(); draw(); }
    catch (e2) { err.textContent = errorText(e2); }
    submit.disabled = false;
  });
  return form;
}

function openChat(chatId, ctx) {
  const app = ctx.chat;
  const c = app && app.store && app.store.get(chatId);
  if (!c) return;
  document.querySelector('dialog.acc-dialog .acc-close')?.click();
  app.loadChat(c);
}
