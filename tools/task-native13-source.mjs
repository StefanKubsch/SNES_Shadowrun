import {readFile,writeFile} from 'node:fs/promises';import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {decodeTaskWindows,taskRomHash,taskHash} from './task-partial-source.mjs';import {loadTaskNativeBlock} from './task-native-catalog.mjs';
import {proveOpcodeBinding,opcodeDispatchWindow} from './task-opcode-source.mjs';import {taskOpcodeSpecs} from './task-opcode-specs.mjs';
import {decodeSource,prove} from './render-task-native-actions-source-proof.mjs';
export const native13Anchors=[{kind:'pointer',start:0x82D7DE,hex:'A09B'},
 {kind:'argument-metadata',start:0x82DA5F,hex:'0102'},{kind:'return-metadata',start:0x82D983,hex:'0200'}];
export async function proveTaskNative13(bytes){
 const slot=await proveOpcodeBinding(bytes,taskOpcodeSpecs.find(s=>s.opcode===0x58)),parts=[];
 for(const name of ['native-arguments','native-bridge','native-dispatch','native-resume']){
  const path=`analysis/render-task-${name}.json`,source=JSON.parse(await readFile(path));if(source.rom_sha256!==taskRomHash)throw Error('Native13 dependency ROM drift');
  const windows=source.windows.map(w=>({start:parseInt(w.entry.replace(':',''),16),hex:w.machine_bytes}));
  for(const w of windows){const off=cpuToOffset(w.start,bytes.length);if(bytes.subarray(off,off+w.hex.length/2).toString('hex').toUpperCase()!==w.hex)throw Error('Native13 dependency source drift');}
  const block=await loadTaskNativeBlock(name),proof=block.proveSource(decodeTaskWindows(bytes,windows).map,block.entries[0]);
  if(JSON.stringify(proof)!==JSON.stringify(source[block.proofField]?.find(p=>p.entry===proof.entry))||proof.external_return_assumptions!==0)throw Error('Native13 dependency proof drift');
  parts.push({source_contract:path,windows:source.windows,proof});
 }
 const anchors=native13Anchors.map(a=>{const off=cpuToOffset(a.start,bytes.length),raw=bytes.subarray(off,off+2);
  if(raw.toString('hex').toUpperCase()!==a.hex)throw Error('Original Native13 anchor drift');return {kind:a.kind,entry:cpuLabel(a.start),machine_bytes:a.hex,sha256:taskHash(raw)};});
 const decoded=decodeSource(bytes),callee=prove(decoded.map,0x809BA0),saved=JSON.parse(await readFile('analysis/render-task-native-actions.json'));
 if(saved.rom_sha256!==taskRomHash||JSON.stringify(saved.proofs.find(p=>p.entry==='80:9BA0'))!==JSON.stringify(callee))throw Error('Native13 full callee proof drift');
 return {entry:'80:F390',native_binding:false,local_source_complete:true,source_closed_to_dispatch:true,full_graph_closed:false,
  full_task_binding:false,global_stack_minimum:null,minimum_protected_stack_bytes:null,external_return_assumptions:0,
  opcode:0x58,target:'80:F4CB',slot:slot.slot,argument_prefix:slot.handler_proof,parts,
  admitted_targets:[{name:'native-actions',id:0x13,target:'80:9BA0',anchors,source_contract:'analysis/render-task-native-actions.json',windows:saved.windows,proof:callee}],
  output_mode:{e:0,m:0,x:0},
  joins:[{from:'80:F390',to:'80:F4CB',kind:'full WORD X58 and actual original CBF4 slot'},
   {from:'80:F4CB',to:'80:F4F6',kind:'one actual argument WORDpop, original0201 metadata and fresh13 ID'},
   {from:'80:F506',to:'80:F52F',kind:'real F508 JSR bytes after actual TCS/D0/PEA/PLB'},
   {from:'80:F52F',to:'80:9BA0',kind:'original9BA0 table WORD and freshA2 after actual stackstores'},
   {from:'80:9BAA',to:'80:F509',kind:'whole own99EB/menu/release, actual freshF508 RTS, E0M0X0D0 DBR80'},
   {from:'80:F509',to:'80:F390',kind:'fresh Task D/DBR/operandS/13-ID/original0002 returnmetadata/resultWORD-PHA/PC/pointer/opcode'}],
  ownership:'One physical owner/access/output/MMIO/wait/control ledger and outer commit. Actual separate operand/outer stacks, protected outer bytes before/after migration, real actions inner frames and freshly matching RTS. Source reset/nonroot return and all late failed owners/records/metadata/IDs/contexts withhold every effect; no global stack minimum inferred.',
  observations:'Chronological frozen original-PC/address/width/value MMIO, counter/wait and optional independent control records. No calculated device result, input capture, NMI, clock or stable division assumed.',
  boundary:'Exactly one observed original Native58/13 through the whole conditional normal9BA0/99EB graph and actualF509/result-PHA; stop before next indexed dispatch. Original body, Entity/caller/initialization/Task/9178/device/time/scene/frame execution remain separate.'};
}
export async function emitTaskNative13(){
 const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong European ROM');
 const proof=await proveTaskNative13(bytes),dispatch=decodeTaskWindows(bytes,[opcodeDispatchWindow]).windows;
 const windows=[...dispatch,...proof.parts.flatMap(p=>p.windows),...proof.admitted_targets[0].windows];
 const unique=windows.filter((w,n)=>windows.findIndex(p=>p.entry===w.entry)===n);
 await writeFile('analysis/render-task-native-opcode-9ba0.json',JSON.stringify({rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',
  windows:unique,proofs:[proof],source_graph:{native_binding:false,local_source_complete:true,source_closed_to_dispatch:true,
   full_graph_closed:false,full_task_binding:false,code_bytes:unique.reduce((n,w)=>n+w.covered_bytes,0)},completed_script_bodies:0},null,2)+'\n');
 console.log('Native58/13: original9BA0/0201/0002, whole own99EB, actualF508/F509/result-PHA/nextF390.');return proof;
}
