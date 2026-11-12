import {getSetting,saveSetting} from './progress.js';
import {el,button} from './ui.js';

// Reader-only controls: no coupling to catalog, home shelves or book formats.
const SIZES=['small','normal','large','xlarge'];
const DURATIONS=[5,10,15,20,25,30,45,60];
export function createReaderTools(){
  const state={theme:getSetting('reader-theme','moon'),size:getSetting('reader-size','normal'),focus:false,remaining:0,running:false};
  if(!['moon','sun'].includes(state.theme))state.theme='moon';
  if(!SIZES.includes(state.size))state.size='normal';
  let interval=null;
  const root=el('section',{className:'reader-tools'});
  const controls=el('div',{className:'reader-tools-row'});
  const focusPanel=el('div',{className:'focus-panel'});
  const status=el('span',{className:'focus-clock',attrs:{role:'status','aria-live':'off'}});
  const theme=button('',()=>{state.theme=state.theme==='moon'?'sun':'moon';saveSetting('reader-theme',state.theme);update()});
  const minus=button('A−',()=>{state.size=SIZES[Math.max(0,SIZES.indexOf(state.size)-1)];saveSetting('reader-size',state.size);update()});
  const plus=button('A+',()=>{state.size=SIZES[Math.min(SIZES.length-1,SIZES.indexOf(state.size)+1)];saveSetting('reader-size',state.size);update()});
  const focus=button('Focus Mode',()=>{state.focus=!state.focus;if(!state.focus)pause();update()});
  const duration=el('select',{attrs:{'aria-label':'Durata sessione Focus'}});
  for(const n of DURATIONS)duration.append(el('option',{text:n+' min',attrs:{value:String(n)}}));
  duration.value='15';
  const start=button('Avvia',()=>{if(!state.remaining)state.remaining=Number(duration.value)*60;state.running=true;clearInterval(interval);interval=setInterval(()=>{state.remaining=Math.max(0,state.remaining-1);if(state.remaining===0)pause();update()},1000);update()},true);
  const pauseButton=button('Pausa',()=>{pause();update()});
  const reset=button('Azzera',()=>{pause();state.remaining=0;update()});
  function pause(){clearInterval(interval);interval=null;state.running=false}
  function update(){
    theme.textContent=state.theme==='moon'?'☀ Sole':'☾ Luna';
    theme.setAttribute('aria-label','Tema lettura: '+state.theme);
    minus.disabled=state.size==='small';plus.disabled=state.size==='xlarge';
    focus.setAttribute('aria-pressed',String(state.focus));
    focusPanel.hidden=!state.focus;
    status.textContent=String(Math.floor(state.remaining/60)).padStart(2,'0')+':'+String(state.remaining%60).padStart(2,'0');
    start.textContent=state.running?'Riavvia':'Avvia';
    pauseButton.disabled=!state.running;
    root.classList.toggle('is-focus',state.focus);
    if(root.parentElement){const shell=root.closest('.reader-shell');if(shell){shell.dataset.theme=state.theme;shell.dataset.fontSize=state.size;shell.classList.toggle('focus-active',state.focus)}}
  }
  duration.addEventListener('change',()=>{if(!state.running){state.remaining=0;update()}});
  controls.append(theme,minus,plus,focus);
  focusPanel.append(el('label',{text:'Timer concentrazione'}),duration,status,start,pauseButton,reset);
  root.append(controls,focusPanel);
  function mount(shell){shell.classList.add('reader-shell');shell.prepend(root);update()}
  function destroy(){pause()}
  update();
  return {mount,destroy};
}
