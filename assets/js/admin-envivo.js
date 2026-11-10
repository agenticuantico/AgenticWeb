/**
 * /admin/ → «En vivo»: qué están haciendo los agentes y cómo trabajan en equipo. Solo lectura (Observador y arriba).
 * Datos reales del servidor (/api/panel/live*): se actualiza cada 15 s mientras la pestaña está a la vista. No hay
 * animaciones inventadas: los agentes trabajan en turnos de 30 min y se muestra cuándo es el próximo.
 * Ingresos: nunca (el servidor oculta montos). Los textos se pintan como texto, nunca como HTML.
 */
import { h, icon, toast } from './ui.js';
import { api } from './admin-staff.js?v=7.14.0';
import { download } from './admin-indicadores.js?v=7.14.0';

const TYPE = { orden: 'Orden', delegacion: 'Delegación', resultado: 'Resultado', propuesta: 'Propuesta', decision: 'Decisión', recomendacion: 'Recomendación', entrenamiento: 'Entrenamiento', puesto: 'Puesto', ascenso: 'Ascenso' };
const TCLS = { orden: 'info', delegacion: 'info', resultado: 'ok', propuesta: 'gold', decision: 'ok', recomendacion: 'warn', entrenamiento: '', puesto: '', ascenso: '' };
const OST = { pendiente: 'En cola', en_curso: 'Trabajando', hecha: 'Hecha', propuesta: 'Espera OK', aprobada: 'Aprobada', rechazada: 'Rechazada', fallida: 'Con error', cancelada: 'Cancelada', delegada: 'Delegada' };
const when = (t) => new Date(t).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' });
const hhmm = (t) => new Date(t).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' });
const ref = (r) => (r ? `${r.kind} ${r.id}` : '');
const todayAR = (d = 0) => new Date(Date.now() - 3 * 3600e3 + d * 86400e3).toISOString().slice(0, 10);

