import {readFile,writeFile} from 'node:fs/promises';
import {taskInterpreterSource} from './task-interpreter-source.mjs';
import {createHash} from 'node:crypto';
import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {decode,formatBlock} from './disassemble.mjs';
import {scriptOpcodes} from '../src/script/opcodes.mjs';
import {proveUpdateToDispatch,describeUpdateByteOwners} from './render-task-updates-source-proof.mjs';
const {bytes,metadata}=inspectRom(await readFile(process.argv[2]??'Shadowrun (E).smc'));
if(metadata.rom_sha256!=='91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690')throw Error('Wrong European ROM revision');
const sha=b=>createHash('sha256').update(b).digest('hex');
function block(name,entry,end){const instructions=[];for(let pc=entry;pc<end;){const i=decode(bytes,pc,{e:0,m:0,x:0});if(i.next>end)throw Error('Source window overflow');instructions.push(i);pc=i.next;}
  return {name,entry,initialState:{e:0,m:0,x:0},instructions,stop:'Complete fixed WORD source to actual dynamic F390; no interpreter/native return inferred.'};}
const describe=b=>{const raw=Buffer.concat(b.instructions.map(i=>i.raw));return {name:b.name,entry:cpuLabel(b.entry),end_exclusive:cpuLabel(b.instructions.at(-1).next),covered_bytes:raw.length,instruction_count:b.instructions.length,sha256:sha(raw),machine_bytes:raw.toString('hex').toUpperCase()};};
const roots=[block('incrementF3E4',0x80F3E4,0x80F3EA),block('decrementF3EA',0x80F3EA,0x80F3F0),block('duplicateF3F0',0x80F3F0,0x80F3F6)];
const fetch=block('fetchF389',0x80F389,0x80F393),map=new Map([...roots,fetch].flatMap(b=>b.instructions.map(i=>[i.cpu,i])));
const consumers=JSON.parse(await readFile('analysis/render-task-consumers.json','utf8')),visit=taskInterpreterSource(bytes);
const interpreter=visit.windows.find(w=>w.name==='interpreterF378');
if([consumers,visit].some(r=>r.rom_sha256!==metadata.rom_sha256)||consumers.windows.find(w=>w.name==='fetchF389').machine_bytes!==describe(fetch).machine_bytes
  ||interpreter.machine_bytes.slice(34)!==describe(fetch).machine_bytes)throw Error('Actual shared fetch source drift');
