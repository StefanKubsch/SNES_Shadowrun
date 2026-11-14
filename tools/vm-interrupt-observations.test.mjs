import test from 'node:test';
import assert from 'node:assert/strict';
import {ScriptInterpreter,EXIT_BUDGET} from '../src/vm/interpreter.mjs';
import {NativeCalls} from '../src/vm/native-call.mjs';
import {ObservedDevices,observationSet} from '../proof/vm/observed-devices.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';
import {runTaskNativeInputWaitOpcode,prepareTaskNativeOpcodeF953} from '../proof/task/native-input-wait-opcode.mjs';
import {GAME_NMI_ROUTINES} from '../src/task/main-game-nmi.mjs';
import {finishInterruptObservations,waitForRandomStateChangeWithInterrupts} from '../src/task/main-wait-interrupt.mjs';
import {withInterruptEvents} from '../src/task/observed-native-events.mjs';
import {SPECIAL_NATIVES} from '../src/vm/special-natives.mjs';
import {DialogTestMemory,rom} from './task-native-dialog-harness.mjs';
import {taskFEC1Fixture} from './task-native-fec1-fixtures.mjs';
import {textDma} from './main-dma-readback-fixtures.mjs';
import {showNotice,showNoticeObserved} from '../src/task/native-notice.mjs';
import {releaseNoticeWindows,releaseNoticeWindowsObserved} from '../src/task/native-slot-release.mjs';
import {redrawWindowList,redrawWindowListObserved} from '../src/task/native-window-list-redraw.mjs';
import {releaseGlove,releaseGloveObserved} from '../src/task/native-glove-release.mjs';
import {restoreAllRunners,restoreAllRunnersObserved} from '../src/task/native-runners-restore.mjs';

const freeze=rows=>Object.freeze(rows.map(o=>Object.freeze({...o})));
const counter=(nmi=true)=>[{pc:0x81B0A1,nmi:false},{pc:0x81B0A5,nmi},{pc:0x81B0A9,nmi:false},{pc:0x81B0AB,nmi:false}];
const input=[0x809E1A,0x809E1D,0x809E20,0x809E23,0x809E26,0x809E29,0x809E2C,0x809E2F,0x809E31,0x809E34,0x809E3C].map(pc=>({pc,nmi:false}));
const nmiIo=value=>[{pc:0x00C118,address:0x804210,width:2,value:0x80},
  {pc:0x809E0B,address:0x4212,width:2,value:0},{pc:0x809E13,address:0x4218,width:2,value}];
