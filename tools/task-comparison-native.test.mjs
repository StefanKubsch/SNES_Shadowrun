import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareTaskCompareGates as gates} from '../proof/task/compare-gates.mjs';
import {prepareTaskCarryCompare as carry} from '../proof/task/carry-compare.mjs';
import {prepareTaskCarrySignGates as signs} from '../proof/task/carry-sign-gates.mjs';
import {prepareTaskComplementSignGates as complement} from '../proof/task/complement-sign-gates.mjs';
import {taskFixture} from './task-native-fixtures.mjs';
import {prepared,unchangedFailure,reads} from './task-native-test-support.mjs';
import {createRenderData} from '../src/render/data.mjs';
import {compareGateWordConsequence} from './render-task-compare-gates-source-proof.mjs';
import {carryCompareWordConsequence} from './render-task-carry-compare-source-proof.mjs';
import {carrySignGateWordConsequence} from './render-task-carry-sign-gates-source-proof.mjs';
import {complementSignGateWordConsequence} from './render-task-complement-sign-gates-source-proof.mjs';

const families=[
 [gates,compareGateWordConsequence,[0x80F852,0x80F86E,0x80F88E,0x80F8AA]],
 [carry,carryCompareWordConsequence,[0x80F735,0x80F77A,0x80F7BC,0x80F7FE]],
 [signs,carrySignGateWordConsequence,[0x80F745,0x80F762,0x80F789,0x80F7A5]],
 [complement,complementSignGateWordConsequence,[0x80F7CB,0x80F7E7,0x80F80E,0x80F82B]],
];
for(const [prepare,equation,entries] of families) test(`source equations and native byte plans agree at all boundaries: ${entries[0].toString(16)}`,()=>{
 for(const entry of entries) for(const right of [0,1,127,128,255,256,32767,32768,65535]) for(const left of [0,1,32767,32768,65535]) for(const incomingCarry of [0,1]) {
  const f=taskFixture(entry,{top:right,left,status:0x4C|incomingCarry}),p=prepared(prepare,f);
  const expected=equation({entry,right,left,leftGateWord:left,leftCompareWord:left,incomingCarry});
  assert.equal(p.value,expected.value); assert.equal(p.outputContext.status&1,expected.carry);
  assert.equal(p.outputContext.status&~0x83,f.context.status&~0x83); assert.equal(p.outputContext.s,0x3F2);
  assert.deepEqual(p.byteWrites,[[0x7E03F3,expected.value&255],[0x7E03F4,expected.value>>>8]]);
 }
});
test('original AE equality falls through BEQ+0 and still stores FFFF',()=>{
 const p=prepared(gates,taskFixture(0x80F86E,{top:1,left:1})); assert.equal(p.value,65535); assert.equal(p.compared,true); assert.equal(p.outputContext.status&1,1);
});
test('negative right gate bypass does not require left source and preserves incoming Carry',()=>{
 for(const [prepare,entry,value] of [[gates,0x80F86E,0],[gates,0x80F8AA,65535],[signs,0x80F762,0],[signs,0x80F7A5,0],[complement,0x80F7E7,65535],[complement,0x80F82B,65535]]) {
  const original=taskFixture(entry,{top:0x8000,status:0x41}),data=createRenderData({writeWindows:original.data.snapshot().writeWindows});
  for(const [address,value] of original.data.snapshot().bytes)if(address!==0x7E03F3&&address!==0x7E03F4)data.seed(address,[value]);
  const f={...original,data},p=prepared(prepare,f);
  assert.equal(p.value,value); assert.equal(p.outputContext.status&1,1); assert.ok(!reads(p).includes(0x3F3));
 }
});
test('DEC of zero wraps FFFF before CMP and does not use signed comparison',()=>{
 for(const [prepare,entry,value] of [[carry,0x80F735,65535],[carry,0x80F7FE,65535],[signs,0x80F762,65535],[complement,0x80F82B,0]]) {
  const p=prepared(prepare,taskFixture(entry,{top:0,left:0x7FFF})); assert.equal(p.comparedRight,65535); assert.equal(p.value,value); assert.equal(p.outputContext.status&1,1);
 }
});
test('comparison result replacing pointer is followed by fresh full opcode read',()=>{
 const f=taskFixture(0x80F77A,{s:0x1FD,top:1,left:0}),pAddress=0x80FFFF+4;
 f.data.seed(pAddress,[0x14,0xA5]); const p=prepared(carry,f); assert.equal(p.value,65535); assert.equal(p.opcodeWord,0xA514);
});
test('late missing opcode and last result byte window reject entire compare plan',()=>{
 for(const [prepare,,entries] of families) for(const entry of entries) {
  unchangedFailure(prepare,taskFixture(entry,{seedOpcode:false}),{},'render_source_required');
  unchangedFailure(prepare,taskFixture(entry,{writeWindows:[[0x7E03F3,0x7E03F3]]}),{},'render_write_window_required');
 }
});
