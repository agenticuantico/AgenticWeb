/**
 * Formulario de contacto / inversores / empresas.
 * Guarda en Firestore leads/{id} (crear: público con validación en reglas; leer/editar: solo admin).
 * Si no se puede guardar, abre el correo con el mensaje listo (respaldo honesto, sin perder la consulta).
 */
import { getStore } from './firebase.js';
import { CONFIG } from './config.js';

const PRIORITY = ['AR', 'US', 'ES', 'CH', 'IT', 'MX', 'CO'];
const OTHERS = ['DE', 'AT', 'BE', 'BO', 'BR', 'CA', 'CL', 'CN', 'CR', 'DO', 'EC', 'FR', 'GB', 'GT', 'HN', 'IE', 'IL', 'IN', 'JP', 'KR', 'LU', 'NI', 'NL', 'NO', 'PA', 'PE', 'PL', 'PR', 'PT', 'PY', 'SE', 'SG', 'SV', 'AE', 'UY', 'VE', 'AU', 'DK', 'FI', 'ZA'];

function fillCountries(sel, lang) {
  let dn; try { dn = new Intl.DisplayNames([lang], { type: 'region' }); } catch { dn = { of: (c) => c }; }
  const opt = (c) => `<option value="${c}">${dn.of(c)}</option>`;
  const rest = OTHERS.slice().sort((a, b) => dn.of(a).localeCompare(dn.of(b), lang));
  const guess = ((navigator.language || '').split('-')[1] || '').toUpperCase();
  sel.innerHTML = PRIORITY.map(opt).join('') + '<option disabled>──────────</option>' + rest.map(opt).join('') + `<option value="XX">${lang === 'es' ? 'Otro' : lang === 'pt' ? 'Outro' : lang === 'it' ? 'Altro' : lang === 'fr' ? 'Autre' : lang === 'de' ? 'Anderes' : 'Other'}</option>`;
  if ([...PRIORITY, ...OTHERS].includes(guess)) sel.value = guess;
}

function mailto(d) {
  const body = `${d.message}\n\n— ${d.name}${d.company ? ' · ' + d.company : ''}\n${d.email}\nPaís: ${d.country} · Interés: ${d.type}${d.ticket ? ' · Ticket: ' + d.ticket : ''}`;
  return `mailto:${CONFIG.CONTACT_EMAIL}?subject=${encodeURIComponent((d.type === 'inversion' ? 'Inversión' : 'Consulta Comercial') + ' · ' + (d.company || d.name))}&body=${encodeURIComponent(body)}`;
}

for (const form of document.querySelectorAll('#leadForm')) {
  const lang = form.dataset.lang || 'es';
  fillCountries(form.querySelector('[data-country-select]'), lang);
  const err = form.querySelector('[data-role="err"]');
  const ok = form.querySelector('[data-role="ok"]');
  const failMsg = form.querySelector('[data-role="fail"]').innerHTML;
  // Botones «Invertir / Asociarse / Agendar reunión» preseleccionan el tipo
  document.querySelectorAll('[data-lead-type]').forEach((a) => a.addEventListener('click', () => {
    const sel = form.querySelector('[name="type"]');
    if ([...sel.options].some((o) => o.value === a.dataset.leadType)) sel.value = a.dataset.leadType;
    setTimeout(() => form.querySelector('[name="name"]').focus({ preventScroll: true }), 400);
  }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    if (fd.get('website')) return; // trampa anti-bots
    const d = {
      name: String(fd.get('name') || '').trim().slice(0, 80),
      company: String(fd.get('company') || '').trim().slice(0, 100),
      email: String(fd.get('email') || '').trim().slice(0, 120),
      country: String(fd.get('country') || 'XX'),
      type: String(fd.get('type') || 'consulta'),
      ticket: String(fd.get('ticket') || '').trim().slice(0, 60),
      message: String(fd.get('message') || '').trim().slice(0, 2000)
    };
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const { fs, db } = await getStore();
      await fs.addDoc(fs.collection(db, 'leads'), { ...d, consent: true, lang, page: form.dataset.page || location.pathname.slice(0, 60), stage: 'nuevo', createdAt: fs.serverTimestamp() });
      form.querySelectorAll('input:not([type=checkbox]), textarea').forEach((el) => { el.value = ''; });
      form.querySelector('[name="consent"]').checked = false;
      ok.hidden = false;
      ok.focus?.();
    } catch {
      err.textContent = new DOMParser().parseFromString(failMsg, 'text/html').documentElement.textContent;
      err.hidden = false;
      location.href = mailto(d);
    } finally { btn.disabled = false; }
  });
}
