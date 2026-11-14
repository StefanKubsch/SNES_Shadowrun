import {readFile,writeFile} from 'node:fs/promises';
import {inspectRom} from './rom.mjs';
import {taskRomHash,decodeTaskWindows} from './task-partial-source.mjs';
import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveAppendC34AStack} from './render-c34a-stack-proof.mjs';
import {spec as childSource} from './render-task-child-yield-source-proof.mjs';
import {formatBlock} from './disassemble.mjs';
export const appendWindows=childSource.windows.filter(w=>['appendDependencyOnly','frameC2C8','heapC242'].includes(w.name));
export function proveTaskAppend(map){
 assertPinnedTaskSource(map,appendWindows);const proof=proveAppendC34AStack(map);
 if(proof.maximum_local_stack_bytes!==6||proof.minimum_protected_stack_bytes!==8||proof.reachable_instructions!==124||map.size!==124)throw Error('Append graph drift');
 return {...proof,native_binding:false,local_source_complete:true,full_graph_closed:true,
  source_closed_to_dispatch:false,full_task_binding:false,global_stack_minimum:null,
  native_contract:'Actual C34A/C2C8/C242 equations, fresh full script ID tables, BYTE header carry and full argument workspace, real JSR/PHA/PLA/RTS and failure continuations. No normalized allocator/list model or source initialization. Append only, no visit; 9178 caller and frame scheduling remain separate.'};
}
export async function emitTaskAppendSource(){
 const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong append ROM');
 const {map,windows,blocks}=decodeTaskWindows(bytes,appendWindows),proof=proveTaskAppend(map);
 await writeFile('analysis/render-task-append-c34a.json',JSON.stringify({rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',
  windows,proofs:[proof],source_graph:{native_binding:false,local_source_complete:true,full_graph_closed:true,classification:'actual-append-frame-heap-graph',code_bytes:281,instructions:124},
  original_profile_contract:'analysis/render-c34a.json',scope:'Native append contract, actual allocator/frame/list failure paths and typed return owners. Original9178 caller occurrence, initialization and whole Task/scene/frames remain separate.'},null,2)+'\n');
 await writeFile('analysis/render-task-append-c34a.asm.txt',blocks.map(formatBlock).join('\n'));
 console.log('C34A: actual append/frame/heap281/124, stack6+2; 9178 caller separate.');
}
