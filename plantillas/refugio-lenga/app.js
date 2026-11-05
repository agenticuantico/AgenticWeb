// Refugio Lenga · plantilla demo (código original de AgentiCuántico, 2026).
import { initCommon, reduced, scrollProgress, sectionProgress, hasWebGL, visibleLoop } from '../_comun/demo.js';

initCommon();

// Paradas del viaje
const journey = document.querySelector('.journey');
const stops = [...document.querySelectorAll('.stop')];
const compass = document.querySelector('.compass');
const st = { fly: 0, j: 0 };
function update() {
  st.j = sectionProgress(journey);
  const hero = Math.min(1, scrollY / innerHeight);
  st.fly = Math.min(1, (hero * .25) + st.j * .75);
  const i = Math.min(stops.length - 1, Math.floor(st.j * stops.length * .999));
  const active = journey.getBoundingClientRect().top < innerHeight * .35;
  stops.forEach((s, k) => s.classList.toggle('on', active && k === i));
  if (compass) compass.style.setProperty('--rot', (st.fly * 220 - 20).toFixed(1) + 'deg');
}
scrollProgress(update);

// Experiencias por temporada
const seasons = {
  invierno: [['Raquetas de nieve', 'Caminata guiada por el bosque nevado, con equipo incluido.'], ['Noche de fogón', 'Guiso de montaña y cielo limpio para mirar estrellas.'], ['Esquí de travesía', 'Salidas con guía para quienes ya tienen experiencia.']],
  primavera: [['Avistaje de aves', 'Recorrido temprano por la costa del lago.'], ['Bici de montaña', 'Senderos de tierra con distintos niveles.'], ['Taller de pan', 'Masa madre y horno de barro, en la casa principal.']],
  verano: [['Kayak al amanecer', 'Dos horas sobre el lago, sin experiencia previa.'], ['Trekking al glaciar', 'Día completo con vianda y guía local.'], ['Pesca con devolución', 'Salidas en la desembocadura del río.']],
  otono: [['Bosque rojo', 'Fotografía entre lengas cuando cambian de color.'], ['Cabalgata', 'Paseo tranquilo por la estancia vecina.'], ['Cocina de estación', 'Hongos, frutos rojos y fuego lento.']]
};
const list = document.getElementById('exp-list');
function showSeason(k) {
  list.innerHTML = seasons[k].map(([b, s]) => `<li><b>${b}</b><span>${s}</span></li>`).join('');
  document.querySelectorAll('.seasons button').forEach(btn => btn.setAttribute('aria-selected', String(btn.dataset.season === k)));
}
document.querySelectorAll('.seasons button').forEach(b => b.addEventListener('click', () => showSeason(b.dataset.season)));
showSeason('invierno');

// Valle 3D procedural
const canvas = document.getElementById('valley');
if (!hasWebGL()) document.documentElement.classList.add('no-webgl');
else initValley().catch(e => { console.warn('3D no disponible:', e); document.documentElement.classList.add('no-webgl'); });

function makeNoise(seed = 7) {
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s); };
  const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  return (x, y) => { let s = 0, a = .5, f = 1; for (let i = 0; i < 5; i++) { s += a * vn(x * f, y * f); f *= 2.03; a *= .5; } return s; };
}

