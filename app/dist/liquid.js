import * as THREE from 'three';
import { pillowGeometry } from './geometry.js';
import { attachBedShader } from './deformation-shader.js';
export function createLiquidBed(board){
  const geometry=pillowGeometry(15.65,.56,5.95,24,.025),rest=new Float32Array(geometry.attributes.position.array);
  const colors=[];
  const left=new THREE.Color('#ebb8d6'),middle=new THREE.Color('#aedbd2'),right=new THREE.Color('#b5b9e9'),c=new THREE.Color();
  for(let i=0;i<rest.length;i+=3){const u=(rest[i]+8)/16;c.copy(u<.5?left:middle).lerp(u<.5?middle:right,u<.5?u*2:(u-.5)*2);colors.push(c.r,c.g,c.b);}
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const material=new THREE.MeshPhysicalMaterial({vertexColors:true,color:0xffffff,metalness:0,roughness:.2,transmission:.55,thickness:1.25,ior:1.4,clearcoat:1,clearcoatRoughness:.09,iridescence:.45,iridescenceIOR:1.3,iridescenceThicknessRange:[170,380],envMapIntensity:1.1});
  const mesh=new THREE.Mesh(geometry,material);mesh.position.y=-.51;mesh.castShadow=true;mesh.receiveShadow=true;board.add(mesh);
  const underside=new THREE.Mesh(pillowGeometry(15.2,.12,5.5,10,.015),new THREE.MeshStandardMaterial({color:'#d6c6e5',roughness:.55,metalness:.12}));underside.position.y=-.43;board.add(underside);
  const update=attachBedShader(material);
  return {update};
}
export function createCaustics(scene){
  const uniforms={time:{value:0},impacts:{value:Array.from({length:12},()=>new THREE.Vector4(0,0,-100,0))}};
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms,
    vertexShader:`varying vec2 pos; void main(){pos=uv*vec2(30.,20.)-vec2(15.,10.);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 pos;uniform float time;uniform vec4 impacts[12];void main(){
      float glow=0.;vec3 color=vec3(0.);for(int i=0;i<12;i++){vec4 w=impacts[i];float age=time-w.z;if(w.w<=0.||age<0.||age>2.6)continue;float d=length(pos-w.xy);float ring=exp(-pow((d-age*3.6)*3.3,2.))*exp(-age*1.4)*w.w;float core=exp(-d*d*.45)*exp(-age*3.)*w.w;float hue=w.x*.08+w.y*.17;vec3 tint=.5+.5*cos(vec3(0.,2.,4.)+hue*3.);color+=(tint*.65+.35)*(ring*.3+core*.18);glow+=ring*.2+core*.12;}
      gl_FragColor=vec4(color,clamp(glow,0.,.38));}`
  });
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(30,20),material);mesh.rotation.x=-Math.PI/2;mesh.position.y=-.895;scene.add(mesh);
  return {update(t,waves){mesh.visible=waves.length>0;uniforms.time.value=t;for(let i=0;i<12;i++){const w=waves[waves.length-1-i];uniforms.impacts.value[i].set(w?.x??0,w?.z??0,w?.time??-100,w?.strength??0);}}};
}
// Endpoints are in board-local space. Put them just inside the keys to hide each join.
export function createGooStrands(board){
  const lengthSegments=20,radialSegments=12,ringVertices=(lengthSegments+1)*radialSegments;
  const indices=[],cosines=new Float32Array(radialSegments),sines=new Float32Array(radialSegments);
  for(let j=0;j<radialSegments;j++){
    const angle=j/radialSegments*Math.PI*2;cosines[j]=Math.cos(angle);sines[j]=Math.sin(angle);
    for(let i=0;i<lengthSegments;i++){
      const a=i*radialSegments+j,b=(i+1)*radialSegments+j,d=i*radialSegments+(j+1)%radialSegments,c=(i+1)*radialSegments+(j+1)%radialSegments;
      indices.push(a,d,b,d,c,b);
    }
    indices.push(ringVertices,(j+1)%radialSegments,j);
    indices.push(ringVertices+1,lengthSegments*radialSegments+j,lengthSegments*radialSegments+(j+1)%radialSegments);
  }
  const strands=Array.from({length:4},()=>{
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array((ringVertices+2)*3),3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('normal',new THREE.BufferAttribute(new Float32Array((ringVertices+2)*3),3).setUsage(THREE.DynamicDrawUsage));
    geometry.setIndex(indices);
    const material=new THREE.MeshPhysicalMaterial({color:'#e7b8d5',metalness:0,roughness:.105,transmission:.8,thickness:.18,ior:1.36,clearcoat:1,clearcoatRoughness:.055,attenuationColor:'#e7b8d5',attenuationDistance:1.6,envMapIntensity:1.1});
    const mesh=new THREE.Mesh(geometry,material);mesh.visible=false;mesh.frustumCulled=false;board.add(mesh);
    return mesh;
  });
  return {update(links){
    for(let strandIndex=0;strandIndex<strands.length;strandIndex++){
      const mesh=strands[strandIndex],link=links[strandIndex];
      const strength=link?Math.min(1,Math.max(0,link.strength)):0;
      if(!(strength>.002)){mesh.visible=false;continue;}
      const from=link.from,to=link.to,dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z,length=Math.hypot(dx,dy,dz);
      if(!Number.isFinite(length)||length<.025){mesh.visible=false;continue;}
      mesh.visible=true;mesh.material.color.copy(link.color);mesh.material.attenuationColor.copy(link.color);
      const fade=Math.sqrt(strength),horizontal=Math.hypot(dx,dz),sag=Math.min(.18,length*.09)*(horizontal/length);
      const nx=horizontal>.00001?dz/horizontal:1,nz=horizontal>.00001?-dx/horizontal:0;
      const neck=.019/Math.sqrt(1+length*.65),startRadius=.105,endRadius=.083;
      mesh.material.thickness=Math.max(.012,startRadius*2*fade);
      const geometry=mesh.geometry,a=geometry.attributes.position.array;
      for(let i=0;i<=lengthSegments;i++){
        const t=i/lengthSegments,cx=from.x+dx*t,cy=from.y+dy*t-sag*4*t*(1-t),cz=from.z+dz*t;
        const tangentY=dy-sag*4*(1-2*t),tangentLength=Math.hypot(dx,tangentY,dz);
        // The horizontal normal stays stable as the centreline sags, avoiding tube twists.
        const tx=dx/tangentLength,ty=tangentY/tangentLength,tz=dz/tangentLength;
        const bx=ty*nz,by=tz*nx-tx*nz,bz=-ty*nx;
        const radius=fade*(neck+(startRadius-neck)*Math.exp(-t*11)+(endRadius-neck)*Math.exp(-(1-t)*11));
        for(let j=0;j<radialSegments;j++){
          const offset=(i*radialSegments+j)*3,c=cosines[j]*radius,s=sines[j]*radius;
          a[offset]=cx+nx*c+bx*s;a[offset+1]=cy+by*s;a[offset+2]=cz+nz*c+bz*s;
        }
      }
      const start=ringVertices*3,end=(ringVertices+1)*3;
      a[start]=from.x;a[start+1]=from.y;a[start+2]=from.z;a[end]=to.x;a[end+1]=to.y;a[end+2]=to.z;
      geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();
    }
  }};
}
export function createDroplets(board){
  const count=36,geometry=new THREE.SphereGeometry(1,12,8),material=new THREE.MeshPhysicalMaterial({color:'#f1d8ed',transmission:.72,roughness:.07,thickness:.35,ior:1.33,clearcoat:1,iridescence:.65,iridescenceIOR:1.3,envMapIntensity:1.1});
  const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;board.add(mesh);
  const dummy=new THREE.Object3D(),drops=Array.from({length:count},()=>({life:0}));let next=0;
  for(let i=0;i<count;i++){dummy.scale.setScalar(0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}
  return {
    emit(x,z,amount=2){for(let i=0;i<amount;i++){const d=drops[next++%count];Object.assign(d,{x:x+(Math.random()-.5)*.55,y:.65,z:z+(Math.random()-.5)*.5,vx:(Math.random()-.5)*.9,vy:1.3+Math.random()*.9,vz:(Math.random()-.5)*.6,size:.045+Math.random()*.06,life:1.05});}},
    update(dt){let active=false;for(let i=0;i<count;i++){const d=drops[i];if(d.life>0){active=true;d.life-=dt;d.vy-=3.3*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;d.z+=d.vz*dt;const life=Math.min(1,d.life*4);dummy.position.set(d.x,d.y,d.z);dummy.scale.set(d.size*life*(1+.25*Math.sin(d.life*13)),d.size*life*(1+Math.abs(d.vy)*.15),d.size*life);}else{dummy.scale.setScalar(0);}dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}mesh.instanceMatrix.needsUpdate=true;return active;}
  };
}
