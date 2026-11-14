import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {cpuLabel} from './rom.mjs';
export function proveContinuation(map,spec){
 assertPinnedTaskSource(map,spec.windows);
 const bridge=spec.name==='native-bridge',frontier=bridge?0x80F52F:0x80F390;
 const pending=[spec.entry],seen=new Set(),edges=[];
 while(pending.length){const pc=pending.pop();if(seen.has(pc))continue;seen.add(pc);const i=map.get(pc);if(!i)throw Error('Uncovered migration source');
  const targets=bridge&&i.cpu===0x80F506?[frontier]:i.mnemonic==='JMP'?[i.target]:i.mode==='rel8'?[i.next,i.target]:[i.next];
  for(const to of targets){edges.push({from:cpuLabel(pc),to:cpuLabel(to)});if(to!==frontier)pending.push(to);}
 }
 if(seen.size!==map.size||!edges.some(e=>e.to===cpuLabel(frontier)))throw Error('Incomplete migration frontier');
 return [{entry:cpuLabel(spec.entry),native_binding:false,local_source_complete:true,source_closed_to_dispatch:false,full_graph_closed:false,
  graph:{visited:[...seen].sort((a,b)=>a-b).map(cpuLabel),edges},frontier:{at:cpuLabel(frontier),before:bridge?'JMP ($00A2)':'indexed opcode dispatch'},
  external_return_assumptions:0,minimum_protected_stack_bytes:null,global_stack_minimum:null,
  transient_stack_bytes:2,stack_migration:true,return_target_executed:false,
  contract:bridge?'TCS from observed fullA, LDA0/TCD, PEA8080 high-low writes and two fresh BYTE PLBs. FullX 24bit WORD82D7B8+X read, D0 WORDstoreA2, JSR highF5/low08 at migrated S, stop BEFORE F52F. D0/DBR80 established locally; last LDA flags from pointer.':'Fresh actualDBR WORD0250 and WORD0252+fullX -> fullD. Fresh DP01 WORD PEI high-low writes; two fresh PLBs set finalDBR from second byte, TSC and actualDBR01F2 store. Fresh DP07 -> S, fullDP09 index to WORD82D970+X including ignored high, maskLow. Nonzero metadata reads fullactualDBR0000 result and pushes high-low. FreshDP03 ->Y and freshDP00 pointer/opcode via F389; stop BEFORE F390. Return mode is explicit E0/M0/X0, never inferred from callee.',
  qualification:'Pinned source-specific manual migration contract only; protected actual outer return owners, physical stack bytes, explicit write windows and cumulative access budgets required. No global stack proof, indirect callee, wholeTask/scene/frame or temporal occurrence claim.'}];
}
