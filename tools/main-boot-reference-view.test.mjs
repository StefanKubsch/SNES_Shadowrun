import test from 'node:test';
import assert from 'node:assert/strict';
import {bootReferenceView} from './main-boot-reference-view.mjs';
import {DialogTestMemory} from './task-native-dialog-harness.mjs';
import {taskOpcodeFixture} from './task-opcode-fixtures.mjs';
import {prepareTaskOpcodeSequence,runTaskOpcodeSequence} from '../proof/task/opcode-sequence.mjs';

function fixture(){
  const f=taskOpcodeFixture();f.data.seed(0x801204,[0x86,0xBA,0x5C,0xBE,0x14,0xA5]);
  const mem=new DialogTestMemory(new Uint8Array(0x20000));
  for(const [address,value]of f.data.snapshot().bytes){
    if(address>=0x7E0000&&address<=0x7FFFFF)mem.write8(address,value);
    else assert.equal(mem.read8(address),value,'fixture uses original ROM');
  }
  return {f:{...f,maxHandlers:5},mem};
}
test('typed boot view matches the existing five-handler source plan, including fresh aliases, flags and exact budgets',()=>{
  const {f,mem}=fixture(),expected=prepareTaskOpcodeSequence(f);assert.equal(expected.handled,true);
  const before=mem.wram.slice(),view=bootReferenceView(mem,f);
  const actual=view.finish(runTaskOpcodeSequence(view.accessor,{maxHandlers:5}));
  assert.deepEqual(actual.outputContext,expected.outputContext);assert.equal(actual.work,expected.work);
  assert.equal(actual.outputBytes,expected.outputBytes);
  assert.deepEqual(actual.accesses,expected.accesses.filter(a=>a.kind==='write').map(({kind,address,value})=>({kind,address,value})));
  assert.deepEqual(mem.wram,before);
  // A later visit always starts from the caller's current full WRAM, rather
  // than the prior private view or a cached pointer/task field.
  mem.write8(0x100,0x5A);assert.equal(bootReferenceView(mem,f).accessor.read(0x800100),0x5A);
});
test('late budget, stack-owner, SRAM and device boundaries leave the source memory untouched',()=>{
  const {f,mem}=fixture(),p=prepareTaskOpcodeSequence(f),before=mem.wram.slice();
  const firstWrite=p.accesses.find(a=>a.kind==='write').address;
  for(const [patch,reason]of [[{maxWork:p.work-1},'task_work_budget_required'],
    [{maxOutputBytes:p.outputBytes-1},'task_output_budget_required'],
    [{protectedStackBytes:[...f.protectedStackBytes,firstWrite<0x2000?0x7E0000+firstWrite:firstWrite]},'task_stack_alias_required']]){
    const view=bootReferenceView(mem,{...f,...patch});
    assert.throws(()=>runTaskOpcodeSequence(view.accessor,{maxHandlers:5}),e=>e.taskBoundary&&e.reason===reason);
    assert.deepEqual(mem.wram,before);
  }
  const {accessor:a}=bootReferenceView(mem,f);a.write(0x100,0xAB);
  for(const address of [0x701FFC,0x804210])assert.throws(()=>a.read(address),e=>e.reason==='render_address_required');
  assert.throws(()=>a.read(0x701FFD),e=>e.reason==='boot_camera_sram_required');
  assert.throws(()=>a.read(0x100,'outer',true),e=>e.reason==='task_outer_return_required');
  assert.deepEqual(mem.wram,before);
});
test('only the proved DEC7 camera WORD is read from fresh supplied SRAM, with no SRAM writes or alias widening',()=>{
  const {f,mem}=fixture();mem.sram=new Uint8Array(0x2000);mem.sram.set([0x34,0x12],0x1FFD);
  const v=bootReferenceView(mem,f);assert.equal(v.accessor.readWord(0x701FFD),0x1234);
  mem.sram[0x1FFD]=0x56;assert.equal(v.accessor.readWord(0x701FFD),0x1234);
  assert.equal(v.memory.sram,undefined);
  assert.equal(bootReferenceView(v.memory,f).accessor.readWord(0x701FFD),0x1234);
  assert.equal(bootReferenceView(mem,f).accessor.readWord(0x701FFD),0x1256);
  for(const address of [0x701FFC,0x701FFF,0xF01FFD])assert.throws(()=>v.accessor.read(address),e=>e.reason==='render_address_required');
  assert.throws(()=>v.accessor.write(0x701FFD,0),e=>e.reason==='render_address_required');
  assert.equal(mem.sram[0x1FFD],0x56);assert.equal(v.finish({}).cameraReads,4);
});
test('a nested visit publishes only into its guarded parent and a later failure never changes the live owner',()=>{
  const {f,mem}=fixture(),before=mem.wram.slice(),parent=bootReferenceView(mem,f);
  parent.accessor.write(0x100,0xA5);
  const child=bootReferenceView(parent.memory,f);assert.equal(child.accessor.read(0x100),0xA5);
  child.accessor.write(0x101,0x5A);assert.equal(parent.accessor.read(0x101),before[0x101]);
  for(const write of child.finish({}).accesses)parent.memory.write8(write.address,write.value);
  assert.equal(parent.accessor.readWord(0x100),0x5AA5);assert.deepEqual(mem.wram,before);
  // The nested memory API retains the parent's budget, protected stack and
  // SRAM boundaries, even if a child has a looser local protection list.
  const protectedAddress=f.protectedStackBytes[0];
  assert.throws(()=>parent.memory.write8(protectedAddress,0),e=>e.reason==='task_stack_alias_required');
  assert.throws(()=>parent.memory.read8(0x701FFC),e=>e.reason==='render_address_required');
  const limited=bootReferenceView(mem,{...f,maxOutputBytes:1});limited.memory.write8(0x100,1);
  assert.throws(()=>limited.memory.write8(0x101,2),e=>e.reason==='task_output_budget_required');
  assert.deepEqual(mem.wram,before);
});
