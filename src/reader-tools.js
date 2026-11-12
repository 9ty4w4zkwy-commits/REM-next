import {getSetting,saveSetting} from './progress.js';
import {el,button} from './ui.js';

// Standalone reader controls. No dependencies on book data or navigation.
const SIZES=['small','normal','large','xlarge'];
export function createReaderTools(){
  const state={theme:getSetting('reader-theme','moon'),size:getSetting('reader-size','normal'),focus:false,seconds:0,running:false,choice:'5'};
  if(!['sun','moon'].includes(state.theme))state.theme='moon';
  if(!SIZES.includes(state.size))state.size='normal';
  let ticker=null;
  const root=el('section',{className:'reader-tools'});
  const controls=el('div',{className:'reader-tools-row'});
  const themes=el('div',{className:'reader-theme-pair',attrs:{role:'group','aria-label':'Tema lettura'}});
  const sun=button('☀ Sole',()=>setTheme('sun'));
  const moon=button('☾ Luna',()=>setTheme('moon'));
  const sizes=el('div',{className:'reader-size-pair',attrs:{role:'group','aria-label':'Dimensione caratteri'}});
  const smaller=button('a',()=>setSize(-1));smaller.setAttribute('aria-label','Riduci caratteri');
  const bigger=button('A',()=>setSize(1));bigger.setAttribute('aria-label','Ingrandisci caratteri');
  const focus=button('Focus Mode',()=>{state.focus=!state.focus;if(!state.focus)pause();update()});
  const panel=el('div',{className:'focus-panel'});
  const choices=el('div',{className:'focus-duration-options',attrs:{role:'group','aria-label':'Durata Focus Mode'}});
  const choiceButtons=[['5','5 minuti'],['10','10 minuti'],['test','Prova libera']].map(([value,label])=>button(label,()=>{pause();state.choice=value;state.seconds=0;update()}));
  const notice=el('p',{className:'focus-notice',text:'Per evitare interruzioni, attiva manualmente Non disturbare sul telefono. Un sito web non può disattivare le notifiche di sistema.'});
  const clock=el('span',{className:'focus-clock',attrs:{role:'timer','aria-live':'off'}});
  const start=button('Inizia',()=>{if(state.choice==='test'){state.running=true;state.seconds=0}else{if(state.seconds<=0)state.seconds=Number(state.choice)*60;state.running=true}clearInterval(ticker);ticker=setInterval(()=>{if(state.choice==='test')state.seconds+=1;else state.seconds=Math.max(0,state.seconds-1);if(state.choice!=='test'&&state.seconds===0)pause();update()},1000);update()},true);
  const pauseButton=button('Pausa',()=>{pause();update()});
  const reset=button('Azzera',()=>{pause();state.seconds=0;update()});
  function setTheme(value){state.theme=value;saveSetting('reader-theme',value);update()}
  function setSize(delta){state.size=SIZES[Math.max(0,Math.min(SIZES.length-1,SIZES.indexOf(state.size)+delta))];saveSetting('reader-size',state.size);update()}
  function pause(){clearInterval(ticker);ticker=null;state.running=false}
  function update(){
    sun.setAttribute('aria-pressed',String(state.theme==='sun'));
    moon.setAttribute('aria-pressed',String(state.theme==='moon'));
    smaller.disabled=state.size==='small';bigger.disabled=state.size==='xlarge';
    focus.setAttribute('aria-pressed',String(state.focus));panel.hidden=!state.focus;
    choiceButtons.forEach((b,i)=>b.setAttribute('aria-pressed',String(['5','10','test'][i]===state.choice)));
    const seconds=state.seconds;
    clock.textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
    start.textContent=state.running?'Ricomincia':state.seconds?'Riprendi':'Inizia';
    pauseButton.disabled=!state.running;
    const shell=root.closest('.reading-shell');
    if(shell){shell.dataset.theme=state.theme;shell.dataset.fontSize=state.size;shell.classList.toggle('focus-active',state.focus)}
  }
  themes.append(sun,moon);sizes.append(smaller,bigger);
  controls.append(themes,sizes,focus);
  choices.append(...choiceButtons);
  panel.append(el('strong',{text:'Quanto vuoi concentrarti?'}),choices,notice,el('div',{className:'focus-timer-actions'},[clock,start,pauseButton,reset]));
  root.append(controls,panel);
  function mount(shell){shell.classList.add('reader-shell');shell.prepend(root);update()}
  function destroy(){pause()}
  update();return {mount,destroy};
}
