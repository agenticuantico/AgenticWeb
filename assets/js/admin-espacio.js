/**
 * /admin/ → «Espacio de trabajo» (canales CEO ↔ Co-CEO, CEO agéntico, Dirección y uno por área, con los mensajes que se
 * cruzan los agentes en sus turnos) y «Rendimiento» (puntaje real por agente y por persona, ascensos y sugerencias).
 * Los permisos los aplica el SERVIDOR; los mensajes se muestran siempre como texto (nunca como HTML).
 */
import { h, icon, toast, confirmDialog, modal } from './ui.js';
import { api } from './admin-staff.js';
import { download } from './admin-indicadores.js?v=7.14.0';

const ERRW = {
  forbidden_channel: 'Tu rol no tiene acceso a este canal.', empty_message: 'Escribí algo antes de mandar.', rate_limited: 'Vas muy rápido: esperá un minuto.',
  daily_limit: 'Llegaste al máximo de mensajes de hoy.', no_agent_in_channel: 'En este canal no hay un agente que tome órdenes.', outside_area: 'Ese agente no es de tu área.',
  invalid_area: 'Elegí un área.', no_agents_in_area: 'No hay agentes activos en esa área.', training_queue_full: 'Ya hay muchas sesiones en espera.', member_not_active: 'Ese agente no está activo.', manual_limit: 'Llegaste al máximo de entrenamientos manuales de hoy.',
  member_not_in_channel: 'Ese agente no es de este canal.', owner_only: 'Solo el CEO (dueño) puede hacer esto.', not_undoable: 'Ese cambio ya no se puede deshacer.',
  not_pending: 'Esa sugerencia ya se resolvió.', area_required: 'Elegí el área del supervisor.', only_owner_grants_coceo: 'Solo el dueño puede dar el rol Co-CEO.', cannot_grant_role: 'Tu rol no puede dar ese rol.'
};
const fail = (e) => toast(ERRW[e && e.code] || (e && e.message) || 'No se pudo completar.', 'danger');
const AREAS = [['dev', 'Desarrollo'], ['soporte', 'Soporte'], ['diseno', 'Diseño'], ['crecimiento', 'Crecimiento']];
const when = (t) => new Date(t).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/* =================== Espacio de trabajo =================== */
export async function renderWorkspace(box, token, me) {
  // Dos vistas: Canales (chat) y Entrenamiento (sesiones de práctica de los agentes con material real).
  const top = h('div', { class: 'stack-lg' }); box.replaceChildren(top);
  const chBox = h('div'); const trBox = h('div', { hidden: true });
  let view = sessionStorage.getItem('ws-view') === 'entrenamiento' ? 'entrenamiento' : 'canales';
  const seg = h('div', { class: 'seg seg-sm seg-2 ws-views', role: 'tablist', 'aria-label': 'Vista del espacio de trabajo' });
  const paint = () => { for (const b of seg.children) b.setAttribute('aria-selected', String(b.dataset.v === view)); chBox.hidden = view !== 'canales'; trBox.hidden = view !== 'entrenamiento'; };
  for (const [v, l] of [['canales', 'Canales'], ['entrenamiento', 'Entrenamiento']]) seg.append(h('button', { type: 'button', role: 'tab', dataset: { v }, onclick: () => { view = v; sessionStorage.setItem('ws-view', v); paint(); if (v === 'entrenamiento' && !trBox.dataset.loaded) { trBox.dataset.loaded = '1'; renderTraining(trBox, token, me); } } }, l));
  top.append(seg, chBox, trBox); paint();
  if (view === 'entrenamiento') { trBox.dataset.loaded = '1'; renderTraining(trBox, token, me); }
  return renderChannels(chBox, token, me);
}

