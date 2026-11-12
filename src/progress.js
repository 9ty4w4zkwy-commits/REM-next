const PREFIX='rem-next-v1:';
export function getProgress(id){try{const value=JSON.parse(localStorage.getItem(PREFIX+id)||'null');return value&&typeof value.chapter==='string'?value:null}catch{return null}}
export function saveProgress(id,chapter){try{localStorage.setItem(PREFIX+id,JSON.stringify({chapter,updatedAt:new Date().toISOString()}))}catch{}}
export function getSetting(key,fallback){try{return localStorage.getItem(PREFIX+'setting:'+key)||fallback}catch{return fallback}}
export function saveSetting(key,value){try{localStorage.setItem(PREFIX+'setting:'+key,String(value))}catch{}}