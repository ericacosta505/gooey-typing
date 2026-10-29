import * as THREE from 'three';
import { pillowGeometry,makeEnvironment,makeLegend } from './geometry.js';
import { spring,channel,clamp,deformPoint,waveAt } from './softbody.js';
import { attachJellyShader } from './deformation-shader.js';
import { createLiquidBed,createCaustics,createDroplets,createGooStrands } from './liquid.js';
const key=(label,code,width=1,value=label.toLowerCase())=>({label,code,width,value});
export const ROWS=[
  [key('esc','Escape'),...Array.from('1234567890').map(x=>key(x,'Digit'+x)),key('−','Minus',1,'-'),key('=','Equal'),key('delete','Backspace',2,'Backspace')],
  [key('tab','Tab',1.5),...Array.from('QWERTYUIOP').map(x=>key(x,'Key'+x)),key('[','BracketLeft'),key(']','BracketRight'),key('\\','Backslash',1.5)],
  [key('caps','CapsLock',1.75),...Array.from('ASDFGHJKL').map(x=>key(x,'Key'+x)),key(';','Semicolon'),key("'",'Quote'),key('return','Enter',2.25,'Enter')],
  [key('shift','ShiftLeft',2.25),...Array.from('ZXCVBNM').map(x=>key(x,'Key'+x)),key(',','Comma'),key('.','Period'),key('/','Slash'),key('shift','ShiftRight',2.75)],
  [key('ctrl','ControlLeft',1.25),key('⌥','AltLeft',1.25),key('⌘','MetaLeft',1.25),key('','Space',6.25,' '),key('⌘','MetaRight',1.25),key('⌥','AltRight',1.25),key('◀','ArrowLeft',1.25),key('▶','ArrowRight',1.25)]
];
const tones=['#e886ac','#e8a083','#ebc078','#c8d38e','#8fd4b5','#89c9d9','#a6b1e3','#c39ed7'];
// Picking uses a coarse copy of the same pillow shape, never the detailed GPU mesh.
function pickGeometry(width,height,depth){
  const geometry=new THREE.BoxGeometry(width,height,depth,Math.max(4,Math.min(18,Math.ceil(width*3))),4,4);
  const a=geometry.attributes.position.array,hw=width/2,hh=height/2,hd=depth/2,radius=Math.min(hw,hh,hd)*.77;
  for(let i=0;i<a.length;i+=3){
    const cx=clamp(a[i],-hw+radius,hw-radius),cy=clamp(a[i+1],-hh+radius,hh-radius),cz=clamp(a[i+2],-hd+radius,hd-radius);
    const dx=a[i]-cx,dy=a[i+1]-cy,dz=a[i+2]-cz,length=Math.hypot(dx,dy,dz)||1;
    const x=cx+dx/length*radius,y=cy+dy/length*radius,z=cz+dz/length*radius;
    const dome=Math.max(0,1-(x/hw)**4)*Math.max(0,1-(z/hd)**4);
    a[i]=x;a[i+1]=y+hh+.1*dome*clamp((y/hh-.25)/.75,0,1);a[i+2]=z;
  }
  geometry.deleteAttribute('normal');geometry.deleteAttribute('uv');geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}
