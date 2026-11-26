import {button,el} from './ui.js';

function audioTime(seconds){
 if(!Number.isFinite(seconds))return '–:––';
 const total=Math.max(0,Math.floor(seconds));
 return Math.floor(total/60)+':'+String(total%60).padStart(2,'0');
}

export function enlargeAudioControls(player){
 const audio=player.querySelector('audio[controls]');
 if(!audio)return;

 const play=button('Riproduci',async()=>{
  if(!audio.paused){audio.pause();return}
  try{await audio.play();feedback.textContent=''}
  catch(error){if(error.name!=='AbortError')feedback.textContent='Impossibile avviare l’audio. Riprova.'}
 });
 const elapsed=el('span');
 const duration=el('span');
 const seek=el('input',{attrs:{type:'range',min:'0',max:'0',step:'0.1','aria-label':'Posizione nell’audio'}});
 const feedback=el('p',{className:'rem-audio-feedback',attrs:{role:'status'}});
 const update=()=>{
  const ready=Number.isFinite(audio.duration)&&audio.duration>0;
  play.textContent=audio.paused?'Riproduci':'Pausa';
  play.disabled=!audio.currentSrc&&!audio.getAttribute('src');
  seek.disabled=!ready;
  seek.max=String(ready?audio.duration:0);
  seek.value=String(ready?audio.currentTime:0);
  seek.setAttribute('aria-valuetext',audioTime(audio.currentTime));
  elapsed.textContent=audioTime(audio.currentTime);
  duration.textContent=audioTime(audio.duration);
 };
 seek.addEventListener('input',()=>{
  if(seek.disabled)return;
  audio.currentTime=Number(seek.value);
  update();
 });
 for(const event of ['loadstart','loadedmetadata','durationchange','timeupdate','seeked','play','pause','ended','emptied','error']){
  audio.addEventListener(event,update);
 }
 const native=el('details',{className:'rem-audio-native'},[el('summary',{text:'Altri comandi audio'})]);
 const controls=el('div',{className:'rem-audio-controls'},[
  play,el('div',{className:'rem-audio-times'},[elapsed,duration]),seek,feedback,native
 ]);
 audio.before(controls);
 native.append(audio);
 const previousNote=player.querySelector(':scope > .format-mode-note:last-child');
 if(previousNote?.textContent==='Narrazione audio generata con intelligenza artificiale.')previousNote.remove();
 player.append(el('p',{className:'format-mode-note',text:'Audio sincronizzato e generato con AI.'}));
 update();
}
