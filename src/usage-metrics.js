import {analyticsEnabled,trackEvent} from './analytics.js?v=reporting-20261127';
import {getSetting,saveSetting} from './progress.js';

const CONSENT='usage-metrics-consent-v1';
const FLUSH_SECONDS=15;
const MAX_EVENT_SECONDS=120;
let active=null;

export const usageMetricsEnabled=()=>analyticsEnabled()&&getSetting(CONSENT,'')==='yes';
export function setUsageMetricsConsent(enabled){saveSetting(CONSENT,enabled?'yes':'no')}

function emit(event,details){
 if(usageMetricsEnabled())trackEvent(event,details,{keepalive:true,canSend:usageMetricsEnabled});
}

export function recordModeChoice(book,path){emit('reading_path_choice',{book_id:book,reading_path:path})}
export function recordSwitch(book,chapter,from,to,path){if(from!==to)emit('format_switch',{book_id:book,chapter_id:chapter,from_format:from,to_format:to,reading_path:path})}
export function stopUsage(){active?.stop();active=null}

export function startUsage(root,{book_id,chapter_id,format,reading_path}){
 stopUsage();
 if(!usageMetricsEnabled()||!root||!['ebook','audio'].includes(format))return;

 const session_id=globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2);
 const details={book_id,chapter_id,format,reading_path,session_id};
 const media=format==='audio'?root.querySelector('audio'):null;
 const interactions=['pointerdown','touchstart','scroll','keydown'];
 let last=performance.now(),interaction=last,seconds=0,reported=0,closed=false;
 let lastPosition=media?.currentTime??0,rate=media?.playbackRate||1;
 const touch=()=>{interaction=performance.now()};
 const visible=()=>{
  if(document.hidden)return false;
  const r=root.getBoundingClientRect();
  return r.bottom>0&&r.top<window.innerHeight;
 };
 const speaking=()=>format==='audio'&&root.dataset.analyticsSpeaking==='true'&&window.speechSynthesis?.speaking&&!window.speechSynthesis?.paused;
 let previousActive=media?false:format==='ebook'?visible():speaking();

 function resetPosition(){lastPosition=media.currentTime}
 function sample(){
  const now=performance.now();
  if(media){
   const position=media.currentTime;
   // The media clock advances only during playback, even when Safari suspends timers.
   if(usageMetricsEnabled()&&root.isConnected&&!media.seeking&&position>lastPosition){
    seconds+=(position-lastPosition)/rate;
   }
   lastPosition=position;
   rate=media.playbackRate||1;
   return;
  }
  const currentActive=format==='ebook'?visible():speaking();
  if(usageMetricsEnabled()&&root.isConnected&&previousActive&&currentActive){
   const end=format==='ebook'?Math.min(now,interaction+120000):now;
   seconds+=Math.max(0,Math.min((end-last)/1000,15));
  }
  last=now;
  previousActive=currentActive;
 }
 function flush(){
  const total=Math.floor(seconds);
  while(reported<total&&usageMetricsEnabled()){
   const duration_seconds=Math.min(total-reported,MAX_EVENT_SECONDS);
   reported+=duration_seconds;
   emit('usage_time',{...details,duration_seconds});
  }
 }
 function sampleAndFlush(){sample();flush()}
 function onTimeUpdate(){sample();if(seconds-reported>=FLUSH_SECONDS)flush()}
 function tick(){if(!root.isConnected){stop();return}onTimeUpdate()}
 function pageHide(event){if(event.persisted)sampleAndFlush();else stop()}
 function stop(){
  if(closed)return;
  sampleAndFlush();
  closed=true;
  clearInterval(timer);
  for(const name of interactions)document.removeEventListener(name,touch,true);
  document.removeEventListener('visibilitychange',sampleAndFlush);
  window.removeEventListener('pagehide',pageHide);
  for(const [name,handler] of mediaEvents)media.removeEventListener(name,handler);
  emit('usage_session_end',{...details,duration_seconds:Math.min(Math.floor(seconds),86400)});
 }

 const mediaEvents=media?[
  ['timeupdate',onTimeUpdate],['seeking',resetPosition],['seeked',resetPosition],
  ['pause',sampleAndFlush],['ended',sampleAndFlush],['ratechange',sample]
 ]:[];
 for(const [name,handler] of mediaEvents)media.addEventListener(name,handler);
 if(format==='ebook')for(const name of interactions)document.addEventListener(name,touch,{capture:true,passive:true});
 document.addEventListener('visibilitychange',sampleAndFlush);
 window.addEventListener('pagehide',pageHide);
 const timer=setInterval(tick,5000);
 active={stop};
 emit('usage_session_start',details);
}
