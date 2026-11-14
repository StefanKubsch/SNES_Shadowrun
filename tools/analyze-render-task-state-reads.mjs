import {readFile,writeFile} from 'node:fs/promises';
import {taskInterpreterSource} from './task-interpreter-source.mjs';
import {createHash} from 'node:crypto';
import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {decode,formatBlock} from './disassemble.mjs';
import {scriptOpcodes} from '../src/script/opcodes.mjs';
import {proveStateReadToDispatch,describeStateReadByteOwners} from './render-task-state-reads-source-proof.mjs';
const {bytes,metadata}=inspectRom(await readFile(process.argv[2]??'Shadowrun (E).smc'));
if(metadata.rom_sha256!=='91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690')throw Error('Wrong European ROM revision');
const sha=b=>createHash('sha256').update(b).digest('hex');
function block(name,entry,end){const instructions=[];for(let pc=entry;pc<end;){const i=decode(bytes,pc,{e:0,m:0,x:0});if(i.next>end)throw Error('Source window overflow');instructions.push(i);pc=i.next;}
  return {name,entry,initialState:{e:0,m:0,x:0},instructions,stop:'Complete fixed WORD offset/state source to actual dynamic F390; no interpreter/native return inferred.'};}
const describe=b=>{const raw=Buffer.concat(b.instructions.map(i=>i.raw));return {name:b.name,entry:cpuLabel(b.entry),end_exclusive:cpuLabel(b.instructions.at(-1).next),covered_bytes:raw.length,instruction_count:b.instructions.length,sha256:sha(raw),machine_bytes:raw.toString('hex').toUpperCase()};};
const roots=[block('state04F8D4',0x80F8D4,0x80F8E4),block('state18F8E4',0x80F8E4,0x80F8F1)];
const fetch=block('fetchF389',0x80F389,0x80F393),map=new Map([...roots,fetch].flatMap(b=>b.instructions.map(i=>[i.cpu,i])));
const push=JSON.parse(await readFile('analysis/render-task-push.json','utf8')),visit=taskInterpreterSource(bytes);
const interpreter=visit.windows.find(w=>w.name==='interpreterF378');
if([push,visit].some(r=>r.rom_sha256!==metadata.rom_sha256)||push.windows.find(w=>w.name==='fetchF389').machine_bytes!==describe(fetch).machine_bytes
  ||interpreter.machine_bytes.slice(34)!==describe(fetch).machine_bytes)throw Error('Actual shared fetch source drift');
