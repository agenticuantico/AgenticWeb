/**
 * Tarjetas del chat con herramientas:
 *  - pasos (qué herramienta se usó y si salió bien),
 *  - ofertas de empleo rankeadas con «Preparar CV y carta»,
 *  - borradores (CV + carta) para revisar, copiar y postular,
 *  - confirmación «Confirmar / Cancelar» para TODA acción que crea, envía o publica algo.
 * La tarjeta de confirmación muestra exactamente lo que guardó el servidor (no lo que el modelo dijo).
 */
import { h, icon, toast } from '../ui.js';
import { call, errorText } from '../account/api.js';
import { startConnect } from '../account/oauth-connect.js';
import { applyCard } from './apply-card.js';

/* ------------------- «Conectá X para seguir» (cuenta que falta) ------------------- */
const NEED_LOGO = { github: 'github', google: 'google', linkedin: 'linkedin', cloudflare: 'cloudflare' };
export function needCard(n, m) {
  const state = h('p', { class: 'tc-state', role: 'status', 'aria-live': 'polite' });
  const title = n.state === 'disabled' ? `Activá ${n.label} para seguir` : n.state === 'expired' ? `Reconectá ${n.label} para seguir` : `Conectá ${n.label} para seguir`;
  const sub = n.state === 'disabled' ? 'Está conectada pero apagada para el chat.' : n.state === 'expired' ? 'El permiso venció.' : 'Se abre la pantalla de permiso y volvés acá.';
  const btnLabel = n.state === 'disabled' ? 'Activar en el chat' : n.state === 'expired' ? `Reconectar ${n.label}` : `Conectar ${n.label}`;
  const btn = h('button', { class: 'btn btn-sm btn-primary', type: 'button' }, btnLabel);
  const logo = h('span', { class: 'tc-need-logo', html: icon('plug') });
  import('../account/connections.js').then((mod) => { if (mod.LOGOS && mod.LOGOS[NEED_LOGO[n.provider]]) logo.innerHTML = mod.LOGOS[NEED_LOGO[n.provider]]; }).catch(() => {});
  const card = h('div', { class: 'tc-need', role: 'group', 'aria-label': title },
    h('div', { class: 'tc-need-h' }, logo, h('div', {}, h('strong', {}, title), h('small', {}, sub))),
    h('p', {}, 'Retomo tu pedido apenas esté lista. Nada se envía ni se publica sin tu «Confirmar».'),
    h('div', { class: 'tc-acts' }, btn), state);
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const text = (m && m.tools && m.tools.resumeText) || '';
    try {
      if (n.state === 'disabled') {
        await call(`/api/connectors/${n.provider}/chat`, { method: 'POST', body: { enabled: true } });
        card.classList.add('done'); btn.remove(); state.textContent = `${n.label} activada. Sigo con tu pedido…`;
        if (text) document.dispatchEvent(new CustomEvent('ac:resume-request', { detail: { text } }));
        return;
      }
      state.textContent = `Abriendo ${n.label}…`;
      const r = await startConnect(n.provider, { resume: { chatId: m && m.tools ? m.tools.chatId : null, text } });
      if (r.mode === 'device' && r.userCode) { state.textContent = `Abrí ${r.verificationUri} y escribí el código ${r.userCode}.`; window.open(r.verificationUri, '_blank', 'noopener'); btn.disabled = false; }
    } catch (e) { state.textContent = errorText(e); btn.disabled = false; }
  });
  return card;
}

/* ---------------------------- Confirmación ---------------------------- */
export function confirmCard(action, { onDone } = {}) {
  const pv = action.preview || {};
  const state = h('p', { class: 'tc-state', role: 'status', 'aria-live': 'polite' });
  const ok = h('button', { class: 'btn btn-sm btn-primary', type: 'button' }, h('span', { html: icon('check') }), 'Confirmar');
  const no = h('button', { class: 'btn btn-sm btn-ghost', type: 'button' }, 'Cancelar');
  const acts = h('div', { class: 'tc-acts' }, ok, no);
  const card = h('div', { class: 'tc-confirm', role: 'group', 'aria-label': `Confirmación: ${pv.title || action.label}` },
    h('div', { class: 'tc-confirm-h' }, h('span', { class: 'tc-lock', html: icon('shield') }), h('div', {}, h('strong', {}, pv.title || action.label), h('small', {}, 'Necesita tu confirmación'))),
    pv.summary ? h('p', { class: 'tc-sum' }, pv.summary) : null,
    pv.fields && pv.fields.length ? h('dl', { class: 'tc-fields' }, ...pv.fields.flatMap((f) => [h('dt', {}, f.label), h('dd', {}, f.value)])) : null,
    pv.body ? h('pre', { class: 'tc-body', tabindex: '0', 'aria-label': 'Contenido' }, pv.body) : null,
    acts, state);
  const finish = (txt, tone) => { acts.remove(); state.textContent = txt; card.classList.add(tone); onDone && onDone(); };
  if (action.status && action.status !== 'pending') finish(statusText(action), action.status === 'confirmed' ? 'done' : 'off');
  async function decide(decision) {
    ok.disabled = no.disabled = true;
    state.textContent = decision === 'confirm' ? 'Haciéndolo…' : 'Cancelando…';
    try {
      const r = await call(`/api/tools/actions/${action.id}`, { method: 'POST', body: { decision } });
      action.status = r.action.status; action.result = r.action.result;
      finish(statusText(r.action), r.action.status === 'confirmed' ? 'done' : 'off');
      if (r.action.status === 'confirmed') toast('Listo.', 'ok');
    } catch (e) {
      if (e.code === 'action_already_decided' || e.code === 'action_expired') { action.status = e.code === 'action_expired' ? 'expired' : 'decided'; finish(errorText(e), 'off'); return; }
      state.textContent = errorText(e); ok.disabled = no.disabled = false;
    }
  }
  ok.addEventListener('click', () => decide('confirm'));
  no.addEventListener('click', () => decide('cancel'));
  return card;
}

