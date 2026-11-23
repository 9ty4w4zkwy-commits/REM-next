// Episodi Ovidio: segmenti consecutivi dei capitoli originali, nessuna omissione.
import {loadEpisodeSegment} from './episode-segments.js?v=pinocchio-122';
export async function loadOvidioEpisode(book,episode){
 const segment=await loadEpisodeSegment(book,episode);
 const episodes=book.seasons.flatMap(s=>s.episodes);
 const index=episodes.findIndex(e=>e.id===episode.id);
 const next=episodes[index+1];
 // L'anticipazione è separata dal testo originale e non altera gli eventi narrati.
 const teaser=next?'\n\nContinua nel prossimo episodio: '+next.title+'.':'';
 return {...segment,content:segment.content.trimEnd()+teaser};
}