async function initValley() {
  const THREE = await import('../_comun/three.js');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, .1, 400);
  scene.fog = new THREE.Fog('#1b2438', 30, 150);

  const fbm = makeNoise(11);
  const height = (x, z) => {
    const ridge = Math.pow(Math.min(1, Math.abs(x) / 46), 1.5) * 26;
    const n = fbm(x * .045 + 10, z * .045) * 14 - 6;
    const detail = fbm(x * .2, z * .2) * 1.6;
    return ridge + n * (.35 + Math.min(1, Math.abs(x) / 30)) + detail - 1.6;
  };

  // Terreno con sombreado plano y colores por altura
  const W = 150, D = 220, geo = new THREE.PlaneGeometry(W, D, 150, 220);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)));
  const terrain = geo.toNonIndexed(); terrain.computeVertexNormals();
  const tp = terrain.attributes.position, tn = terrain.attributes.normal, colors = [];
  const cSand = new THREE.Color('#6b6a55'), cForest = new THREE.Color('#1f3b2f'), cMoss = new THREE.Color('#3c5a3c'), cRock = new THREE.Color('#5d6670'), cSnow = new THREE.Color('#f1f4f7'), c = new THREE.Color();
  for (let i = 0; i < tp.count; i += 3) {
    const y = (tp.getY(i) + tp.getY(i + 1) + tp.getY(i + 2)) / 3, slope = 1 - tn.getY(i);
    if (y < .5) c.copy(cSand); else if (y < 5) c.copy(cForest).lerp(cMoss, Math.random() * .4); else if (y < 11) c.copy(cRock).lerp(cForest, Math.max(0, .5 - slope));
    else c.copy(cSnow).lerp(cRock, Math.min(1, slope * 1.6));
    for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b);
  }
  terrain.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  scene.add(new THREE.Mesh(terrain, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .95 })));

  // Lago
  const water = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: '#2b4a63', metalness: .7, roughness: .18, transparent: true, opacity: .92 }));
  water.rotation.x = -Math.PI / 2; water.position.y = .25; scene.add(water);

  // Bosque de lengas (conos instanciados)
  const treeGeo = new THREE.ConeGeometry(.55, 2.2, 6); treeGeo.translate(0, 1.1, 0);
  const trees = new THREE.InstancedMesh(treeGeo, new THREE.MeshStandardMaterial({ color: '#173327', flatShading: true, roughness: 1 }), 2200);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(); let n = 0, tries = 0;
  while (n < 2200 && tries < 30000) {
    tries++; const x = (Math.random() - .5) * 110, z = (Math.random() - .5) * 200, y = height(x, z);
    if (y > .9 && y < 7.5 && Math.abs(x) > 4) { const k = .6 + Math.random() * .9; s.set(k, k * (.8 + Math.random() * .6), k); v.set(x, y - .1, z); m.compose(v, q, s); trees.setMatrixAt(n++, m); }
  }
  trees.count = n; scene.add(trees);

  // Textura redonda para estrellas y copos
  const flake = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.5, 'rgba(255,255,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  // Cielo con degradé y estrellas
  const skyU = { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({ uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying float vY; void main(){ vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying float vY; void main(){ float t = smoothstep(-.05, .55, vY); gl_FragColor = vec4(mix(bottom, top, t), 1.0); }' }));
  scene.add(sky);
  const starPos = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) { const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * .45; starPos.set([Math.cos(th) * Math.cos(ph) * 280, Math.sin(ph) * 280 + 10, Math.sin(th) * Math.cos(ph) * 280], i * 3); }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, map: flake, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false });
  scene.add(new THREE.Points(starGeo, starMat));

  // Nieve alrededor de la cámara
  const SN = 1400, snowPos = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) snowPos.set([(Math.random() - .5) * 40, Math.random() * 20, (Math.random() - .5) * 40], i * 3);
  const snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
    const snowMat = new THREE.PointsMaterial({ color: '#ffffff', size: .16, map: flake, transparent: true, opacity: .85, depthWrite: false });
  const snow = new THREE.Points(snowGeo, snowMat); scene.add(snow);

  // Luces
  const sun = new THREE.DirectionalLight('#ffffff', 1); scene.add(sun);
  const hemi = new THREE.HemisphereLight('#8fa6c8', '#1a2a22', .6); scene.add(hemi);

  const P = { // noche → amanecer → mediodía
    top: ['#070d1a', '#2d3f66', '#4f8fc4'].map(x => new THREE.Color(x)),
    bottom: ['#22304d', '#ffb48a', '#d9e7ef'].map(x => new THREE.Color(x)),
    fog: ['#18223a', '#d49c86', '#c6d9e5'].map(x => new THREE.Color(x)),
    sun: ['#6f86b8', '#ffb07a', '#fff6e8'].map(x => new THREE.Color(x)),
    sunI: [.35, 1.6, 2.4], hemiI: [.35, .7, 1.1]
  };
  const mix3 = (arr, t, out) => t < .5 ? out.copy(arr[0]).lerp(arr[1], t * 2) : out.copy(arr[1]).lerp(arr[2], (t - .5) * 2);
  const num3 = (arr, t) => t < .5 ? arr[0] + (arr[1] - arr[0]) * t * 2 : arr[1] + (arr[2] - arr[1]) * (t - .5) * 2;

  let mx = 0, tmx = 0, my = 0, tmy = 0, smooth = 0;
  addEventListener('pointermove', e => { tmx = e.clientX / innerWidth - .5; tmy = e.clientY / innerHeight - .5; }, { passive: true });
  function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < 700 ? 68 : 55; camera.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();

  const look = new THREE.Vector3();
  visibleLoop(canvas, (dt, t) => {
    smooth += (st.fly - smooth) * (reduced ? 1 : .06);
    mx += (tmx - mx) * .04; my += (tmy - my) * .04;
    const f = smooth;
    const z = 80 - f * 150, x = Math.sin(f * 5) * 3;
    const ground = Math.max(.25, height(x, z));
    camera.position.set(x + mx * 2, ground + 4.2 + (1 - f) * 2.5, z);
    look.set(x * .6 + mx * 6, ground + 2.4 - my * 3, z - 18); camera.lookAt(look);
    // Hora del día según el recorrido
    mix3(P.top, f, skyU.top.value); mix3(P.bottom, f, skyU.bottom.value); mix3(P.fog, f, scene.fog.color);
    mix3(P.sun, f, sun.color); sun.intensity = num3(P.sunI, f); hemi.intensity = num3(P.hemiI, f);
    sun.position.set(-40 + f * 60, 8 + f * 60, z - 80);
    starMat.opacity = Math.max(0, 1 - f * 2.4);
    snowMat.opacity = .85 * Math.max(.15, 1 - f * 1.3);
    // Nieve que cae y acompaña a la cámara
    snow.position.set(camera.position.x, camera.position.y - 8, camera.position.z - 8);
    if (!reduced) { const a = snowGeo.attributes.position.array; for (let i = 0; i < SN; i++) { a[i * 3 + 1] -= dt * (1.2 + (i % 7) * .15); a[i * 3] += Math.sin(t + i) * dt * .3; if (a[i * 3 + 1] < 0) a[i * 3 + 1] = 20; } snowGeo.attributes.position.needsUpdate = true; }
    const off = journey.getBoundingClientRect().bottom < innerHeight * .3;
    canvas.style.opacity = off ? '0' : '1';
    if (!off) renderer.render(scene, camera);
  });
}
