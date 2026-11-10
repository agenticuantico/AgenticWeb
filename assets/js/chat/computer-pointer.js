/**
 * Ordenador virtual · puntero (sin DOM, se prueba con vitest).
 * Cálculos para dibujar el mouse, el clic, el campo donde se escribe y el desplazamiento SOBRE la captura que se ve.
 * Regla de honestidad: solo se dibuja lo que el servidor registró como acción real del navegador (pointer.ts del
 * worker): coordenadas medidas por el navegador, sobre la misma captura que se está mostrando, y nunca un clic que
 * falló. Sin coordenadas o con otra captura en pantalla, solo se muestra el texto del paso.
 */

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const r2 = (n) => Math.round(n * 100) / 100;

/**
 * Rectángulo donde queda dibujada la captura (nat = tamaño real; box = tamaño de la pantalla) con object-fit.
 * @param {{w:number,h:number}} nat @param {{w:number,h:number}} box @param {'cover'|'contain'} fit
 * @param {number} posY 0 = arriba, 1 = abajo (object-position) @param {number} [posX] 0..1
 */
export function fitRect(nat, box, fit, posY = 0, posX = 0.5) {
  if (!nat || !box || !(nat.w > 0) || !(nat.h > 0) || !(box.w > 0) || !(box.h > 0)) return { left: 0, top: 0, width: box?.w || 0, height: box?.h || 0 };
  const s = fit === 'cover' ? Math.max(box.w / nat.w, box.h / nat.h) : Math.min(box.w / nat.w, box.h / nat.h);
  const width = nat.w * s, height = nat.h * s;
  return { left: r2((box.w - width) * clamp(posX, 0, 1)), top: r2((box.h - height) * clamp(posY, 0, 1)), width: r2(width), height: r2(height) };
}

/** Punto 0..1 de la captura → píxeles dentro de la pantalla (y si se ve). */
export function toView(pt, rect, box) {
  const x = r2(rect.left + pt.x * rect.width), y = r2(rect.top + pt.y * rect.height);
  const bw = box ? box.w : rect.left * 2 + rect.width, bh = box ? box.h : rect.top * 2 + rect.height;
  return { x, y, visible: x >= 0 && y >= 0 && x <= bw && y <= bh };
}

/**
 * Pantallas angostas (celular) con la captura recortada: posición vertical (0..1) que deja el objetivo a la vista.
 * Es solo la «cámara» de la vista; no simula ningún desplazamiento de la página.
 */
export function followY(targetY, nat, box) {
  const s = Math.max(box.w / nat.w, box.h / nat.h);
  const H = nat.h * s, over = H - box.h;
  if (!(over > 1)) return 0;
  const top = clamp(box.h / 2 - targetY * H, -over, 0);
  return r2(-top / over) + 0;   // sin «-0»
}

/** Eventos con número de orden mayor que el último que ya se mostró. */
export function newEvents(list, lastSeq) {
  return (Array.isArray(list) ? list : []).filter((e) => e && Number(e.seq) > Number(lastSeq || 0)).sort((a, b) => a.seq - b.seq);
}

/** Eventos ya vistos cuyo estado cambió (en curso → hecho / error). `seen`: Map seq → estado mostrado. */
export function changedEvents(list, seen) {
  return (Array.isArray(list) ? list : []).filter((e) => e && seen.has(e.seq) && seen.get(e.seq) !== e.status);
}

/** ¿Se puede ubicar el puntero? Coordenadas medidas, sobre la captura que se ve y sin error. */
export function eventFits(ev, shownFrame) {
  return !!ev && ev.status !== 'error' && typeof ev.x === 'number' && typeof ev.y === 'number' && !!ev.frame && ev.frame === shownFrame;
}

const nameOf = (label) => { const m = /«([^»]{1,60})»/.exec(String(label || '')); return m ? m[1] : ''; };
const q = (n) => (n ? ` en «${n}»` : '');

/** Texto corto del paso (globo junto al puntero y lector de pantalla). Nunca incluye lo que se escribe. */
export function pointerText(ev) {
  if (!ev) return '';
  const n = nameOf(ev.label);
  const run = ev.status === 'running', err = ev.status === 'error';
  switch (ev.kind) {
    case 'click':
      if (ev.by === 'user') return err ? 'Tu toque no llegó a la página' : 'Tocaste la pantalla';
      return err ? `No salió el clic${q(n)}` : run ? `Haciendo clic${q(n)}` : `Clic${q(n)}`;
    case 'type':
      if (ev.by === 'login') return err ? 'No se pudo completar el campo' : run ? 'Completando el inicio de sesión (datos ocultos)' : 'Campo completado (datos ocultos)';
      if (ev.by === 'user') return 'Escribiste en la página';
      if (err) return `No se pudo escribir${q(n)}`;
      return run ? `Escribiendo${typeof ev.chars === 'number' ? ` ${ev.chars} ${ev.chars === 1 ? 'carácter' : 'caracteres'}` : ''}${q(n)}` : `Texto escrito${q(n)}`;
    case 'key': return err ? `No salió la tecla ${ev.key || ''}`.trim() : `Tecla ${ev.key || ''}`.trim();
    case 'scroll': {
      const down = Number(ev.dy) > 0;
      if (err) return 'No se pudo desplazar la página';
      return run ? (down ? 'Bajando en la página' : 'Subiendo en la página') : (down ? 'Página desplazada hacia abajo' : 'Página desplazada hacia arriba');
    }
    case 'goto': {
      const host = String(ev.label || '').replace(/^Abrir\s+/i, '');
      return err ? `No se pudo abrir ${host}` : run ? `Abriendo ${host}` : `Abierto ${host}`;
    }
    case 'back': return err ? 'No se pudo volver atrás' : run ? 'Volviendo atrás' : 'Volví a la página anterior';
    default: return String(ev.label || '');
  }
}

/** Duración del viaje del puntero según la distancia (px), entre 260 y 720 ms. */
export function travelMs(dx, dy) {
  const d = Math.hypot(dx || 0, dy || 0);
  return Math.round(clamp(260 + d * 0.9, 260, 720));
}

/** Inverso de toView: toque en la pantalla (px) → punto 0..1 de la captura, o null si cae fuera de la imagen. */
export function fromView(px, py, rect) {
  if (!rect || !(rect.width > 0) || !(rect.height > 0)) return null;
  const x = (px - rect.left) / rect.width, y = (py - rect.top) / rect.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x: Math.round(x * 10_000) / 10_000, y: Math.round(y * 10_000) / 10_000 };
}

/** Lectura de object-position vertical («50% 0%», «center top», «50% 37.5%») → 0..1. */
export function parsePosY(pos) {
  const parts = String(pos || '').trim().split(/\s+/);
  const v = parts.length > 1 ? parts[1] : parts[0];
  if (!v || v === 'top') return 0;
  if (v === 'bottom') return 1;
  if (v === 'center') return 0.5;
  const n = parseFloat(v);
  return /%$/.test(v) && Number.isFinite(n) ? clamp(n / 100, 0, 1) : 0;
}
