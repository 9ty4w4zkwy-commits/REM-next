import {loadCatalog,loadChapter} from './catalog.js';
import {showOnboarding,onboardingCompleted} from './onboarding.js?v=rem-ui-56';
import {getProgress,saveProgress,getSetting,saveSetting} from './progress.js';
import {el,button,panel,heading} from './ui.js';
import {getMode,formatSwitch,paperView,audioView} from './formats.js';
import {createReaderTools} from './reader-tools.js?v=rem-ebook-42';
import {createHighlights} from './highlights.js?v=rem-ebook-44';
import {createEbookJourney} from './ebook-journey.js?v=rem-ebook-44';
import {phraseSearch,getPhrase,savePhrase} from './synchronization.js?v=rem-switch-68';
import {HOME_SECTIONS,booksForHomeSection} from './home-config.js';
import {summaryView} from './summary-view.js?v=rem-summary-50';
const app=document.getElementById('app');let books=[];let currentView='home';let activeReaderTools=null;let activeHighlights=null;
const render=(...nodes)=>{if(activeHighlights){activeHighlights.destroy();activeHighlights=null}if(activeReaderTools){activeReaderTools.destroy();activeReaderTools=null}app.replaceChildren(...nodes);for(const [id,active] of [['navHome',currentView==='home'],['navLibrary',currentView==='library']]){const nav=document.getElementById(id);nav?.classList.toggle('is-active',active);if(active)nav?.setAttribute('aria-current','page');else nav?.removeAttribute('aria-current')}window.scrollTo({top:0,left:0,behavior:'instant'});document.documentElement.scrollTop=0;document.body.scrollTop=0};
const para=(text,cls='')=>el('p',{text,className:cls});
const backArrow=(onClick,label='Torna indietro')=>{const b=button('←',onClick);b.classList.add('reader-back','quiet-back');b.setAttribute('aria-label',label);return b};
const pathLink=(label,onClick)=>{const b=button(label,onClick);b.classList.add('story-path-link');return b};
const findBook=id=>books.find(b=>b.id===id);

const finishedKey=id=>'finished:'+id;
const ratingKey=id=>'rating:'+id;
const isFinished=id=>getSetting(finishedKey(id),'')==='yes';
function finishBook(id){const book=findBook(id);if(!book||book.availability==='preview')return;saveSetting(finishedKey(id),'yes');feedbackBook(id)}
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
const episodeForChapter=(book,id)=>allEpisodes(book).find(ep=>ep.chapterId===id)||allEpisodes(book)[0];
const currentEpisode=book=>{const saved=getSetting('episode-current:'+book.id,'');return allEpisodes(book).find(ep=>ep.id===saved)||episodeForChapter(book,getProgress(book.id)?.chapter)};
const rememberEpisode=(id,ep)=>saveSetting('episode-current:'+id,ep.id);

