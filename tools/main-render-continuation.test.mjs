import test from 'node:test';
import assert from 'node:assert/strict';
import {ff79Fixture} from './render-ff79-fixtures.mjs';
import {clearFF79Windows,proveTaskClearFF79} from './task-native-clear-ff79-source.mjs';
import {matrixNmiSpecs} from './main-matrix-nmi-source.mjs';
import {gameNmiSpecs} from './main-game-nmi-source.mjs';
import {decodeWindows,DialogTestMemory,rom} from './task-native-dialog-harness.mjs';
import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {runReference} from './w65c816-reference.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';
import {NATIVE_CALL_CONTINUATIONS} from '../src/task/native-call-continuation.mjs';
import {WAIT_PAUSED,WAIT_RETURNED} from '../src/task/native-wait-continuation.mjs';
import {GAME_NMI_ROUTINES} from '../src/task/main-game-nmi.mjs';
import {TALK_ROUTINES} from '../src/task/native-dialog.mjs';
import {TRANSITION_ROUTINES} from '../src/task/main-transition.mjs';
import {releaseGloveNameWindow} from '../src/task/native-dialog-portrait.mjs';
import {finishInterruptObservations} from '../src/task/main-wait-interrupt.mjs';
import {releaseWindowAdapter} from '../src/task/native-render-compose.mjs';
import {runReleaseWindowCall} from '../src/game/window-release.mjs';

const releaseWindows=[{start:0x80BCB2,hex:'9CD801ADDA013003205BBE60'},
  {start:0x80BE5B,hex:'ADDC018500203EFAA9FFFF8DDA018DDE0160'}];
