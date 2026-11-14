import {readFile,writeFile} from 'node:fs/promises';
import {taskInterpreterSource} from './task-interpreter-source.mjs';
import {createHash} from 'node:crypto';
import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {decode,formatBlock} from './disassemble.mjs';
import {scriptOpcodes} from '../src/script/opcodes.mjs';
import {proveNegateShiftToDispatch,describeNegateShiftByteOwners} from './render-task-negate-shifts-source-proof.mjs';
const {bytes,metadata}=inspectRom(await readFile(process.argv[2]??'Shadowrun (E).smc'));
if(metadata.rom_sha256!=='91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690')throw Error('Wrong European ROM revision');
const sha=b=>createHash('sha256').update(b).digest('hex');
function block(name,entry,end){const instructions=[];for(let pc=entry;pc<end;){const i=decode(bytes,pc,{e:0,m:0,x:0});if(i.next>end)throw Error('Source window overflow');instructions.push(i);pc=i.next;}
  return {name,entry,initialState:{e:0,m:0,x:0},instructions,stop:'Complete fixed WORD source and actual loop branches to dynamic F390; no interpreter/native return inferred.'};}
const describe=b=>{const raw=Buffer.concat(b.instructions.map(i=>i.raw));return {name:b.name,entry:cpuLabel(b.entry),end_exclusive:cpuLabel(b.instructions.at(-1).next),covered_bytes:raw.length,instruction_count:b.instructions.length,sha256:sha(raw),machine_bytes:raw.toString('hex').toUpperCase()};};
const roots=[block('negateF6F4',0x80F6F4,0x80F6FD),block('shiftLeftF6FD',0x80F6FD,0x80F709),block('shiftRightF709',0x80F709,0x80F715)];
const fetch=block('fetchF389',0x80F389,0x80F393),map=new Map([...roots,fetch].flatMap(b=>b.instructions.map(i=>[i.cpu,i])));
const bitLogic=JSON.parse(await readFile('analysis/render-task-bit-logic.json','utf8')),visit=taskInterpreterSource(bytes);
const interpreter=visit.windows.find(w=>w.name==='interpreterF378');
if([bitLogic,visit].some(r=>r.rom_sha256!==metadata.rom_sha256)||bitLogic.windows.find(w=>w.name==='fetchF389').machine_bytes!==describe(fetch).machine_bytes
  ||interpreter.machine_bytes.slice(34)!==describe(fetch).machine_bytes)throw Error('Actual shared fetch source drift');
