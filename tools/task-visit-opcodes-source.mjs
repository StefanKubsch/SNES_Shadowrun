import {cpuToOffset} from './rom.mjs';
import {decodeTaskWindows,taskHash} from './task-partial-source.mjs';
import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveTaskVisit} from './task-visit-source.mjs';
import {proveOpcodeBinding} from './task-opcode-source.mjs';
import {taskOpcodeSpecs} from './task-opcode-specs.mjs';
import {proveNativeOpcode} from './task-native-opcode-source.mjs';
import {proveScriptOpcode} from './task-script-opcode-source.mjs';
export const visitTailWindow={start:0x80C1D9,hex:'F48080ABAB688D500260'};
export function proveVisitTail(map){
 assertPinnedTaskSource(map,[visitTailWindow]);
 const pcs=[0x80C1D9,0x80C1DC,0x80C1DD,0x80C1DE,0x80C1DF,0x80C1E2];
 const ops=['PEA','PLB','PLB','PLA','STA','RTS'];
 pcs.forEach((pc,n)=>{const i=map.get(pc);if(i?.mnemonic!==ops[n]||['e','m','x'].some(k=>i.state[k]!==0))throw Error('Tail source/width drift');});
 if(map.get(pcs[0]).value!==0x8080||map.get(pcs[4]).value!==0x250||map.get(pcs[4]).mode!=='abs')throw Error('Tail operand drift');
 return {entry:'80:C1D9',native_binding:false,local_source_complete:true,full_graph_closed:false,full_task_binding:false,
  global_stack_minimum:null,external_return_assumptions:0,input_mode:{e:0,m:0,x:0,d:0},visited:pcs.map(p=>'80:'+p.toString(16).slice(-4).toUpperCase()),
  stack_ledger:[{op:'PEA8080',delta:-2},{op:'PLB',delta:1},{op:'PLB',delta:1},{op:'PLA cursor',delta:2},{op:'RTS root',delta:2}],
  effects:'Actual PEA high/low, two actual PLB reads forceDBR80. Fresh bank00 cursor WORD PLA, full DBR80:0250 low/high stores, fresh root WORD RTS. Cursor bytes live, external root owners protected. Final A=cursor,D0,DBR80,S=entryS+4,PC=rawRoot+1 with WORD wrap; N/Z from cursor. No caller execution.',
  boundary:'Explicit observed C1D9 entry only; actual preceding return occurrence is separately proved in bounded visit/opcodes. No scheduling, initialization, scene or frames.'};
}
export async function proveVisitOpcodes(bytes){
 const off=cpuToOffset(visitTailWindow.start,bytes.length);
 if(bytes.subarray(off,off+visitTailWindow.hex.length/2).toString('hex').toUpperCase()!==visitTailWindow.hex)throw Error('Tail original byte drift');
 const tail=decodeTaskWindows(bytes,[visitTailWindow]),tailProof=proveVisitTail(tail.map),visit=await proveTaskVisit(bytes);
 const opcodes=[];
 // Current-stack F927 returns require their own future Visit join contract.
 for(const s of taskOpcodeSpecs.filter(s=>s.family!=='status-return')){const p=await proveOpcodeBinding(bytes,s);opcodes.push({opcode:s.opcode,target:p.target,slot:p.slot,
  source_contract:p.handler_source,handler_proof_sha256:taskHash(Buffer.from(JSON.stringify(p))),windows:p.handler_windows});}
 const native=await proveNativeOpcode(bytes),script=await proveScriptOpcode(bytes);
 const dependency=(path,p)=>({source_contract:path,proof_sha256:taskHash(Buffer.from(JSON.stringify(p)))});
 const proofs=['80:C1CA','80:C1F9','80:C20B'].map(entry=>({entry,native_binding:false,local_source_complete:true,full_graph_closed:false,
  full_task_binding:false,global_stack_minimum:null,external_return_assumptions:0,input_mode:{e:0,m:0,x:0,d:0,decimal:0},
  visit:dependency('analysis/render-task-visit.json',visit.proofs),tail:tailProof,opcodes,
  native58:dependency('analysis/render-task-native-opcode.json',native),script52:dependency('analysis/render-task-script-opcode.json',script),
  joins:[{from:'80:C208',to:'80:F378',raw_return:'C20A',kind:'Actual JSR high/low writes earn physical inner return ownership'},
   {from:'80:C203',to:'80:F495',raw_return:'C20A',kind:'Actual PEA then fresh PHA/RTS prove continuation occurrence, no readiness time assumed'},
   {from:'80:F4CA',to:'80:C20B',raw_return:'C20A',kind:'END reads fresh savedS and actual still-matching inner WORD'},
   {from:'C36A outer RTS',to:'80:C20B',raw_return:'C20A',kind:'Script52 consumes its actual caller WORD then actual owned outer WORD'},
   {from:'80:C238',to:'80:C1D9',raw_return:'C1D8',kind:'Only C1CA actual JSR-body owner admits the tail'},
   {from:'80:C1D9',to:'actual external root',kind:'Original bank/cursor/root tail; target observed only'}],
  ownership:'Local capability exists only after actual source-specific push of rawC20A/rawC1D8 on this overlay. It admits only a fresh matching WORD at both physical bank00 bytes; aliases remain live and changed return WORD rejects atomically. External protected owner set never expands or loses protection. No externally supplied capability or inferred return.',
  budgets:'Exact finite maxHandlers across every original join; one cumulative byte/access/output/observation ledger and one owner commit. F390 after the count is a boundary. Early return, unsupported target or trap/prefix discards the whole plan.',
  boundary:'Manually composed source equations and actual return joins, never arbitrary instruction execution. All byte owners and compatible initial context explicit. Whole interpreter, scheduler,9178/BF3B, initialization, MMIO timing, scene and frames remain open.'}));
 return {windows:[...visit.windows,...tail.windows],proofs};
}
export async function proveVisitTailBytes(bytes){
 const offset=cpuToOffset(visitTailWindow.start,bytes.length);
 if(bytes.subarray(offset,offset+visitTailWindow.hex.length/2).toString('hex').toUpperCase()!==visitTailWindow.hex)throw Error('Tail original drift');
 const r=decodeTaskWindows(bytes,[visitTailWindow]);return {windows:r.windows,proofs:[proveVisitTail(r.map)]};
}
