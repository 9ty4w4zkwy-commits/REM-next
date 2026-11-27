import {audioSourceUrl} from './audio-source.js?v=1';
import {getSetting,saveSetting} from './progress.js';
import {secondsForOffset,offsetForSeconds} from './audio-word-timeline.js';

const ROOT='./audio/la-bella-estate/';
const KEY='la-bella-estate-audio-position';
const SYNC='audio-text-sync:la-bella-estate';
const AUTO='la-bella-estate-auto-continue';
const cache=new Map();
function setting(key){try{return JSON.parse(getSetting(key,'null'))}catch{return null}}
async function timelineFor(chapter){
 if(!/^capitolo-(0[1-9]|1[0-7])$/.test(chapter.id))throw Error('Capitolo audio non riconosciuto');
 if(!cache.has(chapter.id))cache.set(chapter.id,fetch(ROOT+chapter.id+'.words.json',{cache:'no-store'}).then(r=>{
  if(!r.ok)throw Error('Mappatura non disponibile');return r.json();
 }).then(t=>{
  if(t.chapter!==chapter.id||t.coverage<.55||!Number.isFinite(t.duration)||!Array.isArray(t.words)||!t.words.length)throw Error('Mappatura non valida');
  let offset=-1,start=-1;
  for(const w of t.words){if(!Number.isInteger(w.offset)||w.offset<=offset||!Number.isFinite(w.start)||w.start<start||!Number.isFinite(w.end)||w.end<w.start||w.end>t.duration+.01)throw Error('Mappatura non ordinata');offset=w.offset;start=w.start}
  return t;
 }).catch(e=>{cache.delete(chapter.id);throw e}));
 return cache.get(chapter.id);
}
export async function createBellaEstateAudio({chapter,content,segmentStart=0,segmentEnd=null,onPosition,onNext,seekOffset=null}){
 const t=await timelineFor(chapter);
 const words=t.words.filter(w=>w.offset>=segmentStart&&(segmentEnd===null||w.offset<segmentEnd));
 if(!words.length)throw Error('Nessuna parola abbinata in questo episodio');
 const start=segmentStart===0?0:words[0].start;
 const nextAnchor=segmentEnd===null?null:t.words.find(w=>w.offset>=segmentEnd);
 const end=nextAnchor?nextAnchor.start:t.duration;
 const section=document.createElement('section');section.className='format-mode-panel rem-audio-player';
 const status=document.createElement('p');status.className='rem-audio-status';status.setAttribute('role','status');
 const audio=document.createElement('audio');audio.controls=true;audio.preload='metadata';audio.style.width='100%';
 section.append(status,audio);
 const saved=setting(KEY),sync=setting(SYNC);
 const auto=getSetting(AUTO,'false')==='true';saveSetting(AUTO,'false');
 let target=start;
 if(Number.isFinite(seekOffset)&&seekOffset>=segmentStart&&(segmentEnd===null||seekOffset<segmentEnd))target=seekOffset===segmentStart?start:(secondsForOffset(t,seekOffset)??start);
 else if(sync?.chapter===chapter.id&&sync.source==='ebook'&&Number.isFinite(sync.offset)&&sync.offset>=segmentStart&&(segmentEnd===null||sync.offset<segmentEnd))target=secondsForOffset(t,sync.offset)??start;
 else if(!auto&&saved?.chapter===chapter.id&&saved.seconds>=start&&saved.seconds<end)target=saved.seconds;
 target=Math.max(start,Math.min(target,Math.max(start,end-.1)));
 let disposed=false,started=false,completed=false,ready=false,lastSaved=-Infinity;
 section.readAlongOffset=()=>{const offset=offsetForSeconds(t,audio.currentTime);return Number.isInteger(offset)?offset-segmentStart:null};
 section.playbackWindow=()=>[start,end];
 function persist(force=false){
  if(!ready||disposed||completed||!started)return;
  const time=Math.max(start,Math.min(audio.currentTime,end));
  if(!Number.isFinite(time)||(!force&&Math.abs(time-lastSaved)<1.5))return;
  lastSaved=time;
  saveSetting(KEY,JSON.stringify({chapter:chapter.id,seconds:time}));
  const offset=offsetForSeconds(t,time);
  if(Number.isInteger(offset)){
   const absolute=Math.max(segmentStart,Math.min(offset,segmentEnd===null?segmentStart+Math.max(0,content.length-1):segmentEnd-1));
   saveSetting(SYNC,JSON.stringify({chapter:chapter.id,source:'audio',offset:absolute,seconds:time}));
   onPosition?.(absolute);
  }
 }
 function finish(){
  if(disposed||completed||!started)return;
  persist(true);completed=true;audio.pause();
  saveSetting(AUTO,'true');onNext?.();
 }
 audio.addEventListener('loadedmetadata',()=>{
  if(disposed)return;
  audio.currentTime=Math.min(target,Math.max(0,audio.duration-.1));ready=true;
  if(auto)audio.play().catch(()=>{status.textContent='Premi Play per continuare'});
 },{once:true});
 audio.addEventListener('play',()=>{started=true;if(!completed)status.textContent=''});
 audio.addEventListener('seeking',()=>{if(!ready||disposed||completed)return;if(audio.currentTime<start)audio.currentTime=start;else if(audio.currentTime>=end)audio.currentTime=Math.max(start,end-.1)});
 audio.addEventListener('timeupdate',()=>{if(!ready||disposed||completed)return;if(audio.currentTime>=end-.05&&started&&!audio.paused){finish();return}persist()});
 audio.addEventListener('pause',()=>persist(true));
 audio.addEventListener('ended',finish);
 audio.addEventListener('error',()=>{if(!disposed)status.textContent='Audio non disponibile: riprova tra poco.'});
 section.stopAudio=()=>{persist(true);disposed=true;audio.pause();audio.removeAttribute('src');audio.load()};
 audio.src=audioSourceUrl(chapter,ROOT+chapter.id+'.m4a','la-bella-estate/'+chapter.id+'.m4a');
 return section;
}
