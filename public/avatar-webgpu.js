import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.webgpu.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";

const host = document.querySelector(".robot-avatar");
const legacy = document.getElementById("avatarCanvas");
if (!host) {
  console.warn("[AgentiCuantico] avatar host not found");
} else {
  const canvas = document.createElement("canvas");
  canvas.id = "avatarWebGPUCanvas";
  canvas.setAttribute("aria-label", "Avatar 3D WebGPU de AgentiCuantico");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;z-index:2;pointer-events:auto;";
  host.appendChild(canvas);
  if (legacy) legacy.style.display = "none";

  const status = document.getElementById("avatarRigStatus");
  const voiceStatus = document.getElementById("voiceStatus");
  const setStatus = (s) => { if (status) status.textContent = s; };

  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setAnimationLoop(render);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(0, 0.05, 5.8);

  scene.add(new THREE.HemisphereLight(0x9ccfff, 0x050817, 2.1));
  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(-2.5, 4, 5);
  scene.add(key);
  const rim = new THREE.PointLight(0x7a5cff, 22, 10);
  rim.position.set(2.4, 1.4, -1.5);
  scene.add(rim);
  const cyan = new THREE.PointLight(0x48eaff, 18, 9);
  cyan.position.set(-2.2, 0.4, 2.5);
  scene.add(cyan);

  const root = new THREE.Group();
  root.position.y = -0.1;
  scene.add(root);

  const mat = (color, roughness = .5, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });

  const skin = mat(0xf0b8a0, .65);
  const suit = mat(0x081225, .28, .7);
  const suit2 = mat(0x15244a, .3, .72);
  const hair = mat(0x241638, .38, .12);
  const white = mat(0xf5fbff, .16, .25);
  const iris = mat(0x58e8ff, .1, .85);
  const lip = mat(0xd95f8b, .3, .15);
  const glow = mat(0x48eaff, .16, .8);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.73, 1.05, 10, 22), suit);
  torso.scale.set(1.08, 1.04, .64);
  torso.position.y = -1.0;
  root.add(torso);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.18, .24, .34, 20), skin);
  neck.position.y = -.2;
  root.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(.79, 32, 24), skin);
  head.scale.set(.84, 1.08, .79);
  head.position.y = .58;
  root.add(head);

  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(.83, 32, 24, 0, Math.PI * 2, 0, Math.PI * .65), hair);
  hairCap.scale.set(.9, 1.04, .84);
  hairCap.position.set(0, .78, -.02);
  root.add(hairCap);

  for (const x of [-.66, .66]) {
    const lock = new THREE.Mesh(new THREE.SphereGeometry(.34, 20, 16), hair);
    lock.scale.set(.72, 1.65, .58);
    lock.position.set(x, .4, -.03);
    root.add(lock);
  }

  const eyes = [];
  for (const x of [-.29, .29]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.115, 20, 14), white);
    eye.scale.z = .42;
    eye.position.set(x, .64, .69);
    root.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(.058, 16, 12), iris);
    pupil.position.set(x, .64, .795);
    root.add(pupil);
    eyes.push(pupil);
  }

  const nose = new THREE.Mesh(new THREE.CapsuleGeometry(.045, .18, 8, 10), skin);
  nose.position.set(0, .39, .73);
  nose.rotation.x = Math.PI / 2;
  root.add(nose);

  const mouth = new THREE.Mesh(new THREE.TorusGeometry(.15, .03, 10, 28, Math.PI), lip);
  mouth.position.set(0, .2, .71);
  mouth.rotation.z = Math.PI;
  mouth.scale.set(1, .72, 1);
  root.add(mouth);

  const jaw = new THREE.Mesh(new THREE.SphereGeometry(.17, 18, 12), skin);
  jaw.scale.set(1.7, .5, .55);
  jaw.position.set(0, .18, .67);
  jaw.visible = false;
  root.add(jaw);

  const arms = [];
  for (const side of [-1, 1]) {
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(.17, .72, 8, 14), suit2);
    upper.position.set(side * .47, -1.0, 0);
    upper.rotation.z = side * .14;
    root.add(upper);
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(.15, .65, 8, 14), suit);
    fore.position.set(side * .49, -1.55, .08);
    fore.rotation.z = side * .08;
    root.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(.2, 16, 12), skin);
    hand.position.set(side * .52, -1.98, .18);
    root.add(hand);
    arms.push({ upper, fore, hand, side });
  }

  const core = new THREE.Mesh(new THREE.SphereGeometry(.15, 20, 16), glow);
  core.position.set(0, -.95, .45);
  root.add(core);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.23, .018, 8, 32), glow);
  ring.position.set(0, -.95, .46);
  root.add(ring);

  const particleCount = 1100;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const r = 2.1 + Math.random() * 2.6;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.cos(phi) * r * .72;
    positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const particles = new THREE.Points(pg, new THREE.PointsMaterial({
    color: 0x45dfff, size: .035, transparent: true, opacity: .62,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  scene.add(particles);

  let speaking = false;
  let mouthLevel = 0;
  let targetX = 0;
  let targetY = 0;
  let speechTimer = null;

  canvas.addEventListener("pointermove", (event) => {
    const r = canvas.getBoundingClientRect();
    targetX = ((event.clientX - r.left) / r.width - .5) * 2;
    targetY = ((event.clientY - r.top) / r.height - .5) * 2;
  });

  function resize() {
    const w = Math.max(1, canvas.clientWidth || 500);
    const h = Math.max(1, canvas.clientHeight || 420);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  function startSpeechMotion() {
    speaking = true;
    if (speechTimer) clearInterval(speechTimer);
    speechTimer = setInterval(() => {
      mouthLevel = .18 + Math.random() * .82;
    }, 70);
  }
  function stopSpeechMotion() {
    speaking = false;
    if (speechTimer) clearInterval(speechTimer);
    speechTimer = null;
    mouthLevel = 0;
  }

  // Synchronizes visible body/lip motion with the browser voice engine.
  const originalSpeak = window.speechSynthesis?.speak?.bind(window.speechSynthesis);
  if (originalSpeak) {
    window.speechSynthesis.speak = (utterance) => {
      utterance.addEventListener?.("start", startSpeechMotion);
      utterance.addEventListener?.("end", stopSpeechMotion);
      utterance.addEventListener?.("error", stopSpeechMotion);
      utterance.onstart = ((old) => (e) => { old?.(e); startSpeechMotion(); })(utterance.onstart);
      utterance.onend = ((old) => (e) => { old?.(e); stopSpeechMotion(); })(utterance.onend);
      utterance.onerror = ((old) => (e) => { old?.(e); stopSpeechMotion(); })(utterance.onerror);
      originalSpeak(utterance);
    };
  }

  // Also reacts to UI state, so avatar moves even when a custom voice adapter is used.
  const observer = new MutationObserver(() => {
    const text = voiceStatus?.textContent || "";
    const active = /hablando|speaking|reproduciendo|voz/i.test(text) && !/lista/i.test(text);
    if (active) startSpeechMotion();
  });
  if (voiceStatus) observer.observe(voiceStatus, { childList: true, characterData: true, subtree: true });

  // Prefer the final hyperrealistic, rigged GLB when it is available.
  // The procedural avatar remains as a graceful fallback until the asset is uploaded.
  const MODEL_URL = "./assets/avatar/agenticuantico-woman.glb";
  let loadedModel = null;
  let mixer = null;
  let modelClock = new THREE.Clock();
  try {
    const loader = new GLTFLoader();
    loader.load(MODEL_URL, (gltf) => {
      loadedModel = gltf.scene;
      loadedModel.position.set(0, -1.05, 0);
      loadedModel.scale.setScalar(1.42);
      loadedModel.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.castShadow = true;
        obj.receiveShadow = true;
        if (obj.material) {
          obj.material.needsUpdate = true;
          if ("toneMapped" in obj.material) obj.material.toneMapped = true;
        }
      });
      root.clear();
      root.add(loadedModel);
      if (gltf.animations?.length) {
        mixer = new THREE.AnimationMixer(loadedModel);
        gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
      }
      setStatus("GLB · mujer IA · 3D");
    }, undefined, () => {
      setStatus("WEBGPU · avatar fallback");
    });
  } catch {
    setStatus("WEBGPU · avatar fallback");
  }

  setStatus("WEBGPU · avatar activo");

  const clock = new THREE.Clock();
  function render() {
    const t = clock.getElapsedTime();

    particles.rotation.y = t * .035;
    particles.rotation.x = Math.sin(t * .17) * .05;

    if (mixer) mixer.update(Math.min(modelClock.getDelta(), .05));
    root.rotation.y += ((targetX * .11 + Math.sin(t * .42) * .035) - root.rotation.y) * .035;
    root.rotation.x += ((targetY * .035) - root.rotation.x) * .035;
    root.position.y = -.1 + Math.sin(t * 1.15) * .025;

    const liveMouth = speaking ? Math.max(mouthLevel, .22 + .18 * Math.sin(t * 16)) : Math.max(0, mouthLevel -= .035);
    mouth.scale.y = .72 + liveMouth * 2.15;

    for (const eye of eyes) {
      eye.position.x += (targetX * .035 - (eye.position.x - (eye === eyes[0] ? -.29 : .29))) * .08;
    }

    for (const a of arms) {
      const wave = speaking ? Math.sin(t * 2.1 + a.side) * .08 : Math.sin(t * .8 + a.side) * .025;
      a.upper.rotation.z = a.side * (.13 + wave);
      a.fore.rotation.z = a.side * (.08 - wave * .7);
      a.hand.position.y = -1.98 + Math.sin(t * 1.6 + a.side) * .02;
    }

    const blink = Math.sin(t * .43) > .985 ? 1 : 0;
    root.traverse((o) => {
      if (o.morphTargetDictionary && o.morphTargetInfluences) {
        for (const [name, idx] of Object.entries(o.morphTargetDictionary)) {
          if (/mouth|jaw|viseme|phoneme|open/i.test(name)) o.morphTargetInfluences[idx] = liveMouth;
          if (/blink|eye.?close/i.test(name)) o.morphTargetInfluences[idx] = blink;
        }
      }
    });

    renderer.renderAsync(scene, camera).catch(() => {});
  }

  if (!("gpu" in navigator)) {
    setStatus("WEBGPU · fallback automático");
  }
}
