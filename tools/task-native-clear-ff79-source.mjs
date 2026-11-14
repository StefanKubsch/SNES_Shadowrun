import {readFile,writeFile} from 'node:fs/promises';import {inspectRom,cpuLabel} from './rom.mjs';
import {decodeTaskWindows,taskRomHash} from './task-partial-source.mjs';import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';import {formatBlock} from './disassemble.mjs';
import {renderComposeWindows} from './task-native-render-compose-source.mjs';
export const taskClearFF79Window={start:0x80FF79,hex:'A20600BF16027E300E8500DA203EFAFAA9FFFF9F16027ECACA10E89C000260'};
export const clearFF79Windows=()=>[taskClearFF79Window,...renderComposeWindows(0x80FA3E)];
export function proveTaskClearFF79(map){
 assertPinnedTaskSource(map,clearFF79Windows());const p=proveWordStack(map,0x80FF79,'RTS',{measureStack:true});
 if(p.reachable_instructions!==map.size||p.external_return_assumptions||p.minimum_protected_stack_bytes!==28
  ||p.maximum_local_stack_bytes!==26||p.returns.some(r=>r.m!==0||r.x!==0||r.dbr!=='entry'))throw Error('Whole Task FF79 source/stack/mode drift');
 return {...p,native_binding:false,local_source_complete:true,full_graph_closed:true,full_task_binding:false,global_stack_minimum:null,
  root_return:'RTS',return_target_executed:false,
  inner_calls:[...map.values()].filter(i=>['JSR','JSL'].includes(i.mnemonic)).map(i=>({at:cpuLabel(i.cpu),target:cpuLabel(i.target),
   continuation:cpuLabel(i.next),return_word:(i.next-1)&65535,return_bytes:i.mnemonic==='JSL'?3:2,
   ...(i.mnemonic==='JSL'?{return_bank:i.cpu>>>16}:{}),ownership:'Actual pushed mixed frames and fresh matching typed return before this fixed continuation.'})),
  qualification:'Whole original FF79/FA3E/AD92 and all A9B2/9F49/AF1F/ACCF/ACB5/ACAF dependencies. Twenty-six local plus two root stackbytes under intact graph, no global stack minimum. Fresh signed slotWORD gates, DP00, PHX/JSR80:FF85 (WORD FF87)/RTS80:FF88/PLX, marker after successful helper, WORDDEX/BPL and actualDBR0200 STZ preserving real A/flags. Full indices and shared data/stack aliases retained; no capacities or data/wait termination inferred. Every hardware result and WORD01F8 poll is separately frozen on one owner/provider/work/output/outer commit. NativeA7/58/body/caller initialization, scene and frames remain separate.'};
}
export async function emitTaskClearFF79(){
 const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong European ROM');
 const all=decodeTaskWindows(bytes,clearFF79Windows()),proof=proveTaskClearFF79(all.map),report={rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',
  windows:all.windows,proofs:[proof],source_graph:{local_source_complete:true,native_binding:false,full_graph_closed:true,full_task_binding:false,
   code_bytes:all.windows.reduce((n,w)=>n+w.covered_bytes,0),instructions:all.map.size},completed_script_bodies:0};
 await writeFile('analysis/render-task-native-clear-ff79.json',JSON.stringify(report,null,2)+'\n');
 await writeFile('analysis/render-task-native-clear-ff79.asm.txt',all.blocks.map(formatBlock).join('\n'));
 console.log(`Whole Task FF79: ${report.source_graph.code_bytes}/${all.map.size}, 26 local plus two root stackbytes.`);return report;
}
