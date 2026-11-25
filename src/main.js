import {createMontecristoAudio} from './montecristo-audio.js?v=montecristo-sync-20261124';
import {createOvidioAudio} from './ovidio-audio.js?v=4';
import {loadCatalog,loadChapter} from './catalog.js?v=narrative-119-20261124';
import {loadEpisodeSegment} from './episode-segments.js?v=conte-20-20261124';
import {loadOvidioEpisode} from './ovidio-episodes.js?v=2';
import {createCollectionsView} from './collections-view.js?v=rem-ui-209';
import {readCollections,isBookSaved,saveBookToCollections,removeSavedBook,attachItem,detachItem,addThought} from './collections-store.js?v=rem-mint-207';
import {showOnboarding,onboardingCompleted} from './onboarding.js?v=chapters-restored-20261125';
import {getProgress,saveProgress,getSetting,saveSetting} from './progress.js';
import {analyticsEnabled,getTesterCode,registerTesterCode,setAnalyticsConsent,startAnalytics,trackEvent} from './analytics.js?v=onboarding-four-20261125';
import {el,button,panel,heading} from './ui.js';
import {chapterPicker} from './chapter-picker.js?v=compact-picker-20261124';
import {getMode,formatSwitch,paperView,audioView} from './formats.js?v=format-order-20261125';
import {createReaderTools} from './reader-tools.js?v=collapsible-20261125';
import {createHighlights} from './highlights.js?v=single-remove-1';
import {createEbookJourney} from './ebook-journey.js?v=rem-ebook-91';
import {phraseSearch,getPhrase,savePhrase} from './synchronization.js?v=paper-progress-20261124';
import {HOME_SECTIONS,booksForHomeSection} from './home-config.js?v=rem-ui-159';
import {summaryView} from './summary-view.js?v=narrative-119-render-fix-20261124';
const app=document.getElementById('app');let books=[];let currentView='home';let resumeFromHomeId=null;let activeReaderTools=null;let activeHighlights=null;let activeAudioPlayer=null;
const render=(...nodes)=>{document.body.classList.toggle('rem-onboarding-gate',!onboardingCompleted()&&nodes.some(node=>node?.classList?.contains('onboard-screen')));document.body.classList.remove('ebook-fullscreen-active');if(activeAudioPlayer){activeAudioPlayer.stopAudio?.();activeAudioPlayer=null}if(activeHighlights){activeHighlights.destroy();activeHighlights=null}if(activeReaderTools){activeReaderTools.destroy();activeReaderTools=null}document.querySelectorAll('body > .format-switch-bottom').forEach(dock=>dock.remove());app.replaceChildren(...nodes);const readerDock=app.querySelector(':scope > .format-switch-bottom');if(readerDock)document.body.append(readerDock);for(const [id,active] of [['navHome',currentView==='home'],['navLibrary',currentView==='library'],['navProfile',currentView==='profile']]){const nav=document.getElementById(id);nav?.classList.toggle('is-active',active);if(active)nav?.setAttribute('aria-current','page');else nav?.removeAttribute('aria-current')}window.scrollTo({top:0,left:0,behavior:'instant'});document.documentElement.scrollTop=0;document.body.scrollTop=0};
const para=(text,cls='')=>el('p',{text,className:cls});
const backArrow=(onClick,label='Torna indietro')=>{const b=button('←',onClick);b.classList.add('reader-back','quiet-back');b.setAttribute('aria-label',label);return b};
const pathLink=(label,onClick)=>{const b=button(label,onClick);b.classList.add('story-path-link');return b};
const findBook=id=>books.find(b=>b.id===id);

const finishedKey=id=>'finished:'+id;
const ratingKey=id=>'rating:'+id;
const isFinished=id=>getSetting(finishedKey(id),'')==='yes';
function finishBook(id){const book=findBook(id);if(!book||book.availability==='preview')return;saveSetting(finishedKey(id),'yes');trackEvent('book_finished',{book_id:id});feedbackBook(id)}
function feedbackBook(id){
 const book=findBook(id);if(!book)return library();currentView='feedback';
 let rating=Number(getSetting(ratingKey(id),'0'))||0;
 const stars=el('div',{className:'feedback-stars',attrs:{role:'group','aria-label':'Valuta il libro da 1 a 5 stelle'}}),starButtons=[];
 const caption=para('Seleziona da 1 a 5 stelle','feedback-stars-caption');
 const submit=button('Invia',()=>{if(!rating)return;saveSetting(ratingKey(id),rating);detail(id)},true);
 const refresh=()=>{starButtons.forEach((b,i)=>{b.classList.toggle('selected',i<rating);b.setAttribute('aria-pressed',String(i+1===rating))});caption.textContent=rating?rating+' stelle su 5':'Seleziona da 1 a 5 stelle';submit.disabled=!rating};
 for(let n=1;n<=5;n++){
  const star=button('',()=>{rating=rating===n?n-1:n;refresh()});
  star.classList.add('feedback-star');star.setAttribute('aria-label',n+' stelle');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
  const shape=document.createElementNS('http://www.w3.org/2000/svg','path');
  shape.setAttribute('d','M12 2.4 15 8.6l6.9 1-5 4.9 1.2 6.9L12 18.1l-6.1 3.3 1.2-6.9-5-4.9 6.9-1z');
  svg.append(shape);star.append(svg);starButtons.push(star);stars.append(star)
 }
 refresh();
 const skip=button('Non ora',()=>detail(id));skip.classList.add('feedback-skip');
 render(backArrow(()=>detail(id)),el('section',{className:'feedback-card'},[
 el('div',{className:'feedback-sparkle',attrs:{'aria-hidden':'true'}},[
  el('span',{className:'feedback-sparkle-main',text:'✦'}),
  el('span',{className:'feedback-sparkle-small feedback-sparkle-one',text:'✧'}),
  el('span',{className:'feedback-sparkle-small feedback-sparkle-two',text:'✦'})
 ]),
 el('h1',{text:'Hai terminato il libro!'}),para(book.title,'feedback-book-title'),
 para('Quanto ti è piaciuta questa lettura?','feedback-question'),stars,caption,
 para('La tua opinione ci aiuterà a conoscerti meglio e a suggerirti nuove storie in linea con i tuoi gusti.','feedback-explanation'),
 submit,skip
 ]));
}
const finishControl=id=>el('section',{className:'finish-book-box'},[
 button('Termina il libro',()=>finishBook(id),true)
]);

const episodeKey=id=>'episode-done:'+id;
const episodeDone=id=>{try{return JSON.parse(getSetting(episodeKey(id),'{}'))||{}}catch{return {}}};
const setEpisodeDone=(id,chapterId,done)=>{const data=episodeDone(id);if(done)data[chapterId]=true;else delete data[chapterId];saveSetting(episodeKey(id),JSON.stringify(data))};
const storySeasons=book=>book.seasons?.length?book.seasons:[{number:1,episodes:book.chapters.map((chapter,i)=>({id:chapter.id,title:chapter.title.replace(/^Capitolo\s*\d+\s*[·—–-]\s*/i,''),chapterId:chapter.id,recap:chapter.recap,minutes:chapter.minutes}))}];
const allEpisodes=book=>storySeasons(book).flatMap(season=>season.episodes.map((ep,i)=>({...ep,season:season.number,number:i+1})));
const episodeLabel=ep=>'S'+ep.season+'E'+ep.number;
const chapterDisplayTitle=(book,chapter)=>{if(!chapter)return '';if(book.id!=='pinocchio')return chapter.title;const ep=book.seasons?.flatMap(season=>season.episodes||[]).find(item=>item.chapterId===chapter.id);return chapter.title+(ep?.title?' · '+ep.title:'')};
const episodeForChapter=(book,id)=>allEpisodes(book).find(ep=>ep.chapterId===id)||allEpisodes(book)[0];
const currentEpisode=book=>{const saved=getSetting('episode-current:'+book.id,'');return allEpisodes(book).find(ep=>ep.id===saved)||episodeForChapter(book,getProgress(book.id)?.chapter)};
const rememberEpisode=(id,ep)=>saveSetting('episode-current:'+id,ep.id);

