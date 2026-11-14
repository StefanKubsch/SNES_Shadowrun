import {readFile,writeFile} from 'node:fs/promises';
import {taskInterpreterSource} from './task-interpreter-source.mjs';
import {createHash} from 'node:crypto';
import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {decode,formatBlock} from './disassemble.mjs';
import {scriptOpcodes} from '../src/script/opcodes.mjs';
import {proveCarryCompareToDispatch,describeCarryCompareByteOwners} from './render-task-carry-compare-source-proof.mjs';
const {bytes,metadata}=inspectRom(await readFile(process.argv[2]??'Shadowrun (E).smc'));
if(metadata.rom_sha256!=='91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690')throw Error('Wrong European ROM revision');
const sha=b=>createHash('sha256').update(b).digest('hex');
function block(name,entry,end){const instructions=[];for(let pc=entry;pc<end;){const i=decode(bytes,pc,{e:0,m:0,x:0});if(i.next>end)throw Error('Source window overflow');instructions.push(i);pc=i.next;}
  return {name,entry,initialState:{e:0,m:0,x:0},instructions,stop:'Complete fixed WORD source to actual dynamic F390; no interpreter/native return inferred.'};}
const describe=b=>{const raw=Buffer.concat(b.instructions.map(i=>i.raw));return {name:b.name,entry:cpuLabel(b.entry),end_exclusive:cpuLabel(b.instructions.at(-1).next),covered_bytes:raw.length,instruction_count:b.instructions.length,sha256:sha(raw),machine_bytes:raw.toString('hex').toUpperCase()};};
const roots=[block('compare8aF735',0x80F735,0x80F745),block('compare92F77A',0x80F77A,0x80F789),block('compare9aF7BC',0x80F7BC,0x80F7CB),block('compareA2F7FE',0x80F7FE,0x80F80E)];
const fetch=block('fetchF389',0x80F389,0x80F393),map=new Map([...roots,fetch].flatMap(b=>b.instructions.map(i=>[i.cpu,i])));
const previous=JSON.parse(await readFile('analysis/render-task-compare-gates.json','utf8')),visit=taskInterpreterSource(bytes);
const interpreter=visit.windows.find(w=>w.name==='interpreterF378');
if([previous,visit].some(r=>r.rom_sha256!==metadata.rom_sha256)||previous.windows.find(w=>w.name==='fetchF389').machine_bytes!==describe(fetch).machine_bytes
  ||interpreter.machine_bytes.slice(34)!==describe(fetch).machine_bytes)throw Error('Actual shared fetch source drift');
