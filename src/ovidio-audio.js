import {audioSourceUrl} from './audio-source.js?v=1';
import {getSetting,saveSetting} from './progress.js';

const ROOT='./content/books/metamorfosi-ovidio/';
const TRACKS={
  1:['001_Libro_I_parte_1.mp3','001_Libro_I_parte_2.mp3'],
  2:['002_Libro_II_parte_1.mp3','002_Libro_II_parte_2.mp3'],
  3:['003_Libro_III.mp3'],
  4:['004_Libro_IV.mp3']
};
const cache=new Map();
export async function loadOvidioTimeline(chapter){
  if(!cache.has(chapter.file))cache.set(chapter.file,fetch(ROOT+encodeURIComponent(chapter.file.replace(/\.txt$/,'.words.json')),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Mappatura non disponibile');return r.json()}).then(data=>{
    if(!Array.isArray(data.words)||!data.words.length)throw Error('Mappatura vuota');
    return data;
  }).catch(e=>{cache.delete(chapter.file);throw e}));
  return cache.get(chapter.file);
}
function clock(t){const n=Math.max(0,Math.floor(t||0));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
export async function createOvidioAudio({chapter,content,segmentStart=0,segmentEnd=null,onPosition,onNext}){
  const book=Number(chapter.id.match(/^libro-(\d+)/)?.[1]);
  if(!Number.isInteger(book)||book<1||book>15)throw Error('Libro audio non riconosciuto');
  const timeline=await loadOvidioTimeline(chapter);
  const isSegment=segmentEnd!==null;
  const words=isSegment?timeline.words.filter(w=>w.offset>=segmentStart&&w.offset<segmentEnd):timeline.words;
  if(!words.length)throw Error('Audio sincronizzato non disponibile per questo segmento');
  const boundaries=timeline.partDurations||[];
  const tracks=chapter.audioSource==='r2'?timeline.parts:TRACKS[book];
  if(!Array.isArray(tracks)||!tracks.length||tracks.some(t=>typeof t!=='string'||!t||t.includes('/')||t.includes('\\')))throw Error('Tracce audio non valide');
  if(chapter.audioSource==='r2'&&(boundaries.length!==tracks.length||boundaries.some(d=>!Number.isFinite(d)||d<=0)))throw Error('Durata delle tracce R2 non valida');
  const section=document.createElement('section');
  section.className='format-mode-panel rem-audio-player rem-ovidio-player';
  const player=document.createElement('audio');player.preload='metadata';player.controls=true;player.style.width='100%';
  const text=document.createElement('div');text.className='rem-ovidio-transcript';text.setAttribute('aria-label','Testo sincronizzato con la narrazione');
  text.style.cssText='font-family:Georgia,serif;font-size:1.15rem;line-height:1.85;white-space:pre-wrap;max-height:55vh;overflow:auto;padding:16px 6px;color:inherit';
  const spans=[];
  let cursor=0;
  for(const item of words){
    const localOffset=item.offset-segmentStart;
    if(localOffset<cursor||localOffset>=content.length)continue;
    text.append(document.createTextNode(content.slice(cursor,localOffset)));
    const match=/^[^\W_]+(?:['’][^\W_]+)*/u.exec(content.slice(localOffset));
    if(!match)continue;
    const span=document.createElement('span');span.textContent=match[0];span.dataset.start=String(item.start);
    span.style.cssText='cursor:pointer;border-radius:3px;transition:background-color .12s';
    span.title='Ascolta da questa parola';
    span.addEventListener('click',()=>{seekAbsolute(item.start);player.play().catch(()=>{})});
    text.append(span);spans.push({time:item.start,node:span,offset:item.offset});
    cursor=localOffset+match[0].length;
  }
  text.append(document.createTextNode(content.slice(cursor)));
  const start=words[0].start;
  const last=words[words.length-1].end;
  const partStarts=[0];
  for(let i=0;i<tracks.length-1;i++)partStarts.push(partStarts[i]+Number(boundaries[i]||0));
  let currentPart=-1,active=-1,disposed=false,hasStarted=false,lastSave=0,requested=0;
  const key='ovidio-audio-position';
  const saved=(()=>{try{return JSON.parse(getSetting(key,'null'))}catch{return null}})();
  const sync=(()=>{try{return JSON.parse(getSetting('audio-text-sync:metamorfosi-ovidio','null'))}catch{return null}})();
  const fromEbook=sync?.chapter===chapter.id&&sync.source==='ebook'&&Number.isFinite(sync.offset);
  const selectedWord=fromEbook?words.find(w=>w.offset>=sync.offset)||words[words.length-1]:null;
  const initial=selectedWord?selectedWord.start:!isSegment&&saved?.chapter===chapter.id&&Number.isFinite(saved.seconds)?saved.seconds:start;
  if(fromEbook)saveSetting('audio-text-sync:metamorfosi-ovidio','null');
  const continuePlaying=getSetting('ovidio-auto-continue','false')==='true';
  saveSetting('ovidio-auto-continue','false');
  function absolute(){return (partStarts[currentPart]||0)+(player.currentTime||0)}
  function partFor(t){let index=0;for(let i=1;i<partStarts.length;i++)if(t>=partStarts[i])index=i;return index}
  function seekAbsolute(t,autoplay=false){
    if(disposed)return;
    const index=partFor(t),local=Math.max(0,t-partStarts[index]);
    requested=local;
    if(index!==currentPart){
      currentPart=index;
      player.src=audioSourceUrl(chapter,ROOT+'audio/'+encodeURIComponent(tracks[index]),'metamorfosi-ovidio/'+tracks[index]);
      player.load();
      player.addEventListener('loadedmetadata',function loaded(){player.removeEventListener('loadedmetadata',loaded);if(!disposed){player.currentTime=Math.min(requested,Math.max(0,(player.duration||requested+1)-.1));if(autoplay)player.play().catch(()=>{})}});
    }else if(player.readyState>=1){player.currentTime=Math.min(local,Math.max(0,(player.duration||local+1)-.1));if(autoplay)player.play().catch(()=>{})}
  }
  function highlight(){
    if(disposed)return;
    const time=absolute();
    let lo=0,hi=spans.length;
    while(lo<hi){const mid=(lo+hi)>>1;if(spans[mid].time<=time)lo=mid+1;else hi=mid}
    const next=Math.max(0,lo-1);
    if(next!==active){if(active>=0)spans[active].node.style.backgroundColor='';active=next;spans[active]?.node&&(spans[active].node.style.backgroundColor='#f2b8c6');if(player.paused===false&&spans[active]?.node)spans[active].node.scrollIntoView({block:'nearest',behavior:'smooth'})}
    if(Date.now()-lastSave>1500){lastSave=Date.now();saveSetting(key,JSON.stringify({chapter:chapter.id,seconds:time}));if(spans[active]){saveSetting('audio-text-sync:metamorfosi-ovidio',JSON.stringify({chapter:chapter.id,source:'audio',offset:spans[active].offset}));onPosition?.(spans[active].offset)}}
    if(time>=last&&hasStarted){player.pause();hasStarted=false;saveSetting('ovidio-auto-continue','true');onNext?.()}
  }
  player.addEventListener('timeupdate',highlight);
  player.addEventListener('play',()=>{hasStarted=true});
  player.addEventListener('ended',()=>{if(disposed)return;if(currentPart<tracks.length-1&&absolute()<last-1){seekAbsolute(partStarts[currentPart+1],true)}else {saveSetting('ovidio-auto-continue','true');onNext?.()}});
  section.append(player);
  section.stopAudio=()=>{if(!disposed&&currentPart>=0){const time=absolute();saveSetting(key,JSON.stringify({chapter:chapter.id,seconds:time}));const item=words.reduce((last,w)=>w.start<=time?w:last,words[0]);saveSetting('audio-text-sync:metamorfosi-ovidio',JSON.stringify({chapter:chapter.id,source:'audio',offset:item.offset}));onPosition?.(item.offset)}disposed=true;player.pause();player.removeAttribute('src');player.load()};
  seekAbsolute(Math.max(start,Math.min(initial,last)),continuePlaying);
  return section;
}
