/**
 * Pestaña «Empleo»: perfil y preferencias, búsqueda en bolsas de empleo públicas, ranking y borradores.
 * Fuentes: Himalayas, Jobicy, We Work Remotely y la búsqueda web (solo enlaces). Se respeta robots.txt
 * y las condiciones de cada sitio. Nunca se postula solo: el enlace lo abrís vos o confirmás el correo.
 */
import { h, icon, toast } from '../ui.js';
import { call, errorText } from './api.js';
import { offerCard } from '../chat/tool-cards.js';

let seq = 0;
const fid = () => `jf-${++seq}`;
function field(label, control, hint) {
  const id = control.id || (control.id = fid());
  return h('div', { class: 'field' }, h('label', { for: id }, label), control, hint ? h('small', { class: 'muted' }, hint) : null);
}

export async function renderJobs(el) {
  const [{ profile }, { offers }] = await Promise.all([call('/api/jobs/profile'), call('/api/jobs/offers')]);
  el.append(h('div', { class: 'acc-section-h' },
    h('h3', {}, 'Agente de empleo'),
    h('p', { class: 'muted' }, 'Busca en bolsas de empleo públicas, ordena las ofertas según tu perfil y te prepara el CV y la carta para cada una. Vos decidís dónde postular.')));
  const results = h('div', { class: 'tc-offers acc-offers', 'aria-live': 'polite' });
  const info = h('p', { class: 'acc-small muted' });
  el.append(profileForm(profile), searchForm(results, info, profile), info, results);
  if (offers && offers.length) { info.textContent = 'Tu última búsqueda:'; offers.forEach((o) => results.append(offerCard(o))); }
}

function profileForm(p) {
  const v = p || { preferences: {} };
  const pr = v.preferences || {};
  const name = h('input', { class: 'input', name: 'name', required: true, maxlength: 80, value: v.name || '', autocomplete: 'name' });
  const headline = h('input', { class: 'input', name: 'headline', maxlength: 120, value: v.headline || '', placeholder: 'Ej.: Atención al cliente y ventas' });
  const location = h('input', { class: 'input', name: 'location', maxlength: 120, value: v.location || 'Argentina', autocomplete: 'address-level2' });
  const email = h('input', { class: 'input', name: 'contactEmail', type: 'email', maxlength: 200, value: v.contactEmail || '', autocomplete: 'email' });
  const summary = h('textarea', { class: 'textarea', name: 'summary', rows: 3, maxlength: 1500, placeholder: 'Contá en 2 o 3 líneas qué hacés y qué buscás.' }, v.summary || '');
  const experience = h('textarea', { class: 'textarea', name: 'experience', rows: 3, maxlength: 3000, placeholder: 'Trabajos, tareas y logros (sin datos sensibles).' }, v.experience || '');
  const skills = h('input', { class: 'input', name: 'skills', maxlength: 600, value: (v.skills || []).join(', '), placeholder: 'Separadas por coma' });
  const english = h('select', { class: 'input', name: 'english' }, ...[['none', 'No hablo inglés'], ['basic', 'Básico'], ['written', 'Escrito (con ayuda)'], ['fluent', 'Fluido']].map(([val, l]) => h('option', { value: val, selected: (v.english || 'basic') === val || null }, l)));
  const roles = h('input', { class: 'input', name: 'roles', maxlength: 400, value: (pr.roles || []).join(', '), placeholder: 'Ej.: atención al cliente, soporte' });
  const exclude = h('input', { class: 'input', name: 'exclude', maxlength: 400, value: (pr.exclude || []).join(', '), placeholder: 'Ej.: ventas telefónicas' });
  const seniority = h('select', { class: 'input', name: 'seniority' }, ...[['any', 'Cualquiera'], ['junior', 'Junior / poca experiencia'], ['semi', 'Semi senior'], ['senior', 'Senior']].map(([val, l]) => h('option', { value: val, selected: (pr.seniority || 'any') === val || null }, l)));
  const remote = h('input', { type: 'checkbox', name: 'remoteOnly', checked: pr.remoteOnly !== false || null, id: fid() });
  const err = h('p', { class: 'error-text', role: 'alert' });
  const save = h('button', { class: 'btn btn-primary btn-sm', type: 'submit' }, 'Guardar perfil');
  const form = h('form', { class: 'acc-form', novalidate: true },
    h('div', { class: 'acc-form-grid' }, field('Nombre', name), field('Titular', headline), field('Ciudad / país', location), field('Correo para postular', email, 'Opcional. Nunca pedimos tu teléfono.')),
    field('Resumen', summary), field('Experiencia', experience),
    h('div', { class: 'acc-form-grid' }, field('Habilidades', skills), field('Inglés', english), field('Puestos que buscás', roles), field('Excluir ofertas con', exclude), field('Seniority', seniority)),
    h('label', { class: 'acc-check-row', for: remote.id }, remote, ' Solo trabajos remotos'),
    err, h('div', { class: 'acc-row' }, save));
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); err.textContent = '';
    if (!name.value.trim()) { err.textContent = 'Escribí tu nombre.'; name.focus(); return; }
    save.disabled = true;
    try {
      await call('/api/jobs/profile', { method: 'POST', body: { name: name.value, headline: headline.value, location: location.value, contactEmail: email.value, summary: summary.value, experience: experience.value, skills: skills.value, english: english.value, preferences: { roles: roles.value, exclude: exclude.value, seniority: seniority.value, remoteOnly: remote.checked } } });
      toast('Perfil guardado.', 'ok'); det.open = false; det.querySelector('summary small').textContent = 'Guardado';
    } catch (e2) { err.textContent = errorText(e2); }
    save.disabled = false;
  });
  const det = h('details', { class: 'acc-card acc-profile', open: !p || null },
    h('summary', {}, h('span', { html: icon('user') }), h('strong', {}, 'Tu perfil y preferencias'), h('small', { class: 'muted' }, p ? 'Guardado' : 'Completalo para mejores resultados')),
    form);
  return det;
}

