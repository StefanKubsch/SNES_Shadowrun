import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {decode,formatBlock} from './disassemble.mjs';
import {proveVisitC1CAFrontier} from './render-c1ca-stack-proof.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
const {bytes,metadata}=inspectRom(await readFile(process.argv[2]??'Shadowrun (E).smc'));
if(metadata.rom_sha256!=='91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690')throw Error('Wrong European ROM revision');
const sha=b=>createHash('sha256').update(b).digest('hex');
function block(name,entry,end){const instructions=[];for(let pc=entry;pc<end;){const i=decode(bytes,pc,{e:0,m:0,x:0});if(i.next>end)throw Error('Source window overflow');instructions.push(i);pc=i.next;}
  return {name,entry,initialState:{e:0,m:0,x:0},instructions,stop:'Complete local WORD source under explicit entry state; dynamic targets/stack migration remain boundaries, no inferred return.'};}
const describe=b=>{const raw=Buffer.concat(b.instructions.map(i=>i.raw));return {name:b.name,entry:cpuLabel(b.entry),end_exclusive:cpuLabel(b.instructions.at(-1).next),covered_bytes:raw.length,instruction_count:b.instructions.length,sha256:sha(raw),machine_bytes:raw.toString('hex').toUpperCase()};};
const windows=[block('visitC1CA',0x80C1CA,0x80C1E3),block('runC1F9',0x80C1F9,0x80C242),
  block('readyC3C9',0x80C3C9,0x80C401),block('removeC396',0x80C396,0x80C3C9),block('releaseC2BD',0x80C2BD,0x80C2C8),
  block('interpreterF378',0x80F378,0x80F393),block('endF4BE',0x80F4BE,0x80F4CB),
  block('nativeF4CB',0x80F4CB,0x80F532),block('waitC401',0x80C401,0x80C416)];
const excerpts=[block('caller9178',0x8091CA,0x8091D8),block('sweepC1E3',0x80C1E3,0x80C1F9)];
const map=new Map(windows.flatMap(b=>b.instructions.map(i=>[i.cpu,i])));
const text=JSON.parse(await readFile('analysis/render-9178.json','utf8'));
if(text.rom_sha256!==metadata.rom_sha256||text.excerpts.find(w=>w.name==='visitC1CA').machine_bytes!==describe(windows[0]).machine_bytes)throw Error('9178 visit excerpt drift');
const dependencies=[];
for(const path of ['analysis/task-frames.json','analysis/task-heap.json']){
  const owner=JSON.parse(await readFile(path,'utf8'));if(owner.rom_sha256!==metadata.rom_sha256)throw Error('Task ROM drift');
  const slices=owner.source_blocks.filter(w=>map.has(parseInt(w.entry,16)));
  for(const w of slices){let pc=parseInt(w.entry,16),raw='';while(raw.length<w.machine_bytes.length){const i=map.get(pc);if(!i)throw Error('Uncovered older task slice');raw+=i.raw.toString('hex').toUpperCase();pc=i.next;}if(raw!==w.machine_bytes)throw Error('Task source drift');}
  dependencies.push({report:path,source_blocks:slices});
}
const table=(name,entry,length)=>{const off=cpuToOffset(entry,bytes.length),raw=bytes.subarray(off,off+length);return {name,entry:cpuLabel(entry),covered_bytes:length,sha256:sha(raw),machine_bytes:raw.toString('hex').toUpperCase()};};
const opcodeTable=table('allByteOpcodeWordSources',0x80F2B4,257);
const opcodeDispatch=Array.from({length:256},(_,opcode)=>({opcode,word_source:cpuLabel(0x80F2B4+opcode),target:cpuLabel(0x800000|bytes.readUInt16LE(cpuToOffset(0x80F2B4+opcode,bytes.length))),
  classification:opcode<=0xC2&&!(opcode&1)?'original even table slot':'unvalidated overlapping WORD/code-byte target'}));
const nativePointers=table('allByteNativePointerWords',0x82D7B8,512),nativeArgs=table('allByteNativeArgumentWordSources',0x82DA4C,257),nativeReturns=table('allByteNativeReturnWordSources',0x82D970,257);
const native9F=bytes.readUInt16LE(cpuToOffset(0x82D7B8+0x9F*2,bytes.length));if(native9F!==0xC401)throw Error('Original wait target drift');
const frontier=proveVisitC1CAFrontier(map),noDispatch=proveVisitC1CAFrontier(map,{skipReady:true});
const push=JSON.parse(await readFile('analysis/render-task-push.json','utf8'));
if(push.rom_sha256!==metadata.rom_sha256||push.source_graph.source_closed_to_dispatch!==true
  ||push.source_graph.full_graph_closed!==false||push.source_graph.native_binding!==false
  ||push.primitives.some(p=>p.outer_return_frames_added!==0||p.required_writable_operand_stack_bytes!==2))throw Error('Push source frontier drift');
