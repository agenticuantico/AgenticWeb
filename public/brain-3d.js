import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

function sampleHemisphere(side, count){
  const out=[];
  for(let i=0;i<count;i++){
    const u=Math.random(), v=Math.random();
    const theta=Math.acos(2*u-1);
    const phi=Math.PI*2*v;
    const y=Math.cos(theta);
    const radial=Math.sqrt(Math.max(0,1-y*y));
    const x=Math.cos(phi)*radial;
    const z=Math.sin(phi)*radial;
    const groove=Math.sin(phi*5.0+y*7.0)*0.055 + Math.sin(phi*9.0-y*4.0)*0.025;
    const lobe=1+groove;
    const px=side*(0.54 + x*1.16*lobe);
    const py=y*1.35 + Math.sin(phi*3)*0.05;
    const pz=z*0.9 + Math.cos(phi*4)*0.035;
    out.push(new THREE.Vector3(px,py,pz));
  }
  return out;
}

function makePoints(points,color,size,opacity){
  const positions=new Float32Array(points.length*3);
  points.forEach((p,i)=>{positions[i*3]=p.x;positions[i*3+1]=p.y;positions[i*3+2]=p.z});
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.BufferAttribute(positions,3));
  const m=new THREE.PointsMaterial({color,size,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false});
  return new THREE.Points(g,m);
}

function buildConnections(points,maxDistance=0.5,maxEdges=210){
  const pairs=[];
  for(let i=0;i<points.length;i++){
    const candidates=[];
    for(let j=i+1;j<points.length;j++){
      const d=points[i].distanceToSquared(points[j]);
      if(d<maxDistance*maxDistance)candidates.push([d,j]);
    }
    candidates.sort((a,b)=>a[0]-b[0]);
    for(const [,j] of candidates.slice(0,2)){
      if(Math.random()<0.42)pairs.push([i,j]);
      if(pairs.length>=maxEdges)break;
    }
    if(pairs.length>=maxEdges)break;
  }
  return pairs;
}

