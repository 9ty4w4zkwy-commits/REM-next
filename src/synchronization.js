import {rankScenes} from './paper-scene-rank.js?v=paper-scene-20261124';
import {recognizePage,semanticLocations} from './paper-intelligence.js?v=paper-scene-20261124';
import {el,button} from './ui.js';
import {chapterPicker} from './chapter-picker.js?v=compact-picker-20261124';
import {loadChapter,chapterHasAudio} from './catalog.js?v=giro-readflow-20261127';
import {getSetting,saveSetting} from './progress.js';

// A phrase bookmark is independent of the reader UI and of the current format.
export function savePhrase(bookId,chapterId,phrase,offset){
 const record={chapter:chapterId,phrase,offset,updatedAt:new Date().toISOString()};
 saveSetting('sync-point:'+bookId,JSON.stringify(record));return record;
}
export function getPhrase(bookId){try{return JSON.parse(getSetting('sync-point:'+bookId,'null'))}catch{return null}}
const normalize=s=>s.toLocaleLowerCase('it').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'").replace(/[^\p{L}\p{N}']+/gu,' ').trim();
export async function findPhrase(book,query,chapterTexts=new Map()){
 const needle=normalize(query);if(needle.split(/\s+/).filter(Boolean).length<4)return {error:'Inserisci almeno quattro parole consecutive.'};
 const matches=[];
 for(const chapter of book.chapters){
  if(!chapterTexts.has(chapter.id))chapterTexts.set(chapter.id,await loadChapter(book,chapter));
  const content=chapterTexts.get(chapter.id);
  const tokens=[...content.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)].map(m=>({word:normalize(m[0]),start:m.index}));
  const wanted=needle.split(' ');
  for(let i=0;i<=tokens.length-wanted.length;i++){
   if(wanted.every((w,j)=>tokens[i+j].word===w)){
    const start=tokens[i].start;
    matches.push({chapter:chapter.id,title:chapter.title,offset:start,phrase:content.slice(start,tokens[i+wanted.length-1].start+tokens[i+wanted.length-1].word.length),context:content.slice(Math.max(0,start-70),Math.min(content.length,start+180)).replace(/\s+/g,' ')});
   }
  }
 }
 return {matches};
}

