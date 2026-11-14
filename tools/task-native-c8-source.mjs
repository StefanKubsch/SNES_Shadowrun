import {readFile,writeFile} from 'node:fs/promises';import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {decodeTaskWindows,taskRomHash,taskHash} from './task-partial-source.mjs';import {loadTaskNativeBlock} from './task-native-catalog.mjs';
import {proveOpcodeBinding,opcodeDispatchWindow} from './task-opcode-source.mjs';import {taskOpcodeSpecs} from './task-opcode-specs.mjs';
import {fec1Windows,proveTaskFEC1} from './task-native-fec1-source.mjs';
export const nativeC8Anchors=[{kind:'pointer',start:0x82D948,hex:'C1FE'},
 {kind:'argument-metadata',start:0x82DB14,hex:'0700'},{kind:'return-metadata',start:0x82DA38,hex:'0000'}];
export async function proveTaskNativeC8(bytes){
 const slot=await proveOpcodeBinding(bytes,taskOpcodeSpecs.find(s=>s.opcode===0x58)),parts=[];
 for(const name of ['native-arguments','native-bridge','native-dispatch','native-resume']){
  const path=`analysis/render-task-${name}.json`,source=JSON.parse(await readFile(path));if(source.rom_sha256!==taskRomHash)throw Error('C8 dependency ROM drift');
  const windows=source.windows.map(w=>({start:parseInt(w.entry.replace(':',''),16),hex:w.machine_bytes}));
  for(const w of windows){const off=cpuToOffset(w.start,bytes.length);if(bytes.subarray(off,off+w.hex.length/2).toString('hex').toUpperCase()!==w.hex)throw Error('C8 dependency source drift');}
  const block=await loadTaskNativeBlock(name),proof=block.proveSource(decodeTaskWindows(bytes,windows).map,block.entries[0]);
  if(JSON.stringify(proof)!==JSON.stringify(source[block.proofField]?.find(p=>p.entry===proof.entry))||proof.external_return_assumptions!==0)throw Error('C8 dependency proof drift');
  parts.push({source_contract:path,windows:source.windows,proof});
 }
 const anchors=nativeC8Anchors.map(a=>{const off=cpuToOffset(a.start,bytes.length),raw=bytes.subarray(off,off+2);
  if(raw.toString('hex').toUpperCase()!==a.hex)throw Error('Original C8 anchor drift');return {kind:a.kind,entry:cpuLabel(a.start),machine_bytes:a.hex,sha256:taskHash(raw)};});
 const decoded=decodeTaskWindows(bytes,fec1Windows()),callee=proveTaskFEC1(decoded.map),saved=JSON.parse(await readFile('analysis/render-task-native-fec1.json'));
 if(saved.rom_sha256!==taskRomHash||JSON.stringify(saved.proofs)!==JSON.stringify([callee]))throw Error('C8 full callee proof drift');
 return {entry:'80:F390',native_binding:false,local_source_complete:true,source_closed_to_dispatch:true,full_graph_closed:false,
  full_task_binding:false,global_stack_minimum:null,minimum_protected_stack_bytes:null,external_return_assumptions:0,
  opcode:0x58,target:'80:F4CB',slot:slot.slot,argument_prefix:slot.handler_proof,parts,
  admitted_targets:[{name:'native-fec1',id:0xC8,target:'80:FEC1',anchors,source_contract:'analysis/render-task-native-fec1.json',windows:decoded.windows,proof:callee}],
  output_mode:{e:0,m:0,x:0},
  joins:[{from:'80:F390',to:'80:F4CB',kind:'full WORD X58 and actual original CBF4 slot'},
   {from:'80:F4CB',to:'80:F4F6',kind:'seven actual argument WORDpops and fresh original C8 ID/metadata'},
   {from:'80:F506',to:'80:F52F',kind:'real high/low F508 JSR bytes after actual TCS/D0/PEA/PLB'},
   {from:'80:F52F',to:'80:FEC1',kind:'fresh original FEC1 table WORD and separately fresh A2 after stackstores'},
   {from:'80:FF13',to:'80:F509',kind:'actual fresh F508 RTS, E0M0X0D0 DBR80'},
   {from:'80:F509',to:'80:F390',kind:'fresh Task D/DBR/S/C8-ID/original0000 returnmetadata/PC/pointer/opcode'}],
  ownership:'One explicit owner/ledger/outer commit. Native operand stack and migrated outer stack are distinct actual owners; protected outer bytes are revalidated before/after native migration. Real FEC1 inner stack/data/aliases and original C8 metadata must remain fresh. No global stack minimum inferred.',
  observations:'Every original native device PC and actual F6/F8/FA/FC poll consumes one separately frozen chronological record; no result calculation, stable division or timing assumption. Missing/wrong/unused events reject all effects.',
  boundary:'Exactly one observed original Native58/C8 invocation through complete FEC1 and actual F509, stopping before the next indexed dispatch. Whole original C8 scriptbodies, Script52/Child33D/readiness/parent lifecycle, original initialization, wholeTask/9178/device/scene/frame execution remain separate.'};
}
export async function emitTaskNativeC8(){
 const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong European ROM');
 const proof=await proveTaskNativeC8(bytes),dispatch=decodeTaskWindows(bytes,[opcodeDispatchWindow]).windows;
 const windows=[...dispatch,...proof.parts.flatMap(p=>p.windows),...proof.admitted_targets[0].windows];
 const unique=windows.filter((w,n)=>windows.findIndex(p=>p.entry===w.entry)===n);
 await writeFile('analysis/render-task-native-opcode-fec1.json',JSON.stringify({rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',
  windows:unique,proofs:[proof],source_graph:{native_binding:false,local_source_complete:true,source_closed_to_dispatch:true,
   full_graph_closed:false,full_task_binding:false,code_bytes:unique.reduce((n,w)=>n+w.covered_bytes,0)},completed_script_bodies:0},null,2)+'\n');
 console.log('Original Native58/C8: seven actual arguments, full native FEC1/32 stackbytes, fresh F508/ID0000/F509/F390 and one owner/commit.');return proof;
}
