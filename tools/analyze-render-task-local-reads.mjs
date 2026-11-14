import {readFile,writeFile} from 'node:fs/promises';
import {taskInterpreterSource} from './task-interpreter-source.mjs';
import {createHash} from 'node:crypto';
import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {decode,formatBlock} from './disassemble.mjs';
import {scriptOpcodes} from '../src/script/opcodes.mjs';
import {proveLocalReadToDispatch,describeLocalReadByteOwners} from './render-task-local-reads-source-proof.mjs';
const {bytes,metadata}=inspectRom(await readFile(process.argv[2]??'Shadowrun (E).smc'));
if(metadata.rom_sha256!=='91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690')throw Error('Wrong European ROM revision');
const sha=b=>createHash('sha256').update(b).digest('hex');
function block(name,entry,end){const instructions=[];for(let pc=entry;pc<end;){const i=decode(bytes,pc,{e:0,m:0,x:0});if(i.next>end)throw Error('Source window overflow');instructions.push(i);pc=i.next;}
  return {name,entry,initialState:{e:0,m:0,x:0},instructions,stop:'Complete fixed WORD source to actual dynamic F390; no interpreter/native return inferred.'};}
const describe=b=>{const raw=Buffer.concat(b.instructions.map(i=>i.raw));return {name:b.name,entry:cpuLabel(b.entry),end_exclusive:cpuLabel(b.instructions.at(-1).next),covered_bytes:raw.length,instruction_count:b.instructions.length,sha256:sha(raw),machine_bytes:raw.toString('hex').toUpperCase()};};
const roots=[block('local02F3A1',0x80F3A1,0x80F3B1),block('local16F3B9',0x80F3B9,0x80F3C6),block('localC2F8CB',0x80F8CB,0x80F8D4)];
const fetch=block('fetchF389',0x80F389,0x80F393),map=new Map([...roots,fetch].flatMap(b=>b.instructions.map(i=>[i.cpu,i])));
const previous=JSON.parse(await readFile('analysis/render-task-push.json','utf8')),visit=taskInterpreterSource(bytes);
const interpreter=visit.windows.find(w=>w.name==='interpreterF378');
if([previous,visit].some(r=>r.rom_sha256!==metadata.rom_sha256)||previous.windows.find(w=>w.name==='fetchF389').machine_bytes!==describe(fetch).machine_bytes
  ||interpreter.machine_bytes.slice(34)!==describe(fetch).machine_bytes)throw Error('Actual shared fetch source drift');
