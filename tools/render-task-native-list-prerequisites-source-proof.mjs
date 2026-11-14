import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
import {taskListSpecs} from './task-native-list-specs.mjs';
import {taskTextComposeWindows} from './task-native-text-compose-spec.mjs';
export const decodeModes=taskTextComposeWindows.filter(w=>w.initialM||w.initialX)
 .map(w=>({entry:w.start,initialM:w.initialM??0,initialX:w.initialX??0}));
export function listWindows(entry){
 const spec=taskListSpecs.find(s=>s.entry===entry);if(!spec)throw Error('Unproved list root');
 const cursor=taskListSpecs.find(s=>s.entry===0x80FAAC).window,number=taskListSpecs.find(s=>s.entry===0x80FD80).window;
 return entry===0x80FAAC?[cursor]:entry===0x80FD80?[number,...taskTextComposeWindows.filter(w=>!['textFE69','bitAF04'].includes(w.name))]:
  [spec.window,cursor,...(entry===0x80A617?[number]:[]),...taskTextComposeWindows];
}
export function prove(all,entry){
 const windows=listWindows(entry),map=new Map([...all].filter(([pc])=>windows.some(w=>pc>=w.start&&pc<w.start+w.hex.length/2)));
 assertPinnedTaskSource(map,windows);
 const spec=taskListSpecs.find(s=>s.entry===entry),p=proveWordStack(map,entry,'RTS',{measureStack:true,widthJoins:new Set(entry===0x80FAAC?[]:[0x80FC36])});
 if(p.reachable_instructions!==map.size||p.minimum_protected_stack_bytes!==spec.stackBytes
  ||p.maximum_local_stack_bytes!==spec.stackBytes-2||p.external_return_assumptions!==0
  ||p.returns.some(r=>r.m!==0||r.x!==0||r.dbr!=='entry'))throw Error('List root whole graph/mode/stack drift');
 return {...p,native_binding:false,local_source_complete:true,full_graph_closed:true,full_task_binding:false,
  source_closed_to_dispatch:false,global_stack_minimum:null,root_return:'RTS',return_target_executed:false,
  qualification:'Whole individually pinned A617/A5DB/A5F9/FAAC/FD80 root and every reached original FE69/FB39 dependency, actual PHY/PLY/PHB/PEA/PHP/PLP/JSR/JSL/RTS/RTL bytes and fresh matching return frames. Full WORD row/count/index loops and pointer refetches, actual WORD/BYTE changes and preserved hiddenHighA, chained ADC Carry, BYTE4216/WORD4214 number observations with no inferred division/digit guard, null-inclusive fresh forward copy, global chronological MMIO/wait records on one owner/budget/commit. Intact source/stack and explicit fresh inputs, no original initialization/Native13/menu/caller/wholeTask/scene/frames or scriptbody claim.'};
}
