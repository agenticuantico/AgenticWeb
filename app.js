const API_BASE = window.AGENTICUANTICO_API || '';
const form = document.querySelector('#chat-form');
const prompt = document.querySelector('#prompt');
const messages = document.querySelector('#messages');
const status = document.querySelector('#chat-status');

function addMessage(role, text) {
  const item = document.createElement('div');
  item.className = `message ${role}`;
  const name = role === 'user' ? 'Tú' : 'AgentiCuantico';
  item.innerHTML = `<b>${name}</b><p></p>`;
  item.querySelector('p').textContent = text;
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = prompt.value.trim();
  if (!text) return;

  addMessage('user', text);
  prompt.value = '';
  status.textContent = 'Procesando tu objetivo…';

  if (!API_BASE) {
    addMessage('assistant', 'La conexión todavía no está disponible. Intentá nuevamente más tarde.');
    status.textContent = 'Servicio temporalmente no disponible';
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/v1/conversations/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    addMessage('assistant', data.message || data.output || 'Se recibió una respuesta sin texto.');
    status.textContent = 'Respuesta recibida';
  } catch (error) {
    addMessage('assistant', 'No pudimos procesar tu solicitud en este momento. Intentá nuevamente.');
    status.textContent = 'No se pudo completar la solicitud';
    console.error('Request failed:', error);
  }
});
