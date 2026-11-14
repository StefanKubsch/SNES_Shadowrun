import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {inspectRom,cpuToOffset} from './rom.mjs';import {decodeTaskWindows,taskRomHash} from './task-partial-source.mjs';
import {textComposeWindows,proveTaskTextComposition} from './task-native-text-compose-source.mjs';
const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));
for(const entry of [0x80FE69,0x80FB39]){
 test(`Whole Task text ${entry.toString(16)}: original pins, BYTE reentry/join and complete typed return graph`,async()=>{
  assert.equal(metadata.rom_sha256,taskRomHash);const windows=textComposeWindows(entry),{map}=decodeTaskWindows(bytes,windows),proof=proveTaskTextComposition(map,entry);
  assert.equal(proof.minimum_protected_stack_bytes,entry===0x80FE69?12:9);assert.equal(proof.external_return_assumptions,0);
  assert.equal(proof.reachable_instructions,map.size);assert.equal(map.get(0x80FC5F).state.m,1);
  for(const w of windows){const off=cpuToOffset(w.start,bytes.length);assert.equal(bytes.subarray(off,off+w.hex.length/2).toString('hex').toUpperCase(),w.hex);}
  assert.deepEqual(JSON.parse(await readFile('analysis/render-task-native-text-compose.json')).proofs.find(p=>p.entry===proof.entry),proof);
 });
 test(`Whole Task text ${entry.toString(16)}: every raw, missing, mode, operand and edge mutation is rejected`,()=>{
  const {map}=decodeTaskWindows(bytes,textComposeWindows(entry));
  for(const [pc,i] of map){const missing=new Map(map);missing.delete(pc);assert.throws(()=>proveTaskTextComposition(missing,entry));
   const raw=Buffer.from(i.raw);raw[0]^=1;
   for(const patch of [{raw},{value:i.value^1},{next:i.next+1},{state:{...i.state,m:1-i.state.m}},...(i.target?[{target:i.target+1}]:[])]){
    const bad=new Map(map);bad.set(pc,{...i,...patch});assert.throws(()=>proveTaskTextComposition(bad,entry));
   }
  }
 });
}
