// Escena 3D de la plantilla demo (código propio de AgentiCuántico; three.js MIT servido desde el sitio).
import * as THREE from '../_comun/three.js';
const cv=document.getElementById('ink'),hero=cv.parentElement,RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
let r;try{r=new THREE.WebGLRenderer({canvas:cv,alpha:true,antialias:false})}catch(e){}
if(r){
  r.setPixelRatio(Math.min(devicePixelRatio,1.75));
  const scene=new THREE.Scene(),cam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const U={uT:{value:0},uRes:{value:new THREE.Vector2(1,1)},uM:{value:new THREE.Vector2(.75,.4)},uMob:{value:0}};
  const m=new THREE.ShaderMaterial({uniforms:U,transparent:true,premultipliedAlpha:true,vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:`precision highp float;varying vec2 v;uniform float uT,uMob;uniform vec2 uRes,uM;
   float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
   float ball(vec2 p,vec2 c,float r){vec2 d=p-c;return r*r/dot(d,d);}
   void main(){
     float a=uRes.x/uRes.y;vec2 p=v;p.x*=a;
     // ondulación de borde (tinta absorbida por el papel)
     p+=vec2(n(p*6.+uT*.2),n(p*6.-uT*.2))*.018;
     vec2 base=uMob>.5?vec2(a*.78,.72):vec2(a*.74,.52);
     float s=uMob>.5?.75:1.;
     float f=0.;
     f+=ball(p,base+vec2(sin(uT*.31)*.08,cos(uT*.27)*.06),.17*s);
     f+=ball(p,base+vec2(cos(uT*.23)*.18-.1,sin(uT*.35)*.12+.05),.11*s);
     f+=ball(p,base+vec2(sin(uT*.41+2.)*.16+.08,cos(uT*.19)*.16-.08),.09*s);
     f+=ball(p,vec2(uM.x*a,uM.y),.075*s);
     f+=ball(p,base+vec2(cos(uT*.17+1.)*.26,sin(uT*.29+3.)*.2),.06*s);
     float e=smoothstep(.95,1.05,f);
     float edge=smoothstep(1.,1.6,f);
     vec3 acc=vec3(1.,.255,.133);vec3 deep=vec3(.86,.16,.07);
     vec3 col=mix(acc,deep,edge*.55+n(v*40.)*.08);
     gl_FragColor=vec4(col*e,e);
   }`});
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),m));
  const tm=new THREE.Vector2(.75,.4);
  addEventListener('pointermove',e=>{const b=hero.getBoundingClientRect();tm.set((e.clientX-b.left)/b.width,1-(e.clientY-b.top)/b.height)},{passive:true});
  function size(){const w=hero.clientWidth,h=hero.clientHeight;r.setSize(w,h,false);U.uRes.value.set(w,h);U.uMob.value=w<760?1:0;if(w<760)tm.set(.8,.72)}
  size();addEventListener('resize',size);
  const clk=new THREE.Clock();let vis=true,run=false;
  const frame=()=>{const dt=Math.min(clk.getDelta(),.05);U.uT.value+=dt;U.uM.value.lerp(tm,1-Math.pow(.02,dt));r.render(scene,cam)};
  const set=on=>{if(on&&!run){run=true;clk.getDelta();r.setAnimationLoop(frame)}else if(!on&&run){run=false;r.setAnimationLoop(null)}};
  new IntersectionObserver(([e])=>{vis=e.isIntersecting;set(vis&&!document.hidden&&!RM)}).observe(hero);
  document.addEventListener('visibilitychange',()=>set(vis&&!document.hidden&&!RM));
  if(RM){U.uT.value=3;frame()}else set(true);
  document.documentElement.classList.add('gl-on');
}
