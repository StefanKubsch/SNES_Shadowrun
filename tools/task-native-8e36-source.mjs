import {readFile,writeFile} from 'node:fs/promises';
import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {decodeTaskWindows,taskRomHash,taskHash} from './task-partial-source.mjs';
import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {formatBlock} from './disassemble.mjs';
import {native8E36Spec as spec} from './task-native-8e36-spec.mjs';
import {randomWindows,randomTables,prove as proveRandom} from './render-task-native-random-source-proof.mjs';
import {createNativeSpec} from './task-native-create-spec.mjs';
import {proveLeafSource} from './task-native-leaf-source.mjs';
import {taskNativeRenderSpec} from './task-native-render-spec.mjs';
import {proveTaskNativeRender} from './task-native-render-source.mjs';
import {textComposeWindows,proveTaskTextComposition} from './task-native-text-compose-source.mjs';
import {counterWindows,prove as proveCounter} from './render-task-native-counter-b0a1-source-proof.mjs';
import {decodeSource as decodeInputWait,proveTaskInputWaitF953} from './task-native-input-wait-f953-source.mjs';
import {renderComposeWindows,proveTaskRenderCompose} from './task-native-render-compose-source.mjs';
import {rootWindows,prove as proveAudio} from './render-task-native-audio-compose-source-proof.mjs';
import {native8E36Table} from '../src/task/native-object-hit-tables.mjs';

