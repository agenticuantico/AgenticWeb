/* AgentiCuántico · hero neuronal clásico sincronizado con el chat (en espera / pensando / hablando) */
  var IMG_W = 1376, IMG_H = 768;           // tamaño real de la foto del hero
  var POS_Y = 0.30;                         // object-position: center 30%
  var STATES = {
    idle: { status: "En espera · escribí en el chat", detail: "Conectado al chat", sub: "Vías neuronales en línea · Lista", color: "#9fff00", speed: 1 },
    thinking: { status: "Pensando…", detail: "Puede tardar unos segundos", sub: "Vías neuronales en proceso · Pensando…", color: "#a855f7", speed: 2.6 },
    speaking: { status: "Respondiendo", detail: "Por escrito y con voz", sub: "Vías neuronales en respuesta · Explicando", color: "#22c55e", speed: 1.8 }
  };
  var current = "idle";
  var idleTimer = null;

  function $(id) { return document.getElementById(id); }

  function setState(name) {
    var s = STATES[name] || STATES.idle;
    current = name;
    var st = $("heroHudStatus"), dt = $("heroHudDetail"), dot = $("heroHudDot");
    if (st) st.textContent = s.status;
    if (dt) dt.textContent = s.detail;
    if (dot) { dot.style.background = s.color; dot.style.boxShadow = "0 0 10px " + s.color; }
  }

  // ---- Canvas de sinapsis sobre el cerebro dorado ----
  // Nodos en coordenadas de la foto original (zona del árbol dorado).
  var NODES = [
    [742, 236], [760, 205], [712, 198], [786, 178], [728, 262], [770, 252], [694, 230], [806, 224],
    [748, 290], [720, 160], [790, 145], [668, 200], [826, 196], [700, 280], [760, 320], [836, 262],
    [655, 245], [812, 300], [735, 128], [870, 230], [680, 160], [858, 170], [775, 110], [640, 210]
  ];

  function initCanvas() {
    var canvas = $("heroNeuralCanvas"), stage = $("heroVisualWrapper");
    if (!canvas || !stage || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0, h = 0, scale = 1, offX = 0, offY = 0;
    var pts = [];

    function layout() {
      var r = stage.getBoundingClientRect();
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scale = Math.max(w / IMG_W, h / IMG_H);
      offX = (w - IMG_W * scale) / 2;
      offY = (h - IMG_H * scale) * POS_Y;
      pts = NODES.map(function (n, i) {
        return { x: offX + n[0] * scale, y: offY + n[1] * scale, ph: i * 0.77, r: 2.2 + (i % 4) * 0.7 };
      });
    }
    layout();
    window.addEventListener("resize", layout);

    var links = [];
    for (var i = 0; i < NODES.length; i++) {
      for (var j = i + 1; j < NODES.length; j++) {
        var d = Math.hypot(NODES[i][0] - NODES[j][0], NODES[i][1] - NODES[j][1]);
        if (d < 62) links.push([i, j]);
      }
    }
    var sparks = [];
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var t0 = performance.now();

    function frame(now) {
      var s = STATES[current] || STATES.idle;
      var t = (now - t0) / 1000 * s.speed;
      ctx.clearRect(0, 0, w, h);
      var color = s.color;
      // conexiones
      ctx.lineWidth = 1;
      links.forEach(function (l) {
        var a = pts[l[0]], b = pts[l[1]];
        if (!a || !b) return;
        var alpha = 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(t * 2 + a.ph));
        ctx.strokeStyle = hexA(color, alpha);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      });
      // chispas que viajan por las conexiones
      if (!reduce && links.length && Math.random() < 0.08 * s.speed) {
        var lk = links[(Math.random() * links.length) | 0];
        sparks.push({ a: lk[0], b: lk[1], p: 0 });
      }
      sparks = sparks.filter(function (sp) {
        sp.p += 0.025 * s.speed;
        var a = pts[sp.a], b = pts[sp.b];
        if (!a || !b || sp.p > 1) return false;
        var x = a.x + (b.x - a.x) * sp.p, y = a.y + (b.y - a.y) * sp.p;
        ctx.fillStyle = hexA(color, 0.95);
        ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();
        return true;
      });
      // nodos
      pts.forEach(function (p) {
        var pulse = 0.55 + 0.45 * Math.sin(t * 2.4 + p.ph);
        var r = p.r * (0.85 + 0.35 * pulse);
        ctx.shadowColor = color; ctx.shadowBlur = 10 * pulse;
        ctx.fillStyle = hexA(color, 0.55 + 0.4 * pulse);
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.shadowBlur = 0;
      if (!reduce && onscreen && !document.hidden) requestAnimationFrame(frame); else running = false;
    }
    var onscreen = true, running = true;
    function kick() { if (!running && onscreen && !document.hidden && !reduce) { running = true; requestAnimationFrame(frame); } }
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { onscreen = es[0].isIntersecting; kick(); }).observe(stage);
    document.addEventListener("visibilitychange", kick);
    requestAnimationFrame(frame);
  }

  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a.toFixed(3) + ")";
  }

  // ---- Inclinación 3D suave del hero (solo puntero fino) ----
  function initTilt() {
    var stage = $("heroVisualWrapper"), inner = $("heroVisualInner");
    if (!stage || !inner) return;
    if (window.matchMedia && !window.matchMedia("(pointer: fine)").matches) return;
    stage.addEventListener("mousemove", function (e) {
      var r = stage.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      inner.style.transform = "perspective(1000px) rotateX(" + (-y * 4).toFixed(2) + "deg) rotateY(" + (x * 5).toFixed(2) + "deg)";
    });
    stage.addEventListener("mouseleave", function () { inner.style.transform = ""; });
  }

  // ---- Hero conectado al chat ----
  function initHeroLink() {
    var stage = $("heroVisualWrapper");
    if (!stage) return;
    stage.addEventListener("click", function () {
      var chat = $("chat"); if (chat) chat.scrollIntoView({ behavior: "smooth", block: "start" });
      var input = document.querySelector("#homeChat textarea"); if (input) setTimeout(function () { try { input.focus({ preventScroll: true }); } catch (e) {} }, 500);
    });
  }


export function setNeuralState(name) { setState(name); }
export function initNeuralHero() { initCanvas(); initTilt(); initHeroLink(); setState("idle"); }
