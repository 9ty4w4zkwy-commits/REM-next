// Ovidio: episodi brevi ricavati dai testi già pubblicati, senza modificare i capitoli integrali.
import {loadChapter} from './catalog.js?v=montecristo-cover-20261123';
const countWords=s=>s.trim().split(/\s+/).filter(Boolean).length;
export async function loadOvidioEpisode(book,episode){
 const chapter=book.chapters.find(c=>c.id===episode.chapterId);
 if(!chapter)throw Error('Testo episodio non disponibile');
 const original=await loadChapter(book,chapter);
 const paragraphs=original.split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean);
 // Preserve narrative order and crucial opening/conclusion while reducing the reading time.
 const target=episode.targetWords||460;
 const total=countWords(original);
 if(total<=target+60)return {content:original,start:0,end:original.length,chapterId:chapter.id};
 const weights=paragraphs.map(countWords),picked=new Set([0,paragraphs.length-1]);
 let used=weights[0]+weights[weights.length-1];
 for(let i=1;i<paragraphs.length-1;i++){
  const desired=Math.round(target*i/(paragraphs.length-1));
  if(used<desired&&used+weights[i]<=target+70){picked.add(i);used+=weights[i]}
 }
 // Short teaser is editorial framing, not a claim that the next scene has happened.
 const units=book.seasons.flatMap(s=>s.episodes);
 const index=units.findIndex(e=>e.id===episode.id);
 const next=units[index+1];
 const teaser=next?'\n\nE ora? Nel prossimo episodio: '+next.title+'.':'';
 return {content:paragraphs.filter((_,i)=>picked.has(i)).join('\n\n')+teaser,start:0,end:original.length,chapterId:chapter.id};
}
