import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {inspectRom,cpuToOffset} from './rom.mjs';import {proveTaskNative7C} from './task-native-8e36-opcode-source.mjs';
import {native8E36Spec} from './task-native-8e36-spec.mjs';import {task7COpcodeFixture} from './task-native-8e36-opcode-fixtures.mjs';
import {prepareTaskNativeOpcode8E36 as prepare} from '../proof/task/native-8e36-opcode.mjs';
import {prepared,unchangedFailure,commit} from './task-native-test-support.mjs';import {omitBodyBytes as omit,bodyWord as word} from './task-script-body-fixtures.mjs';
const {bytes}=inspectRom(await readFile('Shadowrun (E).smc'));
test('OriginalNative58/7C renews own metadata-highs, nine whole helpers, actual F508 and fresh F509 result-PHA/PC/opcode',async()=>{
 const proof=await proveTaskNative7C(bytes);assert.deepEqual(JSON.parse(await readFile('analysis/render-task-native-opcode-8e36.json')).proofs,[proof]);
 assert.equal(proof.admitted_targets[0].id,0x7C);assert.equal(proof.admitted_targets[0].proof.minimum_protected_stack_bytes,32);
 for(const address of [0x80F30C,0x80F506,0x80F52F,0x80F509,0x808E36,0x8086C4,...native8E36Spec.anchors.map(a=>a.start+1)]){
  const changed=Buffer.from(bytes);changed[cpuToOffset(address,bytes.length)]^=1;await assert.rejects(()=>proveTaskNative7C(changed));
 }
 const f=task7COpcodeFixture({flags:0xA000}),p=commit(prepare,f);assert.equal(p.arguments.wordPops,2);assert.equal(p.arguments.metadataWord,0x0502);
 assert.equal(p.metadataWord,2);assert.equal(p.resultPushed,true);assert.equal(p.calleeReturnWord,0xF508);assert.equal(p.calleeReturnTarget,0x80F509);
 assert.equal(p.tablePointerWord,0x8E36);assert.equal(p.dispatchPointerWord,0x8E36);assert.equal(p.outputContext.pc,0xF390);assert.equal(p.outputContext.x,0x14);
 assert.equal(p.outputContext.s,0x3F2);assert.equal(word(f.data,0x3F3),0x56);assert.equal(p.callee.visits,44);assert.equal(p.observationsUsed,3);
});
test('Native7C bridge rejects missing originalHighs, protected return/window aliases and exhausted cumulative native work/output',()=>{
 const f=task7COpcodeFixture({flags:0xA000}),p=prepared(prepare,f);
 for(const a of native8E36Spec.anchors)unchangedFailure(prepare,omit(f,a.start+1),{},'render_source_required');
 prepared(prepare,{...f,maxWork:p.work,maxOutputBytes:p.outputBytes});unchangedFailure(prepare,f,{maxWork:p.work-1},'task_work_budget_required');
 unchangedFailure(prepare,f,{maxOutputBytes:p.outputBytes-1},'task_output_budget_required');
 unchangedFailure(prepare,f,{protectedStackBytes:[...f.protectedStackBytes,0x7E4002]},'task_stack_alias_required');
 unchangedFailure(prepare,f,{protectedStackBytes:[0x7E0800,0x7E0801]},'task_outer_return_required');
});
