import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {inspectRom,cpuToOffset} from './rom.mjs';
import {decodeTaskWindows} from './task-partial-source.mjs';
import {counterWindows,prove} from './render-task-native-counter-b0a1-source-proof.mjs';
const {bytes}=inspectRom(await readFile('Shadowrun (E).smc'));
test('B0A1: exact whole original long baseline/CMP/equality loop and typed RTL3 without helper assumptions',async()=>{
 const {map}=decodeTaskWindows(bytes,counterWindows),p=prove(map),report=JSON.parse(await readFile('analysis/render-task-native-counter-b0a1.json'));
 assert.deepEqual(report.proofs,[p]);assert.equal(p.reachable_instructions,4);assert.equal(p.external_return_assumptions,0);
 assert.equal(p.minimum_protected_stack_bytes,3);assert.equal(p.full_graph_closed,true);assert.equal(p.full_task_binding,false);
 assert.equal(bytes.subarray(cpuToOffset(0x81B0A1,bytes.length),cpuToOffset(0x81B0AC,bytes.length)).toString('hex'),'af761c7ecf761c7ef0fa6b');
 assert.equal(map.get(0x81B0A9).target,0x81B0A5);
 for(const [pc,i] of map){const absent=new Map(map);absent.delete(pc);assert.throws(()=>prove(absent));
  const raw=Buffer.from(i.raw);raw[0]^=1;
  for(const patch of [{raw},{next:i.next+1},{value:i.value^1},{state:{...i.state,m:1}}]){
   const changed=new Map(map);changed.set(pc,{...i,...patch});assert.throws(()=>prove(changed));
  }
 }
});
