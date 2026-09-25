import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import {GLTFLoader} from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";

const canvas=document.querySelector("#brainCanvas");
if(canvas){
  const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const mobile=matchMedia("(max-width: 700px)").matches;
  try{
    const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:!mobile,powerPreference:"high-performance"});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.15:1.5));
    renderer.setClearColor(0x000000,0);
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(38,1,.1,100);
    camera.position.set(0,0,7);
    const root=new THREE.Group();scene.add(root);
    const ambient=new THREE.AmbientLight(0x8aa8ff,1.2);scene.add(ambient);
    const key=new THREE.PointLight(0x72dcff,18,14);key.position.set(2.5,2.5,4);scene.add(key);
    const violet=new THREE.PointLight(0x8d68ff,14,12);violet.position.set(-3,-2,2);scene.add(violet);
    const particles=new THREE.BufferGeometry(), count=mobile?650:1200, pos=new Float32Array(count*3);
    for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,b=Math.acos(2*Math.random()-1),r=2.3+Math.pow(Math.random(),.55)*3.2;pos[i*3]=Math.sin(b)*Math.cos(a)*r;pos[i*3+1]=Math.cos(b)*r*.7;pos[i*3+2]=Math.sin(b)*Math.sin(a)*r}
    particles.setAttribute("position",new THREE.BufferAttribute(pos,3));
    const pmat=new THREE.PointsMaterial({color:0x8feaff,size:mobile?.035:.025,transparent:true,opacity:.48,blending:THREE.AdditiveBlending,depthWrite:false});
    const points=new THREE.Points(particles,pmat);root.add(points);
    const fallback=new THREE.Mesh(new THREE.IcosahedronGeometry(1.8,3),new THREE.MeshBasicMaterial({color:0x6faeff,wireframe:true,transparent:true,opacity:.1,blending:THREE.AdditiveBlending}));
    root.add(fallback);
    const loader=new GLTFLoader();
    loader.load("/assets/AgentiCuantico_brain_PBR.glb",g=>{
      fallback.visible=false;
      const model=g.scene;model.scale.setScalar(2.25);model.position.y=-.05;model.traverse(o=>{if(o.isMesh){o.material.transparent=true;o.material.opacity=.98}});
      root.add(model);window.__aqBrain=model;
    },undefined,()=>{});
    let tx=0,ty=0,mx=0,my=0;
    addEventListener("pointermove",e=>{tx=(e.clientX/innerWidth-.5)*.35;ty=(e.clientY/innerHeight-.5)*.2},{passive:true});
    addEventListener("touchmove",e=>{const t=e.touches[0];if(t){tx=(t.clientX/innerWidth-.5)*.25;ty=(t.clientY/innerHeight-.5)*.15}},{passive:true});
    const resize=()=>{const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()};
    new ResizeObserver(resize).observe(canvas);resize();
    const clock=new THREE.Clock();
    function frame(){const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;mx+=(tx-mx)*.035;my+=(ty-my)*.035;root.rotation.y+=(reduced?.0025:.006)+mx*.002;root.rotation.x=my+Math.sin(t*.3)*.025;points.rotation.y-=dt*(reduced?.002:.008);pmat.opacity=.38+Math.sin(t*.8)*.08;key.intensity=14+Math.sin(t*1.4)*3;renderer.render(scene,camera);requestAnimationFrame(frame)}
    frame();
    const w=document.querySelector("#webgl");if(w)w.textContent="ACTIVE";
  }catch(e){const w=document.querySelector("#webgl");if(w)w.textContent="FALLBACK"}
}