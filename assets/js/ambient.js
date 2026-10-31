/** Fondo clásico de AgentiCuántico: partículas lima flotando con líneas de red neuronal. */
const canvas = document.getElementById('ambientCanvas');
if (canvas && canvas.getContext) {
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w = 0, h = 0;
  const size = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
  size();
  window.addEventListener('resize', size, { passive: true });
  const n = w < 560 ? 26 : 35;
  const ps = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, r: Math.random() * 2 + 1 }));
  let visible = true;
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible && !reduce) requestAnimationFrame(frame); });
  function frame() {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (!reduce) { p.x += p.vx; p.y += p.vy; }
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(159, 255, 0, 0.45)'; ctx.fill();
      for (let j = i + 1; j < ps.length; j++) {
        const q = ps[j]; const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < 110) { ctx.beginPath(); ctx.strokeStyle = `rgba(24, 24, 27, ${0.05 * (1 - d / 110)})`; ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
      }
    }
    if (visible && !reduce) requestAnimationFrame(frame);
  }
  frame();
}
