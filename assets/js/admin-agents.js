/**
 * /admin/ → Agentes → «Agentes autónomos» (solo dueño).
 * Estado en vivo, «Hacer trabajar ahora», pausa / reanudar / parada de emergencia, qué hizo cada agente
 * (con enlaces a commits y PR) y propuestas pendientes con Aprobar / Rechazar.
 * Todo pasa por worker-v2 con la cuenta de GitHub conectada del dueño; ningún token llega al navegador.
 */
import { h, icon, esc, toast, confirmDialog, timeAgo } from './ui.js';
import { CONFIG } from './config.js';

const KIND_LABEL = {
  'auto-publish': ['Publicó solo', 'ok'], 'smoke-ok': ['Verificado en vivo', 'ok'], revert: ['Se deshizo solo', 'danger'], pr: ['Propuesta', 'gold'],
  'no-change': ['Sin cambios', ''], skip: ['Descartado', ''], 'dry-run': ['Ensayo', ''], error: ['Error', 'danger'], 'manual-run': ['Pedido manual', 'gold'],
  approve: ['Aprobada', 'ok'], reject: ['Rechazada', ''], state: ['Estado', 'warn'], run: ['Ronda', '']
};
const STATE = { activo: ['Activos', 'ok', 'Trabajan solos según su horario.'], pausado: ['En pausa', 'warn', 'No empiezan trabajos nuevos.'], detenido: ['Detenidos', 'danger', 'Parada de emergencia: no corre nada.'] };
const RUN_STATUS = (r) => (r.status !== 'completed' ? ['Trabajando ahora', 'gold'] : r.conclusion === 'success' ? ['Terminó bien', 'ok'] : r.conclusion === 'cancelled' ? ['Cancelada', ''] : ['Con error', 'danger']);
const ago = (iso) => { const t = Date.parse(iso); return t ? timeAgo(new Date(t)) : ''; };

