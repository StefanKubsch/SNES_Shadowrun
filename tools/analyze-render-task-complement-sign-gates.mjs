import {readFile,writeFile} from 'node:fs/promises';
import {taskInterpreterSource} from './task-interpreter-source.mjs';
import {createHash} from 'node:crypto';
import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {decode,formatBlock} from './disassemble.mjs';
import {scriptOpcodes} from '../src/script/opcodes.mjs';
import {proveComplementSignGatesToDispatch,describeComplementSignGateByteOwners} from './render-task-complement-sign-gates-source-proof.mjs';
const {bytes,metadata}=inspectRom(await readFile(process.argv[2]??'Shadowrun (E).smc'));
if(metadata.rom_sha256!=='91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690')throw Error('Wrong European ROM revision');
const sha=b=>createHash('sha256').update(b).digest('hex');
function block(name,entry,end){const instructions=[];for(let pc=entry;pc<end;){const i=decode(bytes,pc,{e:0,m:0,x:0});if(i.next>end)throw Error('Source window overflow');instructions.push(i);pc=i.next;}
  return {name,entry,initialState:{e:0,m:0,x:0},instructions,stop:'Complete fixed WORD source to actual dynamic F390; no interpreter/native return inferred.'};}
const describe=b=>{const raw=Buffer.concat(b.instructions.map(i=>i.raw));return {name:b.name,entry:cpuLabel(b.entry),end_exclusive:cpuLabel(b.instructions.at(-1).next),covered_bytes:raw.length,instruction_count:b.instructions.length,sha256:sha(raw),machine_bytes:raw.toString('hex').toUpperCase()};};
// Later F7F8/F83D trampolines are not reachable from these handler entries.
const roots=[block('gate9cF7CB',0x80F7CB,0x80F7E7),block('gate9eF7E7',0x80F7E7,0x80F7F8),block('gateA4F80E',0x80F80E,0x80F82B),block('gateA6F82B',0x80F82B,0x80F83D)];
const fetch=block('fetchF389',0x80F389,0x80F393),map=new Map([...roots,fetch].flatMap(b=>b.instructions.map(i=>[i.cpu,i])));
const previous=JSON.parse(await readFile('analysis/render-task-carry-sign-gates.json','utf8')),visit=taskInterpreterSource(bytes);
const interpreter=visit.windows.find(w=>w.name==='interpreterF378');
if([previous,visit].some(r=>r.rom_sha256!==metadata.rom_sha256)||previous.windows.find(w=>w.name==='fetchF389').machine_bytes!==describe(fetch).machine_bytes
  ||interpreter.machine_bytes.slice(34)!==describe(fetch).machine_bytes)throw Error('Actual shared fetch source drift');
