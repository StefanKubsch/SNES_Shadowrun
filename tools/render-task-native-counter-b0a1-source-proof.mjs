import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
export const counterWindows=[{start:0x81B0A1,hex:'AF761C7ECF761C7EF0FA6B'}];
export function prove(map){
 assertPinnedTaskSource(map,counterWindows);
 const p=proveWordStack(map,0x81B0A1,'RTL',{measureStack:true});
 if(p.reachable_instructions!==4||p.maximum_local_stack_bytes!==0||p.minimum_protected_stack_bytes!==3
  ||p.external_return_assumptions!==0||p.returns.some(r=>r.m!==0||r.x!==0||r.dbr!=='entry'))throw Error('Counter source/stack/mode drift');
 return {...p,native_binding:false,local_source_complete:true,full_graph_closed:true,full_task_binding:false,
  source_closed_to_dispatch:false,global_stack_minimum:null,root_return:'RTL',return_target_executed:false,
  actual_termination_proven:false,wait_reads:[{at:'81:B0A5',entry:'7E:1C76',width:2,comparison:'saved full A baseline, original unsigned CMP C/N/Z; V preserved'}],
  qualification:'Whole original11byte/4instruction WORD baseline/CMP/BEQ/RTL graph. Long7E1C76 is independent of DBR, both bytes read freshly; repeated equal observations never return. Actual three bank00 stack bytes supply WORD/bank RTL, target reported only. Every original-PC/address/width/value counter poll is an independent chronological observation on one private owner/budget/commit. Counter changes do not prove input, elapsed time, VBlank, callback, transfer, interrupt, original caller, wholeTask/scene/frames or a scriptbody.'};
}
