import test from 'node:test';
import assert from 'node:assert/strict';
import {cartridge} from './cartridge-harness.mjs';
import {loadSave} from './mesen-f390-oracle.mjs';
import {livePlanDriver} from './live-plan-driver.mjs';
import {BADGE_BUY_LIVE_PLAN} from './live-plans.mjs';
import {LiveGame} from '../src/video/live-game.mjs';
import {MouseControl} from '../src/browser/mouse-control.mjs';

// Crosshair with mouse and keyboard (src/browser/mouse-control.mjs,
// docs/CONTROLS.md). Live from the reset with the save game apartment: title
// menu as in live-save, then the closed route of BADGE_BUY_LIVE_PLAN to the
// Beretta in the alley (picked up with R, the orc keeps shooting), in the
// status screen Weapon, Beretta Pistol, Use (sequence from ALLEY_FIGHT_PLAN).
// User finding: after F (A) the crosshair jumped into the glove when the mouse
// moved. Cause: A on the open hand only closes it (E18D), and the next mouse
// move opens the hand again. Now A from the keyboard switches from the hand to
// the crosshair, the mouse only moves it, the left button fires, the right one
// ends it (kept, also during the shot animation). A from the gamepad stays as
// in the original.
const START=0x1000,DOWN=0x0400,A=0x0080,B=0x8000,OPEN=0x01D8;
const TITLE=k=>k>=3000&&k<3004||k>=3300&&k<3304||k>=3600&&k<3604?START:k>=3150&&k<3154?DOWN:0;
const pickUp=BADGE_BUY_LIVE_PLAN.findIndex(c=>c[0]==='press'&&c[1]==='r');
const EQUIP=[['wait',20],['press','start',80],['press','b',40],['press','down',20],['press','down',20],['press','down',20],
  ['press','b',40],['press','down',20],['press','b',40],['press','down',20],['press','down',20],['press','b',40],['press','b',40],
  ['press','b',60],['wait',30]];
test('keyboard F switches the open hand to the crosshair and the mouse aims and fires',{timeout:900000},()=>{
  const input={word:0,keyDirections:0,keyButtons:0,mouse:{seq:0,x:0,y:0},mouseBits:0,buttons:0,back:false,wheel:0},out=[];
  const plan=[...BADGE_BUY_LIVE_PLAN.slice(3,pickUp+1),...EQUIP];let driver=null,control=null;
  const game=new LiveGame(cartridge,{sram:new Uint8Array(loadSave('apartment')),pad:k=>{
    if(k<5000)return TITLE(k);
    driver??=livePlanDriver(plan,game.memory.wram,()=>game.driver.roundsCompleted);
    if(!driver.done())return driver.pad(k);
    const word=control.pad(k,input);out.push(word);return word;}});
  control=new MouseControl(game);
  const wram=game.memory.wram,word=a=>wram[a]|wram[a+1]<<8;
  const run=n=>{while(game.nmis<n)game.step();},after=n=>run(game.nmis+n);
  while(!driver?.done())game.step();after(10);
  const key=(bits,frames)=>{input.word=input.keyButtons=bits;after(frames);input.word=input.keyButtons=0;after(6);};
  const edges=bits=>out.filter((w,i)=>w&bits&&!(out[i-1]&bits)).length;
  // The mouse opens the hand; one keyboard F (held eight frames) switches to the crosshair without a shot.
  input.mouse={seq:1,x:120,y:100};after(6);
  assert.equal(word(OPEN),0xFFFF,'hand open');
  out.length=0;key(A,8);
  assert.equal(word(OPEN),0xFFFE,'one F gives the crosshair');
  assert.equal(edges(A),2,'A once to close the hand, once to open the crosshair, no third press as a shot');
  // The mouse only moves the crosshair (user finding: it jumped into the hand).
  for(const [seq,x,y] of [[2,140,90],[3,60,150],[4,200,40]]){input.mouse={seq,x,y};after(6);
    assert.deepEqual([word(OPEN),wram[0x1D5],wram[0x1D7]],[0xFFFE,x,y],'crosshair under the mouse');}
  // Left button fires (A), the crosshair stays and the mouse still aims.
  out.length=0;input.buttons=1;after(4);input.buttons=0;after(20);
  assert.ok(edges(A)>=1&&!edges(B),'left button gives A');
  assert.equal(word(OPEN),0xFFFE,'still aiming after the shot');
  input.mouse={seq:5,x:100,y:100};after(6);assert.equal(word(OPEN),0xFFFE,'mouse after the shot still aims');
  // B straight after a shot (keyboard or gamepad B, the probe of 2026-10-30): E19A closes the
  // crosshair. With the mouse layer of 2026-10-30 this B read the selection record from the open
  // bus (8C:6A56) and 8D:35B3; since ff40402d this run takes another path. That path is now
  // tools/live-alley-bus.test.mjs, with its input replayed and compared with Mesen.
  input.buttons=1;after(4);input.buttons=0;input.word=B;after(4);input.word=0;
  for(let n=0;n<60&&word(OPEN);n++)after(1);
  assert.equal(word(OPEN),0,'B straight after a shot ends the crosshair');
  // A short right click 10 frames after a shot, while E014 pauses for it, ends the crosshair
  // once player control runs again (closing is kept until then).
  after(30);input.mouse={seq:10,x:120,y:100};after(6);key(A,8);assert.equal(word(OPEN),0xFFFE);
  input.buttons=1;after(4);input.buttons=0;after(10);
  assert.ok(game.controlNmi<game.nmis-1,'player control pauses for the shot');
  out.length=0;input.buttons=2;after(4);input.buttons=0;
  for(let n=0;n<60&&word(OPEN);n++)after(1);
  assert.equal(word(OPEN),0,'short right click during the shot pause ends the crosshair');assert.ok(edges(B)>=1);
  // Moves while the player control pauses lapse (as in dialogs); a move once it runs opens the hand.
  after(30);input.mouse={seq:6,x:110,y:90};after(6);assert.equal(word(OPEN),0xFFFF,'hand again');
  // A from the gamepad (not the keyboard) keeps the original: it only closes the hand.
  input.word=A;after(8);input.word=0;after(6);
  assert.equal(word(OPEN),0,'gamepad A closes the hand like the original');
});
