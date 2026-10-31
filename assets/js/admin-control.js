/**
 * /admin/: Leads (CRM) y Centro de control de agentes.
 * Firestore guarda órdenes, estado y bitácora (reglas: solo admin). Las acciones sobre GitHub
 * (crear Issue, aprobar/rechazar PR, cancelar ejecuciones, escribir control/agents-control.json)
 * pasan por worker-v2 con el token del dueño; el token de GitHub nunca llega al navegador.
 */
import { h, icon, esc, toast, confirmDialog, fmtDate, timeAgo } from './ui.js';
import { CONFIG } from './config.js';
import { getStore, friendlyError } from './firebase.js';
import { clearSystemCache } from './sysconfig.js';

const STAGES = [['nuevo', 'Nuevo'], ['contactado', 'Contactado'], ['reunion', 'Reunión'], ['negociacion', 'Negociación'], ['cerrado', 'Cerrado'], ['descartado', 'Descartado']];
const TYPES = { inversion: 'Inversión', asociacion: 'Asociación', whitelabel: 'White-label', piloto: 'Piloto enterprise', reunion: 'Reunión', consulta: 'Consulta', empresa: 'Plan Empresa' };
const ORDER_STATUS = { en_cola: ['En cola', ''], trabajando: ['Trabajando', 'gold'], pr_listo: ['PR listo', 'ok'], aprobado: ['Aprobado', 'ok'], rechazado: ['Rechazado', 'danger'], cancelado: ['Cancelado', ''] };
const AGENTS = [['programador-fullstack', 'Programador full stack'], ['frontend', 'Frontend'], ['backend', 'Backend'], ['ux-ui', 'UX/UI'], ['disenador-grafico', 'Diseño gráfico'], ['disenador-web', 'Diseño web'], ['ilustrador', 'Ilustración'], ['disenador-3d', 'Diseño 3D'], ['investigador', 'Investigación'], ['ciberseguridad', 'Ciberseguridad']];
const STATE_LABEL = { activo: ['Activo', 'ok', 'Los agentes trabajan según su calendario y las órdenes.'], pausado: ['En pausa', 'warn', 'No toman tareas nuevas; la que está en curso termina.'], detenido: ['Detenido', 'danger', 'Todo detenido: no corre ninguna ejecución nueva.'] };

const CC = new Intl.DisplayNames(['es'], { type: 'region' });
const ccName = (c) => { try { return c === 'XX' ? 'Otro' : CC.of(c); } catch { return c; } };
const flag = (c) => `/assets/flags/${/^[A-Z]{2}$/.test(c) && c !== 'XX' ? c.toLowerCase() : 'xx'}.svg`;

/* ---------- Worker (opcional) ---------- */
let workerP;
export function workerStatus() {
  if (workerP) return workerP;
  const base = String(CONFIG.API_BASE || '').replace(/\/+$/, '');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 3000);
  workerP = fetch(base + '/api/health', { signal: ctrl.signal, cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    .then((j) => { clearTimeout(t); return { live: !!(j && j.ok), control: !!(j && j.control), browser: !!(j && j.browser), base }; });
  return workerP;
}
async function workerCall(user, path, { method = 'POST', body } = {}) {
  const w = await workerStatus();
  if (!w.live || !w.control) { const e = new Error('worker_unavailable'); e.code = 'worker_unavailable'; throw e; }
  const token = await user.getIdToken();
  const r = await fetch(w.base + path, { method, headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || 'error_' + r.status); e.code = j.error; throw e; }
  return j;
}

export async function audit(user, action, detail = '') {
  try {
    const { fs, db } = await getStore();
    await fs.addDoc(fs.collection(db, 'auditLog'), { action, detail: String(detail).slice(0, 600), uid: user.uid, email: user.email || '', at: fs.serverTimestamp() });
  } catch (e) { console.warn('[auditoría]', e && e.code); }
}

/* =================== Leads / CRM =================== */
function miniBars(entries, labeler, flagged) {
  const list = entries.sort((a, b) => b[1] - a[1]).slice(0, 8);
  const sum = list.reduce((a, [, v]) => a + v, 0) || 1;
  if (!list.length) return '<p class="muted small">Sin leads todavía.</p>';
  return '<div class="bars">' + list.map(([k, v]) => `<div class="bar-row">${flagged ? `<img class="flag" src="${flag(k)}" alt="" width="20" height="20" loading="lazy">` : ''}<span class="bar-label">${esc(labeler(k))}</span><span class="bar-track"><i style="width:${((v / sum) * 100).toFixed(1)}%"></i></span><span class="bar-val">${v}</span></div>`).join('') + '</div>';
}
function csv(rows) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
  const head = ['fecha', 'nombre', 'empresa', 'correo', 'pais', 'tipo', 'ticket', 'etapa', 'idioma', 'pagina', 'mensaje', 'notas'];
  return [head.join(','), ...rows.map((r) => [r.createdAt && r.createdAt.toDate ? r.createdAt.toDate().toISOString() : '', r.name, r.company, r.email, r.country, r.type, r.ticket, r.stage, r.lang, r.page, r.message, r.notes].map(q).join(','))].join('\n');
}

