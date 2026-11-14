import {cpuLabel} from './rom.mjs';
import {renderAddress} from '../src/render/data.mjs';
// Fixed ROM lemmas and supplied pure WORD/address equations; no memory/CPU runner.
const specs=new Map([
  [0x80F8F1,{kind:'2E',width:1,pop:0x80F8F6,store:0x80F8F9,body:[[0x80F8F1,'B100'],[0x80F8F3,'C8'],[0x80F8F4,'C8'],[0x80F8F5,'AA'],[0x80F8F6,'68'],[0x80F8F7,'E220'],[0x80F8F9,'9F00007E'],[0x80F8FD,'C220'],[0x80F8FF,'4C89F3']]}],
  [0x80F902,{kind:'36',width:2,pop:0x80F907,store:0x80F908,body:[[0x80F902,'B100'],[0x80F904,'C8'],[0x80F905,'C8'],[0x80F906,'AA'],[0x80F907,'68'],[0x80F908,'9F00007E'],[0x80F90C,'4C89F3']]}]
]);
const fetch=[[0x80F389,'B100'],[0x80F38B,'C8'],[0x80F38C,'29FF00'],[0x80F38F,'AA'],[0x80F390,'7CB4F2']];
const signatures={'B100':['LDA','diy'],'C8':['INY','i'],'AA':['TAX','i'],'68':['PLA','i'],
  'E220':['SEP','imm8'],'C220':['REP','imm8'],'9F00007E':['STA','longx'],
  '29FF00':['AND','immM'],'4C89F3':['JMP','abs'],'7CB4F2':['JMP','indx']};
