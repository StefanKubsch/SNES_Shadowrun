import {readFile,writeFile} from 'node:fs/promises';
import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {decodeTaskWindows,taskRomHash,taskHash} from './task-partial-source.mjs';
import {loadTaskNativeBlock} from './task-native-catalog.mjs';
import {proveOpcodeBinding,opcodeDispatchWindow} from './task-opcode-source.mjs';
import {taskOpcodeSpecs} from './task-opcode-specs.mjs';
import {decodeSource,prove} from './render-task-native-audio-compose-source-proof.mjs';
export const nativeAudioAnchors=[{kind:'pointer',start:0x82D850,hex:'6EC4'},
 {kind:'argument-metadata',start:0x82DA98,hex:'0401'},{kind:'return-metadata',start:0x82D9BC,hex:'0000'}];
export async function proveTaskNativeAudioOpcode(bytes){
 const slot=await proveOpcodeBinding(bytes,taskOpcodeSpecs.find(s=>s.opcode===0x58)),parts=[];
 for(const name of['native-arguments','native-bridge','native-dispatch','native-resume']){
  const path=`analysis/render-task-${name}.json`,source=JSON.parse(await readFile(path));
  if(source.rom_sha256!==taskRomHash)throw Error('Native4C dependency ROM drift');
  const windows=source.windows.map(w=>({start:parseInt(w.entry.replace(':',''),16),hex:w.machine_bytes}));
  for(const w of windows){const off=cpuToOffset(w.start,bytes.length);
   if(bytes.subarray(off,off+w.hex.length/2).toString('hex').toUpperCase()!==w.hex)throw Error('Native4C dependency source drift');}
  const block=await loadTaskNativeBlock(name),proof=block.proveSource(decodeTaskWindows(bytes,windows).map,block.entries[0]);
  if(JSON.stringify(proof)!==JSON.stringify(source[block.proofField]?.find(p=>p.entry===proof.entry))
   ||proof.external_return_assumptions!==0)throw Error('Native4C dependency proof drift');
  parts.push({source_contract:path,windows:source.windows,proof});
 }
 const anchors=nativeAudioAnchors.map(a=>{const off=cpuToOffset(a.start,bytes.length),raw=bytes.subarray(off,off+2);
  if(raw.toString('hex').toUpperCase()!==a.hex)throw Error('Original Native4C anchor drift');
  return {kind:a.kind,entry:cpuLabel(a.start),machine_bytes:a.hex,sha256:taskHash(raw)};});
 const callee=prove(decodeSource(bytes).map,0x80C46E),saved=JSON.parse(await readFile('analysis/render-task-native-audio-compose.json'));
 if(saved.rom_sha256!==taskRomHash||JSON.stringify(saved.proofs.find(p=>p.entry==='80:C46E'))!==JSON.stringify(callee))
  throw Error('Native4C full callee proof drift');
 return {entry:'80:F390',native_binding:false,local_source_complete:true,source_closed_to_dispatch:true,full_graph_closed:false,
  full_task_binding:false,global_stack_minimum:null,minimum_protected_stack_bytes:null,external_return_assumptions:0,
  opcode:0x58,target:'80:F4CB',slot:slot.slot,argument_prefix:slot.handler_proof,parts,
  admitted_targets:[{name:'native-audio-compose',id:0x4C,target:'80:C46E',anchors,
   source_contract:'analysis/render-task-native-audio-compose.json',windows:saved.windows,proof:callee}],
  output_mode:{e:0,m:0,x:0},
  joins:[{from:'80:F390',to:'80:F4CB',kind:'full WORD X58 and original CBF4 dispatch slot'},
   {from:'80:F4CB',to:'80:F4F6',kind:'four actual argument WORDpops, original0104 metadata and fresh4C ID'},
   {from:'80:F506',to:'80:F52F',kind:'actual F508 JSR bytes after TCS/D0/PEA/PLB'},
   {from:'80:F52F',to:'80:C46E',kind:'original C46E table WORD and freshA2 after actual stackstores'},
   {from:'80:C4B2',to:'80:F509',kind:'whole normal audio graph, real freshF508 RTS, E0M0X0D0 DBR80'},
   {from:'80:F509',to:'80:F390',kind:'fresh Task D/DBR/operandS/4C-ID/original0000 returnmetadata/PC/pointer/opcode; no result PHA'}],
  zero_voice_boundary:callee.zero_voice_boundary,
  ownership:'One physical owner/access/output/MMIO ledger and outer commit. Actual separate operand/outer stacks, protected bytes at migration and resume, whole audio inner frames with freshly matching RTS/RTL. All late source, metadata, context, budget, observation and return failures withhold every effect; no global stack minimum inferred.',
  observations:'Every BYTE2140 acknowledgement and BYTE4217 product is independently frozen with originalPC/actual address/width/value. No calculated APU reply, device result, timer or initialization.',
  boundary:'Exactly one observed original Native58/4C through the whole conditional normal C46E graph and actualF509; stop before next indexed dispatch. Zero voice reads saved sound rather than root RTS and remains an atomic boundary. Original bodies, caller/Entity/initialization/Task/9178/device/time/scene/frame execution remain separate.'};
}
export async function emitTaskNativeAudioOpcode(){
 const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));
 if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong European ROM');
 const proof=await proveTaskNativeAudioOpcode(bytes),dispatch=decodeTaskWindows(bytes,[opcodeDispatchWindow]).windows,
  windows=[...dispatch,...proof.parts.flatMap(p=>p.windows),...proof.admitted_targets[0].windows];
 const unique=windows.filter((w,n)=>windows.findIndex(p=>p.entry===w.entry)===n);
 await writeFile('analysis/render-task-native-opcode-c46e.json',JSON.stringify({rom_sha256:taskRomHash,
  progress_reference:'docs/PORTIERUNGSSTAND.json',windows:unique,proofs:[proof],
  source_graph:{native_binding:false,local_source_complete:true,source_closed_to_dispatch:true,
   full_graph_closed:false,full_task_binding:false,code_bytes:unique.reduce((n,w)=>n+w.covered_bytes,0)},completed_script_bodies:0},null,2)+'\n');
 console.log('Native58/4C: original C46E/0104/0000, whole normal audio, actualF508/F509/nextF390.');
 return proof;
}
