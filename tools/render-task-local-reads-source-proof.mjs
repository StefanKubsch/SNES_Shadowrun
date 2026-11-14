import {cpuLabel} from './rom.mjs';
import {renderAddress} from '../src/render/data.mjs';
// Fixed ROM signatures and pure address/WORD equations; no CPU or memory runner.
const specs=new Map([
  [0x80F3A1,{kind:'02',indexed:true,byte:true,local:0x80F3A8,push:0x80F3AD,body:[[0x80F3A1,'B100'],[0x80F3A3,'C8'],[0x80F3A4,'29FF00'],[0x80F3A7,'AA'],[0x80F3A8,'B513'],[0x80F3AA,'29FF00'],[0x80F3AD,'48'],[0x80F3AE,'4C89F3']]}],
  [0x80F3B9,{kind:'16',indexed:true,byte:false,local:0x80F3C0,push:0x80F3C2,body:[[0x80F3B9,'B100'],[0x80F3BB,'C8'],[0x80F3BC,'29FF00'],[0x80F3BF,'AA'],[0x80F3C0,'B513'],[0x80F3C2,'48'],[0x80F3C3,'4C89F3']]}],
  [0x80F8CB,{kind:'C2',indexed:false,byte:true,local:0x80F8CB,push:0x80F8D0,body:[[0x80F8CB,'A513'],[0x80F8CD,'29FF00'],[0x80F8D0,'48'],[0x80F8D1,'4C89F3']]}]
]);
const fetch=[[0x80F389,'B100'],[0x80F38B,'C8'],[0x80F38C,'29FF00'],[0x80F38F,'AA'],[0x80F390,'7CB4F2']];
const signatures={'B100':['LDA','diy'],'C8':['INY','i'],'29FF00':['AND','immM'],'AA':['TAX','i'],
  'B513':['LDA','dpx'],'A513':['LDA','dp'],'48':['PHA','i'],'4C89F3':['JMP','abs'],'7CB4F2':['JMP','indx']};
