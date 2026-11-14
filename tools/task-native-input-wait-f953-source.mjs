import {readFile,writeFile} from 'node:fs/promises';
import {inspectRom,cpuLabel} from './rom.mjs';import {decodeTaskWindows,taskRomHash} from './task-partial-source.mjs';
import {assertPinnedTaskSource} from './pinned-task-source.mjs';import {proveWordStack} from './static-word-stack-proof.mjs';
import {counterWindows,prove as proveCounter} from './render-task-native-counter-b0a1-source-proof.mjs';
import {decodeSource as decodeInput,prove as proveInput,inputApuWindows} from './render-task-native-input-apu-source-proof.mjs';
import {formatBlock} from './disassemble.mjs';
export const inputWaitF953Window={start:0x80F953,hex:'22A1B081201A9EADCE0129C0E0F0F160'};
const normalInput={start:0x809E1A,hex:inputApuWindows[0].hex.slice(0,(0x9E3D-0x9E1A)*2)};
export function decodeSource(bytes){
 const d=decodeTaskWindows(bytes,[inputWaitF953Window,...counterWindows,normalInput]),input=decodeInput(bytes);
 for(const [pc,i]of input.map)if(pc>=0x809E1A&&pc<0x809E59||pc>=0x81F007&&pc<0x81F024)d.map.set(pc,i);
 d.windows=[...d.windows.filter(w=>w.entry!=='80:9E1A'),...input.windows.filter(w=>
  w.entry.startsWith('80:9E')||w.entry.startsWith('81:F0'))];
 d.blocks=[...d.blocks.filter(b=>b.entry!==0x809E1A),...input.blocks.filter(b=>
  b.entry>=0x809E1A&&b.entry<0x809E59||b.entry>=0x81F007&&b.entry<0x81F024)];
 return d;
}
export function proveTaskInputWaitF953(map){
 assertPinnedTaskSource(map,[inputWaitF953Window,...counterWindows,normalInput]);
 const counterMap=new Map([...map].filter(([pc])=>pc>=0x81B0A1&&pc<0x81B0AC)),counter=proveCounter(counterMap),input=proveInput(map,0x809E1A);
 const gate=map.get(0x809E2F),compare=map.get(0x809E2C);
 if(gate.mnemonic!=='BEQ'||gate.target!==0x809E3D||compare.mnemonic!=='CMP'||compare.value!==0x3030)throw Error('Original reset predicate drift');
 const normal=new Map([...map].filter(([pc])=>pc>=0x80F953&&pc<0x80F963||pc>=0x81B0A1&&pc<0x81B0AC||pc>=0x809E1A&&pc<0x809E3D));
 // Conditional proof only: actual current WORD !=3030 admits fallthrough.
 // The original full reset graph remains independently renewed above;
 // runtime rejects its gate before publishing any effect.
 normal.set(gate.cpu,{...gate,mode:'conditional-normal-fallthrough'});
 const p=proveWordStack(normal,0x80F953,'RTS',{measureStack:true});
 if(p.reachable_instructions!==23||p.maximum_local_stack_bytes!==3||p.minimum_protected_stack_bytes!==5||p.external_return_assumptions!==0
  ||p.returns.some(r=>r.m!==0||r.x!==0||r.dbr!=='entry'))throw Error('A3 conditional whole stack drift');
 return {...p,native_binding:false,local_source_complete:true,full_graph_closed:false,conditional_graph_closed:true,
  full_task_binding:false,global_stack_minimum:null,root_return:'RTS',source_closed_to_dispatch:false,return_target_executed:false,
  normal_code_bytes:62,normal_instructions:23,counter,input,
  conditional_edges:[{at:'80:9E2F',excluded:'80:9E3D',predicate:'fresh original full WORD01CA !=3030',otherwise:'task_reset_source_required; no effects published'}],
  inner_calls:[{at:'80:F953',target:'81:B0A1',continuation:'80:F957',raw_return:0xF956,return_bank:0x80,bytes:3},
   {at:'80:F957',target:'80:9E1A',continuation:'80:F95A',raw_return:0xF959,bytes:2}],
  qualification:'Whole original A3/F953 normal counter/input loop, actual JSL/RTL and JSR/RTS under three local plus two root bytes. Full counter WORD baseline and each fresh CMP poll independently observed; counter changes never generate input/time/frames. Three original held reads and previous/edge stores remain fresh; optional control observation before first read is separate from counter samples. Fresh actualDBR01CE AND E0C0; zero loops without a fixed iteration limit, each original access budgeted. Reset3030 rejects the whole current plan. No initialization, original caller, capture/NMI, hardware, scheduler/Task/scene/frame or body admission inferred.'};
}
export async function emitTaskInputWaitF953(){
 const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong European ROM');
 const d=decodeSource(bytes),p=proveTaskInputWaitF953(d.map);
 await writeFile('analysis/render-task-native-input-wait-f953.json',JSON.stringify({rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',
  windows:d.windows,proofs:[p],source_graph:{native_binding:false,local_source_complete:true,full_graph_closed:false,conditional_graph_closed:true},
  completed_script_bodies:0},null,2)+'\n');
 await writeFile('analysis/render-task-native-input-wait-f953.asm.txt',d.blocks.map(formatBlock).join('\n'));
 console.log('OriginalA3/F953:62 normal bytes/23 instructions; real mixed frames, 5 stackbytes, explicit reset boundary.');
}
