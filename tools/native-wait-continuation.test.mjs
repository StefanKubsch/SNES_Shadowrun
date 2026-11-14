import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeWaitContinuation,WAIT_PAUSED,WAIT_RETURNED} from '../src/task/native-wait-continuation.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';
import {runObservedNmi} from '../src/task/observed-nmi.mjs';
import {GAME_NMI_ROUTINES} from '../src/task/main-game-nmi.mjs';
import {counterWindows} from './render-task-native-counter-b0a1-source-proof.mjs';
import {inputApuWindows} from './render-task-native-input-apu-source-proof.mjs';
import {sceneAnimationSpecs} from './main-scene-animation-source.mjs';
import {gameNmiSpecs} from './main-game-nmi-source.mjs';
import {matrixNmiSpecs} from './main-matrix-nmi-source.mjs';
import {decodeWindows,DialogTestMemory,rom} from './task-native-dialog-harness.mjs';
import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {runReference} from './w65c816-reference.mjs';

const roots=[
  {entry:0x81B0A1,root:'RTL',windows:counterWindows},
  {entry:0x81EEBB,root:'RTL',windows:sceneAnimationSpecs.find(s=>s.name==='eebb').windows},
  {entry:0x809E0B,root:'RTS',windows:gameNmiSpecs.find(s=>s.entry===0x809E0B).windows},
  {entry:0x809E1A,root:'RTS',windows:[{start:0x809E1A,hex:inputApuWindows[0].hex.slice(0,0x23*2)}]},
].map(s=>({...s,map:decodeWindows(s.windows)}));
const nmi=decodeWindows([...matrixNmiSpecs[2].windows,...gameNmiSpecs.flatMap(s=>s.windows)]);

function side(spec,{baseline=0xFFFF,p=0x41,bank=0x80,hardware=false,s=0x1EF0}={}) {
  const mem=new DialogTestMemory(new Uint8Array(0x20000),null,rom);
  for(const [at,value]of [[0x6E,0xC152],[0x1C76,baseline],[0x1CA,0x8000],[0x1CC,0x4000],[0x140,0xFFFF],[0xCD8,1]])mem.write16(at,value);
  mem.write8(0x70,0x80);mem.write8(0x30,hardware?0:0x80);
  const a=new TaskAccessor({mem,a:0xA55A,x:0xDEAD,y:0xBEEF,s,d:0,dbr:bank,p,pc:spec.entry&65535});a.load();
  a.ctx.programBank=spec.entry>>>16;if(p&0x10){a.ctx.x&=255;a.ctx.y&=255;}
  const h=dialogAccess(a);if(spec.root==='RTL')h.pushByte(0x80);h.push(0x96AE,2);
  a.io=[];a.trace=[];a.devices={write(){}};
  return {mem,a,h};
}
function nmiIo(v,pad) {
  const bank=v.a.ctx.bank;
  return [...(bank===0x7E?[]:[{pc:0x00C118,address:bank<<16|0x4210,width:2,value:0xAB80}]),
    {pc:0x809E0B,address:0x4212,width:2,value:1},{pc:0x809E0B,address:0x4212,width:2,value:0},
    {pc:0x809E13,address:0x4218,width:2,value:pad}];
}
function referenceIo(v) {
  const read=v.mem.read8.bind(v.mem);let byte=0;
  v.mem.read8=address=>{const o=v.a.io[v.a.ioIndex];if(o&&address===o.address+byte){
    const value=o.value>>>(8*byte++)&255;if(byte===o.width){v.a.ioIndex++;byte=0;}return value;}return read(address);};
}
function originalNmi(v) {
  const c=v.a.ctx,before={...c};v.h.pushByte(c.programBank);v.h.push(c.pc,2);v.h.pushByte(c.status);
  c.status=(c.status|4)&~8;c.programBank=0;
  runReference(nmi,v.mem,c,{entry:0x00C112,root:'RTI',io:v.a.trace});assert.deepEqual(c,before);
}
function check(spec,options,phase) {
  const r=side(spec,options),n=side(spec,options),states=[],hits=new Map();referenceIo(r);
  const before=new Map([...spec.map.keys()].map(pc=>[pc,()=>{
    const hit=(hits.get(pc)??0)+1;hits.set(pc,hit);
    r.a.ctx.programBank=pc>>>16;r.a.ctx.pc=pc&65535;
    const interrupt=pc===phase&&hit===1||[0x81B0A5,0x81EECD].includes(pc)&&hit===3;
    if(interrupt){r.a.io.push(...nmiIo(r,pc===0x809E26?0x2000:0x4000));originalNmi(r);}
    const updates=[],queue=(offset,width,value)=>{
      const address=r.a.ctx.bank<<16|offset;
      if(r.a.ctx.bank===0x7E){r.mem.write16(address,value);updates.push([address,value]);}
      else r.a.io.push({pc,address,width,value});
    };
    // Synthetic device responses are independent of the continuation budget.
    if(pc===0x81EEC2)queue(0x4212,1,hit<3?0x80:0);
    if(pc===0x809E0B)queue(0x4212,2,hit<3?0xAB81:0xAB80);
    if(pc===0x809E13)queue(0x4218,2,0xC100);
    states.push({pc,interrupt,updates,ctx:{...r.a.ctx},wram:r.mem.wram.slice(),io:r.a.ioIndex});
  }]));
  const result=runReference(spec.map,r.mem,r.a.ctx,{entry:spec.entry,root:spec.root,before,io:r.a.trace});
  n.a.io=r.a.io;const wait=new NativeWaitContinuation(n.a,spec.entry);
  for(const [index,state]of states.entries()) {
    assert.equal(wait.pc,state.pc);assert.equal(wait.run(0),WAIT_PAUSED);
    if(state.interrupt)runObservedNmi(n.a,null,GAME_NMI_ROUTINES);
    for(const [address,value]of state.updates)n.mem.write16(address,value);
    assert.deepEqual(n.a.ctx,state.ctx);assert.deepEqual(n.mem.wram,state.wram);assert.equal(n.a.ioIndex,state.io);
    assert.equal(wait.run(1),index===states.length-1?WAIT_RETURNED:WAIT_PAUSED);
  }
  assert.equal(wait.instructions,states.length);assert.equal(wait.result.rawReturnWord,result.rawReturnWord);
  assert.deepEqual(n.a.ctx,r.a.ctx);assert.deepEqual(n.mem.wram,r.mem.wram);assert.equal(n.a.ioIndex,r.a.io.length);
  const expand=rows=>rows.flatMap(o=>o.width===2?[{...o,width:1,value:o.value&255},{...o,width:1,address:o.address+1,value:o.value>>>8}]:[{...o,width:1}]);
  assert.deepEqual(expand(n.a.trace),expand(r.a.trace));
  const after=n.mem.wram.slice();assert.equal(wait.run(100),WAIT_RETURNED);assert.deepEqual(n.mem.wram,after);
}

