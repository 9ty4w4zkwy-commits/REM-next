import {el,button} from './ui.js';
// Tap-to-bookmark: the tapped word and up to nine preceding words.
const KEY='rem-next-v1:highlight:';
const WORD=/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
export function createHighlights(bookId,chapterId,textNode,onSwitch,onBookmark=()=>{}){
 const key=KEY+bookId+':'+chapterId;
 let marks=[];try{marks=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(marks))marks=[]}catch{marks=[]}
 const source={value:''};
 const hint=el('p',{className:'selection-hint',text:'Tocca una parola: REM evidenzia automaticamente le ultime 10 parole fino a quel punto.'});
 const clear=button('Rimuovi evidenziazioni',()=>{marks=[];persist();draw()});
 clear.classList.add('selection-clear');
 const wrap=el('div',{className:'highlight-tools'},[hint]);
 function persist(){try{localStorage.setItem(key,JSON.stringify(marks))}catch{}}
 function draw(){
  const raw=source.value;textNode.replaceChildren();
  const ordered=marks.filter(m=>Number.isInteger(m.start)&&Number.isInteger(m.end)&&m.start>=0&&m.end<=raw.length&&m.end>m.start&&raw.slice(m.start,m.end)===m.quote).sort((a,b)=>a.start-b.start);
  let at=0;for(const m of ordered){if(m.start<at)continue;textNode.append(document.createTextNode(raw.slice(at,m.start)));textNode.append(el('mark',{className:'rem-highlight',text:raw.slice(m.start,m.end)}));at=m.end}
  textNode.append(document.createTextNode(raw.slice(at)));
 }
 function setText(value){source.value=value;draw()}
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
  const start=words[Math.max(0,index-9)].start,end=words[index].end,phrase=source.value.slice(start,end);
  marks=[{start,end,quote:phrase}];persist();draw();onBookmark(phrase,start);
  window.getSelection()?.removeAllRanges();return true;
 }
 let touch=null,lastTouch=0;
 function touchStart(e){if(e.touches.length!==1)return;const t=e.touches[0];touch={x:t.clientX,y:t.clientY,moved:false}}
 function touchMove(e){if(!touch)return;const t=e.touches[0];if(Math.hypot(t.clientX-touch.x,t.clientY-touch.y)>12)touch.moved=true}
 function touchEnd(e){if(!touch)return;const t=e.changedTouches[0],start=touch;touch=null;if(start.moved||Math.hypot(t.clientX-start.x,t.clientY-start.y)>12)return;if(selectAt(t.clientX,t.clientY)){lastTouch=Date.now();e.preventDefault()}}
 function click(e){if(Date.now()-lastTouch<650)return;selectAt(e.clientX,e.clientY)}
 textNode.addEventListener('touchstart',touchStart,{passive:true});
 textNode.addEventListener('touchmove',touchMove,{passive:true});
 textNode.addEventListener('touchend',touchEnd,{passive:false});
 textNode.addEventListener('click',click);
 function destroy(){textNode.removeEventListener('touchstart',touchStart);textNode.removeEventListener('touchmove',touchMove);textNode.removeEventListener('touchend',touchEnd);textNode.removeEventListener('click',click)}
 return {wrap,setText,destroy};
}
