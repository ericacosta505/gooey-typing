import {createKeyboard} from './keyboard.js';
import {TypingSession,generatePassage} from './engine.js';
import {createAudio} from './audio.js';
const $=id=>document.getElementById(id),input=$('typing-input'),passage=$('passage'),area=$('typing-area');
const opening='let your thoughts turn into liquid and your fingertips follow the flow somewhere between a cloud and a daydream everything feels a little softer';
let phase='ready',session,chars=[],composing=false,pendingEdit=null,compositionEdit=null;
const audio=createAudio();
const keyboard=createKeyboard($('keyboard'),{onSound:(code,type)=>{audio.setEnabled(true);audio.play(code,type);},onPress:virtualPress,onReady:()=>document.body.classList.add('loaded')});
function newSession(){session=new TypingSession({mode:'flow',prompt:opening+' '+generatePassage(400)});input.value='';input.disabled=false;pendingEdit=null;compositionEdit=null;composing=false;buildPassage();}
function buildPassage(){chars=Array.from(session.prompt,c=>{const span=document.createElement('span');span.className='char';span.textContent=c;return span;});passage.replaceChildren(...chars);$('accessible-passage').textContent='Passage: '+session.prompt;render();}
function render(){const caret=input.selectionStart,end=input.selectionEnd;for(let i=0;i<chars.length;i++){const cls='char'+(i<session.value.length?(session.value[i]===session.prompt[i]?' correct':' wrong'):'')+(i===caret?' current':'')+(i>=caret&&i<end?' selected':'');if(chars[i].className!==cls)chars[i].className=cls;}const current=chars[Math.min(caret,chars.length-1)];if(current){const line=parseFloat(getComputedStyle(passage).lineHeight);passage.style.transform=`translateY(-${Math.max(0,Math.floor(current.offsetTop/line)*line)}px)`;}}
function focus(){if(!input.disabled)input.focus({preventScroll:true});}
function start(reset=true){if(phase==='active')return;if(reset)newSession();phase='active';document.body.classList.remove('is-stopped');document.body.classList.add('is-active');$('start').disabled=true;$('stop').disabled=false;$('result').replaceChildren();$('announcement').textContent='Typing started. Press Stop to finish.';audio.setEnabled(true);keyboard.setActive(true);if(matchMedia('(pointer:fine)').matches)focus();}
function stop(){if(phase!=='active')return;if(composing){
  input.blur();
  // Some input methods end composition asynchronously on blur. Commit the
  // visible draft now so stopping cannot discard it or accept a later edit.
  if(composing){const edit=compositionEdit;if(edit){const suffixLength=session.value.length-edit.end;pendingEdit={...edit,text:input.value.slice(edit.start,input.value.length-suffixLength)};}composing=false;compositionEdit=null;}
}commit();session.finish();phase='stopped';input.disabled=true;keyboard.setActive(false);keyboard.clear();document.body.classList.remove('is-active');document.body.classList.add('is-stopped');$('start').disabled=false;$('stop').disabled=true;const s=session.stats();$('result').replaceChildren();if(s.attempts){const speed=document.createElement('strong');speed.textContent=s.wpm+' wpm';const stats=document.createTextNode('  ·  '+s.accuracy+'% accuracy  ·  '+formatTime(s.elapsed));$('result').append(speed,stats);$('announcement').textContent=`Finished. ${s.wpm} words per minute. ${s.accuracy} percent accuracy.`;}else{$('announcement').textContent='Stopped. Press Start whenever you are ready.';}}
function formatTime(seconds){const s=Math.floor(seconds);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}
function commit(){if(composing||phase==='stopped')return;if(phase==='ready'&&input.value)start(false);session.commit(input.value,Date.now(),pendingEdit);pendingEdit=null;if(input.value!==session.value)input.value=session.value;if(session.prompt.length-session.value.length<100){session.prompt+=' '+generatePassage(300);buildPassage();}render();}
$('start').addEventListener('click',()=>start());$('stop').addEventListener('click',stop);
input.addEventListener('input',e=>{if(!e.isComposing)commit();});
input.addEventListener('beforeinput',e=>{pendingEdit=null;if(phase==='stopped'){e.preventDefault();return;}if(['insertFromPaste','insertFromDrop','insertReplacementText','historyUndo','historyRedo'].includes(e.inputType)){e.preventDefault();$('announcement').textContent='Type the passage with your keyboard.';return;}if(!composing&&e.inputType?.startsWith('insert')&&typeof e.data==='string')pendingEdit={start:input.selectionStart,end:input.selectionEnd,text:e.data};});
input.addEventListener('paste',e=>e.preventDefault());input.addEventListener('drop',e=>e.preventDefault());
input.addEventListener('compositionstart',()=>{composing=true;compositionEdit={start:input.selectionStart,end:input.selectionEnd};});
input.addEventListener('compositionend',e=>{if(phase==='stopped'){composing=false;compositionEdit=null;pendingEdit=null;input.value=session.value;return;}composing=false;pendingEdit=compositionEdit?{...compositionEdit,text:e.data}:null;compositionEdit=null;commit();});
input.addEventListener('select',()=>{if(!composing)render();});input.addEventListener('keyup',()=>{if(!composing)render();});area.addEventListener('click',focus);
window.addEventListener('keydown',e=>{
  if(e.isComposing||composing)return;
  if(e.code==='Tab'||e.metaKey||e.ctrlKey||e.altKey)return;
  const target=e.target;
  if(target instanceof HTMLButtonElement)return;
  if(e.code==='Escape'){e.preventDefault();stop();return;}
  if(!e.repeat){audio.setEnabled(true);keyboard.press(e.code);}
  if(e.key==='Enter'&&target===input)e.preventDefault();
  if(phase!=='stopped'&&target===document.body&&e.key.length===1)focus();
});
window.addEventListener('keyup',e=>keyboard.release(e.code));
function virtualPress(value,code){
  if(phase!=='active')return;
  if(code==='Escape'){stop();return;}
  if(['Enter','Tab','CapsLock','ShiftLeft','ShiftRight','ControlLeft','AltLeft','AltRight','MetaLeft','MetaRight','ArrowLeft','ArrowRight'].includes(code))return;
  if(matchMedia('(pointer:fine)').matches)focus();const start=input.selectionStart,end=input.selectionEnd;
  pendingEdit=code==='Backspace'?null:{start,end,text:value};
  if(code==='Backspace'){if(start!==end)input.setRangeText('',start,end,'end');else if(start)input.setRangeText('',start-1,start,'end');}else input.setRangeText(value,start,end,'end');commit();
}
window.addEventListener('resize',render);newSession();if(matchMedia('(pointer:fine)').matches)focus();
const context=document.modelContext;
if(context?.registerTool){const lifecycle=new AbortController();const register=tool=>{try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
register({name:'get_keyboard_session',title:'Read the typing session',description:'Read the current session state, speed and accuracy without changing it.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>({phase,...session.stats()})});
register({name:'start_typing_session',title:'Start typing',description:'Start a fresh typing session using the same Start button action. Does not type any text.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:()=>{start();return{phase};}});
register({name:'stop_typing_session',title:'Stop typing',description:'Stop the current session and show its real results, using the same Stop button action.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:()=>{stop();return{phase,...session.stats()};}});
window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
