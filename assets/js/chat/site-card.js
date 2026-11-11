/**
 * Tarjeta de «Sitio web premium» en el chat: vista previa multipágina aislada (iframe con sandbox, sin acceso a la
 * sesión), cambio de página y de ancho (celular / tablet / compu), «Personalizar» (datos reales del negocio) y
 * «Descargar .zip». La descarga la autoriza el servidor solo con plan pago; aquí solo se muestra el resultado.
 */
import { h, icon, toast } from '../ui.js';
import { apiFetch, apiUrl, hasAccount } from './engine.js';

(function css() {
  if (typeof document === 'undefined' || document.getElementById('ac-site-css')) return;
  const l = document.createElement('link');
  l.id = 'ac-site-css'; l.rel = 'stylesheet'; l.href = '/assets/css/site-card.css?v=7.23.0';
  document.head.appendChild(l);
})();

const ANCHOS = [['390', 'Celular'], ['768', 'Tablet'], ['1440', 'Compu']];
const ESTILOS = [['', 'Elegir por mí'], ['minimal', 'Minimalista luminoso'], ['editorial', 'Editorial elegante'], ['corporativo', 'Corporativo sobrio'], ['audaz', 'Audaz con color'], ['oscuro', 'Oscuro con brillo'], ['calido', 'Cálido y orgánico'], ['tecnologico', 'Tecnológico de vidrio'], ['lujo', 'Lujo de líneas finas'], ['autoridad', 'Autoridad sobria nocturna'], ['monitoreo', 'Técnico de monitoreo']];

function descargar(blob, nombre) {
  const u = URL.createObjectURL(blob);
  const a = h('a', { href: u, download: nombre });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
}

