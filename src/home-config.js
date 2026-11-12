// Home layout: reorder, enable or disable sections without editing the renderer.
// A section with no books shows an honest empty state until content is assigned.
export const HOME_SECTIONS=[
 {id:'recommended',title:'Scelti per te ✦',empty:'I suggerimenti personalizzati arriveranno presto.'},
 {id:'continue',title:'Continua a leggere',empty:'I libri che inizi a leggere appariranno qui.'},
 {id:'free',title:'Contenuti gratis da leggere',empty:'Stiamo preparando i primi contenuti gratuiti.'},
 {id:'premium',title:'Contenuti Premium',empty:'I contenuti Premium non sono ancora disponibili.'},
 {id:'new',title:'Novità',empty:'Qui troverai le nuove uscite.'}
];
export function booksForHomeSection(id,books,getProgress){
 switch(id){
  case 'recommended': return books.filter(b=>b.homeSections?.includes('recommended'));
  case 'continue': return books.filter(b=>Boolean(getProgress(b.id)));
  case 'free': return books.filter(b=>b.access==='free');
  case 'premium': return books.filter(b=>b.access==='premium');
  case 'new': return books.filter(b=>b.homeSections?.includes('new'));
  default:return [];
 }
}
