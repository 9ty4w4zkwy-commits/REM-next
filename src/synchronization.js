import {el,button} from './ui.js';
import {loadChapter} from './catalog.js';
import {getSetting,saveSetting} from './progress.js';

// A phrase bookmark is independent of the reader UI and of the current format.
export function savePhrase(bookId,chapterId,phrase,offset){
 const record={chapter:chapterId,phrase,offset,updatedAt:new Date().toISOString()};
 saveSetting('sync-point:'+bookId,JSON.stringify(record));return record;
}
export function getPhrase(bookId){try{return JSON.parse(getSetting('sync-point:'+bookId,'null'))}catch{return null}}
const normalize=s=>s.toLocaleLowerCase('it').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'").replace(/[^\p{L}\p{N}']+/gu,' ').trim();
export async function findPhrase(book,query){
 const needle=normalize(query);if(needle.split(/\s+/).filter(Boolean).length<4)return {error:'Inserisci almeno quattro parole consecutive.'};
 const matches=[];
 for(const chapter of book.chapters){
  const content=await loadChapter(book,chapter);
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
async function findStoryLocations(book,query){
 const terms=[...new Set(normalize(query).split(/\s+/).filter(x=>x.length>3))];
 if(!terms.length)return [];
 const candidates=[];
 for(const chapter of book.chapters){
  let content;
  try{content=await loadChapter(book,chapter)}catch{continue}
  const paragraphs=content.split(/\n\s*\n/);
  const heading=normalize(chapter.title||'');
  let start=0;
  for(const paragraph of paragraphs){
   const clean=normalize(paragraph);
   if(clean.length<20){start+=paragraph.length+2;continue}
   const overlap=terms.filter(t=>clean.includes(t)).length;
   const headingOverlap=terms.filter(t=>heading.includes(t)).length;
   const score=overlap+headingOverlap*2;
   if(score>=Math.min(2,terms.length)){
    const first=terms.find(t=>clean.includes(t));
    const match=first?clean.indexOf(first):0;
    const offset=Math.max(0,start+Math.min(match,paragraph.length-1));
    candidates.push({chapter:chapter.id,title:chapter.title,offset,phrase:paragraph.trim().slice(0,110),context:paragraph.replace(/\s+/g,' ').slice(0,180),score,approximate:true});
   }
   start+=paragraph.length+2;
  }
 }
 return candidates.sort((a,b)=>b.score-a.score).slice(0,4);
}
export function phraseSearch(book,onFound){
 const wrap=el('section',{className:'sync-search rem-paper-locator'});
 const title=el('h2',{text:'Ritrova il tuo punto nella storia'});
 const intro=el('p',{text:'La tua edizione cartacea può essere diversa: cercheremo il passaggio corrispondente o una scena vicina. Potrai sempre scegliere il capitolo.'});
 const tabs=el('div',{className:'rem-paper-methods',attrs:{role:'group','aria-label':'Come indicare il punto'}});
 const methods=[
  ['photo','📷 Fotografa'],['voice','🎙️ Leggi'],['text','✍️ Scrivi'],['chapter','📖 Capitolo']
 ];
 const methodButtons=new Map();
 const panels=new Map();
 const methodArea=el('div',{className:'rem-paper-method-area'});
 let active='photo';
 const field=el('textarea',{attrs:{rows:'3',placeholder:'Incolla una frase o descrivi la scena…','aria-label':'Frase o descrizione del punto di lettura'}});
 const sharedText=el('div',{className:'rem-paper-text-entry'},[el('label',{text:'Frase o descrizione della scena'}),field]);
 const status=el('p',{className:'sync-status',attrs:{role:'status','aria-live':'polite'}});
 const results=el('div',{className:'sync-results rem-paper-matches'});
 const photo=el('input',{attrs:{type:'file',accept:'image/*',capture:'environment','aria-label':'Fotografa la pagina del libro'}});
 const photoStatus=el('p',{className:'sync-photo-note',text:'La foto resta sul tuo telefono. Per ora usa Testo attivo di iPhone per copiare qualche riga dalla foto, poi incollala qui sotto. Il riconoscimento diretto dentro REM arriverà successivamente.'});
 photo.addEventListener('change',()=>{photoStatus.textContent=photo.files?.length?'Foto selezionata. Aprila nell’app Foto, tieni premuto sul testo e copia alcune righe; poi incollale nel campo sottostante. REM non carica la foto su un server.':'La foto resta sul dispositivo.'});
 const photoPanel=el('div',{className:'rem-paper-method-panel'},[el('strong',{text:'Fotografa una pagina'}),photo,photoStatus]);
 const voiceButton=button('🎙️ Avvia dettatura',()=>startVoice());
 const voiceNote=el('p',{className:'sync-photo-note',text:'Leggi ad alta voce alcune righe oppure racconta la scena. Il riconoscimento vocale del browser può usare servizi esterni; non salviamo registrazioni audio.'});
 const voicePanel=el('div',{className:'rem-paper-method-panel'},[voiceButton,voiceNote]);
 const textPanel=el('div',{className:'rem-paper-method-panel'},[el('p',{text:'Scrivi almeno quattro parole consecutive per una ricerca esatta, oppure descrivi una scena per ottenere suggerimenti orientativi.'})]);
 const chapterSelect=el('select',{attrs:{'aria-label':'Scegli il capitolo del cartaceo'}});
 book.chapters.forEach(c=>chapterSelect.append(el('option',{text:c.title,attrs:{value:c.id}})));
 const chapterPanel=el('div',{className:'rem-paper-method-panel'},[el('label',{text:'Capitolo raggiunto'}),chapterSelect,el('p',{className:'sync-photo-note',text:'Se non riconosci il passaggio, scegli il capitolo manualmente.'})]);
 panels.set('photo',photoPanel);panels.set('voice',voicePanel);panels.set('text',textPanel);panels.set('chapter',chapterPanel);
 for(const [id,label] of methods){
  const b=button(label,()=>setMethod(id));
  b.className='rem-paper-method-button';methodButtons.set(id,b);tabs.append(b);
 }
 function setMethod(id){
  active=id;methodArea.replaceChildren(panels.get(id));
  sharedText.hidden=id==='chapter';
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
  status.textContent=matches[0].approximate?'Possibili punti della storia: scegli quello che riconosci. La posizione è indicativa.':'Testo individuato: verifica il passaggio prima di continuare.';
  for(const item of matches){
   const card=el('section',{className:'rem-paper-match'},[
    el('strong',{text:item.title}),
    el('p',{text:item.context||item.phrase}),
    ...(item.approximate?[el('small',{text:'Corrispondenza orientativa: da verificare'})]:[]),
    el('div',{className:'rem-paper-match-actions'},[
     button('Continua in Ebook',()=>choose(item,'ebook'),true),
     button('Continua in Audio',()=>choose(item,'audio'))
    ])
   ]);
   results.append(card);
  }
 }
 const find=button('Trova il punto',async()=>{
  if(active==='chapter'){
   const item={chapter:chapterSelect.value,title:chapterSelect.selectedOptions[0]?.textContent||'',offset:0,phrase:'',context:'Inizio del capitolo selezionato',approximate:true};
   showResults([item]);return;
  }
  const query=field.value.trim();
  if(!query){status.textContent='Inserisci una frase o una descrizione prima di cercare.';return}
  find.disabled=true;status.textContent='Sto cercando nei capitoli…';results.replaceChildren();
  try{
   let matches=[];
   if(normalize(query).split(/\s+/).length>=4){
    const exact=await findPhrase(book,query);
    matches=(exact.matches||[]).slice(0,4);
   }
   if(!matches.length)matches=await findStoryLocations(book,query);
   showResults(matches);
  }catch(e){status.textContent='Ricerca non riuscita: '+e.message}finally{find.disabled=false}
 },true);
 find.className='rem-paper-find';
 const fallback=button('Scegli direttamente il capitolo',()=>setMethod('chapter'));
 fallback.className='rem-paper-fallback';
 wrap.append(title,intro,tabs,methodArea,sharedText,el('div',{className:'rem-paper-actions'},[find,fallback]),status,results);
 setMethod('photo');
 return wrap;
}