const windows=[...clearFF79Windows(),...releaseWindows],map=decodeWindows(windows);
const nmi=decodeWindows([...matrixNmiSpecs[2].windows,...gameNmiSpecs.flatMap(s=>s.windows)]);
const waits=new Set([0x81ACB5,0x81ACB8,0x81ACBC,0x81ACAF,0x81ACB2,0x81ACB4]);
const freeze=rows=>Object.freeze(rows.map(o=>Object.freeze({...o})));
const expand=trace=>trace.flatMap(o=>o.width===2?[{...o,width:1,value:o.value&255},{...o,width:1,address:o.address+1,value:o.value>>>8}]:[{...o,width:1}]);
function side(entry,bank,index,empty,counter){
  const data=ff79Fixture({bank,flags:[1,1,1,1],last:6,slots:empty?[0xFFFF,0x8000,0xFFFF,0x8001]:[0,2,4,6],counter});
  const mem=new DialogTestMemory(new Uint8Array(0x20000),null,rom.slice());
  for(const [address,value]of data.snapshot().bytes){if(address>=0x7E0000&&address<=0x7FFFFF)mem.write8(address,value);
    else mem.rom[((address>>>16)&0x1F)<<15|(address&0x7FFF)]=value;}
  for(const [at,value]of [[0,index],[0x1DA,empty?0xFFFF:0],[0x1DC,index],[0x6E,0xC152],[0x140,0xFFFF],[0xCD8,1]])mem.write16(at,value);
  mem.write8(0x70,0x80);
  const a=new TaskAccessor({mem,a:0xA55A,x:0x1234,y:0xABCD,s:0x1EF0,d:0,dbr:bank,p:index?0xC7:0x43,pc:entry&65535});
  a.load();a.ctx.programBank=entry>>>16;a.trace=[];a.io=[];a.observeArithmetic=true;a.devices={write(){}};
  const h=dialogAccess(a);if(entry===0x81AD92)h.pushByte(0x80);h.push(0x1234,2);return {a,h,mem};
}
function referenceIo(v){const read=v.mem.read8.bind(v.mem);let byte=0;
  v.mem.read8=address=>{const o=v.a.io[v.a.ioIndex];if(o&&address===o.address+byte){const value=o.value>>>(8*byte++)&255;
    if(byte===o.width){v.a.ioIndex++;byte=0;}return value;}return read(address);};
}
function originalNmi(v){const {a,h}=v,before={...a.ctx};
  a.io.push(...(before.bank===0x7E?[]:[{pc:0x00C118,address:before.bank<<16|0x4210,width:2,value:0x80}]),
    {pc:0x809E0B,address:0x4212,width:2,value:1},{pc:0x809E0B,address:0x4212,width:2,value:0},
    {pc:0x809E13,address:0x4218,width:2,value:0x8000});
  h.pushByte(before.programBank);h.push(before.pc,2);h.pushByte(before.status);a.ctx.status=(before.status|4)&~8;a.ctx.programBank=0;
  runReference(nmi,v.mem,a.ctx,{entry:0x00C112,root:'RTI',io:a.trace});assert.deepEqual(a.ctx,before);
}
function compare(entry,bank,index,empty,counter,phase){const r=side(entry,bank,index,empty,counter),n=side(entry,bank,index,empty,counter),records=[],states=[];
  referenceIo(r);const hits=new Map();
  const before=new Map([...waits].map(pc=>[pc,()=>{const hit=(hits.get(pc)??0)+1;hits.set(pc,hit);
    const take=pc===phase&&hit===1||pc===0x81ACAF&&hit>=3;
    records.push({pc,nmi:take});r.a.ctx.pc=pc&65535;r.a.ctx.programBank=pc>>>16;
    if(take){originalNmi(r);states.push({ctx:{...r.a.ctx},wram:r.mem.wram.slice(),io:r.a.ioIndex});}
  }]));
  runReference(map,r.mem,r.a.ctx,{entry,root:entry===0x81AD92?'RTL':'RTS',before,io:r.a.trace,limit:5_000_000});
  const events={interrupts:freeze(records),interruptIndex:0,interruptRoutines:GAME_NMI_ROUTINES},factory=NATIVE_CALL_CONTINUATIONS.get(entry);
  // The talk table binds the lifted release (80:FA3E), which keeps this register-level
  // continuation for recorded interrupt observations.
  if(entry===0x80FA3E)assert.equal(TALK_ROUTINES.get(entry),runReleaseWindowCall);
  const run=entry===0x81AD92?TRANSITION_ROUTINES.get(entry):entry===0x80BE5B?releaseGloveNameWindow:entry===0x80FA3E?releaseWindowAdapter:TALK_ROUTINES.get(entry);
  assert.equal(factory.run,run);n.a.io=r.a.io;const c=factory.create({h:n.h,events}),ctx={...n.a.ctx},wram=n.mem.wram.slice();
  assert.equal(c.run(0),WAIT_PAUSED);assert.deepEqual(n.a.ctx,ctx);assert.deepEqual(n.mem.wram,wram);
  let pauses=0,matched=0;
  while(c.run(1)===WAIT_PAUSED){assert.ok(++pauses<records.length*40+1000);
    const state=states[matched];if(state&&n.a.ctx.pc===state.ctx.pc&&n.a.ctx.programBank===state.ctx.programBank&&n.a.ioIndex===state.io){
      assert.deepEqual(n.a.ctx,state.ctx);assert.deepEqual(n.mem.wram,state.wram);matched++;}
  }
  assert.equal(matched,states.length);assert.equal(c.run(1),WAIT_RETURNED);finishInterruptObservations(events);
  assert.deepEqual(n.a.ctx,r.a.ctx);assert.deepEqual(n.mem.wram,r.mem.wram);assert.deepEqual(expand(n.a.trace),expand(r.a.trace));
  assert.equal(n.a.ioIndex,r.a.io.length);assert.equal(n.a.ctx.pc,0x1235);assert.equal(n.a.ctx.s,0x1EF0);
  if(!empty||![0x80BCB2,0x80FF79].includes(entry))assert.ok(matched>0);
}
test('complete window cleanup/render continuation pins the original shared graph and real mixed stack',()=>{
  proveTaskClearFF79(decodeWindows(clearFF79Windows()));assertPinnedTaskSource(map,windows);
});
test('BCB2/BE5B, FF79, FA3E and AD92 retain all original frames, effects and NMI/RTI across finite budgets',()=>{
  for(const entry of [0x80BCB2,0x80BE5B,0x80FF79,0x80FA3E,0x81AD92])for(const bank of [0,0x80,0x81,0x7E])
    for(const [index,empty,counter,phase]of [[6,false,0,0x81ACB8],[0,false,0xFFFF,0x81ACB2],[2,true,1,0x81ACBC]])
      compare(entry,bank,index,empty,counter,phase);
});
test('a render continuation rejects foreign registers and never replays a failed request',()=>{
  const v=side(0x80FF79,0x80,6,false,0),events={interrupts:freeze([]),interruptIndex:0};
  const c=NATIVE_CALL_CONTINUATIONS.get(0x80FF79).create({h:v.h,events});
  c.run(1);const wram=v.mem.wram.slice(),a=v.a.ctx.a;v.a.ctx.a^=1;
  assert.throws(()=>c.run(1),e=>e.reason==='native_call_owner_required');assert.deepEqual(v.mem.wram,wram);v.a.ctx.a=a;
  assert.throws(()=>c.run(1000),e=>e.reason==='wait_interrupt_observation_required');const failed=v.mem.wram.slice();
  assert.throws(()=>c.run(1000),e=>e.reason==='native_call_failed');assert.deepEqual(v.mem.wram,failed);assert.equal(events.interruptIndex,0);
});