function statusText(a) {
  if (a.status === 'confirmed') {
    const r = a.result || {};
    const url = r.url || (r.commit && r.commit.url);
    return url ? `Hecho. ${url}` : 'Hecho.';
  }
  return ({ cancelled: 'Cancelado: no se hizo nada.', expired: 'Venció sin confirmar: no se hizo nada.', failed: 'No se pudo completar. No se envió ni publicó nada.', decided: 'Ya se decidió antes.' })[a.status] || '';
}

/* ------------------------------- Pasos ------------------------------- */
export function stepsList(steps) {
  if (!steps || !steps.length) return null;
  return h('ul', { class: 'tc-steps', 'aria-label': 'Herramientas usadas' }, ...steps.map((s) => {
    const wait = s.ok && /confirmaci/.test(s.note || '');
    return h('li', { class: wait ? 'wait' : s.ok ? 'ok' : 'err' },
      h('span', { class: 'tc-st', html: icon(wait ? 'clock' : s.ok ? 'check' : 'close') }), h('span', {}, s.label), s.note ? h('small', {}, ` · ${s.note}`) : null);
  }));
}

/* ------------------------------ Empleo ------------------------------ */
const when = (iso) => {
  if (!iso) return '';
  const d = Math.round((Date.now() - Date.parse(iso)) / 86_400_000);
  return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`;
};

export function offerCard(o, { onDraft } = {}) {
  const score = Math.max(0, Math.min(100, o.score | 0));
  const draftBtn = h('button', { class: 'btn btn-sm btn-primary', type: 'button' }, h('span', { html: icon('edit') }), 'Preparar CV y carta');
  const slot = h('div', { class: 'tc-slot' });
  draftBtn.addEventListener('click', async () => {
    draftBtn.disabled = true; draftBtn.lastChild.textContent = 'Preparando…';
    try {
      const r = await call(`/api/jobs/offers/${o.id}/draft`, { method: 'POST', body: {} });
      slot.innerHTML = ''; slot.append(draftsCard(r));
      draftBtn.remove();
      onDraft && onDraft(r);
    } catch (e) { toast(errorText(e), 'warn', 6000); draftBtn.disabled = false; draftBtn.lastChild.textContent = 'Preparar CV y carta'; }
  });
  return h('article', { class: 'tc-offer' },
    h('div', { class: 'tc-offer-top' },
      h('span', { class: 'tc-score', style: `--p:${score}`, role: 'img', 'aria-label': `Encaje ${score} de 100` }, h('b', {}, String(score))),
      h('div', { class: 'tc-offer-t' },
        h('strong', {}, o.title),
        h('small', {}, [o.company, o.location].filter(Boolean).join(' · ')))),
    o.reasons && o.reasons.length ? h('ul', { class: 'tc-tags' }, ...o.reasons.map((r) => h('li', { class: 'good' }, r))) : null,
    o.warnings && o.warnings.length ? h('ul', { class: 'tc-tags' }, ...o.warnings.map((r) => h('li', { class: 'warn' }, r))) : null,
    h('p', { class: 'tc-src' }, `Vía ${o.source}${o.publishedAt ? ' · ' + when(o.publishedAt) : ''}${o.salary ? ' · ' + o.salary : ''}`),
    h('div', { class: 'tc-acts' }, draftBtn, h('a', { class: 'btn btn-sm', href: o.url, target: '_blank', rel: 'noopener noreferrer nofollow' }, h('span', { html: icon('external') }), 'Ver oferta')),
    slot);
}

export function draftsCard(r) {
  const d = r.drafts, o = r.offer, apply = r.apply || {};
  const cv = h('textarea', { class: 'textarea tc-ta', rows: 4, 'aria-label': 'Resumen de CV' }, d.cvSummary);
  const letter = h('textarea', { class: 'textarea tc-ta', rows: 9, 'aria-label': 'Carta de presentación' }, d.coverLetter);
  const copy = (ta, what) => h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => navigator.clipboard.writeText(ta.value).then(() => toast(`${what} copiado.`)) }, h('span', { html: icon('copy') }), 'Copiar');
  const slot = h('div', { class: 'tc-slot' });
  const acts = h('div', { class: 'tc-acts' },
    h('a', { class: 'btn btn-sm btn-primary', href: apply.url || o.url, target: '_blank', rel: 'noopener noreferrer nofollow', onclick: () => { call(`/api/jobs/offers/${o.id}/apply`, { method: 'POST', body: { method: 'link' } }).catch(() => {}); } }, h('span', { html: icon('external') }), 'Postular en la oferta'));
  if (apply.email) {
    acts.append(h('button', { class: 'btn btn-sm', type: 'button', onclick: async (e) => {
      e.currentTarget.disabled = true;
      try {
        const res = await call(`/api/jobs/offers/${o.id}/apply`, { method: 'POST', body: { method: 'email', to: apply.email, subject: d.subject, body: `${letter.value}\n\n---\n${cv.value}` } });
        slot.innerHTML = ''; slot.append(confirmCard(res.action));
      } catch (err) { toast(errorText(err), 'warn', 6000); e.currentTarget.disabled = false; }
    } }, h('span', { html: icon('mail') }), `Enviar por Gmail a ${apply.email}`));
  }
  return h('div', { class: 'tc-drafts' },
    h('p', { class: 'tc-drafts-h' }, h('strong', {}, 'Borradores para revisar'), h('small', {}, d.generatedBy === 'ia' ? 'Hechos con IA a partir de tu perfil. Revisalos antes de usarlos.' : 'Plantilla a partir de tu perfil (la IA no estaba disponible). Revisala y completala.')),
    h('div', { class: 'tc-draft' }, h('div', { class: 'tc-draft-h' }, h('span', {}, 'Resumen de CV'), copy(cv, 'Resumen')), cv),
    h('div', { class: 'tc-draft' }, h('div', { class: 'tc-draft-h' }, h('span', {}, `Carta · Asunto: ${d.subject}`), copy(letter, 'Carta')), letter),
    apply.note ? h('p', { class: 'tc-note' }, apply.note) : null,
    h('p', { class: 'tc-note' }, 'AgentiCuántico nunca postula solo: abrís la oferta y enviás vos, o confirmás el correo.'),
    acts, slot);
}

/* --------------------- Bloque completo para un mensaje --------------------- */
const blocks = new WeakMap();
/** Las tarjetas también pueden aparecer en el chat de la portada: se carga la hoja de estilos si falta. */
function ensureCss() {
  if (!document.querySelector('link[href*="account-area.css"]')) document.head.append(h('link', { rel: 'stylesheet', href: '/assets/css/account-area.css?v=1.0.0', 'data-acc-css': '' }));
}
/** Un solo nodo por mensaje (se conserva entre redibujos del chat). */
export function toolBlock(m) {
  if (blocks.has(m)) return blocks.get(m);
  ensureCss();
  const t = m.tools || {};
  const el = h('div', { class: 'tc-block' });
  const steps = stepsList(t.steps);
  if (steps) el.append(steps);
  const offers = t.jobs && Array.isArray(t.jobs.offers) ? t.jobs.offers : [];
  if (offers.length) el.append(h('div', { class: 'tc-offers' }, ...offers.slice(0, 6).map((o) => offerCard(o))));
  if (t.drafts && t.drafts.drafts) el.append(draftsCard(t.drafts));
  for (const n of t.needs || []) el.append(needCard(n, m));
  if (t.batch && t.batch.batch) el.append(applyCard(m));
  for (const a of t.actions || []) el.append(confirmCard(a, { onDone: () => { m.tools.actions = (m.tools.actions || []).map((x) => (x.id === a.id ? { ...x, status: a.status } : x)); } }));
  blocks.set(m, el);
  return el;
}

/** ¿El pedido es para las herramientas con cuentas (correo, GitHub, Cloudflare, LinkedIn, empleo)? */
export function wantsTools(text) {
  // Las direcciones web no cuentan («…workers.dev/…» no es un pedido sobre Cloudflare Workers).
  const t = String(text || '').replace(/\bhttps?:\/\/\S+/gi, ' ');
  return /(\bgmail\b|\b(mis|mi|los|el) (e-?mails?|mails?|correos?)\b|\binbox\b|mis correos|mi correo|mail(s)? nuevos|bandeja|borrador de correo|mand[aá](le|me)? (un|el) (correo|mail)|\bgithub\b|\brepo(s|sitorio)?s?\b|\bissue\b|\bcommit\b|\bcloudflare\b|\bworkers?\b|\blinkedin\b|public[aá] en|(busc|encontr)\S*\s[^.?!]{0,40}(trabajo|empleo|ofertas?|vacantes?|laburo)|ofertas? de (trabajo|empleo)|\bpostul)/i.test(t);
}
