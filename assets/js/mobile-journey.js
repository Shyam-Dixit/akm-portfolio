// Carousel controls remain available only for layouts that actually scroll sideways.
const phone=matchMedia('(max-width:700px)');
const calm=matchMedia('(prefers-reduced-motion:reduce)');
document.querySelectorAll('.swipe-controls').forEach(controls=>{
  const rail=document.getElementById(controls.dataset.rail);
  if(!rail||rail.id==='education-cards')return;
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

// Keep the animated career corridor visible on phones without reserving space
// for the unused north and south of the full India map.
const mapToggle=document.querySelector('.route-map-toggle');
const routeMap=document.querySelector('#indiamap');
const achievements=document.querySelector('#coach-track');
const completeMapView=routeMap?.getAttribute('viewBox');
const mapLabels=[...document.querySelectorAll('#indiamap .city-lbl')].map(label=>({label,x:label.getAttribute('x'),y:label.getAttribute('y')}));
const stationOptions=[...document.querySelectorAll('#station-select option')].map(option=>({option,label:option.textContent}));
let mapExpanded=false;
function updatePhoneLayout(){
  if(mapToggle&&routeMap){
    const compactMap=phone.matches&&!mapExpanded;
    mapToggle.hidden=!phone.matches;
    routeMap.removeAttribute('hidden');
    routeMap.setAttribute('viewBox',compactMap?'-44 208 500 270':completeMapView);
    routeMap.dataset.view=compactMap?'route':'full';
    mapToggle.setAttribute('aria-expanded',String(mapExpanded));
    mapToggle.setAttribute('aria-label',mapExpanded?'Return to compact career route':'Expand to full India map');
    mapToggle.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${mapExpanded?'<path d="M9 3v6H3m12-6v6h6M9 21v-6H3m12 6v-6h6"/>':'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>'}</svg><span>${mapExpanded?'Route view':'Full map'}</span>`;
    mapLabels.forEach(({label,x,y})=>{
      // Separate the dense western stations and leave room for the moving train.
      const phonePosition={Dahod:[x,'324'],Bhavnagar:[x,'401'],Ahmedabad:[x,'309'],Kota:[x,'265'],Vadodara:[x,'382'],Lucknow:[x,'229'],Prayagraj:[x,'314'],Jhansi:['272','310'],Hajipur:['379','282'],Gorakhpur:[x,'236'],Mumbai:[x,'460']}[label.textContent];
      const position=phone.matches&&phonePosition?phonePosition:[x,y];
      label.setAttribute('x',position[0]);
      label.setAttribute('y',position[1]);
    });
    stationOptions.forEach(({option,label})=>{option.textContent=phone.matches?label.split(' · ').slice(0,2).join(' · '):label;});
  }
  if(achievements){
    achievements.setAttribute('aria-label',phone.matches?'Achievements':'Achievements, use the left and right arrow keys to explore');
    if(phone.matches)achievements.removeAttribute('tabindex');
    else achievements.setAttribute('tabindex','0');
  }
  window.dispatchEvent(new Event('akm:layout'));
}
mapToggle?.addEventListener('click',()=>{mapExpanded=!mapExpanded;updatePhoneLayout();});
phone.addEventListener('change',updatePhoneLayout);
updatePhoneLayout();

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
