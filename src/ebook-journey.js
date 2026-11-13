import {el,button} from './ui.js';
import {getPhrase} from './synchronization.js';
// Ebook navigation, live bookmark and iPhone-friendly immersive reading.
export function createEbookJourney(bookId,onSwitch){
 const root=el('section',{className:'ebook-journey'});
 const heading=el('h2',{text:'Leggi, tocca, continua.'});
 const hint=el('p',{text:'Tocca una parola: REM evidenzia automaticamente la parola toccata e le 8 successive.'});
 const audio=button('Passa ad Audio',()=>switchTo('audio',audio));
 const paper=button('Passa a Cartaceo',()=>switchTo('paper',paper));
 function switchTo(mode,clicked){clicked.classList.add('is-selected');clicked.setAttribute('aria-pressed','true');onSwitch(mode)}
 const actions=el('div',{className:'ebook-journey-actions'},[paper,audio]);
 const bookmark=el('p',{className:'ebook-journey-bookmark',attrs:{role:'status','aria-live':'polite'}});
 function refresh(){const point=getPhrase(bookId);bookmark.textContent=point?.phrase?'Segnalibro: '+(point.page?'pagina '+point.page+' · ':'')+'«'+point.phrase.slice(0,115)+(point.phrase.length>115?'…':'')+'»':'Nessun segnalibro ancora selezionato. Tocca una parola nel testo per iniziare.'}
 function enableImmersive(){document.body.classList.remove('ebook-immersive-active')}
 refresh();
 return {root,refresh,enableImmersive};
}
