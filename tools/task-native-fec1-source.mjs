import {readFile,writeFile} from 'node:fs/promises';import {inspectRom,cpuLabel} from './rom.mjs';import {decodeTaskWindows,taskRomHash} from './task-partial-source.mjs';
import {assertPinnedTaskSource} from './pinned-task-source.mjs';import {proveWordStack} from './static-word-stack-proof.mjs';import {formatBlock} from './disassemble.mjs';
import {taskFEC1Window} from './task-native-fec1-spec.mjs';import {taskNativeRenderSpec} from './task-native-render-spec.mjs';
import {taskTextComposeWindows} from './task-native-text-compose-spec.mjs';import {renderComposeWindows} from './task-native-render-compose-source.mjs';
export function fec1Windows(){
 const windows=[taskFEC1Window];for(const w of [...taskNativeRenderSpec.windows,...taskTextComposeWindows,...renderComposeWindows(0x80FA3E)]){
  const prior=windows.find(p=>p.start===w.start);if(prior){if(prior.hex!==w.hex||(prior.initialM??0)!==(w.initialM??0)||(prior.initialX??0)!==(w.initialX??0))throw Error('Conflicting FEC1 dependency');}
  else windows.push(w);
 }return windows;
}
export function proveTaskFEC1(map){
 assertPinnedTaskSource(map,fec1Windows());const proof=proveWordStack(map,0x80FEC1,'RTS',{measureStack:true,widthJoins:new Set([0x80FC36])});
 if(proof.reachable_instructions!==map.size||proof.external_return_assumptions||proof.minimum_protected_stack_bytes!==32
  ||proof.maximum_local_stack_bytes!==30||proof.returns.some(r=>r.m!==0||r.x!==0||r.dbr!=='entry'))throw Error('Whole FEC1 source/stack/mode drift');
 return {...proof,native_binding:false,local_source_complete:true,full_graph_closed:true,full_task_binding:false,global_stack_minimum:null,
  root_return:'RTS',return_target_executed:false,
  width_lemmas:[{at:'80:FC36',incoming_m:[0,1],operation:'SEP20',outgoing_m:1},{at:'80:FC5F',incoming_m:1,predecessor:'80:FC51 BYTE BEQ',lexical_prior:'80:FC5C WORD JMPFB8C has no fallthrough'}],
  inner_calls:[...map.values()].filter(i=>['JSR','JSL'].includes(i.mnemonic)).map(i=>({at:cpuLabel(i.cpu),target:cpuLabel(i.target),
   continuation:cpuLabel(i.next),return_word:(i.next-1)&65535,return_bytes:i.mnemonic==='JSL'?3:2,
   ...(i.mnemonic==='JSL'?{return_bank:i.cpu>>>16}:{}),ownership:'Real pushed bytes and fresh matching typed return before this fixed continuation.'})),
  qualification:'Complete independently pinned FEC1/F963/FE69/FB39/FA3E/AD92 and all transitive native original branches, actual allocation/minimum/index/status/bank and mixed JSR/JSL/RTS/RTL bytes. Thirty local plus two root stackbytes under intact graph; no global stack minimum. First signedfree6/4/2/0, unsigned minimum with last equality and fresh second lifetime read, full WORD selector ASL and actual DBR bankcarry. Fresh saved allocation/minimum/selected-slot/data/return aliases, original null/wrapped loops and strict cumulative budgets retained. Every original MMIO result and actual wait poll is an independent chronological observation on one private provider/outer commit, no device equation/time inferred. Initialization, original NativeC8/Native58/F509 caller/body binding, wholeTask/9178/scene/frame execution remain separate; helper is zero complete scriptbodies.'};
}
export async function emitTaskFEC1(){
 const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong European ROM');
 const all=decodeTaskWindows(bytes,fec1Windows()),proof=proveTaskFEC1(all.map),report={rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',
  windows:all.windows,proofs:[proof],source_graph:{local_source_complete:true,native_binding:false,full_graph_closed:true,full_task_binding:false,
   code_bytes:all.windows.reduce((n,w)=>n+w.covered_bytes,0),instructions:all.map.size},completed_script_bodies:0};
 await writeFile('analysis/render-task-native-fec1.json',JSON.stringify(report,null,2)+'\n');
 await writeFile('analysis/render-task-native-fec1.asm.txt',all.blocks.map(formatBlock).join('\n'));
 console.log(`Whole Task FEC1: ${report.source_graph.code_bytes}/${all.map.size}, thirty local plus two root stackbytes, all dependencies native.`);return report;
}
