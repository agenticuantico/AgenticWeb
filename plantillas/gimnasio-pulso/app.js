// Pulso · plantilla demo (código original de AgentiCuántico, 2026).
import { initCommon, reduced, scrollProgress, hasWebGL, visibleLoop } from '../_comun/demo.js';

initCommon();

// Ritmo elegido (latidos por minuto)
const bpmIn = document.getElementById('bpm'), bpmOut = document.querySelector('#bpm-out b');
let bpm = +bpmIn.value;
const setFill = () => bpmIn.style.setProperty('--fill', ((bpm - 60) / 120 * 100).toFixed(1) + '%');
bpmIn.addEventListener('input', () => { bpm = +bpmIn.value; bpmOut.textContent = bpm; setFill(); document.querySelector('.mark').style.animationDuration = (60 / bpm) + 's'; });
setFill();

// Tipografía cinética: el ancho variable (wdth) responde a la velocidad del scroll
const kins = [...document.querySelectorAll('[data-kin]')];
let vel = 0, lastY = scrollY, page = 0;
scrollProgress(p => { page = p; });
if (!reduced) (function k() {
  const v = scrollY - lastY; lastY = scrollY; vel += (Math.min(60, Math.abs(v)) - vel) * .12;
  const w = Math.max(62, 100 - vel * 1.4 + Math.sin(performance.now() / 1000 * (bpm / 60) * Math.PI * 2) * 2);
  kins.forEach((el, i) => el.style.setProperty('--w', (i === 1 ? 125 - (100 - w) : w).toFixed(1)));
  requestAnimationFrame(k);
})();

// Tarjetas: el relleno de color sale desde el puntero
document.querySelectorAll('.d-card').forEach(c => c.addEventListener('pointerenter', e => {
  const r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
}));

