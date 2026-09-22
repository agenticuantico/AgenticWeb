import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const host=document.querySelector("#robotAvatar");
const canvas=document.querySelector("#avatarCanvas");
if(!host||!canvas) throw new Error("AgentiCuantico avatar host missing");

canvas.removeAttribute("style");
canvas.style.cssText="position:absolute;inset:0;width:100%;height:100%;display:block;z-index:2;touch-action:none";

const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.08;

const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(25,1,.1,100);
camera.position.set(0,.25,6.1);

scene.add(new THREE.HemisphereLight(0xbad9ff,0x090516,2.3));
const key=new THREE.DirectionalLight(0xffffff,3.8); key.position.set(-2.8,4.5,5); scene.add(key);
const rim=new THREE.PointLight(0x8a6cff,28,9); rim.position.set(2.6,1.7,-1.5); scene.add(rim);
const cyan=new THREE.PointLight(0x40e8ff,20,8); cyan.position.set(-2,.2,2.8); scene.add(cyan);

const root=new THREE.Group(); root.position.y=-.55; scene.add(root);
const make=(g,c,r=.5,m=0)=>new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m}));
const skin=0xeab09b, hair=0x171528, suit=0x080f25, suit2=0x182956, white=0xf7fbff, iris=0x52eaff, lip=0xc64e82, glow=0x55eaff;

const torso=make(new THREE.CapsuleGeometry(.7,1.15,10,24),suit,.28,.65); torso.scale.set(1.05,1.02,.62); torso.position.y=-.85; root.add(torso);
const collar=make(new THREE.TorusGeometry(.35,.07,12,32),0x3b4f86,.25,.7); collar.rotation.x=Math.PI/2; collar.position.set(0,-.25,.02); root.add(collar);
const neck=make(new THREE.CylinderGeometry(.18,.23,.32,24),skin,.65); neck.position.y=.02; root.add(neck);

const head=make(new THREE.SphereGeometry(.79,40,30),skin,.6); head.scale.set(.86,1.1,.8); head.position.set(0,.72,.05); root.add(head);
const hairCap=make(new THREE.SphereGeometry(.84,40,28,0,Math.PI*2,0,Math.PI*.7),hair,.32,.12); hairCap.scale.set(.94,1.07,.86); hairCap.position.set(0,.94,-.03); root.add(hairCap);
for(const side of[-1,1]){
  const lock=make(new THREE.SphereGeometry(.32,24,18),hair,.32,.12); lock.scale.set(.72,1.8,.62); lock.position.set(side*.66,.57,-.02); root.add(lock);
}
const browMat=new THREE.MeshStandardMaterial({color:hair,roughness:.4});
for(const side of[-1,1]){const brow=new THREE.Mesh(new THREE.CapsuleGeometry(.035,.25,6,10),browMat);brow.position.set(side*.29,.91,.72);brow.rotation.z=side*.08;root.add(brow)}

const eyes=[];
for(const side of[-1,1]){
  const e=make(new THREE.SphereGeometry(.12,24,18),white,.16,.18); e.scale.z=.42; e.position.set(side*.29,.74,.75); root.add(e);
  const p=make(new THREE.SphereGeometry(.06,20,14),iris,.08,.8); p.position.set(side*.29,.74,.86); root.add(p); eyes.push(p);
  const glowRing=make(new THREE.TorusGeometry(.09,.012,8,24),iris,.12,.7); glowRing.position.set(side*.29,.74,.855); root.add(glowRing);
}
const nose=make(new THREE.CapsuleGeometry(.045,.2,8,12),skin,.6); nose.rotation.x=Math.PI/2;nose.position.set(0,.47,.79);root.add(nose);
const mouth=make(new THREE.TorusGeometry(.14,.026,10,28,Math.PI),lip,.28,.12);mouth.rotation.z=Math.PI;mouth.position.set(0,.29,.77);root.add(mouth);

