import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {inspectRom,cpuToOffset} from './rom.mjs';
import {actionsRoots,actionsWindow,actionsPins,decodeSource,prove} from './render-task-native-actions-source-proof.mjs';
const {bytes}=inspectRom(await readFile('Shadowrun (E).smc'));
test('Own Task actions: whole original99EB/Native13 and every transitive instruction, real28/30 stack bytes',async()=>{
 const {map}=decodeSource(bytes),source=JSON.parse(await readFile('analysis/render-task-native-actions.json'));
 assert.equal(map.size,1756);assert.equal(actionsWindow.hex.length/2,448);assert.equal(source.source_graph.code_bytes,3802);
 for(const w of actionsPins){const off=cpuToOffset(w.start,bytes.length);assert.equal(bytes.subarray(off,off+w.hex.length/2).toString('hex').toUpperCase(),w.hex);}
 for(const [n,entry] of actionsRoots.entries()){
  const p=prove(map,entry);assert.deepEqual(source.proofs[n],p);assert.equal(p.minimum_protected_stack_bytes,[28,30][n]);
  assert.equal(p.external_return_assumptions,0);assert.equal(p.full_graph_closed,false);assert.equal(p.conditional_graph_closed,true);
  assert.equal(p.original_sound_proof.minimum_protected_stack_bytes,[28,30][n]);assert.equal(p.full_task_binding,false);
  assert.ok(p.excluded_boundaries.some(b=>b.at==='80:9E2F'));assert.ok(p.excluded_boundaries.some(b=>b.at==='80:C495'));
 }
 // Independent literal pins cover every instruction, including alternate
 // menu entries, source reset bytes, all unpack and device/return branches.
 for(const [pc,i] of map){const absent=new Map(map);absent.delete(pc);assert.throws(()=>prove(absent,actionsRoots[1]));const raw=Buffer.from(i.raw);raw[0]^=1;
  for(const patch of [{raw},{next:i.next+1},{value:i.value^1},{state:{...i.state,m:1-i.state.m}},...(i.target?[{target:i.target+1}]:[])]){
   const changed=new Map(map);changed.set(pc,{...i,...patch});assert.throws(()=>prove(changed,actionsRoots[1]));
  }
 }
});
