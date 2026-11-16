import {el,button} from './ui.js';
// Tap-to-bookmark: exactly eight consecutive words when available, including across paragraphs.
const KEY='rem-next-v1:highlight:';
const WORD=/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
export function createHighlights(bookId,chapterId,textNode,onSwitch,onBookmark=()=>{},onSaveThought=()=>{}){
 const key=KEY+bookId+':'+chapterId;
 let marks=[];try{marks=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(marks))marks=[]}catch{marks=[]}
 const source={value:''};
 function cleanRange(start,end){
  const raw=source.value;
  const words=[...raw.matchAll(WORD)].map(m=>({start:m.index,end:m.index+m[0].length}));
  const first=words.findIndex(w=>w.end>start&&w.start<end);
  if(first<0)return null;
  const last=Math.min(words.length-1,first+7);
  return {start:words[first].start,end:words[last].end,quote:raw.slice(words[first].start,words[last].end)};
 }
 const hint=el('p',{className:'selection-hint',text:'Tocco veloce: 8 parole per la sincronizzazione. Tieni premuto e trascina i cursori per selezionare liberamente una frase da salvare nei pensieri.'});
 const clear=button('Rimuovi evidenziazioni',()=>{marks=[];selectedQuote='';saveThought.hidden=true;persist();draw()});
 clear.classList.add('selection-clear');
 const wrap=el('div',{className:'highlight-tools'});
 let selectedQuote='';let selectionMode=false;let longPressTimer=null;let selectionTimer=null;
 const selectionPaint=el('div',{className:'rem-free-selection-paint',attrs:{'aria-hidden':'true'}});
 document.body.append(selectionPaint);
 function clearSelectionPaint(){selectionPaint.replaceChildren()}
 function paintNativeSelection(){
  clearSelectionPaint();
  const selection=window.getSelection();
  if(!selection||selection.isCollapsed||!selection.rangeCount)return;
  const range=selection.getRangeAt(0);
  if(!textNode.contains(range.startContainer)||!textNode.contains(range.endContainer))return;
  const bounds=textNode.getBoundingClientRect();
  for(const rect of range.getClientRects()){
   if(rect.width<2||rect.height<2||rect.bottom<bounds.top||rect.top>bounds.bottom)continue;
   const swatch=el('span',{className:'rem-free-selection-swatch'});
   swatch.style.left=rect.left+'px';swatch.style.top=rect.top+'px';
   swatch.style.width=rect.width+'px';swatch.style.height=rect.height+'px';
   selectionPaint.append(swatch);
  }
 }

 const saveThought=button('Salva nei miei pensieri',()=>{if(!selectedQuote)return;onSaveThought(selectedQuote);window.getSelection()?.removeAllRanges();selectionMode=false;clearSelectionPaint();saveThought.textContent='✓ Salvato nei miei pensieri';saveThought.disabled=true;});
 saveThought.className='rem-save-highlight-thought';saveThought.hidden=true;wrap.append(saveThought);

 function persist(){try{localStorage.setItem(key,JSON.stringify(marks))}catch{}}
 function draw(){
  const raw=source.value;textNode.replaceChildren();
  const ordered=marks.filter(m=>Number.isInteger(m.start)&&Number.isInteger(m.end)&&m.start>=0&&m.end<=raw.length&&m.end>m.start&&raw.slice(m.start,m.end)===m.quote).map(m=>cleanRange(m.start,m.end)).filter(Boolean).sort((a,b)=>a.start-b.start);
  let at=0;for(const m of ordered){if(m.start<at)continue;textNode.append(document.createTextNode(raw.slice(at,m.start)));textNode.append(el('mark',{className:'rem-highlight',text:raw.slice(m.start,m.end)}));at=m.end}
  textNode.append(document.createTextNode(raw.slice(at)));
 }
 function setText(value){source.value=value;selectionMode=false;clearSelectionPaint();draw()}
 function highlightPhrase(offset,phrase){
  const raw=source.value;
  if(!Number.isInteger(offset)||offset<0||offset>=raw.length||!phrase)return null;
  const end=offset+phrase.length;
  if(raw.slice(offset,end)!==phrase)return null;
  const clean=cleanRange(offset,end);if(!clean)return null;marks=[clean];persist();draw();
  return textNode.querySelector('mark.rem-highlight');
 }
 function offsetFromPoint(x,y){
  let range=null;
  if(document.caretRangeFromPoint)range=document.caretRangeFromPoint(x,y);
  else if(document.caretPositionFromPoint){const p=document.caretPositionFromPoint(x,y);if(p){range=document.createRange();range.setStart(p.offsetNode,p.offset);range.collapse(true)}}
  if(!range||!textNode.contains(range.startContainer))return null;
  const before=range.cloneRange();before.selectNodeContents(textNode);before.setEnd(range.startContainer,range.startOffset);
  return before.toString().length;
 }
 function selectAt(x,y){
  const offset=offsetFromPoint(x,y);if(offset===null||!source.value)return false;
  const words=[...source.value.matchAll(WORD)].map(m=>({start:m.index,end:m.index+m[0].length}));
  let index=words.findIndex(w=>offset>=w.start&&offset<=w.end);
  if(index<0)index=words.findIndex(w=>w.start>offset);
  if(index<0)return false;
  const start=words[index].start,end=words[Math.min(words.length-1,index+7)].end,clean=cleanRange(start,end);if(!clean)return false;
  marks=[clean];persist();draw();selectedQuote=clean.quote;saveThought.hidden=false;saveThought.disabled=false;saveThought.textContent='Salva nei miei pensieri';onBookmark(clean.quote,clean.start);
  window.getSelection()?.removeAllRanges();return true;
 }
 let touch=null,lastTouch=0,suppressClickUntil=0;
 function setSaveQuote(quote){selectedQuote=quote;saveThought.hidden=false;saveThought.disabled=false;saveThought.textContent='Salva nei miei pensieri'}
 function readNativeSelection(){
  const selection=window.getSelection();
  if(!selection||selection.isCollapsed||!selection.rangeCount)return false;
  const range=selection.getRangeAt(0);
  if(!textNode.contains(range.startContainer)||!textNode.contains(range.endContainer))return false;
  const quote=selection.toString().trim();
  if(!quote)return false;
  selectionMode=true;setSaveQuote(quote);paintNativeSelection();return true;
 }
 function selectionChanged(){
  if(!selectionMode)return;
  clearTimeout(selectionTimer);
  selectionTimer=setTimeout(()=>{if(!readNativeSelection())clearSelectionPaint()},45);
 }
 function touchStart(e){
  if(e.touches.length!==1)return;
  clearTimeout(longPressTimer);
  const t=e.touches[0];touch={x:t.clientX,y:t.clientY,moved:false,started:Date.now(),long:false};
  longPressTimer=setTimeout(()=>{if(touch&&!touch.moved){touch.long=true;selectionMode=true;suppressClickUntil=Date.now()+1100}},420);
 }
 function touchMove(e){
  if(!touch)return;
  const t=e.touches[0];
  if(Math.hypot(t.clientX-touch.x,t.clientY-touch.y)>12){touch.moved=true;clearTimeout(longPressTimer)}
 }
 function touchEnd(e){
  clearTimeout(longPressTimer);
  if(!touch)return;
  const t=e.changedTouches[0],start=touch;touch=null;
  if(start.long||selectionMode&&Date.now()-start.started>=420){
   suppressClickUntil=Date.now()+1100;
   setTimeout(()=>readNativeSelection(),120);
   return;
  }
  if(start.moved||Math.hypot(t.clientX-start.x,t.clientY-start.y)>12)return;
  if(window.getSelection()?.toString().trim()){selectionMode=true;readNativeSelection();return}
  selectionMode=false;
  if(selectAt(t.clientX,t.clientY)){lastTouch=Date.now();e.preventDefault()}
 }
 function click(e){
  if(Date.now()<suppressClickUntil||Date.now()-lastTouch<650)return;
  if(window.getSelection()?.toString().trim()){selectionMode=true;readNativeSelection();return}
  selectionMode=false;selectAt(e.clientX,e.clientY)
 }
 function contextMenu(){selectionMode=true;suppressClickUntil=Date.now()+1100;setTimeout(()=>readNativeSelection(),100)}
 function refreshSelectionPaint(){if(selectionMode)paintNativeSelection()}
 textNode.addEventListener('touchstart',touchStart,{passive:true});
 textNode.addEventListener('touchmove',touchMove,{passive:true});
 textNode.addEventListener('touchend',touchEnd,{passive:false});
 textNode.addEventListener('click',click);
 textNode.addEventListener('contextmenu',contextMenu);
 document.addEventListener('selectionchange',selectionChanged);
 document.addEventListener('scroll',refreshSelectionPaint,true);
 window.addEventListener('resize',refreshSelectionPaint);
 function destroy(){
  clearTimeout(longPressTimer);clearTimeout(selectionTimer);
  textNode.removeEventListener('touchstart',touchStart);
  textNode.removeEventListener('touchmove',touchMove);
  textNode.removeEventListener('touchend',touchEnd);
  textNode.removeEventListener('click',click);
  textNode.removeEventListener('contextmenu',contextMenu);
  document.removeEventListener('selectionchange',selectionChanged);
  document.removeEventListener('scroll',refreshSelectionPaint,true);
  window.removeEventListener('resize',refreshSelectionPaint);
  selectionPaint.remove();
 }
 return {wrap,setText,highlightPhrase,destroy};
}
