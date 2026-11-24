// Run in Node on GitHub Actions, using exactly the browser's text extraction and E5 model.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {pipeline,env} from '@huggingface/transformers';
import {loadChapter} from '../src/catalog.js';
import {passageWindows} from '../src/paper-intelligence.js';
globalThis.DOMParser=new JSDOM('').window.DOMParser;
const networkFetch=globalThis.fetch;
globalThis.fetch=async (url,options)=>{
 if(typeof url==='string'&&url.startsWith('./content/books/')){
  const path=decodeURIComponent(url.split('?')[0]);
  return new Response(await readFile(path),{status:200});
 }
 return networkFetch(url,options);
};
const ids=['montecristo','pinocchio','mattia-pascal','metamorfosi-ovidio'];
const id=process.argv[2];
if(!ids.includes(id))throw Error('Unknown book');
const catalog=JSON.parse(await readFile('content/books/catalog.json','utf8'));
const book=catalog.books.find(b=>b.id===id);
if(!book?.chapters.length)throw Error('Empty book');
env.allowLocalModels=false;
const extractor=await pipeline('feature-extraction','Xenova/multilingual-e5-small',{device:'cpu',dtype:'q8'});
const rows=[],hashes={};
for(const chapter of book.chapters){
 const content=await loadChapter(book,chapter);
 hashes[chapter.id]=createHash('sha256').update(content).digest('hex');
 const windows=passageWindows(content,chapter);
 if(!windows.length)throw Error('Empty chapter '+chapter.id);
 for(let i=0;i<windows.length;i+=8){
  const batch=windows.slice(i,i+8);
  const vectors=(await extractor(batch.map(w=>'passage: '+w.text),{pooling:'mean',normalize:true})).tolist();
  for(let j=0;j<batch.length;j++){
   const {text,title,...row}=batch[j];
   const vector=vectors[j].map(x=>Math.round(x*100000)/100000);
   if(vector.length!==384||!vector.every(Number.isFinite)||Math.abs(vector.reduce((s,x)=>s+x*x,0)-1)>.02)throw Error('Invalid vector');
   if(content.slice(row.offset,row.offset+row.phrase.length)!==row.phrase)throw Error('Invalid offset');
   rows.push({...row,vector});
  }
 }
 console.log(id,chapter.id,windows.length);
}
await mkdir('content/semantic',{recursive:true});
await writeFile('content/semantic/'+id+'.json',JSON.stringify({version:1,model:'Xenova/multilingual-e5-small:q8',book:id,dimension:384,hashes,rows}));
console.log(id,rows.length,'indexed passages');
