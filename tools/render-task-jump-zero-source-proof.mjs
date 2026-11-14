import {proveTaskControl,taskWord,taskOwner,taskStream} from './task-control-source.mjs';
export const spec={name:'jump-zero',opcode:0x44,entry:0x80F420,window:{start:0x80F420,hex:'68F005C8C84C89F3B100A84C89F3'},s_delta:2,
  contract:'WORD PLA Low/High bank00:S+1/+2 then BEQ on actualWORD Z. Zero path only reads fulltargetWORD via freshDP00/DBR/entryY and WORD TAY; nonzero twoINY, no targetread/pointerBefore owner. BothfreshF389 pointer/fullopcode; takenfetchY=targetWORD, skipfetchY=entryY+2; frontierY=fetchY+1, S+2, no memory stores. C/V/I/decimal/D/DBR preserved; finalA/X=opcodeLow,N0/Z(opcodeLow==0). No capacity/targetboundary/init guards.',
  host_boundary:'Host44 has bounded decodedtargets/arraystack and hostPC stopsbeforefetch; no actualWORDhigh/DP/DBR/S or freshopcode binding.'};
export const prove=map=>proveTaskControl(map,spec);
export function describeJumpZero({d,bank,s,y,conditionWord,targetWord,pointerBefore,pointerAfter}){if(![s,y,conditionWord].every(taskWord))throw Error('Explicit branch WORDs');const taken=conditionWord===0;if(taken&&!taskWord(targetWord))throw Error('Explicit taken target WORD');
  const nextY=taken?targetWord:(y+2)&65535,next=taskStream(d,bank,pointerAfter,nextY),target=taken?taskStream(d,bank,pointerBefore,y):null;
  return {taken,stack_reads:[taskOwner((s+1)&65535),taskOwner((s+2)&65535)],target_sources:target,next_opcode_sources:next,output_operand_s:(s+2)&65535,fetch_y:nextY,frontier_y:(nextY+1)&65535,
    qualification:'Pure source address equations/supplied WORDs, no memory/CPU execution. Skippedtarget has NO readowner; taken fulltarget beforefreshfetch. No owner/permission/globalstack/nativebridge proof.'};}
