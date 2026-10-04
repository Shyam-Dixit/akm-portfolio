// Keep the first highlights within reach on phones; the complete sections stay available.
(()=>{
  const phone=matchMedia('(max-width:700px)');
  const sections=[
    {id:'coach-track',item:'.coach',limit:2,noun:'achievements',short:'Show fewer achievements'},
    {id:'exp-grid',item:'.exp-card',limit:4,noun:'areas of expertise',short:'Show fewer areas'}
  ];
  const refresh=()=>{
    if(typeof window.requestLayoutRefresh==='function')window.requestLayoutRefresh();
    else{window.dispatchEvent(new Event('akm:layout'));window.ScrollTrigger?.refresh();}
  };
  sections.forEach(config=>{
    const container=document.getElementById(config.id);
    if(!container)return;
    const extra=[...container.querySelectorAll(config.item)].slice(config.limit);
    if(!extra.length)return;
    const button=document.createElement('button');
    button.type='button';button.className='mobile-section-toggle';button.hidden=true;
    button.setAttribute('aria-controls',container.id);
    container.after(button);container.classList.add('mobile-section-list');
    extra.forEach(item=>item.classList.add('mobile-section-extra'));
    let expanded=false;
    function sync(){
      if(phone.matches&&extra.some(item=>item.contains(document.activeElement)))expanded=true;
      extra.forEach(item=>{item.hidden=phone.matches&&!expanded;});
      button.hidden=!phone.matches;
      button.setAttribute('aria-expanded',String(expanded));
      button.innerHTML=`<span>${expanded?config.short:`Show ${extra.length} more ${config.noun}`}</span><svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 7 5 5 5-5"/></svg>`;
      if(!phone.matches&&document.activeElement===button){
        const heading=container.closest('section').querySelector('h2');
        heading.tabIndex=-1;heading.focus({preventScroll:true});
      }
      refresh();
    }
    button.addEventListener('click',()=>{
      const beforeY=scrollY,beforeTop=button.getBoundingClientRect().top;
      expanded=!expanded;sync();
      // Expansion reveals the next cards below the reader. On collapse, keep
      // the button in the same viewport position so the reader stays here.
      const top=expanded?beforeY:beforeY+button.getBoundingClientRect().top-beforeTop;
      window.scrollTo({top:Math.max(0,top),behavior:'instant'});
    });
    phone.addEventListener('change',sync);sync();
  });
})();
