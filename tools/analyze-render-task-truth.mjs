import {readFile,writeFile} from 'node:fs/promises';
import {taskInterpreterSource} from './task-interpreter-source.mjs';
import {createHash} from 'node:crypto';
import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {decode,formatBlock} from './disassemble.mjs';
import {scriptOpcodes} from '../src/script/opcodes.mjs';
import {proveTruthToDispatch,describeTruthByteOwners} from './render-task-truth-source-proof.mjs';
const {bytes,metadata}=inspectRom(await readFile(process.argv[2]??'Shadowrun (E).smc'));
if(metadata.rom_sha256!=='91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690')throw Error('Wrong European ROM revision');
const sha=b=>createHash('sha256').update(b).digest('hex');
function block(name,entry,end){const instructions=[];for(let pc=entry;pc<end;){const i=decode(bytes,pc,{e:0,m:0,x:0});if(i.next>end)throw Error('Source window overflow');instructions.push(i);pc=i.next;}
  return {name,entry,initialState:{e:0,m:0,x:0},instructions,stop:'Complete fixed WORD source to actual dynamic F390; no interpreter/native return inferred.'};}
const describe=b=>{const raw=Buffer.concat(b.instructions.map(i=>i.raw));return {name:b.name,entry:cpuLabel(b.entry),end_exclusive:cpuLabel(b.instructions.at(-1).next),covered_bytes:raw.length,instruction_count:b.instructions.length,sha256:sha(raw),machine_bytes:raw.toString('hex').toUpperCase()};};
const roots=[block('booleanF8BF',0x80F8BF,0x80F8CB),block('equalF843',0x80F843,0x80F852),block('notEqualF87F',0x80F87F,0x80F88E)];
const fetch=block('fetchF389',0x80F389,0x80F393),map=new Map([...roots,fetch].flatMap(b=>b.instructions.map(i=>[i.cpu,i])));
const previous=JSON.parse(await readFile('analysis/render-task-negate-shifts.json','utf8')),visit=taskInterpreterSource(bytes);
const interpreter=visit.windows.find(w=>w.name==='interpreterF378');
if([previous,visit].some(r=>r.rom_sha256!==metadata.rom_sha256)||previous.windows.find(w=>w.name==='fetchF389').machine_bytes!==describe(fetch).machine_bytes
  ||interpreter.machine_bytes.slice(34)!==describe(fetch).machine_bytes)throw Error('Actual shared fetch source drift');
