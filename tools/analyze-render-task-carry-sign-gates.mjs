import {readFile,writeFile} from 'node:fs/promises';
import {taskInterpreterSource} from './task-interpreter-source.mjs';
import {createHash} from 'node:crypto';
import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {decode,formatBlock} from './disassemble.mjs';
import {scriptOpcodes} from '../src/script/opcodes.mjs';
import {proveCarrySignGatesToDispatch,describeCarrySignGateByteOwners} from './render-task-carry-sign-gates-source-proof.mjs';
const {bytes,metadata}=inspectRom(await readFile(process.argv[2]??'Shadowrun (E).smc'));
if(metadata.rom_sha256!=='91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690')throw Error('Wrong European ROM revision');
const sha=b=>createHash('sha256').update(b).digest('hex');
function block(name,entry,end){const instructions=[];for(let pc=entry;pc<end;){const i=decode(bytes,pc,{e:0,m:0,x:0});if(i.next>end)throw Error('Source window overflow');instructions.push(i);pc=i.next;}
  return {name,entry,initialState:{e:0,m:0,x:0},instructions,stop:'Complete fixed WORD source to actual dynamic F390; no interpreter/native return inferred.'};}
const describe=b=>{const raw=Buffer.concat(b.instructions.map(i=>i.raw));return {name:b.name,entry:cpuLabel(b.entry),end_exclusive:cpuLabel(b.instructions.at(-1).next),covered_bytes:raw.length,instruction_count:b.instructions.length,sha256:sha(raw),machine_bytes:raw.toString('hex').toUpperCase()};};
// F774/F7B6 are separate later opcode trampolines, not reachable from these entries.
const roots=[block('gate8cF745',0x80F745,0x80F762),block('gate8eF762',0x80F762,0x80F774),block('gate94F789',0x80F789,0x80F7A5),block('gate96F7A5',0x80F7A5,0x80F7B6)];
const fetch=block('fetchF389',0x80F389,0x80F393),map=new Map([...roots,fetch].flatMap(b=>b.instructions.map(i=>[i.cpu,i])));
const previous=JSON.parse(await readFile('analysis/render-task-carry-compare.json','utf8')),visit=taskInterpreterSource(bytes);
const interpreter=visit.windows.find(w=>w.name==='interpreterF378');
if([previous,visit].some(r=>r.rom_sha256!==metadata.rom_sha256)||previous.windows.find(w=>w.name==='fetchF389').machine_bytes!==describe(fetch).machine_bytes
  ||interpreter.machine_bytes.slice(34)!==describe(fetch).machine_bytes)throw Error('Actual shared fetch source drift');