export function initQuantumBrain3D(canvas){
  if(!canvas) return null;
  try{
    const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:"high-performance"});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.55));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.15;

    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(31,1,.1,100);
    camera.position.set(0,.05,6.4);

    const root=new THREE.Group();
    root.rotation.z=-.04;
    scene.add(root);

    const cyan=sampleHemisphere(-1,480);
    const violet=sampleHemisphere(1,480);
    const all=[...cyan,...violet];

    const left=makePoints(cyan,0x42eaff,.045,.88);
    const right=makePoints(violet,0x8c68ff,.045,.86);
    root.add(left,right);

    const pairs=buildConnections(all,.5,360);
    const linePositions=new Float32Array(pairs.length*6);
    pairs.forEach(([a,b],i)=>{
      const p=all[a],q=all[b];
      linePositions.set([p.x,p.y,p.z,q.x,q.y,q.z],i*6);
    });
    const lineGeo=new THREE.BufferGeometry();
    lineGeo.setAttribute("position",new THREE.BufferAttribute(linePositions,3));
    const lines=new THREE.LineSegments(lineGeo,new THREE.LineBasicMaterial({
      color:0x62dfff,transparent:true,opacity:.22,blending:THREE.AdditiveBlending,depthWrite:false
    }));
    root.add(lines);


    const shell=new THREE.Mesh(
      new THREE.SphereGeometry(1.92,48,32),
      new THREE.MeshBasicMaterial({color:0x58eaff,transparent:true,opacity:.018,wireframe:true,blending:THREE.AdditiveBlending,depthWrite:false})
    );
    shell.scale.set(1,.82,.58); root.add(shell);

    const dustCount=360,dustPositions=new Float32Array(dustCount*3);
    for(let i=0;i<dustCount;i++){
      const r=2.2+Math.random()*2.4,a=Math.random()*Math.PI*2,b=Math.acos(2*Math.random()-1);
      dustPositions[i*3]=Math.sin(b)*Math.cos(a)*r;
      dustPositions[i*3+1]=Math.cos(b)*r*.6;
      dustPositions[i*3+2]=Math.sin(b)*Math.sin(a)*r;
    }
    const dustGeo=new THREE.BufferGeometry();
    dustGeo.setAttribute("position",new THREE.BufferAttribute(dustPositions,3));
    const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:0x72eaff,size:.018,transparent:true,opacity:.3,blending:THREE.AdditiveBlending,depthWrite:false}));
    scene.add(dust);

    const core=new THREE.Mesh(
      new THREE.SphereGeometry(.23,24,18),
      new THREE.MeshBasicMaterial({color:0x8df4ff,transparent:true,opacity:.78,blending:THREE.AdditiveBlending})
    );
    core.position.set(0,-.1,.35);
    root.add(core);

    const coreRing=new THREE.Mesh(
      new THREE.TorusGeometry(.38,.012,8,64),
      new THREE.MeshBasicMaterial({color:0x7b63ff,transparent:true,opacity:.65,blending:THREE.AdditiveBlending})
    );
    coreRing.rotation.x=Math.PI/2;
    coreRing.position.copy(core.position);
    root.add(coreRing);

    const chip=new THREE.Group();
    const chipBody=new THREE.Mesh(
      new THREE.BoxGeometry(.58,.18,.52),
      new THREE.MeshStandardMaterial({color:0x091426,metalness:.9,roughness:.2,emissive:0x071d35,emissiveIntensity:.7})
    );
    chip.add(chipBody);
    const edge=new THREE.LineSegments(
      new THREE.EdgesGeometry(chipBody.geometry),
      new THREE.LineBasicMaterial({color:0x5beaff,transparent:true,opacity:.9,blending:THREE.AdditiveBlending})
    );
    chip.add(edge);
    for(let i=0;i<8;i++){
      const pin=new THREE.Mesh(
        new THREE.BoxGeometry(.025,.12,.025),
        new THREE.MeshBasicMaterial({color:i%2?0x8c68ff:0x42eaff,blending:THREE.AdditiveBlending})
      );
      pin.position.set(-.22+(i%4)*.145, .02, i<4?-.3:.3);
      chip.add(pin);
    }
    chip.position.set(0,-1.28,.22);
    chip.rotation.x=-.12;
    root.add(chip);

    const ringGroup=new THREE.Group();
    for(let i=0;i<3;i++){
      const ring=new THREE.Mesh(
        new THREE.TorusGeometry(1.78+i*.13,.008,8,96),
        new THREE.MeshBasicMaterial({color:i===1?0x9a6cff:0x43eaff,transparent:true,opacity:.24-i*.035,blending:THREE.AdditiveBlending})
      );
      ring.rotation.set(i*.48,.22+i*.28,i*.31);
      ringGroup.add(ring);
    }
    root.add(ringGroup);

    const pulseCount=72;
    const pulsePositions=new Float32Array(pulseCount*3);
    const pulsePhase=new Float32Array(pulseCount);
    for(let i=0;i<pulseCount;i++){pulsePhase[i]=Math.random();pulsePositions[i*3]=0;pulsePositions[i*3+1]=0;pulsePositions[i*3+2]=0}
    const pulseGeo=new THREE.BufferGeometry();
    pulseGeo.setAttribute("position",new THREE.BufferAttribute(pulsePositions,3));
    const pulseMat=new THREE.PointsMaterial({color:0xffffff,size:.075,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false});
    const pulses=new THREE.Points(pulseGeo,pulseMat);
    root.add(pulses);

    const ambient=new THREE.PointLight(0x4ceaff,8,8);
    ambient.position.set(-2,1,3);scene.add(ambient);
    const purple=new THREE.PointLight(0x805cff,10,8);
    purple.position.set(2,-.6,2);scene.add(purple);
    scene.add(new THREE.AmbientLight(0x7ca7ff,.5));


