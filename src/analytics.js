// REM Next opt-in telemetry; network failures must not block reading.
import {getSetting,saveSetting} from './progress.js';
const BASE='https://rem-next-analytics.9ty4w4zkwy.workers.dev';
const CONSENT='analytics-consent-v1',ID='analytics-tester-id-v1';
let pending=null;
export const analyticsEnabled=()=>getSetting(CONSENT,'')==='yes';
export function getTesterCode(){
 if(!analyticsEnabled())return null;
 const id=Number(getSetting(ID,''));
 return Number.isSafeInteger(id)&&id>0?'REM-'+String(id).padStart(3,'0'):null;
}
export async function registerTesterCode(){
 if(!analyticsEnabled())return {status:'disabled'};
 const existing=getTesterCode();
 if(existing)return {status:'registered',code:existing};
 try{
  const id=await testerId();
  if(!analyticsEnabled())return {status:'disabled'};
  const code=getTesterCode();
  if(!id||!code)return {status:'error',message:'Il servizio non ha restituito un codice valido. Riprova tra poco.'};
  return {status:'registered',code};
 }catch(error){
  const offline=typeof navigator!=='undefined'&&navigator.onLine===false;
  return {status:'error',message:offline?'Il dispositivo risulta offline. Riconnettiti e riprova.':
   error?.name==='AbortError'?'Il servizio sta impiegando troppo tempo a rispondere. Riprova tra poco.':
   'Registrazione non riuscita: il servizio di raccolta dati non risponde. Puoi riprovare.'};
 }
}
async function post(path,body){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),12000);
 try{
  const r=await fetch(BASE+path,{method:'POST',mode:'cors',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok)throw Error('Analytics HTTP '+r.status);
  return await r.json();
 }finally{clearTimeout(timer)}
}
async function testerId(){
 if(!analyticsEnabled())return null;
 if(pending)return pending;
 pending=(async()=>{
  const previous=Number(getSetting(ID,''));
  const data=await post('/api/testers',Number.isSafeInteger(previous)&&previous>0?{tester_id:previous}:{});
  if(!analyticsEnabled())return null;
  const id=Number(data.tester_id);
  if(!Number.isSafeInteger(id)||id<1)return null;
  saveSetting(ID,id);return id;
 })();
 try{return await pending}finally{pending=null}
}
export function trackEvent(event_type,details={}){
 if(!analyticsEnabled())return;
 void (async()=>{try{const tester_id=await testerId();if(tester_id&&analyticsEnabled())await post('/api/events',{tester_id,event_type,...details})}catch{}})();
}
export function sendOnboardingAnswers(answers){
 if(!analyticsEnabled()||!Array.isArray(answers)||answers.length!==6||!answers.every(a=>Array.isArray(a)&&a.length))return;
 const snapshot=answers.map(a=>a.slice());
 void (async()=>{try{const tester_id=await testerId();if(tester_id&&analyticsEnabled())await post('/api/onboarding',{tester_id,answers:snapshot})}catch{}})();
}
export function setAnalyticsConsent(enabled){
 saveSetting(CONSENT,enabled?'yes':'no');
 if(enabled)trackEvent('app_open');
}
export function startAnalytics(){if(analyticsEnabled())trackEvent('app_open')}
