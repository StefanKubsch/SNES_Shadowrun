import {readFile,writeFile} from 'node:fs/promises';
import {taskInterpreterSource} from './task-interpreter-source.mjs';
import {createHash} from 'node:crypto';
import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {decode,formatBlock} from './disassemble.mjs';
import {scriptOpcodes} from '../src/script/opcodes.mjs';
import {proveLocalWriteToDispatch,describeLocalWriteByteOwners} from './render-task-local-writes-source-proof.mjs';
const {bytes,metadata}=inspectRom(await readFile(process.argv[2]??'Shadowrun (E).smc'));
if(metadata.rom_sha256!=='91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690')throw Error('Wrong European ROM revision');
const sha=b=>createHash('sha256').update(b).digest('hex');
function block(name,entry,end){const instructions=[];let state={e:0,m:0,x:0};
  for(let pc=entry;pc<end;){const i=decode(bytes,pc,state);if(i.next>end)throw Error('Source window overflow');instructions.push(i);pc=i.next;
    if(['SEP','REP'].includes(i.mnemonic)){if(i.value!==0x20)throw Error('Unexpected status mask');state={...state,m:Number(i.mnemonic==='SEP')};}}
  if(state.m!==0)throw Error('WORD fetch mode not restored');
  return {name,entry,initialState:{e:0,m:0,x:0},instructions,stop:'Complete actual SEP20/REP20 width path to dynamic F390; no interpreter/native return inferred.'};}
const describe=b=>{const raw=Buffer.concat(b.instructions.map(i=>i.raw));return {name:b.name,entry:cpuLabel(b.entry),end_exclusive:cpuLabel(b.instructions.at(-1).next),covered_bytes:raw.length,instruction_count:b.instructions.length,sha256:sha(raw),machine_bytes:raw.toString('hex').toUpperCase()};};
const roots=[block('local2CF3C6',0x80F3C6,0x80F3D7),block('local34F3D7',0x80F3D7,0x80F3E4)];
const fetch=block('fetchF389',0x80F389,0x80F393),map=new Map([...roots,fetch].flatMap(b=>b.instructions.map(i=>[i.cpu,i])));
const previous=JSON.parse(await readFile('analysis/render-task-push.json','utf8')),visit=taskInterpreterSource(bytes);
const interpreter=visit.windows.find(w=>w.name==='interpreterF378');
if([previous,visit].some(r=>r.rom_sha256!==metadata.rom_sha256)||previous.windows.find(w=>w.name==='fetchF389').machine_bytes!==describe(fetch).machine_bytes
  ||interpreter.machine_bytes.slice(34)!==describe(fetch).machine_bytes)throw Error('Actual shared fetch source drift');
