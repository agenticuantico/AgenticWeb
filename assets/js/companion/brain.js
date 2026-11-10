/**
 * AgentiCuántico (llamada) · personalidad, memoria y respuestas.
 * Con el servidor: el modelo responde con el prompt de sistema de abajo + la memoria relevante.
 * Sin servidor: respuestas locales honestas (conversación cálida, continuidad con la memoria,
 * cálculos y programación básica) — nunca se presenta como humana.
 */
import { localAnswer } from '../chat/engine.js';

export const CRISIS_RE = /(suicid|matarme|me quiero morir|quiero morir|no quiero (seguir )?vivir|quitarme la vida|terminar con (todo|mi vida)|autolesi|lastimarme|cortarme|hacerme da[ñn]o|kill myself|suicide|end my life|self.?harm|me matar|tirarme (de|del|por))/i;


export function systemPrompt({ lang, name, memory = [], since }) {
  const mem = memory.slice(0, 40).map((m) => `- (${m.kind}) ${m.text}`).join('\n');
  return [
    'Eres AgentiCuántico: una inteligencia artificial cálida, curiosa y muy capaz con la que la persona habla por voz todos los días.',
    'Hablas como una amiga súper inteligente, en el idioma de la persona (en español, neutro y con «tú», salvo que ella use voseo u otra variante): frases cortas y naturales para ser dichas en voz alta (2 a 4 oraciones), una pregunta por vez.',
    'Puedes charlar de la vida, ideas profundas, programación, tecnología o lo que sea. Si te piden código, explícalo en palabras y ofrece pasarlo al chat escrito.',
    'Eres honesta: eres una IA, no una persona; nunca digas que eres humana ni que tienes cuerpo o vida propia. No adules ni des la razón por compromiso: si algo no cierra, dilo con cariño.',
    'Respeta la autonomía: sugiere, no impongas. No des diagnósticos médicos ni consejos financieros personalizados.',
    'Si la persona expresa crisis, ideas de hacerse daño o de suicidio: responde con calma y empatía, pregunta si está a salvo, recomienda llamar a la Línea 135 o al (011) 5275-1135 (24 h, gratis) o al 911 si hay peligro inmediato, y anímala a contactar a alguien de confianza ahora.',
    `Idioma de respuesta: ${lang}.`,
    name ? `La persona se llama ${name}.` : '',
    since ? `La última charla fue ${since}. Retoma con continuidad si viene al caso (por ejemplo, pregunta cómo le fue con algo pendiente).` : '',
    mem ? `Lo que recuerdas de conversaciones anteriores (úsalo con naturalidad, sin recitarlo):\n${mem}` : ''
  ].filter(Boolean).join('\n');
}

