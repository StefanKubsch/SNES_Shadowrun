import {cpuLabel} from './rom.mjs';
import {renderAddress} from '../src/render/data.mjs';
// Fixed ROM lemmas and supplied pure WORD/address equations; no memory/CPU runner.
const specs=new Map([
  [0x80F8D4,{kind:'04',byte:true,read:0x80F8D9,push:0x80F8E0,body:[[0x80F8D4,'B100'],[0x80F8D6,'C8'],[0x80F8D7,'C8'],[0x80F8D8,'AA'],[0x80F8D9,'BF00007E'],[0x80F8DD,'29FF00'],[0x80F8E0,'48'],[0x80F8E1,'4C89F3']]}],
  [0x80F8E4,{kind:'18',byte:false,read:0x80F8E9,push:0x80F8ED,body:[[0x80F8E4,'B100'],[0x80F8E6,'C8'],[0x80F8E7,'C8'],[0x80F8E8,'AA'],[0x80F8E9,'BF00007E'],[0x80F8ED,'48'],[0x80F8EE,'4C89F3']]}]
]);
const fetch=[[0x80F389,'B100'],[0x80F38B,'C8'],[0x80F38C,'29FF00'],[0x80F38F,'AA'],[0x80F390,'7CB4F2']];
const signatures={'B100':['LDA','diy'],'C8':['INY','i'],'AA':['TAX','i'],'BF00007E':['LDA','longx'],
  '29FF00':['AND','immM'],'48':['PHA','i'],'4C89F3':['JMP','abs'],'7CB4F2':['JMP','indx']};
