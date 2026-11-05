// Escena 3D de la plantilla demo (código propio de AgentiCuántico; three.js MIT servido desde el sitio).
import * as THREE from '../_comun/three.js';
const cv=document.getElementById('gl'),RM=matchMedia('(prefers-reduced-motion: reduce)').matches,root=document.documentElement;
let R;try{R=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true,powerPreference:'high-performance'})}catch(e){}
if(!R){root.classList.add('no-gl')}else{
R.setPixelRatio(Math.min(devicePixelRatio,1.75));
R.toneMapping=THREE.ACESFilmicToneMapping;R.toneMappingExposure=1.05;R.outputColorSpace=THREE.SRGBColorSpace;
let dirty=true,tScale=1,cScale=1;
const scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(32,1,.1,60);cam.position.set(0,0,7);

// --- Mapa de entorno propio: "estudio" oscuro con paneles cálidos, procesado con PMREM ---
const envS=new THREE.Scene();
envS.add(new THREE.Mesh(new THREE.SphereGeometry(20,32,16),new THREE.MeshBasicMaterial({color:0x0d0b09,side:THREE.BackSide})));
const panel=(w,h,c,x,y,z,ry)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:c,side:THREE.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);envS.add(m)};
panel(10,3,0xfff1d6,0,9,4);panel(3,12,0xffd9a0,-10,1,2);panel(2.4,10,0x9a8a70,10,0,-3);panel(14,1.2,0xffffff,0,-2,-12);panel(6,6,0x3a2a18,0,-10,0);
const pm=new THREE.PMREMGenerator(R);scene.environment=pm.fromScene(envS,.03).texture;pm.dispose();

// --- Luces ---
const key=new THREE.DirectionalLight(0xffe7c2,2.2);key.position.set(3,4,5);
const rim=new THREE.DirectionalLight(0xc8a96a,3);rim.position.set(-4,1,-3);
scene.add(key,rim,new THREE.AmbientLight(0xffffff,.15));

// --- Frasco armado con geometrías ---
const bottle=new THREE.Group(),inner=new THREE.Group();bottle.add(inner);scene.add(bottle);
function rr(w,h,r){const s=new THREE.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s}
const D=.78,BW=1.5,BH=1.85;
const bodyG=new THREE.ExtrudeGeometry(rr(BW,BH,.26),{depth:D,bevelEnabled:true,bevelThickness:.08,bevelSize:.08,bevelSegments:3,curveSegments:10});bodyG.center();
// Vidrio: transparencia + reflejos de entorno (sin pase de transmisión: más liviano en móvil y estable en GPUs modestas)
const glass=new THREE.MeshPhysicalMaterial({color:0xf3eadb,metalness:0,roughness:.03,transparent:true,opacity:.2,clearcoat:1,clearcoatRoughness:.03,ior:1.52,envMapIntensity:2.2,specularIntensity:1,depthWrite:false});
const body=new THREE.Mesh(bodyG,glass);inner.add(body);
// líquido (opaco y cálido, se ve a través del vidrio)
const liqG=new THREE.ExtrudeGeometry(rr(BW-.34,BH*.66,.16),{depth:D-.26,bevelEnabled:true,bevelThickness:.04,bevelSize:.04,bevelSegments:2,curveSegments:8});liqG.center();
const liquid=new THREE.Mesh(liqG,new THREE.MeshPhysicalMaterial({color:0xb5651d,roughness:.18,metalness:0,clearcoat:1,emissive:0x3a1404,emissiveIntensity:.6,sheen:.4,sheenColor:new THREE.Color(0xffc27a)}));
liquid.position.y=-BH*.15;inner.add(liquid);
// base gruesa
const baseM=new THREE.Mesh(new THREE.BoxGeometry(BW-.12,.12,D-.06),new THREE.MeshPhysicalMaterial({color:0xeee3cf,roughness:.08,transparent:true,opacity:.45,clearcoat:1}));baseM.position.y=-BH/2+.04;inner.add(baseM);
// oro
const gold=new THREE.MeshStandardMaterial({color:0xc8a96a,metalness:1,roughness:.3,envMapIntensity:1.6});
const neck=new THREE.Mesh(new THREE.CylinderGeometry(.2,.24,.2,32),gold);neck.position.y=BH/2+.1+.08;inner.add(neck);
const collar=new THREE.Mesh(new THREE.TorusGeometry(.25,.035,12,48),gold);collar.rotation.x=Math.PI/2;collar.position.y=BH/2+.09;inner.add(collar);
const capG=new THREE.CylinderGeometry(.4,.44,.74,8,1);const cap=new THREE.Mesh(capG,gold);cap.position.y=BH/2+.2+.08+.37;cap.rotation.y=Math.PI/8;inner.add(cap);
const capTop=new THREE.Mesh(new THREE.CylinderGeometry(.3,.4,.08,8),gold);capTop.position.y=cap.position.y+.41;capTop.rotation.y=Math.PI/8;inner.add(capTop);
// etiqueta (CanvasTexture reescribible con el grabado)
const lc=document.createElement('canvas');lc.width=512;lc.height=384;const lx=lc.getContext('2d');
const lt=new THREE.CanvasTexture(lc);lt.colorSpace=THREE.SRGBColorSpace;lt.anisotropy=4;
let engr='',size=50;
function drawLabel(){lx.fillStyle='#0d0b09';lx.fillRect(0,0,512,384);lx.strokeStyle='#c8a96a';lx.lineWidth=3;lx.strokeRect(16,16,480,352);lx.lineWidth=1;lx.strokeRect(28,28,456,328);
  lx.fillStyle='#c8a96a';lx.textAlign='center';lx.font='400 22px Georgia,serif';lx.fillText('C A S A   V E L A R D E',256,82);
  lx.font='italic 400 64px Georgia,serif';lx.fillText('Noctámbula',256,178);
  lx.font='400 18px Georgia,serif';lx.fillText('EXTRAIT DE PARFUM  ·  '+size+' ML',256,226);
  lx.fillRect(216,252,80,1);
  lx.font=engr?'italic 400 34px Georgia,serif':'400 16px Georgia,serif';lx.fillStyle=engr?'#e3cf9f':'#7d6f52';lx.fillText(engr||'LOTE 07 · Nº 0142',256,306);lt.needsUpdate=true;dirty=true}
