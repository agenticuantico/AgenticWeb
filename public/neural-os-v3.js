/* AgentiCuantico Neural OS v3 — functional visual shell around the existing app */
(() => {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.body;
  if (!root) return;
  root.classList.add('aq-neural-os');

  const make = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text) el.textContent = text;
    return el;
  };

  const header = make('header', 'aq-os-header');
  header.innerHTML = '<div class="aq-brand"><span class="aq-brand-mark" aria-hidden="true"></span><span class="aq-brand-copy"><b>AGENTICUANTICO</b><span>NEURAL OPERATING SPACE · v3</span></span></div><div class="aq-header-status"><span class="aq-status-dot"></span><span id="aqHeaderState">NEURAL CORE · READY</span></div>';
  root.appendChild(header);

  const readout = make('div', 'aq-system-readout');
  readout.innerHTML = '<span class="aq-readout">CORE <b id="aqCoreState">READY</b></span><span class="aq-readout">MODE <b id="aqModeState">CONVERSE</b></span><span class="aq-readout">3D <b>WEBGL</b></span>';
  root.appendChild(readout);

  const rail = make('nav', 'aq-command-rail');
  rail.setAttribute('aria-label', 'Controles rápidos del espacio neural');
  const commands = [
    ['chat','◌','Conversación'],
    ['agents','◇','Agentes'],
    ['coder','⌘','CodQ'],
    ['teams','◎','Equipos'],
    ['skills','✦','Skills']
  ];
  commands.forEach(([key, icon, label]) => {
    const button = make('button');
    button.type = 'button';
    button.dataset.quick = key;
    button.setAttribute('aria-label', label);
    button.innerHTML = '<span aria-hidden="true">'+icon+'</span><span class="aq-rail-label">'+label+'</span>';
    rail.appendChild(button);
  });
  root.appendChild(rail);

  const field = document.createElement('canvas');
  field.className = 'aq-neural-field';
  field.setAttribute('aria-hidden','true');
  root.insertBefore(field, root.firstChild);

  const ctx = field.getContext('2d', { alpha:true });
  const points = [];
  let raf = 0;
  let running = true;
  let dpr = Math.min(window.devicePixelRatio || 1, 1.7);
  let w = 0, h = 0, t = 0;

  const resize = () => {
    w = window.innerWidth; h = window.innerHeight;
    field.width = Math.floor(w*dpr);
    field.height = Math.floor(h*dpr);
    field.style.width = w+'px'; field.style.height = h+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    points.length = 0;
    const count = Math.min(105, Math.max(42, Math.floor((w*h)/17000)));
    for(let i=0;i<count;i++){
      const angle = Math.random()*Math.PI*2;
      const radius = Math.pow(Math.random(), .7)*Math.min(w,h)*.46;
      points.push({
        a:angle, r:radius, z:Math.random(),
        speed:(Math.random()-.5)*.0007,
        pulse:Math.random()*Math.PI*2
      });
    }
  };

  const render = () => {
    if (!running) return;
    t += reduced.matches ? .001 : .008;
    ctx.clearRect(0,0,w,h);
    const cx=w*.5, cy=h*(w<560?.34:.45);
    const maxR=Math.min(w,h)*.46;
    const projected=[];
    for(const p of points){
      p.a += p.speed * (reduced.matches ? 0 : 1);
      const rr=p.r*(.96+.04*Math.sin(t*1.4+p.pulse));
      const x=cx+Math.cos(p.a)*rr;
      const y=cy+Math.sin(p.a)*rr*.63;
      projected.push({x,y,p});
    }
    ctx.lineWidth=.55;
    for(let i=0;i<projected.length;i++){
      const a=projected[i];
      for(let j=i+1;j<projected.length;j++){
        const b=projected[j];
        const dx=a.x-b.x,dy=a.y-b.y,dist=Math.hypot(dx,dy);
        if(dist<Math.min(105,maxR*.24)){
          ctx.strokeStyle='rgba(86,190,226,'+(0.07*(1-dist/105))+')';
          ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
        }
      }
    }
    for(const q of projected){
      const pulse=.7+.3*Math.sin(t*1.8+q.p.pulse);
      ctx.fillStyle='rgba(110,218,255,'+(0.14*pulse)+')';
      ctx.beginPath();ctx.arc(q.x,q.y,1.05+pulse*.6,0,Math.PI*2);ctx.fill();
    }
    raf=requestAnimationFrame(render);
  };

  const start = () => {
    if (running && !raf) raf=requestAnimationFrame(render);
  };
  const stop = () => {
    running=false;
    if(raf) cancelAnimationFrame(raf);
    raf=0;
  };
  document.addEventListener('visibilitychange',()=>{ running=!document.hidden; if(running) start(); else stop(); });
  window.addEventListener('resize', resize, {passive:true});
  resize();
  if(!reduced.matches) start(); else render();

  const stateLabel=document.getElementById('aqHeaderState');
  const coreLabel=document.getElementById('aqCoreState');
  const modeLabel=document.getElementById('aqModeState');
  const messages=document.getElementById('messages');
  const input=document.getElementById('input');

  function setState(state){
    root.classList.remove('aq-thinking','aq-speaking','aq-error');
    const map={
      idle:['NEURAL CORE · READY','READY'],
      thinking:['NEURAL CORE · PROCESSING','THINKING'],
      speaking:['NEURAL CORE · SPEAKING','SPEAKING'],
      error:['NEURAL CORE · ATTENTION','ERROR']
    };
    const pair=map[state]||map.idle;
    if(stateLabel) stateLabel.textContent=pair[0];
    if(coreLabel) coreLabel.textContent=pair[1];
    if(state==='thinking') root.classList.add('aq-thinking');
    if(state==='speaking') root.classList.add('aq-speaking');
    if(state==='error') root.classList.add('aq-error');
  }

  if(input){
    input.addEventListener('focus',()=>{ if(root.dataset.aqBusy!=='1') setState('idle'); });
  }
  if(messages){
    const observer=new MutationObserver(()=>{
      const text=messages.textContent||'';
      const busy=/pensando|procesando|generando|thinking/i.test(text);
      root.dataset.aqBusy=busy?'1':'0';
      if(busy) setState('thinking');
      else if(root.dataset.aqVoice==='1') setState('speaking');
      else setState('idle');
    });
    observer.observe(messages,{childList:true,subtree:true,characterData:true});
  }

  document.addEventListener('click',(event)=>{
    const quick=event.target.closest('[data-quick]');
    if(quick){
      modeLabel.textContent=(quick.dataset.quick||'converse').toUpperCase();
      setState('idle');
    }
    if(event.target.closest('#voiceInput')){
      root.dataset.aqVoice='1'; setState('speaking');
    }
    if(event.target.closest('#stopVoice')){
      root.dataset.aqVoice='0'; setState('idle');
    }
  }, true);

  // Expose a tiny integration API for existing avatar/voice modules.
  window.AgentiCuanticoNeuralOS = {
    setState,
    setMode(mode){ if(modeLabel) modeLabel.textContent=String(mode||'CONVERSE').toUpperCase(); },
    pause(){ stop(); },
    resume(){ if(!reduced.matches){ running=true; start(); } }
  };
})();
