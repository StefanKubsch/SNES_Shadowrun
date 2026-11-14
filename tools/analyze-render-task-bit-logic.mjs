import {readFile,writeFile} from 'node:fs/promises';
import {taskInterpreterSource} from './task-interpreter-source.mjs';
import {createHash} from 'node:crypto';
import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {decode,formatBlock} from './disassemble.mjs';
import {scriptOpcodes} from '../src/script/opcodes.mjs';
import {proveBitLogicToDispatch,describeBitLogicByteOwners} from './render-task-bit-logic-source-proof.mjs';
const {bytes,metadata}=inspectRom(await readFile(process.argv[2]??'Shadowrun (E).smc'));
if(metadata.rom_sha256!=='91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690')throw Error('Wrong European ROM revision');
const sha=b=>createHash('sha256').update(b).digest('hex');
function block(name,entry,end){const instructions=[];for(let pc=entry;pc<end;){const i=decode(bytes,pc,{e:0,m:0,x:0});if(i.next>end)throw Error('Source window overflow');instructions.push(i);pc=i.next;}
  return {name,entry,initialState:{e:0,m:0,x:0},instructions,stop:'Complete fixed WORD source to actual dynamic F390; no interpreter/native return inferred.'};}
const describe=b=>{const raw=Buffer.concat(b.instructions.map(i=>i.raw));return {name:b.name,entry:cpuLabel(b.entry),end_exclusive:cpuLabel(b.instructions.at(-1).next),covered_bytes:raw.length,instruction_count:b.instructions.length,sha256:sha(raw),machine_bytes:raw.toString('hex').toUpperCase()};};
const roots=[block('andF715',0x80F715,0x80F71D),block('orF71D',0x80F71D,0x80F725),block('xorF725',0x80F725,0x80F72D),block('notF72D',0x80F72D,0x80F735)];
const fetch=block('fetchF389',0x80F389,0x80F393),map=new Map([...roots,fetch].flatMap(b=>b.instructions.map(i=>[i.cpu,i])));
const updates=JSON.parse(await readFile('analysis/render-task-updates.json','utf8')),visit=taskInterpreterSource(bytes);
const interpreter=visit.windows.find(w=>w.name==='interpreterF378');
if([updates,visit].some(r=>r.rom_sha256!==metadata.rom_sha256)||updates.windows.find(w=>w.name==='fetchF389').machine_bytes!==describe(fetch).machine_bytes
  ||interpreter.machine_bytes.slice(34)!==describe(fetch).machine_bytes)throw Error('Actual shared fetch source drift');
