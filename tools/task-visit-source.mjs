import {readFile} from 'node:fs/promises';
import {cpuToOffset} from './rom.mjs';
import {decodeTaskWindows,taskRomHash} from './task-partial-source.mjs';
import {proveVisitC1CAFrontier} from './render-c1ca-stack-proof.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
import {proveScriptContinuation} from './task-script-opcode-source.mjs';
export const visitEntries=['80:C1CA','80:C1F9','80:C20B','80:C3C9','80:C396'];
export async function proveTaskVisit(bytes){
 const pins=JSON.parse(await readFile(new URL('./task-visit-windows.json',import.meta.url)));
 for(const w of pins){const off=cpuToOffset(w.start,bytes.length);if(bytes.subarray(off,off+w.hex.length/2).toString('hex').toUpperCase()!==w.hex)throw Error('Visit original window drift');}
 const decoded=decodeTaskWindows(bytes,pins),old=JSON.parse(await readFile('analysis/render-c1ca.json'));
 if(old.rom_sha256!==taskRomHash)throw Error('Visit ROM identity drift');
 const frontier=proveVisitC1CAFrontier(decoded.map),noDispatch=proveVisitC1CAFrontier(decoded.map,{skipReady:true});
 const readiness=proveWordStack(decoded.map,0x80C3C9,'RTS',{measureStack:true});
 const removal=proveWordStack(decoded.map,0x80C396,'RTS',{measureStack:true});
 if(JSON.stringify(frontier)!==JSON.stringify(old.full_graph.frontier)||JSON.stringify(noDispatch)!==JSON.stringify(old.no_dispatch_graph.proof)
  ||JSON.stringify(readiness)!==JSON.stringify(old.readiness_graph.proof)||JSON.stringify(removal)!==JSON.stringify(old.removal_graph.proof))throw Error('Renewed visit stack proof drift');
 const continuation=await proveScriptContinuation(bytes);
 const proofs=visitEntries.map(entry=>({entry,native_binding:false,local_source_complete:true,full_graph_closed:false,full_task_binding:false,
  external_return_assumptions:0,global_stack_minimum:null,input_mode:{e:0,m:0,x:0,d:0,decimal:0},
  source_windows:decoded.windows,frontier_stack_proof:frontier,conditional_no_dispatch_proof:noDispatch,
  readiness_proof:readiness,removal_proof:removal,continuation,
  joins:[{from:'80:C1F9',to:'80:C3C9',raw_return:'C1FB',resume:'80:C1FC'},
   {from:'80:C21E',to:'80:C396',raw_return:'C220',resume:'80:C221'},
   {from:'80:C39D',to:'80:C2BD',raw_return:'C39F',resume:'80:C3A0'},
   {from:'80:C207',to:'80:F495',kind:'actual fresh stored rawF494 consumed by RTS; other nonzero targets fail atomically'},
   {from:'80:C208',to:'80:F378',raw_return:'C20A',kind:'PEI/PLB/actual savedS/operandS/full fetch to BEFORE F390'}],
  boundary:'Manual bounded original visit/readiness/release. PostrunC20B needs separately observed E0M0X0/D0/DBR/S. Real continuationF495 stops at F390; arbitrary targets, whole interpreter/task/9178/BF3B, initialization and scene/frames remain open. No external callee return is inferred.'}));
 return {windows:decoded.windows,proofs};
}
