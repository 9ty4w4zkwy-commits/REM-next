import {button,el} from './ui.js';
import {getSetting,saveSetting} from './progress.js';

function localDay(date){
 return [date.getFullYear(),date.getMonth()+1,date.getDate()].join('-');
}

function weeklyRecap(){
 const key='rem-completion-days';
 const today=new Date();
 const monday=new Date(today);
 monday.setDate(today.getDate()-(today.getDay()+6)%7);
 let stored=[];
 try{const parsed=JSON.parse(getSetting(key,'[]'));if(Array.isArray(parsed))stored=parsed}catch{}
 const days=new Set(stored);
 days.add(localDay(today));
 const labels=['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
 const week=labels.map((label,index)=>{
  const day=new Date(monday);
  day.setDate(monday.getDate()+index);
  return {label,done:days.has(localDay(day))};
 });
 const oldest=new Date(today);oldest.setDate(today.getDate()-34);
 const recent=Array.from({length:35},(_,i)=>{const day=new Date(oldest);day.setDate(oldest.getDate()+i);return localDay(day)});
 saveSetting(key,JSON.stringify(recent.filter(day=>days.has(day))));
 const count=week.filter(day=>day.done).length;
 return el('section',{className:'rem-completion-week'},[
  el('div',{className:'rem-completion-week-heading'},[
   el('strong',{text:'Questa settimana'}),
   el('span',{text:count===1?'1 giorno di lettura':count+' giorni di lettura'})
  ]),
  el('ul',{className:'rem-completion-week-days'},week.map(({label,done})=>
   el('li',{className:done?'is-read':'',attrs:{'aria-label':label+(done?', completamento registrato':'')},text:label})
  ))
 ]);
}

function confettiBurst(){
 return el('div',{className:'rem-completion-confetti',attrs:{'aria-hidden':'true'}},
  Array.from({length:44},(_,i)=>{
   const right=i>=22;
   const lane=i%22;
   const x=(right?-1:1)*(9+lane%11*6.8);
   const y=-52+(lane*17%70);
   const spin=(right?-1:1)*(160+lane%5*95);
   const style='--x:'+x+'vw;--y:'+y+'vh;--spin:'+spin+'deg;--delay:'+(lane%6*28)+'ms';
   return el('i',{className:right?'is-right':'',attrs:{style}});
  })
 );
}

const congratulations=['Congratulazioni!','Complimenti!','Ottimo lavoro!','Una tappa in più!','Che bel traguardo!'];

function nextCongratulations(){
 const key='rem-last-congratulations';
 const previous=getSetting(key,'');
 const choices=congratulations.filter(message=>message!==previous);
 const message=choices[Math.floor(Math.random()*choices.length)];
 saveSetting(key,message);
 return message;
}

export function celebrateProgress({book,unit,index,units,completed,episodic,onContinue,onLeave,actionLabel,onAlready}){
 const total=units.length;
 if(index<0||index>=total){onContinue();return}
 const key='rem-celebrated:'+book.id+':'+(episodic?'episode:':'chapter:')+unit.id;
 if(getSetting(key,'')==='yes'){onAlready();return}
 const week=weeklyRecap();
 saveSetting(key,'yes');

 const name=episodic?'Episodio':'Capitolo';
 const hasNext=index+1<total;
 const progress=el('div',{className:'rem-completion-trail',attrs:{role:'img','aria-label':name+' '+(index+1)+' di '+total}},[
  ...units.map((item,i)=>el('span',{className:i===index?'is-new':completed[item.id]?'is-reached':''})),
  el('i',{className:'rem-completion-runner',attrs:{'aria-hidden':'true'}})
 ]);
 progress.style.setProperty('--steps',String(total));
 progress.style.setProperty('--from',(Math.max(0,index-.5)/total*100)+'%');
 progress.style.setProperty('--to',((index+.5)/total*100)+'%');

 const dialog=el('dialog',{className:'rem-completion-dialog',attrs:{'aria-labelledby':'rem-completion-title'}});
 const close=action=>{dialog.close();dialog.remove();action()};
 const next=button(actionLabel||(hasNext?'Continua ora':'Torna alla scheda del libro'),()=>close(onContinue),true);
 next.setAttribute('autofocus','');
 dialog.addEventListener('cancel',event=>{event.preventDefault();close(onLeave)});
 dialog.append(confettiBurst(),el('div',{className:'rem-completion-body'},[
  el('p',{className:'rem-completion-eyebrow',text:book.title}),
  el('h2',{attrs:{id:'rem-completion-title'},text:name+' '+(index+1)+' completato!'}),
  el('p',{className:'rem-completion-congrats',text:nextCongratulations()}),
  el('p',{className:'rem-completion-tagline',text:'Il libro che ti segue!'}),
  progress,
  week,
  el('div',{className:'rem-completion-actions'},[
   next,...(hasNext&&!actionLabel?[button('Riprendi più tardi',()=>close(onLeave))]:[])
  ])
 ]));
 document.body.append(dialog);
 if(typeof dialog.showModal!=='function'){dialog.remove();onContinue();return}
 dialog.showModal();
 dialog.classList.add('is-celebrating');
}
