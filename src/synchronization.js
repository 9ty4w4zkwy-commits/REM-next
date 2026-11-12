import {el,button} from './ui.js';
import {loadChapter} from './catalog.js';
import {getSetting,saveSetting} from './progress.js';

// A phrase bookmark is independent of the reader UI and of the current format.
export function savePhrase(bookId,chapterId,phrase,offset){
 const record={chapter:chapterId,phrase,offset,updatedAt:new Date().toISOString()};
 saveSetting('sync-point:'+bookId,JSON.stringify(record));return record;
}
export function getPhrase(bookId){try{return JSON.parse(getSetting('sync-point:'+bookId,'null'))}catch{return null}}
const normalize=s=>s.toLocaleLowerCase('it').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'").replace(/[^\p{L}\p{N}]+/gu,' ').trim();
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
export function phraseSearch(book,onFound){
 const wrap=el('section',{className:'sync-search'});
 const title=el('h2',{text:'Indica il punto di lettura'});
 const intro=el('p',{text:'Scrivi almeno quattro parole consecutive del libro cartaceo. Cercheremo la frase nel testo digitale di questa edizione.'});
 const photoLabel=el('label',{text:'1 · Carica una foto del cartaceo (opzionale)'});
 const photo=el('input',{attrs:{type:'file',accept:'image/*','aria-label':'Foto della pagina cartacea'}});
 const photoNote=el('p',{className:'sync-photo-note',text:'La foto resta sul dispositivo. Il riconoscimento automatico del testo non è ancora disponibile.'});
 const pageLabel=el('label',{text:'Pagina cartacea (opzionale)'});
 const page=el('input',{attrs:{type:'number',min:'1',inputmode:'numeric',placeholder:'Es. 7','aria-label':'Numero pagina cartacea'}});
 const phraseLabel=el('label',{text:'Ultime 4 parole o una frase'});
 const field=el('textarea',{attrs:{rows:'3',placeholder:'Inserisci una frase del libro…','aria-label':'Frase da cercare'}});
 const submit=button('Passa a Ebook',async()=>{
  results.replaceChildren();submit.classList.add('is-selected');submit.setAttribute('aria-pressed','true');
  if(!field.value.trim()){onFound(null,'ebook');return}
  submit.disabled=true;
  status.textContent='Ricerca in corso…';
  try{const found=await findPhrase(book,field.value);if(found.matches?.length===1){const item=found.matches[0];savePhrase(book.id,item.chapter,item.phrase,item.offset);onFound(item,'ebook');return}status.textContent=found.error||(!found.matches.length?'Nessuna corrispondenza trovata. Controlla la frase e l’edizione.':found.matches.length+' corrispondenza/e trovata/e.');
   for(const item of found.matches.slice(0,12)){const action=button('Apri qui nell’Ebook',()=>{savePhrase(book.id,item.chapter,item.phrase,item.offset);onFound(item,'ebook')});results.append(el('div',{className:'sync-match'},[el('strong',{text:item.title}),el('p',{text:'…'+item.context+'…'}),action]))}
  }catch(e){status.textContent='Impossibile cercare nel testo: '+e.message}finally{submit.disabled=false;submit.classList.remove('is-selected');submit.setAttribute('aria-pressed','false')}
 },true);
 const audioSwitch=button('Passa ad Audio',()=>{audioSwitch.classList.add('is-selected');audioSwitch.setAttribute('aria-pressed','true');onFound(null,'audio')});
 audioSwitch.classList.add('sync-switch-audio');
 const switchActions=el('div',{className:'sync-switch-actions'},[submit,audioSwitch]);
 const status=el('p',{className:'sync-status',attrs:{role:'status'}});
 const results=el('div',{className:'sync-results'});
 wrap.append(title,intro,photoLabel,photo,photoNote,el('h3',{text:'2 · Indica il punto di lettura'}),pageLabel,page,phraseLabel,field,switchActions,status,results);return wrap;
}
