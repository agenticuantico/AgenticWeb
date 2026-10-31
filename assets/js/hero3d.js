/**
 * Hero background: neural network + quantum orbit particle field (three.js).
 * Performance-aware: fewer particles on mobile, DPR cap, pauses offscreen/hidden,
 * single static frame when prefers-reduced-motion is set.
 */
import * as THREE from '../vendor/three/three.module.min.js';

export function initHero(canvas, { reducedMotion = false } = {}) {
  const mobile = matchMedia('(max-width: 820px)').matches;
  const lowEnd = (navigator.hardwareConcurrency || 4) <= 4;
  const N = mobile ? (lowEnd ? 320 : 460) : 1100;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.5));
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05070c, 0.055);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 0, 11);

  const group = new THREE.Group(); scene.add(group);

  // ----- Nodes -----
  const pos = new Float32Array(N * 3);
  const phase = new Float32Array(N);
  const hue = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    // denser cloud around a "brain" center, plus sparse field
    const dense = Math.random() < 0.55;
    if (dense) {
      const u = Math.random() * Math.PI * 2, v = Math.acos(2 * Math.random() - 1), r = 2.2 + Math.random() * 1.6;
      pos[i * 3] = Math.sin(v) * Math.cos(u) * r * 1.25;
      pos[i * 3 + 1] = Math.cos(v) * r * 0.85;
      pos[i * 3 + 2] = Math.sin(v) * Math.sin(u) * r;
    } else {
      pos[i * 3] = (Math.random() - 0.5) * 22;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2;
    }
    phase[i] = Math.random() * Math.PI * 2;
    hue[i] = Math.random();
  }
  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  nodeGeo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  nodeGeo.setAttribute('aHue', new THREE.BufferAttribute(hue, 1));
  const uniforms = { uTime: { value: 0 }, uPx: { value: renderer.getPixelRatio() } };
  const nodeMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `attribute float aPhase; attribute float aHue; uniform float uTime; uniform float uPx; varying vec3 vCol; varying float vA;
      void main(){ vec3 p = position; p += 0.08*vec3(sin(uTime*0.6+aPhase), cos(uTime*0.5+aPhase*1.3), sin(uTime*0.4+aPhase*0.7));
        vec4 mv = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv;
        float tw = 0.55 + 0.45*sin(uTime*1.8 + aPhase*3.0);
        gl_PointSize = (2.2 + 2.6*tw) * uPx * (9.0 / -mv.z);
        vec3 c1 = vec3(0.486,0.953,1.0); vec3 c2 = vec3(0.357,0.549,1.0); vec3 c3 = vec3(0.659,0.459,1.0);
        vCol = aHue < 0.5 ? mix(c1,c2,aHue*2.0) : mix(c2,c3,(aHue-0.5)*2.0); vA = tw; }`,
    fragmentShader: `varying vec3 vCol; varying float vA; void main(){ vec2 d = gl_PointCoord-0.5; float r = length(d); if(r>0.5) discard; float a = smoothstep(0.5,0.0,r); gl_FragColor = vec4(vCol*(0.7+a), a*(0.35+0.65*vA)); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  group.add(new THREE.Points(nodeGeo, nodeMat));

  // ----- Connections (k nearest within radius) -----
  const K = 2, R2 = mobile ? 2.6 : 2.2;
  const segs = [];
  for (let i = 0; i < N; i++) {
    const best = [];
    const xi = pos[i * 3], yi = pos[i * 3 + 1], zi = pos[i * 3 + 2];
    for (let j = 0; j < N; j++) {
      if (j === i) continue;
      const dx = pos[j * 3] - xi, dy = pos[j * 3 + 1] - yi, dz = pos[j * 3 + 2] - zi;
      const d = dx * dx + dy * dy + dz * dz;
      if (d > R2) continue;
      if (best.length < K) { best.push([d, j]); best.sort((a, b) => a[0] - b[0]); } else if (d < best[K - 1][0]) { best[K - 1] = [d, j]; best.sort((a, b) => a[0] - b[0]); }
    }
    for (const [, j] of best) if (i < j) segs.push(i, j);
  }
  const S = segs.length / 2;
  const lp = new Float32Array(S * 6), lt = new Float32Array(S * 2), lph = new Float32Array(S * 2);
  for (let s = 0; s < S; s++) {
    const a = segs[s * 2], b = segs[s * 2 + 1];
    lp.set([pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2], pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]], s * 6);
    lt[s * 2] = 0; lt[s * 2 + 1] = 1;
    const ph = Math.random(); lph[s * 2] = ph; lph[s * 2 + 1] = ph;
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  lineGeo.setAttribute('aT', new THREE.BufferAttribute(lt, 1));
  lineGeo.setAttribute('aPh', new THREE.BufferAttribute(lph, 1));
  const lineMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `attribute float aT; attribute float aPh; varying float vT; varying float vPh; void main(){ vT=aT; vPh=aPh; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime; varying float vT; varying float vPh; void main(){ float head = fract(uTime*0.25 + vPh*7.0); float d = abs(vT-head); float pulse = smoothstep(0.18,0.0,d); vec3 base = vec3(0.30,0.45,0.85); vec3 hot = vec3(0.55,0.98,1.0); gl_FragColor = vec4(mix(base,hot,pulse), 0.10 + pulse*0.55); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  group.add(new THREE.LineSegments(lineGeo, lineMat));

  // ----- Quantum core + orbits -----
  const core = new THREE.Group(); group.add(core);
  const orbitCount = mobile ? 140 : 260;
  const orbits = [];
  for (let k = 0; k < 3; k++) {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(orbitCount * 3);
    for (let i = 0; i < orbitCount; i++) { const a = (i / orbitCount) * Math.PI * 2; p[i * 3] = Math.cos(a) * 1.9; p[i * 3 + 1] = Math.sin(a) * 0.7; p[i * 3 + 2] = 0; }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const m = new THREE.PointsMaterial({ color: [0x7cf3ff, 0x5b8cff, 0xa875ff][k], size: 0.045, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(g, m); pts.rotation.set(k * 1.05, k * 0.6, k * 0.9); core.add(pts); orbits.push(pts);
  }
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 24), new THREE.MeshBasicMaterial({ color: 0x9fe9ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  core.add(glow);
  const glowHalo = new THREE.Mesh(new THREE.SphereGeometry(0.8, 32, 24), new THREE.MeshBasicMaterial({ color: 0x5b8cff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
  core.add(glowHalo);

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  function layout() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const wide = w / h > 1.1;
    // Desktop: brain to the right of the copy. Mobile: upper area behind the title.
    group.position.set(wide ? 4.2 : 1.2, wide ? 0.2 : 4.4, wide ? 0 : -4);
  }

  let running = false, raf = 0, visible = true;
  const clock = new THREE.Clock();
  function render() {
    const t = clock.getElapsedTime();
    uniforms.uTime.value = t;
    pointer.x += (pointer.tx - pointer.x) * 0.04; pointer.y += (pointer.ty - pointer.y) * 0.04;
    group.rotation.y = t * 0.05 + pointer.x * 0.25;
    group.rotation.x = Math.sin(t * 0.15) * 0.08 + pointer.y * 0.12;
    orbits.forEach((o, k) => { o.rotation.z = t * (0.3 + k * 0.12) * (k % 2 ? -1 : 1); });
    const s = 1 + Math.sin(t * 2.2) * 0.06; glow.scale.setScalar(s); glowHalo.scale.setScalar(1 + Math.sin(t * 1.4) * 0.1);
    renderer.render(scene, camera);
  }
  function loop() { raf = requestAnimationFrame(loop); render(); }
  function start() { if (running || reducedMotion || !visible || document.hidden) return; running = true; clock.start(); loop(); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  layout();
  render();
  canvas.classList.add('is-ready');
  if (!reducedMotion) start();

  const ro = new ResizeObserver(() => { layout(); if (!running) render(); }); ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }, { threshold: 0 });
  io.observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  if (!mobile) addEventListener('pointermove', (e) => { pointer.tx = e.clientX / innerWidth - 0.5; pointer.ty = e.clientY / innerHeight - 0.5; }, { passive: true });

  return { stop, start, get running() { return running; } };
}
