import {readFile,writeFile} from 'node:fs/promises';
import {taskInterpreterSource} from './task-interpreter-source.mjs';
import {createHash} from 'node:crypto';
import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {decode,formatBlock} from './disassemble.mjs';
import {scriptOpcodes} from '../src/script/opcodes.mjs';
import {proveStateWriteToDispatch,describeStateWriteByteOwners} from './render-task-state-writes-source-proof.mjs';
const {bytes,metadata}=inspectRom(await readFile(process.argv[2]??'Shadowrun (E).smc'));
if(metadata.rom_sha256!=='91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690')throw Error('Wrong European ROM revision');
const sha=b=>createHash('sha256').update(b).digest('hex');
function block(name,entry,end){const instructions=[];let state={e:0,m:0,x:0};
  for(let pc=entry;pc<end;){const i=decode(bytes,pc,state);if(i.next>end)throw Error('Source window overflow');instructions.push(i);pc=i.next;
    if(['SEP','REP'].includes(i.mnemonic)){if(i.value!==0x20)throw Error('Unexpected status mask');state={...state,m:Number(i.mnemonic==='SEP')};}}
  if(state.m!==0)throw Error('WORD fetch mode not restored');
  return {name,entry,initialState:{e:0,m:0,x:0},instructions,stop:'Complete actual SEP20/REP20 width path to dynamic F390; no interpreter/native return inferred.'};}
const describe=b=>{const raw=Buffer.concat(b.instructions.map(i=>i.raw));return {name:b.name,entry:cpuLabel(b.entry),end_exclusive:cpuLabel(b.instructions.at(-1).next),covered_bytes:raw.length,instruction_count:b.instructions.length,sha256:sha(raw),machine_bytes:raw.toString('hex').toUpperCase()};};
const roots=[block('state2EF8F1',0x80F8F1,0x80F902),block('state36F902',0x80F902,0x80F90F)];
const fetch=block('fetchF389',0x80F389,0x80F393),map=new Map([...roots,fetch].flatMap(b=>b.instructions.map(i=>[i.cpu,i])));
const push=JSON.parse(await readFile('analysis/render-task-push.json','utf8')),visit=taskInterpreterSource(bytes);
const interpreter=visit.windows.find(w=>w.name==='interpreterF378');
if([push,visit].some(r=>r.rom_sha256!==metadata.rom_sha256)||push.windows.find(w=>w.name==='fetchF389').machine_bytes!==describe(fetch).machine_bytes
  ||interpreter.machine_bytes.slice(34)!==describe(fetch).machine_bytes)throw Error('Actual shared fetch source drift');
