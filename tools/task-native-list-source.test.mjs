import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {inspectRom,cpuToOffset} from './rom.mjs';import {decodeTaskWindows} from './task-partial-source.mjs';
import {taskListSpecs} from './task-native-list-specs.mjs';import {listWindows,prove,decodeModes} from './render-task-native-list-prerequisites-source-proof.mjs';
const {bytes}=inspectRom(await readFile('Shadowrun (E).smc'));
test('Own Task list: exact individually complete source graphs, real stack16/14/14/5/12 and explicit FC5F BYTE entry',async()=>{
 const source=JSON.parse(await readFile('analysis/render-task-native-list-prerequisites.json'));
 assert.equal(source.source_graph.code_bytes,1346);assert.equal(source.source_graph.instructions,649);
 assert.deepEqual(decodeModes,[{entry:0x80FC5F,initialM:1,initialX:0}]);
 for(const s of taskListSpecs){
  const {map}=decodeTaskWindows(bytes,listWindows(s.entry)),p=prove(map,s.entry);
  assert.deepEqual(source.proofs.find(p=>p.entry==='80:'+(s.entry&65535).toString(16).toUpperCase()),p);
  assert.equal(p.minimum_protected_stack_bytes,s.stackBytes);assert.equal(p.reachable_instructions,map.size);
  assert.equal(p.full_graph_closed,true);assert.equal(p.full_task_binding,false);assert.equal(p.external_return_assumptions,0);
  for(const w of listWindows(s.entry)){const offset=cpuToOffset(w.start,bytes.length);
   assert.equal(bytes.subarray(offset,offset+w.hex.length/2).toString('hex').toUpperCase(),w.hex);}
  for(const [pc,i] of map){const absent=new Map(map);absent.delete(pc);assert.throws(()=>prove(absent,s.entry));
   const raw=Buffer.from(i.raw);raw[0]^=1;
   for(const patch of [{raw},{next:i.next+1},{value:i.value^1},{state:{...i.state,m:1-i.state.m}}]){
    const changed=new Map(map);changed.set(pc,{...i,...patch});assert.throws(()=>prove(changed,s.entry));
   }
  }
 }
});
