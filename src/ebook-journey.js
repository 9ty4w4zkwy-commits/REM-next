import {el,button} from './ui.js';
import {getPhrase} from './synchronization.js';
// Ebook navigation, live bookmark and iPhone-friendly immersive reading.
export function createEbookJourney(bookId,onSwitch){
 const root=el('section',{className:'ebook-journey'});
 const heading=el('h2',{text:'Leggi, tocca, continua.'});
 const hint=el('p',{text:'Tocca una parola: REM evidenzia automaticamente le 10 parole precedenti, inclusa quella toccata.'});
 const audio=button('Passa ad Audio',()=>switchTo('audio',audio));
 const paper=button('Passa a Cartaceo',()=>switchTo('paper',paper));
 function switchTo(mode,clicked){clicked.classList.add('is-selected');clicked.setAttribute('aria-pressed','true');onSwitch(mode)}
 const actions=el('div',{className:'ebook-journey-actions'},[paper,audio]);
 const bookmark=el('p',{className:'ebook-journey-bookmark',attrs:{role:'status','aria-live':'polite'}});
 function refresh(){const point=getPhrase(bookId);bookmark.textContent=point?.phrase?'Segnalibro: '+(point.page?'pagina '+point.page+' · ':'')+'«'+point.phrase.slice(0,115)+(point.phrase.length>115?'…':'')+'»':'Nessun segnalibro ancora selezionato. Tocca una parola nel testo per iniziare.'}
 const immersive=button('⛶',()=>toggle());
 immersive.setAttribute('aria-label','Espandi lettura');
 immersive.setAttribute('title','Espandi lettura');
 immersive.classList.add('ebook-expand');
 immersive.setAttribute('aria-pressed','false');
 let shell=null;
 function toggle(force){if(!shell)return;const active=typeof force==='boolean'?force:!shell.classList.contains('ebook-immersive');shell.classList.toggle('ebook-immersive',active);document.body.classList.toggle('ebook-immersive-active',active);immersive.textContent=active?'⤡':'⛶';immersive.setAttribute('aria-label',active?'Riduci lettura':'Espandi lettura');immersive.setAttribute('title',active?'Riduci lettura':'Espandi lettura');immersive.setAttribute('aria-pressed',String(active));if(active){shell.scrollTop=0}else{shell.style.removeProperty('scroll-behavior')}}
 function enableImmersive(target){shell=target;target.querySelector('.ebook-page-frame')?.append(immersive);const observer=new MutationObserver(()=>{if(!shell.isConnected){document.body.classList.remove('ebook-immersive-active');observer.disconnect()}});observer.observe(document.getElementById('app'),{childList:true})}
 root.append(heading,hint,bookmark);refresh();
 return {root,refresh,enableImmersive};
}
