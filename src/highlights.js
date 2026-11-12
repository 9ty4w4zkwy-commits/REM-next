import {el,button} from './ui.js';
// Isolated text selection/highlight module. Quotes are stored locally per book/chapter.
const KEY='rem-next-v1:highlight:';
export function createHighlights(bookId,chapterId,textNode,onSwitch){
 const key=KEY+bookId+':'+chapterId;
 let selectedQuote='';let marks=[];try{marks=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(marks))marks=[]}catch{marks=[]}
 const toolbar=el('div',{className:'selection-actions'});
 const hint=el('p',{className:'selection-hint',text:'Seleziona una frase del testo per evidenziarla e scegliere se passare a Cartaceo o Audio.'});
 const quote=el('p',{className:'selection-quote'});
 const highlight=button('Evidenzia',()=>{const s=getSelectionText()||selectedQuote;if(!s)return;const start=plainText().indexOf(s);if(start<0)return;marks.push({start,end:start+s.length,quote:s});persist();draw();hide()});
 const paper=button('Passa a Cartaceo',()=>go('paper'));
 const audio=button('Passa ad Audio',()=>go('audio'));
 const clear=button('Rimuovi evidenziazioni',()=>{marks=[];persist();draw();hide()});
 const actions=el('div',{className:'selection-buttons'},[highlight,paper,audio]);
 toolbar.append(quote,actions,clear);toolbar.hidden=true;
 const source={value:''};
 function plainText(){return source.value}
 function persist(){try{localStorage.setItem(key,JSON.stringify(marks))}catch{}}
 function getSelectionText(){const sel=window.getSelection();if(!sel||sel.isCollapsed||!textNode.contains(sel.anchorNode)||!textNode.contains(sel.focusNode))return '';return sel.toString().trim()}
 function hide(){toolbar.hidden=true;window.getSelection()?.removeAllRanges()}
 function go(mode){const s=getSelectionText()||selectedQuote;onSwitch(mode,s);hide()}
 function show(){const s=getSelectionText();if(!s)return;selectedQuote=s;quote.textContent='“'+s.slice(0,170)+(s.length>170?'…':'')+'”';toolbar.hidden=false}
 function draw(){
  const raw=source.value;textNode.replaceChildren();
  const ordered=marks.filter(m=>Number.isInteger(m.start)&&Number.isInteger(m.end)&&m.start>=0&&m.end<=raw.length&&m.end>m.start&&raw.slice(m.start,m.end)===m.quote).sort((a,b)=>a.start-b.start);
  let at=0;for(const m of ordered){if(m.start<at)continue;textNode.append(document.createTextNode(raw.slice(at,m.start)));textNode.append(el('mark',{className:'rem-highlight',text:raw.slice(m.start,m.end)}));at=m.end}
  textNode.append(document.createTextNode(raw.slice(at)));
 }
 function setText(value){source.value=value;draw()}
 function onSelection(){if(getSelectionText())show()}
 textNode.addEventListener('mouseup',onSelection);
 textNode.addEventListener('touchend',()=>setTimeout(onSelection,180));
 toolbar.addEventListener('click',e=>e.stopPropagation());
 const wrap=el('div',{className:'highlight-tools'},[hint,toolbar]);
 function destroy(){textNode.removeEventListener('mouseup',onSelection)}
 return {wrap,setText,destroy};
}
