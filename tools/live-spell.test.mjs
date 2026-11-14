import test from 'node:test';
import assert from 'node:assert/strict';
import {cartridge} from './cartridge-harness.mjs';
import {loadSave} from './mesen-f390-oracle.mjs';
import {livePlanDriver} from './live-plan-driver.mjs';
import {LiveGame} from '../src/video/live-game.mjs';

// Spell via X, live from the apartment save game (Jake has no spell there, so
// the test writes Magic 3 to his record 7E:3BFC, the six spell levels to
// 7E:3C07..3C0C and 30 magic points to 7E:3C96, as the Mesen coverage scenario
// "status" does). Status screen (Start), Magic, Heal (the second spell) as X
// spell, then X and B cast it at "Me". The expected bytes come from the same
// sequence in Mesen (tools/mesen/explore.lua watch, 2026-11-01): 1CE2 = 3 and
// 1D99 = 1 after the choice; 1D67 = 56, 3D0D 82 -> 81 and 3D11 92 -> 91 after
// the cast; the magic points stay 30 (Heal at full health costs nothing).
const START=0x1000,DOWN=0x0400;
const TITLE=k=>k>=3000&&k<3004||k>=3300&&k<3304||k>=3600&&k<3604?START:k>=3150&&k<3154?DOWN:0;
const SELECT=[['wait',60],['press','start',150],['wait',150],['press','down',30],['press','down',30],['press','b',120],
  ['press','down',30],['press','down',30],['press','b',120],['press','b',120],['wait',60]];
const CAST=[['press','x',30],['press','b',60],['wait',200]];
test('a spell chosen in the status screen is cast with X like the original',{timeout:900000},()=>{
  let driver=null,chosen=null;
  const game=new LiveGame(cartridge,{sram:new Uint8Array(loadSave('apartment')),pad:k=>{
    if(k<5000)return TITLE(k);
    const wram=game.memory.wram;
    if(!driver){wram.set([3],0x3BFC);wram.set([1,2,1,1,1,1],0x3C07);wram.set([30,0],0x3C96);
      driver=livePlanDriver(SELECT,wram,()=>game.driver.roundsCompleted);}
    if(driver.done()&&!chosen){chosen=wram.slice();driver=livePlanDriver(CAST,wram,()=>game.driver.roundsCompleted);}
    return driver.pad(k);}});
  while(!chosen||!driver.done())game.step();
  const wram=game.memory.wram;
  assert.deepEqual([chosen[0x1CE2],chosen[0x1D99]],[3,1],'Heal chosen as X spell');
  assert.deepEqual([chosen[0x3D0D],chosen[0x3D11]],[0x82,0x92]);
  assert.deepEqual([wram[0x1D67],wram[0x3D0D],wram[0x3D11]],[0x56,0x81,0x91],'cast at Me');
  assert.equal(wram[0x3C96]|wram[0x3C97]<<8,30,'Heal at full health costs no magic points');
});
