// Estiba · plantilla demo (código original de AgentiCuántico, 2026).
import { initCommon, reduced, scrollProgress, sectionProgress, hasWebGL, visibleLoop } from '../_comun/demo.js';

initCommon();

const yardWrap = document.querySelector('.yard-wrap');
const phases = [...document.querySelectorAll('.phases li')];
const st = { p: 0 };
scrollProgress(() => {
  st.p = sectionProgress(yardWrap);
  const i = Math.min(2, Math.floor(st.p * 3 * .999));
  phases.forEach((li, k) => li.classList.toggle('on', k <= i));
});

// Seguimiento de ejemplo
const demo = [
  ['done', 'Retiro en origen', 'Depósito del cliente · confirmado'],
  ['done', 'Ingreso a depósito', 'Control de bultos y etiquetado'],
  ['done', 'Consolidado en contenedor', 'Contenedor 40\' · precinto colocado'],
  ['now', 'En tránsito a terminal', 'Turno asignado · esperando ingreso'],
  ['', 'Embarque', 'Pendiente'],
  ['', 'Entrega', 'Pendiente']
];
const form = document.getElementById('trackForm'), input = document.getElementById('trackCode'), msg = document.getElementById('trackMsg'), tl = document.getElementById('timeline');
document.querySelector('[data-fill]').addEventListener('click', e => { input.value = e.currentTarget.dataset.fill; form.requestSubmit(); });
form.addEventListener('submit', e => {
  e.preventDefault();
  const code = input.value.trim().toUpperCase();
  if (code === 'EST-2048') {
    msg.textContent = 'Envío de ejemplo encontrado. Estos estados son ficticios.';
    tl.innerHTML = demo.map(([c, b, s], i) => `<li class="${c}" style="animation-delay:${i * 90}ms"><b>${b}</b><span>${s}</span></li>`).join('');
  } else {
    msg.textContent = 'No encontramos ese código. En esta demo solo existe EST-2048.';
    tl.innerHTML = '';
  }
});

// Patio de contenedores 3D (vista isométrica)
const canvas = document.getElementById('yard');
if (!hasWebGL()) document.documentElement.classList.add('no-webgl');
else initYard().catch(e => { console.warn('3D no disponible:', e); document.documentElement.classList.add('no-webgl'); });

