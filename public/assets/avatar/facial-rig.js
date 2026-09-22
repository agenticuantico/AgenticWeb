/* AgentiCuantico — ARKit 52 / Oculus viseme facial rig controller.
   Works with GLB morph targets and humanoid skeletons. */
export const ARKIT52=[
"browDownLeft","browDownRight","browInnerUp","browOuterUpLeft","browOuterUpRight",
"eyeBlinkLeft","eyeBlinkRight","eyeLookDownLeft","eyeLookDownRight","eyeLookInLeft","eyeLookInRight","eyeLookOutLeft","eyeLookOutRight","eyeLookUpLeft","eyeLookUpRight",
"eyeSquintLeft","eyeSquintRight","eyeWideLeft","eyeWideRight",
"cheekPuff","cheekSquintLeft","cheekSquintRight","noseSneerLeft","noseSneerRight",
"jawForward","jawLeft","jawOpen","jawRight",
"mouthClose","mouthDimpleLeft","mouthDimpleRight","mouthFrownLeft","mouthFrownRight","mouthFunnel","mouthLeft","mouthLowerDownLeft","mouthLowerDownRight","mouthPressLeft","mouthPressRight","mouthPucker","mouthRight","mouthRollLower","mouthRollUpper","mouthShrugLower","mouthShrugUpper","mouthSmileLeft","mouthSmileRight","mouthStretchLeft","mouthStretchRight","mouthUpperUpLeft","mouthUpperUpRight",
"tongueOut"
];
const OCULUS={sil:"viseme_sil",PP:"viseme_PP",FF:"viseme_FF",TH:"viseme_TH",DD:"viseme_DD",kk:"viseme_kk",CH:"viseme_CH",SS:"viseme_SS",nn:"viseme_nn",RR:"viseme_RR",aa:"viseme_aa",E:"viseme_E",ih:"viseme_I",oh:"viseme_O",ou:"viseme_U"};
const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
const aliases={
jawopen:["jawopen","jaw_open","mouthopen","mouth_open"],
mouthclose:["mouthclose","mouth_close"],
mouthsmileleft:["mouthsmileleft","mouth_smile_left"],
mouthsmileright:["mouthsmileright","mouth_smile_right"],
mouthfunnel:["mouthfunnel","mouth_funnel"],
mouthpucker:["mouthpucker","mouth_pucker"],
eyeblinkleft:["eyeblinkleft","eye_blink_left","blinkleft"],
eyeblinkright:["eyeblinkright","eye_blink_right","blinkright"]
};
export function createFacialRig(root){
 const targets=[]; const bones={};
 root?.traverse?.(o=>{
   if(o.isBone) bones[norm(o.name)]=o;
   if(o.isMesh&&o.morphTargetDictionary&&o.morphTargetInfluences) targets.push(o);
 });
 const resolve=(wanted)=>{
   const keys=[wanted,...(aliases[norm(wanted)]||[])].map(norm);
   for(const mesh of targets){
     const dict=mesh.morphTargetDictionary||{};
     for(const [name,idx] of Object.entries(dict)){
       if(keys.includes(norm(name))) return {mesh,idx};
     }
   }
   return null;
 };
 const set=(name,value)=>{
   const r=resolve(name); if(r) r.mesh.morphTargetInfluences[r.idx]=Math.max(0,Math.min(1,value));
 };
 const setAny=(names,value)=>names.forEach(n=>set(n,value));
 const eyeBones=Object.entries(bones).filter(([n])=>/eye(l|r|left|right)/.test(n)).map(([,b])=>b);
 const head=bones.head||bones.headend||bones.neck;
 const spine=bones.spine||bones.spine1||bones.spine2;
 const rig={
   root,targets,bones,head,spine,eyeBones,available:targets.length>0,
   setMouth(level=0,kind="A"){
     const v=Math.max(0,Math.min(1,level));
     set("jawOpen",v*.82); set("mouthClose",Math.max(0,.18-v*.2));
     const map={A:["mouthSmileLeft","mouthSmileRight"],E:["mouthStretchLeft","mouthStretchRight"],I:["mouthSmileLeft","mouthSmileRight"],O:["mouthFunnel","mouthPucker"],U:["mouthPucker","mouthFunnel"],M:["mouthPressLeft","mouthPressRight"]};
     for(const n of ["mouthSmileLeft","mouthSmileRight","mouthStretchLeft","mouthStretchRight","mouthFunnel","mouthPucker","mouthPressLeft","mouthPressRight"])set(n,0);
     setAny(map[kind]||map.A,v*.5);
     for(const [k,n] of Object.entries(OCULUS)) if(n) set(n,k===kind?v*.72:0);
   },
   blink(v=0){set("eyeBlinkLeft",v);set("eyeBlinkRight",v)},
   look(x=0,y=0){
     set("eyeLookOutLeft",Math.max(0,x));set("eyeLookInLeft",Math.max(0,-x));
     set("eyeLookInRight",Math.max(0,x));set("eyeLookOutRight",Math.max(0,-x));
     set("eyeLookUpLeft",Math.max(0,-y));set("eyeLookUpRight",Math.max(0,-y));
     set("eyeLookDownLeft",Math.max(0,y));set("eyeLookDownRight",Math.max(0,y));
   },
   updateBody(t,speaking=false,lookX=0,lookY=0){
     if(head){head.rotation.y+=(lookX*.12+Math.sin(t*.5)*.018-head.rotation.y)*.08;head.rotation.x+=(-lookY*.04-head.rotation.x)*.08}
     if(spine)spine.rotation.z+=Math.sin(t*.7)*.002;
     for(const [n,b] of Object.entries(bones)){
       if(/upperarm|shoulder|arm/.test(n)) b.rotation.z+=(Math.sin(t*1.7+(n.includes("left")?-1:1))*(speaking?.035:.012)-b.rotation.z)*.05;
     }
   },
   reset(){targets.forEach(m=>m.morphTargetInfluences.fill(0))}
 };
 return rig;
}
