import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {taskSourceEdges} from './task-partial-source.mjs';
import {finiteTaskPaths} from './pinned-task-source.mjs';
import {cpuLabel} from './rom.mjs';
export const spec={name:'status-return',entry:0x80F927,classification:'original-status-bit-publication-current-stack-RTS',
  windows:[{start:0x80F927,hex:'E220ADBE01A600100709048DBE01800529FB8DBE01ADC001E00100D00709048DC001800529FB8DC001C22060'}],
  host_boundary:'Current-stack protected actual RTS target only. No saved-S restoration, comparison fallthrough, END, Task/visit completion, scene or frame evidence.'};
export function prove(map,entry=0x80F927){
  if(entry!==spec.entry)throw Error('Original F927 entry required');
  assertPinnedTaskSource(map,spec.windows);
  const graph=taskSourceEdges(map,entry,[0x80F952]);
  const paths=finiteTaskPaths(map,entry,0x80F952).map(p=>p.map(cpuLabel));
  if(paths.length!==4)throw Error('Four finite original status paths required');
  if(map.get(0x80F92C).state.x!==0||map.get(0x80F92C).state.m!==1
    ||map.get(0x80F93F).value!==1||map.get(0x80F952).state.m!==0||map.get(0x80F952).mnemonic!=='RTS')
    throw Error('F927 WORD index, BYTE accumulator and actual WORD return required');
  return [{entry:'80:F927',native_binding:false,local_source_complete:true,source_closed_to_dispatch:false,
    full_graph_closed:false,full_task_binding:false,global_stack_minimum:null,external_return_assumptions:0,
    minimum_protected_stack_bytes:2,outer_return_frames_added:0,operand_s_delta:2,
    ...graph,paths,frontier:{at:'actual-outer-return-target',before:'actual bank80 target execution'},output_mode:{e:0,m:0,x:0},
    contract:'SEP20: BYTE A, WORD X. Read actualDBR01BE BYTE BEFORE fresh bank00:D+00/+01 WORD LDX, wrapping16. Signed X negative sets bit2 in first BYTE; nonnegative clears bit2. Write actualDBR01BE. Read actualDBR01C0 BYTE freshly AFTER first store; CPX0001 uses whole WORD, C=(X>=1); X==1 sets bit2, every other X clears it. Write actualDBR01C0. Hidden High-A retained from entry, Low-A=second written BYTE. Final N/Z from Low-A BYTE, C from full CPX; V/I/decimal preserved. REP20 restores WORD A, leaves WORD X, Y/D/DBR unchanged. Actual RTS reads current bank00:S+1/+2 WORD low/high after stores, S+2 wrap16 and PC=(rawReturn+1)&FFFF in bank80. Both current return physical owners must be explicitly protected. No operand pop, savedOuterS read, TCS, extra return frame, target execution or implicit Task return.',
    qualification:'Complete pinned finite four-path source. Intact current return owners and all actual readable/writable physical sources remain premises; protected aliases fail atomically, and no global stack or original lifecycle is inferred.'}];
}