test('all four resumable roots match pinned instructions at every pause and actual NMI/RTI boundary',()=>{
  for(const spec of roots){assertPinnedTaskSource(spec.map,spec.windows);
    for(const phase of spec.map.keys())for(const bank of [0,0x80,0x81,0x7E]) {
      // EEBB includes both the hardware path and BYTE-counter path, preserving
      // high A, PHP/PLP and original X/M modes. Input low-bit filtering too.
      const variants=spec.entry===0x81EEBB?[{p:0x41},{p:0x30},{p:0x41,hardware:true}]:[{}];
      for(const variant of variants)check(spec,{bank,...variant},phase);
    }
  }
});

test('finite budgets preserve an unchanged counter and cannot create an interrupt or input',()=>{
  for(const root of [0x81B0A1,0x81EEBB])for(const baseline of [0,0xFF,0xFFFF]) {
    const spec=roots.find(s=>s.entry===root),v=side(spec,{baseline}),before=v.mem.wram.slice(),wait=new NativeWaitContinuation(v.a,root);
    assert.equal(wait.run(0),WAIT_PAUSED);assert.deepEqual(v.mem.wram,before);
    for(const budget of [1,2,7,1001])assert.equal(wait.run(budget),WAIT_PAUSED);
    assert.equal(v.mem.read16(0x1C76),baseline);assert.equal(v.mem.read16(0x1CA),0x8000);assert.equal(v.a.ioIndex,0);
    // This is a test writer, not an inferred NMI: memory may change while the
    // owner is paused, but a BEQ still uses the preceding CMP's saved flags.
    v.mem.write16(0x1C76,(baseline+1)&65535);
    assert.equal(wait.run(8),WAIT_RETURNED);assert.equal(v.a.ctx.s,0x1EF0);
  }
});

test('invalid entries, budgets and stale register owners reject without further effects',()=>{
  const spec=roots[0];
  for(const edit of [c=>c.e=1,c=>c.d=1,c=>c.status|=0x20,c=>c.pc++,c=>c.programBank=0x80]) {
    const v=side(spec);edit(v.a.ctx);const before=v.mem.wram.slice();
    assert.throws(()=>new NativeWaitContinuation(v.a,spec.entry),e=>e.reason==='native_wait_entry_required');assert.deepEqual(v.mem.wram,before);
  }
  const v=side(spec),wait=new NativeWaitContinuation(v.a,spec.entry);
  for(const budget of [-1,0.5,NaN,Infinity])assert.throws(()=>wait.run(budget),e=>e.reason==='native_wait_budget_required');
  assert.equal(wait.run(1),WAIT_PAUSED);const before=v.mem.wram.slice();
  for(const key of Object.keys(v.a.ctx)) {const saved=v.a.ctx[key];v.a.ctx[key]^=1;
    assert.throws(()=>wait.run(1),e=>e.reason==='native_wait_owner_required');v.a.ctx[key]=saved;assert.deepEqual(v.mem.wram,before);
  }
  assert.throws(()=>wait.run(1,{beforeInstruction:()=>{throw Error('device failure');}}),/device failure/);
  assert.throws(()=>wait.run(1),e=>e.reason==='native_wait_failed');
});

test('a paused RTL refetches its real stack frame, wraps the return PC, and reset remains nonreturning',()=>{
  const spec=roots[0],v=side(spec),wait=new NativeWaitContinuation(v.a,spec.entry);
  wait.run(1);v.mem.write16(0x1C76,0);wait.run(2);assert.equal(wait.pc,0x81B0AB);
  v.mem.write8(0x1EEE,0xFF);v.mem.write8(0x1EEF,0xFF);v.mem.write8(0x1EF0,0x81);
  assert.equal(wait.run(1),WAIT_RETURNED);assert.equal(wait.result.returnTarget,0x810000);assert.equal(v.a.ctx.s,0x1EF0);
  const input=side(roots[3]);input.mem.write16(0x1CA,0x3030);const reset=new NativeWaitContinuation(input.a,0x809E1A);
  assert.equal(reset.run(7),WAIT_PAUSED);assert.equal(reset.pc,0x809E2F);
  assert.throws(()=>reset.run(1),e=>e.reason==='task_reset_source_required');assert.equal(reset.done,false);
  assert.equal(input.mem.read16(0x1CC),0x3030);assert.equal(input.mem.read16(0x1CE),0x3030);
});
