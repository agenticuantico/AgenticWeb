/**
 * /admin/ → Gobernanza IA: uso de imágenes y videos, pedidos bloqueados, reportes y cupos editables.
 * Datos del Worker (GET /api/admin/ai, solo dueño). Nunca muestra nombres de proveedores: los motores tienen rótulos neutros.
 */
import { h, icon, toast, fmtDate } from './ui.js';
import { CONFIG } from './config.js';

(function css() {
  if (typeof document === 'undefined' || document.getElementById('ac-gov-css')) return;
  const l = document.createElement('link'); l.id = 'ac-gov-css'; l.rel = 'stylesheet'; l.href = '/assets/css/admin-governance.css?v=1.0.0';
  document.head.appendChild(l);
})();

const base = () => String(CONFIG.API_BASE || '').replace(/\/+$/, '');
async function call(user, path, body) {
  const token = await user.getIdToken();
  const r = await fetch(base() + path, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || 'error_' + r.status); e.code = j.error; throw e; }
  return j;
}

export const ENGINE_LABEL = {
  'wai-flux': 'Principal · alta calidad', 'wai-sdxl': 'Principal · liviano', cache: 'Caché (pedido repetido)', 'hf-flux': 'Respaldo con token gratuito',
  gemini: 'Respaldo B', horde: 'Red pública (servidor)', 'horde-browser': 'Red pública (navegador)', 'hf-ltx-token': 'Video · servidor', 'ltx-browser': 'Video · navegador', primary: 'Principal', fallback: 'Respaldo', '—': 'Sin motor'
};
export const CATEGORY_LABEL = { minors: 'Menores', sexual: 'Sexual explícito', deepfake: 'Persona real / deepfake', violence: 'Violencia gráfica', weapons: 'Armas', illegal: 'Ilegal', hate: 'Odio', self_harm: 'Autolesión', otro: 'Otro' };
const LAYER_LABEL = { rules: 'Reglas fijas', guard: 'Clasificador', backup: 'Clasificador de respaldo', vision: 'Revisión del resultado' };
const REASON_LABEL = { menores: 'Menores', sexual: 'Sexual', persona_real: 'Persona real', violencia: 'Violencia', ilegal: 'Ilegal', odio: 'Odio', error: 'Resultado incorrecto', otro: 'Otro' };
const PLAN_LABEL = { guest: 'Sin cuenta', free: 'Gratis', pro: 'Pro', empresa: 'Empresa' };
const STATUS_LABEL = { nuevo: ['Nuevo', 'warn'], revisado: ['Revisado', 'ok'], accion: ['Acción tomada', 'ok'] };

const sum = (rows, f) => rows.filter(f).reduce((a, r) => a + Number(r.n || 0), 0);

