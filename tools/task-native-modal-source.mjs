import {readFile,writeFile} from 'node:fs/promises';import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {decodeTaskWindows,taskRomHash,taskHash} from './task-partial-source.mjs';import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';import {proveModalStack} from './render-menu-stack-proof.mjs';
import {modalSpecs,modalTable} from './task-native-modal-specs.mjs';import {formatBlock} from './disassemble.mjs';
import {taskNativeRenderSpec} from './task-native-render-spec.mjs';import {proveTaskNativeRender} from './task-native-render-source.mjs';
import {decodeSource as decodeMenu,prove as proveMenu} from './render-task-native-menu-compose-source-proof.mjs';
import {renderComposeWindows,proveTaskRenderCompose} from './task-native-render-compose-source.mjs';
import {textComposeWindows,proveTaskTextComposition} from './task-native-text-compose-source.mjs';
export function proveModalRoot(map,s){assertPinnedTaskSource(map,s.windows);
 const p=s.id===0x72?proveModalStack(map):proveWordStack(map,s.entry,'RTS',{measureStack:true,widthJoins:new Set(s.id===0xD7?[0x80FC36]:[])});
 if(p.external_return_assumptions!==0||p.returns.some(r=>r.m||r.x||!['entry',0x80].includes(r.dbr)))throw Error('Modal root stack/return/mode drift');
 if(s.id!==0x72&&p.reachable_instructions!==map.size)throw Error('Unreachable supplied root source');
 return {...p,native_binding:false,local_source_complete:true,full_graph_closed:s.id!==0x72,...(s.id===0x72?{conditional_graph_closed:true}:{}),
  full_task_binding:false,source_closed_to_dispatch:false,global_stack_minimum:null,root_return:'RTS',return_target_executed:false,
  qualification:s.id===0x72?'Whole original CD43 allocation/menu/removal graph, every real source callee walked, independently renewed F963/A6C7/FA3E. Actual PEAFFFF/0000 spans full removal then fresh PLA. WORD wrapped scratch/caller/table/indices, actual mixed bank/mode/return bytes and shared cumulative observation ledger/budget/commit. Conditional normal input/audio only; reset3030 and zeroVoice alternateRTS reject atomically. No initialized caller/menu/record/ROMdata/hardware/time/Task/scene/frames.':
   s.id===0xBF?'Whole originalCD20 SEC/fullWORD lowcurrency-minus-freshDP00. Borrow with nonzero freshly read highcounter decrements once then stores wrapped low; highzero leaves both currency words and STZ00 only. FFFF success retains actual sourceflags/indices; no clamp/range/initialization/Task/scene/frame.':
   s.id===0x74?'Whole originalCBF7 actual freshDP00/fullX8DB020 WORD. Null pointer skips DP02/record; nonzero freshDP02 WORD stored at full long7E0003+X, actual highbyte and alias ownership. No BYTE reinterpretation/record initialization/caller/Task/scene/frame.':
   'Whole original935B and FE69/FB39 helpers. FullWORD selectorASL/actualDBR-D9B8 index, freshDP14, full text with explicit products/FC/FA waits. Real matching nested JSR/JSL/RTS/RTL banks/modes, one provider/budget/outer commit; no caller/window/ROMdata/hardware/time/Task/scene/frame initialization.'};}
export async function modalSource(bytes,s){const d=decodeTaskWindows(bytes,s.windows),proof=proveModalRoot(d.map,s);
 const helper=(entry,windows,prove)=>{const x=decodeTaskWindows(bytes,windows);return {entry:cpuLabel(entry),windows:x.windows,proof:prove(x.map,entry)};};
 const m=s.id===0x72?decodeMenu(bytes):null;
 const helpers=s.id===0x72?[helper(0x80F963,taskNativeRenderSpec.windows,proveTaskNativeRender),
  {entry:'80:A6C7',windows:m.windows,proof:proveMenu(m.map,0x80A6C7)},helper(0x80FA3E,renderComposeWindows(0x80FA3E),proveTaskRenderCompose)]:
  s.id===0xD7?[helper(0x80FE69,textComposeWindows(0x80FE69),proveTaskTextComposition)]:[];
 const pin=a=>{const off=cpuToOffset(a.start,bytes.length),raw=bytes.subarray(off,off+a.hex.length/2);if(raw.toString('hex').toUpperCase()!==a.hex)throw Error('Modal original anchor/table drift');
  return {entry:cpuLabel(a.start),machine_bytes:a.hex,sha256:taskHash(raw),covered_bytes:raw.length,...(a.kind?{kind:a.kind}:{})};};
 return {rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',windows:d.windows,helpers,proofs:[proof],anchors:s.anchors.map(pin),tables:s.id===0x72?[pin(modalTable)]:[],
  source_graph:{native_binding:false,local_source_complete:true,full_graph_closed:s.id!==0x72,...(s.id===0x72?{conditional_graph_closed:true}:{}),
   code_bytes:d.windows.reduce((n,w)=>n+w.covered_bytes,0),instructions:d.map.size},completed_script_bodies:0};}
export async function emitModalSources(){const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong ROM');
 for(const s of modalSpecs){const source=await modalSource(bytes,s);await writeFile(`analysis/render-task-${s.name}.json`,JSON.stringify(source,null,2)+'\n');
  await writeFile(`analysis/render-task-${s.name}.asm.txt`,decodeTaskWindows(bytes,s.windows).blocks.map(formatBlock).join('\n'));
  console.log(s.name,source.source_graph.code_bytes,source.source_graph.instructions,source.proofs[0].reachable_instructions,source.proofs[0].minimum_protected_stack_bytes);}}
