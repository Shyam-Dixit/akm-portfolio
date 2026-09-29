import * as THREE from '../vendor/three.module.min.js';

// A small locomotive built from geometry; no external models or textures.
export function createTrain(canvas) {
  const renderer = new THREE.WebGLRenderer({canvas, alpha:true, antialias:true, powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  // Extra transparent space above the engine lets the steam rise without clipping.
  // Keep the original scale and lower edge so the locomotive stays on its track.
  renderer.setSize(100,170,false);
  renderer.setClearColor(0x000000,0);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-27,27,64.8,-27,.1,400);
  camera.position.set(0,110,150); camera.lookAt(0,4,0);
  scene.add(new THREE.HemisphereLight(0xfff7df,0x173249,2.6));
  const sun = new THREE.DirectionalLight(0xffffff,3.4); sun.position.set(-40,90,60); scene.add(sun);
  const rim = new THREE.DirectionalLight(0xe8bb55,1.7); rim.position.set(50,30,-40); scene.add(rim);
  const body = new THREE.Group(); scene.add(body);
  const material=(color,metalness=.25)=>new THREE.MeshStandardMaterial({color,metalness,roughness:.4});
  const navy=material(0x17445f),blue=material(0x357a9f),gold=material(0xe5b951,.7),dark=material(0x17222b),glass=material(0xa5d5dc,.5),red=material(0xa74935);
  const mesh=(geometry,mat,x,y,z,parent=body)=>{const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);parent.add(m);return m;};
  const box=(w,h,d,mat,x,y,z)=>mesh(new THREE.BoxGeometry(w,h,d),mat,x,y,z);
  box(27,2,10,navy,3,3,0);
  const boiler=mesh(new THREE.CylinderGeometry(4.4,4.4,17,24),blue,6,8,0);boiler.rotation.z=Math.PI/2;
  [1,8,14].forEach(x=>{const band=mesh(new THREE.TorusGeometry(4.45,.36,8,24),gold,x,8,0);band.rotation.y=Math.PI/2;});
  const face=mesh(new THREE.CylinderGeometry(4,4,.8,24),dark,15,8,0);face.rotation.z=Math.PI/2;
  box(8,11,10,navy,-7,8,0);box(10,1.2,12,blue,-7,14,0);
  box(5,5,.25,glass,-7,10,5.1);box(5,5,.25,glass,-7,10,-5.1);
  box(.3,5,6,glass,-2.9,10,0);
  mesh(new THREE.CylinderGeometry(1.7,1.3,5.8,16),dark,10,14,0);
  mesh(new THREE.CylinderGeometry(2.4,1.7,1.1,16),gold,10,17,0);
  mesh(new THREE.SphereGeometry(1.9,12,8),gold,2,12,0);
  box(2,1,12,red,17,3,0);
  const lamp=mesh(new THREE.CylinderGeometry(1.1,1.1,.7,16),new THREE.MeshBasicMaterial({color:0xffe9a5}),15.6,9,0);lamp.rotation.z=Math.PI/2;
  // Short coal tender keeps the engine readable at small sizes.
  box(9,5,9,navy,-19,6,0);box(9,1,9,gold,-19,8.8,0);box(9,1.8,8,dark,-19,9.5,0);box(5,1,2,dark,-13,3,0);
  const wheels=[];
  [-8,0,9,-21,-17].forEach((x,i)=>[-5.2,5.2].forEach(z=>{
    const wheel=new THREE.Group();wheel.position.set(x,2.7,z);body.add(wheel);
    const radius=i<3?2.7:1.7;
    const disc=mesh(new THREE.CylinderGeometry(radius,radius,.9,16),dark,0,0,0,wheel);disc.rotation.x=Math.PI/2;
    const ring=mesh(new THREE.TorusGeometry(radius-.3,.3,6,20),gold,0,0,z>0?.55:-.55,wheel);
    for(let a=0;a<3;a++){
      const spoke=mesh(new THREE.BoxGeometry(radius*1.6,.35,.3),gold,0,0,z>0?.6:-.6,wheel);spoke.rotation.z=a*Math.PI/3;
    }
    wheels.push(wheel);
  }));
  const steamImage=document.createElement('canvas');steamImage.width=64;steamImage.height=64;
  const ctx=steamImage.getContext('2d'),mist=ctx.createRadialGradient(32,32,2,32,32,31);
  mist.addColorStop(0,'rgba(245,250,250,1)');
  mist.addColorStop(.35,'rgba(219,230,232,.95)');
  mist.addColorStop(.7,'rgba(120,151,164,.65)');
  mist.addColorStop(1,'rgba(120,151,164,0)');
  ctx.fillStyle=mist;ctx.fillRect(0,0,64,64);
  const steamTexture=new THREE.CanvasTexture(steamImage);
  const smoke=[];
  for(let i=0;i<9;i++){
    const puff=new THREE.Sprite(new THREE.SpriteMaterial({map:steamTexture,transparent:true,opacity:0,depthWrite:false}));
    scene.add(puff);smoke.push(puff);
  }
  const chimney=new THREE.Vector3();
  let yaw=-Math.PI/2,rotation=0;
  return {
    render({angle,distance,moving,steam,time,reduced}) {
      const target=Math.atan2(-Math.sin(angle)/.592,Math.cos(angle));
      const delta=Math.atan2(Math.sin(target-yaw),Math.cos(target-yaw));
      yaw+=reduced?delta:delta*.22;
      body.rotation.y=yaw;
      if(!reduced)rotation+=distance*.07;
      wheels.forEach(w=>w.rotation.z=rotation);
      body.position.y=moving&&!reduced?Math.sin(time*.022)*.14:0;
      body.updateMatrixWorld();chimney.set(10,18,0);body.localToWorld(chimney);
      smoke.forEach((p,i)=>{
        const phase=(time*.00045+i/9)%1;
        // Rise in world space, independently of the train's changing heading.
        p.position.copy(chimney).add(new THREE.Vector3(Math.sin(phase*5+i*.4)*phase*4,phase*42,0));
        p.scale.setScalar(3+phase*12);
        p.material.opacity=reduced?0:Math.sin(Math.PI*phase)*.82*steam;
      });
      renderer.render(scene,camera);
      return Math.abs(delta)>.015;
    },
    dispose(){steamTexture.dispose();renderer.dispose();scene.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});}
  };
}
