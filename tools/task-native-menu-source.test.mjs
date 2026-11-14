import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {inspectRom,cpuToOffset} from './rom.mjs';
import {menuRoots,menuWindow,menuPins,decodeSource,prove,requestProofs} from './render-task-native-menu-compose-source-proof.mjs';
const {bytes}=inspectRom(await readFile('Shadowrun (E).smc'));
test('Own Task menu: all2304/1088 original bytes, four conditional whole roots with real20-byte frames, separate original002D and all-WORD profiles',async()=>{
 const {map}=decodeSource(bytes),source=JSON.parse(await readFile('analysis/render-task-native-menu-compose.json'));
 assert.equal(map.size,1088);assert.equal(source.source_graph.code_bytes,2304);assert.equal(source.source_graph.full_graph_closed,false);
 for(const w of menuPins){const off=cpuToOffset(w.start,bytes.length);assert.equal(bytes.subarray(off,off+w.hex.length/2).toString('hex').toUpperCase(),w.hex);}
 assert.equal(menuWindow.hex.length/2,400);assert.deepEqual(requestProofs(map).map(p=>p.minimum_protected_stack_bytes),[5,3]);
 assert.deepEqual(source.internal_request_helpers,requestProofs(map));
 for(const entry of menuRoots){const p=prove(map,entry);assert.deepEqual(source.proofs.find(p=>p.entry===entry.toString(16).toUpperCase().replace(/^(..)/,'$1:')),p);
  assert.equal(p.minimum_protected_stack_bytes,20);assert.equal(p.maximum_local_stack_bytes,18);assert.equal(p.external_return_assumptions,0);
  assert.equal(p.conditional_graph_closed,true);assert.equal(p.full_graph_closed,false);assert.equal(p.full_task_binding,false);
  assert.equal(p.original_sound_proof.minimum_protected_stack_bytes,20);
  assert.ok(p.excluded_boundaries.some(b=>b.at==='80:9E2F'));assert.ok(p.excluded_boundaries.some(b=>b.at==='80:C495'));
 }
 // Every source instruction, including all alternate roots/reset/helper bytes,
 // must survive the independent pins before conditional reachability proof.
 for(const [pc,i] of map){const absent=new Map(map);absent.delete(pc);assert.throws(()=>prove(absent,menuRoots[0]));
  const raw=Buffer.from(i.raw);raw[0]^=1;
  for(const patch of [{raw},{next:i.next+1},{value:i.value^1},{state:{...i.state,m:1-i.state.m}}]){
   const changed=new Map(map);changed.set(pc,{...i,...patch});assert.throws(()=>prove(changed,menuRoots[0]));
  }
 }
});
