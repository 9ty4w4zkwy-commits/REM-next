const BASE='./content/books/';
export function validateCatalog(data){
 if(!data||data.schemaVersion!==1||!Array.isArray(data.books))throw Error('Catalogo non valido: schemaVersion 1 e books[] richiesti');
 const ids=new Set();
 for(const b of data.books){if(!b||typeof b.id!=='string'||!/^[a-z0-9-]+$/.test(b.id)||!b.title||typeof b.title!=='string'||!['published','draft'].includes(b.status)||!Array.isArray(b.chapters))throw Error('Libro non valido');if(ids.has(b.id))throw Error('ID libro duplicato: '+b.id);ids.add(b.id);const chapterIds=new Set();for(const c of b.chapters){if(!c.id||!c.title||!c.file||!/^([a-z0-9-]+)\.txt$/.test(c.file)||chapterIds.has(c.id))throw Error('Capitolo non valido in '+b.id);chapterIds.add(c.id)}}
 return data.books.filter(b=>b.status==='published');
}
export async function loadCatalog(){const r=await fetch(BASE+'catalog.json',{cache:'no-store'});if(!r.ok)throw Error('Catalogo non disponibile ('+r.status+')');return validateCatalog(await r.json())}
export async function loadChapter(book,chapter){const r=await fetch(BASE+encodeURIComponent(book.id)+'/'+chapter.file,{cache:'no-store'});if(!r.ok)throw Error('Capitolo non disponibile');return r.text()}