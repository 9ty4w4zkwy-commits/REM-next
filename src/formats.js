import {getSetting,saveSetting} from './progress.js';
import {el,button,panel} from './ui.js';
const ICON_PATHS={
paper:['M12 7c-2.5-2-5.5-2.6-9-2v14c3.5-.6 6.5 0 9 2','M12 7c2.5-2 5.5-2.6 9-2v14c-3.5-.6-6.5 0-9 2','M12 7v14'],
ebook:['M6 2.5h12a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2Z','M10 18.5h4'],
audio:['M3 14v-3a9 9 0 0 1 18 0v3','M3 14h3v7H5a2 2 0 0 1-2-2v-5Z','M18 14h3v5a2 2 0 0 1-2 2h-1v-7Z']
};
function formatIcon(id){const ns='http://www.w3.org/2000/svg';const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.8');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');svg.classList.add('format-icon');for(const d of ICON_PATHS[id]){const path=document.createElementNS(ns,'path');path.setAttribute('d',d);svg.append(path)}return svg}
const MODES=[['ebook','Ebook'],['paper','Cartaceo'],['audio','Audio']];
export function getMode(bookId){const mode=getSetting('format:'+bookId,'ebook');return MODES.some(([id])=>id===mode)?mode:'ebook'}
export function formatSwitch(bookId,selected,onSelect){return el('div',{className:'format-switch',attrs:{role:'group','aria-label':'Formato di lettura'}},MODES.map(([id,label])=>{const b=button(label,()=>{saveSetting('format:'+bookId,id);onSelect(id)},id===selected);b.setAttribute('aria-pressed',String(id===selected));b.dataset.format=id;b.prepend(formatIcon(id));return b}))}
export function paperView(book,chapter,onChapter){const intro=el('p',{text:'Stai leggendo la copia cartacea? Seleziona il capitolo raggiunto. Il progresso viene salvato solo su questo dispositivo.'});const select=el('select',{attrs:{'aria-label':'Capitolo raggiunto sul cartaceo'}});for(const c of book.chapters)select.append(el('option',{text:c.title,attrs:{value:c.id}}));select.value=chapter?.id||book.chapters[0]?.id||'';select.addEventListener('change',()=>onChapter(select.value));return el('section',{className:'format-mode-panel'},[el('p',{className:'eyebrow',text:'REM · CARTACEO'}),el('h2',{text:'Continua sul tuo libro cartaceo'}),intro,el('label',{text:'Capitolo raggiunto'}),select,el('p',{className:'format-mode-note',text:'Per passare subito a Ebook o Audio, usa i tre pulsanti in basso. La ricerca precisa da foto, pagina o frase arriverà nel prossimo step.'})])}
export function audioView({bookId,chapter,content,onPosition}={}){
 const wrap=el('section',{className:'format-mode-panel rem-audio-player'});
 if(!content||!('speechSynthesis' in window)){
  wrap.append(el('p',{text:'La riproduzione vocale non è disponibile su questo dispositivo.'}));return wrap;
 }
 const synth=window.speechSynthesis;
 const key='audio-position:'+bookId;
 let position=0,playing=false,utterance=null,session=0;
 try{const stored=JSON.parse(getSetting(key,'null'));if(stored?.chapter===chapter.id)position=Math.max(0,Math.min(content.length-1,Number(stored.offset)||0))}catch{}
 const status=el('p',{className:'rem-audio-status',text:'Pronto per ascoltare'});
 const progress=el('input',{className:'rem-audio-seek',attrs:{type:'range',min:'0',max:'100',value:String(Math.round(position/content.length*100)),'aria-label':'Posizione audio'}});
 const play=button('▶ Ascolta',()=>{if(playing)stop();else startAudio()});
 play.classList.add('rem-audio-play');const restart=button('↺ Ricomincia',()=>{stop();position=0;persist();startAudio()});
 restart.classList.add('rem-audio-restart');const persist=()=>{saveSetting(key,JSON.stringify({chapter:chapter.id,offset:position}));onPosition?.(position)};
 const update=()=>{progress.value=String(Math.round(position/content.length*100));progress.style.setProperty('--audio-progress',progress.value+'%');status.textContent=playing?'Riproduzione in corso · '+Math.round(position/content.length*100)+'%':'Punto salvato · '+Math.round(position/content.length*100)+'%'};
 function stop(){session++;synth.cancel();playing=false;play.textContent='▶ Riprendi';update();persist()}
 function startAudio(){
  if(!content.trim())return;
  session++;const token=session;synth.cancel();playing=true;play.textContent='Ⅱ Pausa';
  utterance=new SpeechSynthesisUtterance(content.slice(position));utterance.lang='it-IT';utterance.rate=0.95;
  const origin=position;
  utterance.onboundary=e=>{if(token!==session)return;if(Number.isFinite(e.charIndex)){position=Math.min(content.length,origin+e.charIndex);persist();update()}};
  utterance.onend=()=>{if(token!==session)return;playing=false;position=content.length-1;persist();play.textContent='↺ Riascolta';update()};
  utterance.onerror=()=>{if(token!==session)return;playing=false;play.textContent='▶ Riprendi';status.textContent='Riproduzione interrotta. Puoi riprovare.'};
  update();synth.speak(utterance);
 }
 progress.addEventListener('change',()=>{const wasPlaying=playing;stop();position=Math.min(content.length-1,Math.floor(Number(progress.value)/100*content.length));persist();update();if(wasPlaying)startAudio()});
 wrap.append(el('p',{className:'eyebrow',text:'REM · AUDIO'}),el('h2',{className:'rem-audio-title',text:'Ascolta la tua storia'}),status,progress,el('div',{className:'rem-audio-actions'},[play,restart]),el('p',{className:'format-mode-note',text:'Voce sintetica dimostrativa del dispositivo. Il punto viene salvato per riprendere nell’Ebook.'}));
 wrap.stopAudio=()=>{if(playing)stop()};return wrap;
}
