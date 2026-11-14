import test from 'node:test';
import assert from 'node:assert/strict';
import {mainLoopWindow} from './main-loop-motion-source.mjs';
import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {rom, decodeWindows} from './task-native-dialog-harness.mjs';
import {runReference} from './w65c816-reference.mjs';
import {VmMemory} from '../src/vm/memory.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';
import {MAIN_LOOP_RESUME, MAIN_LOOP_ROUND, runMainLoop,MainLoopContinuation} from '../src/vm/main-loop.mjs';
import {WAIT_PAUSED,WAIT_RETURNED} from '../src/task/native-wait-continuation.mjs';
import {waitForRandomStateChangeWithInterrupts,readInputWithInterrupts,finishInterruptObservations} from '../src/task/main-wait-interrupt.mjs';
import {GAME_NMI_ROUTINES} from '../src/task/main-game-nmi.mjs';
import { processSceneRequestReference } from '../proof/game-reference/scene-request.mjs';

const map = decodeWindows([mainLoopWindow]);
const calls = [...map.values()].filter(i => ['JSR', 'JSL'].includes(i.mnemonic) && i.cpu !== 0x8096C0);
function side(caseId) {
  const mem = new VmMemory(rom, new Uint8Array(0x20000));
  mem.write16(0x1FDA, caseId === 3 ? 1 : 0); mem.write16(0x1FD8, caseId === 4 ? 1 : 0);
  const vm = {mem, a: 0xFEDC, x: 7, y: 13, s: 0x1EF0, d: 0, dbr: 0x80, p: 0x40, pc: MAIN_LOOP_RESUME};
  const a = new TaskAccessor(vm); a.load(); const h = dialogAccess(a), log = [];
  const routines = new Map(calls.map(i => [i.target, () => {
    log.push([i.target, a.ctx.pc, a.ctx.programBank, a.ctx.s, a.readWord(a.ctx.s + 1, 16)]);
    h.load(i.target & 0xFFFF); h.dpWrite(0x30, a.ctx.a); h.index('x', a.ctx.x + 2);
    a.ctx.status = (a.ctx.status & ~1) | Number(caseId === 1 && i.target === 0x808000 || caseId === 2 && i.target === 0x80CC4B);
    return {rawReturnWord: i.mnemonic === 'JSL' ? h.rtl() : h.rts()};
  }]));
  return {mem, a, log, routines};
}

test('main loop matches pinned original call frames, carry shortcuts and both exit words', () => {
  assertPinnedTaskSource(map, [mainLoopWindow]);
  for (let caseId = 0; caseId < 5; caseId++) {
    const n = side(caseId), r = side(caseId);
    if (caseId < 3) assert.equal(runMainLoop(n.a, null, n.routines), MAIN_LOOP_ROUND);
    else assert.throws(() => runMainLoop(n.a, null, n.routines), e => e.taskBoundary && e.reason === 'main_loop_exit' && e.pc === (caseId === 3 ? 0x96EC : 0x96F2));
    const stop = new Error('end of bounded interval');
    const boundary = caseId === 3 ? 0x8096EC : caseId === 4 ? 0x8096F2 : 0x8096C0;
    assert.throws(() => runReference(map, r.mem, r.a.ctx, {entry: 0x8096C3,
      calls: r.routines, before: new Map([[boundary, () => {throw stop;}]])}), e => e === stop);
    // PC at the successful boundary is assigned by runMainLoop; taskStop intentionally leaves the
    // last returned PC intact at exits. Everything else must match before the next original opcode.
    for (const key of ['a', 'x', 'y', 's', 'd', 'bank', 'programBank', 'status']) assert.equal(n.a.ctx[key], r.a.ctx[key], `${key} case ${caseId}`);
    assert.deepEqual(n.log, r.log); assert.deepEqual(n.mem.wram, r.mem.wram);
  }
});

test('main loop rejects an invalid entry or changed return widths and names a missing routine', () => {
  const n = side(0);
  assert.throws(() => runMainLoop(n.a, null, new Map()), e => e.taskBoundary && e.reason === 'main_loop_frontier' && e.target === 0x808000);
  n.a.ctx.pc = 0x96C2;
  assert.throws(() => runMainLoop(n.a), e => e.reason === 'main_loop_entry_required');
  n.a.ctx.pc = MAIN_LOOP_RESUME;
  n.a.ctx.status |= 8;
  const before = n.mem.wram.slice();
  assert.throws(() => runMainLoop(n.a, null, n.routines), e => e.reason === 'main_loop_entry_required');
  assert.deepEqual(n.mem.wram, before); assert.deepEqual(n.log, []);
  n.a.ctx.status &= ~8;
  n.routines.set(0x808000, () => {n.a.ctx.status |= 0x20; dialogAccess(n.a).rts();});
  assert.throws(() => runMainLoop(n.a, null, n.routines), e => e.reason === 'main_loop_return_width_required' && e.target === 0x808000);
});

