// Native scrolling works without this enhancement; buttons make each rail discoverable.
const phone=matchMedia('(max-width:700px)');
const calm=matchMedia('(prefers-reduced-motion:reduce)');
document.querySelectorAll('.swipe-controls').forEach(controls=>{
  const rail=document.getElementById(controls.dataset.rail);
  let index=0,queued=0;
  const items=()=>[...rail.children].filter(item=>!item.hidden);
  function update(){
    queued=0;
    const cards=items(),left=rail.getBoundingClientRect().left;
    index=cards.reduce((best,item,i)=>Math.abs(item.getBoundingClientRect().left-left)<Math.abs(cards[best].getBoundingClientRect().left-left)?i:best,0);
    cards.forEach((item,i)=>item.classList.toggle('is-current',i===index));
    controls.querySelector('.swipe-position').textContent=`${String(index+1).padStart(2,'0')} / ${String(cards.length).padStart(2,'0')}`;
    controls.querySelector('[data-step="-1"]').disabled=index===0;
    controls.querySelector('[data-step="1"]').disabled=index===cards.length-1;
  }
  function schedule(){if(!queued)queued=requestAnimationFrame(update);}
  function step(direction){
    const cards=items(),target=cards[Math.max(0,Math.min(cards.length-1,index+direction))];
    if(!target)return;
    rail.scrollBy({left:target.getBoundingClientRect().left-rail.getBoundingClientRect().left,behavior:calm.matches?'instant':'smooth'});
  }
  controls.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>step(+button.dataset.step)));
  rail.addEventListener('keydown',event=>{
    if(!phone.matches||!['ArrowLeft','ArrowRight'].includes(event.key))return;
    event.preventDefault();step(event.key==='ArrowRight'?1:-1);
  });
  rail.addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',schedule);addEventListener('akm:layout',schedule);update();
});

// A lightweight side-view locomotive brings the journey to narrow screens.
const guide=document.querySelector('#journey-guide');
let previousY=scrollY,settle=0;
addEventListener('scroll',()=>{
  const delta=scrollY-previousY;previousY=scrollY;
  if(Math.abs(delta)<1||!matchMedia('(max-width:960px)').matches)return;
  guide.dataset.direction=delta<0?'back':'forward';
  if(calm.matches)return;
  guide.classList.add('travelling');clearTimeout(settle);
  settle=setTimeout(()=>guide.classList.remove('travelling'),900);
},{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(settle);guide.classList.remove('travelling');}});
