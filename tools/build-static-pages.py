#!/usr/bin/env python3
"""Dev-only helper: regenerates /legal/*.html and /404.html from one template.
The generated HTML is committed, so the site needs no build step to deploy.
Spanish (es-AR) text below is the default content; translations live in
/assets/i18n/*.json under the same keys.
Run: python3 tools/build-static-pages.py
"""
import html, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
MAIL = 'agenticuantico@gmail.com'

HEAD = '''<!doctype html>
<html lang="es-AR" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title} · AgentiCuántico</title>
<meta name="description" content="{desc}">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self' mailto:">
<meta name="theme-color" content="#05070c">
<meta name="color-scheme" content="dark">
<meta name="robots" content="{robots}">
{canonical}
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta property="og:site_name" content="AgentiCuántico">
<meta property="og:title" content="{title} · AgentiCuántico">
<meta property="og:image" content="https://agenticuantico.dev.ar/assets/img/og-image.png">
<link rel="stylesheet" href="/assets/css/main.css">
<script type="module" src="/assets/js/page.js"></script>
</head>
<body data-page="{page}">
<a class="skip-link" href="#contenido" data-i18n="a11y.skip">Saltar al contenido</a>
<header class="site-header legal-header">
  <div class="wrap header-inner">
    <a class="brand" href="/" aria-label="AgentiCuántico, inicio">
      <svg class="brand-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><use href="/assets/img/sprite.svg#logo"/></svg>
      <span class="brand-name">Agenti<span>Cuántico</span></span>
    </a>
    <div class="header-actions">
      <div class="lang" data-lang-switcher>
        <button class="lang-btn" type="button" aria-haspopup="listbox" aria-expanded="false" aria-controls="lang-list" data-i18n-attr="aria-label:lang.label" aria-label="Idioma">
          <span class="flag" data-current-flag aria-hidden="true"></span><span class="lang-code" data-current-code>ES</span>
          <svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>
        </button>
        <ul class="lang-list" id="lang-list" role="listbox" tabindex="-1" hidden></ul>
      </div>
      <a class="back-link" href="/" data-i18n="legal.back">← Volver al inicio</a>
    </div>
  </div>
</header>
'''

FOOT = '''<footer class="site-footer">
  <div class="wrap footer-inner">
    <div class="footer-brand"><p data-i18n="footer.tagline">Cerebro cuántico agentic. Hecho en Argentina.</p></div>
    <nav aria-label="Legal" data-i18n-attr="aria-label:footer.legalLabel" class="footer-nav">
      <a href="/legal/privacidad.html" data-i18n="footer.privacy">Privacidad</a>
      <a href="/legal/terminos.html" data-i18n="footer.terms">Términos</a>
      <a href="/legal/cookies.html" data-i18n="footer.cookies">Cookies</a>
      <a href="mailto:agenticuantico@gmail.com">agenticuantico@gmail.com</a>
    </nav>
    <p class="copy">© 2026 AgentiCuántico · <span data-i18n="footer.rights">Todos los derechos reservados.</span></p>
  </div>
</footer>
</body>
</html>
'''

def el(tag, key, text, cls=None):
    c = f' class="{cls}"' if cls else ''
    return f'<{tag}{c} data-i18n="{key}">{html.escape(text)}</{tag}>'

def page(prefix, title, intro, sections):
    out = [f'<main id="contenido" class="legal"><div class="wrap narrow">',
           el('h1', f'{prefix}.title', title),
           el('p', 'legal.updated', 'Última actualización: 31 de octubre de 2026', 'updated'),
           el('p', f'{prefix}.intro', intro)]
    for i, (h, body) in enumerate(sections, 1):
        out.append(el('h2', f'{prefix}.h{i}', h))
        if isinstance(body, list):
            out.append('<ul>' + ''.join(el('li', f'{prefix}.s{i}l{j}', t) for j, t in enumerate(body, 1)) + '</ul>')
        else:
            out.append(el('p', f'{prefix}.s{i}', body))
    out.append('</div></main>')
    return '\n'.join(out)