export function renew8E36Helpers(bytes){
 const helper=(entry,windows,prove)=>{const d=decodeTaskWindows(bytes,windows);return {entry:cpuLabel(entry),windows:d.windows,proof:prove(d.map,entry)};};
 const input=decodeInputWait(bytes);
 return [helper(0x80C51F,randomWindows,proveRandom),helper(0x80A835,createNativeSpec.windows,map=>proveLeafSource(map,createNativeSpec)),
  helper(0x80F963,taskNativeRenderSpec.windows,proveTaskNativeRender),helper(0x80FE69,textComposeWindows(0x80FE69),proveTaskTextComposition),
  helper(0x81B0A1,counterWindows,proveCounter),{entry:'80:F953',windows:input.windows,proof:proveTaskInputWaitF953(input.map)},
  helper(0x80FA3E,renderComposeWindows(0x80FA3E),proveTaskRenderCompose),
  helper(0x81AD92,renderComposeWindows(0x81AD92),proveTaskRenderCompose),helper(0x80C46E,rootWindows(0x80C46E),proveAudio)];
}
// Exact local paths plus independently renewed transitive call summaries.
// No external return is assumed. Width-neutral encodings are checked against
// each incoming mode; immediates keep their original pinned byte length.
export function prove8E36Local(map,helpers){
 assertPinnedTaskSource(map,spec.windows);
 const external=new Map(helpers.map(h=>[parseInt(h.entry.replace(':',''),16),h.proof]));
 if(external.size!==9||helpers.some(h=>h.proof.external_return_assumptions!==0))throw Error('7C helper source required');
 const pending=[{pc:spec.entry,m:0,x:0,stack:[]}],seen=new Set(),visited=new Set(),modes=new Set(),returns=new Set(),calls=[];
 let maximum=0;
 const depth=s=>s.reduce((n,v)=>n+(v.kind==='return'?v.bytes:1),0);
 while(pending.length){const s=pending.pop(),key=JSON.stringify(s);if(seen.has(key))continue;seen.add(key);
  if(seen.size>20000)throw Error('7C unbounded source stack');const i=map.get(s.pc);if(!i)throw Error('7C uncovered edge '+cpuLabel(s.pc));
  if(i.mode==='immM'&&i.length!==(s.m?2:3)||i.mode==='immX'&&i.length!==(s.x?2:3))throw Error('7C immediate mode drift');
  visited.add(s.pc);modes.add(JSON.stringify({at:cpuLabel(s.pc),m:s.m,x:s.x}));maximum=Math.max(maximum,depth(s.stack));
  const t={...s,pc:i.next,stack:[...s.stack]},pop=kind=>{const v=t.stack.pop();if(v?.kind!==kind)throw Error('7C typed stack '+cpuLabel(s.pc));return v;};
  switch(i.mnemonic){
   case 'PHX':case 'PHY':for(let n=0;n<(s.x?1:2);n++)t.stack.push({kind:'index'});break;
   case 'PLX':case 'PLY':for(let n=0;n<(s.x?1:2);n++)pop('index');break;
   case 'PHA':for(let n=0;n<(s.m?1:2);n++)t.stack.push({kind:'data'});break;
   case 'PLA':for(let n=0;n<(s.m?1:2);n++)pop('data');break;
   case 'PEI':if(s.pc!==0x8086EC||i.value!==0||s.m!==0||s.x!==0)throw Error('7C PEI00 lemma');t.stack.push({kind:'data'},{kind:'data'});break;
   case 'REP':case 'SEP':if(i.value&32)t.m=Number(i.mnemonic==='SEP');if(i.value&16)t.x=Number(i.mnemonic==='SEP');break;
   case 'JSR':case 'JSL':{
    const bytes=i.mnemonic==='JSR'?2:3,p=external.get(i.target);
    if(p){
     if(s.m||s.x||p.returns.some(r=>r.m||r.x||!['entry',0x80].includes(r.dbr)))throw Error('7C helper output mode/DBR');
     maximum=Math.max(maximum,depth(s.stack)+p.minimum_protected_stack_bytes);
    }else{if(![0x808691,0x80881C].includes(i.target))throw Error('7C unproved callee');
     t.stack.push({kind:'return',bytes,pc:i.next});t.pc=i.target;}
    calls.push({at:cpuLabel(s.pc),target:cpuLabel(i.target),return_word:(i.next-1)&65535,return_bytes:bytes});break;
   }
   case 'RTS':if(t.stack.length){const r=pop('return');if(r.bytes!==2)throw Error('7C wrong return kind');t.pc=r.pc;}
    else{if(s.m||s.x)throw Error('7C root return mode');returns.add(cpuLabel(s.pc));continue;}break;
   case 'JMP':case 'BRA':if(i.target===undefined)throw Error('7C indirect boundary');t.pc=i.target;break;
   default:if(i.mode==='rel8')pending.push({...t,pc:i.target,stack:[...t.stack]});
    else if(['PHP','PLP','PHB','PLB','PHK','PHD','PLD','TCS','TXS','XCE','RTL','RTI','BRK','COP','JML','MVN','MVP'].includes(i.mnemonic))throw Error('7C unproved control');
  }
  pending.push(t);
 }
 if(visited.size!==map.size)throw Error('7C unreachable supplied source');
 const storeModes=[...modes].map(JSON.parse).filter(m=>m.at==='80:86C4');
 if(JSON.stringify(storeModes.map(m=>m.m).sort())!=='[0,1]')throw Error('7C original BYTE/WORD merge required');
 return {entry:'80:8E36',local_source_complete:true,full_graph_closed:false,conditional_graph_closed:true,native_binding:false,
  full_task_binding:false,
  external_return_assumptions:0,reachable_instructions:visited.size,abstract_states:seen.size,root_return:'RTS',
  maximum_local_stack_bytes:maximum,minimum_protected_stack_bytes:maximum+2,global_stack_minimum:null,
  returns:[...returns].map(at=>({at,m:0,x:0,dbr:'80'})),modes:[...modes].map(JSON.parse).sort((a,b)=>a.at.localeCompare(b.at)||a.m-b.m),
  inner_calls:[...new Map(calls.map(c=>[c.at,c])).values()].sort((a,b)=>a.at.localeCompare(b.at)),
  conditional_boundaries:['Fresh F953 input WORD3030 is original reset, rejects before outer commit',
   'Fresh C46E voice zero consumes saved sound instead of root return, rejects before outer commit'],
  qualification:'Whole original local8E36/8691/881C sources and nine independently renewed transitive helper contracts; actual mode at86C4 gives BYTE and WORD store. Original fixed56 scan, strict60 differences, dynamic full indices and fresh PHX/PHY/PEI/PHA/return bytes, mixed real JSR/JSL/RTS/RTL. Structural proof assumes intact code/stack and normal helper predicates; runtime validates every matching return/context and each physical access atomically. No initialized callers, RNG/PPU/APU/time/input progress, Task/scene/frames or complete body claim.'};
}
export async function source8E36(bytes){
 const decoded=decodeTaskWindows(bytes,spec.windows),helpers=renew8E36Helpers(bytes),proof=prove8E36Local(decoded.map,helpers);
 const pin=w=>{const off=cpuToOffset(w.start,bytes.length),raw=bytes.subarray(off,off+w.hex.length/2);
  if(raw.toString('hex').toUpperCase()!==w.hex)throw Error('7C data/metadata drift');return {entry:cpuLabel(w.start),machine_bytes:w.hex,sha256:taskHash(raw),covered_bytes:raw.length,...(w.kind?{kind:w.kind}:{})};};
 return {rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',windows:decoded.windows,helpers,proofs:[proof],
  anchors:spec.anchors.map(pin),tables:[...randomTables,native8E36Table].map(pin),source_graph:{local_source_complete:true,full_graph_closed:false,conditional_graph_closed:true,
   native_binding:false,code_bytes:decoded.windows.reduce((n,w)=>n+w.covered_bytes,0),instructions:decoded.map.size},completed_script_bodies:0};
}
export async function emit8E36Source(){const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong ROM');
 const report=await source8E36(bytes);await writeFile('analysis/render-task-native-8e36.json',JSON.stringify(report,null,2)+'\n');
 await writeFile('analysis/render-task-native-8e36.asm.txt',decodeTaskWindows(bytes,spec.windows).blocks.map(formatBlock).join('\n'));
 console.log(`7C local ${report.source_graph.code_bytes}/${report.source_graph.instructions}, nine whole helper contracts, stack ${report.proofs[0].minimum_protected_stack_bytes}, BYTE/WORD86C4.`);return report;}
