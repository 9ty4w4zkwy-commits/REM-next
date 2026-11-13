import {readCollections,addShelf,addThought,attachItem,detachItem,removeThought,updateThought,setThoughtVisibility} from './collections-store.js';
import {el,button} from './ui.js';
const node=(tag,cls,text)=>el(tag,{className:cls,text});
const subtitle=(text)=>node('p','rem-violet-muted',text);
export function createCollectionsView({books,openBook,continueBook,isSavedBook=()=>false,back}){
 const root=el('section',{className:'rem-violet'});
 root.replaceChildren();
 const head=el('div',{className:'rem-violet-hero'},[node('p','rem-violet-eyebrow','LA MIA BIBLIOTECA'),node('h1','','Le storie che porti con te.'),subtitle('Libri, idee e pensieri. La tua collezione prende forma.')]);root.append(head);
 const tabs=el('div',{className:'rem-violet-tabs'});root.append(tabs);
 const body=el('div');root.append(body);
 const show=(section)=>{const db=readCollections();tabs.replaceChildren();for(const [id,label] of [['overview','Panoramica'],['shelves','Scaffali'],['thoughts','Pensieri'],['books','Libri']]){const b=button(label,()=>show(id));b.className=id===section?'selected':'';tabs.append(b)}
 body.replaceChildren();
 const sectionTitle=(label)=>body.append(node('h2','rem-violet-heading',label));
 const makeShelf=(s)=>{const card=el('article',{className:'rem-violet-shelf'},[node('span','rem-violet-eyebrow','COLLEZIONE PRIVATA'),node('h3','',s.title),subtitle(s.description||'Una raccolta che cresce con te.')]);const entries=db.items.filter(i=>i.shelfId===s.id);card.append(node('small','',''+entries.length+' elementi'));card.append(button('Apri collezione',()=>showShelf(s)));return card};
 const bookCard=(b)=>{const card=el('article',{className:'rem-violet-book'},[node('strong','',b.title),subtitle(b.author||'')]);card.append(button('Apri libro',()=>openBook(b.id)));return card};
 const thoughtCard=(t)=>{const card=el('article',{className:'rem-violet-thought'});
 const header=el('div',{className:'rem-thought-header'},[node('span','rem-violet-eyebrow','PENSIERO')]);
 const locked=t.private!==false;
 const lock=button(locked?'🔒':'🔓',()=>{const makePublic=locked;if(makePublic){const ok=confirm('Vuoi segnare questo pensiero come pubblico?\\n\\nLa scelta verrà salvata sul dispositivo, ma il pensiero NON sarà visibile ad altri finché REM non avrà una Community online.');if(!ok)return}else{if(!confirm('Vuoi riportare questo pensiero a privato?'))return}setThoughtVisibility(t.id,makePublic);show(section)});
 lock.className='rem-thought-lock';lock.setAttribute('aria-label',locked?'Privato: scegli se renderlo pubblico':'Pubblico (solo impostazione locale): rendi privato');lock.title=locked?'Privato: tocca per cambiare':'Pubblico: impostazione locale';header.append(lock);
 card.append(header,node('p','rem-thought-text',t.text));
 const actions=el('div',{className:'rem-thought-actions'});actions.append(button('Modifica',()=>{const value=prompt('Modifica il pensiero',t.text);if(value!==null&&value.trim()){updateThought(t.id,value);show(section)}}),button('Aggiungi a scaffale',()=>chooseShelf('thought',t.id,section)),button('Elimina',()=>{if(confirm('Eliminare questo pensiero?')){removeThought(t.id);show(section)}}));card.append(actions);return card};
 const createThought=()=>{const b=button('✦ Scrivi un pensiero',()=>{const value=prompt('Scrivi un pensiero libero');if(value?.trim()){addThought(value);show('thoughts')}});b.className='rem-violet-primary';body.append(b)};
 const createShelf=()=>{const b=button('+ Nuova collezione',()=>{const title=prompt('Come si chiama la tua collezione?');if(!title?.trim())return;const description=prompt('Una breve descrizione (facoltativa)')||'';addShelf(title,description);show('shelves')});b.className='rem-violet-primary';body.append(b)};
 const chooseShelf=(type,id,returnTo)=>{if(!db.shelves.length){alert('Crea prima una collezione nella sezione Scaffali.');return}const choices=db.shelves.map((s,i)=>(i+1)+'. '+s.title).join('\n');const n=Number(prompt('Scegli lo scaffale inserendo il numero:\n'+choices));if(Number.isInteger(n)&&n>=1&&n<=db.shelves.length){attachItem(db.shelves[n-1].id,type,id);show(returnTo)}};
 const showShelf=(s)=>{body.replaceChildren();body.append(button('← Tutti gli scaffali',()=>show('shelves')),node('p','rem-violet-eyebrow','COLLEZIONE PRIVATA'),node('h2','',s.title),subtitle(s.description));const filters=el('div',{className:'rem-violet-tabs'}),list=el('div');body.append(filters,list);
 const filter=(kind)=>{filters.replaceChildren();for(const [id,label] of [['all','Tutto'],['book','Libri'],['thought','Pensieri']]){const b=button(label,()=>filter(id));if(kind===id)b.className='selected';filters.append(b)}list.replaceChildren();const entries=readCollections().items.filter(i=>i.shelfId===s.id&&(kind==='all'||i.type===kind));if(!entries.length)list.append(subtitle('Ancora nessun elemento. Aggiungi un libro o un pensiero.'));for(const item of entries){const book=books.find(b=>b.id===item.refId);const thought=readCollections().thoughts.find(t=>t.id===item.refId);const card=el('article',{className:'rem-violet-thought'},[node('span','rem-violet-eyebrow',item.type==='book'?'LIBRO':'PENSIERO'),node('p','',item.type==='book'?book?.title||'Libro non disponibile':thought?.text||'Pensiero non disponibile')]);if(book)card.append(button('Apri libro',()=>openBook(book.id)));card.append(button('Rimuovi dallo scaffale',()=>{detachItem(s.id,item.type,item.refId);filter(kind)}));list.append(card)}};filter('all')};
 if(section==='overview'){
 sectionTitle('La tua Biblioteca in numeri');
 const savedIds=new Set(db.savedBooks.filter(id=>books.some(b=>b.id===id)));
 const stats=el('div',{className:'rem-stats'},[
 [String(savedIds.size),'Libri salvati','books'],[String(db.thoughts.length),'Pensieri','thoughts'],[String(db.shelves.length),'Scaffali','shelves'],[String(db.items.length),'Elementi raccolti','items']
 ].map(([number,label,target])=>{const card=button('',()=>show(target));card.className='rem-stat';card.append(node('strong','',number),node('span','',label),node('span','rem-stat-arrow','↗'));card.setAttribute('aria-label',label+': '+number+'. Apri dettaglio');return card}));
 body.append(stats,subtitle('Una fotografia della tua biblioteca personale. Le collezioni crescono con le tue letture.'));
 const quick=el('div',{className:'rem-dashboard-actions'});
 quick.append(button('✦ Scrivi un pensiero',()=>{const value=prompt('Scrivi un pensiero libero');if(value?.trim()){addThought(value);show('overview')}}),button('Esplora scaffali',()=>show('shelves')));
 body.append(quick);
 }
 if(section==='items'){sectionTitle('Elementi raccolti');body.append(subtitle('Libri e pensieri inseriti nei tuoi scaffali.'));if(!db.items.length)body.append(subtitle('Non hai ancora aggiunto elementi agli scaffali.'));for(const item of db.items){const shelf=db.shelves.find(s=>s.id===item.shelfId);const book=books.find(b=>b.id===item.refId);const thought=db.thoughts.find(t=>t.id===item.refId);const label=item.type==='book'?book?.title:thought?.text;const card=el('article',{className:'rem-violet-book'},[node('span','rem-violet-eyebrow',item.type==='book'?'LIBRO':'PENSIERO'),node('p','',label||'Elemento non disponibile'),subtitle('Scaffale: '+(shelf?.title||'Non disponibile'))]);if(shelf)card.append(button('Apri scaffale',()=>showShelf(shelf)));body.append(card)}}
 if(section==='shelves'){sectionTitle('Le mie collezioni');createShelf();if(!db.shelves.length)body.append(subtitle('Le tue collezioni nasceranno qui.'));for(const s of db.shelves)body.append(makeShelf(s))}
 if(section==='thoughts'){sectionTitle('I miei pensieri');createThought();const input=el('input',{attrs:{type:'search',placeholder:'Cerca nei tuoi pensieri','aria-label':'Cerca pensieri'}});const list=el('div');body.append(input,list);const update=()=>{list.replaceChildren();for(const t of readCollections().thoughts.filter(t=>t.text.toLocaleLowerCase('it').includes(input.value.toLocaleLowerCase('it'))))list.append(thoughtCard(t))};input.addEventListener('input',update);update()}
 if(section==='books'){sectionTitle('I miei libri');body.append(subtitle('I libri che hai aggiunto alla tua Biblioteca dalla Home.'));const saved=books.filter(b=>db.savedBooks.includes(b.id));if(!saved.length)body.append(subtitle('Non hai ancora salvato libri. Dalla Home tocca il + su una copertina.'));for(const b of saved){const card=bookCard(b);card.append(button('+ Aggiungi a uno scaffale',()=>chooseShelf('book',b.id,'books')));body.append(card)}}
 };
 show('overview');return root;
}
