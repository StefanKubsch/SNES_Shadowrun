import {cpuLabel} from './rom.mjs';
import {renderAddress} from '../src/render/data.mjs';
// Fixed source lemmas and pure supplied value/address equations. No CPU/memory runner.
const specs=new Map([
  [0x80F3F6,{kind:'0A',local:false,cmp:0x80F3FC,branch:0x80F3FF,ora:0x80F401,push:0x80F404,
    body:[[0x80F3F6,'B100'],[0x80F3F8,'C8'],[0x80F3F9,'29FF00'],[0x80F3FC,'C98000'],[0x80F3FF,'9003'],[0x80F401,'0900FF'],[0x80F404,'48'],[0x80F405,'4C89F3']]}],
  [0x80F408,{kind:'0C',local:true,cmp:0x80F414,branch:0x80F417,ora:0x80F419,push:0x80F41C,
    body:[[0x80F408,'B100'],[0x80F40A,'C8'],[0x80F40B,'29FF00'],[0x80F40E,'AA'],[0x80F40F,'B513'],[0x80F411,'29FF00'],[0x80F414,'C98000'],[0x80F417,'9003'],[0x80F419,'0900FF'],[0x80F41C,'48'],[0x80F41D,'4C89F3']]}]
]);
const fetch=[[0x80F389,'B100'],[0x80F38B,'C8'],[0x80F38C,'29FF00'],[0x80F38F,'AA'],[0x80F390,'7CB4F2']];
const signatures={'B100':['LDA','diy'],'C8':['INY','i'],'29FF00':['AND','immM'],'AA':['TAX','i'],
  'B513':['LDA','dpx'],'C98000':['CMP','immM'],'9003':['BCC','rel8'],'0900FF':['ORA','immM'],
  '48':['PHA','i'],'4C89F3':['JMP','abs'],'7CB4F2':['JMP','indx']};
