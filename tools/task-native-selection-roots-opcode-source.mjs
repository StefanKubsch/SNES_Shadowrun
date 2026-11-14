import {readFile,writeFile} from 'node:fs/promises';import {inspectRom} from './rom.mjs';
import {taskRomHash,decodeTaskWindows} from './task-partial-source.mjs';import {renew} from './task-native-opcode-source.mjs';
import {proveOpcodeBinding,opcodeDispatchWindow} from './task-opcode-source.mjs';import {taskOpcodeSpecs} from './task-opcode-specs.mjs';
import {selectionRoots} from './task-native-933a-bba0-specs.mjs';import {selectionRootSource} from './task-native-selection-roots-source.mjs';
export async function proveSelectionOpcode(bytes,id){const spec=selectionRoots.find(s=>s.id===id);if(!spec)throw Error('Unproved selection Native');
 const slot=await proveOpcodeBinding(bytes,taskOpcodeSpecs.find(s=>s.opcode===0x58)),parts=[];
 for(const name of ['native-arguments','native-bridge','native-dispatch','native-resume'])parts.push(await renew(bytes,name));
 const source=await selectionRootSource(bytes,spec),saved=JSON.parse(await readFile(`analysis/render-task-${spec.name}.json`));
 if(JSON.stringify(saved)!==JSON.stringify(source))throw Error('Selection whole source drift');
 return {entry:'80:F390',native_binding:false,local_source_complete:true,source_closed_to_dispatch:true,full_graph_closed:false,
  full_task_binding:false,global_stack_minimum:null,minimum_protected_stack_bytes:null,external_return_assumptions:0,
  opcode:0x58,target:'80:F4CB',slot:slot.slot,argument_prefix:slot.handler_proof,parts,
  admitted_targets:[{name:spec.name,id,target:source.proofs[0].entry,anchors:source.anchors,windows:source.windows,
   source_contract:`analysis/render-task-${spec.name}.json`,proof:source.proofs[0],helpers:source.helpers,tables:source.tables}],output_mode:{e:0,m:0,x:0},
  joins:[{from:'80:F390',to:'80:F4CB',kind:'originalWORD58 dispatch and freshly observed ID'},
   {from:'80:F4CB',to:'80:F4F6',kind:'actual one WORDpop and original0201 metadata including high'},
   {from:'80:F52F',to:source.proofs[0].entry,kind:'actualF508 and freshA2 after original bridge stores'},
   {from:source.proofs[0].entry,to:'80:F509',kind:'whole independently renewed root, actual matchingF508 RTS E0M0X0D0/DBR80'},
   {from:'80:F509',to:'80:F390',kind:'fresh savedID/0000 WORDreturn metadata, zero result-push and actualframePC/opcode'}],
  ownership:'One owner/ledger/budget/outer commit, source and argument/metadata highs fresh. Whole typed graph does not license stale saved data or helper/outer stack aliases.',
  boundary:'One original Native58 composition before next dispatch; explicit caller/physical source/product/wait records. No automatic Task/initialization/device/time/scene/frame execution.'};}
export async function emitSelectionOpcodes(){const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong ROM');
 for(const s of selectionRoots){const proof=await proveSelectionOpcode(bytes,s.id),windows=[...decodeTaskWindows(bytes,[opcodeDispatchWindow]).windows,
  ...proof.parts.flatMap(p=>p.windows),...proof.admitted_targets[0].windows];
  await writeFile(`analysis/render-task-native-opcode-${s.name.slice(7)}.json`,JSON.stringify({rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',
   windows,proofs:[proof],source_graph:{native_binding:false,local_source_complete:true,source_closed_to_dispatch:true,full_graph_closed:false,full_task_binding:false},completed_script_bodies:0},null,2)+'\n');}}
