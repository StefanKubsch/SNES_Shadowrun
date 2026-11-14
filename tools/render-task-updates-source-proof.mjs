import {cpuLabel} from './rom.mjs';
import {renderAddress} from '../src/render/data.mjs';

// Fixed JMP-handler paths and symbolic byte origins, not a CPU/memory runner.
const specs=new Map([
  [0x80F3E4,{kind:'increment',delta:0,body:[[0x80F3E4,'68'],[0x80F3E5,'1A'],[0x80F3E6,'48'],[0x80F3E7,'4C89F3']],read:'80:F3E4',push:'80:F3E6'}],
  [0x80F3EA,{kind:'decrement',delta:0,body:[[0x80F3EA,'68'],[0x80F3EB,'3A'],[0x80F3EC,'48'],[0x80F3ED,'4C89F3']],read:'80:F3EA',push:'80:F3EC'}],
  [0x80F3F0,{kind:'duplicate',delta:-2,body:[[0x80F3F0,'A301'],[0x80F3F2,'48'],[0x80F3F3,'4C89F3']],read:'80:F3F0',push:'80:F3F2'}]
]);
const fetch=[[0x80F389,'B100'],[0x80F38B,'C8'],[0x80F38C,'29FF00'],[0x80F38F,'AA'],[0x80F390,'7CB4F2']];
const signatures={
  '68':['PLA','i',0],'1A':['INC','A',0],'3A':['DEC','A',0],'48':['PHA','i',0],
  'A301':['LDA','sr',1],'4C89F3':['JMP','abs',0x80F389],'B100':['LDA','diy',0],
  'C8':['INY','i',0],'29FF00':['AND','immM',255],'AA':['TAX','i',0],'7CB4F2':['JMP','indx',0xF2B4]
};
export function proveUpdateToDispatch(map,entry){
  const spec=specs.get(entry);if(!spec)throw Error('Invalid update source entry');
  const path=[...spec.body,...fetch];
  for(let n=0;n<path.length;n++){
    const [pc,raw]=path[n],i=map.get(pc),[op,mode,value]=signatures[raw],length=raw.length/2;
    if(!i||i.cpu!==pc||i.mnemonic!==op||i.mode!==mode||(i.target??i.value)!==value
      ||i.opcode!==parseInt(raw.slice(0,2),16)||i.raw.toString('hex').toUpperCase()!==raw
      ||i.length!==length||i.next!==pc+length)throw Error('Renew update source lemma '+cpuLabel(pc));
    if(['e','m','x'].some(flag=>i.state?.[flag]!==0))throw Error('Update requires explicit E0M0X0');
    if(n<path.length-1&&(op==='JMP'?i.target:i.next)!==path[n+1][0])throw Error('Uncovered update source edge');
  }
  const duplicate=spec.kind==='duplicate',sBeforePush=duplicate?0:2;
  return {entry:cpuLabel(entry),kind:spec.kind,source_closed_to_dispatch:true,native_binding:false,
    reachable_instructions:path.length,visited:path.map(([pc])=>cpuLabel(pc)),
    stack_read:{at:spec.read,kind:duplicate?'stack-relative WORD LDA01,S':'WORD PLA',
      byte_order:['low at bank00:(incomingS+1)&FFFF','high at bank00:(incomingS+2)&FFFF'],s_delta_after_read:sBeforePush},
    stack_push:{at:spec.push,kind:'WORD PHA',s_delta_before_push:sBeforePush,
      byte_order:[`result high at bank00:(incomingS+${sBeforePush})&FFFF`,`result low at bank00:(incomingS+${sBeforePush}-1)&FFFF`]},
    result:duplicate?'Original top WORD':spec.kind==='increment'?'(original top WORD+1)&FFFF':'(original top WORD-1)&FFFF',
    operand_s_delta:spec.delta,operand_words_added:duplicate?1:0,required_readable_operand_stack_bytes:2,
    required_writable_operand_stack_bytes:2,outer_return_frames_added:0,minimum_protected_stack_bytes:null,external_return_assumptions:0,
    decimal_flag_required:null,y_delta_before_next_opcode:0,y_delta_at_frontier:1,
    output_mode:{e:0,m:0,x:0,d:'entry payload D',dbr:'entry actual DBR'},
    frontier:{at:'80:F390',kind:'indexed-opcode-JMP',a:'Fresh next-opcode lowbyte',x:'Fresh next-opcode lowbyte',
      target:'80:WORD(80:F2B4+X), no ASL/parity/ID clamp; actual next handler remains source-required'},
    flags:'C/V/I/decimal preserved, including signed value wrap. INC/DEC do not use Carry/decimal arithmetic. Final N0/Z(nextOpcodeLow==0) overwrites local read/update N/Z.',
    qualification:'JMP-entered local WORD source to actual fresh fetch/dispatch. Two operand read/write bytes are not a global protected stack minimum. Actual D/DBR/S/Y, intact code/outerstack and real readable/writable byte owners required; no underflow/capacity checks, CPU/memory/device/scene/frame execution inferred.'};
}

export function describeUpdateByteOwners({entry,d,bank,s,y,pointerAfter}){
  const spec=specs.get(entry);if(!spec)throw Error('Invalid update source entry');
  const word=v=>Number.isInteger(v)&&v>=0&&v<=65535;
  if(![d,s,y,pointerAfter].every(word)||!Number.isInteger(bank)||bank<0||bank>255)throw Error('Explicit update address context required');
  const owner=address=>({address:cpuLabel(address),physical_address:renderAddress(address)===null?null:cpuLabel(renderAddress(address))});
  const duplicate=spec.kind==='duplicate',pushS=(s+(duplicate?0:2))&65535;
  const a=(bank*65536+pointerAfter+y)&0xFFFFFF;
  return {entry:cpuLabel(entry),context:{d,bank,s,y},
    stack_reads:[{...owner((s+1)&65535),byte:'low'},{...owner((s+2)&65535),byte:'high'}],
    s_after_read:pushS,
    stack_writes:[{...owner(pushS),byte:'high'},{...owner((pushS-1)&65535),byte:'low'}],
    output_operand_s:(s+spec.delta)&65535,
    next_opcode_sources:{pointer_reads:[owner(d),owner((d+1)&65535)],word_reads:[owner(a),owner((a+1)&0xFFFFFF)]},
    next_opcode_y:y,frontier_y:(y+1)&65535,
    qualification:'Ordered address equations only: full WORD read precedes high/low PHA. Stack bytes and S wrap16bits in bank00; next fetch uses separately supplied fresh poststore pointer. Known physical address is not an owner/write/initialization/outerstack proof. No memory read/write, plan, commit, bus/device or CPU execution.'};
}

// Pure WORD value consequence for every Carry/decimal input; no flag runner.
export function updateWord(entry,value){
  const spec=specs.get(entry);if(!spec)throw Error('Invalid update source entry');
  if(!Number.isInteger(value)||value<0||value>65535)throw Error('Explicit operand WORD required');
  return spec.kind==='duplicate'?value:(value+(spec.kind==='increment'?1:-1))&65535;
}