const dispatch_entries=[[0x9C,0x80F7CB],[0x9E,0x80F7E7],[0xA4,0x80F80E],[0xA6,0x80F82B]].map(([opcode,entry])=>{
  const pc=0x80F2B4+opcode,off=cpuToOffset(pc,bytes.length),raw=bytes.subarray(off,off+2);
  if(raw.readUInt16LE()!==(entry&65535)||scriptOpcodes[opcode]?.handler!==(entry&65535)
    ||visit.dispatch.all_byte_opcode_targets[opcode].target!==cpuLabel(entry))throw Error('Original complement sign gate target drift');
  return {opcode,word_source:cpuLabel(pc),target:cpuLabel(entry),machine_bytes:raw.toString('hex').toUpperCase(),sha256:sha(raw)};
});
const report={rom_sha256:metadata.rom_sha256,progress_reference:'docs/PORTIERUNGSSTAND.json',processor_reference:{...previous.processor_reference,
    sections:previous.processor_reference.sections.map(s=>s.replace('BCS C1','BCC C0'))},
  scope:'Complete JMP-entered original9C/F7CB 9E/F7E7 A4/F80E A6/F82B sources through fresh F389 to dynamic F390. Actual sign gates before optional DEC A, fresh CMP Carry/BCC, negative right directly TXA without INX/leftread. No conventional comparison operator or CPU/memory/task/native/device execution inferred.',
  windows:[...roots,fetch].map(describe),dependencies:[{report:'analysis/render-task-carry-sign-gates.json',window:previous.windows.find(w=>w.name==='fetchF389')},
    {report:'analysis/render-c1ca.json',window:interpreter,opcode_source_sha256:visit.dispatch.opcode_source.sha256}],dispatch_entries,
  source_graph:{source_closed_to_dispatch:true,full_graph_closed:false,native_binding:false,code_bytes:102,instructions:map.size,
    minimum_protected_stack_bytes:null,qualification:'102/53 deduplicated source, twelve finite paths allS+2. LaterF7F8/F83D trampolines excluded as unreachable; no root JSR/global interpreter return proof.'},
  complement_sign_gates:roots.map(b=>proveComplementSignGatesToDispatch(map,b.entry)),
  synthetic_address_examples:[
    ['9C negative left skips CMP and writes0000',{entry:0x80F7CB,d:0x3D6,bank:0x9D,s:0x3F0,y:4,pointerAfter:0xA001,leftGateWord:0x8000,right:0,incomingCarry:1}],
    ['9E negative right reads no left but writesFFFF',{entry:0x80F7E7,d:0x3D6,bank:0x80,s:0x1FFD,y:0,pointerAfter:0xA001,right:0x8000,incomingCarry:0}],
    ['A4 fresh CMP differs from left sign gate',{entry:0x80F80E,d:0x3D6,bank:0x80,s:0x3D3,y:4,pointerAfter:0xFFFF,leftGateWord:0,leftCompareWord:0xFFFF,right:1}],
    ['A6 rightzero wraps DEC but does not repeat BMI',{entry:0x80F82B,d:0xFFFF,bank:0xFF,s:0xFFFC,y:1,pointerAfter:0,right:0,leftCompareWord:0xFFFF}]
  ].map(([name,context])=>({name,...describeComplementSignGateByteOwners(context)})),
  contract:{
    entry:'Actual opcode JMP in programbank80, E0M0X0, actual payloadD/DBR/operandS/WORD-Y, intact code/outerstack and real byte owners. IncomingA/X have no assumptions. No root JSR/underflow/capacity/parity/ID guards. Distinct fresh gate/CMP WORDreads supplied explicitly, not cached.',
    left_gate:'9C/A4 WORDLDA03,S first reads left low/high at entryS+3/+4; BPL tests its actual N. Negative leftGateWORD: right WORDPLA low/high and S+2, LDA0000, STA01,S writes left low/high. No LDX/DEC/CMP/INX/TXA, entryX unchanged until fetch, incomingCarry preserved. Nonnegative gate: LDXFFFF/rightPLA, optionalDEC A onlyA4, then separate freshleftCMP01,S. leftCompareWORD need not equal leftGateWORD. Six read accesses on four unique bytes when compared.',
    right_gate:'9E/A6 LDXFFFF/right WORDPLA andS+2, BMI tests actual original right N BEFORE anyDEC. Negative right jumps directly to TXA/STA retainingXFFFF: resultFFFF, incomingCarry preserved, noINX/DEC/CMP/leftread. Two readable rightbytes but mandatory two writable leftbytes. Nonnegative right: A6 DEC A then freshleftCMP; 9E freshCMP withoutDEC. No second sign gate on decremented A.',
    compared:'BCC skipsINX iff actual freshCMP C0; C1 INXFFFF->0000. A=(originalright-1) modulo65536 atA4/A6, originalright at9C/9E. CMP C1 iff unsignedA>=freshleftCompareWORD, ignoresincomingCarry/decimal andpreservesA/V. Compared resultFFFF iffC0, else0000. Originalright0000 passesA6 BMI, becomesFFFF, compares andreturns0000/C1 for EVERYfreshleft; negativeA4 leftgate skipsDEC. Originalright8000 becomes7FFF onlyonA4 compared path; A6 BMI instead skipsDEC/CMP/INX andreturnsFFFF. No saturation/right>left/signedoperator rewrite.',
    relation_to_previous:'Under identical explicit originalright, leftGateWORD/freshleftCompareWORD and incomingCarry observations, 9C pairs94, 9E pairs96, A4 pairs8C and A6 pairs8E: resultWORD complements0000/FFFF and actualCarry is identical. Corresponding compared BCC/BCS decisions differ; no-CMP left immediates differ and right negative bypasses versus executes INX. Data consequence only, not a familiar comparison operator or runtime pairing assumption.',
    flags_stack:previous.contract.flags_stack,
    addressing:previous.contract.addressing,
    fetch:previous.contract.fetch,
    aliases:previous.contract.aliases,
    host_boundary:'compileScriptFrame rejects original9C/9E/A4/A6 asnotimplemented beforestep/stateeffects. No runtime changes/opcode renaming/native promotion. Pure WORD/address examples explicitlysynthetic, not machine/task/device/scene evidence.',
    boundaries:'Local sources closeonlytoactualdynamicdispatch. Physical taskbyte bridge, originalinitialization, local/state reads andwrites, furtheropcode/native/stackmigration/return contracts separate. FullC1CA/9178/BF3B/native/globalstack remainopen.'}};
await writeFile('analysis/render-task-complement-sign-gates.json',JSON.stringify(report,null,2)+'\n');
await writeFile('analysis/render-task-complement-sign-gates.asm.txt',`; European ROM SHA-256 ${metadata.rom_sha256}\n; Actual original sign/BCC gates and optional DEC A, negative right TXA, fresh fetch. Dynamic dispatch/full return OPEN; no CPU execution.\n\n`+[...roots,fetch].map(formatBlock).join('\n'));
console.log(`Task complement sign gates102/${map.size}; twelve paths, sign beforeDEC, negative rightTXA/noCMP; full dynamic graph OPEN.`);
