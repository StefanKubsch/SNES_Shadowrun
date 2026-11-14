import {readFile,writeFile} from 'node:fs/promises';
import {inspectRom} from './rom.mjs';import {taskRomHash,decodeTaskWindows} from './task-partial-source.mjs';
import {renew} from './task-native-opcode-source.mjs';
import {proveOpcodeBinding,opcodeDispatchWindow} from './task-opcode-source.mjs';import {taskOpcodeSpecs} from './task-opcode-specs.mjs';
import {source8E36} from './task-native-8e36-source.mjs';
export async function proveTaskNative7C(bytes){
 const slot=await proveOpcodeBinding(bytes,taskOpcodeSpecs.find(s=>s.opcode===0x58)),parts=[];
 for(const name of ['native-arguments','native-bridge','native-dispatch','native-resume'])parts.push(await renew(bytes,name));
 const source=await source8E36(bytes),saved=JSON.parse(await readFile('analysis/render-task-native-8e36.json'));
 if(JSON.stringify(saved)!==JSON.stringify(source))throw Error('7C whole source drift');
 const windows=[...source.windows,...source.helpers.flatMap(h=>h.windows)].filter((w,n,all)=>all.findIndex(p=>p.entry===w.entry)===n);
 return {entry:'80:F390',native_binding:false,local_source_complete:true,source_closed_to_dispatch:true,full_graph_closed:false,
  full_task_binding:false,global_stack_minimum:null,minimum_protected_stack_bytes:null,external_return_assumptions:0,
  opcode:0x58,target:'80:F4CB',slot:slot.slot,argument_prefix:slot.handler_proof,parts,
  admitted_targets:[{name:'native-8e36',id:0x7C,target:'80:8E36',anchors:source.anchors,
   source_contract:'analysis/render-task-native-8e36.json',windows,proof:source.proofs[0],helpers:source.helpers,tables:source.tables}],
  output_mode:{e:0,m:0,x:0},joins:[
   {from:'80:F390',to:'80:F4CB',kind:'full WORDX58, originalF30C/CBF4 dispatch'},
   {from:'80:F4CB',to:'80:F4F6',kind:'two real WORDpops, fresh7C-ID and original0205 metadata including high'},
   {from:'80:F52F',to:'80:8E36',kind:'actualF508 JSR and fresh368E/A2 after stack writes'},
   {from:'80:8E95',to:'80:F509',kind:'actual freshF508 RTS,32byte conditional native graph, DBR80/M0X0D0'},
   {from:'80:F509',to:'80:F390',kind:'fresh7C-ID and original0200 returnmetadata, resultWORD-PHA/frame/PC/opcode'}],
  ownership:'One cumulative ledger/provider/window/budget/outer commit; actual PHX/PHY/PEI/PHA and nested mixed returns remain fresh. BYTE/WORD86C4 follows actual mode and original LDX-NZ. No source/table/metadata-high/caller/alias caches.',
  boundary:'Exactly one observed originalNative58/7C, whole conditional local/transitive graph through actualF509, stop before next dispatch. Reset3030 and altered audio root return reject all effects. Original initialization/automaticTask/scene/frame/device/time boundaries remain separate.'};
}
export async function emitTaskNative7C(){const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong ROM');
 const proof=await proveTaskNative7C(bytes),windows=[...decodeTaskWindows(bytes,[opcodeDispatchWindow]).windows,...proof.parts.flatMap(p=>p.windows),...proof.admitted_targets[0].windows]
  .filter((w,n,all)=>all.findIndex(p=>p.entry===w.entry)===n);
 await writeFile('analysis/render-task-native-opcode-8e36.json',JSON.stringify({rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',windows,
  proofs:[proof],source_graph:{native_binding:false,local_source_complete:true,source_closed_to_dispatch:true,full_graph_closed:false,full_task_binding:false},completed_script_bodies:0},null,2)+'\n');}
