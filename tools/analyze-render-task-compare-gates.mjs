import {readFile,writeFile} from 'node:fs/promises';
import {taskInterpreterSource} from './task-interpreter-source.mjs';
import {createHash} from 'node:crypto';
import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {decode,formatBlock} from './disassemble.mjs';
import {scriptOpcodes} from '../src/script/opcodes.mjs';
import {proveCompareGatesToDispatch,describeCompareGateByteOwners} from './render-task-compare-gates-source-proof.mjs';
const {bytes,metadata}=inspectRom(await readFile(process.argv[2]??'Shadowrun (E).smc'));
if(metadata.rom_sha256!=='91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690')throw Error('Wrong European ROM revision');
const sha=b=>createHash('sha256').update(b).digest('hex');
function block(name,entry,end){const instructions=[];for(let pc=entry;pc<end;){const i=decode(bytes,pc,{e:0,m:0,x:0});if(i.next>end)throw Error('Source window overflow');instructions.push(i);pc=i.next;}
  return {name,entry,initialState:{e:0,m:0,x:0},instructions,stop:'Complete fixed WORD source to actual dynamic F390; no interpreter/native return inferred.'};}
const describe=b=>{const raw=Buffer.concat(b.instructions.map(i=>i.raw));return {name:b.name,entry:cpuLabel(b.entry),end_exclusive:cpuLabel(b.instructions.at(-1).next),covered_bytes:raw.length,instruction_count:b.instructions.length,sha256:sha(raw),machine_bytes:raw.toString('hex').toUpperCase()};};
const roots=[block('acF852',0x80F852,0x80F86E),block('aeF86E',0x80F86E,0x80F87F),block('b4F88E',0x80F88E,0x80F8AA),block('b6F8AA',0x80F8AA,0x80F8BB)];
const fetch=block('fetchF389',0x80F389,0x80F393),map=new Map([...roots,fetch].flatMap(b=>b.instructions.map(i=>[i.cpu,i])));
const previous=JSON.parse(await readFile('analysis/render-task-truth.json','utf8')),visit=taskInterpreterSource(bytes);
const interpreter=visit.windows.find(w=>w.name==='interpreterF378');
if([previous,visit].some(r=>r.rom_sha256!==metadata.rom_sha256)||previous.windows.find(w=>w.name==='fetchF389').machine_bytes!==describe(fetch).machine_bytes
  ||interpreter.machine_bytes.slice(34)!==describe(fetch).machine_bytes)throw Error('Actual shared fetch source drift');