async function renderChannels(box, token, me) {
  const canDl = new Set(me.perms || []).has('audit.view');
  const root = h('div', { class: 'ws stack-lg' }); box.replaceChildren(root);
  let ov = null; let cur = null; let timer = null;
  const list = h('nav', { class: 'ws-channels', 'aria-label': 'Canales' });
  const head = h('div', { class: 'ws-head' });
  const feed = h('ol', { class: 'ws-feed', 'aria-live': 'polite', 'aria-label': 'Mensajes' });
  const input = h('textarea', { class: 'input ws-input', rows: '2', maxlength: '1000', 'aria-label': 'Mensaje', placeholder: 'Escribí un mensaje…' });
  const ask = h('input', { type: 'checkbox', id: 'wsAsk', checked: true });
  const askL = h('label', { class: 'ws-opt small', for: 'wsAsk' }, ask, ' Pedir respuesta del agente');
  const send = h('button', { class: 'btn btn-primary', type: 'submit', html: icon('send') + '<span>Mandar</span>' });
  const asOrder = h('button', { class: 'btn', type: 'button', html: icon('bolt') + '<span>Convertir en orden</span>' });
  const quota = h('p', { class: 'tiny muted ws-quota' });
  const form = h('form', { class: 'ws-form', novalidate: true }, input, h('div', { class: 'ws-form-row' }, askL, h('div', { class: 'row' }, asOrder, send)), quota);
  const pane = h('section', { class: 'card panel ws-pane' }, head, feed, form);
  root.append(h('div', { class: 'ws-layout' }, h('aside', { class: 'card panel ws-side' }, h('h2', { class: 'ws-title' }, 'Canales'), list), pane));

  async function loadOverview() {
    try { ov = await api('/api/panel/ws', { token }); }
    catch (e) { root.replaceChildren(h('div', { class: 'alert warn' }, h('span', { html: icon('warn') }), h('div', {}, 'No se pudo abrir el espacio de trabajo: ' + (ERRW[e.code] || e.message)))); return false; }
    if (!ov.channels.length) {
      root.replaceChildren(h('div', { class: 'card panel empty-state' }, h('span', { class: 'gate-ic', html: icon('users') }), h('h2', {}, 'Todavía no tenés canales'),
        h('p', { class: 'muted' }, 'El espacio de trabajo es para el CEO, el Co-CEO y los supervisores de área. Si necesitás uno, pedíselo al CEO.')));
      return false;
    }
    drawList();
    quota.textContent = `Respuestas de los agentes hoy: ${ov.quota.agentReplies.used} de ${ov.quota.agentReplies.max} (dentro de las ${ov.quota.team.max} consultas diarias del equipo; usadas ${ov.quota.team.used}). Los agentes no publican ni envían nada desde acá.`;
    return true;
  }
  function drawList() {
    list.replaceChildren(...ov.channels.map((c) => {
      const b = h('button', { type: 'button', class: 'ws-ch' + (cur && cur.id === c.id ? ' on' : ''), 'aria-current': cur && cur.id === c.id ? 'true' : 'false', onclick: () => open(c.id) },
        h('span', { class: 'ws-ch-name' }, c.label), c.unread ? h('span', { class: 'ws-badge', 'aria-label': `${c.unread} sin leer` }, String(c.unread)) : null,
        c.last ? h('span', { class: 'ws-ch-last tiny muted' }, `${c.last.author_name}: ${c.last.body}`) : h('span', { class: 'ws-ch-last tiny muted' }, 'Sin mensajes todavía'));
      return b;
    }));
  }
  function bubble(m) {
    const cls = m.author_kind === 'human' ? (m.mine ? 'me' : 'human') : m.author_kind;
    return h('li', { class: 'ws-msg ' + cls },
      h('div', { class: 'ws-meta tiny' }, h('strong', {}, m.author_name), m.author_kind === 'agent' ? h('span', { class: 'tchip' }, 'agente') : m.author_kind === 'system' ? h('span', { class: 'tchip more' }, 'aviso') : null, h('span', { class: 'muted' }, when(m.created_at)), m.order_id ? h('span', { class: 'muted' }, 'orden ' + m.order_id) : null),
      h('p', { class: 'ws-body' }, m.body),   // texto plano (h() usa textContent)
      m.report_id && canDl ? h('div', { class: 'row ws-files' }, ...['xlsx', 'csv'].map((x) => h('button', { class: 'btn btn-sm', type: 'button', html: icon('download') + `<span>Descargar ${x.toUpperCase()}</span>`, onclick: () => download(`/api/panel/kpi/reports/${m.report_id}.${x}${x === 'csv' ? '?table=resumen' : ''}`, token, `reporte-${m.report_id}.${x}`) }))) : null);
  }
  async function open(id, quiet = false) {
    const c = ov.channels.find((x) => x.id === id) || ov.channels[0];
    cur = c; sessionStorage.setItem('ws-ch', c.id);
    const people = (c.people || []);
    head.replaceChildren(h('h2', {}, c.label), h('p', { class: 'small muted' }, c.desc + (c.agentName ? ` Agente del canal: ${c.agentName}${c.agentRole && c.agentRole !== c.agentName ? ' (' + c.agentRole + ')' : ''}.` : '')),
      people.length ? h('div', { class: 'ws-people', 'aria-label': 'Quiénes trabajan en este canal' }, ...people.map((p) => h('span', { class: 'ws-person' }, p.name, h('span', { class: 'tn-badge ' + (p.holder === 'humano' ? 'is-human' : 'is-agent') }, p.holder === 'humano' ? 'Humano' : 'Agente')))) : null);
    askL.hidden = !c.agent; asOrder.hidden = !c.agent || !ov.canOrder;
    if (!quiet) feed.replaceChildren(h('li', {}, h('div', { class: 'skeleton', style: 'height:60px' })));
    try {
      const r = await api('/api/panel/ws/' + c.id, { token });
      feed.replaceChildren(...(r.messages.length ? r.messages.map(bubble) : [h('li', { class: 'muted small ws-empty' }, c.agent ? 'Sin mensajes todavía. Preguntale algo al agente o dale una orden.' : 'Sin mensajes todavía.')]));
      feed.scrollTop = feed.scrollHeight;
      const x = ov.channels.find((y) => y.id === c.id); if (x) x.unread = 0; drawList();
    } catch (e) { feed.replaceChildren(h('li', { class: 'error-text' }, ERRW[e.code] || e.message)); }
  }
  async function submit(order) {
    const text = input.value.trim(); if (!text || !cur) { input.focus(); return; }
    send.disabled = asOrder.disabled = true;
    try {
      const r = await api('/api/panel/ws/' + cur.id, { method: 'POST', token, body: { text, ask: !order && cur.agent && ask.checked, order: !!order } });
      input.value = '';
      if (r.order) toast('Orden creada: queda en la cola del equipo.', 'success');
      await open(cur.id, true);
      await loadOverview(); drawList();
    } catch (e) { fail(e); }
    finally { send.disabled = asOrder.disabled = false; input.focus(); }
  }
  form.addEventListener('submit', (e) => { e.preventDefault(); submit(false); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(false); } });
  asOrder.onclick = async () => { if (!input.value.trim()) { input.focus(); return; } if (await confirmDialog({ title: 'Convertir en orden', text: `«${input.value.trim().slice(0, 140)}» queda como orden para ${cur.agentName || 'el agente del canal'}. La toma en el próximo turno; si termina en un cambio, espera aprobación.`, ok: 'Crear orden' })) submit(true); };
  if (await loadOverview()) {
    await open(sessionStorage.getItem('ws-ch') || ov.channels[0].id);
    timer = setInterval(() => { if (!document.hidden && root.isConnected && cur) { loadOverview().then((ok) => ok && open(cur.id, true)); } else if (!root.isConnected) clearInterval(timer); }, 30000);
  }
}

