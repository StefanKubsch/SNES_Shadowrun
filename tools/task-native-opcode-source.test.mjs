import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectRom,cpuToOffset} from './rom.mjs';
import {proveNativeOpcode} from './task-native-opcode-source.mjs';
import {nativeOpcodeSpecs} from './task-native-opcode-specs.mjs';
const {bytes}=inspectRom(await readFile('Shadowrun (E).smc'));
for(const s of [null,...nativeOpcodeSpecs]){
 const name=s?.compositionName??'native-opcode';
 test(`${name}: separate pinned composition contract renews all actual source/mode/stack joins`,async()=>{
  const p=await proveNativeOpcode(bytes,s),r=JSON.parse(await readFile(`analysis/render-task-${name}.json`));assert.deepEqual(r.proofs,[p]);
  assert.equal(p.external_return_assumptions,0);assert.deepEqual(p.output_mode,{e:0,m:0,x:0});
  assert.equal(p.source_closed_to_dispatch,true);assert.equal(p.full_task_binding,false);assert.equal(p.global_stack_minimum,null);
  assert.deepEqual(p.parts.map(p=>p.proof.entry),['80:F4CB','80:F4F6','80:F52F','80:F509']);
  assert.equal(p.admitted_targets.length,s?1:nativeOpcodeSpecs.length);
  if(s){const leaf=p.admitted_targets[0];assert.equal(leaf.id,s.id);assert.equal(leaf.proof.root_return,'RTS');
   assert.equal(leaf.proof.maximum_local_stack_bytes,s.maximumLocalStackBytes??0);assert.equal(leaf.proof.minimum_protected_stack_bytes,(s.maximumLocalStackBytes??0)+2);
   assert.ok(leaf.proof.returns.every(r=>r.m===0&&r.x===0&&r.dbr==='entry'));}
 });
 test(`${name}: original slot, prefix, bridge JSR, indirect pointer, leaf and resume byte drift invalidate composition`,async()=>{
  const addresses=[0x80F30C,0x80F4CB,0x80F4F6,0x80F506,0x80F52F,0x80F509,0x80F389,
   ...(s?[s.entry,...s.anchors.map(a=>a.start+1)]:[])];
  for(const address of addresses){const changed=Buffer.from(bytes);changed[cpuToOffset(address,bytes.length)]^=1;
   await assert.rejects(()=>proveNativeOpcode(changed,s));}
 });
}
