import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {inspectRom,cpuToOffset} from './rom.mjs';import {decodeTaskWindows,taskRomHash} from './task-partial-source.mjs';
import {taskTextSpecs} from './task-native-text-specs.mjs';import {proveTaskTextRoot} from './task-native-text-source.mjs';
const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));
for(const spec of taskTextSpecs){
 test(`Task text ${spec.name}: independent original bytes and complete typed RTL stack proof`,async()=>{
  assert.equal(metadata.rom_sha256,taskRomHash);const {map}=decodeTaskWindows(bytes,spec.windows),proof=proveTaskTextRoot(map,spec);
  assert.equal(proof.minimum_protected_stack_bytes,spec.stackBytes);assert.equal(proof.maximum_local_stack_bytes,spec.stackBytes-3);
  for(const w of spec.windows){const off=cpuToOffset(w.start,bytes.length);assert.equal(bytes.subarray(off,off+w.hex.length/2).toString('hex').toUpperCase(),w.hex);}
  assert.deepEqual(JSON.parse(await readFile('analysis/render-task-native-text-prerequisites.json')).proofs.find(p=>p.entry===proof.entry),proof);
 });
 test(`Task text ${spec.name}: all missing, raw, operand, edge and mode mutations reject`,()=>{
  const {map}=decodeTaskWindows(bytes,spec.windows);
  for(const [pc,i] of map){const missing=new Map(map);missing.delete(pc);assert.throws(()=>proveTaskTextRoot(missing,spec));
   const raw=Buffer.from(i.raw);raw[0]^=1;
   for(const patch of [{raw},{value:i.value^1},{next:i.next+1},{state:{...i.state,m:1-i.state.m}},...(i.target?[{target:i.target+1}]:[])]){
    const bad=new Map(map);bad.set(pc,{...i,...patch});assert.throws(()=>proveTaskTextRoot(bad,spec));
   }
  }
 });
}