/* =================== Entrenamiento =================== */
const TST = { pendiente: ['En espera', ''], aprobada: ['Aprobado', 'ok'], desaprobada: ['A repasar', 'warn'], sin_modelo: ['Sin modelo', ''], cancelada: ['Cancelado', ''] };
export async function renderTraining(box, token, me) {
  const owner = (me.perms || []).includes('owner.settings') || me.role === 'ceo' || (me.user && me.user.role === 'ceo');
  const root = h('div', { class: 'train stack-lg' }); box.replaceChildren(root);
  const load = async () => {
    root.replaceChildren(h('div', { class: 'card panel' }, h('div', { class: 'skeleton', style: 'height:180px' })));
    let d;
    try { d = await api('/api/admin/team/training', { token }); }
    catch (e) { root.replaceChildren(h('div', { class: 'alert warn' }, h('span', { html: icon('warn') }), h('div', {}, 'No se pudo abrir el entrenamiento: ' + (ERRW[e.code] || e.message)))); return; }
    draw(d);
  };
  const assign = async (body) => { try { const r = await api('/api/admin/team/training/assign', { method: 'POST', token, body }); toast(`Asignado: ${r.created.length} sesión(es). Se hacen en los próximos turnos.`, 'success'); load(); } catch (e) { fail(e); } };
  function draw(d) {
    const memberSel = h('select', { class: 'select', 'aria-label': 'Agente' }, ...d.members.map((m) => h('option', { value: m.id }, `${m.name} · ${(d.areas.find((a) => a.id === m.area) || {}).label || m.area}`)));
    const run = h('button', { class: 'btn btn-sm', type: 'button', html: icon('play') + '<span>Entrenar ahora (1 sesión)</span>', disabled: !d.llm });
    run.onclick = async () => { run.disabled = true; try { const r = await api('/api/admin/team/training/run', { method: 'POST', token, body: {} }); toast(r.ran ? r.line : r.reason === 'sin_modelo' ? 'El modelo no está configurado en este servidor.' : 'No hay sesiones en espera o ya se usó el cupo de hoy.', r.ran ? 'success' : 'info'); load(); } catch (e) { fail(e); run.disabled = false; } };
    const head = h('section', { class: 'card panel' },
      h('div', { class: 'panel-head' }, h('h2', {}, 'Entrenamiento'), h('button', { class: 'btn btn-sm btn-ghost', type: 'button', html: icon('refresh') + '<span>Actualizar</span>', onclick: load })),
      h('p', { class: 'small' }, `Cada sesión es un ejercicio con material real del sitio y del equipo. El agente contesta con el modelo y se corrige con chequeos fijos (sin modelo). Con ${d.passScore}/100 o más aprueba: suma ${d.xpPass} XP y la habilidad del área. Si no, le queda una lección con la devolución.`),
      h('p', { class: 'tiny muted' }, d.note),
      h('div', { class: 'kpis team-kpis' },
        h('div', { class: 'kpi' }, h('span', { class: 'kpi-ic', html: icon('spark') }), h('div', {}, h('small', {}, 'Consultas de entrenamiento hoy'), h('strong', {}, `${d.budget.used} de ${d.budget.max}`), h('span', { class: 'muted tiny' }, `dentro de las ${d.budget.team.max} del equipo (usadas ${d.budget.team.used})`))),
        h('div', { class: 'kpi' }, h('span', { class: 'kpi-ic', html: icon('clock') }), h('div', {}, h('small', {}, 'Automáticas hoy'), h('strong', {}, `${d.budget.auto} de ${d.budget.autoMax}`), h('span', { class: 'muted tiny' }, 'el turno elige al que menos entrenó')))),
      !d.llm ? h('div', { class: 'alert info' }, h('span', { html: icon('info') }), h('div', {}, 'Este servidor no tiene el modelo configurado: se pueden asignar sesiones, pero no se corren.')) : null,
      owner ? h('div', { class: 'train-assign' }, h('label', { class: 'label' }, 'Asignar a un agente'), h('div', { class: 'row' }, memberSel, h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: () => assign({ member: memberSel.value }) }, 'Asignar'), run)) : h('p', { class: 'small muted' }, 'Asignar entrenamientos lo hace el dueño.'));
    const areas = h('section', { class: 'card panel' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Módulos por área')), h('ul', { class: 'train-areas' }, ...d.areas.map((a) => h('li', { class: 'train-area' },
      h('div', { class: 'train-area-head' }, h('strong', {}, a.label), h('span', { class: 'muted tiny' }, `${a.agents.length} agente(s) · ${a.sessions} sesión(es) · ${a.passed} aprobada(s)`)),
      h('ul', { class: 'small train-mods' }, ...a.modules.map((m) => h('li', {}, h('strong', {}, m.label + ': '), m.material))),
      h('p', { class: 'tiny muted' }, 'Al aprobar gana: ' + a.skill),
      owner && a.agents.length ? h('button', { class: 'btn btn-sm', type: 'button', onclick: () => assign({ area: a.id }) }, `Entrenar el área (${Math.min(a.agents.length, 8)})`) : null))));
    const rows = d.members.filter((m) => m.sessions).sort((a, b) => b.passed - a.passed || (b.avg || 0) - (a.avg || 0));
    const table = h('section', { class: 'card panel' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Puntajes por agente')),
      rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('caption', { class: 'sr-only' }, 'Puntajes de entrenamiento por agente'),
        h('thead', {}, h('tr', {}, ...['Agente', 'Área', 'Sesiones', 'Aprobadas', 'Promedio', 'Nivel interno'].map((t) => h('th', { scope: 'col' }, t)))),
        h('tbody', {}, ...rows.map((m) => h('tr', {}, h('td', {}, h('strong', {}, m.name)), h('td', { class: 'small' }, (d.areas.find((a) => a.id === m.area) || {}).label || m.area), h('td', {}, String(m.sessions)), h('td', {}, String(m.passed)), h('td', {}, m.avg == null ? '—' : m.avg + '/100'), h('td', { class: 'small' }, `Nv ${m.level} · ${m.title} · ${m.xp} XP`))))))
        : h('p', { class: 'muted small' }, 'Todavía nadie entrenó. Las primeras sesiones aparecen acá con su puntaje real.'));
    const hist = h('section', { class: 'card panel train-hist' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Historial de entrenamiento')),
      d.sessions.length ? h('ul', { class: 'team-props' }, ...d.sessions.map((x) => {
        const [l, c] = TST[x.status] || [x.status, ''];
        const ans = x.answer && typeof x.answer === 'object' ? JSON.stringify(x.answer).slice(0, 400) : x.answer ? String(x.answer).slice(0, 400) : '';
        return h('li', { class: 'team-prop' },
          h('div', { class: 'team-prop-head' }, h('span', { class: 'chip ' + c }, l), h('strong', {}, `${x.memberName} · ${x.areaLabel}`), x.score != null ? h('span', { class: 'train-score' }, `${x.score}/100`) : null, h('span', { class: 'muted tiny' }, when(x.created_at) + ' · ' + x.assigned_by)),
          x.exercise ? h('details', { class: 'small' }, h('summary', {}, `${x.module} · fuente: ${x.exercise.source}`), h('p', {}, x.exercise.prompt), h('pre', { class: 'train-pre' }, x.exercise.material), ans ? h('p', { class: 'tiny muted' }, 'Respuesta: ' + ans) : null) : h('p', { class: 'tiny muted' }, x.module === 'auto' ? 'El ejercicio se arma con material real cuando le toca el turno.' : x.module),
          x.feedback ? h('p', { class: 'small' }, x.feedback) : null,
          owner && x.status === 'pendiente' ? h('div', { class: 'row-actions' }, h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: async () => { try { await api(`/api/admin/team/training/${x.id}/cancel`, { method: 'POST', token, body: {} }); load(); } catch (e) { fail(e); } } }, 'Cancelar')) : null);
      })) : h('p', { class: 'muted small' }, 'Sin sesiones todavía.'));
    root.replaceChildren(head, areas, table, hist);
  }
  await load();
}

