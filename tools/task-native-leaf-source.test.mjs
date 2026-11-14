import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {inspectRom,cpuToOffset} from './rom.mjs';
import {decodeTaskWindows,taskRomHash,taskHash} from './task-partial-source.mjs';
import {taskLeafSpecs} from './task-native-leaf-specs.mjs';import {proveLeafSource} from './task-native-leaf-source.mjs';
const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));
for(const spec of taskLeafSpecs) {
 test(`${spec.name}: independent full ROM/window/table pins and local typed RTS graph`,async()=>{
  assert.equal(metadata.rom_sha256,taskRomHash);const {map}=decodeTaskWindows(bytes,spec.windows),proof=proveLeafSource(map,spec);
  assert.equal(proof.minimum_protected_stack_bytes,(spec.maximumLocalStackBytes??0)+2);assert.equal(proof.maximum_local_stack_bytes,spec.maximumLocalStackBytes??0);assert.equal(proof.external_return_assumptions,0);
  for(const window of spec.windows){const start=cpuToOffset(window.start,bytes.length),raw=bytes.subarray(start,start+window.hex.length/2);assert.equal(raw.toString('hex').toUpperCase(),window.hex);}
  for(const anchor of spec.anchors){const start=cpuToOffset(anchor.start,bytes.length);assert.equal(bytes.subarray(start,start+2).toString('hex').toUpperCase(),anchor.hex);}
  assert.equal(bytes.readUInt16LE(cpuToOffset(0x82D7B8+spec.id*2,bytes.length)),spec.entry&65535);
  const report=JSON.parse(await readFile(`analysis/render-task-${spec.name}.json`));assert.deepEqual(report.proofs,[proof]);assert.equal(report.source_graph.full_graph_closed,true);assert.equal(report.source_graph.native_binding,false);
  for(const w of report.windows)assert.equal(w.sha256,taskHash(Buffer.from(w.machine_bytes,'hex')));
 });
 test(`${spec.name}: every missing/raw/operand/mode/edge mutation fails the fixed source lemma`,()=>{
  const {map}=decodeTaskWindows(bytes,spec.windows);
  for(const [pc,i] of map){const missing=new Map(map);missing.delete(pc);assert.throws(()=>proveLeafSource(missing,spec));
   const raw=Buffer.from(i.raw);raw[0]^=1;
   for(const patch of [{raw},{value:i.value^1},{next:i.next+1},{state:{...i.state,m:1-i.state.m}}]) {
    const bad=new Map(map);bad.set(pc,{...i,...patch});assert.throws(()=>proveLeafSource(bad,spec));
   }
  }
 });
}
