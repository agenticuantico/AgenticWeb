/**
 * Catálogo de servicios de «Cuentas conectadas» (sin DOM, probado en worker-v2/test/fase5-catalogo.test.ts).
 *  - kind 'oauth': conectores oficiales del servidor (OAuth o token). `provider` es el id de /api/connectors.
 *  - kind 'session': sitios que se conectan con la sesión que la persona inicia en la computadora virtual
 *    («Tomar el control» en la página de login oficial y, al devolver el control, guardar la sesión).
 * Logos: archivos locales en /assets/img/marcas (fuente y licencia en TERCEROS.md). `logo: null` = sin logo
 * oficial con permiso de uso: se muestra la inicial en una ficha neutra (no es un logo).
 */

const M = '/assets/img/marcas/';

/** Categorías visibles (también se pueden buscar). */
export const CATEGORIES = {
  dev: 'Desarrollo', mail: 'Correo y agenda', files: 'Archivos', work: 'Empleo', shop: 'Compras', pay: 'Pagos',
  media: 'Música y video', social: 'Redes sociales', team: 'Trabajo en equipo', design: 'Diseño', store: 'Tiendas online', web: 'Sitios web'
};

/** @typedef {{ id: string, name: string, kind: 'oauth'|'session', provider?: string, category: keyof typeof CATEGORIES,
 *   logo: string|null, login?: string, hosts?: string[], loginHosts?: string[], keywords?: string[] }} Service */

