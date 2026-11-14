import {readFile,writeFile} from 'node:fs/promises';
import {taskInterpreterSource} from './task-interpreter-source.mjs';
import {createHash} from 'node:crypto';
import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {decode,formatBlock} from './disassemble.mjs';
import {scriptOpcodes} from '../src/script/opcodes.mjs';
import {proveConsumerToDispatch,describeConsumerByteOwners} from './render-task-consumers-source-proof.mjs';
const {bytes,metadata}=inspectRom(await readFile(process.argv[2]??'Shadowrun (E).smc'));
if(metadata.rom_sha256!=='91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690')throw Error('Wrong European ROM revision');
const sha=b=>createHash('sha256').update(b).digest('hex');
function block(name,entry,end){const instructions=[];for(let pc=entry;pc<end;){const i=decode(bytes,pc,{e:0,m:0,x:0});if(i.next>end)throw Error('Source window overflow');instructions.push(i);pc=i.next;}
  return {name,entry,initialState:{e:0,m:0,x:0},instructions,stop:'Complete fixed WORD source to actual dynamic F390; no interpreter/native return inferred.'};}
const describe=b=>{const raw=Buffer.concat(b.instructions.map(i=>i.raw));return {name:b.name,entry:cpuLabel(b.entry),end_exclusive:cpuLabel(b.instructions.at(-1).next),covered_bytes:raw.length,instruction_count:b.instructions.length,sha256:sha(raw),machine_bytes:raw.toString('hex').toUpperCase()};};
const roots=[block('dropF8BB',0x80F8BB,0x80F8BF),block('addF532',0x80F532,0x80F53B),block('subtractF53B',0x80F53B,0x80F546)];
const fetch=block('fetchF389',0x80F389,0x80F393),map=new Map([...roots,fetch].flatMap(b=>b.instructions.map(i=>[i.cpu,i])));
const push=JSON.parse(await readFile('analysis/render-task-push.json','utf8')),visit=taskInterpreterSource(bytes);
const interpreter=visit.windows.find(w=>w.name==='interpreterF378');
if([push,visit].some(r=>r.rom_sha256!==metadata.rom_sha256)||push.windows.find(w=>w.name==='fetchF389').machine_bytes!==describe(fetch).machine_bytes
  ||interpreter.machine_bytes.slice(34)!==describe(fetch).machine_bytes)throw Error('Actual shared fetch source drift');
