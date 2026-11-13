// REM Biblioteca v1: local-first data, independent of reading progress.
const KEY='rem-next-v1:collections';
const blank=()=>({version:1,shelves:[],thoughts:[],items:[]});
export function readCollections(){try{const v=JSON.parse(localStorage.getItem(KEY)||'null');return v&&v.version===1&&Array.isArray(v.shelves)&&Array.isArray(v.thoughts)&&Array.isArray(v.items)?v:blank()}catch{return blank()}}
export function writeCollections(data){localStorage.setItem(KEY,JSON.stringify(data));window.dispatchEvent(new Event('rem-collections-changed'))}
export function newId(){return globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)}
export function addThought(text){const db=readCollections();const item={id:newId(),text:text.trim(),createdAt:new Date().toISOString(),private:true};if(!item.text)return null;db.thoughts.unshift(item);writeCollections(db);return item}
export function addShelf(title,description=''){const db=readCollections();const shelf={id:newId(),title:title.trim(),description:description.trim(),private:true,createdAt:new Date().toISOString()};if(!shelf.title)return null;db.shelves.unshift(shelf);writeCollections(db);return shelf}
export function attachItem(shelfId,type,id){const db=readCollections();if(!db.shelves.some(s=>s.id===shelfId))return; if(!['book','thought'].includes(type))return; if(!db.items.some(i=>i.shelfId===shelfId&&i.type===type&&i.refId===id)){db.items.push({shelfId,type,refId:id,order:Date.now()});writeCollections(db)}}
export function detachItem(shelfId,type,id){const db=readCollections();db.items=db.items.filter(i=>!(i.shelfId===shelfId&&i.type===type&&i.refId===id));writeCollections(db)}
export function removeThought(id){const db=readCollections();db.thoughts=db.thoughts.filter(t=>t.id!==id);db.items=db.items.filter(i=>!(i.type==='thought'&&i.refId===id));writeCollections(db)}
export function updateThought(id,text){const db=readCollections();const t=db.thoughts.find(t=>t.id===id);if(t&&text.trim()){t.text=text.trim();writeCollections(db)}}

export function setThoughtVisibility(id,makePublic){const db=readCollections();const thought=db.thoughts.find(t=>t.id===id);if(!thought)return false;thought.private=!makePublic;writeCollections(db);return true}