const consumers=JSON.parse(await readFile('analysis/render-task-consumers.json','utf8'));
if(consumers.rom_sha256!==metadata.rom_sha256||consumers.source_graph.source_closed_to_dispatch!==true
  ||consumers.source_graph.full_graph_closed!==false||consumers.source_graph.native_binding!==false
  ||consumers.consumers.length!==3||consumers.consumers.some(p=>p.outer_return_frames_added!==0||p.operand_s_delta!==2)
  ||JSON.stringify(consumers.consumers.map(p=>p.entry))!==JSON.stringify(['80:F8BB','80:F532','80:F53B']))throw Error('Consumer source frontier drift');
for(const w of consumers.windows){const off=cpuToOffset(parseInt(w.entry.replace(':',''),16),bytes.length),raw=bytes.subarray(off,off+w.covered_bytes);
  if(raw.toString('hex').toUpperCase()!==w.machine_bytes||sha(raw)!==w.sha256)throw Error('Consumer source byte drift');}
const updates=JSON.parse(await readFile('analysis/render-task-updates.json','utf8'));
if(updates.rom_sha256!==metadata.rom_sha256||updates.source_graph.source_closed_to_dispatch!==true
  ||updates.source_graph.full_graph_closed!==false||updates.source_graph.native_binding!==false
  ||JSON.stringify(updates.updates.map(p=>[p.entry,p.operand_s_delta,p.outer_return_frames_added]))
    !==JSON.stringify([['80:F3E4',0,0],['80:F3EA',0,0],['80:F3F0',-2,0]]))throw Error('Update source frontier drift');
for(const w of updates.windows){const off=cpuToOffset(parseInt(w.entry.replace(':',''),16),bytes.length),raw=bytes.subarray(off,off+w.covered_bytes);
  if(raw.toString('hex').toUpperCase()!==w.machine_bytes||sha(raw)!==w.sha256)throw Error('Update source byte drift');}
const bitLogic=JSON.parse(await readFile('analysis/render-task-bit-logic.json','utf8'));
if(bitLogic.rom_sha256!==metadata.rom_sha256||bitLogic.source_graph.source_closed_to_dispatch!==true
  ||bitLogic.source_graph.full_graph_closed!==false||bitLogic.source_graph.native_binding!==false
  ||JSON.stringify(bitLogic.bit_logic.map(p=>[p.entry,p.operand_s_delta,p.outer_return_frames_added]))
    !==JSON.stringify([['80:F715',2,0],['80:F71D',2,0],['80:F725',2,0],['80:F72D',0,0]]))throw Error('Bit logic source frontier drift');
for(const w of bitLogic.windows){const off=cpuToOffset(parseInt(w.entry.replace(':',''),16),bytes.length),raw=bytes.subarray(off,off+w.covered_bytes);
  if(raw.toString('hex').toUpperCase()!==w.machine_bytes||sha(raw)!==w.sha256)throw Error('Bit logic source byte drift');}
const negateShifts=JSON.parse(await readFile('analysis/render-task-negate-shifts.json','utf8'));
if(negateShifts.rom_sha256!==metadata.rom_sha256||negateShifts.source_graph.source_closed_to_dispatch!==true
  ||negateShifts.source_graph.full_graph_closed!==false||negateShifts.source_graph.native_binding!==false
  ||JSON.stringify(negateShifts.negate_shifts.map(p=>[p.entry,p.operand_s_delta,p.outer_return_frames_added]))
    !==JSON.stringify([['80:F6F4',0,0],['80:F6FD',2,0],['80:F709',2,0]]))throw Error('Negate/shift source frontier drift');
for(const w of negateShifts.windows){const off=cpuToOffset(parseInt(w.entry.replace(':',''),16),bytes.length),raw=bytes.subarray(off,off+w.covered_bytes);
  if(raw.toString('hex').toUpperCase()!==w.machine_bytes||sha(raw)!==w.sha256)throw Error('Negate/shift source byte drift');}
const truth=JSON.parse(await readFile('analysis/render-task-truth.json','utf8'));
if(truth.rom_sha256!==metadata.rom_sha256||truth.source_graph.source_closed_to_dispatch!==true
  ||truth.source_graph.full_graph_closed!==false||truth.source_graph.native_binding!==false
  ||JSON.stringify(truth.truth.map(p=>[p.entry,p.operand_s_delta,p.outer_return_frames_added]))
    !==JSON.stringify([['80:F8BF',0,0],['80:F843',2,0],['80:F87F',2,0]]))throw Error('Truth source frontier drift');
