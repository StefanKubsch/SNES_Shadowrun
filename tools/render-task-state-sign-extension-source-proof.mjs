import {assertPinnedTaskSource,taskFetchWindow,finiteTaskPaths} from './pinned-task-source.mjs';
import {signExtensionWordConsequence} from './render-task-sign-extension-source-proof.mjs';
import {describeStateReadByteOwners} from './render-task-state-reads-source-proof.mjs';
import {cpuLabel} from './rom.mjs';
export const stateSignWindow={start:0x80F90F,hex:'B100C8C8AABF00007E29FF00C9800090030900FF484C89F3'};
export function proveStateSignToDispatch(map){assertPinnedTaskSource(map,[stateSignWindow,taskFetchWindow]);const paths=finiteTaskPaths(map,0x80F90F).sort((a,b)=>a.length-b.length);
  return {entry:'80:F90F',source_closed_to_dispatch:true,full_graph_closed:false,native_binding:false,code_bytes:34,instructions:16,
    outer_return_frames_added:0,operand_s_delta:-2,minimum_protected_stack_bytes:null,external_return_assumptions:0,
    paths:paths.map((path,n)=>({condition:n?'stateLow80..FF/C1/ORAFF00':'stateLow00..7F/C0/noORA',visited:path.map(cpuLabel),executed_instructions:path.length,n_before_push:1,z_before_push:0})),
    offset:'Full WORD via fresh DP00/actualDBR/Y, two INY/full TAX, no lowmask/ASL/parity/cap; WORD LDA7E0000,X low/high including7F0000 atXFFFF before AND00FF.',
    flags:'CMP0080 C1 iff stateLow>=80 independent of incomingC/decimal, V preserved. PrePHA N1/Z0 on BOTH paths, positive/zero flags from negative WORD CMP result, negative ORA resetsN/Z. Fresh fetch N0/Z(opcodeLow==0), Carry from actualCMP; V/I/decimal/D/DBR retained.',
    stack:'WORD PHA high00/FF atbank00:S thenstateLow at(S-1)&FFFF; S-2, two writeowners/no stackreads. State/index reads before both writes, fresh pointer/opcode after both.',
    frontier:{at:'80:F390',a_x:'Fresh nextOpcodeLow',fetch_y_delta:2,frontier_y_delta:3,target:'80:WORD(80:F2B4+X), no ASL/parity/cap; next body open'},
    qualification:'Own0E/fetch windows independently pinned; address/data dependencies reused separately. Two finite paths15/16 only; physical State/pointer/stack/opcode owners, intactcode/outerstack and full task/native/globalstack return remain explicit. No CPU/memory/device execution.'};
}
export function stateSignConsequence({offsetWord,stateWord}){if(!Number.isInteger(offsetWord)||offsetWord<0||offsetWord>65535)throw Error('Explicit offset WORD required');return {...signExtensionWordConsequence({entry:0x80F3F6,operandWord:stateWord}),index:offsetWord,offsetWord};}
export function describeStateSignOwners(context){const base=describeStateReadByteOwners({...context,entry:0x80F8E4}),c=stateSignConsequence(context),stack=base.stack_writes.map((b,n)=>({...b,value:n?c.data_low:Math.floor(c.value/256)}));
  return {...base,...c,index:context.offsetWord,entry:'80:F90F',state_sources:{...base.state_sources,at:'80:F914'},stack_writes:stack,
    ordered_accesses:base.ordered_accesses.map(a=>a.kind==='PHA-high'?{...a,bytes:[stack[0]]}:a.kind==='PHA-low'?{...a,bytes:[stack[1]]}:a),
    qualification:'Pure supplied State/offset/address equations reused from checked04/18 and low-sign equations from0A; actual0E bytes independently pinned. No memory read/write, CPU/device/native execution, ownership/permission/initialization proof. State reads before high/low PHA, fresh pointer/opcode afterwards.'};
}
