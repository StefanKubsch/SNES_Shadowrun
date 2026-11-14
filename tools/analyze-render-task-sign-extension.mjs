import {readFile,writeFile} from 'node:fs/promises';
import {taskInterpreterSource} from './task-interpreter-source.mjs';
import {createHash} from 'node:crypto';
import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {decode,formatBlock} from './disassemble.mjs';
import {scriptOpcodes} from '../src/script/opcodes.mjs';
import {proveSignExtensionToDispatch,describeSignExtensionByteOwners} from './render-task-sign-extension-source-proof.mjs';
const {bytes,metadata}=inspectRom(await readFile(process.argv[2]??'Shadowrun (E).smc'));
if(metadata.rom_sha256!=='91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690')throw Error('Wrong European ROM revision');
const sha=b=>createHash('sha256').update(b).digest('hex');
function block(name,entry,end){const instructions=[];for(let pc=entry;pc<end;){const i=decode(bytes,pc,{e:0,m:0,x:0});if(i.next>end)throw Error('Source window overflow');instructions.push(i);pc=i.next;}
  return {name,entry,initialState:{e:0,m:0,x:0},instructions,stop:'Complete fixed WORD source through both CMP/BCC paths to dynamic F390; no interpreter/native return inferred.'};}
const describe=b=>{const raw=Buffer.concat(b.instructions.map(i=>i.raw));return {name:b.name,entry:cpuLabel(b.entry),end_exclusive:cpuLabel(b.instructions.at(-1).next),covered_bytes:raw.length,instruction_count:b.instructions.length,sha256:sha(raw),machine_bytes:raw.toString('hex').toUpperCase()};};
const roots=[block('sign0AF3F6',0x80F3F6,0x80F408),block('sign0CF408',0x80F408,0x80F420)];
const fetch=block('fetchF389',0x80F389,0x80F393),map=new Map([...roots,fetch].flatMap(b=>b.instructions.map(i=>[i.cpu,i])));
const push=JSON.parse(await readFile('analysis/render-task-push.json','utf8')),visit=taskInterpreterSource(bytes);
const interpreter=visit.windows.find(w=>w.name==='interpreterF378');
if([push,visit].some(r=>r.rom_sha256!==metadata.rom_sha256)||push.windows.find(w=>w.name==='fetchF389').machine_bytes!==describe(fetch).machine_bytes
  ||interpreter.machine_bytes.slice(34)!==describe(fetch).machine_bytes)throw Error('Actual shared fetch source drift');
