// Interacciones de la plantilla demo (código propio de AgentiCuántico).
document.querySelectorAll('form[data-demo-form]').forEach(f=>f.addEventListener('submit',e=>{e.preventDefault();f.querySelector('button').textContent='Gracias'}));
(()=>{
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const nav=document.getElementById('nav');const n=()=>nav.classList.toggle('solid',scrollY>40);n();addEventListener('scroll',n,{passive:true});
// Revelados por capítulo
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.18});
document.querySelectorAll('.ch,.rv').forEach(el=>io.observe(el));
// Lupas: zoom ligado al scroll de su capítulo
const lenses=[...document.querySelectorAll('[data-lens]')];let tk=false;
function lz(){tk=false;lenses.forEach(l=>{const r=l.closest('.ch').getBoundingClientRect();const p=Math.min(1,Math.max(0,(innerHeight-r.top)/(r.height+innerHeight)));l.style.setProperty('--z',RM?.5:p)})}
addEventListener('scroll',()=>{if(!tk){tk=true;requestAnimationFrame(lz)}},{passive:true});lz();
// Compra
const price=document.getElementById('price'),fmt=v=>'$ '+v.toLocaleString('es-AR');
document.querySelectorAll('input[name=ml]').forEach(r=>r.addEventListener('change',()=>{price.textContent=fmt(+r.dataset.price);dispatchEvent(new CustomEvent('velarde:size',{detail:+r.value}))}));
const eng=document.getElementById('eng'),engN=document.getElementById('engN');
eng.addEventListener('input',()=>{engN.textContent=eng.value.length+'/14';dispatchEvent(new CustomEvent('velarde:eng',{detail:eng.value}))});
const buy=document.getElementById('buy'),bag=document.getElementById('bag'),bagN=document.getElementById('bagN');let count=0;
buy.addEventListener('click',()=>{count++;bagN.textContent=count;bag.classList.add('has');buy.classList.add('ok');buy.textContent='Agregado · Ver bolsa';setTimeout(()=>{buy.classList.remove('ok');buy.textContent='Agregar otro'},2400)});
})();