// Return likely story locations when editions use different wording.
// These are editorial suggestions, never word-accurate matches.
async function findStoryLocations(book,query,chapterTexts=new Map()){
 const chapters=[];
 for(const chapter of book.chapters){
  try{
   if(!chapterTexts.has(chapter.id))chapterTexts.set(chapter.id,await loadChapter(book,chapter));
   chapters.push({...chapter,content:chapterTexts.get(chapter.id)});
  }catch{}
 }
 return rankScenes(chapters,query);
}
export function phraseSearch(book,onFound){
 const wrap=el('section',{className:'sync-search rem-paper-locator'});
 const title=el('h2',{text:'Ritrova il tuo punto nella storia'});
 const intro=el('p',{text:'La tua edizione cartacea può essere diversa: cercheremo il passaggio corrispondente o una scena vicina. Potrai sempre scegliere il capitolo.'});
 const tabs=el('div',{className:'rem-paper-methods',attrs:{role:'group','aria-label':'Come indicare il punto'}});
 const methods=[
  ['photo','Fotografa'],['voice','Leggi'],['text','Scrivi'],['chapter','Capitolo']
 ];
 const icons={
  photo:['rect|3|6|18|15|2','circle|12|13.5|4','path|M8 6l1.3-2h5.4L16 6'],
  voice:['rect|9|2|6|13|3','path|M5 10a7 7 0 0 0 14 0 M12 17v5 M8 22h8'],
  text:['path|M12 20h9 M4 20l4.5-1 11-11a2.12 2.12 0 0 0-3-3l-11 11L4 20Z'],
  chapter:['path|M12 7c-2.5-2-5.5-2.6-9-2v14c3.5-.6 6.5 0 9 2 M12 7c2.5-2 5.5-2.6 9-2v14c-3.5-.6-6.5 0-9 2 M12 7v14']
 };
 const methodIcon=id=>{
  const ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg');
  svg.classList.add('rem-paper-method-icon');
  svg.setAttribute('viewBox','0 0 24 24');
  svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');
  svg.setAttribute('stroke-width','1.8');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');
  svg.setAttribute('aria-hidden','true');
  for(const data of icons[id]){
   const [kind,...values]=data.split('|');
   const n=document.createElementNS(ns,kind);
   if(kind==='path')n.setAttribute('d',values[0]);
   if(kind==='rect'){['x','y','width','height','rx'].forEach((attr,i)=>n.setAttribute(attr,values[i]))}
   if(kind==='circle'){['cx','cy','r'].forEach((attr,i)=>n.setAttribute(attr,values[i]))}
   svg.append(n);
  }
  return svg;
 };
 const methodButtons=new Map();
 const panels=new Map();
 const methodArea=el('div',{className:'rem-paper-method-area'});
 let active='photo';
 const field=el('textarea',{attrs:{rows:'3',placeholder:'Incolla una frase o descrivi la scena…','aria-label':'Frase o descrizione del punto di lettura'}});
 const sharedText=el('div',{className:'rem-paper-text-entry'},[el('label',{text:'Frase o descrizione della scena'}),field]);
 const status=el('p',{className:'sync-status',attrs:{role:'status','aria-live':'polite'}});
 const results=el('div',{className:'sync-results rem-paper-matches'});
 const progressLabel=el('p',{text:'Sto cercando il punto nella storia…'});
 const progressFill=el('span',{className:'rem-paper-progress-fill'});
 const progressTrack=el('div',{className:'rem-paper-progress-track',attrs:{role:'progressbar','aria-label':'Ricerca del punto nella storia'}},[progressFill]);
 const progressBox=el('div',{className:'rem-paper-progress',attrs:{hidden:''}},[progressLabel,progressTrack]);
 let photoBusy=false;
 function updateBusy(){
  const busy=photoBusy||searching;
  progressBox.hidden=!busy;
  wrap.setAttribute('aria-busy',String(busy));
  takePhoto.disabled=busy;choosePhoto.disabled=busy;photo.disabled=busy;library.disabled=busy;
  find.disabled=busy;
  for(const b of methodButtons.values())b.disabled=busy;
 }
 let photoText='';
 const photo=el('input',{attrs:{type:'file',accept:'image/*',capture:'environment','aria-label':'Fotografa la pagina del libro'}});
 const library=el('input',{attrs:{type:'file',accept:'image/*','aria-label':'Scegli una foto dalla libreria'}});
 photo.hidden=true;library.hidden=true;photo.style.setProperty('display','none','important');library.style.setProperty('display','none','important');
 const takePhoto=button('Scatta una foto',()=>photo.click());
 const choosePhoto=button('Scegli dalla libreria',()=>library.click());
 const photoStatus=el('p',{className:'sync-photo-note',text:'Fotografa una pagina ben illuminata.'});
 let photoRun=0;
 const handlePhoto=async input=>{
  const file=input.files?.[0];if(!file)return;
  if(searching||photoBusy){input.value='';return}
  const run=++photoRun;photoBusy=true;photoText='';updateBusy();results.replaceChildren();status.textContent='';photoStatus.textContent='Fotografa una pagina ben illuminata.';
  try{
   const extracted=await recognizePage(file);
   if(run!==photoRun||!wrap.isConnected)return;
   photoText=extracted;photoStatus.textContent='Fotografa una pagina ben illuminata.';
   photoBusy=false;if(active==='photo'){find.disabled=false;find.click();}
  }catch(e){if(run===photoRun)photoStatus.textContent='Foto non leggibile. Riprova oppure usa Scrivi.'}
  finally{if(run===photoRun){photoBusy=false;photo.value='';library.value='';updateBusy()}}
 };
 photo.addEventListener('change',()=>handlePhoto(photo));
 library.addEventListener('change',()=>handlePhoto(library));
 const photoPanel=el('div',{className:'rem-paper-method-panel'},[el('strong',{text:'Fotografa una pagina'}),el('div',{className:'rem-paper-match-actions'},[takePhoto,choosePhoto]),photo,library,photoStatus]);
 const voiceButton=button('🎙️ Avvia dettatura',()=>startVoice());
 const voiceNote=el('p',{className:'sync-photo-note',text:'Leggi ad alta voce alcune righe oppure racconta la scena. Il riconoscimento vocale del browser può usare servizi esterni; non salviamo registrazioni audio.'});
 const voicePanel=el('div',{className:'rem-paper-method-panel'},[voiceButton,voiceNote]);
 const textPanel=el('div',{className:'rem-paper-method-panel'},[el('p',{text:'Scrivi almeno quattro parole consecutive per una ricerca esatta, oppure descrivi una scena per ottenere suggerimenti orientativi.'})]);
 const chapterSelect=el('select',{attrs:{'aria-label':'Scegli il capitolo del cartaceo'}});
 book.chapters.forEach(c=>chapterSelect.append(el('option',{text:c.title,attrs:{value:c.id}})));
 const chapterPanel=el('div',{className:'rem-paper-method-panel'},[el('label',{text:'Capitolo raggiunto'}),chapterPicker(chapterSelect),el('p',{className:'sync-photo-note',text:'Se non riconosci il passaggio, scegli il capitolo manualmente.'})]);
 panels.set('photo',photoPanel);panels.set('voice',voicePanel);panels.set('text',textPanel);panels.set('chapter',chapterPanel);
 for(const [id,label] of methods){
  const b=button('',()=>setMethod(id));
  b.className='rem-paper-method-button';
  b.setAttribute('aria-label',label);
  b.append(methodIcon(id),el('span',{className:'rem-paper-method-label',text:label}));
  methodButtons.set(id,b);tabs.append(b);
 }
 function setMethod(id){
  active=id;methodArea.replaceChildren(panels.get(id));
  sharedText.hidden=id==='chapter'||id==='photo';
  find.hidden=id==='photo';
  results.replaceChildren();status.textContent='';
  for(const [key,b] of methodButtons)b.setAttribute('aria-pressed',String(key===id));
 }
 function startVoice(){
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Recognition){voiceNote.textContent='Il riconoscimento vocale non è disponibile in questo browser. Puoi usare il microfono della tastiera iPhone nel campo Scrivi.';return}
  const rec=new Recognition();rec.lang='it-IT';rec.interimResults=false;rec.maxAlternatives=1;
  voiceButton.disabled=true;voiceNote.textContent='Ascolto in corso…';
  rec.onresult=e=>{field.value=e.results?.[0]?.[0]?.transcript||'';voiceNote.textContent='Trascrizione pronta: controllala e premi Trova il punto.'};
  rec.onerror=()=>{voiceNote.textContent='Non è stato possibile trascrivere. Puoi provare a scrivere la frase.'};
  rec.onend=()=>{voiceButton.disabled=false};
  try{rec.start()}catch{voiceButton.disabled=false;voiceNote.textContent='Microfono non disponibile. Usa il campo Scrivi.'}
 }
 function choose(item,target){
  if(item){savePhrase(book.id,item.chapter,item.phrase,item.offset)}
  onFound(item,target);
 }
 function showResults(matches){
  results.replaceChildren();
  if(!matches.length){status.textContent='Nessuna corrispondenza affidabile. Prova a indicare il capitolo oppure una frase più lunga.';return}
  status.textContent=matches[0].approximate?'Possibili scene corrispondenti: scegli quella che riconosci. La posizione è indicativa, anche tra traduzioni diverse.':'Testo individuato: verifica il passaggio prima di continuare.';
  for(const item of matches){
   const card=el('section',{className:'rem-paper-match'},[
    el('strong',{text:item.title}),
    el('p',{text:item.context||item.phrase}),
    ...(item.approximate?[el('small',{text:'Corrispondenza orientativa: verifica il passaggio'})]:[]),
    el('div',{className:'rem-paper-match-actions'},[
     button('Continua in Ebook',()=>choose(item,'ebook'),true),
     ...(chapterHasAudio(book,book.chapters.find(chapter=>chapter.id===item.chapter))?[button('Continua in Audio',()=>choose(item,'audio'))]:[])
    ])
   ]);
   results.append(card);
  }
 }
 let searching=false;
 const find=button('Trova il punto',async()=>{
  if(active==='chapter'){
   const item={chapter:chapterSelect.value,title:chapterSelect.selectedOptions[0]?.textContent||'',offset:0,phrase:'',context:'Inizio del capitolo selezionato',approximate:true};
   showResults([item]);return;
  }
  const query=(active==='photo'?photoText:field.value).trim();
  if(!query){status.textContent='Inserisci una frase o una descrizione prima di cercare.';return}
  if(searching||photoBusy)return;searching=true;updateBusy();status.textContent='';results.replaceChildren();
  try{
   let matches=[];const chapterTexts=new Map();
   if(normalize(query).split(/\s+/).length>=4){
    const exact=await findPhrase(book,query,chapterTexts);
    matches=(exact.matches||[]).slice(0,4);
   }
   let semanticFailed=false;
   if(!matches.length){
    const lexical=await findStoryLocations(book,query,chapterTexts);
    const strongest=lexical[0];
    if(strongest&&strongest.coverage>=.52&&strongest.shared>=3&&(!lexical[1]||strongest.score>lexical[1].score*1.16)){
     matches=[strongest];
    }else{
     let semantic=[];
     try{semantic=await semanticLocations(book,query)}catch(e){semanticFailed=true}
     const combined=lexical.map(item=>{
      const related=semantic.find(s=>s.chapter===item.chapter&&Math.abs(s.offset-item.offset)<1800);
      return {...item,rank:item.score+(related?.score||0)*.16};
     });
     for(const item of semantic){
      if(!combined.some(s=>s.chapter===item.chapter&&Math.abs(s.offset-item.offset)<1800))combined.push({...item,rank:item.score*.38});
     }
     combined.sort((a,b)=>b.rank-a.rank);
     matches=combined.filter((item,i)=>item.rank>=combined[0].rank*.80&&!combined.slice(0,i).some(s=>s.chapter===item.chapter&&Math.abs(s.offset-item.offset)<1800)).slice(0,3);
    }
   }
   if(wrap.isConnected){showResults(matches);if(semanticFailed)status.textContent+=' Ricerca semantica non disponibile: è stata usata la ricerca per parole chiave.'}

  }catch(e){status.textContent='Ricerca non riuscita: '+e.message}finally{searching=false;updateBusy()}
 },true);
 find.className='rem-paper-find';
 wrap.append(title,intro,tabs,methodArea,sharedText,el('div',{className:'rem-paper-actions'},[find]),progressBox,status,results);
 setMethod('photo');
 return wrap;
}
