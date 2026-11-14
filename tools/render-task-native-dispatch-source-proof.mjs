import {assertPinnedTaskSource} from './pinned-task-source.mjs';
export const dispatchSpec={name:'native-dispatch',entry:0x80F52F,
 windows:[{start:0x80F52F,hex:'6CA200'}],classification:'native58-indirect-target-frontier',
 host_boundary:'Fresh bank00 WORD00A2 after all preceding writes, PBR80 target; no DP/DBR-relative pointer, no inferred target or return. Only individually proved typedRTS graphs may be bound; helper graphs require their own calls/stack/return proof.'};
export function prove(map){
 assertPinnedTaskSource(map,dispatchSpec.windows);
 if(map.size!==1)throw Error('Unexpected indirect dispatch source');
 return {entry:'80:F52F',native_binding:false,local_source_complete:true,source_closed_to_dispatch:false,
  full_graph_closed:false,global_stack_minimum:null,minimum_protected_stack_bytes:null,external_return_assumptions:0,
  pointer:{address:'00:00A2',width:2,wrap:16,bank:'00',directPageApplied:false,dataBankApplied:false,freshAfterWrites:true},
  target:{programBank:'80',source:'fresh pointer WORD',callee:'individually pinned E0M0X0D0 typedRTS graph with separate local stack/call proof'},
  qualification:'Original JMP($00A2) only; fresh low/high bank00 bytes, no flags/stack/data writes from JMP. Unknown targets, missing bytes or unproved mode/return contracts stop atomically. Separate source-bound native composition does not imply wholeTask/scene/frame or occurrence.'};
}
