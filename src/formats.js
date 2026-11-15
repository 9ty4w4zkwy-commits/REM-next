import {getSetting,saveSetting} from './progress.js';
import {el,button,panel} from './ui.js';
const ICON_PATHS={
paper:['M12 7c-2.5-2-5.5-2.6-9-2v14c3.5-.6 6.5 0 9 2','M12 7c2.5-2 5.5-2.6 9-2v14c-3.5-.6-6.5 0-9 2','M12 7v14'],
ebook:['M6 2.5h12a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2Z','M10 18.5h4'],
audio:['M3 14v-3a9 9 0 0 1 18 0v3','M3 14h3v7H5a2 2 0 0 1-2-2v-5Z','M18 14h3v5a2 2 0 0 1-2 2h-1v-7Z']
};
function formatIcon(id){const ns='http://www.w3.org/2000/svg';const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.8');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');svg.classList.add('format-icon');for(const d of ICON_PATHS[id]){const path=document.createElementNS(ns,'path');path.setAttribute('d',d);svg.append(path)}return svg}
const MODES=[['ebook','Ebook'],['paper','Cartaceo'],['audio','Audio']];
export function getMode(bookId){const mode=getSetting('format:'+bookId,'ebook');return MODES.some(([id])=>id===mode)?mode:'ebook'}
export function formatSwitch(bookId,selected,onSelect){return el('div',{className:'format-switch',attrs:{role:'group','aria-label':'Formato di lettura'}},MODES.map(([id,label])=>{const b=button(label,()=>{saveSetting('format:'+bookId,id);onSelect(id)},id===selected);b.setAttribute('aria-pressed',String(id===selected));b.dataset.format=id;b.prepend(formatIcon(id));return b}))}
export function paperView(book,chapter,onChapter){const intro=el('p',{text:'Stai leggendo la copia cartacea? Seleziona il capitolo raggiunto. Il progresso viene salvato solo su questo dispositivo.'});const select=el('select',{attrs:{'aria-label':'Capitolo raggiunto sul cartaceo'}});for(const c of book.chapters)select.append(el('option',{text:c.title,attrs:{value:c.id}}));select.value=chapter?.id||book.chapters[0]?.id||'';select.addEventListener('change',()=>onChapter(select.value));return el('section',{className:'format-mode-panel'},[el('p',{className:'eyebrow',text:'REM · CARTACEO'}),el('h2',{text:'Continua sul tuo libro cartaceo'}),intro,el('label',{text:'Capitolo raggiunto'}),select,el('p',{className:'format-mode-note',text:'Per passare subito a Ebook o Audio, usa i tre pulsanti in basso. La ricerca precisa da foto, pagina o frase arriverà nel prossimo step.'})])}
// Local chapter-audio preview: no third-party recording is published by REM Next.
// Selecting a chapter file plays it on-device and saves its actual playback time.
// Store private test audio only inside this browser; never upload recordings to GitHub Pages.
function audioDatabase(){
 return new Promise((resolve,reject)=>{
  if(!('indexedDB' in window))return reject(Error('Archivio locale non supportato'));
  const request=indexedDB.open('rem-private-audio',1);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('chapters'))request.result.createObjectStore('chapters')};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
 });
}
async function storedAudio(id,blob){
 const db=await audioDatabase();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('chapters',blob?'readwrite':'readonly');
  const req=blob?tx.objectStore('chapters').put(blob,id):tx.objectStore('chapters').get(id);
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
  tx.oncomplete=()=>db.close();
 });
}
function localChapterAudioView({bookId,chapter,onPosition,content}){
 const wrap=el('section',{className:'format-mode-panel rem-audio-player'});
 const key='audio-real-position:'+bookId;
 const syncKey='audio-text-sync:'+bookId;
 const textLength=typeof content==='string'?content.length:0;
 const number=Number(chapter.id.match(/^capitolo-(\d+)$/)?.[1]);
 const expected='capitolo-'+String(number).padStart(2,'0')+'.m4a';
 const note=el('p',{className:'rem-audio-status',text:'Ricerca dell’audio salvato sul dispositivo…'});
 const picker=el('input',{attrs:{type:'file',multiple:'',accept:'.m4a,.mp4,audio/mp4','aria-label':'Importa i capitoli audio M4A'}});
 picker.style.maxWidth='100%';
 const audio=document.createElement('audio');audio.controls=true;audio.preload='metadata';audio.style.width='100%';
 let url=null,disposed=false;
 const attach=file=>{
  if(disposed)return;
  if(url)URL.revokeObjectURL(url);
  url=URL.createObjectURL(file);audio.src=url;
  audio.addEventListener('loadedmetadata',()=>{
   try{const saved=JSON.parse(getSetting(key,'null'));if(saved?.chapter===chapter.id&&Number.isFinite(saved.seconds))audio.currentTime=Math.min(saved.seconds,Math.max(0,audio.duration-0.5))}catch{}
   note.textContent='Capitolo pronto: premi Play. Il file rimane privato su questo dispositivo.';
  },{once:true});
 };
 // Publicly licensed audio is preferred when available; local files remain a fallback.
 const publicSrc=number===1?'./audio/pinocchio/capitolo-01.m4a':'./audio/pinocchio/'+expected;
 if(number===1){
  // GitHub release assets are cross-origin: Safari may reject HEAD checks due to CORS.
  // Let the native audio element request the file directly instead.
  audio.src=publicSrc;
  picker.hidden=true;
  note.textContent='Caricamento del capitolo 1…';
  audio.addEventListener('loadedmetadata',()=>{
   if(disposed)return;
   try{const sync=JSON.parse(getSetting(syncKey,'null'));const saved=JSON.parse(getSetting(key,'null'));const seconds=sync?.chapter===chapter.id&&sync.source==='ebook'&&textLength>0?Math.max(0,Math.min(1,sync.offset/textLength))*audio.duration:saved?.chapter===chapter.id?saved.seconds:0;if(Number.isFinite(seconds))audio.currentTime=Math.min(seconds,Math.max(0,audio.duration-.5))}catch{}
   note.textContent='';
  },{once:true});
  audio.addEventListener('error',()=>{
   if(disposed)return;
   picker.hidden=false;
   note.textContent='Il collegamento pubblico non è riproducibile in questo browser. Puoi importare il file M4A.';
  },{once:true});
 }else{
  storedAudio(bookId+':'+chapter.id).then(file=>{
   if(file)attach(file);
   else if(!disposed)note.textContent='Importa una sola volta i file M4A dei capitoli (puoi selezionarne più di uno).';
  }).catch(()=>{if(!disposed)note.textContent='Archivio locale non disponibile: puoi comunque scegliere un file per questa sessione.'});
 }
 picker.addEventListener('change',async()=>{
  const files=[...(picker.files||[])];if(!files.length)return;
  let count=0,selected=null,errors=0;
  note.textContent='Salvataggio dei capitoli sul dispositivo…';
  for(const file of files){
   const match=file.name.match(/(?:capitolo|chapter)[-_ ]*0?(\d{1,2})\\.m4a$/i);
   const index=Number(match?.[1]);
   if(!Number.isInteger(index)||index<1||index>36)continue;
   try{await storedAudio(bookId+':capitolo-'+index,file);count++;if(index===number)selected=file}
   catch{errors++;if(index===number)selected=file}
  }
  if(selected)attach(selected);
  else if(!disposed)note.textContent=count+' capitoli salvati. Per ascoltare questo capitolo seleziona '+expected+'.';
  if(errors&&!disposed)note.textContent+=' Alcuni file non sono stati memorizzati: verifica lo spazio libero.';
  picker.value='';
 });
 let lastSaved=-1;
 const persist=()=>{
  if(!Number.isFinite(audio.currentTime)||Math.abs(audio.currentTime-lastSaved)<2)return;
  lastSaved=audio.currentTime;
  saveSetting(key,JSON.stringify({chapter:chapter.id,seconds:audio.currentTime,duration:audio.duration||null}));
  if(textLength>0&&Number.isFinite(audio.duration)&&audio.duration>0){const offset=Math.min(textLength-1,Math.round(audio.currentTime/audio.duration*textLength));saveSetting(syncKey,JSON.stringify({chapter:chapter.id,source:'audio',offset,seconds:audio.currentTime}));onPosition?.(offset)}else onPosition?.(-1);
 };
 audio.addEventListener('timeupdate',persist);audio.addEventListener('pause',persist);
 audio.addEventListener('ended',()=>{saveSetting(key,JSON.stringify({chapter:chapter.id,seconds:0,duration:audio.duration||null}));note.textContent='Capitolo completato.'});
 if(number===1){wrap.append(note,audio);wrap.append(picker)}else{wrap.append(el('p',{className:'eyebrow',text:'REM · AUDIO · PROVA PRIVATA'}),note,el('label',{text:'Importa i capitoli M4A una sola volta'}),picker,audio,el('p',{className:'format-mode-note',text:'I file audio sono salvati solo nel browser di questo dispositivo, non pubblicati sul sito. Safari può cancellarli se liberi spazio o elimini i dati del sito: conserva una copia originale. Il segnalibro audio è basato sul tempo reale.'}));}
 wrap.stopAudio=()=>{disposed=true;persist();audio.pause();audio.removeAttribute('src');audio.load();if(url)URL.revokeObjectURL(url)};
 return wrap;
}
export function audioView({bookId,chapter,content,onPosition}={}){
 if(bookId==='pinocchio'&&/^capitolo-\d+$/.test(chapter?.id||''))return localChapterAudioView({bookId,chapter,onPosition,content});
 const wrap=el('section',{className:'format-mode-panel rem-audio-player'});
 if(!content||!('speechSynthesis' in window)){
  wrap.append(el('p',{text:'La riproduzione vocale non è disponibile su questo dispositivo.'}));return wrap;
 }
 const synth=window.speechSynthesis;
 const key='audio-position:'+bookId;
 let position=0,playing=false,utterance=null,session=0;
 try{const stored=JSON.parse(getSetting(key,'null'));if(stored?.chapter===chapter.id)position=Math.max(0,Math.min(content.length-1,Number(stored.offset)||0))}catch{}
 const status=el('p',{className:'rem-audio-status',text:'Pronto per ascoltare'});
 // Speech synthesis does not expose a real duration; display explicitly estimated time.
 const estimatedSeconds=Math.max(1,Math.round(content.trim().split(/\s+/).length/150*60));
 const clock=el('div',{className:'rem-audio-clock',attrs:{'aria-label':'Tempi audio stimati'}});
 const elapsed=el('span',{text:'~00:00'}),duration=el('span',{text:'~'+formatClock(estimatedSeconds)});
 clock.append(elapsed,duration);
 function formatClock(seconds){const n=Math.max(0,Math.floor(seconds));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
 function updateClock(value){elapsed.textContent='~'+formatClock(estimatedSeconds*Math.max(0,Math.min(1,value/content.length)))}
 const progress=el('input',{className:'rem-audio-seek',attrs:{type:'range',min:'0',max:'100',value:String(Math.round(position/content.length*100)),'aria-label':'Posizione audio'}});
 const play=button('',()=>{if(playing)stop();else startAudio()});
 const setPlay=(isPlaying,label)=>{play.replaceChildren(el('span',{className:'rem-audio-play-icon',attrs:{'aria-hidden':'true'}},[el('span',{className:isPlaying?'rem-pause-glyph':'rem-play-glyph'})]),el('span',{text:label}));play.setAttribute('aria-label',label)};
 setPlay(false,'Ascolta');
 play.classList.add('rem-audio-play');const restart=button('↺ Ricomincia',()=>{stop();position=0;persist();startAudio()});
 restart.classList.add('rem-audio-restart');const persist=()=>{saveSetting(key,JSON.stringify({chapter:chapter.id,offset:position}));onPosition?.(position)};
 const update=()=>{if(seeking)return;progress.value=String(Math.round(position/content.length*100));progress.style.setProperty('--audio-progress',progress.value+'%');status.textContent=playing?'Riproduzione in corso':'Punto salvato';updateClock(position)};
 function stop(){session++;synth.cancel();playing=false;setPlay(false,'Riprendi');update();persist()}
 function startAudio(){
  if(!content.trim())return;
  session++;const token=session;synth.cancel();playing=true;setPlay(true,'Pausa');
  utterance=new SpeechSynthesisUtterance(content.slice(position));utterance.lang='it-IT';utterance.rate=0.95;
  const origin=position;
  utterance.onboundary=e=>{if(token!==session)return;if(Number.isFinite(e.charIndex)){position=Math.min(content.length,origin+e.charIndex);persist();update()}};
  utterance.onend=()=>{if(token!==session)return;playing=false;position=content.length-1;persist();setPlay(false,'Riascolta');update()};
  utterance.onerror=()=>{if(token!==session)return;playing=false;play.textContent='▶ Riprendi';status.textContent='Riproduzione interrotta. Puoi riprovare.'};
  update();synth.speak(utterance);
 }
 let seeking=false;
 progress.addEventListener('pointerdown',()=>{seeking=true});
 progress.addEventListener('input',()=>{seeking=true;progress.style.setProperty('--audio-progress',progress.value+'%');status.textContent='Spostamento del punto di ascolto';updateClock(Number(progress.value)/100*content.length)});
 const commitSeek=()=>{
  if(!seeking)return;
  const target=Math.max(0,Math.min(content.length-1,Math.floor(Number(progress.value)/100*content.length)));
  const wasPlaying=playing;
  if(playing)stop();
  position=target;seeking=false;persist();update();
  if(wasPlaying)startAudio();
 };
 progress.addEventListener('change',commitSeek);
 progress.addEventListener('pointerup',commitSeek);
 progress.addEventListener('pointercancel',commitSeek);
 progress.addEventListener('blur',commitSeek);
 wrap.append(el('p',{className:'eyebrow',text:'REM · AUDIO'}),status,clock,progress,el('div',{className:'rem-audio-actions'},[play,restart]),el('p',{className:'format-mode-note',text:'Voce sintetica dimostrativa del dispositivo. Il punto viene salvato per riprendere nell’Ebook.'}));
 wrap.stopAudio=()=>{if(playing)stop()};update();return wrap;
}