/** Opciones de ruta (ref) para pruebas: no se exponen en la interfaz. */
export async function renderAutonomy(box, user, { base = String(CONFIG.API_BASE || '').replace(/\/+$/, ''), extraHeaders = null } = {}) {
  const call = async (path, { method = 'GET', body } = {}) => {
    const headers = extraHeaders ? { ...extraHeaders } : { Authorization: 'Bearer ' + (await user.getIdToken()) };
    if (body) headers['Content-Type'] = 'application/json';
    const r = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(({ forbidden_role: 'Tu rol no permite esta acción.', outside_area: 'Solo puedes actuar sobre los agentes de tu área.', session_expired: 'Tu sesión venció: entra de nuevo.' })[j.error] || j.error || 'error_' + r.status); e.code = j.error; throw e; }
    return j;
  };
  const section = h('section', { class: 'card panel wide agx', 'aria-labelledby': 'agx-title' });
  box.prepend(section);
  const draw = async () => {
    section.innerHTML = '';
    section.append(h('div', { class: 'panel-head' }, h('h2', { id: 'agx-title' }, 'Agentes autónomos'),
      h('button', { class: 'btn btn-sm btn-ghost', type: 'button', html: icon('refresh') + 'Actualizar', onclick: draw })));
    section.append(h('div', { class: 'skeleton', style: 'height:120px' }));
    let d;
    try { d = await call('/api/admin/agents/overview'); }
    catch (e) {
      section.lastChild.remove();
      section.append(h('div', { class: 'alert warn' }, h('span', { html: icon('warn') }), h('div', {}, 'No se pudo leer el estado de los agentes (', esc(e.code || e.message), '). Revisa tu sesión o el servidor.')));
      return;
    }
    section.lastChild.remove();
    const [sl, sc, sd] = STATE[d.state] || STATE.activo;
    const running = d.runs.filter((r) => r.status !== 'completed');
    // Estado
    section.append(h('div', { class: `state-banner ${sc}`, role: 'status' }, h('span', { class: 'dot' }),
      h('div', {}, h('strong', {}, `Agentes: ${sl}`), h('span', {}, ` · ${sd}${running.length ? ` · ${running.length} trabajando ahora` : ''}`)),
      d.updatedAt ? h('span', { class: 'tiny', style: 'margin-left:auto' }, `${d.updatedBy || ''} · ${ago(d.updatedAt)}`) : null));
    if (!d.github) section.append(h('div', { class: 'alert warn' }, h('span', { html: icon('warn') }), h('div', {}, 'Falta tu cuenta de GitHub conectada (Centro de control → Conectores → GitHub, con la cuenta agenticuantico). Sin ella no se pueden lanzar rondas ni aprobar propuestas.')));
    if (!d.llm) section.append(h('div', { class: 'alert warn' }, h('span', { html: icon('warn') }), h('div', {}, 'El modelo de IA gratis no está configurado en el servidor.')));
    // Cifras del día
    const kpi = (label, value, sub, ic) => h('div', { class: 'kpi' }, h('span', { class: 'kpi-ic', html: icon(ic) }), h('div', {}, h('small', {}, label), h('strong', {}, value), sub ? h('span', { class: 'muted tiny' }, sub) : null));
    section.append(h('div', { class: 'kpis kpis-4 agx-kpis' },
      kpi('Publicados solos hoy', `${d.today.autoPublished} de ${d.limits.autoPerDay}`, 'arreglos chicos verificados', 'check'),
      kpi('Propuestas pendientes', String(d.pending.length), 'esperan tu OK', 'flag'),
      kpi('Consultas al modelo hoy', `${d.today.llmCalls} de ${d.limits.llmPerDay}`, 'cupo gratis', 'spark'),
      kpi('Última ronda', d.runs[0] ? ago(d.runs[0].createdAt) : '—', d.runs[0] ? RUN_STATUS(d.runs[0])[0] : 'todavía no corrió', 'clock')));
    // Controles
    const who = h('select', { class: 'select', 'aria-label': 'Qué agente trabaja' }, h('option', { value: '' }, 'Todos los agentes'),
      ...d.agents.map((a) => h('option', { value: a.id }, `${a.name}${a.auto ? '' : ' (propuestas)'}`)));
    const runBtn = h('button', { class: 'btn btn-primary', type: 'button', html: icon('bolt') + 'Hacer trabajar ahora', disabled: d.state !== 'activo' || !d.github || null });
    runBtn.onclick = async () => {
      runBtn.disabled = true;
      try { const r = await call('/api/admin/agents/run', { method: 'POST', body: { role: who.value } }); toast(`Listo: ${r.role ? 'el agente' : 'el equipo'} empieza en 1 o 2 minutos (${r.started.join(' y ')}).`, 'ok', 7000); setTimeout(draw, 4000); }
      catch (e) { toast(e.code === 'agents_pausado' || e.code === 'agents_detenido' ? 'Primero reanuda los agentes.' : 'No se pudo lanzar: ' + (e.code || e.message), 'error', 7000); runBtn.disabled = false; }
    };
    const setState = async (next) => {
      if (next === 'detenido') {
        if (!(await confirmDialog({ title: 'Parada de emergencia de los agentes', text: 'Cancela lo que esté corriendo y no deja empezar nada nuevo hasta que reanudes. ¿Continuar?', ok: 'Detener todo', danger: true }))) return;
      }
      try {
        const agents = Object.fromEntries(d.agents.map((a) => [a.id, a.on]));
        const r = await call('/api/admin/agents/state', { method: 'POST', body: { state: next, agents } });
        toast(`Agentes: ${STATE[next][0].toLowerCase()}${r.canceled ? ` · ${r.canceled} ejecuciones canceladas` : ''}`, 'ok', 6000);
        draw();
      } catch (e) { toast('No se pudo cambiar el estado: ' + (e.code || e.message), 'error', 7000); }
    };
    section.append(h('div', { class: 'agx-controls' },
      h('div', { class: 'row' }, who, runBtn),
      h('div', { class: 'row master-switch' },
        d.state === 'activo' ? h('button', { class: 'btn', type: 'button', html: icon('pause') + 'Pausar', onclick: () => setState('pausado') })
          : h('button', { class: 'btn btn-gold', type: 'button', html: icon('play') + 'Reanudar', onclick: () => setState('activo') }),
        h('button', { class: 'btn btn-danger', type: 'button', disabled: d.state === 'detenido' || null, html: icon('stop') + 'Parada de emergencia', onclick: () => setState('detenido') }))));
    section.append(h('p', { class: 'small muted' }, `Se publican solos únicamente los arreglos chicos que pasan todas las pruebas (errores de tipeo, enlaces rotos, accesibilidad y carga de imágenes): hasta ${d.limits.autoMaxFiles} archivos y ${d.limits.autoMaxLines} líneas por cambio, y ${d.limits.autoPerDay} por día. Después se revisa el sitio en vivo y, si algo falla, se deshace solo. Todo lo demás llega como propuesta para tu OK.`));
    // Agentes
    const list = h('div', { class: 'agx-agents' });
    for (const a of d.agents) {
      const toggle = h('input', { type: 'checkbox', checked: a.on || null, 'aria-label': `Encender o apagar ${a.name}` });
      toggle.onchange = async () => {
        const agents = Object.fromEntries(d.agents.map((x) => [x.id, x.id === a.id ? toggle.checked : x.on]));
        try { await call('/api/admin/agents/state', { method: 'POST', body: { state: d.state, agents } }); a.on = toggle.checked; toast(`${a.name}: ${toggle.checked ? 'encendido' : 'apagado'}`, 'ok'); }
        catch (e) { toggle.checked = !toggle.checked; toast('No se pudo guardar: ' + (e.code || e.message), 'error'); }
      };
      const last = a.last;
      const [kl, kc] = last ? KIND_LABEL[last.kind] || [last.kind, ''] : ['Sin actividad todavía', ''];
      list.append(h('article', { class: 'agx-agent' },
        h('div', { class: 'agx-agent-top' },
          h('div', {}, h('strong', {}, a.name), h('span', { class: 'chip ' + (a.auto ? 'ok' : 'gold') }, a.auto ? 'Publica arreglos chicos' : 'Solo propuestas'), h('span', { class: 'tiny muted' }, a.repo === 'AgenticWeb' ? ' · sitio' : ' · código privado')),
          h('label', { class: 'switch', title: a.on ? 'Encendido' : 'Apagado' }, toggle, h('span'))),
        h('p', { class: 'small' }, a.does),
        h('p', { class: 'tiny muted' }, a.running ? h('span', { class: 'chip gold' }, 'Trabajando ahora') : h('span', { class: 'chip ' + kc }, kl),
          last ? ` ${ago(last.at)}${last.title ? ' · ' + last.title : ''}` : '',
          last && last.url ? h('span', {}, ' · ', h('a', { href: last.url, target: '_blank', rel: 'noopener' }, 'ver')) : null)));
    }
    section.append(h('h3', {}, 'Equipo'), h('p', { class: 'tiny muted' }, `Horario: sitio ${d.schedule.AgenticWeb}; código privado ${d.schedule.AgenticDev}.`), list);
    // Propuestas pendientes
    const pend = h('div', { class: 'orders' });
    if (!d.pending.length) pend.append(h('p', { class: 'muted small' }, 'No hay propuestas esperando tu OK.'));
    for (const p of d.pending) {
      const detail = h('div', { class: 'small muted' });
      const view = h('button', { class: 'btn btn-sm btn-ghost', type: 'button' }, 'Ver cambios');
      view.onclick = async () => { try { const r = await call(`/api/admin/pr/${p.repo}/${p.number}`); detail.textContent = `${r.changedFiles} archivo(s) · +${r.additions} −${r.deletions} · ${r.files.map((f) => f.name).slice(0, 6).join(', ')}`; } catch (e) { detail.textContent = 'No se pudo leer: ' + (e.code || e.message); } };
      const ok = h('button', { class: 'btn btn-sm btn-primary', type: 'button' }, 'Aprobar');
      ok.onclick = async () => {
        if (!(await confirmDialog({ title: 'Aprobar propuesta', text: `Se publica «${p.title}» (${p.repo} #${p.number}). ¿Confirmas?`, ok: 'Aprobar y publicar' }))) return;
        try { await call(`/api/admin/pr/${p.repo}/${p.number}/approve`, { method: 'POST', body: { confirm: true } }); toast('Aprobada y publicada.', 'ok'); draw(); }
        catch (e) { toast('No se pudo aprobar: ' + (e.code || e.message), 'error', 7000); }
      };
      const no = h('button', { class: 'btn btn-sm btn-danger-ghost', type: 'button' }, 'Rechazar');
      no.onclick = async () => {
        if (!(await confirmDialog({ title: 'Rechazar propuesta', text: `Se cierra «${p.title}» sin publicar.`, ok: 'Rechazar', danger: true }))) return;
        try { await call(`/api/admin/pr/${p.repo}/${p.number}/reject`, { method: 'POST' }); toast('Rechazada.', 'ok'); draw(); }
        catch (e) { toast('No se pudo rechazar: ' + (e.code || e.message), 'error', 7000); }
      };
      pend.append(h('article', { class: 'order' },
        h('div', { class: 'row', style: 'justify-content:space-between' }, h('strong', {}, p.title), h('span', { class: 'chip gold' }, p.repo === 'AgenticWeb' ? 'Sitio' : 'Código privado')),
        h('div', { class: 'tiny muted' }, `${ago(p.createdAt)} · `, h('a', { href: p.url, target: '_blank', rel: 'noopener' }, `PR #${p.number}`)),
        detail, h('div', { class: 'row' }, view, ok, no)));
    }
    section.append(h('h3', {}, 'Propuestas pendientes'), pend);
    // Bitácora (lista: se lee bien en el teléfono)
    const rows = d.log.slice(0, 25);
    section.append(h('h3', {}, 'Qué hizo cada agente'));
    if (!rows.length) section.append(h('p', { class: 'muted small' }, 'Todavía no hay actividad registrada.'));
    else section.append(h('ul', { class: 'agx-log' }, ...rows.map((e) => {
      const [kl, kc] = KIND_LABEL[e.kind] || [e.kind, ''];
      const name = (d.agents.find((a) => a.id === e.role) || {}).name || (e.role === 'equipo' ? 'Equipo' : e.role);
      return h('li', {}, h('div', { class: 'agx-log-head' }, h('span', { class: 'chip ' + kc }, kl), h('strong', {}, name), h('span', { class: 'tiny muted' }, ago(e.at)),
        e.url ? h('a', { class: 'tiny', href: e.url, target: '_blank', rel: 'noopener' }, e.url.includes('/pull/') ? 'Ver PR' : 'Ver commit') : null),
        [e.title, e.detail].some(Boolean) ? h('p', { class: 'small' }, [e.title, e.detail].filter(Boolean).join(' · ')) : null);
    })));
    // Rondas recientes
    if (d.runs.length) section.append(h('h3', {}, 'Rondas recientes'), h('ul', { class: 'agx-log' }, ...d.runs.map((r) => {
      const [l, c] = RUN_STATUS(r);
      return h('li', {}, h('div', { class: 'agx-log-head' }, h('span', { class: 'chip ' + c }, l), h('strong', {}, r.repo === 'AgenticWeb' ? 'Sitio' : 'Código privado'),
        h('span', { class: 'tiny muted' }, `${r.event === 'schedule' ? 'por horario' : r.event === 'workflow_dispatch' ? 'pedido manual' : r.event} · ${ago(r.createdAt)}`),
        h('a', { class: 'tiny', href: r.url, target: '_blank', rel: 'noopener' }, 'Ver ronda')));
    })));
  };
  await draw();
  return { refresh: draw };
}
