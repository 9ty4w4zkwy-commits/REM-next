import {el,button} from './ui.js';
import {getSetting,saveSetting} from './progress.js';
const KEY='onboarding-v1';
const QUESTIONS=[
 {title:'Quali cose ti fanno perdere la cognizione del tempo?',hint:'Puoi scegliere fino a due risposte.',max:2,options:['Viaggiare e scoprire luoghi','Capire come funziona la mente','Arte, musica e creatività','Storie e relazioni umane','Misteri ed enigmi','Natura e avventura']},
 {title:'Quale di queste frasi ti rappresenta di più?',hint:'Scegli quella che senti più tua.',max:1,options:['Amo scoprire cose nuove','Mi piace capire tutto a fondo','Sono una persona sognatrice','Amo le sfide','Sono una persona sensibile']},
 {title:'Quando hai del tempo libero, cosa scegli più volentieri?',hint:'Scegli la risposta più spontanea.',max:1,options:['Esplorare posti nuovi','Stare con le persone che amo','Creare qualcosa','Imparare qualcosa di nuovo','Stare nella natura']},
 {title:'Cosa cerchi in un libro, adesso?',hint:'Potrai cambiare questa risposta quando vuoi.',max:1,options:['Evadere','Sorridere','Emozionarmi','Scoprire']}
];
const loadAnswers=()=>{try{const a=JSON.parse(getSetting('onboarding-answers','[]'));return Array.isArray(a)?QUESTIONS.map((_,i)=>Array.isArray(a[i])?a[i]:[]):QUESTIONS.map(()=>[])}catch{return QUESTIONS.map(()=>[])}};
export const onboardingCompleted=()=>getSetting(KEY,'')==='done';
export function showOnboarding(render,home){
 let step=-1;const answers=loadAnswers();
 const persist=()=>saveSetting('onboarding-answers',JSON.stringify(answers));
 const finish=()=>{persist();saveSetting(KEY,'done');home()};
 const draw=()=>{
  const header=el('div',{className:'onboard-top'},[
   el('strong',{className:'onboard-brand',text:'REM',attrs:{'aria-label':'REM'}}),
   button('Lo faccio più tardi',()=>{persist();saveSetting(KEY,'later');home()})
  ]);
  const bars=el('div',{className:'onboard-progress',attrs:{'aria-label':step<0?'Introduzione':'Domanda '+(step+1)+' di 4'}},QUESTIONS.map((_,i)=>el('span',{className:i<=step?'is-active':''})));
  const nodes=[header,bars];
  if(step<0){
   nodes.push(el('section',{className:'onboard-intro'},[
    el('h1',{},[document.createTextNode('Ogni storia inizia '),el('span',{text:'da chi la legge.'})]),
    el('p',{text:'Raccontaci qualcosa di te. Ti aiuteremo a scoprire storie che forse non avresti mai cercato.'}),
    button('Iniziamo',()=>{step=0;draw()},true)
   ]));
  }else{
   const q=QUESTIONS[step],chosen=answers[step];
   const choices=el('div',{className:'onboard-options'},q.options.map(option=>{
    const b=button(option,()=>{
     const index=chosen.indexOf(option);
     if(index>=0)chosen.splice(index,1);
     else if(q.max===1)answers[step]=[option];
     else if(chosen.length<q.max)chosen.push(option);
     persist();draw();
    });
    b.classList.add('onboard-option');
    if(chosen.includes(option))b.classList.add('selected');
    b.setAttribute('aria-pressed',String(chosen.includes(option)));
    return b;
   }));
   const next=button(step===3?'Entra in REM':'Avanti →',()=>{if(step===3)finish();else{step++;draw()}},true);
   next.disabled=!answers[step].length;
   nodes.push(el('section',{className:'onboard-question'},[
    el('p',{className:'onboard-kicker',text:'DOMANDA '+(step+1)+' DI 4'}),
    el('h1',{text:q.title}),el('p',{className:'onboard-hint',text:q.hint}),choices,
    el('div',{className:'onboard-actions'},[
     button('← Indietro',()=>{step--;draw()}),next
    ]),
    el('p',{className:'onboard-privacy',text:'Le risposte restano su questo dispositivo. Puoi modificarle o saltare il percorso quando vuoi.'})
   ]));
  }
  render(el('div',{className:'onboard-screen'},nodes));
 };
 draw();
}
