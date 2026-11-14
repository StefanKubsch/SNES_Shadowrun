import test from 'node:test';
import assert from 'node:assert/strict';
import {taskFEC1Fixture} from './task-native-fec1-fixtures.mjs';
import {ff79Fixture} from './render-ff79-fixtures.mjs';
import {DialogTestMemory,rom} from './task-native-dialog-harness.mjs';
import {textDma} from './main-dma-readback-fixtures.mjs';
import {ScriptInterpreter} from '../src/vm/interpreter.mjs';
import {TaskScheduler,STOP_NATIVE_WAIT,STOP_BUDGET} from '../src/vm/scheduler.mjs';
import {NativeCalls} from '../src/vm/native-call.mjs';
import {NATIVE_POINTERS} from '../src/vm/layout.mjs';
import {ObservedDevices,observationSet} from '../proof/vm/observed-devices.mjs';
import {SPECIAL_NATIVE_CONTINUATIONS} from '../src/vm/special-natives.mjs';
import {GAME_NMI_ROUTINES} from '../src/task/main-game-nmi.mjs';

// The scheduler bridge F4F6/F52F, the special native and F509 run once with
// an infinite and once with a single-unit work budget. Interrupt, device and
// DMA records are synthetic; the busy poll alternates, so every taken NMI
// pauses inside 80:9E0B. The task frame is a minimal explicit F509 owner.
const FRAME=0x180,OUTER=0x1EE0,INNER=0x1EA0;
const nativeId=target=>{for(let x=0;x<0x200;x+=2)if((0x800000|rom[((NATIVE_POINTERS>>>16)&0x1F)<<15|((NATIVE_POINTERS+x)&0x7FFF)]
  |rom[((NATIVE_POINTERS>>>16)&0x1F)<<15|((NATIVE_POINTERS+x+1)&0x7FFF)]<<8)===target)return x;throw Error('native id');};
