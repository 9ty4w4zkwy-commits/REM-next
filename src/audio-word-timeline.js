// Word-level timestamps from the verified chapter recording, not estimated reading speed.
// Offsets refer to the complete Wikisource chapter, never to an episode slice.
const cache=new Map();
export async function loadWordTimeline(chapterId){
 const match=/^capitolo-(\d{1,2})$/.exec(chapterId||'');
 const number=Number(match?.[1]);
 if(!Number.isInteger(number)||number<1||number>36)return null;
 if(!cache.has(chapterId))cache.set(chapterId,fetch('./audio/pinocchio/capitolo-'+String(number).padStart(2,'0')+'.words.json',{cache:'no-store'})
  .then(r=>{if(!r.ok)throw Error('Timeline non disponibile');return r.json()})
  .then(data=>{
   if(data.chapter!==chapterId||!Array.isArray(data.words)||!data.words.length)throw Error('Timeline non valida per il capitolo');
   let lastOffset=-1,lastTime=-1;
   for(const w of data.words){
    if(!Number.isInteger(w.offset)||w.offset<=lastOffset||!Number.isFinite(w.start)||w.start<lastTime||!Number.isFinite(w.end)||w.end<w.start)throw Error('Timeline non ordinata');
    lastOffset=w.offset;lastTime=w.start;
   }
   return data;
  }).catch(error=>{cache.delete(chapterId);throw error}));
 return cache.get(chapterId);
}
// Return null outside known word anchors: never fabricate a time by text proportion.
export function secondsForOffset(timeline,offset){
 if(!timeline?.words?.length||!Number.isFinite(offset))return null;
 const words=timeline.words;let low=0,high=words.length-1;
 while(low<=high){const mid=(low+high)>>1;if(words[mid].offset<=offset)low=mid+1;else high=mid-1}
 return high>=0?words[high].start:null;
}
export function offsetForSeconds(timeline,seconds){
 if(!timeline?.words?.length||!Number.isFinite(seconds))return null;
 const words=timeline.words;let low=0,high=words.length-1;
 while(low<=high){const mid=(low+high)>>1;if(words[mid].start<=seconds)low=mid+1;else high=mid-1}
 return high>=0?words[high].offset:null;
}
