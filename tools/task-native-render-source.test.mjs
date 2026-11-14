import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {inspectRom,cpuToOffset} from './rom.mjs';
import {decodeTaskWindows,taskRomHash} from './task-partial-source.mjs';
import {taskNativeRenderSpec as spec} from './task-native-render-spec.mjs';
import {proveTaskNativeRender} from './task-native-render-source.mjs';
const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));
test('Task F963: independently pinned whole original graph and mixed typed return proof',async()=>{
 assert.equal(metadata.rom_sha256,taskRomHash);const {map}=decodeTaskWindows(bytes,spec.windows),proof=proveTaskNativeRender(map);
 assert.equal(proof.maximum_local_stack_bytes,6);assert.equal(proof.minimum_protected_stack_bytes,8);
 assert.equal(proof.inner_calls.length,5);assert.deepEqual(proof.inner_calls.map(c=>c.return_bytes),[2,3,3,3,3]);
 for(const w of spec.windows){const off=cpuToOffset(w.start,bytes.length);assert.equal(bytes.subarray(off,off+w.hex.length/2).toString('hex').toUpperCase(),w.hex);}
 assert.deepEqual(JSON.parse(await readFile('analysis/render-task-native-f963.json')).proofs,[proof]);
});
test('Task F963: all missing/raw/operand/mode/edge mutations fail the original source pins',()=>{
 const {map}=decodeTaskWindows(bytes,spec.windows);
 for(const [pc,i] of map){const missing=new Map(map);missing.delete(pc);assert.throws(()=>proveTaskNativeRender(missing));
  const raw=Buffer.from(i.raw);raw[0]^=1;
  for(const patch of [{raw},{value:i.value^1},{next:i.next+1},{state:{...i.state,m:1-i.state.m}},...(i.target?[{target:i.target+1}]:[])]){
   const bad=new Map(map);bad.set(pc,{...i,...patch});assert.throws(()=>proveTaskNativeRender(bad));
  }
 }
});
