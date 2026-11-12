import {getSetting,saveSetting} from './progress.js';
import {el,button} from './ui.js';

// Self-contained reader presentation. Focus overlay is mounted inside the reader.
const SIZES=['small','normal','large','xlarge'];
export function createReaderTools(){
 const state={theme:getSetting('reader-theme','moon'),size:getSetting('reader-size','normal'),focus:false,seconds:0,running:false,choice:5};
 if(!['sun','moon'].includes(state.theme))state.theme='moon';
 if(!SIZES.includes(state.size))state.size='normal';
 let ticker=null, shell=null;
 const root=el('section',{className:'reader-tools'});
 const title=el('strong',{className:'reader-tools-title',text:'Focus mode'});
 const row=el('div',{className:'reader-tools-row'});
 const sun=button('',()=>setTheme('sun'));sun.classList.add('reader-theme-button');sun.append(el('span',{text:'☀️',className:'reader-theme-icon'}),el('span',{text:'Chiaro'}));
 const moon=button('',()=>setTheme('moon'));moon.classList.add('reader-theme-button');moon.append(el('span',{text:'☾',className:'reader-theme-icon'}),el('span',{text:'Scuro'}));
 const divider=el('span',{className:'reader-tools-divider',attrs:{'aria-hidden':'true'}});
 const smaller=button('A−',()=>setSize(-1));smaller.classList.add('reader-font-button');smaller.setAttribute('aria-label','Riduci dimensione caratteri');
 const bigger=button('A+',()=>setSize(1));bigger.classList.add('reader-font-button');bigger.setAttribute('aria-label','Aumenta dimensione caratteri');
 const focus=button('',()=>openDialog());focus.classList.add('reader-focus-button');focus.append(el('span',{className:'reader-theme-icon',text:'◷'}),el('span',{text:'Focus'}));
 const overlay=el('div',{className:'reader-focus-overlay',attrs:{role:'presentation'}});
 const dialog=el('section',{className:'reader-focus-dialog',attrs:{role:'dialog','aria-modal':'true','aria-label':'Imposta Focus'}});
 const heading=el('h2',{text:'Focus'});
 const question=el('p',{text:'Quanto tempo vuoi dedicare alla lettura?'});
 const presets=el('div',{className:'reader-focus-presets'});
 const five=button('5 minuti',()=>choose(5));
 const ten=button('10 minuti',()=>choose(10));
 const custom=button('Personalizza',()=>{customBox.hidden=!customBox.hidden;customInput.focus()});
 const customBox=el('div',{className:'reader-focus-custom'});
 const customLabel=el('label',{text:'Durata personalizzata (minuti)',attrs:{for:'rem-focus-minutes'}});
 const customInput=el('input',{attrs:{id:'rem-focus-minutes',type:'number',min:'1',max:'180',value:'15',inputmode:'numeric'}});
 customInput.addEventListener('input',()=>{const n=Number(customInput.value);if(n>=1&&n<=180)choose(n,false)});
 customBox.append(customLabel,customInput);customBox.hidden=true;
 const notice=el('p',{className:'reader-focus-notice',text:'Per silenziare le notifiche, attiva Non disturbare dal Centro di Controllo del telefono. Alla fine, disattivalo manualmente.'});
 const actions=el('div',{className:'reader-focus-actions'});
 const start=button('Inizia Focus',()=>{const n=Number(state.choice);if(!Number.isFinite(n)||n<1||n>180)return;state.seconds=n*60;state.focus=true;state.running=true;closeDialog();startTimer();update() },true);
 const cancel=button('Non ora',()=>closeDialog());
 const activeBar=el('div',{className:'reader-focus-active'});
 const clock=el('span',{className:'reader-focus-clock',attrs:{role:'timer','aria-live':'off'}});
 const pause=button('Pausa',()=>{if(state.running){stopTimer();pause.textContent='Riprendi'}else{state.running=true;startTimer();pause.textContent='Pausa'}update()});
 const end=button('Termina',()=>{state.focus=false;stopTimer();state.seconds=0;update()});
 function choose(n,hide=true){state.choice=n;if(hide)customBox.hidden=true;update()}
 function openDialog(){overlay.hidden=false;update();five.focus()}
 function closeDialog(){overlay.hidden=true;focus.focus()}
 function setTheme(value){state.theme=value;saveSetting('reader-theme',value);update()}
 function setSize(delta){state.size=SIZES[Math.max(0,Math.min(SIZES.length-1,SIZES.indexOf(state.size)+delta))];saveSetting('reader-size',state.size);update()}
 function stopTimer(){clearInterval(ticker);ticker=null;state.running=false}
 function startTimer(){clearInterval(ticker);ticker=setInterval(()=>{state.seconds=Math.max(0,state.seconds-1);if(state.seconds===0){state.focus=false;stopTimer()}update()},1000)}
 function update(){
  sun.setAttribute('aria-pressed',String(state.theme==='sun'));moon.setAttribute('aria-pressed',String(state.theme==='moon'));
  five.setAttribute('aria-pressed',String(state.choice===5));ten.setAttribute('aria-pressed',String(state.choice===10));
  smaller.setAttribute('aria-disabled',String(state.size==='small'));bigger.setAttribute('aria-disabled',String(state.size==='xlarge'));
  activeBar.hidden=!state.focus;
  clock.textContent=String(Math.floor(state.seconds/60)).padStart(2,'0')+':'+String(state.seconds%60).padStart(2,'0');
  if(shell){shell.dataset.theme=state.theme;shell.dataset.fontSize=state.size;shell.classList.toggle('focus-active',state.focus)}
 }
 row.append(sun,moon,divider,smaller,bigger,focus);root.append(title,row);
 presets.append(five,ten);actions.append(start,cancel);
 dialog.append(heading,question,presets,custom,customBox,notice,actions);
 overlay.append(dialog);
 overlay.addEventListener('click',e=>{if(e.target===overlay)closeDialog()});
 overlay.addEventListener('keydown',e=>{if(e.key==='Escape')closeDialog()});
 activeBar.append(el('span',{text:'Focus attivo'}),clock,pause,end);
 function mount(target){shell=target;shell.classList.add('reader-shell');shell.prepend(root,activeBar);document.body.append(overlay);overlay.hidden=true;activeBar.hidden=true;update()}
 function destroy(){stopTimer();overlay.remove()}
 update();return {mount,destroy};
}
