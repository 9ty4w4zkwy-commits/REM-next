import {el,button} from './ui.js';
import {chapterPicker} from './chapter-picker.js?v=compact-picker-20261124';
import {getSetting,saveSetting} from './progress.js';
import {createReaderTools} from './reader-tools.js';

// Riassunti editoriali: terza persona, cronologia degli eventi, niente dialoghi ricopiati.
// Per un capitolo non ancora curato non mostrare frammenti automatici e incoerenti.
function narrativeParagraphs(value){
 const str=String(value||'').trim();
 if(!str)return [];
 const explicit=str.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);
 if(explicit.length>1)return explicit;
 const sentences=str.match(/[^.!?…]+(?:[.!?…]+|$)/g)?.map(x=>x.trim()).filter(Boolean)||[];
 if(sentences.length<5)return [str];
 const chunks=[];
 const groupSize=Math.max(2,Math.ceil(sentences.length/4));
 for(let i=0;i<sentences.length;i+=groupSize)chunks.push(sentences.slice(i,i+groupSize).join(' '));
 return chunks;
}
export function summaryView(book,onClose,onContinue){
 const root=el('section',{className:'summary-shell'});
 const title=el('h2',{text:'Il tuo riassunto'});
 const intro=el('p',{text:'Scegli un capitolo del libro completo. Il riassunto racconta in terza persona gli avvenimenti principali del capitolo, in ordine e senza dialoghi o anticipazioni.'});
 const label=el('label',{text:'Capitolo da riassumere'});
 const select=document.createElement('select');select.setAttribute('aria-label','Capitolo da riassumere');
 book.chapters.forEach(c=>{const opt=document.createElement('option');opt.value=c.id;opt.textContent=c.title;select.append(opt)});
 select.value=getSetting('summary-chapter:'+book.id,book.chapters[0]?.id||'');
 const formats=el('div',{className:'summary-formats'});
 const ebook=button('Ebook',()=>{});
 formats.append(ebook);
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
 const finish=button('Continua dal capitolo successivo →',()=>{stopSpeech();const idx=book.chapters.findIndex(c=>c.id===select.value);onContinue(book.chapters[idx+1]?.id||select.value)},true);
 const back=button('← Torna al libro',()=>{stopSpeech();onClose()});
 let currentText='',generation=0;
 function stopSpeech(){if('speechSynthesis' in window)window.speechSynthesis.cancel()}
 function current(){return book.chapters.find(c=>c.id===select.value)}
 async function renderSummary(){
  const token=++generation;stopSpeech();saveSetting('summary-chapter:'+book.id,select.value);
  const chapter=current();currentText='';output.replaceChildren(el('h3',{text:chapter?.title||''}),el('p',{text:'Preparazione della sintesi…'}));
  status.textContent='';finish.disabled=true;
  ebook.classList.add('is-selected');
  ebook.setAttribute('aria-pressed','true');
  if(!chapter){status.textContent='Nessun capitolo disponibile.';return}
  try{
   const key=book.id+':'+chapter.id;
   if(!cache.has(key))cache.set(key,Promise.resolve(chapter.summary?.trim()||''));
   const result=await cache.get(key);if(token!==generation||!root.isConnected)return;
   currentText=result;output.replaceChildren(el('h3',{text:chapter.title}),...(result?narrativeParagraphs(result).map(part=>el('p',{text:part})):[el('p',{text:'Il riassunto narrativo di questo capitolo è in preparazione.'})]));
   status.textContent='';
   finish.disabled=!result;
  }catch(error){if(token!==generation||!root.isConnected)return;output.replaceChildren(el('h3',{text:chapter.title}),el('p',{text:'Non è stato possibile caricare il testo del capitolo.'}));status.textContent=error.message||'Errore di caricamento'}
 }
 select.addEventListener('change',renderSummary);
 root.append(title,intro,label,chapterPicker(select),el('p',{text:'Scegli il formato del riassunto'}),formats,readingShell,el('div',{className:'summary-actions'},[back,finish]));
 renderSummary();return root;
}
