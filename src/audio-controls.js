import {button,el} from './ui.js';
import {getSetting,saveSetting} from './progress.js';

const speeds=[.75,1,1.25,1.5,2];
let sleepDeadline=0;

function audioTime(seconds){
 if(!Number.isFinite(seconds))return '–:––';
 const total=Math.max(0,Math.floor(seconds));
 return Math.floor(total/60)+':'+String(total%60).padStart(2,'0');
}

const iconPaths={
 play:'M7 4.5a1 1 0 0 1 1.5-.9l13 7.5a1 1 0 0 1 0 1.8l-13 7.5a1 1 0 0 1-1.5-.9Z',
 pause:'M5 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm10 0h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z',
 moon:'M12 2.8a9.3 9.3 0 1 0 9.2 11.6A7.4 7.4 0 0 1 12 2.8Z',
 rewind:'M9 2 6 5l3 3 M6 5a8.6 8.6 0 1 1-2.6 6.1',
 forward:'M15 2l3 3-3 3 M18 5a8.6 8.6 0 1 0 2.6 6.1'
};

function transportIcon(name){
 const ns='http://www.w3.org/2000/svg';
 const svg=document.createElementNS(ns,'svg');
 svg.setAttribute('viewBox','0 0 24 24');
 svg.setAttribute('aria-hidden','true');
 svg.setAttribute('focusable','false');
 const path=document.createElementNS(ns,'path');
 path.setAttribute('d',iconPaths[name]);
 if(name==='rewind'||name==='forward'){
  path.setAttribute('fill','none');
  path.setAttribute('stroke','currentColor');
  path.setAttribute('stroke-width','1.75');
  path.setAttribute('stroke-linecap','round');
  path.setAttribute('stroke-linejoin','round');
  const label=document.createElementNS(ns,'text');
  label.setAttribute('x','12');
  label.setAttribute('y','13');
  label.setAttribute('dominant-baseline','central');
  label.setAttribute('text-anchor','middle');
  label.setAttribute('fill','currentColor');
  label.textContent=name==='rewind'?'15':'30';
  svg.append(path,label);
 }else{
  path.setAttribute('fill','currentColor');
  svg.append(path);
 }
 return svg;
}

