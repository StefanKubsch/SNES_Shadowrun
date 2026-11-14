import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {inspectRom,cpuToOffset} from './rom.mjs';
import {proveTaskNativeAudioOpcode,nativeAudioAnchors} from './task-native-audio-opcode-source.mjs';
const {bytes}=inspectRom(await readFile('Shadowrun (E).smc'));
test('Native58/4C: separately renewed whole slot/arguments/bridge/normal audio/realRTS/resume and original C46E/0104/0000',async()=>{
 const proof=await proveTaskNativeAudioOpcode(bytes);
 assert.deepEqual(JSON.parse(await readFile('analysis/render-task-native-opcode-c46e.json')).proofs,[proof]);
 assert.deepEqual(proof.parts.map(p=>p.proof.entry),['80:F4CB','80:F4F6','80:F52F','80:F509']);
 assert.deepEqual(proof.admitted_targets.map(t=>[t.id,t.target]),[[0x4C,'80:C46E']]);
 assert.equal(proof.admitted_targets[0].proof.minimum_protected_stack_bytes,14);
 assert.equal(proof.admitted_targets[0].proof.full_graph_closed,false);
 assert.equal(proof.zero_voice_boundary.raw_return,'actual saved sound WORD, not root return');
 assert.equal(proof.global_stack_minimum,null);assert.equal(proof.source_closed_to_dispatch,true);assert.equal(proof.full_task_binding,false);
});
test('Native58/4C: every complete audio/helper/bridge/return/metadata high byte rejects source drift',async()=>{
 for(const address of[0x80F30C,0x80F4CB,0x80F4F6,0x80F506,0x80F52F,0x80C46E,0x80C483,0x80C4B2,
  0x81F130,0x81F100,0x81F122,0x81F1E8,0x81F03A,0x81F007,0x81F023,0x80C416,0x80F509,0x80F389,
  ...nativeAudioAnchors.flatMap(a=>[a.start,a.start+1])]){
  const changed=Buffer.from(bytes);changed[cpuToOffset(address,bytes.length)]^=1;
  await assert.rejects(()=>proveTaskNativeAudioOpcode(changed));
 }
});
