// Quiet, procedural gel sounds. No downloads, recordings, or microphone access.
export function createAudio(){
  let context=null,enabled=false,noise=null,lastDown=-1,lastUp=-1;
  function initialize(){
    if(!context){
      const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;
      context=new Audio();noise=context.createBuffer(1,Math.ceil(context.sampleRate*.22),context.sampleRate);
      const samples=noise.getChannelData(0);let brown=0;
      for(let i=0;i<samples.length;i++){brown=(brown+(Math.random()*2-1)*.09)/1.025;samples[i]=brown*2.5;}
    }
    if(context.state==='suspended')context.resume().catch(()=>{});return true;
  }
  return {
    setEnabled(value){enabled=value;if(value)initialize();},
    play(code,phase='down'){
      if(!enabled||!initialize())return;
      const now=context.currentTime,up=phase==='up';
      if(now-(up?lastUp:lastDown)<.02)return;if(up)lastUp=now;else lastDown=now;
      const seed=Array.from(code).reduce((a,c)=>a+c.charCodeAt(0),0),weight=code==='Space'?.74:1;
      const duration=up?.11:.19;
      const output=context.createGain();output.gain.value=.48;output.connect(context.destination);
      const source=context.createBufferSource();source.buffer=noise;
      const filter=context.createBiquadFilter();filter.type='bandpass';filter.Q.value=up?3.5:2;
      filter.frequency.setValueAtTime((up?320:820)+(seed%5)*45,now);
      filter.frequency.exponentialRampToValueAtTime(up?760:115,now+duration*.8);
      const envelope=context.createGain();envelope.gain.setValueAtTime(.001,now);
      envelope.gain.exponentialRampToValueAtTime(up?.023:.075,now+.012);
      envelope.gain.exponentialRampToValueAtTime(.001,now+duration);
      source.connect(filter);filter.connect(envelope);envelope.connect(output);
      source.start(now);source.stop(now+duration+.015);
      const tone=context.createOscillator();tone.type='sine';
      tone.frequency.setValueAtTime((up?340:205+(seed%7)*7)*weight,now);
      tone.frequency.exponentialRampToValueAtTime((up?110:56)*weight,now+duration*.78);
      const gain=context.createGain();gain.gain.setValueAtTime(.001,now);
      gain.gain.exponentialRampToValueAtTime(up?.023:.058,now+.008);
      gain.gain.exponentialRampToValueAtTime(.001,now+duration);
      tone.connect(gain);gain.connect(output);tone.start(now);tone.stop(now+duration+.015);
      source.onended=()=>{source.disconnect();filter.disconnect();envelope.disconnect();};
      tone.onended=()=>{tone.disconnect();gain.disconnect();output.disconnect();};
    }
  };
}
