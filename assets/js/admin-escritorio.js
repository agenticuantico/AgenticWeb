/**
 * /admin/ → «Espacio de trabajo»: Recepción (lo que llegó y espera a alguien) y Solicitudes (las órdenes del equipo),
 * con estados, filtros y estados vacíos. Datos reales de GET /api/panel/ws/desk; las acciones usan las rutas de siempre
 * y el SERVIDOR controla rol y área en cada una. Los textos se muestran como texto (nunca como HTML).
 */
import { h, icon, toast, confirmDialog, modal } from './ui.js';
import { api } from './admin-staff.js';

const ST = {
  pendiente: ['En cola', 'st-queue'], en_curso: ['En curso', 'st-run'], hecha: ['Hecha', 'st-ok'], delegada: ['Delegada', 'st-ok'], propuesta: ['Espera OK', 'st-wait'],
  aprobada: ['Aprobada', 'st-ok'], rechazada: ['Rechazada', 'st-bad'], fallida: ['Con error', 'st-bad'], cancelada: ['Cancelada', 'st-off']
};
const TYPE = { decidir: ['Decidir', '#7c3aed', 'check'], error: ['Error', '#dc2626', 'warn'], urgente: ['Urgente', '#ea580c', 'bolt'], informe: ['Informe', '#2563eb', 'file'], sugerencia: ['Ascenso', '#0d9488', 'userPlus'], entrenamiento: ['Entrenamiento', '#b45309', 'brain'] };
const SEV = { alta: 'Alta', media: 'Media', baja: 'Baja' };
const ERR = { forbidden_role: 'Tu rol no puede hacer esto.', outside_area: 'Esa orden no es de tu área.', owner_only: 'Solo el CEO (dueño) puede hacer esto.', not_pending: 'Esa orden ya se resolvió.', rate_limited: 'Vas muy rápido: esperá un minuto.' };
const fail = (e) => toast(ERR[e && e.code] || (e && e.message) || 'No se pudo completar.', 'danger');
const when = (t) => new Date(t).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Argentina/Buenos_Aires' });
const ago = (t) => { const m = Math.round((Date.now() - t) / 60e3); return m < 1 ? 'recién' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`; };
const empty = (title, text) => h('div', { class: 'desk-empty' }, h('span', { class: 'desk-empty-ic', html: icon('check') }), h('strong', {}, title), h('p', { class: 'small muted' }, text));

let cache = null;
export async function loadDesk(token, force = false) {
  if (cache && !force && Date.now() - cache.at < 15_000) return cache.d;
  const d = await api('/api/panel/ws/desk', { token }); cache = { at: Date.now(), d }; return d;
}

function select(label, options, value, onchange) {
  const s = h('select', { class: 'select select-sm', 'aria-label': label }, ...options.map(([v, l]) => h('option', { value: v, selected: v === value || null }, l)));
  s.addEventListener('change', () => onchange(s.value)); return s;
}

async function decideOrder(o, action, token, done) {
  if (action === 'reject' && !(await confirmDialog({ title: 'Rechazar la propuesta', text: 'El agente no sigue con este cambio. Queda en la Bitácora.', ok: 'Rechazar', danger: true }))) return;
  try { await api(`/api/admin/team/orders/${o}/${action}`, { method: 'POST', token, body: {} }); toast(action === 'approve' ? 'Aprobada' : action === 'reject' ? 'Rechazada' : 'Cancelada', 'success'); done(); }
  catch (e) { fail(e); }
}

/* =================== Recepción =================== */
export async function renderReception(box, token, me, go) {
  const f = { type: sessionStorage.getItem('desk.type') || '', area: '' };
  const root = h('div', { class: 'stack-lg' }); box.replaceChildren(root);
  const load = async (force) => {
    root.replaceChildren(h('div', { class: 'card panel' }, h('div', { class: 'skeleton', style: 'height:160px' })));
    let d; try { d = await loadDesk(token, force); } catch (e) { root.replaceChildren(h('div', { class: 'alert warn' }, h('span', { html: icon('warn') }), h('div', {}, 'No se pudo abrir la Recepción: ' + e.message))); return; }
    draw(d);
  };
  function draw(d) {
    const counts = {}; for (const x of d.inbox) counts[x.type] = (counts[x.type] || 0) + 1;
    const chips = h('div', { class: 'desk-chips', role: 'group', 'aria-label': 'Filtrar por tipo' },
      h('button', { type: 'button', class: 'desk-chip', 'aria-pressed': String(!f.type), onclick: () => { f.type = ''; sessionStorage.removeItem('desk.type'); draw(d); } }, `Todo (${d.inbox.length})`),
      ...Object.entries(TYPE).map(([k, [l, c]]) => h('button', { type: 'button', class: 'desk-chip', style: `--c:${c}`, 'aria-pressed': String(f.type === k), disabled: !counts[k] || null, onclick: () => { f.type = k; sessionStorage.setItem('desk.type', k); draw(d); } }, h('i', {}), `${l} (${counts[k] || 0})`)));
    const area = select('Área', [['', 'Todas las áreas'], ...d.areas.map((a) => [a.id, a.label]), ['__none', 'Dirección / sin área']], f.area, (v) => { f.area = v; draw(d); });
    const list = d.inbox.filter((x) => (!f.type || x.type === f.type) && (!f.area || (f.area === '__none' ? !x.area : x.area === f.area)));
    const items = list.map((x) => {
      const [l, c, ic] = TYPE[x.type] || [x.type, '#64748b', 'info'];
      const acts = h('div', { class: 'desk-acts' });
      if (x.type === 'decidir') acts.append(h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: () => decideOrder(x.ref.id, 'approve', token, () => load(true)) }, 'Aprobar'), h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => decideOrder(x.ref.id, 'reject', token, () => load(true)) }, 'Rechazar'));
      if (x.type === 'informe') acts.append(h('button', { class: 'btn btn-sm', type: 'button', onclick: () => go('rendimiento') }, 'Ver informe'));
      if (x.type === 'sugerencia') acts.append(h('button', { class: 'btn btn-sm', type: 'button', onclick: () => go('rendimiento') }, 'Revisar'));
      if (x.type === 'entrenamiento') acts.append(h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => go('entrenamientos') }, 'Ver entrenamiento'));
      if (x.type === 'error' || x.type === 'urgente') acts.append(h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => go('solicitudes', x.ref.id) }, 'Ver solicitud'));
      return h('li', { class: 'desk-item sev-' + x.severity, style: `--c:${c}` },
        h('span', { class: 'desk-item-ic', html: icon(ic) }),
        h('div', { class: 'desk-item-main' },
          h('div', { class: 'desk-item-top' }, h('span', { class: 'desk-tag' }, l), h('span', { class: 'desk-sev' }, 'Prioridad ' + SEV[x.severity].toLowerCase()), h('span', { class: 'muted tiny' }, `${x.areaLabel} · ${ago(x.at)}`)),
          h('strong', { class: 'desk-item-title' }, x.title), h('p', { class: 'small muted' }, x.detail)),
        acts.childElementCount ? acts : null);
    });
    const sevCount = (s) => d.inbox.filter((x) => x.severity === s).length;
    root.replaceChildren(
      h('section', { class: 'card panel desk-head' },
        h('div', { class: 'panel-head' }, h('h2', {}, 'Recepción'), h('span', { class: 'chip' }, 'Ves: ' + d.scope), h('button', { class: 'btn btn-sm btn-ghost', type: 'button', html: icon('refresh') + '<span>Actualizar</span>', onclick: () => load(true) })),
        h('p', { class: 'small muted' }, 'Todo lo que llegó y espera a alguien: propuestas por aprobar, errores de los últimos 7 días, urgentes sin empezar, informes sin leer, sugerencias de ascenso y entrenamientos a repasar.'),
        h('div', { class: 'desk-sev-row' }, ...[['alta', 'Alta'], ['media', 'Media'], ['baja', 'Baja']].map(([s, l]) => h('div', { class: 'desk-sev-box s-' + s }, h('small', {}, 'Prioridad ' + l.toLowerCase()), h('strong', {}, String(sevCount(s)))))),
        h('div', { class: 'desk-filters' }, chips, area)),
      h('section', { class: 'card panel' }, items.length ? h('ul', { class: 'desk-list' }, ...items) : empty(d.inbox.length ? 'Nada con ese filtro' : 'Recepción al día', d.inbox.length ? 'Probá con otro tipo o área.' : 'No hay nada esperando: cuando llegue una propuesta, un error o un informe, aparece acá.')));
  }
  await load(false);
}

/* =================== Solicitudes =================== */
export async function renderRequests(box, token, me, focus) {
  const perms = new Set(me.perms || []);
  const f = { status: '', area: '', prio: '', q: '' };
  const root = h('div', { class: 'stack-lg' }); box.replaceChildren(root);
  const load = async (force) => {
    root.replaceChildren(h('div', { class: 'card panel' }, h('div', { class: 'skeleton', style: 'height:160px' })));
    let d; try { d = await loadDesk(token, force); } catch (e) { root.replaceChildren(h('div', { class: 'alert warn' }, h('span', { html: icon('warn') }), h('div', {}, 'No se pudieron leer las solicitudes: ' + e.message))); return; }
    draw(d);
  };
  const newOrder = async () => {
    let team; try { team = await api('/api/admin/team', { token }); } catch (e) { fail(e); return; }
    const ms = (team.members || []).filter((m) => m.status === 'activo' && m.kind !== 'ceo');
    const sel = h('select', { class: 'select', 'aria-label': 'Para quién' }, ...ms.map((m) => h('option', { value: m.id }, m.name)));
    const ta = h('textarea', { class: 'input', rows: 4, maxlength: 600, placeholder: 'Qué tiene que hacer (concreto y verificable)', 'aria-label': 'Pedido' });
    const pr = h('select', { class: 'select', 'aria-label': 'Prioridad' }, ...[[1, 'Baja'], [2, 'Media'], [3, 'Alta'], [4, 'Urgente']].map(([v, l]) => h('option', { value: v, selected: v === 2 || null }, l)));
    const v = await modal({ title: 'Nueva solicitud', body: h('div', { class: 'stack' }, h('label', { class: 'label' }, 'Para'), sel, h('label', { class: 'label' }, 'Pedido'), ta, h('label', { class: 'label' }, 'Prioridad'), pr, h('p', { class: 'tiny muted' }, 'La toma el agente en su próximo turno (cada 30 min). Nada se publica sin pasar las pruebas o tu OK.')),
      actions: [{ label: 'Cancelar', value: null, class: 'btn-ghost' }, { label: 'Crear', value: 'ok', class: 'btn-primary' }] }).done;
    if (v !== 'ok' || !ta.value.trim()) return;
    try { await api('/api/admin/team/orders', { method: 'POST', token, body: { member_id: sel.value, text: ta.value.trim(), priority: Number(pr.value) } }); toast('Solicitud creada', 'success'); load(true); } catch (e) { fail(e); }
  };
  function draw(d) {
    const st = select('Estado', [['', 'Todos los estados'], ...Object.entries(ST).map(([k, [l]]) => [k, `${l} (${d.byStatus[k] || 0})`])], f.status, (v) => { f.status = v; draw(d); });
    const ar = select('Área', [['', 'Todas las áreas'], ...d.areas.map((a) => [a.id, a.label]), ['__none', 'Dirección']], f.area, (v) => { f.area = v; draw(d); });
    const pr = select('Prioridad', [['', 'Toda prioridad'], ['4', 'Urgente'], ['3', 'Alta'], ['2', 'Media'], ['1', 'Baja']], f.prio, (v) => { f.prio = v; draw(d); });
    const q = h('input', { class: 'input input-sm', type: 'search', placeholder: 'Buscar…', value: f.q, 'aria-label': 'Buscar en solicitudes' });
    q.addEventListener('input', () => { f.q = q.value; paintList(); });
    const listBox = h('div');
    const paintList = () => {
      const s = f.q.trim().toLowerCase();
      const rows = d.orders.filter((o) => (!f.status || o.status === f.status) && (!f.area || (f.area === '__none' ? !o.area : o.area === f.area)) && (!f.prio || String(o.priority) === f.prio) && (!s || (o.text + ' ' + o.memberName + ' ' + (o.result || '')).toLowerCase().includes(s)));
      listBox.replaceChildren(rows.length ? h('ul', { class: 'req-list' }, ...rows.slice(0, 120).map((o) => {
        const [l, c] = ST[o.status] || [o.status, 'st-off'];
        const acts = h('div', { class: 'desk-acts' });
        if (o.status === 'propuesta' && perms.has('team.decide.small')) acts.append(h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: () => decideOrder(o.id, 'approve', token, () => load(true)) }, 'Aprobar'), h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => decideOrder(o.id, 'reject', token, () => load(true)) }, 'Rechazar'));
        if (['pendiente', 'en_curso'].includes(o.status) && perms.has('team.order')) acts.append(h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => decideOrder(o.id, 'cancel', token, () => load(true)) }, 'Cancelar'));
        return h('li', { class: 'req ' + (focus === o.id ? 'is-focus' : ''), id: 'req-' + o.id },
          h('div', { class: 'req-top' }, h('span', { class: 'req-st ' + c }, l), h('span', { class: 'req-prio p' + o.priority }, o.priorityLabel), h('strong', {}, o.memberName), h('span', { class: 'muted tiny' }, `${o.areaLabel} · ${o.sourceLabel} · ${when(o.createdAt)}`)),
          h('p', { class: 'req-text' }, o.text),
          o.result ? h('p', { class: 'small muted' }, 'Resultado: ' + o.result) : null,
          o.link ? h('a', { class: 'small', href: o.link, target: '_blank', rel: 'noopener' }, 'Ver cambio') : null,
          acts.childElementCount ? acts : null);
      })) : empty(d.orders.length ? 'Sin solicitudes con ese filtro' : 'Todavía no hay solicitudes', d.orders.length ? 'Cambiá el estado, el área o la búsqueda.' : 'Las órdenes del CEO agéntico, de los supervisores y las que crees acá aparecen con su estado.'));
      if (focus) setTimeout(() => document.getElementById('req-' + focus)?.scrollIntoView({ block: 'center' }), 50);
    };
    const pills = h('div', { class: 'req-pills' }, ...['pendiente', 'en_curso', 'propuesta', 'fallida', 'hecha'].map((k) => { const [l, c] = ST[k]; return h('button', { type: 'button', class: 'req-pill ' + c, 'aria-pressed': String(f.status === k), onclick: () => { f.status = f.status === k ? '' : k; draw(d); } }, h('strong', {}, String(d.byStatus[k] || 0)), h('span', {}, l)); }));
    root.replaceChildren(
      h('section', { class: 'card panel' },
        h('div', { class: 'panel-head' }, h('h2', {}, 'Solicitudes'), perms.has('team.order') ? h('button', { class: 'btn btn-sm btn-primary', type: 'button', html: icon('plus') + '<span>Nueva solicitud</span>', onclick: newOrder }) : null, h('button', { class: 'btn btn-sm btn-ghost', type: 'button', html: icon('refresh') + '<span>Actualizar</span>', onclick: () => load(true) })),
        h('p', { class: 'small muted' }, `Las últimas ${d.limits.orders} órdenes del equipo. Ves: ${d.scope}.`),
        pills, h('div', { class: 'desk-filters' }, st, ar, pr, q)),
      h('section', { class: 'card panel' }, listBox));
    paintList();
  }
  await load(false);
}
