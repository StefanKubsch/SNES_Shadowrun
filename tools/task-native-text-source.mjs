import {readFile,writeFile} from 'node:fs/promises';
import {inspectRom,cpuLabel} from './rom.mjs';
import {decodeTaskWindows,taskRomHash} from './task-partial-source.mjs';
import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';import {formatBlock} from './disassemble.mjs';
import {taskTextSpecs} from './task-native-text-specs.mjs';

export function proveTaskTextRoot(map,spec){
 if(!taskTextSpecs.includes(spec))throw Error('Unproved text root');assertPinnedTaskSource(map,spec.windows);
 const proof=proveWordStack(map,spec.entry,'RTL',{measureStack:true});
 if(proof.external_return_assumptions||proof.reachable_instructions!==map.size
  ||proof.minimum_protected_stack_bytes!==spec.stackBytes||proof.maximum_local_stack_bytes!==spec.stackBytes-3
  ||proof.returns.some(r=>r.m!==0||r.x!==0||r.dbr!=='entry'))throw Error('Text root graph/stack/mode drift');
 return {...proof,native_binding:false,local_source_complete:true,full_graph_closed:true,full_task_binding:false,
  global_stack_minimum:null,root_return:'RTL',return_target_executed:false,
  stack_events:[...map.values()].filter(i=>['PHA','PLA','PHP','PLP','PHB','PEA','PLB','JSL','RTL'].includes(i.mnemonic))
   .map(i=>({at:cpuLabel(i.cpu),operation:i.mnemonic,value:i.value,bytes:i.mnemonic==='JSL'||i.mnemonic==='RTL'?3:
    ['PHA','PLA','PEA'].includes(i.mnemonic)?2:1,...(i.mnemonic==='JSL'?{target:cpuLabel(i.target),return_word:(i.next-1)&65535,return_bank:i.cpu>>>16}:{})})),
  device_reads:[...map.values()].filter(i=>[0x4214,0x4216].includes(i.value)&&['CMP','LDA','ADC'].includes(i.mnemonic))
   .map(i=>({at:cpuLabel(i.cpu),offset:i.value,width:i.state.m?1:2})),
  wait_reads:[...map.values()].filter(i=>[0x1FA,0x1FC].includes(i.value)&&i.mnemonic==='LDA')
   .map(i=>({at:cpuLabel(i.cpu),offset:i.value,width:2})),
  qualification:'Complete individually pinned text helper through typed root RTL, actual PHA/PLA/PHP/PLP/PHB/PEA/PLB and AE4C JSL/RTL when taken. Fresh bank00 DP0 and stack, full WORD X, actual restored DBR and return WORD/bank. BYTE changes preserve hidden HighA, WORD source owners read both bytes. Explicit chronological quotient/remainder/product MMIO observations at original PCs, no calculation/timing assumption. Binary ADC/SBC, intact owners and private access/output budgets; no complete FE69/FB39/FEC1/NativeC8/Native58/caller/Task/scene/frame binding or original scriptbody claim.'};
}
export async function emitTaskTextRoots(){
 const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong European ROM');
 const decoded=taskTextSpecs.map(s=>decodeTaskWindows(bytes,s.windows)),proofs=decoded.map((d,n)=>proveTaskTextRoot(d.map,taskTextSpecs[n]));
 const windows=[...new Map(decoded.flatMap(d=>d.windows).map(w=>[w.entry,w])).values()],report={rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',windows,proofs,
  source_graph:{local_source_complete:true,native_binding:false,full_graph_closed:true,full_task_binding:false,
   code_bytes:windows.reduce((n,w)=>n+w.covered_bytes,0),instructions:new Set(decoded.flatMap(d=>[...d.map.keys()])).size},completed_script_bodies:0};
 await writeFile('analysis/render-task-native-text-prerequisites.json',JSON.stringify(report,null,2)+'\n');
 await writeFile('analysis/render-task-native-text-prerequisites.asm.txt',[...new Map(decoded.flatMap(d=>d.blocks).map(b=>[b.entry,b])).values()].map(formatBlock).join('\n'));
 console.log(`Task text prerequisites: ${report.source_graph.code_bytes}/${report.source_graph.instructions}, nine RTL roots; full text composition OPEN.`);
 return report;
}
