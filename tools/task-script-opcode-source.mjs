import {readFile} from 'node:fs/promises';
import {cpuToOffset,cpuLabel} from './rom.mjs';
import {decodeTaskWindows,taskHash,taskRomHash} from './task-partial-source.mjs';
import {proveOpcodeBinding} from './task-opcode-source.mjs';
import {taskOpcodeSpecs} from './task-opcode-specs.mjs';
import {prove as proveArguments} from './render-task-script-arguments-source-proof.mjs';
import {prove as proveBridge} from './render-task-script-bridge-source-proof.mjs';
import {scriptOpcodeSpecs} from './task-script-opcode-fixtures.mjs';
async function renew(bytes,name,prove){
 const source=JSON.parse(await readFile(`analysis/render-task-${name}.json`));
 if(source.rom_sha256!==taskRomHash)throw Error('Script composition ROM drift');
 const windows=source.windows.map(w=>({start:parseInt(w.entry.replace(':',''),16),hex:w.machine_bytes}));
 for(const w of windows){const offset=cpuToOffset(w.start,bytes.length);
  if(bytes.subarray(offset,offset+w.hex.length/2).toString('hex').toUpperCase()!==w.hex)throw Error('Script composition window drift');}
 const proofs=prove(decodeTaskWindows(bytes,windows).map);
 if(JSON.stringify(proofs)!==JSON.stringify(source.proofs)||proofs.some(p=>p.external_return_assumptions!==0))throw Error('Script source proof drift');
 return {source_contract:`analysis/render-task-${name}.json`,windows:source.windows,proofs};
}
export async function proveScriptContinuation(bytes){
 const bridge=await renew(bytes,'script-bridge',proveBridge);
 // Compare complete F495/F509 equations, retaining their different long table operands.
 const n=JSON.parse(await readFile('analysis/render-task-native-resume.json'));
 const sw=bridge.windows.find(w=>w.entry==='80:F495'),nw=n.windows.find(w=>w.entry==='80:F509');
 if(!nw||sw.machine_bytes.replace('23E682','70D982')!==nw.machine_bytes)throw Error('Resume equation dependency mismatch');
 const offset=cpuToOffset(0x80F509,bytes.length);
 if(bytes.subarray(offset,offset+nw.covered_bytes).toString('hex').toUpperCase()!==nw.machine_bytes)throw Error('Native resume dependency byte drift');
 return bridge.proofs.map(p=>({...p,global_stack_minimum:null,
  native_equation_dependency:p.entry==='80:F495'?'proof/task/native-resume.mjs; exact shared equation with original82E623 metadata':'src/task/script-yield.mjs; complete manual C242/C2C8/C36A equations',
  native_obligations:'Actual inner JSR stack bytes and every RTS re-read on the same overlay; changed inner return targets reject atomically. Outer return is protected and target only observed. Readiness/continuation occurrence is never inferred.'}));
}
export async function proveScriptOpcode(bytes,spec=null){
 const slot=await proveOpcodeBinding(bytes,taskOpcodeSpecs.find(s=>s.opcode===0x52));
 const prefix=await renew(bytes,'script-arguments',proveArguments),bridge=await renew(bytes,'script-bridge',proveBridge);
 const continuation=await proveScriptContinuation(bytes),anchors=[];
 if(spec){
  if(!scriptOpcodeSpecs.some(s=>JSON.stringify(s)===JSON.stringify(spec)))throw Error('Unproved script ID');
  const wordHex=n=>Buffer.from([n&255,n>>>8]).toString('hex').toUpperCase();
  for(const [kind,address,hex] of [
   ['argument-metadata',0x82E9CC+spec.id,wordHex(spec.argument)],['bank-metadata',0x82DB28+spec.id,wordHex(spec.bank)],
   ['script-pointer',0x82DED1+2*spec.id,wordHex(spec.pointer)],['return-metadata',0x82E623+spec.id,wordHex(spec.returnMetadata)],
   ['script-frame-header',((spec.bank&255)<<16)|spec.pointer,Buffer.from(spec.header).toString('hex').toUpperCase()]]){
   const off=cpuToOffset(address,bytes.length),raw=bytes.subarray(off,off+2);
   if(raw.toString('hex').toUpperCase()!==hex)throw Error('Script original anchor drift');
   anchors.push({kind,entry:cpuLabel(address),machine_bytes:hex,sha256:taskHash(raw)});
  }
 }
 return {entry:'80:F390',native_binding:false,local_source_complete:true,source_closed_to_dispatch:false,full_graph_closed:false,
  full_task_binding:false,global_stack_minimum:null,external_return_assumptions:0,opcode:0x52,target:'80:F460',
  script_id:spec?.id??null,script_header:spec?.entry??null,slot:slot.slot,argument_prefix:slot.handler_proof,
  parts:[prefix,bridge],continuation,anchors,output_mode:{e:0,m:0,x:0},
  joins:[{from:'80:F460',to:'80:F488',kind:'fresh-outer-S; no cached ID after workspace'},
   {from:'80:F492',to:'80:C36A',kind:'actual JSR rawF494'},
   {from:'80:C36A',to:'80:C2C8',kind:'actual JSR rawC36C; full frame allocation'},
   {from:'80:C2F5',to:'80:C242',kind:'actual JSR rawC2F7; full heap coalescing/split/exhaustion'},
   {from:'80:C384',to:'parent02B2',kind:'PLA caller raw WORD'},
   {from:'C36A outer RTS',to:'actual protected outer return target',kind:'yield; target observed only'}],
  boundary:'Outer yield does not execute F495. C1CA readiness, actual later continuation, Script body, F378, whole Task, initialization, scene and frames remain open. Odd argument loops retain original WORD wrap and finite explicit work budget. Allocation/slot exhaustion preserves original writes; no invented success guard.'};
}
