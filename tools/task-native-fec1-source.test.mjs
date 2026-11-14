import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {inspectRom,cpuToOffset} from './rom.mjs';import {decodeTaskWindows,taskRomHash} from './task-partial-source.mjs';import {fec1Windows,proveTaskFEC1} from './task-native-fec1-source.mjs';
const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));
test('Whole Task FEC1: original entire transitive graph, mixed mode join and32 actual stackbytes',async()=>{
 assert.equal(metadata.rom_sha256,taskRomHash);const windows=fec1Windows(),{map}=decodeTaskWindows(bytes,windows),proof=proveTaskFEC1(map);
 assert.equal(proof.minimum_protected_stack_bytes,32);assert.equal(proof.maximum_local_stack_bytes,30);assert.equal(proof.reachable_instructions,1033);
 for(const w of windows){const off=cpuToOffset(w.start,bytes.length);assert.equal(bytes.subarray(off,off+w.hex.length/2).toString('hex').toUpperCase(),w.hex);}
 assert.deepEqual(JSON.parse(await readFile('analysis/render-task-native-fec1.json')).proofs,[proof]);
});
test('Whole Task FEC1: every removed instruction and altered raw/operand/mode/edge is rejected',()=>{
 const {map}=decodeTaskWindows(bytes,fec1Windows());for(const [pc,i] of map){const missing=new Map(map);missing.delete(pc);assert.throws(()=>proveTaskFEC1(missing));const raw=Buffer.from(i.raw);raw[0]^=1;
  for(const patch of [{raw},{value:i.value^1},{next:i.next+1},{state:{...i.state,m:1-i.state.m}},...(i.target?[{target:i.target+1}]:[])]){
   const bad=new Map(map);bad.set(pc,{...i,...patch});assert.throws(()=>proveTaskFEC1(bad));
  }
 }
});
