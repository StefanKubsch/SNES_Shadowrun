import {readFile,writeFile} from 'node:fs/promises';import {inspectRom,cpuLabel} from './rom.mjs';
import {decodeTaskWindows,taskRomHash} from './task-partial-source.mjs';import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';import {formatBlock} from './disassemble.mjs';
import {taskNativeRenderSpec} from './task-native-render-spec.mjs';import {taskRenderComposeWindows} from './task-native-render-compose-spec.mjs';
import {unpackWindows} from './task-native-unpack-source.mjs';
export const renderComposeEntries=[0x81ACAF,0x81ACB5,0x81ACCF,0x81AD92,0x80FA3E];
const helper=name=>taskNativeRenderSpec.windows.find(w=>w.name===name);
export function renderComposeWindows(entry){
 if(entry===0x81ACAF)return [helper('waitACAF')];
 if(entry===0x81ACB5)return [helper('requestACB5'),helper('waitACAF')];
 if(entry===0x81ACCF)return [helper('entryACCF')];
 if(entry===0x81AD92||entry===0x80FA3E)return [
  ...taskRenderComposeWindows.filter(w=>entry===0x80FA3E||w.name==='composeAD92'),
  ...unpackWindows(0x81A9B2),helper('entryACCF'),helper('requestACB5'),helper('waitACAF')];
 return [];
}
export function proveTaskRenderCompose(map,entry){
 const windows=renderComposeWindows(entry);if(!windows.length)throw Error('Unproved render composition entry');assertPinnedTaskSource(map,windows);
 const minimum=new Map([[0x81ACAF,3],[0x81ACB5,6],[0x81ACCF,6],[0x81AD92,22],[0x80FA3E,24]]).get(entry),rootBytes=entry===0x80FA3E?2:3;
 const proof=proveWordStack(map,entry,rootBytes===2?'RTS':'RTL',{measureStack:true});
 if(proof.reachable_instructions!==map.size||proof.external_return_assumptions||proof.minimum_protected_stack_bytes!==minimum
  ||proof.maximum_local_stack_bytes!==minimum-rootBytes||proof.returns.some(r=>r.m!==0||r.x!==0||r.dbr!=='entry'))throw Error('Render composition source/stack/mode drift');
 return {...proof,native_binding:false,local_source_complete:true,full_graph_closed:true,full_task_binding:false,global_stack_minimum:null,
  root_return:rootBytes===2?'RTS':'RTL',return_target_executed:false,
  inner_calls:[...map.values()].filter(i=>['JSR','JSL'].includes(i.mnemonic)).map(i=>({at:cpuLabel(i.cpu),target:cpuLabel(i.target),
   continuation:cpuLabel(i.next),return_word:(i.next-1)&65535,return_bytes:i.mnemonic==='JSL'?3:2,
   ...(i.mnemonic==='JSL'?{return_bank:i.cpu>>>16}:{}),ownership:'Real pushed bytes and fresh matching typed return before this fixed continuation.'})),
  qualification:'Complete individually pinned original FA3E removal/backscan, AD92 reload/list, ACCF border/cell/row, ACB5 request and ACAF wait including all A9B2/9F49/AF1F dependencies. Real mixed native stack/data/status/bank/index/return bytes and fresh shared aliases. Original full WORD DO-loops, signed backscan/initial gate and unsigned inclusive list comparisons, no capacities/termination inferred. All928 conversion words and all active/gated AF1F paths retained; device results and each actual WORD01F8 poll are independent chronological observations on one private provider/window/work/output/outer commit. No device timing/transfer, original caller/initialization, FEC1/NativeC8/Native58/wholeTask/scene/frame binding or complete scriptbody claim.'};
}
export async function emitTaskRenderCompose(){
 const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong European ROM');
 const all=decodeTaskWindows(bytes,renderComposeWindows(0x80FA3E));
 const proofs=renderComposeEntries.map(entry=>proveTaskRenderCompose(decodeTaskWindows(bytes,renderComposeWindows(entry)).map,entry));
 const report={rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',windows:all.windows,proofs,
  source_graph:{local_source_complete:true,native_binding:false,full_graph_closed:true,full_task_binding:false,
   code_bytes:all.windows.reduce((n,w)=>n+w.covered_bytes,0),instructions:all.map.size},completed_script_bodies:0};
 await writeFile('analysis/render-task-native-render-compose.json',JSON.stringify(report,null,2)+'\n');
 await writeFile('analysis/render-task-native-render-compose.asm.txt',all.blocks.map(formatBlock).join('\n'));
 console.log(`Whole Task render composition: ${report.source_graph.code_bytes}/${all.map.size}, stack3/6/6/22/24.`);return report;
}
