/**
 * /admin/ → «Equipo»: organigrama de agentes como lienzo de nodos (arrastrar, conectar, zoom y desplazamiento con
 * mouse o dedos), estado de cada agente, «Dar orden», historial, propuestas, contrataciones y cupos.
 * Todo pasa por worker-v2 (/api/admin/team/*). Ningún token llega al navegador.
 */
import { h, icon, esc, toast, confirmDialog, modal, timeAgo } from './ui.js';
import { CONFIG } from './config.js';

const NODE_W = 228, NODE_H = 150;
const ST = { activo: ['Activo', 'ok'], pausado: ['En pausa', 'warn'], desactivado: ['Apagado', ''] };
const OST = { pendiente: ['En cola', ''], en_curso: ['Trabajando', 'gold'], hecha: ['Hecha', 'ok'], propuesta: ['Espera tu OK', 'gold'], aprobada: ['Aprobada', 'ok'], rechazada: ['Rechazada', ''], fallida: ['Con error', 'danger'], cancelada: ['Cancelada', ''], delegada: ['Delegada', 'info'] };
const PRIO = [null, 'baja', 'media', 'alta', 'urgente'];
const KIND = { ceo: 'CEO', lead: 'Líder', worker: 'Trabajador' };
const GSTATE = { activo: ['Equipo activo', 'ok'], pausado: ['Equipo en pausa', 'warn'], detenido: ['Parada de emergencia', 'danger'] };
const ERR = {
  cycle: 'Esa conexión haría un círculo (alguien terminaría siendo jefe de su jefe).', parent_rank_must_be_higher: 'El jefe tiene que tener un rango más alto (número menor).',
  reports_rank_must_be_lower: 'Hay personas a cargo con un rango igual o más alto.', ceo_has_no_parent: 'El CEO no reporta a nadie.', only_ceo_rank_1: 'El rango 1 es solo del CEO.',
  has_reports: 'Primero mové a las personas que tiene a cargo.', cannot_delete_ceo: 'El CEO no se puede borrar.', manual_limit: 'Llegaste al máximo de turnos manuales de hoy.',
  github_not_configured: 'Falta tu cuenta de GitHub conectada para enviar el cambio.', queue_full: 'La cola está llena.', rate_limited: 'Demasiados pedidos seguidos; esperá un minuto.',
  login_required: 'Tu sesión venció: ingresá de nuevo.', owner_only: 'Solo la cuenta dueña.'
};
const ago = (t) => (t ? timeAgo(new Date(typeof t === 'number' ? t : Date.parse(t))) : 'todavía no');
const hhmm = (t) => new Date(t).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });

/** Posiciones por defecto: CEO arriba, líderes en fila y cada equipo en columna debajo de su líder. */
export function defaultLayout(members) {
  const pos = {}; const kids = (id) => members.filter((m) => m.parent_id === id);
  const ceo = members.find((m) => m.kind === 'ceo') || members[0]; if (!ceo) return pos;
  const top = kids(ceo.id); const gap = NODE_W + 44;
  pos[ceo.id] = { x: ((top.length - 1) * gap) / 2, y: 0 };
  top.forEach((l, i) => {
    pos[l.id] = { x: i * gap, y: NODE_H + 70 };
    let row = 0;
    const walk = (id, depth) => { for (const k of kids(id)) { pos[k.id] = { x: i * gap + depth * 18, y: 2 * (NODE_H + 70) + row * (NODE_H + 26) }; row++; walk(k.id, depth + 1); } };
    walk(l.id, 0);
  });
  let extra = 0; for (const m of members) if (!pos[m.id]) pos[m.id] = { x: -gap, y: (extra++) * (NODE_H + 26) };
  return pos;
}

