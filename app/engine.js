/* AgentiCuántico · conexión con el servidor (worker-v2) + motor de demostración local */
(function () {
  "use strict";
  var CFG = window.AC_CONFIG || {};
  var S = { live: false, checked: false, caps: null, base: "" };

  function sleep(ms, signal) {
    return new Promise(function (res, rej) {
      var t = setTimeout(res, ms);
      if (signal) signal.addEventListener("abort", function () { clearTimeout(t); rej(abortErr()); }, { once: true });
    });
  }
  function abortErr() { var e = new Error("aborted"); e.name = "AbortError"; return e; }

  /* ---------- Servidor ---------- */
  function init() {
    var forceDemo = /[?&]demo=1\b/.test(location.search);
    var base = String(CFG.API_BASE || "").replace(/\/+$/, "");
    if (forceDemo || !base || !window.fetch) { S.checked = true; return Promise.resolve(S); }
    var cached = null;
    try { cached = JSON.parse(sessionStorage.getItem("ac.health") || "null"); } catch (e) { /* ignore */ }
    if (cached && cached.base === base && Date.now() - cached.at < 5 * 60 * 1000) {
      S.live = !!cached.ok; S.caps = cached.caps; S.base = cached.ok ? base : ""; S.checked = true;
      return Promise.resolve(S);
    }
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, CFG.HEALTH_TIMEOUT_MS || 3000);
    return fetch(base + "/api/health", { signal: ctrl.signal, credentials: "include", cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var ok = !!(j && j.ok);
        S.live = ok && !!j.llm; S.caps = ok ? j : null; S.base = S.live ? base : "";
      })
      .catch(function () { S.live = false; S.caps = null; S.base = ""; })
      .then(function () {
        clearTimeout(timer); S.checked = true;
        try { sessionStorage.setItem("ac.health", JSON.stringify({ base: base, ok: S.live, caps: S.caps, at: Date.now() })); } catch (e) { /* ignore */ }
        return S;
      });
  }

  function api(path, opts) {
    opts = opts || {};
    return fetch(S.base + path, {
      method: opts.method || "GET", credentials: "include", signal: opts.signal,
      headers: opts.body ? { "Content-Type": "application/json" } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
  }

  function readSSE(res, onData, signal) {
    var reader = res.body.getReader(), dec = new TextDecoder(), buf = "";
    function pump() {
      return reader.read().then(function (r) {
        if (r.done) return;
        buf += dec.decode(r.value, { stream: true });
        var i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          var block = buf.slice(0, i); buf = buf.slice(i + 2);
          block.split("\n").forEach(function (line) {
            if (line.indexOf("data:") !== 0) return;
            var p = line.slice(5).trim();
            if (!p) return;
            if (p === "[DONE]") { onData("[DONE]"); return; }
            try { onData(JSON.parse(p)); } catch (e) { /* ignore */ }
          });
        }
        if (signal && signal.aborted) { reader.cancel().catch(function () {}); throw abortErr(); }
        return pump();
      });
    }
    return pump();
  }

  function noticeFor(status, code) {
    if (status === 401) return "login";
    if (status === 402) return "upgrade";
    if (status === 429) return "quota";
    return "fallback";
  }

  /* ---------- Chat ---------- */
  function chat(o) {
    if (!S.live) return demoChat(o);
    var text = "";
    return api("/api/chat", { method: "POST", signal: o.signal, body: { messages: o.messages, agent: "general", lang: langCode(o.lang), mode: o.mode === "deep" ? "deep" : "fast" } })
      .then(function (res) {
        if (!res.ok || !res.body) {
          return res.json().catch(function () { return {}; }).then(function (j) {
            return demoChat(o).then(function (r) { r.notice = noticeFor(res.status, j && j.error); return r; });
          });
        }
        return readSSE(res, function (d) {
          if (d && typeof d.delta === "string") { text += d.delta; o.onDelta(d.delta); }
        }, o.signal).then(function () {
          if (!text) return demoChat(o).then(function (r) { r.notice = "fallback"; return r; });
          return { text: text, demo: false };
        });
      })
      .catch(function (e) {
        if (e && e.name === "AbortError") throw e;
        if (text) return { text: text, demo: false };
        markOffline();
        return demoChat(o).then(function (r) { r.notice = "fallback"; return r; });
      });
  }

  /* ---------- Agente ---------- */
  function agent(o) {
    if (!S.live) return demoAgent(o);
    var got = false;
    return api("/api/agent/run", { method: "POST", signal: o.signal, body: { task: o.task, lang: langCode(o.lang) } })
      .then(function (res) {
        if (!res.ok || !res.body) {
          return res.json().catch(function () { return {}; }).then(function (j) {
            return demoAgent(o).then(function (r) { r.notice = noticeFor(res.status, j && j.error); return r; });
          });
        }
        return readSSE(res, function (d) { if (d !== "[DONE]") { got = true; o.onEvent(d); } }, o.signal).then(function () { return { demo: false }; });
      })
      .catch(function (e) {
        if (e && e.name === "AbortError") throw e;
        if (got) return { demo: false };
        markOffline();
        return demoAgent(o).then(function (r) { r.notice = "fallback"; return r; });
      });
  }

  function markOffline() { S.live = false; S.base = ""; try { sessionStorage.removeItem("ac.health"); } catch (e) { /* ignore */ } if (window.AC_onConnection) window.AC_onConnection(); }
  function langCode(l) { return l === "en" ? "en" : l === "pt" ? "pt-BR" : "es"; }

  /* ---------- Cuenta y pagos ---------- */
  function me() {
    if (!S.live) return Promise.resolve(null);
    return api("/api/auth/me").then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { return j && j.user; }).catch(function () { return null; });
  }
  function magicLink(email, lang) {
    if (!S.live) return Promise.resolve({ demo: true });
    return api("/api/auth/magic-link", { method: "POST", body: { email: email, lang: langCode(lang) } })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, error: j.error }; }); })
      .catch(function () { return { ok: false, error: "network" }; });
  }
  function googleUrl() { return S.live && S.caps && S.caps.auth && S.caps.auth.google ? S.base + "/api/auth/google/start" : null; }
  function logout() { if (!S.live) return Promise.resolve(); return api("/api/auth/logout", { method: "POST", body: {} }).catch(function () {}); }
  function subscribe(provider, plan) {
    if (!S.live) return Promise.resolve({ demo: true });
    var ready = S.caps && S.caps.billing && S.caps.billing[provider];
    if (!ready) return Promise.resolve({ notReady: true });
    return api("/api/billing/" + provider + "/subscribe", { method: "POST", body: { plan: plan } })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return r.status === 401 ? { needLogin: true } : r.ok && j.url ? { url: j.url } : { notReady: true }; }); })
      .catch(function () { return { notReady: true }; });
  }

  /* =====================================================================
   *  Motor de demostración local (sin red)
   * ===================================================================== */
  function streamText(text, onDelta, signal) {
    var parts = text.match(/\s+|[^\s]+/g) || [];
    var i = 0, sent = "";
    function step() {
      if (signal && signal.aborted) return Promise.reject(abortErr());
      if (i >= parts.length) return Promise.resolve();
      var n = 1 + Math.floor(Math.random() * 3), chunk = "";
      for (var k = 0; k < n && i < parts.length; k++) chunk += parts[i++];
      onDelta(chunk); sent += chunk;
      var inCode = (sent.match(/```/g) || []).length % 2 === 1;
      return sleep(inCode ? 8 : 14 + Math.random() * 22, signal).then(step);
    }
    return step();
  }

  function calc(expr) {
    var src = String(expr).replace(/,/g, ".").replace(/×/g, "*").replace(/÷/g, "/").replace(/x(?=\s*\d)/gi, "*").replace(/\s+/g, "");
    if (!src || src.length > 200 || !/^[0-9+\-*/%^().a-z]+$/i.test(src)) throw new Error("bad");
    var i = 0, FN = { sqrt: Math.sqrt, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil, log: Math.log10, ln: Math.log };
    function peek() { return src[i]; }
    function expect(c) { if (src[i] !== c) throw new Error("bad"); i++; }
    function primary() {
      if (peek() === "(") { i++; var v = add(); expect(")"); return v; }
      if (peek() === "-") { i++; return -power(); }
      var m = /^(\d+\.?\d*|\.\d+)/.exec(src.slice(i));
      if (m) { i += m[0].length; var num = parseFloat(m[0]); if (peek() === "%" && !/\d|\(/.test(src[i + 1] || "")) { i++; return num / 100; } return num; }
      var w = /^[a-z]+/i.exec(src.slice(i));
      if (w) { var nm = w[0].toLowerCase(); i += w[0].length; if (nm === "pi") return Math.PI; if (FN[nm]) { expect("("); var x = add(); expect(")"); return FN[nm](x); } }
      throw new Error("bad");
    }
    function power() { var b = primary(); if (peek() === "^") { i++; return Math.pow(b, power()); } return b; }
    function mul() { var v = power(); while (peek() === "*" || peek() === "/" || peek() === "%") { var op = src[i++], r = power(); v = op === "*" ? v * r : op === "/" ? v / r : v % r; } return v; }
    function add() { var v = mul(); while (peek() === "+" || peek() === "-") { var op = src[i++], r = mul(); v = op === "+" ? v + r : v - r; } return v; }
    var v = add();
    if (i !== src.length || !isFinite(v)) throw new Error("bad");
    return Math.round(v * 1e10) / 1e10;
  }
  function findExpr(text) {
    var m = String(text).match(/(?:sqrt\()?[\d.,]+\s*%?(?:\s*[-+*/^×÷x%]\s*\(?\s*[\d.,]+\s*\)?%?)+\)?/i);
    return m ? m[0].trim() : null;
  }
  function fmtNum(n, lang) { try { return n.toLocaleString(lang === "en" ? "en-US" : lang === "pt" ? "pt-BR" : "es-AR", { maximumFractionDigits: 6 }); } catch (e) { return String(n); } }

  var P = (CFG.PRICES || { pro: { usd: 10, ars: 15600 }, empresa: { usd: 30, ars: 46800 } });
  var MAIL = CFG.CONTACT_EMAIL || "agenticuantico@gmail.com";
  function L(lang, es, en, pt) { return lang === "en" ? en : lang === "pt" ? pt : es; }
  function ars(n) { return "ARS " + fmtNum(n, "es"); }

  function codeAnswer(q, lang) {
    var t = q.toLowerCase();
    if (/python|\.py\b/.test(t)) return L(lang, "Acá tenés un ejemplo en **Python**, listo para copiar:", "Here's a **Python** example, ready to copy:", "Aqui está um exemplo em **Python**, pronto para copiar:") +
      "\n\n```python\nimport re\n\nEMAIL_RE = re.compile(r\"^[^\\s@]+@[^\\s@]+\\.[a-z]{2,}$\", re.IGNORECASE)\n\ndef es_email_valido(email: str) -> bool:\n    \"\"\"Devuelve True si el email tiene un formato válido.\"\"\"\n    return bool(EMAIL_RE.match(email.strip()))\n\ndef ordenar_precios(precios: list[float]) -> list[float]:\n    \"\"\"Ordena de menor a mayor sin modificar la lista original.\"\"\"\n    return sorted(precios)\n\nif __name__ == \"__main__\":\n    print(es_email_valido(\"hola@agenticuantico.dev.ar\"))  # True\n    print(ordenar_precios([46800, 0, 15600]))           # [0, 15600, 46800]\n```\n\n" +
      L(lang, "¿Querés que lo adapte a tu caso o le agregue tests?", "Want me to adapt it to your case or add tests?", "Quer que eu adapte ao seu caso ou adicione testes?");
    if (/\bsql\b|consulta|query/.test(t)) return L(lang, "Ejemplo en **SQL**:", "**SQL** example:", "Exemplo em **SQL**:") +
      "\n\n```sql\n-- Clientes con más compras en los últimos 30 días\nSELECT c.nombre, COUNT(p.id) AS compras, SUM(p.total) AS total\nFROM clientes c\nJOIN pedidos p ON p.cliente_id = c.id\nWHERE p.fecha >= CURRENT_DATE - INTERVAL '30 days'\nGROUP BY c.nombre\nORDER BY total DESC\nLIMIT 10;\n```";
    if (/html|css|landing|p[aá]gina|web/.test(t)) return L(lang, "Una base **HTML + CSS** responsive:", "A responsive **HTML + CSS** starter:", "Uma base **HTML + CSS** responsiva:") +
      "\n\n```html\n<!doctype html>\n<html lang=\"es\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n  <title>Mi página</title>\n  <style>\n    body { margin: 0; font-family: system-ui, sans-serif; background: #EDEEF5; color: #18181b; }\n    .hero { min-height: 70vh; display: grid; place-items: center; text-align: center; padding: 24px; }\n    .btn { background: #9fff00; color: #18181b; padding: 12px 22px; border-radius: 999px; font-weight: 700; text-decoration: none; }\n  </style>\n</head>\n<body>\n  <section class=\"hero\">\n    <div>\n      <h1>Hola 👋</h1>\n      <p>Tu propuesta en una línea.</p>\n      <a class=\"btn\" href=\"#contacto\">Empezar</a>\n    </div>\n  </section>\n</body>\n</html>\n```\n\n" +
      L(lang, "Tip: en **modo Agente** te genero el archivo completo con vista previa.", "Tip: in **Agent mode** I generate the full file with a preview.", "Dica: no **modo Agente** eu gero o arquivo completo com pré-visualização.");
    return L(lang, "Ejemplo en **JavaScript**:", "**JavaScript** example:", "Exemplo em **JavaScript**:") +
      "\n\n```javascript\n/**\n * Valida un email con una expresión regular simple.\n * @param {string} email\n * @returns {boolean}\n */\nfunction esEmailValido(email) {\n  const re = /^[^\\s@]+@[^\\s@]+\\.[a-z]{2,}$/i;\n  return re.test(String(email).trim());\n}\n\nconsole.log(esEmailValido('hola@agenticuantico.dev.ar')); // true\nconsole.log(esEmailValido('sin-arroba.com'));             // false\n```\n\n" +
      L(lang, "¿Lo querés en TypeScript o con validación del dominio?", "Want it in TypeScript or with domain validation?", "Quer em TypeScript ou com validação de domínio?");
  }

  function demoAnswer(q, lang, mode) {
    var t = String(q || "").toLowerCase();
    var expr = findExpr(q);
    if (expr && (/calcul|cu[aá]nto|how much|what is|quanto|^[\d\s.,+\-*/^()%x×÷]+=?\s*\??$/i.test(t) || /^[\d\s.,+\-*/^()%x×÷]+$/.test(t.trim()))) {
      try {
        var v = calc(expr);
        return L(lang, "**" + expr + " = " + fmtNum(v, lang) + "**\n\nLo calculé con la calculadora segura de AgentiCuántico (sin ejecutar código).", "**" + expr + " = " + fmtNum(v, lang) + "**\n\nComputed with AgentiCuántico's safe calculator (no code execution).", "**" + expr + " = " + fmtNum(v, lang) + "**\n\nCalculei com a calculadora segura da AgentiCuántico (sem executar código).");
      } catch (e) { /* not math */ }
    }
    if (/c[oó]digo|\bcode\b|funci[oó]n|function|javascript|typescript|python|script|\bhtml\b|\bcss\b|\bsql\b|programa|fun[cç][aã]o/.test(t)) return codeAnswer(q, lang);
    if (/plan|precio|pre[cç]o|price|pricing|cu[aá]nto cuesta|how much|suscrip|subscri|assinatura|pagar|\bpay\b|mercado ?pago|paypal|pro\b|empresa/.test(t)) {
      return L(lang,
        "Estos son los planes de **AgentiCuántico**:\n\n| Plan | Mercado Pago | PayPal | Incluye |\n|---|---|---|---|\n| Gratis | $0 | USD 0 | Agente general · 20 mensajes/día |\n| **Pro** | " + ars(P.pro.ars) + "/mes | USD " + P.pro.usd + "/mes | Agentes comercial, técnico y analista · 500 mensajes/día |\n| Empresa | " + ars(P.empresa.ars) + "/mes | USD " + P.empresa.usd + "/mes | Todo Pro · 3000 mensajes/día · soporte prioritario |\n\n- **Mercado Pago** cobra en pesos (ARS).\n- **PayPal** cobra en dólares (USD).\n- Suscripción mensual, cancelás cuando quieras.\n\nPodés contratar desde **Mejorar plan** en el menú de la izquierda.",
        "Here are **AgentiCuántico**'s plans:\n\n| Plan | Mercado Pago | PayPal | Includes |\n|---|---|---|---|\n| Free | $0 | USD 0 | General agent · 20 messages/day |\n| **Pro** | " + ars(P.pro.ars) + "/mo | USD " + P.pro.usd + "/mo | Sales, technical and analyst agents · 500 messages/day |\n| Business | " + ars(P.empresa.ars) + "/mo | USD " + P.empresa.usd + "/mo | Everything in Pro · 3000 messages/day · priority support |\n\nMercado Pago charges in ARS, PayPal in USD. Monthly, cancel anytime. Use **Upgrade plan** in the left menu.",
        "Estes são os planos da **AgentiCuántico**:\n\n| Plano | Mercado Pago | PayPal | Inclui |\n|---|---|---|---|\n| Grátis | $0 | USD 0 | Agente geral · 20 mensagens/dia |\n| **Pro** | " + ars(P.pro.ars) + "/mês | USD " + P.pro.usd + "/mês | Agentes comercial, técnico e analista · 500 mensagens/dia |\n| Empresa | " + ars(P.empresa.ars) + "/mês | USD " + P.empresa.usd + "/mês | Tudo do Pro · 3000 mensagens/dia · suporte prioritário |\n\nMercado Pago cobra em ARS e PayPal em USD. Mensal, cancele quando quiser.");
    }
    if (/^(hola|buenas|buen d[ií]a|hello|hi|hey|ol[aá]|oi)\b/.test(t.trim())) {
      return L(lang, "¡Hola! Soy **AgentiCuántico**. Puedo responder preguntas, escribir código, calcular y, en **modo Agente**, planificar y ejecutar tareas completas paso a paso.\n\n¿Con qué arrancamos?",
        "Hi! I'm **AgentiCuántico**. I can answer questions, write code, calculate and, in **Agent mode**, plan and run whole tasks step by step.\n\nWhere do we start?",
        "Olá! Sou a **AgentiCuántico**. Posso responder perguntas, escrever código, calcular e, no **modo Agente**, planejar e executar tarefas completas passo a passo.\n\nPor onde começamos?");
    }
    if (/agente|agent|automatiz|automat|tarea|task|tarefa/.test(t)) {
      return L(lang, "El **modo Agente** trabaja así:\n\n1. **Pensando** — entiende la tarea y arma un plan.\n2. **Buscando** — lee páginas públicas que le indiques.\n3. **Escribiendo código** — redacta el entregable (código, HTML o informe).\n4. **Verificando** — revisa el resultado y lo corrige una vez si hace falta.\n\nVas viendo cada paso en la **computadora del agente** y al final recibís los archivos para descargar. Elegí **Agente** arriba y describí tu tarea.",
        "**Agent mode** works like this:\n\n1. **Thinking** — understands the task and makes a plan.\n2. **Searching** — reads public pages you point to.\n3. **Writing code** — drafts the deliverable (code, HTML or report).\n4. **Verifying** — reviews and fixes it once if needed.\n\nYou follow every step on the **agent's computer** and get downloadable files at the end.",
        "O **modo Agente** funciona assim:\n\n1. **Pensando** — entende a tarefa e monta um plano.\n2. **Buscando** — lê páginas públicas indicadas.\n3. **Escrevendo código** — cria o entregável.\n4. **Verificando** — revisa e corrige uma vez se precisar.\n\nVocê acompanha cada passo no **computador do agente**.");
    }
    if (/segur|privacidad|privacy|privacidade|datos|data|dados/.test(t)) {
      return L(lang, "Sobre **seguridad y privacidad**:\n\n- Tus chats se guardan **en tu dispositivo** (almacenamiento local del navegador). Podés exportarlos o borrarlos en *Configuración → Datos*.\n- El servidor no expone claves al navegador; los pagos se procesan en **Mercado Pago** o **PayPal**.\n- El agente solo usa herramientas seguras: leer páginas públicas, calculadora y formateo de código.",
        "On **security and privacy**:\n\n- Your chats are stored **on your device**. Export or delete them in *Settings → Data*.\n- No keys ever reach the browser; payments run on **Mercado Pago** or **PayPal**.\n- The agent only uses safe tools: reading public pages, a calculator and code formatting.",
        "Sobre **segurança e privacidade**:\n\n- Seus chats ficam **no seu dispositivo**. Exporte ou exclua em *Configurações → Dados*.\n- Nenhuma chave chega ao navegador; pagamentos via **Mercado Pago** ou **PayPal**.\n- O agente usa só ferramentas seguras.");
    }
    if (/contact|correo|mail|escrib|comercial|hablar con|falar/.test(t)) {
      return L(lang, "Podés escribirnos a **" + MAIL + "** con el asunto **\"Consulta Comercial\"**. Contanos tu empresa y qué querés automatizar, y te respondemos con una propuesta.",
        "Email us at **" + MAIL + "** with the subject **\"Consulta Comercial\"**. Tell us about your company and what you want to automate.",
        "Escreva para **" + MAIL + "** com o assunto **\"Consulta Comercial\"**. Conte sobre sua empresa e o que quer automatizar.");
    }
    if (/voz|voice|llamad|call|habl|speak/.test(t)) {
      return L(lang, "Tenés dos opciones de voz:\n\n- 🎙️ **Dictar**: tocá el micrófono y hablá; el texto aparece en el cuadro.\n- 🔊 **Modo voz**: conversación manos libres; te respondo en voz alta con la voz que elijas (*Femenina* o *Masculina*) en Configuración.",
        "Two voice options:\n\n- 🎙️ **Dictate**: tap the mic and talk.\n- 🔊 **Voice mode**: hands-free conversation; I answer aloud with the voice you choose in Settings.",
        "Duas opções de voz:\n\n- 🎙️ **Ditar**: toque no microfone e fale.\n- 🔊 **Modo voz**: conversa sem mãos; respondo em voz alta com a voz escolhida.");
    }
    if (/qu[eé] es|qu[eé] hace|qui[eé]n|agenticu[aá]ntico|what is|who are|o que [eé]|sobre (vos|ti|voc)|about/.test(t)) {
      return L(lang, "**AgentiCuántico** es una plataforma argentina de IA agéntica para personas y empresas:\n\n- 💬 **Chat** con respuestas rápidas o **razonamiento profundo**.\n- 🤖 **Modo Agente**: planifica, ejecuta y verifica tareas (código, páginas web, informes).\n- 🧑‍💼 **Agentes especializados** (comercial, técnico, analista) en el plan Pro.\n- 🎙️ **Voz**: dictado y conversación manos libres.\n- 💳 Pagos con **Mercado Pago** (ARS) o **PayPal** (USD).\n\n¿Querés probar el modo Agente con una tarea real?",
        "**AgentiCuántico** is an Argentine agentic AI platform for people and companies:\n\n- 💬 **Chat** with fast answers or **deep reasoning**.\n- 🤖 **Agent mode**: plans, runs and verifies tasks (code, web pages, reports).\n- 🧑‍💼 **Specialised agents** on Pro.\n- 🎙️ **Voice**: dictation and hands-free talk.\n- 💳 Payments via **Mercado Pago** (ARS) or **PayPal** (USD).",
        "A **AgentiCuántico** é uma plataforma argentina de IA agêntica para pessoas e empresas:\n\n- 💬 **Chat** rápido ou com **raciocínio profundo**.\n- 🤖 **Modo Agente**: planeja, executa e verifica tarefas.\n- 🧑‍💼 **Agentes especializados** no Pro.\n- 🎙️ **Voz**.\n- 💳 **Mercado Pago** (ARS) ou **PayPal** (USD).");
    }
    if (/demo|conect|servidor|server|backend|api\b|funciona/.test(t)) {
      return L(lang, "Ahora estoy en **modo demo**: respondo en tu navegador, sin servidor. Cuando el servidor está conectado, el chat usa un modelo de lenguaje completo, el modo Agente ejecuta herramientas reales y se habilitan cuentas y pagos. El cambio es automático.",
        "I'm in **demo mode**: answering in your browser, no server. When the server is connected, chat uses a full language model, Agent mode runs real tools, and accounts and payments turn on — automatically.",
        "Estou em **modo demo**: respondo no seu navegador. Com o servidor conectado, o chat usa um modelo completo, o Agente executa ferramentas reais e contas e pagamentos são ativados — automaticamente.");
    }
    var topic = String(q || "").trim().replace(/\s+/g, " ").slice(0, 80);
    return L(lang,
      "Buena pregunta sobre «" + topic + "». En **modo demo** respondo con información de AgentiCuántico, ejemplos de código y cálculos; las respuestas abiertas con IA completa se activan cuando el servidor está conectado.\n\nMientras tanto, probá:\n\n- *Explicame qué es AgentiCuántico*\n- *Escribí una función en Python que ordene precios*\n- *¿Cuánto es 15600 × 3?*\n- Elegí **Agente** arriba y pedile *una landing page para tu negocio*.",
      "Good question about “" + topic + "”. In **demo mode** I answer about AgentiCuántico, code samples and math; open-ended AI answers turn on when the server is connected.\n\nTry:\n\n- *Explain what AgentiCuántico is*\n- *Write a Python function that sorts prices*\n- *What is 15600 × 3?*\n- Pick **Agent** above and ask for *a landing page for your business*.",
      "Boa pergunta sobre «" + topic + "». No **modo demo** respondo sobre a AgentiCuántico, exemplos de código e cálculos; respostas abertas com IA completa ligam com o servidor conectado.\n\nExperimente:\n\n- *Explique o que é a AgentiCuántico*\n- *Escreva uma função em Python que ordene preços*\n- *Quanto é 15600 × 3?*");
  }

  function demoChat(o) {
    var last = (o.messages || []).filter(function (m) { return m.role === "user"; }).pop();
    var text = demoAnswer(last ? last.content.split("\n\n[")[0] : "", o.lang, o.mode);
    var wait = o.mode === "deep" ? 1400 + Math.random() * 900 : 350 + Math.random() * 300;
    return sleep(wait, o.signal).then(function () { return streamText(text, o.onDelta, o.signal); }).then(function () { return { text: text, demo: true }; });
  }

  /* ---------- Agente de demostración ---------- */
  function deliverableFor(task) {
    var t = task.toLowerCase();
    if (/landing|p[aá]gina web|\bhtml\b|sitio web|website|web page|p[aá]gina/.test(t)) return { name: "index.html", kind: "html" };
    if (/python|\.py\b/.test(t)) return { name: "script.py", kind: "code" };
    if (/javascript|node|typescript|\bjs\b|c[oó]digo|\bcode\b|script|funci[oó]n|function|programa/.test(t)) return { name: "script.js", kind: "code" };
    return { name: "informe.md", kind: "markdown" };
  }
  function titleFrom(task) { var s = task.replace(/^(arm[aá]|hac[eé]|cre[aá]|escrib[ií]|build|write|make|create|crie|fa[cç]a|escreva)\s+(me\s+)?/i, "").trim(); return s.charAt(0).toUpperCase() + s.slice(1, 70); }

  function artifactContent(d, task, lang, calcLine) {
    var title = titleFrom(task);
    if (d.kind === "html") {
      var biz = (task.match(/para (una|un|mi)?\s*([\wáéíóúñ ]{3,40})/i) || [])[2] || L(lang, "tu negocio", "your business", "seu negócio");
      biz = biz.trim(); var Biz = biz.charAt(0).toUpperCase() + biz.slice(1);
      return "<!doctype html>\n<html lang=\"" + (lang === "en" ? "en" : lang === "pt" ? "pt-BR" : "es") + "\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n  <title>" + Biz + "</title>\n  <style>\n    :root { --ink: #18181b; --bg: #f7f7fb; --accent: #9fff00; }\n    * { box-sizing: border-box; }\n    body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, sans-serif; color: var(--ink); background: var(--bg); }\n    header { display: flex; justify-content: space-between; align-items: center; padding: 18px 6vw; }\n    .logo { font-weight: 800; letter-spacing: -.02em; }\n    .hero { padding: 12vh 6vw; display: grid; gap: 18px; max-width: 760px; }\n    h1 { font-size: clamp(2rem, 6vw, 3.6rem); line-height: 1.05; margin: 0; }\n    p { font-size: 1.1rem; color: #52525b; margin: 0; }\n    .btn { display: inline-block; background: var(--accent); color: var(--ink); padding: 14px 24px; border-radius: 999px; font-weight: 700; text-decoration: none; width: max-content; }\n    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; padding: 0 6vw 10vh; }\n    .card { background: #fff; border: 1px solid #e4e4e7; border-radius: 18px; padding: 22px; }\n    footer { padding: 24px 6vw; color: #71717a; font-size: .9rem; }\n  </style>\n</head>\n<body>\n  <header><span class=\"logo\">" + Biz + "</span><a class=\"btn\" href=\"#contacto\">" + L(lang, "Contacto", "Contact", "Contato") + "</a></header>\n  <section class=\"hero\">\n    <h1>" + L(lang, "Bienvenido a ", "Welcome to ", "Bem-vindo a ") + Biz + "</h1>\n    <p>" + L(lang, "Una propuesta clara, cercana y de calidad. Conocenos y visitanos hoy.", "A clear, friendly, quality offer. Meet us and visit today.", "Uma proposta clara, próxima e de qualidade. Conheça-nos hoje.") + "</p>\n    <a class=\"btn\" href=\"#contacto\">" + L(lang, "Quiero saber más", "Tell me more", "Quero saber mais") + "</a>\n  </section>\n  <section class=\"cards\">\n    <div class=\"card\"><h3>" + L(lang, "Calidad", "Quality", "Qualidade") + "</h3><p>" + L(lang, "Productos seleccionados con cuidado.", "Carefully selected products.", "Produtos selecionados com cuidado.") + "</p></div>\n    <div class=\"card\"><h3>" + L(lang, "Atención", "Service", "Atendimento") + "</h3><p>" + L(lang, "Te atendemos como en casa.", "We treat you like family.", "Atendemos como em casa.") + "</p></div>\n    <div class=\"card\" id=\"contacto\"><h3>" + L(lang, "Contacto", "Contact", "Contato") + "</h3><p>" + L(lang, "Escribinos y te respondemos en el día.", "Write to us, we reply the same day.", "Escreva e respondemos no mesmo dia.") + "</p></div>\n  </section>\n  <footer>© " + new Date().getFullYear() + " " + Biz + "</footer>\n</body>\n</html>\n";
    }
    if (d.name.slice(-3) === ".py") {
      return "\"\"\"\n" + title + "\nGenerado por el agente de AgentiCuántico (modo demo).\n\"\"\"\n\nfrom typing import Iterable\n\n\ndef ordenar_precios(precios: Iterable[float], descendente: bool = False) -> list[float]:\n    \"\"\"Devuelve los precios ordenados, ignorando valores inválidos.\"\"\"\n    validos = [float(p) for p in precios if isinstance(p, (int, float)) and p >= 0]\n    return sorted(validos, reverse=descendente)\n\n\ndef formatear_ars(valor: float) -> str:\n    \"\"\"Formatea un número como pesos argentinos: 15600 -> 'ARS 15.600'.\"\"\"\n    return \"ARS \" + f\"{valor:,.0f}\".replace(\",\", \".\")\n\n\nif __name__ == \"__main__\":\n    precios = [46800, 0, 15600, -1]\n    for p in ordenar_precios(precios):\n        print(formatear_ars(p))\n";
    }
    if (d.kind === "code") {
      return "/**\n * " + title + "\n * Generado por el agente de AgentiCuántico (modo demo).\n */\n\n/** Ordena una lista de precios sin modificar la original. */\nexport function ordenarPrecios(precios, { descendente = false } = {}) {\n  const validos = precios.filter((p) => Number.isFinite(p) && p >= 0);\n  return [...validos].sort((a, b) => (descendente ? b - a : a - b));\n}\n\n/** Formatea un número como pesos argentinos: 15600 -> \"ARS 15.600\". */\nexport function formatearARS(valor) {\n  return 'ARS ' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(valor);\n}\n\n/** Valida un email con una expresión simple. */\nexport function esEmailValido(email) {\n  return /^[^\\s@]+@[^\\s@]+\\.[a-z]{2,}$/i.test(String(email).trim());\n}\n\n// Ejemplo de uso\nconsole.log(ordenarPrecios([46800, 0, 15600]).map(formatearARS));\n";
    }
    return "# " + title + "\n\n> " + L(lang, "Informe generado por el agente de AgentiCuántico en modo demo. Con el servidor conectado, el contenido se redacta con IA completa.", "Report generated by the AgentiCuántico agent in demo mode. With the server connected, the content is written by the full AI.", "Relatório gerado pelo agente da AgentiCuántico em modo demo.") + "\n\n## " + L(lang, "Objetivo", "Goal", "Objetivo") + "\n\n" + task + "\n\n" + (calcLine ? "## " + L(lang, "Cálculo", "Calculation", "Cálculo") + "\n\n" + calcLine + "\n\n" : "") +
      "## " + L(lang, "Plan de acción", "Action plan", "Plano de ação") + "\n\n" + L(lang,
        "1. **Diagnóstico**: relevar procesos, tiempos y costos actuales.\n2. **Prioridades**: elegir 1–2 tareas repetitivas con mayor impacto.\n3. **Piloto**: automatizarlas con un agente durante 2–4 semanas.\n4. **Medición**: comparar horas ahorradas, errores y satisfacción.\n5. **Escala**: extender a otras áreas con lo aprendido.",
        "1. **Diagnosis**: map current processes, times and costs.\n2. **Priorities**: pick 1–2 repetitive tasks with the most impact.\n3. **Pilot**: automate them with an agent for 2–4 weeks.\n4. **Measure**: hours saved, errors and satisfaction.\n5. **Scale**: extend to other areas.",
        "1. **Diagnóstico**: mapear processos, tempos e custos.\n2. **Prioridades**: escolher 1–2 tarefas repetitivas de maior impacto.\n3. **Piloto**: automatizar com um agente por 2–4 semanas.\n4. **Medição**: horas economizadas, erros e satisfação.\n5. **Escala**: estender a outras áreas.") +
      "\n\n## " + L(lang, "Riesgos y cuidados", "Risks", "Riscos") + "\n\n" + L(lang, "- Revisar siempre la información importante.\n- No cargar datos sensibles sin un acuerdo de privacidad.\n- Definir un responsable humano por proceso.", "- Always review important information.\n- Don't load sensitive data without a privacy agreement.\n- Assign a human owner per process.", "- Revisar sempre informações importantes.\n- Não carregar dados sensíveis sem acordo de privacidade.\n- Definir um responsável humano por processo.") +
      "\n\n## " + L(lang, "Próximos pasos", "Next steps", "Próximos passos") + "\n\n- [ ] " + L(lang, "Validar el objetivo con el equipo", "Validate the goal with the team", "Validar o objetivo com a equipe") + "\n- [ ] " + L(lang, "Elegir el primer proceso piloto", "Choose the first pilot process", "Escolher o primeiro processo piloto") + "\n- [ ] " + L(lang, "Escribir a " + MAIL + " para una propuesta", "Email " + MAIL + " for a proposal", "Escrever para " + MAIL) + "\n";
  }

  function demoAgent(o) {
    var task = o.task, lang = o.lang, sig = o.signal, emit = o.onEvent;
    var d = deliverableFor(task);
    var url = (task.match(/https?:\/\/[^\s<>"')\]]+/i) || [])[0];
    var expr = findExpr(task), calcLine = null;
    var steps = [{ title: L(lang, "Entender la tarea y definir criterios", "Understand the task and criteria", "Entender a tarefa e os critérios"), phase: "thinking", tool: "think" }];
    if (url) steps.push({ title: L(lang, "Leer la página indicada", "Read the given page", "Ler a página indicada"), phase: "searching", tool: "fetch" });
    else steps.push({ title: L(lang, "Reunir contexto y referencias", "Gather context and references", "Reunir contexto e referências"), phase: "searching", tool: "think" });
    if (expr) steps.push({ title: L(lang, "Calcular", "Calculate", "Calcular"), phase: "thinking", tool: "calc" });
    steps.push({ title: L(lang, "Redactar " + d.name, "Write " + d.name, "Escrever " + d.name), phase: "coding", tool: "write" });
    if (d.kind !== "markdown") steps.push({ title: L(lang, "Formatear el código", "Format the code", "Formatar o código"), phase: "coding", tool: "format" });
    steps.forEach(function (s, i) { s.id = i + 1; });
    var content = "";
    var p = sleep(500, sig).then(function () { emit({ type: "plan", steps: steps, deliverable: d }); });
    steps.forEach(function (s) {
      p = p.then(function () {
        emit({ type: "step", id: s.id, status: "running", phase: s.phase, title: s.title });
        return sleep(600 + Math.random() * 500, sig);
      }).then(function () {
        if (s.tool === "think" && s.phase === "thinking") emit({ type: "log", id: s.id, text: L(lang, "Objetivo: ", "Goal: ", "Objetivo: ") + task.slice(0, 160) + "\n" + L(lang, "Entregable: ", "Deliverable: ", "Entregável: ") + d.name + "\n" + L(lang, "Criterios: claro, completo, listo para usar.", "Criteria: clear, complete, ready to use.", "Critérios: claro, completo, pronto para usar.") });
        else if (s.tool === "think") emit({ type: "log", id: s.id, text: L(lang, "Contexto reunido a partir de la tarea y buenas prácticas. (Modo demo: sin búsqueda en internet.)", "Context gathered from the task and best practices. (Demo mode: no web search.)", "Contexto reunido da tarefa e boas práticas. (Modo demo: sem busca na web.)") });
        else if (s.tool === "fetch") emit({ type: "log", id: s.id, text: "GET " + url + "\n" + L(lang, "Modo demo: la página no se descarga. Con el servidor conectado, el agente lee su contenido público.", "Demo mode: the page isn't downloaded. With the server connected, the agent reads its public content.", "Modo demo: a página não é baixada. Com o servidor conectado, o agente lê o conteúdo público.") });
        else if (s.tool === "calc") { try { var v = calc(expr); calcLine = expr + " = " + fmtNum(v, lang); } catch (e) { calcLine = expr + " = ?"; } emit({ type: "log", id: s.id, text: calcLine }); }
        else if (s.tool === "write") { content = artifactContent(d, task, lang, calcLine); emit({ type: "log", id: s.id, text: d.name + " · " + content.length + " chars\n" + content.slice(0, 600) }); }
        else if (s.tool === "format") emit({ type: "log", id: s.id, text: L(lang, "Código formateado (indentación de 2 espacios, sin espacios finales).", "Code formatted (2-space indent, no trailing spaces).", "Código formatado.") });
        emit({ type: "step", id: s.id, status: "done", phase: s.phase, title: s.title });
      });
    });
    var vid = steps.length + 1, vt = L(lang, "Verificar el resultado", "Verify the result", "Verificar o resultado");
    return p.then(function () {
      emit({ type: "step", id: vid, status: "running", phase: "verifying", title: vt });
      return sleep(800, sig);
    }).then(function () {
      emit({ type: "log", id: vid, text: "OK · " + L(lang, "el entregable cumple los criterios.", "the deliverable meets the criteria.", "o entregável cumpre os critérios.") });
      emit({ type: "step", id: vid, status: "done", phase: "verifying", title: vt });
      emit({ type: "artifact", name: d.name, mime: d.kind === "html" ? "text/html" : d.kind === "markdown" ? "text/markdown" : d.name.slice(-3) === ".py" ? "text/x-python" : "text/javascript", content: content });
      var summary = L(lang,
        "Listo. Preparé **" + d.name + "** siguiendo el plan: entendí la tarea, reuní contexto, " + (calcLine ? "calculé (" + calcLine + "), " : "") + "lo redacté y lo verifiqué.\n\n" + (d.kind === "html" ? "Abrilo con **Vista previa** o descargalo y subilo a tu hosting." : d.kind === "markdown" ? "Podés descargarlo y editarlo en cualquier editor." : "Descargalo y ejecutalo; las funciones están comentadas.") + "\n\n_Modo demo: el contenido es una plantilla. Con el servidor conectado, el agente lo redacta con IA a medida._",
        "Done. I prepared **" + d.name + "** following the plan: understood the task, gathered context, " + (calcLine ? "calculated (" + calcLine + "), " : "") + "wrote it and verified it.\n\n_Demo mode: the content is a template. With the server connected, the agent writes it with full AI._",
        "Pronto. Preparei **" + d.name + "** seguindo o plano: entendi a tarefa, reuni contexto, " + (calcLine ? "calculei (" + calcLine + "), " : "") + "escrevi e verifiquei.\n\n_Modo demo: o conteúdo é um modelo. Com o servidor conectado, o agente escreve com IA completa._");
      return streamText(summary, function (c) { emit({ delta: c }); }, sig);
    }).then(function () { emit({ type: "done" }); return { demo: true }; });
  }

  window.AC_ENGINE = {
    state: S, init: init, chat: chat, agent: agent, me: me, magicLink: magicLink, googleUrl: googleUrl, logout: logout, subscribe: subscribe,
    _demoAnswer: demoAnswer, _calc: calc
  };
})();