test('main continuation retains the real JSL frame through counter pauses and matches both carry shortcuts and owner exits',()=>{
  for(let caseId=0;caseId<5;caseId++){
    const n=side(caseId),r=side(caseId);
    const events=()=>({interrupts:Object.freeze([
      ...[[0x81B0A1,false],[0x81B0A5,false],[0x81B0A9,false],[0x81B0A5,true],[0x81B0A9,false],[0x81B0AB,false]],
      ...[0x809E1A,0x809E1D,0x809E20,0x809E23,0x809E26,0x809E29,0x809E2C,0x809E2F,0x809E31,0x809E34,0x809E3C].map(pc=>[pc,false]),
    ].map(([pc,nmi])=>Object.freeze({pc,nmi}))),interruptIndex:0,interruptRoutines:GAME_NMI_ROUTINES});
    for(const v of [n,r]){
      if(caseId===0){v.mem.write16(0x1CE9,0xFFFF);v.routines.set(0x80CC4B,processSceneRequestReference);}
      for(const [at,value]of [[0x6E,0xC152],[0x1C76,0xFFFF],[0x140,0xFFFF],[0xCD8,1]])v.mem.write16(at,value);
      v.mem.write8(0x70,0x80);
      v.a.io=[{pc:0x00C118,address:0x804210,width:2,value:0xAB80},
        {pc:0x809E0B,address:0x4212,width:2,value:1},{pc:0x809E0B,address:0x4212,width:2,value:0},
        {pc:0x809E13,address:0x4218,width:2,value:0x8100}];v.a.devices={write(){}};
      v.routines.set(0x81B0A1,waitForRandomStateChangeWithInterrupts);v.routines.set(0x809E1A,readInputWithInterrupts);
      // The real outer owner's frame is below every helper and survives pauses.
      dialogAccess(v.a).push(0xA156,2);
    }
    const ne=events(),re=events(),continuation=new MainLoopContinuation(n.a,{events:ne,routines:n.routines,returnToOwner:true});
    const before=n.mem.wram.slice();assert.equal(continuation.run(0),WAIT_PAUSED);assert.deepEqual(n.mem.wram,before);
    const expected=runMainLoop(r.a,re,r.routines,true);let pauses=0;
    while(continuation.run(1)===WAIT_PAUSED){assert.ok(++pauses<300);
      if(continuation.wait?.pc===0x81B0A5){assert.equal(n.a.ctx.s,0x1EEB);assert.equal(n.a.readWord(0x1EEC,16),0x96AE);assert.equal(n.a.read(0x1EEE),0x80);}
    }
    assert.equal(continuation.result,expected);assert.deepEqual(n.a.ctx,r.a.ctx);assert.deepEqual(n.mem.wram,r.mem.wram);assert.deepEqual(n.log,r.log);
    assert.equal(ne.interruptIndex,re.interruptIndex);assert.equal(n.a.ioIndex,r.a.ioIndex);
    if(caseId<3){finishInterruptObservations(ne);finishInterruptObservations(re);assert.equal(n.mem.read16(0x1C76),0);assert.equal(n.mem.read16(0x1CA),0x8100);}
    const after=n.mem.wram.slice();assert.equal(continuation.run(100),WAIT_RETURNED);assert.deepEqual(n.mem.wram,after);
  }
});

test('main continuation rejects stale ownership and never restarts a failed callee',()=>{
  const v=side(0),c=new MainLoopContinuation(v.a,{routines:v.routines});
  for(const budget of [-1,0.5,Infinity])assert.throws(()=>c.run(budget),e=>e.reason==='main_continuation_budget_required');
  assert.equal(c.run(1),WAIT_PAUSED);const before=v.mem.wram.slice();v.a.ctx.s--;
  assert.throws(()=>c.run(1),e=>e.reason==='main_continuation_owner_required');assert.deepEqual(v.mem.wram,before);v.a.ctx.s++;
  v.routines.set(0x80CC4B,()=>{throw Error('callee failed');});
  assert.throws(()=>c.run(1),/callee failed/);const failed=v.mem.wram.slice();
  assert.throws(()=>c.run(1),e=>e.reason==='main_continuation_failed');assert.deepEqual(v.mem.wram,failed);
});
