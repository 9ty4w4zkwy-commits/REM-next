import {loadCatalog,loadChapter} from './catalog.js';
import {getProgress,saveProgress,getSetting,saveSetting} from './progress.js';
import {el,button,panel,heading} from './ui.js';
import {getMode,formatSwitch,paperView,audioView} from './formats.js';
import {createReaderTools} from './reader-tools.js?v=rem-ebook-42';
import {createHighlights} from './highlights.js?v=rem-ebook-44';
import {createEbookJourney} from './ebook-journey.js?v=rem-ebook-44';
import {phraseSearch,getPhrase,savePhrase} from './synchronization.js?v=rem-switch-31';
import {HOME_SECTIONS,booksForHomeSection} from './home-config.js';
import {summaryView} from './summary-view.js?v=rem-summary-50';
const app=document.getElementById('app');let books=[];let currentView='home';let activeReaderTools=null;let activeHighlights=null;
const render=(...nodes)=>{if(activeHighlights){activeHighlights.destroy();activeHighlights=null}if(activeReaderTools){activeReaderTools.destroy();activeReaderTools=null}app.replaceChildren(...nodes);window.scrollTo({top:0,left:0,behavior:'instant'});document.documentElement.scrollTop=0;document.body.scrollTop=0};
const para=(text,cls='')=>el('p',{text,className:cls});
const findBook=id=>books.find(b=>b.id===id);
const episodeKey=id=>'episode-done:'+id;
const episodeDone=id=>{try{return JSON.parse(getSetting(episodeKey(id),'{}'))||{}}catch{return {}}};
const setEpisodeDone=(id,chapterId,done)=>{const data=episodeDone(id);if(done)data[chapterId]=true;else delete data[chapterId];saveSetting(episodeKey(id),JSON.stringify(data))};
const storySeasons=book=>book.seasons?.length?book.seasons:[{number:1,episodes:book.chapters.map((chapter,i)=>({id:chapter.id,title:chapter.title.replace(/^Capitolo\s*\d+\s*[·—–-]\s*/i,''),chapterId:chapter.id,recap:chapter.recap,minutes:chapter.minutes}))}];
const allEpisodes=book=>storySeasons(book).flatMap(season=>season.episodes.map((ep,i)=>({...ep,season:season.number,number:i+1})));
const episodeLabel=ep=>'S'+ep.season+'E'+ep.number;
const episodeForChapter=(book,id)=>allEpisodes(book).find(ep=>ep.chapterId===id)||allEpisodes(book)[0];
const currentEpisode=book=>{const saved=getSetting('episode-current:'+book.id,'');return allEpisodes(book).find(ep=>ep.id===saved)||episodeForChapter(book,getProgress(book.id)?.chapter)};
const rememberEpisode=(id,ep)=>saveSetting('episode-current:'+id,ep.id);
const resumeLabel=book=>{const path=getSetting('reading-path:'+book.id,'');if(path==='episodes'){const ep=currentEpisode(book);return ep?'Riprendi da '+episodeLabel(ep):'Scopri gli episodi'}return getProgress(book.id)?'Continua a leggere':'Scopri il libro'};

function resetDemo(id){if(!confirm('Ricominciare la demo da zero? Verranno cancellati il segnalibro e la scelta di lettura della sola demo.'))return;try{localStorage.removeItem('rem-next-v1:'+id);for(const key of ['reading-path:','format:','sync-point:','episode-current:','episode-season:',episodeKey('')])localStorage.removeItem('rem-next-v1:setting:'+key+id)}catch{}chooseReadingPath(id)}