function transcriptView(content){
 const root=el('div',{className:'rem-audio-transcript',attrs:{tabindex:'0','aria-label':'Testo del brano'}});
 const entries=[];
 const fragment=document.createDocumentFragment();
 let cursor=0;
 for(const word of content.matchAll(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:[’'][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*/gu)){
  fragment.append(document.createTextNode(content.slice(cursor,word.index)));
  const node=el('span',{text:word[0]});
  fragment.append(node);
  cursor=word.index+word[0].length;
  entries.push({start:word.index,end:cursor,node});
 }
 fragment.append(document.createTextNode(content.slice(cursor)));
 root.append(fragment);
 let active=null;
 return {root,follow(offset,reveal=false){
  let low=0,high=entries.length;
  if(Number.isInteger(offset)){
   while(low<high){
    const mid=(low+high)>>1;
    if(entries[mid].start<=offset)low=mid+1;else high=mid;
   }
  }
  const entry=entries[low-1];
  const next=entry&&offset<entry.end?entry.node:null;
  if(active===next&&!reveal)return;
  if(active!==next){
   active?.classList.remove('is-current');
   active=next;
   active?.classList.add('is-current');
  }
  if(!active)return;
  const box=root.getBoundingClientRect();
  const line=active.getBoundingClientRect();
  const relativeTop=line.top-box.top;
  if(relativeTop<0||line.bottom-box.top>root.clientHeight*.72){
   root.scrollTop+=relativeTop-root.clientHeight*.28;
  }
 }};
}

export function mountPodcastControls(player,content){
 const audio=player.querySelector('audio[controls]');
 if(!audio)return;
 const transcript=transcriptView(content);
 const feedback=el('p',{className:'rem-audio-feedback',attrs:{role:'status'}});
 const play=button('',async()=>{
  if(!audio.paused){audio.pause();return}
  try{await audio.play();feedback.textContent=''}
  catch(error){if(error.name!=='AbortError')feedback.textContent='Impossibile avviare l’audio. Riprova.'}
 });
 play.className='rem-podcast-play';
 const playIcon=transportIcon('play');
 const pauseIcon=transportIcon('pause');
 play.append(playIcon);
 const playbackTime=()=>player.playbackTime?.()??audio.currentTime;
 const playbackWindow=()=>player.playbackWindow?.()??[0,audio.duration];
 const jump=time=>{
  const [start,end]=playbackWindow();
  if(!Number.isFinite(end)||audio.readyState<1)return;
  const target=Math.max(start,Math.min(time,end-.1));
  if(player.seekPlayback)player.seekPlayback(target);else audio.currentTime=target;
 };
 const back=button('',()=>jump(playbackTime()-15));
 back.className='rem-podcast-skip';
 back.append(transportIcon('rewind'));
 back.setAttribute('aria-label','Indietro di 15 secondi');
 const forward=button('',()=>jump(playbackTime()+30));
 forward.className='rem-podcast-skip';
 forward.append(transportIcon('forward'));
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
 speed.className='rem-podcast-speed';
 const sleep=el('select',{className:'rem-podcast-sleep',attrs:{'aria-label':'Timer di spegnimento'}},
  [['','Disattivato'],['15','15 min'],['30','30 min'],['45','45 min'],['60','60 min']].map(([value,text])=>el('option',{text,attrs:{value}})));
 const sleepControl=el('div',{className:'rem-podcast-timer'},[transportIcon('moon'),sleep]);
 let sleepTimer;
 function showSleepState(){sleepControl.classList.toggle('is-active',Boolean(sleep.value))}
 function scheduleSleep(){
  clearTimeout(sleepTimer);
  const remaining=sleepDeadline-Date.now();
  if(remaining<=0){sleepDeadline=0;sleep.value='';showSleepState();return}
  sleepTimer=setTimeout(()=>{sleepDeadline=0;sleep.value='';showSleepState();audio.pause()},remaining);
 }
 sleep.addEventListener('change',()=>{
  sleepDeadline=Number(sleep.value)?Date.now()+Number(sleep.value)*60000:0;
  showSleepState();
  scheduleSleep();
 });
 if(sleepDeadline>Date.now())sleep.value=String([15,30,45,60].find(minutes=>minutes*60000>=sleepDeadline-Date.now())??60);
 showSleepState();
 scheduleSleep();
 let frame=null;
 const stop=player.stopAudio?.bind(player);
 player.stopAudio=()=>{
  clearTimeout(sleepTimer);
  stopFollowing();
  stop?.();
 };

 const elapsed=el('span');
 const remaining=el('span');
 const seek=el('input',{attrs:{type:'range',min:'0',max:'0',step:'0.1','aria-label':'Posizione nell’audio'}});
 const update=()=>{
  const [start,end]=playbackWindow();
  const ready=audio.readyState>=1&&Number.isFinite(end)&&end>start;
  const position=ready?Math.min(end-start,Math.max(0,playbackTime()-start)):0;
  const icon=audio.paused?playIcon:pauseIcon;
  if(play.firstChild!==icon)play.replaceChildren(icon);
  play.setAttribute('aria-label',audio.paused?'Riproduci':'Pausa');
  play.disabled=!audio.currentSrc&&!audio.getAttribute('src');
  seek.disabled=back.disabled=forward.disabled=!ready;
  seek.max=String(ready?end-start:0);
  seek.value=String(position);
  seek.setAttribute('aria-valuetext',audioTime(position));
  elapsed.textContent=audioTime(position);
  remaining.textContent=ready?'−'+audioTime(end-start-position):'–:––';
  if(ready)followText();
 };
 function followText(reveal=false){
  transcript.follow(player.readAlongOffset?.(),reveal);
 }
 function followPlayback(){
  frame=null;
  if(audio.paused||!player.isConnected)return;
  if(!audio.seeking&&audio.readyState>=2)followText();
  frame=requestAnimationFrame(followPlayback);
 }
 function startFollowing(){
  if(frame===null)frame=requestAnimationFrame(followPlayback);
 }
 function stopFollowing(){
  if(frame!==null)cancelAnimationFrame(frame);
  frame=null;
 }
 audio.addEventListener('playing',startFollowing);
 for(const event of ['pause','ended','emptied','error'])audio.addEventListener(event,stopFollowing);
 audio.addEventListener('seeked',()=>followText(true));
 seek.addEventListener('input',()=>jump(playbackWindow()[0]+Number(seek.value)));
 for(const event of ['loadstart','loadedmetadata','durationchange','timeupdate','seeked','play','pause','ended','emptied','error']){
  audio.addEventListener(event,update);
 }
 audio.addEventListener('loadedmetadata',setRate);
 setRate();

 const transport=el('div',{className:'rem-podcast-transport'},[speed,back,play,forward,sleepControl]);
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
 requestAnimationFrame(()=>{if(player.isConnected){followText(true);if(!audio.paused)startFollowing()}});
}
