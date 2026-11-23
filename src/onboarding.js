import {el,button} from './ui.js';
import {getSetting,saveSetting} from './progress.js';
import {setAnalyticsConsent,sendOnboardingAnswers} from './analytics.js?v=analytics-2';
const KEY='onboarding-v1';
const QUESTIONS=[
 {title:'Quali cose ti fanno perdere la cognizione del tempo?',hint:'Puoi scegliere fino a due risposte.',max:2,options:['Viaggiare e scoprire luoghi','Capire come funziona la mente','Arte, musica e creatività','Storie e relazioni umane','Misteri ed enigmi','Natura e avventura']},
 {title:'Quale di queste frasi ti rappresenta di più?',hint:'Scegli quella che senti più tua.',max:1,options:['Amo scoprire cose nuove','Mi piace capire tutto a fondo','Sono una persona sognatrice','Amo le sfide','Sono una persona sensibile','Mi piace trovare soluzioni']},
 {title:'Quando hai del tempo libero, cosa scegli più volentieri?',hint:'Scegli la risposta più spontanea.',max:1,options:['Esplorare posti nuovi','Stare con le persone che amo','Creare qualcosa','Imparare qualcosa di nuovo','Stare nella natura','Rilassarmi e ricaricarmi']},
 {title:'Cosa cerchi in un libro, adesso?',hint:'Potrai cambiare questa risposta quando vuoi.',max:1,options:['Evadere','Sorridere','Emozionarmi','Scoprire','Riflettere','Sognare']},
 {title:'In che modo ti piace vivere le storie?',hint:'Scegli la modalità che ti piace di più.',max:1,options:['A episodi','Ebook','Audiolibri','Libri cartacei',"Un po' di tutto",'Dipende dalla storia']},
 {title:'In quali momenti vorresti che una storia ti accompagnasse?',hint:'Puoi scegliere più risposte.',max:6,options:['Nei piccoli ritagli di tempo|5–10 minuti tra un impegno e l’altro','Durante gli spostamenti|A piedi, sui mezzi o in viaggio','Durante una pausa|10–20 minuti per me','Mentre faccio altro|Cucinando, camminando o svolgendo attività quotidiane','Prima di dormire|10–30 minuti a fine giornata','Quando ho più tempo libero|30 minuti o più, senza fretta']}
];
const OPTION_EMOJIS=[
 ['🌍','🧠','🎨','❤️','🔍','🌿'],
 ['✨','🔬','☁️','🏆','💗','💡'],
 ['🧳','🥰','🖌️','📚','🌳','🧘'],
 ['🚀','😊','🥹','🗺️','💭','🌙'],
 ['📖','📱','🎧','📚','🌈','✨'],
 ['⏱️','🚆','☕','🍳','🌙','🛋️']
];
const loadAnswers=()=>{try{const a=JSON.parse(getSetting('onboarding-answers','[]'));return Array.isArray(a)?QUESTIONS.map((_,i)=>Array.isArray(a[i])?a[i]:[]):QUESTIONS.map(()=>[])}catch{return QUESTIONS.map(()=>[])}};
export const onboardingCompleted=()=>getSetting(KEY,'')==='done';
export function showOnboarding(render,home,{editing=false}={}){
 let step=editing?0:-1;const answers=loadAnswers();
 const persist=()=>saveSetting('onboarding-answers',JSON.stringify(answers));
 const finish=()=>{persist();saveSetting(KEY,'done');sendOnboardingAnswers(answers);home()};
 const draw=(preserveScroll=false)=>{
  const previousScroll=preserveScroll?window.scrollY:0;
  const header=el('div',{className:'onboard-top'},[
   el('strong',{className:'onboard-brand',text:'REM',attrs:{'aria-label':'REM'}}),
   button(editing?'Annulla':'Lo faccio più tardi',()=>{if(!editing){persist();saveSetting(KEY,'later')}home()})
  ]);
  const bars=el('div',{className:'onboard-progress',attrs:{'aria-label':step<0?'Introduzione':'Domanda '+(step+1)+' di '+QUESTIONS.length}},QUESTIONS.map((_,i)=>el('span',{className:i<=step?'is-active':''})));
  const nodes=[header,bars];
  if(step<0){
   nodes.push(el('section',{className:'onboard-intro'},[
    el('h1',{},[document.createTextNode('Ogni storia inizia '),el('span',{text:'da chi la legge.'})]),
    el('p',{text:'Raccontaci qualcosa di te. Ti aiuteremo a scoprire storie che forse non avresti mai cercato.'}),
    el('p',{text:'Partecipazione facoltativa al test: scegliendo «Partecipo al test» autorizzi l’invio a Cloudflare di un codice numerico, delle risposte alle sei domande e delle attività nell’app (libri aperti, modalità ebook/audio e date). Non chiediamo nome o email. Puoi interrompere gli invii dal Profilo; i dati già inviati non vengono cancellati automaticamente. Puoi anche continuare senza inviare dati.'}),
    button('Partecipo al test',()=>{setAnalyticsConsent(true);step=0;draw()},true),
    button('Continua senza partecipare',()=>{setAnalyticsConsent(false);step=0;draw()})
   ]));
  }else{
   const q=QUESTIONS[step],chosen=answers[step];
   const choices=el('div',{className:'onboard-options'},q.options.map((option,optionIndex)=>{
    const parts=option.split('|');
    const b=button(parts[0],()=>{
     const index=chosen.indexOf(option);
     if(index>=0)chosen.splice(index,1);
     else if(q.max===1)answers[step]=[option];
     else if(chosen.length<q.max)chosen.push(option);
     if(!editing)persist();draw(true);
    });
    b.textContent='';
    b.append(el('span',{className:'onboard-option-emoji',text:OPTION_EMOJIS[step][optionIndex],attrs:{'aria-hidden':'true'}}),el('span',{className:'onboard-option-title',text:parts[0]}));
    if(parts.length>1)b.append(el('span',{className:'onboard-option-detail',text:parts[1]}));
    b.setAttribute('aria-label',parts.join('. '));
    b.classList.add('onboard-option');
    if(parts.length>1)b.classList.add('onboard-option-detailed');
    if(chosen.includes(option))b.classList.add('selected');
    b.setAttribute('aria-pressed',String(chosen.includes(option)));
    return b;
   }));
   const next=button(step===QUESTIONS.length-1?(editing?'Salva le risposte':'Entra in REM'):'Avanti →',()=>{if(step===QUESTIONS.length-1)finish();else{step++;draw()}},true);
   next.disabled=!answers[step].length;
   nodes.push(el('section',{className:'onboard-question'},[
    el('p',{className:'onboard-kicker',text:'DOMANDA '+(step+1)+' DI '+QUESTIONS.length}),
    el('h1',{text:q.title}),el('p',{className:'onboard-hint',text:q.hint}),choices,
    el('div',{className:'onboard-actions'},[
     button('← Indietro',()=>{if(editing&&step===0)home();else{step--;draw()}}),next
    ]),
    el('p',{className:'onboard-privacy',text:editing?'Le modifiche saranno salvate solo quando tocchi «Salva le risposte».':'Le risposte sono salvate sul dispositivo e, solo se hai aderito alla raccolta dati di test, vengono inviate anche a Cloudflare al completamento. Puoi modificarle o saltare il percorso.'})
   ]));
  }
  render(el('div',{className:'onboard-screen'},nodes));
  if(preserveScroll)window.scrollTo({top:previousScroll,left:0,behavior:'instant'});
 };
 draw();
}
