/* Tema: el sitio es siempre claro (blanco). Se ignora cualquier preferencia guardada o del sistema
   y se borra un 'ac.theme' viejo para que no vuelva a aparecer el modo oscuro. */
(function () {
  document.documentElement.setAttribute('data-theme', 'light');
  document.documentElement.style.colorScheme = 'only light';
  try { localStorage.removeItem('ac.theme'); } catch (e) { /* sin almacenamiento */ }
  try { sessionStorage.removeItem('ac.theme'); } catch (e) { /* sin almacenamiento */ }
})();
