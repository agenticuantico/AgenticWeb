// Entorno de reflejos procedural (sin imágenes HDR externas).
import * as THREE from './three.js';
export function makeEnv(renderer, { top = '#ffffff', bottom = '#202020', lights = ['#ffffff'] } = {}) {
  const s = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 32, 16);
  const c1 = new THREE.Color(top), c2 = new THREE.Color(bottom), col = [];
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const t = (pos.getY(i) / 10 + 1) / 2; const c = c2.clone().lerp(c1, t); col.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  s.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  lights.forEach((l, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.4), new THREE.MeshBasicMaterial({ color: l, side: THREE.DoubleSide }));
    const a = (i / lights.length) * Math.PI * 2;
    m.position.set(Math.cos(a) * 6, 4 - i, Math.sin(a) * 6); m.lookAt(0, 0, 0); s.add(m);
  });
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.04).texture; pm.dispose();
  return tex;
}
