(() => {
  const root=document.documentElement;
  document.body.classList.add('immersive-neural-ui');
  const state=document.getElementById('avatarState');
  const input=document.getElementById('input');
  const send=document.getElementById('send');
  const messages=document.getElementById('messages');
  const setState=(label)=>{ if(state) state.textContent=label; };
  window.addEventListener('aq:neural-state',e=>{ if(e.detail?.label) setState(e.detail.label); });
  const observer=new MutationObserver(()=>{
    const busy=[...messages?.querySelectorAll('.msg')||[]].some(m=>/pensando|procesando|generando/i.test(m.textContent||''));
    if(busy) setState('Cerebro neuronal · procesando');
  });
  if(messages) observer.observe(messages,{childList:true,subtree:true});
  if(input){
    input.addEventListener('focus',()=>setState('Cerebro neuronal · escuchando'));
    input.addEventListener('blur',()=>{if(!input.value.trim())setState('Cerebro neuronal · listo')});
  }
  if(send) send.addEventListener('click',()=>setState('Cerebro neuronal · pensando'));
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-quick],[data-view]');
    if(b) window.setTimeout(()=>setState('Cerebro neuronal · listo'),500);
  });
  // Pointer depth: subtle and performance-safe, no layout movement.
  let raf=0;
  window.addEventListener('pointermove',e=>{
    if(raf)return; raf=requestAnimationFrame(()=>{
      raf=0;
      const x=(e.clientX/innerWidth-.5), y=(e.clientY/innerHeight-.5);
      root.style.setProperty('--pointer-x',x.toFixed(3));
      root.style.setProperty('--pointer-y',y.toFixed(3));
    });
  },{passive:true});
})();