const word=v=>Number.isInteger(v)&&v>=0&&v<=65535;
function specFor(entry){const s=specs.get(entry);if(!s)throw Error('Invalid sign extension source entry');return s;}
function validate(map,spec){const all=[...spec.body,...fetch];
  for(const [pc,raw]of all){const i=map.get(pc),b=Buffer.from(raw,'hex'),[op,mode]=signatures[raw],length=b.length;
    const value=length===1?0:b.readUIntLE(1,length-1),next=pc+length,target=mode==='rel8'?spec.push:op==='JMP'&&mode==='abs'?0x80F389:undefined;
    if(!i||i.cpu!==pc||i.opcode!==b[0]||i.mnemonic!==op||i.mode!==mode||i.value!==value||i.target!==target
      ||i.length!==length||i.next!==next||!i.raw.equals(b))throw Error('Renew sign extension source lemma '+cpuLabel(pc));
    if(['e','m','x'].some(f=>i.state?.[f]!==0))throw Error('Sign extension requires explicit E0M0X0');
    if(pc!==0x80F390&&![...(op==='JMP'?[target]:[next]),...(mode==='rel8'?[target]:[])].every(edge=>all.some(([source])=>source===edge)))throw Error('Uncovered sign extension source edge');
  }return all;
}
export function proveSignExtensionToDispatch(map,entry){const spec=specFor(entry),all=validate(map,spec),full=all.map(([pc])=>cpuLabel(pc)),taken=all.filter(([pc])=>pc!==spec.ora).map(([pc])=>cpuLabel(pc));
  return {entry:cpuLabel(entry),opcode_kind:spec.kind,source_closed_to_dispatch:true,native_binding:false,
    reachable_instructions:all.length,visited:full,outer_return_frames_added:0,operand_words_added:1,operand_s_delta:-2,
    required_readable_operand_stack_bytes:0,required_writable_operand_stack_bytes:2,minimum_protected_stack_bytes:null,
    decimal_flag_required:null,external_return_assumptions:0,stream_operand_bytes_consumed:1,
    reads:[{at:cpuLabel(entry),kind:spec.local?'index-operand':'immediate-operand',bytes:2,highbyte_required:true,
      pointer:'fresh bank00:D/D+1',data:'actualDBR:pointer+entryY full WORD low/high; INY once then AND00FF'},
      ...(spec.local?[{at:'80:F40F',kind:'local',bytes:2,highbyte_required:true,
        address:'bank00:(fullD+13+indexLow)&FFFF, high=(base+1)&FFFF; WORD LDA13,X before AND00FF'}]:[]),
      {at:'80:F389',kind:'next-opcode',bytes:2,highbyte_required:true,after_push:true,
        pointer:'fresh bank00:D/D+1 after both PHA writes',data:'actualDBR:freshPointer+updatedY full WORD including ignoredopcodeHigh'}],
    branch:{at:cpuLabel(spec.branch),flag_origin:cpuLabel(spec.cmp),condition:'BCC on WORD CMP0080 Carry; taken iff masked dataLow<80, independent of incoming Carry/decimal',taken:cpuLabel(spec.push),fallthrough:cpuLabel(spec.ora)},
    paths:[{condition:'dataLow00..7F',visited:taken,executed_instructions:taken.length,carry:0,result:'00:original dataLow; ORAFF00 skipped',
      n_before_push:1,z_before_push:0,flag_origin:'WORD CMP0080 negative subtraction even for positive/zero pushed data'},
      {condition:'dataLow80..FF',visited:full,executed_instructions:full.length,carry:1,result:'FF:original dataLow via WORD ORAFF00',
        n_before_push:1,z_before_push:0,flag_origin:'WORD ORAFF00; CMP result/flags replaced except actual Carry'}],
    stack_writes:[{at:cpuLabel(spec.push),order:1,byte:'00 if dataLow<80 else FF',address:'bank00:entryS'},
      {at:cpuLabel(spec.push),order:2,byte:'original dataLow',address:'bank00:(entryS-1)&FFFF'}],
    x_before_next_fetch:spec.local?'full WORD X=original indexLow0..255, no ASL/clamp':'entry X unchanged; no TAX before fetch',
    y_delta_before_next_opcode:1,y_delta_at_frontier:2,saved_frame_cursor_write:false,
    output_mode:{e:0,m:0,x:0,d:'entry payload D',dbr:'entry actual DBR'},
    frontier:{at:'80:F390',kind:'indexed-opcode-JMP',a:'Fresh next-opcode lowbyte',x:'Fresh next-opcode lowbyte',
      target:'80:WORD(80:F2B4+X), no ASL/parity/ID clamp; next handler remains source-required'},
    flags:'Final Carry from actual CMP0080, C1 iff dataLow>=80. V/I/decimal/D/DBR preserved; no CLD. N1/Z0 on both PHA paths, not derived from pushed WORD on BCC path. Fresh F389 replaces N/Z to N0/Z(nextOpcodeLow==0), preserving actual Carry.',
    qualification:'Four finite JMP-entered paths to dynamic F390 only. Full WORD reads precede high/low PHA, no stackreads/localwrites/extra returnframe. Actual D/DBR/S/Y and real byte owners/intact code/outerstack required; no global stack/capacity/initialization/task/native/device proof.'};
}
export function signExtensionWordConsequence({entry,operandWord,localWord}){
  const spec=specFor(entry);if(!word(operandWord)||spec.local&&!word(localWord))throw Error('Explicit operand/local WORDs required');
  const low=(spec.local?localWord:operandWord)%256,negative=low>=128;
  return {index:spec.local?operandWord%256:null,data_low:low,value:negative?65280+low:low,carry:Number(negative),ora_executed:negative,
    cmp_result:(low+65536-128)%65536,cmp_n:Number(!negative),cmp_z:Number(low===128),n_before_push:1,z_before_push:0};
}
export function describeSignExtensionByteOwners({entry,d,bank,s,y,pointerBefore,pointerAfter,operandWord,localWord}){
  const spec=specFor(entry);if(![d,s,y,pointerBefore,pointerAfter].every(word)||!Number.isInteger(bank)||bank<0||bank>255)throw Error('Explicit sign extension address context required');
  const c=signExtensionWordConsequence({entry,operandWord,localWord});
  const owner=a=>({address:cpuLabel(a),physical_address:renderAddress(a)===null?null:cpuLabel(renderAddress(a))});
  const source=(pointer,atY)=>{const a=(bank*65536+pointer+atY)&0xFFFFFF;return {pointer_reads:[owner(d),owner((d+1)&65535)],word_reads:[owner(a),owner((a+1)&0xFFFFFF)]};};
  const operand=source(pointerBefore,y),nextY=(y+1)&65535,local=(d+0x13+(c.index??0))&65535;
  const localReads=spec.local?[owner(local),owner((local+1)&65535)]:null,stackWrites=[{...owner(s),order:1,byte:'high',value:Math.floor(c.value/256)},
    {...owner((s-1)&65535),order:2,byte:'low',value:c.data_low}],next=source(pointerAfter,nextY);
  return {entry:cpuLabel(entry),context:{d,bank,s,y,operandWord,...(spec.local?{localWord}:{})},...c,
    operand_sources:operand,local_sources:localReads?{at:'80:F40F',word_reads:localReads}:null,stack_writes:stackWrites,
    ordered_accesses:[{kind:'operand-pointer',operation:'read',bytes:operand.pointer_reads},{kind:spec.local?'index-WORD':'immediate-WORD',operation:'read',bytes:operand.word_reads},
      ...(localReads?[{kind:'local-WORD',operation:'read',bytes:localReads}]:[]),...stackWrites.map(b=>({kind:'PHA-'+b.byte,operation:'write',bytes:[b]})),
      {kind:'next-pointer',operation:'read',bytes:next.pointer_reads},{kind:'next-opcode-WORD',operation:'read',bytes:next.word_reads}],
    output_operand_s:(s-2)&65535,next_opcode_y:nextY,frontier_y:(nextY+1)&65535,next_opcode_sources:next,
    qualification:'Ordered pure supplied WORD/address equations; observations not checked against memory. Actual index/immediate/local low/high reads before high/low PHA, fresh pointer/opcode afterwards. Bank00 DP/S wrap16bits, stream wraps24bits. Physical mapping is not ownership, permission, initialization or outerstack proof. No memory read/write, plan, commit, bus/device or CPU execution.'};
}
