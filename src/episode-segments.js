// Narrative episode segments. Every chapter is partitioned at a paragraph boundary.
// All source characters remain in their original order; no text is rewritten.
import {loadChapter} from './catalog.js?v=pinocchio-121';
export function episodeUnits(book){
 if(book.id!=='pinocchio')return (book.seasons||[]).flatMap(s=>s.episodes);
 return book.seasons.flatMap(s=>s.episodes);
}
export function segmentRange(content,part=0,parts=1){
 if(parts===1)return {start:0,end:content.length};
 const breaks=[0];const re=/\n\n/g;let match;
 while((match=re.exec(content)))breaks.push(match.index+2);
 breaks.push(content.length);
 const edges=[0];
 for(let i=1;i<parts;i++){
  const goal=content.length*i/parts;
  const options=breaks.filter(v=>v>edges[i-1]+80&&v<content.length-80);
  edges.push(options.length?options.reduce((a,b)=>Math.abs(a-goal)<Math.abs(b-goal)?a:b):Math.round(goal));
 }
 edges.push(content.length);
 return {start:edges[part],end:edges[part+1]};
}
export async function loadEpisodeSegment(book,episode){
 const chapter=book.chapters.find(c=>c.id===episode.chapterId);
 if(!chapter)throw Error('Capitolo dell’episodio non trovato');
 const full=await loadChapter(book,chapter);
 const {start,end}=segmentRange(full,episode.part||0,episode.parts||1);
 return {content:full.slice(start,end),start,end,chapterId:chapter.id};
}
