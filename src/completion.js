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

export function celebrateProgress({book,unit,index,total,episodic,onContinue,onLeave}){
 if(index<0||index>=total){onContinue();return}
 const key='rem-celebrated:'+book.id+':'+(episodic?'episode:':'chapter:')+unit.id;
 if(getSetting(key,'')==='yes'){onContinue();return}
 const week=weeklyRecap();
 saveSetting(key,'yes');

 const name=episodic?'Episodio':'Capitolo';
 const remaining=total-index-1;
 const remainingLabel=remaining===0?'Sei arrivato all’ultima tappa del percorso.':remaining===1?
  'Manca 1 '+name.toLowerCase()+'.':'Mancano '+remaining+(episodic?' episodi.':' capitoli.');
 const dots=Math.min(total+1,9);
 const progress=el('div',{className:'rem-completion-trail',attrs:{role:'img','aria-label':(index+1)+' di '+total}},[
  ...Array.from({length:dots},(_,i)=>el('span',{className:i/(dots-1)<=(index+1)/total?'is-reached':''})),
  el('i',{className:'rem-completion-ring',attrs:{'aria-hidden':'true'}}),
  el('div',{className:'rem-completion-runner',attrs:{'aria-hidden':'true'}},[el('i')])
 ]);
 progress.style.setProperty('--from',(index/total*100)+'%');
 progress.style.setProperty('--to',((index+1)/total*100)+'%');

 const art=el('div',{className:'rem-completion-art',attrs:{'aria-hidden':'true'}},[
  el('div',{className:'rem-completion-book'},[
   el('div',{className:'rem-completion-pages'}),
   el('div',{className:'rem-completion-cover'},[
    el('span',{className:'rem-completion-book-wordmark',text:'REM'}),
    el('span',{className:'rem-completion-book-ornament'})
   ]),
   el('div',{className:'rem-completion-bookmark'})
  ]),
  el('div',{className:'rem-completion-popper'},[
   el('span',{text:'🎉'}),
   ...Array.from({length:10},(_,i)=>el('i',{className:'rem-completion-ribbon',attrs:{style:'--spark:'+i}}))
  ])
 ]);
 const dialog=el('dialog',{className:'rem-completion-dialog',attrs:{'aria-labelledby':'rem-completion-title'}});
 const close=action=>{dialog.close();dialog.remove();action()};
 const next=button(remaining?'Continua ora':'Torna alla scheda del libro',()=>close(onContinue),true);
 next.setAttribute('autofocus','');
 dialog.addEventListener('cancel',event=>{event.preventDefault();close(onLeave)});
 dialog.append(el('div',{className:'rem-completion-body'},[
  el('p',{className:'rem-completion-eyebrow',text:book.title}),
  el('h2',{attrs:{id:'rem-completion-title'},text:name+' '+(index+1)+' completato!'}),
  el('p',{className:'rem-completion-congrats',text:'Congratulazioni!'}),
  art,
  el('p',{className:'rem-completion-tagline',text:'Il libro ti segue!'}),
  progress,
  el('p',{className:'rem-completion-remaining',text:remainingLabel}),
  week,
  el('div',{className:'rem-completion-actions'},[
   next,...(remaining?[button('Riprendi più tardi',()=>close(onLeave))]:[])
  ])
 ]));
 document.body.append(dialog);
 if(typeof dialog.showModal!=='function'){dialog.remove();onContinue();return}
 dialog.showModal();
 requestAnimationFrame(()=>requestAnimationFrame(()=>{if(dialog.open)dialog.classList.add('is-celebrating')}));
}
