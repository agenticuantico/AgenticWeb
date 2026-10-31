/** /compartido/?id=…: muestra una conversación compartida en modo solo lectura (Firestore shares/{id}). */
import { h, esc } from './ui.js';
import { getStore, friendlyError } from './firebase.js';
import { renderMarkdown } from './chat/md.js';

const root = document.getElementById('shareRoot');
const id = (new URLSearchParams(location.search).get('id') || '').replace(/[^a-z0-9]/gi, '').slice(0, 40);
(async () => {
  if (!id) { root.innerHTML = '<h1>Enlace incompleto</h1><p class="muted">Pedile a quien te lo compartió que te reenvíe el enlace.</p>'; return; }
  try {
    const { fs, db } = await getStore();
    const s = await fs.getDoc(fs.doc(db, 'shares', id));
    if (!s.exists()) { root.innerHTML = '<h1>Conversación no disponible</h1><p class="muted">El enlace venció o su autor dejó de compartirla.</p>'; return; }
    const d = s.data();
    document.title = `${d.title} · AgentiCuántico`;
    root.innerHTML = '';
    root.append(h('p', { class: 'eyebrow' }, 'Conversación compartida · solo lectura'), h('h1', { style: 'font-size:var(--fs-2xl)' }, d.title));
    const thread = h('div', { class: 'thread-inner', style: 'margin-top:24px' });
    for (const m of d.messages || []) {
      if (m.role === 'user') thread.append(h('div', { class: 'msg user' }, h('div', { class: 'bubble' }, m.kind === 'voice' ? '🎙️ ' + (m.transcript || m.content || 'Nota de voz') : m.content)));
      else if (m.role === 'assistant') {
        const body = h('div', { class: 'md' }); body.innerHTML = renderMarkdown(m.content, { codeActions: false });
        thread.append(h('div', { class: 'msg assistant' }, h('div', { class: 'msg-who' }, h('strong', {}, m.agent ? m.agent.name : 'AgentiCuántico')), h('div', { class: 'msg-body' }, body)));
      }
    }
    root.append(thread, h('div', { class: 'band', style: 'margin-top:40px' }, h('div', {}, h('h2', {}, 'Probá AgentiCuántico'), h('p', {}, 'Chateá, hablá con el avatar y dejá que el agente haga el trabajo.')), h('div', {}, h('a', { class: 'btn btn-lg', href: '/app/' }, 'Abrir el chat'))));
  } catch (e) { root.innerHTML = `<h1>No se pudo abrir</h1><p class="muted">${esc(friendlyError(e))}</p>`; }
})();
