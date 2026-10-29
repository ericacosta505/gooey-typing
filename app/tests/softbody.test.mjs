import test from 'node:test';
import assert from 'node:assert/strict';
import {spring,channel,deformPoint,waveAt} from '../dist/softbody.js';
const shape={halfWidth:.43,halfDepth:.47,height:.97};
const rest={squash:0,dragX:0,dragZ:0,pullY:0,swayX:0,swayZ:0,twist:0,gripX:0,gripZ:0,wave:0};
test('unforced jelly retains its exact resting shape',()=>{
  for(const p of [[.2,.9,.1],[-.43,.4,.47],[0,0,0]])assert.deepEqual(deformPoint(...p,shape,rest,[]),p);
});
test('pressing dents the crown and swells the belly',()=>{
  const m={...rest,squash:.82};
  const crown=deformPoint(0,.97,0,shape,m,[]),belly=deformPoint(.43,.485,0,shape,m,[]);
  assert.ok(crown[1]<.3,'crown visibly compresses');assert.ok(belly[0]>.55,'belly expands');
});
test('drag and torsion preserve the anchored base',()=>{
  const m={...rest,dragX:2.1,dragZ:.8,pullY:2.8,twist:.4,wave:.2};
  assert.deepEqual(deformPoint(.43,0,.47,shape,m,[]),[.43,0,.47]);
  const crown=deformPoint(0,.97,0,shape,m,[]);assert.ok(crown[1]>3);assert.equal(crown[0],2.1);
});
test('extreme presses and pulls stay finite and above the bed',()=>{
  for(const squash of [-.45,.92])for(const pullY of [-.08,2.8])for(let i=0;i<20;i++){
    const y=i/19*.97,m={...rest,squash,pullY,dragX:2.1,dragZ:-.65,twist:.6,wave:-.2};
    const p=deformPoint(.43,y,.47,shape,m,[]);assert.ok(p.every(Number.isFinite));assert.ok(p[1]>=0);
  }
});
test('spring recovers from a large pull at 30, 60 and 120 fps',()=>{
  for(const fps of [30,60,120]){const s=channel(2.8);s.velocity=4;for(let i=0;i<fps*6*2;i++)spring(s,0,1/fps/2,85,5.5);assert.ok(Math.abs(s.value)<.0001);assert.ok(Math.abs(s.velocity)<.0001);}
});
test('wave propagation is causal, bounded and expires',()=>{
  assert.equal(waveAt(4,.1),0);assert.notEqual(waveAt(4,.6),0);assert.equal(waveAt(8,1),0);assert.equal(waveAt(1,3),0);
  for(let t=0;t<3;t+=.02)assert.ok(Math.abs(waveAt(1,t))<=1);
});