export class SiteCard {
  constructor(site, { lang = 'es', onUpdate } = {}) {
    this.site = site; this.lang = lang; this.onUpdate = onUpdate;
    this.ancho = window.innerWidth < 700 ? '390' : '1440';
    this.el = h('section', { class: 'stc', 'aria-label': 'Sitio web generado' });
    this.render();
    this.ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.fit()) : null;
    if (this.ro) this.ro.observe(this.el);
  }

  /** La vista previa se pide al mismo servidor que usa el chat (en la copia de prueba, el mismo origen). */
  url(file = 'index.html') { return apiUrl(`/api/sites/${this.site.id}/p/${file}`); }

  render() {
    const s = this.site, m = s.meta || {};
    this.frame = h('iframe', { class: 'stc-frame', title: `Vista previa de ${m.marca || 'tu sitio'}`, src: this.url(), sandbox: 'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox', referrerpolicy: 'no-referrer', loading: 'lazy' });
    this.stage = h('div', { class: 'stc-stage' }, h('div', { class: 'stc-scale' }, this.frame));
    const paginas = h('select', { class: 'stc-select', 'aria-label': 'Página', onchange: (e) => { this.frame.src = this.url(e.target.value); } }, ...(m.paginas || [{ file: 'index.html', label: 'Inicio' }]).map((p) => h('option', { value: p.file }, p.label)));
    const anchos = h('div', { class: 'stc-seg', role: 'group', 'aria-label': 'Ancho de la vista previa' }, ...ANCHOS.map(([w, l]) => h('button', { type: 'button', class: 'stc-segb', 'aria-pressed': String(this.ancho === w), onclick: (e) => { this.ancho = w; this.el.querySelectorAll('.stc-segb').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); this.fit(); } }, l)));
    this.estado = h('p', { class: 'stc-estado', role: 'status', 'aria-live': 'polite' });
    this.el.replaceChildren(
      h('header', { class: 'stc-h' },
        h('span', { class: 'stc-ic', html: icon('globe') }),
        h('div', { class: 'stc-tit' }, h('strong', {}, m.marca || 'Tu sitio'), h('span', {}, [m.rubroNombre, `${(m.paginas || []).length} páginas`, m.combo && m.combo.estilo].filter(Boolean).join(' · '))),
        h('a', { class: 'stc-btn stc-ghost', href: this.url(), target: '_blank', rel: 'noopener', title: 'Abrir la vista previa en otra pestaña' }, h('span', { html: icon('share') }), 'Abrir')),
      h('div', { class: 'stc-bar' }, paginas, anchos),
      this.stage,
      h('div', { class: 'stc-acts' },
        h('button', { type: 'button', class: 'stc-btn stc-primary', onclick: () => this.zip() }, h('span', { html: icon('download') }), 'Descargar .zip'),
        h('button', { type: 'button', class: 'stc-btn', 'aria-expanded': 'false', onclick: (e) => this.toggleForm(e.currentTarget) }, h('span', { html: icon('edit') }), 'Personalizar'),
        m.combo ? h('span', { class: 'stc-combo' }, `Diseño ${(Number(m.combo.index) + 1).toLocaleString('es-AR')} de ${Number(m.combo.total).toLocaleString('es-AR')}`) : null),
      this.estado);
    requestAnimationFrame(() => this.fit());
  }

  fit() {
    const w = Number(this.ancho), box = this.stage.clientWidth || 600;
    const k = Math.min(1, box / w), alto = Math.round((this.stage.clientHeight || 460) / k);
    this.frame.style.width = w + 'px'; this.frame.style.height = alto + 'px';
    this.frame.style.transform = `scale(${k})`;
    this.stage.querySelector('.stc-scale').style.width = Math.round(w * k) + 'px';
  }

  aviso(tipo, html) { this.estado.className = 'stc-estado ' + tipo; this.estado.innerHTML = html; }

  async zip() {
    this.aviso('', 'Preparando el .zip…');
    try {
      const r = await apiFetch(`/api/sites/${this.site.id}/zip`);
      if (r.ok) {
        const b = await r.blob();
        const nombre = ((r.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/) || [])[1] || 'sitio.zip';
        descargar(b, nombre);
        this.aviso('ok', 'Listo: se descargó <strong>' + nombre.replace(/[<&]/g, '') + '</strong>. Adentro está el archivo LEEME.md con los pasos para publicarlo gratis.');
        return;
      }
      if (r.status === 401) this.aviso('info', 'Para descargar el sitio completo, <a href="/cuenta/">inicia sesión</a> con una cuenta Pro o Empresa. La vista previa sigue disponible gratis.');
      else if (r.status === 402) this.aviso('info', 'La descarga del sitio completo (.zip listo para publicar) está incluida en los planes <strong>Pro y Empresa</strong>. <a href="/planes.html#planes">Ver planes y pagar con Mercado Pago</a>.');
      else if (r.status === 403) this.aviso('error', 'Este sitio fue creado con otra cuenta.');
      else if (r.status === 404) this.aviso('error', 'La vista previa venció (se guarda 30 días). Pídeme el sitio de nuevo y lo genero otra vez.');
      else this.aviso('error', 'No pude preparar el .zip ahora. Prueba de nuevo en un momento.');
    } catch { this.aviso('error', 'Sin conexión con el servidor. Revisa tu conexión y vuelve a intentarlo.'); }
  }

  toggleForm(btn) {
    if (this.form) { this.form.remove(); this.form = null; btn.setAttribute('aria-expanded', 'false'); return; }
    btn.setAttribute('aria-expanded', 'true');
    const b = this.site.brief || {};
    const campo = (id, label, attrs = {}) => h('label', { class: 'stc-f' }, h('span', {}, label), h('input', { id: 'stc-' + id, name: id, value: b[id] || '', ...attrs }));
    const esSeg = (this.site.meta || {}).rubro === 'seguridad';
    const sel = h('select', { name: 'estilo' }, ...ESTILOS.map(([v, l]) => h('option', { value: v }, l)));
    const color = h('input', { type: 'color', name: 'color', value: '#1f6b45', 'aria-label': 'Color principal' });
    let usarColor = false; color.addEventListener('input', () => { usarColor = true; });
    const logo = h('input', { type: 'file', name: 'logo', accept: 'image/png,image/jpeg,image/webp,image/svg+xml' });
    const err = h('p', { class: 'stc-estado', role: 'status', 'aria-live': 'polite' });
    this.form = h('form', { class: 'stc-form', onsubmit: async (e) => {
      e.preventDefault();
      const fd = new FormData(this.form);
      const brief = { rubro: (this.site.meta || {}).rubro, nombre: fd.get('nombre'), ciudad: fd.get('ciudad'), email: fd.get('email'), whatsapp: fd.get('whatsapp'), telefono: fd.get('whatsapp'), servicios: String(fd.get('servicios') || ''), direccion: fd.get('direccion'), horario: fd.get('horario'), ...(esSeg ? { zonas: String(fd.get('zonas') || '') || undefined, monitoreo: String(fd.get('monitoreo') || '') || undefined, habilitacion: String(fd.get('habilitacion') || '') || undefined } : {}), estilo: fd.get('estilo') || undefined, colores: usarColor ? [color.value] : undefined };
      const f = logo.files && logo.files[0];
      if (f) {
        if (f.size > 200 * 1024) { err.className = 'stc-estado error'; err.textContent = 'El logo pesa más de 200 KB: usa una versión más liviana.'; return; }
        brief.logo = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
      }
      const send = this.form.querySelector('button[type=submit]');
      send.disabled = true; send.textContent = 'Generando…'; err.className = 'stc-estado'; err.textContent = 'Estoy armando la nueva versión con tus datos (tarda unos segundos).';
      try {
        const r = await apiFetch('/api/sites', { method: 'POST', body: { brief, lang: this.lang } });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw Object.assign(new Error(j.error || 'error'), { status: r.status, code: j.error });
        this.site = { ...j, brief: { ...b, ...brief, logo: undefined } };
        this.form = null; this.render();
        this.onUpdate && this.onUpdate(this.site);
        toast('Sitio actualizado con tus datos');
      } catch (x) {
        send.disabled = false; send.textContent = 'Generar con mis datos';
        err.className = 'stc-estado error';
        err.textContent = x.status === 429 ? 'Llegaste al límite de sitios de hoy. ' + (hasAccount() ? 'Con un plan pago puedes generar más.' : 'Inicia sesión para tener más.') : 'No pude generar la nueva versión ahora. Prueba de nuevo en un momento.';
      }
    } },
      h('p', { class: 'stc-nota' }, 'Solo usamos los datos que escribas aquí. Nada se inventa: lo que dejes vacío queda marcado para completar.'),
      h('div', { class: 'stc-grid' }, campo('nombre', 'Nombre del negocio', { maxlength: 40, autocomplete: 'organization' }), campo('ciudad', 'Ciudad', { maxlength: 60 }), campo('email', 'Correo para los formularios', { type: 'email', maxlength: 80 }), campo('whatsapp', 'WhatsApp (con código de país)', { inputmode: 'tel', maxlength: 30 }), campo('direccion', 'Dirección (opcional)', { maxlength: 120 }), campo('horario', 'Horario (opcional)', { maxlength: 60 })),
      h('label', { class: 'stc-f' }, h('span', {}, 'Servicios o productos (separados por coma)'), h('input', { name: 'servicios', maxlength: 400 })),
      esSeg ? h('div', { class: 'stc-grid' }, campo('zonas', 'Zonas donde prestas servicio (opcional)', { maxlength: 200 }), campo('monitoreo', 'Central de monitoreo: horario y contacto (opcional)', { maxlength: 140 }), campo('habilitacion', 'Número de habilitación y organismo (opcional)', { maxlength: 80 })) : null,
      h('div', { class: 'stc-grid' }, h('label', { class: 'stc-f' }, h('span', {}, 'Estilo visual'), sel), h('label', { class: 'stc-f' }, h('span', {}, 'Color principal (opcional)'), color), h('label', { class: 'stc-f' }, h('span', {}, 'Logo (opcional, hasta 200 KB)'), logo)),
      h('div', { class: 'stc-acts' }, h('button', { type: 'submit', class: 'stc-btn stc-primary' }, 'Generar con mis datos')), err);
    this.el.append(this.form);
    this.form.querySelector('input').focus();
  }
}