const dispatch_entries=[[0x0A,0x80F3F6],[0x0C,0x80F408]].map(([opcode,entry])=>{
  const pc=0x80F2B4+opcode,off=cpuToOffset(pc,bytes.length),raw=bytes.subarray(off,off+2);
  if(raw.readUInt16LE()!==(entry&65535)||scriptOpcodes[opcode]?.handler!==(entry&65535)
    ||visit.dispatch.all_byte_opcode_targets[opcode].target!==cpuLabel(entry))throw Error('Original sign extension target drift');
  return {opcode,word_source:cpuLabel(pc),target:cpuLabel(entry),machine_bytes:raw.toString('hex').toUpperCase(),sha256:sha(raw)};
});
const report={rom_sha256:metadata.rom_sha256,progress_reference:'docs/PORTIERUNGSSTAND.json',
  processor_reference:{url:'https://www.westerndesigncenter.com/wdc/documentation/w65c816s.pdf',edition:'March 13, 2024',
    sections:['3.5.11/7.2 full D+offset+WORD X; native bank00 wrap','3.5.13 native DP pointer and24bit indexed data',
      '7.1/Table5-7 WORD PHA high/low','Table5-5 CMP N/Z/C preservesA/V; BCC Carry0; ORA N/Z preservesC/V; PHA flags preserved','7.9 indirect JMP programbank'],
    qualification:'Instruction data/address/flag semantics only; no SNES device/timing/interrupt/scene evidence.'},
  scope:'Complete original0A/F3F6 immediate and0C/F408 local BYTE sign-extension JMP sources through fresh F389 to dynamic F390. Full WORD reads before AND00FF/CMP0080/BCC/optional ORAFF00; PHA high/low, actual Carry and separate pre-PHA versus frontier N/Z. Pure supplied equations only; no CPU/memory/task/native execution.',
  windows:[...roots,fetch].map(describe),dependencies:[{report:'analysis/render-task-push.json',window:push.windows.find(w=>w.name==='fetchF389')},
    {report:'analysis/render-c1ca.json',window:interpreter,opcode_source_sha256:visit.dispatch.opcode_source.sha256}],dispatch_entries,
  source_graph:{source_closed_to_dispatch:true,full_graph_closed:false,native_binding:false,code_bytes:52,instructions:map.size,
    minimum_protected_stack_bytes:null,qualification:'52/24 deduplicated source; four finite paths12/13 and15/16, allS-2. Two writable operandbytes; no root JSR/global interpreter return proof.'},
  sign_extensions:roots.map(b=>proveSignExtensionToDispatch(map,b.entry)),
  synthetic_address_examples:[
    ['0A positivezero still N1/Z0 atPHA fromCMP',{entry:0x80F3F6,d:0x3D6,bank:0x9D,s:0x3F0,y:4,pointerBefore:0xA001,pointerAfter:0xA001,operandWord:0xAB00}],
    ['0A negative PHA replaces ownpointer before freshfetch',{entry:0x80F3F6,d:0x3D6,bank:0x80,s:0x3D7,y:4,pointerBefore:0x1200,pointerAfter:0xFF80,operandWord:0x0080}],
    ['0C localhigh bank00wrap andindexYwrap',{entry:0x80F408,d:0xFFEB,bank:0x9D,s:1,y:0xFFFF,pointerBefore:0xA001,pointerAfter:0xA001,operandWord:0xFF01,localWord:0xAA80}],
    ['0C ignoredlocalhigh still requires ownreadowner',{entry:0x80F408,d:0x1FEB,bank:0x9D,s:0x3F0,y:4,pointerBefore:0xA001,pointerAfter:0xA001,operandWord:1,localWord:0xBB7F}]
  ].map(([name,context])=>({name,...describeSignExtensionByteOwners(context)})),
  contract:{
    entry:'Actual original opcode JMP programbank80, E0M0X0, full actual payloadD/DBR/operandS/WORD-Y, intactcode/outerstack andreal byte owners. No rootJSR/stackunderflow/capacity/parity/ID/initialization guard; full WORD observations explicit.',
    immediate:'0A reads full WORD via fresh bank00:D/D+1 andactualDBR:pointer+Y, includingignoredHigh; INYonce thenWORDAND00FF. MaskedoperandLow isdata; noTAX/localread beforefetch, entryX retained. No cachedimmediateBYTE shortcut.',
    local:'0C reads full WORDindex via samefreshpointer/actualDBR/Y; INYonce, WORDAND00FF/TAX setsfullX=indexLow0..255. WORDLDA13,X readsbank00:(fullD+13hex+indexLow)&FFFF low/high, THEN WORDAND00FF. Local/index ignoredhigh need realreadowners. FullDL/odd/FF offsets, noASL/clamp/hostcachedlocal/frame/initialization.',
    comparison:'Both WORDCMP0080 afterdatamask, so incomingfullHigh neverselectssign. CMPpreservesA/V, result=(dataLow-0080)&FFFF; C1 iff dataLow>=80 independentofincomingC/decimal. BCC Carry0 skipsORA andpushes00xx for00..7F; Carry1 executesWORDORAFF00 andpushesFFxx for80..FF. ORA/PHA preserveactualCMP-Carry/V. No BMI/signedWORD gate/XBA/SEP/CLD orsyntheticCarryseed.',
    push_flags:'Pre-PHA N1/Z0 onBOTH paths: Carry0 WORDCMP resultFF80..FFFF setsN1/Z0 evenwhenpusheddata0000..007F; noORA torefresh. Carry1 CMP result0000..007F (Z1 at80), thenORAFF00 replacesN/Z toN1/Z0. PHA preservesflags, so derivingPHA-N/Z frompushedWORD iswrongonpositivepath. IncomingV preservedthroughCMP/ORA, decimalalso.',
    stack:'ExactlyoneWORDPHA highfirstatbank00:entryS, lowsecondat(entryS-1)&FFFF, S-2. High00 iffdataLow<80 elseFF, loworiginaldataLow. NoPLA/stackread/localstore/extrareturnframe; twoactualwriteowners notglobalstackminima. S/addresswrap16bits, native00FF->0100 notemulationpagewrap.',
    aliases:'Allactualimmediate/index/localWORDreads precedebothPHAwrites; valueslatched evenifstackoverwriteslocal/sourcebytes. PHA may overwriteownDP00pointer/framebank/PC/cursor/savedS/control, operand/outerstack ornextopcodebytes; realowners/intactcode/outerstack remainrequired. Laterpointer/opcode freshafterbothwrites, notcachedindexpointer/prestoreopcode. Noautomaticframe7store/memoryopening/initialization/destructivealiasauthorization.',
    fetch:'F389 reads freshbank00:D/D+1 andfullWORD actualDBR:freshPointer+updatedY includingignoredopcodeHigh. BothfetchY=(entryY+1)&FFFF, frontierY=(entryY+2)&FFFF. WORDLDA/INY/AND00FF/TAX givesA/X=nextOpcodeLow,N0/Z(low==0) with actualCMP-Carry preserved. D/DBR/V/I/decimal preserved, noCLD/binary-onlypremise. JMP(80:F2B4+X) noASL/parity/IDclamp ornextbodyreturn.',
    owners:'DP/local/stackbytes remainbank00 independentofDBR; streamWORD/nextfetch actualDBR canwrap24bits, D/S/Y separately16bits. Readmaskedhighbytes stillactualowners evenunmapped. Physicalmapping isnot owner/writepermission/initialization/intactframe proof. Pointerbefore/after are separate suppliedobservations, no memoryconsistency asserted.',
    host_boundary:'Existing compileScriptFrame0A/0C yieldsame signedscalarWORD ondisjointsyntheticfixtures butreadonlyBYTE operand/local anduseboundedinitializedhostlocals/arraystack. HostPC stopsbeforenextopcodefetch; noactualCMP-Carry/prePHA-NZ/WORDhigh/physicalD/DBR/S/aliaschronology/byteowners ornativebridge/whole9178 evidence. No runtimechanges.',
    boundaries:'Two localsources closeonlytodynamicalF390. Physicaltaskbytebridge, state/furtheropcode/native/stackmigration/return/originalinitialization remainseparate. FullC1CA/9178/BF3B/native/globalstack open.'}};
await writeFile('analysis/render-task-sign-extension.json',JSON.stringify(report,null,2)+'\n');
await writeFile('analysis/render-task-sign-extension.asm.txt',`; European ROM SHA-256 ${metadata.rom_sha256}\n; Full WORD reads before sign mask/CMP/BCC/ORA, PHA then freshfetch. Four paths; pre-PHA N1/Z0 onboth, Carry fromCMP. Dynamic return OPEN; no CPU execution.\n\n`+[...roots,fetch].map(formatBlock).join('\n'));
console.log(`Task sign extension52/${map.size}; fourpaths, CMP Carry, prePHA N1/Z0 then freshfetch; full dynamic graph OPEN.`);