/** @type {Service[]} */
export const SERVICES = [
  // Conexión oficial (OAuth o token)
  { id: 'github', name: 'GitHub', kind: 'oauth', provider: 'github', category: 'dev', logo: M + 'github.svg', keywords: ['repositorios', 'codigo', 'git'] },
  { id: 'cloudflare', name: 'Cloudflare', kind: 'oauth', provider: 'cloudflare', category: 'dev', logo: M + 'cloudflare.svg', keywords: ['workers', 'dns', 'token'] },
  { id: 'gmail', name: 'Gmail', kind: 'oauth', provider: 'google', category: 'mail', logo: M + 'gmail.svg', keywords: ['google', 'correo', 'email', 'mail'] },
  { id: 'gcalendar', name: 'Google Calendar', kind: 'oauth', provider: 'gcalendar', category: 'mail', logo: M + 'gcalendar.svg', keywords: ['google', 'calendario', 'agenda', 'eventos'] },
  { id: 'gdrive', name: 'Google Drive', kind: 'oauth', provider: 'gdrive', category: 'files', logo: M + 'gdrive.svg', keywords: ['google', 'documentos', 'archivos', 'docs'] },
  { id: 'gcloud', name: 'Google Cloud', kind: 'oauth', provider: 'gcloud', category: 'dev', logo: M + 'gcloud.svg', keywords: ['google', 'gcp', 'apis', 'proyectos', 'nube'] },
  { id: 'linkedin', name: 'LinkedIn', kind: 'oauth', provider: 'linkedin', category: 'work', logo: M + 'linkedin.webp', keywords: ['empleo', 'perfil', 'publicar', 'trabajo'] },
  // Sesión en la computadora virtual (página de login oficial de cada sitio)
  { id: 'mercadolibre', name: 'Mercado Libre', kind: 'session', category: 'shop', logo: M + 'mercadolibre.svg', login: 'https://www.mercadolibre.com/jms/mla/lgz/login', hosts: ['mercadolibre.com.ar', 'mercadolibre.com'], keywords: ['meli', 'compras', 'ventas', 'pedidos'] },
  { id: 'mercadopago', name: 'Mercado Pago', kind: 'session', category: 'pay', logo: M + 'mercadopago.svg', login: 'https://www.mercadopago.com.ar/home', hosts: ['mercadopago.com.ar', 'mercadopago.com'], keywords: ['mp', 'billetera', 'cobros', 'pagos'] },
  { id: 'paypal', name: 'PayPal', kind: 'session', category: 'pay', logo: M + 'paypal.svg', login: 'https://www.paypal.com/signin', hosts: ['paypal.com'], keywords: ['pagos', 'cobros', 'dolares'] },
  { id: 'amazon', name: 'Amazon', kind: 'session', category: 'shop', logo: null, login: 'https://www.amazon.com/gp/css/homepage.html', hosts: ['amazon.com'], keywords: ['compras', 'pedidos'] },
  { id: 'spotify', name: 'Spotify', kind: 'session', category: 'media', logo: M + 'spotify.svg', login: 'https://accounts.spotify.com/es/login', hosts: ['spotify.com'], keywords: ['musica', 'playlists', 'podcasts'] },
  { id: 'netflix', name: 'Netflix', kind: 'session', category: 'media', logo: M + 'netflix.svg', login: 'https://www.netflix.com/ar/login', hosts: ['netflix.com'], keywords: ['series', 'peliculas'] },
  { id: 'youtube', name: 'YouTube', kind: 'session', category: 'media', logo: M + 'youtube.svg', login: 'https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fwww.youtube.com%2F', hosts: ['youtube.com'], loginHosts: ['accounts.google.com'], keywords: ['videos', 'canal', 'google'] },
  { id: 'x', name: 'X', kind: 'session', category: 'social', logo: M + 'x.svg', login: 'https://x.com/i/flow/login', hosts: ['x.com', 'twitter.com'], keywords: ['twitter', 'tuits', 'posteos'] },
  { id: 'instagram', name: 'Instagram', kind: 'session', category: 'social', logo: M + 'instagram.svg', login: 'https://www.instagram.com/accounts/login/', hosts: ['instagram.com'], keywords: ['ig', 'fotos', 'reels'] },
  { id: 'facebook', name: 'Facebook', kind: 'session', category: 'social', logo: M + 'facebook.svg', login: 'https://www.facebook.com/login/', hosts: ['facebook.com'], keywords: ['fb', 'meta', 'paginas'] },
  { id: 'tiktok', name: 'TikTok', kind: 'session', category: 'social', logo: M + 'tiktok.svg', login: 'https://www.tiktok.com/login', hosts: ['tiktok.com'], keywords: ['videos', 'tik tok'] },
  { id: 'reddit', name: 'Reddit', kind: 'session', category: 'social', logo: M + 'reddit.svg', login: 'https://www.reddit.com/login/', hosts: ['reddit.com'], keywords: ['foros', 'comunidades'] },
  { id: 'discord', name: 'Discord', kind: 'session', category: 'social', logo: M + 'discord.svg', login: 'https://discord.com/login', hosts: ['discord.com'], keywords: ['chat', 'servidores', 'comunidad'] },
  { id: 'microsoft', name: 'Microsoft · Outlook', kind: 'session', category: 'mail', logo: null, login: 'https://login.live.com/', hosts: ['live.com', 'outlook.com', 'microsoft.com', 'office.com'], keywords: ['outlook', 'hotmail', 'correo', 'office', 'microsoft 365'] },
  { id: 'notion', name: 'Notion', kind: 'session', category: 'team', logo: M + 'notion.svg', login: 'https://www.notion.so/login', hosts: ['notion.so', 'notion.com'], keywords: ['notas', 'documentos', 'wiki'] },
  { id: 'trello', name: 'Trello', kind: 'session', category: 'team', logo: M + 'trello.svg', login: 'https://trello.com/login', hosts: ['trello.com'], keywords: ['tableros', 'tareas', 'kanban'] },
  { id: 'canva', name: 'Canva', kind: 'session', category: 'design', logo: M + 'canva.webp', login: 'https://www.canva.com/login', hosts: ['canva.com'], keywords: ['diseno', 'flyers', 'presentaciones'] },
  { id: 'figma', name: 'Figma', kind: 'session', category: 'design', logo: M + 'figma.svg', login: 'https://www.figma.com/login', hosts: ['figma.com'], keywords: ['diseno', 'ui', 'prototipos'] },
  { id: 'dropbox', name: 'Dropbox', kind: 'session', category: 'files', logo: M + 'dropbox.svg', login: 'https://www.dropbox.com/login', hosts: ['dropbox.com'], keywords: ['archivos', 'nube', 'carpetas'] },
  { id: 'shopify', name: 'Shopify', kind: 'session', category: 'store', logo: M + 'shopify.svg', login: 'https://www.shopify.com/login', hosts: ['shopify.com', 'myshopify.com'], keywords: ['tienda', 'ecommerce', 'ventas'] },
  { id: 'tiendanube', name: 'Tiendanube', kind: 'session', category: 'store', logo: M + 'tiendanube.webp', login: 'https://www.tiendanube.com/login', hosts: ['tiendanube.com', 'mitiendanube.com'], keywords: ['tienda', 'ecommerce', 'nuvemshop', 'ventas'] },
  { id: 'wordpress', name: 'WordPress.com', kind: 'session', category: 'web', logo: M + 'wordpress.svg', login: 'https://wordpress.com/log-in', hosts: ['wordpress.com'], keywords: ['blog', 'sitio', 'web'] },
  { id: 'vercel', name: 'Vercel', kind: 'session', category: 'dev', logo: M + 'vercel.svg', login: 'https://vercel.com/login', hosts: ['vercel.com'], keywords: ['deploy', 'hosting', 'nextjs'] },
  { id: 'netlify', name: 'Netlify', kind: 'session', category: 'dev', logo: M + 'netlify.svg', login: 'https://app.netlify.com/login', hosts: ['netlify.com'], keywords: ['deploy', 'hosting'] },
  { id: 'computrabajo', name: 'Computrabajo', kind: 'session', category: 'work', logo: M + 'computrabajo.svg', login: 'https://candidato.ar.computrabajo.com/acceso/', hosts: ['computrabajo.com'], keywords: ['empleo', 'cv', 'postulaciones', 'trabajo'] },
  { id: 'bumeran', name: 'Bumeran', kind: 'session', category: 'work', logo: null, login: 'https://www.bumeran.com.ar/login', hosts: ['bumeran.com.ar'], keywords: ['empleo', 'cv', 'postulaciones', 'trabajo'] },
  { id: 'indeed', name: 'Indeed', kind: 'session', category: 'work', logo: M + 'indeed.svg', login: 'https://secure.indeed.com/auth', hosts: ['indeed.com'], keywords: ['empleo', 'cv', 'postulaciones', 'trabajo'] }
];

