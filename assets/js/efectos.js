/*! Efectos del sitio · biblioteca propia, sin dependencias. Respeta «reducir movimiento» del sistema. */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  root.classList.remove('sin-js');
  root.classList.add('ef-on');
  var quieto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finoPuntero = window.matchMedia && window.matchMedia('(pointer: fine)').matches;

  // Texto que aparece por palabras o letras (el texto real queda para lectores de pantalla).
  d.querySelectorAll('[data-texto]').forEach(function (el) {
    if (quieto || el.dataset.listo) return;
    el.dataset.listo = '1';
    var modo = el.getAttribute('data-texto') === 'letras' ? 'letras' : 'palabras';
    var txt = el.textContent.replace(/\s+/g, ' ').trim();
    el.setAttribute('aria-label', txt);
    el.classList.add('ef-texto');
    var partes = modo === 'letras' ? txt.split('') : txt.split(' ');
    var paso = modo === 'letras' ? 0.025 : 0.07;
    el.textContent = '';
    partes.forEach(function (p, i) {
      var s = d.createElement('span');
      s.className = 'ef-letra'; s.setAttribute('aria-hidden', 'true');
      s.style.setProperty('--d', (i * paso).toFixed(3) + 's');
      s.textContent = modo === 'letras' ? p : (i < partes.length - 1 ? p + ' ' : p);
      el.appendChild(s);
    });
  });

  // Aparición al entrar en pantalla.
  var vistos = d.querySelectorAll('[data-revelar], .ef-texto, .ef-subrayado');
  if (quieto || !('IntersectionObserver' in window)) vistos.forEach(function (el) { el.classList.add('es-visible'); });
  else {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('es-visible'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    vistos.forEach(function (el, i) { if (el.hasAttribute('data-revelar') && !el.style.getPropertyValue('--retraso')) el.style.setProperty('--retraso', ((i % 4) * 0.08).toFixed(2) + 's'); io.observe(el); });
  }

  // Brillo que sigue al puntero en tarjetas.
  if (finoPuntero) d.querySelectorAll('.ef-brillo').forEach(function (el) {
    el.addEventListener('pointermove', function (e) { var r = el.getBoundingClientRect(); el.style.setProperty('--mx', (e.clientX - r.left) + 'px'); el.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
  });

  // Inclinación 3D suave.
  if (finoPuntero && !quieto) d.querySelectorAll('[data-inclinar]').forEach(function (el) {
    var max = parseFloat(el.getAttribute('data-inclinar')) || 6;
    el.addEventListener('pointermove', function (e) { var r = el.getBoundingClientRect(); var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; el.style.transform = 'perspective(900px) rotateX(' + (-y * max).toFixed(2) + 'deg) rotateY(' + (x * max).toFixed(2) + 'deg)'; });
    el.addEventListener('pointerleave', function () { el.style.transform = ''; });
  });

  // Botones magnéticos.
  if (finoPuntero && !quieto) d.querySelectorAll('[data-magnetico]').forEach(function (el) {
    el.addEventListener('pointermove', function (e) { var r = el.getBoundingClientRect(); el.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * 0.18).toFixed(1) + 'px,' + ((e.clientY - r.top - r.height / 2) * 0.25).toFixed(1) + 'px)'; });
    el.addEventListener('pointerleave', function () { el.style.transform = ''; });
  });

  // Marquesina: se duplica el contenido para un bucle continuo (la copia se oculta a lectores de pantalla).
  d.querySelectorAll('.ef-marquesina-pista').forEach(function (p) {
    if (p.dataset.listo) return; p.dataset.listo = '1';
    Array.prototype.slice.call(p.children).forEach(function (c) { var k = c.cloneNode(true); k.setAttribute('aria-hidden', 'true'); p.appendChild(k); });
  });

  // Paralaje leve y barra de progreso de lectura.
  var par = d.querySelectorAll('[data-paralaje]'), barra = d.querySelector('.barra-progreso'), cab = d.querySelector('.cabecera');
  var pend = false;
  function alScroll() {
    pend = false;
    var y = window.scrollY || 0, h = root.scrollHeight - window.innerHeight;
    if (barra) barra.style.setProperty('--p', h > 0 ? (y / h).toFixed(4) : '0');
    if (cab) cab.classList.toggle('es-scroll', y > 8);
    if (!quieto) par.forEach(function (el) { var f = parseFloat(el.getAttribute('data-paralaje')) || 0.12; el.style.transform = 'translate3d(0,' + (y * f).toFixed(1) + 'px,0)'; });
  }
  window.addEventListener('scroll', function () { if (!pend) { pend = true; requestAnimationFrame(alScroll); } }, { passive: true });
  alScroll();

  // Partículas livianas (se pausan fuera de pantalla o con la pestaña oculta).
  d.querySelectorAll('canvas[data-particulas]').forEach(function (cv) {
    if (quieto) return;
    var ctx = cv.getContext('2d'); if (!ctx) return;
    var n = Math.min(90, parseInt(cv.getAttribute('data-particulas'), 10) || 40);
    var color = getComputedStyle(cv.parentElement || root).getPropertyValue('--c-accent').trim() || '120 120 120';
    var pts = [], w = 0, h = 0, dpr = Math.min(2, window.devicePixelRatio || 1), activo = true, raf = 0;
    function medir() { var r = cv.getBoundingClientRect(); w = r.width; h = r.height; cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    medir();
    for (var i = 0; i < n; i++) pts.push({ x: Math.random() * w, y: Math.random() * h, r: 0.6 + Math.random() * 1.8, vx: (Math.random() - 0.5) * 0.25, vy: -0.08 - Math.random() * 0.25, a: 0.25 + Math.random() * 0.5 });
    function cuadro() {
      raf = 0; if (!activo) return;
      ctx.clearRect(0, 0, w, h);
      pts.forEach(function (p) { p.x += p.vx; p.y += p.vy; if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w; } if (p.x < -5) p.x = w + 5; if (p.x > w + 5) p.x = -5; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fillStyle = 'rgb(' + color + ' / ' + p.a + ')'; ctx.fill(); });
      raf = requestAnimationFrame(cuadro);
    }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { activo = es[0].isIntersecting && !d.hidden; if (activo && !raf) raf = requestAnimationFrame(cuadro); }).observe(cv);
    d.addEventListener('visibilitychange', function () { activo = !d.hidden; if (activo && !raf) raf = requestAnimationFrame(cuadro); });
    window.addEventListener('resize', medir);
    raf = requestAnimationFrame(cuadro);
  });
})();