const entries=[[0xBC,0x80F8BB],[0x5C,0x80F532],[0x5E,0x80F53B]],dispatch_entries=entries.map(([opcode,entry])=>{
  const pc=0x80F2B4+opcode,off=cpuToOffset(pc,bytes.length),raw=bytes.subarray(off,off+2);
  if(raw.readUInt16LE()!==(entry&65535)||scriptOpcodes[opcode]?.handler!==(entry&65535)
    ||visit.dispatch.all_byte_opcode_targets[opcode].target!==cpuLabel(entry))throw Error('Original consumer target drift');
  return {opcode,word_source:cpuLabel(pc),target:cpuLabel(entry),machine_bytes:raw.toString('hex').toUpperCase(),sha256:sha(raw)};
});
const report={rom_sha256:metadata.rom_sha256,progress_reference:'docs/PORTIERUNGSSTAND.json',
  processor_reference:{url:'https://www.westerndesigncenter.com/wdc/documentation/w65c816s.pdf',edition:'March 13, 2024',
    sections:['3.5.22/3.5.23/7.1 bank00 native stack and unsigned stack-relative offset','Table5-7 page41 row22b PLA low/high; page42 row23 stack-relative WORD low/high','Table5-5 ADC/SBC/CLC/SEC and status effects','3.5.13/7.2/7.9 fresh DP indexed fetch and programbank jump'],
    qualification:'Processor instruction address/data/flag semantics only; no SNES device, timing, interrupt or scene evidence.'},
  scope:'Complete JMP-entered F8BB/F532/F53B local stack-consumer sources through actual fresh F389 to dynamic F390. Fixed path/byte chronology and binary data consequences; no CPU/memory/task/native/device execution.',
  windows:[...roots,fetch].map(describe),dependencies:[
    {report:'analysis/render-task-push.json',window:push.windows.find(w=>w.name==='fetchF389')},
    {report:'analysis/render-c1ca.json',window:interpreter,opcode_source_sha256:visit.dispatch.opcode_source.sha256}],
  dispatch_entries,source_graph:{source_closed_to_dispatch:true,full_graph_closed:false,native_binding:false,code_bytes:34,instructions:map.size,
    minimum_protected_stack_bytes:null,qualification:'34/18 deduplicated local source; all entries advance operand S by2, no root JSR or whole interpreter/return proof.'},
  consumers:entries.map(([,entry])=>proveConsumerToDispatch(map,entry)),
  synthetic_address_examples:[
    ['Drop S wrap',{entry:0x80F8BB,d:0x3D6,bank:0x9D,s:0xFFFF,y:0xFFFF,pointerAfter:0xFFFF}],
    ['Add writes fresh pointer',{entry:0x80F532,d:0x3D6,bank:0x80,s:0x3D3,y:4,pointerAfter:0x1234}],
    ['Subtract WORDs wrap inside bank00',{entry:0x80F53B,d:0xFFFF,bank:0x7E,s:0xFFFC,y:0,pointerAfter:0}],
    ['Arithmetic outside known WRAM',{entry:0x80F532,d:0x3D6,bank:0x9D,s:0x1FFD,y:0,pointerAfter:0xA001}]
  ].map(([name,context])=>({name,...describeConsumerByteOwners(context)})),
  contract:{
    entry:'Actual opcode JMP in programbank80, E0M0X0, full payloadD/actualDBR/operandS/WORD-Y and intact code. Incoming A/X carry no payload assumptions. No root JSR, no underflow/capacity/parity checks. Original stack-relative bank is00 independently of D/DBR.',
    drop:'F8BB WORDPLA reads low at00:(S+1)&FFFF then high at00:(S+2)&FFFF, S advances2; JMPF389. Discarded value is still a required real readable WORD; no physical byte clear or stack store. C/V preserved and PLA N/Z replaced by fetch.',
    add:'F532 first WORDPLA right at incomingS+1/+2 and advancesS2. CLC seedsCarry0; ADC01,S reads left at incomingS+3/+4. WORDSTA01,S overwrites left low then high at those same addresses; no PHA. Binary right+left result modulo65536, Carry on unsigned overflow, V on signed overflow. IncomingCarry ignored, decimal flag not cleared.',
    subtract:'F53B SEC seedsCarry1, LDA03,S reads left at incomingS+3/+4, SBC01,S reads right at+1/+2, STA03,S writes left-right low/high at+3/+4. Only then PLA freshly reads discarded right+1/+2 and advancesS2. Binary C1 means no borrow; V signed subtraction overflow. PLA overwrites A/N/Z, not C/V. No pop-before-result-store assumption.',
    addressing:'Every PLA/stack-relative data byte stays inbank00 with independent16bit address wrap. PLA movesS; sr LDA/ADC/SBC/STA never moveS and use unsigned offsets1/3 from currentS. Arithmetic needs four readable operandbytes and two writable existing leftbytes, Drop two readablebytes/no writablebytes; none is a protected global outer-return-stack minimum.',
    decimal:'Binary result/C/V formulas require explicitly supplied status decimal flag0. Neither handler executes CLD. If decimal flag1, original ADC/SBC use decimal arithmetic and these binary formulas/hostvalues do not apply; decimal result/flag contract remains separate. Drop has no arithmetic and no binary-only premise. Payload D is a distinct16bit register, not the status decimal flag.',
    fetch:'All handlers JMP actualF389 after stack accesses. Freshbank00:D/(D+1)&FFFF pointer and fullWORD at((DBR<<16)+pointer+incomingY)&FFFFFF, including ignoredhigh; then WORDINY/AND00FF/TAX/JMP(80:F2B4+X). No operandY advance, finalY=(entryY+1)&FFFF, A/X=freshopcodeLow,N0/Z(low==0). Arithmetic C/V survive; Drop C/V and all I/decimal preserved. Target/tablebyte ownership remains required.',
    aliases:'Arithmetic result writes may overlap DPpointer, frame/control/cursor/savedouterS or nextopcode bytes. Fresh F389 pointer/data must follow both result stores; no cached pointer/opcode. The two arithmetic operand WORDs are disjoint logical bank00 offsets for everyS, but actual read/write owner and device stability are not inferred. Subtract still requires its later discarded PLA read after writes. Code and outer-returnstack integrity are explicit prerequisites; destructive physical overlaps are not approved.',
    host_boundary:'stepStackPrimitive Drop and compileScriptFrame Add/Subtract use bounded arrayWORDs with underflow/storageguards, binary values and no statusdecimal/C/V. Returned hostPC precedes nextopcode while F390Y already follows it. They provide neither discarded PLA byte sources, physical bank00stack/alias chronology, ignoredopcodeHigh nor arbitrary S/DBR/byte ownership. Host data comparisons remain synthetic, no original Task/CPU/scene run.',
    boundaries:'Three local consumer sources closed only to actual dynamicdispatch. Physical taskbyte bridge, initialization, further opcode/native/stackmigration/return sources and decimal execution contract separate. C1CA/9178/BF3B full graphs/native/globalstack remain open.'}};
await writeFile('analysis/render-task-consumers.json',JSON.stringify(report,null,2)+'\n');
await writeFile('analysis/render-task-consumers.asm.txt',`; European ROM SHA-256 ${metadata.rom_sha256}\n; JMP-entered WORD consumers, actual fresh fetch. Dynamic dispatch and full return remain OPEN; no CPU execution.\n\n`+[...roots,fetch].map(formatBlock).join('\n'));
console.log(`Task consumers34/${map.size}; entry paths ${report.consumers.map(p=>p.reachable_instructions).join('/')}; S+2 each, full dynamic graph OPEN.`);
