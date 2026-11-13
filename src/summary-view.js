import {el,button} from './ui.js';
import {getSetting,saveSetting} from './progress.js';

// Editorial summaries are supplied in the catalog, never fabricated from a book.
export function summaryView(book,onClose,onContinue){
 const root=el('section',{className:'summary-shell'});
 const title=el('h2',{text:'Il tuo riassunto'});
 const intro=el('p',{text:'Recupera un capitolo e scegli come fruire il riassunto. Il libro completo resta sempre disponibile.'});
 const label=el('label',{text:'Capitolo da riassumere'});
 const select=el('select',{attrs:{'aria-label':'Capitolo da riassumere'}});
 book.chapters.forEach(c=>select.append(el('option',{text:c.title,attrs:{value:c.id}})));
 select.value=getSetting('summary-chapter:'+book.id,book.chapters[0]?.id||'');
 const formats=el('div',{className:'summary-formats'});
 const ebook=button('Ebook',()=>setFormat('ebook'));
 const audio=button('Audio',()=>setFormat('audio'));
 formats.append(ebook,audio);
 const output=el('article',{className:'summary-content',attrs:{'aria-live':'polite'}});
 const status=el('p',{className:'summary-status',attrs:{role:'status'}});
 const play=button('▶ Ascolta il riassunto',()=>toggleSpeech());
 const finish=button('Continua dal capitolo successivo →',()=>{stopSpeech();const idx=book.chapters.findIndex(c=>c.id===select.value);onContinue(book.chapters[idx+1]?.id||select.value)},true);
 const back=button('← Torna al libro',()=>{stopSpeech();onClose()});
 let mode='ebook',speaking=false;
 function stopSpeech(){if('speechSynthesis' in window)window.speechSynthesis.cancel();speaking=false;play.textContent='▶ Ascolta il riassunto'}
 function current(){return book.chapters.find(c=>c.id===select.value)}
 function renderSummary(){stopSpeech();saveSetting('summary-chapter:'+book.id,select.value);const chapter=current();const summary=chapter?.summary||'';output.replaceChildren(el('h3',{text:chapter?.title||''}),el('p',{text:summary||'Il riassunto di questo capitolo non è ancora disponibile.'}));status.textContent=summary?'Riassunto editoriale dimostrativo. Non sostituisce il testo integrale.':'Per questo capitolo serve un riassunto editoriale verificato.';finish.disabled=!summary;play.disabled=!summary||!('speechSynthesis' in window);play.hidden=mode!=='audio';ebook.classList.toggle('is-selected',mode==='ebook');audio.classList.toggle('is-selected',mode==='audio');ebook.setAttribute('aria-pressed',String(mode==='ebook'));audio.setAttribute('aria-pressed',String(mode==='audio'))}
 function setFormat(next){mode=next;renderSummary()}
 function toggleSpeech(){if(speaking){stopSpeech();return}const summary=current()?.summary;if(!summary||!('speechSynthesis' in window))return;stopSpeech();const utterance=new SpeechSynthesisUtterance(summary);utterance.lang='it-IT';utterance.rate=.92;utterance.onend=()=>{speaking=false;play.textContent='▶ Ascolta il riassunto'};utterance.onerror=()=>{speaking=false;play.textContent='▶ Ascolta il riassunto';status.textContent='La lettura vocale non è disponibile su questo dispositivo.'};window.speechSynthesis.speak(utterance);speaking=true;play.textContent='■ Ferma audio'}
 select.addEventListener('change',renderSummary);
 root.append(title,intro,label,select,el('p',{text:'Scegli il formato del riassunto'}),formats,output,play,status,el('div',{className:'summary-actions'},[back,finish]));
 renderSummary();return root;
}
