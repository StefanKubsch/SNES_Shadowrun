import test from 'node:test';
import assert from 'node:assert/strict';
import {cartridge} from './cartridge-harness.mjs';
import {browserLive,findEdge} from './browser-frame.mjs';
import {LiveGame} from '../src/video/live-game.mjs';
import {resolve} from 'node:path';
import {loadSave} from './mesen-f390-oracle.mjs';
import {saveHash,saveToText} from '../src/browser/save-file.mjs';

// The real browser page: open the ROM, "Spiel starten", the live cold start
// runs in the worker without input up to the intro text. Expected pixels come
// from the same native owner (LiveGame), whose pictures are compared with
// Mesen in live-cold-start.test.mjs. Each frame of the worker carries the
// sound pairs since the previous frame; the page received exactly the pairs
// the native DSP produced up to that frame (count and FNV-1a over the Int16
// values, DSP compared with Mesen in sound-apu.test.mjs), and its AudioWorklet
// plays them. Before the start the page imports the save apartment.srm
// (src/browser/save-file.mjs): it keeps it in localStorage, exports it
// unchanged, and the worker starts with it as SRAM (loading and saving in
// the game: live-save.test.mjs).
const edge=findEdge();
test('the browser starts the game live from reset and shows the native frame',{skip:edge?false:'Microsoft Edge nicht gefunden',timeout:600000},async()=>{
  const sram=new Uint8Array(loadSave('apartment'));
  const browser=await browserLive({exe:edge,minNmi:900,savePath:resolve('tools/mesen/saves/apartment.srm')});
  let pixels=null,pairs=0,hash=0x811C9DC5,sounding=false;
  const game=new LiveGame(cartridge,{sram,onFrame:f=>{
    if(f.nmi>browser.nmi)return;
    const audio=game.apu.takeOutput();pairs+=audio.length/2;
    for(const v of audio){hash=Math.imul(hash^(v&0xFFFF),0x01000193)>>>0;if(v)sounding=true;}
    if(f.nmi===browser.nmi)pixels=f.pixels;}});
  game.apu.enableOutput(256);
  while(game.nmis<=browser.nmi)game.step();
  assert.ok(browser.nmi>=900);
  // Served with cross-origin isolation: the worker reads the pad at the NMI and stays at most two frames ahead.
  assert.equal(browser.shared,true,'shared memory between page and worker');
  assert.deepEqual(browser.pixels,Buffer.from(pixels),'browser live frame '+browser.nmi);
  const sound=browser.audio;
  assert.deepEqual([sound.pairs,sound.hash],[pairs,hash],'browser sound pairs');
  assert.ok(sounding&&sound.error===null&&sound.played>0,JSON.stringify(sound));
  // Steuerung (src/browser/controls.mjs): Y nach der Beschriftung, rechte Maustaste = R, beide losgelassen.
  assert.deepEqual(browser.pads,[0x4000,0x4010,0]);
  const save=browser.save,sum=saveHash(sram);
  assert.deepEqual([save.hash,save.loaded,save.stored,save.exported],[sum,sum,saveToText(sram),saveToText(sram)],save.status);
  console.log(JSON.stringify({nmi:browser.nmi,stalls:browser.stalls,sound,logDir:browser.logDir}));
});
