/*
 * AgentiCuantico · configuración del sitio estático
 *
 * API_BASE es la única constante a tocar para conectar un backend:
 *   ""                               -> modo demostración local (sin servidor)
 *   "https://api.agenticuantico.dev.ar" -> todas las llamadas /api/* van a ese backend
 *
 * En modo demostración ninguna llamada /api/* sale a la red: se responden acá
 * mismo con datos públicos, sin errores en pantalla ni en la consola.
 */
const API_BASE = "";

(function () {
  "use strict";

  var base = String(API_BASE || "").replace(/\/+$/, "");
  var DEMO = base === "";
  window.AGENTIC_DEMO = DEMO;
  window.AGENTIC_API_BASE = base;

  var CONTACT = "agenticuantico@gmail.com";
  var SOON = "Disponible próximamente. Mientras tanto escribinos a " + CONTACT + ".";

  var AGENTS = [{"id": "astra-6-quantum", "name": "Astra-6 Quantum", "role": "Arquitecto Full-Stack & Ingeniero Backend Cuántico", "avatar": "⚡", "description": "Modelo al nivel de GPT-6 / Astra propio: Node.js, TypeScript, Cloudflare Workers, microservicios, bases de datos reactivas y APIs de ultra baja latencia.", "skills": ["Node.js & Cloudflare Workers", "TypeScript Full-Stack", "Arquitectura distribuida & SQL", "Testing y refactorización"]}, {"id": "quantum-vision-designer", "name": "Quantum Vision Designer", "role": "Diseñador Web UI/UX & Artista Gráfico Ilustrativo", "avatar": "🎨", "description": "Diseño visual de vanguardia estilo Astra: interfaces futuristas, Tailwind CSS mobile-first, gráficos vectoriales SVG, arte conceptual y prototipado responsive.", "skills": ["UI / UX Design 2026", "Tailwind CSS & Mobile Responsive", "Ilustración Vectorial & SVG", "Sistemas de Diseño & Micro-interacciones"]}, {"id": "supergrok-quantum-analyst", "name": "SuperGrok Quantum Analyst", "role": "Estratega Cuántico de Mercados & Tokenomics", "avatar": "🌌", "description": "Inspirado en SuperGrok 2026: análisis profundo de mercados globales, modelos de tokenomics, optimización de capital, growth hacking y proyecciones.", "skills": ["Análisis de Mercados Globales", "Estrategia B2B & Tokenomics", "Optimización de Algoritmos", "Growth Hacking Predictivo"]}, {"id": "cybersentinel-2026", "name": "CyberSentinel 2026", "role": "Especialista en Ciberseguridad & Zero-Trust", "avatar": "🛡️", "description": "Auditoría de vulnerabilidades en tiempo real, protección de secretos, pentesting automatizado y arquitectura zero-trust.", "skills": ["Auditoría de Seguridad", "Zero-Trust & Encriptación", "Detección de Fugas & Secretos", "Hardening de Servidores"]}, {"id": "devbot", "name": "DevBot", "role": "Programador Fullstack & Debugger", "avatar": "💻", "description": "Experto en TypeScript, depuración y scripts de automatización (desactivado por defecto en el chat).", "skills": ["TypeScript / Node.js", "Debugging & refactorización", "Scripts de automatización"]}, {"id": "pixelux", "name": "PixelUX", "role": "Diseñador Web & Especialista UI/UX", "avatar": "✨", "description": "Diseño centrado en el usuario, interfaces modernas, sistemas de diseño y accesibilidad WCAG AAA.", "skills": ["UI / UX Design", "Tailwind CSS", "Micro-interacciones", "Accesibilidad"]}, {"id": "aura", "name": "Aura", "role": "Ilustradora Digital & Branding Artístico", "avatar": "🖌️", "description": "Creación de identidad visual, estética digital, diseño de logotipos y arte gráfico conceptual.", "skills": ["Identidad de marca & SVG", "Paletas cromáticas & branding", "Generación de conceptos visuales"]}, {"id": "growthbot", "name": "GrowthBot", "role": "Especialista en Marketing Cuántico & SEO 2026", "avatar": "📈", "description": "Estrategias de posicionamiento, SEO técnico y semántico, copywriting persuasivo y conversión.", "skills": ["SEO técnico & On-page", "Copywriting comercial", "Embudos de conversión"]}, {"id": "closer", "name": "Closer", "role": "Consultor de Negocios & Ventas B2B", "avatar": "💼", "description": "Desarrollo de propuestas comerciales, pitches de venta, pricing para empresas y negociación estratégica.", "skills": ["Pitch comercial B2B", "Estrategia de pricing", "Cierre de negocios"]}];

  var nativeFetch = window.fetch ? window.fetch.bind(window) : null;

  function apiPath(input) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    try {
      var u = new URL(url, window.location.href);
      if (u.origin === window.location.origin && u.pathname.indexOf("/api/") === 0) return u.pathname + u.search;
    } catch (e) {}
    return null;
  }

  function jsonResponse(data, status) {
    return new Response(JSON.stringify(data), {
      status: status || 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  function readBody(init) {
    try { return init && init.body ? JSON.parse(init.body) : {}; } catch (e) { return {}; }
  }

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function has(t, words) {
    for (var i = 0; i < words.length; i++) if (t.indexOf(words[i]) !== -1) return true;
    return false;
  }

  var NOTE = "\n\n(Modo demostración: respuesta generada en tu navegador con información pública. La super inteligencia completa se habilita al conectar el servidor.)";

  var PLANS =
    "Planes de AgentiCuantico (ciclo de 30 días, renovación automática cancelable en 1 clic):\n\n" +
    "• Free (Básico) · Gratis: chat estándar, análisis de archivos hasta 5 MB y síntesis de voz en español argentino.\n" +
    "• Pro Agéntico · $14.990 ARS / USD 15: llamada de voz a voz en vivo, DevBot y PixelUX, conexión con GitHub, archivos hasta 25 MB y modo Pensar más.\n" +
    "• Business Team · $34.990 ARS / USD 35: llamadas ilimitadas, equipo de 5 agentes (DevBot, PixelUX, Aura, GrowthBot y Closer), GitHub y Cloudflare, salas multi-agente.\n" +
    "• Quantum Enterprise · $89.990 ARS / USD 90: todo Business ilimitado, agentes autónomos personalizados, SLA empresarial y soporte prioritario 24/7.\n\n" +
    "Detalle completo en la página Planes. Para contratar, escribinos a " + CONTACT + ".";

  var ABOUT =
    "AgentiCuantico es una super inteligencia artificial agéntica con razonamiento profundo y un equipo de agentes especializados.\n\n" +
    "Sirve para conversar, programar soluciones con código, analizar archivos, diseñar interfaces, preparar propuestas comerciales y coordinar agentes expertos que trabajan en conjunto. " +
    "También ofrece interacción de voz a voz en español argentino.\n\n" +
    "Podés ver los planes en la sección Planes o escribirnos a " + CONTACT + ".";

  var HOW =
    "Cómo funciona AgentiCuantico:\n\n" +
    "1. Escribís o dictás tu orden en el chat.\n" +
    "2. La super inteligencia analiza el pedido (con el modo 🧠 Pensar más activa razonamiento profundo).\n" +
    "3. Si elegís agentes con el botón +, cada especialista aporta su parte y colaboran entre sí.\n" +
    "4. Recibís la respuesta con código listo para copiar, y si querés, también por voz.";

  var CONTACT_TXT =
    "Podés contactar al equipo comercial de AgentiCuantico por email: " + CONTACT + "\n\n" +
    "Contanos tu empresa, qué necesitás y un plazo aproximado, y te respondemos a la brevedad.";

  function agentsText() {
    return "Equipo de agentes especializados de AgentiCuantico:\n\n" +
      AGENTS.map(function (a) { return "• " + a.avatar + " " + a.name + " · " + a.role; }).join("\n") +
      "\n\nLos activás desde el botón + del chat, opción Equipo de Agentes con Rol.";
  }

  function codeSample(t) {
    if (has(t, ["python"])) {
      return "Te dejo un ejemplo base en Python, listo para adaptar:\n\n" +
        "```python\n" +
        "def resumen_ventas(ventas):\n" +
        "    \"\"\"Devuelve total, promedio y la venta más alta.\"\"\"\n" +
        "    if not ventas:\n" +
        "        return {\"total\": 0, \"promedio\": 0, \"maxima\": 0}\n" +
        "    total = sum(ventas)\n" +
        "    return {\n" +
        "        \"total\": total,\n" +
        "        \"promedio\": round(total / len(ventas), 2),\n" +
        "        \"maxima\": max(ventas),\n" +
        "    }\n\n" +
        "print(resumen_ventas([1200, 850, 2300]))\n" +
        "```";
    }
    if (has(t, ["javascript", " js", "funcion", "script"])) {
      return "Un ejemplo base en JavaScript:\n\n" +
        "```javascript\n" +
        "function formatearPrecio(valor, moneda = \"ARS\") {\n" +
        "  return new Intl.NumberFormat(\"es-AR\", {\n" +
        "    style: \"currency\",\n" +
        "    currency: moneda\n" +
        "  }).format(valor);\n" +
        "}\n\n" +
        "console.log(formatearPrecio(14990)); // $ 14.990,00\n" +
        "```";
    }
    return "A continuación, te presento una estructura de banner de 300×250 px (formato estándar \"Medium Rectangle\") con una animación de entrada suave y un botón de llamada a la acción (CTA) con efecto hover.\n\n" +
      "### Código del Banner (HTML y CSS)\n\n" +
      "```html\n" +
      "<!DOCTYPE html>\n" +
      "<html lang=\"es\">\n" +
      "<head>\n" +
      "  <meta charset=\"UTF-8\">\n" +
      "  <style>\n" +
      "    .banner-ad {\n" +
      "      width: 300px;\n" +
      "      height: 250px;\n" +
      "      border-radius: 16px;\n" +
      "      background: linear-gradient(135deg, #18181b, #2563eb);\n" +
      "      color: #fff;\n" +
      "      font-family: system-ui, sans-serif;\n" +
      "      display: flex;\n" +
      "      flex-direction: column;\n" +
      "      justify-content: center;\n" +
      "      align-items: center;\n" +
      "      animation: entrada 0.8s ease-out both;\n" +
      "    }\n" +
      "    .cta-button {\n" +
      "      margin-top: 14px;\n" +
      "      padding: 10px 20px;\n" +
      "      border: none;\n" +
      "      border-radius: 999px;\n" +
      "      background-color: #9fff00;\n" +
      "      color: #18181b;\n" +
      "      font-weight: bold;\n" +
      "      text-decoration: none;\n" +
      "      transition: background-color 0.2s, transform 0.2s;\n" +
      "    }\n" +
      "    .cta-button:hover {\n" +
      "      background-color: #ffffff;\n" +
      "      transform: scale(1.05);\n" +
      "    }\n" +
      "    @keyframes entrada {\n" +
      "      from { opacity: 0; transform: translateY(12px); }\n" +
      "      to { opacity: 1; transform: translateY(0); }\n" +
      "    }\n" +
      "  </style>\n" +
      "</head>\n" +
      "<body>\n" +
      "  <div class=\"banner-ad\">\n" +
      "    <strong>Tu idea merece un equipo</strong>\n" +
      "    <a class=\"cta-button\" href=\"#\">Empezar ahora</a>\n" +
      "  </div>\n" +
      "</body>\n" +
      "</html>\n" +
      "```";
  }

  function demoAnswer(message) {
    var t = " " + norm(message) + " ";
    if (!t.trim()) return ABOUT;
    if (has(t, ["precio", "plan", "cuanto", "costo", "cuesta", "pagar", "suscrip", "tarifa", "mercado pago", "paypal"])) return PLANS + NOTE;
    if (has(t, ["contact", "email", "mail", "correo", "comercial", "presupuesto", "cotiz", "hablar con", "telefono", "whatsapp"])) return CONTACT_TXT + NOTE;
    if (has(t, ["agente", "equipo", "devbot", "pixelux", "aura", "growthbot", "closer"])) return agentsText() + NOTE;
    if (has(t, ["codigo", "html", "css", "banner", "programa", "javascript", "python", "script", "funcion", "landing", "pagina web", "sitio web"])) return codeSample(t) + NOTE;
    if (has(t, ["como funciona", "como se usa", "como uso", "pasos"])) return HOW + NOTE;
    if (has(t, ["voz", "llamada", "hablar", "microfono"])) {
      return "Podés presionar el micrófono para dictar tu orden y escuchar la respuesta con la voz del navegador. Las llamadas de voz a voz en vivo con el agente forman parte de los planes Pro, Business y Quantum." + NOTE;
    }
    if (has(t, ["que es", "quien", "agenticuantico", "agentic", "que haces", "que podes", "para que sirve", "servicio"])) return ABOUT + NOTE;
    if (has(t, [" hola ", " buenas", " buen dia", " buenos", " hey ", " saludos"])) {
      return "¡Hola! Soy AgentiCuantico. Puedo contarte qué es la plataforma, cómo funciona, los planes y el equipo de agentes, o mostrarte un ejemplo de código. ¿Por dónde empezamos?" + NOTE;
    }
    return "Recibí tu orden: \"" + String(message).slice(0, 160) + "\".\n\n" +
      "Esta es la versión pública de demostración, así que puedo responder sobre qué es AgentiCuantico, cómo funciona, planes, agentes y contacto, o mostrarte un ejemplo de código. " +
      "Para resolver pedidos completos con la super inteligencia, escribinos a " + CONTACT + "." + NOTE;
  }
  window.agenticDemoAnswer = demoAnswer;

  async function demoApi(path, init) {
    var method = ((init && init.method) || "GET").toUpperCase();
    var body = readBody(init);
    var p = path.split("?")[0];

    if (p === "/api/public-chat") {
      await wait(650 + Math.random() * 500);
      return jsonResponse({ ok: true, demo: true, answer: demoAnswer(body.message) });
    }
    if (p === "/api/chat/agents") {
      await wait(800);
      var ids = body.activeAgentIds || [];
      var answer = demoAnswer(body.message);
      var responses = ids.map(function (id, i) {
        var a = AGENTS.filter(function (x) { return x.id === id; })[0];
        if (!a) return null;
        var reply = i === 0 ? answer : (a.name + " revisó la propuesta desde su especialidad (" + a.role + ") y la complementará cuando el servidor esté conectado.");
        return { agentName: a.name, agentRole: a.role, avatar: a.avatar, reply: reply };
      }).filter(Boolean);
      return jsonResponse({ ok: responses.length > 0, demo: true, responses: responses });
    }
    if (p === "/api/agents") return jsonResponse({ ok: true, demo: true, agents: AGENTS });
    if (p === "/api/user/trial-config") return jsonResponse({ ok: false, demo: true });
    if (p === "/api/auth/user") return jsonResponse({ ok: false, demo: true, user: null });
    if (p === "/api/auth/logout") return jsonResponse({ ok: true, demo: true });
    if (p.indexOf("/api/auth/") === 0) {
      return jsonResponse({ ok: false, demo: true, error: "El acceso con cuenta (login y registro) estará disponible próximamente." }, 503);
    }
    if (p === "/api/contact") {
      return jsonResponse({ ok: false, demo: true, error: "El formulario estará disponible próximamente. Escribinos a " + CONTACT + " y te respondemos a la brevedad." }, 503);
    }
    if (p.indexOf("/api/integrations/") === 0) {
      return jsonResponse({ ok: false, demo: true, message: "Las integraciones con GitHub y Cloudflare estarán disponibles próximamente.", error: SOON }, 503);
    }
    if (p === "/api/voice/live-call") {
      await wait(500);
      var r = demoAnswer(body.transcript).replace(/```[\s\S]*?```/g, "Te preparé el código en el chat.").replace(NOTE, "");
      return jsonResponse({ ok: true, demo: true, agentName: "AgentiCuantico", reply: r.slice(0, 420) });
    }
    if (p.indexOf("/api/orders") === 0 || p.indexOf("/api/checkout") === 0 || p.indexOf("/api/user/") === 0) {
      return jsonResponse({ ok: false, demo: true, error: "Los pagos online estarán disponibles próximamente. Para contratar un plan escribinos a " + CONTACT + "." }, 503);
    }
    return jsonResponse({ ok: false, demo: true, error: SOON }, 503);
  }

  if (nativeFetch) {
    window.fetch = function (input, init) {
      var path = apiPath(input);
      if (path === null) return nativeFetch(input, init);
      if (DEMO) {
        return demoApi(path, init).catch(function () {
          return jsonResponse({ ok: false, demo: true, error: SOON }, 503);
        });
      }
      return nativeFetch(base + path, Object.assign({ credentials: "include" }, init || {})).catch(function () {
        return jsonResponse({ ok: false, error: "No se pudo conectar con el servidor. Intentá de nuevo en unos minutos." }, 503);
      });
    };
  }

  // Evita que una promesa rechazada en la UI rompa la consola.
  window.addEventListener("unhandledrejection", function (e) { e.preventDefault(); });
})();