function vmStart(sets){const mem=new DialogTestMemory(new Uint8Array(0x20000),null,rom),vm=new ScriptInterpreter(mem);
  mem.write16(0x400,0x800);mem.write8(0x402,0x7E);mem.write16(0x1F2,0x1EF0);mem.write16(0x250,0);mem.write16(0x252,0x400);
  mem.wram.set([0x58,0xA3,0,0],0x800);mem.write16(0x6E,0xC152);mem.write8(0x70,0x80);mem.write16(0x140,0xFFFF);mem.write16(0xCD8,1);mem.write16(0x1C76,0xFFFF);
  vm.setContext({a:0x58,x:0x58,y:1,s:0x1800,d:0x400,bank:0x7E,status:0});
  const devices=new ObservedDevices(sets);vm.natives=new NativeCalls(vm,{admitted:[],implementation:()=>null,devices});
  vm.natives.accessor.trace=[];return vm;
}
test('VM Native58/F953 shares explicit NMI/input observations through its original bridge and resume',()=>{
  const interrupts=[...counter(),...input,...counter(),...input],io=[...nmiIo(0),...nmiIo(0x8000)];
  const set=observationSet(0x80F953,{io,interrupts,interruptRoutines:GAME_NMI_ROUTINES}),vm=vmStart([set]),r=vmStart([]),a=r.natives.accessor;
  a.load();a.io=set.io;const events={interrupts:set.interrupts,interruptIndex:0,interruptRoutines:GAME_NMI_ROUTINES};
  runTaskNativeInputWaitOpcode(a,{protectedStackBytes:[0x7E1EF1,0x7E1EF2],interruptEvents:events});finishInterruptObservations(events);a.store();
  assert.equal(vm.run(1),EXIT_BUDGET);assert.deepEqual(vm.context(),r.context());assert.deepEqual(vm.mem.wram,r.mem.wram);
  assert.deepEqual(vm.natives.accessor.trace,a.trace);assert.equal(vm.natives.calls,1);assert.equal(vm.natives.devices.index,1);
  assert.equal(vm.mem.read16(0x1C76),1);assert.equal(vm.mem.read16(0x1CA),0x8000);assert.equal(vm.s,0x1800);assert.equal(vm.d,0x400);
  assert.equal(vm.natives.accessor.io,null);assert.equal(vm.natives.accessor.ioIndex,io.length);
});
test('VM rejects missing or unused interrupt, transfer and legacy writers at the per-Native boundary',()=>{
  const good={io:nmiIo(0x8000),interrupts:[...counter(),...input],interruptRoutines:GAME_NMI_ROUTINES};
  for(const [extra,reason]of [
    [{interrupts:[]},'native_boundary:wait_interrupt_observation_required'],
    [{interrupts:[...good.interrupts,{pc:0x81B0A1,nmi:false}]},'native_boundary:wait_interrupt_observation_unused'],
    [{dmaTransfers:[textDma()]},'native_boundary:text_dma_observation_unused'],
    [{wait:[{pc:0x81B0A5,address:0x7E1C76,width:2,value:123}]},'native_boundary:task_wait_observation_unused'],
    [{input:[{pc:0x809E1A,address:0x8001CA,width:2,value:0}]},'native_boundary:task_input_observation_unused'],
  ]){const vm=vmStart([observationSet(0x80F953,{...good,...extra})]);assert.throws(()=>vm.run(1),e=>e.reason===reason);
    assert.equal(vm.natives.accessor.io,null);assert.equal(vm.natives.calls,0);
  }
  for(const extra of [{dmaTransfers:[textDma()]},{startupInterrupts:true}]){
    const vm=vmStart([observationSet(0x80F953,extra)]);
    assert.throws(()=>vm.run(1),e=>e.reason==='interrupt_observations_required');
    assert.equal(vm.natives.accessor.io,null);
  }
});
test('a suspended observed caller resumes the same cursor and IO stream after its round supplies more occurrences',()=>{
  // Synthetic outer Native only to isolate the adapter contract. Both actual
  // B0A1 calls and their full NMI execute; this is no original F953 round claim.
  const original=SPECIAL_NATIVES.get(0x80F953),seen=[];
  try{
    SPECIAL_NATIVES.set(0x80F953,(a,options)=>{const h=dialogAccess(a),events=withInterruptEvents({},options);
      h.call(0x809489,0x81B0A1,()=>waitForRandomStateChangeWithInterrupts(h,events),true);seen.push(events.interruptIndex);
      h.call(0x8091D4,0x80C1CA,()=>options.round(0x80C1CA));seen.push(events.interruptIndex);
      h.call(0x809489,0x81B0A1,()=>waitForRandomStateChangeWithInterrupts(h,events),true);seen.push(events.interruptIndex);return h.rts();});
    const vm=vmStart([observationSet(0x80F953,{io:nmiIo(0),interrupts:counter(),interruptRoutines:GAME_NMI_ROUTINES})]);
    vm.natives.rounds=entry=>{assert.equal(entry,0xC1CA);assert.equal(vm.natives.accessor.ioIndex,3);
      vm.pc=(vm.pull16()+1)&65535;
      return {io:nmiIo(0x8000),interrupts:freeze(counter())};};
    assert.equal(vm.run(1),EXIT_BUDGET);assert.deepEqual(seen,[4,4,8]);assert.equal(vm.natives.accessor.ioIndex,6);
    assert.equal(vm.mem.read16(0x1C76),1);assert.equal(vm.mem.read16(0x1CA),0x8000);assert.equal(vm.natives.calls,1);
    assert.equal(vm.d,0x400);assert.equal(vm.s,0x1800);
  }finally{SPECIAL_NATIVES.set(0x80F953,original);}
});

