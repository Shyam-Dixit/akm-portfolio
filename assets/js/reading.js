// Small, progressive enhancements for the writing collection and reading pages.
const motionCovers=[...document.querySelectorAll('[data-cover-motion]')];
if(motionCovers.length){
  const preference=matchMedia('(prefers-reduced-motion: reduce)'),visible=new Set();
  const update=()=>{
    motionCovers.forEach(img=>{
      const playing=!preference.matches&&!document.hidden&&visible.has(img);
      img.classList.toggle('cover-in-view',playing);
      if(img.dataset.coverMotion==='illustration'){
        const src=playing?img.dataset.coverSrc:img.dataset.coverStill;
        if(img.getAttribute('src')!==src)img.src=src;
      }
    });
  };
  const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>entry.isIntersecting?visible.add(entry.target):visible.delete(entry.target));update();},{threshold:.15});
  motionCovers.forEach(img=>observer.observe(img));
  preference.addEventListener('change',update);document.addEventListener('visibilitychange',update);update();
}
const articleFilters=document.querySelector('.article-filters');
if(articleFilters){
  const cards=[...document.querySelectorAll('[data-article-category]')];
  const categories=[...new Set(cards.map(card=>card.dataset.articleCategory))];
  if(categories.length>1){
    articleFilters.hidden=false;
    const count=document.querySelector('.collection-count'),originalCount=count.textContent;
    count.setAttribute('aria-live','polite');
    [null,...categories].forEach(category=>{
      const button=document.createElement('button');button.type='button';
      button.textContent=category||'All thoughts';button.setAttribute('aria-pressed',String(category===null));
      button.addEventListener('click',()=>{
        articleFilters.querySelectorAll('button').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
        cards.forEach(card=>{card.hidden=category!==null&&card.dataset.articleCategory!==category;});
        const visible=cards.filter(card=>!card.hidden).length;
        count.textContent=category===null?originalCount:`${visible} ${visible===1?'reflection':'reflections'} · ${category}`;
      });
      articleFilters.append(button);
    });
  }
}
const thoughts=document.querySelector('#thoughts');
if(thoughts){
  const observer=new IntersectionObserver(entries=>{
    if(entries[0].isIntersecting){thoughts.classList.add('in-view');observer.disconnect();}
  },{threshold:.15});
  observer.observe(thoughts);
  const rail=thoughts.querySelector('.thought-cards'),cards=[...rail.querySelectorAll('.home-thought')];
  const phone=matchMedia('(max-width:700px)'),calm=matchMedia('(prefers-reduced-motion:reduce)');
  const note=document.createElement('div'),hint=document.createElement('span'),position=document.createElement('span');
  note.className='thoughts-scroll-note';hint.textContent='Swipe to explore';
  position.setAttribute('aria-live','polite');note.append(hint,position);rail.after(note);
  rail.setAttribute('role','region');rail.setAttribute('aria-label','Articles');
  let current=0,queued=0;
  function updateRail(){
    queued=0;
    const scrollable=rail.scrollWidth>rail.clientWidth+1&&cards.length>1;
    note.hidden=!scrollable;hint.textContent=phone.matches?'Swipe to explore':'Scroll to explore';
    if(scrollable)rail.setAttribute('tabindex','0');else rail.removeAttribute('tabindex');
    if(!cards.length)return;
    const left=rail.getBoundingClientRect().left;
    current=cards.reduce((best,card,i)=>Math.abs(card.getBoundingClientRect().left-left)<Math.abs(cards[best].getBoundingClientRect().left-left)?i:best,0);
    if(rail.scrollWidth>rail.clientWidth&&rail.scrollLeft>=rail.scrollWidth-rail.clientWidth-2)current=cards.length-1;
    const label=`${current+1} / ${cards.length}`;
    if(position.textContent!==label){position.textContent=label;position.setAttribute('aria-label',`Article ${current+1} of ${cards.length}`);}
  }
  function scheduleRail(){if(!queued)queued=requestAnimationFrame(updateRail);}
  rail.addEventListener('scroll',scheduleRail,{passive:true});
  rail.addEventListener('keydown',event=>{
    if(rail.scrollWidth<=rail.clientWidth||!['ArrowLeft','ArrowRight'].includes(event.key))return;
    const max=rail.scrollWidth-rail.clientWidth,left=rail.getBoundingClientRect().left;
    const stops=[...new Set([0,...cards.map(card=>Math.max(0,Math.min(max,Math.round(rail.scrollLeft+card.getBoundingClientRect().left-left)))),max])].sort((a,b)=>a-b);
    const next=event.key==='ArrowRight'?stops.find(stop=>stop>rail.scrollLeft+2):[...stops].reverse().find(stop=>stop<rail.scrollLeft-2);
    if(next===undefined)return;
    event.preventDefault();
    rail.scrollTo({left:next,behavior:calm.matches?'instant':'smooth'});
  });
  phone.addEventListener('change',updateRail);addEventListener('resize',scheduleRail);document.fonts?.ready.then(scheduleRail);updateRail();
}
if(document.querySelector('.reading-article')){
  const update=()=>{
    const article=document.querySelector('.reading-article');
    const end=article.offsetTop+article.offsetHeight-innerHeight;
    const progress=Math.max(0,Math.min(100,scrollY/Math.max(1,end)*100));
    document.documentElement.style.setProperty('--reading-progress',progress+'%');
  };
  addEventListener('scroll',update,{passive:true});addEventListener('resize',update);document.fonts?.ready.then(update);update();
  document.querySelector('.reading-share').addEventListener('click',async()=>{
    const status=document.querySelector('.reading-share-status');
    try{await navigator.clipboard.writeText(location.href);status.textContent='Link copied.';}
    catch{status.textContent='Copy the link from your browser’s address bar.';}
  });
}
