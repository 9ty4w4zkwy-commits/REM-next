// Local inference only: images and queries are never sent to a search API.
import {loadChapter} from './catalog.js';
let ocrLoader,modelLoader;
function ocrLibrary(){
 if(!ocrLoader)ocrLoader=new Promise((resolve,reject)=>{
  if(window.Tesseract){resolve(window.Tesseract);return}
  const script=document.createElement('script');
  script.src='https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js';
  script.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(Error('OCR non disponibile'));
  script.onerror=()=>{script.remove();reject(Error('Impossibile scaricare il motore OCR'))};
  document.head.append(script);
 }).catch(e=>{ocrLoader=null;throw e});
 return ocrLoader;
}
async function imageCanvas(file){
 const url=URL.createObjectURL(file);
 try{
  const image=new Image();image.src=url;await image.decode();
  const scale=Math.min(1,2200/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  return canvas;
 }finally{URL.revokeObjectURL(url)}
}
export async function recognizePage(file,onProgress=()=>{}){
 if(!file||file.size>25*1024*1024)throw Error('Scegli una foto fino a 25 MB');
 const canvas=await imageCanvas(file);
 const lib=await ocrLibrary();
 let worker;
 try{
  worker=await lib.createWorker('ita',1,{logger:m=>{if(m.status==='recognizing text')onProgress('Lettura foto: '+Math.round(m.progress*100)+'%');else onProgress('Preparazione riconoscimento testo…')}});
  const result=await worker.recognize(canvas);
  const text=result.data.text.replace(/-\s*\n\s*/g,'').replace(/\s+/g,' ').trim();
  if(text.split(' ').length<8)throw Error('Testo insufficiente: fotografa la pagina con più luce e nitidezza');
  return text;
 }finally{if(worker)await worker.terminate();canvas.width=canvas.height=1}
}
async function model(){
 if(!modelLoader)modelLoader=(async()=>{
  const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2');
  env.allowLocalModels=false;
  env.backends.onnx.wasm.numThreads=1;
  return pipeline('feature-extraction','Xenova/multilingual-e5-small',{device:'wasm',dtype:'q8'});
 })().catch(e=>{modelLoader=null;throw e});
 return modelLoader;
}
export function passageWindows(content,chapter){
 const tokens=[...content.matchAll(/\S+/g)];
 const out=[];
 for(let i=0;i<tokens.length;i+=75){
  const end=Math.min(tokens.length,i+150);
  const start=tokens[i].index;
  const last=tokens[end-1];
  const text=content.slice(start,last.index+last[0].length);
  out.push({chapter:chapter.id,title:chapter.title,offset:start,phrase:text.slice(0,110),context:text.replace(/\s+/g,' ').slice(0,350),text});
  if(end===tokens.length)break;
 }
 return out;
}
const indexes=new Map();
async function embed(extractor,texts){
 const tensor=await extractor(texts,{pooling:'mean',normalize:true});
 return tensor.tolist();
}
async function loadIndex(book){
 const response=await fetch('./content/semantic/'+encodeURIComponent(book.id)+'.json',{cache:'no-cache'});
 if(!response.ok)throw Error('Indice semantico in preparazione');
 const index=await response.json();
 if(index.version!==1||index.model!=='Xenova/multilingual-e5-small:q8'||index.book!==book.id||!Array.isArray(index.rows)||!index.rows.length||index.dimension!==384)throw Error('Indice semantico non valido');
 const chapters=new Map(book.chapters.map(c=>[c.id,c]));
 const rows=index.rows.map(row=>{
  if(!chapters.has(row.chapter)||!Number.isSafeInteger(row.offset)||row.offset<0||typeof row.context!=='string'||!Array.isArray(row.vector)||row.vector.length!==384||!row.vector.every(Number.isFinite))throw Error('Passaggio non valido');
  return {...row,title:chapters.get(row.chapter).title,vector:Float32Array.from(row.vector)};
 });
 return {rows,hashes:index.hashes};
}
async function textHash(text){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function semanticLocations(book,query,progress=()=>{}){
 progress('Caricamento indice semantico già preparato…');
 if(!indexes.has(book.id))indexes.set(book.id,loadIndex(book).catch(e=>{indexes.delete(book.id);throw e}));
 const {rows,hashes}=await indexes.get(book.id);
 progress('Caricamento modello linguistico locale…');
 const extractor=await model();
 progress('Confronto dei passaggi…');
 const [q]=await embed(extractor,['query: '+query.slice(0,1800)]);
 const ranked=rows.map(({vector,...location})=>({ ...location,score:vector.reduce((sum,x,i)=>sum+x*q[i],0),approximate:true,semantic:true})).sort((a,b)=>b.score-a.score);
 const chosen=[];
 for(const row of ranked){
  if(row.score<.70)break;
  if(chosen.some(x=>x.chapter===row.chapter&&Math.abs(x.offset-row.offset)<900))continue;
  chosen.push(row);if(chosen.length===4)break;
 }
 const verified=[];
 const checked=new Map();
 for(const item of chosen){
  if(!checked.has(item.chapter)){
   const chapter=book.chapters.find(c=>c.id===item.chapter);
   const content=await loadChapter(book,chapter);
   checked.set(item.chapter,await textHash(content)===hashes[item.chapter]?content:null);
  }
  const content=checked.get(item.chapter);
  if(content&&item.offset<content.length&&content.slice(item.offset,item.offset+item.phrase.length)===item.phrase)verified.push(item);
 }
 return verified;
}