const word=v=>Number.isInteger(v)&&v>=0&&v<=65535;
function specFor(entry){const s=specs.get(entry);if(!s)throw Error('Invalid local read source entry');return s;}
function validate(map,spec){const all=[...spec.body,...fetch];
  for(const [pc,raw]of all){const i=map.get(pc),b=Buffer.from(raw,'hex'),[op,mode]=signatures[raw],length=b.length;
    const value=length===1?0:b.readUIntLE(1,length-1),next=pc+length,target=op==='JMP'&&mode==='abs'?0x80F389:undefined;
    if(!i||i.cpu!==pc||i.opcode!==b[0]||i.mnemonic!==op||i.mode!==mode||i.value!==value||i.target!==target
      ||i.length!==length||i.next!==next||!i.raw.equals(b))throw Error('Renew local read source lemma '+cpuLabel(pc));
    if(['e','m','x'].some(flag=>i.state?.[flag]!==0))throw Error('Local read requires explicit E0M0X0');
    if(pc!==0x80F390&&!all.some(([source])=>source===(op==='JMP'?target:next)))throw Error('Uncovered local read source edge');
  }return all;
}
export function proveLocalReadToDispatch(map,entry){const spec=specFor(entry),all=validate(map,spec),width=Number(spec.indexed);
  return {entry:cpuLabel(entry),opcode_kind:spec.kind,source_closed_to_dispatch:true,native_binding:false,
    reachable_instructions:all.length,visited:all.map(([pc])=>cpuLabel(pc)),outer_return_frames_added:0,operand_words_added:1,
    operand_s_delta:-2,required_writable_operand_stack_bytes:2,required_readable_operand_stack_bytes:0,minimum_protected_stack_bytes:null,
    decimal_flag_required:null,external_return_assumptions:0,index_operand_bytes_consumed:width,
    reads:[...(spec.indexed?[{at:cpuLabel(entry),kind:'index-operand',bytes:2,highbyte_required:true,
      pointer:'fresh bank00:D/D+1',data:'full WORD actualDBR:pointer+entryY, then INY/AND00FF/TAX; X=operandLow'}]:[]),
      {at:cpuLabel(spec.local),kind:'local',bytes:2,highbyte_required:true,mode:spec.indexed?'dpx':'dp',
        address:spec.indexed?'bank00:(D+13+operandLow)&FFFF; highbyte wraps within bank00':'bank00:(D+13)&FFFF; highbyte wraps within bank00',
        mask_after_read:spec.byte?'WORD AND00FF':'none; full WORD retained'},
      {at:'80:F389',kind:'next-opcode',bytes:2,highbyte_required:true,after_push:true,
        pointer:'fresh bank00:D/D+1 after both PHA writes',data:'actualDBR:freshPointer+updatedY; ignored opcode highbyte still read'}],
    stack_writes:[{at:cpuLabel(spec.push),byte:spec.byte?'00':'original local highbyte',address:'00:entryS',order:1},
      {at:cpuLabel(spec.push),byte:'original local lowbyte',address:'00:((entryS-1)&FFFF)',order:2}],
    x_before_next_fetch:spec.indexed?'original index operandLow, even for WORD local':'entry X unchanged; direct local read unindexed',
    y_delta_before_next_opcode:width,y_delta_at_frontier:width+1,saved_frame_cursor_write:false,
    output_mode:{e:0,m:0,x:0,d:'entry payload D',dbr:'entry actual DBR'},
    frontier:{at:'80:F390',kind:'indexed-opcode-JMP',a:'Fresh next-opcode lowbyte',x:'Fresh next-opcode lowbyte',
      target:'80:WORD(80:F2B4+X), no ASL/parity/ID clamp; next handler remains source-required'},
    flags:'LDA/AND/TAX/INY change N/Z only, PHA/JMP preserve flags. C/V/I/decimal unchanged, no binary-only premise. Final N0/Z(nextOpcodeLow==0); X/A overwritten by fresh opcodeLow.',
    qualification:'Three straight JMP-entered sources, full index/local reads before high/low PHA, fresh nextfetch to F390 only. Actual D/DBR/S/Y/intact code/outerstack and real byte owners required; no global stack minimum, local capacity/initialization guard, task/native/device/scene/frame execution inferred.'};
}
export function localReadWordConsequence({entry,indexWord,localWord}){
  const spec=specFor(entry);if(!word(localWord)||spec.indexed&&!word(indexWord))throw Error('Explicit local/index WORDs required');
  return {index:spec.indexed?indexWord%256:null,value:spec.byte?localWord%256:localWord};
}
export function describeLocalReadByteOwners({entry,d,bank,s,y,pointerBefore,pointerAfter,indexWord,localWord}){
  const spec=specFor(entry);if(![d,s,y,pointerAfter].every(word)||spec.indexed&&!word(pointerBefore)||!Number.isInteger(bank)||bank<0||bank>255)throw Error('Explicit local read address context required');
  const c=localReadWordConsequence({entry,indexWord,localWord});
  const owner=a=>({address:cpuLabel(a),physical_address:renderAddress(a)===null?null:cpuLabel(renderAddress(a))});
  const source=(pointer,atY)=>{const a=(bank*65536+pointer+atY)&0xFFFFFF;return {pointer_reads:[owner(d),owner((d+1)&65535)],word_reads:[owner(a),owner((a+1)&0xFFFFFF)]};};
  const indexSources=spec.indexed?source(pointerBefore,y):null,local=(d+0x13+(c.index??0))&65535,nextY=(y+Number(spec.indexed))&65535;
  const localReads=[owner(local),owner((local+1)&65535)],stackWrites=[{...owner(s),order:1,byte:'high',value:Math.floor(c.value/256)},
    {...owner((s-1)&65535),order:2,byte:'low',value:c.value%256}],next=source(pointerAfter,nextY);
  return {entry:cpuLabel(entry),context:{d,bank,s,y,localWord,...(spec.indexed?{indexWord}:{})},...c,
    operand_sources:indexSources,local_sources:{at:cpuLabel(spec.local),mode:spec.indexed?'dpx':'dp',word_reads:localReads},stack_writes:stackWrites,
    ordered_accesses:[...(indexSources?[{kind:'index-pointer',operation:'read',bytes:indexSources.pointer_reads},{kind:'index-WORD',operation:'read',bytes:indexSources.word_reads}]:[]),
      {kind:'local-WORD',operation:'read',bytes:localReads},...stackWrites.map(b=>({kind:'PHA-'+b.byte,operation:'write',bytes:[b]})),
      {kind:'next-pointer',operation:'read',bytes:next.pointer_reads},{kind:'next-opcode-WORD',operation:'read',bytes:next.word_reads}],
    output_operand_s:(s-2)&65535,next_opcode_y:nextY,frontier_y:(nextY+1)&65535,next_opcode_sources:next,
    qualification:'Ordered pure WORD/address equations only, supplied fresh observations not executed or checked against memory. Full local Low/High read even for BYTE before PHA High/Low; fresh pointer/opcode afterwards. Bank00 DP/S wrap16bits; DBR indexed data wrap24bits. Physical mapping is not byte ownership, write permission, initialization or outerstack proof. No memory read/write, plan, commit, bus/device or CPU execution.'};
}
