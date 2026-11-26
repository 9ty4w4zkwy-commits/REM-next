import {button,el} from './ui.js';
import {getSetting,saveSetting} from './progress.js';

const speeds=[.75,1,1.25,1.5,2];

function audioTime(seconds){
 if(!Number.isFinite(seconds))return '–:––';
 const total=Math.max(0,Math.floor(seconds));
 return Math.floor(total/60)+':'+String(total%60).padStart(2,'0');
}

const iconPaths={
 play:'M7 4.5a1 1 0 0 1 1.5-.9l13 7.5a1 1 0 0 1 0 1.8l-13 7.5a1 1 0 0 1-1.5-.9Z',
 pause:'M5 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm10 0h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z',
 clock:'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18Zm0 4v5h5',
 skip:'M15.6 5.3A8.5 8.5 0 1 1 12 4.5',
 speakerLow:'M3 9h4l5-4v14l-5-4H3Zm12 .5a4 4 0 0 1 0 5',
 speakerHigh:'M2 9h4l5-4v14l-5-4H2Zm12 .5a4 4 0 0 1 0 5m2-8a8 8 0 0 1 0 11m2-14a12 12 0 0 1 0 17'
};

function transportIcon(name){
 const ns='http://www.w3.org/2000/svg';
 const svg=document.createElementNS(ns,'svg');
 svg.setAttribute('viewBox','0 0 24 24');
 svg.setAttribute('aria-hidden','true');
 svg.setAttribute('focusable','false');
 const path=document.createElementNS(ns,'path');
 path.setAttribute('d',iconPaths[name==='rewind'||name==='forward'?'skip':name]);
 if(name==='rewind'||name==='forward'||name==='clock'||name.startsWith('speaker')){
  path.setAttribute('fill','none');
  path.setAttribute('stroke','currentColor');
  path.setAttribute('stroke-width','1.75');
  path.setAttribute('stroke-linecap','round');
  path.setAttribute('stroke-linejoin','round');
  svg.append(path);
  if(name==='clock'||name.startsWith('speaker'))return svg;
  path.setAttribute('stroke-width','1.55');
  const tip=document.createElementNS(ns,'path');
  tip.setAttribute('d','M10.5 2.2 14.2 4.5 10.5 6.8Z');
  tip.setAttribute('fill','currentColor');
  if(name==='rewind'){
   const mirror='translate(24 0) scale(-1 1)';
   path.setAttribute('transform',mirror);
   tip.setAttribute('transform',mirror);
  }
  svg.append(tip);
  const label=document.createElementNS(ns,'text');
  label.setAttribute('x','12');
  label.setAttribute('y','15.75');
  label.setAttribute('text-anchor','middle');
  label.setAttribute('fill','currentColor');
  label.textContent=name==='rewind'?'15':'30';
  svg.append(label);
 }else{
  path.setAttribute('fill','currentColor');
  svg.append(path);
 }
 return svg;
}

function volumeControl(audio){
 const appleMobile=/iPhone|iPad|iPod/.test(navigator.userAgent)||
  (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 // On iOS the property can round-trip even though it does not change the output.
 const probe=document.createElement('audio');
 probe.volume=.5;
 if(appleMobile||probe.volume!==.5)return null;
 const key='audiobook-volume';
 const saved=Number(getSetting(key,'1'));
 if(Number.isFinite(saved)&&saved>=0&&saved<=1)audio.volume=saved;
 const slider=el('input',{className:'rem-podcast-seek',attrs:{type:'range',min:'0',max:'1',step:'.01','aria-label':'Volume audiolibro'}});
 const update=()=>{
  slider.value=String(audio.volume);
  const percent=Math.round(audio.volume*100)+'%';
  slider.style.setProperty('--rem-podcast-progress',percent);
  slider.setAttribute('aria-valuetext',percent);
 };
 slider.addEventListener('input',()=>{
  audio.volume=Number(slider.value);
  saveSetting(key,String(audio.volume));
  update();
 });
 audio.addEventListener('volumechange',update);
 update();
 return el('div',{className:'rem-podcast-volume'},[transportIcon('speakerLow'),slider,transportIcon('speakerHigh')]);
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

export function mountPodcastControls(player,content,focus){
 const audio=player.querySelector('audio[controls]');
 focus.className='rem-podcast-focus';
 focus.replaceChildren(transportIcon('clock'));
 focus.setAttribute('aria-label','Focus');
 focus.title='Focus';
 if(!audio){(player.querySelector('.rem-audio-actions')||player).append(focus);return}
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
 let frame=null;
 const stop=player.stopAudio?.bind(player);
 player.stopAudio=()=>{
  stopFollowing();
  stop?.();
 };

 const elapsed=el('span');
 const remaining=el('span');
 const seek=el('input',{className:'rem-podcast-seek',attrs:{type:'range',min:'0',max:'0',step:'0.1','aria-label':'Posizione nell’audio'}});
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
  seek.style.setProperty('--rem-podcast-progress',ready?(position/(end-start)*100)+'%':'0%');
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

 const transport=el('div',{className:'rem-podcast-transport'},[speed,back,play,forward,focus]);
 const volume=volumeControl(audio);
 const controls=el('div',{className:'rem-audio-controls'},[
  transcript.root,seek,el('div',{className:'rem-audio-times'},[elapsed,remaining]),transport,...(volume?[volume]:[]),feedback
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
