import {proveVisitOpcodes} from './task-visit-opcodes-source.mjs';
import {proveOpcodeBinding} from './task-opcode-source.mjs';
import {spec,prove} from './render-task-status-return-source-proof.mjs';
import {decodeTaskWindows,taskHash} from './task-partial-source.mjs';
import {statusOpcodeSpecs} from './task-visit-status-fixtures.mjs';
export async function proveVisitStatus(bytes){
 const base=await proveVisitOpcodes(bytes),status=decodeTaskWindows(bytes,spec.windows),statusProof=prove(status.map);
 // Renew every instruction on postrun/remove/tail until the next separately
 // proved F378/F495 entry. None uses direct page or writes D, so F927's D stays.
 const decoded=decodeTaskWindows(bytes,base.windows.map(w=>({start:parseInt(w.entry.replace(':',''),16),hex:w.machine_bytes})));
 const dLedger=[...decoded.map.entries()].map(([pc,i])=>({...i,pc})).filter(i=>[[0x80C1D9,0x80C1E3],[0x80C1FE,0x80C242],[0x80C2BD,0x80C2C8],[0x80C396,0x80C3C9]]
  .some(([lo,hi])=>i.pc>=lo&&i.pc<hi));
 if(!dLedger.length||dLedger.some(i=>['TCD','PLD'].includes(i.mnemonic)||/^(dp|di|dix|diy|dil|dily)$/.test(i.mode)))throw Error('Postrun D-preservation source drift');
 const slots=[];
 for(const s of statusOpcodeSpecs){const p=await proveOpcodeBinding(bytes,s);slots.push({opcode:s.opcode,target:p.target,slot:p.slot,
  source_contract:p.handler_source,proof_sha256:taskHash(Buffer.from(JSON.stringify(p))),windows:p.handler_windows,
  prefix:s.family==='trap-prefix'?'Original fixed JMP80:F927 only; no fallthrough':'Original direct F927 table target'});}
 return {windows:[...base.windows,...status.windows],proofs:base.proofs.map(p=>({...p,
  original_visit_contract:'analysis/render-task-visit-opcodes.json',original_visit_proof_sha256:taskHash(Buffer.from(JSON.stringify(p))),
  status_return:{source_contract:'analysis/render-task-status-return.json',proofs:statusProof,slots},
  joins:[...p.joins,{from:'80:F952',to:'80:C20B',raw_return:'C20A',kind:'F927 reads current S+1/+2 freshly after status writes; only actual earned matching physical inner owner admits C20B'}],
  current_stack_return:'No TCS or savedOuterS read. Current operandS must independently identify the actual still-matching source-written C20A owner; equal externally protected bytes or a savedS owner elsewhere never suffice. Five original JMP prefixes reach this same pinned body without executing fallthrough.',
  postrun_d_ledger:dLedger.map(i=>({pc:i.pc,mnemonic:i.mnemonic,mode:i.mode})),
  postrun_d:'Pinned C20B/remove/release/C1D9 operations use actualDBR absolute operands and native stack only; D is preserved through root RTS. A new F378/F495 uses its own full original TCD/DP equations. Initial external Visit and standalone Tail retain D0 premises.',
  boundary:'Separate bounded current-stack F927/Visit join. Full original WORD opcode/target and current return reads, fixed original C20B/tail equations, cumulative count/budgets and outer atomic commit. No whole interpreter, script bodies, scheduler, initialization, device chronology, scenes or frames.'}))};
}
