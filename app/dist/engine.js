const WORDS = `soft little warm light morning cloud gentle quiet happy slow peach bloom honey dream open world river ocean meadow summer golden sweet wander breeze cotton garden petal velvet ripple mist shimmer cozy pillow lavender candle sunlight comfort silver moon earth water wonder heart home window music smile blue pink green amber coral cream pearl sugar glow tiny calm mellow still rain fresh leaf drift float flow play squeeze plush smooth touch rest easy kind together never always over under through around every where while after before again some many other just with this that from have will your there when into time make good know take feel keep give find day way new love think look come work well even want back much first only small round space rhythm dance story begin happy fingers typing spring leaves birds waves sky forest stone beach warm bright clear shine nest lake rose mint lovely tender butter breathe` .split(/\s+/);
const OPENING='slow mornings and warm light little moments of quiet joy let your fingers wander across a softer world find a gentle rhythm and make yourself at home'.split(' ');
export function generatePassage(count=300,punctuation=false,opening=false,random=Math.random){
  const words=[];
  for(let i=0;i<count;i++){
    let word=opening && i<OPENING.length?OPENING[i]:WORDS[Math.floor(random()*WORDS.length)];
    if(word===words.at(-1))word=WORDS[(WORDS.indexOf(word)+7)%WORDS.length];
    if(punctuation){if(i%9===0)word=word[0].toUpperCase()+word.slice(1);if(i%9===8||i===count-1)word+='.';else if(i%9===4)word+=',';}
    words.push(word);
  }
  return words.join(' ');
}
export class TypingSession {
  constructor({mode='time',length=30,prompt='',punctuation=false}={}){
    this.mode=mode;this.length=length;this.prompt=prompt;this.punctuation=punctuation;
    this.status='idle';this.value='';this.startedAt=null;this.finishedAt=null;this.attempts=0;this.correctAttempts=0;this.samples=[];
  }
  elapsed(now=Date.now()){
    if(this.startedAt===null)return 0;
    const seconds=Math.max(0,((this.finishedAt??now)-this.startedAt)/1000);
    return this.mode==='time'?Math.min(this.length,seconds):seconds;
  }
  expired(now=Date.now()){return this.mode==='time'&&this.startedAt!==null&&now>=this.startedAt+this.length*1000;}
  commit(next,now=Date.now(),edit=null){
    if(this.status==='finished')return false;
    if(this.expired(now)){this.finish(now);return false;}
    if(this.mode==='words')next=next.slice(0,this.prompt.length);
    const explicit=edit&&Number.isInteger(edit.start)&&Number.isInteger(edit.end)&&edit.start>=0&&edit.end>=edit.start&&edit.end<=this.value.length&&typeof edit.text==='string'&&(this.value.slice(0,edit.start)+edit.text+this.value.slice(edit.end))===next;
    if(next===this.value&&!(explicit&&edit.text.length))return false;
    if(this.status==='idle'&&next.length===0)return false;
    if(this.status==='idle'){this.status='running';this.startedAt=now;}
    const old=this.value;let prefix=0,suffix=0;
    while(prefix<old.length&&prefix<next.length&&old[prefix]===next[prefix])prefix++;
    while(suffix<old.length-prefix&&suffix<next.length-prefix&&old[old.length-1-suffix]===next[next.length-1-suffix])suffix++;
    const added=explicit?edit.text:next.slice(prefix,next.length-suffix);
    const insertionStart=explicit?edit.start:prefix;
    this.attempts+=added.length;
    for(let i=0;i<added.length;i++)if(this.mode==='zen'||added[i]===this.prompt[insertionStart+i])this.correctAttempts++;
    this.value=next;
    if(this.mode==='words'&&next.length===this.prompt.length)this.finish(now);
    return true;
  }
  stats(now=Date.now()){
    const elapsed=this.elapsed(now);let correct=0;
    if(this.mode==='zen')correct=this.value.length;
    else for(let i=0;i<this.value.length;i++)if(this.value[i]===this.prompt[i])correct++;
    return {elapsed,correct,incorrect:this.value.length-correct,characters:this.value.length,attempts:this.attempts,wpm:elapsed>0?Math.round(correct/5/(Math.max(elapsed,.1)/60)):0,rawWpm:elapsed>0?Math.round(this.value.length/5/(Math.max(elapsed,.1)/60)):0,accuracy:this.mode==='zen'||!this.attempts?null:Math.round(this.correctAttempts/this.attempts*100),words:this.value.trim()?this.value.trim().split(/\s+/).length:0};
  }
  tick(now=Date.now()){
    if(this.status!=='running')return;
    if(this.expired(now))this.finish(now);
    const stats=this.stats(now),second=Math.floor(stats.elapsed);
    if(second>0&&second!==(this.samples.at(-1)?.second??-1))this.samples.push({second,wpm:stats.wpm});
  }
  finish(now=Date.now()){
    if(this.status!=='running')return false;
    this.finishedAt=this.mode==='time'?Math.min(now,this.startedAt+this.length*1000):now;
    this.status='finished';return true;
  }
}
