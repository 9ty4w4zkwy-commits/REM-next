// Staged beta metrics. Enable only after Worker, dashboard and consent flow are ready.
import {analyticsEnabled,trackEvent} from './analytics.js?v=onboarding-four-20261125';
export const METRICS_READY=false;
let active=null;
const enabled=()=>METRICS_READY&&analyticsEnabled();
const emit=(event,details)=>{if(enabled())trackEvent(event,details)};
export function recordModeChoice(book,path){emit('reading_path_choice',{book_id:book,reading_path:path})}
export function recordSwitch(book,chapter,from,to,path){if(from!==to)emit('format_switch',{book_id:book,chapter_id:chapter,from_format:from,to_format:to,reading_path:path})}
export function stopUsage(){active?.stop();active=null}
export function startUsage(root,{book_id,chapter_id,format,reading_path}){
 stopUsage();if(!enabled()||!root||!['ebook','audio'].includes(format))return;
 const session_id=globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2);
 const details={book_id,chapter_id,format,reading_path,session_id};
 let last=performance.now(),interaction=last,seconds=0,reported=0,previousPlaying=false,previousVisible=false,closed=false;
 const touch=()=>{interaction=performance.now()};
 const isPlaying=()=>{const media=root.querySelector('audio');if(media)return !media.paused&&!media.ended&&!media.seeking&&media.readyState>=3;return root.dataset.analyticsSpeaking==='true'&&window.speechSynthesis?.speaking&&!window.speechSynthesis?.paused};
 const visible=()=>{if(document.hidden)return false;const r=root.getBoundingClientRect();return r.bottom>0&&r.top<window.innerHeight};
 function sample(){const now=performance.now(),delta=Math.max(0,Math.min((now-last)/1000,15));if(enabled()&&root.isConnected){if(format==='audio'&&previousPlaying&&isPlaying())seconds+=delta;else if(format==='ebook'&&previousVisible&&visible()&&now-interaction<=120000)seconds+=delta;}last=now;previousPlaying=format==='audio'&&isPlaying();previousVisible=format==='ebook'&&visible()}
 function flush(){const total=Math.floor(seconds),duration_seconds=total-reported;if(duration_seconds>0&&enabled()){reported=total;emit('usage_time',{...details,duration_seconds})}}
 function tick(){if(!root.isConnected){stop();return}sample();if(seconds-reported>=60)flush()}
 function onVisibility(){sample();flush()}
 function stop(){if(closed)return;sample();flush();closed=true;clearInterval(timer);for(const e of ['pointerdown','touchstart','scroll','keydown'])document.removeEventListener(e,touch,true);document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('pagehide',stop);if(enabled())emit('usage_session_end',{...details,duration_seconds:Math.floor(seconds)})}
 for(const e of ['pointerdown','touchstart','scroll','keydown'])document.addEventListener(e,touch,{capture:true,passive:true});
 document.addEventListener('visibilitychange',onVisibility);window.addEventListener('pagehide',stop);
 previousPlaying=format==='audio'&&isPlaying();previousVisible=format==='ebook'&&visible();
 const timer=setInterval(tick,5000);active={stop};emit('usage_session_start',details);
}
