import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {decode,formatBlock} from './disassemble.mjs';
import {scriptOpcodes} from '../src/script/opcodes.mjs';
import {provePushToDispatch,describePushByteOwners} from './render-task-push-source-proof.mjs';
const {bytes,metadata}=inspectRom(await readFile(process.argv[2]??'Shadowrun (E).smc'));
if(metadata.rom_sha256!=='91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690')throw Error('Wrong European ROM revision');
const sha=b=>createHash('sha256').update(b).digest('hex');
function block(name,entry,end){const instructions=[];for(let pc=entry;pc<end;){const i=decode(bytes,pc,{e:0,m:0,x:0});if(i.next>end)throw Error('Source window overflow');instructions.push(i);pc=i.next;}
  return {name,entry,initialState:{e:0,m:0,x:0},instructions,stop:'Complete fixed WORD source to actual F390 dynamic opcode edge; no handler/native/interpreter return inferred.'};}
const describe=b=>{const raw=Buffer.concat(b.instructions.map(i=>i.raw));return {name:b.name,entry:cpuLabel(b.entry),end_exclusive:cpuLabel(b.instructions.at(-1).next),covered_bytes:raw.length,instruction_count:b.instructions.length,sha256:sha(raw),machine_bytes:raw.toString('hex').toUpperCase()};};
const roots=[block('pushZeroF393',0x80F393,0x80F398),block('pushU8F398',0x80F398,0x80F3A1),block('pushU16F3B1',0x80F3B1,0x80F3B9)];
const fetch=block('fetchF389',0x80F389,0x80F393),map=new Map([...roots,fetch].flatMap(b=>b.instructions.map(i=>[i.cpu,i])));
const owner=taskInterpreterSource(bytes),interpreter=owner.windows.find(w=>w.name==='interpreterF378');
if(owner.rom_sha256!==metadata.rom_sha256||!interpreter||interpreter.machine_bytes.slice((0x80F389-0x80F378)*2)!==describe(fetch).machine_bytes)throw Error('Actual interpreter fetch drift');
const rawTable=bytes.subarray(cpuToOffset(0x80F2B4,bytes.length),cpuToOffset(0x80F3B5,bytes.length));
if(owner.dispatch.opcode_source.machine_bytes!==rawTable.toString('hex').toUpperCase())throw Error('Opcode source drift');
const entries=[[0xC0,0x80F393],[0x00,0x80F398],[0x14,0x80F3B1]],dispatch_entries=entries.map(([opcode,entry])=>{
  const pc=0x80F2B4+opcode,off=cpuToOffset(pc,bytes.length),raw=bytes.subarray(off,off+2);
  if(bytes.readUInt16LE(off)!==(entry&65535)||scriptOpcodes[opcode]?.handler!==(entry&65535))throw Error('Original push target drift');
  return {opcode,word_source:cpuLabel(pc),target:cpuLabel(entry),machine_bytes:raw.toString('hex').toUpperCase(),sha256:sha(raw)};
});
const proofs=entries.map(([,entry])=>provePushToDispatch(map,entry));
const report={rom_sha256:metadata.rom_sha256,progress_reference:'docs/PORTIERUNGSSTAND.json',
  processor_reference:{url:'https://www.westerndesigncenter.com/wdc/documentation/w65c816s.pdf',edition:'March 13, 2024',
    sections:['2.11/3.5.22/7.1 native bank00 stack','3.5.13/7.2 native DP pointer and24bit indexed data','Table5-7 page41 rows22c/22d high-first PHA/PEA','7.9 JMP(a,x) pointer uses programbank'],
    qualification:'Instruction address/data semantics only, not SNES memory/device/timing or ROM scene evidence.'},
  scope:'Complete F393/F398/F3B1 JMP-entered push source and actual F389 refetch to dynamic F390. Symbolic WORD data/operand-byte/flag/mode and fresh pointer contracts; concrete address equations only. No CPU/memory/device/native/interpreter execution.',
  windows:[...roots,fetch].map(describe),dependencies:[{report:'analysis/render-c1ca.json',window:interpreter,reused_window:describe(fetch),opcode_source_sha256:sha(rawTable)}],
  dispatch_entries,source_graph:{source_closed_to_dispatch:true,full_graph_closed:false,native_binding:false,code_bytes:32,instructions:map.size,
    minimum_protected_stack_bytes:null,qualification:'32/17 deduplicated source, no root JSR. Each entry adds two operand stackbytes and reaches actual dynamic edge; no wholeinterpreter stack/return proof.'},
  primitives:proofs,
  synthetic_address_examples:[
    ['disjoint WORD context',{entry:0x80F3B1,d:0x03D6,bank:0x9D,s:0x03F0,y:0,pointerBefore:0xA001,pointerAfter:0xA001}],
    ['BYTE Ywrap and bank carry',{entry:0x80F398,d:0xFFFF,bank:0x9D,s:1,y:0xFFFF,pointerBefore:0xFFFF,pointerAfter:0x8000}],
    ['push overwrites pointer',{entry:0x80F3B1,d:0x03D6,bank:0x80,s:0x03D7,y:4,pointerBefore:0x1200,pointerAfter:0x1234}],
    ['stack outside known WRAM',{entry:0x80F393,d:0x03D6,bank:0x9D,s:0x8000,y:0,pointerAfter:0xA001}]
  ].map(([name,context])=>({name,...describePushByteOwners(context)})),
  contract:{
    entry:'Actual opcode JMP entry in programbank80, E0M0X0, full payloadD/actualDBR/operandS/WORD-Y. Y already advanced by previous opcode fetch; incoming A/X not payload data assumptions. No root JSR or return frame added. D/DBR and statusC/V/I/decimal preserved; no binary-only arithmetic premise for these handlers.',
    zero:'F393 PEA0000 pushes two zeroBYTES, high first at bank00:S, low second at bank00:(S-1)&FFFF; S becomes(S-2)&FFFF. No operandpointer/data read, no extraY increment before BRA actualF389. PEA does not infer valid writable stack/frame bytes.',
    byte:'F398 reads fullWORD via freshbank00:D+00/D+01 pointer and actualDBR:pointer+Y; ignoredhigh still required. WORD-INY once; AND00FF, WORD-PHA zeroHigh/operandLow in actual bank00:S/S-1 order. No BYTE-mode push or cached next-opcode highbyte.',
    word:'F3B1 fresh fullWORD via currentDP00/Y, twoWORD-INYs beforeWORD-PHA originalHigh/Low. Then actualJMPF389; no ID/cap/alignment or syntheticJSRreturn. OperandY and S wrap independently16bit.',
    fetch:'All paths execute actualF389: fresh currentpointer after push, fresh fullWORD opcode via actualDBR:pointer+updatedY; INY, WORDAND00FF, TAX and JMP(80:F2B4+X) withoutASL. A/X freshopcodeLow, finalN0/Z(low==0), finalY=incomingY+operandwidth+1 modulo65536. Both opcodeWORDbytes and original tableWORDbytes needed. Dynamic nexttarget unknown until supplied; no full return assumption.',
    stack_owner:'Two ordered actual bank00 stackstores, not a protected root-call frame. Real byte owner/window must cover both high/low locations and preserve code, outerreturnstack and required data sources. Native S0/S1 wraps; bank00 aboveWRAM can be IO/ROM/unsupported mapping, no write/memory/device effect inferred. Frame7 savedcursor is not explicitly rewritten by push; physical overlap may still modify it or any metadata.',
    aliases:'OperandWORD read precedes both stackstores; next pointer/read follows them. Stores may overwrite bank00:D+00/D+01, framebank/PC/S fields, later source bytes, globals or savedouterS. Fresh next pointer must reflect actual physical writes, not cached operandpointer. Canonicaladdress equations reuse existing renderAddress mapping only, no render owner joined to task/heap owners or write approval.',
    frame_provenance:'F378 obtains D from freshactualDBR0252+X, framebank via PEI01/twoPLBs, operandS from freshDP07 andY fromfreshDP03. Existing C2C8 writes originalframe7 andarguments under actualproducerDBR; only supplied physical ownership proves those writes are the consumer sources. No manufacturedinitializedframe/S/PC/script or nominalprofile byte capacity assumed.',
    host_boundary:'stepStackPrimitive uses bounded bytecode/arraywords, returnsPC at next opcode before fetch; source F390 Y is already past that nextopcode. HeapFrameStorage writes known payload words with metadata/local/stack window guards. Those are intentional host coverage limits, not originalcaps. Full ignoredBYTEoperand highread, WORDwrap, physical alias/refetch and arbitrary machineS/DBR/source ownership are not supplied by these APIs.',
    boundaries:'Three local push sources closed to actualdispatch; underlying live byte owners/write windows and complete opcode/native/stackmigration/return graph remain separate. C1CA/9178/BF3B full_graph staysopen, no global stack minimum or new native binding. Original initialization/scenes/CPU/devices/interrupt/frame execution not promoted.'}};
await writeFile('analysis/render-task-push.json',JSON.stringify(report,null,2)+'\n');
await writeFile('analysis/render-task-push.asm.txt',`; European ROM SHA-256 ${metadata.rom_sha256}\n; JMP-entered WORD push sources, actual fresh refetch, dynamic dispatch remains open. No CPU execution.\n\n`+[...roots,fetch].map(formatBlock).join('\n'));
console.log(`Task push source32/${map.size}; entries ${proofs.map(p=>p.reachable_instructions).join('/')}; operand bytes2 each, zero outerreturnframes; full dynamic graph OPEN.`);
import {taskInterpreterSource} from './task-interpreter-source.mjs';
