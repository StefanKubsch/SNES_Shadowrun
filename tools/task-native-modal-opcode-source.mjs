import {readFile,writeFile} from 'node:fs/promises';import {inspectRom} from './rom.mjs';import {taskRomHash,decodeTaskWindows} from './task-partial-source.mjs';
import {renew} from './task-native-opcode-source.mjs';import {proveOpcodeBinding,opcodeDispatchWindow} from './task-opcode-source.mjs';import {taskOpcodeSpecs} from './task-opcode-specs.mjs';
import {modalSpecs} from './task-native-modal-specs.mjs';import {modalSource} from './task-native-modal-source.mjs';
export async function proveModalOpcode(bytes,id){const s=modalSpecs.find(s=>s.id===id);if(!s)throw Error('Unproved modal Native');
 const slot=await proveOpcodeBinding(bytes,taskOpcodeSpecs.find(s=>s.opcode===0x58)),parts=[];
 for(const name of ['native-arguments','native-bridge','native-dispatch','native-resume'])parts.push(await renew(bytes,name));
 const source=await modalSource(bytes,s),saved=JSON.parse(await readFile(`analysis/render-task-${s.name}.json`));if(JSON.stringify(source)!==JSON.stringify(saved))throw Error('Modal whole source drift');
 return {entry:'80:F390',native_binding:false,local_source_complete:true,source_closed_to_dispatch:true,full_graph_closed:false,
  full_task_binding:false,global_stack_minimum:null,minimum_protected_stack_bytes:null,external_return_assumptions:0,opcode:0x58,target:'80:F4CB',slot:slot.slot,argument_prefix:slot.handler_proof,parts,
  admitted_targets:[{name:s.name,id,target:source.proofs[0].entry,anchors:source.anchors,windows:source.windows,source_contract:`analysis/render-task-${s.name}.json`,
   proof:source.proofs[0],helpers:source.helpers,tables:source.tables}],output_mode:{e:0,m:0,x:0},
  joins:[{from:'80:F390',to:'80:F4CB',kind:'originalWORD58 dispatch and freshID'},
   {from:'80:F4CB',to:'80:F4F6',kind:'actual originalWORDpops and full argumentmetadata including high'},
   {from:'80:F52F',to:source.proofs[0].entry,kind:'actualF508 and freshA2 after actual bridge stores'},
   {from:source.proofs[0].entry,to:'80:F509',kind:'whole own normal root and independently renewed helpers, actual matchingF508 RTS E0M0X0D0/DBR80'},
   {from:'80:F509',to:'80:F390',kind:'fresh savedID/full returnmetadata/actual resultPHA condition/framePC/pointer/opcode'}],
  ownership:'One private provider/physical ledger/budget/outer commit. No cached selector/choice/PEA/DP/table/ID/return-high/context aliases; global chronological MMIO/wait/input records where actually reached.',
  boundary:'Native72 conditional normal menu retains actual reset3030 and zeroVoice alternateRTS boundaries; all failures reject complete current plan. Other three roots are whole graphs. No initialized caller/record/window/device/time/Task/scene/frame.'};}
export async function emitModalOpcodes(){const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong ROM');
 for(const s of modalSpecs){const proof=await proveModalOpcode(bytes,s.id),windows=[...decodeTaskWindows(bytes,[opcodeDispatchWindow]).windows,...proof.parts.flatMap(p=>p.windows),...proof.admitted_targets[0].windows];
  await writeFile(`analysis/render-task-native-opcode-${s.name.slice(7)}.json`,JSON.stringify({rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',windows,proofs:[proof],
   source_graph:{native_binding:false,local_source_complete:true,source_closed_to_dispatch:true,full_graph_closed:false,full_task_binding:false},completed_script_bodies:0},null,2)+'\n');}}
