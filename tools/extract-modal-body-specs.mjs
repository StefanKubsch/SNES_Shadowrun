import {readFile,writeFile} from 'node:fs/promises';import {inspectRom,cpuToOffset} from './rom.mjs';import {taskHash} from './task-partial-source.mjs';
import {decodeScript} from '../src/script/codec.mjs';import {modalSpecs} from './task-native-modal-specs.mjs';import {nativeOpcodeSpecs} from './task-native-opcode-specs.mjs';
const {bytes}=inspectRom(await readFile('Shadowrun (E).smc')),inventory=JSON.parse(await readFile('analysis/script-decoding.json'));
const ids=[0x04D,0x0A4,0x0C3,0x0C8,0x0D7,0x0E3,0x118,0x143,0x162,0x1E6,0x1ED,0x27A,0x381],modalBodySpecs=[];
for(const id of ids){const original=inventory.complete.find(s=>parseInt(s.id,16)===id),scriptEntry=parseInt(original.cpu_address.replace(':',''),16),n=original.byteLength,
 off=cpuToOffset(scriptEntry,bytes.length),raw=bytes.subarray(off,off+n+3),decoded=decodeScript(raw.subarray(2,2+n));
 if(!decoded.fullyCovered||decoded.edges.some(e=>e.to<=e.from)||decoded.instructions.some(i=>[0x4C,0x50,0x52].includes(i.opcode)))throw Error('Incomplete modal body');
 const word=a=>bytes.readUInt16LE(cpuToOffset(a,bytes.length));
 modalBodySpecs.push({id,scriptEntry,argumentBytes:word(0x82E9CC+id)&255,returnBytes:word(0x82E623+id)&255,header:[...raw.subarray(0,2)],bytecode:[...raw.subarray(2,2+n)],
  fetchTail:raw.at(-1),sourceHash:taskHash(raw),romReads:[],instructions:decoded.instructions.map(({pc,opcode,operand,length,flow})=>({pc,opcode,operand,length,flow})),edges:decoded.edges,
  modalBody:true,sourceRomGuards:true,originalTextSources:true,nativeModalObservations:true,native9AObservations:original.native_calls.includes('9A'),...(original.native_calls.includes('C8')?{c8Observations:true}:{}),
  ...(original.native_calls.includes('4C')?{audioObservations:true}:{})});}
const modalNativeSources=[...modalSpecs,nativeOpcodeSpecs.find(s=>s.id===0x42)].map(s=>({id:s.id,target:s.entry,anchors:s.anchors.map(a=>({address:a.start,bytes:[...Buffer.from(a.hex,'hex')]}))}));
await writeFile('proof/task/script-body-modal-specs.mjs','// Whole individually extracted original modal bodies; each needs complete source/data/native path admission.\nexport const modalBodySpecs='+JSON.stringify(modalBodySpecs,null,2)+';\nexport const modalNativeSources='+JSON.stringify(modalNativeSources,null,2)+';\n');
console.log('Extracted modal bodies',modalBodySpecs.map(s=>[s.id,s.bytecode.length,s.instructions.length]));
