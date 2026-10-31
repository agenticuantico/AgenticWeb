/**
 * "Agente": procedural stylized 3D avatar (head, face, hands) built with three.js.
 * No external models or textures. Mouth driven by viseme weights from lipsync.js.
 */
import * as THREE from '../vendor/three/three.module.min.js';

const isMobile = () => matchMedia('(max-width: 820px)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

function rimMaterial(colorA, colorB, power = 2.4, intensity = 1.0) {
  return new THREE.ShaderMaterial({
    uniforms: { cA: { value: new THREE.Color(colorA) }, cB: { value: new THREE.Color(colorB) }, p: { value: power }, k: { value: intensity }, glow: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vY = position.y; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 cA; uniform vec3 cB; uniform float p; uniform float k; uniform float glow; varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ float f = pow(1.0 - max(dot(vN, vV), 0.0), p); vec3 c = mix(cB, cA, clamp(vY*0.5+0.5,0.0,1.0)); gl_FragColor = vec4(c * f * (k + glow), f * (0.85 + glow*0.3)); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  });
}

export function createAvatar(canvas, { reducedMotion = false } = {}) {
  const mobile = isMobile();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile || devicePixelRatio < 2, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.6 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  const target = new THREE.Vector3(0, 0.12, 0);

  // Lights
  scene.add(new THREE.HemisphereLight(0x9cc0ff, 0x05070c, 0.75));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(2.5, 3, 5); scene.add(key);
  const fill = new THREE.DirectionalLight(0x8fa8ff, 0.6); fill.position.set(-3, 0.5, 3); scene.add(fill);
  const rimC = new THREE.PointLight(0x7cf3ff, 18, 12, 2); rimC.position.set(-2.6, 1.6, -2); scene.add(rimC);
  const rimV = new THREE.PointLight(0xa875ff, 16, 12, 2); rimV.position.set(2.6, 1.2, -2); scene.add(rimV);

  // Materials
  const skin = new THREE.MeshPhysicalMaterial({ color: 0x1a2640, metalness: 0.15, roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.35, sheen: 0.35, sheenColor: new THREE.Color(0x5b8cff), sheenRoughness: 0.6 });
  const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0x0e1626, metalness: 0.25, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.5 });
  const skinDark = new THREE.MeshStandardMaterial({ color: 0x070b13, roughness: 0.6, metalness: 0.1 });
  const lipMat = new THREE.MeshPhysicalMaterial({ color: 0x7e5869, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.3, emissive: 0x3a1424, emissiveIntensity: 0.5 });
  const mouthIn = new THREE.MeshBasicMaterial({ color: 0x14040a });
  const teethMat = new THREE.MeshStandardMaterial({ color: 0xeef4ff, roughness: 0.3, emissive: 0x334455, emissiveIntensity: 0.2 });
  const eyeWhite = new THREE.MeshPhysicalMaterial({ color: 0x050a12, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 });
  const irisGlow = new THREE.MeshBasicMaterial({ color: 0x7cf3ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
  const irisMat = new THREE.MeshBasicMaterial({ color: 0x8ff6ff });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x02060c });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x7cf3ff, transparent: true, opacity: 0.9 });
  const browMat = new THREE.MeshStandardMaterial({ color: 0x2a3a58, roughness: 0.5 });

  const root = new THREE.Group(); scene.add(root);

  // ===== Head =====
  const head = new THREE.Group(); head.position.set(0, 0.55, 0); root.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(1, mobile ? 48 : 72, mobile ? 36 : 56), skin);
  skull.scale.set(0.87, 1.0, 0.9); head.add(skull);
  const rim = new THREE.Mesh(new THREE.SphereGeometry(1.04, 48, 36), rimMaterial(0x7cf3ff, 0xa875ff, 2.6, 0.9));
  rim.scale.copy(skull.scale); head.add(rim);
  // Chin / jaw volume
  const chin = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 24), skin);
  chin.scale.set(1.0, 0.6, 0.62); chin.position.set(0, -0.62, 0.48); head.add(chin);
  // Cheeks
  // Nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 18), skin); nose.scale.set(0.5, 1.5, 0.55); nose.position.set(0, -0.1, 0.875); head.add(nose);

  // Eyes
  const eyes = [];
  for (const s of [-1, 1]) {
    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 24), skinDark); socket.scale.set(1.05, 0.72, 0.4); socket.position.set(0.3 * s, 0.12, 0.79); head.add(socket);
    const eye = new THREE.Group(); eye.position.set(0.3 * s, 0.12, 0.83); head.add(eye);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.105, 32, 24), eyeWhite); ball.scale.set(1.15, 0.78, 0.5); eye.add(ball);
    const iris = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.058, 40), irisMat); iris.position.z = 0.054; eye.add(iris);
    const glowD = new THREE.Mesh(new THREE.CircleGeometry(0.075, 32), irisGlow); glowD.position.z = 0.05; eye.add(glowD);
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.03, 24), pupilMat); pupil.position.z = 0.056; eye.add(pupil);
    const spark = new THREE.Mesh(new THREE.CircleGeometry(0.011, 12), new THREE.MeshBasicMaterial({ color: 0xffffff })); spark.position.set(0.018, 0.018, 0.058); eye.add(spark);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.114, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), skin);
    lid.scale.set(1.17, 0.82, 0.56); lid.position.copy(eye.position); head.add(lid);
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.2, 6, 12), browMat); brow.rotation.z = Math.PI / 2 - 0.07 * s; brow.position.set(0.3 * s, 0.33, 0.8); head.add(brow);
    eyes.push({ eye, iris, pupil, spark, brow, lid, s });
  }

  // Audio receptors (ears)
  const ears = [];
  for (const s of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.026, 12, 40), glowMat.clone());
    ring.position.set(0.84 * s, 0.05, 0); ring.rotation.y = Math.PI / 2; head.add(ring);
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.08, 32), skinDark); pod.rotation.z = Math.PI / 2; pod.position.set(0.81 * s, 0.05, 0); head.add(pod);
    ears.push(ring);
  }
  // Forehead seam (emissive line)
  const seam = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.006, 6, 80, Math.PI * 0.7), glowMat.clone());
  seam.material.opacity = 0.55; seam.rotation.set(-0.35, 0, Math.PI * 0.15); seam.position.set(0, 0.52, 0.35); head.add(seam);

  // Mouth
  const mouth = new THREE.Group(); mouth.position.set(0, -0.38, 0.815); head.add(mouth);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.13, 40), mouthIn); inner.position.z = 0.02; inner.scale.set(1, 0.05, 1); mouth.add(inner);
  const teethTop = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.01), teethMat); teethTop.position.set(0, 0.0, 0.026); mouth.add(teethTop);
  const teethBot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.022, 0.01), teethMat); teethBot.position.set(0, 0.0, 0.025); mouth.add(teethBot);
  const upperLip = new THREE.Mesh(new THREE.CapsuleGeometry(0.017, 0.21, 8, 16), lipMat); upperLip.rotation.z = Math.PI / 2; upperLip.position.set(0, 0.016, 0.03); mouth.add(upperLip);
  const lowerLip = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.19, 8, 16), lipMat); lowerLip.rotation.z = Math.PI / 2; lowerLip.position.set(0, -0.016, 0.03); mouth.add(lowerLip);
  const corners = [-1, 1].map((s) => { const c = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 10), lipMat); c.position.set(0.118 * s, 0, 0.026); mouth.add(c); return c; });

  // ===== Neck & torso =====
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.7, 32), bodyMat); neck.position.set(0, -0.62, -0.05); root.add(neck);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.014, 8, 64), glowMat.clone()); collar.rotation.x = Math.PI / 2; collar.position.set(0, -0.86, -0.05); root.add(collar);
  const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), bodyMat); torso.scale.set(1.5, 0.78, 0.68); torso.position.set(0, -1.62, -0.15); root.add(torso);
  const torsoRim = new THREE.Mesh(new THREE.SphereGeometry(1.03, 40, 28), rimMaterial(0x5b8cff, 0xa875ff, 3.0, 0.7)); torsoRim.scale.copy(torso.scale); torsoRim.position.copy(torso.position); root.add(torsoRim);
  const core = new THREE.Mesh(new THREE.CircleGeometry(0.07, 32), glowMat.clone()); core.position.set(0, -1.2, 0.47); core.rotation.x = -0.35; root.add(core);

  // ===== Hands =====
  function makeHand(side) {
    const g = new THREE.Group();
    const wrist = new THREE.Group(); g.add(wrist);
    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.55, 8, 16), skin); forearm.position.set(0, -0.42, -0.05); forearm.rotation.x = 0.25; wrist.add(forearm);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.01, 8, 32), glowMat.clone()); band.rotation.x = Math.PI / 2; band.position.y = -0.17; wrist.add(band);
    const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.13, 8, 20), skin); palm.scale.set(1.05, 1, 0.45); wrist.add(palm);
    const fingers = [];
    const fx = [-0.072, -0.024, 0.024, 0.072];
    const lens = [[0.085, 0.06, 0.05], [0.1, 0.07, 0.055], [0.095, 0.068, 0.052], [0.075, 0.055, 0.045]];
    for (let f = 0; f < 4; f++) {
      let parent = new THREE.Group(); parent.position.set(fx[f] * side, 0.17 - Math.abs(f - 1.5) * 0.012, 0); wrist.add(parent);
      const joints = [];
      for (let j = 0; j < 3; j++) {
        const L = lens[f][j];
        const seg = new THREE.Mesh(new THREE.CapsuleGeometry(0.028 - j * 0.003, L, 6, 10), skin); seg.position.y = L / 2 + 0.01;
        parent.add(seg); joints.push(parent);
        if (j === 2) { const tip = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), glowMat); tip.position.set(0, L + 0.02, 0.012); parent.add(tip); }
        const nextJ = new THREE.Group(); nextJ.position.y = L + 0.02; parent.add(nextJ); parent = nextJ;
      }
      fingers.push(joints);
    }
    // thumb
    const thumbBase = new THREE.Group(); thumbBase.position.set(-0.115 * side, -0.03, 0.03); thumbBase.rotation.z = 0.75 * side; thumbBase.rotation.x = 0.3; wrist.add(thumbBase);
    const thumb = [];
    let tp = thumbBase;
    for (let j = 0; j < 2; j++) { const L = j ? 0.06 : 0.08; const seg = new THREE.Mesh(new THREE.CapsuleGeometry(0.03 - j * 0.004, L, 6, 10), skin); seg.position.y = L / 2 + 0.01; tp.add(seg); thumb.push(tp); const n = new THREE.Group(); n.position.y = L + 0.02; tp.add(n); tp = n; }
    return { g, wrist, fingers, thumb, side, band };
  }
  const hands = [makeHand(-1), makeHand(1)];
  hands.forEach((h) => root.add(h.g));
  const HAND_BASE = { x: 0.86, y: -0.62, z: 0.95 };
  hands.forEach((h) => h.g.scale.setScalar(1.45));

  const GESTURES = {
    rest: { p: [0.02, -0.34, -0.08], r: [0.55, 0.1, 0.5], c: [0.35, 0.3, 0.38, 0.45, 0.52] },
    open: { p: [-0.04, 0.05, 0.08], r: [-0.5, 0.3, 0.16], c: [0.08, 0.04, 0.04, 0.08, 0.12] },
    point: { p: [-0.04, 0.14, 0.12], r: [-0.1, 0.1, 0.12], c: [0.75, 0.0, 0.95, 0.95, 0.95] },
    explain: { p: [-0.02, 0.06, 0.06], r: [-0.1, 0.65, 0.38], c: [0.2, 0.12, 0.18, 0.24, 0.3] },
    count: { p: [-0.03, 0.12, 0.1], r: [-0.15, 0.1, 0.1], c: [0.9, 0.0, 0.0, 0.95, 0.95] },
    beat: { p: [-0.02, 0.0, 0.08], r: [0.15, 0.2, 0.3], c: [0.7, 0.72, 0.8, 0.85, 0.88] }
  };
  const SPEAK_GESTURES = ['open', 'explain', 'point', 'count', 'beat', 'open', 'explain'];
  const handState = hands.map(() => ({ name: 'rest', p: [...GESTURES.rest.p], r: [...GESTURES.rest.r], c: [...GESTURES.rest.c], next: 0, phase: Math.random() * 6 }));

  // ===== Aura particles =====
  const auraCount = mobile ? 260 : 600;
  const auraGeo = new THREE.BufferGeometry();
  const ap = new Float32Array(auraCount * 3);
  for (let i = 0; i < auraCount; i++) {
    const a = Math.random() * Math.PI * 2, r = 1.35 + Math.random() * 1.0, y = (Math.random() - 0.5) * 2.6;
    ap[i * 3] = Math.cos(a) * r; ap[i * 3 + 1] = y + 0.4; ap[i * 3 + 2] = Math.sin(a) * r - 0.9;
  }
  auraGeo.setAttribute('position', new THREE.BufferAttribute(ap, 3));
  const aura = new THREE.Points(auraGeo, new THREE.PointsMaterial({ color: 0x7cc8ff, size: mobile ? 0.03 : 0.022, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(aura);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.008, 8, 120), new THREE.MeshBasicMaterial({ color: 0x5b8cff, transparent: true, opacity: 0.45 }));
  halo.position.set(0, 0.6, -0.8); scene.add(halo);

  // ===== State =====
  const state = {
    mouth: { open: 0, wide: 0, round: 0, close: 0.15, fv: 0 },
    energy: 0, speaking: false, blink: 0, gesture: ['rest', 'rest'], frames: 0, running: false
  };
  let source = null; // (now) => {open,wide,round,close,fv, amp?}
  let nextBlink = performance.now() + 1800;
  let blinkStart = -1;
  let saccade = { x: 0, y: 0, tx: 0, ty: 0, next: 0 };
  const pointer = { x: 0, y: 0 };

  function fit() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    const needH = 3.35, needW = 2.9;
    const visH = Math.max(needH, needW / aspect);
    const dist = visH / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.position.set(0, target.y + 0.15, dist);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }

  function applyHand(h, hs, dt, t) {
    const G = GESTURES[hs.name];
    const sp = state.speaking ? 6 : 3.5;
    for (let i = 0; i < 3; i++) { hs.p[i] = damp(hs.p[i], G.p[i], sp, dt); hs.r[i] = damp(hs.r[i], G.r[i], sp, dt); }
    for (let i = 0; i < 5; i++) hs.c[i] = damp(hs.c[i], G.c[i], sp * 1.4, dt);
    const s = h.side;
    const motion = reducedMotion ? 0.3 : 1;
    const beat = state.speaking ? Math.sin(t * 5.2 + hs.phase) * 0.025 * (0.4 + state.energy) * motion : 0;
    const sway = (hs.name === 'explain' ? Math.sin(t * 2.4 + hs.phase) * 0.25 : 0) * motion;
    const breathe = Math.sin(t * 1.3 + hs.phase) * 0.012 * motion;
    h.g.position.set(s * (HAND_BASE.x + hs.p[0]), HAND_BASE.y + hs.p[1] + beat + breathe, HAND_BASE.z + hs.p[2]);
    h.g.rotation.set(hs.r[0], s * (hs.r[1] + sway), -s * hs.r[2]);
    // finger curls: index..pinky are c[1..4]
    h.fingers.forEach((joints, f) => {
      const c = hs.c[f + 1];
      joints[0].rotation.x = c * 1.2; joints[1].rotation.x = c * 1.5; joints[2].rotation.x = c * 1.1;
      joints[0].rotation.z = (f - 1.5) * -0.06 * s * (1 - c);
    });
    h.thumb[0].rotation.x = hs.c[0] * 0.9; h.thumb[1].rotation.x = hs.c[0] * 0.9;
  }

  const target4 = { open: 0, wide: 0, round: 0, close: 0.15, fv: 0 };
  let last = performance.now();
  let raf = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = Math.max(last, now);
    const t = now / 1000;
    state.frames++;

    // Mouth target
    let amp = null;
    const w = source ? source(now) : null;
    if (w) { Object.assign(target4, w); amp = w.amp != null ? w.amp : null; }
    else { target4.open = 0; target4.wide = 0.05; target4.round = 0; target4.close = 0.15; target4.fv = 0; }
    if (amp != null) target4.open *= Math.min(1.2, 0.25 + amp * 1.2); // proxy audio amplitude gate
    const m = state.mouth;
    for (const k of ['open', 'wide', 'round', 'close', 'fv']) m[k] = damp(m[k], target4[k], 22, dt);
    state.energy = damp(state.energy, state.speaking ? Math.min(1, m.open * 1.3 + m.wide * 0.3) : 0, 8, dt);

    // Apply mouth
    const open = m.open * (1 - m.close * 0.9);
    const width = 1 + m.wide * 0.28 - m.round * 0.32;
    inner.scale.set(width * (1 - m.round * 0.2), Math.max(0.03, open * 0.85 + m.round * 0.12 * open), 1);
    inner.position.y = -open * 0.035;
    upperLip.position.y = 0.016 + open * 0.01 - m.close * 0.004;
    upperLip.scale.set(1, width, 1 + m.round * 0.3);
    upperLip.position.z = 0.034 + m.round * 0.03;
    lowerLip.position.y = -0.016 - open * 0.1 + m.close * 0.009 + m.fv * 0.02;
    lowerLip.position.z = 0.034 + m.round * 0.03 - m.fv * 0.016;
    lowerLip.scale.set(1, width * 0.95, 1 + m.round * 0.3);
    corners.forEach((c, i) => { const s = i ? 1 : -1; c.position.x = 0.118 * s * width; c.position.y = -open * 0.04 + m.wide * 0.006; });
    teethTop.visible = open > 0.08 || m.fv > 0.3; teethTop.position.y = 0.0 - m.fv * 0.005; teethTop.scale.x = width * 0.95;
    teethBot.visible = open > 0.25; teethBot.position.y = -open * 0.085 + 0.012;
    chin.position.y = -0.6 - open * 0.07; chin.position.z = 0.5 - open * 0.015;

    // Blink & eyes
    if (now > nextBlink && blinkStart < 0) { blinkStart = now; }
    if (blinkStart >= 0) {
      const p = (now - blinkStart) / 150;
      state.blink = p < 0.5 ? p * 2 : Math.max(0, 2 - p * 2);
      if (p >= 1) { blinkStart = -1; state.blink = 0; nextBlink = now + 2200 + Math.random() * 3600 * (Math.random() < 0.15 ? 0.15 : 1); }
    }
    if (now > saccade.next) { saccade.tx = (Math.random() - 0.5) * 0.026 + pointer.x * 0.02; saccade.ty = (Math.random() - 0.5) * 0.016 + pointer.y * 0.012; saccade.next = now + 600 + Math.random() * 1800; }
    saccade.x = damp(saccade.x, saccade.tx, 18, dt); saccade.y = damp(saccade.y, saccade.ty, 18, dt);
    eyes.forEach((e) => {
      e.eye.scale.y = Math.max(0.3, 1 - state.blink * 0.7);
      e.lid.rotation.x = -0.42 + state.blink * 1.95 - state.energy * 0.12;
      e.iris.position.x = e.pupil.position.x = saccade.x; e.iris.position.y = e.pupil.position.y = saccade.y;
      e.spark.position.x = 0.018 + saccade.x; e.spark.position.y = 0.018 + saccade.y;
      e.brow.position.y = 0.33 + state.energy * 0.03 + Math.max(0, Math.sin(t * 3.1)) * state.energy * 0.015;
    });

    // Head motion
    const motion = reducedMotion ? 0.25 : 1;
    head.rotation.y = damp(head.rotation.y, (Math.sin(t * 0.5) * 0.12 + pointer.x * 0.18) * motion, 3, dt);
    head.rotation.x = damp(head.rotation.x, (Math.sin(t * 0.7) * 0.04 - pointer.y * 0.08 - state.energy * 0.05 + (state.speaking ? Math.sin(t * 4.3) * 0.025 : 0)) * motion, 4, dt);
    head.rotation.z = damp(head.rotation.z, Math.sin(t * 0.45) * 0.035 * motion, 3, dt);
    head.position.y = 0.55 + Math.sin(t * 1.3) * 0.012 * motion;

    // Gestures
    handState.forEach((hs, i) => {
      if (state.speaking && now > hs.next) {
        hs.name = Math.random() < 0.22 ? 'rest' : SPEAK_GESTURES[(Math.random() * SPEAK_GESTURES.length) | 0];
        if (i === 1 && hs.name === handState[0].name && hs.name !== 'rest') hs.name = 'open';
        hs.next = now + 1300 + Math.random() * 1500;
      } else if (!state.speaking && hs.name !== 'rest' && now > hs.next) { hs.name = 'rest'; }
      state.gesture[i] = hs.name;
      applyHand(hands[i], hs, dt, t);
    });

    // Glow
    const g = 0.55 + state.energy * 0.45 + Math.sin(t * 2) * 0.05;
    ears.forEach((r) => { r.material.opacity = g; });
    collar.material.opacity = 0.5 + state.energy * 0.5;
    core.material.opacity = 0.6 + state.energy * 0.4;
    rim.material.uniforms.glow.value = state.energy * 0.6;
    aura.rotation.y += dt * 0.05 * motion;
    halo.rotation.z += dt * 0.08 * motion;
    halo.material.opacity = 0.3 + state.energy * 0.3;

    renderer.render(scene, camera);
  }

  function start() { if (!state.running) { state.running = true; last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { state.running = false; cancelAnimationFrame(raf); }

  const ro = new ResizeObserver(fit); ro.observe(canvas);
  fit();
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !document.hidden) start(); else if (!state.speaking) stop(); }, { threshold: 0.01 });
  io.observe(canvas);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width - 0.5) * 2; pointer.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
  }, { passive: true });
  canvas.addEventListener('pointerleave', () => { pointer.x = 0; pointer.y = 0; });
  start();

  return {
    state,
    setSource(fn) { source = fn; },
    setSpeaking(v) { state.speaking = !!v; if (v) { handState.forEach((h) => { h.next = 0; }); start(); } },
    start, stop, fit,
    scene, camera,
    dispose() { stop(); ro.disconnect(); io.disconnect(); renderer.dispose(); }
  };
}