const entries=[[0x7E,0x80F715],[0x80,0x80F71D],[0x82,0x80F725],[0x84,0x80F72D]],dispatch_entries=entries.map(([opcode,entry])=>{
  const pc=0x80F2B4+opcode,off=cpuToOffset(pc,bytes.length),raw=bytes.subarray(off,off+2);
  if(raw.readUInt16LE()!==(entry&65535)||scriptOpcodes[opcode]?.handler!==(entry&65535)
    ||visit.dispatch.all_byte_opcode_targets[opcode].target!==cpuLabel(entry))throw Error('Original bit logic target drift');
  return {opcode,word_source:cpuLabel(pc),target:cpuLabel(entry),machine_bytes:raw.toString('hex').toUpperCase(),sha256:sha(raw)};
});
const report={rom_sha256:metadata.rom_sha256,progress_reference:'docs/PORTIERUNGSSTAND.json',
  processor_reference:{url:'https://www.westerndesigncenter.com/wdc/documentation/w65c816s.pdf',edition:'March 13, 2024',
    sections:['3.5.22/3.5.23/7.1 bank00 native stack/stack-relative offsets','Table5-7 page41 rows22b/22c low-first PLA/high-first PHA; page42 row23 WORD stack-relative low/high','Table5-5 AND/ORA/EOR update N/Z only; C/V/decimal preserved','3.5.13/7.2/7.9 fresh DP indexed fetch and programbank jump'],
    qualification:'Processor instruction address/data/flag semantics only; no SNES device, timing, interrupt or scene evidence.'},
  scope:'Complete JMP-entered F715/F71D/F725/F72D local bit logic sources through actual fresh F389 to dynamic F390. Fixed paths, WORD values and ordered byte origins only; no CPU/memory/task/native/device execution.',
  windows:[...roots,fetch].map(describe),dependencies:[{report:'analysis/render-task-updates.json',window:updates.windows.find(w=>w.name==='fetchF389')},
    {report:'analysis/render-c1ca.json',window:interpreter,opcode_source_sha256:visit.dispatch.opcode_source.sha256}],
  dispatch_entries,source_graph:{source_closed_to_dispatch:true,full_graph_closed:false,native_binding:false,code_bytes:42,instructions:map.size,
    minimum_protected_stack_bytes:null,qualification:'42/21 deduplicated source; AND/OR/XORS+2, NOTS0, no root JSR or whole interpreter/return proof.'},
  bit_logic:entries.map(([,entry])=>proveBitLogicToDispatch(map,entry)),
  synthetic_address_examples:[
    ['AND wraps bank00 operands',{entry:0x80F715,d:0xFFFF,bank:0xFF,s:0xFFFC,y:0,pointerAfter:0xFFFF}],
    ['OR overwrites fresh pointer',{entry:0x80F71D,d:0x3D6,bank:0x80,s:0x3D3,y:4,pointerAfter:0x1234}],
    ['XOR has unavailable writable byte',{entry:0x80F725,d:0x3D6,bank:0x9D,s:0x1FFD,y:0,pointerAfter:0xA001}],
    ['NOT replaces pointer high/low',{entry:0x80F72D,d:0x3D6,bank:0x80,s:0x3D5,y:0xFFFF,pointerAfter:0x1234}]
  ].map(([name,context])=>({name,...describeBitLogicByteOwners(context)})),
  contract:{
    entry:'Actual opcode JMP in programbank80, E0M0X0, full payloadD/actualDBR/operandS/WORD-Y and intact code/outerstack. Incoming A/X carry no payload assumptions. No root JSR, underflow/capacity/parity guards. Read/write byte counts are operand windows, not a global protected stack minimum.',
    binary:'F715/F71D/F725 WORDPLA right reads originalS+1/+2 low/high, then S+2. WORDAND/ORA/EOR01,S reads left at originalS+3/+4; WORDSTA01,S writes result to those same leftbytes low/high. FinalS=originalS+2, one rightWORD removed; no PHA/resultpush, no boolean normalization. Each requires four readablebytes/two writable existingleftbytes.',
    not:'F72D WORDPLA originaltop at originalS+1/+2 low/high, S+2. WORDEOR immediateFFFF complements all16bits. WORDPHA stores resulthigh at originalS+2 then resultlow at originalS+1, restoringS. No stack-relative STA/leftWORD/boolean truth conversion; two readable/two writable originaltopbytes.',
    values:'Binary result is bitwise rightANDleft/rightORleft/rightXORleft; NOT is originaltopXORFFFF. FullWORD masks, including highbyte. No arithmetic, signed comparison, Carry seed, decimal mode dependence or binary-only premise. All four preserve actualC/V/I/decimal and D/DBR; final N/Z are nextopcode flags, not bitlogic result flags.',
    addressing:'All PLA/srLogic/STA/PHA data bytes stay bank00 independently ofD/DBR, with16bit byteaddress/S wrap. Binary sr uses currentS afterPLA+2; NOT temporaryS+2 is undone byPHA. Reads low/high, STA low/high, PHA high/low. Both logical WORDs remain disjoint for everyS; exact actual readable/writable owner and device stability remain prerequisites.',
    fetch:'All handlers JMPactualF389 after both stores; no own operandY advance. Freshbank00:D/(D+1)&FFFF pointer and fullWORD at((DBR<<16)+pointer+incomingY)&FFFFFF including ignoredhigh, then INY/AND00FF/TAX/JMP(80:F2B4+X). FinalY=(entryY+1)&FFFF,A/X=freshopcodeLow,N0/Z(low==0); C/V/I/decimal andD/DBR preserved. No ASL/parity/ID clamp; true nexttarget/tablebyte sources required.',
    aliases:'Binary leftstores or NOT originaltopstores can overlap physical DPpointer/frame/cursor/control/savedouterS or nextopcode sources. Full operandWORD reads precede both resultstores, then F389 must read freshpointer/data; never cached values. Code and outer-returnstack integrity explicit, destructive aliases not approved; no automatic frame7 rewrite or original initialization supplied.',
    host_boundary:'compileScriptFrame bit logic uses bounded arrayWORDs and storageguards, returnsPC before nextopcode and tracks no machineC/V/decimal or physicalS/D/DBR. It supplies neither arbitrary bank00 byteowners, ignoredopcodeHigh nor full physical PLA/sr/STA/PHA alias/refetch chronology. Synthetic hostvalue comparisons are data consequences only, not original Task/CPU/device/scene evidence.',
    boundaries:'Four local sources close only to actual dynamicdispatch. Physical taskbyte bridge, original initialization, further opcode/native/stackmigration/return contracts separate. C1CA/9178/BF3B fullgraphs/native/globalstack remain open.'}};
await writeFile('analysis/render-task-bit-logic.json',JSON.stringify(report,null,2)+'\n');
await writeFile('analysis/render-task-bit-logic.asm.txt',`; European ROM SHA-256 ${metadata.rom_sha256}\n; JMP-entered WORD bit logic, actual fresh fetch. Dynamic dispatch and full return OPEN; no CPU execution.\n\n`+[...roots,fetch].map(formatBlock).join('\n'));
console.log(`Task bit logic42/${map.size}; all entry paths9; binaryS+2/NOTS0, full dynamic graph OPEN.`);