export async function renderTeam(box, user, { base = String(CONFIG.API_BASE || '').replace(/\/+$/, ''), extraHeaders = null } = {}) {
  const call = async (path, { method = 'GET', body } = {}) => {
    const headers = extraHeaders ? { ...extraHeaders } : { Authorization: 'Bearer ' + (await user.getIdToken()) };
    if (body) headers['Content-Type'] = 'application/json';
    const r = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(ERR[j.error] || j.error || 'error_' + r.status); e.code = j.error; throw e; }
    return j;
  };
  const fail = (e) => toast(e.message || 'No se pudo completar.', 'danger');
  let d = null; let view = sessionStorage.getItem('team-view') || 'mapa';
  const root = h('div', { class: 'team stack-lg' }); box.replaceChildren(root);

  async function load() {
    root.replaceChildren(h('div', { class: 'card panel' }, h('div', { class: 'skeleton', style: 'height:320px' })));
    try { d = await call('/api/admin/team'); }
    catch (e) { root.replaceChildren(h('div', { class: 'alert warn' }, h('span', { html: icon('warn') }), h('div', {}, 'No se pudo leer el equipo (', esc(e.message), ').'))); return; }
    draw();
  }

  function draw() {
    root.replaceChildren(head(), channel(), quota(), proposals(), board(), ranking(), activity());
  }

  /* ---------- Cabecera: estado global + controles ---------- */
  function head() {
    const [gl, gc] = GSTATE[d.state] || GSTATE.activo;
    const setState = async (state) => {
      if (state === 'detenido' && !(await confirmDialog({ title: 'Parada de emergencia', text: 'Frena a todo el equipo y cancela los trabajos de GitHub en curso. ¿Seguimos?', ok: 'Detener todo', danger: true }))) return;
      try { await call('/api/admin/agents/state', { method: 'POST', body: { state, agents: d.agents || {} } }); toast(state === 'activo' ? 'Equipo activo' : state === 'pausado' ? 'Equipo en pausa' : 'Equipo detenido'); load(); } catch (e) { fail(e); }
    };
    const run = h('button', { class: 'btn btn-primary btn-sm', type: 'button', html: icon('play') + 'Hacer trabajar ahora', disabled: d.state !== 'activo' });
    run.onclick = async () => { run.disabled = true; try { const r = await call('/api/admin/team/tick', { method: 'POST', body: {} }); toast(r.did && r.did.length ? `Turno hecho: ${r.did.length} tarea(s)` : 'Turno hecho: nada pendiente'); load(); } catch (e) { fail(e); run.disabled = false; } };
    const sch = d.schedule;
    return h('section', { class: 'card panel team-head', 'aria-labelledby': 'team-title' },
      h('div', { class: 'panel-head' }, h('h2', { id: 'team-title' }, 'Equipo de agentes'),
        h('button', { class: 'btn btn-sm btn-ghost', type: 'button', html: icon('refresh') + 'Actualizar', onclick: load })),
      d.preview ? h('div', { class: 'alert info' }, h('span', { html: icon('info') }), h('div', {}, 'Copia de prueba: base de datos propia, no toca producción ni envía nada a GitHub.')) : null,
      h('div', { class: `state-banner ${gc}`, role: 'status' }, h('span', { class: 'dot' }), h('div', {}, h('strong', {}, gl), h('span', {}, ' · ' + sch.text))),
      h('div', { class: 'team-actions' }, run,
        d.state === 'activo' ? h('button', { class: 'btn btn-sm', type: 'button', html: icon('pause') + 'Pausar todo', onclick: () => setState('pausado') }) : h('button', { class: 'btn btn-sm', type: 'button', html: icon('play') + 'Reanudar', onclick: () => setState('activo') }),
        d.state !== 'detenido' ? h('button', { class: 'btn btn-sm btn-danger', type: 'button', html: icon('power') + 'Parada de emergencia', onclick: () => setState('detenido') }) : null),
      h('p', { class: 'muted small team-rules' }, `Se publican solos solo arreglos chicos que pasan las pruebas (hasta ${d.quota.autoPublish.maxFiles} archivos, ${d.quota.autoPublish.maxLines} líneas y ${d.quota.autoPublish.max} por día, con vuelta atrás automática; nunca precios, pagos, inicio de sesión ni textos legales). Todo plan del CEO, toda contratación y todo cambio más grande espera tu Aprobar.`));
  }

  /* ---------- Cupos ---------- */
  function quota() {
    const q = d.quota, s = d.schedule;
    const kpi = (label, value, sub, ic, warn) => h('div', { class: 'kpi' + (warn ? ' warn' : '') }, h('span', { class: 'kpi-ic', html: icon(ic) }), h('div', {}, h('small', {}, label), h('strong', {}, value), sub ? h('span', { class: 'muted tiny' }, sub) : null));
    const pct = (u, m) => (m ? Math.round((u / m) * 100) : 0);
    return h('section', { class: 'card panel', 'aria-labelledby': 'team-q' },
      h('div', { class: 'panel-head' }, h('h2', { id: 'team-q' }, 'Cupos de hoy')),
      h('div', { class: 'kpis team-kpis' },
        kpi('Turnos hoy', `${s.ticksToday} de ${s.ticksPerDay}`, `próximo ${hhmm(s.nextTick)} · último ${s.lastTick ? ago(s.lastTick.at) : 'todavía no'}`, 'clock'),
        kpi('Modelo · equipo', `${q.team.used} de ${q.team.max}`, `${pct(q.team.used, q.team.max)} % · hasta ${s.llmPerTick} por turno`, 'spark', q.team.used >= q.team.max),
        kpi('Modelo · GitHub', `${q.actions.used} de ${q.actions.max}`, 'rondas de los agentes de código', 'code', q.actions.used >= q.actions.max),
        kpi('Publicados solos', `${q.autoPublish.used} de ${q.autoPublish.max}`, 'arreglos chicos verificados', 'check'),
        kpi('Espera por cupo', q.backoffUntil ? 'hasta ' + hhmm(q.backoffUntil) : 'No', q.backoffUntil ? 'Google pidió esperar (429)' : 'el modelo responde', 'warn', !!q.backoffUntil),
        kpi('Tareas por turno', String(s.tasksPerTick), `${s.ticksPerDay * s.tasksPerTick} lugares por día`, 'users')),
      h('p', { class: 'muted tiny' }, q.reference));
  }

  /* ---------- Propuestas y contrataciones ---------- */
  function decideBtns(o) {
    const act = async (a, btn) => {
      if (a === 'approve' && !(await confirmDialog({ title: 'Aprobar', text: o.kind === 'contratacion' ? 'Se crea el agente nuevo (solo puede proponer, nunca publicar) y queda activo.' : o.kind === 'plan' ? 'Se crean las tareas del plan para cada agente.' : 'Se envía a los agentes de GitHub, que abren un PR (o publican solo si es un arreglo chico que pasa las pruebas).', ok: 'Aprobar' }))) return;
      btn.disabled = true;
      try {
        const r = await call(`/api/admin/team/orders/${o.id}/${a}`, { method: 'POST', body: {} }); toast(a === 'approve' ? (r.note || 'Aprobada') : 'Rechazada');
        await load();
        if (a === 'approve' && r.member) { const nm = d.members.find((x) => x.id === r.member); if (nm) orderDialog(nm, true); } // contratado: primera tarea con un toque
      } catch (e) { fail(e); btn.disabled = false; }
    };
    const ok = h('button', { class: 'btn btn-sm btn-primary', type: 'button' }, 'Aprobar'); ok.onclick = () => act('approve', ok);
    const no = h('button', { class: 'btn btn-sm btn-ghost', type: 'button' }, 'Rechazar'); no.onclick = () => act('reject', no);
    return h('div', { class: 'row-actions' }, ok, no);
  }
  const nameOf = (id) => (d.members.find((m) => m.id === id) || { name: id }).name;
  function proposalItem(o) {
    const r = o.result || { summary: '' };
    const kindLabel = o.kind === 'plan' ? 'Plan del CEO' : o.kind === 'contratacion' ? 'Contratación' : 'Cambio';
    return h('li', { class: 'team-prop' },
      h('div', { class: 'team-prop-head' }, h('span', { class: 'chip gold' }, kindLabel), h('strong', {}, nameOf(o.member_id)), h('span', { class: 'muted tiny' }, ago(o.created_at))),
      h('p', {}, r.summary),
      r.tasks ? h('ul', { class: 'team-tasks' }, ...r.tasks.map((t) => h('li', {}, h('strong', {}, nameOf(t.member) + ': '), t.text, t.reason ? h('span', { class: 'muted tiny team-why' }, ' · por qué: ' + t.reason) : null))) : null,
      r.change ? h('p', { class: 'small' }, h('strong', {}, r.change.title + ' · '), r.change.detail) : null,
      r.hire ? h('div', { class: 'small team-hire' }, h('p', {}, h('strong', {}, `${r.hire.name} (${r.hire.role})`), ` · reporta a ${nameOf(r.hire.parent)}`), h('p', {}, r.hire.why), r.hire.expected ? h('p', { class: 'muted' }, 'Tareas esperadas: ' + r.hire.expected) : null, chips(r.hire.tags)) : null,
      decideBtns(o));
  }
  function proposals() {
    const list = d.proposals.filter((o) => o.kind !== 'contratacion');
    const hires = d.hires || [];
    const sec = h('section', { class: 'card panel', 'aria-labelledby': 'team-p' }, h('div', { class: 'panel-head' }, h('h2', { id: 'team-p' }, `Esperan tu OK (${list.length})`)));
    sec.append(list.length ? h('ul', { class: 'team-props' }, ...list.map(proposalItem)) : h('p', { class: 'muted small' }, 'Nada pendiente. Los planes del CEO y los cambios propuestos aparecen acá.'));
    sec.append(h('h3', { class: 'team-sub' }, `Contrataciones (${hires.filter((x) => x.status === 'propuesta').length} por decidir)`));
    sec.append(hires.length ? h('ul', { class: 'team-props' }, ...hires.map((o) => o.status === 'propuesta' ? proposalItem(o) : h('li', { class: 'team-prop done' }, h('span', { class: 'chip ' + (OST[o.status] || ['', ''])[1] }, (OST[o.status] || [o.status])[0]), ' ', (o.result && o.result.hire && o.result.hire.role) || o.text, h('span', { class: 'muted tiny' }, ' · ' + ago(o.created_at)))))
      : h('p', { class: 'muted small' }, 'El CEO propone contratar un agente nuevo solo cuando nadie del equipo tiene las habilidades para una orden. Nunca lo crea solo.'));
    return sec;
  }

  const chips = (tags, max = 6) => { const t = String(tags || '').split(',').map((x) => x.trim()).filter(Boolean); return t.length ? h('div', { class: 'team-chips' }, ...t.slice(0, max).map((x) => h('span', { class: 'tchip' }, x)), t.length > max ? h('span', { class: 'tchip more' }, '+' + (t.length - max)) : null) : null; };

  /* ---------- Lienzo ---------- */
  function board() {
    const sec = h('section', { class: 'card panel team-board', 'aria-labelledby': 'team-b' });
    const seg = h('div', { class: 'seg seg-sm seg-2', role: 'tablist', 'aria-label': 'Vista del equipo' });
    for (const [v, l] of [['mapa', 'Mapa'], ['lista', 'Lista']]) seg.append(h('button', { type: 'button', role: 'tab', 'aria-selected': String(view === v), onclick: () => { view = v; sessionStorage.setItem('team-view', v); draw(); } }, l));
    const addBtn = h('button', { class: 'btn btn-sm', type: 'button', html: icon('plus') + 'Agregar agente', onclick: () => editDialog(null) });
    sec.append(h('div', { class: 'panel-head' }, h('h2', { id: 'team-b' }, 'Organigrama'), seg, addBtn));
    if (view === 'lista') { sec.append(listView()); return sec; }
    sec.append(canvas());
    return sec;
  }

  function listView() {
    const ul = h('ul', { class: 'team-list' });
    const kids = (id) => d.members.filter((m) => m.parent_id === id);
    const item = (m, depth) => {
      const [sl, sc] = ST[m.status] || ST.activo;
      ul.append(h('li', { style: `--depth:${depth}` }, h('button', { type: 'button', class: 'team-li', onclick: () => detail(m.id) },
        h('span', { class: 'tn-dot ' + sc, 'aria-hidden': 'true' }), h('span', { class: 'team-li-name' }, m.name), h('span', { class: 'chip' }, 'Rango ' + m.rank), h('span', { class: 'chip ' + sc }, sl),
        h('span', { class: 'muted tiny' }, `${m.tasks_done} tareas · ${m.queue} en cola`))));
      for (const k of kids(m.id)) item(k, depth + 1);
    };
    for (const m of d.members.filter((x) => !x.parent_id)) item(m, 0);
    return ul;
  }

  function canvas() {
    const def = defaultLayout(d.members);
    const pos = {}; for (const m of d.members) pos[m.id] = m.x != null && m.y != null ? { x: m.x, y: m.y } : def[m.id];
    const vp = h('div', { class: 'tc-viewport', tabindex: '0', role: 'application', 'aria-label': 'Lienzo del organigrama. Arrastrá para mover; pellizcá o usá los botones para acercar.' });
    const stage = h('div', { class: 'tc-stage' });
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg'); svg.setAttribute('class', 'tc-edges'); svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<defs><marker id="tcArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>';
    stage.append(svg); vp.append(stage);
    const T = { x: 20, y: 20, k: 1 };
    const apply = () => { stage.style.transform = `translate(${T.x}px, ${T.y}px) scale(${T.k})`; };
    const nodes = {};
    const recentAssign = (d.assignments || []).filter((a) => Date.now() - a.created_at < 24 * 3600e3 && a.created_by && /^CEO/.test(a.created_by));
    const edges = () => {
      let out = '';
      for (const m of d.members) {
        if (!m.parent_id || !pos[m.parent_id]) continue;
        const a = pos[m.parent_id], b = pos[m.id];
        const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H, x2 = b.x + NODE_W / 2, y2 = b.y; const my = (y1 + y2) / 2;
        const flowing = (d.assignments || []).some((a) => a.member_id === m.id && Date.now() - a.created_at < 24 * 3600e3);
        out += `<path class="tc-edge${m.status !== 'activo' ? ' off' : ''}${flowing ? ' flow' : ''}" d="M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}"/>`;
      }
      // Asignaciones del CEO (últimas 24 h): flechas punteadas del CEO al agente.
      const ceo = d.members.find((m) => m.kind === 'ceo');
      const seen = new Set();
      if (ceo) for (const a of recentAssign) {
        if (seen.has(a.member_id) || !pos[a.member_id] || a.member_id === ceo.id) continue; seen.add(a.member_id);
        const c = pos[ceo.id], b = pos[a.member_id];
        const x1 = c.x + NODE_W, y1 = c.y + NODE_H / 2, x2 = b.x + NODE_W, y2 = b.y + NODE_H / 2; const cx = Math.max(x1, x2) + 90;
        out += `<path class="tc-assign" marker-end="url(#tcArrow)" d="M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}"><title>${esc(a.text.slice(0, 120))}</title></path>`;
      }
      svg.innerHTML = svg.innerHTML.split('</defs>')[0] + '</defs>' + out;
      let maxX = 0, maxY = 0; for (const p of Object.values(pos)) { maxX = Math.max(maxX, p.x + NODE_W + 120); maxY = Math.max(maxY, p.y + NODE_H + 40); }
      svg.setAttribute('width', String(maxX)); svg.setAttribute('height', String(maxY));
    };
    const place = (id) => { const n = nodes[id]; n.style.transform = `translate(${pos[id].x}px, ${pos[id].y}px)`; };
    for (const m of d.members) {
      const [sl, sc] = ST[m.status] || ST.activo;
      const sw = h('button', { type: 'button', class: 'tn-switch', role: 'switch', 'aria-checked': String(m.status === 'activo'), 'aria-label': `${m.name}: ${m.status === 'activo' ? 'apagar' : 'encender'}` }, h('i'));
      sw.onclick = async (e) => { e.stopPropagation(); try { await call(`/api/admin/team/members/${m.id}`, { method: 'PATCH', body: { status: m.status === 'activo' ? 'desactivado' : 'activo' } }); load(); } catch (er) { fail(er); } };
      const order = h('button', { type: 'button', class: 'tn-order', html: icon('send') + '<span>Dar orden</span>' });
      order.onclick = (e) => { e.stopPropagation(); orderDialog(m); };
      const port = h('span', { class: 'tn-port', title: 'Arrastrá hasta otro nodo para cambiar a quién reporta', 'aria-hidden': 'true' });
      const n = h('div', { class: `tn tn-${m.kind} st-${m.status}`, tabindex: '0', role: 'button', 'aria-label': `${m.name}, ${KIND[m.kind]}, rango ${m.rank}, ${sl}. Abrir detalle.`, dataset: { id: m.id } },
        m.kind !== 'ceo' ? port : null,
        h('div', { class: 'tn-top' }, h('span', { class: 'tn-dot ' + sc, 'aria-hidden': 'true' }), h('strong', { class: 'tn-name' }, m.name), h('span', { class: 'tn-rank', title: 'Rango' }, 'R' + m.rank)),
        h('div', { class: 'tn-role' }, m.role !== m.name ? m.role : m.kind === 'lead' && m.rank >= 3 ? 'Supervisor' : KIND[m.kind]),
        chips(m.tags, 3),
        h('div', { class: 'tn-meta' }, `Nv ${m.progress ? m.progress.level : 1} · ${m.tasks_done} tareas · ${m.queue} en cola · ${m.last_run_at ? ago(m.last_run_at) : 'sin turnos'}`),
        m.progress && m.progress.rest ? h('div', { class: 'tn-rest', title: 'Sala de descanso (metáfora): no toma tareas por ahora' }, 'Descansa: ' + m.progress.rest.toLowerCase()) : null,
        h('div', { class: 'tn-foot' }, sw, order));
      n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); detail(m.id); } });
      nodes[m.id] = n; stage.append(n); place(m.id);
    }
    edges(); apply();

    // ---- Gestos: arrastrar nodos, conectar, desplazar y pellizcar ----
    const ptrs = new Map(); let mode = null; let drag = null; let pinch = null; let temp = null;
    const toStage = (cx, cy) => { const r = vp.getBoundingClientRect(); return { x: (cx - r.left - T.x) / T.k, y: (cy - r.top - T.y) / T.k }; };
    vp.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      vp.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), k: T.k, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, T: { ...T } }; mode = 'pinch'; drag = null; return; }
      const portEl = e.target.closest('.tn-port'); const nodeEl = e.target.closest('.tn');
      if (portEl && nodeEl) { mode = 'connect'; drag = { id: nodeEl.dataset.id }; temp = document.createElementNS(svgNS, 'path'); temp.setAttribute('class', 'tc-temp'); svg.append(temp); return; }
      if (nodeEl) { mode = 'node'; const p = toStage(e.clientX, e.clientY); drag = { id: nodeEl.dataset.id, dx: p.x - pos[nodeEl.dataset.id].x, dy: p.y - pos[nodeEl.dataset.id].y, moved: false, sx: e.clientX, sy: e.clientY }; return; }
      mode = 'pan'; drag = { sx: e.clientX, sy: e.clientY, tx: T.x, ty: T.y };
    });
    vp.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (mode === 'pinch' && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()]; const k = Math.min(2, Math.max(0.3, pinch.k * Math.hypot(a.x - b.x, a.y - b.y) / pinch.dist));
        const r = vp.getBoundingClientRect(); const mx = pinch.mid.x - r.left, my = pinch.mid.y - r.top;
        T.x = mx - ((mx - pinch.T.x) * k) / pinch.k; T.y = my - ((my - pinch.T.y) * k) / pinch.k; T.k = k; apply(); return;
      }
      if (mode === 'pan') { T.x = drag.tx + e.clientX - drag.sx; T.y = drag.ty + e.clientY - drag.sy; apply(); return; }
      if (mode === 'node') {
        if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 5) return;
        drag.moved = true; const p = toStage(e.clientX, e.clientY); pos[drag.id] = { x: Math.round(p.x - drag.dx), y: Math.round(p.y - drag.dy) }; place(drag.id); edges(); return;
      }
      if (mode === 'connect') { const a = pos[drag.id]; const p = toStage(e.clientX, e.clientY); temp.setAttribute('d', `M${a.x + NODE_W / 2},${a.y} L${p.x},${p.y}`); svg.append(temp); }
    });
    const end = async (e) => {
      if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId);
      const m = mode; const dr = drag; if (ptrs.size === 0) { mode = null; drag = null; }
      if (m === 'node' && dr) {
        if (!dr.moved) { detail(dr.id); return; }
        try { await call('/api/admin/team/layout', { method: 'POST', body: { positions: [{ id: dr.id, ...pos[dr.id] }] } }); } catch (er) { fail(er); }
      }
      if (m === 'connect' && dr) {
        temp && temp.remove(); temp = null;
        const el = document.elementFromPoint(e.clientX, e.clientY); const target = el && el.closest('.tn');
        if (target && target.dataset.id !== dr.id) {
          try { await call(`/api/admin/team/members/${dr.id}`, { method: 'PATCH', body: { parent_id: target.dataset.id } }); toast(`${nameOf(dr.id)} ahora reporta a ${nameOf(target.dataset.id)}`); load(); } catch (er) { fail(er); }
        }
      }
    };
    vp.addEventListener('pointerup', end); vp.addEventListener('pointercancel', end);
    vp.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY); }, { passive: false });
    vp.addEventListener('keydown', (e) => { if (e.target !== vp) return; const s = 40; if (e.key === 'ArrowLeft') T.x += s; else if (e.key === 'ArrowRight') T.x -= s; else if (e.key === 'ArrowUp') T.y += s; else if (e.key === 'ArrowDown') T.y -= s; else if (e.key === '+') return zoomAt(1.15); else if (e.key === '-') return zoomAt(1 / 1.15); else return; e.preventDefault(); apply(); });
    function zoomAt(f, cx, cy) {
      const r = vp.getBoundingClientRect(); const mx = (cx ?? r.left + r.width / 2) - r.left, my = (cy ?? r.top + r.height / 2) - r.top;
      const k = Math.min(2, Math.max(0.3, T.k * f)); T.x = mx - ((mx - T.x) * k) / T.k; T.y = my - ((my - T.y) * k) / T.k; T.k = k; apply();
    }
    function fit(all) {
      const r = vp.getBoundingClientRect(); if (!r.width) return;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of Object.values(pos)) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x + NODE_W); y1 = Math.max(y1, p.y + NODE_H); }
      const pad = 24; let k = Math.min(1.1, Math.max(0.3, Math.min((r.width - pad * 2) / (x1 - x0), (r.height - pad * 2) / (y1 - y0))));
      if (r.width < 700 && !all) { // celular/tablet chica: legible primero (CEO y líderes); «Ajustar» muestra todo
        k = Math.max(k, 0.62); const ceo = d.members.find((m) => m.kind === 'ceo'); const c = ceo ? pos[ceo.id] : { x: x0, y: y0 };
        T.k = k; T.x = r.width / 2 - (c.x + NODE_W / 2) * k; T.y = pad + 40 - c.y * k; apply(); return;
      }
      T.k = k; T.x = (r.width - (x1 - x0) * k) / 2 - x0 * k; T.y = pad + (r.width < 700 ? 40 : 0) - y0 * k; apply();
    }
    const tools = h('div', { class: 'tc-tools' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Alejar', onclick: () => zoomAt(1 / 1.2) }, '−'),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Acercar', onclick: () => zoomAt(1.2) }, '+'),
      h('button', { type: 'button', class: 'btn btn-sm btn-ghost', onclick: () => fit(true) }, 'Ajustar'),
      h('button', { type: 'button', class: 'btn btn-sm btn-ghost', onclick: async () => { if (!(await confirmDialog({ title: 'Ordenar', text: 'Vuelve a acomodar todos los nodos en su lugar automático.', ok: 'Ordenar' }))) return; try { await call('/api/admin/team/layout', { method: 'POST', body: { reset: true } }); load(); } catch (e) { fail(e); } } }, 'Ordenar'));
    const legend = h('p', { class: 'muted tiny tc-legend' }, 'Arrastrá un nodo para moverlo · arrastrá el punto de arriba de un nodo hasta otro para cambiar a quién reporta · línea animada = orden que bajó por esa conexión en las últimas 24 h · línea punteada = tarea asignada por el CEO.');
    requestAnimationFrame(() => fit(false));
    return h('div', { class: 'tc-wrap' }, vp, tools, legend);
  }

  /* ---------- Diálogos ---------- */
  function orderDialog(m, first = false) {
    const ta = h('textarea', { class: 'input', rows: '4', maxlength: '1200', required: true, placeholder: m.kind === 'ceo' ? 'Ej.: Mejorá la velocidad de la portada en celulares.' : 'Ej.: Revisá los textos de la página de planes.', 'aria-label': 'Orden' });
    const pr = h('select', { class: 'select', 'aria-label': 'Prioridad' }, ...[2, 3, 4, 1].map((p) => h('option', { value: String(p) }, p === 2 ? 'Prioridad media' : 'Prioridad ' + PRIO[p])));
    const hint = m.kind === 'ceo' ? 'El CEO arma un plan con las tareas y a quién se las da (con el motivo). El plan llega acá para tu OK.' : m.kind === 'lead' ? 'El líder la pasa a la persona de su equipo cuyas habilidades mejor encajan.' : 'Responde con un informe o una propuesta de cambio. Nada se publica sin las reglas de siempre.';
    const err = h('p', { class: 'error-text', hidden: true });
    modal({
      title: first ? `Primera tarea para ${m.name}` : `Dar orden a ${m.name}`, label: `Dar orden a ${m.name}`,
      body: h('div', { class: 'stack team-order' }, h('p', { class: 'muted small' }, hint), h('label', { class: 'label' }, 'Qué tiene que hacer'), ta, pr, err,
        h('p', { class: 'muted tiny' }, m.status !== 'activo' ? `Ahora está ${ST[m.status][0].toLowerCase()}: la orden espera en la cola hasta que lo actives.` : `Se toma en el próximo turno (cada ${d.schedule.everyMin} min) o con «Hacer trabajar ahora».`)),
      actions: [{ label: 'Cancelar', class: 'btn-ghost', value: false }, { label: 'Enviar orden', class: 'btn-primary', onClick: async () => {
        if (ta.value.trim().length < 4) { err.textContent = 'Escribí la orden (al menos 4 letras).'; err.hidden = false; return false; }
        try { await call('/api/admin/team/orders', { method: 'POST', body: { member_id: m.id, text: ta.value.trim(), priority: Number(pr.value) } }); toast('Orden en la cola'); load(); }
        catch (e) { err.textContent = e.message; err.hidden = false; return false; }
      } }],
      onOpen: () => ta.focus()
    });
  }

  async function detail(id) {
    const m = d.members.find((x) => x.id === id); if (!m) return;
    const hist = h('div', { class: 'team-hist' }, h('div', { class: 'skeleton', style: 'height:60px' }));
    const seg = h('div', { class: 'seg seg-sm', role: 'radiogroup', 'aria-label': 'Estado' });
    for (const s of ['activo', 'pausado', 'desactivado']) seg.append(h('button', { type: 'button', role: 'radio', 'aria-checked': String(m.status === s), 'aria-selected': String(m.status === s), onclick: async () => { try { await call(`/api/admin/team/members/${m.id}`, { method: 'PATCH', body: { status: s } }); dlg.close(); load(); } catch (e) { fail(e); } } }, ST[s][0]));
    const runOne = h('button', { class: 'btn btn-sm', type: 'button', html: icon('play') + 'Hacer trabajar ahora', disabled: m.status !== 'activo' || d.state !== 'activo' });
    runOne.onclick = async () => { runOne.disabled = true; try { const r = await call('/api/admin/team/tick', { method: 'POST', body: { member: m.id } }); toast(r.did && r.did.length ? r.did.join(' · ') : 'Sin tareas para hacer ahora'); dlg.close(); load(); } catch (e) { fail(e); runOne.disabled = false; } };
    const parent = d.members.find((x) => x.id === m.parent_id);
    const dlg = modal({
      title: m.name, wide: true,
      body: h('div', { class: 'stack team-detail' },
        h('div', { class: 'team-detail-top' }, h('span', { class: 'chip' }, KIND[m.kind]), h('span', { class: 'chip' }, 'Rango ' + m.rank), parent ? h('span', { class: 'muted small' }, 'Reporta a ' + parent.name) : null, m.agent_id ? h('span', { class: 'chip info' }, 'Agente de GitHub: ' + m.agent_id) : null),
        h('p', {}, m.duties),
        h('div', { class: 'team-profile' },
          h('div', {}, h('small', { class: 'label' }, 'Habilidades'), chips(m.tags, 12) || h('span', { class: 'muted small' }, '—')),
          h('div', {}, h('small', { class: 'label' }, 'Conocimiento'), chips(m.knowledge, 12) || h('span', { class: 'muted small' }, '—')),
          h('div', {}, h('small', { class: 'label' }, 'Herramientas y permisos'), h('ul', { class: 'team-tools' }, ...(m.tools || []).map((t) => h('li', {}, t)))),
          h('div', {}, h('small', { class: 'label' }, 'Tope por día'), h('strong', {}, `${m.max_per_day} tareas`))),
        m.progress ? h('div', { class: 'team-progress' },
          h('p', { class: 'muted tiny' }, 'Progreso (metáfora de juego, calculada con tareas reales; no mide inteligencia): +5 por tarea hecha, +20 por propuesta aprobada, +3 por propuesta, −2 por error.'),
          h('div', { class: 'team-pgrid' }, ...[['Nivel', m.progress.level], ['XP', m.progress.xp], ['Edad', `${m.progress.ageDays} día(s)`], ['Hechas', m.progress.done], ['Aprobadas', m.progress.approved], ['Errores', m.progress.failed]].map(([k, v]) => h('div', {}, h('small', {}, k), h('strong', {}, String(v))))),
          h('small', { class: 'label' }, `Lecciones aprendidas (${m.progress.lessonCount}) · entran en sus próximos pedidos al modelo`),
          m.progress.lessons.length ? h('ul', { class: 'team-lessons' }, ...m.progress.lessons.map((l) => h('li', {}, l))) : h('p', { class: 'muted small' }, 'Todavía ninguna.')) : null,
        h('div', { class: 'team-detail-actions' }, seg, runOne,
          h('button', { class: 'btn btn-sm btn-primary', type: 'button', html: icon('send') + 'Dar orden', onclick: () => { dlg.close(); orderDialog(m); } }),
          h('button', { class: 'btn btn-sm btn-ghost', type: 'button', html: icon('edit') + 'Editar', onclick: () => { dlg.close(); editDialog(m); } })),
        h('h3', { class: 'team-sub' }, 'Bandeja: órdenes recibidas, resultados y reportes'), hist)
    });
    try {
      const r = await call(`/api/admin/team/orders?member=${encodeURIComponent(m.id)}&limit=30`);
      hist.replaceChildren(r.orders.length ? h('ul', { class: 'team-orders' }, ...r.orders.map(orderRow)) : h('p', { class: 'muted small' }, 'Todavía no hizo tareas.'));
    } catch (e) { hist.replaceChildren(h('p', { class: 'error-text' }, e.message)); }
  }

  function orderRow(o) {
    const [l, c] = OST[o.status] || [o.status, ''];
    const cancel = ['pendiente', 'en_curso'].includes(o.status) ? h('button', { class: 'linklike tiny', type: 'button', onclick: async () => { try { await call(`/api/admin/team/orders/${o.id}/cancel`, { method: 'POST', body: {} }); toast('Cancelada'); load(); } catch (e) { fail(e); } } }, 'Cancelar') : null;
    const src = o.source === 'admin' ? 'Tu orden' : o.source === 'rutina' ? 'Rutina' : o.source === 'ceo' ? 'Del CEO' : 'De su líder';
    return h('li', { class: 'team-order-row' },
      h('div', { class: 'team-order-head' }, h('span', { class: 'chip ' + c }, l), h('strong', {}, o.text.slice(0, 120)), h('span', { class: 'muted tiny' }, `${src} · ${PRIO[o.priority] || ''} · ${ago(o.created_at)}`)),
      o.reason ? h('p', { class: 'muted tiny team-why' }, 'Por qué: ' + o.reason) : null,
      o.result && o.result.summary ? h('p', { class: 'small' }, o.result.summary) : null,
      o.link ? h('a', { class: 'small', href: o.link, target: '_blank', rel: 'noopener' }, 'Ver en GitHub') : null, cancel,
      o.status === 'propuesta' ? decideBtns(o) : null);
  }

  function editDialog(m) {
    const isNew = !m; m = m || { name: '', role: '', rank: 3, parent_id: 'lead-dev', duties: '', tags: '', knowledge: '', max_per_day: 6, kind: 'worker', skill: 'propose' };
    const name = h('input', { class: 'input', value: m.name, maxlength: '60', 'aria-label': 'Nombre' });
    const role = h('input', { class: 'input', value: m.role, maxlength: '80', 'aria-label': 'Rol' });
    const rank = h('select', { class: 'select', 'aria-label': 'Rango', disabled: m.kind === 'ceo' }, ...[1, 2, 3, 4, 5].map((r) => h('option', { value: String(r), selected: r === m.rank }, `Rango ${r}${r === 1 ? ' (CEO)' : r === 2 ? ' (líder)' : ''}`)));
    const parent = h('select', { class: 'select', 'aria-label': 'Reporta a', disabled: m.kind === 'ceo' }, ...d.members.filter((x) => x.id !== m.id).map((x) => h('option', { value: x.id, selected: x.id === m.parent_id }, `${x.name} (rango ${x.rank})`)));
    const duties = h('textarea', { class: 'input', rows: '3', maxlength: '400', 'aria-label': 'Funciones' }, m.duties);
    const tags = h('input', { class: 'input', value: m.tags || '', maxlength: '300', 'aria-label': 'Habilidades (separadas por coma)' });
    const know = h('input', { class: 'input', value: m.knowledge || '', maxlength: '300', 'aria-label': 'Conocimiento (separado por coma)' });
    const max = h('input', { class: 'input', type: 'number', min: '1', max: '48', value: String(m.max_per_day || 6), 'aria-label': 'Tope de tareas por día' });
    const skill = h('select', { class: 'select', 'aria-label': 'Tipo de tarea' }, h('option', { value: 'propose' }, 'Revisa y propone'), h('option', { value: 'lead' }, 'Líder (reparte)'), h('option', { value: 'monitor' }, 'Monitoreo'), h('option', { value: 'links' }, 'Enlaces'), h('option', { value: 'perf' }, 'Rendimiento'), h('option', { value: 'a11y' }, 'Accesibilidad'), h('option', { value: 'support' }, 'Atención'));
    const err = h('p', { class: 'error-text', hidden: true });
    const L = (t, el) => h('label', { class: 'label' }, t, el);
    modal({
      title: isNew ? 'Agregar agente' : `Editar ${m.name}`, wide: true,
      body: h('div', { class: 'team-form' }, L('Nombre', name), L('Rol', role), L('Rango', rank), L('Reporta a', parent), isNew ? L('Tipo de tarea', skill) : null, L('Tope por día', max), h('label', { class: 'label span-all' }, 'Funciones', duties), L('Habilidades (separadas por coma)', tags), L('Conocimiento', know), err),
      actions: [
        !isNew && m.kind !== 'ceo' ? { label: 'Borrar', class: 'btn-ghost danger-text', onClick: async () => { if (!(await confirmDialog({ title: 'Borrar agente', text: `Se borra «${m.name}» y se cancelan sus órdenes abiertas.`, ok: 'Borrar', danger: true }))) return false; try { await call(`/api/admin/team/members/${m.id}`, { method: 'DELETE' }); toast('Agente borrado'); load(); } catch (e) { err.textContent = e.message; err.hidden = false; return false; } } } : null,
        { label: 'Cancelar', class: 'btn-ghost', value: false },
        { label: 'Guardar', class: 'btn-primary', onClick: async () => {
          const body = { name: name.value, role: role.value || name.value, duties: duties.value, tags: tags.value, knowledge: know.value, max_per_day: Number(max.value) };
          if (m.kind !== 'ceo') { body.rank = Number(rank.value); body.parent_id = parent.value; }
          try {
            if (isNew) await call('/api/admin/team/members', { method: 'POST', body: { ...body, skill: skill.value } });
            else await call(`/api/admin/team/members/${m.id}`, { method: 'PATCH', body });
            toast('Guardado'); load();
          } catch (e) { err.textContent = e.message; err.hidden = false; return false; }
        } }].filter(Boolean)
    });
  }

  /* ---------- Canal CEO agéntico ↔ Demian ---------- */
  function channel() {
    const ceo = d.members.find((m) => m.kind === 'ceo');
    const msgs = d.orders.filter((o) => o.member_id === (ceo && ceo.id) && (o.source === 'admin' || ['informe', 'plan', 'senal'].includes(o.kind) || (o.result && /^Resumen|^Reporte diario|^Plan de mejora/.test(o.result.summary || ''))))
      .slice(0, 8).reverse();
    // Reportes de líderes del día (de abajo hacia arriba) como contexto plegado.
    const reps = d.orders.filter((o) => o.kind === 'reporte' && (d.members.find((m) => m.id === o.member_id) || {}).rank === 2).slice(0, 4);
    const list = h('ol', { class: 'team-chat', 'aria-label': 'Mensajes con el CEO' });
    for (const o of msgs) {
      if (o.source === 'admin') list.append(h('li', { class: 'me' }, h('small', {}, 'Vos · ' + ago(o.created_at)), h('p', {}, o.text)));
      if (o.result && o.result.summary) list.append(h('li', { class: 'ceo' }, h('small', {}, 'CEO agéntico · ' + ago(o.finished_at || o.created_at)), h('p', {}, o.result.summary), o.status === 'propuesta' ? h('p', { class: 'tiny' }, 'Espera tu OK en «Esperan tu OK».') : null));
    }
    if (!list.children.length) list.append(h('li', { class: 'ceo' }, h('small', {}, 'CEO agéntico'), h('p', {}, 'Todavía no hay mensajes. Cada día publico acá el plan de mejora (desde las 8) y el resumen (desde las 21). Escribime una orden o una pregunta y la tomo en el próximo turno.')));
    const ta = h('textarea', { class: 'input', rows: '2', maxlength: '1200', placeholder: 'Escribile al CEO: una orden, una pregunta o una prioridad…', 'aria-label': 'Mensaje para el CEO' });
    const send = h('button', { class: 'btn btn-primary btn-sm', type: 'submit', html: icon('send') + 'Enviar' });
    const form = h('form', { class: 'team-chat-form' }, ta, send);
    form.addEventListener('submit', async (e) => { e.preventDefault(); if (ta.value.trim().length < 4 || !ceo) return; send.disabled = true; try { await call('/api/admin/team/orders', { method: 'POST', body: { member_id: ceo.id, text: ta.value.trim(), priority: 3 } }); toast('Enviado al CEO'); load(); } catch (er) { fail(er); send.disabled = false; } });
    const tab = document.querySelector('[role=tab][data-tab=equipo]');
    if (tab) { tab.querySelector('.tab-badge')?.remove(); if (d.unreadReport) tab.append(h('span', { class: 'tab-badge', 'aria-label': 'Reporte nuevo' }, '1')); }
    const seenBtn = d.unreadReport ? h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: async () => { try { await call('/api/admin/team/seen', { method: 'POST', body: {} }); load(); } catch (e) { fail(e); } } }, 'Marcar como leído') : null;
    return h('section', { class: 'card panel', 'aria-labelledby': 'team-c' }, h('div', { class: 'panel-head' }, h('h2', { id: 'team-c' }, 'CEO agéntico ↔ Demian'), d.unreadReport ? h('span', { class: 'chip gold', role: 'status' }, 'Reporte nuevo') : null, seenBtn),
      h('p', { class: 'muted small' }, 'El CEO agéntico recomienda; vos decidís. Cada día, desde las 20, los trabajadores reportan a su supervisor, los supervisores a su líder y los líderes al CEO; desde las 21 llega acá un solo reporte. Avisos solo dentro del panel: no se manda nada afuera.'), list,
      reps.length ? h('details', { class: 'team-reps' }, h('summary', {}, `Reportes de los líderes (${reps.length})`), h('ul', {}, ...reps.map((o) => h('li', { class: 'small' }, o.result && o.result.summary)))) : null, form);
  }

  /* ---------- Ranking ---------- */
  function ranking() {
    let period = sessionStorage.getItem('team-rk-p') || 'todo'; let area = sessionStorage.getItem('team-rk-a') || '';
    const leads = d.members.filter((m) => m.kind === 'lead');
    const sec = h('section', { class: 'card panel', 'aria-labelledby': 'team-r' });
    const body = h('div', { class: 'table-wrap' });
    const areaSel = h('select', { class: 'select', 'aria-label': 'Área', style: 'width:auto' }, h('option', { value: '' }, 'Todas las áreas'), ...leads.map((l) => h('option', { value: l.id, selected: l.id === area }, l.name.replace('Líder de ', ''))));
    const perSel = h('select', { class: 'select', 'aria-label': 'Período', style: 'width:auto' }, h('option', { value: 'todo', selected: period === 'todo' }, 'Histórico'), h('option', { value: 'hoy', selected: period === 'hoy' }, 'Hoy'));
    const paint = () => {
      const rows = d.members.filter((m) => m.kind === 'worker' && (!area || m.parent_id === area)).map((m) => ({ m, p: m.progress || {} }))
        .map((r) => ({ ...r, score: period === 'hoy' ? r.p.todayDone || 0 : r.p.xp || 0 })).sort((a, b) => b.score - a.score);
      body.replaceChildren(h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ...['#', 'Agente', period === 'hoy' ? 'Tareas hoy' : 'XP', 'Hechas', 'Aprobadas', 'Errores', 'Nivel'].map((t) => h('th', {}, t)))),
        h('tbody', {}, ...rows.map((r, i) => h('tr', {}, h('td', {}, String(i + 1)), h('td', {}, h('button', { class: 'linklike', type: 'button', onclick: () => detail(r.m.id) }, r.m.name)), h('td', {}, String(r.score)), h('td', {}, String(r.p.done || 0)), h('td', {}, String(r.p.approved || 0)), h('td', {}, String(r.p.failed || 0)), h('td', {}, String(r.p.level || 1)))))));
    };
    areaSel.onchange = () => { area = areaSel.value; sessionStorage.setItem('team-rk-a', area); paint(); };
    perSel.onchange = () => { period = perSel.value; sessionStorage.setItem('team-rk-p', period); paint(); };
    sec.append(h('div', { class: 'panel-head' }, h('h2', { id: 'team-r' }, 'Ranking'), areaSel, perSel), body, h('p', { class: 'muted tiny' }, 'Con datos reales de las tareas (hechas, aprobadas, errores). Es una forma de comparar, no una medida de inteligencia.'));
    paint();
    return sec;
  }

  /* ---------- Actividad ---------- */
  function activity() {
    const recent = d.orders.slice(0, 15);
    const asg = (d.assignments || []).slice(0, 8);
    return h('section', { class: 'card panel', 'aria-labelledby': 'team-a' },
      h('div', { class: 'panel-head' }, h('h2', { id: 'team-a' }, 'Actividad')),
      asg.length ? h('div', {}, h('h3', { class: 'team-sub' }, 'Asignaciones (CEO y líderes)'), h('ul', { class: 'team-asg' }, ...asg.map((a) => h('li', {}, h('strong', {}, `${a.created_by} → ${nameOf(a.member_id)}`), ': ', a.text.slice(0, 110), a.reason ? h('span', { class: 'muted tiny team-why' }, ' · ' + a.reason) : null, h('span', { class: 'muted tiny' }, ' · ' + ago(a.created_at)))))) : null,
      h('h3', { class: 'team-sub' }, 'Últimas tareas'),
      recent.length ? h('ul', { class: 'team-orders' }, ...recent.map((o) => { const li = orderRow(o); li.querySelector('.team-order-head strong').textContent = `${nameOf(o.member_id)}: ${o.text.slice(0, 100)}`; return li; })) : h('p', { class: 'muted small' }, 'Todavía no hubo turnos. El primero llega en el próximo turno automático o con «Hacer trabajar ahora».'));
  }

  await load();
}
