import {mountImmersiveReader} from './immersive-reader.js?v=immersive-focus-mint-20261126';
import {el,button} from './ui.js';
import {chapterPicker} from './chapter-picker.js?v=picker-close-above-20261126';
import {getSetting,saveSetting} from './progress.js';
import {createReaderTools} from './reader-tools.js?v=immersive-focus-mint-20261126';

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
 const label=el('label',{text:'Capitolo da riassumere'});
 const select=document.createElement('select');select.setAttribute('aria-label','Capitolo da riassumere');
 book.chapters.forEach(c=>{const opt=document.createElement('option');opt.value=c.id;opt.textContent=c.title;select.append(opt)});
 select.value=getSetting('summary-chapter:'+book.id,book.chapters[0]?.id||'');
 if(!select.value&&book.chapters.length)select.value=book.chapters[0].id;
 const output=el('article',{className:'summary-content reading-text',attrs:{'aria-live':'polite'}});
 const page=el('div',{className:'ebook-page-frame summary-page-frame'},[output]);
 const readingShell=el('section',{className:'reading-shell ebook-reading-shell summary-reading-shell'});
 const readerTools=createReaderTools();
 const move=delta=>{
  select.selectedIndex+=delta;
  renderSummary();
  output.scrollTop=0;
 };
 const prev=button('',()=>move(-1));
 const next=button('',()=>move(1));
 readingShell.append(page);
 readerTools.mount(readingShell);
 const immersive=mountImmersiveReader({readingShell,text:output,readingUnitTitle:'Riassunto · '+book.title,prev,next,getReaderTools:()=>readerTools,onFullscreen:open=>readingShell.classList.toggle('summary-reading-shell',!open)});
 const observer=new MutationObserver(()=>{if(!root.isConnected){readerTools.destroy();observer.disconnect()}});
 queueMicrotask(()=>observer.observe(document.body,{childList:true,subtree:true}));
 const finish=button('Continua dal capitolo successivo →',()=>{const idx=book.chapters.findIndex(c=>c.id===select.value);onContinue(book.chapters[idx+1]?.id||select.value)},true);
 const back=button('← Torna al libro',onClose);
 function current(){return book.chapters.find(c=>c.id===select.value)}
 function renderSummary(){
  saveSetting('summary-chapter:'+book.id,select.value);
  const chapter=current();const currentText=typeof chapter?.summary==='string'?chapter.summary.trim():'';
  output.replaceChildren(el('h3',{text:chapter?.title||''}),...(currentText?narrativeParagraphs(currentText).map(part=>el('p',{text:part})):[el('p',{text:chapter?'Il riassunto narrativo di questo capitolo è in preparazione.':'Nessun capitolo disponibile.'})]));
  finish.disabled=!currentText;
  prev.disabled=select.selectedIndex<=0;
  next.disabled=select.selectedIndex<0||select.selectedIndex>=select.options.length-1;
  immersive.updateNavigation();
 }
 select.addEventListener('change',renderSummary);
 root.append(title,label,chapterPicker(select),readingShell,el('div',{className:'summary-actions'},[back,finish]));
 renderSummary();return root;
}
