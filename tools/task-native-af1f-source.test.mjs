import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {inspectRom,cpuToOffset} from './rom.mjs';import {decodeTaskWindows,taskRomHash} from './task-partial-source.mjs';
import {taskAF1FSpec} from './task-native-af1f-spec.mjs';import {proveTaskAF1F} from './task-native-af1f-source.mjs';
const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));
test('Task AF1F: independent full original active/gated source, RTL/PHX/PLX graph and WORD IO reads',async()=>{
 assert.equal(metadata.rom_sha256,taskRomHash);const {map}=decodeTaskWindows(bytes,taskAF1FSpec.windows),proof=proveTaskAF1F(map);
 assert.equal(proof.minimum_protected_stack_bytes,5);assert.equal(proof.maximum_local_stack_bytes,2);assert.equal(proof.external_return_assumptions,0);
 for(const w of taskAF1FSpec.windows){const off=cpuToOffset(w.start,bytes.length);assert.equal(bytes.subarray(off,off+w.hex.length/2).toString('hex').toUpperCase(),w.hex);}
 assert.deepEqual(JSON.parse(await readFile('analysis/render-task-native-af1f.json')).proofs,[proof]);assert.ok(proof.device_reads.every(r=>r.width===2));
});
test('Task AF1F: every missing, raw, operand, mode and edge mutation rejects the full original source',()=>{
 const {map}=decodeTaskWindows(bytes,taskAF1FSpec.windows);
 for(const [pc,i] of map){const missing=new Map(map);missing.delete(pc);assert.throws(()=>proveTaskAF1F(missing));const raw=Buffer.from(i.raw);raw[0]^=1;
  for(const patch of [{raw},{value:i.value^1},{next:i.next+1},{state:{...i.state,m:1-i.state.m}},...(i.target?[{target:i.target+1}]:[])]){
   const bad=new Map(map);bad.set(pc,{...i,...patch});assert.throws(()=>proveTaskAF1F(bad));
  }
 }
});
