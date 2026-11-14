import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {inspectRom,cpuToOffset} from './rom.mjs';import {proveTaskNativeC8,nativeC8Anchors} from './task-native-c8-source.mjs';
const {bytes}=inspectRom(await readFile('Shadowrun (E).smc'));
test('Native58/C8: independently renewed original slot/arguments/bridge/wholeFEC1/actualRTS/resume and original anchors',async()=>{
 const proof=await proveTaskNativeC8(bytes);assert.deepEqual(JSON.parse(await readFile('analysis/render-task-native-opcode-fec1.json')).proofs,[proof]);
 assert.deepEqual(proof.parts.map(p=>p.proof.entry),['80:F4CB','80:F4F6','80:F52F','80:F509']);
 assert.deepEqual(proof.admitted_targets.map(t=>[t.id,t.target]),[[0xC8,'80:FEC1']]);assert.equal(proof.admitted_targets[0].proof.minimum_protected_stack_bytes,32);
 assert.equal(proof.global_stack_minimum,null);assert.equal(proof.source_closed_to_dispatch,true);assert.equal(proof.full_task_binding,false);
});
test('Native58/C8: mutated original slot/prefix/bridge/indirect/innerreturn/modejoin/resume/anchor bytes reject source',async()=>{
 for(const address of [0x80F30C,0x80F4CB,0x80F4F6,0x80F506,0x80F52F,0x80FEC1,0x80FED3,0x80FF04,0x80FF13,
  0x80FC36,0x80FC5F,0x81AF1F,0x80F509,0x80F389,...nativeC8Anchors.flatMap(a=>[a.start,a.start+1])]){
  const changed=Buffer.from(bytes);changed[cpuToOffset(address,bytes.length)]^=1;await assert.rejects(()=>proveTaskNativeC8(changed));
 }
});
