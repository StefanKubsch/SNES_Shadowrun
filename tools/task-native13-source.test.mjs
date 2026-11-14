import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {inspectRom,cpuToOffset} from './rom.mjs';import {proveTaskNative13,native13Anchors} from './task-native13-source.mjs';
const {bytes}=inspectRom(await readFile('Shadowrun (E).smc'));
test('Native58/13: independently renewed whole slot/arguments/bridge/actions/actualRTS/resume, original9BA0/0201/0002',async()=>{
 const proof=await proveTaskNative13(bytes);assert.deepEqual(JSON.parse(await readFile('analysis/render-task-native-opcode-9ba0.json')).proofs,[proof]);
 assert.deepEqual(proof.parts.map(p=>p.proof.entry),['80:F4CB','80:F4F6','80:F52F','80:F509']);
 assert.deepEqual(proof.admitted_targets.map(t=>[t.id,t.target]),[[0x13,'80:9BA0']]);
 assert.equal(proof.admitted_targets[0].proof.minimum_protected_stack_bytes,30);
 assert.equal(proof.global_stack_minimum,null);assert.equal(proof.source_closed_to_dispatch,true);assert.equal(proof.full_task_binding,false);
});
test('Native58/13: original whole-call slot, prefix, target/root/inner-frame, every native prerequisite and metadata highs reject source drift',async()=>{
 for(const address of [0x80F30C,0x80F4CB,0x80F4F6,0x80F506,0x80F52F,0x809BA0,0x809BA5,0x809BAA,0x8099EB,
  0x809B8F,0x809B94,0x809B97,0x80F963,0x80FA3E,0x80A6A5,0x81B0A1,0x809E1A,0x80A617,0x80C46E,
  0x81F130,0x81F007,0x81AD92,0x81A9B2,0x809F49,0x81AF1F,0x80F509,0x80F389,...native13Anchors.flatMap(a=>[a.start,a.start+1])]){
  const changed=Buffer.from(bytes);changed[cpuToOffset(address,bytes.length)]^=1;await assert.rejects(()=>proveTaskNative13(changed));
 }
});