const dispatch_entries=[[0x2C,0x80F3C6],[0x34,0x80F3D7]].map(([opcode,entry])=>{
  const pc=0x80F2B4+opcode,off=cpuToOffset(pc,bytes.length),raw=bytes.subarray(off,off+2);
  if(raw.readUInt16LE()!==(entry&65535)||scriptOpcodes[opcode]?.handler!==(entry&65535)
    ||visit.dispatch.all_byte_opcode_targets[opcode].target!==cpuLabel(entry))throw Error('Original local write target drift');
  return {opcode,word_source:cpuLabel(pc),target:cpuLabel(entry),machine_bytes:raw.toString('hex').toUpperCase(),sha256:sha(raw)};
});
const report={rom_sha256:metadata.rom_sha256,progress_reference:'docs/PORTIERUNGSSTAND.json',
  processor_reference:{url:'https://www.westerndesigncenter.com/wdc/documentation/w65c816s.pdf',edition:'March 13, 2024',
    sections:['3.5.11/7.2 full D+offset+WORD-X; DirectX bytes within bank00',
      '3.5.13 native DP pointer and24bit indexed stream data','7.1/Table5-7 page41 WORD PLA low/high',
      'Table5-5 PLA N/Z; STA preserves flags; SEP20/REP20 change M only','7.23 hidden high A retained across M changes; 7.9 programbank indirect JMP'],
    qualification:'Instruction address/data/flag semantics only; no SNES device/timing/interrupt/scene evidence.'},
  scope:'Complete JMP-entered original2C/F3C6 and34/F3D7 local write sources through fresh F389 to dynamic F390. Full WORD index/PLA before BYTE or WORD local stores; actual SEP20/REP20 M path, bank00 DP13+LowX, fresh pointer/opcode. Pure supplied equations only; no CPU/memory/task/native/device execution inferred.',
  windows:[...roots,fetch].map(describe),dependencies:[{report:'analysis/render-task-push.json',window:previous.windows.find(w=>w.name==='fetchF389')},
    {report:'analysis/render-c1ca.json',window:interpreter,opcode_source_sha256:visit.dispatch.opcode_source.sha256}],dispatch_entries,
  source_graph:{source_closed_to_dispatch:true,full_graph_closed:false,native_binding:false,code_bytes:40,instructions:map.size,
    minimum_protected_stack_bytes:null,qualification:'40/21 deduplicated source; two straight paths14/12, bothS+2. Two readable operandbytes, no root JSR/global interpreter return proof.'},
  local_writes:roots.map(b=>proveLocalWriteToDispatch(map,b.entry)),
  synthetic_address_examples:[
    ['2C reads full stackWORD but writes onlylow',{entry:0x80F3C6,d:0x3D6,bank:0x9D,s:0x3F0,y:4,pointerBefore:0xA001,pointerAfter:0xA001,indexWord:0xFF01,stackWord:0xAB80}],
    ['34 stores overlap alreadyread operandbytes',{entry:0x80F3D7,d:0x3D6,bank:0x80,s:0x3E8,y:4,pointerBefore:0x1200,pointerAfter:0x1200,indexWord:0,stackWord:0x1234}],
    ['34 local highwrap staysbank00',{entry:0x80F3D7,d:0xFFEB,bank:0x9D,s:0xFFFF,y:0xFFFF,pointerBefore:0xA001,pointerAfter:0xA001,indexWord:1,stackWord:0xAA80}],
    ['2C overwrites nextopcode without readingold localhigh',{entry:0x80F3C6,d:0x3D6,bank:0x80,s:0x3F0,y:0,pointerBefore:0x3E8,pointerAfter:0x3E8,indexWord:0xFF00,stackWord:0xAB34}]
  ].map(([name,context])=>({name,...describeLocalWriteByteOwners(context)})),
  contract:{
    entry:'Actual original opcode JMP in programbank80, E0M0X0, full actual payloadD/DBR/operandS/WORD-Y, intact code/outerstack and real byte owners. IncomingA/X not payload assumptions. No root JSR/underflow/capacity/parity/ID/initialization guards; full WORD observations supplied explicitly.',
    index:'Both read fullWORD via freshbank00:D/D+1 pointer andactualDBR:pointer+Y includingignoredindexHigh. WORD INY once, AND00FF/TAX sets fullWORD X=operandLow0..255. No ASL/parity/offsetcap, evenodd or255 remainactualbyteoffsets; no hostcachedlocal/frame/index.',
    pop:'WORD PLA occurs before SEP/localstore: low atbank00:(entryS+1)&FFFF, high at(entryS+2)&FFFF, S+2. BOTH readable bytes mandatory evenfor2C BYTEstore. Full poppedWORD latched before allwrites evenwithlocal/stackalias. No PHA/stackstore/localpreread/extra operand orframe-returnpush.',
    stores:'2C SEP20 makes M1 for single BYTE STA13,X, then REP20 restores M0 beforefetch; X staysWORD. OnlypoppedLow written, no localHigh read/write orpreservationread, no zero/sign extension. HiddenhighA remainspoppedHigh, so fullA afterREP equalsfullpoppedWORD, notzeroextendedLow. 34 WORDSTA13,X writespoppedLow thenpoppedHigh. Bothstoreevenifsamevalue; no omittedwrite, RMW orlocalinitialization.',
    owners:'Localbytebase isbank00:(fullD+13hex+operandLow)&FFFF independentofDBR andS. WORDhigh at(base+1)&FFFF; 00FF->0100 isnotemulationpagewrap. Localreadpermission notneeded forplainSTA; one/tworealwriteowners mandatory. Stack/index ignoredhighbytes andfreshopcodeHigh eachneedreadowners. Physicalmapping givesno writepermission, capacity, initialization orprotectedouterstack proof.',
    header_disjoint:'Local offsets13..112hex (WORD high through113hex) are disjointfromownframeheader00..12hex modulo65536, forallD and0..255indices. ThusownDP00/01pointer, framebank/PC/cursor/savedS/headercontrols are not overwritten bythese localstores, evenwithDwrap. This doesnotexcludeotherframes/controlbytes, operand/outerstack orstream/opcode aliases; frameboundaries/ownership stillrequired.',
    aliases:'BothfullindexWORD andPLAWORD reads precedealllocalstores; overlapmayrewritealreadypoppedbytes orfutureoperandbytes, othercontrol/outerstack ornextopcodebytes. LatchedX/poppedA arenotchangedbyoverlap. F389pointer/opcode arefreshafterstores; separate before/afterobservations do notassert externalchanges orownpointeroverwrite. Intactcode/outerstack andactualownersrequired, noautomaticframe7stores/memoryopening ordestructivealiasauthorization.',
    fetch:'Afteralllocalstores F389 rereadsbank00:D/D+1 pointer andfullWORD actualDBR:freshPointer+updatedY, includingignoredopcodeHigh. BothfetchY=(entryY+1)&FFFF, frontierY=(entryY+2)&FFFF. WORDLDA replacesfullpoppedA, thenINY/AND00FF/TAX: A/X=nextOpcodeLow,N0/Z(low==0),D/DBR/C/V/I/decimal preserved. JMP(80:F2B4+X) withoutASL/parity/IDclamp ornextbodyreturn.',
    flags:'PLA setsWORD N/Z (e.g.0100 Z0,8000 N1), notBYTE-low flags; SEP20/STA/REP20 preserveN/Z evenacrossM changes. SEP/REP mask20 changesonlyM, neverX/C/V/I/decimal/highA; noCLD/binary-onlypremise. F389 laterreplacesN/Z fromfreshopcodeLow. PayloadD separatefromstatusdecimal.',
    host_boundary:'Existing compileScriptFrame2C/34 areboundedhostlocal stores withsinglebyte indexread, arraystackpop, range/underflowguards andinitializedbyte marking; optionalHeapFrameStorage ownsitsseparatehostgeometry. BYTEstorewritesonlylow, WORDboth. Scalaragreement ondisjointsyntheticfixtures doesnot supplyoriginalindexHigh/PLAHigh, physicalD/DBR/S, chronologicalalias/refetch, capacity/initialization ornativebridge/whole9178 evidence. No runtimechanges.',
    boundaries:'Two local sources closeonlytoactualdynamicdispatch. Physicaltaskbytebridge, state/signextension/furtheropcode/native/stackmigration/return/originalinitialization remainseparate. FullC1CA/9178/BF3B/native/globalstack remainopen.'}};
await writeFile('analysis/render-task-local-writes.json',JSON.stringify(report,null,2)+'\n');
await writeFile('analysis/render-task-local-writes.asm.txt',`; European ROM SHA-256 ${metadata.rom_sha256}\n; Full WORD index/PLA before BYTE or WORD local stores; actual SEP20/REP20 path, fresh fetch. Dynamic dispatch/full return OPEN; no CPU execution.\n\n`+[...roots,fetch].map(formatBlock).join('\n'));
console.log(`Task local writes40/${map.size}; two paths, WORD PLA before BYTE/WORD stores, freshpointer; full dynamic graph OPEN.`);