/* Recap always uses completed story material before the selected episode; never the next episode's preview. */
function episodeRecap(book,episode){
 const currentChapterId=episode.chapterId||episode.id;
 const prior=allEpisodes(book).slice(0,allEpisodes(book).findIndex(ep=>ep.id===episode.id)).filter(ep=>(ep.chapterId||ep.id)!==currentChapterId);
 if(!prior.length)return null;
 const seen=new Set();
 const parts=prior.map(ep=>{
  const chapter=book.chapters.find(c=>c.id===(ep.chapterId||ep.id));
  if(!chapter||seen.has(chapter.id))return null;
  seen.add(chapter.id);
  return {title:ep.title||chapter.title,text:chapter.summary||chapter.recap||''};
 }).filter(part=>part?.text);
 return parts.length?parts.slice(-2):null;
}
function recapPrompt(book,episode,mode='ebook'){
 const parts=episodeRecap(book,episode);if(!parts)return null;
 const key='recap-skipped:'+book.id+':'+episode.id;
 const content=el('div',{className:'episode-recap-content',attrs:{hidden:''}},[
  ...parts.map(part=>el('div',{className:'episode-recap-part'},[el('strong',{text:part.title}),para(part.text)]))
 ]);
 const audioMode=mode==='audio';const label=audioMode?'✦ Ascolta il recap':'✦ Leggi il recap';let speaking=false;let recapSpeech=null;
 const stopRecap=()=>{if(recapSpeech&&'speechSynthesis' in window){window.speechSynthesis.cancel();recapSpeech=null}speaking=false;open.textContent=label};
 const open=button(label,()=>{
  if(audioMode){
   if(speaking){stopRecap();return}
   if(!('speechSynthesis' in window)){open.textContent='Audio non disponibile';return}
   const text=parts.map(part=>part.title+'. '+part.text).join('. ');
   window.speechSynthesis.cancel();recapSpeech=new SpeechSynthesisUtterance(text);recapSpeech.lang='it-IT';recapSpeech.rate=.95;
   recapSpeech.onend=()=>{speaking=false;recapSpeech=null;open.textContent=label};
   recapSpeech.onerror=()=>{speaking=false;recapSpeech=null;open.textContent=label};
   speaking=true;open.textContent='Ⅱ Ferma il recap';window.speechSynthesis.speak(recapSpeech);
   invite.hidden=true;saveSetting(key,'yes');return;
  }
  content.hidden=!content.hidden;open.textContent=content.hidden?label:'Chiudi il recap';if(!content.hidden){invite.hidden=true;saveSetting(key,'yes')}
 });
 const skip=button('Salta',()=>{if(audioMode)stopRecap();invite.hidden=true;saveSetting(key,'yes')});
 const invite=el('div',{className:'episode-recap-invite',attrs:getSetting(key,'')==='yes'?{hidden:''}:{}},[
  para('Vuoi ritrovare il filo della storia prima di continuare?'),
  skip
 ]);
 return el('section',{className:'episode-recap-panel'},[
  el('span',{className:'episode-recap-eyebrow',text:'LA STORIA FINORA'}),
  open,invite,content
 ]);
}

const resumeLabel=book=>{const path=getSetting('reading-path:'+book.id,'');if(path==='episodes'){const ep=currentEpisode(book);return ep?'Riprendi da '+episodeLabel(ep):'Scopri gli episodi'}return getProgress(book.id)?'Continua a leggere':'Scopri il libro'};

function resetDemo(id){if(!confirm('Ricominciare la demo da zero? Verranno cancellati il segnalibro e la scelta di lettura della sola demo.'))return;try{localStorage.removeItem('rem-next-v1:'+id);for(const key of ['reading-path:','format:','sync-point:','episode-current:','episode-season:',episodeKey('')])localStorage.removeItem('rem-next-v1:setting:'+key+id)}catch{}chooseReadingPath(id)}

const cover=book=>{const visual=el('div',{className:'cover '+(book.coverStyle==='classic'?'classic':'forest')},[el('div',{className:'cover-art',attrs:{'aria-hidden':'true'}},[el('span',{className:'art-orbit'}),el('span',{className:'art-moon'}),el('span',{className:'art-horizon'})]),el('span',{className:'cover-imprint',text:'R E M  /  STORIES'}),el('div',{className:'cover-copy'},[el('strong',{text:book.title}),el('small',{text:book.author||''})])]);if(book.coverImage){const img=el('img',{className:'cover-photo',attrs:{src:book.coverImage,alt:'Copertina di '+book.title,loading:'lazy'}});img.addEventListener('load',()=>visual.classList.add('has-cover-image'));img.addEventListener('error',()=>img.remove());visual.append(img)}return visual};

const trailerButton=book=>{
 const b=button('',()=>trailerView(book.id));
 b.append(el('span',{className:'rem-trailer-play',text:'▶',attrs:{'aria-hidden':'true'}}),el('span',{className:'rem-trailer-label',text:'Trailer'}));
 b.setAttribute('aria-label','Guarda il trailer di '+book.title);
 b.classList.add('rem-trailer-trigger');
 return b;
};
function trailerView(id){
 const book=findBook(id);if(!book)return home();
 currentView='trailer';
 const demo=id==='libro-demo';
 const scenes=demo?[
  ['OGNI STORIA','comincia da una pagina.'],
  ['UN SOLO VIAGGIO','tanti modi di viverlo.'],
  ['LEGGI. ASCOLTA. RITROVA.','La storia continua con te.'],
  ['REM NEXT','Il libro che ti segue.']
 ]:[
  [book.author||'REM PRESENTA',book.title],
  ['UNA STORIA DA SCOPRIRE',book.description||'Lasciati sorprendere da una nuova lettura.'],
  ['PROSSIMAMENTE SU REM',book.title]
 ];
 let index=0,playing=false,timer=null;
 const stage=el('div',{className:'rem-trailer-stage'},[
  el('div',{className:'rem-trailer-glow',attrs:{'aria-hidden':'true'}}),
  el('div',{className:'rem-trailer-scene'},[
   el('p',{className:'rem-trailer-kicker',text:scenes[0][0]}),
   el('h2',{className:'rem-trailer-line',text:scenes[0][1]})
  ]),
  el('div',{className:'rem-trailer-progress'},[el('span')])
 ]);
 const kicker=stage.querySelector('.rem-trailer-kicker'),line=stage.querySelector('.rem-trailer-line'),progress=stage.querySelector('.rem-trailer-progress span');
 const play=button('',()=>{if(playing){stop();return}playing=true;updatePlay();advance()});
 const updatePlay=()=>{play.replaceChildren(el('span',{className:playing?'rem-trailer-overlay-pause':'rem-trailer-overlay-play',attrs:{'aria-hidden':'true'}}));play.setAttribute('aria-label',playing?'Metti in pausa il trailer':'Riproduci il trailer');play.classList.toggle('is-playing',playing)};
 play.classList.add('rem-trailer-below-toggle');updatePlay();
 const show=()=>{kicker.textContent=scenes[index][0];line.textContent=scenes[index][1];progress.style.width=((index+1)/scenes.length*100)+'%';stage.classList.remove('rem-trailer-enter');void stage.offsetWidth;stage.classList.add('rem-trailer-enter')};
 const stop=()=>{playing=false;clearTimeout(timer);updatePlay()};
 const advance=()=>{if(!stage.isConnected){stop();return}show();if(!playing)return;timer=setTimeout(()=>{if(!stage.isConnected){stop();return}if(index===scenes.length-1){stop();return}index++;advance()},3000)};
 const close=()=>{stop();detail(id)};
 const replay=button('↺ Ricomincia',()=>{stop();index=0;show()});
 const note=demo?'Anteprima animata dimostrativa: non è ancora un trailer video definitivo.':'Anteprima grafica provvisoria: il trailer video di questo libro non è ancora disponibile.';
 render(backArrow(close,'Torna al libro'),el('section',{className:'rem-trailer-page'},[
  el('p',{className:'eyebrow',text:'TRAILER · REM NEXT'}),
  el('h1',{text:book.title}),
  stage,el('div',{className:'rem-trailer-actions'},[play,replay]),
  para(note,'rem-trailer-note')
 ]));
 show();
 if(demo){playing=true;updatePlay();advance()}
}

function refreshHomeSaveButtons(){document.querySelectorAll('.rem-cover-save').forEach(control=>{const id=control.dataset.bookId;const selected=isBookSaved(id);control.textContent=selected?'✓':'+';control.setAttribute('aria-pressed',String(selected));control.classList.toggle('is-saved',selected);control.setAttribute('aria-label',(selected?'Gestisci libro salvato: ':'Salva nella Biblioteca: ')+(control.dataset.bookTitle||''))})}
function openHomeSaveSheet(book){const alreadySaved=isBookSaved(book.id);
 const overlay=el('div',{className:'rem-save-overlay'}),sheet=el('section',{className:'rem-save-sheet',attrs:{role:'dialog','aria-modal':'true','aria-label':'Salva nella Biblioteca'}});
 const close=()=>{document.removeEventListener('keydown',onKey);overlay.remove()};const onKey=e=>{if(e.key==='Escape')close()};document.addEventListener('keydown',onKey);
 overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
 const top=el('div',{className:'rem-save-sheet-top'},[el('h2',{text:alreadySaved?'Organizza il libro':'Salva nella Biblioteca'}),button('✕',close)]);sheet.append(top);
 sheet.append(el('div',{className:'rem-save-book-info'},[el('div',{className:'rem-save-book-cover'},[cover(book)]),el('div',{},[el('strong',{text:book.title}),el('p',{text:book.author||''})])]));
 sheet.append(el('p',{className:'rem-save-hint',text:alreadySaved?'Questo libro è nella tua Biblioteca. Puoi rimuoverlo oppure organizzarlo nelle collezioni.':'Salva il libro nella tua Biblioteca e scegli, se vuoi, una o più collezioni.'}));
 if(!alreadySaved){const save=button('Salva nella Biblioteca',()=>{const db=readCollections();saveBookToCollections(book.id,db.items.filter(i=>i.type==='book'&&i.refId===book.id).map(i=>i.shelfId));refreshHomeSaveButtons();close()});save.className='rem-save-confirm';sheet.append(save)}
 const db=readCollections();
 if(db.shelves.length){
  sheet.append(el('p',{className:'rem-save-shelves-label',text:'Le tue collezioni · tocca per aggiungere o togliere'}));
  const list=el('div',{className:'rem-save-shelves'});
  db.shelves.forEach(shelf=>{
   const selected=()=>readCollections().items.some(i=>i.type==='book'&&i.refId===book.id&&i.shelfId===shelf.id);
   const toggle=button('',()=>{
    if(selected())detachItem(shelf.id,'book',book.id);
    else{if(!isBookSaved(book.id))saveBookToCollections(book.id,[]);attachItem(shelf.id,'book',book.id)}
    refreshHomeSaveButtons();draw();
   });
   const draw=()=>{const yes=selected();toggle.textContent=(yes?'✓  ':'+  ')+shelf.title;toggle.classList.toggle('is-selected',yes);toggle.setAttribute('aria-pressed',String(yes));toggle.setAttribute('aria-label',(yes?'Rimuovi da ':'Aggiungi a ')+shelf.title)};
   toggle.className='rem-save-shelf-toggle';draw();list.append(toggle);
  });
  sheet.append(list);
 }
 const organize=button('+ Crea o gestisci collezioni',()=>{close();library('shelves',book.id)});organize.className='rem-save-collections';sheet.append(organize);
 if(alreadySaved){const remove=button('Rimuovi dalla Biblioteca',()=>{removeSavedBook(book.id);refreshHomeSaveButtons();close()});remove.className='rem-save-remove';sheet.append(remove)}
 overlay.append(sheet);document.body.append(overlay);top.querySelector('button')?.focus()}