// Horarios de ejemplo
const plan = [
  [['07:00', 'Funcional', 'Coach a confirmar · 50 min'], ['09:00', 'Movilidad', '45 min'], ['18:30', 'Boxeo', 'Inicial · 60 min'], ['19:45', 'HIIT', '40 min']],
  [['07:00', 'Fuerza', 'Progresión semanal · 60 min'], ['12:30', 'Ciclismo indoor', '45 min'], ['19:00', 'Funcional', '50 min']],
  [['07:00', 'Funcional', '50 min'], ['18:30', 'Boxeo', 'Intermedio · 60 min'], ['20:00', 'Movilidad', '45 min']],
  [['07:00', 'Fuerza', '60 min'], ['12:30', 'HIIT', '40 min'], ['19:00', 'Ciclismo indoor', '45 min'], ['20:00', 'Boxeo', 'Inicial · 60 min']],
  [['07:00', 'Funcional', '50 min'], ['18:00', 'HIIT', '40 min'], ['19:00', 'Fuerza', 'Técnica de barra · 60 min']],
  [['10:00', 'Funcional en equipo', '60 min'], ['11:15', 'Movilidad', '45 min']]
];
const slots = document.getElementById('slots');
function showDay(d) {
  slots.innerHTML = plan[d].map(([t, n, s]) => `<li><time>${t}</time><b>${n}</b><span>${s}</span></li>`).join('');
  document.querySelectorAll('.days button').forEach(b => b.setAttribute('aria-selected', String(+b.dataset.day === d)));
}
document.querySelectorAll('.days button').forEach(b => b.addEventListener('click', () => showDay(+b.dataset.day)));
document.querySelector('.days').addEventListener('keydown', e => {
  if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
  const bs = [...document.querySelectorAll('.days button')]; const i = bs.indexOf(document.activeElement); if (i < 0) return;
  const n = bs[(i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length]; n.focus(); n.click();
});
showDay(Math.min(5, Math.max(0, (new Date().getDay() + 6) % 7)));

// Núcleo 3D: esfera que late con desplazamiento por ruido (shader propio)
const canvas = document.getElementById('core');
if (!hasWebGL()) document.documentElement.classList.add('no-webgl');
else initCore().catch(e => { console.warn('3D no disponible:', e); document.documentElement.classList.add('no-webgl'); });

async function initCore() {
  const THREE = await import('../_comun/three.js');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, .1, 100); camera.position.set(0, 0, 6.5);

  const uniforms = { uTime: { value: 0 }, uBeat: { value: 0 }, uAmp: { value: .28 }, uMouse: { value: new THREE.Vector2() },
    uA: { value: new THREE.Color('#ff5a1f') }, uB: { value: new THREE.Color('#ffd0bf') }, uC: { value: new THREE.Color('#2a0700') } };
  const noise = /* glsl */`
    float h(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float vn(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }
    float fbm(vec3 p){ float a = .5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vn(p); p *= 2.02; a *= .5; } return s; }`;
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: noise + /* glsl */`
      uniform float uTime, uBeat, uAmp; uniform vec2 uMouse;
      varying float vD; varying vec3 vN; varying vec3 vP;
      void main(){
        vec3 p = position;
        float n = fbm(normal * 1.6 + vec3(uTime * .25, uTime * .18, uMouse.x));
        float d = (n - .45) * uAmp * (1.0 + uBeat * 1.6) + uBeat * .12;
        p += normal * d; vD = d; vN = normalize(normalMatrix * normal); vP = (modelViewMatrix * vec4(p, 1.0)).xyz;
        gl_Position = projectionMatrix * vec4(vP, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uA, uB, uC; uniform float uBeat;
      varying float vD; varying vec3 vN; varying vec3 vP;
      void main(){
        vec3 v = normalize(-vP); float fr = pow(1.0 - max(dot(vN, v), 0.0), 2.2);
        vec3 col = mix(uC, uA, smoothstep(-.12, .22, vD));
        col = mix(col, uB, fr * (.65 + uBeat * .35));
        col += uA * uBeat * .18;
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 48), mat); scene.add(blob);

  // Anillos de onda expansiva en cada latido
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.02, 128), new THREE.MeshBasicMaterial({ color: '#ff5a1f', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    scene.add(r); rings.push({ m: r, t: 1 + i });
  }

  let mx = 0, my = 0, tmx = 0, tmy = 0;
  addEventListener('pointermove', e => { tmx = e.clientX / innerWidth - .5; tmy = e.clientY / innerHeight - .5; }, { passive: true });
  function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); blob.position.y = w < 860 ? .95 : .1; blob.scale.setScalar(w < 860 ? .62 : 1); rings.forEach(r => r.m.position.y = blob.position.y); }
  addEventListener('resize', resize); resize();

  let phase = 0, lastBeat = 0;
  visibleLoop(canvas, (dt, t) => {
    mx += (tmx - mx) * .05; my += (tmy - my) * .05;
    phase += dt * (bpm / 60);
    const f = phase % 1;
    // Doble golpe del corazón (lub-dub)
    const beat = reduced ? .15 : Math.exp(-f * 14) + .55 * Math.exp(-Math.max(0, f - .18) * 16) * (f > .18 ? 1 : 0);
    uniforms.uBeat.value = beat; uniforms.uTime.value = t; uniforms.uMouse.value.set(mx, my);
    uniforms.uAmp.value = .26 + page * .5;
    blob.rotation.y += dt * .15; blob.rotation.x = my * .5; blob.rotation.z = mx * .3;
    if (Math.floor(phase) !== lastBeat && !reduced) { lastBeat = Math.floor(phase); const r = rings.find(r => r.t >= 1); if (r) r.t = 0; }
    rings.forEach(r => { r.t = Math.min(1.2, r.t + dt * .9); const s = 1.35 * (1 + r.t * 1.4) * blob.scale.x; r.m.scale.setScalar(s); r.m.material.opacity = r.t < 1 ? (1 - r.t) * .5 : 0; r.m.lookAt(camera.position); });
    renderer.render(scene, camera);
  });
}