const entries=[[0x78,0x80F6F4],[0x7A,0x80F6FD],[0x7C,0x80F709]],dispatch_entries=entries.map(([opcode,entry])=>{
  const pc=0x80F2B4+opcode,off=cpuToOffset(pc,bytes.length),raw=bytes.subarray(off,off+2);
  if(raw.readUInt16LE()!==(entry&65535)||scriptOpcodes[opcode]?.handler!==(entry&65535)
    ||visit.dispatch.all_byte_opcode_targets[opcode].target!==cpuLabel(entry))throw Error('Original negate/shift target drift');
  return {opcode,word_source:cpuLabel(pc),target:cpuLabel(entry),machine_bytes:raw.toString('hex').toUpperCase(),sha256:sha(raw)};
});
const report={rom_sha256:metadata.rom_sha256,progress_reference:'docs/PORTIERUNGSSTAND.json',
  processor_reference:{url:'https://www.westerndesigncenter.com/wdc/documentation/w65c816s.pdf',edition:'March 13, 2024',
    sections:['3.5.22/7.1 bank00 native stack','Table5-7 page41 rows22b/22c WORD PLX/PLA low-first and PHA high-first','Table5-5 EOR/INC/PLX/DEX and ASL/LSR flags, BEQ/BNE Z tests','3.5.13/7.2/7.9 fresh DP indexed fetch and programbank jump'],
    qualification:'Processor instruction address/data/flag semantics only; no SNES device, timing, interrupt or scene evidence.'},
  scope:'Complete JMP-entered F6F4/F6FD/F709 source including actual zero-count gates and full WORD shift-loop induction to F390. Address/value equations only, no CPU/memory/task/native/device execution.',
  windows:[...roots,fetch].map(describe),dependencies:[{report:'analysis/render-task-bit-logic.json',window:bitLogic.windows.find(w=>w.name==='fetchF389')},
    {report:'analysis/render-c1ca.json',window:interpreter,opcode_source_sha256:visit.dispatch.opcode_source.sha256}],
  dispatch_entries,source_graph:{source_closed_to_dispatch:true,full_graph_closed:false,native_binding:false,code_bytes:43,instructions:map.size,
    minimum_protected_stack_bytes:null,qualification:'43/26 deduplicated source; NegateS0/ShiftS+2. FullWORD finite loop under explicit context, not wholeinterpreter termination or global stack proof.'},
  negate_shifts:entries.map(([,entry])=>proveNegateShiftToDispatch(map,entry)),
  synthetic_address_examples:[
    ['Negate overwrites fresh pointer',{entry:0x80F6F4,d:0x3D6,bank:0x80,s:0x3D5,y:4,pointerAfter:0x1234}],
    ['Shift0 requires no valuebytes',{entry:0x80F6FD,d:0xFFFF,bank:0xFF,s:0x1FFE,y:0xFFFF,count:0,pointerAfter:0xFFFF}],
    ['Shift1 wraps value and PHA',{entry:0x80F709,d:0x3D6,bank:0x9D,s:0xFFFC,y:0,count:1,pointerAfter:0xA001}],
    ['Full65535 leftcount and pointeralias',{entry:0x80F6FD,d:0x3D6,bank:0x80,s:0x3D3,y:4,count:65535,pointerAfter:0x1234}]
  ].map(([name,context])=>({name,...describeNegateShiftByteOwners(context)})),
  contract:{
    entry:'Actual opcode JMP in programbank80,E0M0X0,full payloadD/actualDBR/operandS/WORD-Y and intact code/outerstack. No root JSR, underflow/capacity/parity guards. Actual readable/writable byteowners and preserved contexts remain prerequisites; operand bytes are not global protected stack minimum.',
    negate:'WORDPLA originaltop low/high at incomingS+1/+2 raisesS2, WORDEORFFFF and INCA give (-originaltop)mod65536, WORDPHA high at incomingS+2 then low at+1 restoresS. C/V/I/decimal preserved, even8000->8000; no SBC/binary-only premise or Carry seed. Two readable/two writable originaltopbytes.',
    zero_count:'WORDPLX count low/high at incomingS+1/+2 raisesS2. BEQ tests PLX Z and jumps directly to actual JMPF389 for exactWORD0. No operand-value PLA, no PHA/store, no shift/DEX; two readablecountbytes and zero writablebytes. OriginalleftWORD is not loaded as operand; incoming C preserved, X0 before fetch. Aliased leftbytes can still be actual DP/fetch sources at F389 and need separate readable owners. No manufactured leftvalue/source or underflowcheck.',
    positive_count:'AnyWORD1..FFFF takes PLA of originalleft low/high at incomingS+3/+4, raisingS4. ASL/LSR accumulator, WORDDEX, BNE onDEX Z repeat exactly suppliedcount times. WORDPHA high at incomingS+4 then low at+3 restoresS to originalS+2. Four readablebytes/two writable existingleftbytes, rightcount removed. No clamp16/32 or signed cutoff; X0 at loop exit then actualfreshopcode TAX replacesX.',
    values:'Left logicalzero-fill: (value*2^count)mod65536, right floor(value/2^count). Result0 for count>=16, but actualloop still count times. For1..16 Carry is originalbit(16-count) left or(count-1) right; count16 canleaveCarry1 with result0, count>16 C0. Count0 preserves incomingC and unread value. Negate preservesC/V, shifts preserveV/I/decimal; no signed rightshift or rotates.',
    loop_flags:'BEQ depends on PLX WORD Z, not A/oldopcode. BNE immediately follows DEX, tests its Z rather than ASL/LSR resultZ. Therefore a value becoming0 early never shortens the loop. DEX/branches/PHA/fetch preserve lastshiftCarry; local result/DEX N/Z overwritten by finalAND00FF/TAX. Fullcount decrease gives local instruction/data termination only, not elapsed time or interpreter return.',
    addressing:'All PLX/PLA/PHA operandbytes stay bank00 independently ofD/DBR; byteaddresses andS wrap16bits separately. Pulls low/high; PHA high/low relative to current raisedS. Count0 performs no store, positivecount stores once after wholeloop. Explicit source/stability/write owners and intactcode/outerstack required, not actual execution proof.',
    fetch:'ActualF389 runs after any PHA or zero-count gate, with unchanged operandY. Freshbank00:D/(D+1)&FFFF pointer and fullWORD at((DBR<<16)+pointer+incomingY)&FFFFFF including ignoredhigh; INY/AND00FF/TAX/JMP(80:F2B4+X). FinalY=(entryY+1)&FFFF,A/X=freshopcodeLow,N0/Z(low==0), D/DBR/V/I/decimal unchanged. C actual path-dependent; no ASL/parity/ID clamp or cached pointer/opcode.',
    aliases:'Negate originaltop/positive-shift leftPHA can alias physical DPpointer/frame/cursor/control/savedouterS or nextopcode bytes. All operandreads precede both PHAstores; F389 must use freshpoststore pointer/data. Count0 changesS without writes and does not authorize valuebyte reads. Code/outerstack integrity explicit; no automatic frame7 rewrite or approved destructive alias/initialization.',
    host_boundary:'compileScriptFrame normalized arrayWORD Negate/Shifts clamps shift result at16 and reads known leftvalue even for count0; it has no original WORD loop/Carry, arbitrary physical S/D/DBR/byteowners, ignoredopcodeHigh or source/refetch chronology. Bounded hostvalue comparisons remain synthetic data consequences, not original Task/CPU/device/scene evidence.',
    boundaries:'Three local sources close only to actual dynamicdispatch. Finite data-loop proof is conditional on actual context/intactcode, not wholeinterpreter return. Physical taskbyte bridge, initialization, further opcode/native/stackmigration/return sources separate; C1CA/9178/BF3B fullgraphs/native/globalstack remain open.'}};
await writeFile('analysis/render-task-negate-shifts.json',JSON.stringify(report,null,2)+'\n');
await writeFile('analysis/render-task-negate-shifts.asm.txt',`; European ROM SHA-256 ${metadata.rom_sha256}\n; JMP Negate/Shifts with actual count0 gates/WORD loop. Dynamic dispatch and full return OPEN; no CPU execution.\n\n`+[...roots,fetch].map(formatBlock).join('\n'));
console.log(`Task negate/shifts43/${map.size}; negate10/zero8/positive10+3*count instructions, full dynamic graph OPEN.`);