const dispatch_entries=[[0x02,0x80F3A1],[0x16,0x80F3B9],[0xC2,0x80F8CB]].map(([opcode,entry])=>{
  const pc=0x80F2B4+opcode,off=cpuToOffset(pc,bytes.length),raw=bytes.subarray(off,off+2);
  if(raw.readUInt16LE()!==(entry&65535)||scriptOpcodes[opcode]?.handler!==(entry&65535)
    ||visit.dispatch.all_byte_opcode_targets[opcode].target!==cpuLabel(entry))throw Error('Original local read target drift');
  return {opcode,word_source:cpuLabel(pc),target:cpuLabel(entry),machine_bytes:raw.toString('hex').toUpperCase(),sha256:sha(raw)};
});
const report={rom_sha256:metadata.rom_sha256,progress_reference:'docs/PORTIERUNGSSTAND.json',
  processor_reference:{url:'https://www.westerndesigncenter.com/wdc/documentation/w65c816s.pdf',edition:'March 13, 2024',
    sections:['3.5.11/3.5.17 DirectX/Direct actual full D/16bit native address; 7.2 bank00 range including highbyte',
      '3.5.13 native DP pointer and24bit indexed data; Table5-7 low/high reads',
      '7.1 native bank00 S; Table5-7 page41 WORDPHA highfirst','Table5-5 LDA/AND/TAX/INY N/Z only, PHA flags preserved',
      '7.9 JMP(a,x) pointer uses programbank'],qualification:'Instruction address/data/flag semantics only; no SNES device/timing/interrupt/scene evidence.'},
  scope:'Complete JMP-entered original02/F3A1 16/F3B9 C2/F8CB local read sources through fresh F389 to dynamic F390. Full WORDindex/local reads even for BYTE masked outputs, bank00 DP13(+LowX), high/low WORDPHA and fresh pointer/opcode. Pure equations only; no CPU/memory/task/native/device execution inferred.',
  windows:[...roots,fetch].map(describe),dependencies:[{report:'analysis/render-task-push.json',window:previous.windows.find(w=>w.name==='fetchF389')},
    {report:'analysis/render-c1ca.json',window:interpreter,opcode_source_sha256:visit.dispatch.opcode_source.sha256}],dispatch_entries,
  source_graph:{source_closed_to_dispatch:true,full_graph_closed:false,native_binding:false,code_bytes:48,instructions:map.size,
    minimum_protected_stack_bytes:null,qualification:'48/24 deduplicated source; three straight paths, allS-2. Two output operandbytes, no root JSR/global interpreter return proof.'},
  local_reads:roots.map(b=>proveLocalReadToDispatch(map,b.entry)),
  synthetic_address_examples:[
    ['02 ignores index highbyte only after fullread',{entry:0x80F3A1,d:0x3D6,bank:0x9D,s:0x3F0,y:4,pointerBefore:0xA001,pointerAfter:0xA001,indexWord:0xFF01,localWord:0xAB80}],
    ['16 stackwrites overlap and replace pointer before refetch',{entry:0x80F3B9,d:0x3D6,bank:0x80,s:0x3D7,y:4,pointerBefore:0x1200,pointerAfter:0x1234,indexWord:0xFFFF,localWord:0x1234}],
    ['C2 localWORDhigh wraps within bank00',{entry:0x80F8CB,d:0xFFEC,bank:0x9D,s:1,y:0xFFFF,pointerAfter:0xA001,localWord:0xAA80}],
    ['02 ignored localhigh requires own byteowner',{entry:0x80F3A1,d:0x1FEB,bank:0x9D,s:0x3F0,y:4,pointerBefore:0xA001,pointerAfter:0xA001,indexWord:1,localWord:0xBB55}]
  ].map(([name,context])=>({name,...describeLocalReadByteOwners(context)})),
  contract:{
    entry:'Actual original opcode JMP in programbank80, E0M0X0, full actual payloadD/DBR/operandS/WORD-Y, intact code/outerstack and real byte owners. IncomingA/X not payload assumptions. No root JSR/underflow/capacity/parity/ID/initialization guards; full WORD observations supplied explicitly.',
    indexed:'02/16 first read fullWORD via freshbank00:D/D+1 pointer andactualDBR:pointer+Y, low/high includingignoredindexHigh. WORDINY once, AND00FF/TAX sets fullWORDX=operandLow, no ASL/parity/offsetcap. Fresh WORDLDA13,X then reads bank00:(D+13+X)&FFFF and high at(base+1)&FFFF. Full D, includingDL, actual index0..255, no cached host local/framevalue. Index255 still requires byte atD+113 after bank00wrap; WORD local offsets may be odd.',
    direct:'C2 does WORDLDA13, no index operand/pointer/dataread beforelocal, no initialINY orTAX, no incomingX dependency. Reads bank00:(D+13)&FFFF/(D+14)&FFFF low/high, thenAND00FF. EntryX unchanged until actual fetchTAX. Separate fetch pointer/opcode owners remain mandatory.',
    values:'02/C2 read BOTH localbytes then WORDAND00FF: zeroextendedlocalLow, never signed extension even80..FF, stackHigh00. 16 retains full original localWORD. All paths WORDPHA highfirst atbank00:S, lowsecond atbank00:(S-1)&FFFF; S=(entryS-2)&FFFF. No PLA/localstore/extra stackread; pushedlocalWORD source latched before writes, even ifPHA aliases localbytes.',
    owners:'Local DP13(+X) is actual bank00 independentlyofDBR andcanwrap16bit acrossFFFF/0000 or00FF/0100. Full ignored index/local highbytes need real readowners; BYTE mask isnot permission totruncate reads ormanufacture initialization. Stackbytes may be WRAM/IO/ROM/unmapped; physical mapping isnot writepermission oractual owner. Two operandoutputbytes are not protected globalstackminima.',
    fetch:'After both PHA stores actualF389 rereads bank00:D/D+1 pointer and fullWORD actualDBR:freshPointer+updatedY includingignoredopcodeHigh, INY/AND00FF/TAX/JMP(80:F2B4+X). 02/16 updatedY=(entryY+1)&FFFF, frontierY=(entryY+2)&FFFF; C2 updatedY=entryY, frontierY=(entryY+1)&FFFF. A/X=nextOpcodeLow,N0/Z(low==0),D/DBR/C/V/I/decimal preserved. No ASL/parity/IDclamp orimplicitnextbodyreturn.',
    aliases:'Full indexWORD andlocalWORD reads actuallypresent precedebothPHA stores; freshpointer/opcode afterstores. PHA may overwrite localWORD, DPpointer/framebank/PC/S/cursor/control/savedouterS ornextopcodebytes. Read-before-write localvalue latched; laterpointer isfreshseparate input, notcached indexpointer orprestoreOpcode. Intact code/outerstack andactualowners stillrequired, noautomaticframe7 writes/initialization/memoryopening ordestructivealiasauthorization.',
    flags:'LDA/AND/TAX/INY updateN/Z only; PHA/JMP preserveflags. C/V/I/decimal remainentryvalues, noCLD/binary-onlypremise. WORDAND00FF leavesN0; finalZ fromfreshopcodeLow, notlocal/index. PayloadD separate fromstatusdecimal.',
    host_boundary:'Existing compileScriptFrame 02/16/C2 use bounded initializedlocal arrays and optional guardedHeapFrameStorage. BYTEhost read consumes onlylowlocalbyte, bytecodeindex reads onebyte andPC stopsbefore nextopcodefetch. These intentional coverage limits do not supply actualWORDhighread/physicalD/DBR/S/aliases/refetch ororiginal localcapacity/initialization rules. Scalaragreement on disjoint initializedfixtures isnot nativebridge/whole9178 evidence; no runtimechanges.',
    boundaries:'Three local sources closeonlytoactualdynamicdispatch. Physical taskbyte bridge, local/state stores, signextension, furtheropcode/native/stackmigration/return contracts andoriginalinitialization separate. FullC1CA/9178/BF3B/native/globalstack remainopen.'}};
await writeFile('analysis/render-task-local-reads.json',JSON.stringify(report,null,2)+'\n');
await writeFile('analysis/render-task-local-reads.asm.txt',`; European ROM SHA-256 ${metadata.rom_sha256}\n; Full WORD local/index reads before BYTE masks, WORDPHA then fresh fetch. Dynamic dispatch/full return OPEN; no CPU execution.\n\n`+[...roots,fetch].map(formatBlock).join('\n'));
console.log(`Task local reads48/${map.size}; three paths, full index/localWORD reads, PHA then freshpointer; full dynamic graph OPEN.`);
