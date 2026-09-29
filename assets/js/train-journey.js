const $=s=>document.querySelector(s);
const control=$('#train-scroll'),thumb=$('#train-thumb'),layer=$('#journey-track');
const path=$('#journey-route'),progressPath=$('#journey-route-progress');
const desktop=matchMedia('(min-width:961px) and (min-height:421px)');
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
const chapters=[['about','About'],['journey','Journey'],['achv','Achievements'],['expertise','Expertise'],['thoughts','Thoughts'],['gallery','Gallery'],['contact','Contact']];
let state=null,frame=0,layoutFrame=0,lastY=scrollY,lastMove=0,direction=1,angle=Math.PI/2,travelled=0,drag=null,anchor=null,model=null,modelPromise=null;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function loadModel(){
  if(modelPromise||reduced.matches)return;
  modelPromise=import('./train-model.js').then(({createTrain})=>{
    model=createTrain($('#train-canvas'));control.classList.add('has-model');
    $('#train-canvas').addEventListener('webglcontextlost',event=>{
      event.preventDefault();
      control.classList.remove('has-model');control.dataset.renderer='svg';
    });
    $('#train-canvas').addEventListener('webglcontextrestored',()=>{
      control.classList.add('has-model');control.dataset.renderer='webgl';wake();
    });
    control.dataset.renderer='webgl';wake();
  }).catch(()=>{control.dataset.renderer='svg';});
}
function pointAtY(y){
  const samples=state.samples;
  let low=0,high=samples.length-1;
  while(high-low>1){const mid=(low+high)>>1;if(samples[mid].y<y)low=mid;else high=mid;}
  const a=samples[low],b=samples[high],t=clamp((y-a.y)/(b.y-a.y||1),0,1);
  const length=a.length+(b.length-a.length)*t;
  return {point:path.getPointAtLength(length),length};
}
function place(){
  if(!state)return;
  const y=clamp(scrollY+(anchor??innerHeight*.58),state.start,state.end);
  const {point,length}=pointAtY(y),screenY=point.y-scrollY;
  const visible=screenY>90&&screenY<innerHeight-55;
  control.hidden=!visible;
  control.style.left=point.x+'px';control.style.top=screenY+'px';
  const next=path.getPointAtLength(Math.min(state.length,length+3));
  const previous=path.getPointAtLength(Math.max(0,length-3));
  angle=Math.atan2(next.y-previous.y,next.x-previous.x)+(direction<0?Math.PI:0);
  thumb.style.setProperty('--heading',angle+'rad');
  thumb.dataset.direction=direction>0?'down':'up';
  progressPath.style.strokeDashoffset=state.length-length;
  const percent=clamp(scrollY/state.maxScroll,0,1)*100;
  thumb.setAttribute('aria-valuenow',Math.round(percent));
  const current=[...state.stops].reverse().find(s=>s.y<=y)||state.stops[0];
  $('#train-section').textContent=current.name;
  $('#train-help').textContent=(direction>0?'↓ Forward':'↑ Back')+' · Drag to travel';
  thumb.setAttribute('aria-valuetext',`${current.name}, ${Math.round(percent)}%`);
  state.stops.forEach(s=>s.marker.classList.toggle('passed',y>=s.y));
  if(visible)loadModel();
  return visible;
}
function wake(){if(!frame&&state&&!document.hidden)frame=requestAnimationFrame(animate);}
function animate(now){
  frame=0;
  if(!state||document.hidden)return;
  const moving=now-lastMove<600&&!reduced.matches;
  const steam=reduced.matches?0:clamp(1-(now-lastMove-700)/1600,0,1);
  const visible=!control.hidden;
  control.classList.toggle('moving',moving);
  let turning=false;
  if(model&&visible&&control.dataset.renderer==='webgl')turning=model.render({angle,distance:travelled,moving,steam,time:now,reduced:reduced.matches});
  travelled=0;
  if(visible&&(moving||turning||steam>0))wake();
}
function onScroll(){
  const delta=scrollY-lastY;
  if(Math.abs(delta)>.5){direction=delta>0?1:-1;lastMove=performance.now();travelled+=delta;}
  lastY=scrollY;place();wake();updateGuide();
}
function endDrag(){
  if(!drag)return;
  const id=drag.id;drag=null;
  if(thumb.hasPointerCapture(id))thumb.releasePointerCapture(id);
  document.documentElement.classList.remove('train-dragging');control.classList.remove('dragging');
}
function build(){
  layoutFrame=0;endDrag();state=null;control.hidden=true;layer.hidden=true;layer.style.height='0px';
  if(frame)cancelAnimationFrame(frame);frame=0;
  if(!desktop.matches||document.hidden)return;
  const width=document.documentElement.clientWidth,footer=$('footer').getBoundingClientRect();
  const height=footer.bottom+scrollY;
  const x=$('#coach-rail').getBoundingClientRect().left/2||32;
  const stops=chapters.map(([id,name])=>{
    const el=$('#'+id),top=el.getBoundingClientRect().top+scrollY;
    const heading=el.querySelector('.sign-plate,h2');
    const sx=Math.max(x,Math.min(155,(heading?.getBoundingClientRect().left||250)-72));
    return {id,name,top,x:sx,y:top+155};
  });
  const start=stops[0].top+10,end=footer.top+scrollY+70;
  let d=`M ${x} ${start}`;
  stops.forEach(s=>{
    // A bounded bend in the heading's whitespace, back in the gutter before content.
    d+=` L ${x} ${s.top+10} C ${x} ${s.top+65},${s.x} ${s.top+70},${s.x} ${s.y} C ${s.x} ${s.top+245},${x} ${s.top+235},${x} ${s.top+305}`;
  });
  d+=` L ${x} ${end}`;
  layer.style.height=height+'px';layer.querySelector('svg').setAttribute('viewBox',`0 0 ${width} ${height}`);
  layer.querySelectorAll('path').forEach(p=>p.setAttribute('d',d));
  const length=path.getTotalLength(),samples=[];
  for(let l=0;l<length;l+=8){const p=path.getPointAtLength(l);samples.push({y:p.y,length:l});}
  samples.push({y:end,length});
  progressPath.style.strokeDasharray=length;
  const markers=$('#journey-stations');markers.replaceChildren();
  stops.forEach((s,i)=>{
    const marker=document.createElementNS('http://www.w3.org/2000/svg','g');marker.classList.add('route-station');
    const circle=document.createElementNS(marker.namespaceURI,'circle');circle.setAttribute('cx',s.x);circle.setAttribute('cy',s.y);circle.setAttribute('r','8');
    const label=document.createElementNS(marker.namespaceURI,'text');label.setAttribute('x',s.x+17);label.setAttribute('y',s.y+4);label.textContent=String(i+1).padStart(2,'0');
    marker.append(circle,label);markers.append(marker);s.marker=marker;
  });
  state={start,end,length,samples,stops,maxScroll:Math.max(1,document.documentElement.scrollHeight-innerHeight)};
  layer.hidden=false;lastY=scrollY;anchor=anchor===null?null:clamp(anchor,115,innerHeight-85);place();wake();updateGuide();
}
function scheduleBuild(){if(!layoutFrame)layoutFrame=requestAnimationFrame(build);}
thumb.addEventListener('pointerdown',e=>{
  if(e.button!==0||!e.isPrimary||!state)return;
  e.preventDefault();thumb.focus({preventScroll:true});
  drag={id:e.pointerId,y:e.clientY,scroll:scrollY};thumb.setPointerCapture(e.pointerId);
  document.documentElement.classList.add('train-dragging');control.classList.add('dragging');
});
thumb.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId||!state)return;
  anchor=clamp(e.clientY,115,innerHeight-85);
  const top=drag.scroll+(e.clientY-drag.y)*state.maxScroll/Math.max(220,innerHeight-220);
  window.scrollTo({top:clamp(top,0,state.maxScroll),behavior:'instant'});
  onScroll();
});
['pointerup','pointercancel','lostpointercapture'].forEach(event=>thumb.addEventListener(event,endDrag));
thumb.addEventListener('keydown',e=>{
  if(!state)return;
  const targets={ArrowDown:scrollY+90,ArrowUp:scrollY-90,PageDown:scrollY+innerHeight*.8,PageUp:scrollY-innerHeight*.8,Home:0,End:state.maxScroll};
  if(!(e.key in targets))return;
  e.preventDefault();window.scrollTo({top:clamp(targets[e.key],0,state.maxScroll),behavior:'instant'});onScroll();
});
function updateGuide(){
  const guide=$('#journey-guide');
  guide.hidden=scrollY<innerHeight*.65;
  const readY=scrollY+innerHeight*.35;
  let active=0;
  chapters.forEach(([id],i)=>{if($('#'+id).getBoundingClientRect().top+scrollY<=readY)active=i;});
  $('#guide-current').textContent=`${String(active+1).padStart(2,'0')} / ${chapters.length} · ${chapters[active][1]}`;
  guide.style.setProperty('--read-progress',clamp(scrollY/(document.documentElement.scrollHeight-innerHeight),0,1)*100+'%');
  guide.querySelectorAll('a').forEach((a,i)=>{if(i===active)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
}
$('#journey-guide').querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{$('#journey-guide').open=false;}));
window.addEventListener('scroll',onScroll,{passive:true});
window.addEventListener('resize',scheduleBuild);
window.addEventListener('akm:layout',scheduleBuild);
window.addEventListener('blur',endDrag);
window.addEventListener('pagehide',event=>{
  endDrag();if(frame)cancelAnimationFrame(frame);frame=0;
  if(!event.persisted){model?.dispose();model=null;}
});
window.addEventListener('pageshow',scheduleBuild);
document.addEventListener('visibilitychange',scheduleBuild);
desktop.addEventListener('change',scheduleBuild);
reduced.addEventListener('change',()=>{place();wake();});
document.fonts?.ready.then(scheduleBuild);
new ResizeObserver(scheduleBuild).observe(document.body);
scheduleBuild();updateGuide();