const word=v=>Number.isInteger(v)&&v>=0&&v<=65535;
function specFor(entry){const s=specs.get(entry);if(!s)throw Error('Invalid state read source entry');return s;}
function validate(map,spec){const all=[...spec.body,...fetch];
  for(const [pc,raw]of all){const i=map.get(pc),b=Buffer.from(raw,'hex'),[op,mode]=signatures[raw],length=b.length;
    const value=length===1?0:b.readUIntLE(1,length-1),next=pc+length,target=op==='JMP'&&mode==='abs'?0x80F389:undefined;
    if(!i||i.cpu!==pc||i.opcode!==b[0]||i.mnemonic!==op||i.mode!==mode||i.value!==value||i.target!==target
      ||i.length!==length||i.next!==next||!i.raw.equals(b))throw Error('Renew state read source lemma '+cpuLabel(pc));
    if(['e','m','x'].some(f=>i.state?.[f]!==0))throw Error('State read requires explicit E0M0X0');
    if(pc!==0x80F390&&!all.some(([source])=>source===(op==='JMP'?target:next)))throw Error('Uncovered state read source edge');
  }return all;
}
export function proveStateReadToDispatch(map,entry){const spec=specFor(entry),all=validate(map,spec);
  return {entry:cpuLabel(entry),opcode_kind:spec.kind,source_closed_to_dispatch:true,native_binding:false,
    reachable_instructions:all.length,visited:all.map(([pc])=>cpuLabel(pc)),outer_return_frames_added:0,operand_words_added:1,operand_s_delta:-2,
    required_readable_operand_stack_bytes:0,required_writable_operand_stack_bytes:2,minimum_protected_stack_bytes:null,
    decimal_flag_required:null,external_return_assumptions:0,offset_operand_bytes_consumed:2,
    reads:[{at:cpuLabel(entry),kind:'offset-operand',bytes:2,highbyte_required:true,
      pointer:'fresh bank00:D/D+1',data:'actualDBR:pointer+entryY full WORD; two WORD INY, full WORD TAX, no low mask/ASL/clamp'},
      {at:cpuLabel(spec.read),kind:'state',bytes:2,highbyte_required:true,mode:'longx',
        address:'24bit 7E0000+full offsetWORD; high atbase+1, XFFFF reads7E:FFFF/7F:0000',
        mask_after_read:spec.byte?'WORD AND00FF; zeroextend stateLow after both reads':'none; full stateWORD retained'},
      {at:'80:F389',kind:'next-opcode',bytes:2,highbyte_required:true,after_push:true,
        pointer:'fresh bank00:D/D+1 after both PHA writes',data:'actualDBR:freshPointer+updatedY full WORD including ignored opcodeHigh'}],
    local_reads:[],state_writes:[],
    stack_writes:[{at:cpuLabel(spec.push),order:1,byte:spec.byte?'00':'original stateHigh',address:'bank00:entryS'},
      {at:cpuLabel(spec.push),order:2,byte:'original stateLow',address:'bank00:(entryS-1)&FFFF'}],
    x_before_next_fetch:'full original offsetWORD0..FFFF, no ASL/parity/lowbyte/address clamp',
    y_delta_before_next_opcode:2,y_delta_at_frontier:3,saved_frame_cursor_write:false,
    output_mode:{e:0,m:0,x:0,d:'entry payload D',dbr:'entry actual DBR'},
    frontier:{at:'80:F390',kind:'indexed-opcode-JMP',a:'Fresh next-opcode lowbyte',x:'Fresh next-opcode lowbyte',
      target:'80:WORD(80:F2B4+X), no ASL/parity/ID clamp; next handler remains source-required'},
    flags:'LDA/AND/TAX/INY update N/Z only; PHA/JMP preserve flags. C/V/I/decimal/D/DBR preserved; no CLD/binary-only premise. Final N0/Z(nextOpcodeLow==0), E0/M0/X0.',
    qualification:'Two straight JMP-entered sources to F390 only. Full offset/state reads precede high/low PHA; no local/state store or stackread. Real state/operand/pointer/stack/opcode owners and actual D/DBR/S/Y/intact code/outerstack explicit; no global stack/capacity/initialization/task/native/device proof.'};
}
export function stateReadWordConsequence({entry,offsetWord,stateWord}){
  const spec=specFor(entry);if(!word(offsetWord)||!word(stateWord))throw Error('Explicit offset/state WORDs required');
  return {index:offsetWord,value:spec.byte?stateWord%256:stateWord};
}
export function describeStateReadByteOwners({entry,d,bank,s,y,pointerBefore,pointerAfter,offsetWord,stateWord}){
  const spec=specFor(entry);if(![d,s,y,pointerBefore,pointerAfter].every(word)||!Number.isInteger(bank)||bank<0||bank>255)throw Error('Explicit state read address context required');
  const c=stateReadWordConsequence({entry,offsetWord,stateWord});
  const owner=a=>({address:cpuLabel(a),physical_address:renderAddress(a)===null?null:cpuLabel(renderAddress(a))});
  const source=(pointer,atY)=>{const a=(bank*65536+pointer+atY)&0xFFFFFF;return {pointer_reads:[owner(d),owner((d+1)&65535)],word_reads:[owner(a),owner((a+1)&0xFFFFFF)]};};
  const operand=source(pointerBefore,y),nextY=(y+2)&65535,state=0x7E0000+c.index,stateReads=[owner(state),owner(state+1)];
  const stackWrites=[{...owner(s),order:1,byte:'high',value:Math.floor(c.value/256)},{...owner((s-1)&65535),order:2,byte:'low',value:c.value%256}],next=source(pointerAfter,nextY);
  return {entry:cpuLabel(entry),context:{d,bank,s,y,offsetWord,stateWord},...c,operand_sources:operand,
    state_sources:{at:cpuLabel(spec.read),mode:'longx',word_reads:stateReads},stack_writes:stackWrites,
    ordered_accesses:[{kind:'offset-pointer',operation:'read',bytes:operand.pointer_reads},{kind:'offset-WORD',operation:'read',bytes:operand.word_reads},
      {kind:'state-WORD',operation:'read',bytes:stateReads},...stackWrites.map(b=>({kind:'PHA-'+b.byte,operation:'write',bytes:[b]})),
      {kind:'next-pointer',operation:'read',bytes:next.pointer_reads},{kind:'next-opcode-WORD',operation:'read',bytes:next.word_reads}],
    output_operand_s:(s-2)&65535,next_opcode_y:nextY,frontier_y:(nextY+1)&65535,next_opcode_sources:next,
    qualification:'Ordered pure supplied WORD/address equations; observations not checked against memory. State low/high reads before high/low PHA, fresh pointer/opcode afterwards. State7E0000+fullX is24bit including high7F0000 atXFFFF, bank00 DP/S wrap16bits; stream24bit/Y16bit. Physical mapping is not ownership, permission, initialization or outerstack proof. No memory read/write, plan, commit, bus/device or CPU execution.'};
}
