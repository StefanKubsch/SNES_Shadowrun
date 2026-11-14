import test from 'node:test';
import assert from 'node:assert/strict';
import {cartridge} from './cartridge-harness.mjs';
import {loadSave} from './mesen-f390-oracle.mjs';
import {findMesen} from './mesen.mjs';
import {explore} from './mesen-explore.mjs';
import {PLAN} from './live-alley-plan.mjs';
import {exploreLive} from './explore-live.mjs';

// Shot and B in the alley, natively and in Mesen (open issue D15C of 2026-10-30).
// From the apartment save game the closed route of BADGE_BUY_LIVE_PLAN leads into
// the alley, Jake picks up the Beretta while the orc shoots and equips it in the
// status screen. Then the input the mouse layer gave before 2026-10-30 (ff40402d):
// B opens the hand, the crosshair goes to 120,100, A twice gives the crosshair,
// it goes to 140,90, 60,150 and 200,40, A fires, it goes to 100,100, A fires and
// B follows at once. The crosshair position is written to 01D4/01D6 as that layer
// did. That B lets the player control read through A985/D15C:
//   80:A98C the word 80:9906 (97 A0) and 80:A9BD the word 80:9A66 (1F A9), code
//   bytes read as data, and 80:A9AF 8C:6A56, 80:A9BF 8D:35B3, where nothing is
//   mapped (Book I PDF 93: $2000-$5FFF is the register area, these are no
//   registers; $6000-$7FFF is empty). The original reads 8C there: the open bus
//   holds the last byte read, the bank byte of the pointer 8C:8C94, which is what
//   src/task/native-object-turn.mjs returns.
// The four code bytes were missing in the data package (rom_byte_absent at
// 80:9906): the mouse layer of ff40402d no longer reached this path, so the read
// record (analysis/rom-reads.json) never saw them.
// Same random draws on both sides (explore.lua "counter" and "clock", as in
// tools/live-matrix.test.mjs): at the alley entry and again after the status
// screen, whose own wait loop the clock does not count. Jake's health, the only
// differing byte of his record at the alley entry, is set equal (19, then 12).
// The status screen still ends in another state of the fight in the original
// (lag frames there shift the orc), so after it only the reads and the end of the
// crosshair are compared, not every frame.
const CODE=[[0x809906,0x97],[0x809907,0xA0],[0x809A66,0x1F],[0x809A67,0xA9]];

let native=null;
const run=()=>native??=exploreLive(PLAN,{cartridge,sram:loadSave('apartment')});
// Watched word n of a Mesen "W frame x y object words..." line is field 5 + n (01D8 is word 3).
test('B straight after a shot reads code bytes 80:9906 and 80:9A66 from the data package and ends the crosshair',{timeout:900000},()=>{
  const r=run(),w=r.game.memory.wram;
  assert.deepEqual(r.reads.map(([,address,value])=>[address,value]),CODE,'the word reads of 80:A98C and 80:A9BD');
  assert.equal(new Set(r.reads.map(([k])=>k)).size,1,'all in the frame of the B');
  assert.equal(w[0x1D8]|w[0x1D9]<<8,0,'the crosshair ends');
});

const {exe,reason}=findMesen();
test('the original makes the same reads and gets the pointer bank 8C from the open bus',{skip:exe?false:reason,timeout:1200000},async()=>{
  const r=run(),reads=[],lines=[];
  await explore(exe,PLAN,{start:10,limit:30000,sram:loadSave('apartment'),timeoutMs:1100000,onLine:line=>{
    const t=line.split(' ');if(t[0]==='RD')reads.push([parseInt(t[2],16),parseInt(t[3],16),parseInt(t[4],16)]);
    else if(t[0]==='W'||t[0]==='CTR')lines.push(t);}});
  // Mesen names the address after the instruction (its PC has moved on by then).
  assert.deepEqual(reads,[[0x809906,0x97,0x80A98C],[0x809907,0xA0,0x80A98C],[0x8C6A56,0x8C,0x80A9AF],[0x8C6A57,0x8C,0x80A9AF],
    [0x809A66,0x1F,0x80A9BD],[0x809A67,0xA9,0x80A9BD],[0x8D35B3,0x8C,0x80A9BF],[0x8D35B4,0x8C,0x80A9BF]]);
  // The crosshair (01D8 = FFFE) ends with that B in the original too.
  assert.equal(lines.filter(t=>t[0]==='CTR').length,2,'two counter switches in the original');
  const crosshair=lines.filter(t=>t[0]==='W').map(t=>parseInt(t[8],16));
  assert.ok(crosshair.includes(0xFFFE),'crosshair in the original');assert.equal(crosshair.at(-1),0,'and ended at the end');
});