const dispatch_entries=[[0x8C,0x80F745],[0x8E,0x80F762],[0x94,0x80F789],[0x96,0x80F7A5]].map(([opcode,entry])=>{
  const pc=0x80F2B4+opcode,off=cpuToOffset(pc,bytes.length),raw=bytes.subarray(off,off+2);
  if(raw.readUInt16LE()!==(entry&65535)||scriptOpcodes[opcode]?.handler!==(entry&65535)
    ||visit.dispatch.all_byte_opcode_targets[opcode].target!==cpuLabel(entry))throw Error('Original carry sign gate target drift');
  return {opcode,word_source:cpuLabel(pc),target:cpuLabel(entry),machine_bytes:raw.toString('hex').toUpperCase(),sha256:sha(raw)};
});
const report={rom_sha256:metadata.rom_sha256,progress_reference:'docs/PORTIERUNGSSTAND.json',
  processor_reference:{url:'https://www.westerndesigncenter.com/wdc/documentation/w65c816s.pdf',edition:'March 13, 2024',
    sections:['3.5.22/3.5.23/7.1 bank00 native stack/stack-relative offsets','Table5-7 WORD PLA low/high and WORD stack-relative read/store low/high',
      'Table5-1 BMI N1, BPL N0, BCS C1; Table5-5 BMI N0 label inconsistent, not used',
      'Table5-5 WORD DEC A/INX affect N/Z only; CMP changes N/Z/C and preserves A/V',
      'CMP ignores decimal/incomingCarry; C1 iff unsigned accumulator>=operand','3.5.13/7.2/7.9 fresh DP indexed fetch and programbank jump'],
    qualification:'Processor semantics only; no SNES device/timing/interrupt/scene evidence.'},
  scope:'Complete JMP-entered original8C/F745 8E/F762 94/F789 96/F7A5 sources through fresh F389 to dynamic F390. Actual sign gates before optional DEC A, fresh CMP Carry, negative right INX without leftread. No conventional comparison operator or CPU/memory/task/native/device execution inferred.',
  windows:[...roots,fetch].map(describe),dependencies:[{report:'analysis/render-task-carry-compare.json',window:previous.windows.find(w=>w.name==='fetchF389')},
    {report:'analysis/render-c1ca.json',window:interpreter,opcode_source_sha256:visit.dispatch.opcode_source.sha256}],dispatch_entries,
  source_graph:{source_closed_to_dispatch:true,full_graph_closed:false,native_binding:false,code_bytes:102,instructions:map.size,
    minimum_protected_stack_bytes:null,qualification:'102/53 deduplicated source, twelve finite paths allS+2. LaterF774/F7B6 trampolines excluded as unreachable; no root JSR/global interpreter return proof.'},
  carry_sign_gates:roots.map(b=>proveCarrySignGatesToDispatch(map,b.entry)),
  synthetic_address_examples:[
    ['8C negative left skips DEC/CMP even with rightzero',{entry:0x80F745,d:0x3D6,bank:0x9D,s:0x3F0,y:4,pointerAfter:0xA001,leftGateWord:0x8000,right:0,incomingCarry:0}],
    ['8E negative right reads no left but still writes it',{entry:0x80F762,d:0x3D6,bank:0x80,s:0x1FFD,y:0,pointerAfter:0xA001,right:0x8000,incomingCarry:1}],
    ['94 fresh CMP left differs from earlier sign gate',{entry:0x80F789,d:0x3D6,bank:0x80,s:0x3D3,y:4,pointerAfter:0,leftGateWord:0,leftCompareWord:0xFFFF,right:1}],
    ['96 mandatory leftstore wraps bank00',{entry:0x80F7A5,d:0xFFFF,bank:0xFF,s:0xFFFC,y:1,pointerAfter:0xFFFF,right:0x7FFF,leftCompareWord:0x7FFF}]
  ].map(([name,context])=>({name,...describeCarrySignGateByteOwners(context)})),
  contract:{
    entry:'Actual opcode JMP in programbank80, E0M0X0, actual payloadD/DBR/operandS/WORD-Y, intact code/outerstack and real byte owners. IncomingA/X have no assumptions. No root JSR/underflow/capacity/parity/ID guards. Distinct fresh gate/CMP WORDreads supplied explicitly, not cached.',
    left_gate:'8C/94 WORDLDA03,S first reads left low/high at entryS+3/+4; BPL tests its actual N. Negative leftGateWORD: right WORDPLA low/high and S+2, LDAFFFF, STA01,S writes left low/high. No LDX/DEC/CMP/INX/TXA, entryX unchanged until fetch, incomingCarry preserved. Nonnegative gate: LDXFFFF/rightPLA, optionalDEC A only8C, then separate freshleftCMP01,S. leftCompareWORD need not equal leftGateWORD. Six read accesses on four unique bytes when compared.',
    right_gate:'8E/96 LDXFFFF/right WORDPLA andS+2, BMI tests actual original right N BEFORE anyDEC. Negative right jumps directly to INXFFFF->0000 thenTXA/STA: result0000, incomingCarry preserved, noDEC/CMP/leftread. Two readable rightbytes but mandatory two writable leftbytes. Nonnegative right: 8E DEC A then freshleftCMP; 96 freshCMP withoutDEC. No second sign gate on decremented A.',
    compared:'BCS skipsINX iff actual freshCMP C1; C0 INXFFFF->0000. A=(originalright-1) modulo65536 at8C/8E, originalright at94/96. CMP C1 iff unsignedA>=freshleftCompareWORD, ignoresincomingCarry/decimal andpreservesA/V. Compared resultFFFF iffC1, else0000. Originalright0000 passes8E BMI, becomesFFFF, compares andreturnsFFFF for EVERYfreshleft; negative8C leftgate skipsDEC. Originalright8000 becomes7FFF onlyon8C compared path; 8E BMI instead skipsDEC/CMP andreturns0000. No saturation/right>left/signedoperator rewrite.',
    flags_stack:'Exactly one WORDPLA and mandatoryWORDSTAleft on everypath, rightremoved/leftreplaced, finalS+2. No PHA/resultpush/STZ. C actualincoming orCMP survivesINX/TXA/STA/fetch; V/I/decimal preserved throughout includingDEC8000->7FFF, noCLD/binary-onlypremise. FinalN/Z/X fromfreshopcode, notsign/result/CMP. PayloadD separate fromstatusdecimal. Operandread/write requirements are not global protected stack minima.',
    addressing:'All operand PLA/LDA/CMP/STA bytes bank00 independentlyofD/DBR; S andbyteaddresses wrap16bits. GateusesentryS+3, compare/store usesS+2 plus1. DEC A modifiesregisteronly, neverwrites poppedright oradds memoryaccess. Rightnegative omitsleft readowner, notleft writeowner.',
    fetch:'All twelve paths reachactualF389 afterbothleft stores. Freshbank00:D/(D+1)&FFFF pointer and fullWORD at((DBR<<16)+pointer+incomingY)&FFFFFF includingignoredhigh, INY/AND00FF/TAX/JMP(80:F2B4+X). FinalY=(entryY+1)&FFFF,A/X=opcodeLow,N0/Z(low==0); D/DBR/V/I/decimal preserved,C actualpath. No ASL/parity/IDclamp; nexttarget/tableWORD/body remainrequired.',
    aliases:'All actual gate/PLA/freshCMP reads precedebothleft stores; pointer/opcode are freshafterstores. Leftstores canalias pointer/frame/cursor/control/savedouterS/nextopcodebytes. No-CMP doesnot waive mandatoryleftwrites orfreshDP/opcodeowners. Intact code/outerstack andreal ownersrequired; noautomaticframe7 writes/initialization/memoryopening ordestructivealiasauthorization.',
    host_boundary:'compileScriptFrame rejects original8C/8E/94/96 asnotimplemented beforestep/stateeffects. No runtime changes/opcode renaming/native promotion. Pure WORD/address examples explicitlysynthetic, not machine/task/device/scene evidence.',
    boundaries:'Local sources closeonlytoactualdynamicdispatch. Separate9C/9E/A4/A6 sources: analysis/render-task-complement-sign-gates.json. Physical taskbyte bridge, originalinitialization andopcode/native/stackmigration/return contracts remainseparate. FullC1CA/9178/BF3B/native/globalstack remainopen.'}};
await writeFile('analysis/render-task-carry-sign-gates.json',JSON.stringify(report,null,2)+'\n');
await writeFile('analysis/render-task-carry-sign-gates.asm.txt',`; European ROM SHA-256 ${metadata.rom_sha256}\n; Actual original sign/Carry gates and optional DEC A, fresh fetch. Dynamic dispatch/full return OPEN; no CPU execution.\n\n`+[...roots,fetch].map(formatBlock).join('\n'));
console.log(`Task carry sign gates102/${map.size}; twelve paths, sign beforeDEC, negative rightINX/noCMP; full dynamic graph OPEN.`);
