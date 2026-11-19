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
 const hint=el('p',{className:'selection-hint',text:'Tocca una parola per sincronizzare 8 parole. Attiva il pennino rosa per selezionare liberamente e salvare nei pensieri.'});
 const clear=button('Rimuovi evidenziazioni',()=>{marks=[];selectedQuote='';saveThought.hidden=true;persist();draw()});
 clear.classList.add('selection-clear');
 const wrap=el('div',{className:'highlight-tools'});
 let enabled=false;let selectedQuote='';let selectionMode=false;let longPressTimer=null;let selectionTimer=null;let customMode=false;let customAnchor=0;let customEnd=0;
 const selectionPaint=el('div',{className:'rem-free-selection-paint',attrs:{'aria-hidden':'true'}});
 document.body.append(selectionPaint);
 function clearSelectionPaint(){selectionPaint.replaceChildren()}
 function customRangePaint(){
  clearSelectionPaint();
  const start=Math.min(customAnchor,customEnd),end=Math.max(customAnchor,customEnd);
  if(end<=start)return;
  const range=document.createRange();
  const walker=document.createTreeWalker(textNode,NodeFilter.SHOW_TEXT);
  let pos=0,first=null,last=null,node;
  while((node=walker.nextNode())){
   const next=pos+node.textContent.length;
   if(first===null&&start<next)first=[node,Math.max(0,start-pos)];
   if(last===null&&end<=next)last=[node,Math.max(0,end-pos)];
   pos=next;
  }
  if(!first||!last)return;
  range.setStart(...first);range.setEnd(...last);
  for(const rect of range.getClientRects()){
   if(rect.width<2||rect.height<2)continue;
   const swatch=el('span',{className:'rem-free-selection-swatch'});
   swatch.style.left=rect.left+'px';swatch.style.top=rect.top+'px';
   swatch.style.width=rect.width+'px';swatch.style.height=rect.height+'px';
   selectionPaint.append(swatch);
  }
 }
 function customSelect(x,y,initial=false){
  const offset=offsetFromPoint(x,y);if(offset===null)return;
  const words=[...source.value.matchAll(WORD)].map(m=>({start:m.index,end:m.index+m[0].length}));
  let idx=words.findIndex(w=>offset>=w.start&&offset<=w.end);if(idx<0)idx=words.findIndex(w=>w.start>offset);if(idx<0)return;
  if(initial)customAnchor=words[idx].start;
  customEnd=offset<customAnchor?words[idx].start:words[idx].end;
  const start=Math.min(customAnchor,customEnd),end=Math.max(customAnchor,customEnd);
  setSaveQuote(source.value.slice(start,end));customRangePaint();
 }
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

 let savedNoticeTimer=null;
 const saveThought=button('Salva nei miei pensieri',()=>{if(!selectedQuote)return;onSaveThought(selectedQuote);window.getSelection()?.removeAllRanges();selectionMode=false;customMode=false;textNode.classList.remove('rem-custom-selecting');clearSelectionPaint();saveThought.textContent='✓ Salvato nei miei pensieri';saveThought.disabled=true;clearTimeout(savedNoticeTimer);savedNoticeTimer=setTimeout(()=>{saveThought.hidden=true;selectedQuote='';saveThought.disabled=false;saveThought.textContent='Salva nei miei pensieri';},2000);});
 saveThought.className='rem-save-highlight-thought';saveThought.hidden=true;wrap.append(saveThought);

 function persist(){try{localStorage.setItem(key,JSON.stringify(marks))}catch{}}
 function draw(){
  const raw=source.value;textNode.replaceChildren();
  const ordered=marks.filter(m=>Number.isInteger(m.start)&&Number.isInteger(m.end)&&m.start>=0&&m.end<=raw.length&&m.end>m.start&&raw.slice(m.start,m.end)===m.quote).map(m=>cleanRange(m.start,m.end)).filter(Boolean).sort((a,b)=>a.start-b.start);
  let at=0;for(const m of ordered){if(m.start<at)continue;textNode.append(document.createTextNode(raw.slice(at,m.start)));textNode.append(el('mark',{className:'rem-highlight',text:raw.slice(m.start,m.end)}));at=m.end}
  textNode.append(document.createTextNode(raw.slice(at)));
 }
 function setText(value){source.value=value;selectedQuote='';saveThought.hidden=true;selectionMode=false;customMode=false;textNode.classList.remove('rem-custom-selecting');clearSelectionPaint();draw()}
 function highlightPhrase(offset,phrase){
  const raw=source.value;
  if(!Number.isInteger(offset)||offset<0||offset>=raw.length||!phrase)return null;
  const end=offset+phrase.length;
  if(raw.slice(offset,end)!==phrase)return null;
  const clean=cleanRange(offset,end);if(!clean)return null;marks=[clean];persist();draw();
  return textNode.querySelector('mark.rem-highlight');
 }
 function offsetFromPoint(x,y){
  // iOS may return no caret when -webkit-user-select:none is active.
  // Resolve taps from DOM word rectangles instead of relying on native selection.
  const nodes=[];const walker=document.createTreeWalker(textNode,NodeFilter.SHOW_TEXT);
  let node,total=0;
  while((node=walker.nextNode())){nodes.push({node,start:total,end:total+node.textContent.length});total+=node.textContent.length}
  const locate=offset=>{
   for(const item of nodes){if(offset>=item.start&&offset<=item.end)return [item.node,offset-item.start]}
   return null;
  };
  const words=[...source.value.matchAll(WORD)];
  let best=null,bestDistance=Infinity;
  const range=document.createRange();
  for(const match of words){
   const first=locate(match.index),last=locate(match.index+match[0].length);
   if(!first||!last)continue;
   try{range.setStart(...first);range.setEnd(...last)}catch{continue}
   for(const rect of range.getClientRects()){
    if(!rect.width||!rect.height)continue;
    const dx=Math.max(rect.left-x,0,x-rect.right);
    const dy=Math.max(rect.top-y,0,y-rect.bottom);
    const distance=dx*dx+dy*dy;
    if(distance<bestDistance){bestDistance=distance;best=match.index}
    if(distance===0)return match.index;
   }
  }
  return bestDistance<2500?best:null;
 }
 function selectAt(x,y){
  const offset=offsetFromPoint(x,y);if(offset===null||!source.value)return false;
  const words=[...source.value.matchAll(WORD)].map(m=>({start:m.index,end:m.index+m[0].length}));
  let index=words.findIndex(w=>offset>=w.start&&offset<=w.end);
  if(index<0)index=words.findIndex(w=>w.start>offset);
  if(index<0)return false;
  const start=words[index].start,end=words[Math.min(words.length-1,index+7)].end,clean=cleanRange(start,end);if(!clean)return false;
  marks=[clean];persist();draw();clearTimeout(savedNoticeTimer);selectedQuote='';saveThought.hidden=true;saveThought.disabled=false;saveThought.textContent='Salva nei miei pensieri';clearSelectionPaint();onBookmark(clean.quote,clean.start);
  window.getSelection()?.removeAllRanges();return true;
 }
 let touch=null,lastTouch=0,suppressClickUntil=0;
 function setEnabled(value){
  enabled=Boolean(value);
  touch=null;customMode=false;selectionMode=false;
  window.getSelection()?.removeAllRanges();
  textNode.classList.remove('rem-custom-selecting');
  textNode.classList.toggle('rem-thought-pen-active',enabled);
  clearSelectionPaint();selectedQuote='';saveThought.hidden=true;saveThought.disabled=false;
  saveThought.textContent='Salva nei miei pensieri';
 }
 function thoughtAt(x,y){
  const offset=offsetFromPoint(x,y);if(offset===null||!source.value)return false;
  const words=[...source.value.matchAll(WORD)];
  const index=words.findIndex(w=>offset>=w.index&&offset<=w.index+w[0].length);
  if(index<0)return false;
  customAnchor=words[index].index;
  customEnd=customAnchor+words[index][0].length;
  setSaveQuote(source.value.slice(customAnchor,customEnd));
  customRangePaint();
  return true;
 }
 function touchStart(e){
  if(e.touches.length!==1)return;
  const t=e.touches[0];
  touch={x:t.clientX,y:t.clientY,started:Date.now(),moved:false,dragging:false};
  if(enabled){
   // Start a thought selection immediately; do not depend on a later click,
   // which iOS can suppress when native selection is disabled.
   thoughtAt(t.clientX,t.clientY);
  }
 }
 function touchMove(e){
  if(!touch||e.touches.length!==1)return;
  const t=e.touches[0];
  if(Math.hypot(t.clientX-touch.x,t.clientY-touch.y)>11)touch.moved=true;
  if(!enabled)return;
  if(touch.moved){
   touch.dragging=true;customMode=true;
   textNode.classList.add('rem-custom-selecting');
   e.preventDefault();
   customSelect(t.clientX,t.clientY);
  }
 }
 function touchEnd(e){
  if(!touch)return;
  const start=touch;touch=null;
  const t=e.changedTouches[0];if(!t)return;
  if(enabled){
   if(start.dragging)customSelect(t.clientX,t.clientY);
   textNode.classList.remove('rem-custom-selecting');customMode=false;
   suppressClickUntil=Date.now()+700;
   e.preventDefault();
   return;
  }
  if(start.moved||Math.hypot(t.clientX-start.x,t.clientY-start.y)>11||Date.now()-start.started>380)return;
  if(selectAt(t.clientX,t.clientY)){lastTouch=Date.now();e.preventDefault()}
 }
 function click(e){
  if(Date.now()<suppressClickUntil||Date.now()-lastTouch<650)return;
  if(enabled){thoughtAt(e.clientX,e.clientY);}
  else selectAt(e.clientX,e.clientY);
 }
 function contextMenu(e){e.preventDefault()}
 function refreshSelectionPaint(){if(enabled&&selectedQuote)customRangePaint()}
 textNode.addEventListener('touchstart',touchStart,{passive:true});
 textNode.addEventListener('touchmove',touchMove,{passive:false});
 textNode.addEventListener('touchend',touchEnd,{passive:false});
 textNode.addEventListener('click',click);
 textNode.addEventListener('contextmenu',contextMenu);
 document.addEventListener('scroll',refreshSelectionPaint,true);
 window.addEventListener('resize',refreshSelectionPaint);
 function destroy(){
  clearTimeout(longPressTimer);clearTimeout(selectionTimer);clearTimeout(savedNoticeTimer);
  textNode.removeEventListener('touchstart',touchStart);
  textNode.removeEventListener('touchmove',touchMove);
  textNode.removeEventListener('touchend',touchEnd);
  textNode.removeEventListener('click',click);
  textNode.removeEventListener('contextmenu',contextMenu);
  
  document.removeEventListener('scroll',refreshSelectionPaint,true);
  window.removeEventListener('resize',refreshSelectionPaint);
  textNode.classList.remove('rem-custom-selecting','rem-thought-pen-active');selectionPaint.remove();
 }
 return {wrap,setText,highlightPhrase,setEnabled,destroy};
}