/* ---------- Extracción local de datos para la memoria ---------- */
const RELATIONS = 'mam[aá]|madre|pap[aá]|padre|hermana|hermano|hijo|hija|novia|novio|esposa|esposo|pareja|amiga|amigo|jefe|jefa|abuela|abuelo|t[ií]a|t[ií]o|prima|primo|perro|perra|gato|gata|socio|socia';
export function extractFacts(utterances) {
  const facts = [];
  const add = (kind, text) => { text = text.trim().replace(/[.,;!?]+$/, ''); if (text.length > 2 && text.length < 160 && !facts.some((f) => f.text.toLowerCase() === text.toLowerCase())) facts.push({ kind, text }); };
  for (const u of utterances) {
    const t = u.replace(/\s+/g, ' ');
    let m;
    if ((m = /\b(?:me llamo|mi nombre es|soy) ([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?: [A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/.exec(t))) add('nombre', m[1]);
    for (const r of t.matchAll(new RegExp(`\\bmi (${RELATIONS}) (?:se llama|es) ([A-ZÁÉÍÓÚÑa-záéíóúñ]+)`, 'gi'))) add('persona', `${r[2]} (${r[1].toLowerCase()})`);
    for (const r of t.matchAll(/\bme (?:encanta|gusta(?:n)?|apasiona) (?:mucho )?(.{3,60}?)(?:[.,;]|$| y | pero )/gi)) add('interés', r[1]);
    for (const r of t.matchAll(/\b(?:quiero|mi (?:objetivo|meta|sueño) es|estoy tratando de|voy a) (.{4,80}?)(?:[.,;]|$| pero )/gi)) add('objetivo', r[1]);
    for (const r of t.matchAll(/\b(?:trabajo (?:de|como|en)|estudio) (.{3,60}?)(?:[.,;]|$| y )/gi)) add('ocupación', r[1]);
    for (const r of t.matchAll(/\b(?:mañana|el lunes|el martes|el miércoles|el jueves|el viernes|esta semana|la semana que viene) (?:tengo|voy a|empiezo) (.{4,70}?)(?:[.,;]|$)/gi)) add('pendiente', r[1]);
    if ((m = /\b(?:estoy|me siento|ando) (muy |re |bastante )?(triste|cansad[oa]|feliz|content[oa]|ansios[oa]|estresad[oa]|preocupad[oa]|bien|mal|motivad[oa]|solo|sola|nervios[oa])/i.exec(t))) add('ánimo', `${new Date().toLocaleDateString('es-AR')}: ${m[0]}`);
  }
  return facts.slice(0, 20);
}

/* ---------- Respuesta local (sin servidor) ---------- */
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export function greeting({ name, memory = [], lang = 'es' }) {
  if (lang === 'en') return name ? `Hi ${name}! Good to hear you again. How's your day going?` : "Hi! I'm your AgentiCuántico companion. What's on your mind today?";
  const pend = memory.find((m) => m.kind === 'pendiente' || m.kind === 'objetivo');
  if (name && pend) return `¡Hola, ${name}! Qué bueno escucharte. La última vez me contaste de ${pend.text}. ¿Cómo te fue con eso?`;
  if (name) return pick([`¡Hola, ${name}! ¿Cómo vienes hoy?`, `¡${name}! Qué lindo escucharte. ¿Qué tal tu día?`]);
  return '¡Hola! Soy AgentiCuántico, una inteligencia artificial. Podemos charlar de lo que quieras: tu día, ideas, programación, tecnología. ¿Cómo te llamas?';
}

export function localReply(text, ctx) {
  const t = text.toLowerCase();
  const name = ctx.name;
  if (CRISIS_RE.test(text)) {
    return { crisis: true, text: `${name ? name + ', ' : ''}gracias por contármelo; me importa que estés bien. Lo que sientes es importante y no tienes que atravesarlo en soledad. ¿Estás a salvo ahora? Si estás en Argentina, puedes llamar gratis a la Línea 135, o al cero once, cincuenta y dos setenta y cinco, once treinta y cinco, las veinticuatro horas. Si hay peligro inmediato, llama al 911. Y si puedes, escríbele ahora a alguien de confianza. Te dejo los números en pantalla.` };
  }
  let m;
  if ((m = /\b(?:me llamo|mi nombre es|soy) ([A-ZÁÉÍÓÚÑa-záéíóúñ]+)/i.exec(text)) && !/soy (una|un|muy|re|de)\b/i.test(text)) {
    const n = m[1].charAt(0).toUpperCase() + m[1].slice(1);
    ctx.name = n;
    return { text: `¡Encantada, ${n}! Me gusta tu nombre. Cuéntame, ¿cómo viene tu día?` };
  }
  if (/(sos|eres) (humana|una persona|real)|are you (human|real)/.test(t)) return { text: 'No, soy una inteligencia artificial. No tengo cuerpo ni vida propia, pero sí te escucho con atención y recuerdo lo que me cuentas si me das permiso. ¿Seguimos?' };
  if (/\b(triste|mal|baj[oó]n|angustiad|deprimid|sol[oa]\b|ansios|estresad|cansad|agotad)/.test(t)) {
    return { text: pick([
      `Uf, ${name ? name + ', ' : ''}lo siento. ¿Quieres contarme qué pasó o prefieres que pensemos algo para despejarte un rato?`,
      'Gracias por decírmelo. A veces ayuda ponerlo en palabras. ¿Qué es lo que más te pesa hoy?',
      'Te entiendo. Tomate un segundo, respira hondo. ¿Hay alguien cerca con quien puedas hablar también?'
    ]) };
  }
  if (/\b(feliz|bien|genial|contento|contenta|buen[ií]simo|excelente|re bien)\b/.test(t)) return { text: pick(['¡Qué bueno! Me alegra mucho. ¿Qué fue lo mejor de tu día?', '¡Bien ahí! Cuéntame más, ¿qué te puso de buen humor?']) };
  if (/^(hola|buenas|buen d[ií]a|qu[eé] tal|che)\b/.test(t.trim())) return { text: greeting({ name, memory: ctx.memory }) };
  if (/(gracias|te agradezco)/.test(t)) return { text: pick(['¡De nada! Para eso estoy.', 'Un placer. ¿Algo más que quieras charlar?']) };
  if (/(chau|me voy|hasta ma[ñn]ana|nos vemos|adi[oó]s)/.test(t)) return { text: `¡Chau${name ? ', ' + name : ''}! Me encantó charlar. Cuando quieras, me llamas de nuevo.`, bye: true };
  if (/(c[oó]digo|programa|javascript|python|funci[oó]n|api|bug|error|html|css|sql)/.test(t)) {
    return { text: 'Me encanta la programación. Por voz te puedo explicar la idea: primero definimos qué entra y qué sale, después los casos borde y al final escribimos las pruebas. Si quieres el código completo, abre el chat escrito y te lo armo ahí. ¿Qué estás construyendo?' };
  }
  const calc = /\d\s*[-+*/x×÷^]\s*\d/.test(t) ? localAnswer(text, 'es') : null;
  if (calc && /=/.test(calc)) return { text: calc.replace(/\*\*/g, '').split('\n')[0] + '. ¿Algo más?' };
  if (/\b(qu[eé] (pens[aá]s|opin[aá]s)|qu[eé] onda con|sentido de la vida|filosof|existencia|universo)\b/.test(t)) {
    return { text: pick(['Qué buena pregunta. Te soy honesta: tengo ideas, no certezas. Me parece que el sentido se construye con lo que elegimos cuidar todos los días. ¿Tú qué piensas?', 'Me encanta ir a fondo con eso. Para empezar, ¿qué te hizo pensar en esto hoy?']) };
  }
  if (/\b(trabajo|laburo|facultad|estudio|examen|proyecto|entrevista)\b/.test(t)) return { text: pick(['Cuéntame más de eso. ¿Qué es lo que más te entusiasma y qué lo que más te preocupa?', '¿Y cómo te sientes con eso? Si quieres, lo ordenamos en pasos chiquitos.']) };
  return { text: pick([
    'Te escucho. Cuéntame un poco más.',
    'Mmm, interesante. ¿Por qué lo dices?',
    'Entiendo. ¿Y cómo te hace sentir eso?',
    'Mientras activamos mi conversación completa, te respondo de forma más simple; igual te sigo con atención. ¿Qué más pasó?'
  ]) };
}