const dispatch_entries=[[0x04,0x80F8D4],[0x18,0x80F8E4]].map(([opcode,entry])=>{
  const pc=0x80F2B4+opcode,off=cpuToOffset(pc,bytes.length),raw=bytes.subarray(off,off+2);
  if(raw.readUInt16LE()!==(entry&65535)||scriptOpcodes[opcode]?.handler!==(entry&65535)
    ||visit.dispatch.all_byte_opcode_targets[opcode].target!==cpuLabel(entry))throw Error('Original state read target drift');
  return {opcode,word_source:cpuLabel(pc),target:cpuLabel(entry),machine_bytes:raw.toString('hex').toUpperCase(),sha256:sha(raw)};
});
const report={rom_sha256:metadata.rom_sha256,progress_reference:'docs/PORTIERUNGSSTAND.json',
  processor_reference:{url:'https://www.westerndesigncenter.com/wdc/documentation/w65c816s.pdf',edition:'March 13, 2024',
    sections:['3.5/3.5.6 AbsoluteLongX full24bit base+WORD X and WORD bank crossing','3.5.13 native DP pointer and24bit indexed data',
      '7.1/Table5-7 WORD PHA high/low;7.2 native bank00 pointer range','Table5-5 LDA/AND/TAX/INY N/Z only; PHA flags preserved','7.9 indirect JMP programbank'],
    qualification:'Instruction data/address/flag semantics only; no SNES device/timing/interrupt/scene evidence.'},
  scope:'Complete original04/F8D4 and18/F8E4 State-read JMP sources through fresh F389 to dynamic F390. Full offsetWORD/TAX withoutclamp, WORD LDA7E0000,X including high7F0000 atXFFFF; AND00FF only04, PHA high/low andfreshpointer/opcode. Pure suppliedequations, no CPU/memory/task/native execution.',
  windows:[...roots,fetch].map(describe),dependencies:[{report:'analysis/render-task-push.json',window:push.windows.find(w=>w.name==='fetchF389')},
    {report:'analysis/render-c1ca.json',window:interpreter,opcode_source_sha256:visit.dispatch.opcode_source.sha256}],dispatch_entries,
  source_graph:{source_closed_to_dispatch:true,full_graph_closed:false,native_binding:false,code_bytes:39,instructions:map.size,
    minimum_protected_stack_bytes:null,qualification:'39/20 deduplicated source; two straight paths13/12, allS-2. Two writable operandbytes, no root JSR/global interpreter return proof.'},
  state_reads:roots.map(b=>proveStateReadToDispatch(map,b.entry)),
  synthetic_address_examples:[
    ['04 reads high7F0000 before zeroextending Low80',{entry:0x80F8D4,d:0x3D6,bank:0x9D,s:0x3F0,y:4,pointerBefore:0xA001,pointerAfter:0xA001,offsetWord:65535,stateWord:0xAB80}],
    ['18 PHA overwrites ownpointer afterread',{entry:0x80F8E4,d:0x3D6,bank:0x80,s:0x3D7,y:4,pointerBefore:0x1200,pointerAfter:0x1234,offsetWord:0x1234,stateWord:0x1234}],
    ['18 PHA overlaps alreadyread StateWORD',{entry:0x80F8E4,d:0x100,bank:0x9D,s:0x3EA,y:0xFFFF,pointerBefore:0xA001,pointerAfter:0xA001,offsetWord:0x3E9,stateWord:0xAA80}],
    ['04 full offset-high crosses unknownstreamowner',{entry:0x80F8D4,d:0x3D6,bank:0,s:0x3F0,y:0,pointerBefore:0x1FFF,pointerAfter:0x1200,offsetWord:0x8001,stateWord:0xBB55}]
  ].map(([name,context])=>({name,...describeStateReadByteOwners(context)})),
  contract:{
    entry:'Actual original opcode JMP programbank80, E0M0X0, full actual payloadD/DBR/operandS/WORD-Y, intactcode/outerstack andreal byte owners. No rootJSR/stackunderflow/capacity/parity/ID/State-initialization guard; full WORD observations explicit.',
    offset:'Both readfullWORD via freshbank00:D/D+1 andactualDBR:pointer+Y, Low/High. TwoWORD INY thenfullWORD TAX setsX=entireoffsetWORD0..FFFF; noAND00FF/indexlow shortcut, ASL, parity/address clamp orincomingX dependency. Highoffset is actualaddressdata, notignored. Indexsource andlaterfreshfetchpointer remainseparate observations.',
    state:'Original WORDLDA longx7E0000,X readsLow at24bit7E0000+fullX andHigh atbase+1. DBR/D/S neverchoose Statebase. AtXFFFF low7E:FFFF high7F:0000; nofixedbank7E highwrap to7E0000, droppedHigh orclamped/rejected lastoffset. Odd offsets remainodd. All statebytes needactualreadowners despite knownWRAMmapping.',
    values:'04 reads BOTH Statebytes thenWORDAND00FF zeroextendsLow (80..FF=>0080..00FF), never signextends; 18 retainsfulloriginalStateWORD. BothWORDPHA highfirstbank00:S thenlowbank00:(S-1)&FFFF, S-2. 04pushHigh00, 18originalStateHigh. NoPLA/stackread/localread/state/localstore/extraRootReturn orautomaticFrame7write.',
    owners:'StateLow/High actual7E0000+X/X+1; DPpointer andstackbank00/16Bit independentofDBR. FullD/DL retained. Stream data24Bit andY16Bit wrapindependently; even04 StateHigh7F0000 needsownrealreadsource. KnownphysicalWRAM isnot initializedState/ownership/writepermission orintactframe/globalstack proof. Two operandwriteowners mandatory, noimplicitmemoryopening.',
    aliases:'Full offset/StateWORD reads precedebothPHAwrites; Statevalue/fullX latched evenifstackoverwrites Statebytes mappedfrombank00:S. StateLowWRAM00..1FFF mayaliasDPpointer/frame/control/operandbytes; StateHighat7F0000 isdistinctfrombank00lowWRAM stack. PHA mayreplaceownpointer/framebank/PC/cursor/savedS/control/outerstack ornextopcode. Freshpointer/opcode afterwrites, notcachedprestore/indexvalues. Actualowners/intactcode/outerstack required, nodestructivealiasauthorization/initialization inferred.',
    fetch:'F389 readsfreshbank00:D/D+1 pointer andfullWORD actualDBR:freshPointer+updatedY includingignoredopcodeHigh. BothfetchY=(entryY+2)&FFFF, frontierY=(entryY+3)&FFFF. WORDLDA/INY/AND00FF/TAX givesA/X=nextOpcodeLow,N0/Z(low==0), C/V/I/decimal/D/DBR preserved; noCLD/binary-onlypremise. JMP(80:F2B4+X) noASL/parity/IDclamp ornextbodyreturn.',
    flags:'LDA/AND/TAX/INY changeN/Z only; PHA/JMP preserveflags. C/V/I/decimal retained evenwhenStateLow>=80 orStateWORDnegative; noCMP/signgate/Carryseed. Finalflags fromfreshopcodeLow, notState/offset; E0M0X0 throughout. PayloadD separatefromstatusdecimal.',
    host_boundary:'Existing compileScriptFrame04/18 areexplicitlyunsupported andstopbeforePC/stack/local/step-state changes. Sourceclosure doesnot authorizehostState access or supplyphysicaloffset/stateHigh/DP/DBR/S/alias/refetch ownership, nativeTaskbytebridge orwhole9178 evidence. No runtimechanges ornativepromotion.',
    boundaries:'Two localsources closeonlytodynamicalF390. Statewrites/State-signextension, physicaltaskbytebridge, furtheropcode/native/stackmigration/return/originalinitialization remainseparate. FullC1CA/9178/BF3B/native/globalstack open.'}};
await writeFile('analysis/render-task-state-reads.json',JSON.stringify(report,null,2)+'\n');
await writeFile('analysis/render-task-state-reads.asm.txt',`; European ROM SHA-256 ${metadata.rom_sha256}\n; FullWORD offset andState reads; longX highbankcrossing, PHA thenfreshfetch. Dynamic return OPEN; no CPU execution.\n\n`+[...roots,fetch].map(formatBlock).join('\n'));
console.log(`Task state reads39/${map.size}; fullWORD X/State including7Fhigh, twoINY thenPHA/freshfetch; full dynamic graph OPEN.`);
