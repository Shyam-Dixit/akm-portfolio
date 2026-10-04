// Small, progressive enhancements for the writing collection and reading pages.
const motionCovers=[...document.querySelectorAll('[data-cover-motion]')];
if(motionCovers.length){
  const preference=matchMedia('(prefers-reduced-motion: reduce)'),visible=new Set();
  let paused=false;
  try{paused=sessionStorage.getItem('akm-cover-motion')==='paused';}catch{}
  const control=document.createElement('button');
  control.type='button';control.className='cover-motion-control';
  const update=()=>{
    const stopped=paused||preference.matches;
    control.textContent=stopped?'Resume artwork motion':'Pause artwork motion';
    control.setAttribute('aria-pressed',String(stopped));
    control.hidden=preference.matches;
    motionCovers.forEach(img=>{
      const playing=!stopped&&!document.hidden&&visible.has(img);
      img.classList.toggle('cover-in-view',playing);
      if(img.dataset.coverMotion==='illustration'){
        const src=img.dataset.coverSrc+(playing?'':'#still');
        if(img.getAttribute('src')!==src)img.src=src;
      }
    });
  };
  control.addEventListener('click',()=>{paused=!paused;try{sessionStorage.setItem('akm-cover-motion',paused?'paused':'playing');}catch{}update();});
  const artwork=document.querySelector('.reading-art');
  if(artwork)artwork.after(control);else document.querySelector('.collection-count')?.after(control);
  const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>entry.isIntersecting?visible.add(entry.target):visible.delete(entry.target));update();},{threshold:.15});
  motionCovers.forEach(img=>observer.observe(img));
  preference.addEventListener('change',update);document.addEventListener('visibilitychange',update);update();
}
const thoughts=document.querySelector('#thoughts');
if(thoughts){
  const observer=new IntersectionObserver(entries=>{
    if(entries[0].isIntersecting){thoughts.classList.add('in-view');observer.disconnect();}
  },{threshold:.15});
  observer.observe(thoughts);
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