/* Recap always uses completed story material before the selected episode; never the next episode's preview. */
function episodeRecap(book,episode){
 const prior=allEpisodes(book).slice(0,allEpisodes(book).findIndex(ep=>ep.id===episode.id));
 if(!prior.length)return null;
 const seen=new Set();
 const parts=prior.map(ep=>{
  const chapter=book.chapters.find(c=>c.id===(ep.chapterId||ep.id));
  if(!chapter||seen.has(chapter.id))return null;
  seen.add(chapter.id);
  return {title:ep.title||chapter.title,text:chapter.summary||chapter.recap||''};
 }).filter(part=>part?.text);
 return parts.length?parts:null;
}
function recapPrompt(book,episode){
 const parts=episodeRecap(book,episode);if(!parts)return null;
 const key='recap-skipped:'+book.id+':'+episode.id;
 const content=el('div',{className:'episode-recap-content',attrs:{hidden:''}},[
  ...parts.map(part=>el('div',{className:'episode-recap-part'},[el('strong',{text:part.title}),para(part.text)]))
 ]);
 const open=button('✦ Leggi il recap',()=>{content.hidden=!content.hidden;open.textContent=content.hidden?'✦ Leggi il recap':'Chiudi il recap';if(!content.hidden){invite.hidden=true;saveSetting(key,'yes')}});
 const skip=button('Salta',()=>{invite.hidden=true;saveSetting(key,'yes')});
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
 b.append(el('span',{className:'rem-trailer-play',text:'▶',attrs:{'aria-hidden':'true'}}),el('span',{className:'rem-trailer-label',text:'Guarda il trailer'}));
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

function home(){currentView='home';const intro=el('section',{className:'rem-home-intro'},[el('p',{className:'eyebrow',text:'SCOPRI REM'}),el('h1',{},[document.createTextNode('La tua prossima storia '),el('span',{className:'mint-word',text:'ti aspetta.'})]),para('Scopri i libri disponibili, ritrova le tue letture e passa da un formato all’altro.','rem-home-subtitle')]);const shelf=(section)=>{const list=booksForHomeSection(section.id,books,getProgress,id=>getSetting('reading-path:'+id,''),id=>getSetting('episode-current:'+id,''));const cards=list.map(book=>{const saved=getProgress(book.id);const path=getSetting('reading-path:'+book.id,'');return el('article',{className:'rem-book-card'},[cover(book),el('h3',{text:book.title}),para(book.author||'Una storia da scoprire','rem-card-subtitle'),...(saved||path?[el('span',{className:'home-reading-label',text:path==='episodes'?'A EPISODI':'LIBRO COMPLETO'})]:[]),button(book.availability==='preview'?'Scopri il libro':resumeLabel(book),()=>book.availability==='preview'?detail(book.id):readingEntry(book.id),true),...(section.id==='continue'?[]:[trailerButton(book)])])});return el('section',{className:'rem-home-section',attrs:{'data-section':section.id}},[el('div',{className:'rem-section-heading'},[el('h2',{className:'rem-section-title'},section.id==='recommended'?[document.createTextNode('Scelti per te '),el('span',{className:'rem-recommend-sparkle',text:'✦',attrs:{'aria-hidden':'true'}})]:[document.createTextNode(section.title)]),...(section.id==='recommended'?[(()=>{const b=button('Riprova questionario',()=>showOnboarding(render,home));b.classList.add('onboard-retry');return b})()]:[])]),...(section.subtitle?[para(section.subtitle,'rem-shelf-subtitle')]:[]),...(cards.length?[el('div',{className:'rem-book-grid'},cards)]:[para(section.empty,'rem-empty-section')])])};render(intro,...HOME_SECTIONS.map(shelf))}
function library(){currentView='library';const search=el('input',{attrs:{type:'search',placeholder:'Titolo o autore','aria-label':'Cerca libri'}});const results=el('div');function update(){const query=search.value.trim().toLocaleLowerCase('it');const matches=books.filter(b=>(b.title+' '+(b.author||'')).toLocaleLowerCase('it').includes(query));results.replaceChildren(...matches.map(book=>panel([el('div',{className:'library-card'},[cover(book),el('div',{},[el('h2',{text:book.title}),para(book.author||''),button('Apri libro',()=>detail(book.id),true)])])])));if(!matches.length)results.append(para('Nessun libro trovato.'))}search.addEventListener('input',update);render(heading('La tua biblioteca','LE TUE STORIE'),search,results);update()}
function detail(id){const book=findBook(id);if(!book)return library();currentView='detail';const nodes=[backArrow(library,'Torna alla biblioteca'),heading(book.title,'SCOPRI IL LIBRO'),cover(book),para(book.author||''),para(book.description||''),trailerButton(book)];if(book.availability==='preview')nodes.push(para('Anteprima del catalogo: la lettura non è ancora disponibile.','preview-notice'));else nodes.push(para(book.chapters.length+' capitoli disponibili'),button(getProgress(id)?(getSetting('reading-path:'+id,'normal')==='episodes'?'Riprendi gli episodi':'Continua a leggere'):'Inizia a leggere',()=>readingEntry(id),true),finishControl(id),...(id==='libro-demo'?[(()=>{const b=button('Ricomincia la demo',()=>resetDemo(id));b.classList.add('demo-reset-link');return b})()]:[]));render(...nodes)}
function readingEntry(id){
 const book=findBook(id);if(!book)return library();
 if(book.availability==='preview')return detail(id);
 const preference=getSetting('reading-path:'+id,'');
 if(!preference&&!getProgress(id))return chooseReadingPath(id);
 if(preference==='episodes'){const ep=getSetting('episode-current:'+id,'');const found=allEpisodes(book).find(e=>e.id===ep);return found?reader(id,found.chapterId,getMode(id),null,true,found.id):episodes(id)}
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
 const seasonTabs=el('div',{className:'season-tabs',attrs:{role:'group','aria-label':'Seleziona stagione'}},seasons.map(season=>{const b=button('S'+season.number,()=>episodes(id,season.number),season.number===selected.number);b.classList.add('season-tab');b.setAttribute('aria-pressed',String(season.number===selected.number));return b}));
 const cards=selected.episodes.map((ep,i)=>{
  const chapter=book.chapters.find(c=>c.id===(ep.chapterId||ep.id));
  const item={...ep,season:selected.number,number:i+1};
  const isCurrent=current?.id===ep.id&&(saved||getSetting('episode-current:'+id,''));
  const open=mode=>{rememberEpisode(id,item);saveSetting('format:'+id,mode);reader(id,chapter?.id,mode,null,true,item.id)};
  const cardRecapSlot=el('div',{className:'episode-card-recap-slot'});
  return el('article',{className:'episode-card'},[
   el('span',{className:'episode-number',text:String(i+1)}),
   el('div',{className:'episode-info'},[
    el('p',{className:'episode-code',text:episodeLabel(item)}),
    el('h3',{text:ep.title||('Episodio '+(i+1))}),
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
 render(backArrow(()=>detail(id)),heading(book.title,'LA TUA STORIA · EPISODI'),
 seasonTabs,el('h2',{className:'season-heading',text:'Stagione '+selected.number}),el('div',{className:'episodes-list'},cards),
 pathLink('Passa al libro completo',()=>{saveSetting('reading-path:'+id,'normal');reader(id)}));
}
function openSummary(id,chapterId,mode,inEpisode,episodeId){
 const book=findBook(id);if(!book)return;
 currentView='summary';
 if(chapterId)saveSetting('summary-chapter:'+id,chapterId);
 const goBack=()=>reader(id,chapterId,mode,null,inEpisode,episodeId);
 const continueAt=nextId=>{saveProgress(id,nextId);reader(id,nextId,mode,null,inEpisode,episodeId)};
 render(button('← Torna alla storia',goBack),heading(book.title,'RIASSUNTI · LIBRO COMPLETO'),summaryView(book,goBack,continueAt));
}
async function reader(id,chapterId,modeOverride,seekOffset=null,episodic=false,episodeId=null){const book=findBook(id);if(!book)return library();currentView='reader';const mode=modeOverride||getMode(id);const saved=getProgress(id);const chapter=book.chapters.find(c=>c.id===chapterId)||book.chapters.find(c=>c.id===saved?.chapter)||book.chapters[0];const inEpisode=episodic||getSetting('reading-path:'+id,'normal')==='episodes';const nav=button('←',()=>inEpisode?episodes(id):detail(id));nav.classList.add('reader-back');nav.setAttribute('aria-label',inEpisode?'Torna agli episodi':'Torna alla scheda libro');const pathChange=pathLink(inEpisode?'Passa al libro completo':'Passa a episodi',()=>{saveSetting('reading-path:'+id,inEpisode?'normal':'episodes');inEpisode?reader(id,chapter?.id,mode):episodes(id)});const episode= inEpisode?(allEpisodes(book).find(ep=>ep.id===episodeId)||currentEpisode(book)||episodeForChapter(book,chapter?.id)):null;if(episode)rememberEpisode(id,episode);const episodeHeading=episode?el('div',{className:'episode-reader-context'},[el('span',{text:episodeLabel(episode)}),el('strong',{text:episode.title||'Episodio'}),...(episodeRecap(book,episode)?[recapPrompt(book,episode)]:[])]):null;const summaryButton=button('✦ Riassumi',()=>openSummary(id,chapter?.id,mode,inEpisode,episode?.id));summaryButton.classList.add('summary-launch','summary-warm');const readingExtras=el('div',{className:'summary-footer'},[el('span',{className:'summary-footer-hint',text:'Vuoi un riepilogo?'}),summaryButton]);const switcher=formatSwitch(id,mode,next=>reader(id,chapter?.id,next,null,inEpisode,episode?.id));const quickSwitch=formatSwitch(id,mode,next=>reader(id,chapter?.id,next,null,inEpisode,episode?.id));quickSwitch.classList.add('format-switch-bottom');if(!chapter)return render(nav,heading(book.title,'IL TUO LIBRO'),switcher,para('Questo libro non contiene capitoli.'),pathChange);
if(mode==='audio'){const shell=el('section',{className:'reading-shell audio-sync-shell'},[el('h2',{text:'Ascolta la tua storia'}),audioView(),el('p',{className:'switch-context',text:getPhrase(id)?.phrase?'Segnalibro: “'+getPhrase(id).phrase+'”':'Nessun punto di testo selezionato.'})]);render(nav,heading(book.title,'IL TUO LIBRO'),...(episodeHeading?[episodeHeading]:[]),shell,readingExtras,finishControl(id),pathChange,quickSwitch);activeReaderTools=createReaderTools({focusOnly:true});activeReaderTools.mount(shell);return}
if(mode==='paper'){const search=phraseSearch(book,(item,target='ebook')=>{saveSetting('format:'+id,target);reader(id,item?.chapter||chapter?.id,target,item?.offset??null,inEpisode,episode?.id)});const point=getPhrase(id);const paperResume=point?.phrase?el('aside',{className:'paper-resume-card'},[el('h2',{text:'Riprendi sul cartaceo'}),el('strong',{className:'paper-resume-location',text:'Pagina cartacea: '+(point.page||'da verificare')+' · '+(book.chapters.find(c=>c.id===point.chapter)?.title||'Capitolo salvato')}),el('p',{className:'paper-resume-quote',text:'Cerca questa frase: «'+point.phrase+'»'}),el('p',{className:'paper-resume-note',text:'Riferimento al testo digitale di REM. La pagina cartacea dipende dall’edizione: cerca le parole riportate per ritrovare il punto esatto.'})]):null;const shell=el('section',{className:'reading-shell paper-sync-shell'},[...(paperResume?[paperResume]:[]),el('h2',{text:'Da dove ripartiamo?'}),el('p',{text:'Scegli il formato e continua la tua lettura. Per ritrovare il punto nel cartaceo, fotografa la pagina oppure scrivi le ultime parole che hai letto.'}),search,el('p',{className:'switch-context',text:getPhrase(id)?.phrase?'Segnalibro: “'+getPhrase(id).phrase+'”':'Nessun punto salvato: cerca una frase per sincronizzare la lettura.'})]);render(nav,heading(book.title,'IL TUO LIBRO'),...(episodeHeading?[episodeHeading]:[]),shell,readingExtras,finishControl(id),pathChange,quickSwitch);activeReaderTools=createReaderTools({focusOnly:true});activeReaderTools.mount(shell);return}
const readingUnitTitle=inEpisode&&episode?episodeLabel(episode)+' · '+(episode.title||'') : chapter.title;
const chapterSelect=el('select',{attrs:{'aria-label':'Scegli episodio o capitolo'}});for(const c of book.chapters)chapterSelect.append(el('option',{text:inEpisode?((ep=>ep?episodeLabel(ep)+' · '+(ep.title||''):c.title)(allEpisodes(book).find(ep=>ep.chapterId===c.id))):c.title,attrs:{value:c.id}}));chapterSelect.value=chapter.id;chapterSelect.addEventListener('change',()=>{const selectedEpisode=inEpisode?allEpisodes(book).find(ep=>ep.chapterId===chapterSelect.value):null;reader(id,chapterSelect.value,'ebook',null,inEpisode,selectedEpisode?.id||null)});
const sizeSelect=el('select',{attrs:{'aria-label':'Dimensione testo'}});for(const [value,label] of [['normal','Normale'],['large','Grande'],['xlarge','Molto grande']])sizeSelect.append(el('option',{text:label,attrs:{value}}));sizeSelect.value=getSetting('fontSize','normal');const text=el('article',{className:'reading-text '+sizeSelect.value});sizeSelect.addEventListener('change',()=>{saveSetting('fontSize',sizeSelect.value);text.className='reading-text '+sizeSelect.value});const controls=el('div',{className:'reader-controls'},[chapterSelect]);const idx=book.chapters.findIndex(c=>c.id===chapter.id);const prev=button('←',()=>reader(id,book.chapters[idx-1]?.id,'ebook',null,inEpisode,null));prev.setAttribute('aria-label','Capitolo precedente');const next=button('→',()=>reader(id,book.chapters[idx+1]?.id,'ebook',null,inEpisode,null));next.setAttribute('aria-label','Capitolo successivo');prev.disabled=idx===0;next.disabled=idx===book.chapters.length-1;const journey=createEbookJourney(id,target=>{saveSetting('format:'+id,target);reader(id,chapter.id,target,null,inEpisode,episode?.id)});const readingShell=el('section',{className:'reading-shell ebook-reading-shell'},[journey.root,controls,el('h2',{className:'ebook-chapter-heading',text:readingUnitTitle}),el('div',{className:'ebook-page-frame'},[el('div',{className:'ebook-page-heading'},[el('strong',{text:book.title}),el('strong',{text:readingUnitTitle})]),text]),el('div',{className:'chapter-actions ebook-chapter-nav'},[prev,next])]);journey.enableImmersive(readingShell);render(nav,heading(book.title,'ORA STAI LEGGENDO'),...(episodeHeading?[episodeHeading]:[]),readingShell,readingExtras,finishControl(id),pathChange,quickSwitch);activeHighlights=createHighlights(id,chapter.id,text,()=>{},(quote,offset)=>{savePhrase(id,chapter.id,quote,offset);journey.refresh()});readingShell.querySelector('.ebook-chapter-nav')?.after(activeHighlights.wrap);const rail=el('div',{className:'ebook-scroll-rail',attrs:{'aria-hidden':'true'}},[el('div',{className:'ebook-scroll-thumb'})]);const frame=readingShell.querySelector('.ebook-page-frame');frame?.append(rail);const updateRail=()=>{const total=text.scrollHeight-text.clientHeight;const ratio=text.scrollHeight?text.clientHeight/text.scrollHeight:1;rail.firstChild.style.height=Math.max(12,ratio*100)+'%';rail.firstChild.style.top=(total>0?(text.scrollTop/total)*(100-Math.max(12,ratio*100)):0)+'%';rail.classList.toggle('is-scrollable',total>2)};text.addEventListener('scroll',updateRail,{passive:true});requestAnimationFrame(updateRail);activeHighlights.wrap.append(el('div',{className:'ebook-inline-switches'},[button('Passa a Cartaceo',()=>{saveSetting('format:'+id,'paper');reader(id,chapter.id,'paper',null,inEpisode,episode?.id)}),button('Passa ad Audio',()=>{saveSetting('format:'+id,'audio');reader(id,chapter.id,'audio',null,inEpisode,episode?.id)})]));activeReaderTools=createReaderTools();activeReaderTools.mount(readingShell);text.textContent='Caricamento capitolo…';try{const content=await loadChapter(book,chapter);if(!text.isConnected)return;activeHighlights?.setText(content);requestAnimationFrame(updateRail);saveProgress(id,chapter.id);const point=getPhrase(id);const offset=seekOffset??(point?.chapter===chapter.id?point.offset:null);if(Number.isInteger(offset)&&offset>=0&&offset<content.length){
 const match=point?.chapter===chapter.id&&point.offset===offset?point:null;
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
}catch(error){if(text.isConnected)text.textContent='Impossibile caricare il capitolo: '+error.message}}
document.getElementById('brand').onclick=home;document.getElementById('navHome').onclick=home;document.getElementById('navLibrary').onclick=library;
try{books=await loadCatalog();if(onboardingCompleted()||getSetting('onboarding-v1','')==='later')home();else showOnboarding(render,home)}catch(error){render(heading('REM Next','ERRORE'),para('Impossibile caricare il catalogo: '+error.message),para('Avvia l’app tramite un server web, non aprendo index.html come file locale.'))}