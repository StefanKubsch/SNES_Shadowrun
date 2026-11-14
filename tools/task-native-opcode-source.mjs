import {readFile} from 'node:fs/promises';
import {cpuLabel,cpuToOffset} from './rom.mjs';
import {decodeTaskWindows,taskHash,taskRomHash} from './task-partial-source.mjs';
import {proveOpcodeBinding} from './task-opcode-source.mjs';
import {taskOpcodeSpecs} from './task-opcode-specs.mjs';
import {loadTaskNativeBlock} from './task-native-catalog.mjs';
import {nativeOpcodeSpecs} from './task-native-opcode-specs.mjs';
import {proveLeafSource} from './task-native-leaf-source.mjs';

export async function renew(bytes,name){
 const path=`analysis/render-task-${name}.json`,source=JSON.parse(await readFile(path));
 if(source.rom_sha256!==taskRomHash)throw Error('Native58 composition ROM drift');
 const windows=source.windows.map(w=>({start:parseInt(w.entry.replace(':',''),16),hex:w.machine_bytes}));
 for(const w of windows){const offset=cpuToOffset(w.start,bytes.length);
  if(bytes.subarray(offset,offset+w.hex.length/2).toString('hex').toUpperCase()!==w.hex)throw Error('Native58 composition window drift');}
 const b=await loadTaskNativeBlock(name),modes=windows.map(w=>({...w,...b.decodeModes.find(m=>m.entry===w.start)}));
 const proof=b.proveSource(decodeTaskWindows(bytes,modes).map,b.entries[0]);
 if(JSON.stringify(source[b.proofField]?.find(p=>p.entry===proof.entry))!==JSON.stringify(proof)
  ||proof.external_return_assumptions!==0)throw Error('Native58 composition proof drift');
 return {source_contract:path,windows:source.windows,proof};
}
export async function proveNativeOpcode(bytes,spec=null){
 const slot=await proveOpcodeBinding(bytes,taskOpcodeSpecs.find(s=>s.opcode===0x58));
 const parts=[];
 for(const name of ['native-arguments','native-bridge','native-dispatch','native-resume'])parts.push(await renew(bytes,name));
 if(parts[0].proof.frontier.at!=='80:F4F6'||parts[1].proof.frontier.at!=='80:F52F'
  ||parts[3].proof.frontier.at!=='80:F390')throw Error('Native58 composition frontier drift');
 const sourceTargets=[];
 for(const s of spec?[spec]:nativeOpcodeSpecs){
  if(!nativeOpcodeSpecs.some(p=>p.entry===s.entry&&p.id===s.id))throw Error('Unadmitted Native58 composition');
  const leaf=await renew(bytes,s.name),renewed=proveLeafSource(decodeTaskWindows(bytes,s.windows).map,s);
  if(JSON.stringify(renewed)!==JSON.stringify(leaf.proof))throw Error('Native58 leaf proof drift');
  const anchors=s.anchors.map(a=>{const offset=cpuToOffset(a.start,bytes.length),raw=bytes.subarray(offset,offset+2);
   if(raw.toString('hex').toUpperCase()!==a.hex)throw Error('Native58 composition anchor drift');
   return {kind:a.kind,entry:cpuLabel(a.start),machine_bytes:a.hex,sha256:taskHash(raw)};});
  sourceTargets.push({name:s.name,id:s.id,target:cpuLabel(s.entry),anchors,
   source_contract:leaf.source_contract,windows:leaf.windows,...(spec?{proof:leaf.proof}:{})});
 }
 return {entry:'80:F390',native_binding:false,local_source_complete:true,source_closed_to_dispatch:true,
  full_graph_closed:false,full_task_binding:false,global_stack_minimum:null,minimum_protected_stack_bytes:null,
  external_return_assumptions:0,opcode:0x58,target:'80:F4CB',slot:slot.slot,argument_prefix:slot.handler_proof,
  parts,admitted_targets:sourceTargets,
  output_mode:{e:0,m:0,x:0},
  joins:[{from:'80:F4CB',to:'80:F4F6',kind:'fallthrough-before-TCS'},
   {from:'80:F506',to:'80:F52F',kind:'actual-JSR-F508-high-low'},
   {from:'80:F52F',to:'fresh-00:A2',kind:'fresh-bank00-pointer-after-JSR'},
   {from:'leaf-RTS',to:'80:F509',kind:'fresh-F508-return-only-E0M0X0D0-DBR80'},
   {from:'80:F509',to:'80:F390',kind:'fresh-Task-D-DBR-S-ID-metadata-result-PC-pointer-opcode'}],
  ownership:'Explicit physical protected outer bytes must match migrated S+1/S+2 before any bridge write and after actual leaf RTS. All source reads, argument workspace, return-frame bytes, pointer/ID/metadata/result/PC aliases use one overlay; no cached logical owners or global stack minimum.',
  budgets:'Finite explicit maxHandlers, one cumulative access/output/observation ledger, one outer commit. Native58 consumes one handler; callee result fetch never executes the next target on its own.',
  boundary:'Unadmitted actual target, wrong inner RTS/context, missing bytes, protected alias, write window, exhausted budget, unused observation or stale owner rejects all writes/requests. Original initialization, Script52/Yield/C1CA/F378/9178/BF3B, device timing, scene and frames remain open.'};
}