const cases=[
  {target:0x80FEC1,seed:mem=>{for(const [address,value]of taskFEC1Fixture({cursor:0,occupied:[4,4,4,4]}).data.snapshot().bytes)
    if(address>=0x7E0000&&address<=0x7FFFFF)mem.write8(address,value);}},
  {target:0x80FEC1,seed:mem=>{for(const [address,value]of taskFEC1Fixture({cursor:0,bank:0x80}).data.snapshot().bytes)
    if(address>=0x7E0000&&address<=0x7FFFFF)mem.write8(address,value);}},
  ...[0x80FF79,0x80CDA8,0x80CD9D,0x80D079].map(target=>({target,seed:mem=>{
    for(const [address,value]of ff79Fixture({bank:0x80,flags:[1,1,1,1],last:6,slots:[0,2,4,6],counter:0}).snapshot().bytes)
      if(address>=0x7E0000&&address<=0x7FFFFF)mem.write8(address,value);
    for(const [at,value]of [[0x1D61,2],[0x1DA,0],[0x1DC,2]])mem.write16(at,value);}})),
  // Input wait: the bridge leaves WORD F953 in A as the B0A1 baseline.
  {target:0x80F953,seed:mem=>{mem.write16(0x1C76,0xF950);mem.write16(0x1CA,0);mem.write16(0x1CC,0);}},
  // Spell choice: window F963, menu A6C7 cancelled by the pad word 2000, release FA3E.
  {target:0x80E1CF,pad:0x2000,reach:[0x81ACBD,0x809E1A],seed:mem=>{for(const [address,value]of taskFEC1Fixture({cursor:0}).data.snapshot().bytes)
    if(address>=0x7E0000&&address<=0x7FFFFF)mem.write8(address,value);mem.write16(0x7E3C1C,1);mem.write16(0x7E3C1E,0);
    mem.write16(0x1CA,0);mem.write16(0x1CC,0);}},
  // Dialog 0: portraits, greeting, one second, main menu cancelled by pad 2000, close 92C5.
  {target:0x80936C,pad:0x2000,reach:[0x81ACBD,0x81B0A1,0x809E1A],seed:mem=>{for(const [address,value]of taskFEC1Fixture({cursor:0}).data.snapshot().bytes)
    if(address>=0x7E0000&&address<=0x7FFFFF)mem.write8(address,value);
    for(const [at,value]of [[0,0x40],[2,0],[0x1FD6,0],[0x1CA,0],[0x1CC,0],[0x1DA,0xFFFF]])mem.write16(at,value);mem.write16(0x7E3CA3,0xFFFF);}},
  // Glove choice: BC67, then B0A1/9E1A/BE6D per frame until B; no object (14B0 negative), BCB2 and 9E1A.
  ...[0x808D0B,0x809BC6].map(target=>({target,seed:mem=>{for(const [address,value]of ff79Fixture({bank:0x80,flags:[1,1,1,1],last:6,slots:[0,2,4,6],counter:0}).snapshot().bytes)
    if(address>=0x7E0000&&address<=0x7FFFFF)mem.write8(address,value);
    for(const [at,value]of [[0x14B0,0xFFFF],[0x1DA,0xFFFF],[0x1CA,0],[0x1CC,0],[0x1F62,1],[0xCC2,0]])mem.write16(at,value);}})),
  // Player control: Select opens the group overview ED3C (F963, FE69, FAAC, FD80), F953 waits for B, FA3E.
  {target:0x80E014,reach:[0x81ACBD,0x81ACC9,0x809E1A],seed:mem=>{for(const [address,value]of taskFEC1Fixture({cursor:0}).data.snapshot().bytes)
    if(address>=0x7E0000&&address<=0x7FFFFF)mem.write8(address,value);
    for(const [at,value]of [[0x1CE,0x2000],[0x1CA,0x2000],[0x1CC,0],[0x1D6B,1],[0x1FA8,0],[0xCC2,0],[0x1DA,0xFFFF],[0x1D8,0]])mem.write16(at,value);mem.write16(0x7E2DF0,mem.read16(0x809700));}},
  // Weapon menu: object DP00 with item 08B2 (first 9700 entry), one slot at [F9]+6, menu cancelled by pad 2000.
  {target:0x80F254,pad:0x2000,reach:[0x81ACBD,0x809E1A],seed:mem=>{for(const [address,value]of taskFEC1Fixture({cursor:0}).data.snapshot().bytes)
    if(address>=0x7E0000&&address<=0x7FFFFF)mem.write8(address,value);
    for(const [at,value]of [[0,0x40],[0x150A+0x40,0x08B2],[0x1CA,0],[0x1CC,0]])mem.write16(at,value);mem.write8(0x7E3C07,1);}},
  // Main menu: window F963, menu A6C7 cancelled by pad 2000, release FA3E.
  {target:0x80CE6D,pad:0x2000,reach:[0x81ACBD,0x809E1A],seed:mem=>{for(const [address,value]of taskFEC1Fixture({cursor:0}).data.snapshot().bytes)
    if(address>=0x7E0000&&address<=0x7FFFFF)mem.write8(address,value);for(const at of [0x1CA,0x1CC])mem.write16(at,0);}},
  // Actions 9BA0: option mask DP00 = 80 (one entry), window F963, menu A6A5 cancelled by pad 2000, release FA3E.
  {target:0x809BA0,pad:0x2000,reach:[0x81ACBD,0x809E1A],seed:mem=>{for(const [address,value]of taskFEC1Fixture({cursor:0}).data.snapshot().bytes)
    if(address>=0x7E0000&&address<=0x7FFFFF)mem.write8(address,value);for(const [at,value]of [[0,0x80],[0x1CA,0],[0x1CC,0]])mem.write16(at,value);}},
  // 8E36: one admitted slot 10 next to object 0; 8691 counts 1FD4 to 4 and shows the notice 74BA
  // (F963, FE69, thirty B0A1 frames, F953 until B, FA3E).
  {target:0x808E36,reach:[0x81ACBD,0x81B0A1,0x809E1A],seed:mem=>{for(const [address,value]of taskFEC1Fixture({cursor:0}).data.snapshot().bytes)
    if(address>=0x7E0000&&address<=0x7FFFFF)mem.write8(address,value);
    for(let x=0;x<=0x56;x+=2)mem.write16(0x7E3F28+x,x===0x10?0:0xFFFF);
    for(const [at,value]of [[0,0],[2,0],[0x1458+0x10,0x8000],[0x1FD4,3],[0x1CA,0],[0x1CC,0]])mem.write16(at,value);}},
  // Modal text: selector DP00 through D9B8 into the existing window DP14.
  {target:0x80935B,seed:mem=>{for(const [address,value]of taskFEC1Fixture({cursor:0}).data.snapshot().bytes)
    if(address>=0x7E0000&&address<=0x7FFFFF)mem.write8(address,value);mem.write16(0,4);mem.write16(0x14,2);}},
];
function side(c,{records,io,dma}){
  const mem=new DialogTestMemory(new Uint8Array(0x20000),null,rom.slice());c.seed(mem);
  for(const [at,value]of [[0x6E,0xC152],[0x140,0xFFFF],[0xCD8,1],[0x250,0],[0x252,FRAME],[FRAME,0x8000],[FRAME+2,0x80],
    [FRAME+3,0],[FRAME+7,INNER],[FRAME+9,nativeId(c.target)]])mem.write16(at,value);
  mem.write8(0x70,0x80);
  const vm=new ScriptInterpreter(mem),set=observationSet(c.target,{io,interrupts:records,interruptRoutines:GAME_NMI_ROUTINES,dmaTransfers:dma});
  vm.natives=new NativeCalls(vm,{admitted:[],implementation:()=>null,devices:new ObservedDevices([set])});vm.natives.accessor.trace=[];
  Object.assign(vm,{a:OUTER,x:nativeId(c.target),y:0,s:INNER,d:0x1000,dbr:0x7E,p:0,pc:0xF4F6});return {vm,mem};
}
function deviceValue(io,address,pad=0x8000){const offset=address&65535;
  if(offset===0x4212)return io.findLast(o=>(o.address&65535)===0x4212)?.value===1?0:1;
  return new Map([[0x4210,0x80],[0x4218,pad],[0x213A,0],[0x2134,1]]).get(offset)??0;
}
function observe(c){const records=[],io=[],dma=[];
  for(let attempt=0;;attempt++){assert.ok(attempt<4000);
    const v=side(c,{records,io,dma});
    try{assert.equal(v.vm.natives.call(),false);return {obs:{records,io,dma},v};}
    catch(error){const reason=error?.reason?.replace('native_boundary:','');
      if(reason==='wait_interrupt_observation_required'){const pc=error.details.pc,hits=records.filter(o=>o.pc===pc).length;records.push({pc,nmi:hits>=2});}
      else if(reason==='device_observation_required')io.push({pc:error.details.pc,address:error.address,width:error.details.width,value:deviceValue(io,error.address,c.pad)});
      else if(reason==='text_dma_observation_required')dma.push(textDma(v.mem.read16(0x20E),dma.length));
      else throw error;}
  }
}
const state=vm=>({a:vm.a,x:vm.x,y:vm.y,s:vm.s,d:vm.d,dbr:vm.dbr,p:vm.p,pc:vm.pc});