async function loadGLBBrain(root,THREE,controller){
  try{
    const {GLTFLoader}=await import("https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js");
    const loader=new GLTFLoader();
    const url="https://raw.githubusercontent.com/itayinbarr/brainproject/main/brain-atlas/models/brain.glb";
    loader.load(url,g=>{
      const model=g.scene; model.name="AgentiCuanticoGLBBrain";
      const box=new THREE.Box3().setFromObject(model), size=box.getSize(new THREE.Vector3()), center=box.getCenter(new THREE.Vector3());
      model.position.sub(center); const scale=3.25/Math.max(size.x,size.y,size.z); model.scale.setScalar(scale);
      model.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.transparent=true;o.material.opacity=.34;o.material.metalness=.55;o.material.roughness=.25;o.material.emissive=new THREE.Color(0x071d35);o.material.emissiveIntensity=.45}});
      root.add(model); controller.glbBrain=model; controller.glbLoaded=true;
    },undefined,()=>{});
  }catch(e){}
}
\n    const controller={
      renderer,scene,camera,root,speaking:false,thinking:false,listening:false,mouthLevel:0,mouseX:0,mouseY:0,
      setSpeaking(v){this.speaking=!!v},
      setListening(v){this.listening=!!v},
      setMouth(v){this.mouthLevel=Math.max(0,Math.min(1,v))},
      setThinking(v){this.thinking=!!v}
    };

    loadGLBBrain(root,THREE,controller);\n\n    canvas.addEventListener("pointermove",e=>{
      const r=canvas.getBoundingClientRect();
      controller.mouseX=((e.clientX-r.left)/Math.max(r.width,1)-.5)*2;
      controller.mouseY=((e.clientY-r.top)/Math.max(r.height,1)-.5)*2;
    },{passive:true});

    const resize=()=>{
      const w=Math.max(1,canvas.clientWidth||500),h=Math.max(1,canvas.clientHeight||420);
      renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
    };
    if(window.ResizeObserver)new ResizeObserver(resize).observe(canvas);
    window.addEventListener("resize",resize,{passive:true});
    resize();

    const clock=new THREE.Clock();
    const animate=()=>{
      const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;
      const speed=controller.thinking?2.05:controller.speaking?1.45:controller.listening?1.7:1;
      root.rotation.y+=((controller.mouseX*.22+Math.sin(t*.25)*.08)-root.rotation.y)*.035;
      root.rotation.x+=((controller.mouseY*.10+Math.sin(t*.31)*.025)-root.rotation.x)*.035;
      root.position.y=Math.sin(t*.62)*.035;
      shell.rotation.y-=dt*.08;
      dust.rotation.y+=dt*.018;
      left.rotation.y=Math.sin(t*.22)*.018;
      right.rotation.y=-Math.sin(t*.22)*.018;
      ringGroup.rotation.y+=dt*.16*speed;
      ringGroup.rotation.x=Math.sin(t*.18)*.18;
      core.scale.setScalar(1+Math.sin(t*2.4)*.08+(controller.thinking?.20:0)+(controller.speaking?.08:0)+(controller.listening?.12:0));
      shell.material.opacity=.012+(controller.thinking?.035:.006);
      coreRing.rotation.z+=dt*.9*speed;
      chip.rotation.z=Math.sin(t*.7)*.05;
      lines.material.opacity=.16+(controller.thinking?.2:.06)+Math.sin(t*2.1)*.035;
      pulseMat.opacity=controller.thinking?.98:controller.speaking?.9:controller.listening?.86:.68;

      const pa=pulses.geometry.attributes.position.array;
      for(let i=0;i<pulseCount;i++){
        const phase=(pulsePhase[i]+t*(controller.thinking?.32:.16))%1;
        const idx=Math.floor(phase*pairs.length);
        const pair=pairs[idx%Math.max(1,pairs.length)];
        const a=all[pair?.[0]||0],b=all[pair?.[1]||1];
        const f=(phase*pairs.length)%1;
        pa[i*3]=THREE.MathUtils.lerp(a.x,b.x,f);
        pa[i*3+1]=THREE.MathUtils.lerp(a.y,b.y,f);
        pa[i*3+2]=THREE.MathUtils.lerp(a.z,b.z,f);
      }
      pulses.geometry.attributes.position.needsUpdate=true;
      renderer.render(scene,camera);
      requestAnimationFrame(animate);
    };
    animate();

    const setStatus=()=>{
      const s=document.getElementById("avatarRigStatus");
      if(s)s.textContent=controller.thinking?"NEURAL CORE · RAZONANDO":controller.listening?"NEURAL CORE · ESCUCHANDO":"NEURAL CORE · ACTIVO";
      const state=document.getElementById("avatarState");
      if(state)state.textContent=controller.thinking?"Razonamiento agéntico · activo":controller.listening?"Escuchando al usuario · activo":"Cerebro neuronal · listo";
    };
    controller.setThinkingState=setStatus;
    setStatus();
    return controller;
  }catch(error){
    console.error("[AgentiCuantico] Quantum brain init failed:",error);
    const status=document.getElementById("avatarRigStatus");
    if(status)status.textContent="3D · fallback seguro";
    return null;
  }
}
