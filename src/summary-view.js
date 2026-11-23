import {el,button} from './ui.js';
import {getSetting,saveSetting} from './progress.js';
import {loadChapter} from './catalog.js?v=ovidio-mini-20261123';
import {createReaderTools} from './reader-tools.js';

// Sintesi estrattiva: usa esclusivamente frasi del capitolo originale.
// Nessuna trama o evento viene inventato.
function extractSummary(source){
 const clean=source.replace(/\r/g,'').replace(/\s+/g,' ').trim();
 const sentences=clean.match(/[^.!?…]+(?:[.!?…]+|$)/g)?.map(s=>s.trim()).filter(s=>s.length>25)||[];
 if(!sentences.length)return clean.slice(0,1200);
 const target=190;
 const indices=new Set();
 const n=sentences.length;
 const bands=[[0,Math.ceil(n*.3)],[Math.floor(n*.3),Math.ceil(n*.7)],[Math.floor(n*.7),n]];
 let count=0;
 for(const [start,end] of bands){
  const quota=Math.ceil(target/3);
  let bandWords=0;
  for(let i=start;i<end;i++){
   const words=sentences[i].split(/\s+/).length;
   if(bandWords>=quota)break;
   indices.add(i);bandWords+=words;count+=words;
  }
 }
 return [...indices].sort((a,b)=>a-b).map(i=>sentences[i]).join('\n\n');
}
const cache=new Map();
export function summaryView(book,onClose,onContinue){
 const root=el('section',{className:'summary-shell'});
 const title=el('h2',{text:'Il tuo riassunto'});
 const intro=el('p',{text:'Scegli un capitolo del libro completo. La sintesi seleziona i passaggi essenziali dal testo originale, senza aggiungere eventi.'});
 const label=el('label',{text:'Capitolo da riassumere'});
 const select=document.createElement('select');select.setAttribute('aria-label','Capitolo da riassumere');
 book.chapters.forEach(c=>{const opt=document.createElement('option');opt.value=c.id;opt.textContent=c.title;select.append(opt)});
 select.value=getSetting('summary-chapter:'+book.id,book.chapters[0]?.id||'');
 const formats=el('div',{className:'summary-formats'});
 const ebook=button('Ebook',()=>setFormat('ebook'));
 const audio=button('Audio',()=>setFormat('audio'));
 formats.append(ebook,audio);
 const output=el('article',{className:'summary-content reading-text',attrs:{'aria-live':'polite'}});
 const page=el('div',{className:'ebook-page-frame summary-page-frame'},[output]);
 const readingShell=el('section',{className:'reading-shell summary-reading-shell'});
 const readerTools=createReaderTools();
 const fullscreenGlyph=(close=false)=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','22');svg.setAttribute('height','22');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.9');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',close?'M3 3l7 7 M10 5v5H5 M21 21l-7-7 M14 19v-5h5':'M10 10L3 3 M3 9V3h6 M14 14l7 7 M21 15v6h-6');svg.append(path);return svg};
 const full=button('',()=>toggleFullscreen());full.append(fullscreenGlyph());
 full.className='summary-fullscreen-toggle';full.setAttribute('aria-label','Attiva schermo intero');full.title='Schermo intero';
 const exitFull=button('',()=>toggleFullscreen(false));exitFull.append(fullscreenGlyph(true));
 exitFull.className='summary-fullscreen-exit';exitFull.setAttribute('aria-label','Esci da schermo intero');
 const topbar=el('div',{className:'summary-fullscreen-header'},[el('strong',{text:'Riassunto · '+book.title}),exitFull]);
 let isFull=false;
 function toggleFullscreen(force){isFull=typeof force==='boolean'?force:!isFull;root.classList.toggle('summary-is-fullscreen',isFull);document.body.classList.toggle('summary-fullscreen-active',isFull);full.setAttribute('aria-pressed',String(isFull));if(isFull)page.scrollTop=0}
 page.append(full);readingShell.append(topbar,page);readerTools.mount(readingShell);
 const observer=new MutationObserver(()=>{if(!root.isConnected){document.body.classList.remove('summary-fullscreen-active');readerTools.destroy();observer.disconnect()}});
 queueMicrotask(()=>observer.observe(document.body,{childList:true,subtree:true}));
 const status=el('p',{className:'summary-status',attrs:{role:'status'}});
 const play=button('▶ Ascolta il riassunto',()=>toggleSpeech());
 const finish=button('Continua dal capitolo successivo →',()=>{stopSpeech();const idx=book.chapters.findIndex(c=>c.id===select.value);onContinue(book.chapters[idx+1]?.id||select.value)},true);
 const back=button('← Torna al libro',()=>{stopSpeech();onClose()});
 let mode='ebook',speaking=false,currentText='',generation=0;
 function stopSpeech(){if('speechSynthesis' in window)window.speechSynthesis.cancel();speaking=false;play.textContent='▶ Ascolta il riassunto'}
 function current(){return book.chapters.find(c=>c.id===select.value)}
 async function renderSummary(){
  const token=++generation;stopSpeech();saveSetting('summary-chapter:'+book.id,select.value);
  const chapter=current();currentText='';output.replaceChildren(el('h3',{text:chapter?.title||''}),el('p',{text:'Preparazione della sintesi…'}));
  status.textContent='';finish.disabled=true;play.disabled=true;play.hidden=mode!=='audio';
  ebook.classList.toggle('is-selected',mode==='ebook');audio.classList.toggle('is-selected',mode==='audio');
  ebook.setAttribute('aria-pressed',String(mode==='ebook'));audio.setAttribute('aria-pressed',String(mode==='audio'));
  if(!chapter){status.textContent='Nessun capitolo disponibile.';return}
  try{
   const key=book.id+':'+chapter.id;
   if(!cache.has(key))cache.set(key,loadChapter(book,chapter).then(text=>chapter.summary?.trim()||extractSummary(text)).catch(err=>{cache.delete(key);throw err}));
   const result=await cache.get(key);if(token!==generation||!root.isConnected)return;
   currentText=result;output.replaceChildren(el('h3',{text:chapter.title}),el('p',{text:result}));
   status.textContent=chapter.summary?.trim()?'Riassunto editoriale del capitolo.':'Sintesi estrattiva dal testo originale: una selezione di passaggi, non un riassunto editoriale.';
   finish.disabled=false;play.disabled=!(result&&'speechSynthesis' in window);
  }catch(error){if(token!==generation||!root.isConnected)return;output.replaceChildren(el('h3',{text:chapter.title}),el('p',{text:'Non è stato possibile caricare il testo del capitolo.'}));status.textContent=error.message||'Errore di caricamento'}
 }
 function setFormat(next){mode=next;renderSummary()}
 function toggleSpeech(){
  if(speaking){stopSpeech();return}
  if(!currentText||!('speechSynthesis' in window))return;
  stopSpeech();const utterance=new SpeechSynthesisUtterance(currentText);utterance.lang='it-IT';utterance.rate=.92;
  utterance.onend=()=>{speaking=false;play.textContent='▶ Ascolta il riassunto'};
  utterance.onerror=()=>{speaking=false;play.textContent='▶ Ascolta il riassunto';status.textContent='La lettura vocale non è disponibile su questo dispositivo.'};
  window.speechSynthesis.speak(utterance);speaking=true;play.textContent='■ Ferma audio';
 }
 select.addEventListener('change',renderSummary);
 root.append(title,intro,label,select,el('p',{text:'Scegli il formato del riassunto'}),formats,readingShell,play,status,el('div',{className:'summary-actions'},[back,finish]));
 renderSummary();return root;
}
