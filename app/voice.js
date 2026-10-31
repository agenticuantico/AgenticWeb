/*
 * AgentiCuántico · voz (solo femenina) compartida por /app/ y el chat de la portada.
 *
 * 1) Si el servidor anuncia TTS (GET /api/health -> tts), usa POST {API_BASE}/api/tts (ElevenLabs, voz femenina).
 * 2) Si no, usa la mejor voz FEMENINA del navegador para el idioma elegido.
 * Idioma principal: español (Argentina) 🇦🇷.
 */
(function () {
  "use strict";
  var CFG = window.AC_CONFIG || {};
  var KEY = "ac.voice.lang";

  var LANGS = [
    { code: "es-AR", flag: "🇦🇷", name: "Español (Argentina)", short: "ES", ui: "es", sr: "es-AR", fallback: ["es-AR", "es-419", "es-US", "es-MX", "es-ES", "es"] },
    { code: "es-ES", flag: "🇪🇸", name: "Español (España)", short: "ES", ui: "es", sr: "es-ES", fallback: ["es-ES", "es"] },
    { code: "en-US", flag: "🇺🇸", name: "English (US)", short: "EN", ui: "en", sr: "en-US", fallback: ["en-US", "en-GB", "en"] },
    { code: "pt-BR", flag: "🇧🇷", name: "Português (Brasil)", short: "PT", ui: "pt", sr: "pt-BR", fallback: ["pt-BR", "pt-PT", "pt"] },
    { code: "it-IT", flag: "🇮🇹", name: "Italiano", short: "IT", ui: "es", sr: "it-IT", fallback: ["it-IT", "it"] },
    { code: "fr-FR", flag: "🇫🇷", name: "Français", short: "FR", ui: "es", sr: "fr-FR", fallback: ["fr-FR", "fr-CA", "fr"] },
    { code: "de-DE", flag: "🇩🇪", name: "Deutsch", short: "DE", ui: "es", sr: "de-DE", fallback: ["de-DE", "de"] }
  ];

  // Nombres de voces femeninas conocidas (Apple, Microsoft, Google, Android, Samsung).
  var FEMALE = /female|femenin|feminin|mujer|woman|paulina|daniela|florencia|agustina|martina|m[oó]nica|helena|sabina|francisca|luciana|elena|samantha|victoria|joana|am[eé]lie|alice|\banna\b|camila|valeria|valentina|isabela|isabella|laura|luc[ií]a|elvira|dalia|marisol|ximena|sof[ií]a|zira|\baria\b|jenny|michelle|\bemma\b|\bava\b|allison|susan|karen|moira|tessa|fiona|serena|raquel|leticia|fernanda|thalita|francisca|brenda|vit[oó]ria|elsa|federica|alessia|gisela|marlene|katja|hedda|petra|amala|seraphina|julie|virginie|audrey|aur[eé]lie|c[eé]line|elo[iï]se|denise|chantal|marie|nora|ines|in[eé]s|carmen|esperanza|angelica|ang[eé]lica|paloma|lola|abril|renata|catalina|beatriz|clara|irene|lupe|penelope|pen[eé]lope|salli|joanna|kendra|kimberly|ivy|ruth|nicole|olivia|amy|lea|l[eé]a|vicki|marlene|carla|bianca|giorgia|silvia|lisa|luisa|yuna|kyoko|google espa|google us english|google portugu|google italiano|google fran|google deutsch/i;
  var MALE = /\bmale\b|masculin|hombre|\bman\b|jorge|diego|juan|carlos|pablo|ra[uú]l|\bdaniel\b|\balex\b|\bdavid\b|\bfred\b|thomas|\btom\b|felipe|ricardo|antonio|enrique|[aá]lvaro|gonzalo|tom[aá]s|mateo|\bluca\b|cosimo|rocko|grandpa|eddy|reed|ralph|albert|bruce|junior|aaron|arthur|gordon|oliver|rishi|xander|\blee\b|henri|claude|stefan|conrad|killian|markus|yannick|\bryan\b|\bguy\b|davis|\btony\b|jason|christopher|\beric\b|roger|steffan|brian|andrew|duarte|humberto|nicolau|julio|fabio|valerio|benigno|giuseppe|cristiano|lorenzo|alessio|gerardo|liberto|emilio|elias|alonso|arnau|dario|sa[uú]l|\bteo\b|yago|pelayo|\bgael\b|matthew|joey|justin|kevin|\bjoe\b|brian|russell|geraint|giorgio|hans|enrico|thierry|mathieu|paul\b|\bpaulo\b|reinaldo|\bluiz\b|\bfelix\b/i;
  var QUALITY = /natural|neural|premium|enhanced|mejorad|wavenet|studio|online/i;

  // Banderas en SVG (los emojis de banderas no se ven en Windows).
  var FLAGS = {
    "es-AR": '<rect width="30" height="20" fill="#74ACDF"/><rect y="6.67" width="30" height="6.66" fill="#fff"/><circle cx="15" cy="10" r="2.3" fill="#F6B40E" stroke="#85340A" stroke-width=".4"/>',
    "es-ES": '<rect width="30" height="20" fill="#AA151B"/><rect y="5" width="30" height="10" fill="#F1BF00"/>',
    "en-US": '<rect width="30" height="20" fill="#fff"/><g fill="#B22234"><rect width="30" height="1.54"/><rect y="3.08" width="30" height="1.54"/><rect y="6.15" width="30" height="1.54"/><rect y="9.23" width="30" height="1.54"/><rect y="12.31" width="30" height="1.54"/><rect y="15.38" width="30" height="1.54"/><rect y="18.46" width="30" height="1.54"/></g><rect width="13" height="10.77" fill="#3C3B6E"/><g fill="#fff"><circle cx="2.6" cy="2.2" r=".6"/><circle cx="6.5" cy="2.2" r=".6"/><circle cx="10.4" cy="2.2" r=".6"/><circle cx="4.55" cy="5.4" r=".6"/><circle cx="8.45" cy="5.4" r=".6"/><circle cx="2.6" cy="8.6" r=".6"/><circle cx="6.5" cy="8.6" r=".6"/><circle cx="10.4" cy="8.6" r=".6"/></g>',
    "pt-BR": '<rect width="30" height="20" fill="#009C3B"/><path d="M15 2.2 27.4 10 15 17.8 2.6 10Z" fill="#FFDF00"/><circle cx="15" cy="10" r="4.3" fill="#002776"/><path d="M10.9 9.2c2.8-.6 5.9-.2 8.3 1.3" stroke="#fff" stroke-width=".8" fill="none"/>',
    "it-IT": '<rect width="10" height="20" fill="#009246"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#CE2B37"/>',
    "fr-FR": '<rect width="10" height="20" fill="#0055A4"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#EF4135"/>',
    "de-DE": '<rect width="30" height="6.67" fill="#000"/><rect y="6.67" width="30" height="6.67" fill="#DD0000"/><rect y="13.33" width="30" height="6.67" fill="#FFCE00"/>'
  };
  function flagSvg(code, w) {
    w = w || 24; var h = Math.round(w * 2 / 3);
    return '<svg class="ac-flag" width="' + w + '" height="' + h + '" viewBox="0 0 30 20" role="img" aria-label="' + byCode(code).name + '" style="border-radius:3px;box-shadow:0 0 0 1px rgba(0,0,0,.12);display:inline-block;vertical-align:middle;flex:0 0 auto"><g>' + (FLAGS[byCode(code).code] || "") + "</g></svg>";
  }

  var S = { lang: null, audio: null, ctx: null, raf: 0, levelCb: null, speaking: false, listeners: [], token: 0 };

  function byCode(code) { return LANGS.find(function (l) { return l.code === code; }) || LANGS[0]; }
  function getLang() {
    if (!S.lang) { var v = null; try { v = localStorage.getItem(KEY); } catch (e) { /* ignore */ } S.lang = byCode(v || "es-AR").code; }
    return S.lang;
  }
  function setLang(code) {
    S.lang = byCode(code).code;
    try { localStorage.setItem(KEY, S.lang); } catch (e) { /* ignore */ }
    S.listeners.forEach(function (fn) { try { fn(S.lang); } catch (e) { /* ignore */ } });
  }
  function onChange(fn) { S.listeners.push(fn); }

  function isMale(v) { return MALE.test(v.name) && !/female|femenin|feminin|mujer/i.test(v.name); }
  function scoreVoice(v, lang) {
    var vl = String(v.lang || "").replace("_", "-").toLowerCase(), best = -1;
    lang.fallback.forEach(function (f, i) {
      var fl = f.toLowerCase();
      if (vl === fl || (fl.length === 2 && vl.indexOf(fl) === 0)) best = Math.max(best, 100 - i * 12);
    });
    if (best < 0) return -1;
    var s = best;
    if (FEMALE.test(v.name)) s += 40;
    if (QUALITY.test(v.name)) s += 25;
    if (/google/i.test(v.name)) s += 15;
    if (v.localService === false) s += 5;
    return s;
  }
  /** Mejor voz femenina del navegador para el idioma; nunca devuelve voces masculinas conocidas. */
  function pickVoice(code, list) {
    var vs = list || (window.speechSynthesis ? speechSynthesis.getVoices() : []);
    var lang = byCode(code || getLang()), best = null, bestScore = -1;
    vs.forEach(function (v) {
      if (isMale(v)) return;
      var sc = scoreVoice(v, lang);
      if (sc > bestScore) { bestScore = sc; best = v; }
    });
    return best;
  }
  function femaleVoices(code, list) {
    var vs = list || (window.speechSynthesis ? speechSynthesis.getVoices() : []), lang = byCode(code || getLang());
    return vs.filter(function (v) { return !isMale(v) && scoreVoice(v, lang) >= 0; });
  }

  function plain(md) {
    return String(md || "").replace(/```[\s\S]*?```/g, " ").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[#*_`>|~]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function ttsAvailable() {
    var E = window.AC_ENGINE, caps = E && E.state && E.state.caps;
    return !!(caps && caps.tts && CFG.API_BASE);
  }

  function emitLevel(v) { if (S.levelCb) try { S.levelCb(v); } catch (e) { /* ignore */ } }
  function stopMeter() { cancelAnimationFrame(S.raf); S.raf = 0; emitLevel(0); }

  function stop() {
    S.token++;
    if (S.audio) { try { S.audio.pause(); } catch (e) { /* ignore */ } S.audio = null; }
    if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    S.speaking = false; stopMeter();
  }

  function speakBrowser(text, o, token) {
    if (!window.speechSynthesis) { o.onEnd && o.onEnd(); return; }
    var lang = byCode(o.lang || getLang());
    var u = new SpeechSynthesisUtterance(text);
    u.lang = lang.code;
    var v = pickVoice(lang.code);
    if (v) u.voice = v;
    u.rate = 1.0;
    u.pitch = v && FEMALE.test(v.name) ? 1.05 : 1.15; // voz sin género conocido: tono un poco más agudo
    var t0 = 0, pulse = 0;
    var tick = function () {
      if (token !== S.token) return;
      var t = (performance.now() - t0) / 1000;
      pulse *= 0.86;
      emitLevel(Math.min(1, 0.25 + 0.35 * Math.abs(Math.sin(t * 9.3)) * Math.abs(Math.sin(t * 3.1 + 1)) + pulse));
      S.raf = requestAnimationFrame(tick);
    };
    u.onstart = function () { S.speaking = true; t0 = performance.now(); tick(); o.onStart && o.onStart(); };
    u.onboundary = function () { pulse = 0.5; };
    u.onend = u.onerror = function () { if (token !== S.token) return; S.speaking = false; stopMeter(); o.onEnd && o.onEnd(); };
    try { speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { o.onEnd && o.onEnd(); }
  }

  function speakServer(text, o, token) {
    var base = String(CFG.API_BASE || "").replace(/\/+$/, "");
    var lang = byCode(o.lang || getLang());
    return fetch(base + "/api/tts", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text.slice(0, 800), lang: lang.code }) })
      .then(function (r) { if (!r.ok) throw new Error("tts " + r.status); return r.blob(); })
      .then(function (blob) {
        if (token !== S.token) return;
        var url = URL.createObjectURL(blob), a = new Audio(url);
        S.audio = a;
        var analyser = null, data = null;
        try {
          var AC = window.AudioContext || window.webkitAudioContext;
          if (AC) {
            S.ctx = S.ctx || new AC();
            var src = S.ctx.createMediaElementSource(a);
            analyser = S.ctx.createAnalyser(); analyser.fftSize = 256;
            src.connect(analyser); analyser.connect(S.ctx.destination);
            data = new Uint8Array(analyser.frequencyBinCount);
            if (S.ctx.state === "suspended") S.ctx.resume();
          }
        } catch (e) { analyser = null; }
        var tick = function () {
          if (token !== S.token) return;
          if (analyser) { analyser.getByteFrequencyData(data); var sum = 0; for (var i = 2; i < 40; i++) sum += data[i]; emitLevel(Math.min(1, sum / (38 * 160))); }
          else emitLevel(0.4 + 0.3 * Math.abs(Math.sin(performance.now() / 90)));
          S.raf = requestAnimationFrame(tick);
        };
        a.onplay = function () { S.speaking = true; tick(); o.onStart && o.onStart(); };
        a.onended = a.onerror = function () { URL.revokeObjectURL(url); if (token !== S.token) return; S.speaking = false; stopMeter(); o.onEnd && o.onEnd(); };
        return a.play();
      });
  }

  /** Habla el texto con voz femenina. o: {lang, onStart, onEnd}. */
  function speak(text, o) {
    o = o || {};
    stop();
    var token = S.token;
    var t = plain(text).slice(0, 2500);
    if (!t) { o.onEnd && o.onEnd(); return; }
    if (ttsAvailable()) {
      speakServer(t, o, token).catch(function () { if (token === S.token) speakBrowser(t, o, token); });
    } else speakBrowser(t, o, token);
  }

  function onLevel(fn) { S.levelCb = fn; }

  if (window.speechSynthesis) {
    try { speechSynthesis.getVoices(); } catch (e) { /* ignore */ }
    try { speechSynthesis.addEventListener("voiceschanged", function () { /* voces cargadas */ }); } catch (e) { /* ignore */ }
  }

  window.AC_VOICE = {
    LANGS: LANGS, byCode: byCode, flagSvg: flagSvg, getLang: getLang, setLang: setLang, onChange: onChange,
    pickVoice: pickVoice, femaleVoices: femaleVoices, isMale: isMale, speak: speak, stop: stop, onLevel: onLevel,
    ttsAvailable: ttsAvailable, plain: plain, isSpeaking: function () { return S.speaking; }
  };
})();
