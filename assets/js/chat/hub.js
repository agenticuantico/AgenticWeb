/**
 * Centro de control: agentes, herramientas, habilidades, conectores, automatizaciones, memoria e instrucciones.
 * Todo lo que necesita servidor lo dice explícitamente.
 */
import { h, icon, toast, modal, uid, confirmDialog } from '../ui.js';
import { AGENTS, TOOLS, SKILLS, CONNECTORS, initials } from './agents.js';
import { state as engineState } from './engine.js';

const TABS = [
  ['agentes', 'Agentes', 'users'], ['herramientas', 'Herramientas', 'tools'], ['habilidades', 'Habilidades', 'spark'],
  ['conectores', 'Conectores', 'plug'], ['automatizaciones', 'Automatizaciones', 'clock'], ['memoria', 'Memoria', 'memory'], ['instrucciones', 'Instrucciones', 'edit']
];

export function openHub(chat, tab = 'agentes') {
  const nav = h('div', { class: 'hub-tabs', role: 'tablist', 'aria-label': 'Secciones' });
  const pane = h('div', { class: 'hub-pane', role: 'tabpanel' });
  const body = h('div', { class: 'hub' }, nav, pane);
  for (const [id, label, ic] of TABS) {
    nav.append(h('button', { type: 'button', role: 'tab', 'data-tab': id, onclick: () => show(id), html: icon(ic) + `<span>${label}</span>` }));
  }
  const m = modal({ title: 'Centro de control', body, wide: true });
  function show(id) {
    nav.querySelectorAll('[role="tab"]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
    pane.innerHTML = '';
    ({ agentes, herramientas, habilidades, conectores, automatizaciones, memoria, instrucciones })[id](pane, chat, m);
  }
  show(tab);
}

const backendChip = () => engineState.live ? h('span', { class: 'chip ok' }, 'Activo') : h('span', { class: 'chip warn' }, 'Próximamente');

function agentes(pane, chat) {
  const ws = chat.store.ws;
  pane.append(h('p', { class: 'muted' }, 'Invitá especialistas a la conversación con «Invitar agente» o escribiendo @nombre. Cada uno responde con su nombre. Disponible en todos los planes.'));
  if (!chat.featuresUnlocked) pane.append(h('div', { class: 'alert info' }, h('span', { html: icon('lock') }), h('div', {}, 'Tu plan actual es Gratis. ', h('a', { href: '/planes.html' }, 'Ver planes Pro y Empresa'))));
  const grid = h('div', { class: 'agent-grid' });
  for (const a of [...AGENTS, ...(ws.customAgents || [])]) {
    const inChat = chat.chat.agents.includes(a.id);
    grid.append(h('div', { class: 'agent-card', style: `--c:${a.color || '#888'}` },
      h('span', { class: 'p-badge lg' }, initials(a.name)),
      h('div', {}, h('strong', {}, a.name), h('small', { class: 'muted' }, a.role || 'Agente propio')),
      h('div', { class: 'agent-skills' }, ...(a.skills || []).slice(0, 4).map((s) => h('span', { class: 'chip' }, s))),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-sm' + (inChat ? '' : ' btn-primary'), type: 'button', onclick: (e) => { if (!chat.featuresUnlocked) return chat.paywall('Los agentes invitables'); chat.toggleAgent(a.id); e.target.textContent = chat.chat.agents.includes(a.id) ? 'Quitar del chat' : 'Invitar'; e.target.classList.toggle('btn-primary'); } }, inChat ? 'Quitar del chat' : 'Invitar'),
        a.custom ? h('button', { class: 'icon-btn sm', type: 'button', 'aria-label': 'Eliminar agente ' + a.name, html: icon('trash'), onclick: async () => { if (await confirmDialog({ title: 'Eliminar agente', text: `¿Eliminar «${a.name}»?`, danger: true, ok: 'Eliminar' })) { ws.customAgents = ws.customAgents.filter((x) => x.id !== a.id); chat.store.saveWorkspace(); pane.innerHTML = ''; agentes(pane, chat); } } }) : null)));
  }
  pane.append(grid);
  const form = h('form', { class: 'card hub-form' },
    h('h3', {}, 'Crear agente propio'),
    field('Nombre', h('input', { class: 'input', name: 'name', required: true, maxlength: 40, placeholder: 'Ej.: Asistente de ventas' })),
    field('Rol', h('input', { class: 'input', name: 'role', maxlength: 60, placeholder: 'Ej.: Responde consultas de clientes' })),
    field('Instrucciones', h('textarea', { class: 'textarea', name: 'system', required: true, maxlength: 2000, placeholder: 'Cómo debe trabajar, tono, límites…' })),
    field('Color', h('input', { class: 'input', name: 'color', type: 'color', value: '#b8892f', style: 'max-width:90px;padding:4px' })),
    h('button', { class: 'btn btn-primary', type: 'submit' }, 'Guardar agente'));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!chat.featuresUnlocked) return chat.paywall('Los agentes propios');
    const f = new FormData(form);
    ws.customAgents = ws.customAgents || [];
    ws.customAgents.push({ id: uid('ag'), custom: true, name: String(f.get('name')).trim(), role: String(f.get('role') || '').trim(), system: String(f.get('system')).trim(), color: String(f.get('color')), icon: 'user', skills: [] });
    chat.store.saveWorkspace();
    toast('Agente creado');
    pane.innerHTML = ''; agentes(pane, chat);
  });
  pane.append(form);
}

