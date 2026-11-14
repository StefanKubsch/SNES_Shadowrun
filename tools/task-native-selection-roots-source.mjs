import {readFile,writeFile} from 'node:fs/promises';
import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {decodeTaskWindows,taskRomHash,taskHash} from './task-partial-source.mjs';
import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
import {selectionRoots,directionTable} from './task-native-933a-bba0-specs.mjs';
import {requestWindows,requestProofs} from './render-task-native-menu-compose-source-proof.mjs';
import {listWindows,prove as proveList} from './render-task-native-list-prerequisites-source-proof.mjs';
import {textComposeWindows,proveTaskTextComposition} from './task-native-text-compose-source.mjs';
import {nativeD15CSpec} from './task-native-d15c-spec.mjs';import {proveLeafSource} from './task-native-leaf-source.mjs';
import {formatBlock} from './disassemble.mjs';
export function proveSelectionRoot(map,spec){
 assertPinnedTaskSource(map,spec.windows);
 const p=proveWordStack(map,spec.entry,'RTS',{measureStack:true,
  peiWordPushes:new Map(spec.id===0x1A?nativeD15CSpec.peiWordPushes:[]),widthJoins:new Set(spec.id===0x9A?[0x80FC36]:[])});
 if(p.reachable_instructions!==map.size||p.external_return_assumptions!==0||p.returns.some(r=>r.m||r.x||r.dbr!=='entry'))throw Error('Selection whole source/return drift');
 return {...p,native_binding:false,local_source_complete:true,full_graph_closed:true,full_task_binding:false,
  source_closed_to_dispatch:false,global_stack_minimum:null,root_return:'RTS',return_target_executed:false,
  qualification:spec.id===0x9A?'Whole original933A/FA67/ACBD/FAAC/FE69/FB39 graph. Real held selector PHA/fresh PLA, full WORD ASL/table index and two fresh DP14 reads. Every actual mixed mode/bank/JSR/JSL/RTS/RTL byte and helper contract renewed; single private ledger/window/budget/commit. Actual product and F6/FC/FA waits are explicit fresh observations. No initialized window/selector/caller/device/time/Task/scene/frame assumption.':
   'Whole originalBBA0 reachable windows, original unreachableBBF1..BBF3 excluded, full D15C/A985/AAAF. Third ASL carry goes directly to fresh ADC2DE2; full longX/WORD descending compare and fresh A2 read, exact CPX2/4 adjustment and original direction tables. Real PEI04/00, nested fresh JSR/RTS and alias/mode checks. No clamped index or inferred record/list termination/initialization/caller/Task/scene/frame.'};
}
export async function selectionRootSource(bytes,spec){
 const d=decodeTaskWindows(bytes,spec.windows),proof=proveSelectionRoot(d.map,spec);
 const helper=(entry,windows,prove)=>{const decoded=decodeTaskWindows(bytes,windows);return {entry:cpuLabel(entry),windows:decoded.windows,proof:prove(decoded.map,entry)};};
 const helpers=spec.id===0x9A?[
  helper(0x80FA67,requestWindows,map=>requestProofs(map)[0]),helper(0x80FAAC,listWindows(0x80FAAC),proveList),
  helper(0x80FE69,textComposeWindows(0x80FE69),proveTaskTextComposition)]:
  [helper(0x80D15C,nativeD15CSpec.windows,map=>proveLeafSource(map,nativeD15CSpec))];
 const pin=a=>{const off=cpuToOffset(a.start,bytes.length),raw=bytes.subarray(off,off+a.hex.length/2);
  if(raw.toString('hex').toUpperCase()!==a.hex)throw Error('Selection original anchor/table drift');
  return {entry:cpuLabel(a.start),machine_bytes:a.hex,covered_bytes:raw.length,sha256:taskHash(raw),...(a.kind?{kind:a.kind}:{})};};
 return {rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',windows:d.windows,helpers,proofs:[proof],
  anchors:spec.anchors.map(pin),tables:spec.id===0x1A?[pin(directionTable)]:[],source_graph:{local_source_complete:true,full_graph_closed:true,
   native_binding:false,code_bytes:d.windows.reduce((n,w)=>n+w.covered_bytes,0),instructions:d.map.size},completed_script_bodies:0};
}
export async function emitSelectionRootSources(){const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong ROM');
 for(const s of selectionRoots){const source=await selectionRootSource(bytes,s);await writeFile(`analysis/render-task-${s.name}.json`,JSON.stringify(source,null,2)+'\n');
  await writeFile(`analysis/render-task-${s.name}.asm.txt`,decodeTaskWindows(bytes,s.windows).blocks.map(formatBlock).join('\n'));
  console.log(s.name,source.source_graph.code_bytes,source.source_graph.instructions,source.proofs[0].minimum_protected_stack_bytes);}}
