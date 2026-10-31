/* Aplica el tema antes de pintar (evita parpadeo). Diseño clásico: claro por defecto; oscuro solo si la persona lo eligió. */
(function () {
  try {
    var t = localStorage.getItem('ac.theme') || sessionStorage.getItem('ac.theme');
    document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
  } catch (e) { /* sin almacenamiento */ }
})();
