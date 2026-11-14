import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {inspectRom,cpuToOffset} from './rom.mjs';
import {audioComposeWindows,decodeSource,prove,rootWindows} from './render-task-native-audio-compose-source-proof.mjs';
const {bytes}=inspectRom(await readFile('Shadowrun (E).smc'));
test('Own Task audio: entire original444/220 graph, individually whole helper frames14/10/2/6/6 and conditional zeroVoice RTS',async()=>{
 const {map}=decodeSource(bytes),source=JSON.parse(await readFile('analysis/render-task-native-audio-compose.json'));
 assert.equal(map.size,220);assert.equal(source.source_graph.code_bytes,444);assert.equal(source.source_graph.full_graph_closed,false);
 for(const w of audioComposeWindows){const off=cpuToOffset(w.start,bytes.length);assert.equal(bytes.subarray(off,off+w.hex.length/2).toString('hex').toUpperCase(),w.hex);}
 for(const w of audioComposeWindows.slice(0,5)){
  const p=prove(map,w.start);assert.deepEqual(source.proofs.find(p=>p.entry===w.start.toString(16).toUpperCase().replace(/^(..)/,'$1:')),p);
  assert.equal(p.local_source_complete,true);assert.equal(p.external_return_assumptions,0);assert.equal(p.full_task_binding,false);
  assert.equal(p.full_graph_closed,w.start!==0x80C46E);
  for(const [pc,i] of map)if(rootWindows(w.start).some(r=>pc>=r.start&&pc<r.start+r.hex.length/2)){
   const absent=new Map(map);absent.delete(pc);assert.throws(()=>prove(absent,w.start));
   const raw=Buffer.from(i.raw);raw[0]^=1;
   for(const patch of [{raw},{next:i.next+1},{value:i.value^1},{state:{...i.state,m:1-i.state.m}}]){
    const changed=new Map(map);changed.set(pc,{...i,...patch});assert.throws(()=>prove(changed,w.start));
   }
  }
 }
 assert.deepEqual(prove(map,0x81F130).modes.filter(w=>w.at==='81:F1B7').map(w=>w.m),[0,1]);
 assert.equal(prove(map,0x80C46E).zero_voice_boundary.preceding_effects_published,false);
 assert.equal(bytes.readUInt16LE(cpuToOffset(0x80C4FF,bytes.length)),45);
});
