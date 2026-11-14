import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {inspectRom,cpuToOffset} from './rom.mjs';import {decodeTaskWindows,taskRomHash} from './task-partial-source.mjs';
import {renderComposeEntries,renderComposeWindows,proveTaskRenderCompose} from './task-native-render-compose-source.mjs';
const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));
test('Whole Task FA3E/AD92/ACCF/ACB5/ACAF: individually pinned full graphs and actual mixed stack bounds',async()=>{
 assert.equal(metadata.rom_sha256,taskRomHash);const proofs=[];
 for(const [n,entry] of renderComposeEntries.entries()){
  const windows=renderComposeWindows(entry),{map}=decodeTaskWindows(bytes,windows),proof=proveTaskRenderCompose(map,entry);proofs.push(proof);
  assert.equal(proof.minimum_protected_stack_bytes,[3,6,6,22,24][n]);assert.equal(proof.external_return_assumptions,0);
  for(const w of windows){const off=cpuToOffset(w.start,bytes.length);assert.equal(bytes.subarray(off,off+w.hex.length/2).toString('hex').toUpperCase(),w.hex);}
 }
 assert.deepEqual(JSON.parse(await readFile('analysis/render-task-native-render-compose.json')).proofs,proofs);
});
test('Whole Task render: each removed instruction, mutated raw/operand/width/edge independently rejects source',()=>{
 for(const entry of renderComposeEntries){const {map}=decodeTaskWindows(bytes,renderComposeWindows(entry));
  for(const [pc,i] of map){const missing=new Map(map);missing.delete(pc);assert.throws(()=>proveTaskRenderCompose(missing,entry));const raw=Buffer.from(i.raw);raw[0]^=1;
   for(const patch of [{raw},{value:i.value^1},{next:i.next+1},{state:{...i.state,m:1-i.state.m}},...(i.target?[{target:i.target+1}]:[])]){
    const bad=new Map(map);bad.set(pc,{...i,...patch});assert.throws(()=>proveTaskRenderCompose(bad,entry));
   }
  }
 }
});
