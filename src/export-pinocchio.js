import {loadCatalog,loadChapter} from './catalog.js?v=rem-editorial-161';

const button=document.querySelector('#export'),status=document.querySelector('#status');
const enc=new TextEncoder();
const xml=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const bytes=s=>enc.encode(s);
const u16=(view,offset,n)=>view.setUint16(offset,n,true);
const u32=(view,offset,n)=>view.setUint32(offset,n>>>0,true);
const crcTable=Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});
function crc32(data){let c=0xffffffff;for(const b of data)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0}
function zip(files){
 const chunks=[],central=[];let offset=0;
 for(const [name,content] of files){
  const filename=bytes(name),data=typeof content==='string'?bytes(content):content,crc=crc32(data);
  const local=new Uint8Array(30+filename.length),lv=new DataView(local.buffer);
  u32(lv,0,0x04034b50);u16(lv,4,20);u16(lv,6,0x0800);u16(lv,8,0);u32(lv,14,crc);u32(lv,18,data.length);u32(lv,22,data.length);u16(lv,26,filename.length);local.set(filename,30);
  chunks.push(local,data);
  const dir=new Uint8Array(46+filename.length),dv=new DataView(dir.buffer);
  u32(dv,0,0x02014b50);u16(dv,4,20);u16(dv,6,20);u16(dv,8,0x0800);u16(dv,10,0);u32(dv,16,crc);u32(dv,20,data.length);u32(dv,24,data.length);u16(dv,28,filename.length);u32(dv,42,offset);dir.set(filename,46);
  central.push(dir);offset+=local.length+data.length;
 }
 const centralSize=central.reduce((n,a)=>n+a.length,0);
 const end=new Uint8Array(22),ev=new DataView(end.buffer);
 u32(ev,0,0x06054b50);u16(ev,8,files.length);u16(ev,10,files.length);u32(ev,12,centralSize);u32(ev,16,offset);
 return new Blob([...chunks,...central,end],{type:'application/epub+zip'});
}
function epub(book,chapters){
 const files=[['mimetype','application/epub+zip'],['META-INF/container.xml','<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>']];
 const navItems=[],manifest=[],spine=[];
 chapters.forEach(({chapter,text},i)=>{
  const filename='chapter-'+String(i+1).padStart(2,'0')+'.xhtml',id='ch'+(i+1);
  const paragraphs=text.split(/\n\s*\n/).map(p=>'<p>'+xml(p).replace(/\n/g,'<br/>')+'</p>').join('\n');
  files.push(['OEBPS/'+filename,'<?xml version="1.0" encoding="utf-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="it"><head><title>'+xml(chapter.title)+'</title></head><body><h1>'+xml(chapter.title)+'</h1>'+paragraphs+'</body></html>']);
  navItems.push('<li><a href="'+filename+'">'+xml(chapter.title)+'</a></li>');
  manifest.push('<item id="'+id+'" href="'+filename+'" media-type="application/xhtml+xml"/>');
  spine.push('<itemref idref="'+id+'"/>');
 });
 files.push(['OEBPS/nav.xhtml','<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="it"><head><title>Indice</title></head><body><nav epub:type="toc" id="toc"><h1>Indice</h1><ol>'+navItems.join('')+'</ol></nav></body></html>']);
 files.push(['OEBPS/content.opf','<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="it"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">urn:rem-next:pinocchio:wikisource</dc:identifier><dc:title>'+xml(book.title)+'</dc:title><dc:creator>'+xml(book.author||'Carlo Collodi')+'</dc:creator><dc:language>it</dc:language><dc:source>https://it.wikisource.org/wiki/Le_avventure_di_Pinocchio</dc:source><meta property="dcterms:modified">2026-11-15T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>'+manifest.join('')+'</manifest><spine>'+spine.join('')+'</spine></package>']);
 return zip(files);
}
button.addEventListener('click',async()=>{
 button.disabled=true;status.textContent='Caricamento del catalogo…';
 try{
  const books=await loadCatalog(),book=books.find(b=>b.id==='pinocchio');
  if(!book||book.chapters.length!==36)throw Error('Impossibile trovare i 36 capitoli di Pinocchio nel catalogo.');
  const chapters=[];
  for(let i=0;i<book.chapters.length;i++){
   status.textContent='Recupero capitolo '+(i+1)+' di '+book.chapters.length+'…';
   const chapter=book.chapters[i],text=await loadChapter(book,chapter);
   if(!text||text.length<450)throw Error('Testo non valido al capitolo '+(i+1));
   chapters.push({chapter,text});
  }
  status.textContent='Creazione del file EPUB…';
  const blob=epub(book,chapters),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='REM-Next-Pinocchio-Wikisource.epub';document.body.append(a);a.click();a.remove();
  status.textContent='EPUB pronto: 36 capitoli, '+chapters.reduce((n,c)=>n+c.text.length,0).toLocaleString('it-IT')+' caratteri. Controlla i download del browser.';
  setTimeout(()=>URL.revokeObjectURL(url),60000);
 }catch(error){status.textContent='Non è stato possibile creare il file: '+error.message}
 finally{button.disabled=false}
});