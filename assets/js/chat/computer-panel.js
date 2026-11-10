/**
 * Panel del botón «Ordenador» del chat: explica el ordenador virtual y ofrece tareas de ejemplo para no depender
 * de frases mágicas. Sin cuenta muestra «Ingresa con tu cuenta» (la sesión del ordenador es privada de cada cuenta).
 * Las frases «…en el ordenador» / «usa el ordenador» siguen funcionando igual.
 */
import { h, icon, modal } from '../ui.js';

/** Tareas de ejemplo por idioma del chat (lo que se manda es exactamente lo que se ve). */
export const COMPUTER_TASKS = {
  'es-AR': [
    ['globe', 'Busca el pronóstico de hoy para Bahía Blanca'],
    ['briefcase', 'Busca ofertas de empleo remoto de atención al cliente y ármame una lista con enlaces'],
    ['search', 'Compara precios de un monitor de 24 pulgadas en Mercado Libre'],
    ['file', 'Entra a agenticuantico.dev.ar/planes.html y resúmeme los planes'],
  ],
  'es-ES': [
    ['globe', 'Busca la previsión de hoy para Madrid'],
    ['briefcase', 'Busca ofertas de empleo remoto de atención al cliente y hazme una lista con enlaces'],
    ['search', 'Compara precios de un monitor de 24 pulgadas en tiendas online'],
    ['file', 'Entra en agenticuantico.dev.ar/planes.html y resúmeme los planes'],
  ],
  'en-US': [
    ['globe', 'Look up today’s weather forecast for New York'],
    ['briefcase', 'Find remote customer support job openings and give me a list with links'],
    ['search', 'Compare prices for a 24-inch monitor in online stores'],
    ['file', 'Open agenticuantico.dev.ar/planes.html and summarize the plans'],
  ],
  'pt-BR': [
    ['globe', 'Veja a previsão do tempo de hoje para São Paulo'],
    ['briefcase', 'Procure vagas remotas de atendimento ao cliente e me passe uma lista com links'],
    ['search', 'Compare preços de um monitor de 24 polegadas em lojas online'],
    ['file', 'Abra agenticuantico.dev.ar/planes.html e resuma os planos'],
  ],
};

export function tasksFor(langId) { return COMPUTER_TASKS[langId] || COMPUTER_TASKS['es-AR']; }

/** @param {any} chat instancia de ChatApp (usa chat.user, chat.lang, chat.sendToComputer, chat.forceNext) */
export function openComputerPanel(chat) {
  const body = h('div', { class: 'pc-panel' });
  body.append(h('p', { class: 'pc-lead' }, 'Un navegador en la nube que abre páginas, busca y completa pasos por ti mientras miras la pantalla en vivo.'));
  if (!chat.user) {
    body.append(
      h('div', { class: 'pc-login' },
        h('span', { class: 'pc-login-ic', html: icon('user') }),
        h('div', {}, h('strong', {}, 'Ingresa con tu cuenta'), h('p', { class: 'muted small' }, 'El ordenador virtual se abre con tu cuenta, así tu sesión es privada y nadie más la ve. Crear la cuenta es gratis.'))),
      h('ul', { class: 'pc-rules' },
        h('li', {}, 'Antes de comprar, pagar, enviar, publicar o postularse, te pide aprobación.'),
        h('li', {}, 'Si un sitio pide iniciar sesión, lo cargas en un formulario seguro: el modelo de IA no ve tu contraseña.')));
    return modal({ title: 'Ordenador virtual', body, label: 'Ordenador virtual', actions: [
      { label: 'Ahora no', class: 'btn-ghost' },
      { label: 'Ingresa con tu cuenta', class: 'btn-primary', onClick: () => { location.href = '/cuenta/'; } },
    ] });
  }
  let ref;
  const list = h('div', { class: 'pc-tasks', role: 'list' });
  for (const [ic, t] of tasksFor(chat.lang && chat.lang.id)) {
    list.append(h('button', { class: 'pc-task', type: 'button', role: 'listitem', 'data-no-i18n': '', onclick: () => { ref && ref.close(); chat.sendToComputer(t); } },
      h('span', { class: 'pc-task-ic', html: icon(ic) }), h('span', { class: 'pc-task-t' }, t), h('span', { class: 'pc-task-go', html: icon('arrowRight') })));
  }
  body.append(h('p', { class: 'pc-h' }, 'Prueba con una de estas tareas'), list,
    h('ul', { class: 'pc-rules' },
      h('li', {}, 'Antes de comprar, pagar, enviar, publicar o postularse, te pide aprobación.'),
      h('li', {}, 'Si un sitio pide iniciar sesión, aparece un formulario seguro: el modelo de IA no ve tu contraseña.'),
      h('li', {}, 'Usa minutos de ordenador por día según tu plan; la tarjeta te muestra cuántos te quedan.')));
  ref = modal({ title: 'Ordenador virtual', body, label: 'Ordenador virtual', actions: [
    { label: 'Cerrar', class: 'btn-ghost' },
    { label: 'Escribir mi tarea', class: 'btn-primary', onClick: () => {
      chat.forceNext = 'computer'; chat.renderMode();
      setTimeout(() => chat.$('input').focus({ preventScroll: false }), 50);
    } },
  ] });
  return ref;
}
