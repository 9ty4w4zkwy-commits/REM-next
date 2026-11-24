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
async function buildIndex(book,extractor,progress){
 const rows=[];
 for(let i=0;i<book.chapters.length;i++){
  const chapter=book.chapters[i];
  progress('Analisi semantica del libro: capitolo '+(i+1)+' di '+book.chapters.length+'…');
  const windows=passageWindows(await loadChapter(book,chapter),chapter);
  for(let j=0;j<windows.length;j+=4){
   const batch=windows.slice(j,j+4);
   const vectors=await embed(extractor,batch.map(w=>'passage: '+w.text));
   batch.forEach((w,k)=>{const {text,...location}=w;rows.push({...location,vector:Float32Array.from(vectors[k])})});
   await new Promise(resolve=>setTimeout(resolve,0));
  }
 }
 return rows;
}
export async function semanticLocations(book,query,progress=()=>{}){
 progress('Caricamento del modello linguistico locale (primo utilizzo più lento)…');
 const extractor=await model();
 if(!indexes.has(book.id))indexes.set(book.id,buildIndex(book,extractor,progress).catch(e=>{indexes.delete(book.id);throw e}));
 const rows=await indexes.get(book.id);
 progress('Confronto dei passaggi…');
 const [q]=await embed(extractor,['query: '+query.slice(0,1800)]);
 const ranked=rows.map(({vector,...location})=>({ ...location,score:vector.reduce((sum,x,i)=>sum+x*q[i],0),approximate:true,semantic:true})).sort((a,b)=>b.score-a.score);
 const chosen=[];
 for(const row of ranked){
  if(row.score<.70)break;
  if(chosen.some(x=>x.chapter===row.chapter&&Math.abs(x.offset-row.offset)<900))continue;
  chosen.push(row);if(chosen.length===4)break;
 }
 return chosen;
}
