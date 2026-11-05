// Altura Sur · plantilla demo (código original de AgentiCuántico, 2026).
import { initCommon, reduced, finePointer, scrollProgress, sectionProgress, hasWebGL, visibleLoop } from '../_comun/demo.js';

initCommon();

// Tarjetas con inclinación 3D (CSS)
if (finePointer && !reduced) document.querySelectorAll('[data-tilt]').forEach(c => {
  c.addEventListener('pointermove', e => { const r = c.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; c.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`; });
  c.addEventListener('pointerleave', () => { c.style.transform = ''; });
});

// Capítulos de la historia
const story = document.querySelector('.story');
const chapters = [...document.querySelectorAll('.chapter')];
const meter = document.querySelector('.story-meter');
const state = { story: 0, page: 0, hero: 0 };
function updateStory() {
  state.story = sectionProgress(story);
  const i = Math.min(chapters.length - 1, Math.floor(state.story * chapters.length * 0.999));
  chapters.forEach((c, k) => c.classList.toggle('on', k === i && story.getBoundingClientRect().top < innerHeight * .5));
  meter.style.setProperty('--sp', state.story.toFixed(3));
  state.hero = Math.min(1, scrollY / innerHeight);
}
scrollProgress(p => { state.page = p; updateStory(); });

const canvas = document.getElementById('glass');
if (!hasWebGL()) document.documentElement.classList.add('no-webgl');
else initGlass().catch(e => { console.warn('3D no disponible:', e); document.documentElement.classList.add('no-webgl'); });

async function initGlass() {
  const THREE = await import('../_comun/three.js');
  const { makeEnv } = await import('../_comun/env.js');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.environment = makeEnv(renderer, { top: '#f3e9dc', bottom: '#1a0a0e', lights: ['#ffffff', '#c9a35b', '#ffe9d0'] });
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 100);
  camera.position.set(0, .2, 7.2);

  const root = new THREE.Group(); scene.add(root);
  const glass = new THREE.Group(); root.add(glass);

  // Perfil de la copa (radio, altura)
  const bowl = [[0, 0], [.34, .07], [.6, .28], [.73, .62], [.72, 1.0], [.65, 1.38], [.6, 1.62]];
  const curve = new THREE.SplineCurve(bowl.map(([x, y]) => new THREE.Vector2(x, y)));
  const bowlPts = curve.getPoints(60);
  const rAt = y => { for (let i = 1; i < bowlPts.length; i++) { const a = bowlPts[i - 1], b = bowlPts[i]; if (y <= b.y) { const t = (y - a.y) / ((b.y - a.y) || 1); return a.x + (b.x - a.x) * t; } } return bowlPts.at(-1).x; };
  const outer = [new THREE.Vector2(.62, -1.62), new THREE.Vector2(.6, -1.57), new THREE.Vector2(.1, -1.5), new THREE.Vector2(.045, -1.38), new THREE.Vector2(.04, -.2), new THREE.Vector2(.07, -.06)]
    .concat(bowlPts.map(p => new THREE.Vector2(Math.max(p.x, .07), p.y)));
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: .04, metalness: 0, transparent: true, opacity: .13, envMapIntensity: 2.2, clearcoat: 1, clearcoatRoughness: .05, side: THREE.DoubleSide, depthWrite: false });
  const glassMesh = new THREE.Mesh(new THREE.LatheGeometry(outer, 96), glassMat); glassMesh.renderOrder = 2; glass.add(glassMesh);
  // Borde brillante
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.6, .008, 8, 96), new THREE.MeshStandardMaterial({ color: '#fff', metalness: 1, roughness: .1 }));
  rim.rotation.x = Math.PI / 2; rim.position.y = 1.62; glass.add(rim);

  // Vino
  const wineMat = new THREE.MeshPhysicalMaterial({ color: '#5c0a1c', roughness: .18, clearcoat: 1, clearcoatRoughness: .1, sheen: .5, sheenColor: '#b32a44', envMapIntensity: 1.2, transparent: true, opacity: .94 });
  const surfMat = new THREE.MeshPhysicalMaterial({ color: '#3a0611', roughness: .25, clearcoat: .6, clearcoatRoughness: .2, envMapIntensity: .55, side: THREE.DoubleSide });
  let wine = null, surface = null, fillNow = -1;
  function buildWine(fill) {
    const top = .03 + fill * 1.0;
    const pts = [new THREE.Vector2(0, .025)];
    for (let i = 1; i <= 30; i++) { const y = .025 + (top - .025) * (i / 30); pts.push(new THREE.Vector2(rAt(y) * .965, y)); }
    if (wine) { wine.geometry.dispose(); glass.remove(wine); }
    wine = new THREE.Mesh(new THREE.LatheGeometry(pts, 72), wineMat); wine.renderOrder = 1; glass.add(wine);
    if (!surface) { surface = new THREE.Mesh(new THREE.CircleGeometry(1, 72), surfMat); surface.rotation.x = -Math.PI / 2; glass.add(surface); }
    const r = rAt(top) * .965; surface.scale.setScalar(r); surface.position.y = top;
    fillNow = fill;
  }
  buildWine(.42);

  // Luces
  const key = new THREE.DirectionalLight('#ffe8cc', 2.2); key.position.set(3, 4, 5); scene.add(key);
  const rimL = new THREE.DirectionalLight('#c9a35b', 3); rimL.position.set(-4, 2, -3); scene.add(rimL);
  scene.add(new THREE.AmbientLight('#3a1a20', 1));

  // Partículas doradas
  const N = 420, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - .5) * 9; pos[i * 3 + 1] = (Math.random() - .5) * 6; pos[i * 3 + 2] = (Math.random() - .5) * 5 - 1; seed[i] = Math.random(); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,230,180,1)'); gr.addColorStop(1, 'rgba(255,230,180,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const dust = new THREE.Points(pg, new THREE.PointsMaterial({ size: .05, map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#e8c58a', opacity: .75 }));
  scene.add(dust);

  // Interacción
  let px = 0, py = 0, tx = 0, ty = 0;
  addEventListener('pointermove', e => { tx = e.clientX / innerWidth - .5; ty = e.clientY / innerHeight - .5; }, { passive: true });
  let lastScroll = scrollY, slosh = 0, sloshV = 0, tiltZ = 0;

  function resize() {
    const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    const mobile = w < 820;
    root.position.set(mobile ? 0 : 1.55, mobile ? .95 : -.05, 0);
    root.scale.setScalar(mobile ? .6 : 1);
  }
  addEventListener('resize', resize); resize();

  const wineColors = [new THREE.Color('#5c0a1c'), new THREE.Color('#4a0816'), new THREE.Color('#6e1024')];
  visibleLoop(canvas, (dt, t) => {
    px += (tx - px) * .06; py += (ty - py) * .06;
    const s = state.story, h = state.hero;
    // Llenado según el capítulo: Suelo (bajo) → Tiempo (sube) → Copa (servido)
    const fill = .3 + Math.min(1, s * 1.6) * .35;
    if (Math.abs(fill - fillNow) > .012) buildWine(fill);
    wineMat.color.lerpColors(wineColors[0], wineColors[2], s);
    // Oleaje por velocidad de scroll y movimiento del puntero (resorte)
    const v = (scrollY - lastScroll); lastScroll = scrollY;
    sloshV += (-slosh * 40 - sloshV * 6) * dt + (reduced ? 0 : v * .0009 + (tx - px) * .25);
    slosh += sloshV * dt * 6; slosh = Math.max(-.35, Math.min(.35, slosh));
    if (surface) { surface.rotation.x = -Math.PI / 2 + slosh * .8; surface.rotation.y = 0; }
    tiltZ += ((reduced ? 0 : -px * .25) - tiltZ) * .08;
    glass.rotation.set(py * .2 + h * .12 - s * .25, (reduced ? .4 : t * .18) + px * .6 + s * Math.PI * 1.2, tiltZ + Math.sin(s * Math.PI) * .18);
    glass.position.y = Math.sin(t * .9) * (reduced ? 0 : .05) - s * .2;
    // Partículas
    const a = pg.attributes.position.array;
    if (!reduced) for (let i = 0; i < N; i++) { a[i * 3 + 1] += dt * (.05 + seed[i] * .12); if (a[i * 3 + 1] > 3) a[i * 3 + 1] = -3; a[i * 3] += Math.sin(t + seed[i] * 9) * dt * .03; }
    pg.attributes.position.needsUpdate = true;
    dust.rotation.y = px * .2;
    // Desvanecer al terminar la historia
    const rect = story.getBoundingClientRect();
    const off = rect.bottom < innerHeight * .4;
    canvas.style.opacity = off ? '0' : '1';
    if (!off) renderer.render(scene, camera);
  });
}
