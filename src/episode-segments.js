// Narrative episode segments. Every chapter is partitioned at a paragraph boundary.
// All source characters remain in their original order; no text is rewritten.
import {loadChapter} from './catalog.js?v=conte-20-20261124';
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
  const sentences=[...content.matchAll(/[.!?…][”»\"']?\\s+/g)].map(m=>m.index+m[0].length).filter(v=>v>edges[i-1]+80&&v<content.length-80);
  const candidates=options.length?options:sentences;
  edges.push(candidates.length?candidates.reduce((a,b)=>Math.abs(a-goal)<Math.abs(b-goal)?a:b):Math.round(goal));
 }
 edges.push(content.length);
 return {start:edges[part],end:edges[part+1]};
}
export async function loadEpisodeSegment(book,episode){
 const chapter=book.chapters.find(c=>c.id===episode.chapterId);
 if(!chapter)throw Error('Capitolo dell’episodio non trovato');
 const full=await loadChapter(book,chapter);
 const {start,end}=Number.isSafeInteger(episode.start)&&Number.isSafeInteger(episode.end)?{start:episode.start,end:episode.end}:segmentRange(full,episode.part||0,episode.parts||1);
 if(start<0||end>full.length||end<=start)throw Error('Limiti episodio non validi');
 return {content:full.slice(start,end),start,end,chapterId:chapter.id};
}

export function migrateEpisodeProgress(book, completed, savedId, bookmark) {
 const previous=book.previousEpisodes;
 const episodes=episodeUnits(book);
 const oldEpisode=previous.find(episode=>episode.id===savedId);
 const marked=previous.filter(episode=>completed[episode.id]);
 const next={...completed};
 for(const episode of episodes){
  let covered=episode.start;
  for(const old of marked){
   if(old.chapterId===episode.chapterId&&old.start<=covered&&old.end>covered)covered=old.end;
  }
  if(covered>=episode.end)next[episode.id]=true;
 }
 if(!oldEpisode)return {completed:next,episode:null};
 const savedOffset=bookmark?.chapter===oldEpisode.chapterId&&Number.isSafeInteger(bookmark.offset)
  &&bookmark.offset>=oldEpisode.start&&bookmark.offset<oldEpisode.end?bookmark.offset:oldEpisode.start;
 for(const season of book.seasons){
  const found=season.episodes.find(episode=>episode.chapterId===oldEpisode.chapterId&&episode.start<=savedOffset&&savedOffset<episode.end);
  if(found)return {completed:next,episode:{...found,season:season.number}};
 }
 return {completed:next,episode:null};
}