PAGES = {
  'privacidad': ('priv', 'Política de privacidad', 'Cómo AgentiCuántico trata los datos personales, conforme a la Ley 25.326.',
    'Esta política explica cómo AgentiCuántico trata los datos personales en agenticuantico.dev.ar y en su app web, conforme a la Ley 25.326 de Protección de Datos Personales de la República Argentina.', [
    ('Responsable', f'El responsable del tratamiento es AgentiCuántico, proyecto con sede en la República Argentina. Contacto: {MAIL}.'),
    ('Qué datos tratamos', [
      'Los datos que nos enviás por correo electrónico, por ejemplo en una consulta comercial.',
      'Si creás una cuenta en la app: tu email, tu plan y el estado de tus pagos. Los datos de tarjeta los procesan Mercado Pago o PayPal; nosotros no los vemos ni los guardamos.',
      'Preferencias guardadas en tu navegador (idioma, moneda y conversaciones de la demo) mediante almacenamiento local.']),
    ('La demo del Agente', 'La demo del sitio responde con una base de conocimiento pública incluida en la página y no envía tus preguntas a nuestros servidores. La voz usa el sintetizador de tu navegador; algunos navegadores pueden procesar el texto con su propio proveedor de voz.'),
    ('Finalidad', 'Responder consultas, prestar el servicio, gestionar suscripciones, prevenir abusos y cumplir obligaciones legales. No vendemos tus datos.'),
    ('Proveedores', 'Podemos usar proveedores de infraestructura en la nube, de modelos de IA y de pagos (Mercado Pago, PayPal) que tratan datos por cuenta nuestra con medidas de seguridad adecuadas, lo que puede implicar transferencias internacionales.'),
    ('Tus derechos', f'Podés solicitar acceso, rectificación, actualización o supresión de tus datos escribiendo a {MAIL}. El acceso es gratuito en intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo (art. 14, inc. 3, Ley 25.326).'),
    ('Autoridad de control', 'La Agencia de Acceso a la Información Pública, en su carácter de órgano de control de la Ley 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.'),
    ('Cambios', 'Podemos actualizar esta política. La versión vigente siempre estará publicada en esta página.')]),
  'terminos': ('terms', 'Términos y condiciones', 'Condiciones de uso del sitio y la app de AgentiCuántico.',
    'Al usar agenticuantico.dev.ar y la app de AgentiCuántico aceptás estos términos.', [
    ('El servicio', 'AgentiCuántico ofrece herramientas de inteligencia artificial agentic. La demo pública es informativa y puede contener errores; no reemplaza el asesoramiento profesional.'),
    ('Uso aceptable', 'No uses el servicio para actividades ilegales, para vulnerar derechos de terceros, enviar spam ni intentar acceder a sistemas sin autorización.'),
    ('Suscripciones y pagos', 'Los planes pagos se cobran por mes en forma recurrente mediante Mercado Pago (en pesos) o PayPal (en dólares). Podés cancelar cuando quieras desde tu medio de pago o escribiéndonos; la cancelación evita los cobros siguientes. Los precios pueden cambiar con aviso previo.'),
    ('Botón de arrepentimiento', f'Si contrataste a distancia, podés revocar la aceptación dentro de los 10 días corridos, según la Ley 24.240 de Defensa del Consumidor, escribiendo a {MAIL}.'),
    ('Propiedad intelectual', 'La marca, el diseño y el software de AgentiCuántico pertenecen a sus titulares. El contenido que generes con el servicio es tuyo, sujeto a las licencias de los proveedores de modelos.'),
    ('Limitación de responsabilidad', 'El servicio se ofrece "tal cual". En la medida permitida por la ley, no respondemos por daños indirectos derivados del uso de respuestas generadas por IA.'),
    ('Ley aplicable', f'Estos términos se rigen por las leyes de la República Argentina. Contacto: {MAIL}.')]),
  'cookies': ('cookies', 'Política de cookies', 'Qué almacenamiento usa el sitio de AgentiCuántico.',
    'Este sitio no usa cookies de publicidad ni de rastreo de terceros.', [
    ('Qué usamos', [
      'Almacenamiento local (localStorage) para recordar tu idioma, la moneda elegida y, en la app, tus conversaciones de demostración.',
      'Una caché del service worker para que el sitio cargue rápido y funcione sin conexión.',
      'Si iniciás sesión en la app, una cookie de sesión estrictamente necesaria, segura y httpOnly, emitida por nuestro backend.']),
    ('Cómo borrarlo', 'Podés borrar estos datos desde la configuración de tu navegador o, en la app, con la opción "Borrar conversaciones".'),
    ('Cambios', 'Si en el futuro sumamos analítica, lo informaremos en esta página y pediremos tu consentimiento cuando corresponda.')]),
}

for slug, (prefix, title, desc, intro, sections) in PAGES.items():
    canonical = f'<link rel="canonical" href="https://agenticuantico.dev.ar/legal/{slug}.html">'
    doc = HEAD.format(title=title, desc=html.escape(desc), robots='index, follow', canonical=canonical, page='legal') + page(prefix, title, intro, sections) + '\n' + FOOT
    (ROOT / 'legal' / f'{slug}.html').write_text(doc, encoding='utf-8')

nf = '''<main id="contenido" class="page-404"><div>
<h1>404</h1>
<h2 data-i18n="nf.title">Página no encontrada</h2>
<p class="section-lead" data-i18n="nf.lead">La señal se perdió en el multiverso. Volvé al inicio o hablá con el Agente.</p>
<div class="hero-actions center"><a class="btn btn-primary btn-lg" href="/" data-i18n="nf.home">Ir al inicio</a><a class="btn btn-glass btn-lg" href="/app/" data-i18n="cta.try">Probar AgentiCuántico</a></div>
</div></main>'''
(ROOT / '404.html').write_text(HEAD.format(title='Página no encontrada', desc='Página no encontrada', robots='noindex', canonical='', page='404') + nf + '\n' + FOOT, encoding='utf-8')
print('ok')