const cover=book=>{const visual=el('div',{className:'cover '+(book.coverStyle==='classic'?'classic':'forest')},[el('div',{className:'cover-art',attrs:{'aria-hidden':'true'}},[el('span',{className:'art-orbit'}),el('span',{className:'art-moon'}),el('span',{className:'art-horizon'})]),el('span',{className:'cover-imprint',text:'R E M  /  STORIES'}),el('div',{className:'cover-copy'},[el('strong',{text:book.title}),el('small',{text:book.author||''})])]);if(book.coverImage){const img=el('img',{className:'cover-photo',attrs:{src:book.coverImage,alt:'Copertina di '+book.title,loading:'lazy'}});img.addEventListener('load',()=>visual.classList.add('has-cover-image'));img.addEventListener('error',()=>img.remove());visual.append(img)}return visual};
function home(){currentView='home';const intro=el('section',{className:'rem-home-intro'},[el('p',{className:'eyebrow',text:'SCOPRI REM'}),el('h1',{},[document.createTextNode('La tua prossima storia '),el('span',{className:'mint-word',text:'ti aspetta.'})]),para('Scopri i libri disponibili, ritrova le tue letture e passa da un formato all’altro.','rem-home-subtitle')]);const shelf=(section)=>{const list=booksForHomeSection(section.id,books,getProgress,id=>getSetting('reading-path:'+id,''),id=>getSetting('episode-current:'+id,''));const cards=list.map(book=>{const saved=getProgress(book.id);const path=getSetting('reading-path:'+book.id,'');return el('article',{className:'rem-book-card'},[cover(book),el('h3',{text:book.title}),para(book.author||'Una storia da scoprire','rem-card-subtitle'),...(saved||path?[el('span',{className:'home-reading-label',text:path==='episodes'?'A EPISODI':'LIBRO COMPLETO'})]:[]),button(book.availability==='preview'?'Scopri il libro':resumeLabel(book),()=>book.availability==='preview'?detail(book.id):readingEntry(book.id),true)])});return el('section',{className:'rem-home-section',attrs:{'data-section':section.id}},[el('h2',{className:'rem-section-title',text:section.title}),...(cards.length?[el('div',{className:'rem-book-grid'},cards)]:[para(section.empty,'rem-empty-section')])])};render(intro,...HOME_SECTIONS.map(shelf))}
function library(){currentView='library';const search=el('input',{attrs:{type:'search',placeholder:'Titolo o autore','aria-label':'Cerca libri'}});const results=el('div');function update(){const query=search.value.trim().toLocaleLowerCase('it');const matches=books.filter(b=>(b.title+' '+(b.author||'')).toLocaleLowerCase('it').includes(query));results.replaceChildren(...matches.map(book=>panel([el('div',{className:'library-card'},[cover(book),el('div',{},[el('h2',{text:book.title}),para(book.author||''),button('Apri libro',()=>detail(book.id),true)])])])));if(!matches.length)results.append(para('Nessun libro trovato.'))}search.addEventListener('input',update);render(heading('La tua biblioteca','LE TUE STORIE'),search,results);update()}
function detail(id){const book=findBook(id);if(!book)return library();currentView='detail';const nodes=[button('← Biblioteca',library),heading(book.title,'SCOPRI IL LIBRO'),cover(book),para(book.author||''),para(book.description||'')];if(book.availability==='preview')nodes.push(para('Anteprima del catalogo: la lettura non è ancora disponibile.','preview-notice'));else nodes.push(para(book.chapters.length+' capitoli disponibili'),button(getProgress(id)?(getSetting('reading-path:'+id,'normal')==='episodes'?'Riprendi gli episodi':'Continua a leggere'):'Inizia a leggere',()=>readingEntry(id),true),...(id==='libro-demo'?[(()=>{const b=button('Ricomincia la demo',()=>resetDemo(id));b.classList.add('demo-reset-link');return b})()]:[]));render(...nodes)}
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
 render(button('← Scheda libro',()=>detail(id)),heading('Una storia. Due modi di viverla.','LA TUA ESPERIENZA'),para(book.title,'reading-path-book'),para('La storia è la stessa. Cambia il ritmo con cui scegli di scoprirla. Puoi cambiare modalità in qualsiasi momento senza perdere il segnalibro.','reading-path-note'),el('div',{className:'reading-path-grid'},[
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
  return el('article',{className:'episode-card'},[
   el('span',{className:'episode-number',text:String(i+1)}),
   el('div',{className:'episode-info'},[
    el('p',{className:'episode-code',text:episodeLabel(item)}),
    el('h3',{text:ep.title||('Episodio '+(i+1))}),
    para(ep.recap||'Il recap di questo episodio sarà disponibile presto.','episode-recap'),
    el('div',{className:'episode-meta'},[el('span',{text:ep.minutes?'circa '+ep.minutes+' min':'Durata da definire'}),...(isCurrent?[el('span',{className:'episode-current',text:'Sei qui'})]:[]),...(done[ep.id]?[el('span',{className:'episode-done',text:'Letto'})]:[])]),
    el('div',{className:'episode-actions'},[
     button('Ebook',()=>open('ebook')),
     button('Audio',()=>open('audio')),
     button('Cartaceo',()=>open('paper')),
     button(done[ep.id]?'✓ Letto sul cartaceo':'Segna letto sul cartaceo',()=>{setEpisodeDone(id,ep.id,!done[ep.id]);episodes(id,selected.number)})
    ])
   ])
  ]);
 });
 render(button('← Scheda libro',()=>detail(id)),heading(book.title,'LA TUA STORIA · EPISODI'),
 
 seasonTabs,el('h2',{className:'season-heading',text:'Stagione '+selected.number}),el('div',{className:'episodes-list'},cards),
 button('Passa al libro completo',()=>{saveSetting('reading-path:'+id,'normal');reader(id)}));
}
function openSummary(id,chapterId,mode,inEpisode,episodeId){
 const book=findBook(id);if(!book)return;
 currentView='summary';
 if(chapterId)saveSetting('summary-chapter:'+id,chapterId);
 const goBack=()=>reader(id,chapterId,mode,null,inEpisode,episodeId);
 const continueAt=nextId=>{saveProgress(id,nextId);reader(id,nextId,mode,null,inEpisode,episodeId)};
 render(button('← Torna alla storia',goBack),heading(book.title,'RIASSUNTI · LIBRO COMPLETO'),summaryView(book,goBack,continueAt));
}
async function reader(id,chapterId,modeOverride,seekOffset=null,episodic=false,episodeId=null){const book=findBook(id);if(!book)return library();currentView='reader';const mode=modeOverride||getMode(id);const saved=getProgress(id);const chapter=book.chapters.find(c=>c.id===chapterId)||book.chapters.find(c=>c.id===saved?.chapter)||book.chapters[0];const inEpisode=episodic||getSetting('reading-path:'+id,'normal')==='episodes';const nav=button('←',()=>inEpisode?episodes(id):detail(id));nav.classList.add('reader-back');nav.setAttribute('aria-label',inEpisode?'Torna agli episodi':'Torna alla scheda libro');const pathChange=button(inEpisode?'Passa al libro completo':'Passa a episodi',()=>{saveSetting('reading-path:'+id,inEpisode?'normal':'episodes');inEpisode?reader(id,chapter?.id,mode):episodes(id)});pathChange.classList.add('reading-path-switch');const episode= inEpisode?(allEpisodes(book).find(ep=>ep.id===episodeId)||currentEpisode(book)||episodeForChapter(book,chapter?.id)):null;if(episode)rememberEpisode(id,episode);const episodeHeading=episode?el('div',{className:'episode-reader-context'},[el('span',{text:episodeLabel(episode)}),el('strong',{text:episode.title||'Episodio'}),para(episode.recap||'')]):null;const summaryButton=button('Riassumi',()=>openSummary(id,chapter?.id,mode,inEpisode,episode?.id));summaryButton.classList.add('summary-launch');const readingExtras=el('div',{className:'reading-extras'},[el('p',{className:'reading-extras-label',text:'ALTRI MODI DI VIVERE LA STORIA'}),el('div',{className:'reading-extras-actions'},[pathChange,summaryButton])]);const switcher=formatSwitch(id,mode,next=>reader(id,chapter?.id,next,null,inEpisode,episode?.id));const quickSwitch=formatSwitch(id,mode,next=>reader(id,chapter?.id,next,null,inEpisode,episode?.id));quickSwitch.classList.add('format-switch-bottom');if(!chapter)return render(nav,heading(book.title,'IL TUO LIBRO'),pathChange,switcher,para('Questo libro non contiene capitoli.'));
if(mode==='audio'){const shell=el('section',{className:'reading-shell audio-sync-shell'},[el('h2',{text:'Ascolta la tua storia'}),audioView(),el('p',{className:'switch-context',text:getPhrase(id)?.phrase?'Segnalibro: “'+getPhrase(id).phrase+'”':'Nessun punto di testo selezionato.'})]);render(nav,heading(book.title,'IL TUO LIBRO'),...(episodeHeading?[episodeHeading]:[]),shell,readingExtras,quickSwitch);activeReaderTools=createReaderTools({focusOnly:true});activeReaderTools.mount(shell);return}
if(mode==='paper'){const search=phraseSearch(book,(item,target='ebook')=>{saveSetting('format:'+id,target);reader(id,item?.chapter||chapter?.id,target,item?.offset??null,inEpisode,episode?.id)});const point=getPhrase(id);const paperResume=point?.phrase?el('aside',{className:'paper-resume-card'},[el('h2',{text:'Riprendi sul cartaceo'}),el('strong',{className:'paper-resume-location',text:'Pagina cartacea: '+(point.page||'da verificare')+' · '+(book.chapters.find(c=>c.id===point.chapter)?.title||'Capitolo salvato')}),el('p',{className:'paper-resume-quote',text:'Cerca questa frase: «'+point.phrase+'»'}),el('p',{className:'paper-resume-note',text:'Riferimento al testo digitale di REM. La pagina cartacea dipende dall’edizione: cerca le parole riportate per ritrovare il punto esatto.'})]):null;const shell=el('section',{className:'reading-shell paper-sync-shell'},[...(paperResume?[paperResume]:[]),el('h2',{text:'Da dove ripartiamo?'}),el('p',{text:'Scegli il formato e continua la tua lettura. Per ritrovare il punto nel cartaceo, fotografa la pagina oppure scrivi le ultime parole che hai letto.'}),search,el('p',{className:'switch-context',text:getPhrase(id)?.phrase?'Segnalibro: “'+getPhrase(id).phrase+'”':'Nessun punto salvato: cerca una frase per sincronizzare la lettura.'})]);render(nav,heading(book.title,'IL TUO LIBRO'),...(episodeHeading?[episodeHeading]:[]),shell,readingExtras,quickSwitch);activeReaderTools=createReaderTools({focusOnly:true});activeReaderTools.mount(shell);return}
const chapterSelect=el('select',{attrs:{'aria-label':'Scegli capitolo'}});for(const c of book.chapters)chapterSelect.append(el('option',{text:c.title,attrs:{value:c.id}}));chapterSelect.value=chapter.id;chapterSelect.addEventListener('change',()=>reader(id,chapterSelect.value,'ebook',null,inEpisode,episode?.id));
const sizeSelect=el('select',{attrs:{'aria-label':'Dimensione testo'}});for(const [value,label] of [['normal','Normale'],['large','Grande'],['xlarge','Molto grande']])sizeSelect.append(el('option',{text:label,attrs:{value}}));sizeSelect.value=getSetting('fontSize','normal');const text=el('article',{className:'reading-text '+sizeSelect.value});sizeSelect.addEventListener('change',()=>{saveSetting('fontSize',sizeSelect.value);text.className='reading-text '+sizeSelect.value});const controls=el('div',{className:'reader-controls'},[chapterSelect]);const idx=book.chapters.findIndex(c=>c.id===chapter.id);const prev=button('←',()=>reader(id,book.chapters[idx-1]?.id,'ebook',null,inEpisode,null));prev.setAttribute('aria-label','Capitolo precedente');const next=button('→',()=>reader(id,book.chapters[idx+1]?.id,'ebook',null,inEpisode,null));next.setAttribute('aria-label','Capitolo successivo');prev.disabled=idx===0;next.disabled=idx===book.chapters.length-1;const journey=createEbookJourney(id,target=>{saveSetting('format:'+id,target);reader(id,chapter.id,target,null,inEpisode,episode?.id)});const readingShell=el('section',{className:'reading-shell ebook-reading-shell'},[journey.root,controls,el('h2',{className:'ebook-chapter-heading',text:chapter.title}),el('div',{className:'ebook-page-frame'},[el('div',{className:'ebook-page-heading'},[el('strong',{text:book.title}),el('strong',{text:chapter.title})]),text]),el('div',{className:'chapter-actions ebook-chapter-nav'},[prev,next])]);journey.enableImmersive(readingShell);render(nav,heading(book.title,'ORA STAI LEGGENDO'),...(episodeHeading?[episodeHeading]:[]),readingShell,readingExtras,quickSwitch);activeHighlights=createHighlights(id,chapter.id,text,()=>{},(quote,offset)=>{savePhrase(id,chapter.id,quote,offset);journey.refresh()});readingShell.querySelector('.ebook-chapter-nav')?.after(activeHighlights.wrap);const rail=el('div',{className:'ebook-scroll-rail',attrs:{'aria-hidden':'true'}},[el('div',{className:'ebook-scroll-thumb'})]);const frame=readingShell.querySelector('.ebook-page-frame');frame?.append(rail);const updateRail=()=>{const total=text.scrollHeight-text.clientHeight;const ratio=text.scrollHeight?text.clientHeight/text.scrollHeight:1;rail.firstChild.style.height=Math.max(12,ratio*100)+'%';rail.firstChild.style.top=(total>0?(text.scrollTop/total)*(100-Math.max(12,ratio*100)):0)+'%';rail.classList.toggle('is-scrollable',total>2)};text.addEventListener('scroll',updateRail,{passive:true});requestAnimationFrame(updateRail);activeHighlights.wrap.append(el('div',{className:'ebook-inline-switches'},[button('Passa a Cartaceo',()=>{saveSetting('format:'+id,'paper');reader(id,chapter.id,'paper',null,inEpisode,episode?.id)}),button('Passa ad Audio',()=>{saveSetting('format:'+id,'audio');reader(id,chapter.id,'audio',null,inEpisode,episode?.id)})]));activeReaderTools=createReaderTools();activeReaderTools.mount(readingShell);text.textContent='Caricamento capitolo…';try{const content=await loadChapter(book,chapter);if(!text.isConnected)return;activeHighlights?.setText(content);requestAnimationFrame(updateRail);saveProgress(id,chapter.id);const point=getPhrase(id);const offset=seekOffset??(point?.chapter===chapter.id?point.offset:null);if(Number.isInteger(offset)&&offset>=0&&offset<content.length){
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
try{books=await loadCatalog();home()}catch(error){render(heading('REM Next','ERRORE'),para('Impossibile caricare il catalogo: '+error.message),para('Avvia l’app tramite un server web, non aprendo index.html come file locale.'))}