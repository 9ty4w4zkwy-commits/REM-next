import {el,button} from './ui.js';
import {getPhrase} from './synchronization.js';
// Ebook-only navigation panel; independent of Focus, highlights and format dock.
export function createEbookJourney(bookId,onSwitch){
 const root=el('section',{className:'ebook-journey'});
 const heading=el('h2',{text:'Leggi, tocca, continua.'});
 const hint=el('p',{text:'Seleziona una frase del libro per fissare il segnalibro.'});
 const audio=button('▶ Passa ad Audio',()=>onSwitch('audio'));
 const paper=button('Passa a Cartaceo',()=>onSwitch('paper'));
 const actions=el('div',{className:'ebook-journey-actions'},[audio,paper]);
 const bookmark=el('p',{className:'ebook-journey-bookmark',attrs:{role:'status','aria-live':'polite'}});
 function refresh(){const point=getPhrase(bookId);bookmark.textContent=point?.phrase?'Segnalibro: '+(point.page?'pagina '+point.page+' · ':'')+'«'+point.phrase.slice(0,115)+(point.phrase.length>115?'…':'')+'»':'Nessun segnalibro ancora selezionato. Tocca una frase nel testo per iniziare.'}
 root.append(heading,hint,actions,bookmark);refresh();
 return {root,refresh};
}