export async function renderGovernance(box, user) {
  box.innerHTML = '';
  box.append(h('div', { class: 'card panel' }, h('div', { class: 'skeleton', style: 'height:22px;width:40%' }), h('p', { class: 'muted', style: 'margin-top:10px' }, 'Cargando gobernanza…')));
  let d;
  try { d = await call(user, '/api/admin/ai'); }
  catch (e) {
    box.innerHTML = '';
    box.append(h('div', { class: 'alert warn' }, 'No se pudo leer la gobernanza del servidor (', e.code || e.message, ').'));
    return;
  }
  box.innerHTML = '';
  const today = new Date().toISOString().slice(0, 10);
  const days = d.days || [];
  const imgOk = sum(days, (r) => r.kind === 'image' && r.verdict === 'allowed');
  const vidOk = sum(days, (r) => r.kind === 'video' && r.verdict === 'done');
  const blocked = sum(days, (r) => r.verdict === 'blocked');
  const errors = sum(days, (r) => r.verdict === 'error');
  const todayImg = sum(days, (r) => r.day === today && r.kind === 'image' && r.verdict === 'allowed');
  const budget = Object.fromEntries((d.budgetToday || []).map((r) => [r.key, Number(r.value)]));
  const cfg = d.config;

  const kpi = (label, value, sub, ic) => h('div', { class: 'kpi' }, h('span', { class: 'kpi-ic', html: icon(ic) }), h('div', {}, h('small', {}, label), h('strong', {}, String(value)), sub ? h('span', { class: 'muted tiny' }, sub) : null));
  box.append(h('div', { class: 'kpis gov-kpis' },
    kpi('Imágenes (14 días)', imgOk, `Hoy: ${todayImg}`, 'image'),
    kpi('Videos con IA (14 días)', vidOk, d.engines && d.engines.video === 'server' ? 'Motor: servidor' : 'Motor: navegador', 'play'),
    kpi('Bloqueados (14 días)', blocked, 'Pedidos y resultados', 'shield'),
    kpi('Errores (14 días)', errors, 'Sin motor disponible', 'warn'),
    kpi('Voz premium hoy', `${budget.tts_premium_chars || 0} / ${cfg.ttsPremiumDailyChars}`, 'caracteres', 'mic')));

  const grid = h('div', { class: 'admin-grid' });
  box.append(grid);
  const card = (title, cls = '', extra = null) => { const c = h('section', { class: 'card panel ' + cls }, h('div', { class: 'panel-head' }, h('h2', {}, title), extra)); grid.append(c); return c; };

  /* ---- Salvaguardas y cupos (editable) ---- */
  const cc = card('Salvaguardas y cupos', 'span-2');
  cc.append(h('p', { class: 'muted small' }, 'Las reglas fijas (menores, deepfakes de personas reales, sexual explícito, violencia gráfica, armas, odio, autolesión) están siempre activas y no se pueden apagar.'));
  const sw = (key, label, hint) => {
    const input = h('input', { type: 'checkbox', checked: cfg[key] ? '' : null, 'aria-label': label, 'data-k': key });
    return h('label', { class: 'flag-row' }, h('span', {}, h('strong', {}, label), hint ? h('small', { class: 'muted', style: 'display:block' }, hint) : null), h('span', { class: 'switch' }, input, h('span')));
  };
  cc.append(sw('moderation', 'Clasificador de seguridad', 'Revisa cada pedido además de las reglas fijas.'),
    sw('outputCheck', 'Revisión del resultado', 'Revisa la imagen antes de mostrarla.'),
    sw('publicNetwork', 'Red pública gratuita de respaldo', 'Más lenta; se usa cuando no hay otro motor.'),
    sw('video', 'Video con IA', 'Si se apaga, el chat arma clips animados con imágenes.'));
  const num = (path, val, label) => h('input', { class: 'input gov-num', type: 'number', min: '0', step: '1', value: String(val), 'data-p': path, 'aria-label': label });
  const tbl = h('table', { class: 'gov-qtable' },
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Plan'), h('th', { scope: 'col' }, 'Imágenes/día'), h('th', { scope: 'col' }, 'Videos/día'))),
    h('tbody', {}, ...['guest', 'free', 'pro', 'empresa'].map((t) => h('tr', {}, h('th', { scope: 'row' }, PLAN_LABEL[t]), h('td', {}, num(`imageQuota.${t}`, cfg.imageQuota[t], `Imágenes por día, ${PLAN_LABEL[t]}`)), h('td', {}, num(`videoQuota.${t}`, cfg.videoQuota[t], `Videos por día, ${PLAN_LABEL[t]}`))))));
  cc.append(h('div', { class: 'table-wrap' }, tbl),
    h('div', { class: 'gov-row' },
      h('label', {}, h('span', {}, 'Imágenes por minuto'), num('perMinute.image', cfg.perMinute.image, 'Imágenes por minuto')),
      h('label', {}, h('span', {}, 'Videos por minuto'), num('perMinute.video', cfg.perMinute.video, 'Videos por minuto')),
      h('label', {}, h('span', {}, 'Voz premium (caracteres/día)'), num('ttsPremiumDailyChars', cfg.ttsPremiumDailyChars, 'Voz premium, caracteres por día'))));
  const saveBtn = h('button', { class: 'btn btn-primary', type: 'button', html: icon('check') + 'Guardar cambios' });
  saveBtn.onclick = async () => {
    const out = { imageQuota: {}, videoQuota: {}, perMinute: {} };
    cc.querySelectorAll('[data-p]').forEach((i) => { const [a, b] = i.dataset.p.split('.'); if (b) out[a][b] = Number(i.value); else out[a] = Number(i.value); });
    cc.querySelectorAll('[data-k]').forEach((i) => { out[i.dataset.k] = i.checked; });
    saveBtn.disabled = true;
    try { await call(user, '/api/admin/ai/config', out); toast('Gobernanza actualizada', 'ok'); }
    catch (e) { toast('No se pudo guardar: ' + (e.code || e.message), 'error', 6000); }
    finally { saveBtn.disabled = false; }
  };
  cc.append(h('div', { class: 'row', style: 'margin-top:12px;gap:10px;flex-wrap:wrap' }, saveBtn, h('a', { class: 'btn', href: '/gobernanza/', target: '_blank', rel: 'noopener' }, 'Ver la política pública')));

  /* ---- Motores (rótulos neutros) ---- */
  const ec = card('Motores usados (14 días)', 'span-2');
  const prov = (d.providers || []).slice().sort((a, b) => b.n - a.n);
  if (!prov.length) ec.append(h('p', { class: 'muted' }, 'Todavía no hay generaciones registradas.'));
  else ec.append(h('ul', { class: 'gov-list' }, ...prov.map((p) => h('li', {}, h('span', {}, `${p.kind === 'video' ? 'Video' : 'Imagen'} · ${ENGINE_LABEL[p.provider] || 'Otro'}`), h('strong', {}, String(p.n))))));
  ec.append(h('p', { class: 'muted small', style: 'margin-top:10px' },
    `Clasificador: ${d.engines && d.engines.classifier ? 'activo' : 'no disponible'} · respaldo: ${d.engines && d.engines.backupClassifier ? 'activo' : 'no disponible'} · token gratuito de video: ${d.engines && d.engines.hfToken ? 'cargado' : 'no cargado (el video usa la cuota gratuita del navegador de cada persona)'}.`));
  if ((d.categories || []).length) ec.append(h('h3', { class: 'gov-h3' }, 'Bloqueos por motivo'), h('ul', { class: 'gov-list' }, ...d.categories.map((c) => h('li', {}, h('span', {}, CATEGORY_LABEL[c.category] || c.category), h('strong', {}, String(c.n))))));

  /* ---- Pedidos bloqueados ---- */
  const bc = card('Pedidos bloqueados', 'span-4');
  const bl = d.blocked || [];
  if (!bl.length) bc.append(h('p', { class: 'muted' }, 'No hay pedidos bloqueados.'));
  else bc.append(h('div', { class: 'table-wrap' }, h('table', { class: 'gov-btable' },
    h('thead', {}, h('tr', {}, ...['Fecha', 'Tipo', 'Motivo', 'Decidió', 'Plan', 'Extracto (30 días)'].map((t) => h('th', { scope: 'col' }, t)))),
    h('tbody', {}, ...bl.map((r) => h('tr', {},
      h('td', {}, fmtDate(new Date(r.ts))), h('td', {}, r.kind === 'video' ? 'Video' : 'Imagen'),
      h('td', {}, h('span', { class: 'chip danger' }, CATEGORY_LABEL[r.category] || 'Otro')), h('td', {}, LAYER_LABEL[r.layer] || r.layer || '—'),
      h('td', {}, PLAN_LABEL[r.plan] || r.plan), h('td', { class: 'gov-excerpt', 'data-no-i18n': '' }, r.excerpt || h('span', { class: 'muted' }, `huella ${String(r.prompt_hash || '').slice(0, 10)}…`))))))));

  /* ---- Reportes ---- */
  const rc = card('Reportes de personas', 'span-4');
  const reps = d.reports || [];
  if (!reps.length) rc.append(h('p', { class: 'muted' }, 'No hay reportes.'));
  else rc.append(h('ul', { class: 'gov-reports' }, ...reps.map((r) => {
    const [lab, tone] = STATUS_LABEL[r.status] || STATUS_LABEL.nuevo;
    const chip = h('span', { class: 'chip ' + tone }, lab);
    const act = (status, text) => h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => { try { await call(user, '/api/admin/ai/report', { id: r.id, status }); const [l2, t2] = STATUS_LABEL[status]; chip.textContent = l2; chip.className = 'chip ' + t2; } catch (e) { toast(e.code || e.message, 'error'); } } }, text);
    return h('li', {}, h('div', {}, h('strong', {}, REASON_LABEL[r.reason] || r.reason), ' ', chip, h('small', { class: 'muted', style: 'display:block' }, fmtDate(new Date(r.ts)), r.audit_id ? ` · archivo ${r.audit_id.slice(0, 8)}…` : ''), r.details ? h('p', { class: 'small', 'data-no-i18n': '' }, r.details) : null),
      h('div', { class: 'row', style: 'gap:6px' }, act('revisado', 'Revisado'), act('accion', 'Acción tomada')));
  })));
}
