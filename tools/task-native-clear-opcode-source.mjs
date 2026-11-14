import {readFile,writeFile} from 'node:fs/promises';import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {decodeTaskWindows,taskRomHash,taskHash} from './task-partial-source.mjs';import {loadTaskNativeBlock} from './task-native-catalog.mjs';
import {proveOpcodeBinding,opcodeDispatchWindow} from './task-opcode-source.mjs';import {taskOpcodeSpecs} from './task-opcode-specs.mjs';
import {clearFF79Windows,proveTaskClearFF79} from './task-native-clear-ff79-source.mjs';
export const nativeA7Anchors=[{kind:'pointer',start:0x82D906,hex:'79FF'},
 {kind:'argument-metadata',start:0x82DAF3,hex:'0001'},{kind:'return-metadata',start:0x82DA17,hex:'0000'}];
export async function proveTaskNativeA7(bytes){
 const slot=await proveOpcodeBinding(bytes,taskOpcodeSpecs.find(s=>s.opcode===0x58)),parts=[];
 for(const name of ['native-arguments','native-bridge','native-dispatch','native-resume']){
  const path=`analysis/render-task-${name}.json`,source=JSON.parse(await readFile(path));if(source.rom_sha256!==taskRomHash)throw Error('A7 dependency ROM drift');
  const windows=source.windows.map(w=>({start:parseInt(w.entry.replace(':',''),16),hex:w.machine_bytes}));
  for(const w of windows){const off=cpuToOffset(w.start,bytes.length);if(bytes.subarray(off,off+w.hex.length/2).toString('hex').toUpperCase()!==w.hex)throw Error('A7 dependency source drift');}
  const block=await loadTaskNativeBlock(name),proof=block.proveSource(decodeTaskWindows(bytes,windows).map,block.entries[0]);
  if(JSON.stringify(proof)!==JSON.stringify(source[block.proofField]?.find(p=>p.entry===proof.entry))||proof.external_return_assumptions!==0)throw Error('A7 dependency proof drift');
  parts.push({source_contract:path,windows:source.windows,proof});
 }
 const anchors=nativeA7Anchors.map(a=>{const off=cpuToOffset(a.start,bytes.length),raw=bytes.subarray(off,off+2);
  if(raw.toString('hex').toUpperCase()!==a.hex)throw Error('Original A7 anchor drift');return {kind:a.kind,entry:cpuLabel(a.start),machine_bytes:a.hex,sha256:taskHash(raw)};});
 const decoded=decodeTaskWindows(bytes,clearFF79Windows()),callee=proveTaskClearFF79(decoded.map),saved=JSON.parse(await readFile('analysis/render-task-native-clear-ff79.json'));
 if(saved.rom_sha256!==taskRomHash||JSON.stringify(saved.proofs)!==JSON.stringify([callee]))throw Error('A7 full callee proof drift');
 return {entry:'80:F390',native_binding:false,local_source_complete:true,source_closed_to_dispatch:true,full_graph_closed:false,
  full_task_binding:false,global_stack_minimum:null,minimum_protected_stack_bytes:null,external_return_assumptions:0,
  opcode:0x58,target:'80:F4CB',slot:slot.slot,argument_prefix:slot.handler_proof,parts,
  admitted_targets:[{name:'native-clear-ff79',id:0xA7,target:'80:FF79',anchors,source_contract:'analysis/render-task-native-clear-ff79.json',windows:decoded.windows,proof:callee}],
  output_mode:{e:0,m:0,x:0},
  joins:[{from:'80:F390',to:'80:F4CB',kind:'full WORD X58 and actual original F4CB slot'},
   {from:'80:F4CB',to:'80:F4F6',kind:'original argument0100 WORD including ignored high; zero actual WORDpops, fresh A7 ID'},
   {from:'80:F506',to:'80:F52F',kind:'real high/low F508 JSR after actual TCS/D0/PEA/PLB'},
   {from:'80:F52F',to:'80:FF79',kind:'fresh original FF79 table WORD and independently fresh A2 after stackstores'},
   {from:'80:FF97',to:'80:F509',kind:'actual fresh F508 RTS, E0M0X0D0 DBR80'},
   {from:'80:F509',to:'80:F390',kind:'fresh Task D/DBR/S/A7-ID/original0000 returnmetadata/no PHA/PC/pointer/opcode'}],
  ownership:'One owner/provider/work/output/IO/wait ledger and outer commit. Actual operand and migrated outer stack, mixed inner frames, PHX/PLX and root RTS remain fresh. FF79 STZ actualDBR0200 may replace a Taskframe pointer; never cache or infer preservation. No whole Task stack minimum.',
  observations:'Each AF1F hardware result and each reached ACAF WORD01F8 poll is an independently frozen chronological record. Future, missing, wrong, reused or unused samples reject all current-plan effects; no device/division/wait/timing equation inferred.',
  boundary:'One observed whole original Native58/A7 call through FF79 and real F509 before next indexed dispatch. Whole original body, original initialization/caller/scene/frame lifecycle remain separate.'};
}
export async function emitTaskNativeA7(){
 const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong European ROM');
 const proof=await proveTaskNativeA7(bytes),dispatch=decodeTaskWindows(bytes,[opcodeDispatchWindow]).windows;
 const windows=[...dispatch,...proof.parts.flatMap(p=>p.windows),...proof.admitted_targets[0].windows].filter((w,n,all)=>all.findIndex(p=>p.entry===w.entry)===n);
 await writeFile('analysis/render-task-native-opcode-ff79.json',JSON.stringify({rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',windows,proofs:[proof],
  source_graph:{native_binding:false,local_source_complete:true,source_closed_to_dispatch:true,full_graph_closed:false,full_task_binding:false,
   code_bytes:windows.reduce((n,w)=>n+w.covered_bytes,0)},completed_script_bodies:0},null,2)+'\n');
 console.log('Original Native58/A7: zero actual pops, whole FF79/28 stackbytes, fresh F508/A7-ID0000/F509/F390.');return proof;
}