/** Minúsculas, sin tildes ni signos: «Diseño» y «diseno» coinciden. */
export function normalize(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

/** El texto con el que se busca un servicio: nombre, categoría y palabras clave. */
export function haystack(sv) {
  return normalize([sv.name, CATEGORIES[sv.category] || '', ...(sv.keywords || []), sv.kind === 'session' ? 'sesion computadora virtual' : 'oauth token oficial'].join(' '));
}

/**
 * Busca mientras se escribe. Cada palabra tiene que ser el comienzo de alguna palabra del servicio (en cualquier orden). Orden del resultado:
 * coincidencia al principio del nombre, después dentro del nombre, después por categoría o palabra clave;
 * a igual puntaje, el orden original del catálogo.
 */
export function searchServices(list, query) {
  const q = normalize(query);
  if (!q) return list.slice();
  const words = q.split(' ');
  const scored = [];
  list.forEach((sv, i) => {
    const tokens = haystack(sv).split(' '), name = normalize(sv.name);
    if (!words.every((w) => tokens.some((t) => t.startsWith(w)))) return;
    const score = name.startsWith(q) ? 0 : name.split(' ').some((p) => p.startsWith(words[0])) ? 1 : name.includes(words[0]) ? 2 : 3;
    scored.push([score, i, sv]);
  });
  return scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[2]);
}

/** ¿El host de una sesión guardada pertenece a este servicio? (dominio exacto o subdominio). */
export function hostMatches(sv, host) {
  const h = String(host || '').toLowerCase().replace(/^www\./, '');
  return !!h && (sv.hosts || []).some((d) => h === d || h.endsWith('.' + d));
}

/**
 * Estado de cada servicio a partir de lo que devuelve el servidor:
 *  - providers: /api/connectors → [{ id, status: 'connected'|'expired'|'available'|'not_configured', … }]
 *  - sessions:  /api/agent/sessions → [{ host, expiresAt, … }] (las vencidas no cuentan)
 * Devuelve { status, provider?, session? } por id de servicio.
 */
export function serviceStatus(sv, providers = [], sessions = [], now = Date.now()) {
  if (sv.kind === 'oauth') {
    const p = providers.find((x) => x.id === sv.provider);
    return { status: p ? p.status : 'not_configured', provider: p || null };
  }
  const s = sessions.find((x) => hostMatches(sv, x.host) && !(x.expiresAt && x.expiresAt <= now));
  return { status: s ? 'connected' : 'available', session: s || null };
}

/**
 * Agrupa para la lista: «Conectadas» arriba (conectadas o por reconectar), después las conexiones oficiales
 * (las disponibles antes que las no configuradas) y al final los sitios con sesión en la computadora virtual.
 */
export function groupServices(list, statusOf) {
  const connected = [], official = [], session = [];
  for (const sv of list) {
    const st = statusOf(sv).status;
    if (st === 'connected' || st === 'expired') connected.push(sv);
    else if (sv.kind === 'oauth') official.push(sv);
    else session.push(sv);
  }
  const rank = (sv) => (statusOf(sv).status === 'not_configured' ? 1 : 0);
  official.sort((a, b) => rank(a) - rank(b));
  return { connected, official, session };
}

/** Página de login oficial del servicio: solo https y solo en sus dominios (nunca una dirección que escriba la persona). */
export function loginUrl(sv) {
  try {
    const u = new URL(sv.login);
    return u.protocol === 'https:' && hostMatches({ hosts: [...(sv.hosts || []), ...(sv.loginHosts || [])] }, u.hostname) ? u.href : null;
  } catch { return null; }
}