/* =================== Rendimiento =================== */
export async function renderPerf(box, token, me) {
  const root = h('div', { class: 'perf stack-lg' }); box.replaceChildren(root);
  const load = async () => {
    root.replaceChildren(h('div', { class: 'card panel' }, h('div', { class: 'skeleton', style: 'height:200px' })));
    let d;
    try { d = await api('/api/panel/perf', { token }); }
    catch (e) { root.replaceChildren(h('div', { class: 'alert warn' }, h('span', { html: icon('warn') }), h('div', {}, 'No se pudo leer el rendimiento: ' + (ERRW[e.code] || e.message)))); return; }
    draw(d);
  };
  const scoreCell = (x) => x.score == null ? h('span', { class: 'muted small' }, `Sin datos suficientes (${x.events} evento${x.events === 1 ? '' : 's'})`) : h('span', { class: 'perf-score' }, h('strong', {}, String(x.score)), h('span', { class: 'perf-bar', 'aria-hidden': 'true' }, h('i', { style: `width:${x.score}%` })));
  const counts = (c) => `${c.done} hechas · ${c.approved} aprobadas · ${c.failed} con error · ${c.rejected} rechazadas` + (c.testsPassed || c.reverted || c.prApproved || c.prRejected ? ` · ${c.testsPassed} pruebas OK · ${c.reverted} revertidas · ${c.prApproved}/${c.prRejected} PR aprob./rech.` : '');
  function draw(d) {
    const rules = h('details', { class: 'perf-rules' }, h('summary', {}, 'Cómo se calcula y cuándo hay ascensos'), h('ul', { class: 'small' }, ...d.rule.map((r) => h('li', {}, r))));
    const promos = d.promotions;
    const pending = promos.filter((p) => p.status === 'sugerida');
    const promoRow = (p) => {
      const kids = [h('div', { class: 'team-prop-head' }, h('span', { class: 'chip ' + (p.status === 'aplicada' || p.status === 'confirmada' ? 'ok' : p.status === 'sugerida' ? 'warn' : '') }, { aplicada: 'Aplicado', deshecha: 'Deshecho', sugerida: 'Sugerencia', confirmada: 'Confirmado', descartada: 'Descartada' }[p.status] || p.status),
        h('strong', {}, `${p.name}: ${p.fromLabel} → ${p.toLabel}`), h('span', { class: 'muted tiny' }, when(p.created_at) + (p.decided_by ? ' · ' + p.decided_by : ''))), h('p', { class: 'small' }, p.reason)];
      const acts = h('div', { class: 'row-actions' });
      if (p.canUndo) acts.append(h('button', { class: 'btn btn-sm', type: 'button', onclick: async (ev) => { if (!(await confirmDialog({ title: 'Deshacer el ascenso', text: 'Todos vuelven al puesto que tenían. Ese par no cambia de nuevo por 14 días.', ok: 'Deshacer' }))) return; ev.target.disabled = true; try { await api(`/api/panel/perf/promotions/${p.id}/undo`, { method: 'POST', token, body: {} }); toast('Deshecho', 'success'); load(); } catch (e) { fail(e); ev.target.disabled = false; } } }, 'Deshacer'));
      if (p.canDecide) {
        const ok = h('button', { class: 'btn btn-sm btn-primary', type: 'button' }, 'Confirmar ascenso');
        ok.onclick = async () => {
          let area = null;
          if (p.to_role === 'supervisor') {
            const sel = h('select', { class: 'select', 'aria-label': 'Área' }, ...AREAS.map(([v, l]) => h('option', { value: v }, l)));
            const v = await modal({ title: 'Área del supervisor', body: h('div', { class: 'stack' }, h('p', { class: 'small' }, `${p.name} pasa a Supervisor de área. ¿De qué área?`), sel), actions: [{ label: 'Cancelar', value: null, class: 'btn-ghost' }, { label: 'Confirmar', value: 'ok', class: 'btn-primary' }] }).done;
            if (v !== 'ok') return; area = sel.value;
          } else if (!(await confirmDialog({ title: 'Confirmar ascenso', text: `${p.name} pasa de ${p.fromLabel} a ${p.toLabel}. Cambia sus permisos en el panel.`, ok: 'Confirmar' }))) return;
          ok.disabled = true;
          try { await api(`/api/panel/perf/promotions/${p.id}/confirm`, { method: 'POST', token, body: area ? { area } : {} }); toast('Ascenso confirmado', 'success'); load(); } catch (e) { fail(e); ok.disabled = false; }
        };
        const no = h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: async () => { try { await api(`/api/panel/perf/promotions/${p.id}/dismiss`, { method: 'POST', token, body: {} }); toast('Sugerencia descartada'); load(); } catch (e) { fail(e); } } }, 'Ahora no');
        acts.append(ok, no);
      }
      if (acts.childElementCount) kids.push(acts);
      return h('li', { class: 'team-prop' }, ...kids);
    };
    const table = (rows, who) => rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table perf-table' },
      h('caption', { class: 'sr-only' }, who === 'agent' ? 'Puntaje de los agentes' : 'Puntaje de las personas'),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, '#'), h('th', { scope: 'col' }, who === 'agent' ? 'Agente o persona' : 'Persona'), h('th', { scope: 'col' }, 'Puesto'), h('th', { scope: 'col' }, 'Puntaje'), who === 'agent' ? h('th', { scope: 'col' }, 'Experiencia y habilidades') : null, h('th', { scope: 'col' }, 'Datos (30 días)'))),
      h('tbody', {}, ...rows.map((x, i) => h('tr', {}, h('td', {}, String(i + 1)), h('td', {}, h('strong', {}, x.name), who === 'agent' ? h('span', { class: 'tn-badge ' + (x.holder === 'humano' ? 'is-human' : 'is-agent'), style: 'margin-left:6px' }, x.holder === 'humano' ? 'Humano' : 'Agente') : null, x.principal ? h('span', { class: 'tn-badge is-principal', style: 'margin-left:4px' }, 'Principal') : null), h('td', { class: 'small' }, who === 'agent' ? x.role : x.roleLabel + (x.area ? ` (${(AREAS.find((a) => a[0] === x.area) || [, x.area])[1]})` : '')), h('td', {}, scoreCell(x)), who === 'agent' ? h('td', { class: 'small perf-growth' }, x.isNew ? h('span', { class: 'tn-new' }, 'Nuevo') : null, ` Nv ${x.level} · ${x.title} · ${x.xp} XP`, (x.skills || []).length ? h('div', { class: 'team-chips' }, ...x.skills.map((s) => h('span', { class: 'tchip won' + (s.source === 'entrenamiento' ? ' trained' : '') }, `${s.tag} ×${s.n}`))) : null) : null, h('td', { class: 'tiny muted' }, counts(x.counts)))))))
      : h('p', { class: 'muted small' }, who === 'agent' ? 'Sin agentes.' : 'Todavía no hay personas invitadas (aparte del dueño).');
    const anyAgentData = d.agents.some((a) => a.score != null);
    const evalBtn = d.canEvaluate ? h('button', { class: 'btn btn-sm', type: 'button', html: icon('refresh') + '<span>Evaluar ascensos ahora</span>', onclick: async (ev) => { ev.currentTarget.disabled = true; try { const r = await api('/api/panel/perf/evaluate', { method: 'POST', token, body: {} }); toast(r.applied.length ? `Ascensos aplicados: ${r.applied.length}` : 'Nadie cumple la regla todavía.', r.applied.length ? 'success' : 'info'); load(); } catch (e) { fail(e); } } }) : null;
    root.replaceChildren(...[
      h('section', { class: 'card panel' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Rendimiento'), evalBtn), h('p', { class: 'small muted' }, 'Puntajes con datos reales de los últimos 30 días. Sin datos, no se inventa nada.'), d.levelNote ? h('p', { class: 'tiny muted' }, d.levelNote) : null, rules),
      pending.length ? h('section', { class: 'card panel' }, h('h2', {}, 'Ascensos sugeridos (personas)'), h('p', { class: 'small muted' }, 'El sistema solo sugiere: el rol cambia cuando alguien con permiso lo confirma.'), h('ul', { class: 'team-props' }, ...pending.map(promoRow))) : null,
      h('section', { class: 'card panel' }, h('h2', {}, 'Organigrama: agentes y personas'), h('p', { class: 'tiny muted' }, 'Las personas que ocupan un puesto suman con sus acciones reales igual que los agentes. Los ascensos automáticos son solo entre agentes; para personas, solo sugerencias.'), anyAgentData ? null : h('p', { class: 'small muted' }, 'Todavía no hay datos suficientes de ningún agente: el puntaje aparece cuando cada uno junta al menos 3 eventos (tareas, aprobaciones, pruebas).'), table(d.agents, 'agent')),
      d.humans && (me.perms || []).includes('staff.view') ? h('section', { class: 'card panel' }, h('h2', {}, 'Personas'), table(d.humans, 'human')) : null,
      h('section', { class: 'card panel' }, h('h2', {}, 'Historial de ascensos'), promos.filter((p) => p.status !== 'sugerida').length ? h('ul', { class: 'team-props' }, ...promos.filter((p) => p.status !== 'sugerida').map(promoRow)) : h('p', { class: 'muted small' }, 'Todavía no hubo ascensos ni cambios de puesto.'))
    ].filter(Boolean));
  }
  await load();
}