const entries=[[0x86,0x80F3E4],[0x88,0x80F3EA],[0xBA,0x80F3F0]],dispatch_entries=entries.map(([opcode,entry])=>{
  const pc=0x80F2B4+opcode,off=cpuToOffset(pc,bytes.length),raw=bytes.subarray(off,off+2);
  if(raw.readUInt16LE()!==(entry&65535)||scriptOpcodes[opcode]?.handler!==(entry&65535)
    ||visit.dispatch.all_byte_opcode_targets[opcode].target!==cpuLabel(entry))throw Error('Original update target drift');
  return {opcode,word_source:cpuLabel(pc),target:cpuLabel(entry),machine_bytes:raw.toString('hex').toUpperCase(),sha256:sha(raw)};
});
const report={rom_sha256:metadata.rom_sha256,progress_reference:'docs/PORTIERUNGSSTAND.json',
  processor_reference:{url:'https://www.westerndesigncenter.com/wdc/documentation/w65c816s.pdf',edition:'March 13, 2024',
    sections:['3.5.22/3.5.23/7.1 bank00 native stack/stack-relative offsets','Table5-7 page41 rows22b/22c low-first PLA/high-first PHA; page42 row23 WORD stack-relative read','Table5-5 INC/DEC change N/Z only, no decimal/Carry/V operation','3.5.13/7.2/7.9 fresh DP indexed fetch and programbank jump'],
    qualification:'Processor instruction address/data/flag semantics only; no SNES device, timing, interrupt or scene evidence.'},
  scope:'Complete JMP-entered F3E4/F3EA/F3F0 local stack update/duplicate sources through actual fresh F389 to dynamic F390. Fixed paths, WORD value and byte chronology only; no CPU/memory/task/native/device execution.',
  windows:[...roots,fetch].map(describe),dependencies:[
    {report:'analysis/render-task-consumers.json',window:consumers.windows.find(w=>w.name==='fetchF389')},
    {report:'analysis/render-c1ca.json',window:interpreter,opcode_source_sha256:visit.dispatch.opcode_source.sha256}],
  dispatch_entries,source_graph:{source_closed_to_dispatch:true,full_graph_closed:false,native_binding:false,code_bytes:28,instructions:map.size,
    minimum_protected_stack_bytes:null,qualification:'28/16 deduplicated local source; updateS unchanged, duplicateS-2; no root JSR or whole interpreter/return proof.'},
  updates:entries.map(([,entry])=>proveUpdateToDispatch(map,entry)),
  synthetic_address_examples:[
    ['Increment restores wrapped S',{entry:0x80F3E4,d:0x3D6,bank:0x9D,s:0xFFFE,y:0xFFFF,pointerAfter:0xFFFF}],
    ['Decrement overwrites fresh pointer',{entry:0x80F3EA,d:0x3D6,bank:0x80,s:0x3D5,y:4,pointerAfter:0x1234}],
    ['Duplicate overwrites pointer',{entry:0x80F3F0,d:0x3D6,bank:0x80,s:0x3D7,y:4,pointerAfter:0x1234}],
    ['Duplicate beyond known WRAM',{entry:0x80F3F0,d:0xFFFF,bank:0xFF,s:0,y:0,pointerAfter:0xFFFF}]
  ].map(([name,context])=>({name,...describeUpdateByteOwners(context)})),
  contract:{
    entry:'Actual opcode JMP in programbank80, E0M0X0, full payloadD/actualDBR/operandS/WORD-Y and intact code/outerstack. Incoming A/X carry no payload assumptions. No root JSR, underflow/capacity/parity checks. Two read/write bytes are operand windows, not a global protected stack minimum.',
    increment:'F3E4 WORDPLA reads original top low/high at bank00:incomingS+1/+2 and increasesS2. INC A wraps originalWORD+1 at16bits. WORDPHA writes result high at originalS+2 then low at originalS+1, returningS to originalS. JMPactualF389; no stack-relative STA or memory INC inferred.',
    decrement:'F3EA WORDPLA reads original top low/high at bank00:incomingS+1/+2 and increasesS2. DEC A wraps originalWORD-1 at16bits. WORDPHA writes result high at originalS+2 then low at originalS+1, returningS to originalS. JMPactualF389; no SBC/borrow/Carry seed, no operandY advance.',
    duplicate:'F3F0 WORDLDA01,S reads full original top at bank00:incomingS+1/+2 without movingS. WORDPHA writes originalhigh at incomingS and originallow at incomingS-1, thenS=(incomingS-2)&FFFF. Original topbytes remain logically disjoint from newcopy for everyS; no pop, metadata write or capacity guard inferred.',
    addressing:'All PLA/srLDA/PHA operandbytes stay bank00 independently ofD/DBR, with individual16bit address/S wrap. Updates temporarily raiseS2 and restoreS; duplicate lowersS2. Reads are low/high; PHA stores high/low. Full originalWORD is read before either store, including update overwrite. Known physical mapping is not actual readable/writable owner or device stability.',
    flags:'PLA/LDA and INC/DEC update localN/Z; PHA preserves them. INC/DEC wrap regardless of incomingC/statusdecimal and preserveC/V, even7FFF->8000 or8000->7FFF. No ADC/SBC/CLD or binary-only premise. AllC/V/I/decimal preserved; payloadD is a separate16bit register. Final N0/Z(freshopcodeLow==0) from F389AND00FF/TAX overwrites local flags.',
    fetch:'All JMPactualF389 after stores, with unchanged operandY. Freshbank00:D/(D+1)&FFFF pointer and fullWORD at((DBR<<16)+pointer+incomingY)&FFFFFF including ignoredhigh, then INY/AND00FF/TAX/JMP(80:F2B4+X). FinalY=(entryY+1)&FFFF,A/X=freshopcodeLow; D/DBR unchanged. NoASL/parity/ID clamp, complete nexttarget/tablebyte ownership required.',
    aliases:'Update stores overwrite originaltopbytes, possibly physical DPpointer/frame/cursor/control/savedouterS or nextopcode sources. Duplicate newbytes are logically disjoint from topWORD but may hit those other fields. F389 must read freshpointer/data after both high/lowstores, never cached values. Code and outer-returnstack integrity explicit; destructive aliases not approved. No automatic frame7 rewrite or original initialization supplied.',
    host_boundary:'compileScriptFrame Increment/Decrement/Duplicate uses bounded arrayWORDs and storageguards, writes known stack windows and returnsPC before nextopcode. It omits physical PLA/PHA/sr addressing, arbitraryS/D/DBR, ignoredopcodeHigh, statusflags and alias/refetch chronology. Synthetic hostvalue comparisons are data consequences only; no original Task/CPU/device/scene evidence.',
    boundaries:'Three local sources close only to actual dynamicdispatch. Physical taskbyte bridge, initialization, further opcode/native/stackmigration/return contracts separate. C1CA/9178/BF3B fullgraphs/native/globalstack remain open.'}};
await writeFile('analysis/render-task-updates.json',JSON.stringify(report,null,2)+'\n');
await writeFile('analysis/render-task-updates.asm.txt',`; European ROM SHA-256 ${metadata.rom_sha256}\n; JMP-entered WORD updates/duplicate, actual fresh fetch. Dynamic dispatch and full return OPEN; no CPU execution.\n\n`+[...roots,fetch].map(formatBlock).join('\n'));
console.log(`Task updates28/${map.size}; entry paths ${report.updates.map(p=>p.reachable_instructions).join('/')}; updateS0/duplicateS-2, full dynamic graph OPEN.`);