export function createKeyboard(container,{onPress=()=>{},onSound=()=>{},onReady=()=>{},onHover=()=>{}}={}){
  let renderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch{return fallback(container,onPress,onSound,onReady);}
  renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio,1.5),2));
  renderer.transmissionResolutionScale=.8;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.93;
  renderer.setClearColor('#eae7ef',0);
  renderer.shadowMap.enabled=false;
  const canvas=renderer.domElement;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','A soft 3D jelly keyboard. Type on your keyboard, or hold and drag a key to stretch it.');canvas.style.touchAction='none';container.append(canvas);
  const scene=new THREE.Scene();scene.fog=new THREE.Fog('#e8e4ef',18,55);
  const camera=new THREE.PerspectiveCamera(32,1,.1,100);
  const environment=makeEnvironment(renderer);scene.environment=environment.texture;scene.environmentIntensity=.72;
  const keyLight=new THREE.DirectionalLight('#fff2de',2.2);keyLight.position.set(-4,10,6);keyLight.castShadow=true;
  keyLight.shadow.mapSize.set(1024,1024);Object.assign(keyLight.shadow.camera,{left:-10,right:10,top:8,bottom:-8,near:1,far:26});keyLight.shadow.bias=-.00025;keyLight.shadow.normalBias=.03;keyLight.shadow.radius=5;keyLight.shadow.blurSamples=6;
  const rim=new THREE.DirectionalLight('#c5daff',1.65);rim.position.set(7,6,-5);
  const blush=new THREE.DirectionalLight('#f7c1e3',1.2);blush.position.set(-8,3,-4);
  scene.add(keyLight,rim,blush,new THREE.HemisphereLight('#f8ecff','#9d91a9',.35));
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(140,140),new THREE.MeshStandardMaterial({color:'#e6e2eb',roughness:.53,metalness:.04}));floor.rotation.x=-Math.PI/2;floor.position.y=-.9;floor.receiveShadow=true;scene.add(floor);
  // A broad ambient contact shadow keeps the floating gel grounded without hard edges.
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=512;shadowCanvas.height=256;const sc=shadowCanvas.getContext('2d');const gradient=sc.createRadialGradient(256,128,15,256,128,250);gradient.addColorStop(0,'rgba(85,55,103,.33)');gradient.addColorStop(.6,'rgba(104,79,117,.18)');gradient.addColorStop(1,'rgba(116,99,123,0)');sc.fillStyle=gradient;sc.fillRect(0,0,512,256);
  const ambientTexture=new THREE.CanvasTexture(shadowCanvas);const ambientShadow=new THREE.Mesh(new THREE.PlaneGeometry(21,10),new THREE.MeshBasicMaterial({map:ambientTexture,transparent:true,depthWrite:false}));ambientShadow.rotation.x=-Math.PI/2;ambientShadow.position.y=-.897;scene.add(ambientShadow);
  const board=new THREE.Group();board.rotation.y=-.055;scene.add(board);
  const bed=createLiquidBed(board),caustics=createCaustics(scene),droplets=createDroplets(board),strands=createGooStrands(board);
  const geometries=new Map(),pickGeometries=new Map(),keys=[],byCode=new Map(),pickMeshes=[],textures=[];
  const contactCanvas=document.createElement('canvas');contactCanvas.width=128;contactCanvas.height=128;
  const contactContext=contactCanvas.getContext('2d'),contactGradient=contactContext.createRadialGradient(64,64,20,64,64,64);
  contactGradient.addColorStop(0,'rgba(77,51,90,.22)');contactGradient.addColorStop(.6,'rgba(102,67,108,.14)');contactGradient.addColorStop(1,'rgba(102,67,108,0)');contactContext.fillStyle=contactGradient;contactContext.fillRect(0,0,128,128);
  const contactTexture=new THREE.CanvasTexture(contactCanvas);textures.push(contactTexture);
  const contactShadows=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:contactTexture,transparent:true,depthWrite:false}),ROWS.flat().length);board.add(contactShadows);let contactIndex=0;const contactDummy=new THREE.Object3D();
  const beadCount=ROWS.flat().length*2;
  const beads=new THREE.InstancedMesh(new THREE.SphereGeometry(1,10,8),new THREE.MeshPhysicalMaterial({color:'#e9dce9',metalness:.65,roughness:.08,clearcoat:1,envMapIntensity:1.3}),beadCount);beads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);beads.frustumCulled=false;board.add(beads);const beadDummy=new THREE.Object3D();let beadIndex=0;
  ROWS.forEach((row,rowIndex)=>{
    let x=-7.5;
    row.forEach((desc,index)=>{
      const width=desc.width-.14,height=.87,depth=.94;
      const shape={halfWidth:width/2,halfDepth:depth/2,height:height+.1};
      const group=new THREE.Group();group.position.set(x+desc.width/2,.04,(rowIndex-2)*1.11);board.add(group);x+=desc.width;
      contactDummy.position.set(group.position.x,.052,group.position.z);contactDummy.rotation.x=-Math.PI/2;contactDummy.scale.set(width*1.8,1.5,1);contactDummy.updateMatrix();contactShadows.setMatrixAt(contactIndex++,contactDummy.matrix);
      const colorPos=clamp((group.position.x+7.5)/15*7+rowIndex*.05,0,6.999),i=Math.floor(colorPos);
      const color=new THREE.Color(tones[i]).lerp(new THREE.Color(tones[Math.min(i+1,7)]),colorPos-i);
      const material=new THREE.MeshPhysicalMaterial({color,metalness:0,roughness:.095,transmission:.95,thickness:1.15,ior:1.44,clearcoat:1,clearcoatRoughness:.065,attenuationColor:color.clone(),attenuationDistance:1.7,iridescence:.2,iridescenceIOR:1.32,iridescenceThicknessRange:[150,340],dispersion:0,envMapIntensity:1.05,emissive:color.clone(),emissiveIntensity:.018});
      const cache=width.toFixed(2);if(!geometries.has(cache))geometries.set(cache,pillowGeometry(width,height,depth,14,.1));
      const geometry=geometries.get(cache).clone();geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
      const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=false;group.add(mesh);
      if(!pickGeometries.has(cache))pickGeometries.set(cache,pickGeometry(width,height,depth));
      const pickMesh=new THREE.Mesh(pickGeometries.get(cache).clone(),new THREE.MeshBasicMaterial());pickMesh.visible=false;group.add(pickMesh);pickMeshes.push(pickMesh);
      const legend=makeLegend(desc.label,width,height,'#584e69');group.add(legend.mesh);textures.push(legend.texture);const updateShader=attachJellyShader(material,legend.mesh.material,shape);
      const state={...desc,group,mesh,pickMesh,pickBase:new Float32Array(pickMesh.geometry.attributes.position.array),pickMotion:null,pickDirty:false,legend,shape,updateShader,squash:channel(.82),spawnUntil:.42+rowIndex*.065+index*.012,pulseAt:-100,dragX:channel(),dragZ:channel(),pullY:channel(),swayX:channel(),swayZ:channel(),twist:channel(),held:false,until:0,gripX:0,gripZ:0,targetX:0,targetZ:0,targetY:0,phase:Math.random()*6.28,lastEnergy:0,hover:0};
      state.bubbles=Array.from({length:2},(_,bi)=>({id:beadIndex++,x:(Math.random()-.5)*width*.55,y:.35+Math.random()*.33,z:(Math.random()-.5)*.44,size:.035+Math.random()*.028}));
      for(const b of state.bubbles){beadDummy.position.set(group.position.x+b.x,group.position.y+b.y,group.position.z+b.z);beadDummy.scale.setScalar(b.size);beadDummy.updateMatrix();beads.setMatrixAt(b.id,beadDummy.matrix);}
      mesh.userData.key=state;pickMesh.userData.key=state;keys.push(state);byCode.set(desc.code,state);
    });
  });
  geometries.forEach(g=>g.dispose());
  for(const k of keys){k.neighbors=[-1,1].map(direction=>keys.filter(other=>other!==k&&Math.abs(other.group.position.z-k.group.position.z)<.1&&Math.sign(other.group.position.x-k.group.position.x)===direction).sort((a,b)=>Math.abs(a.group.position.x-k.group.position.x)-Math.abs(b.group.position.x-k.group.position.x))[0]).filter(Boolean);}
  const strandLinks=Array.from({length:4},()=>({from:new THREE.Vector3(),to:new THREE.Vector3(),color:new THREE.Color(),strength:0}));
  function updateStrands(){
    let count=0;
    if(!reduced)for(const k of keys){
      const amount=Math.hypot(k.dragX.value,k.dragZ.value)+Math.max(0,k.pullY.value);
      if(amount<.18||!k.pickMotion)continue;
      for(const neighbor of k.neighbors){
        if(count===4)break;
        const side=Math.sign(neighbor.group.position.x-k.group.position.x),link=strandLinks[count++];
        deformPoint(side*k.shape.halfWidth*.65,k.shape.height*.76,0,k.shape,k.pickMotion,output);
        link.from.set(...output).add(k.group.position);
        if(neighbor.pickMotion){deformPoint(-side*neighbor.shape.halfWidth*.78,neighbor.shape.height*.66,0,neighbor.shape,neighbor.pickMotion,output);link.to.set(...output).add(neighbor.group.position);}
        else link.to.set(neighbor.group.position.x-side*neighbor.shape.halfWidth*.78,neighbor.group.position.y+neighbor.shape.height*.66,neighbor.group.position.z);
        link.strength=clamp((amount-.18)/.4,0,1);link.color.copy(k.mesh.material.color).lerp(neighbor.mesh.material.color,.3);
      }
      if(count===4)break;
    }
    strands.update(strandLinks.slice(0,count));
  }
  pickGeometries.forEach(g=>g.dispose());
  let time=0,last=0,frameId=0,disposed=false,active=false,energy=0,intro=0,hovered=null,pointer=null,frames=0,dpr=renderer.getPixelRatio(),slowFrames=0;
  const reducedQuery=matchMedia('(prefers-reduced-motion: reduce)');let reduced=reducedQuery.matches;
  const waves=[],mouse={x:0,y:0},smoothedMouse={x:0,y:0};
  const output=[0,0,0];
  function addWave(k,strength=1){if(reduced)return;waves.push({x:k.group.position.x,z:k.group.position.z,time,strength});if(waves.length>12)waves.shift();energy=Math.min(1,energy+.14);}
  function press(code,held=true){
    const k=byCode.get(code);if(!k)return;
    if(!k.held){k.held=held;k.until=time+.13;k.squash.velocity+=reduced?0:5.2;k.swayX.velocity+=(Math.random()-.5)*1.4;k.swayZ.velocity-=.7;k.twist.velocity+=(Math.random()-.5)*.9;addWave(k,1);onSound(code,'down');}
    wake();
  }
  function release(code){const k=byCode.get(code);if(!k)return;const wasHeld=k.held;k.held=false;k.targetX=0;k.targetY=0;k.targetZ=0;if(wasHeld){addWave(k,.4);if(!reduced&&Math.abs(k.pullY.value)+Math.abs(k.dragX.value)+Math.abs(k.dragZ.value)>.18)droplets.emit(k.group.position.x,k.group.position.z,3);onSound(code,'up');}wake();}
  function clear(){for(const k of keys){k.held=false;k.until=0;k.targetX=0;k.targetY=0;k.targetZ=0;}if(pointer){try{canvas.releasePointerCapture(pointer.id);}catch{}pointer=null;}wake();}
  function deform(k,motion){
    k.updateShader(motion);
    k.pickMotion=motion;k.pickDirty=true;
    k.mesh.material.emissiveIntensity=.018+Math.max(0,motion.squash)*.12;
    for(const b of k.bubbles){deformPoint(b.x,b.y,b.z,k.shape,motion,output);beadDummy.position.set(k.group.position.x+output[0],k.group.position.y+output[1],k.group.position.z+output[2]);beadDummy.scale.setScalar(b.size);beadDummy.updateMatrix();beads.setMatrixAt(b.id,beadDummy.matrix);}beads.instanceMatrix.needsUpdate=true;
  }
  function updateKey(k,dt){
    const isPressed=k.held||time<k.until||(!reduced&&time<k.spawnUntil)||(!reduced&&time>k.pulseAt&&time<k.pulseAt+.1),dragAmount=Math.hypot(k.targetX,k.targetZ)+k.targetY;
    const target=isPressed?(dragAmount>.12?.12:.82):(hovered===k?-.045:0);
    let wave=0,swayX=0,swayZ=0;
    if(!reduced)for(const w of waves){const dx=k.group.position.x-w.x,dz=k.group.position.z-w.z,d=Math.hypot(dx,dz);if(d<.1)continue;const value=waveAt(d,time-w.time,w.strength);wave+=value*.2;swayX+=value*dx/(d||1)*.09;swayZ+=value*dz/(d||1)*.09;}
    if(reduced){k.squash.value=isPressed?.4:0;k.squash.velocity=0;for(const state of [k.dragX,k.dragZ,k.pullY,k.swayX,k.swayZ,k.twist]){state.value=0;state.velocity=0;}}else{
      const steps=2,step=dt/steps;
      for(let i=0;i<steps;i++){
        spring(k.squash,target,step,145,8.7);
        spring(k.dragX,k.targetX,step,k.held?170:75,k.held?15:4.8);
        spring(k.dragZ,k.targetZ,step,k.held?170:75,k.held?15:4.8);
        spring(k.pullY,k.targetY,step,k.held?135:85,k.held?13:5.5);
        spring(k.swayX,0,step,85,5.7);spring(k.swayZ,0,step,105,5.8);spring(k.twist,0,step,65,4.8);
      }
      k.squash.value=clamp(k.squash.value,-.5,.97);
    }
    const total=Math.abs(k.squash.value)+Math.abs(k.squash.velocity)+Math.abs(k.dragX.value)+Math.abs(k.dragZ.value)+Math.abs(k.pullY.value)+Math.abs(wave)+Math.abs(k.twist.value);
    if(total>.0008||k.lastEnergy>.0008){
      deform(k,{squash:clamp(k.squash.value-wave*.5,-.45,.92),dragX:k.dragX.value,dragZ:k.dragZ.value,pullY:clamp(k.pullY.value,-.08,2.8),swayX:k.swayX.value+swayX,swayZ:k.swayZ.value+swayZ,twist:k.twist.value,gripX:k.gripX,gripZ:k.gripZ,wave});k.lastEnergy=total;
    }
    return total>.002;
  }
  let wakeTime=performance.now();
  function wake(){clearTimeout(idleTimer);idleTimer=0;wakeTime=performance.now();if(!frameId&&!disposed&&!document.hidden)frameId=requestAnimationFrame(frame);}
  function frame(timestamp){
    frameId=0;if(disposed||document.hidden||timestamp===last)return;
    const rawDelta=(timestamp-last)/1000||.016,dt=Math.min(rawDelta,.034);last=timestamp;time+=dt;frames++;
    let moving=false;while(waves.length&&time-waves[0].time>2.6)waves.shift();
    for(const k of keys)moving=updateKey(k,dt)||moving;
    energy*=Math.exp(-dt*1.8);intro=Math.min(1,intro+dt*.5);
    smoothedMouse.x+=(mouse.x-smoothedMouse.x)*Math.min(1,dt*2.3);smoothedMouse.y+=(mouse.y-smoothedMouse.y)*Math.min(1,dt*2.3);
    if(!reduced){board.rotation.y=-.055+smoothedMouse.x*.055+Math.sin(time*.2)*.012;board.rotation.z=smoothedMouse.x*-.012;board.position.y=Math.sin(time*.8)*.032+energy*.02;board.rotation.x=smoothedMouse.y*.014;}
    updateStrands();bed.update(time,waves,reduced);caustics.update(time,reduced?[]:waves);moving=droplets.update(dt)||moving;
    renderer.render(scene,camera);
    if(frames%90===0){canvas.dataset.frameMs=String(Math.round(rawDelta*1000));canvas.dataset.drawCalls=String(renderer.info.render.calls);canvas.dataset.triangles=String(renderer.info.render.triangles);canvas.dataset.pixelRatio=String(dpr);}
    if(frames===2){onReady();container.classList.add('ready');}
    // Drop resolution only when sustained interaction is expensive; keep the silhouette smooth.
    if(rawDelta>.035&&moving)slowFrames++;else slowFrames=Math.max(0,slowFrames-1);
    if(slowFrames>75&&dpr>1.1){dpr=Math.max(1,dpr-.25);renderer.setPixelRatio(dpr);slowFrames=0;}
    if(frames<2||(reduced?keys.some(k=>!k.held&&time<k.until):(moving||waves.length||pointer||active||timestamp-wakeTime<2200||intro<1))){frameId=requestAnimationFrame(frame);}
    else if(!reduced){idleTimer=setTimeout(()=>{idleTimer=0;if(!disposed&&!document.hidden&&!frameId)frameId=requestAnimationFrame(frame);},100);}
  }
  let idleTimer=0;
  const ray=new THREE.Raycaster(),pt=new THREE.Vector2();
  function hit(e){
    const rect=canvas.getBoundingClientRect();pt.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
    for(const k of keys){
      if(!k.pickDirty)continue;
      const geometry=k.pickMesh.geometry,a=geometry.attributes.position.array,b=k.pickBase;
      for(let i=0;i<a.length;i+=3){deformPoint(b[i],b[i+1],b[i+2],k.shape,k.pickMotion,output);a[i]=output[0];a[i+1]=output[1];a[i+2]=output[2];}
      geometry.computeBoundingBox();geometry.computeBoundingSphere();k.pickDirty=false;
    }
    board.updateWorldMatrix(true,true);camera.updateWorldMatrix(true,false);ray.setFromCamera(pt,camera);
    return ray.intersectObjects(pickMeshes,false)[0];
  }
  canvas.addEventListener('pointermove',e=>{
    const rect=canvas.getBoundingClientRect();mouse.x=(e.clientX-rect.left)/rect.width*2-1;mouse.y=(e.clientY-rect.top)/rect.height*2-1;
    if(pointer&&pointer.id===e.pointerId){
      const k=pointer.key,scale=15.8/Math.max(320,rect.width*.82),dx=(e.clientX-pointer.x)*scale,dy=(e.clientY-pointer.y)*scale;
      if(Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>5)pointer.dragged=true;
      if(pointer.dragged){k.targetX=clamp(dx,-2.1,2.1);k.targetZ=clamp(dy*.28,-.65,.8);k.targetY=clamp(-dy*1.05+Math.abs(dx)*.25,0,2.3);}
      canvas.style.cursor='grabbing';wake();return;
    }
    const found=hit(e)?.object.userData.key??null;
    if(found!==hovered){hovered=found;onHover(!!found);canvas.style.cursor=found?'grab':'default';wake();}
  });
  canvas.addEventListener('pointerleave',()=>{if(!pointer){hovered=null;onHover(false);mouse.x=0;mouse.y=0;wake();}});
  canvas.addEventListener('pointerdown',e=>{
    if(pointer||e.button>0)return;const h=hit(e);if(!h)return;const k=h.object.userData.key;e.preventDefault();clearTimeout(idleTimer);
    // Recover the grip on the rest surface, even when this key is already stretched.
    const b=k.pickBase,f=h.face,w=h.barycoord;
    const gripX=b[f.a*3]*w.x+b[f.b*3]*w.y+b[f.c*3]*w.z,gripZ=b[f.a*3+2]*w.x+b[f.b*3+2]*w.y+b[f.c*3+2]*w.z;
    k.gripX=clamp(gripX/k.shape.halfWidth,-.8,.8);k.gripZ=clamp(gripZ/k.shape.halfDepth,-.8,.8);
    pointer={id:e.pointerId,key:k,x:e.clientX,y:e.clientY,dragged:false};canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';press(k.code);
  });
  function lift(e){if(!pointer||pointer.id!==e.pointerId)return;const p=pointer;pointer=null;release(p.key.code);try{canvas.releasePointerCapture(e.pointerId);}catch{}canvas.style.cursor='grab';if(!p.dragged&&e.type==='pointerup')onPress(p.key.value,p.key.code);}
  canvas.addEventListener('pointerup',lift);canvas.addEventListener('pointercancel',lift);canvas.addEventListener('lostpointercapture',e=>{if(pointer?.id===e.pointerId){release(pointer.key.code);pointer=null;}});
  const resize=new ResizeObserver(()=>{const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;const d=Math.max(8.45/(Math.tan(THREE.MathUtils.degToRad(16))*camera.aspect)+3.3,11.3);camera.position.set(d*.025,d*.735,d*.678);camera.lookAt(0,.1,0);camera.updateProjectionMatrix();wake();});resize.observe(container);
  const visibility=()=>{clear();if(document.hidden){cancelAnimationFrame(frameId);clearTimeout(idleTimer);frameId=0;}else{last=performance.now();wake();}};
  const motionChange=e=>{reduced=e.matches;wake();};reducedQuery.addEventListener('change',motionChange);document.addEventListener('visibilitychange',visibility);window.addEventListener('blur',clear);
  wake();
  return {press,release,clear,setActive(value){if(value&&!active&&!reduced){keys.forEach(k=>k.pulseAt=time+.08+Math.abs(k.group.position.x)*.022+Math.abs(k.group.position.z)*.018);waves.push({x:0,z:0,time:time+.06,strength:1.5});}active=value;wake();},
    dispose(){disposed=true;cancelAnimationFrame(frameId);clearTimeout(idleTimer);resize.disconnect();reducedQuery.removeEventListener('change',motionChange);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',clear);scene.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());});textures.forEach(t=>t.dispose());ambientTexture.dispose();environment.dispose();renderer.dispose();container.replaceChildren();}
  };
}
function fallback(container,onPress,onSound,onReady){
  container.classList.add('fallback');const codes=new Map();
  for(const row of ROWS){const r=document.createElement('div');r.className='fallback-row';for(const k of row){const b=document.createElement('button');b.textContent=k.label;b.style.flex=k.width;b.style.background=tones[Math.min(7,Math.floor(codes.size%14/2))];b.setAttribute('aria-label',k.code);b.addEventListener('click',()=>{onPress(k.value,k.code);onSound(k.code);});r.append(b);codes.set(k.code,b);}container.append(r);}
  onReady();return {press(c){codes.get(c)?.classList.add('pressed');},release(c){codes.get(c)?.classList.remove('pressed');},clear(){codes.forEach(b=>b.classList.remove('pressed'));},setActive(){},dispose(){container.replaceChildren();}};
}