function herramientas(pane) {
  pane.append(h('p', { class: 'muted' }, 'Herramientas que usa el modo «Hace todo por vos». Las que corren en tu dispositivo funcionan siempre; las demás se activan con el servidor.'));
  const list = h('div', { class: 'hub-list' });
  for (const t of TOOLS) list.append(h('div', { class: 'hub-item' }, h('span', { class: 'hub-ic', html: icon(t.icon) }), h('div', {}, h('strong', {}, t.name), h('p', { class: 'muted small' }, t.desc)), t.needsBackend ? backendChip() : h('span', { class: 'chip ok' }, 'En tu dispositivo')));
  pane.append(list);
}

function habilidades(pane, chat) {
  const ws = chat.store.ws;
  pane.append(h('p', { class: 'muted' }, 'Activá habilidades para ajustar cómo responde. Se aplican a todas tus conversaciones.'));
  const list = h('div', { class: 'hub-list' });
  for (const s of SKILLS) {
    const input = h('input', { type: 'checkbox', checked: (ws.skills || []).includes(s.id) || null, 'aria-label': s.name });
    input.addEventListener('change', () => { ws.skills = input.checked ? [...new Set([...(ws.skills || []), s.id])] : (ws.skills || []).filter((x) => x !== s.id); chat.store.saveWorkspace(); });
    list.append(h('label', { class: 'hub-item' }, h('div', {}, h('strong', {}, s.name), h('p', { class: 'muted small' }, s.desc)), h('span', { class: 'switch' }, input, h('span'))));
  }
  pane.append(list);
}

function conectores(pane, chat) {
  // GitHub y Cloudflare se conectan de verdad (por usuario); el resto queda en «Próximamente».
  import('./connectors.js').then((mod) => mod.renderConnectors(pane, chat, (p) => { import('./logins.js').then((lg) => lg.renderLogins(p, chat)).catch(() => {}).finally(() => proximamente(p, chat)); })).catch(() => proximamente(pane, chat));
}