const word=v=>Number.isInteger(v)&&v>=0&&v<=65535;
function specFor(entry){const s=specs.get(entry);if(!s)throw Error('Invalid state write source entry');return s;}
function validate(map,spec){const all=[...spec.body,...fetch];let m=0;
  for(const [pc,raw]of all){const i=map.get(pc),b=Buffer.from(raw,'hex'),[op,mode]=signatures[raw],length=b.length;
    const value=length===1?0:b.readUIntLE(1,length-1),next=pc+length,target=op==='JMP'&&mode==='abs'?0x80F389:undefined;
    if(!i||i.cpu!==pc||i.opcode!==b[0]||i.mnemonic!==op||i.mode!==mode||i.value!==value||i.target!==target
      ||i.length!==length||i.next!==next||!i.raw.equals(b))throw Error('Renew state write source lemma '+cpuLabel(pc));
    if(i.state?.e!==0||i.state?.x!==0||i.state?.m!==m)throw Error('State write requires actual E0/X0 and SEP20/REP20 M path');
    if(pc!==0x80F390&&!all.some(([source])=>source===(op==='JMP'?target:next)))throw Error('Uncovered state write source edge');
    if(op==='SEP')m=1;if(op==='REP')m=0;
  }return all;
}
export function proveStateWriteToDispatch(map,entry){const spec=specFor(entry),all=validate(map,spec);
  return {entry:cpuLabel(entry),opcode_kind:spec.kind,source_closed_to_dispatch:true,native_binding:false,
    reachable_instructions:all.length,visited:all.map(([pc])=>cpuLabel(pc)),outer_return_frames_added:0,operand_words_removed:1,operand_s_delta:2,
    required_readable_operand_stack_bytes:2,required_writable_operand_stack_bytes:0,minimum_protected_stack_bytes:null,
    decimal_flag_required:null,external_return_assumptions:0,offset_operand_bytes_consumed:2,state_write_bytes:spec.width,
    reads:[{at:cpuLabel(entry),kind:'offset-operand',bytes:2,highbyte_required:true,
      pointer:'fresh bank00:D/D+1',data:'actualDBR:pointer+entryY full WORD; two WORD INY, full WORD TAX without mask/ASL/clamp'},
      {at:cpuLabel(spec.pop),kind:'operand-stack',bytes:2,highbyte_required:true,
        address:'bank00:(entryS+1)&FFFF low then (entryS+2)&FFFF high; full WORD latched before State store; S+2'},
      {at:'80:F389',kind:'next-opcode',bytes:2,highbyte_required:true,after_state_store:true,
        pointer:'fresh bank00:D/D+1 after all State writes, even when ownpointer was overwritten',data:'full WORD actualDBR:freshPointer+updatedY; ignoredopcodeHigh still read'}],
    state_reads:[],local_reads:[],state_writes:Array.from({length:spec.width},(_,n)=>({at:cpuLabel(spec.store),order:n+1,
      byte:n?'original popped highbyte':'original popped lowbyte',address:n?'24bit7E0000+full offsetWORD+1; atXFFFF high7F0000':'24bit7E0000+full offsetWORD'})),
    width_path:spec.width===1?'WORD offset/TAX/PLA; SEP20; BYTE STA7E0000,X; REP20; WORD fetch':'WORD offset/TAX/PLA/STA7E0000,X/fetch throughout',
    a_before_next_fetch:'Full popped WORD, including high A retained across SEP20/STA/REP20 at2E',
    x_before_next_fetch:'full original offsetWORD0..FFFF, no lowmask/ASL/parity/address clamp',
    y_delta_before_next_opcode:2,y_delta_at_frontier:3,saved_frame_cursor_write:false,
    output_mode:{e:0,m:0,x:0,d:'entry payload D',dbr:'entry actual DBR'},
    frontier:{at:'80:F390',kind:'indexed-opcode-JMP',a:'Fresh next-opcode lowbyte',x:'Fresh next-opcode lowbyte',
      target:'80:WORD(80:F2B4+X), no ASL/parity/ID clamp; next handler remains source-required'},
    flags:'PLA/LDA/TAX/INY update N/Z only; STA/JMP preserve flags. SEP20/REP20 change only M, high A and WORD PLA N/Z retained until fetch. C/V/I/decimal/D/DBR unchanged; final N0/Z(nextOpcodeLow==0), E0/M0/X0.',
    qualification:'Two straight JMP sources to dynamic F390 only; full offset/PLA reads before State stores, no State/local preread or PHA/stackstore instruction. State stores may alias own bank00 WRAM pointer/header/control/stack/opcode; real owners and intact code/outerstack required. No global minimum/capacity/initialization/task/native/device proof.'};
}
export function stateWriteWordConsequence({entry,offsetWord,stackWord}){
  const spec=specFor(entry);if(!word(offsetWord)||!word(stackWord))throw Error('Explicit offset/stack WORDs required');
  return {index:offsetWord,write_value:spec.width===1?stackWord%256:stackWord,write_bytes:spec.width,a_before_next_fetch:stackWord};
}
export function describeStateWriteByteOwners({entry,d,bank,s,y,pointerBefore,pointerAfter,offsetWord,stackWord}){
  const spec=specFor(entry);if(![d,s,y,pointerBefore,pointerAfter].every(word)||!Number.isInteger(bank)||bank<0||bank>255)throw Error('Explicit state write address context required');
  const c=stateWriteWordConsequence({entry,offsetWord,stackWord});
  const owner=a=>({address:cpuLabel(a),physical_address:renderAddress(a)===null?null:cpuLabel(renderAddress(a))});
  const source=(pointer,atY)=>{const a=(bank*65536+pointer+atY)&0xFFFFFF;return {pointer_reads:[owner(d),owner((d+1)&65535)],word_reads:[owner(a),owner((a+1)&0xFFFFFF)]};};
  const operand=source(pointerBefore,y),nextY=(y+2)&65535,state=0x7E0000+c.index;
  const stackReads=[owner((s+1)&65535),owner((s+2)&65535)],stateWrites=Array.from({length:spec.width},(_,n)=>({
    ...owner(state+n),order:n+1,byte:n?'high':'low',value:n?Math.floor(stackWord/256):stackWord%256})),next=source(pointerAfter,nextY);
  return {entry:cpuLabel(entry),context:{d,bank,s,y,offsetWord,stackWord},...c,operand_sources:operand,
    stack_sources:{at:cpuLabel(spec.pop),word_reads:stackReads},state_writes:stateWrites,
    ordered_accesses:[{kind:'offset-pointer',operation:'read',bytes:operand.pointer_reads},{kind:'offset-WORD',operation:'read',bytes:operand.word_reads},
      {kind:'PLA-WORD',operation:'read',bytes:stackReads},...stateWrites.map(b=>({kind:'state-'+b.byte,operation:'write',bytes:[b]})),
      {kind:'next-pointer',operation:'read',bytes:next.pointer_reads},{kind:'next-opcode-WORD',operation:'read',bytes:next.word_reads}],
    output_operand_s:(s+2)&65535,next_opcode_y:nextY,frontier_y:(nextY+1)&65535,next_opcode_sources:next,
    qualification:'Ordered pure supplied WORD/address equations; observations not checked against memory. PLA Low/High before BYTE Low or WORD Low/High State stores, fresh pointer/opcode afterwards. State7E0000+fullX is24bit including high7F0000 atXFFFF; DP/S bank00 wrap16bits, stream24bit/Y16bit. Physical mapping is not ownership, permission, initialization or outerstack proof. No memory read/write, plan, commit, bus/device or CPU execution.'};
}