const dispatch_entries=[[0x8A,0x80F735],[0x92,0x80F77A],[0x9A,0x80F7BC],[0xA2,0x80F7FE]].map(([opcode,entry])=>{
  const pc=0x80F2B4+opcode,off=cpuToOffset(pc,bytes.length),raw=bytes.subarray(off,off+2);
  if(raw.readUInt16LE()!==(entry&65535)||scriptOpcodes[opcode]?.handler!==(entry&65535)
    ||visit.dispatch.all_byte_opcode_targets[opcode].target!==cpuLabel(entry))throw Error('Original carry compare target drift');
  return {opcode,word_source:cpuLabel(pc),target:cpuLabel(entry),machine_bytes:raw.toString('hex').toUpperCase(),sha256:sha(raw)};
});
const report={rom_sha256:metadata.rom_sha256,progress_reference:'docs/PORTIERUNGSSTAND.json',
  processor_reference:{url:'https://www.westerndesigncenter.com/wdc/documentation/w65c816s.pdf',edition:'March 13, 2024',
    sections:['3.5.22/3.5.23/7.1 bank00 native stack/stack-relative offsets','Table5-7 WORD PLA low/high and WORD stack-relative read/store low/high',
      'Table5-5 WORD DEC A/INX/DEX change N/Z only, preserve C/V/decimal; CMP sets N/Z/C and preserves A/V',
      'Table5-1 BCS C1 and BCC C0; 3.5.21 actual signed relative targets',
      'CMP ignores decimal/incomingCarry; C1 iff accumulator>=operand','3.5.13/7.2/7.9 fresh DP indexed fetch and programbank jump'],
    qualification:'Processor instruction address/data/flag semantics only; no SNES device, timing, interrupt or scene evidence.'},
  scope:'Complete JMP-entered original8A/F735 92/F77A 9A/F7BC A2/F7FE sources through fresh F389 to dynamic F390. WORD DEC A wrap, actual unsigned CMP Carry and BCS/BCC paths only; no familiar comparison operator or CPU/memory/task/native/device execution inferred.',
  windows:[...roots,fetch].map(describe),dependencies:[{report:'analysis/render-task-compare-gates.json',window:previous.windows.find(w=>w.name==='fetchF389')},
    {report:'analysis/render-c1ca.json',window:interpreter,opcode_source_sha256:visit.dispatch.opcode_source.sha256}],dispatch_entries,
  source_graph:{source_closed_to_dispatch:true,full_graph_closed:false,native_binding:false,code_bytes:72,instructions:map.size,
    minimum_protected_stack_bytes:null,qualification:'72/39 deduplicated source; eight finite branch paths, allS+2. DEC in A only, no saturation/signed rewrite. No root JSR/global interpreter return proof.'},
  carry_compare:roots.map(b=>proveCarryCompareToDispatch(map,b.entry)),
  synthetic_address_examples:[
    ['8A rightzero becomesFFFF before compare',{entry:0x80F735,d:0x3D6,bank:0x9D,s:0x3F0,y:4,pointerAfter:0xA001,right:0,left:65535}],
    ['92 leftstore overwrites freshpointer',{entry:0x80F77A,d:0x3D6,bank:0x80,s:0x3D3,y:4,pointerAfter:0xFFFF,right:65535,left:1}],
    ['9A requires real writable leftbytes',{entry:0x80F7BC,d:0x3D6,bank:0x80,s:0x1FFD,y:0,pointerAfter:0xA001,right:0,left:1}],
    ['A2 leftbytes wrap bank00 independently ofDBR',{entry:0x80F7FE,d:0xFFFF,bank:0xFF,s:0xFFFC,y:1,pointerAfter:0xFFFF,right:0x8000,left:0x7FFF}]
  ].map(([name,context])=>({name,...describeCarryCompareByteOwners(context)})),
  contract:{
    entry:'Actual original opcode JMP in programbank80, E0M0X0, actual payloadD/DBR/operandS/WORD-Y, intact code/outerstack and real byte owners. IncomingA/X have no payload assumptions. No root JSR/underflow/capacity/parity/ID guards. Actual fresh WORD sources required.',
    operands:'All four WORDLDXFFFF exceptA2 LDX0000. WORDPLA reads originalright atentryS+1/+2 low/high, raisesS2. 8A/A2 then WORDDEC A modifiesA only, not originalrightbytes. WORDCMP01,S reads freshleft atoriginalS+3/+4 usingcurrentS+2. A isoriginalright for92/9A, (originalright-1) modulo65536 for8A/A2. Full operands includinghighbytes; no gates skipCMP orleftread.',
    gates:'8A/92 BCS skipINX iffactualCMP Carry1; Carry0 INXFFFF->0000. 9A BCC skipINX iffCarry0; Carry1 INXFFFF->0000. A2 BCC skipDEX iffCarry0, retainsX0000; Carry1 DEX0000->FFFF. TXA/WORDSTA01,S always overwritesexisting leftbytes low/high, even samevalue. FinalS+2, rightremoved/leftreplaced, fourreadable/twowritable operandbytes; noPHA/resultpush.',
    values_flags:'ComparedrightW isright for92/9A or(right-1) modulo65536 for8A/A2. CMP C1 iffunsignedW>=freshleft, ignoresincomingC/decimal andpreservesA/V. ResultFFFF iffC1 for8A/92/A2, iffC0 for9A. 8A/A2 originalright0000->WFFFF andC1 forEVERYleft, resultFFFF; originalright8000->7FFF withoutVchange. No saturation/signedcomparison/right>left simplification; DEC isnotSBC. All preserveV/I/decimal, noCLD/binary-onlypremise. Carry survivesindexupdate/TXA/STA/fetch. FinalN/Z andX fromfreshopcode, nottruth/CMP. PayloadD separate fromstatusdecimal.',
    addressing:'PLA/CMP/STA operands staybank00 independentlyofD/DBR; byteaddresses andS wrap16bits. DEC A addsno memoryaccess orrightbytewrite. LeftCMP/store usescurrentS afterPLA. Four readable/two writable operandbytes are not global protected stack minima; noautomaticframe7 ororiginalinitialization supplied.',
    fetch:'BothCarrypaths JMPactualF389 afterbothleft stores. Freshbank00:D/(D+1)&FFFF pointer andfullWORD at((DBR<<16)+pointer+incomingY)&FFFFFF includingignoredhigh, INY/AND00FF/TAX/JMP(80:F2B4+X). FinalY=(entryY+1)&FFFF,A/X=opcodeLow,N0/Z(low==0); D/DBR/V/I/decimal preserved,C actualCMP. NoASL/parity/IDclamp; actualtarget/tableWORD/nextbody remainrequired.',
    aliases:'FullrightPLA andfreshleftCMPreads precedebothleftstores; freshpointer/data afterstores. Leftwrites canphysicallyalias DPpointer/frame/cursor/control/savedouterS ornextopcodebytes. DEC A changesregisteronly, neverwrites poppedright. Intact code/outer-returnstack andactualread/writeowners required; no destructivealias authorization ormemoryopening.',
    host_boundary:'compileScriptFrame intentionally rejects original8A/92/9A/A2 asnotimplemented beforestep/stateeffects. No opcode renaming/executable promotion orruntime changes. Pure WORD/address examples are explicitlysynthetic equations, not machine/task/device/scene evidence.',
    boundaries:'Four local sources closeonlytoactualdynamicdispatch. Physical taskbyte bridge, originalinitialization, furtheropcode/native/stackmigration/return contracts separate. FullC1CA/9178/BF3B/native/globalstack remainopen.'}};
await writeFile('analysis/render-task-carry-compare.json',JSON.stringify(report,null,2)+'\n');
await writeFile('analysis/render-task-carry-compare.asm.txt',`; European ROM SHA-256 ${metadata.rom_sha256}\n; Original WORD carry comparisons, DEC A wrap retained, fresh fetch. Dynamic dispatch/full return OPEN; no CPU execution.\n\n`+[...roots,fetch].map(formatBlock).join('\n'));
console.log(`Task carry compare72/${map.size}; eight branch paths, actualDECwrap/CMP Carry, allS+2; full dynamic graph OPEN.`);