export async function renderLive(box, token) {
  const root = h('div', { class: 'live stack-lg' }); box.replaceChildren(root);
  let view = sessionStorage.getItem('live-view') || 'actividad';
  let ov = null; let seen = new Set(); let timer = null; let lastOk = 0;
  const status = h('p', { class: 'small live-status', role: 'status', 'aria-live': 'polite' });
  const seg = h('div', { class: 'seg seg-sm live-views', role: 'tablist', 'aria-label': 'Vista de En vivo' });
  const body = h('div', { class: 'stack-lg' });
  const VIEWS = [['actividad', 'Actividad'], ['equipos', 'Equipos'], ['conversaciones', 'Conversaciones'], ['historial', 'Historial']];
  for (const [v, l] of VIEWS) seg.append(h('button', { type: 'button', role: 'tab', dataset: { v }, onclick: () => { view = v; sessionStorage.setItem('live-view', v); paintSeg(); draw(); } }, l));
  const paintSeg = () => { for (const b of seg.children) b.setAttribute('aria-selected', String(b.dataset.v === view)); };
  root.append(h('section', { class: 'card panel' },
    h('div', { class: 'panel-head' }, h('h2', {}, 'En vivo'), h('button', { class: 'btn btn-sm btn-ghost', type: 'button', html: icon('refresh') + '<span>Actualizar</span>', onclick: () => poll(true) })),
    h('p', { class: 'small muted' }, 'Lo que hacen los agentes, con datos reales. Trabajan en turnos de 30 minutos: entre turno y turno no pasa nada nuevo. Esta vista se actualiza sola cada 15 segundos. Solo lectura; los ingresos nunca se muestran.'),
    status, seg), body);
  paintSeg();

  async function poll(manual = false) {
    if (!root.isConnected) { clearInterval(timer); return; }
    if (!manual && (document.hidden || !root.offsetParent)) return; // pestaña oculta: no pregunta
    try {
      const d = await api('/api/panel/live', { token });
      const fresh = ov ? d.events.filter((e) => !seen.has(key(e))).length : 0;
      ov = d; lastOk = Date.now();
      if (!seen.size) for (const e of d.events) seen.add(key(e));
      drawStatus(fresh);
      if (view === 'actividad' || view === 'equipos') draw();
      for (const e of d.events) seen.add(key(e));
    } catch (e) { status.textContent = 'No se pudo actualizar: ' + (e.message || 'error') + (lastOk ? ` · último dato ${hhmm(lastOk)}` : ''); }
  }
  const key = (e) => `${e.at}|${e.type}|${e.agent}|${ref(e.ref)}`;
  function drawStatus(fresh) {
    const st = { activo: 'Equipo activo', pausado: 'Equipo en pausa', detenido: 'Parada de emergencia' }[ov.state] || ov.state;
    status.replaceChildren(h('strong', {}, st), ` · próximo turno en ${ov.nextInMin} min (${hhmm(ov.nextTick).slice(0, 5)})`, ov.lastTick ? ` · último turno ${when(ov.lastTick.at)}` : ' · todavía no hubo turnos', ` · actualizado ${hhmm(Date.now())}`, ...(fresh ? [h('span', { class: 'chip ok live-new' }, `${fresh} nuevo(s)`)] : []));
  }
  const evItem = (e, isNew) => h('li', { class: 'live-ev' + (isNew ? ' is-new' : '') },
    h('div', { class: 'live-ev-head' }, h('span', { class: 'chip ' + (TCLS[e.type] || '') }, TYPE[e.type] || e.type), h('strong', {}, e.agentName), h('span', { class: 'tn-badge ' + (e.holder === 'humano' ? 'is-human' : 'is-agent') }, e.holder === 'humano' ? 'Humano' : 'Agente'), h('span', { class: 'muted tiny' }, `${e.teamLabel} · ${when(e.at)}`), isNew ? h('span', { class: 'tchip won' }, 'nuevo') : null),
    h('p', { class: 'small live-action' }, e.action),
    e.ref ? h('p', { class: 'tiny muted' }, `${e.ref.kind === 'propuesta' ? 'Propuesta' : e.ref.kind === 'entrenamiento' ? 'Entrenamiento' : e.ref.kind === 'puesto' ? 'Puesto' : e.ref.kind === 'ascenso' ? 'Ascenso' : 'Orden'} ${e.ref.id}${e.status ? ' · ' + (OST[e.status] || e.status) : ''}`) : null);

  function draw() {
    if (!ov && view !== 'historial') { body.replaceChildren(h('div', { class: 'card panel' }, h('div', { class: 'skeleton', style: 'height:160px' }))); return; }
    if (view === 'actividad') {
      const lt = ov.lastTick && ov.lastTick.did && ov.lastTick.did.length ? h('div', { class: 'small' }, h('strong', {}, 'Último turno: '), ov.lastTick.did.join(' · ')) : null;
      body.replaceChildren(h('section', { class: 'card panel' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Actividad (últimas 48 h)')), lt,
        ov.events.length ? h('ol', { class: 'live-feed' }, ...ov.events.map((e) => evItem(e, !seen.has(key(e))))) : h('p', { class: 'muted small' }, 'Sin actividad en las últimas 48 horas. Cuando los agentes trabajen en su turno, aparece acá.')));
    } else if (view === 'equipos') {
      body.replaceChildren(h('ul', { class: 'live-teams' }, ...ov.teams.map((t) => h('li', { class: 'card panel live-team' },
        h('div', { class: 'panel-head' }, h('h2', {}, t.label), h('span', { class: 'muted tiny' }, `${t.active} de ${t.members} activos`)),
        h('div', {}, h('small', { class: 'label' }, 'Orden en curso'), t.current ? h('p', { class: 'small' }, h('strong', {}, t.current.agent + ': '), t.current.text, h('span', { class: 'muted tiny' }, ` · ${OST[t.current.status] || t.current.status} desde ${when(t.current.since)}`)) : h('p', { class: 'muted small' }, 'Ninguna en este momento.')),
        h('div', {}, h('small', { class: 'label' }, `Trabajando ahora (último turno de 30 min)`), t.working.length ? h('div', { class: 'team-chips' }, ...t.working.map((w) => h('span', { class: 'tchip won' }, w.name + (w.holder === 'humano' ? ' · Humano' : '')))) : h('p', { class: 'muted small' }, 'Nadie: esperan el próximo turno.')),
        h('div', {}, h('small', { class: 'label' }, 'Última salida'), t.lastOutput ? h('p', { class: 'small' }, h('strong', {}, t.lastOutput.agent + ': '), t.lastOutput.summary, h('span', { class: 'muted tiny' }, ` · ${when(t.lastOutput.at)}`)) : h('p', { class: 'muted small' }, 'Todavía sin resultados.'))))));
    } else if (view === 'conversaciones') drawThreads();
    else drawHistory();
  }

  async function drawThreads() {
    body.replaceChildren(h('div', { class: 'card panel' }, h('div', { class: 'skeleton', style: 'height:160px' })));
    let d; try { d = await api('/api/panel/live/threads', { token }); } catch (e) { body.replaceChildren(h('div', { class: 'alert warn' }, h('span', { html: icon('warn') }), h('div', {}, 'No se pudieron leer las conversaciones: ' + e.message))); return; }
    if (view !== 'conversaciones') return;
    const th = (t) => h('li', { class: 'live-thread' }, h('details', {},
      h('summary', {}, h('strong', {}, t.title), h('span', { class: 'muted tiny' }, ` · ${t.team} · ${t.steps.length} paso(s) · ${t.messages.length} mensaje(s) · ${when(t.updatedAt)}`)),
      h('ol', { class: 'live-steps' }, ...t.steps.map((s) => h('li', {}, h('span', { class: 'small' }, h('strong', {}, `${s.from} → ${s.to}`), ` · ${OST[s.status] || s.status} · ${when(s.at)}`), s.result ? h('p', { class: 'tiny muted' }, 'Resultado: ' + s.result) : null))),
      t.messages.length ? h('ol', { class: 'ws-feed live-msgs' }, ...t.messages.map((m) => h('li', { class: 'ws-msg ' + m.fromKind }, h('div', { class: 'ws-meta tiny' }, h('strong', {}, m.from + (m.to ? ' → ' + m.to : '')), h('span', { class: 'muted' }, when(m.at))), h('p', { class: 'ws-body' }, m.body)))) : null));
    body.replaceChildren(
      h('section', { class: 'card panel' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Conversaciones por orden (7 días)')), h('p', { class: 'small muted' }, 'Quién delegó qué a quién, el resultado y lo que se dijeron los agentes. No incluye los chats privados de personas.'),
        d.threads.length ? h('ul', { class: 'live-threads' }, ...d.threads.map(th)) : h('p', { class: 'muted small' }, 'Todavía no hay órdenes con delegaciones o mensajes en los últimos 7 días.')),
      h('section', { class: 'card panel' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Notas de equipo sin orden')),
        d.teamNotes.length ? h('ol', { class: 'ws-feed live-msgs' }, ...d.teamNotes.map((m) => h('li', { class: 'ws-msg ' + m.fromKind }, h('div', { class: 'ws-meta tiny' }, h('strong', {}, m.from), h('span', { class: 'muted' }, `${m.channel} · ${when(m.at)}`)), h('p', { class: 'ws-body' }, m.body)))) : h('p', { class: 'muted small' }, 'Sin notas en los últimos 7 días.')));
  }

  function drawHistory() {
    const agents = (ov && ov.agents) || []; const teams = (ov && ov.teamsList) || []; const types = Object.keys(TYPE);
    const fa = h('select', { class: 'select', 'aria-label': 'Agente' }, h('option', { value: '' }, 'Todos los agentes'), ...agents.map((a) => h('option', { value: a.id }, a.name)));
    const ft = h('select', { class: 'select', 'aria-label': 'Equipo' }, h('option', { value: '' }, 'Todos los equipos'), ...teams.map((t) => h('option', { value: t.id }, t.label)));
    const fy = h('select', { class: 'select', 'aria-label': 'Tipo' }, h('option', { value: '' }, 'Todos los tipos'), ...types.map((t) => h('option', { value: t }, TYPE[t])));
    const ff = h('input', { class: 'input', type: 'date', 'aria-label': 'Desde', value: todayAR(-6) });
    const fto = h('input', { class: 'input', type: 'date', 'aria-label': 'Hasta', value: todayAR() });
    const out = h('div', {});
    const qs = () => { const q = new URLSearchParams(); if (fa.value) q.set('agent', fa.value); if (ft.value) q.set('team', ft.value); if (fy.value) q.set('type', fy.value); if (ff.value) q.set('from', ff.value); if (fto.value) q.set('to', fto.value); return q.toString(); };
    const run = async () => {
      out.replaceChildren(h('div', { class: 'skeleton', style: 'height:120px' }));
      try {
        const d = await api('/api/panel/live/history?' + qs(), { token });
        out.replaceChildren(h('p', { class: 'small muted' }, `${d.total} evento(s)${d.total > d.events.length ? `; se muestran los ${d.events.length} más nuevos (el CSV trae todos)` : ''}.`),
          d.events.length ? h('ol', { class: 'live-feed' }, ...d.events.map((e) => evItem(e, false))) : h('p', { class: 'muted small' }, 'Sin eventos con esos filtros.'));
      } catch (e) { out.replaceChildren(h('p', { class: 'error-text' }, e.message)); }
    };
    const form = h('form', { class: 'live-filters', novalidate: true }, fa, ft, fy, h('label', { class: 'tiny muted' }, 'Desde', ff), h('label', { class: 'tiny muted' }, 'Hasta', fto),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-sm btn-primary', type: 'submit' }, 'Filtrar'), h('button', { class: 'btn btn-sm', type: 'button', html: icon('download') + '<span>Descargar CSV</span>', onclick: () => download('/api/panel/live/history.csv?' + qs(), token, `en-vivo-${ff.value || 'desde'}-a-${fto.value || 'hoy'}.csv`) })));
    form.addEventListener('submit', (e) => { e.preventDefault(); run(); });
    body.replaceChildren(h('section', { class: 'card panel' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Historial')), form, out));
    run();
  }

  draw(); await poll(true);
  timer = setInterval(() => poll(false), 15000);
  if (!ov) toast('En vivo: no se pudo leer la actividad todavía.', 'info');
}
