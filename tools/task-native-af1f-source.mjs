import {readFile,writeFile} from 'node:fs/promises';import {inspectRom,cpuLabel} from './rom.mjs';
import {decodeTaskWindows,taskRomHash} from './task-partial-source.mjs';import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';import {formatBlock} from './disassemble.mjs';import {taskAF1FSpec as spec} from './task-native-af1f-spec.mjs';
export function proveTaskAF1F(map){
 assertPinnedTaskSource(map,spec.windows);const proof=proveWordStack(map,spec.entry,'RTL',{measureStack:true});
 if(proof.reachable_instructions!==map.size||proof.external_return_assumptions||proof.minimum_protected_stack_bytes!==5
  ||proof.maximum_local_stack_bytes!==2||proof.returns.some(r=>r.m!==0||r.x!==0||r.dbr!=='entry'))throw Error('AF1F source/stack/mode drift');
 return {...proof,native_binding:false,local_source_complete:true,full_graph_closed:true,full_task_binding:false,global_stack_minimum:null,
  root_return:'RTL',return_target_executed:false,
  device_reads:[0x81AF56,0x81AF73,0x81AFC9,0x81AFCE,0x81AFEC,0x81B009,0x81B016].map(pc=>{
   const i=map.get(pc);return {at:cpuLabel(pc),operation:i.mnemonic,offset:i.value,width:2};}),
  qualification:'Entire independently pinned AF1F WORD overlay including zero/negative gates and all active branches, actual PHX/PLX and root RTL. Original full WORD DO-loop counts, actual DBR device/data owners and fresh absolute result WORDs at each original PC. Quotients/remainders are independent chronological observations, never calculated or cached across stores/dividends. Full WORD table pointers/values read before masking, original ADC/SBC/ASL/DEC/LDY/CMP flags, binary arithmetic and one private provider/work/output/commit required. No initialization, uninterrupted timing assumption, device execution, A9B2/9F49/AD92/FEC1/Native58/Task/scene/frame binding or complete body claim.'};
}
export async function emitTaskAF1F(){
 const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong European ROM');
 const {map,blocks,windows}=decodeTaskWindows(bytes,spec.windows),proof=proveTaskAF1F(map),report={rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',
  windows,proofs:[proof],source_graph:{local_source_complete:true,native_binding:false,full_graph_closed:true,full_task_binding:false,
   code_bytes:windows.reduce((n,w)=>n+w.covered_bytes,0),instructions:map.size},completed_script_bodies:0};
 await writeFile('analysis/render-task-native-af1f.json',JSON.stringify(report,null,2)+'\n');
 await writeFile('analysis/render-task-native-af1f.asm.txt',blocks.map(formatBlock).join('\n'));
 console.log(`Task AF1F: ${report.source_graph.code_bytes}/${map.size}, full RTL/active graph and five stackbytes; no calculated hardware results.`);return report;
}
