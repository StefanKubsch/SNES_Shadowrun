import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readProgress,validateScriptOpcodeBlock} from './progress.mjs';
import {scriptOpcodeSpecs} from './task-script-opcode-fixtures.mjs';
test('original Script52 contracts and current autonomous batch have complete native evidence',async()=>{
 const p=await readProgress(process.cwd()),g=p.work_groups.find(g=>g.id==='task-f378-opcode-dispatch');
 assert.equal(g.script52_blocks.length,scriptOpcodeSpecs.length+1);
 if(p.autonomous_batch.scope==='complete-original-script52-id-series'){
  assert.deepEqual(scriptOpcodeSpecs.map(s=>s.id),Array.from({length:937},(_,id)=>id));
  const blocks=g.script52_blocks.filter(b=>b.script_id>=409&&b.script_id<=936);
  assert.deepEqual(blocks.map(b=>b.script_id),Array.from({length:528},(_,n)=>409+n));
  const expected=blocks.flatMap(b=>[b.id,b.id+':manual-native']);
  assert.equal(p.autonomous_batch.authorized_blocks,1056);
  assert.deepEqual(p.autonomous_batch.completed_groups,expected);
 }
 for(const b of g.script52_blocks){
  await validateScriptOpcodeBlock(process.cwd(),b,p.rom_sha256);
  await assert.rejects(()=>validateScriptOpcodeBlock(process.cwd(),{...b,script_id:65535},p.rom_sha256));
  const r=JSON.parse(await readFile(b.manual_native.report));assert.equal(r.probes.length,3);assert.ok(r.probes.every(p=>p.synthetic));
 }
 if(p.autonomous_batch.authorization.includes('ab89a6b50')){
  const expected=[...g.native58_blocks.filter(b=>[164,179,180,181,190,201,204,207,211,218].includes(b.native_function_id)),
   p.work_groups.find(g=>g.id==='task-f378-script-bridge'),...g.script52_blocks].flatMap(b=>[b.id,b.id+':manual-native']);
  assert.equal(p.autonomous_batch.authorized_blocks,100);assert.equal(expected.length,100);assert.deepEqual(p.autonomous_batch.completed_groups,expected);
 }
 if(p.autonomous_batch.authorization.includes('ab6208a33')){
  const expected=[p.work_groups.find(g=>g.id==='task-visit-c1ca'),...g.script52_blocks.filter(b=>b.script_id>=38&&b.script_id<=86)].flatMap(b=>[b.id,b.id+':manual-native']);
  assert.equal(p.autonomous_batch.authorized_blocks,100);assert.equal(expected.length,100);assert.deepEqual(p.autonomous_batch.completed_groups,expected);
 }
 if(p.autonomous_batch.authorization.includes('ab6c4a47c')){
  const blocks=g.script52_blocks.filter(b=>b.script_id>=209&&b.script_id<=258);
  assert.deepEqual(blocks.map(b=>b.script_id),Array.from({length:50},(_,n)=>209+n));
  const expected=blocks.flatMap(b=>[b.id,b.id+':manual-native']);
  assert.equal(p.autonomous_batch.authorized_blocks,100);assert.equal(expected.length,100);
  assert.deepEqual(p.autonomous_batch.completed_groups,expected);
 }
 if(p.autonomous_batch.authorization.includes('ab89f198a')){
  const blocks=g.script52_blocks.filter(b=>b.script_id>=259&&b.script_id<=308);
  assert.deepEqual(blocks.map(b=>b.script_id),Array.from({length:50},(_,n)=>259+n));
  const expected=blocks.flatMap(b=>[b.id,b.id+':manual-native']);
  assert.equal(p.autonomous_batch.authorized_blocks,100);assert.equal(expected.length,100);
  assert.deepEqual(p.autonomous_batch.completed_groups,expected);
 }
 if(p.autonomous_batch.authorization.includes('ab73da6b7')){
  const blocks=g.script52_blocks.filter(b=>b.script_id>=309&&b.script_id<=408);
  assert.deepEqual(blocks.map(b=>b.script_id),Array.from({length:100},(_,n)=>309+n));
  const expected=blocks.flatMap(b=>[b.id,b.id+':manual-native']);
  assert.equal(p.autonomous_batch.authorized_blocks,200);assert.equal(expected.length,200);
  assert.deepEqual(p.autonomous_batch.completed_groups,expected);
 }
});
