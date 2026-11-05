/**
 * Pestaña «Tareas»: tareas programadas de la persona (búsqueda diaria de empleo, resumen web) y sus resultados.
 * Las corre el servidor con un solo Cron Trigger (plan gratis); acá se crean, se editan, se pausan, se ejecutan una vez,
 * se ve el historial de ejecuciones y se borran.
 */
import { h, icon, toast, confirmDialog, timeAgo } from '../ui.js';
import { call, errorText } from './api.js';
import { getSiteLang } from '../i18n.js';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
let seq = 0;
const fid = (p) => `${p}-${++seq}`;

function field(label, control, hint) {
  const id = control.id || (control.id = fid('f'));
  return h('div', { class: 'field' }, h('label', { for: id }, label), control, hint ? h('small', { class: 'muted' }, hint) : null);
}

export async function renderTasks(el, ctx) {
  const data = await call('/api/tasks');
  const head = h('div', { class: 'acc-section-h' },
    h('h3', {}, 'Tareas programadas'),
    h('p', { class: 'muted' }, `${data.tasks.filter((t) => t.status === 'active').length} de ${data.max} activas · las horas son de Argentina.`));
  el.append(head);
  const list = h('div', { class: 'acc-tasks' });
  if (!data.tasks.length) list.append(h('div', { class: 'acc-empty sm' }, h('span', { class: 'acc-empty-ic', html: icon('clock') }), h('p', {}, 'Todavía no tenés tareas. Creá una abajo: por ejemplo, buscar empleo todos los días a las 9.')));
  for (const t of data.tasks) list.append(taskCard(t, ctx, el));
  el.append(list, taskForm(ctx, el, data));
}

function rerender(el, ctx) { el.innerHTML = ''; return renderTasks(el, ctx).catch((e) => el.append(h('p', { class: 'error-text' }, errorText(e)))); }

