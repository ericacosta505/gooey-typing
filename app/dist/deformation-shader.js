import * as THREE from 'three';
const bodyFunction=`
uniform vec3 gooShape;
uniform float gooSquash;
uniform vec3 gooDrag;
uniform vec3 gooSway;
uniform vec2 gooGrip;
uniform float gooWave;
vec3 gooDeform(vec3 p){
  float t=clamp(p.y/gooShape.y,0.,1.2);
  vec2 uv=p.xz/gooShape.xz;
  float belly=sin(min(t,1.)*3.14159265);
  float swell=1.+gooSquash*(.13+.37*belly);
  vec2 gripDelta=uv-gooGrip;
  vec2 dentDelta=uv-gooGrip*.55;
  float grip=exp(-dot(gripDelta,gripDelta)*1.5);
  float dent=exp(-dot(dentDelta,dentDelta)*3.8);
  float upper=t*t;
  float twist=gooSway.z*upper;
  vec2 b=p.xz*swell;
  vec2 rotated=mat2(cos(twist),sin(twist),-sin(twist),cos(twist))*b;
  vec3 q;
  q.x=rotated.x+(gooDrag.x+gooSway.x)*upper;
  q.z=rotated.y+(gooDrag.z+gooSway.y)*upper;
  q.y=max(p.y*.07,p.y*(1.-gooSquash*.57)-.32*gooSquash*dent*upper+gooDrag.y*pow(t,1.65)*(.45+.55*grip)+gooWave*upper);
  return q;
}`;
function inject(material,uniforms,code,normal=true,cacheKey='goo-body-v1'){
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=code+'\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed = gooDeform(position);');
    if(normal)shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
      vec3 axis=abs(normal.x)>.8?vec3(0.,1.,0.):vec3(1.,0.,0.);
      vec3 tangent=normalize(cross(axis,normal));
      vec3 bitangent=normalize(cross(normal,tangent));
      vec3 at=gooDeform(position);
      objectNormal=normalize(cross(gooDeform(position+tangent*.003)-at,gooDeform(position+bitangent*.003)-at));`);
  };
  material.customProgramCacheKey=()=>cacheKey+(normal?'-n':'-p');
}
export function attachJellyShader(body,legend,shape){
  const uniforms={gooShape:{value:new THREE.Vector3(shape.halfWidth,shape.height,shape.halfDepth)},gooSquash:{value:0},gooDrag:{value:new THREE.Vector3()},gooSway:{value:new THREE.Vector3()},gooGrip:{value:new THREE.Vector2()},gooWave:{value:0}};
  inject(body,uniforms,bodyFunction,true);inject(legend,uniforms,bodyFunction,false);
  return motion=>{uniforms.gooSquash.value=motion.squash;uniforms.gooDrag.value.set(motion.dragX,motion.pullY,motion.dragZ);uniforms.gooSway.value.set(motion.swayX,motion.swayZ,motion.twist);uniforms.gooGrip.value.set(motion.gripX,motion.gripZ);uniforms.gooWave.value=motion.wave;};
}
export function attachBedShader(material){
  const uniforms={gooTime:{value:0},gooImpacts:{value:Array.from({length:12},()=>new THREE.Vector4(0,0,-100,0))}};
  const code=`uniform float gooTime;uniform vec4 gooImpacts[12];
  vec3 gooDeform(vec3 p){vec3 q=p;float delta=0.;for(int i=0;i<12;i++){vec4 w=gooImpacts[i];float age=gooTime-w.z;if(w.w<=0.||age<0.||age>2.6)continue;float d=length((p.xz-w.xy)*vec2(1.,1.1));float delayed=age-d/8.5;if(delayed>=0.&&delayed<1.5&&d<7.)delta+=sin(delayed*17.)*exp(-delayed*3.9-d*.34)*w.w*.12;}q.y+=delta*min(1.,p.y/.4);return q;}`;
  inject(material,uniforms,code,true,'goo-bed-v1');
  return(time,waves,reduced)=>{uniforms.gooTime.value=time;for(let i=0;i<12;i++){const w=reduced?null:waves[waves.length-1-i];uniforms.gooImpacts.value[i].set(w?.x??0,w?.z??0,w?.time??-100,w?.strength??0);}};
}