/** Filtro de inglés por defecto (igual que el servidor): «no hablo» → sin inglés; «escrito» → solo escrito. */
export function defaultEnglishFilter(profile) {
  const pr = (profile && profile.preferences) || {};
  if (['any', 'none', 'written'].includes(pr.englishFilter)) return pr.englishFilter;
  return profile && profile.english === 'none' ? 'none' : profile && profile.english === 'written' ? 'written' : 'any';
}

function searchForm(results, info, profile) {
  const q = h('input', { class: 'input', type: 'search', name: 'q', maxlength: 120, value: (profile && profile.preferences && profile.preferences.roles[0]) || 'atención al cliente', 'aria-label': 'Qué trabajo buscás', enterkeyhint: 'search' });
  const btn = h('button', { class: 'btn btn-primary', type: 'submit' }, h('span', { html: icon('search') }), 'Buscar');
  // Fase 3: filtros que se aplican de verdad (no solo bajan el puesto en el orden).
  const engId = fid();
  const english = h('select', { class: 'input input-sm', id: engId, name: 'english' }, ...[['any', 'Cualquier nivel'], ['none', 'Sin inglés'], ['written', 'Solo inglés escrito']].map(([v, l]) => h('option', { value: v, selected: defaultEnglishFilter(profile) === v || null }, l)));
  const ar = h('input', { type: 'checkbox', name: 'remoteArgentina', id: fid(), checked: (profile && profile.preferences && profile.preferences.remoteArgentina) !== false || null });
  const filters = h('fieldset', { class: 'acc-filters' }, h('legend', { class: 'sr-only' }, 'Filtros de la búsqueda'),
    h('label', { class: 'acc-filter', for: engId }, h('span', {}, 'Inglés'), english),
    h('label', { class: 'acc-filter acc-check-row', for: ar.id }, ar, h('span', {}, 'Solo remoto desde Argentina')));
  const f = h('form', { class: 'acc-search-wrap', role: 'search' }, h('div', { class: 'acc-search' }, q, btn), filters);
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = q.value.trim();
    if (query.length < 2) { q.focus(); return; }
    btn.disabled = true; btn.lastChild.textContent = 'Buscando…';
    results.innerHTML = ''; info.textContent = 'Buscando en bolsas de empleo públicas…';
    try {
      const r = await call('/api/jobs/search', { method: 'POST', body: { query, english: english.value, remoteArgentina: ar.checked } });
      const src = r.sources.map((s) => `${s.source}${s.status === 'ok' ? ` (${s.count})` : s.status === 'robots' ? ' (no permitido por el sitio)' : ' (sin respuesta)'}`).join(' · ');
      info.textContent = r.offers.length ? `${r.offers.length} ofertas ordenadas por encaje. Fuentes: ${src}.` : `No encontré ofertas que encajen. Fuentes: ${src}.`;
      const hid = r.hidden || {};
      if (hid.english) info.append(h('span', { class: 'acc-hidden' }, ` ${hid.english === 1 ? 'Oculté 1 oferta que pide inglés.' : `Oculté ${hid.english} ofertas que piden inglés.`}`));
      if (hid.region) info.append(h('span', { class: 'acc-hidden' }, ` ${hid.region === 1 ? 'Oculté 1 oferta que no acepta Argentina.' : `Oculté ${hid.region} ofertas que no aceptan Argentina.`}`));
      if (!r.profile) info.append(h('span', {}, ' Completá tu perfil para que el orden sea más preciso y para preparar borradores.'));
      r.offers.forEach((o) => results.append(offerCard(o)));
    } catch (e2) { info.textContent = errorText(e2); }
    btn.disabled = false; btn.lastChild.textContent = 'Buscar';
  });
  return f;
}