function directSide(fixture,entry){const mem=new DialogTestMemory(new Uint8Array(0x20000),null,rom.slice());
  for(const [address,value]of fixture.data.snapshot().bytes){if(address>=0x7E0000&&address<=0x7FFFFF)mem.write8(address,value);
    else mem.rom[((address>>>16)&0x1F)<<15|(address&0x7FFF)]=value;}
  const a=new TaskAccessor({mem,a:fixture.context.a,x:fixture.context.x,y:fixture.context.y,s:fixture.context.s,d:0,dbr:0x80,p:fixture.context.status,pc:entry&65535});
  a.load();a.trace=[];a.io=[];a.observeArithmetic=true;a.devices={write(){}};
  mem.write16(0x6E,0xC152);mem.write8(0x70,0x80);mem.write16(0x140,0xFFFF);mem.write16(0xCD8,1);
  return {a,mem,h:dialogAccess(a)};
}
// Test-only construction of finite synthetic occurrence lists, by restarting
// the same initial state at each explicitly reported missing observation.
// The resulting frozen lists replay verbatim; this is no clock/device model.
function directObservations(fixture,entry,run){const interrupts=[],io=[],dmaTransfers=[];
  for(let attempt=0;attempt<1000;attempt++){const v=directSide(fixture,entry);v.a.io=io;
    const events={interrupts:freeze(interrupts),interruptIndex:0,interruptRoutines:GAME_NMI_ROUTINES,
      dmaTransfers:Object.freeze([...dmaTransfers]),dmaIndex:0,values:freeze([]),waitIndex:0,waitEvents:[],calls:[],inputs:freeze([]),inputIndex:0};
    try{run(v.a,events,false);finishInterruptObservations(events);assert.equal(v.a.ioIndex,io.length);return {v,events,io,dmaTransfers,interrupts};}
    catch(e){
      if(e.reason==='wait_interrupt_observation_required'){assert.equal(e.observationIndex,interrupts.length);
        interrupts.push({pc:e.pc,nmi:[0x81ACAF,0x81ACBD,0x81ACC3,0x81ACC9,0x81B0A5].includes(e.pc)});continue;}
      if(e.reason==='device_observation_required'){assert.equal(e.details.observationIndex,io.length);
        io.push({pc:e.details.pc,address:e.address,width:e.details.width,value:(e.address&65535)===0x2140?v.mem.read8(0x1CE4):0});continue;}
      if(e.reason==='text_dma_observation_required'){assert.equal(e.observationIndex,dmaTransfers.length);dmaTransfers.push(textDma(v.mem.read16(0x20E),dmaTransfers.length));continue;}
      throw e;
    }
  }assert.fail('synthetic observation construction exceeded its diagnostic bound');
}
test('Observed notice, clear and window adapters preserve one live interrupt/DMA cursor across real helpers',()=>{
  for(const [entry,run,observed,occupied]of [[0x80FEC1,showNotice,showNoticeObserved,[]],
    [0x80FF79,releaseNoticeWindows,releaseNoticeWindowsObserved,[0]],
    [0x80CDA8,redrawWindowList,redrawWindowListObserved,[]],
    [0x80CD9D,releaseGlove,releaseGloveObserved,[]],
    [0x80D079,restoreAllRunners,restoreAllRunnersObserved,[]]]){
    const fixture=taskFEC1Fixture({s:0x1EEE,occupied}),r=directObservations(fixture,entry,run),n=directSide(fixture,entry);
    n.a.io=r.io;const shared={interrupts:freeze(r.interrupts),interruptIndex:0,interruptRoutines:GAME_NMI_ROUTINES,dmaTransfers:Object.freeze(r.dmaTransfers),dmaIndex:0};
    const result=observed(n.a,{interruptEvents:shared},false);finishInterruptObservations(shared);
    assert.deepEqual(n.a.ctx,r.v.a.ctx,entry.toString(16));assert.deepEqual(n.mem.wram,r.v.mem.wram,entry.toString(16));assert.deepEqual(n.a.trace,r.v.a.trace);
    assert.equal(result.waitObservationsUsed,0);assert.equal(n.a.ioIndex,r.io.length);assert.ok(shared.interruptIndex>0);
    if(entry===0x80FEC1)assert.ok(shared.dmaIndex>0);
  }
});
test('speculative plans refuse a live interrupt cursor before reading or consuming it',()=>{
  const interruptEvents={interrupts:freeze([{pc:0x81B0A1,nmi:true}]),interruptIndex:0};
  assert.deepEqual(prepareTaskNativeOpcodeF953({interruptEvents}),{handled:false,reason:'task_interrupt_direct_execution_required'});
  assert.equal(interruptEvents.interruptIndex,0);
});
