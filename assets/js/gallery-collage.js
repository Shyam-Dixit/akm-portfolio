// Native scrolling gives the reader control; the gentle drift resumes after a pause.
(()=>{
  const grid=document.querySelector('#gal-grid');
  if(!grid)return;
  const speed=22,rest=3500;
  let lanes=[],frame=0,lastTime=0;
  const canMove=()=>grid.classList.contains('collage-in-view')&&!grid.classList.contains('motion-paused')&&!document.hidden;
  function wake(){if(!frame&&canMove())frame=requestAnimationFrame(tick);}
  function hold(row,duration=rest){
    row.until=Math.max(row.until,performance.now()+duration);
    clearTimeout(row.timer);row.timer=setTimeout(wake,row.until-performance.now()+20);
  }
  function write(row,position){
    row.position=position;row.lane.scrollLeft=position;row.written=row.lane.scrollLeft;
  }
  function tick(now){
    frame=0;
    if(!canMove()){lastTime=0;return;}
    const elapsed=lastTime?Math.min(50,now-lastTime)/1000:0;
    lastTime=now;let moving=false;
    lanes.forEach(row=>{
      if(!row.span||row.touching||row.hover||row.keyboard||now<row.until)return;
      moving=true;
      let position=row.position+row.direction*speed*elapsed;
      // Repeated groups let either direction wrap without a visible jump.
      while(position<row.span)position+=row.span;
      while(position>=row.span*2)position-=row.span;
      write(row,position);
    });
    if(moving)wake();else lastTime=0;
  }
  function copyGroup(group){
    const copy=group.cloneNode(true);
    copy.removeAttribute('data-gallery-original');copy.setAttribute('aria-hidden','true');
    copy.querySelectorAll('button').forEach(button=>button.tabIndex=-1);
    copy.querySelectorAll('img').forEach(img=>img.alt='');
    return copy;
  }
  function measure(){
    lanes.forEach(row=>{
      const gap=parseFloat(getComputedStyle(row.reel).columnGap)||0;
      const span=row.group.getBoundingClientRect().width+gap;
      if(!span||!row.lane.clientWidth)return;
      // A short filtered collection still needs enough copies beyond the wrap
      // point to fill the entire viewport. Three groups alone can hit the end.
      const copiesAfter=Math.max(1,Math.ceil((row.lane.clientWidth+gap)/span));
      if(span===row.span&&copiesAfter===row.copiesAfter)return;
      const progress=row.span?((row.position%row.span)+row.span)%row.span/row.span:0;
      if(copiesAfter!==row.copiesAfter){
        [...row.reel.children].filter(group=>group!==row.group).forEach(group=>group.remove());
        row.reel.insertBefore(copyGroup(row.group),row.group);
        for(let i=0;i<copiesAfter;i++)row.reel.append(copyGroup(row.group));
        row.copiesAfter=copiesAfter;
      }
      row.span=span;write(row,span*(1+progress));
    });wake();
  }
  const sizes=new ResizeObserver(measure);
  function bind(){
    lanes.forEach(row=>{row.abort.abort();clearTimeout(row.timer);});sizes.disconnect();
    lanes=[...grid.querySelectorAll('.gallery-lane')].map((lane,index)=>{
      const row={lane,reel:lane.querySelector('.gallery-reel'),group:lane.querySelector('[data-gallery-original]')||lane.querySelector('.gallery-reel-group:not([aria-hidden])'),copiesAfter:0,direction:index%2?-1:1,position:0,written:0,span:0,until:0,timer:0,touching:false,hover:false,keyboard:false,pointer:null,suppressUntil:0,abort:new AbortController()};
      const on=(name,handler,options={})=>lane.addEventListener(name,handler,{...options,signal:row.abort.signal});
      lane.tabIndex=0;lane.setAttribute('role','region');lane.setAttribute('aria-label',`Photograph row ${index+1}, scroll left or right`);
      on('scroll',()=>{
        if(Math.abs(lane.scrollLeft-row.written)<1)return;
        row.position=lane.scrollLeft;row.written=lane.scrollLeft;hold(row);
      },{passive:true});
      on('wheel',()=>hold(row),{passive:true});
      on('pointerenter',event=>{if(event.pointerType==='mouse')row.hover=true;});
      on('pointerleave',event=>{if(event.pointerType==='mouse'){row.hover=false;hold(row,900);}});
      on('pointerdown',event=>{
        if(event.button!==0)return;
        row.touching=true;row.pointer={id:event.pointerId,x:event.clientX,y:event.clientY,left:lane.scrollLeft,moved:false};
      });
      on('pointermove',event=>{
        const pointer=row.pointer;if(!pointer||pointer.id!==event.pointerId)return;
        const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;
        if(Math.abs(dx)>6&&Math.abs(dx)>Math.abs(dy))pointer.moved=true;
        if(event.pointerType!=='mouse'||!pointer.moved)return;
        event.preventDefault();
        if(!lane.hasPointerCapture(event.pointerId))lane.setPointerCapture(event.pointerId);
        lane.classList.add('is-dragging');write(row,pointer.left-dx);
      });
      function release(event){
        if(!row.pointer||row.pointer.id!==event.pointerId)return;
        if(row.pointer.moved)row.suppressUntil=performance.now()+350;
        if(lane.hasPointerCapture(event.pointerId))lane.releasePointerCapture(event.pointerId);
        row.pointer=null;row.touching=false;lane.classList.remove('is-dragging');hold(row);
      }
      on('pointerup',release);on('pointercancel',release);on('lostpointercapture',release);
      window.addEventListener('pointerup',release,{signal:row.abort.signal});
      on('click',event=>{
        if(performance.now()>=row.suppressUntil)return;
        event.preventDefault();event.stopImmediatePropagation();
      },{capture:true});
      on('dragstart',event=>event.preventDefault());
      on('focusin',event=>{
        if(!event.target.matches(':focus-visible'))return;
        row.keyboard=true;
        if(event.target.matches('.gal-open'))event.target.scrollIntoView({block:'nearest',inline:'center',behavior:'instant'});
      });
      on('focusout',event=>{if(!lane.contains(event.relatedTarget)){row.keyboard=false;hold(row,900);}});
      on('keydown',event=>{
        if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
        event.preventDefault();row.keyboard=true;
        lane.scrollBy({left:(event.key==='ArrowRight'?1:-1)*lane.clientWidth*.75,behavior:'smooth'});
      });
      sizes.observe(lane);sizes.observe(row.group);
      return row;
    });measure();
  }
  new MutationObserver(changes=>{
    if(changes.some(change=>change.type==='childList'))bind();else wake();
  }).observe(grid,{childList:true,attributes:true,attributeFilter:['class']});
  document.addEventListener('visibilitychange',wake);
  window.addEventListener('blur',()=>lanes.forEach(row=>{row.pointer=null;row.touching=false;row.hover=false;row.lane.classList.remove('is-dragging');hold(row);}));
  bind();
})();