const arms=[];
for(const side of[-1,1]){
 const upper=make(new THREE.CapsuleGeometry(.17,.7,8,16),suit2,.3,.7);upper.position.set(side*.5,-.9,0);upper.rotation.z=side*.14;root.add(upper);
 const fore=make(new THREE.CapsuleGeometry(.145,.64,8,16),suit,.3,.65);fore.position.set(side*.53,-1.43,.08);fore.rotation.z=side*.08;root.add(fore);
 const hand=make(new THREE.SphereGeometry(.18,18,14),skin,.62);hand.position.set(side*.55,-1.82,.18);root.add(hand);arms.push({upper,fore,hand,side});
}
const core=make(new THREE.SphereGeometry(.13,20,16),glow,.12,.9);core.position.set(0,-.86,.43);root.add(core);
const coreRing=make(new THREE.TorusGeometry(.22,.018,8,40),glow,.12,.8);coreRing.position.set(0,-.86,.44);root.add(coreRing);

const pCount=900,pos=new Float32Array(pCount*3);
for(let i=0;i<pCount;i++){const r=2.15+Math.random()*2.4,a=Math.random()*Math.PI*2,b=Math.acos(2*Math.random()-1);pos[i*3]=Math.sin(b)*Math.cos(a)*r;pos[i*3+1]=Math.cos(b)*r*.72;pos[i*3+2]=Math.sin(b)*Math.sin(a)*r}
const pg=new THREE.BufferGeometry();pg.setAttribute("position",new THREE.BufferAttribute(pos,3));
const particles=new THREE.Points(pg,new THREE.PointsMaterial({color:0x55ddff,size:.028,transparent:true,opacity:.58,blending:THREE.AdditiveBlending,depthWrite:false}));scene.add(particles);

let tx=0,ty=0,speaking=false,level=0,timer=null;
canvas.addEventListener("pointermove",e=>{const r=canvas.getBoundingClientRect();tx=((e.clientX-r.left)/r.width-.5)*2;ty=((e.clientY-r.top)/r.height-.5)*2});
canvas.addEventListener("pointerleave",()=>{tx=0;ty=0});
function start(){speaking=true;if(timer)clearInterval(timer);timer=setInterval(()=>level=.2+Math.random()*.8,70)}
function stop(){speaking=false;if(timer)clearInterval(timer);timer=null;level=0}
const synth=window.speechSynthesis;
if(synth){const original=synth.speak.bind(synth);synth.speak=u=>{u.onstart=(()=>{start();});u.onend=(()=>{stop();});u.onerror=(()=>{stop();});original(u)}}
const voiceStatus=document.querySelector("#voiceStatus");
if(voiceStatus)new MutationObserver(()=>{/hablando|reproduciendo/i.test(voiceStatus.textContent||"")?start():/lista|detener/i.test(voiceStatus.textContent||"")&&stop()}).observe(voiceStatus,{subtree:true,childList:true,characterData:true});

function resize(){const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()} new ResizeObserver(resize).observe(canvas);resize();
const clock=new THREE.Clock();
function render(){const t=clock.getElapsedTime(),m=speaking?Math.max(level,.18+.16*Math.sin(t*16)):0;
 particles.rotation.y=t*.035; root.rotation.y+=(tx*.12+Math.sin(t*.5)*.025-root.rotation.y)*.04; root.rotation.x+=(ty*.035-root.rotation.x)*.04; root.position.y=-.55+Math.sin(t*1.1)*.025;
 mouth.scale.y=.75+m*2.2; core.scale.setScalar(1+m*.35);
 eyes.forEach((p,i)=>p.position.x+=(tx*.035+(i? .29:-.29)-p.position.x)*.08);
 arms.forEach(a=>{const wv=speaking?Math.sin(t*2.2+a.side)*.08:Math.sin(t*.8+a.side)*.02;a.upper.rotation.z=a.side*(.14+wv);a.fore.rotation.z=a.side*(.08-wv*.6);a.hand.position.y=-1.82+Math.sin(t*1.6+a.side)*.018});
 renderer.render(scene,camera);requestAnimationFrame(render)}
render();

const state=document.querySelector("#avatarRigStatus"); if(state)state.textContent="3D · mujer IA · activa";
const name=document.querySelector("#avatarName"); if(name)name.textContent="AgentiQ";
