import {cpuLabel} from './rom.mjs';
import {renderAddress} from '../src/render/data.mjs';
// Fixed ROM lemmas and pure supplied WORD/address consequences, no memory/CPU runner.
const specs=new Map([
  [0x80F3C6,{kind:'2C',width:1,pop:0x80F3CD,store:0x80F3D0,body:[[0x80F3C6,'B100'],[0x80F3C8,'C8'],[0x80F3C9,'29FF00'],[0x80F3CC,'AA'],[0x80F3CD,'68'],[0x80F3CE,'E220'],[0x80F3D0,'9513'],[0x80F3D2,'C220'],[0x80F3D4,'4C89F3']]}],
  [0x80F3D7,{kind:'34',width:2,pop:0x80F3DE,store:0x80F3DF,body:[[0x80F3D7,'B100'],[0x80F3D9,'C8'],[0x80F3DA,'29FF00'],[0x80F3DD,'AA'],[0x80F3DE,'68'],[0x80F3DF,'9513'],[0x80F3E1,'4C89F3']]}]
]);
const fetch=[[0x80F389,'B100'],[0x80F38B,'C8'],[0x80F38C,'29FF00'],[0x80F38F,'AA'],[0x80F390,'7CB4F2']];
const signatures={'B100':['LDA','diy'],'C8':['INY','i'],'29FF00':['AND','immM'],'AA':['TAX','i'],
  '68':['PLA','i'],'E220':['SEP','imm8'],'C220':['REP','imm8'],'9513':['STA','dpx'],
  '4C89F3':['JMP','abs'],'7CB4F2':['JMP','indx']};
