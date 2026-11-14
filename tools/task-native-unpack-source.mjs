import {readFile,writeFile} from 'node:fs/promises';import {inspectRom,cpuLabel} from './rom.mjs';
import {decodeTaskWindows,taskRomHash} from './task-partial-source.mjs';import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';import {formatBlock} from './disassemble.mjs';
import {taskUnpackWindows} from './task-native-unpack-spec.mjs';import {taskAF1FSpec} from './task-native-af1f-spec.mjs';
export const unpackWindows=entry=>entry===0x809F49?taskUnpackWindows.slice(0,3):entry===0x81A9B2?[...taskUnpackWindows,...taskAF1FSpec.windows]:[];
export function proveTaskUnpack(map,entry){
 const windows=unpackWindows(entry);if(!windows.length)throw Error('Unproved unpack entry');assertPinnedTaskSource(map,windows);
 const proof=proveWordStack(map,entry,'RTL',{measureStack:true}),minimum=entry===0x809F49?15:19;
 if(proof.reachable_instructions!==map.size||proof.external_return_assumptions||proof.minimum_protected_stack_bytes!==minimum
  ||proof.maximum_local_stack_bytes!==minimum-3||proof.returns.some(r=>r.m!==0||r.x!==0||r.dbr!=='entry'))throw Error('Unpack source/stack/mode drift');
 return {...proof,native_binding:false,local_source_complete:true,full_graph_closed:true,full_task_binding:false,global_stack_minimum:null,
  root_return:'RTL',return_target_executed:false,
  inner_calls:[...map.values()].filter(i=>['JSL','JSR'].includes(i.mnemonic)).map(i=>({at:cpuLabel(i.cpu),target:cpuLabel(i.target),
   continuation:cpuLabel(i.next),return_word:(i.next-1)&65535,return_bytes:i.mnemonic==='JSL'?3:2,
   ...(i.mnemonic==='JSL'?{return_bank:i.cpu>>>16}:{}),ownership:'Actual pushes and fresh matching return bytes before fixed continuation.'})),
  qualification:'Entire individually pinned original 9F49/9F4D,9E9B,9E65 and, for A9B2, AF1F source graph. Real PHP/PLP, PHB/PLB, header/bit PHA/PLA and mixed JSR/JSL/RTS/RTL bytes; original SEP30 clears index highbytes, REP30 restores WORD widths. Literal zero length still copies one BYTE, WORD loops wrap, source/scratch/output aliases stay fresh, MVN preserves flags and wraps offsets, literal WORD address carries into next bank. A9B2 converts all 928 WORDs with one carry chain independent of decoded length; AF1F hardware results require individual chronological observations. Private provider/window/work/output/commit required; graph closure does not prove termination or full output coverage. No CPU execution, initialization, device timing, FA3E/AD92/FEC1/NativeC8/Task/scene/frame binding or complete body claim.'};
}
export async function emitTaskUnpack(){
 const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong European ROM');
 for(const entry of [0x809F49,0x81A9B2]){const all=decodeTaskWindows(bytes,unpackWindows(entry)),proof=proveTaskUnpack(all.map,entry);
 const report={rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',windows:all.windows,proofs:[proof],
  source_graph:{local_source_complete:true,native_binding:false,full_graph_closed:true,full_task_binding:false,
   code_bytes:all.windows.reduce((n,w)=>n+w.covered_bytes,0),instructions:all.map.size},completed_script_bodies:0};
 const prefix=`analysis/render-task-native-${entry===0x809F49?'unpack':'a9b2'}`;
 await writeFile(prefix+'.json',JSON.stringify(report,null,2)+'\n');
 await writeFile(prefix+'.asm.txt',all.blocks.map(formatBlock).join('\n'));
 console.log(`Task ${cpuLabel(entry)}: ${report.source_graph.code_bytes}/${all.map.size}, actual mixed modes/returns.`);
 }
}