const label=new THREE.Mesh(new THREE.PlaneGeometry(.92,.69),new THREE.MeshStandardMaterial({map:lt,roughness:.6,metalness:.2}));label.position.set(0,-.12,D/2+.081);inner.add(label);
inner.position.y=-.35;// centra el conjunto (tapa incluida)
// sombra de contacto
const sc=document.createElement('canvas');sc.width=sc.height=128;const sx=sc.getContext('2d');const gr=sx.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(0,0,0,.7)');gr.addColorStop(1,'rgba(0,0,0,0)');sx.fillStyle=gr;sx.fillRect(0,0,128,128);
const shadow=new THREE.Mesh(new THREE.PlaneGeometry(2.6,.9),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(sc),transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-BH/2-.35-.12;bottle.add(shadow);
// polvo dorado
const PN=RM?0:(innerWidth<760?140:260),pp=new Float32Array(PN*3);for(let i=0;i<PN;i++){pp[i*3]=(Math.random()-.5)*12;pp[i*3+1]=(Math.random()-.5)*8;pp[i*3+2]=(Math.random()-.5)*6-1}
const dust=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(pp,3)),new THREE.PointsMaterial({color:0xe3cf9f,size:.022,transparent:true,opacity:.55,depthWrite:false}));scene.add(dust);
drawLabel();
addEventListener('velarde:eng',e=>{engr=e.detail.trim().slice(0,14);drawLabel()});
addEventListener('velarde:size',e=>{size=e.detail;drawLabel();const s={30:.86,50:1,100:1.12}[size];tScale=s});

