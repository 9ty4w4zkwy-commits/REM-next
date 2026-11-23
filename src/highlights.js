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
 const hint=el('p',{className:'selection-hint',text:'Pennino spento: tocca per sincronizzare 8 parole. Pennino acceso: trascina lateralmente per evidenziare e salvare nei pensieri.'});
 const clear=button('Rimuovi evidenziazioni',()=>{marks=[];selectedQuote='';saveThought.hidden=true;persist();draw()});
 clear.classList.add('selection-clear');
 const wrap=el('div',{className:'highlight-tools'});
 let enabled=false;let selectedQuote='';let selectionMode=false;let longPressTimer=null;let selectionTimer=null;let customMode=false;let customAnchor=0;let customEnd=0;
 const selectionPaint=el('div',{className:'rem-free-selection-paint',attrs:{'aria-hidden':'true'}});
 document.body.append(selectionPaint);
 function clearSelectionPaint(){selectionPaint.replaceChildren()}
 function customRangePaint(){
  clearSelectionPaint();const raw=source.value;
  const start=Math.min(customAnchor,customEnd),end=Math.max(customAnchor,customEnd);
  if(end<=start)return;
  const range=document.createRange();let pos=0;let a=null,b=null;
  const walker=document.createTreeWalker(textNode,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){const node=walker.currentNode,next=pos+node.length;if(a===null&&start<=next)a=[node,Math.max(0,start-pos)];if(b===null&&end<=next)b=[node,Math.max(0,end-pos)];pos=next}
  if(!a||!b)return;range.setStart(...a);range.setEnd(...b);
  const bounds=textNode.getBoundingClientRect();for(const rect of range.getClientRects()){
   if(rect.width<2||rect.height<2||rect.bottom<bounds.top||rect.top>bounds.bottom)continue;
   const swatch=el('span',{className:'rem-free-selection-swatch'});
   swatch.style.left=rect.left+'px';swatch.style.top=rect.top+'px';swatch.style.width=rect.width+'px';swatch.style.height=rect.height+'px';selectionPaint.append(swatch);
  }
 }
 function customSelect(x,y,initial=false){
  const offset=offsetFromPoint(x,y);if(offset===null)return;
  const words=[...source.value.matchAll(WORD)].map(m=>({start:m.index,end:m.index+m[0].length}));
  // Safari caret positions often land exactly at the start of the NEXT word
  // even while the finger is visually still over the previous one.
  // At that boundary, keep the previous word when selecting forwards.
  let idx=words.findIndex(w=>offset>=w.start&&offset<w.end);
  if(idx<0)idx=words.findIndex(w=>w.start>offset);
  if(idx<0)idx=words.length-1;
  if(initial)customAnchor=words[idx].start;
  if(!initial&&offset===words[idx].start&&idx>0&&offset>customAnchor)idx--;
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
 function setText(value){source.value=value;selectionMode=false;customMode=false;textNode.classList.remove('rem-custom-selecting');clearSelectionPaint();draw()}
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
  marks=[clean];persist();draw();clearTimeout(savedNoticeTimer);selectedQuote='';saveThought.hidden=true;saveThought.disabled=false;saveThought.textContent='Salva nei miei pensieri';clearSelectionPaint();onBookmark(clean.quote,clean.start);
  window.getSelection()?.removeAllRanges();return true;
 }
 let lastMarkTap={time:0,start:-1};
 function removeMarkedPhrase(mark){
  if(!mark||!textNode.contains(mark))return false;
  const before=document.createRange();before.selectNodeContents(textNode);before.setEndBefore(mark);
  const start=before.toString().length;
  const end=start+mark.textContent.length;
  const index=marks.findIndex(m=>m.start===start&&m.end===end);
  if(index<0)return false;
  marks.splice(index,1);persist();draw();
  customMode=false;selectionMode=false;selectedQuote='';
  textNode.classList.remove('rem-custom-selecting');clearSelectionPaint();
  saveThought.hidden=true;window.getSelection()?.removeAllRanges();
  return true;
 }
 function markedAt(target){return target?.closest?.('mark.rem-highlight')||null}
 function doubleMarkTap(target){
  const mark=markedAt(target);if(!mark||!textNode.contains(mark))return false;
  const range=document.createRange();range.selectNodeContents(textNode);range.setEndBefore(mark);
  const start=range.toString().length,now=Date.now();
  if(lastMarkTap.start===start&&now-lastMarkTap.time<420){
   lastMarkTap={time:0,start:-1};return removeMarkedPhrase(mark);
  }
  lastMarkTap={time:now,start};return false;
 }
 let touch=null,lastTouch=0,suppressClickUntil=0;
 function setSaveQuote(quote){clearTimeout(savedNoticeTimer);selectedQuote=quote;saveThought.hidden=false;saveThought.disabled=false;saveThought.textContent='Salva nei miei pensieri'}
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
  if(!enabled||!selectionMode)return;
  clearTimeout(selectionTimer);
  selectionTimer=setTimeout(()=>{if(!readNativeSelection())clearSelectionPaint()},45);
 }
 function touchStart(e){
  if(e.touches.length!==1)return;
  if(markedAt(e.target)&&doubleMarkTap(e.target)){e.preventDefault();touch=null;suppressClickUntil=Date.now()+800;return;}
  clearTimeout(longPressTimer);
  const t=e.touches[0];
  touch={x:t.clientX,y:t.clientY,moved:false,started:Date.now(),custom:false,scrolling:false};
  // Disable native text selection while preserving ordinary vertical page scrolling.
  window.getSelection()?.removeAllRanges();
 }
 function touchMove(e){
  if(!touch||e.touches.length!==1)return;
  if(!enabled)return;
  const t=e.touches[0],dx=t.clientX-touch.x,dy=t.clientY-touch.y;
  if(touch.scrolling)return;
  if(!touch.custom){
   if(Math.hypot(dx,dy)<11)return;
   touch.moved=true;
   if(Math.abs(dy)>Math.abs(dx)*1.2){touch.scrolling=true;return}
   if(Math.abs(dx)<12)return;
   touch.custom=true;customMode=true;selectionMode=false;
   textNode.classList.add('rem-custom-selecting');
   window.getSelection()?.removeAllRanges();
   customSelect(touch.x,touch.y,true);
  }
  if(touch.custom){e.preventDefault();customSelect(t.clientX,t.clientY)}
 }
 function touchEnd(e){
  clearTimeout(longPressTimer);
  if(!touch)return;
  const t=e.changedTouches[0],start=touch;touch=null;
  if(start.custom){e.preventDefault();/* Preserve the last deliberate drag position: touchend may jump to the next word on Safari. */suppressClickUntil=Date.now()+800;return}
  if(enabled){suppressClickUntil=Date.now()+650;return}
  if(start.scrolling||start.moved||Math.hypot(t.clientX-start.x,t.clientY-start.y)>11)return;
  if(Date.now()-start.started>380)return;
  customMode=false;textNode.classList.remove('rem-custom-selecting');clearSelectionPaint();
  if(selectAt(t.clientX,t.clientY)){lastTouch=Date.now();e.preventDefault()}
 }
 function click(e){
  if(e.detail>=2&&markedAt(e.target)){e.preventDefault();removeMarkedPhrase(markedAt(e.target));return}
  if(customMode)return;
  if(enabled){if(window.getSelection()?.toString().trim()){selectionMode=true;readNativeSelection()}return}
  if(Date.now()<suppressClickUntil||Date.now()-lastTouch<650)return;
  if(window.getSelection()?.toString().trim()){selectionMode=true;readNativeSelection();return}
  selectionMode=false;selectAt(e.clientX,e.clientY)
 }
 function contextMenu(e){if(!enabled){e.preventDefault();suppressClickUntil=Date.now()+800}}
 function setEnabled(value){
  enabled=Boolean(value);touch=null;customMode=false;selectionMode=false;
  textNode.classList.remove('rem-custom-selecting');
  textNode.classList.toggle('rem-thought-pen-active',enabled);
  window.getSelection()?.removeAllRanges();
  clearSelectionPaint();selectedQuote='';saveThought.hidden=true;
  saveThought.disabled=false;saveThought.textContent='Salva nei miei pensieri';
 }
 function refreshSelectionPaint(){if(customMode)customRangePaint();else if(selectionMode)paintNativeSelection()}
 textNode.addEventListener('touchstart',touchStart,{passive:false});
 textNode.addEventListener('touchmove',touchMove,{passive:false});
 textNode.addEventListener('touchend',touchEnd,{passive:false});
 textNode.addEventListener('click',click);
 textNode.addEventListener('contextmenu',contextMenu);
 document.addEventListener('selectionchange',selectionChanged);
 document.addEventListener('scroll',refreshSelectionPaint,true);
 window.addEventListener('resize',refreshSelectionPaint);
 function destroy(){
  clearTimeout(longPressTimer);clearTimeout(selectionTimer);clearTimeout(savedNoticeTimer);
  textNode.removeEventListener('touchstart',touchStart);
  textNode.removeEventListener('touchmove',touchMove);
  textNode.removeEventListener('touchend',touchEnd);
  textNode.removeEventListener('click',click);
  textNode.removeEventListener('contextmenu',contextMenu);
  document.removeEventListener('selectionchange',selectionChanged);
  document.removeEventListener('scroll',refreshSelectionPaint,true);
  window.removeEventListener('resize',refreshSelectionPaint);
  textNode.classList.remove('rem-custom-selecting','rem-thought-pen-active');selectionPaint.remove();
 }
 return {wrap,setText,highlightPhrase,setEnabled,destroy};
}
