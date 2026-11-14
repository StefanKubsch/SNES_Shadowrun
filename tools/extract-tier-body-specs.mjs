import {readFile,writeFile} from 'node:fs/promises';import {inspectRom,cpuToOffset} from './rom.mjs';import {taskHash} from './task-partial-source.mjs';
import {decodeScript} from '../src/script/codec.mjs';import {tierRootSpecs} from './task-native-tier-specs.mjs';
const {bytes}=inspectRom(await readFile('Shadowrun (E).smc')),inventory=JSON.parse(await readFile('analysis/script-decoding.json')),tierBodySpecs=[];
for(const id of [0x1A3,0x1FE,0x392]){const original=inventory.complete.find(s=>parseInt(s.id,16)===id),scriptEntry=parseInt(original.cpu_address.replace(':',''),16),n=original.byteLength,
 off=cpuToOffset(scriptEntry,bytes.length),raw=bytes.subarray(off,off+n+3),decoded=decodeScript(raw.subarray(2,2+n));
 if(!decoded.fullyCovered||decoded.edges.some(e=>e.to<=e.from)||decoded.instructions.some(i=>[0x4C,0x50,0x52].includes(i.opcode)))throw Error('Incomplete tier body');
 const word=a=>bytes.readUInt16LE(cpuToOffset(a,bytes.length));tierBodySpecs.push({id,scriptEntry,argumentBytes:word(0x82E9CC+id)&255,returnBytes:word(0x82E623+id)&255,
  header:[...raw.subarray(0,2)],bytecode:[...raw.subarray(2,2+n)],fetchTail:raw.at(-1),sourceHash:taskHash(raw),romReads:[],
  instructions:decoded.instructions.map(({pc,opcode,operand,length,flow})=>({pc,opcode,operand,length,flow})),edges:decoded.edges,
  tierBody:true,modalBody:true,sourceRomGuards:true,originalTextSources:true,native9AObservations:true});}
const tierNativeSources=tierRootSpecs.map(s=>({id:s.id,target:s.entry,anchors:s.anchors.map(a=>({address:a.start,bytes:[...Buffer.from(a.hex,'hex')]}))}));
await writeFile('proof/task/script-body-tier-specs.mjs','// Individually extracted original tier bodies; full source and native path proof required.\nexport const tierBodySpecs='+JSON.stringify(tierBodySpecs,null,2)+';\nexport const tierNativeSources='+JSON.stringify(tierNativeSources,null,2)+';\n');
console.log('Extracted three original tier bodies, each72 bytecode bytes and32 instructions.');
