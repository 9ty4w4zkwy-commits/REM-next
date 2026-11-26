import {button,el} from './ui.js';
import {getSetting,saveSetting} from './progress.js';

const speeds=[.75,1,1.25,1.5,2];
let sleepDeadline=0;

function audioTime(seconds){
 if(!Number.isFinite(seconds))return '–:––';
 const total=Math.max(0,Math.floor(seconds));
 return Math.floor(total/60)+':'+String(total%60).padStart(2,'0');
}

function transcriptView(content){
 const root=el('div',{className:'rem-audio-transcript',attrs:{tabindex:'0','aria-label':'Testo del brano'}});
 const chunks=[...content.matchAll(/\S[^.!?…\n]*(?:[.!?…]+[”»"’]?|(?=\n|$))/gu)];
 const entries=[];
 let cursor=0;
 for(const chunk of chunks){
  root.append(document.createTextNode(content.slice(cursor,chunk.index)));
  const node=el('span',{text:chunk[0]});
  root.append(node);
  cursor=chunk.index+chunk[0].length;
  entries.push({start:chunk.index,node});
 }
 root.append(document.createTextNode(content.slice(cursor)));
 let active=null;
 return {root,follow(offset){
  let low=0,high=entries.length;
  if(Number.isInteger(offset)){
   while(low<high){
    const mid=(low+high)>>1;
    if(entries[mid].start<=offset)low=mid+1;else high=mid;
   }
  }
  const next=entries[low-1]?.node;
  if(active===next)return;
  active?.classList.remove('is-current');
  active=next;
  if(!active)return;
  active.classList.add('is-current');
  const box=root.getBoundingClientRect();
  const line=active.getBoundingClientRect();
  if(line.top<box.top||line.bottom>box.bottom){
   root.scrollTop+=line.top-box.top-root.clientHeight*.25;
  }
 }};
}

export function mountPodcastControls(player,content){
 const audio=player.querySelector('audio[controls]');
 if(!audio)return;
 const transcript=transcriptView(content);
 const feedback=el('p',{className:'rem-audio-feedback',attrs:{role:'status'}});
 const play=button('▶',async()=>{
  if(!audio.paused){audio.pause();return}
  try{await audio.play();feedback.textContent=''}
  catch(error){if(error.name!=='AbortError')feedback.textContent='Impossibile avviare l’audio. Riprova.'}
 });
 play.className='rem-podcast-play';
 const playbackTime=()=>player.playbackTime?.()??audio.currentTime;
 const playbackWindow=()=>player.playbackWindow?.()??[0,audio.duration];
 const jump=time=>{
  const [start,end]=playbackWindow();
  if(!Number.isFinite(end)||audio.readyState<1)return;
  const target=Math.max(start,Math.min(time,end-.1));
  if(player.seekPlayback)player.seekPlayback(target);else audio.currentTime=target;
 };
 const back=button('↶ 15',()=>jump(playbackTime()-15));
 back.setAttribute('aria-label','Indietro di 15 secondi');
 const forward=button('30 ↷',()=>jump(playbackTime()+30));
 forward.setAttribute('aria-label','Avanti di 30 secondi');
 const storedRate=Number(getSetting('audiobook-playback-rate','1'));
 let rate=speeds.includes(storedRate)?storedRate:1;
 const speed=button('',()=>{
  rate=speeds[(speeds.indexOf(rate)+1)%speeds.length];
  saveSetting('audiobook-playback-rate',String(rate));
  setRate();
 });
 function setRate(){
  audio.defaultPlaybackRate=rate;
  audio.playbackRate=rate;
  speed.textContent=rate+'×';
  speed.setAttribute('aria-label','Velocità '+rate+'×. Tocca per cambiarla');
 }
 const sleep=el('select',{className:'rem-podcast-sleep',attrs:{'aria-label':'Timer di spegnimento'}},
  [['','☾'],['15','15 min'],['30','30 min'],['45','45 min'],['60','60 min']].map(([value,text])=>el('option',{text,attrs:{value}})));
 let sleepTimer;
 function scheduleSleep(){
  clearTimeout(sleepTimer);
  const remaining=sleepDeadline-Date.now();
  if(remaining<=0){sleepDeadline=0;sleep.value='';return}
  sleepTimer=setTimeout(()=>{sleepDeadline=0;sleep.value='';audio.pause()},remaining);
 }
 sleep.addEventListener('change',()=>{
  sleepDeadline=Number(sleep.value)?Date.now()+Number(sleep.value)*60000:0;
  scheduleSleep();
 });
 if(sleepDeadline>Date.now())sleep.value=String([15,30,45,60].find(minutes=>minutes*60000>=sleepDeadline-Date.now())??60);
 scheduleSleep();
 const stop=player.stopAudio?.bind(player);
 player.stopAudio=()=>{
  clearTimeout(sleepTimer);
  stop?.();
 };

 const elapsed=el('span');
 const remaining=el('span');
 const seek=el('input',{attrs:{type:'range',min:'0',max:'0',step:'0.1','aria-label':'Posizione nell’audio'}});
 const update=()=>{
  const [start,end]=playbackWindow();
  const ready=audio.readyState>=1&&Number.isFinite(end)&&end>start;
  const position=ready?Math.min(end-start,Math.max(0,playbackTime()-start)):0;
  play.textContent=audio.paused?'▶':'❚❚';
  play.setAttribute('aria-label',audio.paused?'Riproduci':'Pausa');
  play.disabled=!audio.currentSrc&&!audio.getAttribute('src');
  seek.disabled=back.disabled=forward.disabled=!ready;
  seek.max=String(ready?end-start:0);
  seek.value=String(position);
  seek.setAttribute('aria-valuetext',audioTime(position));
  elapsed.textContent=audioTime(position);
  remaining.textContent=ready?'−'+audioTime(end-start-position):'–:––';
  if(ready)transcript.follow(player.readAlongOffset?.());
 };
 seek.addEventListener('input',()=>jump(playbackWindow()[0]+Number(seek.value)));
 for(const event of ['loadstart','loadedmetadata','durationchange','timeupdate','seeked','play','pause','ended','emptied','error']){
  audio.addEventListener(event,update);
 }
 audio.addEventListener('loadedmetadata',setRate);
 setRate();

 const transport=el('div',{className:'rem-podcast-transport'},[speed,back,play,forward,sleep]);
 const controls=el('div',{className:'rem-audio-controls'},[
  transcript.root,seek,el('div',{className:'rem-audio-times'},[elapsed,remaining]),transport,feedback
 ]);
 audio.before(controls);
 audio.controls=false;
 audio.hidden=true;
 const previousNote=player.querySelector(':scope > .format-mode-note:last-child');
 if(previousNote?.textContent==='Narrazione audio generata con intelligenza artificiale.')previousNote.remove();
 player.append(el('p',{className:'format-mode-note',text:'Audio sincronizzato e generato con AI.'}));
 update();
}
