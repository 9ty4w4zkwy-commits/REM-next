export const R2_AUDIO_BASE='https://rem-audio.9ty4w4zkwy.workers.dev/';
export function audioSourceUrl(chapter,localUrl,key){
 if(chapter?.audioSource==null||chapter.audioSource==='github')return localUrl;
 if(chapter.audioSource!=='r2')throw Error('Sorgente audio sconosciuta');
 if(typeof key!=='string'||!key.split('/').every(s=>/^[a-zA-Z0-9_-][a-zA-Z0-9_. -]*$/.test(s))||!/\.(m4a|m4b|mp3|aac|ogg|wav)$/i.test(key))throw Error('Percorso audio R2 non valido');
 return R2_AUDIO_BASE+key.split('/').map(encodeURIComponent).join('/');
}
