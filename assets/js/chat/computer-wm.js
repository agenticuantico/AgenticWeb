/**
 * Ordenador virtual · gestor de ventanas del escritorio (cálculos sin DOM, se prueban con vitest).
 * Rectángulos en píxeles relativos al área del escritorio (sin la barra de tareas): { x, y, w, h }.
 *  - Escritorio angosto (celular, tarjeta chica): todas las ventanas se abren a pantalla completa (modo compacto).
 *  - Escritorio ancho (compu, tablet): ventanas movibles y redimensionables que nunca salen del escritorio.
 */

/** Por debajo de este ancho del escritorio, las ventanas ocupan todo (celular). */
export const COMPACT_W = 700;
/** Tamaño mínimo de una ventana. */
export const MIN_WIN = Object.freeze({ w: 300, h: 220 });
/** Ancho reservado a la columna de íconos cuando la ventana del navegador se abre al lado. */
export const ICONS_W = 100;

const clamp = (n, a, b) => Math.min(Math.max(n, a), Math.max(a, b));
const num = (n, d = 0) => (Number.isFinite(Number(n)) ? Number(n) : d);

/** ¿Escritorio angosto? (ventanas siempre a pantalla completa, sin arrastrar). */
export function isCompact(width) { return num(width) < COMPACT_W; }

/** Mantiene la ventana dentro del escritorio y con el tamaño mínimo (si el escritorio es más chico, lo llena). */
export function clampRect(r, bounds, min = MIN_WIN) {
  const bw = Math.max(0, num(bounds && bounds.w)), bh = Math.max(0, num(bounds && bounds.h));
  const w = Math.round(clamp(num(r && r.w, min.w), Math.min(min.w, bw), bw));
  const h = Math.round(clamp(num(r && r.h, min.h), Math.min(min.h, bh), bh));
  const x = Math.round(clamp(num(r && r.x), 0, bw - w));
  const y = Math.round(clamp(num(r && r.y), 0, bh - h));
  return { x, y, w, h };
}

/** Arrastre por la barra de título. */
export function dragRect(start, dx, dy, bounds) {
  return clampRect({ ...start, x: num(start.x) + num(dx), y: num(start.y) + num(dy) }, bounds);
}

/**
 * Cambio de tamaño desde un borde o esquina: 'e' (derecha), 's' (abajo), 'se' (esquina), 'w' (izquierda), 'sw'.
 * El borde opuesto queda quieto; respeta el mínimo y el escritorio.
 */
export function resizeRect(start, dx, dy, bounds, edge = 'se', min = MIN_WIN) {
  const bw = num(bounds.w), bh = num(bounds.h);
  let { x, y, w, h } = { x: num(start.x), y: num(start.y), w: num(start.w), h: num(start.h) };
  if (edge.includes('e')) w = clamp(w + num(dx), min.w, bw - x);
  if (edge.includes('s')) h = clamp(h + num(dy), min.h, bh - y);
  if (edge.includes('w')) { const right = x + w; const nx = clamp(x + num(dx), 0, right - min.w); w = right - nx; x = nx; }
  return clampRect({ x, y, w, h }, bounds, min);
}

/**
 * Lugar inicial de cada ventana. El navegador ocupa el escritorio al lado de los íconos; las demás se abren
 * escalonadas (n = cuántas ventanas hay abiertas) para que no queden una exactamente encima de otra.
 */
export function defaultRect(id, bounds, n = 0) {
  const bw = num(bounds.w), bh = num(bounds.h);
  if (id === 'browser') return clampRect({ x: ICONS_W, y: 10, w: bw - ICONS_W - 12, h: bh - 20 }, bounds);
  const w = Math.min(560, Math.max(MIN_WIN.w, Math.round(bw * 0.5)));
  const h = Math.min(440, Math.max(MIN_WIN.h, Math.round(bh * 0.7)));
  const step = 28 * (num(n) % 6);
  return clampRect({ x: Math.round(bw * 0.22) + step, y: 24 + step, w, h }, bounds);
}

/** Orden de apilado: la ventana activa va arriba de todo. Devuelve el nuevo orden (último = arriba). */
export function raise(order, id) {
  const list = (Array.isArray(order) ? order : []).filter((x) => x !== id);
  list.push(id);
  return list;
}

/** Ventana activa = la de más arriba que no está minimizada. */
export function activeWindow(order, wins) {
  for (let i = order.length - 1; i >= 0; i--) { const w = wins[order[i]]; if (w && w.open && !w.min) return order[i]; }
  return '';
}

/** Fecha corta para la barra de tareas («mar 10/11»). */
export function dateLabel(d, lang = 'es') {
  try {
    const wd = d.toLocaleDateString(lang, { weekday: 'short' }).replace('.', '');
    const dm = d.toLocaleDateString(lang, { day: '2-digit', month: '2-digit' });
    return `${wd} ${dm}`;
  } catch { return ''; }
}

/**
 * Por qué se ve la «Vista de lectura» (texto de la página) y no una captura real. Honesto según el estado:
 *  - sin minutos de navegador real hoy (light_fallback / cupo);
 *  - todos los navegadores ocupados (fila);
 *  - el servicio de navegador no respondió;
 *  - o, simplemente, el agente leyó la página como texto porque no hacía falta hacer clics.
 * Devuelve null en modo navegador real.
 */
export function readingNote(s) {
  if (!s || s.mode === 'browser') return null;
  if (s.status === 'queued') return { kind: 'wait', title: 'Vista de lectura', text: 'Todos los navegadores en la nube están ocupados. Mientras tanto muestro el texto de la página; la captura real aparece apenas se libere uno.' };
  const left = Math.max(num(s.browserLeftMs), num(s.remoteLeftMs));
  const noMinutes = s.notice === 'light_fallback' || s.browserBlocked === 'user_quota' || s.browserBlocked === 'global_quota' || (typeof s.browserLeftMs === 'number' && left <= 0);
  if (noMinutes) return { kind: 'quota', title: 'Vista de lectura', text: 'Hoy ya se usaron los minutos de navegador real. Muestro el texto de la página (no una captura) y sigo trabajando así. Los minutos se renuevan mañana.' };
  if (s.browserBlocked === 'unavailable') return { kind: 'off', title: 'Vista de lectura', text: 'El navegador en la nube no respondió. Muestro el texto de la página (no una captura) y sigo trabajando así.' };
  return { kind: 'info', title: 'Vista de lectura', text: 'Leo esta página como texto porque es más rápido y no gasta minutos. Abro el navegador real, con captura en vivo, cuando hace falta hacer clic, completar un formulario o iniciar sesión.' };
}