async function initYard() {
  const THREE = await import('../_comun/three.js');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 400);

  // Piso con demarcación (textura dibujada en canvas)
  const gtex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
    g.fillStyle = '#16233a'; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(238,242,247,.10)'; g.lineWidth = 2; for (let i = 0; i <= 512; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
    g.strokeStyle = 'rgba(255,196,61,.55)'; g.setLineDash([22, 18]); g.lineWidth = 4; g.beginPath(); g.moveTo(0, 470); g.lineTo(512, 470); g.stroke();
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ map: gtex, roughness: .95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  // Textura corrugada para los contenedores
  const corr = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
    for (let x = 0; x < 256; x += 8) { const gr = g.createLinearGradient(x, 0, x + 8, 0); gr.addColorStop(0, '#d8d8d8'); gr.addColorStop(.5, '#ffffff'); gr.addColorStop(1, '#bdbdbd'); g.fillStyle = gr; g.fillRect(x, 0, 8, 64); }
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, 256, 3); g.fillRect(0, 61, 256, 3);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const palette = ['#ff7a1a', '#1f4e8c', '#2c8c86', '#b8322a', '#d9dde3', '#3b4a5e', '#e2a72e'];
  const mats = palette.map(col => new THREE.MeshStandardMaterial({ color: col, map: corr, roughness: .7, metalness: .2 }));
  const boxGeo = new THREE.BoxGeometry(6.06, 2.59, 2.44);

  const yard = new THREE.Group(); scene.add(yard);
  const conts = [];
  const ROWS = 4, BAYS = 4, TIERS = 3;
  let k = 0;
  for (let tier = 0; tier < TIERS; tier++) for (let r = 0; r < ROWS; r++) for (let b = 0; b < BAYS; b++) {
    if (tier === 2 && (r + b) % 2 === 1) continue; // pila irregular, más natural
    const m = new THREE.Mesh(boxGeo, mats[(r * 3 + b * 5 + tier * 2) % mats.length]);
    m.castShadow = m.receiveShadow = true;
    const target = new THREE.Vector3(b * 6.6 - 10, 1.3 + tier * 2.62, r * 3.0 - 4.5);
    m.position.copy(target);
    yard.add(m); conts.push({ m, target, t: 0 }); k++;
  }
  conts.forEach((c, i) => { c.t = .04 + (i / conts.length) * .74; });

  // Grúa pórtico
  const steel = new THREE.MeshStandardMaterial({ color: '#ffb000', roughness: .5, metalness: .4 });
  const crane = new THREE.Group();
  const legGeo = new THREE.BoxGeometry(.6, 13, .6);
  [[-1.4, -9], [-1.4, 9], [1.4, -9], [1.4, 9]].forEach(([x, z]) => { const l = new THREE.Mesh(legGeo, steel); l.position.set(x, 6.5, z); l.castShadow = true; crane.add(l); });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.2, 19.2), steel); beam.position.y = 13.2; beam.castShadow = true; crane.add(beam);
  const trolley = new THREE.Mesh(new THREE.BoxGeometry(2, .9, 2), new THREE.MeshStandardMaterial({ color: '#2b3442', roughness: .6 })); trolley.position.y = 12.3; crane.add(trolley);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 1, 6), new THREE.MeshStandardMaterial({ color: '#c9d2dc' })); crane.add(cable);
  const spreader = new THREE.Mesh(new THREE.BoxGeometry(6.2, .3, 2.5), new THREE.MeshStandardMaterial({ color: '#ffb000', roughness: .5 })); crane.add(spreader);
  scene.add(crane);

  // Camión
  const truck = new THREE.Group();
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 2.4), new THREE.MeshStandardMaterial({ color: '#eef2f7', roughness: .4 })); cab.position.set(4.3, 1.6, 0); truck.add(cab);
  const bed = new THREE.Mesh(new THREE.BoxGeometry(6.6, .4, 2.4), new THREE.MeshStandardMaterial({ color: '#2b3442' })); bed.position.y = .7; truck.add(bed);
  const load = new THREE.Mesh(boxGeo, mats[0]); load.position.y = 2.2; truck.add(load);
  truck.children.forEach(c => c.castShadow = true);
  truck.position.set(-40, 0, 12); scene.add(truck);

  // Luces
  scene.add(new THREE.HemisphereLight('#bcd3ff', '#0a1220', 1.1));
  const sun = new THREE.DirectionalLight('#fff1dc', 2.4); sun.position.set(-20, 40, 18); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 120 });
  scene.add(sun);

  const target = new THREE.Vector3();
  let zoom = 28, mobile = false, mx = 0, tmx = 0;
  addEventListener('pointermove', e => { tmx = e.clientX / innerWidth - .5; }, { passive: true });
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false);
    mobile = w < 860; zoom = mobile ? 30 : 26;
    const a = w / h; camera.left = -zoom * a; camera.right = zoom * a; camera.top = zoom; camera.bottom = -zoom; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();
  const right = new THREE.Vector3(1, 0, -1).normalize();
  const ease = x => 1 - Math.pow(1 - x, 3);

  visibleLoop(canvas, (dt, t) => {
    mx += (tmx - mx) * .05;
    const p = reduced ? 1 : st.p;
    // Encuadre: a la derecha en escritorio, abajo en móvil
    target.set(0, 0, 0).addScaledVector(right, mobile ? 0 : -16);
    if (mobile) target.y = 11;
    const ang = Math.PI / 4 + mx * .25 + p * .35;
    camera.position.set(target.x + Math.cos(ang) * 60, target.y + 52, target.z + Math.sin(ang) * 60);
    camera.lookAt(target);

    // Contenedores que bajan y se apilan según el scroll
    let active = null;
    conts.forEach(c => {
      const local = (p - c.t) / .06;
      if (local <= 0) { c.m.visible = false; return; }
      c.m.visible = true;
      const e = ease(Math.min(1, local));
      c.m.position.set(c.target.x, c.target.y + (1 - e) * 9, c.target.z);
      if (local < 1) active = c;
    });
    // La grúa sigue al contenedor que se está colocando
    const goal = active ? active.target : conts[conts.length - 1].target;
    crane.position.x += (goal.x - crane.position.x) * .1;
    trolley.position.z += (goal.z - trolley.position.z) * .12;
    const hookY = active ? active.m.position.y + 1.45 : 9;
    spreader.position.set(0, hookY, trolley.position.z);
    cable.position.set(0, (12.3 + hookY) / 2, trolley.position.z); cable.scale.y = Math.max(.1, 12.3 - hookY);
    // Despacho: el camión cruza en la última etapa
    const tp = Math.max(0, (p - .7) / .3);
    truck.position.x = -40 + ((t * 9) % 90) * (tp > 0 ? 1 : 0);
    truck.visible = tp > 0;
    renderer.render(scene, camera);
  });
}
