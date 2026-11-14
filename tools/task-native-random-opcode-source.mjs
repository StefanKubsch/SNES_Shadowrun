import {readFile,writeFile} from 'node:fs/promises';
import {cpuToOffset,cpuLabel,inspectRom} from './rom.mjs';
import {taskRomHash,taskHash,decodeTaskWindows} from './task-partial-source.mjs';
import {proveOpcodeBinding,opcodeDispatchWindow} from './task-opcode-source.mjs';
import {taskOpcodeSpecs} from './task-opcode-specs.mjs';
import {loadTaskNativeBlock} from './task-native-catalog.mjs';
import {randomWindows,randomTables,randomAnchors,random63Anchors,decodeSource,prove} from './render-task-native-random-source-proof.mjs';
export async function proveTaskNativeRandomOpcode(bytes,nativeId=0x3E){
 if(![0x3E,0x63].includes(nativeId))throw Error('Unproved random native');
 const direct=nativeId===0x63,entry=direct?0x80C560:0x80C51F,
  code=direct?randomWindows.slice(1):randomWindows,tables=direct?randomTables.slice(1):randomTables;
 const slot=await proveOpcodeBinding(bytes,taskOpcodeSpecs.find(s=>s.opcode===0x58)),parts=[];
 for(const name of ['native-arguments','native-bridge','native-dispatch','native-resume']){
  const path=`analysis/render-task-${name}.json`,source=JSON.parse(await readFile(path));
  if(source.rom_sha256!==taskRomHash)throw Error('Native3E dependency ROM drift');
  const windows=source.windows.map(w=>({start:parseInt(w.entry.replace(':',''),16),hex:w.machine_bytes}));
  for(const w of windows){const off=cpuToOffset(w.start,bytes.length);
   if(bytes.subarray(off,off+w.hex.length/2).toString('hex').toUpperCase()!==w.hex)throw Error('Native3E dependency source drift');}
  const b=await loadTaskNativeBlock(name),proof=b.proveSource(decodeTaskWindows(bytes,windows).map,b.entries[0]);
  if(JSON.stringify(proof)!==JSON.stringify(source[b.proofField].find(p=>p.entry===proof.entry)))throw Error('Native3E dependency proof drift');
  parts.push({source_contract:path,windows:source.windows,proof});
 }
 const pin=w=>{const off=cpuToOffset(w.start,bytes.length),raw=bytes.subarray(off,off+w.hex.length/2);
  if(raw.toString('hex').toUpperCase()!==w.hex)throw Error('Original Native3E anchor/table drift');
  return {entry:cpuLabel(w.start),covered_bytes:raw.length,machine_bytes:w.hex,sha256:taskHash(raw),...(w.kind?{kind:w.kind}:{})};};
 for(const w of [...code,...tables])pin(w);
 const anchors=(direct?random63Anchors:randomAnchors).map(pin),callee=prove(decodeSource(bytes).map,entry),source=JSON.parse(await readFile('analysis/render-task-native-random.json'));
 const selectedTables=direct?source.tables.slice(1):source.tables,selectedWindows=direct?source.windows.filter(w=>parseInt(w.entry.replace(':',''),16)>=0x80C560):source.windows;
 if(source.rom_sha256!==taskRomHash||JSON.stringify(source.proofs.find(p=>p.entry===cpuLabel(entry)))!==JSON.stringify(callee)
  ||JSON.stringify(selectedTables)!==JSON.stringify(tables.map(pin)))throw Error('Whole random source drift');
 return {entry:'80:F390',native_binding:false,local_source_complete:true,source_closed_to_dispatch:true,full_graph_closed:false,
  full_task_binding:false,global_stack_minimum:null,minimum_protected_stack_bytes:null,external_return_assumptions:0,
  opcode:0x58,target:'80:F4CB',slot:slot.slot,argument_prefix:slot.handler_proof,parts,
  admitted_targets:[{name:'native-random',id:nativeId,target:cpuLabel(entry),anchors,source_contract:'analysis/render-task-native-random.json',windows:selectedWindows,tables:selectedTables,proof:callee}],
  output_mode:{e:0,m:0,x:0},joins:[
   {from:'80:F390',to:'80:F4CB',kind:'full WORD X58 and original dispatch slot'},
   {from:'80:F4CB',to:'80:F4F6',kind:direct?'zero argument WORDpops, original0100 metadata and fresh63 ID':'one actual argument WORDpop, original0201 metadata and fresh3E ID'},
   {from:'80:F506',to:cpuLabel(entry),kind:direct?'actualF508 JSR afterTCS/D0/PEA/PLB, originalC560 pointer and freshly readA2':'actualF508 JSR afterTCS/D0/PEA/PLB, originalC51F pointer and freshly readA2'},
   ...(!direct?[{from:'80:C532',to:'80:C560',kind:'actualC534 JSR/PHP/SEP30/PLP/RTS, each fresh independent PPU BYTE'}]:[]),
   {from:direct?'80:C58C':'80:C53F',to:'80:F509',kind:direct?'actualPHP/SEP30/PLP and freshF508 RTS after three independent PPU BYTE reads':'actualF508 RTS after zero or repeated fresh comparison attempts'},
   {from:'80:F509',to:'80:F390',kind:direct?'fresh task D/DBR/S/63-ID/original0002 returnmetadata/resultPHA/PC/pointer/opcode':'fresh task D/DBR/S/3E-ID/original0002 returnmetadata/resultPHA/PC/pointer/opcode'}],
  observations:direct?'Exactly one reached2137 latch,213C horizontal,213D vertical BYTE per helper call, independently frozen with originalPC/actualaddress/width/value. No range argument/mask/rejection loop or calculated device/time value. All late source/record/owner/budget/return errors withhold every effect.':'Each reached2137 latch,213C horizontal,213D vertical BYTE is independently frozen with originalPC/actualaddress/width/value. Zero limit consumes none. No computed device values or assumed rejection-loop termination; finite work/output/observation budgets withhold every late effect.',
  ownership:'One physical owner/access/MMIO ledger/budget and outer commit. PHP/PLP and every helper/root actual RTS are freshly read; no cached mask/limit/status/frame/PC/ID/result. Structural local stack5 is not alias exclusion or wholeTask/globalstack proof.',
  boundary:direct?'Exactly one observed originalNative58/63 through wholeC560 and realF509, stop before next dispatch. Its original zero-pop0100 and0002 result metadata are independently pinned; whole3E is a separate caller. Originalbodies/caller/initialization/Task/device/time/scene/frames remain separate.':'Exactly one observed originalNative58/3E through wholeC51F/C560 and realF509, stop before next dispatch. Originalbodies/caller/initialization/Task/device/time/scene/frames remain separate.'};
}
async function buildTaskNativeRandomOpcodeReport(nativeId){
 const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong ROM');
 const proof=await proveTaskNativeRandomOpcode(bytes,nativeId),dispatch=decodeTaskWindows(bytes,[opcodeDispatchWindow]).windows;
 const windows=[...dispatch,...proof.parts.flatMap(p=>p.windows),...proof.admitted_targets[0].windows]
  .filter((w,n,all)=>all.findIndex(p=>p.entry===w.entry)===n);
 return {rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',
  windows,proofs:[proof],completed_script_bodies:0,source_graph:{native_binding:false,local_source_complete:true,source_closed_to_dispatch:true,full_graph_closed:false,full_task_binding:false}};
}
const reportPath=nativeId=>`analysis/render-task-native-opcode-${nativeId===0x63?'c560':'c51f'}.json`;
export async function verifyTaskNativeRandomOpcodeSource(nativeId=0x3E){
 const expected=await buildTaskNativeRandomOpcodeReport(nativeId),source=JSON.parse(await readFile(reportPath(nativeId),'utf8'));
 if(JSON.stringify(source)!==JSON.stringify(expected))throw Error('Random opcode source report drift: '+reportPath(nativeId));
 return expected.proofs[0];
}
export async function emitTaskNativeRandomOpcode(nativeId=0x3E){
 const report=await buildTaskNativeRandomOpcodeReport(nativeId);
 await writeFile(reportPath(nativeId),JSON.stringify(report,null,2)+'\n');
 return report.proofs[0];
}
