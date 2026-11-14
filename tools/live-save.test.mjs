import test from 'node:test';
import assert from 'node:assert/strict';
import {cartridge} from './cartridge-harness.mjs';
import {loadSave} from './mesen-f390-oracle.mjs';
import {livePlanDriver} from './live-plan-driver.mjs';
import {LiveGame} from '../src/video/live-game.mjs';
import {SaveWatch,importSave,saveFromText,saveToText} from '../src/browser/save-file.mjs';

// Save game in the browser (src/browser/save-file.mjs): .srm files are the
// raw 8 KiB SRAM, and the localStorage text returns them unchanged.
test('a save file is the raw 8 KiB SRAM and survives the browser storage text',()=>{
  const bytes=Uint8Array.from({length:0x2000},(_,i)=>i*7&255);
  assert.deepEqual(saveFromText(saveToText(bytes)),bytes);
  assert.equal(saveFromText(null),null);assert.equal(saveFromText('AAAA'),null);
  assert.throws(()=>importSave(new Uint8Array(0x2001)),/8192 bytes/);
  assert.notEqual(importSave(bytes),bytes);
});
test('the save watch reports a changed SRAM once it stayed unchanged for a frame',()=>{
  const sram=new Uint8Array(0x2000),watch=new SaveWatch(sram);
  assert.equal(watch.check(),null);
  sram[5]=1;assert.equal(watch.check(),null);
  sram[6]=2;assert.equal(watch.check(),null);
  const saved=watch.check();assert.deepEqual([saved[5],saved[6]],[1,2]);
  assert.equal(watch.check(),null,'reported once');
  sram[5]=0;sram[5]=1;assert.equal(watch.check(),null,'unchanged against the reported state');
});

// Live from the reset with the Mesen save game apartment (slot 1): title menu
// "Start saved game", "Resume game 1" loads Jake's apartment; at the bed "Save game",
// "Save game 2". Native loading and saving give the loaded state in slot 2 (from 0FFE,
// 0FFE bytes per slot); only bytes 0/1 and 24C of the slot differ (checksum and
// play time). The waits are lag-free (shorter than in the Mesen plan
// SAVES.apartment).
const START=0x1000,DOWN=0x0400,SLOT=0x0FFE;
const TITLE=k=>k>=3000&&k<3004||k>=3300&&k<3304||k>=3600&&k<3604?START:k>=3150&&k<3154?DOWN:0;
const BED_SAVE=[['press','b'],['glove',122,155],['wait',8],['press','b',40],['press','down',20],['press','b',80],['wait',400],
  ['press','down',20],['press','b',80],['wait',60],['press','down',20],['press','down',20],['press','b',120],['wait',60]];
test('the live game loads a save from the title and saves again at the bed',{timeout:900000},()=>{
  const loaded=new Uint8Array(loadSave('apartment'));let driver=null,watch=null;const reports=[];
  const game=new LiveGame(cartridge,{sram:loaded,pad:k=>{
    if(k<5000)return TITLE(k);
    driver??=livePlanDriver(BED_SAVE,game.memory.wram,()=>game.driver.roundsCompleted);return driver.pad(k);},
    onFrame:f=>{const save=watch.check();if(save)reports.push({nmi:f.nmi,save});}});
  watch=new SaveWatch(game.memory.sram);
  while(!driver?.done())game.step();
  const sram=game.memory.sram,differs=[];
  for(let i=0;i<SLOT;i++)if(sram[SLOT+i]!==loaded[i])differs.push(i);
  assert.deepEqual(differs,[0,1,0x24C]);
  assert.deepEqual(sram.subarray(0,SLOT),loaded.subarray(0,SLOT),'slot 1 unchanged');
  // The browser receives the finished save once, after the bed menu.
  assert.equal(reports.length,1,JSON.stringify(reports.map(r=>r.nmi)));
  assert.ok(reports[0].nmi>5700);assert.deepEqual(reports[0].save,sram);
  assert.equal(game.dataOutsideBlank,0);
});
