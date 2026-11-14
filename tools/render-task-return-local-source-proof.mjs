import {proveTaskControl,taskWord,taskStream,taskOwner} from './task-control-source.mjs';
export const spec={name:'return-local',opcode:0x50,entry:0x80F454,window:{start:0x80F454,hex:'A5051A1A8505B205A84C89F3'},s_delta:0,
  contract:'Fresh DP05 WORD, two WORD INC, STA05 low/high; then fresh DP05 pointer WORD via LDA(DP05), actualDBR fullreturnWORD, TAY. Pointer store can alias its own subsequent return data. S unchanged, no CPU PLA/RTS/returnframe. Fresh DP00/opcode fetch after writes, full Y return and no underflow/cap/target/init guards. Final A/X=opcodeLow,N0/Z,C/V/I/decimal/D/DBR preserved.',
  host_boundary:'Host50 uses calls array and guarded decodedreturntargets; it does not provide original DP05/DBR return memory or its alias chronology.'};
export const prove=map=>proveTaskControl(map,spec);
export function describeLocalReturn({d,bank,s,localPointerBefore,localPointerAfterStore,returnWord,pointerAfter}){
  if(![d,s,localPointerBefore,localPointerAfterStore,returnWord].every(taskWord))throw Error('Explicit localreturn WORDs');
  const value=(localPointerBefore+2)&65535,owners=[taskOwner((d+5)&65535),taskOwner((d+6)&65535)],local=taskStream((d+5)&65535,bank,localPointerAfterStore,0),next=taskStream(d,bank,pointerAfter,returnWord);
  const writes=owners.map((b,n)=>({...b,order:n+1,byte:n?'high':'low',value:n?Math.floor(value/256):value%256}));
  return {initial_pointer_read:owners,pointer_writes:writes,new_local_pointer:value,fresh_return_pointer:{value:localPointerAfterStore,bytes:local.pointer_reads},return_word_sources:local.word_reads,next_opcode_sources:next,output_operand_s:s,fetch_y:returnWord,frontier_y:(returnWord+1)&65535,
    ordered_accesses:[{kind:'DP05-WORD',operation:'read',bytes:owners},...writes.map(b=>({kind:'DP05-'+b.byte,operation:'write',bytes:[b]})),{kind:'fresh-return-pointer',operation:'read',bytes:local.pointer_reads},{kind:'return-WORD',operation:'read',bytes:local.word_reads},{kind:'fresh-next-pointer',operation:'read',bytes:next.pointer_reads},{kind:'fresh-opcode-WORD',operation:'read',bytes:next.word_reads}],
    qualification:'Supplied values/address equations only, no memory execution or consistency claim. DP00/05 bank00 16bit, indirect data actualDBR 24bit. Fresh pointer/return/fetch observations after own writes; physical mapping gives no permission/init/globalstack/native bridge.'};
}