export async function renderLeads(box, user) {
  box.innerHTML = '';
  const { fs, db } = await getStore();
  let leads = [];
  try {
    const s = await fs.getDocs(fs.query(fs.collection(db, 'leads'), fs.orderBy('createdAt', 'desc'), fs.limit(500)));
    leads = s.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    box.append(h('div', { class: 'alert warn' }, h('span', { html: icon('warn') }), h('div', {}, 'No se pudieron leer los leads: ', friendlyError(e), ' Publicá las reglas de Firestore (firebase/firestore.rules).')));
    return;
  }
  const fCountry = h('select', { class: 'select', 'aria-label': 'Filtrar por país' }, h('option', { value: '' }, 'Todos los países'), ...[...new Set(leads.map((l) => l.country))].sort().map((c) => h('option', { value: c }, ccName(c))));
  const fType = h('select', { class: 'select', 'aria-label': 'Filtrar por tipo' }, h('option', { value: '' }, 'Todos los tipos'), ...Object.entries(TYPES).map(([k, v]) => h('option', { value: k }, v)));
  const fStage = h('select', { class: 'select', 'aria-label': 'Filtrar por etapa' }, h('option', { value: '' }, 'Todas las etapas'), ...STAGES.map(([k, v]) => h('option', { value: k }, v)));
  const exportBtn = h('button', { class: 'btn btn-sm', type: 'button', html: icon('download') + 'Exportar CSV' });
  const filtered = () => leads.filter((l) => (!fCountry.value || l.country === fCountry.value) && (!fType.value || l.type === fType.value) && (!fStage.value || l.stage === fStage.value));
  const kpis = h('div', { class: 'kpis kpis-4' });
  const charts = h('div', { class: 'admin-grid' });
  const pipeline = h('div', { class: 'pipeline' });
  const tableWrap = h('div', { class: 'table-wrap' });
  box.append(h('div', { class: 'admin-head sub' }, h('h2', {}, 'Leads de inversores y empresas'), h('div', { class: 'row' }, fCountry, fType, fStage, exportBtn)), kpis, charts, h('section', { class: 'card panel' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Embudo')), pipeline), h('section', { class: 'card panel' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Contactos')), tableWrap));
  exportBtn.onclick = () => {
    const blob = new Blob(['\ufeff' + csv(filtered())], { type: 'text/csv;charset=utf-8' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `leads-agenticuantico-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.append(a); a.click(); a.remove();
    audit(user, 'leads_export', `${filtered().length} filas`);
  };
  const draw = () => {
    const list = filtered();
    const by = (k) => { const o = {}; list.forEach((l) => { o[l[k]] = (o[l[k]] || 0) + 1; }); return o; };
    const week = list.filter((l) => l.createdAt && l.createdAt.toMillis && Date.now() - l.createdAt.toMillis() < 7 * 864e5).length;
    kpis.innerHTML = '';
    const k = (label, v) => h('div', { class: 'kpi' }, h('div', {}, h('small', {}, label), h('strong', {}, String(v))));
    kpis.append(k('Leads', list.length), k('Últimos 7 días', week), k('Inversión', list.filter((l) => l.type === 'inversion').length), k('En negociación', list.filter((l) => l.stage === 'negociacion').length));
    charts.innerHTML = '';
    charts.append(h('section', { class: 'card panel span-2' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Leads por país')), h('div', { html: miniBars(Object.entries(by('country')), ccName, true) })),
      h('section', { class: 'card panel span-2' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Leads por tipo')), h('div', { html: miniBars(Object.entries(by('type')), (t) => TYPES[t] || t) })));
    pipeline.innerHTML = '';
    const st = by('stage');
    STAGES.forEach(([id, label]) => pipeline.append(h('div', { class: 'pipe-col' + (fStage.value === id ? ' on' : '') }, h('small', {}, label), h('strong', {}, String(st[id] || 0)))));
    tableWrap.innerHTML = '';
    if (!list.length) { tableWrap.append(h('p', { class: 'muted small' }, 'Sin leads para estos filtros.')); return; }
    const tb = h('tbody');
    for (const l of list) {
      const sel = h('select', { class: 'select select-sm', 'aria-label': 'Etapa de ' + l.name }, ...STAGES.map(([id, label]) => h('option', { value: id, selected: l.stage === id || null }, label)));
      sel.onchange = async () => {
        try { await fs.updateDoc(fs.doc(db, 'leads', l.id), { stage: sel.value, updatedAt: fs.serverTimestamp(), updatedBy: user.email }); l.stage = sel.value; audit(user, 'lead_stage', `${l.email} → ${sel.value}`); toast('Etapa actualizada', 'ok'); draw(); }
        catch (e) { toast(friendlyError(e), 'error'); sel.value = l.stage; }
      };
      tb.append(h('tr', {},
        h('td', {}, h('strong', {}, l.name), h('div', { class: 'tiny muted' }, l.company || '—')),
        h('td', {}, h('a', { href: `mailto:${l.email}?subject=${encodeURIComponent('AgentiCuántico · ' + (TYPES[l.type] || 'Consulta'))}` }, l.email)),
        h('td', {}, h('img', { class: 'flag', src: flag(l.country), alt: '', width: 18, height: 18 }), ' ', ccName(l.country)),
        h('td', {}, TYPES[l.type] || l.type, l.ticket ? h('div', { class: 'tiny muted' }, l.ticket) : null),
        h('td', { class: 'msg-cell' }, h('details', {}, h('summary', {}, (l.message || '').slice(0, 60) + ((l.message || '').length > 60 ? '…' : '')), h('p', { class: 'small' }, l.message))),
        h('td', {}, l.createdAt && l.createdAt.toDate ? fmtDate(l.createdAt.toDate()) : '—'),
        h('td', {}, sel)));
    }
    tableWrap.append(h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ...['Contacto', 'Correo', 'País', 'Tipo', 'Mensaje', 'Fecha', 'Etapa'].map((t) => h('th', {}, t)))), tb));
  };
  [fCountry, fType, fStage].forEach((s) => { s.onchange = draw; });
  draw();
}

/* =================== Centro de control de agentes =================== */
export async function renderAgentsControl(box, user, onStateChange) {
  box.innerHTML = '';
  const { fs, db } = await getStore();
  const w = await workerStatus();
  let sys = {};
  try { const s = await fs.getDoc(fs.doc(db, 'config', 'system')); sys = s.exists() ? s.data() : {}; } catch (e) { box.append(h('div', { class: 'alert warn' }, 'Configuración no disponible: ', friendlyError(e))); }
  const agents = Object.assign({ state: 'activo', perAgent: {} }, sys.agents || {});
  const state = sys.killSwitch ? 'detenido' : agents.state;
  const [lbl, cls, desc] = STATE_LABEL[state] || STATE_LABEL.activo;

  // Banner de estado
  box.append(h('div', { class: `state-banner ${cls}`, role: 'status' }, h('span', { class: 'dot' }), h('div', {}, h('strong', {}, `Agentes: ${lbl}`), h('span', {}, ' · ' + desc + (sys.killSwitch ? ' Parada de emergencia del sitio activa.' : ''))),
    agents.updatedAt ? h('span', { class: 'tiny', style: 'margin-left:auto' }, `${agents.updatedBy || ''} · ${agents.updatedAt.toDate ? timeAgo(agents.updatedAt.toDate()) : ''}`) : null));
  if (!w.live || !w.control) {
    box.append(h('div', { class: 'alert info' }, h('span', { html: icon('info') }), h('div', {},
      h('strong', {}, 'Sincronización con GitHub pendiente de conectar el servidor. '),
      'Las órdenes y el estado se guardan acá y los workflows leen el estado publicado en Firestore en su primer paso. Crear Issues, aprobar PR y cancelar ejecuciones en curso se habilita al desplegar worker-v2 con el secreto GITHUB_TOKEN. ',
      'Mientras tanto, para frenar todo al instante: GitHub → cada repositorio → Actions → elegí el workflow → «⋯» → Disable workflow (y «Cancel run» en las ejecuciones en curso).',
      h('div', { class: 'row', style: 'margin-top:8px' }, h('a', { class: 'btn btn-sm', href: CONFIG.GITHUB.ACTIONS_DEV, target: '_blank', rel: 'noopener', html: icon('external') + 'Actions AgenticDev' }), h('a', { class: 'btn btn-sm', href: CONFIG.GITHUB.ACTIONS_WEB, target: '_blank', rel: 'noopener', html: icon('external') + 'Actions AgenticWeb' })))));
  }

  const grid = h('div', { class: 'admin-grid' });
  box.append(grid);

  // Interruptor maestro
  const setState = async (next, label) => {
    if (next === 'detenido') {
      if (!(await confirmDialog({ title: 'Detener todos los agentes', text: 'Cancela las ejecuciones en curso y bloquea las nuevas hasta que los reanudes. ¿Continuar?', ok: 'Continuar', danger: true }))) return;
      if (!(await confirmDialog({ title: 'Confirmación final', text: 'Confirmá DETENER. Se puede revertir con «Despertar / Reanudar».', ok: 'Detener ahora', danger: true }))) return;
    }
    try {
      await fs.setDoc(fs.doc(db, 'config', 'system'), { agents: { ...agents, state: next, updatedAt: fs.serverTimestamp(), updatedBy: user.email }, updatedAt: fs.serverTimestamp(), updatedBy: user.email }, { merge: true });
      clearSystemCache();
      let extra = '';
      try { const r = await workerCall(user, '/api/admin/agents/state', { body: { state: next, agents: agents.perAgent || {} } }); extra = r.canceled ? ` · ${r.canceled} ejecuciones canceladas` : ' · archivo de control actualizado en GitHub'; }
      catch (e) { extra = e.code === 'worker_unavailable' ? ' · guardado; GitHub se sincroniza al conectar el servidor' : ` · GitHub: ${e.message}`; }
      await audit(user, 'agents_state', `${label}${extra}`);
      toast(`Agentes: ${label}${extra}`, 'ok', 7000);
      renderAgentsControl(box, user, onStateChange);
      onStateChange && onStateChange();
    } catch (e) { toast(friendlyError(e), 'error', 6000); }
  };
  const sw = h('section', { class: 'card panel span-2' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Interruptor maestro')),
    h('div', { class: 'master-switch' },
      h('button', { class: 'btn' + (state === 'activo' ? ' btn-primary' : ''), type: 'button', disabled: state === 'activo' || null, onclick: () => setState('activo', 'habilitados'), html: icon('power') + 'Habilitar' }),
      h('button', { class: 'btn' + (state === 'pausado' ? ' btn-primary' : ''), type: 'button', disabled: state === 'pausado' || null, onclick: () => setState('pausado', 'en pausa'), html: icon('pause') + 'Pausar' }),
      h('button', { class: 'btn btn-danger', type: 'button', disabled: state === 'detenido' || null, onclick: () => setState('detenido', 'detenidos'), html: icon('stop') + 'Detener' }),
      h('button', { class: 'btn btn-gold', type: 'button', disabled: state === 'activo' || null, onclick: () => setState('activo', 'reanudados'), html: icon('refresh') + 'Despertar / Reanudar' })),
    h('p', { class: 'small muted', style: 'margin-top:10px' }, 'Pausar: no toman tareas nuevas y la actual termina. Detener: cancela lo que esté corriendo (requiere el servidor) y bloquea todo. La parada de emergencia del sitio también detiene a los agentes.'));
  // Agentes individuales
  const per = h('div', { class: 'flags' });
  for (const [id, label] of AGENTS) {
    const on = (agents.perAgent || {})[id] !== false;
    const input = h('input', { type: 'checkbox', checked: on || null, 'aria-label': label });
    input.onchange = async () => {
      agents.perAgent = { ...(agents.perAgent || {}), [id]: input.checked };
      try {
        await fs.setDoc(fs.doc(db, 'config', 'system'), { agents: { ...agents, updatedAt: fs.serverTimestamp(), updatedBy: user.email } }, { merge: true });
        workerCall(user, '/api/admin/agents/state', { body: { state: agents.state, agents: agents.perAgent } }).catch(() => {});
        audit(user, 'agent_toggle', `${id}: ${input.checked ? 'encendido' : 'apagado'}`);
        toast(`${label}: ${input.checked ? 'encendido' : 'apagado'}`, 'ok');
      } catch (e) { input.checked = !input.checked; toast(friendlyError(e), 'error'); }
    };
    per.append(h('label', { class: 'flag-row' }, h('span', {}, label), h('span', { class: 'switch' }, input, h('span'))));
  }
  grid.append(sw, h('section', { class: 'card panel span-2' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Agentes')), per));

  // Órdenes
  const text = h('textarea', { class: 'input', rows: 3, maxlength: 4000, placeholder: 'Ej.: Mejorá la portada en móvil; arreglá el chat a 320 px; mejorá el cerebro 3D.', 'aria-label': 'Orden para los agentes' });
  const repo = h('select', { class: 'select', 'aria-label': 'Repositorio destino' }, h('option', { value: 'AgenticWeb' }, 'AgenticWeb (sitio)'), h('option', { value: 'AgenticDev' }, 'AgenticDev (privado)'), h('option', { value: 'cerebro' }, 'Cerebro'));
  const prio = h('select', { class: 'select', 'aria-label': 'Prioridad' }, ...[['baja', 'Baja'], ['media', 'Media'], ['alta', 'Alta'], ['urgente', 'Urgente']].map(([v, l]) => h('option', { value: v, selected: v === 'media' || null }, l)));
  const send = h('button', { class: 'btn btn-primary', type: 'button', html: icon('send') + 'Enviar orden' });
  const list = h('div', { class: 'orders' });
  send.onclick = async () => {
    const t = text.value.trim();
    if (t.length < 4) { text.focus(); return; }
    send.disabled = true;
    try {
      const ref = await fs.addDoc(fs.collection(db, 'agent_orders'), { text: t, repo: repo.value, priority: prio.value, status: 'en_cola', createdAt: fs.serverTimestamp(), createdBy: user.email });
      let note = 'Orden guardada.';
      try { const r = await workerCall(user, '/api/admin/orders', { body: { id: ref.id, text: t, repo: repo.value, priority: prio.value } }); await fs.updateDoc(fs.doc(db, 'agent_orders', ref.id), { issueUrl: r.issueUrl, updatedAt: fs.serverTimestamp() }); note = 'Orden enviada a GitHub como Issue.'; }
      catch (e) { note = e.code === 'worker_unavailable' ? 'Orden guardada; se envía a GitHub al conectar el servidor.' : 'Orden guardada; GitHub respondió: ' + e.message; }
      audit(user, 'agent_order', `${repo.value}/${prio.value}: ${t.slice(0, 200)}`);
      toast(note, 'ok', 6000);
      text.value = '';
      loadOrders();
    } catch (e) { toast(friendlyError(e), 'error', 6000); } finally { send.disabled = false; }
  };
  grid.append(h('section', { class: 'card panel wide' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Órdenes a los agentes')), text, h('div', { class: 'row', style: 'margin-top:8px' }, repo, prio, send),
    h('p', { class: 'tiny muted' }, 'Los agentes trabajan en una rama y abren un PR. Nunca mergean a main: lo aprobás vos acá.'), list));

  async function loadOrders() {
    list.innerHTML = '<div class="skeleton" style="height:60px"></div>';
    let orders = [];
    try { const s = await fs.getDocs(fs.query(fs.collection(db, 'agent_orders'), fs.orderBy('createdAt', 'desc'), fs.limit(50))); orders = s.docs.map((d) => ({ id: d.id, ...d.data() })); }
    catch (e) { list.innerHTML = ''; list.append(h('p', { class: 'muted small' }, 'No se pudieron leer las órdenes: ' + friendlyError(e))); return; }
    list.innerHTML = '';
    if (!orders.length) { list.append(h('p', { class: 'muted small' }, 'Todavía no hay órdenes.')); return; }
    for (const o of orders) {
      const [sl, sc] = ORDER_STATUS[o.status] || [o.status, ''];
      const actions = h('div', { class: 'row' });
      const summary = h('div', { class: 'small muted' });
      if (o.prUrl && o.prNumber && o.status === 'pr_listo') {
        const view = h('button', { class: 'btn btn-sm btn-ghost', type: 'button' }, 'Ver cambios');
        view.onclick = async () => {
          try { const r = await workerCall(user, `/api/admin/pr/${o.repo}/${o.prNumber}`, { method: 'GET' }); summary.textContent = `${r.changedFiles} archivos · +${r.additions} −${r.deletions} · ${r.files.map((f) => f.name).slice(0, 6).join(', ')}`; }
          catch (e) { summary.textContent = e.code === 'worker_unavailable' ? 'El detalle del PR se ve al conectar el servidor (o en GitHub).' : e.message; }
        };
        const ok = h('button', { class: 'btn btn-sm btn-primary', type: 'button' }, 'Aprobar y mergear');
        ok.onclick = async () => {
          if (!(await confirmDialog({ title: 'Aprobar PR', text: `Se mergea el PR #${o.prNumber} en ${o.repo}. ¿Confirmás?`, ok: 'Aprobar y mergear' }))) return;
          try { await workerCall(user, `/api/admin/pr/${o.repo}/${o.prNumber}/approve`, { body: { confirm: true } }); await fs.updateDoc(fs.doc(db, 'agent_orders', o.id), { status: 'aprobado', updatedAt: fs.serverTimestamp() }); audit(user, 'pr_approve', `${o.repo}#${o.prNumber}`); toast('PR aprobado y mergeado', 'ok'); loadOrders(); }
          catch (e) { toast(e.code === 'worker_unavailable' ? 'Aprobar requiere el servidor conectado. Podés revisar y mergear en GitHub.' : e.message, 'error', 7000); }
        };
        const no = h('button', { class: 'btn btn-sm btn-danger-ghost', type: 'button' }, 'Rechazar');
        no.onclick = async () => {
          if (!(await confirmDialog({ title: 'Rechazar PR', text: `Se cierra el PR #${o.prNumber} sin mergear.`, ok: 'Rechazar', danger: true }))) return;
          try { await workerCall(user, `/api/admin/pr/${o.repo}/${o.prNumber}/reject`); } catch (e) { if (e.code !== 'worker_unavailable') { toast(e.message, 'error'); return; } }
          await fs.updateDoc(fs.doc(db, 'agent_orders', o.id), { status: 'rechazado', updatedAt: fs.serverTimestamp() }).catch(() => {});
          audit(user, 'pr_reject', `${o.repo}#${o.prNumber}`); loadOrders();
        };
        actions.append(view, ok, no);
      }
      list.append(h('article', { class: 'order' },
        h('div', { class: 'row', style: 'justify-content:space-between' }, h('strong', {}, o.text.slice(0, 140)), h('span', { class: 'chip ' + sc }, sl)),
        h('div', { class: 'tiny muted' }, `${o.repo} · prioridad ${o.priority} · ${o.createdAt && o.createdAt.toDate ? timeAgo(o.createdAt.toDate()) : ''}`, o.issueUrl ? h('span', {}, ' · ', h('a', { href: o.issueUrl, target: '_blank', rel: 'noopener' }, 'Issue')) : null, o.prUrl ? h('span', {}, ' · ', h('a', { href: o.prUrl, target: '_blank', rel: 'noopener' }, 'PR')) : null),
        o.diffSummary ? h('p', { class: 'small muted' }, o.diffSummary) : null, summary, actions));
    }
  }
  loadOrders();

  // Bitácora
  const log = h('div', { class: 'table-wrap' });
  grid.append(h('section', { class: 'card panel wide' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Bitácora de auditoría')), log));
  try {
    const s = await fs.getDocs(fs.query(fs.collection(db, 'auditLog'), fs.orderBy('at', 'desc'), fs.limit(60)));
    const rows = s.docs.map((d) => d.data());
    if (!rows.length) log.append(h('p', { class: 'muted small' }, 'Sin registros todavía.'));
    else log.append(h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ...['Cuándo', 'Quién', 'Acción', 'Detalle'].map((t) => h('th', {}, t)))),
      h('tbody', {}, ...rows.map((r) => h('tr', {}, h('td', {}, r.at && r.at.toDate ? fmtDate(r.at.toDate(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'), h('td', {}, r.email), h('td', {}, r.action), h('td', { class: 'small' }, r.detail))))));
  } catch (e) { log.append(h('p', { class: 'muted small' }, 'Bitácora no disponible: ' + friendlyError(e))); }
}
