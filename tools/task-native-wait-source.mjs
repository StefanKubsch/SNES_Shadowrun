import {readFile} from 'node:fs/promises';
import {cpuToOffset,cpuLabel} from './rom.mjs';
import {decodeTaskWindows,taskHash,taskRomHash} from './task-partial-source.mjs';
import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {loadTaskNativeBlock} from './task-native-catalog.mjs';
import {proveOpcodeBinding} from './task-opcode-source.mjs';
import {taskOpcodeSpecs} from './task-opcode-specs.mjs';
import {proveTaskVisit} from './task-visit-source.mjs';

export const waitWindow={start:0x80C401,hex:'AE5002A5009DA20BA5029D020C9E620C689DB20260'};
export const waitAnchors=[{start:0x82D8F6,hex:'01C4',kind:'pointer'},
 {start:0x82DAEB,hex:'0202',kind:'argument-metadata'},
 {start:0x82DA0F,hex:'0200',kind:'return-metadata'}];
export function proveNativeWait(map){
 assertPinnedTaskSource(map,[waitWindow]);
 const pcs=[0xC401,0xC404,0xC406,0xC409,0xC40B,0xC40E,0xC411,0xC412,0xC415];
 const ops=['LDX','LDA','STA','LDA','STA','STZ','PLA','STA','RTS'];
 pcs.forEach((pc,n)=>{if(map.get(0x800000|pc)?.mnemonic!==ops[n])throw Error('Wait source operation drift');});
 if(map.size!==pcs.length)throw Error('Wait source coverage drift');
 return {entry:'80:C401',native_binding:false,local_source_complete:true,full_graph_closed:false,
  full_task_binding:false,external_return_assumptions:0,global_stack_minimum:null,
  input_mode:{e:0,m:0,x:0,d:0},visited:pcs.map(pc=>cpuLabel(0x800000|pc)),
  stack_ledger:[{at:'80:C411',operation:'PLA',delta:2,owner:'fresh current bank00 S+1/S+2; discarded native JSR WORD'},
   {at:'80:C415',operation:'RTS',delta:2,owner:'fresh remaining bank00 S+3/S+4; protected actual outer WORD',target:'80:((raw+1)&FFFF)',target_executed:false}],
  data_events:[{at:'80:C401',operation:'WORD LDX',source:'actualDBR0250'},
   {at:'80:C404',operation:'WORD LDA',source:'bank00 D0 DP00'},
   {at:'80:C406',operation:'WORD STA',destination:'actualDBR0BA2+latched full X'},
   {at:'80:C409',operation:'WORD LDA',source:'bank00 D0 DP02 after preceding stores'},
   {at:'80:C40B',operation:'WORD STA',destination:'actualDBR0C02+latched full X'},
   {at:'80:C40E',operation:'WORD STZ',destination:'actualDBR0C62+latched full X'},
   {at:'80:C412',operation:'WORD STA',destination:'actualDBR02B2+latched full X after actual PLA'}],
  effects:'No parity/slot-cap/mask/count guard. Every data address uses 24bit addition, every stack byte uses bank00 WORD wrap. X remains the first loaded full WORD even if writes alias0250. DP02 and PLA are freshly read after preceding writes. Final A/flags are the actual PLA WORD; S advances4. Outer target is reported only.',
  qualification:'Complete pinned nine-instruction Native9F source, including two different actual stack owners. No normal leaf RTS proof is borrowed; discarded JSR bytes and remaining protected return are distinct. No initialization, caller occurrence, scheduling, temporal preservation, scene or frame claim.'};
}
async function renew(bytes,name){
 const sourcePath=`analysis/render-task-${name}.json`,saved=JSON.parse(await readFile(sourcePath));
 if(saved.rom_sha256!==taskRomHash)throw Error('Wait dependency ROM drift');
 const windows=saved.windows.map(w=>({start:parseInt(w.entry.replace(':',''),16),hex:w.machine_bytes}));
 for(const w of windows){const off=cpuToOffset(w.start,bytes.length);
  if(bytes.subarray(off,off+w.hex.length/2).toString('hex').toUpperCase()!==w.hex)throw Error('Wait dependency byte drift');}
 const b=await loadTaskNativeBlock(name),proof=b.proveSource(decodeTaskWindows(bytes,windows).map,b.entries[0]);
 if(JSON.stringify(proof)!==JSON.stringify(saved[b.proofField].find(p=>p.entry===proof.entry))||proof.external_return_assumptions!==0)
  throw Error('Wait renewed dependency drift');
 return {source_contract:sourcePath,windows:saved.windows,proof};
}
export async function proveNativeWaitSources(bytes){
 const off=cpuToOffset(waitWindow.start,bytes.length);
 if(bytes.subarray(off,off+waitWindow.hex.length/2).toString('hex').toUpperCase()!==waitWindow.hex)throw Error('Wait original byte drift');
 const decoded=decodeTaskWindows(bytes,[waitWindow]),native=proveNativeWait(decoded.map);
 const anchors=waitAnchors.map(a=>{const off=cpuToOffset(a.start,bytes.length),raw=bytes.subarray(off,off+2);
  if(raw.toString('hex').toUpperCase()!==a.hex)throw Error('Wait original anchor drift');
  return {entry:cpuLabel(a.start),kind:a.kind,machine_bytes:a.hex,sha256:taskHash(raw)};});
 const slot=await proveOpcodeBinding(bytes,taskOpcodeSpecs.find(s=>s.opcode===0x58)),parts=[];
 for(const name of ['native-arguments','native-bridge','native-dispatch','native-resume'])parts.push(await renew(bytes,name));
 const visit=await proveTaskVisit(bytes);
 const base={native_binding:false,local_source_complete:true,full_graph_closed:false,full_task_binding:false,
  external_return_assumptions:0,global_stack_minimum:null,input_mode:{e:0,m:0,x:0,d:0},native_function_id:159,anchors};
 const yieldProof={...base,entry:'80:F390',input_mode:{e:0,m:0,x:0,opcode:88},opcode:88,slot:slot.slot,
  argument_prefix:slot.handler_proof,parts:parts.slice(0,3),callee:native,
  joins:[{from:'80:F4CB',to:'80:F4F6',kind:'original argument stack migration prefix'},
   {from:'80:F506',to:'80:C401',raw_return:'F508',kind:'actual JSR high/low and fresh00A2 must name C401'},
   {from:'80:C411',to:'actualDBR02B2+X',raw_return:'F508',kind:'fresh PLA consumes real inner JSR bytes and saves continuation'},
   {from:'80:C415',to:'actual remaining protected outer target',kind:'fresh S+3/S+4 RTS; target observed only'}],
  boundary:'F509 is not executed by this yield. Original Native9F ID159 has argumentWORD0202 and returnWORD0002. Actual table target and PLA bytes remain fresh. Whole scheduler/caller and later readiness occurrence remain explicit boundaries.'};
 const resumeProof={...base,entry:'80:C1F9',readiness:{source_contract:'analysis/render-task-visit.json',
  proof_sha256:taskHash(Buffer.from(JSON.stringify(visit.proofs.find(p=>p.entry==='80:C1F9'))))},resume:parts[3],
  joins:[{from:'80:C1F9',to:'80:C3C9',raw_return:'C1FB',kind:'actual JSR high/low, fresh original readiness, actual RTS toC1FC'},
   {from:'80:C1FC',to:'80:C22F',kind:'Carry0 follows actual blocked cursor/outer RTS; no continuation executes'},
   {from:'80:C1FE',to:'80:C203',kind:'Carry1 fresh02B2+fullX must contain F508; zero/F494/other targets rejected'},
   {from:'80:C203',to:'80:F509',raw_return:'C20A',kind:'actual PEA C20A, PHA savedF508, actual RTS establishesF509 occurrence'},
   {from:'80:F509',to:'80:F390',kind:'fresh D/DBR/S/ID/native-returnmetadata/result/PC/pointer/opcode; savedS retains actualC20A'}],
  boundary:'Independent explicitly observed compatible C1F9 entry only. No inferred time, event writer, scheduler occurrence or preservation since yield. Readiness may stay blocked; only actual Carry1/F508 opens original F509. Native return table82D970 is used, not script82E623. Whole Task/scene/frames stay open.'};
 const windows=[...decoded.windows,...parts.flatMap(p=>p.windows),...visit.windows];
 return {rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',windows,
  proofs:[native,yieldProof,resumeProof],source_graph:{native_binding:false,local_source_complete:true,full_graph_closed:false},
  completed_script_bodies:0,scope:'Separate original Native9F yield and observed later readiness/native resume contracts; no automatic temporal join.'};
}