function home(){
 resumeFromHomeId=null;
 currentView='home';
 const intro=el('h1',{className:'rem-cinema-intro'},[el('span',{className:'rem-intro-first-line',text:'La tua prossima storia'}),el('span',{className:'mint-word rem-intro-second-line',text:'ti aspetta'})]);
 const shelf=section=>{
  const list=booksForHomeSection(section.id,books,getProgress,id=>getSetting('reading-path:'+id,''),id=>getSetting('episode-current:'+id,''));
  const cards=list.map(book=>{
   const image=el('div',{className:'rem-home-cover-wrap'},[cover(book)]);
   // Fill the entire cover frame even if nested cover sizing leaves a small gap on mobile.
   if(book.coverImage){image.style.backgroundImage=`url("${String(book.coverImage).replace(/"/g,'%22')}")`;image.style.backgroundSize='cover';image.style.backgroundPosition='center';}
   // Preserve the distinct lettering, color and composition printed on each original cover.
   // No duplicated title or opaque title band is layered over the artwork.
   const save=button(isBookSaved(book.id)?'✓':'+',()=>openHomeSaveSheet(book));
   save.className='rem-cover-save'+(isBookSaved(book.id)?' is-saved':'');
   save.dataset.bookId=String(book.id);save.dataset.bookTitle=book.title;
   save.setAttribute('aria-label','Salva o organizza nella Biblioteca: '+book.title);
   image.append(save);
   const open=button('Apri '+book.title,()=>section.id==='continue'&&getProgress(book.id)?readingEntry(book.id,true):detail(book.id));
   open.className='rem-cinema-cover-open';open.setAttribute('aria-label',section.id==='continue'?'Riprendi '+book.title+' dal segnalibro':'Scopri '+book.title);
   image.append(open);
   return el('article',{className:'rem-book-card rem-cinema-card',attrs:{'aria-label':book.title+' — '+(book.author||'')}},[image]);
  });
  return el('section',{className:'rem-home-section rem-cinema-section',attrs:{'data-section':section.id}},[
   el('div',{className:'rem-section-heading'},[el('h2',{className:'rem-section-title'},section.id==='recommended'?[document.createTextNode('Scelti per te '),el('span',{className:'rem-recommend-sparkles',attrs:{'aria-hidden':'true'}},[el('span',{className:'rem-recommend-sparkle',text:'✦'}),el('span',{className:'rem-recommend-sparkle-pink',text:'✦'})])]:[document.createTextNode(section.title)])]),
   ...(cards.length?[el('div',{className:'rem-book-grid'},cards)]:[para(section.empty,'rem-empty-section')])
  ]);
 };
 const backToTop=button('↑  Torna su',()=>window.scrollTo({top:0,left:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));
 backToTop.className='rem-home-back-to-top';
 backToTop.setAttribute('aria-label','Torna all’inizio della Home');
 render(intro,...HOME_SECTIONS.map(shelf),el('div',{className:'rem-home-back-to-top-wrap'},[backToTop]));
}
function searchBooks(){
 currentView='search';
 const input=el('input',{className:'rem-book-search-input',attrs:{type:'search',placeholder:'Titolo, autore, emozione, luogo','aria-label':'Cerca per titolo, autore, emozione o luogo',autocomplete:'off'}});
 const results=el('div',{className:'rem-search-results'});
 const resetSearch=button('←',()=>{selectedMood=null;selectedPlace=null;input.value='';update();window.scrollTo({top:0,behavior:'smooth'})});resetSearch.classList.add('rem-search-reset');resetSearch.setAttribute('aria-label','Nuova ricerca');resetSearch.setAttribute('title','Nuova ricerca');resetSearch.hidden=true;
 const searchButton=button('Cerca',()=>{selectedMood=null;selectedPlace=null;update();input.blur()});searchButton.classList.add('rem-search-submit');searchButton.setAttribute('aria-label','Cerca libri');
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLocaleLowerCase('it').replace(/[^a-z0-9 ]/g,' ').replace(/\\s+/g,' ').trim();
 const synonyms={
  sorridere:['ridere','ridi','divertire','divertirmi','divertente','umorismo','allegria','sorriso','sorridere','felice','felicita','leggerezza'],
  emozionare:['emozione','emozioni','emozionare','emozionarmi','commuovere','commuovermi','commovente','toccare il cuore','sentimenti'],
  sognare:['sognare','sogno','sogni','fantasia','fantastico','immaginazione','magia','magico','evasione'],
  riflettere:['riflettere','pensare','pensiero','profondo','filosofico','introspezione','domande'],
  sorprendere:['sorprendere','sorpresa','sorprese','inaspettato','imprevedibile','colpi di scena','stupire'],
  appassionare:['appassionare','coinvolgente','coinvolgere','avvincente','intenso','passione'],
  avventura:['avventura','avventure','viaggio','viaggiare','esplorare','esplorazione','scoprire'],
  meravigliare:['meraviglia','meravigliare','stupore','affascinare','incantare'],
  suspense:['suspense','tensione','mistero','misterioso','brivido','thriller'],
  paura:['paura','spaventare','spaventarmi','horror','terrore','inquietante'],
  innamorare:['innamorare','amore','romantico','romantica','romanticismo','innamorarmi']
 };
 const phrases=[{text:'Emozionarmi',emoji:'💗',mood:'emozionare'},{text:'Ridere',emoji:'🤣',mood:'sorridere'},{text:'Sognare',emoji:'🌙',mood:'sognare'},{text:'Riflettere',emoji:'🧠',mood:'riflettere'},{text:'Avventura',emoji:'🚀',mood:'avventura'}];
 const suggestions=el('div',{className:'rem-mood-suggestions'});
 suggestions.append(el('p',{className:'rem-mood-label',text:'Oppure cerca per emozione…'}));
 const chipRow=el('div',{className:'rem-mood-chips'});
 let selectedMood=null;let selectedPlace=null;const moodChips=[];const placeButtons=[];
 phrases.forEach((phrase,i)=>{const chip=button(phrase.emoji+' '+phrase.text,()=>{selectedMood=selectedMood===phrase.mood?null:phrase.mood;selectedPlace=null;input.value='';update()});chip.classList.add('rem-mood-chip','rem-mood-chip-'+(i+1));chip.setAttribute('aria-pressed','false');moodChips.push({chip,mood:phrase.mood});chipRow.append(chip)});
 suggestions.append(chipRow);
 const placeSuggestions=el('div',{className:'rem-place-suggestions'});
 placeSuggestions.append(el('p',{className:'rem-mood-label',text:'Oppure cerca per luogo…'}));
 const placeChips=el('div',{className:'rem-place-chips'});
 ['🏛️ Roma','🥐 Parigi','💂 Londra','🍃 Toscana'].forEach((label,i)=>{const place=label.slice(label.indexOf(' ')+1);const chip=button(label,()=>{selectedPlace=selectedPlace===place?null:place;selectedMood=null;input.value='';update()});chip.classList.add('rem-place-chip','rem-place-chip-'+(i+1));chip.setAttribute('aria-pressed','false');placeButtons.push({chip,place});placeChips.append(chip)});
 placeSuggestions.append(placeChips);
 function findMoods(query){
  if(!query)return [];
  const tokens=query.split(' ').filter(w=>w.length>2);
  return Object.entries(synonyms).filter(([mood,words])=>words.some(word=>{const term=normalize(word);return query.includes(term)||term.split(' ').some(w=>w.length>4&&tokens.includes(w))})).map(([mood])=>mood);
 }
 const update=()=>{
  const query=normalize(input.value);results.replaceChildren();
  const searching=Boolean(query||selectedMood||selectedPlace);
  suggestions.hidden=searching&&!selectedMood;placeSuggestions.hidden=searching&&!selectedPlace;resetSearch.hidden=!searching;
  suggestions.querySelector('.rem-mood-label').hidden=searching;
  placeSuggestions.querySelector('.rem-mood-label').hidden=searching;
  moodChips.forEach(({chip,mood})=>{const active=mood===selectedMood;chip.classList.toggle('is-selected',active);chip.hidden=searching&&!active;chip.setAttribute('aria-pressed',String(active))});
  placeButtons.forEach(({chip,place})=>{const active=place===selectedPlace;chip.classList.toggle('is-selected',active);chip.hidden=searching&&!active;chip.setAttribute('aria-pressed',String(active))});
  const matchedMoods=selectedMood?[selectedMood]:findMoods(query);
  const placeQuery=(selectedPlace?normalize(selectedPlace):query).replace(/^(libri |storie |romanzi |ambientati |ambientato |ambientate |su |a |in |di |che parlano di )+/,'').trim();
  const matches=books.filter(book=>selectedMood?(book.moods||[]).includes(selectedMood):selectedPlace?(book.locations||[]).some(loc=>normalize(loc)===placeQuery||normalize(loc).includes(placeQuery)):!query||normalize(book.title+' '+(book.author||'')).includes(query)||matchedMoods.some(mood=>(book.moods||[]).includes(mood))||(placeQuery.length>2&&(book.locations||[]).some(loc=>normalize(loc)===placeQuery||normalize(loc).includes(placeQuery))));
  if(!matches.length){results.append(para('Nessun libro del catalogo è associato a questo luogo. Prova un altro luogo, titolo, autore o emozione.','rem-search-empty'));return}
  for(const book of matches){
   const card=button('',()=>detail(book.id));
   card.className='rem-search-result';
   card.setAttribute('aria-label','Apri '+book.title+' di '+(book.author||''));
   const art=el('div',{className:'rem-search-result-cover'},[book.coverImage?el('img',{className:'rem-search-cover-full',attrs:{src:book.coverImage,alt:'Copertina di '+book.title,loading:'lazy'}}):cover(book)]);
   card.append(art);
   results.append(card);
  }
 };
 input.addEventListener('input',()=>{selectedMood=null;selectedPlace=null;update()});
 input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();selectedMood=null;update();input.blur()}});
 const back=button('← Torna alla Home',home);back.className='rem-search-back';
 render(el('section',{className:'rem-search-view'},[back,el('h1',{text:'Cerca su REM'}),el('div',{className:'rem-search-field'},[input,searchButton ]),suggestions,placeSuggestions,resetSearch,results]));
 update();requestAnimationFrame(()=>input.focus({preventScroll:true}));
}
function profile(){
 currentView='profile';
 const completed=onboardingCompleted();
 const card=(icon,title,body,action)=>el('section',{className:'rem-profile-card'},[
  el('div',{className:'rem-profile-card-title'},[el('span',{className:'rem-profile-card-icon',text:icon,attrs:{'aria-hidden':'true'}}),el('h2',{text:title})]),
  para(body,'rem-profile-description'),...(action?[action]:[])
 ]);
 const questionnaire=button(completed?'Rivedi le mie risposte →':'Completa il questionario →',()=>showOnboarding(render,profile,{editing:true}),true);
 questionnaire.classList.add('rem-profile-action');
 const status=el('span',{className:'rem-profile-status',text:completed?'Completato':'Da completare'});
 const intro=el('section',{className:'rem-profile-intro'},[
  el('div',{className:'rem-profile-avatar',attrs:{'aria-hidden':'true'}},[el('span',{className:'rem-profile-avatar-head'}),el('span',{className:'rem-profile-avatar-body'})]),
  el('div',{},[el('h1',{text:'Il mio profilo'}),para('Il tuo spazio personale su REM','rem-profile-subtitle')])
 ]);
 const interests=card('✦','I miei interessi','Le tue risposte ci aiutano a conoscere i tuoi gusti e a suggerirti nuove storie.',el('div',{className:'rem-profile-questionnaire'},[
  el('div',{className:'rem-profile-questionnaire-head'},[el('strong',{text:'Questionario iniziale'}),status]),questionnaire
 ]));
 const reading=card('◫','La mia esperienza di lettura','Le preferenze di lettura vengono conservate sul tuo dispositivo.',el('div',{className:'rem-profile-preferences'},[
  el('div',{},[el('span',{text:'Dimensione del testo'}),el('strong',{text:({'small':'Piccola','normal':'Normale','large':'Grande','xlarge':'Molto grande'})[getSetting('fontSize','normal')]||'Normale'})]),
  el('div',{},[el('span',{text:'La tua Biblioteca'}),button('Apri →',()=>library())])
 ]));
 const analyticsToggle=button(analyticsEnabled()?'Disattiva invio dati di test':'Attiva invio dati di test',()=>{setAnalyticsConsent(!analyticsEnabled());profile()});
 analyticsToggle.classList.add('rem-profile-action');
 const testerCode=getTesterCode();
 const testerActions=el('div',{className:'rem-tester-actions'});
 const testerSection=analyticsEnabled()?card('№','Il mio codice tester',
  testerCode?'Verifica del codice tester in corso…':'Assegnazione automatica del codice tester in corso…',testerActions):null;
 if(testerSection){
  const message=testerSection.querySelector('.rem-profile-description');
  const showCode=code=>{
   message.textContent='Il tuo codice tester è '+code+'. Le tue attività saranno associate a questo numero nella Dashboard.';
   const copy=button('Copia '+code,()=>{
    if(navigator.clipboard?.writeText)void navigator.clipboard.writeText(code).catch(()=>{window.prompt('Copia il codice tester',code)});
    else window.prompt('Copia il codice tester',code);
   });
   copy.classList.add('rem-profile-action');
   testerActions.replaceChildren(copy);
  };
  const retry=async()=>{
   message.textContent='Contatto il servizio per completare la registrazione…';
   testerActions.replaceChildren();
   const result=await registerTesterCode({create:!getTesterCode()});
   if(!testerSection.isConnected||!analyticsEnabled())return;
   if(result.status==='registered')showCode(result.code);
   else showError(result.message);
  };
  const showError=(detail='')=>{
   message.textContent=(detail&&detail!=='undefined'?detail+' ':'')+
     'Il codice tester non risulta ancora confermato. Puoi riprovare senza rifare il questionario.';
   const retryButton=button('Riprova registrazione',()=>{void retry()},true);
   retryButton.classList.add('rem-profile-action');
   testerActions.replaceChildren(retryButton);
  };
  void registerTesterCode().then(result=>{
   if(!testerSection.isConnected||!analyticsEnabled())return;
   if(result.status==='registered')showCode(result.code);
   else showError(result.status==='needs_retry'?'':result.message);
  });
 }
 const privacy=el('details',{className:'rem-profile-privacy-details'},[
  el('summary',{text:'◇  Privacy e dati'}),
  card('◇','Privacy e preferenze','Questionario, libri salvati e progressi restano su questo dispositivo. Solo se scegli di partecipare, REM invia a Cloudflare un ID numerico, le risposte al questionario e le attività di utilizzo (libro, formato e data). Nessun nome o email. Puoi interrompere i futuri invii; disattivare non cancella i dati già raccolti.',analyticsToggle)
 ]);
 render(el('div',{className:'rem-profile-page'},[backArrow(home,'Torna alla Home'),intro,interests,reading,...(testerSection?[testerSection]:[]),privacy]));
}
function library(section='overview',bookId=null){currentView='library';render(createCollectionsView({books,openBook:detail,continueBook:readingEntry,isSavedBook:isBookSaved,coverBook:cover,back:home,initialSection:section,initialBookId:bookId}))}
function detail(id){
 resumeFromHomeId=null;
 const book=findBook(id);if(!book)return library();
 currentView='detail';trackEvent('book_open',{book_id:id});
 const save=button(isBookSaved(id)?'✓':'+',()=>openHomeSaveSheet(book));
 save.className='rem-detail-save'+(isBookSaved(id)?' is-saved':'');
 save.setAttribute('aria-label',isBookSaved(id)?'Gestisci libro salvato':'Salva nella Biblioteca');
 const coverArt=el('div',{className:'rem-cinema-detail-cover'},[
  cover(book),
  (()=>{const b=button('▶',()=>trailerView(id));b.className='rem-detail-trailer-play';b.setAttribute('aria-label','Guarda il trailer di '+book.title);return b})(),
  (()=>{const b=button('Guarda il trailer',()=>trailerView(id));b.className='rem-detail-trailer-cta';return b})()
 ]);
 const summary=book.description||'';
 const concise=summary;
 const info=el('section',{className:'rem-cinema-detail-info'},[
  coverArt,
  el('div',{className:'rem-cinema-detail-copy'},[
   el('div',{className:'rem-cinema-detail-title'},[el('h1',{text:book.title}),save]),
   para(book.author||'','rem-cinema-detail-author'),
   para(concise,'rem-cinema-detail-description')
  ])
 ]);
 const nodes=[backArrow(home,'Torna alla Home'),el('div',{className:'rem-cinema-detail'},[
  info,
  el('p',{className:'rem-cinema-modes-intro',text:'Un’unica storia, due modi di viverla: a episodi o a capitoli. In entrambe le modalità puoi passare liberamente da ebook ad audio o cartaceo.'})
 ])];
 if(book.availability==='preview'){
  nodes.push(para('Questo libro è attualmente disponibile come anteprima. La lettura arriverà prossimamente.','preview-notice'));
 }else{
  const choose=path=>{saveSetting('reading-path:'+id,path);path==='episodes'?episodes(id):reader(id)};
  nodes.push(el('div',{className:'rem-cinema-path-actions'},[
   button('A episodi',()=>choose('episodes'),true),
   button('A capitoli',()=>choose('normal'))
  ]));
  nodes.push(para('↻  Cambia modalità o formato in qualsiasi momento, senza perdere il segnalibro.','rem-cinema-path-note'));
  if(getProgress(id))nodes.push(button('Riprendi dal segnalibro',()=>readingEntry(id)));
  if(id==='libro-demo'){const reset=button('Ricomincia la demo',()=>resetDemo(id));reset.classList.add('demo-reset-link');nodes.push(reset)}
 }
 render(...nodes);
}
function readingEntry(id,fromHome=false){
 resumeFromHomeId=fromHome?id:null;
 const book=findBook(id);if(!book)return library();
 if(book.availability==='preview')return detail(id);
 const preference=getSetting('reading-path:'+id,'');
 if(!preference&&!getProgress(id))return chooseReadingPath(id);
 if(preference==='episodes'){const ep=getSetting('episode-current:'+id,'');const found=allEpisodes(book).find(e=>e.id===ep);return found?reader(id,found.chapterId,getMode(id),null,true,found.id):reader(id,getProgress(id)?.chapter,getMode(id),null,true)}
 return reader(id);
}
function chooseReadingPath(id){
 const book=findBook(id);currentView='choice';
 const choose=path=>{saveSetting('reading-path:'+id,path);path==='episodes'?episodes(id):reader(id)};
 render(backArrow(()=>detail(id)),heading('Una storia. Due modi di viverla.','LA TUA ESPERIENZA'),para(book.title,'reading-path-book'),para('La storia è la stessa. Cambia il ritmo con cui scegli di scoprirla. Puoi cambiare modalità in qualsiasi momento senza perdere il segnalibro.','reading-path-note'),el('div',{className:'reading-path-grid'},[
  el('section',{className:'reading-path-option'},[el('h2',{text:'Libro completo'}),para('Una lettura continua, con Cartaceo, Ebook e Audio e sincronizzazione del segnalibro.'),button('Scopri il libro completo',()=>choose('normal'),true)]),
  el('section',{className:'reading-path-option'},[el('h2',{text:'A episodi'}),para('Una storia suddivisa in tappe, con recap, durata indicativa e progressi.'),button('Scopri gli episodi',()=>choose('episodes'),true)])
 ]));
}
function episodes(id,selectedSeason){
 
 const book=findBook(id);if(!book)return library();currentView='episodes';
 saveSetting('reading-path:'+id,'episodes');
 const seasons=storySeasons(book),selected=seasons.find(season=>season.number===selectedSeason)||seasons.find(season=>season.number===Number(getSetting('episode-season:'+id,'1')))||seasons[0];
 saveSetting('episode-season:'+id,selected.number);
 const done=episodeDone(id),saved=getProgress(id),current=currentEpisode(book);
 const seasonPicker=document.createElement('select');seasonPicker.className='season-picker';seasonPicker.setAttribute('aria-label','Seleziona stagione');
 seasons.forEach(season=>{const opt=document.createElement('option');opt.value=String(season.number);opt.textContent='Stagione '+season.number+' · '+(season.title||'')+' ('+season.episodes.length+' episodi)';seasonPicker.append(opt)});
 seasonPicker.value=String(selected.number);
 seasonPicker.addEventListener('change',()=>episodes(id,Number(seasonPicker.value)));
 const seasonTabs=el('div',{className:'episode-navigation-selects'},[el('label',{text:'Scegli la stagione'}),chapterPicker(seasonPicker)]);
 const cards=selected.episodes.map((ep,i)=>{
  const chapter=book.chapters.find(c=>c.id===(ep.chapterId||ep.id));
  const item={...ep,season:selected.number,number:i+1};
  const isCurrent=current?.id===ep.id&&(saved||getSetting('episode-current:'+id,''));
  const open=mode=>{if(mode==='paper'){saveSetting('reading-path:'+id,'normal');saveSetting('format:'+id,'paper');return reader(id,chapter?.id,'paper',null,false,null)}saveSetting('reading-path:'+id,'episodes');rememberEpisode(id,item);saveProgress(id,chapter?.id||item.chapterId);saveSetting('format:'+id,mode);reader(id,chapter?.id,mode,Number.isSafeInteger(item.start)?item.start:null,true,item.id)};
  const cardRecapSlot=el('div',{className:'episode-card-recap-slot'});
  return el('article',{className:'episode-card'},[
   el('span',{className:'episode-number',text:String(i+1)}),
   el('div',{className:'episode-info'},[
    el('p',{className:'episode-code',text:episodeLabel(item)}),
    el('h3',{},[el('button',{className:'episode-title-open',text:ep.title||('Episodio '+(i+1)),onClick:()=>open('ebook'),attrs:{type:'button','aria-label':'Leggi '+(ep.title||('episodio '+(i+1)))}})]),
    para(ep.recap||'Il recap di questo episodio sarà disponibile presto.','episode-recap'),
    el('div',{className:'episode-meta'},[el('span',{text:ep.minutes?'circa '+ep.minutes+' min':'Durata da definire'}),...(isCurrent?[el('span',{className:'episode-current',text:'Sei qui'})]:[]),...(done[ep.id]?[el('span',{className:'episode-done',text:'Letto'})]:[])]),
    el('div',{className:'episode-actions'},[
     ...(episodeRecap(book,item)?[button('✦ La storia finora',()=>{const box=recapPrompt(book,item);const existing=cardRecapSlot.firstChild;if(existing){cardRecapSlot.replaceChildren();return}if(box){cardRecapSlot.append(box);const trigger=box.querySelector('button');trigger?.click()}})]:[]),
     button('Ebook',()=>open('ebook')),
     button('Audio',()=>open('audio')),
     button('Cartaceo',()=>open('paper')),
     button(done[ep.id]?'✓ Letto sul cartaceo':'Segna letto sul cartaceo',()=>{setEpisodeDone(id,ep.id,!done[ep.id]);episodes(id,selected.number)})
    ]),
    cardRecapSlot
   ])
  ]);
 });
 render(backArrow(()=>detail(id)),el('div',{className:'rem-episodes-heading'},[heading(book.title,'LA TUA STORIA · EPISODI')]),
 seasonTabs,
 el('div',{className:'episodes-list rem-episode-list-open',attrs:{'aria-label':'Episodi della stagione'}},cards),
 pathLink('Passa alla lettura continua',()=>{saveSetting('reading-path:'+id,'normal');reader(id)}));
}
function openSummary(id,chapterId,mode,inEpisode,episodeId){
 const book=findBook(id);if(!book)return;
 currentView='summary';
 if(chapterId)saveSetting('summary-chapter:'+id,chapterId);
 const goBack=()=>reader(id,chapterId,mode,null,inEpisode,episodeId);
 const continueAt=nextId=>{saveProgress(id,nextId);reader(id,nextId,mode,null,inEpisode,episodeId)};
 render(button('← Torna alla storia',goBack),heading(book.title,'RIASSUNTI · LIBRO COMPLETO'),summaryView(book,goBack,continueAt));
}
async function reader(id,chapterId,modeOverride,seekOffset=null,episodic=false,episodeId=null){const book=findBook(id);if(!book)return library();currentView='reader';const mode=modeOverride||getMode(id);const saved=getProgress(id);const requestedEpisode=episodeId?allEpisodes(book).find(ep=>ep.id===episodeId):null;const chapter=book.chapters.find(c=>c.id===(requestedEpisode?.chapterId||chapterId))||book.chapters.find(c=>c.id===saved?.chapter)||book.chapters[0];if(chapter)trackEvent(mode==='audio'?'audio_open':mode==='paper'?'paper_open':'ebook_open',{book_id:id,chapter_id:chapter.id});const inEpisode=mode!=='paper'&&(episodic||getSetting('reading-path:'+id,'normal')==='episodes');if(mode==='paper')saveSetting('reading-path:'+id,'normal');const returnHome=resumeFromHomeId===id&&!inEpisode;const nav=button('←',()=>inEpisode?episodes(id):returnHome?home():detail(id));nav.classList.add('reader-back');nav.setAttribute('aria-label',inEpisode?'Torna agli episodi':returnHome?'Torna alla Home':'Torna alla scheda libro');const pathChange=pathLink(inEpisode?'Passa a lettura continua':'Passa a episodi',()=>{saveSetting('reading-path:'+id,inEpisode?'normal':'episodes');inEpisode?reader(id,chapter?.id,mode):episodes(id)});const episode= inEpisode?(allEpisodes(book).find(ep=>ep.id===episodeId)||currentEpisode(book)||episodeForChapter(book,chapter?.id)):null;if(episode)rememberEpisode(id,episode);const episodeHeading=episode?el('div',{className:'episode-reader-context'},[el('span',{text:episodeLabel(episode)}),el('strong',{text:episode.title||'Episodio'}),...(episodeRecap(book,episode)?[recapPrompt(book,episode,mode)]:[])]):null;const summaryButton=button('✦ Riassumi',()=>openSummary(id,chapter?.id,mode,inEpisode,episode?.id));summaryButton.classList.add('summary-launch','summary-warm');const readingExtras=inEpisode?el('div',{className:'summary-footer'}):el('div',{className:'summary-footer'},[el('span',{className:'summary-footer-hint',text:'Vuoi un riepilogo?'}),summaryButton]);let prepareAudioSwitch=null;const switchFormat=next=>{if(next==='audio'&&mode==='ebook')prepareAudioSwitch?.();saveSetting('format:'+id,next);reader(id,chapter?.id,next,null,inEpisode,episode?.id)};const switcher=formatSwitch(id,mode,switchFormat);const quickSwitch=formatSwitch(id,mode,switchFormat);quickSwitch.classList.add('format-switch-bottom');if(!chapter)return render(nav,el('div',{className:'rem-reader-heading'},[heading(book.title,'UN LIBRO, TANTI MODI DI VIVERLO')]),switcher,para('Questo libro non contiene capitoli.'),pathChange);
if(mode==='audio'){
 const audioChapterTitle=inEpisode&&episode?episodeLabel(episode)+' · '+episode.title:chapterDisplayTitle(book,chapter);
 const audioChapterHeading=el('h2',{className:'rem-audio-chapter-heading',text:audioChapterTitle});
 const shell=el('section',{className:'reading-shell audio-sync-shell'});
 render(nav,el('div',{className:'rem-reader-heading'},[heading(book.title,'UN LIBRO, TANTI MODI DI VIVERLO')]),...(episodeHeading?[episodeHeading]:[]),audioChapterHeading,shell,readingExtras,finishControl(id),pathChange,quickSwitch);
 activeReaderTools=createReaderTools({focusOnly:true});activeReaderTools.mount(shell);
 try{
  const segment=inEpisode&&episode?((book.id==='pinocchio'||book.id==='montecristo')?await loadEpisodeSegment(book,episode):book.id==='metamorfosi-ovidio'?await loadOvidioEpisode(book,episode):null):null;const content=segment?.content??await loadChapter(book,chapter);if(!shell.isConnected)return;
  const point=getPhrase(id);if(id!=='pinocchio'&&point?.chapter===chapter.id&&Number.isFinite(Number(point.offset)))saveSetting('audio-position:'+id,JSON.stringify({chapter:chapter.id,offset:Math.max(0,(Number(point.offset)||0)-(segment?.start||0))}));const player=id==='montecristo'?await createMontecristoAudio({chapter,content,segmentStart:segment?.start||0,segmentEnd:segment?.end??null,seekOffset,onPosition:offset=>{saveProgress(id,chapter.id);const local=offset-(segment?.start||0);if(local>=0&&local<content.length)savePhrase(id,chapter.id,content.slice(local,local+90).trim(),offset)},onNext:()=>{const units=inEpisode?allEpisodes(book):book.chapters;const index=units.findIndex(c=>c.id===(inEpisode?episode?.id:chapter.id));const next=units[index+1];if(next){const nextChapter=inEpisode?next.chapterId:next.id;saveProgress(id,nextChapter);reader(id,nextChapter,'audio',null,inEpisode,inEpisode?next.id:null)}else saveSetting('montecristo-auto-continue','false')}}):id==='metamorfosi-ovidio'?await createOvidioAudio({chapter,content,segmentStart:segment?.start||0,segmentEnd:segment?.end||null,onPosition:offset=>{saveProgress(id,chapter.id);if(offset>=0&&offset<content.length)savePhrase(id,chapter.id,content.slice(Math.max(0,offset-(segment?.start||0)),Math.max(0,offset-(segment?.start||0))+90).trim(),offset)},onNext:()=>{const units=inEpisode?allEpisodes(book):book.chapters;const index=units.findIndex(c=>c.id===(inEpisode?episode?.id:chapter.id));const next=units[index+1];if(next){const nextChapter=inEpisode?next.chapterId:next.id;saveProgress(id,nextChapter);reader(id,nextChapter,'audio',0,inEpisode,inEpisode?next.id:null)}else saveProgress(id,chapter.id)}}):audioView({bookId:id,chapter,content,segmentStart:segment?.start||0,onPosition:offset=>{if(offset>=0&&offset<content.length){const excerpt=content.slice(offset,Math.min(content.length,offset+90)).trim();savePhrase(id,chapter.id,excerpt,offset+(segment?.start||0))}saveProgress(id,chapter.id)}});
  const units=inEpisode?allEpisodes(book):book.chapters;
  const unitIndex=inEpisode?units.findIndex(item=>item.id===episode?.id):units.findIndex(item=>item.id===chapter.id);
  const moveAudio=direction=>{
   const target=units[unitIndex+direction];if(!target)return;
   const nextChapter=inEpisode?target.chapterId:target.id;
   saveProgress(id,nextChapter);
   saveSetting('audio-position:'+id,JSON.stringify({chapter:nextChapter,offset:0}));
   saveSetting('audio-text-sync:'+id,JSON.stringify({chapter:nextChapter,source:'audio',offset:0,selected:false}));
   reader(id,nextChapter,'audio',id==='montecristo'?(inEpisode?target.start??0:0):0,inEpisode,inEpisode?target.id:null);
  };
  const previousAudio=button('←',()=>moveAudio(-1));
  const nextAudio=button('→',()=>moveAudio(1));
  previousAudio.disabled=unitIndex<=0;
  nextAudio.disabled=unitIndex<0||unitIndex>=units.length-1;
  previousAudio.setAttribute('aria-label',inEpisode?'Episodio precedente':'Capitolo precedente');
  nextAudio.setAttribute('aria-label',inEpisode?'Episodio successivo':'Capitolo successivo');
  const audioNavigation=el('nav',{className:'chapter-actions ebook-chapter-nav rem-audio-chapter-nav',attrs:{'aria-label':inEpisode?'Navigazione episodi audio':'Navigazione capitoli audio'}},[previousAudio,nextAudio]);
  shell.append(player,audioNavigation,el('div',{className:'audio-inline-switches'},[button('Passa a Ebook',()=>reader(id,chapter.id,'ebook',null,inEpisode,episode?.id)),button('Passa a Cartaceo',()=>reader(id,chapter.id,'paper',null,inEpisode,episode?.id))]));activeAudioPlayer=player;
 }catch(error){if(shell.isConnected)shell.append(el('p',{text:'Impossibile caricare l’audio: '+error.message}))}
 return;
}
if(mode==='paper'){const search=phraseSearch(book,(item,target='ebook')=>{if(item?.chapter&&Number.isFinite(item.offset)&&target==='audio'&&(id==='metamorfosi-ovidio'||id==='montecristo'||id==='pinocchio'))saveSetting('audio-text-sync:'+id,JSON.stringify({chapter:item.chapter,source:'ebook',offset:item.offset,selected:true}));saveSetting('reading-path:'+id,'normal');saveSetting('format:'+id,target);if(item?.chapter)saveProgress(id,item.chapter);reader(id,item?.chapter||chapter?.id,target,item?.offset??null,false,null)});const point=getPhrase(id);
 const resumeChapter=book.chapters.find(c=>c.id===point?.chapter)||chapter;
 const paperResume=resumeChapter?el('aside',{className:'paper-resume-card'},[
  el('h2',{text:'Riprendi sul cartaceo'}),
  el('strong',{className:'paper-resume-location',text:resumeChapter.title}),
  el('div',{className:'paper-resume-recap',attrs:{'aria-label':'Breve contesto della storia'}},[
   el('strong',{className:'paper-resume-recap-heading',text:'Dove sei nella storia'}),
   el('p',{className:'paper-resume-recap-text',text:'Caricamento del contesto narrativo…'})
  ]),
  el('div',{className:'paper-resume-note'},[
   el('strong',{text:'Nota sulla sincronizzazione'}),
   el('p',{text:'Con edizioni cartacee diverse, REM individua il punto di lettura in modo approssimativo, basandosi sugli eventi della storia.'}),
   el('p',{text:'Con le edizioni collegate a REM, invece, la sincronizzazione sarà precisa e verranno indicate la pagina e la frase esatta da cui riprendere.'})
  ])
 ]):null;
 if(paperResume){
  const recapText=paperResume.querySelector('.paper-resume-recap-text');
  loadChapter(book,resumeChapter).then(content=>{
   if(!paperResume.isConnected)return;
   const raw=String(content||'').replace(/\r/g,'');
   const savedOffset=point?.chapter===resumeChapter.id&&Number.isFinite(Number(point.offset))?Math.max(0,Math.min(raw.length-1,Number(point.offset))):0;
   const paragraphs=[...raw.matchAll(/[^\n]+(?:\n(?!\n)[^\n]+)*/g)].map(m=>({start:m.index,text:m[0].trim()})).filter(p=>p.text.length>35);
   const near=paragraphs.findLast?.(p=>p.start<=savedOffset)||paragraphs[0];
   const preview=(near?.text||raw).replace(/\s+/g,' ').trim();
   const sentences=preview.match(/[^.!?…]+(?:[.!?…]+|$)/g)?.map(t=>t.trim()).filter(Boolean)||[];
   const excerpt=sentences.slice(0,3).join(' ').slice(0,330).trim();
   recapText.textContent=excerpt||'Consulta il capitolo indicato per ritrovare la scena da cui riprendere.';
  }).catch(()=>{if(paperResume.isConnected)recapText.textContent='Consulta il capitolo indicato per ritrovare la scena da cui riprendere.'});
 };const shell=el('section',{className:'reading-shell paper-sync-shell'},[...(paperResume?[paperResume]:[]),el('h2',{text:'Da dove ripartiamo?'}),el('p',{text:'Scegli il formato e continua la tua lettura. Per ritrovare il punto nel cartaceo, fotografa la pagina oppure scrivi le ultime parole che hai letto.'}),search,el('p',{className:'switch-context',text:'Scegli uno dei metodi qui sopra per ritrovare il punto della tua storia.'})]);render(nav,el('div',{className:'rem-reader-heading'},[heading(book.title,'UN LIBRO, TANTI MODI DI VIVERLO')]),...(episodeHeading?[episodeHeading]:[]),shell,readingExtras,finishControl(id),pathChange,quickSwitch);return}
const readingUnitTitle=inEpisode&&episode?episodeLabel(episode)+' · '+(episode.title||'') : chapterDisplayTitle(book,chapter);
const chapterSelect=el('select',{attrs:{'aria-label':'Scegli episodio o capitolo'}});if(inEpisode){for(const ep of allEpisodes(book))chapterSelect.append(el('option',{text:episodeLabel(ep)+' · '+ep.title,attrs:{value:ep.id}}));chapterSelect.value=episode?.id||'';chapterSelect.addEventListener('change',()=>{const ep=allEpisodes(book).find(e=>e.id===chapterSelect.value);if(ep)reader(id,ep.chapterId,'ebook',null,true,ep.id)})}else{for(const c of book.chapters)chapterSelect.append(el('option',{text:chapterDisplayTitle(book,c),attrs:{value:c.id}}));chapterSelect.value=chapter.id;chapterSelect.addEventListener('change',()=>reader(id,chapterSelect.value,'ebook'))}
const sizeSelect=el('select',{attrs:{'aria-label':'Dimensione testo'}});for(const [value,label] of [['normal','Normale'],['large','Grande'],['xlarge','Molto grande']])sizeSelect.append(el('option',{text:label,attrs:{value}}));sizeSelect.value=getSetting('fontSize','normal');const text=el('article',{className:'reading-text '+sizeSelect.value});sizeSelect.addEventListener('change',()=>{saveSetting('fontSize',sizeSelect.value);text.className='reading-text '+sizeSelect.value});const controls=el('div',{className:'reader-controls'},[chapterPicker(chapterSelect)]);const idx=book.chapters.findIndex(c=>c.id===chapter.id);const epIndex=inEpisode&&episode?allEpisodes(book).findIndex(e=>e.id===episode.id):-1;const episodeList=inEpisode?allEpisodes(book):[];const prev=button('←',()=>{const ep=episodeList[epIndex-1];reader(id,ep?.chapterId||book.chapters[idx-1]?.id,'ebook',null,inEpisode,ep?.id||null)});prev.setAttribute('aria-label','Capitolo precedente');const next=button('→',()=>{const ep=episodeList[epIndex+1];reader(id,ep?.chapterId||book.chapters[idx+1]?.id,'ebook',null,inEpisode,ep?.id||null)});next.setAttribute('aria-label','Capitolo successivo');prev.disabled=inEpisode?epIndex<=0:idx===0;next.disabled=inEpisode?epIndex>=episodeList.length-1:idx===book.chapters.length-1;const journey=createEbookJourney(id,target=>switchFormat(target));const readingShell=el('section',{className:'reading-shell ebook-reading-shell'},[journey.root,controls,el('h2',{className:'ebook-chapter-heading',text:readingUnitTitle}),el('div',{className:'ebook-page-frame'},[el('div',{className:'ebook-page-heading'},[el('strong',{text:readingUnitTitle})]),text]),el('div',{className:'chapter-actions ebook-chapter-nav'},[prev,next])]);journey.enableImmersive(readingShell);
 const immersiveHeader=el('div',{className:'rem-immersive-header'},[el('span',{className:'rem-immersive-chapter',text:readingUnitTitle})]);
 const fullscreenGlyph=(close=false)=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','22');svg.setAttribute('height','22');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.9');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',close?'M3 3l7 7 M10 5v5H5 M21 21l-7-7 M14 19v-5h5':'M10 10L3 3 M3 9V3h6 M14 14l7 7 M21 15v6h-6');svg.append(path);return svg};
 const fullscreenButton=button('',()=>{document.body.classList.add('ebook-fullscreen-active');fullscreenButton.setAttribute('aria-pressed','true');readingShell.scrollTop=0;});
 fullscreenButton.className='rem-ebook-fullscreen-toggle rem-immersive-entry';fullscreenButton.append(fullscreenGlyph());fullscreenButton.setAttribute('aria-pressed','false');fullscreenButton.setAttribute('aria-label','Attiva schermo intero');fullscreenButton.title='Schermo intero';
 const fullscreenClose=button('',()=>{document.body.classList.remove('ebook-fullscreen-active');fullscreenButton.setAttribute('aria-pressed','false')});
 fullscreenClose.className='rem-ebook-fullscreen-toggle rem-immersive-close';fullscreenClose.append(fullscreenGlyph(true));fullscreenClose.setAttribute('aria-label','Esci da schermo intero');fullscreenClose.title='Esci da schermo intero';immersiveHeader.append(fullscreenClose);
 const immersiveToolbar=el('div',{className:'rem-immersive-toolbar',attrs:{'aria-label':'Comandi lettura'}});
 const immersiveIcon=(name)=>{const paths={sun:['circle|12|12|4','path|M12 2v2 M12 20v2 M4.93 4.93l1.42 1.42 M17.65 17.65l1.42 1.42 M2 12h2 M20 12h2 M4.93 19.07l1.42-1.42 M17.65 6.35l1.42-1.42'],moon:['path|M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z'],book:['path|M12 6c-3.5-2.5-7-2.5-10-1v14c3-1.5 6.5-1.5 10 1 3.5-2.5 7-2.5 10-1V5c-3-1.5-6.5-1.5-10 1Z','path|M12 6v14'],audio:['path|M3 14v-3a9 9 0 0 1 18 0v3','rect|3|13|4|8|2','rect|17|13|4|8|2'],back:['path|M19 12H5 M12 19l-7-7 7-7'],forward:['path|M5 12h14 M12 5l7 7-7 7']};const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','23');svg.setAttribute('height','23');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.8');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');for(const spec of paths[name]||[]){const [tag,...parts]=spec.split('|');const node=document.createElementNS('http://www.w3.org/2000/svg',tag);if(tag==='path')node.setAttribute('d',parts[0]);if(tag==='circle'){node.setAttribute('cx',parts[0]);node.setAttribute('cy',parts[1]);node.setAttribute('r',parts[2])}if(tag==='rect'){['x','y','width','height','rx'].forEach((key,i)=>node.setAttribute(key,parts[i]))}svg.append(node)}return svg};
 const tool=(label,caption,kind,fn)=>{const b=button('',fn);b.className='rem-immersive-tool rem-immersive-'+kind;b.setAttribute('aria-label',label);b.title=label;if(caption.startsWith('icon:'))b.append(immersiveIcon(caption.slice(5)));else b.textContent=caption;immersiveToolbar.append(b);return b};
 const immersivePrev=tool('Capitolo precedente','icon:back','arrow',()=>{if(!prev.disabled)prev.click()});
 const lightTool=tool('Tema chiaro','icon:sun','theme-light',()=>setImmersiveTheme('light'));
 const darkTool=tool('Tema scuro','icon:moon','theme-dark',()=>setImmersiveTheme('dark'));
 const shrinkTool=tool('Riduci testo','A−','font',()=>adjustImmersiveFont(-1));
 const growTool=tool('Ingrandisci testo','A+','font',()=>adjustImmersiveFont(1));
 tool('Passa al cartaceo','icon:book','format',()=>switchFormat('paper'));
 tool('Passa all’audiolibro','icon:audio','format',()=>switchFormat('audio'));
 const immersiveNext=tool('Capitolo successivo','icon:forward','arrow',()=>{if(!next.disabled)next.click()});
 immersivePrev.disabled=prev.disabled;immersiveNext.disabled=next.disabled;
 let immersiveFont=Number(getSetting('immersiveFontSize','0'))||0;
 function adjustImmersiveFont(delta){immersiveFont=Math.max(-2,Math.min(5,immersiveFont+delta));saveSetting('immersiveFontSize',String(immersiveFont));text.style.setProperty('--rem-immersive-font-size',(1.18+immersiveFont*.12)+'rem');readingShell.style.setProperty('--rem-immersive-heading-font-size',(.92+immersiveFont*.095)+'rem');shrinkTool.disabled=immersiveFont<=-2;growTool.disabled=immersiveFont>=5}
 function setImmersiveTheme(theme){readingShell.classList.toggle('rem-immersive-light',theme==='light');lightTool.setAttribute('aria-pressed',String(theme==='light'));darkTool.setAttribute('aria-pressed',String(theme==='dark'));saveSetting('immersiveTheme',theme)}
 adjustImmersiveFont(0);setImmersiveTheme(getSetting('immersiveTheme','dark')==='light'?'light':'dark');
 readingShell.prepend(immersiveHeader);readingShell.querySelector('.ebook-page-frame')?.append(fullscreenButton);readingShell.append(immersiveToolbar);
 render(nav,el('div',{className:'rem-reader-heading'},[heading(book.title,'UN LIBRO, TANTI MODI DI VIVERLO')]),...(episodeHeading?[episodeHeading]:[]),readingShell,readingExtras,finishControl(id),pathChange,quickSwitch);activeHighlights=createHighlights(id,chapter.id,text,()=>{},(quote,offset)=>{clearTimeout(scrollSaveTimer);savePhrase(id,chapter.id,quote,offset+segmentStart);saveSetting('audio-position:'+id,JSON.stringify({chapter:chapter.id,offset}));if(id==='pinocchio'||id==='metamorfosi-ovidio'||id==='montecristo')saveSetting('audio-text-sync:'+id,JSON.stringify({chapter:chapter.id,source:'ebook',offset:offset+segmentStart,selected:true}));journey.refresh()},(quote)=>{const saved=addThought('“'+quote+'”',{bookId:id,bookTitle:book.title,chapter:readingUnitTitle});if(saved)window.dispatchEvent(new Event('rem-collections-changed'))});readingShell.querySelector('.ebook-chapter-nav')?.after(activeHighlights.wrap);
 const highlightToggle=button('',()=>{const active=highlightToggle.getAttribute('aria-pressed')!=='true';highlightToggle.setAttribute('aria-pressed',String(active));highlightToggle.setAttribute('aria-label',active?'Disattiva la sottolineatura':'Attiva la sottolineatura');highlightToggle.title=active?'Pennino attivo: tocca di nuovo per disattivarlo':'Attiva sottolineatura';readingShell.classList.toggle('rem-highlighter-on',active);activeHighlights?.setEnabled(active)});
 highlightToggle.className='rem-floating-highlighter';highlightToggle.setAttribute('aria-label','Attiva o disattiva la sottolineatura');highlightToggle.setAttribute('aria-pressed','false');highlightToggle.title='Attiva sottolineatura';
 const highlighterSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');highlighterSvg.setAttribute('viewBox','0 0 24 24');highlighterSvg.setAttribute('width','19');highlighterSvg.setAttribute('height','19');highlighterSvg.setAttribute('fill','none');highlighterSvg.setAttribute('stroke','currentColor');highlighterSvg.setAttribute('stroke-width','1.9');highlighterSvg.setAttribute('stroke-linecap','round');highlighterSvg.setAttribute('stroke-linejoin','round');highlighterSvg.setAttribute('aria-hidden','true');const highlighterPath=document.createElementNS('http://www.w3.org/2000/svg','path');highlighterPath.setAttribute('d','m14 5 5 5 M3 21l5.5-1.3L20 8.2a2.1 2.1 0 0 0 0-3L18.8 4a2.1 2.1 0 0 0-3 0L4.3 15.5 3 21Z');highlighterSvg.append(highlighterPath);highlightToggle.append(highlighterSvg);readingShell.append(highlightToggle);
 // Keep the pen above the appropriate command bar in both reading layouts.
 const positionPenAboveFormats=()=>{
  if(!highlightToggle.isConnected)return;
  const full=document.body.classList.contains('ebook-fullscreen-active');
  const bar=full?readingShell.querySelector('.rem-immersive-toolbar'):quickSwitch;
  if(!bar||!bar.isConnected)return;
  const rect=bar.getBoundingClientRect();
  const height=highlightToggle.getBoundingClientRect().height||34;
  if(rect.height>0){
   highlightToggle.style.setProperty('top',Math.max(12,rect.top-height-8)+'px','important');
   highlightToggle.style.setProperty('bottom','auto','important');
  }
 };
 const schedulePenPosition=()=>requestAnimationFrame(positionPenAboveFormats);
 window.addEventListener('resize',schedulePenPosition,{passive:true});
 const penBarObserver=new ResizeObserver(schedulePenPosition);
 penBarObserver.observe(quickSwitch);
 const immersivePenBar=readingShell.querySelector('.rem-immersive-toolbar');
 if(immersivePenBar)penBarObserver.observe(immersivePenBar);
 const penModeObserver=new MutationObserver(schedulePenPosition);
 penModeObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
 requestAnimationFrame(()=>requestAnimationFrame(positionPenAboveFormats));
 const penPositionCleanup=setInterval(()=>{
  if(!highlightToggle.isConnected){
   penBarObserver.disconnect();penModeObserver.disconnect();
   window.removeEventListener('resize',schedulePenPosition);
   clearInterval(penPositionCleanup);
  }
 },1500);
 let readerRestoring=true;let scrollSaveTimer=null;let loadedTextContent='';let segmentStart=0;
 const saveVisibleReadingPoint=()=>{
  if(readerRestoring||!loadedTextContent||!text.isConnected)return;
  const rect=text.getBoundingClientRect();
  const x=Math.min(rect.right-16,Math.max(rect.left+16,rect.left+32));
  const y=Math.min(rect.bottom-12,Math.max(rect.top+12,rect.top+20));
  const caret=document.caretRangeFromPoint?.(x,y);
  let offset=null;
  if(caret&&text.contains(caret.startContainer)){
   const range=document.createRange();range.selectNodeContents(text);range.setEnd(caret.startContainer,caret.startOffset);
   offset=range.toString().length;
  }
  if(offset===null){const total=text.scrollHeight-text.clientHeight;offset=Math.round((total>0?text.scrollTop/total:0)*loadedTextContent.length)}
  offset=Math.max(0,Math.min(loadedTextContent.length-1,offset));
  savePhrase(id,chapter.id,loadedTextContent.slice(offset,offset+90).trim(),offset+segmentStart);if(id==='pinocchio'||id==='metamorfosi-ovidio'||id==='montecristo')saveSetting('audio-text-sync:'+id,JSON.stringify({chapter:chapter.id,source:'ebook',offset:offset+segmentStart,selected:false}));
 };
 prepareAudioSwitch=()=>{let selected=false;try{const sync=JSON.parse(getSetting('audio-text-sync:'+id,'null'));selected=(id==='pinocchio'||id==='metamorfosi-ovidio'||id==='montecristo')&&sync?.chapter===chapter.id&&sync.source==='ebook'&&sync.selected===true}catch{}if(!selected)saveVisibleReadingPoint()};
 text.addEventListener('scroll',()=>{if(readerRestoring)return;clearTimeout(scrollSaveTimer);scrollSaveTimer=setTimeout(saveVisibleReadingPoint,180)},{passive:true});
 const updateRail=()=>{};activeHighlights.wrap.append(el('div',{className:'ebook-inline-switches'},[button('Passa a Cartaceo',()=>{saveSetting('format:'+id,'paper');reader(id,chapter.id,'paper',null,inEpisode,episode?.id)}),button('Passa ad Audio',()=>{switchFormat('audio')})]));activeReaderTools=createReaderTools({collapsible:true});activeReaderTools.mount(readingShell);text.textContent='Caricamento capitolo…';try{const segment=inEpisode&&episode?((book.id==='pinocchio'||book.id==='montecristo')?await loadEpisodeSegment(book,episode):book.id==='metamorfosi-ovidio'?await loadOvidioEpisode(book,episode):null):null;const content=segment?.content??await loadChapter(book,chapter);if(!text.isConnected)return;segmentStart=segment?.start||0;activeHighlights?.setText(content);loadedTextContent=content;requestAnimationFrame(updateRail);saveProgress(id,chapter.id);const point=getPhrase(id);let audioOffset=null;try{const audio=JSON.parse(getSetting('audio-position:'+id,'null'));if(audio?.chapter===chapter.id)audioOffset=Number(audio.offset)}catch{}let syncOffset=null;try{const sync=JSON.parse(getSetting('audio-text-sync:'+id,'null'));if((id==='pinocchio'||id==='metamorfosi-ovidio'||id==='montecristo')&&sync?.chapter===chapter.id&&sync.source==='audio')syncOffset=Number(sync.offset)}catch{}const absoluteOffset=seekOffset??(syncOffset??(point?.chapter===chapter.id?point.offset:audioOffset));const offset=Number.isInteger(absoluteOffset)?absoluteOffset-segmentStart:null;if(Number.isInteger(offset)&&offset>=0&&offset<content.length){
 const match=point?.chapter===chapter.id&&point.offset===absoluteOffset?point:null;
 const highlighted=match?activeHighlights?.highlightPhrase(offset,match.phrase):null;
 if(highlighted){
  requestAnimationFrame(()=>{highlighted.scrollIntoView({block:'center',behavior:'instant'});updateRail()});
 }else{
  const range=document.createRange();const walker=document.createTreeWalker(text,NodeFilter.SHOW_TEXT);
  let node,remaining=offset;
  while((node=walker.nextNode())){
   if(remaining<=node.textContent.length){
    range.setStart(node,remaining);range.collapse(true);
    const marker=document.createElement('span');marker.className='sync-anchor';marker.textContent='▌';
    range.insertNode(marker);marker.scrollIntoView({block:'center',behavior:'instant'});break;
   }
   remaining-=node.textContent.length;
  }
 }
}
}catch(error){if(text.isConnected)text.textContent='Impossibile caricare il capitolo: '+error.message}finally{requestAnimationFrame(()=>{requestAnimationFrame(()=>{readerRestoring=false})})}}
document.getElementById('brand').onclick=home;document.getElementById('navHome').onclick=home;document.getElementById('navLibrary').onclick=()=>library();document.getElementById('navProfile').onclick=profile;document.getElementById('navSearch').onclick=searchBooks;
try{books=await loadCatalog();startAnalytics();if(onboardingCompleted()||getSetting('onboarding-v1','')==='later')home();else showOnboarding(render,home)}catch(error){render(heading('REM Next','ERRORE'),para('Impossibile caricare il catalogo: '+error.message),para('Avvia l’app tramite un server web, non aprendo index.html come file locale.'))}