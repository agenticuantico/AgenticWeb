/* Aplica el tema antes de pintar (evita parpadeo). Script clásico y mínimo. */
(function () {
  try {
    var t = localStorage.getItem('ac.theme') || sessionStorage.getItem('ac.theme');
    if (!t) t = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
  } catch (e) { /* sin almacenamiento */ }
})();
