// REM Next — opt-in analytics with server-issued tester credentials.
// A public tester number is not authentication. Only the private token authorizes events.
import {getSetting,saveSetting} from './progress.js';
const BASE='https://rem-next-analytics.9ty4w4zkwy.workers.dev';
const CONSENT='analytics-consent-v1';
const ID='analytics-tester-id-v1';
const TOKEN='analytics-tester-token-v2';
const ENROLLMENT='analytics-tester-enrollment-v2';
// One automatic registration attempt per browser without a credential.
// Avoid silent repeated INSERTs when a network response is lost.
const AUTO_ATTEMPT='analytics-tester-auto-attempt-v3';
const validId=id=>Number.isSafeInteger(id)&&id>0;
const validToken=token=>typeof token==='string'&&/^[a-f0-9]{64}$/.test(token);
let pending=null;
export const analyticsEnabled=()=>getSetting(CONSENT,'')==='yes';
export const getTesterRegistrationState=()=>getSetting(ENROLLMENT,'');
export function getTesterCode(){
 if(!analyticsEnabled()||!validToken(getSetting(TOKEN,'')))return null;
 const id=Number(getSetting(ID,''));
 return validId(id)?'REM-'+String(id).padStart(3,'0'):null;
}
async function post(path,body){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch(BASE+path,{method:'POST',mode:'cors',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(data.error||'Servizio non disponibile');error.status=response.status;throw error}
  return data;
 }finally{clearTimeout(timer)}
}
function storeCredential(data,token){
 const id=Number(data?.tester_id);
 const issued=token||data?.token;
 if(!validId(id)||!validToken(issued))throw Error('Il servizio non ha restituito credenziali valide.');
 saveSetting(TOKEN,issued);
 saveSetting(ID,String(id));
 saveSetting(ENROLLMENT,'linked');
 if(getSetting(TOKEN,'')!==issued||Number(getSetting(ID,''))!==id)throw Error('Impossibile salvare il codice sul dispositivo.');
 return id;
}
function friendlyError(error){
 if(typeof navigator!=='undefined'&&navigator.onLine===false)return 'Il dispositivo è offline. Riconnettiti e riprova.';
 if(error?.name==='AbortError')return 'Il servizio sta impiegando troppo tempo a rispondere. Riprova.';
 if(error?.status===401)return 'Credenziale non valida o codice di recupero scaduto. Verifica il codice e riprova.';
 if(error?.status===403)return 'Il servizio ha rifiutato il dominio del sito. Contatta chi gestisce REM.';
 return 'Registrazione non riuscita: '+(error?.message||'servizio non disponibile')+'.';
}
// Opted-in participants receive a code automatically, including legacy visits.
// A failed/uncertain request is not silently retried, to avoid duplicate IDs.
async function ensureTester({create=false}={}){
 if(!analyticsEnabled())return null;
 if(pending)return pending;
 const stored=getSetting(TOKEN,'');
 if(!validToken(stored)&&!create)return null;
 pending=(async()=>{
  if(validToken(stored)){
   const result=await post('/api/testers',{token:stored});
   const id=Number(result.tester_id);
   if(!validId(id))throw Error('Il servizio non riconosce il codice tester.');
   saveSetting(ID,String(id));saveSetting(ENROLLMENT,'linked');
   return id;
  }
  // Single explicit/first-consent registration attempt; do not retry
  // invisibly after a lost response and accidentally allocate multiple IDs.
  saveSetting(ENROLLMENT,'awaiting');
  saveSetting(AUTO_ATTEMPT,'started');
  return storeCredential(await post('/api/testers',{}));
 })();
 try{return await pending}finally{pending=null}
}
export async function registerTesterCode({create=false}={}){
 if(!analyticsEnabled())return {status:'disabled'};
 if(!validToken(getSetting(TOKEN,''))&&!create&&!pending)return {status:'needs_retry'};
 try{
  const id=await ensureTester({create});
  const code=getTesterCode();
  return id&&code?{status:'registered',code}:{status:'error',message:'Il codice tester non è stato salvato correttamente.'};
 }catch(error){return {status:'error',message:friendlyError(error)}}
}
export async function recoverTesterCode(recoveryCode){
 if(!analyticsEnabled())return {status:'disabled'};
 const code=String(recoveryCode||'').trim().toUpperCase();
 if(!/^REM-[A-F0-9]{32}$/.test(code))return {status:'error',message:'Inserisci il codice temporaneo completo generato da Cloudflare.'};
 if(pending)return {status:'error',message:'È già in corso una registrazione. Riprova al termine.'};
 pending=(async()=>storeCredential(await post('/api/recover',{code})))();
 try{
  const id=await pending;
  if(!id)return {status:'error',message:'Non è stato possibile recuperare il profilo.'};
  trackEvent('app_open');
  return {status:'registered',code:getTesterCode()};
 }catch(error){return {status:'error',message:friendlyError(error)}}
 finally{pending=null}
}
export function trackEvent(event_type,details={}){
 if(!analyticsEnabled())return;
 void (async()=>{
  try{
   const create=!validToken(getSetting(TOKEN,''))&&!getSetting(AUTO_ATTEMPT,'');
   const tester_id=await ensureTester({create});
   const token=getSetting(TOKEN,'');
   if(tester_id&&validToken(token)&&analyticsEnabled())await post('/api/events',{token,event_type,...details});
  }catch{}
 })();
}
export function sendOnboardingAnswers(answers){
 if(!analyticsEnabled()||!Array.isArray(answers)||answers.length!==6||!answers.every(a=>Array.isArray(a)&&a.length))return;
 const snapshot=answers.map(a=>a.slice());
 void (async()=>{
  try{
   const create=!validToken(getSetting(TOKEN,''))&&!getSetting(AUTO_ATTEMPT,'');
   const tester_id=await ensureTester({create});
   const token=getSetting(TOKEN,'');
   if(tester_id&&validToken(token)&&analyticsEnabled())await post('/api/onboarding',{token,answers:snapshot});
  }catch{}
 })();
}
export function setAnalyticsConsent(enabled){
 const wasEnabled=analyticsEnabled();
 saveSetting(CONSENT,enabled?'yes':'no');
 if(enabled){
  if(!wasEnabled&&!validToken(getSetting(TOKEN,''))&&
      getSetting(ENROLLMENT,'')==='')saveSetting(ENROLLMENT,'new');
  trackEvent('app_open');
  syncSavedOnboarding();
 }
}
// Existing testers may have completed onboarding before the new token flow.
function syncSavedOnboarding(){
 try{
  const answers=JSON.parse(getSetting('onboarding-answers','[]'));
  if(Array.isArray(answers)&&answers.length===6&&answers.every(a=>Array.isArray(a)&&a.length))sendOnboardingAnswers(answers);
 }catch{}
}
export function startAnalytics(){
 if(!analyticsEnabled())return;
 trackEvent('app_open');
 syncSavedOnboarding();
}
