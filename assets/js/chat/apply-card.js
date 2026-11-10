/**
 * Tarjeta del chat para la tanda de postulaciones: UNA aprobación para todas.
 *  - Antes de aprobar: lista de ofertas con lo que se va a enviar en cada una (editable), casilla para quitar,
 *    permiso opcional para aceptar términos/privacidad de cada portal, y la estimación honesta del día.
 *  - Después: estado por oferta (en cola / enviando / enviada / necesita tu ayuda / omitida) con su motivo.
 * Las ofertas de LinkedIn, de portales que no permiten bots o sin verificar quedan como enlace u omitidas.
 */
import { h, icon, toast } from '../ui.js';
import { call, errorText } from '../account/api.js';

const ST = {
  pending: ['', 'Lista para enviar'], queued: ['', 'En cola'], running: ['warn', 'Enviando…'], sent: ['ok', 'Enviada'],
  needs_help: ['warn', 'Necesita tu ayuda'], skipped: ['muted', 'Omitida'], removed: ['muted', 'Quitada']
};
const modeChip = (it) => (it.mode === 'link' ? 'Solo enlace' : it.mode === 'skip' ? 'Omitida' : null);
const FIELDS = [['fullName', 'Nombre completo', 'text'], ['email', 'Correo', 'email'], ['location', 'Ubicación', 'text'], ['english', 'Inglés', 'text'], ['availability', 'Disponibilidad', 'text'], ['cvSummary', 'Resumen del CV', 'area'], ['coverLetter', 'Carta de presentación', 'area']];

