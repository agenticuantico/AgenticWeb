/* Al recargar (o volver con «atrás» desde la caché del navegador) toda página abre ARRIBA,
   en cualquier dispositivo. Los enlaces a una sección (#seccion, /admin/#agentes) siguen funcionando:
   si la dirección trae #ancla, se respeta el ancla en lugar de subir. Script clásico (no módulo) para correr temprano. */
(function () {
  'use strict';
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) { /* sin soporte */ }
  function anchorTarget() {
    var h = location.hash;
    if (!h || h.length < 2) return null;
    var id;
    try { id = decodeURIComponent(h.slice(1)); } catch (e) { id = h.slice(1); }
    return document.getElementById(id) || document.getElementsByName(id)[0] || null;
  }
  function toTop() {
    var t = anchorTarget();
    if (t) { if (t.scrollIntoView) t.scrollIntoView(); return; }
    if (location.hash && location.hash.length > 1) return; // ancla manejada por la página (p. ej. pestañas de /admin/)
    window.scrollTo(0, 0);
    var se = document.scrollingElement || document.documentElement;
    if (se) se.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
    // Contenedores con desplazamiento propio (hilo del chat): también arriba al abrir.
    var els = document.querySelectorAll('[data-scroll-top-on-load], [data-role="thread"]');
    for (var i = 0; i < els.length; i++) els[i].scrollTop = 0;
  }
  toTop();
  document.addEventListener('DOMContentLoaded', toTop);
  window.addEventListener('load', function () { toTop(); setTimeout(toTop, 0); });
  window.addEventListener('pageshow', function (e) { if (e.persisted) toTop(); });
})();
