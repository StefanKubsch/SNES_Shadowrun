import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {decode,formatBlock} from './disassemble.mjs';
import {scriptOpcodes} from '../src/script/opcodes.mjs';
import {proveStateSignToDispatch,describeStateSignOwners,stateSignWindow} from './render-task-state-sign-extension-source-proof.mjs';
import {taskFetchWindow} from './pinned-task-source.mjs';
const {bytes,metadata}=inspectRom(await readFile(process.argv[2]??'Shadowrun (E).smc'));
if(metadata.rom_sha256!=='91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690')throw Error('Wrong European ROM');
const sha=b=>createHash('sha256').update(b).digest('hex'),blocks=[],windows=[],map=new Map();
for(const [name,w]of [['state0EF90F',stateSignWindow],['fetchF389',taskFetchWindow]]){const instructions=[];for(let pc=w.start;pc<w.start+w.hex.length/2;){const i=decode(bytes,pc,{e:0,m:0,x:0});instructions.push(i);map.set(pc,i);pc=i.next;}
  const raw=Buffer.concat(instructions.map(i=>i.raw));blocks.push({entry:w.start,initialState:{e:0,m:0,x:0},instructions,stop:'Both finite branch paths close only to dynamicF390; no CPU execution.'});windows.push({name,entry:cpuLabel(w.start),end_exclusive:cpuLabel(w.start+raw.length),covered_bytes:raw.length,instruction_count:instructions.length,sha256:sha(raw),machine_bytes:raw.toString('hex').toUpperCase()});}
const off=cpuToOffset(0x80F2C2,bytes.length),table=bytes.subarray(off,off+2);if(table.readUInt16LE()!==0xF90F||scriptOpcodes[0x0E].handler!==0xF90F)throw Error('Original0E table drift');
const proofs=[proveStateSignToDispatch(map)],dependencies=[];
for(const [path,entry]of [['analysis/render-task-state-reads.json','80:F8E4'],['analysis/render-task-sign-extension.json','80:F3F6']]){const r=JSON.parse(await readFile(path,'utf8'));if(r.rom_sha256!==metadata.rom_sha256)throw Error('Dependency ROM drift');dependencies.push({source:path,entry,qualification:'Only pure address/value equations reused; own0E source/proof independently pinned.'});}
const report={rom_sha256:metadata.rom_sha256,progress_reference:'docs/PORTIERUNGSSTAND.json',windows,proofs,
  source_graph:{source_closed_to_dispatch:true,full_graph_closed:false,native_binding:false,code_bytes:34,instructions:16,minimum_protected_stack_bytes:null},dependencies,
  dispatch_entries:[{opcode:14,word_source:'80:F2C2',target:'80:F90F',machine_bytes:table.toString('hex').toUpperCase(),sha256:sha(table)}],
  synthetic_examples:[{d:0x3D6,bank:0x9D,s:0x3F0,y:65535,pointerBefore:0xA001,pointerAfter:0xA001,offsetWord:65535,stateWord:0xAB00},{d:0x3D6,bank:0x80,s:0x3D7,y:4,pointerBefore:0x1200,pointerAfter:0xFF80,offsetWord:0x3E9,stateWord:0xAB80}].map(describeStateSignOwners),
  host_boundary:'0E remains unsupported and stopsbeforehoststateeffects; no runtime/native promotion. FullC1CA/9178/BF3B/globalstack/taskbyte owners remain open.'};
await writeFile('analysis/render-task-state-sign-extension.json',JSON.stringify(report,null,2)+'\n');await writeFile('analysis/render-task-state-sign-extension.asm.txt',blocks.map(formatBlock).join('\n'));console.log('0E source34/16; paths15/16, fullWORD StateHigh andactualCMP flags; dynamicreturn OPEN.');
