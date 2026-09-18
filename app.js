const API_BASE = (window.AGENTICUANTICO_API || window.location.origin).replace(/\/$/, '');
const form = document.querySelector('#chat-form');
const prompt = document.querySelector('#prompt');
const messages = document.querySelector('#messages');
const status = document.querySelector('#chat-status');
const history = [];

function addMessage(role, text) {
  const item = document.createElement('div');
  item.className = `message ${role}`;
  const name = role === 'user' ? 'Tú' : 'AgentiCuantico';
  item.innerHTML = `<b>${name}</b><p></p>`;
  item.querySelector('p').textContent = text;
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
}

function setBusy(busy) {
  prompt.disabled = busy;
  form.querySelector('button').disabled = busy;
  status.textContent = busy ? 'Pensando…' : 'Listo';
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = prompt.value.trim();
  if (!text || prompt.disabled) return;

  addMessage('user', text);
  prompt.value = '';
  setBusy(true);

  try {
    const response = await fetch(`${API_BASE}/v1/conversations/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

    const answer = data.message || 'No se recibió una respuesta.';
    addMessage('assistant', answer);
    history.push({ role: 'user', content: text }, { role: 'assistant', content: answer });
    while (history.length > 12) history.shift();
    status.textContent = 'Respuesta recibida';
  } catch (error) {
    addMessage('assistant', 'No pude procesar tu mensaje en este momento. Intentá nuevamente.');
    status.textContent = 'Servicio no disponible';
    console.error('Chat request failed:', error);
  } finally {
    setBusy(false);
  }
});