for(const w of truth.windows){const off=cpuToOffset(parseInt(w.entry.replace(':',''),16),bytes.length),raw=bytes.subarray(off,off+w.covered_bytes);
  if(raw.toString('hex').toUpperCase()!==w.machine_bytes||sha(raw)!==w.sha256)throw Error('Truth source byte drift');}
const compareGates=JSON.parse(await readFile('analysis/render-task-compare-gates.json','utf8'));
if(compareGates.rom_sha256!==metadata.rom_sha256||compareGates.source_graph.source_closed_to_dispatch!==true
  ||compareGates.source_graph.full_graph_closed!==false||compareGates.source_graph.native_binding!==false
  ||JSON.stringify(compareGates.compare_gates.map(p=>[p.entry,p.operand_s_delta,p.outer_return_frames_added]))
    !==JSON.stringify([['80:F852',2,0],['80:F86E',2,0],['80:F88E',2,0],['80:F8AA',2,0]]))throw Error('Compare gate source frontier drift');
for(const w of compareGates.windows){const off=cpuToOffset(parseInt(w.entry.replace(':',''),16),bytes.length),raw=bytes.subarray(off,off+w.covered_bytes);
  if(raw.toString('hex').toUpperCase()!==w.machine_bytes||sha(raw)!==w.sha256)throw Error('Compare gate source byte drift');}
const carryCompare=JSON.parse(await readFile('analysis/render-task-carry-compare.json','utf8'));
if(carryCompare.rom_sha256!==metadata.rom_sha256||carryCompare.source_graph.source_closed_to_dispatch!==true
  ||carryCompare.source_graph.full_graph_closed!==false||carryCompare.source_graph.native_binding!==false
  ||JSON.stringify(carryCompare.carry_compare.map(p=>[p.entry,p.operand_s_delta,p.outer_return_frames_added]))
    !==JSON.stringify([['80:F735',2,0],['80:F77A',2,0],['80:F7BC',2,0],['80:F7FE',2,0]]))throw Error('Carry compare source frontier drift');
for(const w of carryCompare.windows){const off=cpuToOffset(parseInt(w.entry.replace(':',''),16),bytes.length),raw=bytes.subarray(off,off+w.covered_bytes);
  if(raw.toString('hex').toUpperCase()!==w.machine_bytes||sha(raw)!==w.sha256)throw Error('Carry compare source byte drift');}
const carrySignGates=JSON.parse(await readFile('analysis/render-task-carry-sign-gates.json','utf8'));
if(carrySignGates.rom_sha256!==metadata.rom_sha256||carrySignGates.source_graph.source_closed_to_dispatch!==true
  ||carrySignGates.source_graph.full_graph_closed!==false||carrySignGates.source_graph.native_binding!==false
  ||JSON.stringify(carrySignGates.carry_sign_gates.map(p=>[p.entry,p.operand_s_delta,p.outer_return_frames_added]))
    !==JSON.stringify([['80:F745',2,0],['80:F762',2,0],['80:F789',2,0],['80:F7A5',2,0]]))throw Error('Carry sign gate source frontier drift');
for(const w of carrySignGates.windows){const off=cpuToOffset(parseInt(w.entry.replace(':',''),16),bytes.length),raw=bytes.subarray(off,off+w.covered_bytes);
  if(raw.toString('hex').toUpperCase()!==w.machine_bytes||sha(raw)!==w.sha256)throw Error('Carry sign gate source byte drift');}
const complementSignGates=JSON.parse(await readFile('analysis/render-task-complement-sign-gates.json','utf8'));
if(complementSignGates.rom_sha256!==metadata.rom_sha256||complementSignGates.source_graph.source_closed_to_dispatch!==true
  ||complementSignGates.source_graph.full_graph_closed!==false||complementSignGates.source_graph.native_binding!==false
  ||JSON.stringify(complementSignGates.complement_sign_gates.map(p=>[p.entry,p.operand_s_delta,p.outer_return_frames_added]))
    !==JSON.stringify([['80:F7CB',2,0],['80:F7E7',2,0],['80:F80E',2,0],['80:F82B',2,0]]))throw Error('Complement sign gate source frontier drift');
for(const w of complementSignGates.windows){const off=cpuToOffset(parseInt(w.entry.replace(':',''),16),bytes.length),raw=bytes.subarray(off,off+w.covered_bytes);
  if(raw.toString('hex').toUpperCase()!==w.machine_bytes||sha(raw)!==w.sha256)throw Error('Complement sign gate source byte drift');}
const localReads=JSON.parse(await readFile('analysis/render-task-local-reads.json','utf8'));
if(localReads.rom_sha256!==metadata.rom_sha256||localReads.source_graph.source_closed_to_dispatch!==true
  ||localReads.source_graph.full_graph_closed!==false||localReads.source_graph.native_binding!==false
  ||JSON.stringify(localReads.local_reads.map(p=>[p.entry,p.operand_s_delta,p.outer_return_frames_added]))
    !==JSON.stringify([['80:F3A1',-2,0],['80:F3B9',-2,0],['80:F8CB',-2,0]]))throw Error('Local read source frontier drift');