const entries=[[0xBE,0x80F8BF],[0xAA,0x80F843],[0xB0,0x80F843],[0xB2,0x80F87F],[0xB8,0x80F87F]];
const dispatch_entries=entries.map(([opcode,entry])=>{
  const pc=0x80F2B4+opcode,off=cpuToOffset(pc,bytes.length),raw=bytes.subarray(off,off+2);
  if(raw.readUInt16LE()!==(entry&65535)||scriptOpcodes[opcode]?.handler!==(entry&65535)
    ||visit.dispatch.all_byte_opcode_targets[opcode].target!==cpuLabel(entry))throw Error('Original truth/alias target drift');
  return {opcode,word_source:cpuLabel(pc),target:cpuLabel(entry),machine_bytes:raw.toString('hex').toUpperCase(),sha256:sha(raw)};
});
const report={rom_sha256:metadata.rom_sha256,progress_reference:'docs/PORTIERUNGSSTAND.json',
  processor_reference:{url:'https://www.westerndesigncenter.com/wdc/documentation/w65c816s.pdf',edition:'March 13, 2024',
    sections:['3.5.22/3.5.23/7.1 bank00 native stack/stack-relative offsets','Table5-7 WORD PLA low/high and WORD stack-relative read/store low/high',
      'Table5-5 CMP sets N/Z/C, leaves V; LDA/LDX/PLA/DEX/INX/TXA affect N/Z only; BEQ/BNE test Z',
      'CMP compares binary regardless of decimal flag; C1 iff accumulator>=operand','3.5.13/7.2/7.9 fresh DP indexed fetch and programbank jump'],
    qualification:'Processor instruction address/data/flag semantics only; no SNES device, timing, interrupt or scene evidence.'},
  scope:'Complete JMP-entered F8BF/F843/F87F sources including BE/AA/B0/B2/B8 opcode aliases through fresh F389 to dynamic F390. Boolean zero/no-store and fullWORD compare paths, actual CMP Carry and ordered byte equations only; no CPU/memory/task/native/device execution.',
  windows:[...roots,fetch].map(describe),dependencies:[{report:'analysis/render-task-negate-shifts.json',window:previous.windows.find(w=>w.name==='fetchF389')},
    {report:'analysis/render-c1ca.json',window:interpreter,opcode_source_sha256:visit.dispatch.opcode_source.sha256}],
  dispatch_entries,source_graph:{source_closed_to_dispatch:true,full_graph_closed:false,native_binding:false,code_bytes:52,instructions:map.size,
    minimum_protected_stack_bytes:null,qualification:'52/26 deduplicated source; BooleanS0, Equal/NotEqualS+2. Six finite branch paths; no root JSR/global interpreter return proof.'},
  truth:roots.map(b=>proveTruthToDispatch(map,b.entry)),
  synthetic_address_examples:[
    ['Boolean zero has no operand write',{entry:0x80F8BF,d:0x3D6,bank:0x9D,s:0x1FFF,y:0,pointerAfter:0xA001,value:0,incomingCarry:1}],
    ['Boolean nonzero overwrites fresh pointer',{entry:0x80F8BF,d:0x3D6,bank:0x80,s:0x3D5,y:4,pointerAfter:0xFFFF,value:0x100,incomingCarry:0}],
    ['Equal wraps bank00 left result',{entry:0x80F843,d:0xFFFF,bank:0xFF,s:0xFFFC,y:1,pointerAfter:0xFFFF,left:0x8000,right:0x8000}],
    ['NotEqual has unavailable writable left byte',{entry:0x80F87F,d:0x3D6,bank:0x9D,s:0x1FFD,y:0,pointerAfter:0xA001,left:1,right:0}]
  ].map(([name,context])=>({name,...describeTruthByteOwners(context)})),
  contract:{
    entry:'Actual opcode JMP in programbank80, E0M0X0, actual payloadD/DBR/operandS/WORD-Y and intact code/outerstack. A/X have no incoming payload assumptions. No root JSR/underflow/capacity/parity guards. Byte windows are operand needs, not global protected stack minima.',
    boolean:'BE targets F8BF. WORDLDA01,S reads full originaltop at bank00:S+1/+2 low/high without changing S. BEQ on LDA Z jumps to F8C8 iff fullWORD==0000: no LDAFFFF or STA, no writable operandbytes required. Every nonzeroWORD, including0100/8000/FFFF, loadsFFFF and WORDSTA01,S overwrites originaltop low/high; exactly two readable/two writable operandbytes. S unchanged on both paths; no PLA/PHA/STZ.',
    compare:'AA/B0 both target F843; B2/B8 both target F87F. WORDLDX0000 (equal) orFFFF (notEqual), WORDPLA right low/high at originalS+1/+2 then S+2, WORDCMP01,S reads left at originalS+3/+4. A remainsright. BNE consumes actualCMP Z, skipping DEX/INX iff right!=left. Equal path WORDDEX0000->FFFF or WORDINXFFFF->0000. TXA/WORDSTA01,S always overwrites left low/high, including already-equal resultbytes. FinalS+2; four readable/two writable existingleftbytes, no resultPHA.',
    values_flags:'Boolean yieldsFFFF iff fulltop!=0, zero preserved withoutstore; incomingC preserved. Equal yieldsFFFF iff fullleft==right, NotEqual iff different. Comparisons leave C1 iff unsignedright>=left, including equalityC1; Carry is not truthresult nor left>=right, and ignores incomingC/decimal. CMP updates N/Z/C only, keeps A/V; DEX/INX/TXA/STA/fetch preserve comparisonC. All preserve V/I/decimal, no CLD/binary-only premise. Final N/Z from nextopcode, not localtruth/CMP. PayloadD is separate from statusdecimal.',
    addressing:'All operand PLA/LDA/CMP/STA bytes stay bank00 independently ofD/DBR; byteaddresses and S wrap16bits. Comparison uses currentS afterPLA+2. Reads/stores low/high. Boolean has no S movement; no extra protected returnstack bytes or global underflow proof.',
    fetch:'Both branch paths JMPactualF389; after both stores when present, zeroBoolean after fulltopread withoutstore. Freshbank00:D/(D+1)&FFFF pointer and fullWORD at((DBR<<16)+pointer+incomingY)&FFFFFF including ignoredhigh, INY/AND00FF/TAX/JMP(80:F2B4+X). FinalY=(entryY+1)&FFFF,A/X=freshopcodeLow,N0/Z(low==0); D/DBR/V/I/decimal preserved, C from actual path. No ASL/parity/ID clamp; actual nexttarget/tablebyte sources required.',
    aliases:'Resultstores can overlap physical DPpointer/frame/cursor/control/savedouterS or nextopcodebytes. Full operandreads precede stores, then freshpointer/data; no cached pointer/value. Boolean zero needs no operandwriteowner but still requires independent fresh DP/opcode owners even if they alias topbytes. Intact code/outer-returnstack and real byte owners required; destructive aliases not approved, no automatic frame7 rewrite or original initialization.',
    host_boundary:'compileScriptFrame has bounded normalizedWORDarrays/underflowguards. Boolean host replaceTop writes zero too; original zero path does no store. Comparisons model truthvalues/aliases but no actual CMP Carry/S/D/DBR or physical PLA/CMP/STA/refetch. HostPC before nextopcode, original F390-Y after; ignoredopcodeHigh absent. Synthetic hostvalue comparisons are data consequences only, not original task/CPU/device/scene evidence.',
    boundaries:'Three local sources close only to actual dynamicdispatch. Physical taskbyte bridge, original initialization, further opcode/native/stackmigration/return contracts separate. FullC1CA/9178/BF3B/native/globalstack remain open.'}};
await writeFile('analysis/render-task-truth.json',JSON.stringify(report,null,2)+'\n');
await writeFile('analysis/render-task-truth.asm.txt',`; European ROM SHA-256 ${metadata.rom_sha256}\n; JMP-entered WORD truth/compare sources and fresh fetch. Dynamic dispatch/full return OPEN; no CPU execution.\n\n`+[...roots,fetch].map(formatBlock).join('\n'));
console.log(`Task truth52/${map.size}; six branch paths, Boolean zero no-store, actual rightCMPleft Carry; full dynamic graph OPEN.`);
