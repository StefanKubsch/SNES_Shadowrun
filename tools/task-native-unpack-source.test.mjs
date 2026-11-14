import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {inspectRom,cpuToOffset} from './rom.mjs';import {decodeTaskWindows,taskRomHash} from './task-partial-source.mjs';
import {unpackWindows,proveTaskUnpack} from './task-native-unpack-source.mjs';
const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));
test('Task unpack/A9B2: individually pinned original graph, mixed M/X modes and actual stack15/19',async()=>{
 assert.equal(metadata.rom_sha256,taskRomHash);const proofs=[];
 for(const entry of [0x809F49,0x81A9B2]){
  const windows=unpackWindows(entry),{map}=decodeTaskWindows(bytes,windows),p=proveTaskUnpack(map,entry);proofs.push(p);
  assert.equal(p.external_return_assumptions,0);assert.equal(p.minimum_protected_stack_bytes,entry===0x809F49?15:19);
  for(const w of windows){const off=cpuToOffset(w.start,bytes.length);assert.equal(bytes.subarray(off,off+w.hex.length/2).toString('hex').toUpperCase(),w.hex);}
  assert.equal(map.get(0x809F02).state.x,1);assert.equal(map.get(0x809F12).state.x,0);
  assert.deepEqual(JSON.parse(await readFile(`analysis/render-task-native-${entry===0x809F49?'unpack':'a9b2'}.json`)).proofs,[p]);
 }
});
test('Task unpack/A9B2: every removed byte/op/mode/operand/edge is rejected independently',()=>{
 for(const entry of [0x809F49,0x81A9B2]){const {map}=decodeTaskWindows(bytes,unpackWindows(entry));
  for(const [pc,i] of map){const missing=new Map(map);missing.delete(pc);assert.throws(()=>proveTaskUnpack(missing,entry));const raw=Buffer.from(i.raw);raw[0]^=1;
   for(const patch of [{raw},{value:i.value^1},{next:i.next+1},{state:{...i.state,x:1-i.state.x}},...(i.target?[{target:i.target+1}]:[])]){
    const bad=new Map(map);bad.set(pc,{...i,...patch});assert.throws(()=>proveTaskUnpack(bad,entry));
   }
  }
 }
});
