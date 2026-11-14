import {readFile,writeFile} from 'node:fs/promises';import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {decodeTaskWindows,taskRomHash,taskHash} from './task-partial-source.mjs';import {loadTaskNativeBlock} from './task-native-catalog.mjs';
import {proveOpcodeBinding,opcodeDispatchWindow} from './task-opcode-source.mjs';import {taskOpcodeSpecs} from './task-opcode-specs.mjs';
import {decodeSource,proveTaskInputWaitF953} from './task-native-input-wait-f953-source.mjs';
export const nativeA3Anchors=[{kind:'pointer',start:0x82D8FE,hex:'53F9'},
 {kind:'argument-metadata',start:0x82DAEF,hex:'0001'},{kind:'return-metadata',start:0x82DA13,hex:'0002'}];
export async function proveTaskNativeA3(bytes){
 const slot=await proveOpcodeBinding(bytes,taskOpcodeSpecs.find(s=>s.opcode===0x58)),parts=[];
 for(const name of ['native-arguments','native-bridge','native-dispatch','native-resume']){
  const path=`analysis/render-task-${name}.json`,source=JSON.parse(await readFile(path));if(source.rom_sha256!==taskRomHash)throw Error('A3 dependency ROM drift');
  const windows=source.windows.map(w=>({start:parseInt(w.entry.replace(':',''),16),hex:w.machine_bytes}));
  for(const w of windows){const off=cpuToOffset(w.start,bytes.length);if(bytes.subarray(off,off+w.hex.length/2).toString('hex').toUpperCase()!==w.hex)throw Error('A3 dependency source drift');}
  const block=await loadTaskNativeBlock(name),proof=block.proveSource(decodeTaskWindows(bytes,windows).map,block.entries[0]);
  if(JSON.stringify(proof)!==JSON.stringify(source[block.proofField]?.find(p=>p.entry===proof.entry))||proof.external_return_assumptions!==0)throw Error('A3 dependency proof drift');
  parts.push({source_contract:path,windows:source.windows,proof});
 }
 const anchors=nativeA3Anchors.map(a=>{const off=cpuToOffset(a.start,bytes.length),raw=bytes.subarray(off,off+2);
  if(raw.toString('hex').toUpperCase()!==a.hex)throw Error('Original A3 anchor drift');return {kind:a.kind,entry:cpuLabel(a.start),machine_bytes:a.hex,sha256:taskHash(raw)};});
 const decoded=decodeSource(bytes),callee=proveTaskInputWaitF953(decoded.map),saved=JSON.parse(await readFile('analysis/render-task-native-input-wait-f953.json'));
 if(saved.rom_sha256!==taskRomHash||JSON.stringify(saved.proofs)!==JSON.stringify([callee]))throw Error('A3 full callee proof drift');
 return {entry:'80:F390',native_binding:false,local_source_complete:true,source_closed_to_dispatch:true,full_graph_closed:false,
  full_task_binding:false,global_stack_minimum:null,minimum_protected_stack_bytes:null,external_return_assumptions:0,
  opcode:0x58,target:'80:F4CB',slot:slot.slot,argument_prefix:slot.handler_proof,parts,
  admitted_targets:[{name:'native-input-wait-f953',id:0xA3,target:'80:F953',anchors,source_contract:'analysis/render-task-native-input-wait-f953.json',windows:decoded.windows,proof:callee}],
  output_mode:{e:0,m:0,x:0},
  joins:[{from:'80:F390',to:'80:F4CB',kind:'full WORD X58 and actual original F4CB slot'},
   {from:'80:F4CB',to:'80:F4F6',kind:'original argument0100 WORD including ignored high; zero actual WORDpops, fresh A3 ID'},
   {from:'80:F506',to:'80:F52F',kind:'real high/low F508 JSR after actual TCS/D0/PEA/PLB'},
   {from:'80:F52F',to:'80:F953',kind:'fresh original F953 table WORD and independently fresh A2 after stackstores'},
   {from:'80:F962',to:'80:F509',kind:'actual fresh F508 RTS after conditional normal F953, E0M0X0D0 DBR80'},
   {from:'80:F509',to:'80:F390',kind:'fresh Task D/DBR/S/A3-ID/original0200 returnmetadata/no PHA/PC/pointer/opcode'}],
  ownership:'One owner/provider/work/output/wait/input ledger and outer commit. Actual operand/migrated stack and real counter-JSL/input-JSR/RTL/RTS bytes remain fresh; no whole Task minimum or helper returning summary.',
  observations:'Each reached B0A5 counter WORD poll is frozen independently. Optional input observation at actual9E1A precedes three fresh original held reads; counter samples never supply input/time/frames. Missing/wrong/reordered/unused records reject the current plan. Reset3030 rejects all effects.',
  boundary:'One observed whole original Native58/A3 call through F953 and real F509 before next indexed dispatch. Whole original body, original initialization/caller/scene/frame lifecycle remain separate.'};
}
export async function emitTaskNativeA3(){
 const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong European ROM');
 const proof=await proveTaskNativeA3(bytes),dispatch=decodeTaskWindows(bytes,[opcodeDispatchWindow]).windows;
 const windows=[...dispatch,...proof.parts.flatMap(p=>p.windows),...proof.admitted_targets[0].windows].filter((w,n,all)=>all.findIndex(p=>p.entry===w.entry)===n);
 await writeFile('analysis/render-task-native-opcode-f953.json',JSON.stringify({rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',windows,proofs:[proof],
  source_graph:{native_binding:false,local_source_complete:true,source_closed_to_dispatch:true,full_graph_closed:false,full_task_binding:false,
   code_bytes:windows.reduce((n,w)=>n+w.covered_bytes,0)},completed_script_bodies:0},null,2)+'\n');
 console.log('Original Native58/A3: zero actual pops, whole conditional F953/5 stackbytes, fresh F508/A3-ID0200/F509/F390.');return proof;
}
