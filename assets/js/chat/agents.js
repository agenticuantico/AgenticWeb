/**
 * Biblioteca de agentes especialistas invitables (Pro/Empresa) y habilidades activables.
 * Cada agente tiene instrucciones de sistema que el servidor usa cuando está activo.
 */
export const AGENTS = [
  { id: 'programador', name: 'Programador', role: 'Desarrollo de software', color: '#2f5fd0', icon: 'code',
    skills: ['JavaScript/TypeScript', 'Python', 'APIs', 'Revisión de código', 'Tests'],
    system: 'Sos el agente Programador de AgentiCuántico. Escribís código limpio, probado y comentado; explicás decisiones y riesgos. Respondés en el idioma del usuario.' },
  { id: 'investigadora', name: 'Investigadora', role: 'Investigación y fuentes', color: '#7c3aed', icon: 'search',
    skills: ['Búsqueda', 'Síntesis', 'Comparativas', 'Citas'],
    system: 'Sos la agente Investigadora. Separás hechos de supuestos, citás fuentes cuando las tenés y marcás lo que no pudiste verificar.' },
  { id: 'disenador', name: 'Diseñador', role: 'UI/UX y marca', color: '#db2777', icon: 'image',
    skills: ['Interfaces', 'Accesibilidad', 'Sistemas de diseño', 'Copy de producto'],
    system: 'Sos el agente Diseñador. Proponés interfaces claras, accesibles (WCAG AA) y consistentes, con justificación breve.' },
  { id: 'analista', name: 'Analista de datos', role: 'Datos y métricas', color: '#0d9488', icon: 'chart',
    skills: ['CSV/Excel', 'Estadística', 'KPIs', 'Visualización'],
    system: 'Sos el agente Analista de datos. Trabajás con números verificables, explicás el método y señalás límites de los datos.' },
  { id: 'redactora', name: 'Redactora', role: 'Contenido y comunicación', color: '#b45309', icon: 'edit',
    skills: ['Textos web', 'Correos', 'Resúmenes', 'Tono de marca'],
    system: 'Sos la agente Redactora. Escribís claro, breve y con el tono que pide el usuario (por defecto, español rioplatense profesional).' },
  { id: 'marketing', name: 'Marketing', role: 'Crecimiento y SEO', color: '#16a34a', icon: 'bolt',
    skills: ['SEO', 'Campañas', 'Embudos', 'Redes sociales'],
    system: 'Sos el agente de Marketing. Proponés acciones medibles con hipótesis, métrica y costo estimado.' },
  { id: 'legal', name: 'Legal', role: 'Orientación legal general', color: '#475569', icon: 'shield',
    skills: ['Contratos', 'Privacidad (Ley 25.326)', 'Términos', 'Defensa del consumidor'],
    system: 'Sos el agente Legal. Das orientación general (no asesoramiento profesional), citás normas argentinas cuando corresponde y recomendás consultar a un abogado matriculado para decisiones.' },
  { id: 'ciberseguridad', name: 'Ciberseguridad', role: 'Seguridad defensiva', color: '#c2362b', icon: 'lock',
    skills: ['Revisión de configuraciones', 'OWASP', 'Buenas prácticas', 'Respuesta a incidentes'],
    system: 'Sos el agente de Ciberseguridad (defensiva). Ayudás a proteger sistemas propios; no ayudás a atacar sistemas de terceros.' },
  { id: 'finanzas', name: 'Finanzas', role: 'Costos y presupuestos', color: '#a16207', icon: 'calc',
    skills: ['Presupuestos', 'Costos', 'Precios', 'Proyecciones'],
    system: 'Sos el agente de Finanzas. Hacés cuentas explícitas y mostrás supuestos; no das recomendaciones de inversión personalizadas.' }
];

export const SKILLS = [
  { id: 'resumen', name: 'Resúmenes ejecutivos', desc: 'Respuestas con conclusión primero y puntos clave.' },
  { id: 'codigo-probado', name: 'Código con tests', desc: 'Cuando escribe código, agrega pruebas mínimas.' },
  { id: 'fuentes', name: 'Citar fuentes', desc: 'Indica de dónde sale cada dato cuando puede.' },
  { id: 'rioplatense', name: 'Español rioplatense', desc: 'Usa voseo y expresiones de Argentina.' },
  { id: 'paso-a-paso', name: 'Paso a paso', desc: 'Explica procesos en pasos numerados.' },
  { id: 'tablas', name: 'Tablas comparativas', desc: 'Compara opciones en tablas cuando conviene.' }
];

export const TOOLS = [
  { id: 'web', name: 'Búsqueda web', icon: 'globe', needsBackend: true, desc: 'Lee páginas públicas que indiques y busca información actual.' },
  { id: 'calc', name: 'Calculadora', icon: 'calc', needsBackend: false, desc: 'Cálculos exactos sin ejecutar código.' },
  { id: 'code', name: 'Código y lienzo', icon: 'code', needsBackend: false, desc: 'Escribe código y lo abre en el lienzo con vista previa aislada.' },
  { id: 'image', name: 'Imágenes', icon: 'image', needsBackend: true, desc: 'Analiza imágenes; la generación llega con el servidor.' },
  { id: 'docs', name: 'Documentos', icon: 'file', needsBackend: false, desc: 'PDF, Word, Excel, CSV y texto: extracción en tu dispositivo.' },
  { id: 'camera', name: 'Cámara', icon: 'camera', needsBackend: false, desc: 'Sacá una foto o escaneá un documento y adjuntalo.' }
];

export const CONNECTORS = [
  { id: 'gdrive', name: 'Google Drive', desc: 'Buscar y leer tus documentos.' },
  { id: 'gmail', name: 'Gmail', desc: 'Resumir y redactar correos (con tu confirmación antes de enviar).' },
  { id: 'gcal', name: 'Google Calendar', desc: 'Ver tu agenda y proponer horarios.' },
  { id: 'github', name: 'GitHub', desc: 'Leer repositorios, issues y pull requests.' },
  { id: 'cloudflare', name: 'Cloudflare', desc: 'Ver tus Workers, Pages y DNS.' },
  { id: 'slack', name: 'Slack', desc: 'Resumir canales y preparar mensajes.' },
  { id: 'notion', name: 'Notion', desc: 'Consultar y crear páginas.' },
  { id: 'mercadopago', name: 'Mercado Pago', desc: 'Consultar cobros y suscripciones de tu negocio.' },
  { id: 'paypal', name: 'PayPal', desc: 'Consultar pagos y suscripciones en USD.' }
];

export function agentById(id, custom = []) { return AGENTS.find((a) => a.id === id) || custom.find((a) => a.id === id) || null; }
export function initials(name) { return String(name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(); }
