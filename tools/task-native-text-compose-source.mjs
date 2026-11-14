import {readFile,writeFile} from 'node:fs/promises';import {inspectRom,cpuLabel} from './rom.mjs';
import {decodeTaskWindows,taskRomHash} from './task-partial-source.mjs';import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';import {formatBlock} from './disassemble.mjs';
import {taskTextComposeWindows} from './task-native-text-compose-spec.mjs';
export const textComposeWindows=entry=>entry===0x80FE69?taskTextComposeWindows:entry===0x80FB39?
 taskTextComposeWindows.filter(w=>!['textFE69','bitAF04'].includes(w.name)):[];
export function proveTaskTextComposition(map,entry){
 const windows=textComposeWindows(entry);if(!windows.length)throw Error('Unproved text composition entry');
 assertPinnedTaskSource(map,windows);
 const byteEntry=map.get(0x80FC5F),join=map.get(0x80FC36);
 if(byteEntry.state.m!==1||byteEntry.mnemonic!=='DEC'||byteEntry.value!==0xA5||join.mnemonic!=='SEP'||join.value!==0x20
  ||map.get(0x80FC5C).mnemonic!=='JMP'||map.get(0x80FC5C).target!==0x80FB8C
  ||map.get(0x80FC51).target!==0x80FC5F||map.get(0x80FC51).state.m!==1)throw Error('Original FB39 BYTE reentry/join drift');
 const proof=proveWordStack(map,entry,'RTS',{measureStack:true,widthJoins:new Set([0x80FC36])});
 const minimum=entry===0x80FE69?12:9;
 if(proof.external_return_assumptions||proof.reachable_instructions!==map.size||proof.minimum_protected_stack_bytes!==minimum
  ||proof.maximum_local_stack_bytes!==minimum-2||proof.returns.some(r=>r.m!==0||r.x!==0||r.dbr!=='entry'))throw Error('Whole text graph/stack/mode drift');
 return {...proof,native_binding:false,local_source_complete:true,full_graph_closed:true,full_task_binding:false,global_stack_minimum:null,
  return_target_executed:false,root_return:'RTS',
  width_lemmas:[{at:'80:FC36',operation:'SEP20',incoming_m:[0,1],outgoing_m:1},
   {at:'80:FC5F',incoming_m:1,predecessor:'80:FC51 BYTE BEQ',lexical_prior:'80:FC5C WORD JMPFB8C has no fallthrough'}],
  inner_calls:[...map.values()].filter(i=>['JSL','JSR'].includes(i.mnemonic)).map(i=>({at:cpuLabel(i.cpu),target:cpuLabel(i.target),
   continuation:cpuLabel(i.next),return_word:(i.next-1)&65535,return_bytes:i.mnemonic==='JSL'?3:2,
   ...(i.mnemonic==='JSL'?{return_bank:i.cpu>>>16}:{}),ownership:'Actual pushed WORD/bank and fresh matching RTS/RTL bytes before this fixed continuation.'})),
  stack_events:[...map.values()].filter(i=>['PHA','PLA','PHX','PLX','PHP','PLP','PHB','PLB','PEA'].includes(i.mnemonic))
   .map(i=>({at:cpuLabel(i.cpu),operation:i.mnemonic,m:i.state.m,x:i.state.x,value:i.value})),
  qualification:'Entire individually pinned FE69/FB39 dictionary, measurement/style/word/line/glyph graph and all original helper branches through root RTS. Typed RTS/RTL, real bank/data/index/status bytes, fresh source/DP/physical fields, hidden HighA and original width joins. Chronological explicit quotient/remainder/product and external wait events, no derived MMIO/timing or initialization. Structural loops prove no termination; full wrapping register loops retained by exact equations/work charges, private owner/window/budget/outer commit required. Original caller occurrence, NativeC8/FEC1/Native58/F509, wholeTask/9178/scene/frame binding and complete scriptbodies remain separate.'};
}
export async function emitTaskTextComposition(){
 const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong European ROM');
 const all=decodeTaskWindows(bytes,taskTextComposeWindows),proofs=[0x80FE69,0x80FB39].map(entry=>proveTaskTextComposition(decodeTaskWindows(bytes,textComposeWindows(entry)).map,entry));
 const report={rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',windows:all.windows,proofs,
  source_graph:{local_source_complete:true,native_binding:false,full_graph_closed:true,full_task_binding:false,code_bytes:all.windows.reduce((n,w)=>n+w.covered_bytes,0),instructions:all.map.size},completed_script_bodies:0};
 await writeFile('analysis/render-task-native-text-compose.json',JSON.stringify(report,null,2)+'\n');
 await writeFile('analysis/render-task-native-text-compose.asm.txt',all.blocks.map(formatBlock).join('\n'));
 console.log(`Whole Task text: ${report.source_graph.code_bytes}/${report.source_graph.instructions}, FE69 stack12, FB39 stack9; FEC1 OPEN.`);return report;
}