function taskCard(t, ctx, root) {
  const last = t.lastRun;
  const status = t.status === 'active' ? h('span', { class: 'acc-chip ok' }, 'Activa') : h('span', { class: 'acc-chip' }, 'Pausada');
  const runBtn = h('button', { class: 'btn btn-sm btn-primary', type: 'button' }, h('span', { html: icon('play') }), 'Ejecutar ahora');
  const results = h('div', { class: 'acc-task-res' });
  if (last) results.append(runView(last));
  runBtn.addEventListener('click', async () => {
    runBtn.disabled = true; runBtn.lastChild.textContent = 'Ejecutando…';
    try {
      const r = await call(`/api/tasks/${t.id}/run`, { method: 'POST', body: {} });
      toast(r.ok ? 'Listo: la tarea se ejecutó.' : r.summary, r.ok ? 'ok' : 'warn');
      results.innerHTML = '';
      if (r.runs && r.runs[0]) results.append(runView(r.runs[0]));
      ctx.summary = null;
    } catch (e) { toast(errorText(e), 'warn'); }
    runBtn.disabled = false; runBtn.lastChild.textContent = 'Ejecutar ahora';
  });
  const toggle = h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => {
    try { await call(`/api/tasks/${t.id}/${t.status === 'active' ? 'pause' : 'resume'}`, { method: 'POST', body: {} }); ctx.summary = null; rerender(root, ctx); }
    catch (e) { toast(errorText(e), 'warn'); }
  } }, t.status === 'active' ? 'Pausar' : 'Reanudar');
  const del = h('button', { class: 'icon-btn sm', type: 'button', 'aria-label': `Borrar la tarea ${t.title}`, html: icon('trash'), onclick: async () => {
    if (!(await confirmDialog({ title: 'Borrar tarea', text: `¿Borrar «${t.title}» y sus resultados?`, ok: 'Borrar', danger: true }))) return;
    try { await call(`/api/tasks/${t.id}/delete`, { method: 'POST', body: {} }); ctx.summary = null; rerender(root, ctx); } catch (e) { toast(errorText(e), 'warn'); }
  } });
  const card = h('article', { class: 'acc-task', 'aria-label': `Tarea: ${t.title}` });
  const edit = h('button', { class: 'btn btn-sm', type: 'button', 'aria-expanded': 'false' }, h('span', { html: icon('edit') }), 'Editar');
  edit.addEventListener('click', () => {
    const open = card.querySelector('.acc-task-edit');
    if (open) { open.remove(); edit.setAttribute('aria-expanded', 'false'); edit.focus(); return; }
    const f = taskForm(ctx, root, null, t, () => { f.remove(); edit.setAttribute('aria-expanded', 'false'); edit.focus(); });
    f.classList.add('acc-task-edit');
    card.insertBefore(f, card.querySelector('.acc-task-hist'));
    edit.setAttribute('aria-expanded', 'true');
    f.querySelector('select, input').focus();
  });
  const hist = historyBox(t);
  card.append(
    h('div', { class: 'acc-task-top' },
      h('span', { class: 'acc-task-ic', html: icon(t.kind === 'job_search' ? 'briefcase' : 'globe') }),
      h('div', { class: 'acc-task-t' }, h('strong', {}, t.title), h('small', { class: 'muted' }, t.schedule)),
      status),
    h('p', { class: 'acc-task-next muted' }, t.status === 'active' ? `Próxima: ${new Date(t.nextRunAt).toLocaleString(getSiteLang(), { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : t.failCount >= 5 ? 'Se pausó sola después de 5 fallas seguidas.' : 'No se ejecuta mientras esté pausada.'),
    results,
    h('div', { class: 'acc-row' }, runBtn, toggle, edit, del),
    hist);
  return card;
}

/** «Historial»: se carga al abrirlo (últimas 10 ejecuciones, con estado, cuándo y si fue manual). */
function historyBox(t) {
  const list = h('div', { class: 'acc-hist-list', 'aria-live': 'polite' });
  const det = h('details', { class: 'acc-task-hist' }, h('summary', {}, 'Historial de ejecuciones'), list);
  let loaded = false;
  det.addEventListener('toggle', async () => {
    if (!det.open || loaded) return;
    loaded = true;
    list.replaceChildren(h('p', { class: 'muted acc-small' }, 'Cargando…'));
    try {
      const r = await call(`/api/tasks/${t.id}/runs?limit=10`);
      if (!r.runs.length) { list.replaceChildren(h('p', { class: 'muted acc-small' }, 'Todavía no se ejecutó.')); return; }
      list.replaceChildren(h('ol', { class: 'acc-hist' }, ...r.runs.map((x) => h('li', { class: x.status },
        h('span', { class: 'acc-chip ' + (x.status === 'ok' ? 'ok' : x.status === 'error' ? 'warn' : '') }, x.status === 'ok' ? 'Bien' : x.status === 'error' ? 'Con problemas' : 'En curso'),
        h('span', { class: 'acc-hist-when' }, new Date(x.startedAt).toLocaleString(getSiteLang(), { timeZone: 'America/Argentina/Buenos_Aires', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), x.trigger === 'manual' ? ' · manual' : ' · programada'),
        x.summary ? h('span', { class: 'acc-hist-sum' }, x.summary) : null))));
    } catch (e) { loaded = false; list.replaceChildren(h('p', { class: 'error-text' }, errorText(e))); }
  });
  return det;
}

function runView(r) {
  const ok = r.status === 'ok';
  const box = h('div', { class: 'acc-run ' + (ok ? 'ok' : r.status === 'running' ? '' : 'err') },
    h('p', {}, h('strong', {}, ok ? 'Último resultado' : r.status === 'running' ? 'En curso' : 'Última ejecución con problemas'), ' · ', h('span', { class: 'muted' }, timeAgo(r.startedAt)), r.trigger === 'manual' ? h('span', { class: 'muted' }, ' · manual') : null),
    h('p', { class: 'acc-run-sum' }, r.summary || ''));
  const offers = r.result && Array.isArray(r.result.offers) ? r.result.offers : [];
  if (offers.length) {
    box.append(h('ol', { class: 'acc-run-list' }, ...offers.slice(0, 5).map((o) => h('li', {},
      h('a', { href: o.url, target: '_blank', rel: 'noopener noreferrer nofollow' }, o.title), h('span', { class: 'muted' }, ` · ${o.company} · ${o.score}/100`)))));
  }
  const items = r.result && Array.isArray(r.result.items) ? r.result.items : [];
  if (items.length) box.append(h('ol', { class: 'acc-run-list' }, ...items.slice(0, 5).map((o) => h('li', {}, h('a', { href: o.url, target: '_blank', rel: 'noopener noreferrer nofollow' }, o.title)))));
  return box;
}

function taskForm(ctx, root, data, task = null, onCancel = null) {
  const kind = h('select', { class: 'input', name: 'kind' }, h('option', { value: 'job_search' }, 'Buscar empleo'), h('option', { value: 'web_digest' }, 'Resumen de la web'));
  const query = h('input', { class: 'input', name: 'query', required: true, maxlength: 120, placeholder: 'Ej.: atención al cliente remoto Argentina', autocomplete: 'off' });
  const cadence = h('select', { class: 'input', name: 'cadence' }, h('option', { value: 'daily' }, 'Todos los días'), h('option', { value: 'weekly' }, 'Una vez por semana'));
  const wd = task && task.weekday !== null && task.weekday !== undefined ? task.weekday : 1;
  const hr = task ? task.hourArt : 9;
  const weekday = h('select', { class: 'input', name: 'weekday' }, ...DAYS.map((d, i) => h('option', { value: String(i), selected: i === wd || null }, d)));
  const hour = h('select', { class: 'input', name: 'hour' }, ...Array.from({ length: 24 }, (_, i) => h('option', { value: String(i), selected: i === hr || null }, `${String(i).padStart(2, '0')}:00`)));
  const title = task ? h('input', { class: 'input', name: 'title', maxlength: 80, autocomplete: 'off', value: task.title }) : null;
  if (task) { kind.value = task.kind; query.value = (task.params && task.params.query) || ''; cadence.value = task.cadence; }
  const dayField = field('Día', weekday);
  dayField.hidden = cadence.value !== 'weekly';
  cadence.addEventListener('change', () => { dayField.hidden = cadence.value !== 'weekly'; });
  const err = h('p', { class: 'error-text', role: 'alert' });
  const submit = h('button', { class: 'btn btn-primary', type: 'submit' }, h('span', { html: icon(task ? 'check' : 'plus') }), task ? 'Guardar cambios' : 'Crear tarea');
  const cancel = task ? h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => onCancel && onCancel() }, 'Cancelar') : null;
  const full = !task && data.tasks.filter((t) => t.status === 'active').length >= data.max;
  const form = h('form', { class: 'acc-card acc-form', novalidate: true, 'aria-label': task ? `Editar ${task.title}` : 'Nueva tarea' },
    h('h4', {}, task ? 'Editar tarea' : 'Nueva tarea'),
    full ? h('p', { class: 'acc-note' }, h('span', { html: icon('info') }), 'Llegaste al máximo de tareas activas de tu plan. Pausá o borrá una para crear otra.') : null,
    h('div', { class: 'acc-form-grid' }, title ? field('Nombre', title) : null, field('Qué hace', kind), field('Qué buscar', query), field('Frecuencia', cadence), dayField, field('Hora (Argentina)', hour)),
    err, h('div', { class: 'acc-row' }, submit, cancel));
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); err.textContent = '';
    if (query.value.trim().length < 2) { err.textContent = 'Escribí qué querés buscar.'; query.focus(); return; }
    submit.disabled = true;
    const body = { kind: kind.value, params: { query: query.value.trim() }, cadence: cadence.value, hourArt: Number(hour.value), weekday: cadence.value === 'weekly' ? Number(weekday.value) : undefined };
    try {
      if (task) {
        await call(`/api/tasks/${task.id}/edit`, { method: 'POST', body: { ...body, title: title.value.trim() || undefined } });
        toast('Cambios guardados.', 'ok');
      } else {
        await call('/api/tasks', { method: 'POST', body });
        toast('Tarea creada.', 'ok');
      }
      ctx.summary = null; rerender(root, ctx);
    } catch (e2) { err.textContent = errorText(e2); submit.disabled = false; }
  });
  return form;
}
