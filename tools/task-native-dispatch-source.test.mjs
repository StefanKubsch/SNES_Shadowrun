import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {inspectRom,cpuToOffset} from './rom.mjs';import {decodeTaskWindows,taskRomHash} from './task-partial-source.mjs';
import {dispatchSpec,prove} from './render-task-native-dispatch-source-proof.mjs';
import {taskLeafSpecs} from './task-native-leaf-specs.mjs';import {nativeTargetEntries} from '../src/task/native-targets.mjs';
import {proveLeafSource} from './task-native-leaf-source.mjs';
import {continuationSpecs} from './task-native-continuation-specs.mjs';import {proveContinuation} from './task-native-continuation-source.mjs';
const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));
test('F52F original absolute-indirect bank00 pointer and every decoder-field mutation are pinned',async()=>{
 assert.equal(metadata.rom_sha256,taskRomHash);assert.equal(bytes.subarray(cpuToOffset(0x80F52F,bytes.length),cpuToOffset(0x80F52F,bytes.length)+3).toString('hex').toUpperCase(),'6CA200');
 const {map}=decodeTaskWindows(bytes,dispatchSpec.windows),p=prove(map),report=JSON.parse(await readFile('analysis/render-task-native-dispatch.json'));assert.deepEqual(report.proofs,[p]);
 assert.equal(p.pointer.directPageApplied,false);assert.equal(p.pointer.dataBankApplied,false);assert.equal(p.pointer.freshAfterWrites,true);assert.equal(p.full_graph_closed,false);
 const i=map.get(0x80F52F);for(const patch of [{raw:Buffer.alloc(3)},{next:i.next+1},{value:0xA3},{mode:'indx'},{state:{...i.state,m:1}},{target:0x80CA3A}])assert.throws(()=>prove(new Map([[i.cpu,{...i,...patch}]])));assert.throws(()=>prove(new Map()));
});
test('every bounded Native58 target has an exact source/mode/two-byte typedRTS proof, no inferred calls',async()=>{
 const report=JSON.parse(await readFile('analysis/render-task-native-dispatch.json'));assert.deepEqual([...nativeTargetEntries].sort(),taskLeafSpecs.map(s=>s.entry).sort());assert.equal(new Set(nativeTargetEntries).size,nativeTargetEntries.length);
 assert.equal(report.target_dependencies.length,taskLeafSpecs.length);
 for(const s of taskLeafSpecs){const dependency=report.target_dependencies.find(d=>d.entry===s.entry),p=proveLeafSource(decodeTaskWindows(bytes,s.windows).map,s);assert.deepEqual(dependency.proof,p);assert.equal(p.minimum_protected_stack_bytes,(s.maximumLocalStackBytes??0)+2);assert.equal(p.maximum_local_stack_bytes,s.maximumLocalStackBytes??0);assert.equal(p.external_return_assumptions,0);assert.ok(p.returns.every(r=>r.m===0&&r.x===0&&r.dbr==='entry'));}
 for(const spec of continuationSpecs){const dep=report.composition_dependencies.find(d=>d.source===`analysis/render-task-${spec.name}.json`);assert.deepEqual(dep.proofs,proveContinuation(decodeTaskWindows(bytes,spec.windows).map,spec));}
 const {map}=decodeTaskWindows(bytes,continuationSpecs[0].windows);assert.equal(map.get(0x80F506).target,0x80F52F);assert.equal(map.get(0x80F506).next-1,0x80F508);assert.equal(map.get(0x80F506).next,0x80F509);
 assert.equal(report.composition_contract.inner_return_word,'F508');assert.equal(report.composition_contract.required_return_target,'80:F509');assert.equal(report.composition_contract.frontier,'80:F390');assert.equal(report.composition_contract.full_task_binding,false);assert.equal(report.composition_contract.global_stack_minimum,null);
});