const word=v=>Number.isInteger(v)&&v>=0&&v<=65535;
function specFor(entry){const s=specs.get(entry);if(!s)throw Error('Invalid local write source entry');return s;}
function validate(map,spec){const all=[...spec.body,...fetch];let m=0;
  for(const [pc,raw]of all){const i=map.get(pc),b=Buffer.from(raw,'hex'),[op,mode]=signatures[raw],length=b.length;
    const value=length===1?0:b.readUIntLE(1,length-1),next=pc+length,target=op==='JMP'&&mode==='abs'?0x80F389:undefined;
    if(!i||i.cpu!==pc||i.opcode!==b[0]||i.mnemonic!==op||i.mode!==mode||i.value!==value||i.target!==target
      ||i.length!==length||i.next!==next||!i.raw.equals(b))throw Error('Renew local write source lemma '+cpuLabel(pc));
    if(i.state?.e!==0||i.state?.x!==0||i.state?.m!==m)throw Error('Local write requires actual E0/X0 and SEP20/REP20 M path');
    if(pc!==0x80F390&&!all.some(([source])=>source===(op==='JMP'?target:next)))throw Error('Uncovered local write source edge');
    if(op==='SEP')m=1;if(op==='REP')m=0;
  }return all;
}
export function proveLocalWriteToDispatch(map,entry){const spec=specFor(entry),all=validate(map,spec);
  return {entry:cpuLabel(entry),opcode_kind:spec.kind,source_closed_to_dispatch:true,native_binding:false,
    reachable_instructions:all.length,visited:all.map(([pc])=>cpuLabel(pc)),outer_return_frames_added:0,operand_words_removed:1,
    operand_s_delta:2,required_readable_operand_stack_bytes:2,required_writable_operand_stack_bytes:0,minimum_protected_stack_bytes:null,
    decimal_flag_required:null,external_return_assumptions:0,index_operand_bytes_consumed:1,local_write_bytes:spec.width,
    reads:[{at:cpuLabel(entry),kind:'index-operand',bytes:2,highbyte_required:true,
      pointer:'fresh bank00:D/D+1',data:'full WORD actualDBR:pointer+entryY, then WORD INY/AND00FF/TAX; X=operandLow'},
      {at:cpuLabel(spec.pop),kind:'operand-stack',bytes:2,highbyte_required:true,
        address:'bank00:(entryS+1)&FFFF low then (entryS+2)&FFFF high; full WORD latched before local store; S+2'},
      {at:'80:F389',kind:'next-opcode',bytes:2,highbyte_required:true,after_local_store:true,
        pointer:'fresh bank00:D/D+1 after all local writes',data:'full WORD actualDBR:freshPointer+updatedY; ignored opcodeHigh still read'}],
    local_reads:[],local_writes:Array.from({length:spec.width},(_,n)=>({at:cpuLabel(spec.store),order:n+1,byte:n?'original popped highbyte':'original popped lowbyte',
      address:n?'bank00:(D+13+operandLow+1)&FFFF':'bank00:(D+13+operandLow)&FFFF'})),
    width_path:spec.width===1?'WORD index and PLA; SEP20; BYTE STA13,X; REP20; WORD fetch':'WORD index/PLA/STA13,X/fetch throughout',
    a_before_next_fetch:'Full popped WORD, including high A retained across SEP20/STA/REP20 at2C',
    x_before_next_fetch:'full WORD X=original index operandLow, no ASL/parity/offset clamp',
    y_delta_before_next_opcode:1,y_delta_at_frontier:2,saved_frame_cursor_write:false,
    output_mode:{e:0,m:0,x:0,d:'entry payload D',dbr:'entry actual DBR'},
    frontier:{at:'80:F390',kind:'indexed-opcode-JMP',a:'Fresh next-opcode lowbyte',x:'Fresh next-opcode lowbyte',
      target:'80:WORD(80:F2B4+X), no ASL/parity/ID clamp; next handler remains source-required'},
    flags:'PLA/LDA/AND/TAX/INY update N/Z only; STA/JMP preserve flags. SEP20/REP20 change only M, no clearing high A or refreshing N/Z. C/V/I/decimal unchanged. Final N0/Z(nextOpcodeLow==0), E0/M0/X0.',
    qualification:'Two straight JMP sources to actual F390 only; WORD reads before local stores, no local preread or stack writes. Own header D+00..12 disjoint from local D+13+LowX (and WORD high) modulo65536. Other owners/aliases and intact code/outerstack explicit; no global minimum, capacity/initialization guard or task/native/device execution.'};
}
export function localWriteWordConsequence({entry,indexWord,stackWord}){
  const spec=specFor(entry);if(!word(indexWord)||!word(stackWord))throw Error('Explicit index/stack WORDs required');
  return {index:indexWord%256,write_value:spec.width===1?stackWord%256:stackWord,write_bytes:spec.width,a_before_next_fetch:stackWord};
}
export function describeLocalWriteByteOwners({entry,d,bank,s,y,pointerBefore,pointerAfter,indexWord,stackWord}){
  const spec=specFor(entry);if(![d,s,y,pointerBefore,pointerAfter].every(word)||!Number.isInteger(bank)||bank<0||bank>255)throw Error('Explicit local write address context required');
  const c=localWriteWordConsequence({entry,indexWord,stackWord});
  const owner=a=>({address:cpuLabel(a),physical_address:renderAddress(a)===null?null:cpuLabel(renderAddress(a))});
  const source=(pointer,atY)=>{const a=(bank*65536+pointer+atY)&0xFFFFFF;return {pointer_reads:[owner(d),owner((d+1)&65535)],word_reads:[owner(a),owner((a+1)&0xFFFFFF)]};};
  const indexSources=source(pointerBefore,y),nextY=(y+1)&65535,local=(d+0x13+c.index)&65535;
  const stackReads=[owner((s+1)&65535),owner((s+2)&65535)],localWrites=Array.from({length:spec.width},(_,n)=>({
    ...owner((local+n)&65535),order:n+1,byte:n?'high':'low',value:n?Math.floor(stackWord/256):stackWord%256})),next=source(pointerAfter,nextY);
  return {entry:cpuLabel(entry),context:{d,bank,s,y,indexWord,stackWord},...c,operand_sources:indexSources,
    stack_sources:{at:cpuLabel(spec.pop),word_reads:stackReads},local_writes:localWrites,
    ordered_accesses:[{kind:'index-pointer',operation:'read',bytes:indexSources.pointer_reads},{kind:'index-WORD',operation:'read',bytes:indexSources.word_reads},
      {kind:'PLA-WORD',operation:'read',bytes:stackReads},...localWrites.map(b=>({kind:'local-'+b.byte,operation:'write',bytes:[b]})),
      {kind:'next-pointer',operation:'read',bytes:next.pointer_reads},{kind:'next-opcode-WORD',operation:'read',bytes:next.word_reads}],
    output_operand_s:(s+2)&65535,next_opcode_y:nextY,frontier_y:(nextY+1)&65535,next_opcode_sources:next,
    qualification:'Ordered pure supplied WORD/address equations only; no consistency with memory asserted. PLA Low/High before BYTE Low or WORD Low/High stores, fresh pointer/opcode afterwards. Bank00 DP/S wrap16bits; indexed stream wraps24bits. Physical mapping is not byte ownership, write permission, initialization or outerstack proof. No memory read/write, plan, commit, bus/device or CPU execution.'};
}
