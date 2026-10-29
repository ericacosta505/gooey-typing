// Stable, allocation-free shape functions shared by the body and its printed legend.
export function spring(state,target,dt,stiffness=130,damping=8){
  state.velocity+=((target-state.value)*stiffness-state.velocity*damping)*dt;
  state.value+=state.velocity*dt;
  return state.value;
}
export const channel=(value=0)=>({value,velocity:0});
export const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
export function deformPoint(x,y,z,shape,motion,out){
  const t=clamp(y/shape.height,0,1.2),u=x/shape.halfWidth,v=z/shape.halfDepth;
  const s=motion.squash;
  const belly=Math.sin(Math.min(t,1)*Math.PI);
  const swell=1+s*(.13+.37*belly);
  const grip=Math.exp(-((u-motion.gripX)**2+(v-motion.gripZ)**2)*1.5);
  const dent=Math.exp(-((u-motion.gripX*.55)**2+(v-motion.gripZ*.55)**2)*3.8);
  const upper=t*t;
  const twist=motion.twist*upper,cs=Math.cos(twist),sn=Math.sin(twist);
  const bx=x*swell,bz=z*swell;
  out[0]=bx*cs-bz*sn+(motion.dragX+motion.swayX)*upper;
  out[2]=bx*sn+bz*cs+(motion.dragZ+motion.swayZ)*upper;
  out[1]=y*(1-s*.57)-.32*s*dent*upper+motion.pullY*Math.pow(t,1.65)*(.45+.55*grip)+motion.wave*upper;
  out[1]=Math.max(y*.07,out[1]);
  // A crown can stretch high, but the bottom remains welded to the liquid bed.
  return out;
}
export function waveAt(distance,age,strength=1){
  const delayed=age-distance/8.5;
  if(delayed<0||delayed>1.5||distance>7)return 0;
  return Math.sin(delayed*17)*Math.exp(-delayed*3.9-distance*.34)*strength;
}
