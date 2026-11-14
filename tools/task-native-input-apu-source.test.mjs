import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {inspectRom,cpuToOffset} from './rom.mjs';
import {inputApuWindows,decodeSource,prove} from './render-task-native-input-apu-source-proof.mjs';
const {bytes}=inspectRom(await readFile('Shadowrun (E).smc'));
test('Task input/APU: all167/79 original bytes, actualPHP/PLP/RTS/RTL and E1 reset terminal are individually pinned',async()=>{
 const {map}=decodeSource(bytes),source=JSON.parse(await readFile('analysis/render-task-native-input-apu.json'));
 assert.equal(map.size,79);assert.equal(source.source_graph.code_bytes,167);assert.equal(source.source_graph.full_graph_closed,false);
 for(const w of inputApuWindows){const off=cpuToOffset(w.start,bytes.length);
  assert.equal(bytes.subarray(off,off+w.hex.length/2).toString('hex').toUpperCase(),w.hex);
  const p=prove(map,w.start);assert.deepEqual(source.proofs.find(p=>p.entry===w.start.toString(16).toUpperCase().replace(/^(..)/,'$1:')),p);
  assert.equal(p.external_return_assumptions,0);assert.equal(p.local_source_complete,true);assert.equal(p.full_task_binding,false);
 }
 const input=prove(map,0x809E1A);assert.equal(input.native_reset_completed,false);assert.equal(input.protected_with_root_jsr_bytes,6);
 assert.equal(input.terminals[0].to,'80:E382');assert.equal(input.native_reset_boundary.preceding_effects_published,false);
 assert.deepEqual(map.get(0x809E55).state,{e:1,m:1,x:1});assert.deepEqual(map.get(0x81F023).state,{e:0,m:0,x:0});
 assert.equal(prove(map,0x81F007).minimum_protected_stack_bytes,4);assert.equal(prove(map,0x80C416).minimum_protected_stack_bytes,3);
 assert.equal(prove(map,0x81F007).byte_entry_proof.returns[0].m,1);
 for(const [pc,i] of map){const entry=pc>=0x81F007?0x81F007:pc>=0x809E1A&&pc<0x809E59?0x809E1A:0x80C416;
  const absent=new Map(map);absent.delete(pc);assert.throws(()=>prove(absent,entry));
  const raw=Buffer.from(i.raw);raw[0]^=1;
  for(const patch of [{raw},{next:i.next+1},{value:i.value^1},{state:{...i.state,m:1-i.state.m}}]){
   const changed=new Map(map);changed.set(pc,{...i,...patch});assert.throws(()=>prove(changed,entry));
  }
 }
});
