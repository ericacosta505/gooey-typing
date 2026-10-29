import * as THREE from 'three';
import { mergeVertices } from './vendor/BufferGeometryUtils.js';
import { clamp } from './softbody.js';
export function pillowGeometry(width,height,depth,segments=14,puff=.1){
  const sx=Math.min(64,Math.ceil(segments*Math.sqrt(width))),sz=Math.max(10,segments),sy=12;
  let geo=new THREE.BoxGeometry(width,height,depth,sx,sy,sz);
  const a=geo.attributes.position.array,hw=width/2,hh=height/2,hd=depth/2;
  const radius=Math.min(hw,hh,hd)*.77;
  for(let i=0;i<a.length;i+=3){
    let x=a[i],y=a[i+1],z=a[i+2];
    const cx=clamp(x,-hw+radius,hw-radius),cy=clamp(y,-hh+radius,hh-radius),cz=clamp(z,-hd+radius,hd-radius);
    const dx=x-cx,dy=y-cy,dz=z-cz,l=Math.hypot(dx,dy,dz)||1;
    x=cx+dx/l*radius;y=cy+dy/l*radius;z=cz+dz/l*radius;
    const dome=Math.max(0,1-(x/hw)**4)*Math.max(0,1-(z/hd)**4);
    y+=puff*dome*clamp((y/hh-.25)/.75,0,1);
    a[i]=x;a[i+1]=y+hh;a[i+2]=z;
  }
  geo.deleteAttribute('normal');geo.deleteAttribute('uv');
  geo=mergeVertices(geo,1e-5);geo.computeVertexNormals();geo.computeBoundingSphere();
  // Cover the full range of the elastic pull for picking and frustum culling.
  geo.boundingSphere.radius+=4;
  return geo;
}
export function makeEnvironment(renderer){
  const envScene=new THREE.Scene();envScene.background=new THREE.Color('#767083');
  const add=(w,h,color,intensity,x,y,z)=>{const material=new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(intensity),side:THREE.DoubleSide});const plane=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);plane.position.set(x,y,z);plane.lookAt(0,0,0);envScene.add(plane);};
  add(8,6,'#fff0da',5,-6,9,4);
  add(4,9,'#d9f6ff',4,6,5,-3);
  add(14,.8,'#ffffff',7,0,7,5);
  add(4,4,'#f5b6e1',2.5,-9,2,-4);
  add(6,3,'#b6cafa',2,1,2,-8);
  const generator=new THREE.PMREMGenerator(renderer),target=generator.fromScene(envScene,.045,.1,50);
  generator.dispose();envScene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  return target;
}
export function makeLegend(text,width,height,color){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
  const ctx=canvas.getContext('2d');ctx.textAlign='center';ctx.textBaseline='middle';
  // The tiny pale offset reads like a print suspended just inside the jelly.
  const size=text.length>1?58:108;
  ctx.font=`500 ${size}px "Avenir Next", Arial, sans-serif`;
  ctx.fillStyle='rgba(255,255,255,.5)';ctx.fillText(text,256,128);
  ctx.fillStyle=color;ctx.fillText(text,256,125);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  const w=Math.min(width*.9,text.length>2?2.1:.85),d=text.length>2?.33:.43;
  const geometry=new THREE.PlaneGeometry(w,d,10,6);geometry.rotateX(-Math.PI/2);
  const a=geometry.attributes.position.array;
  for(let i=0;i<a.length;i+=3){const dome=Math.max(0,1-(a[i]/(width/2))**4)*Math.max(0,1-(a[i+2]/.48)**4);a[i+1]=height+.10*dome+.003;}
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});
  return {mesh:new THREE.Mesh(geometry,material),base:new Float32Array(a),texture};
}
