import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareTaskMultiplyUnsigned as mulU} from '../proof/task/multiply-unsigned.mjs';
import {prepareTaskMultiplySU as mulSU} from '../proof/task/multiply-su.mjs';
import {prepareTaskMultiplyUS as mulUS} from '../proof/task/multiply-us.mjs';
import {prepareTaskMultiplySS as mulSS} from '../proof/task/multiply-ss.mjs';
import {prepareTaskDivideUnsigned as divU} from '../proof/task/divide-unsigned.mjs';
import {prepareTaskDivideSU as divSU} from '../proof/task/divide-su.mjs';
import {prepareTaskDivideUS as divUS} from '../proof/task/divide-us.mjs';
import {taskArithmeticFixture as fixture,arithmeticObservations} from './task-arithmetic-native-fixtures.mjs';
import {prepared,commit,unchangedFailure} from './task-native-test-support.mjs';

const multiply=[[mulU,0x80F581],[mulSU,0x80F546],[mulUS,0x80F556],[mulSS,0x80F566]];
const divide=[[divU,0x80F609],[divSU,0x80F5CC],[divUS,0x80F5DE]],all=[...multiply,...divide];
const remaining=p=>p.byteWrites.filter(([a])=>a===0x7E03F3||a===0x7E03F4).reduce((v,[a,b])=>v|(b<<((a-0x7E03F3)*8)),0);
test('multiply records original five operands including XBA rightHigh and independent observed bytes',()=>{
 const f=fixture(0x80F581),p=commit(mulU,f);
 assert.deepEqual(p.ioRequests.filter(r=>r.kind==='write').map(r=>[r.pc,r.address,r.width,r.value]),[
  [0x80F588,0x804202,1,0x78],[0x80F58D,0x804203,1,0x12],[0x80F599,0x804203,1,0x34],
  [0x80F59E,0x804202,1,0x12],[0x80F5B2,0x804203,1,0x56]]);
 assert.deepEqual(p.ioRequests.filter(r=>r.kind==='read').map(({pc,address,width,value})=>({pc,address,width,value})),f.ioObservations);
 assert.equal(remaining(p),0xE034); assert.equal(p.outputContext.status&0x41,0x40);
 assert.equal(p.outputContext.s,0x3F2); assert.equal(p.outputContext.y,5); assert.equal(p.observationsUsed,4);
 assert.ok(p.ioRequests.every(Object.isFrozen)); assert.ok(Object.isFrozen(p.ioRequests));
});
test('all multiply sign combinations normalize before common reads and negate only count1',()=>{
 for(const [prepare,entry] of multiply)for(const left of [0,1,0x7FFF,0x8000,0xFFFF])for(const top of [0,1,0x7FFF,0x8000,0xFFFF]) {
  const f=fixture(entry,{left,top}),p=prepared(prepare,f);
  const count=Number((entry===0x80F546||entry===0x80F566)&&left>=32768)+Number((entry===0x80F556||entry===0x80F566)&&top>=32768);
  assert.equal(p.signCount,count); assert.equal(p.negated,count===1);
  assert.equal(remaining(p),count===1?0x1FCC:0xE034); assert.equal(p.outputContext.status&0x41,0x40);
 }
});
test('multiply ADC reads its scratch alias after resultLow store, second CLC discards first Carry',()=>{
 const f=fixture(0x80F581,{s:0x1E7}),p=prepared(mulU,f);
 assert.equal(p.accesses.find(r=>r.label==='fresh-scratch-first-ADC').value,0x34);
 assert.equal(p.accesses.find(r=>r.label==='fresh-scratch-second-ADC').value,0x8A);
 assert.equal(p.outputContext.status&0x41,1); assert.equal(p.byteWrites.find(([a])=>a===0x7E01EB)[1],2);
 const g=fixture(0x80F581);g.ioObservations=arithmeticObservations(g.entry,0x80,[255,0,1,255]);
 assert.equal(prepared(mulU,g).outputContext.status&0x41,0);
});
test('discarded BYTE PLA is still fresh and required while XBA uses latched rightHigh',()=>{
 const f=fixture(0x80F581,{s:0x1E8});f.ioObservations=arithmeticObservations(f.entry,0x80,[0xA1,0x34,0x56,0x78]);
 const p=prepared(mulU,f);
 assert.equal(p.accesses.find(r=>r.label==='discarded-right-high-PLA').value,0xF7);
 assert.equal(p.ioRequests.find(r=>r.pc===0x80F59E).value,0x12);
});
test('division uses fresh full scratch scaling, ordered mixed-width observations and original requests',()=>{
 const f=fixture(0x80F609),p=commit(divU,f);
 assert.equal(p.shifts,5);assert.equal(p.scaledDivisor,0x91);assert.equal(remaining(p),0x1234);assert.equal(p.corrected,false);
 assert.deepEqual(p.ioRequests.filter(r=>r.kind==='write').map(r=>[r.pc,r.address,r.width,r.value]),[
  [0x80F632,0x804204,2,0x2B3],[0x80F63A,0x804206,1,0x91],[0x80F64F,0x804204,1,0],
  [0x80F655,0x804205,1,0x56],[0x80F65B,0x804206,1,0]]);
 assert.deepEqual(p.ioRequests.filter(r=>r.kind==='read').map(({pc,address,width,value})=>({pc,address,width,value})),f.ioObservations);
 assert.equal(p.outputContext.status&0x41,0x41);assert.equal(p.outputContext.s,0x3F2);
});
test('division covers zero divisor and all 0..8 register halving counts without inferred quotient',()=>{
 for(const top of [0,1,255,256,511,512,1024,2048,4096,8192,16384,32768,65535]) {
  const f=fixture(0x80F609,{top,left:0xBEEF}),p=prepared(divU,f);
  let shifts=0;while((top>>>shifts)>=256)shifts++;
  assert.equal(p.shifts,shifts);assert.equal(p.scaledDivisor,top>>>shifts);assert.equal(remaining(p),0x1234);
  assert.equal(p.ioRequests.find(r=>r.pc===0x80F63A).value,top>>>shifts);
 }
});
test('division scratch dividend store may replace right WORD before actual PLA',()=>{
 const f=fixture(0x80F609,{s:0x1E9}),p=prepared(divU,f);
 assert.equal(p.accesses.find(r=>r.label==='fresh-right-PLA-low').value,0x78);
 assert.equal(p.accesses.find(r=>r.label==='fresh-right-PLA-high').value,0x56);
 assert.equal(p.shifts,7);assert.equal(p.scaledDivisor,0xAC);
});
test('division correction, zero CMP equality and optional sign correction preserve Carry and V/decimal',()=>{
 for(const [prepare,entry] of divide)for(const left of [1,0x8000,0xFFFF])for(const top of [1,0x8000,0xFFFF])for(const observed of [0,0x1234,65535]) {
  const f=fixture(entry,{left,top,status:0x4D});f.ioObservations=arithmeticObservations(entry,0x80,[0x34,0x12,0x56,observed]);
  const p=prepared(prepare,f),count=Number(entry===0x80F5CC&&left>=32768)+Number(entry===0x80F5DE&&top>=32768);
  const corrected=observed<0x1234,value=corrected?0x1233:0x1234;
  assert.equal(p.signCount,count);assert.equal(p.corrected,corrected);assert.equal(remaining(p),count===1?(-value)&65535:value);
  assert.equal(p.outputContext.status&0x49,0x48|Number(!corrected));
 }
 const f=fixture(0x80F609);f.ioObservations=arithmeticObservations(f.entry,0x80,[0,0,0,0]);assert.equal(remaining(prepared(divU,f)),0);
});
test('division sign prefix changes register only; no normalized operand store',()=>{
 for(const [prepare,entry,patch] of [[divSU,0x80F5CC,{left:0xFFFF}],[divUS,0x80F5DE,{top:0xFFFF}]]) {
  const p=prepared(prepare,fixture(entry,patch));assert.equal(p.signCount,1);
  assert.ok(!p.accesses.some(r=>r.kind==='write'&&r.label==='sign-magnitude'));
 }
});
test('missing/mutable/mismatched/extra observations and wrong MMIO mode are all no-effect',()=>{
 for(const [prepare,entry] of all) {
  const f=fixture(entry),records=f.ioObservations;
  unchangedFailure(prepare,f,{ioMode:null},'task_io_mode_required');
  unchangedFailure(prepare,f,{ioObservations:null},'task_io_observation_required');
  unchangedFailure(prepare,f,{ioObservations:[...records]},'task_io_observations_required');
  unchangedFailure(prepare,f,{ioObservations:Object.freeze(records.map(r=>({...r})))},'task_io_observations_required');
  unchangedFailure(prepare,f,{ioObservations:Object.freeze(records.slice(0,-1))},'task_io_observation_required');
  for(const patch of [{pc:0},{address:0x004216},{width:2,value:0x1000}]) {
   const bad=Object.freeze([Object.freeze({...records[0],...patch}),...records.slice(1)]);
   unchangedFailure(prepare,f,{ioObservations:bad},patch.pc===0?'task_io_observations_required':'task_io_observation_required');
  }
  unchangedFailure(prepare,f,{ioObservations:Object.freeze([...records,records[0]])},'task_io_observation_unused');
 }
});
test('BYTE multiplication requires binary arithmetic and rejects every decimal-entry variant atomically',()=>{
 for(const [prepare,entry] of multiply){const f=fixture(entry,{status:0x4D,top:0xFFFF,left:0xFFFF});unchangedFailure(prepare,f,{},'task_binary_arithmetic_required');}
});
test('ordinary WRAM arithmetic registers are physical provider bytes with no MMIO inference',()=>{
 for(const [prepare,entry] of all) {
  const f=fixture(entry,{bank:0x7E,writeWindows:[[0x7E0000,0x7EFFFF]]});
  f.ioObservations=Object.freeze([]); f.data.seed(0x7E4214,[0x34,0x12,0x56,0x78]);
  const p=prepared(prepare,f); assert.equal(p.ioRequests.length,0);assert.equal(p.observationsUsed,0);
  assert.ok(p.accesses.some(r=>r.kind==='write'&&r.address>=0x7E4202&&r.address<=0x7E4206));
  unchangedFailure(prepare,f,{ioObservations:arithmeticObservations(entry,0x7E)},'task_io_observation_unused');
 }
});
test('actual DBR00 and 81 preserve distinct observed register addresses',()=>{
 for(const bank of [0,0x81])for(const [prepare,entry] of all) {
  const f=fixture(entry,{bank}),p=prepared(prepare,f);assert.ok(p.ioRequests.every(r=>(r.address>>>16)===bank));
 }
});
test('late missing source and last writable byte hold all requests and byte writes back',()=>{
 for(const [prepare,entry] of all) {
  unchangedFailure(prepare,fixture(entry,{seedOpcode:false}),{},'render_source_required');
  const f=fixture(entry,{writeWindows:[[0x7E0000,0x7E03F3]]});unchangedFailure(prepare,f,{},'render_write_window_required');
  const p=prepared(prepare,fixture(entry));
  unchangedFailure(prepare,fixture(entry),{maxOutputBytes:p.outputBytes-1},'task_output_budget_required');
 }
});
test('original division scratch overlapping protected outer stack is rejected',()=>{
 for(const [prepare,entry] of divide)unchangedFailure(prepare,fixture(entry,{savedOuterS:0x1EF}),{},'task_stack_alias_required');
});
test('invalid observation values and sparse lists never produce requests or effects',()=>{
 for(const [prepare,entry] of all) {
  const f=fixture(entry),records=f.ioObservations;
  for(const value of [-1,256,NaN,1.5])unchangedFailure(prepare,f,{ioObservations:Object.freeze([Object.freeze({...records[0],value}),...records.slice(1)])},'task_io_observations_required');
  unchangedFailure(prepare,f,{ioObservations:Object.freeze(new Array(4))},'task_io_observations_required');
 }
});
