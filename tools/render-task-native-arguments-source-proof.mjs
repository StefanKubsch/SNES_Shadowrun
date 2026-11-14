import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {taskSourceEdges} from './task-partial-source.mjs';
export const spec={name:'native-arguments',entry:0x80F4CB,opcode:0x58,classification:'native-argument-prefix',
 windows:[{start:0x80F4CB,hex:'B100C829FF0084038509AABF4CDA8229FF00F00DA8A20000689D0000E8E888D0F7A5090AAA3B8507ADF201'}],
 host_boundary:'Original Native58 physical arguments and fresh aliases are separate from host array/native event dispatch.'};
export function prove(map) {
 assertPinnedTaskSource(map,spec.windows);
 if(map.get(0x80F4F3)?.next!==0x80F4F6)throw Error('Native58 argument frontier drift');
 const graph=taskSourceEdges(map,spec.entry,[0x80F4F3]);
 return [{entry:'80:F4CB',native_binding:false,local_source_complete:true,source_closed_to_dispatch:false,full_graph_closed:false,
  graph,frontier:{at:'80:F4F6',before:'TCS'},operand_s_delta:'2*argumentLow0..255',outer_return_frames_added:0,
  minimum_protected_stack_bytes:null,global_stack_minimum:null,external_return_assumptions:0,
  contract:'Full operandWORD through fresh DP00/actualDBR/Y, INY1/AND00FF. SavePC03/ID09 before metadataWORD82DA4C+ID including ignoredHigh. Low0 skips loop; else exact count WORDPLA/workspaceSTA actualDBR0000+X/INX2/DEY. Fresh fullDP09 after stores, ASL16/TAX with actualCarry, TSC->DP07, freshactualDBR01F2->A. Stop beforeTCS atF4F6. No cached ID/metadata/pointer, arraystack/clamp/device or return inference.',
  qualification:'Complete pinned local original Native58 argument prefix with structural loop only, explicit fresh physical sources/owners/stack and budgets. Native callee dispatch, stack migration, return and wholeTask/C1CA/scene/frame remain separate.'}];
}
