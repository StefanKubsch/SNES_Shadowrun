import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectRom,cpuToOffset} from './rom.mjs';
import {decodeTaskWindows,taskRomHash} from './task-partial-source.mjs';
import {continuationSpecs} from './task-native-continuation-specs.mjs';
import {proveContinuation} from './task-native-continuation-source.mjs';
const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));
for(const spec of continuationSpecs){
 test(`${spec.name}: exact ROM source and migration graph never claim inferred callee return`,async()=>{
  assert.equal(metadata.rom_sha256,taskRomHash);
  for(const w of spec.windows){const offset=cpuToOffset(w.start,bytes.length);assert.equal(bytes.subarray(offset,offset+w.hex.length/2).toString('hex').toUpperCase(),w.hex);}
  const {map}=decodeTaskWindows(bytes,spec.windows),[proof]=proveContinuation(map,spec);
  assert.equal(proof.global_stack_minimum,null);assert.equal(proof.minimum_protected_stack_bytes,null);assert.equal(proof.external_return_assumptions,0);
  assert.equal(proof.transient_stack_bytes,2);assert.equal(proof.full_graph_closed,false);
  assert.equal(proof.frontier.at,spec.name==='native-bridge'?'80:F52F':'80:F390');
  const report=JSON.parse(await readFile(`analysis/render-task-${spec.name}.json`));assert.deepEqual(report.proofs,[proof]);
 });
 test(`${spec.name}: every missing instruction, literal, mode, operand and edge mutation fails`,()=>{
  const {map}=decodeTaskWindows(bytes,spec.windows);
  for(const [pc,i] of map){const missing=new Map(map);missing.delete(pc);assert.throws(()=>proveContinuation(missing,spec));const raw=Buffer.from(i.raw);raw[0]^=1;
   for(const patch of [{raw},{value:i.value^1},{next:i.next+1},{state:{...i.state,m:1-i.state.m}},...(i.target===undefined?[]:[{target:i.target+1}])]){const bad=new Map(map);bad.set(pc,{...i,...patch});assert.throws(()=>proveContinuation(bad,spec));}
  }
 });
}