for(const w of localReads.windows){const off=cpuToOffset(parseInt(w.entry.replace(':',''),16),bytes.length),raw=bytes.subarray(off,off+w.covered_bytes);
  if(raw.toString('hex').toUpperCase()!==w.machine_bytes||sha(raw)!==w.sha256)throw Error('Local read source byte drift');}
const localWrites=JSON.parse(await readFile('analysis/render-task-local-writes.json','utf8'));
if(localWrites.rom_sha256!==metadata.rom_sha256||localWrites.source_graph.source_closed_to_dispatch!==true
  ||localWrites.source_graph.full_graph_closed!==false||localWrites.source_graph.native_binding!==false
  ||JSON.stringify(localWrites.local_writes.map(p=>[p.entry,p.operand_s_delta,p.outer_return_frames_added]))
    !==JSON.stringify([['80:F3C6',2,0],['80:F3D7',2,0]]))throw Error('Local write source frontier drift');
for(const w of localWrites.windows){const off=cpuToOffset(parseInt(w.entry.replace(':',''),16),bytes.length),raw=bytes.subarray(off,off+w.covered_bytes);
  if(raw.toString('hex').toUpperCase()!==w.machine_bytes||sha(raw)!==w.sha256)throw Error('Local write source byte drift');}
const signExtension=JSON.parse(await readFile('analysis/render-task-sign-extension.json','utf8'));
if(signExtension.rom_sha256!==metadata.rom_sha256||signExtension.source_graph.source_closed_to_dispatch!==true
  ||signExtension.source_graph.full_graph_closed!==false||signExtension.source_graph.native_binding!==false
  ||JSON.stringify(signExtension.sign_extensions.map(p=>[p.entry,p.operand_s_delta,p.outer_return_frames_added]))
    !==JSON.stringify([['80:F3F6',-2,0],['80:F408',-2,0]]))throw Error('Sign extension source frontier drift');
for(const w of signExtension.windows){const off=cpuToOffset(parseInt(w.entry.replace(':',''),16),bytes.length),raw=bytes.subarray(off,off+w.covered_bytes);
  if(raw.toString('hex').toUpperCase()!==w.machine_bytes||sha(raw)!==w.sha256)throw Error('Sign extension source byte drift');}
const stateReads=JSON.parse(await readFile('analysis/render-task-state-reads.json','utf8'));
if(stateReads.rom_sha256!==metadata.rom_sha256||stateReads.source_graph.source_closed_to_dispatch!==true
  ||stateReads.source_graph.full_graph_closed!==false||stateReads.source_graph.native_binding!==false
  ||JSON.stringify(stateReads.state_reads.map(p=>[p.entry,p.operand_s_delta,p.outer_return_frames_added]))
    !==JSON.stringify([['80:F8D4',-2,0],['80:F8E4',-2,0]]))throw Error('State read source frontier drift');
for(const w of stateReads.windows){const off=cpuToOffset(parseInt(w.entry.replace(':',''),16),bytes.length),raw=bytes.subarray(off,off+w.covered_bytes);
  if(raw.toString('hex').toUpperCase()!==w.machine_bytes||sha(raw)!==w.sha256)throw Error('State read source byte drift');}
const stateWrites=JSON.parse(await readFile('analysis/render-task-state-writes.json','utf8'));
if(stateWrites.rom_sha256!==metadata.rom_sha256||stateWrites.source_graph.source_closed_to_dispatch!==true
  ||stateWrites.source_graph.full_graph_closed!==false||stateWrites.source_graph.native_binding!==false
  ||JSON.stringify(stateWrites.state_writes.map(p=>[p.entry,p.operand_s_delta,p.outer_return_frames_added]))
    !==JSON.stringify([['80:F8F1',2,0],['80:F902',2,0]]))throw Error('State write source frontier drift');
for(const w of stateWrites.windows){const off=cpuToOffset(parseInt(w.entry.replace(':',''),16),bytes.length),raw=bytes.subarray(off,off+w.covered_bytes);
  if(raw.toString('hex').toUpperCase()!==w.machine_bytes||sha(raw)!==w.sha256)throw Error('State write source byte drift');}
