import test from 'node:test';
import assert from 'node:assert/strict';
import {audioSourceUrl,R2_AUDIO_BASE} from '../src/audio-source.js';
test('existing audio stays on GitHub',()=>{assert.equal(audioSourceUrl({},'./audio/montecristo/capitolo-20.m4a','montecristo/capitolo-20.m4a'),'./audio/montecristo/capitolo-20.m4a');assert.equal(audioSourceUrl({audioSource:'github'},'local','key'),'local')});
test('new chapter on R2',()=>assert.equal(audioSourceUrl({audioSource:'r2'},'local','montecristo/capitolo-21.m4a'),R2_AUDIO_BASE+'montecristo/capitolo-21.m4a'));
test('multi-track Ovidio',()=>assert.equal(audioSourceUrl({audioSource:'r2'},'local','metamorfosi-ovidio/005_Libro_V.mp3'),R2_AUDIO_BASE+'metamorfosi-ovidio/005_Libro_V.mp3'));
test('reject invalid source and path',()=>{assert.throws(()=>audioSourceUrl({audioSource:'other'},'local','x.mp3'));for(const path of ['../x.mp3','https://example.com/x.mp3','a//x.mp3','a/x.txt'])assert.throws(()=>audioSourceUrl({audioSource:'r2'},'local',path))});
