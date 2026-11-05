// Interacciones de la plantilla demo (código propio de AgentiCuántico).
(()=>{
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const root=document.documentElement,body=document.body;

// Split de letras para el titular (cada palabra queda junta para no cortar mal en móvil)
let ci=0;document.querySelectorAll('[data-split]').forEach(el=>{const nodes=[...el.childNodes];el.textContent='';
  nodes.forEach(n=>{if(n.nodeType===3){n.textContent.split(/(\s+)/).forEach(w=>{if(!w)return;if(/^\s+$/.test(w)){el.append(' ');return}
    const ws=document.createElement('span');ws.style.display='inline-block';ws.style.whiteSpace='nowrap';
    [...w].forEach(c=>{const s=document.createElement('span');s.className='ch';s.style.setProperty('--i',ci++);s.textContent=c;ws.append(s)});el.append(ws)})}
  else{n.classList.add('ch');n.style.setProperty('--i',ci++);el.append(n)}})});

// Telón con contador
const cur=document.getElementById('curtain'),cnt=document.getElementById('cnt');
function reveal(){cur.classList.add('out');body.classList.add('ready');setTimeout(()=>{cur.classList.remove('out');cur.classList.add('trans','wipe-out')},1100)}
if(RM){body.classList.add('ready')}else{const t0=performance.now(),D=1100;const f=t=>{const k=Math.min(1,(t-t0)/D);cnt.textContent=String(Math.round((1-Math.pow(1-k,2))*100)).padStart(2,'0');k<1?requestAnimationFrame(f):setTimeout(reveal,150)};requestAnimationFrame(f)}

// Transición de página al navegar por anclas: telón que entra, salto, telón que sale
document.querySelectorAll('a[data-link]').forEach(a=>a.addEventListener('click',e=>{const id=a.getAttribute('href');const t=document.querySelector(id);if(!t)return;e.preventDefault();
  if(RM){t.scrollIntoView();return}
  cur.className='curtain trans wipe-in';void cur.offsetWidth;cur.classList.add('go');
  setTimeout(()=>{scrollTo({top:t.getBoundingClientRect().top+scrollY,behavior:'instant'});cur.className='curtain trans wipe-out';history.replaceState(null,'',id)},650)}));

// Reloj local en el nav
const clk=document.getElementById('clock');const tick=()=>{const d=new Date();clk.textContent='BAHÍA BLANCA '+d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'America/Argentina/Buenos_Aires'})};tick();setInterval(tick,30000);

// Marquesina duplicada
const band=document.getElementById('band');band.innerHTML+=band.innerHTML;

// Revelados
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.2});
document.querySelectorAll('.rv').forEach(el=>io.observe(el));

// Manifiesto: palabras que se "entintan" con el scroll
const mani=document.getElementById('mani');const words=[];
[...mani.childNodes].forEach(n=>{if(n.nodeType===3){const frag=document.createDocumentFragment();n.textContent.split(/(\s+)/).forEach(w=>{if(!w.trim()){frag.append(w);return}const s=document.createElement('span');s.className='w';s.textContent=w;words.push(s);frag.append(s)});n.replaceWith(frag)}else{n.classList.add('w');words.push(n)}});

// Bucle de scroll (rAF): máscaras de proyectos, manifiesto, tema, proceso horizontal
const figs=[...document.querySelectorAll('.proj figure')],dark=document.querySelector('[data-theme=dark]');
const proc=document.getElementById('proceso'),track=document.getElementById('htrack'),pbar=document.getElementById('pbar');
let ticking=false;
function onScroll(){ticking=false;const vh=innerHeight;
  if(!RM){figs.forEach(f=>{const r=f.getBoundingClientRect();const p=Math.min(1,Math.max(0,(vh-r.top)/(vh*.85)));const e=1-Math.pow(1-p,3);
    f.style.setProperty('--c',(1-e)*30+'%');f.style.setProperty('--cx',(1-e)*8+'%');f.querySelector('.art').style.setProperty('--r',e)})}
  const mr=mani.getBoundingClientRect();const mp=Math.min(1,Math.max(0,(vh*.85-mr.top)/(mr.height+vh*.2)));const on=Math.floor(mp*words.length*1.1);
  words.forEach((w,i)=>w.classList.toggle('on',RM||i<on));
  const dr=dark.getBoundingClientRect();body.classList.toggle('dark',dr.top<vh*.4&&dr.bottom>vh*.6);
  const pr=proc.getBoundingClientRect(),tot=pr.height-vh,pp=Math.min(1,Math.max(0,-pr.top/tot));
  const max=track.scrollWidth-innerWidth+parseFloat(getComputedStyle(track).paddingLeft);track.style.transform=`translate3d(${-pp*Math.max(0,max)}px,0,0)`;pbar.style.setProperty('--p',pp)}
addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(onScroll)}},{passive:true});addEventListener('resize',onScroll);onScroll();

// Copiar mail
const mail=document.getElementById('mail');mail.addEventListener('click',async()=>{try{await navigator.clipboard.writeText('hola@trama.estudio')}catch(e){}
  mail.classList.add('ok');mail.querySelector('small').textContent='¡Copiado!';setTimeout(()=>{mail.classList.remove('ok');mail.querySelector('small').textContent='Copiar'},1800)});

// Cursor personalizado: solo con puntero fino y sin reducción de movimiento
if(matchMedia('(pointer:fine)').matches&&!RM){
  root.classList.add('has-cur');const c=document.getElementById('cur'),d=document.getElementById('curDot'),lbl=document.getElementById('curLbl');
  let x=innerWidth/2,y=innerHeight/2,cx=x,cy=y;
  addEventListener('pointermove',e=>{x=e.clientX;y=e.clientY;d.style.transform=`translate(${x}px,${y}px)`;if(!c.classList.contains('live')){cx=x;cy=y;c.classList.add('live');d.classList.add('live')}},{passive:true});
  (function loop(){cx+=(x-cx)*.18;cy+=(y-cy)*.18;c.style.transform=`translate(${cx}px,${cy}px)`;requestAnimationFrame(loop)})();
  document.addEventListener('pointerover',e=>{const t=e.target.closest('[data-cursor],a,button,.srow');c.classList.remove('big','link');if(!t)return;
    if(t.dataset.cursor){lbl.textContent=t.dataset.cursor;c.classList.add('big')}else c.classList.add('link')});
  document.documentElement.addEventListener('pointerleave',()=>{c.classList.remove('live');d.classList.remove('live')});
}
})();
