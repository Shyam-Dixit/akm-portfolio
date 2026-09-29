// Small, progressive enhancements for the writing collection and reading pages.
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
