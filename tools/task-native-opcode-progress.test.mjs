import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readProgress,validateNativeOpcodeBlock} from './progress.mjs';
import {nativeOpcodeSpecs} from './task-native-opcode-specs.mjs';
test('All admitted full-call source contracts and native bindings retain separate evidence',async()=>{
 const p=await readProgress(process.cwd()),g=p.work_groups.find(g=>g.id==='task-f378-opcode-dispatch');
 const blocks=g.native58_blocks,c8=blocks.filter(b=>b.native_function_id===0xC8);assert.equal(c8.length,1);assert.equal(c8[0].callee,'80:FEC1');
 assert.equal(c8[0].manual_native.module,'proof/task/native-c8-opcode.mjs');
 const actions=blocks.filter(b=>b.native_function_id===0x13);assert.equal(actions.length,1);assert.equal(actions[0].callee,'80:9BA0');
 assert.equal(actions[0].manual_native.module,'proof/task/native13-opcode.mjs');
 const audio=blocks.filter(b=>b.native_function_id===0x4C);assert.equal(audio.length,1);assert.equal(audio[0].callee,'80:C46E');
 assert.equal(audio[0].manual_native.module,'proof/task/native-audio-opcode.mjs');
 const random=blocks.filter(b=>b.native_function_id===0x3E);assert.equal(random.length,1);assert.equal(random[0].callee,'80:C51F');
 assert.equal(random[0].manual_native.module,'proof/task/native-random-opcode.mjs');
 const directRandom=blocks.filter(b=>b.native_function_id===0x63);assert.equal(directRandom.length,1);assert.equal(directRandom[0].callee,'80:C560');
 assert.equal(directRandom[0].manual_native.module,'proof/task/native-random-opcode.mjs');
 const clear=blocks.filter(b=>b.native_function_id===0xA7);assert.equal(clear.length,1);assert.equal(clear[0].callee,'80:FF79');assert.equal(clear[0].manual_native.module,'proof/task/native-clear-opcode.mjs');
 const inputWait=blocks.filter(b=>b.native_function_id===0xA3);assert.equal(inputWait.length,1);assert.equal(inputWait[0].callee,'80:F953');assert.equal(inputWait[0].manual_native.module,'proof/task/native-input-wait-opcode.mjs');
 const blast=blocks.filter(b=>b.native_function_id===0x7C);assert.equal(blast.length,1);assert.equal(blast[0].callee,'80:8E36');assert.equal(blast[0].manual_native.module,'proof/task/native-8e36-opcode.mjs');
 const selection=blocks.filter(b=>[0x9A,0x1A].includes(b.native_function_id));assert.equal(selection.length,2);
 assert.ok(selection.every(b=>b.manual_native.module==='proof/task/native-selection-root-opcode.mjs'));
 const modal=blocks.filter(b=>[0x72,0xBF,0x74,0xD7].includes(b.native_function_id));assert.equal(modal.length,4);assert.ok(modal.every(b=>b.manual_native.module==='proof/task/native-modal-opcode.mjs'));
 assert.equal(blocks.length,nativeOpcodeSpecs.length+1+c8.length+actions.length+audio.length+random.length+directRandom.length+clear.length+inputWait.length+blast.length+selection.length+modal.length);assert.equal(new Set(blocks.map(b=>b.id)).size,blocks.length);
 for(const s of nativeOpcodeSpecs){const b=blocks.find(b=>b.native_function_id===s.id);assert.equal(b.callee,'80:'+(s.entry&65535).toString(16).toUpperCase());}
 for(const b of blocks){
  await validateNativeOpcodeBlock(process.cwd(),b,p.rom_sha256);
  await assert.rejects(()=>validateNativeOpcodeBlock(process.cwd(),{...b,callee:'80:1234'},p.rom_sha256));
  if(b.callee!==null)await assert.rejects(()=>validateNativeOpcodeBlock(process.cwd(),{...b,native_function_id:b.native_function_id+1},p.rom_sha256));
  const r=JSON.parse(await readFile(b.manual_native.report));assert.equal(r.probes.length,b.native_function_id===0x3E?12:b.native_function_id===0x63?9:3);assert.ok(r.probes.every(p=>p.synthetic));
  if(b.native_function_id===0x3E)assert.deepEqual(r.probes.filter(p=>p.handled).map(p=>p.case),['zero','normal','retry','actual-mask-stack-alias']);
  if(b.native_function_id===0x63)assert.deepEqual(r.probes.filter(p=>p.handled).map(p=>p.case),['normal','full-WORD-result','state-byte-wrap']);
 }
 if(p.autonomous_batch.authorization.includes('ab275c1ee')){
  assert.equal(p.autonomous_batch.authorized_blocks,100);
  assert.deepEqual(p.autonomous_batch.completed_groups,blocks.flatMap(b=>[b.id,b.id+':manual-native']));
 }
});
