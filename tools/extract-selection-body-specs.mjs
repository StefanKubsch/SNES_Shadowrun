import {readFile,writeFile} from 'node:fs/promises';import {inspectRom,cpuToOffset} from './rom.mjs';
import {taskHash} from './task-partial-source.mjs';import {decodeScript} from '../src/script/codec.mjs';
import {selectionRoots} from './task-native-933a-bba0-specs.mjs';
const {bytes}=inspectRom(await readFile('Shadowrun (E).smc'));
const selectionBodySpecs=[];
for(const [id,scriptEntry,n]of [[0xF8,0x82FD94,43],[0x194,0x9FAF3D,39]]){
 const off=cpuToOffset(scriptEntry,bytes.length),raw=bytes.subarray(off,off+n+3),decoded=decodeScript(raw.subarray(2,2+n));
 if(!decoded.fullyCovered||decoded.edges.some(e=>e.to<=e.from))throw Error('Incomplete selection body');
 const word=a=>bytes.readUInt16LE(cpuToOffset(a,bytes.length));
 selectionBodySpecs.push({id,scriptEntry,argumentBytes:word(0x82E9CC+id)&255,returnBytes:word(0x82E623+id)&255,
  header:[...raw.subarray(0,2)],bytecode:[...raw.subarray(2,2+n)],fetchTail:raw.at(-1),sourceHash:taskHash(raw),romReads:[],
  instructions:decoded.instructions.map(({pc,opcode,operand,length,flow})=>({pc,opcode,operand,length,flow})),edges:decoded.edges,
  selectionBody:true,sourceRomGuards:true,originalTextSources:true,...(id===0xF8?{native9AObservations:true}:{native1ABinding:true})});
}
const selectionNativeSources=selectionRoots.map(s=>({id:s.id,target:s.entry,anchors:s.anchors.map(a=>({address:a.start,bytes:[...Buffer.from(a.hex,'hex')]}))}));
await writeFile('proof/task/script-body-selection-specs.mjs','// Whole individually extracted original0F8/194; dynamic ROM roots are pinned by source exploration.\nexport const selectionBodySpecs='+JSON.stringify(selectionBodySpecs,null,2)+';\nexport const selectionNativeSources='+JSON.stringify(selectionNativeSources,null,2)+';\n');
console.log('Individual body extraction',selectionBodySpecs.map(s=>[s.id,s.bytecode.length,s.instructions.length]));