test('resumable special natives are registered with their own observed equations',()=>{
  assert.deepEqual([...SPECIAL_NATIVE_CONTINUATIONS.keys()],[0x80FEC1,0x80FF79,0x80CDA8,0x80CD9D,0x80CECB,0x80D079,0x80F953,0x80933A,0x80935B,0x80CD43,0x80855E,0x80E1CF,0x80936C,0x809BC6,0x808D0B,0x809BD3,0x809C33,0x809BB9,0x80C724,0x80E014,0x80EA6E,0x80F254,0x80CE6D,0x809BA0,0x808E36]);
});
test('FEC1, FF79, CDA8, CD9D, D079, F953, E1CF, 8D0B, 9BC6, E014, F254, CE6D, 9BA0, 8E36 and modal 935B pause inside the scheduler bridge and resume to F509 and the next opcode',()=>{
  for(const c of cases){
    const {obs,v:r}=observe(c),n=side(c,obs),scheduler=new TaskScheduler(n.vm);
    assert.ok(obs.records.some(o=>o.nmi));
    for(const pc of c.reach??[])assert.ok(obs.records.some(o=>o.pc===pc),`${c.target.toString(16)} reaches ${pc.toString(16)}`);
    n.vm.natives.workBudget=1;assert.equal(n.vm.natives.call(),true);assert.equal(n.vm.pc,0xF52F);
    let pauses=1,busy=0,stop;
    while((stop=scheduler.resume(0))===STOP_NATIVE_WAIT){assert.ok(++pauses<200000);
      const ctx=n.vm.natives.accessor.ctx;if(ctx.programBank===0x80&&ctx.pc>=0x9E0B&&ctx.pc<0x9E18)busy++;
      assert.equal(n.vm.pc,0xF52F);}
    assert.equal(stop,STOP_BUDGET);assert.equal(n.vm.natives.pending,null);assert.equal(n.vm.natives.calls,1);
    assert.ok(busy>0);assert.ok(pauses>obs.records.length);
    assert.deepEqual(state(n.vm),state(r.vm));assert.equal(n.vm.pc,0xF390);
    assert.deepEqual(n.mem.wram,r.mem.wram);assert.deepEqual(n.vm.natives.accessor.trace,r.vm.natives.accessor.trace);
    assert.equal(n.vm.natives.devices.index,1);
  }
});
test('an infinite work budget keeps the synchronous bridge; foreign owners are rejected before any effect',()=>{
  const c=cases[0],{obs,v:r}=observe(c),sync=side(c,obs);
  assert.equal(sync.vm.natives.call(),false);assert.equal(sync.vm.natives.pending,null);assert.deepEqual(sync.mem.wram,r.mem.wram);
  const n=side(c,obs);n.vm.natives.workBudget=1;assert.equal(n.vm.natives.call(),true);n.vm.pc=0xF390;
  assert.throws(()=>new TaskScheduler(n.vm).resume(0),err=>err.reason==='native_pending_owner_required');
  n.vm.pc=0xF52F;n.vm.natives.accessor.ctx.x^=1;const wram=n.mem.wram.slice();
  assert.throws(()=>n.vm.natives.continuePending(),err=>err.reason==='native_boundary:native_call_owner_required');
  assert.deepEqual(n.mem.wram,wram);n.vm.natives.accessor.ctx.x^=1;n.vm.natives.workBudget=Infinity;
  assert.equal(n.vm.natives.continuePending(),false);assert.deepEqual(state(n.vm),state(r.vm));assert.deepEqual(n.mem.wram,r.mem.wram);
});