const supplementalDefinitions=JSON.parse(await readFile('tools/task-supplemental-sources.json','utf8'));
const supplementalTaskSources=[];
for(const def of supplementalDefinitions){const r=JSON.parse(await readFile(def.source,'utf8'));
  if(r.rom_sha256!==metadata.rom_sha256||r.source_graph.native_binding!==false||r.source_graph.full_graph_closed!==false
    ||r.source_graph.source_closed_to_dispatch!==(def.closed_dispatch!==false)
    ||def.closed_dispatch===false&&(r.source_graph.local_source_complete!==true||typeof def.classification!=='string'||r.source_graph.classification!==def.classification)
    ||JSON.stringify(r.proofs.map(p=>p.entry))!==JSON.stringify(def.entries))throw Error('Supplemental source frontier drift');
  for(const w of r.windows){const off=cpuToOffset(parseInt(w.entry.replace(':',''),16),bytes.length),raw=bytes.subarray(off,off+w.covered_bytes);if(raw.toString('hex').toUpperCase()!==w.machine_bytes||sha(raw)!==w.sha256)throw Error('Supplemental source byte drift');}
  supplementalTaskSources.push({entries:def.entries,source:def.source,source_closed_to_dispatch:def.closed_dispatch!==false,...(def.closed_dispatch===false?{local_source_complete:true,classification:def.classification}:{}),full_graph_closed:false,native_binding:false,
    operand_s_deltas:r.proofs.map(p=>p.operand_s_delta),outer_return_frames_added:0,qualification:'Separate pinned local source only. Actualbyteowners/intactcode/outerstack and fullC1CA/9178/globalstack/native return remain open.'});
}
const report={rom_sha256:metadata.rom_sha256,progress_reference:'docs/PORTIERUNGSSTAND.json',
  scope:'Complete local C1CA/C1F9 visit, actual readiness/removal/release and explicit interpreter/native/END/wait source windows. Exhaustive typed outer-stack frontier stops at actual continuation RTS and task TCS; no dynamic return or whole9178 binding inferred.',
  windows:windows.map(describe),excerpts:excerpts.map(describe),dependencies,
  local_source:{code_bytes:windows.reduce((n,b)=>n+describe(b).covered_bytes,0),instructions:map.size,
    qualification:'Local byte coverage under explicit WORD entry assumptions; postdynamic/stack-switch source bodies have no inferred incoming runtime state.'},
  full_graph:{closed:false,native_binding:false,actual_termination_proven:false,minimum_protected_stack_bytes:null,
    unresolved_boundaries:['80:C207 continuation data-derived RTS','80:F386 operand-stack TCS','80:F390 indexed opcode JMP','80:F52F native pointer JMP'],frontier,
    supplied_opcode_sources:[{entries:['80:F393','80:F398','80:F3B1'],source:'analysis/render-task-push.json',source_closed_to_dispatch:true,
      full_graph_closed:false,native_binding:false,operand_output_bytes_each:2,outer_return_frames_added:0,
      qualification:'Three actual JMP-entered push sources through fresh F389 refetch. Operand byte owners and dynamic handler/native/stack-return graph still explicit; not a global stack minimum.'},
      {entries:['80:F8BB','80:F532','80:F53B'],source:'analysis/render-task-consumers.json',source_closed_to_dispatch:true,
        full_graph_closed:false,native_binding:false,operand_s_delta_each:2,outer_return_frames_added:0,
        qualification:'Actual Drop/Add/Subtract JMP sources to fresh F389. Distinct pop/store chronology, binary arithmetic requires decimal flag0; byte owners and full dynamic return graph remain separate.'},
      {entries:['80:F3E4','80:F3EA','80:F3F0'],source:'analysis/render-task-updates.json',source_closed_to_dispatch:true,
        full_graph_closed:false,native_binding:false,operand_s_deltas:[0,0,-2],outer_return_frames_added:0,
        qualification:'Actual Increment/Decrement/Duplicate JMP sources to fresh F389. FullWORD read before high/lowPHA; C/V/decimal preserved, no binary-only premise. Byte owners and complete dynamic return graph remain separate.'},
      {entries:['80:F715','80:F71D','80:F725','80:F72D'],source:'analysis/render-task-bit-logic.json',source_closed_to_dispatch:true,
        full_graph_closed:false,native_binding:false,operand_s_deltas:[2,2,2,0],outer_return_frames_added:0,
        qualification:'Actual AND/OR/XOR/NOT JMP sources to fresh F389. FullWORD reads before low/highSTA or high/lowPHA; C/V/decimal preserved. Byte owners and full dynamic return graph remain separate.'},
      {entries:['80:F6F4','80:F6FD','80:F709'],source:'analysis/render-task-negate-shifts.json',source_closed_to_dispatch:true,
        full_graph_closed:false,native_binding:false,operand_s_deltas:[0,2,2],outer_return_frames_added:0,
        qualification:'Actual Negate/Shifts to fresh F389, including WORD-count finite loop and zero-count no-value-read/no-store path. Negate preserves C/V; positive shifts expose lastCarry. No global stack or dynamic return promotion.'},
      {entries:['80:F8BF','80:F843','80:F87F'],source:'analysis/render-task-truth.json',source_closed_to_dispatch:true,
        full_graph_closed:false,native_binding:false,operand_s_deltas:[0,2,2],outer_return_frames_added:0,
        qualification:'Actual Boolean/Equal/NotEqual and original aliases to fresh F389. FullWORD zeroBoolean no-store, comparison rightPLA/leftCMP/STA and actual right>=left Carry. No global stack or dynamic return promotion.'},
      {entries:['80:F852','80:F86E','80:F88E','80:F8AA'],source:'analysis/render-task-compare-gates.json',source_closed_to_dispatch:true,
        full_graph_closed:false,native_binding:false,operand_s_deltas:[2,2,2,2],outer_return_frames_added:0,
        qualification:'Actual AC/AE/B4/B6 sign/compare gates to fresh F389; original AE BEQ00 retained. AC/B4 gate and fresh CMP reads distinct; AE/B6 negative right no leftread but mandatory leftstore. Path-dependent incoming/CMP Carry; no global stack/dynamic return promotion.'},
      {entries:['80:F735','80:F77A','80:F7BC','80:F7FE'],source:'analysis/render-task-carry-compare.json',source_closed_to_dispatch:true,
        full_graph_closed:false,native_binding:false,operand_s_deltas:[2,2,2,2],outer_return_frames_added:0,
        qualification:'Actual 8A/92/9A/A2 CMP Carry paths through fresh F389; WORD DEC A wrap at8A/A2, original0000->FFFF. All rightPLA/leftCMP/leftSTA, result independent of conventional operator names; no global stack/dynamic return promotion.'},
      {entries:['80:F745','80:F762','80:F789','80:F7A5'],source:'analysis/render-task-carry-sign-gates.json',source_closed_to_dispatch:true,
        full_graph_closed:false,native_binding:false,operand_s_deltas:[2,2,2,2],outer_return_frames_added:0,
        qualification:'Actual 8C/8E/94/96 sign/BCS paths to fresh F389. Left gate/freshCMP distinct; negative right INX/no leftread orDEC, mandatoryleftstore. OptionalDEC A wrap, incoming/CMP Carry; no global stack/dynamic return promotion.'},
      {entries:['80:F7CB','80:F7E7','80:F80E','80:F82B'],source:'analysis/render-task-complement-sign-gates.json',source_closed_to_dispatch:true,
        full_graph_closed:false,native_binding:false,operand_s_deltas:[2,2,2,2],outer_return_frames_added:0,
        qualification:'Actual 9C/9E/A4/A6 sign/BCC paths to fresh F389. Left gate/freshCMP distinct; negative right directlyTXA/FFFF withoutINX/DEC/leftread, mandatoryleftstore. DEC A wrap onlyA4/A6; incoming/CMP Carry, no global stack/dynamic return promotion.'},
      {entries:['80:F3A1','80:F3B9','80:F8CB'],source:'analysis/render-task-local-reads.json',source_closed_to_dispatch:true,
        full_graph_closed:false,native_binding:false,operand_s_deltas:[-2,-2,-2],outer_return_frames_added:0,
        qualification:'Actual 02/16/C2 localWORD reads to fresh F389. Full index/local highbytes before BYTE masks, actualbank00 DP13(+LowX), WORDPHA high/low thenfreshpointer/opcode. Existing host arrays do not supply physical byte owners/global stack/dynamic return.'},
      {entries:['80:F3C6','80:F3D7'],source:'analysis/render-task-local-writes.json',source_closed_to_dispatch:true,
        full_graph_closed:false,native_binding:false,operand_s_deltas:[2,2],outer_return_frames_added:0,
        qualification:'Actual 2C/34 fullWORD index/PLA before BYTE or WORD local stores, actual SEP20/REP20 restores WORD fetch. Own DP00..12 header disjoint; other aliases, fresh pointer/opcode and byte owners explicit. No global stack/dynamic return/native promotion.'},
      {entries:['80:F3F6','80:F408'],source:'analysis/render-task-sign-extension.json',source_closed_to_dispatch:true,
        full_graph_closed:false,native_binding:false,operand_s_deltas:[-2,-2],outer_return_frames_added:0,
        qualification:'Actual 0A/0C fullWORD reads before AND00FF/CMP0080/BCC/optionalORAFF00, WORDPHA high/low thenfreshfetch. Carry from dataLow>=80; prePHA N1/Z0 onbothpaths. Byteowners/aliases and global stack/dynamic return/native binding remain separate.'},
      {entries:['80:F8D4','80:F8E4'],source:'analysis/render-task-state-reads.json',source_closed_to_dispatch:true,
        full_graph_closed:false,native_binding:false,operand_s_deltas:[-2,-2],outer_return_frames_added:0,
        qualification:'Actual 04/18 fullWORD offset/TAX and longX7E0000 StateWORD reads including high7F0000 atXFFFF. AND00FF only04, twoINY thenPHA high/low andfreshfetch; C/V/decimal preserved. Statebyteowners/aliases/native Taskbridge and dynamic/global stack return remain separate.'},
      {entries:['80:F8F1','80:F902'],source:'analysis/render-task-state-writes.json',source_closed_to_dispatch:true,
        full_graph_closed:false,native_binding:false,operand_s_deltas:[2,2],outer_return_frames_added:0,
        qualification:'Actual 2E/36 fullWORD offset/TAX/PLA before BYTE/WORD longX State stores; SEP20/REP20 at2E and high7F0000 at36 XFFFF. Ownpointer/header/stack/opcode aliases and freshfetch explicit; no global stack/dynamic return/native promotion.'},...supplementalTaskSources]},
  no_dispatch_graph:{conditional_graph_closed:true,native_binding:false,actual_termination_proven:false,proof:noDispatch,
    condition:'Negative tail or each actual C3C9 return Carry0 at C1FC. No ready task, successor execution or payload entry.'},
  readiness_graph:{closed:true,native_binding:false,proof:proveWordStack(map,0x80C3C9,'RTS',{measureStack:true})},
  removal_graph:{closed:true,native_binding:false,proof:proveWordStack(map,0x80C396,'RTS',{measureStack:true})},
  local:windows.map(b=>({entry:cpuLabel(b.entry),calls:b.instructions.filter(i=>['JSR','JSL'].includes(i.mnemonic)).map(i=>({from:cpuLabel(i.cpu),to:cpuLabel(i.target)})),edges:b.instructions.filter(i=>i.target!==undefined).map(i=>({from:cpuLabel(i.cpu),to:cpuLabel(i.target),kind:i.mnemonic})),returns:b.instructions.filter(i=>i.mnemonic==='RTS').map(i=>cpuLabel(i.cpu))})),
  dispatch:{opcode_source:opcodeTable,all_byte_opcode_targets:opcodeDispatch,original_even_slots:98,
    native_sources:[nativePointers,nativeArgs,nativeReturns],original_native_slots:220,wait_native_id:159,wait_target:'80:C401',
    qualification:'Original literal source pins, not callable-target/handler return proof. Opcode X is maskedBYTE without ASL: odd bytes overlap words, C4..FF read interpreter code beyond original table. Native tables have220 original entries; no source ID clamp, fresh savedID may become arbitraryWORD through aliases/native effects.'},
  contract:{
    entry:'Local visit/helpers E0M0X0/D0000 binary, actual DBR and intact disjoint code/outerstack; data/source/column validity explicit. No implicit48-slot/parity/ID cap. Wholevisit machine return and operandstack ownership remain open.',
    cursor:'C1CA freshWORDDBR0250->WORDPHA; freshWORDDBR024C->X->DBR0250. Negative tail skips C1F9 and preserves DBR. Otherwise actualC1F9 then PEA8080/PLB/PLB forces DBR80 before WORDPLA/STA0250. Restores original cursorVALUE into actual returnDBR0250, not necessarily original physical cell; A/N/Z from savedcursor, C/V/I/X/Y remain actual path effects. Both PEA bytes consumed before savedcursor.',
    readiness:'ActualC3C9 reads freshWORDDBR0BA2+X. Zero returnsSEC without scratch/status clear. Negative or bit1000 returnsCLC before DP00 changes. Otherwise WORDSTZDP00, savedstatus->DP71; AND6FFE and freshDBR0C62+X, nonzero->DP00. FreshDP71 bit1 selects WORDDECDBR0C02+X; only wrappedresult0 TSB1 into freshDP00. FreshDP00 nonzero clears actualDBR0BA2+X thenSEC, elseCLC. FullWORDmask/counter and fresh alias order; no frame/time/check inferred from count.',
    continuation:'C1F9 first actualC3C9, Carry0 moves fresh cursor to fresh predecessor and returns. Carry1 reads freshWORDDBR02B2+X. Nonzero: PEAC20A creates returnWORD toC20B, WORDPHA stores actual continuation, RTS consumes that WORD and jumps to bank80:(WORD+1)&FFFF. FFFF therefore targets80:0000. No validation or assumed return; remaining outer return/cursor frames stay live. Zero: JSR actualF378.',
    postrun:'C20B context requires actual returning task with WORD/D0 and suitable DBR/stack. Fresh0250->X, fresh0BA2+X: negative chooses freshsuccessor0372+X->0250/X and directF378, bypassing readiness and storedcontinuation. Nonnegative reads freshpredecessor0312+X->0250; secondfreshstatus nonzero returns, zero calls actualC396. After removal fresh0250->X andfreshparentstatus; negative STZparentstatus andBRA C1FE (bypasses readiness), otherwiseRTS. No root/negativecursor sentinel check before parentstatus read.',
    removal:'C396 SEC/freshDBR0252+X/SBC03D6 and actualC2BD. C2BD preservesX, TAY and freshWORDDBR03D2+Y AND7FFF store, no immediate merge or payload clear. Back: fresh predecessorY; oldfreehead->0312+X, X->024E; CPX fresh0250 repairs cursor only ifequal. Freshsuccessor0372+X; TYX tests predecessor signed, repairs successorlink ifnonnegative. TAY tests freshsuccessor signed; repairs predecessorlink or tail024C. No membership/parity/range guards, fresh output/source aliases and actual bank carry.',
    payload:'F378 freshDBR0252+X->A/TCD: D becomes actualpayloadWORD, not assumedoriginal03D6. PEI($01) reads WORDbank00:D+1/D+2, pushes high(frame2) thenlow(frame1); firstPLB consumesframe1, secondPLB selectsframe2. TSC thenSTAactualnewDBR01F2 records outerS; freshWORDDP07->A/TCS selects operandS. Initial freshWORDDP03->Y. FramepointerDP00 and opcodeWORD(DBR:pointer+Y) remainfresh, then INY/AND00FF/TAX/JMP(80:F2B4+X). IgnoredopcodeHigh still required, no ASL/clamp/parity check. Task/root/visit returnframes stay on saved outerstack; no global stack minimum before proving operandstack extent and restoration.',
    end:'F4BE WORDPLA from operandS writes result to currentDBR0000 (not payloadDP00). FreshcurrentDBR01F2->A/TCS restores outerS; LDA0000/TCD restoresD0; RTS consumes actualouter return, with currentDBR preserved and A0/N0/Z1. Payload/status initialization and savedS source ownership must be proved separately.',
    native:'F4CB freshWORDopcodeoperand viaDP00/Y, INY/AND00FF savesY->frame03 and ID->frame09. WORDargumenttable82DA4C+X AND00FF; count0 skip, otherwiseWORDPLA into currentDBR0000+X, X+=2/Y--. FreshDP09 ASL/TAX maysee aliasedWORD, TSC->DP07; freshDBR01F2/TCS restoresouterS, LDA0/TCD setsD0, PEA8080/PLB/PLB setsDBR80. WORD82D7B8+X->DP A2; actualJSRF52F, JMP(bank00:A2) to bank80 target. Native callees arbitrary; scratchA2 and handler modes/D/DBR/stack effects source-required.',
    nativeReturn:'F509 is conditional postnative context, not an assumed callee return: freshDBR0250/0252+X->D, PEIframe01/PLB/PLB->framebank, TSC->DBR01F2, freshDP07/TCS->operandS. FreshWORDDP09 indexes82D970, fullWORDread AND00FF; anynonzero pushes freshDBR0000 WORD, no byte-count loop. FreshDP03->Y thenJMPF389. New cursor/frame/ID/data can differ after native effects; no cached originals.',
    yield:'Actualnative9F C401: freshDBR0250->X, DP00->0BA2+X, DP02->0C02+X, STZ0C62+X, WORDPLA of actualJSRF506 returnWORD F508->02B2+X, RTS consumes next outerF378 or PEAC20A return toC20B. Status0 removes without executingF509. Readiness for storedF508 later invokes dynamicRTS ->F509. Masknegative can select successor after run; no invented callback/frameclock.',
    host_boundary:'Existing scheduler/frame/task JavaScript APIs represent explicitly bounded normalized cooperative data. They fault negative postrun masks, stop unsupported natives/unknown bytecode/sources and omit arbitrary machine control/stack/D/DBR execution. Existing data/runtime tests are not actual9178 script or full machine return evidence.',
    boundaries:'Complete local windows and no-dispatch/readiness/removal proofs supplied; arbitrary continuation targets, operandstack byte owners, complete opcode/native bodies and compatible return/S/D/DBR ownership still source-required. FullC1CA/9178/BF3B/globalstack/native binding staysopen. Original initialization/callers and CPU/device/interrupt/scene/frame execution separate.'}};
await writeFile('analysis/render-c1ca.json',JSON.stringify(report,null,2)+'\n');
await writeFile('analysis/render-c1ca.asm.txt',`; European ROM SHA-256 ${metadata.rom_sha256}\n; Local visit/helper/interpreter/native source. Dynamic return and stack migration explicitly OPEN. No CPU execution.\n\n`+[...windows,...excerpts].map(formatBlock).join('\n'));
console.log(`C1CA local ${report.local_source.code_bytes}/${map.size}; no-dispatch stack ${noDispatch.minimum_protected_stack_bytes}, prefix-only ${frontier.minimum_protected_prefix_stack_bytes}; full dynamic graph OPEN.`);