const dispatch_entries=[[0xAC,0x80F852],[0xAE,0x80F86E],[0xB4,0x80F88E],[0xB6,0x80F8AA]].map(([opcode,entry])=>{
  const pc=0x80F2B4+opcode,off=cpuToOffset(pc,bytes.length),raw=bytes.subarray(off,off+2);
  if(raw.readUInt16LE()!==(entry&65535)||scriptOpcodes[opcode]?.handler!==(entry&65535)
    ||visit.dispatch.all_byte_opcode_targets[opcode].target!==cpuLabel(entry))throw Error('Original compare gate target drift');
  return {opcode,word_source:cpuLabel(pc),target:cpuLabel(entry),machine_bytes:raw.toString('hex').toUpperCase(),sha256:sha(raw)};
});
const report={rom_sha256:metadata.rom_sha256,progress_reference:'docs/PORTIERUNGSSTAND.json',
  processor_reference:{url:'https://www.westerndesigncenter.com/wdc/documentation/w65c816s.pdf',edition:'March 13, 2024',
    sections:['3.5.22/3.5.23/7.1 bank00 native stack/stack-relative offsets','Table5-7 WORD PLA low/high and WORD stack-relative read/store low/high',
      'Table5-1 BMI is Branch if Result Minus N1; BPL N0; Table5-5 page32 BMI N0 is an inconsistent label, not used',
      'Table5-5 CMP changes N/Z/C only; PLA/LDA/LDX/DEX/INX/TXA N/Z; BEQ/BNE test CMP Z',
      '3.5.21 relative target is PC after branch operand plus signed displacement; BEQ00 taken/fallthrough equal',
      'CMP ignores decimal/incomingCarry; C1 iff accumulator>=operand','3.5.13/7.2/7.9 fresh DP indexed fetch and programbank jump'],
    qualification:'Processor instruction address/data/flag semantics only; no SNES device, timing, interrupt or scene evidence.'},
  scope:'Complete JMP-entered AC/F852 AE/F86E B4/F88E B6/F8AA sources through fresh F389 to dynamic F390. Actual sign gates, path-dependent fresh WORDreads/CMP Carry and original AE BEQ00 retained; no familiar comparison operator or CPU/memory/task/native/device execution inferred.',
  windows:[...roots,fetch].map(describe),dependencies:[{report:'analysis/render-task-truth.json',window:previous.windows.find(w=>w.name==='fetchF389')},
    {report:'analysis/render-c1ca.json',window:interpreter,opcode_source_sha256:visit.dispatch.opcode_source.sha256}],dispatch_entries,
  source_graph:{source_closed_to_dispatch:true,full_graph_closed:false,native_binding:false,code_bytes:100,instructions:map.size,
    minimum_protected_stack_bytes:null,qualification:'100/51 deduplicated source; twelve branch lemmas, allS+2. AE compared equality/inequality paths have same PCs but distinct CMP Z/branch outcomes. No root JSR/global interpreter return proof.'},
  compare_gates:roots.map(b=>proveCompareGatesToDispatch(map,b.entry)),
  synthetic_address_examples:[
    ['AC negative left gate consumes right without fresh compare',{entry:0x80F852,d:0x3D6,bank:0x9D,s:0x3F0,y:4,pointerAfter:0xA001,leftGateWord:0x8000,right:0x1234,incomingCarry:1}],
    ['AE negative right needs no readable left before mandatory write',{entry:0x80F86E,d:0x3D6,bank:0x80,s:0x1FFD,y:0,pointerAfter:0xA001,right:0x8000,incomingCarry:0}],
    ['B4 gate and compare read same bytes with separate fresh WORDs',{entry:0x80F88E,d:0x3D6,bank:0x80,s:0x3D3,y:4,pointerAfter:0xFFFF,leftGateWord:0,leftCompareWord:2,right:1}],
    ['B6 compared left bytes wrap separately in bank00',{entry:0x80F8AA,d:0xFFFF,bank:0xFF,s:0xFFFC,y:1,pointerAfter:0xFFFF,right:0x7FFF,leftCompareWord:0xFFFF}]
  ].map(([name,context])=>({name,...describeCompareGateByteOwners(context)})),
  contract:{
    entry:'Actual original opcode JMP in programbank80, E0M0X0, actual payloadD/DBR/operandS/WORD-Y, intact code/outerstack and real byte owners. No root JSR, underflow/capacity/parity/ID guards. Distinct fresh read values supplied explicitly, not cached, paired or inferred from sign gate.',
    left_gate:'AC/B4 first WORDLDA03,S reads originalleft at S+3/+4 low/high, then BPL on actualLDA N. Negative leftGateWORD: WORDPLA reads right S+1/+2, S+2; immediate0000 forAC orFFFF forB4; STA01,S overwrites left low/high. No CMP, incomingCarry preserved, four unique readable/two writable operandbytes. Nonnegative leftGateWORD: LDX0000/FFFF, PLA right, freshCMP01,S rereads same originalleft bytes afterS+2. Six byte read accesses on four unique bytes. leftCompareWORD is a new fullWORD observation, not necessarily leftGateWORD.',
    right_gate:'AE/B6 LDX0000/FFFF then WORDPLA reads right low/high and increasesS2. BMI consumes actualPLA N, not earlierLDX N. Negative rightWORD jumps directly toTXA/STA: AE result0000, B6FFFF, incomingCarry preserved. No left LDA/CMP/read, but left still requires two writable bytes at originalS+3/+4; only two readable rightbytes. Nonnegative right always reads fresh full leftCMPWORD; four readable/two writable bytes.',
    compared:'CMP compares actual right inA against freshleftCompareWORD; C1 iff unsignedright>=freshleft, ignores incomingCarry/decimal, preservesA/V. AC BEQ skipsDEX only ifequal: equal0000/differentFFFF. B4/B6 BNE skipsINX ifdifferent: equal0000/differentFFFF. AE BEQ00 atF876 targetsF878 exactly equal tofallthrough: bothCMP-Z cases executeWORDDEX0000->FFFF. AE nonnegative right alwaysFFFF, includingequal0/0; no correcting original branch or naming it conventional equality/ordering.',
    flags_stack:'All paths execute exactly one rightWORDPLA and mandatoryWORDSTAleft low/high underfinalS+2; noPHA/resultpush. Skipped CMP preserves actualentryCarry; compared paths retainCMP Carry throughLDX/DEX/INX/TXA/STA/fetch. V/I/decimal alwayspreserved, noCLD/binary-onlypremise. PayloadD separate fromstatusdecimal. Final N/Z andX are freshnextopcode, not sign/truth/CMP result. Two/four unique readablebytes and two writableleftbytes are operand needs, not global protected stack minima.',
    addressing:'All PLA/LDA/CMP/STA operands bank00 independently ofD/DBR; byteaddresses andS wrap16bits. AC/B4 gate usesentryS+3, compare/store usecurrentS+2 plus1. AE/B6 rightnegative path does not requireleft readowner even thoughleft writeowner ismandatory. Real source stability/chronology and byteowners remain explicit; no memory opening or destructive alias authorization.',
    fetch:'All twelve path lemmas reachactualF389 afterbothleft stores. Freshbank00:D/(D+1)&FFFF pointer andfullWORD at((DBR<<16)+pointer+incomingY)&FFFFFF includingignoredhigh, INY/AND00FF/TAX/JMP(80:F2B4+X). FinalY=(entryY+1)&FFFF,A/X=opcodeLow,N0/Z(low==0); D/DBR/V/I/decimal preserved,C actualpath. No ASL/parity/ID clamp; actualtarget/tableWORD/nextbody remain required.',
    aliases:'Left resultstores canphysicallyalias DPpointer/frame/cursor/control/savedouterS ornextopcodebytes. All gate/right/freshCMPreads actuallypresent onselectedpath precedebothstores; nextpointer/data readfreshafterstores. OmittedleftCMP isnot omittedleftwrite or futureDP/opcodeownership. Intact code/outer-returnstack andactualread/writeowners required; noautomaticframe7 store/initialization supplied.',
    host_boundary:'compileScriptFrame intentionally rejects originalAC/AE/B4/B6 asnotimplemented beforestep/stateeffects. No opcode renaming/executable promotion or runtime changes. Pure WORD/address examples are explicitlysynthetic equations, not machine/task/device/scene evidence.',
    boundaries:'Four local sources closeonlytoactualdynamicdispatch. Physical taskbyte bridge, originalinitialization, furtheropcode/native/stackmigration/return contracts separate. FullC1CA/9178/BF3B/native/globalstack remainopen.'}};
await writeFile('analysis/render-task-compare-gates.json',JSON.stringify(report,null,2)+'\n');
await writeFile('analysis/render-task-compare-gates.asm.txt',`; European ROM SHA-256 ${metadata.rom_sha256}\n; Original sign/compare gates, AE BEQ00 retained, fresh fetch. Dynamic dispatch/full return OPEN; no CPU execution.\n\n`+[...roots,fetch].map(formatBlock).join('\n'));
console.log(`Task compare gates100/${map.size}; twelve branch lemmas, originalAE BEQ00, allS+2; full dynamic graph OPEN.`);