export function applyCard(m) {
  const data = m.tools.batch;
  const meta = (it) => h('small', { class: 'tc-apply-meta' }, h('span', {}, it.company || ''), h('span', { class: 'tc-apply-host', title: it.host || '' }, it.host || ''));
  const root = h('div', { class: 'tc-apply', role: 'group', 'aria-label': 'Postulaciones para aprobar' });
  let timer = null;
  const render = (v) => {
    m.tools.batch = { ...m.tools.batch, ...v };
    root.innerHTML = '';
    if (v.batch.status === 'draft') draft(v); else progress(v);
  };

  function head(v, sub) {
    return h('div', { class: 'tc-apply-h' }, h('span', { class: 'tc-lock', html: icon('shield') }),
      h('div', {}, h('strong', {}, v.batch.status === 'draft' ? 'Postulaciones para revisar' : 'Tus postulaciones'), h('small', {}, sub)));
  }

  function draft(v) {
    const autos = v.items.filter((i) => i.mode === 'auto');
    const edits = new Map();
    const include = new Map(autos.map((i) => [i.id, true]));
    const terms = h('input', { type: 'checkbox', id: 'terms-' + v.batch.id });
    const okBtn = h('button', { class: 'btn btn-sm btn-primary', type: 'button' }, h('span', { html: icon('check') }), `Aprobar y postular (${autos.length})`);
    const noBtn = h('button', { class: 'btn btn-sm btn-ghost', type: 'button' }, 'Cancelar');
    const state = h('p', { class: 'tc-state', role: 'status', 'aria-live': 'polite' });
    const count = () => { const n = [...include.values()].filter(Boolean).length; okBtn.lastChild.textContent = `Aprobar y postular (${n})`; okBtn.disabled = n === 0; };
    root.append(head(v, `«${v.batch.query}» · nada se envía hasta que apruebes`));
    root.append(h('p', { class: 'tc-apply-est' }, h('span', { html: icon('clock') }), v.estimate ? v.estimate.text : ''));
    const list = h('ol', { class: 'tc-apply-list' });
    for (const it of v.items) {
      const li = h('li', { class: 'tc-apply-item' + (it.mode === 'auto' ? '' : ' off') });
      const titleRow = h('div', { class: 'tc-apply-t' });
      if (it.mode === 'auto') {
        const cb = h('input', { type: 'checkbox', checked: true, 'aria-label': `Incluir ${it.title}` });
        cb.addEventListener('change', () => { include.set(it.id, cb.checked); li.classList.toggle('removed', !cb.checked); count(); });
        titleRow.append(cb);
      }
      titleRow.append(h('div', {}, h('strong', {}, it.title), meta(it)));
      if (modeChip(it)) titleRow.append(h('span', { class: 'acc-chip muted' }, modeChip(it)));
      li.append(titleRow);
      if (it.mode !== 'auto') {
        li.append(h('p', { class: 'tc-apply-why' }, it.reason || ''), h('a', { href: it.url, target: '_blank', rel: 'noopener noreferrer', class: 'tc-apply-link' }, 'Abrir la oferta'));
      } else {
        const ans = (v.answers && v.answers[it.id]) || {};
        const det = h('details', { class: 'tc-apply-det' }, h('summary', {}, 'Ver y editar lo que se envía'));
        const grid = h('div', { class: 'tc-apply-fields' });
        for (const [k, label, type] of FIELDS) {
          const id = `ap-${it.id}-${k}`;
          const input = type === 'area' ? h('textarea', { class: 'input', id, rows: k === 'coverLetter' ? 7 : 3 }) : h('input', { class: 'input', id, type });
          input.value = ans[k] || '';
          input.addEventListener('input', () => { const e = edits.get(it.id) || {}; e[k] = input.value; edits.set(it.id, e); });
          grid.append(h('div', { class: 'field' + (type === 'area' ? ' wide' : '') }, h('label', { for: id }, label), input));
        }
        det.append(grid, h('p', { class: 'acc-small muted' }, 'Se adjunta un CV en PDF armado con tu perfil. Nunca se envía tu teléfono.'));
        li.append(det);
      }
      list.append(li);
    }
    root.append(list);
    root.append(h('label', { class: 'tc-apply-terms', for: terms.id }, terms, h('span', {}, 'Autorizo aceptar en mi nombre los términos y la política de privacidad de cada portal (si no, esas postulaciones quedan para que las completes tú).')));
    root.append(h('div', { class: 'tc-acts' }, okBtn, noBtn), state);
    count();
    okBtn.addEventListener('click', async () => {
      okBtn.disabled = noBtn.disabled = true; state.textContent = 'Poniendo en cola…';
      try {
        const items = autos.map((i) => ({ id: i.id, include: include.get(i.id) !== false, answers: edits.get(i.id) }));
        const r = await call(`/api/apply/batches/${v.batch.id}/approve`, { method: 'POST', body: { items, acceptTerms: terms.checked } });
        toast('Postulaciones aprobadas. Te muestro el avance aquí.', 'ok');
        render(r); poll();
      } catch (e) { state.textContent = errorText(e); okBtn.disabled = noBtn.disabled = false; }
    });
    noBtn.addEventListener('click', async () => {
      noBtn.disabled = okBtn.disabled = true;
      try { render(await call(`/api/apply/batches/${v.batch.id}/cancel`, { method: 'POST', body: {} })); } catch (e) { state.textContent = errorText(e); noBtn.disabled = okBtn.disabled = false; }
    });
  }

  function progress(v) {
    const done = v.items.filter((i) => i.status === 'sent').length;
    const help = v.items.filter((i) => i.status === 'needs_help').length;
    const left = v.items.filter((i) => i.status === 'queued' || i.status === 'running').length;
    const sub = v.batch.status === 'cancelled' ? 'Cancelaste la tanda: lo que faltaba no se envió.' : `${done} enviada${done === 1 ? '' : 's'} · ${help} necesita${help === 1 ? '' : 'n'} tu ayuda · ${left} en cola`;
    root.append(head(v, sub));
    if (left && v.estimate) root.append(h('p', { class: 'tc-apply-est' }, h('span', { html: icon('clock') }), v.estimate.text));
    root.append(h('ol', { class: 'tc-apply-list' }, ...v.items.map((it) => {
      const [tone, label] = ST[it.status] || ST.pending;
      return h('li', { class: 'tc-apply-item st-' + it.status },
        h('div', { class: 'tc-apply-t' }, h('div', {}, h('strong', {}, it.title), meta(it)), h('span', { class: `acc-chip ${tone}` }, label)),
        it.reason ? h('p', { class: 'tc-apply-why' }, it.reason) : null,
        it.status === 'needs_help' || it.mode !== 'auto' ? h('a', { href: it.url, target: '_blank', rel: 'noopener noreferrer', class: 'tc-apply-link' }, 'Abrir la oferta') : null);
    })));
    if (left) root.append(h('div', { class: 'tc-acts' }, h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: async (e) => {
      e.currentTarget.disabled = true;
      try { render(await call(`/api/apply/batches/${v.batch.id}/cancel`, { method: 'POST', body: {} })); } catch (err) { toast(errorText(err), 'warn'); }
    } }, 'Cancelar lo que falta')));
  }

  async function refresh() {
    try { const v = await call(`/api/apply/batches/${data.batch.id}`); render(v); return v; } catch { return null; }
  }
  function poll() {
    clearInterval(timer);
    timer = setInterval(async () => {
      if (!root.isConnected) { clearInterval(timer); return; }
      const v = await refresh();
      if (v && (v.batch.status === 'done' || v.batch.status === 'cancelled')) clearInterval(timer);
    }, 20_000);
  }
  render(data);
  if (data.batch.status !== 'draft') { refresh().then((v) => { if (v && !['done', 'cancelled'].includes(v.batch.status)) poll(); }); }
  return root;
}
