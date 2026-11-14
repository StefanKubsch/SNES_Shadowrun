import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {prepareTaskNativeArguments as prepare} from '../proof/task/native-arguments.mjs';
import {taskPrefixFixture as fixture} from './task-prefix-native-fixtures.mjs';import {prepared,unchangedFailure} from './task-native-test-support.mjs';
import {inspectRom,cpuToOffset} from './rom.mjs';import {decodeTaskWindows} from './task-partial-source.mjs';
import {spec,prove} from './render-task-native-arguments-source-proof.mjs';
test('Native58 fullWORD operand/high thenLow ID and complete metadataHigh before prefix stores',()=>{
 const f=fixture(0x80F4CB),p=prepared(prepare,f);assert.equal(p.operandWord,0xAA02);assert.equal(p.id,2);assert.equal(p.wordPops,0);
 assert.equal(p.outputContext.pc,0xF4F6);assert.equal(p.outputContext.a,0x6FF);assert.equal(p.outputContext.x,4);assert.equal(p.outputContext.y,5);
 assert.equal(p.stackMigrationExecuted,false);assert.ok(p.readAddresses.includes(0x82DA4F));assert.equal(p.outputContext.status&1,0);
});
test('Native58 metadataLow1 consumes one WORD; no script52 half-count interpretation',()=>{
 const f=fixture(0x80F4CB);f.data.seed(0x82DA4E,[1,0xAB]);const p=prepared(prepare,f);
 assert.equal(p.wordPops,1);assert.equal(p.outputContext.s,0x3F2);assert.equal(p.outputContext.y,0);
});
test('Native58 workspace can overwrite saved ID; final ASL uses full fresh ID and actual Carry',()=>{
 const f=fixture(0x80F4CB,{d:0});f.data.seed(0x82DA4E,[5,0]);
 for(let n=0;n<5;n++)f.data.seed(0x3F1+n*2,[n+1,n===4?0x80:0]);
 const p=prepared(prepare,f);assert.equal(p.wordPops,5);assert.equal(p.freshId,0x80);assert.equal(p.outputContext.x,0x100);assert.equal(p.outputContext.status&1,0);
});
test('Native58 every allowed metadataCount runs its full declared number with cumulative budgets',()=>{
 for(const count of [0,1,2,3,127,128,255]){
  const f=fixture(0x80F4CB,{s:0x300,savedOuterS:0x900});f.data.seed(0x82DA4E,[count,0xCD]);
  for(let n=0;n<count;n++)f.data.seed(0x301+n*2,[n&255,(n+1)&255]);
  const p=prepared(prepare,{...f,maxOutputBytes:2048});assert.equal(p.wordPops,count);assert.equal(p.outputContext.s,0x300+2*count);
  unchangedFailure(prepare,f,{maxWork:p.work-1,maxOutputBytes:2048},'task_work_budget_required');
 }
});
test('Native58 late missing outerSHigh and protected argument alias hold all workspace effects',()=>{
 const f=fixture(0x80F4CB);f.data.seed(0x82DA4E,[1,0]);unchangedFailure(prepare,f,{protectedStackBytes:[0x7E03F1,0x7E03F2]},'task_stack_alias_required');
 unchangedFailure(prepare,f,{maxOutputBytes:5},'task_output_budget_required');
});
test('Native58 prefix exact byte/mode/edge pins reject every missing or mutated instruction',async()=>{
 const {bytes}=inspectRom(await readFile('Shadowrun (E).smc')),{map}=decodeTaskWindows(bytes,spec.windows);
 for(const [pc,i] of map){const missing=new Map(map);missing.delete(pc);assert.throws(()=>prove(missing));
  for(const patch of [{value:i.value^1},{state:{...i.state,m:1}},{next:i.next+1}]){const bad=new Map(map);bad.set(pc,{...i,...patch});assert.throws(()=>prove(bad));}}
 const report=JSON.parse(await readFile('analysis/render-task-native-arguments.json'));assert.deepEqual(report.proofs,prove(map));
 const slot=cpuToOffset(0x80F2B4+0x58,bytes.length);assert.equal(bytes.readUInt16LE(slot),0xF4CB);
});