function proximamente(pane, chat) {
  const ws = chat.store.ws;
  pane.append(h('h3', { class: 'conn-subtitle' }, 'Próximamente'));
  const list = h('div', { class: 'hub-list' });
  for (const c of CONNECTORS.filter((x) => x.id !== 'github' && x.id !== 'cloudflare')) {
    const want = (ws.connectorsWanted || []).includes(c.id);
    const b = h('button', { class: 'btn btn-sm' + (want ? '' : ' btn-ghost'), type: 'button', 'aria-pressed': String(want) }, want ? 'Te avisamos' : 'Avisarme');
    b.addEventListener('click', () => {
      const on = !(ws.connectorsWanted || []).includes(c.id);
      ws.connectorsWanted = on ? [...(ws.connectorsWanted || []), c.id] : ws.connectorsWanted.filter((x) => x !== c.id);
      chat.store.saveWorkspace();
      b.textContent = on ? 'Te avisamos' : 'Avisarme'; b.classList.toggle('btn-ghost', !on); b.setAttribute('aria-pressed', String(on));
    });
    list.append(h('div', { class: 'hub-item' }, h('span', { class: 'hub-ic', html: icon('plug') }), h('div', {}, h('strong', {}, c.name), h('p', { class: 'muted small' }, c.desc)), b));
  }
  pane.append(list);
}

async function automatizaciones(pane, chat) {
  pane.append(h('div', { class: 'alert warn' }, h('span', { html: icon('clock') }), h('div', {}, 'Las automatizaciones se guardan ahora y ', h('strong', {}, 'empiezan a ejecutarse cuando habilitemos las tareas programadas'), '; todavía no se ejecutan.')));
  const list = h('div', { class: 'hub-list' });
  pane.append(list);
  const refresh = async () => {
    list.innerHTML = '';
    const items = await chat.store.listAutomations().catch(() => []);
    if (!items.length) list.append(h('p', { class: 'muted small' }, 'Todavía no creaste automatizaciones.'));
    for (const a of items) list.append(h('div', { class: 'hub-item' }, h('span', { class: 'hub-ic', html: icon('clock') }), h('div', {}, h('strong', {}, a.title), h('p', { class: 'muted small' }, `${{ daily: 'Todos los días', weekly: 'Cada semana', weekdays: 'Lunes a viernes' }[a.schedule] || a.schedule} a las ${a.time} · ${a.prompt.slice(0, 80)}`)), h('span', { class: 'chip warn' }, 'Programada'), h('button', { class: 'icon-btn sm', type: 'button', 'aria-label': 'Eliminar automatización', html: icon('trash'), onclick: async () => { await chat.store.deleteAutomation(a.id).catch(() => {}); refresh(); } })));
  };
  refresh();
  const form = h('form', { class: 'card hub-form' },
    h('h3', {}, 'Nueva automatización'),
    field('Título', h('input', { class: 'input', name: 'title', required: true, maxlength: 80, placeholder: 'Ej.: Resumen de noticias del sector' })),
    field('Qué tiene que hacer', h('textarea', { class: 'textarea', name: 'prompt', required: true, maxlength: 2000, placeholder: 'Ej.: Buscá novedades sobre IA en Argentina y mandame un resumen.' })),
    h('div', { class: 'grid', style: 'grid-template-columns:1fr 1fr' },
      field('Frecuencia', h('select', { class: 'select', name: 'schedule' }, h('option', { value: 'daily' }, 'Todos los días'), h('option', { value: 'weekdays' }, 'Lunes a viernes'), h('option', { value: 'weekly' }, 'Cada semana'))),
      field('Hora (Argentina)', h('input', { class: 'input', name: 'time', type: 'time', value: '09:00', required: true }))),
    h('button', { class: 'btn btn-primary', type: 'submit' }, 'Guardar'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    try {
      await chat.store.saveAutomation({ id: uid('auto'), title: f.get('title'), prompt: f.get('prompt'), schedule: f.get('schedule'), time: f.get('time') });
      toast('Automatización guardada (se ejecutará cuando habilitemos las tareas programadas)');
      form.reset(); refresh();
    } catch { toast('No se pudo guardar todavía en tu cuenta.', 'error'); }
  });
  pane.append(form);
}

