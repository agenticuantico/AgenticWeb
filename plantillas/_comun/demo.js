// Kit común de las plantillas demo de AgentiCuántico (código propio, 2026).
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

// Revelado al entrar en pantalla
export function reveal(root = document) {
  const els = root.querySelectorAll('.rv');
  if (reduced || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: .08 });
  els.forEach(e => io.observe(e));
  // Respaldo: si se salta rápido una sección, también se revela lo que ya quedó arriba
  let t = 0;
  addEventListener('scroll', () => { if (t) return; t = setTimeout(() => { t = 0; els.forEach(e => { if (!e.classList.contains('in') && e.getBoundingClientRect().top < innerHeight) { e.classList.add('in'); io.unobserve(e); } }); }, 120); }, { passive: true });
}

// Progreso de scroll de la página (0..1) en --p de .progress y callback
export function scrollProgress(cb) {
  const bar = document.querySelector('.progress');
  let ticking = false;
  const run = () => {
    ticking = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    if (bar) bar.style.setProperty('--p', p.toFixed(4));
    cb && cb(p);
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(run); } }, { passive: true });
  addEventListener('resize', run);
  run();
}

// Progreso (0..1) de una sección alta con contenido sticky
export function sectionProgress(el) {
  const r = el.getBoundingClientRect();
  const total = r.height - innerHeight;
  return total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : (r.top < 0 ? 1 : 0);
}

// Cursor propio con anillo que sigue con inercia
export function cursor() {
  if (reduced || !finePointer) return;
  const ring = document.createElement('div'); ring.className = 'cur'; ring.setAttribute('aria-hidden', 'true');
  const dot = document.createElement('div'); dot.className = 'cur-dot'; dot.setAttribute('aria-hidden', 'true');
  document.body.append(ring, dot); document.documentElement.classList.add('has-cur');
  let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y;
  addEventListener('pointermove', e => { x = e.clientX; y = e.clientY; ring.classList.add('on'); dot.classList.add('on'); dot.style.transform = `translate(${x}px,${y}px)`; }, { passive: true });
  document.addEventListener('pointerleave', () => { ring.classList.remove('on'); dot.classList.remove('on'); });
  document.addEventListener('pointerover', e => ring.classList.toggle('big', !!e.target.closest('a,button,[data-cursor]')));
  (function loop() { rx += (x - rx) * .18; ry += (y - ry) * .18; ring.style.transform = `translate(${rx}px,${ry}px)`; requestAnimationFrame(loop); })();
}

// Botones magnéticos
export function magnetic(sel = '[data-magnetic]') {
  if (reduced || !finePointer) return;
  document.querySelectorAll(sel).forEach(b => {
    b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .22}px,${(e.clientY - r.top - r.height / 2) * .3}px)`; });
    b.addEventListener('pointerleave', () => { b.style.transform = ''; });
  });
}

// Formularios demo: no envían nada, solo confirman en pantalla
export function demoForms() {
  document.querySelectorAll('form[data-demo]').forEach(f => f.addEventListener('submit', e => {
    e.preventDefault();
    const ok = f.querySelector('.form-ok'); if (ok) { ok.classList.add('show'); ok.focus?.(); }
  }));
}

// Menú móvil accesible
export function menu() {
  const btn = document.querySelector('[data-menu-btn]'); const nav = document.querySelector('[data-menu]');
  if (!btn || !nav) return;
  const set = open => { btn.setAttribute('aria-expanded', String(open)); nav.classList.toggle('open', open); document.body.classList.toggle('menu-open', open); };
  btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => set(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
}

// ¿Hay WebGL?
export function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

// Pausa el render cuando la pestaña está oculta o el canvas fuera de pantalla
export function visibleLoop(canvas, frame) {
  let onScreen = true, raf = 0;
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen && !raf) tick(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !raf) tick(); });
  let last = performance.now();
  function tick() {
    raf = 0;
    if (document.hidden || !onScreen) return;
    const now = performance.now(); const dt = Math.min(.05, (now - last) / 1000); last = now;
    frame(dt, now / 1000);
    raf = requestAnimationFrame(tick);
  }
  tick();
}

export function initCommon() { reveal(); cursor(); magnetic(); demoForms(); menu(); }
