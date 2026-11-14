// REM Biblioteca v1: local-first data, independent of reading progress.
const KEY='rem-next-v1:collections';
const blank=()=>({version:1,shelves:[],thoughts:[],items:[],savedBooks:[]});
export function readCollections(){try{const v=JSON.parse(localStorage.getItem(KEY)||'null');return v&&v.version===1&&Array.isArray(v.shelves)&&Array.isArray(v.thoughts)&&Array.isArray(v.items)?{...v,savedBooks:Array.isArray(v.savedBooks)?v.savedBooks:[]}:blank()}catch{return blank()}}
export function writeCollections(data){localStorage.setItem(KEY,JSON.stringify(data));window.dispatchEvent(new Event('rem-collections-changed'))}
export function newId(){return globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)}
export function addThought(text){const db=readCollections();const item={id:newId(),text:text.trim(),createdAt:new Date().toISOString(),private:true};if(!item.text)return null;db.thoughts.unshift(item);writeCollections(db);return item}
export function addShelf(title,description=''){const db=readCollections();const shelf={id:newId(),title:title.trim(),description:description.trim(),private:true,createdAt:new Date().toISOString()};if(!shelf.title)return null;db.shelves.unshift(shelf);writeCollections(db);return shelf}
export function attachItem(shelfId,type,id){const db=readCollections();if(!db.shelves.some(s=>s.id===shelfId))return; if(!['book','thought'].includes(type))return; if(!db.items.some(i=>i.shelfId===shelfId&&i.type===type&&i.refId===id)){db.items.push({shelfId,type,refId:id,order:Date.now()});writeCollections(db)}}
export function detachItem(shelfId,type,id){const db=readCollections();db.items=db.items.filter(i=>!(i.shelfId===shelfId&&i.type===type&&i.refId===id));writeCollections(db)}
export function removeThought(id){const db=readCollections();db.thoughts=db.thoughts.filter(t=>t.id!==id);db.items=db.items.filter(i=>!(i.type==='thought'&&i.refId===id));writeCollections(db)}
export function updateThought(id,text){const db=readCollections();const t=db.thoughts.find(t=>t.id===id);if(t&&text.trim()){t.text=text.trim();writeCollections(db)}}

export function setThoughtVisibility(id,makePublic){const db=readCollections();const thought=db.thoughts.find(t=>t.id===id);if(!thought)return false;thought.private=!makePublic;writeCollections(db);return true}

// Bookmarks are independent of reading progress and shelf membership.
export function isBookSaved(id){return readCollections().savedBooks.includes(id)}
export function toggleSavedBook(id){const db=readCollections();const index=db.savedBooks.indexOf(id);if(index<0)db.savedBooks.unshift(id);else db.savedBooks.splice(index,1);writeCollections(db);return index<0}

export function setShelfVisibility(id,makePublic){const db=readCollections();const shelf=db.shelves.find(s=>s.id===id);if(!shelf)return false;shelf.private=!makePublic;writeCollections(db);return true}

export function removeShelf(id){const db=readCollections();if(!db.shelves.some(s=>s.id===id))return false;db.shelves=db.shelves.filter(s=>s.id!==id);db.items=db.items.filter(i=>i.shelfId!==id);writeCollections(db);return true}

/** Save a book once, and set its membership in selected collections atomically. */
export function saveBookToCollections(id,shelfIds=[]){const db=readCollections();if(!db.savedBooks.includes(id))db.savedBooks.unshift(id);const wanted=new Set(shelfIds.filter(sid=>db.shelves.some(s=>s.id===sid)));db.items=db.items.filter(i=>!(i.type==='book'&&i.refId===id&&!wanted.has(i.shelfId)));for(const shelfId of wanted){if(!db.items.some(i=>i.shelfId===shelfId&&i.type==='book'&&i.refId===id))db.items.push({shelfId,type:'book',refId:id,order:Date.now()})}writeCollections(db)}
/** Removing a saved book also clears its memberships, never other saved books. */
export function removeSavedBook(id){const db=readCollections();db.savedBooks=db.savedBooks.filter(x=>x!==id);db.items=db.items.filter(i=>!(i.type==='book'&&i.refId===id));writeCollections(db)}