function memoria(pane, chat) {
  const st = chat.store, ws = st.ws;
  const fail = (e) => import('../account/api.js').then((m) => toast(m.errorText(e), 'warn')).catch(() => toast('No se pudo guardar.', 'warn'));
  const sw = h('input', { type: 'checkbox', checked: ws.memoryOn || null, 'aria-label': 'Usar memoria' });
  sw.addEventListener('change', () => st.setMemoryOn(sw.checked).catch((e) => { sw.checked = !sw.checked; fail(e); }));
  pane.append(h('label', { class: 'hub-item' }, h('div', {}, h('strong', {}, 'Usar memoria'), h('p', { class: 'muted small' }, 'Datos que recuerdo entre conversaciones. Decí «Recordá que…» para agregar uno. Los chats incógnito nunca se usan ni se guardan.'), h('p', { class: 'muted small' }, st.serverOk ? 'Se guarda en tu cuenta. Nunca guardo contraseñas, códigos ni tarjetas.' : 'Nunca guardo contraseñas, códigos ni tarjetas.')), h('span', { class: 'switch' }, sw, h('span'))));
  const list = h('div', { class: 'hub-list' });
  const clearBox = h('div');
  const draw = () => {
    list.innerHTML = ''; clearBox.innerHTML = '';
    if (!ws.memory.length) list.append(h('p', { class: 'muted small' }, 'No hay datos guardados.'));
    ws.memory.forEach((m) => {
      const input = h('input', { class: 'input', value: m.text, maxlength: 300, 'aria-label': 'Dato guardado' });
      input.addEventListener('change', () => { const v = input.value.trim(); if (!v) { input.value = m.text; return; } st.editMemory(m.id, v).then(() => toast('Memoria actualizada')).catch((e) => { input.value = m.text; fail(e); }); });
      list.append(h('div', { class: 'hub-item' }, input, h('button', { class: 'icon-btn sm', type: 'button', 'aria-label': 'Borrar dato: ' + m.text, html: icon('trash'), onclick: () => st.deleteMemory(m.id).then(draw).catch(fail) })));
    });
    if (ws.memory.length) clearBox.append(h('button', { class: 'btn btn-danger-ghost btn-sm', type: 'button', style: 'margin-top:16px', onclick: async () => { if (await confirmDialog({ title: 'Borrar memoria', text: '¿Borrar todos los datos guardados?', danger: true, ok: 'Borrar todo' })) st.clearMemory().then(draw).catch(fail); } }, 'Borrar toda la memoria'));
  };
  draw();
  const add = h('form', { class: 'row', style: 'margin-top:12px' }, h('input', { class: 'input', name: 'm', maxlength: 300, placeholder: 'Agregar un dato (ej.: Mi empresa vende café)', style: 'flex:1;min-width:200px', 'aria-label': 'Nuevo dato' }), h('button', { class: 'btn', type: 'submit' }, 'Agregar'));
  add.addEventListener('submit', (e) => { e.preventDefault(); const v = add.m.value.trim(); if (!v) return; st.addMemory(v).then(() => { add.reset(); draw(); }).catch(fail); });
  pane.append(list, add, clearBox);
}

function instrucciones(pane, chat) {
  const ws = chat.store.ws;
  const ta = h('textarea', { class: 'textarea', maxlength: 1500, rows: 7, placeholder: 'Ej.: Respondé breve, con ejemplos de Argentina. Soy desarrollador.', 'aria-label': 'Instrucciones personalizadas' });
  ta.value = ws.instructions || '';
  pane.append(h('p', { class: 'muted' }, 'Instrucciones que se aplican a todas tus conversaciones (no a las de incógnito).'), ta,
    h('div', { class: 'row', style: 'margin-top:12px;justify-content:flex-end' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { ws.instructions = ta.value.trim(); chat.store.saveWorkspace(); toast('Instrucciones guardadas'); } }, 'Guardar')));
}

function field(label, control) {
  const id = uid('f');
  control.id = id;
  return h('div', { class: 'field' }, h('label', { for: id }, label), control);
}
