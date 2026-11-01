/** /gobernanza/: completa la tabla de cupos con los valores vigentes del servidor (si responde). */
import { CONFIG } from './config.js';
const base = String(CONFIG.API_BASE || '').replace(/\/+$/, '');
if (base) {
  fetch(base + '/api/ai/policy', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((p) => {
    if (!p) return;
    document.querySelectorAll('#govQuota [data-q]').forEach((td) => {
      const [k, t] = td.dataset.q.split('.');
      const v = p[k] && p[k][t];
      if (Number.isFinite(v)) td.textContent = String(v);
    });
  }).catch(() => {});
}
