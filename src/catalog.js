const BASE='./content/books/';
export function validateCatalog(data){
 if(!data||data.schemaVersion!==1||!Array.isArray(data.books))throw Error('Catalogo non valido: schemaVersion 1 e books[] richiesti');
 const ids=new Set();
 for(const b of data.books){if(!b||typeof b.id!=='string'||!/^[a-z0-9-]+$/.test(b.id)||!b.title||typeof b.title!=='string'||!['published','draft'].includes(b.status)||!Array.isArray(b.chapters))throw Error('Libro non valido');if(ids.has(b.id))throw Error('ID libro duplicato: '+b.id);ids.add(b.id);const chapterIds=new Set();for(const c of b.chapters){if(!c.id||!c.title||!c.file||!/^([a-z0-9-]+)\.txt$/.test(c.file)||chapterIds.has(c.id))throw Error('Capitolo non valido in '+b.id);chapterIds.add(c.id)}}
 return data.books.filter(b=>b.status==='published');
}
export async function loadCatalog(){const r=await fetch(BASE+'catalog.json?v=rem-editorial-227',{cache:'no-store'});if(!r.ok)throw Error('Catalogo non disponibile ('+r.status+')');return validateCatalog(await r.json())}
// Pinocchio: read the original Italian public-domain text from Wikisource.
// This avoids distributing an altered transcription and keeps all 36 chapters available.
const pinocchioCache=new Map();
async function loadPinocchioChapter(chapter){
 const number=Number(chapter.id.match(/^capitolo-(\d+)$/)?.[1]);
 if(!Number.isInteger(number)||number<1||number>36)throw Error('Capitolo di Pinocchio non valido');
 if(pinocchioCache.has(number))return pinocchioCache.get(number);
 const page='Le_avventure_di_Pinocchio/Capitolo_'+number;
 const url='https://it.wikisource.org/w/api.php?action=parse&format=json&formatversion=2&prop=text&origin=*&page='+encodeURIComponent(page);
 const response=await fetch(url);
 if(!response.ok)throw Error('Impossibile caricare il capitolo da Wikisource');
 const payload=await response.json();
 if(payload.error||!payload.parse?.text)throw Error('Testo del capitolo non disponibile su Wikisource');
 const doc=new DOMParser().parseFromString(payload.parse.text,'text/html');
 const root=doc.querySelector('.mw-parser-output')||doc.body;
 root.querySelectorAll('style,script,table,.mw-editsection,.ws-noexport,.noprint,.mw-cite-backlink,.reference,.mw-references-wrap,.printfooter,.catlinks,.mw-parser-output > nav, .header-container, .ws-summary, .ws-title').forEach(node=>node.remove());
 const paragraphs=[...root.querySelectorAll('p')].map(p=>p.textContent.replace(/\s+/g,' ').trim()).filter(p=>p.length>25);
 let content=paragraphs.join('\n\n');
 // Remove only repeated title labels at the start of the chapter.
 content=content.replace(/^\s*Le avventure di Pinocchio\s*/i,'').replace(new RegExp('^\\s*Capitolo\\s*'+number+'\\s*','i'),'');
 if(content.length<450)throw Error('Il testo del capitolo non è stato estratto correttamente');
 pinocchioCache.set(number,content);
 return content;
}
// Pirandello: load each complete original chapter from Italian Wikisource.
const mattiaCache=new Map();
async function loadMattiaChapter(chapter){
 const number=Number(chapter.id.match(/^capitolo-(\d+)$/)?.[1]);
 if(!Number.isInteger(number)||number<1||number>18)throw Error('Capitolo di Mattia Pascal non valido');
 if(mattiaCache.has(number))return mattiaCache.get(number);
 const page='Il_fu_Mattia_Pascal/'+number;
 const url='https://it.wikisource.org/w/api.php?action=parse&format=json&formatversion=2&prop=text&origin=*&page='+encodeURIComponent(page);
 const response=await fetch(url);
 if(!response.ok)throw Error('Impossibile caricare il capitolo da Wikisource');
 const payload=await response.json();
 if(payload.error||!payload.parse?.text)throw Error('Testo del capitolo non disponibile su Wikisource');
 const doc=new DOMParser().parseFromString(payload.parse.text,'text/html');
 const root=doc.querySelector('.mw-parser-output')||doc.body;
 root.querySelectorAll('style,script,table,.mw-editsection,.ws-noexport,.noprint,.reference,.mw-references-wrap,.printfooter,.catlinks,.header-container,.ws-summary,.ws-title,.ws-header,.ws-footer').forEach(node=>node.remove());
 const paragraphs=[...root.querySelectorAll('p')].map(p=>p.textContent.replace(/\s+/g,' ').trim()).filter(p=>p.length>8);
 let content=paragraphs.join('\n\n');
 if(content.length<120)throw Error('Il capitolo non è stato estratto correttamente');
 mattiaCache.set(number,content);
 return content;
}
export async function loadChapter(book,chapter){
 if(book.id==='pinocchio')return loadPinocchioChapter(chapter);
 if(book.id==='mattia-pascal')return loadMattiaChapter(chapter);
 const r=await fetch(BASE+encodeURIComponent(book.id)+'/'+chapter.file+'?v=long-reading-38',{cache:'no-store'});
 if(!r.ok)throw Error('Capitolo non disponibile');
 return r.text();
}