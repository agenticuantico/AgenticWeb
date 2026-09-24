import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
export function initNeuralWorld(canvas){
  if(!canvas)return null;
  try{
    const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:"high-performance"});
    const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent), reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const count=mobile?900:1800; renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.2:1.45));
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(52,1,.1,100);camera.position.z=8;
    const group=new THREE.Group();scene.add(group);
    const positions=new Float32Array(count*3);
    for(let i=0;i<count;i++){const r=2.2+Math.pow(Math.random(),.55)*7.5,a=Math.random()*Math.PI*2,b=Math.acos(2*Math.random()-1);positions[i*3]=Math.sin(b)*Math.cos(a)*r;positions[i*3+1]=Math.cos(b)*r*.62;positions[i*3+2]=Math.sin(b)*Math.sin(a)*r}
    const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.BufferAttribute(positions,3));
    const mat=new THREE.PointsMaterial({color:0x76dcff,size:.028,transparent:true,opacity:.72,blending:THREE.AdditiveBlending,depthWrite:false});
    group.add(new THREE.Points(geo,mat));
    const rings=new THREE.Group();
    for(let i=0;i<5;i++){const r=2.5+i*.65,m=new THREE.Mesh(new THREE.TorusGeometry(r,.006,6,160),new THREE.MeshBasicMaterial({color:i%2?0x9a6cff:0x43d9ff,transparent:true,opacity:.10,blending:THREE.AdditiveBlending,depthWrite:false}));m.rotation.set(i*.34,.2+i*.17,i*.21);rings.add(m)}
    group.add(rings);
    group.add(new THREE.Mesh(new THREE.SphereGeometry(5.8,32,20),new THREE.MeshBasicMaterial({color:0x14275e,transparent:true,opacity:.045,wireframe:true,blending:THREE.AdditiveBlending,depthWrite:false})));
    const resize=()=>{const w=Math.max(1,canvas.clientWidth||innerWidth),h=Math.max(1,canvas.clientHeight||innerHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()};new ResizeObserver(resize).observe(canvas);addEventListener("resize",resize,{passive:true});resize();
    const clock=new THREE.Clock();const animate=()=>{const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;group.rotation.y+=dt*(reduced?.004:.009);group.rotation.x=Math.sin(t*.07)*.035;rings.rotation.y+=dt*(reduced?.006:.018);mat.opacity=.46+Math.sin(t*.45)*.08;renderer.render(scene,camera);requestAnimationFrame(animate)};animate();
    return{renderer,scene,camera}
  }catch(error){console.warn("[AgentiCuantico] Neural world unavailable",error);return null}
}