// --- Capítulos: estado del frasco por sección (x, y, escala, inclinación) ---
const DESK=[{x:1.75,y:-.05,s:.86,rz:0,rx:.05},{x:-1.55,y:0,s:.98,rz:0,rx:.1},{x:2.0,y:-2.75,s:2.0,rz:-.08,rx:.25},{x:-1.5,y:-.25,s:1.7,rz:.06,rx:.05},{x:1.8,y:1.1,s:1.9,rz:0,rx:-.1},{x:0,y:-.55,s:.62,rz:.22,rx:.12},{x:1.6,y:-.05,s:1.02,rz:0,rx:.05}];
const MOB=[{x:0,y:.78,s:.45,rz:0,rx:.05},{x:0,y:.95,s:.5,rz:0,rx:.1},{x:.1,y:-.05,s:.88,rz:-.08,rx:.25},{x:-.1,y:.8,s:.9,rz:.06,rx:.05},{x:.1,y:1.95,s:.92,rz:0,rx:-.1},{x:0,y:1.05,s:.42,rz:.2,rx:.12},{x:0,y:1.15,s:.46,rz:0,rx:.05}];
const secs=[...document.querySelectorAll('[data-k]')];let centers=[];
function measure(){centers=secs.map(s=>s.offsetTop+s.offsetHeight/2-innerHeight/2)}
const ss=t=>t*t*(3-2*t),lerp=(a,b,t)=>a+(b-a)*t;
function stateAt(y,T){if(y<=centers[0])return T[0];for(let i=0;i<centers.length-1;i++){if(y<=centers[i+1]){const t=ss((y-centers[i])/(centers[i+1]-centers[i]));const a=T[i],b=T[i+1];return{x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t),s:lerp(a.s,b.s,t),rz:lerp(a.rz,b.rz,t),rx:lerp(a.rx,b.rx,t)}}}return T[T.length-1]}

let mob=false;function resize(){const w=innerWidth,h=innerHeight;R.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();mob=w<760;measure();dirty=true}
resize();addEventListener('resize',resize);addEventListener('load',measure);new ResizeObserver(measure).observe(document.body);

const cur={x:0,y:0,s:1,rz:0,rx:0,ry:0};let mx=0,my=0;
addEventListener('pointermove',e=>{mx=e.clientX/innerWidth-.5;my=e.clientY/innerHeight-.5},{passive:true});
addEventListener('scroll',()=>dirty=true,{passive:true});
// Pausa: pestaña oculta o footer en pantalla (el canvas se atenúa y deja de renderizar)
let hidden=false,footOn=false;
new IntersectionObserver(([e])=>{footOn=e.isIntersecting&&e.intersectionRatio>.35;root.classList.toggle('gl-fade',footOn);sync()},{threshold:[0,.35,.6]}).observe(document.getElementById('foot'));
document.addEventListener('visibilitychange',()=>{hidden=document.hidden;sync()});
let running=false;function sync(){const on=!hidden&&!footOn;if(on&&!running){running=true;clk.getDelta();R.setAnimationLoop(frame)}else if(!on&&running){running=false;setTimeout(()=>{if(!running)R.setAnimationLoop(null)},1500)}}
const clk=new THREE.Clock();let t=0,last=-1;
function frame(){const dt=Math.min(clk.getDelta(),.05);t+=dt;
  const y=scrollY,T=mob?MOB:DESK,st=stateAt(y,T),k=RM?1:1-Math.pow(.004,dt);
  const docH=document.documentElement.scrollHeight-innerHeight,g=docH>0?y/docH:0;
  cur.x+=(st.x-cur.x)*k;cur.y+=(st.y-cur.y)*k;cur.s+=(st.s-cur.s)*k;cur.rz+=(st.rz-cur.rz)*k;cur.rx+=(st.rx-cur.rx)*k;cScale+=(tScale-cScale)*k;
  const tr=g*Math.PI*3+(RM?0:t*.12)+(mob?0:mx*.4);cur.ry+=(tr-cur.ry)*k;
  bottle.position.set(cur.x,cur.y,0);bottle.scale.setScalar(cur.s*cScale);bottle.rotation.set(cur.rx+(mob?0:my*.15),cur.ry,cur.rz);
  if(!RM){bottle.position.y+=Math.sin(t*.8)*.04;dust.rotation.y=t*.01;dust.position.y=Math.sin(t*.2)*.1-g*2}
  document.getElementById('amb').style.setProperty('--ax',(50+cur.x/ (mob?2:5)*50)+'%');
  if(RM&&!dirty&&last===y)return;last=y;dirty=false;R.render(scene,cam)}
sync();root.classList.add('gl-on');
}