const dispatch_entries=[[0x2E,0x80F8F1],[0x36,0x80F902]].map(([opcode,entry])=>{
  const pc=0x80F2B4+opcode,off=cpuToOffset(pc,bytes.length),raw=bytes.subarray(off,off+2);
  if(raw.readUInt16LE()!==(entry&65535)||scriptOpcodes[opcode]?.handler!==(entry&65535)
    ||visit.dispatch.all_byte_opcode_targets[opcode].target!==cpuLabel(entry))throw Error('Original state write target drift');
  return {opcode,word_source:cpuLabel(pc),target:cpuLabel(entry),machine_bytes:raw.toString('hex').toUpperCase(),sha256:sha(raw)};
});
const report={rom_sha256:metadata.rom_sha256,progress_reference:'docs/PORTIERUNGSSTAND.json',
  processor_reference:{url:'https://www.westerndesigncenter.com/wdc/documentation/w65c816s.pdf',edition:'March 13, 2024',
    sections:['3.5/3.5.6 AbsoluteLongX full24bit base+WORD X and WORD bank crossing','3.5.13 native DP pointer and24bit indexed data',
      '7.1/Table5-7 WORD PLA low/high and WORD STA low/high;7.2 native bank00 pointer range',
      'Table5-5 PLA N/Z; STA preservesflags; SEP20/REP20 changeM only','7.23 hiddenhighA retained acrossM changes;7.9 indirectJMP programbank'],
    qualification:'Instruction data/address/flag semantics only; no SNES device/timing/interrupt/scene evidence.'},
  scope:'Complete original2E/F8F1 and36/F902 State-write JMP sources through fresh F389 to dynamic F390. Full offsetWORD/TAX andWORD PLA before BYTE/WORD STA7E0000,X; actualSEP20/REP20, high7F0000 atXFFFF, ownpointer/header/stack/opcode aliases andfreshfetch. Pure suppliedequations, no CPU/memory/task/native execution.',
  windows:[...roots,fetch].map(describe),dependencies:[{report:'analysis/render-task-push.json',window:push.windows.find(w=>w.name==='fetchF389')},
    {report:'analysis/render-c1ca.json',window:interpreter,opcode_source_sha256:visit.dispatch.opcode_source.sha256}],dispatch_entries,
  source_graph:{source_closed_to_dispatch:true,full_graph_closed:false,native_binding:false,code_bytes:40,instructions:map.size,
    minimum_protected_stack_bytes:null,qualification:'40/21 deduplicated source; two straight paths14/12, allS+2. Two readable operandbytes, no root JSR/global interpreter return proof.'},
  state_writes:roots.map(b=>proveStateWriteToDispatch(map,b.entry)),
  synthetic_address_examples:[
    ['2E atXFFFF writes only7EFFFF, hiddenHighA retained',{entry:0x80F8F1,d:0x3D6,bank:0x9D,s:0x3F0,y:4,pointerBefore:0xA001,pointerAfter:0xA001,offsetWord:65535,stackWord:0xAB80}],
    ['36 atXFFFF writes high7F0000 afterlow',{entry:0x80F902,d:0x3D6,bank:0x9D,s:65535,y:65535,pointerBefore:0xA001,pointerAfter:0xA001,offsetWord:65535,stackWord:0xAB80}],
    ['2E replaces ownpointerLow beforefreshfetch',{entry:0x80F8F1,d:0x3D6,bank:0x80,s:0x3F0,y:4,pointerBefore:0x1200,pointerAfter:0x1234,offsetWord:0x3D6,stackWord:0xAB34}],
    ['36 overlaps alreadyreadPLA bytes',{entry:0x80F902,d:0x3D6,bank:0x80,s:0x3E8,y:4,pointerBefore:0x1200,pointerAfter:0x1200,offsetWord:0x3E9,stackWord:0x1234}]
  ].map(([name,context])=>({name,...describeStateWriteByteOwners(context)})),
  contract:{
    entry:'Actual original opcode JMP programbank80, E0M0X0, full actual payloadD/DBR/operandS/WORD-Y, intactcode/outerstack andreal byte owners. No rootJSR/stackunderflow/capacity/parity/ID/State-initialization guard; full WORD observations explicit.',
    offset:'Both readfullWORD via freshbank00:D/D+1 andactualDBR:pointer+Y, Low/High. TwoWORD INY thenfullWORD TAX setsX=entireoffsetWORD0..FFFF; noAND00FF/indexlow shortcut, ASL/parity/address clamp orincomingX dependency. OffsetHigh isaddressdata, notignored. XlatchedbeforePLA/Statewrites andnotreloaded evenifsource/control aliased.',
    pop:'WORDPLA beforeSEP/Statewrite readsbank00:(entryS+1)&FFFF Low then(entryS+2)&FFFF High, S+2. Bothreadowners mandatory evenfor2E BYTEstore. FullpoppedWORD latchedbeforeallwrites, includingoverlap withalreadyreadoperandbytes. NoPHA/explicitstackstore/local/Statepreread/returnpush ororiginalguard.',
    stores:'2E SEP20 setsM1, BYTESTA longx7E0000,X writesonlypoppedLow, REP20 restoresM0 beforefetch. XstillWORD; hiddenhighA retainspoppedHigh, fullA afterREP equalsfullpoppedWORD, notzero/signextendedLow. NoStateHighread/write/preservationread evenatXFFFF. 36 WORDSTA writespoppedLow at7E0000+fullX thenpoppedHigh at24bitbase+1; XFFFF high7F0000, no7Ewrap. Bothstoreevenifsamevalue; noRMW/omittedwrite/initialization.',
    owners:'Stateaddress24bit7E0000+fullX independentofD/DBR/S. One/tworealStatewriteowners, notStatereadowners forplainSTA. Fulloffset/PLA/freshopcodehigh needreadowners. DPpointer/Sbank00 wrap16bits, stream24bit andY16bit separately. KnownWRAM/physicaladdress suppliesno Stateinitialization, writepermission orintactframe/globalstack proof.',
    aliases:'Statewrites canphysicallyaliasownbank00WRAM DP00pointer/framebank/PC/cursor/savedS/headercontrols, popped/futureoperand/outerstack orstream/opcode bytes. UnlikeDP13+LowX localstores, ownheader isnotdisjoint. Offset/PLAreads precedeallstores; fullX/poppedA latched, no sourcecacheforlaterfetch. F389 freshpointer/opcode afterallwrites canreflectownpointerreplacement orchangedopcode. Actualowners/intactcode/outerstack remainrequired; noautomaticFrame7stores/memoryopening/destructivealiasauthorization. No explicitstackstoreinstruction doesnotexclude Statewrites aliasingstackbytes.',
    fetch:'F389 rereadsfreshbank00:D/D+1 andfullWORD actualDBR:freshPointer+updatedY includingignoredopcodeHigh, afterallStatewrites. BothfetchY=(entryY+2)&FFFF, frontierY=(entryY+3)&FFFF. WORDLDA/INY/AND00FF/TAX givesA/X=nextOpcodeLow,N0/Z(low==0), C/V/I/decimal/D/DBR retained, E0M0X0. NoCLD/binary-onlypremise. JMP(80:F2B4+X) noASL/parity/IDclamp ornextbodyreturn.',
    flags:'PLA-N/Z usefullWORD (0100 Z0,0080 N0,8000 N1). SEP20/STA/REP20 do notrefresh N/Z andonlychangeM, notX/C/V/I/decimal/highA; finalfetch replacesfullA/NZ. NoCMP/Signgate/Carryseed. PayloadD separatefromstatusdecimal.',
    host_boundary:'Existing compileScriptFrame2E/36 areexplicitlyunsupported andstopbeforePC/stack/local/step-state changes. Sourceclosure doesnot authorizehostState stores or supplyphysicaloffset/PLA/DP/DBR/S/Statewrite/alias/refetch ownership, nativeTaskbytebridge orwhole9178 evidence. No runtimechanges ornativepromotion.',
    boundaries:'Two localsources closeonlytodynamicalF390. State-signextension, physicaltaskbytebridge, furtheropcode/native/stackmigration/return/originalinitialization remainseparate. FullC1CA/9178/BF3B/native/globalstack open.'}};
await writeFile('analysis/render-task-state-writes.json',JSON.stringify(report,null,2)+'\n');
await writeFile('analysis/render-task-state-writes.asm.txt',`; European ROM SHA-256 ${metadata.rom_sha256}\n; FullWORD offset/PLA before BYTE orWORD State stores; actualSEP20/REP20, ownpointer aliases thenfreshfetch. Dynamic return OPEN; no CPU execution.\n\n`+[...roots,fetch].map(formatBlock).join('\n'));
console.log(`Task state writes40/${map.size}; fullWORD offset/PLA thenBYTE/WORD stores, ownpointer alias/freshfetch; full dynamic graph OPEN.`);
