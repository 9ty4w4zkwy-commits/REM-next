// Rank whole scenes using rare words, shared phrases and consecutive dialogue.
const stop=new Set('della delle degli dallo dalla anche questo questa quello quella sono stato stata quando mentre prima dopo come dove dentro avrebbe essere aveva avevano nella nelle tutti tutte molto perche storia disse rispose chiese domando quale quali vostri vostre loro ancora sempre allora quello quelle'.split(' '));
const tokens=text=>[...text.matchAll(/[\p{L}\p{N}]+/gu)].map(m=>({word:m[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''),offset:m.index}));
const useful=w=>w.length>=4&&!stop.has(w);
const grams=words=>new Set(words.slice(0,-2).map((w,i)=>words.slice(i,i+3).join(' ')));
export function rankScenes(chapters,query){
 const q=tokens(query).map(t=>t.word),terms=[...new Set(q.filter(useful))],qgrams=grams(q);
 if(terms.length<3)return [];
 const docs=chapters.map(c=>({...c,tokens:tokens(c.content)}));
 const frequencies=new Map(terms.map(w=>[w,docs.filter(d=>d.tokens.some(t=>t.word===w)).length]));
 const weight=w=>1+Math.log((docs.length+1)/(1+(frequencies.get(w)||0)));
 const total=terms.reduce((s,w)=>s+weight(w),0);
 const candidates=[];
 const size=Math.max(65,Math.min(320,q.length+35)),step=Math.max(20,Math.floor(size/4));
 for(const doc of docs){
  for(let i=0;i<doc.tokens.length;i+=step){
   const window=doc.tokens.slice(i,i+size);if(window.length<8)break;
   const words=window.map(t=>t.word),set=new Set(words);
   const matched=terms.filter(w=>set.has(w));
   const coverage=matched.reduce((s,w)=>s+weight(w),0)/total;
   const g=grams(words);let shared=0;for(const gram of qgrams)if(g.has(gram))shared++;
   const phraseScore=Math.min(1,shared/Math.max(3,q.length*.15));
   const score=.78*coverage+.22*phraseScore;
   if(matched.length>=4&&coverage>=.20){
    // Find the first nearby anchor from the opening of the query, not the end of the scene.
    const opening=q.slice(0,Math.min(55,q.length));let bestAnchor=-1,bestCount=0;
    for(let j=0;j<window.length;j++){
     const local=words.slice(j,j+Math.min(28,opening.length));const localSet=new Set(local);
     const hits=[...new Set(opening.filter(useful))].filter(w=>localSet.has(w)).reduce((s,w)=>s+weight(w),0);
     if(hits>bestCount){bestCount=hits;bestAnchor=j}
    }
    const near=window[Math.max(0,bestAnchor)].offset;
    const before=doc.content.lastIndexOf('\n\n',near);
    const offset=before>=0&&near-before<300?before+2:near;
    candidates.push({chapter:doc.id,title:doc.title,offset,phrase:doc.content.slice(offset,offset+110),context:doc.content.slice(offset,offset+360).replace(/\s+/g,' '),score,coverage,shared,approximate:true});
   }
   if(i+size>=doc.tokens.length)break;
  }
 }
 candidates.sort((a,b)=>b.score-a.score);
 const best=candidates[0];if(!best)return [];
 const result=[];
 for(const item of candidates){
  if(item.score<Math.max(.23,best.score*.78))break;
  if(result.some(x=>x.chapter===item.chapter&&Math.abs(x.offset-item.offset)<1800))continue;
  result.push(item);if(result.length>=3)break;
 }
 return result;
}
