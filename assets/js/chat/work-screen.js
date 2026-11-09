/**
 * Pantalla de trabajo: tarjeta en el chat que muestra, mientras el agente trabaja, la actividad real paso a paso.
 *  - estado de cada paso (Pendiente / En curso / Listo / Error), acción actual que manda el servidor,
 *    tiempo transcurrido, Detener (corta el pedido de verdad), plegar y pantalla completa (Computadora del agente);
 *  - al terminar, un resumen con SOLO lo que pasó (pasos completados, archivos creados, qué quedó sin hacer).
 * Las funciones puras se prueban con vitest; workScreen() recibe h/icon para no depender del DOM al importar.
 */
const LABEL = { pending: 'Pendiente', running: 'En curso', done: 'Listo', error: 'Error', stopped: 'Detenido' };
export const stepLabel = (s) => LABEL[s] || LABEL.pending;

export function fmtElapsed(ms) {
  const t = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const hh = Math.floor(t / 3600), mm = Math.floor((t % 3600) / 60), ss = t % 60;
  return (hh ? `${hh}:${String(mm).padStart(2, '0')}` : String(mm)) + ':' + String(ss).padStart(2, '0');
}

/** Acción en curso: la que informó el servidor; si no, el paso que está corriendo. */
export function currentAction(m) {
  if (!m || !m.streaming) return '';
  if (m.action) return String(m.action);
  const cur = (m.steps || []).find((x) => x.status === 'running');
  if (cur) return `${cur.title}…`;
  const w = (m.artifacts || []).find((x) => x.writing);
  if (w) return `Escribiendo ${w.name}…`;
  return 'Armando el plan…';
}

/** Resumen honesto: solo pasos completados y archivos que llegaron de verdad. */
export function workSummary(m) {
  const steps = (m && m.steps) || [];
  const files = ((m && m.artifacts) || []).filter((a) => a && a.content && !a.writing).map((a) => (a.version ? `${a.name} · versión ${a.version}` : a.name));
  return {
    done: steps.filter((s) => s.status === 'done').map((s) => s.title),
    failed: steps.filter((s) => s.status === 'error').map((s) => s.title),
    notDone: steps.filter((s) => s.status !== 'done' && s.status !== 'error').map((s) => s.title),
    files,
    stopped: !!(m && m.stopped)
  };
}

export function elapsedOf(m, now = Date.now()) {
  if (!m || !m.startedAt) return 0;
  return (m.endedAt || now) - m.startedAt;
}

/**
 * Tarjeta DOM. o: { h, icon, onExpand(), onStop(), onToggle(open) }
 */
export function workScreen(m, o) {
  const { h, icon } = o;
  const running = !!m.streaming;
  const steps = m.steps || [];
  const done = steps.filter((x) => x.status === 'done').length;
  const open = m._wsOpen != null ? m._wsOpen : running;
  const sum = workSummary(m);
  const stopped = !running && (m.stopped || (steps.length && done < steps.length && !sum.failed.length));
  const state = running ? 'running' : stopped ? 'stopped' : sum.failed.length ? 'error' : 'done';
  const title = running ? currentAction(m) : stopped ? 'Detenido' : sum.failed.length ? 'Terminó con avisos' : 'Listo';
  const time = !m.startedAt ? null : h('span', { class: 'ws-time' + (running ? ' is-live' : ''), 'data-start': m.startedAt || '', 'aria-label': 'Tiempo transcurrido' }, fmtElapsed(elapsedOf(m)));
  const card = h('section', { class: `ws-card is-${state}${open ? ' is-open' : ''}`, 'aria-label': 'Pantalla de trabajo' });
  const dot = h('span', { class: 'ws-dot', 'aria-hidden': 'true', html: state === 'done' ? icon('check') : state === 'error' || state === 'stopped' ? icon('close') : '' });
  const head = h('div', { class: 'ws-head' },
    dot,
    h('div', { class: 'ws-title' },
      h('small', {}, 'Pantalla de trabajo'),
      h('strong', { 'data-no-i18n': running ? '' : null, 'aria-live': running ? 'polite' : null }, title)),
    h('div', { class: 'ws-tools' }, time,
    h('button', { class: 'ws-ib ws-fold', type: 'button', title: open ? 'Plegar' : 'Desplegar', 'aria-label': open ? 'Plegar pantalla de trabajo' : 'Desplegar pantalla de trabajo', 'aria-expanded': String(open), html: icon('chevron'), onclick: () => o.onToggle && o.onToggle(!open) }),
    h('button', { class: 'ws-ib', type: 'button', title: 'Pantalla completa', 'aria-label': 'Ver en pantalla completa', html: icon('expand'), onclick: () => o.onExpand && o.onExpand() }),
    running ? h('button', { class: 'ws-stop', type: 'button', 'aria-label': 'Detener al agente', onclick: () => o.onStop && o.onStop() }, h('span', { html: icon('stop') }), 'Detener') : null));
  card.append(head);
  card.append(h('div', { class: 'ws-prog', role: 'progressbar', 'aria-label': 'Avance', 'aria-valuemin': 0, 'aria-valuemax': steps.length || 1, 'aria-valuenow': done }, h('i', { style: `width:${steps.length ? Math.round((done / steps.length) * 100) : running ? 6 : 100}%` })));
  if (open) {
    const ul = h('ol', { class: 'ws-steps' });
    for (const st of steps) {
      const s = st.status === 'running' && !running ? 'stopped' : st.status || 'pending';
      ul.append(h('li', { class: 'ws-step is-' + s },
        h('span', { class: 'ws-sdot', 'aria-hidden': 'true', html: s === 'done' ? icon('check') : '' }),
        h('span', { class: 'ws-st' }, st.title),
        h('em', { class: 'ws-badge' }, stepLabel(s))));
    }
    if (steps.length) card.append(ul);
    if (!running) {
      const box = h('div', { class: 'ws-sum' }, h('strong', {}, 'Qué hice'));
      const list = h('ul', {});
      sum.done.forEach((t) => list.append(h('li', {}, t)));
      sum.files.forEach((f) => list.append(h('li', {}, 'Archivo: ' + f)));
      if (!sum.done.length && !sum.files.length) list.append(h('li', {}, 'No llegué a completar ningún paso.'));
      box.append(list);
      if (sum.failed.length) box.append(h('p', {}, 'Con avisos: ' + sum.failed.join(' · ')));
      if (stopped && sum.notDone.length) box.append(h('p', {}, 'Quedó sin hacer (lo detuviste): ' + sum.notDone.join(' · ')));
      card.append(box);
    }
  }
  return card;
}
