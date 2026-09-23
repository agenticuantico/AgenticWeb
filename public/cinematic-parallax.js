(() => {
  const enable=()=>{
    document.body.classList.add("aq-immersive");
    const layer=document.getElementById("aiDesignLayer");
    if(!layer||matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    let raf=0;
    const move=e=>{
      const x=(e.clientX/Math.max(innerWidth,1)-.5)*18;
      const y=(e.clientY/Math.max(innerHeight,1)-.5)*12;
      cancelAnimationFrame(raf);
      raf=requestAnimationFrame(()=>{layer.style.setProperty("--parallax-x",x.toFixed(1)+"px");layer.style.setProperty("--parallax-y",y.toFixed(1)+"px")});
    };
    addEventListener("pointermove",move,{passive:true});
    addEventListener("blur",()=>{layer.style.setProperty("--parallax-x","0px");layer.style.setProperty("--parallax-y","0px")},{passive:true});
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",enable,{once:true});else enable();
})();