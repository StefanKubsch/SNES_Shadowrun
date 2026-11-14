import {cpuLabel} from './rom.mjs';
import {renderAddress} from '../src/render/data.mjs';

// Fixed source lemmas and address/data equations only; no CPU or memory runner.
const specs=new Map([
  [0x80F8BB,{kind:'drop',body:[[0x80F8BB,'68'],[0x80F8BC,'4C89F3']],operations:[
    {at:'80:F8BB',kind:'read',s_delta:0,offset:1,value:'discarded right WORD',pull:true}]}],
  [0x80F532,{kind:'add',body:[[0x80F532,'68'],[0x80F533,'18'],[0x80F534,'6301'],[0x80F536,'8301'],[0x80F538,'4C89F3']],operations:[
    {at:'80:F532',kind:'read',s_delta:0,offset:1,value:'right WORD',pull:true},
    {at:'80:F534',kind:'read',s_delta:2,offset:1,value:'left WORD',pull:false},
    {at:'80:F536',kind:'write',s_delta:2,offset:1,value:'right+left result WORD'}]}],
  [0x80F53B,{kind:'subtract',body:[[0x80F53B,'38'],[0x80F53C,'A303'],[0x80F53E,'E301'],[0x80F540,'8303'],[0x80F542,'68'],[0x80F543,'4C89F3']],operations:[
    {at:'80:F53C',kind:'read',s_delta:0,offset:3,value:'left WORD',pull:false},
    {at:'80:F53E',kind:'read',s_delta:0,offset:1,value:'right WORD',pull:false},
    {at:'80:F540',kind:'write',s_delta:0,offset:3,value:'left-right result WORD'},
    {at:'80:F542',kind:'read',s_delta:0,offset:1,value:'fresh discarded right WORD after result store',pull:true}]}]
]);
const fetch=[[0x80F389,'B100'],[0x80F38B,'C8'],[0x80F38C,'29FF00'],[0x80F38F,'AA'],[0x80F390,'7CB4F2']];
const signatures={
  '68':['PLA','i',0],'18':['CLC','i',0],'38':['SEC','i',0],
  '6301':['ADC','sr',1],'8301':['STA','sr',1],'A303':['LDA','sr',3],
  'E301':['SBC','sr',1],'8303':['STA','sr',3],'4C89F3':['JMP','abs',0x80F389],
  'B100':['LDA','diy',0],'C8':['INY','i',0],'29FF00':['AND','immM',255],
  'AA':['TAX','i',0],'7CB4F2':['JMP','indx',0xF2B4]
};
export function proveConsumerToDispatch(map,entry){
  const spec=specs.get(entry);if(!spec)throw Error('Invalid consumer source entry');
  const path=[...spec.body,...fetch];
  for(let n=0;n<path.length;n++){
    const [pc,raw]=path[n],i=map.get(pc),[op,mode,value]=signatures[raw],length=raw.length/2;
    if(!i||i.cpu!==pc||i.mnemonic!==op||i.mode!==mode||(i.target??i.value)!==value
      ||i.opcode!==parseInt(raw.slice(0,2),16)||i.raw.toString('hex').toUpperCase()!==raw
      ||i.length!==length||i.next!==pc+length)throw Error('Renew consumer source lemma '+cpuLabel(pc));
    if(['e','m','x'].some(flag=>i.state?.[flag]!==0))throw Error('Consumer requires explicit E0M0X0');
    if(n<path.length-1&&(op==='JMP'?i.target:i.next)!==path[n+1][0])throw Error('Uncovered consumer source edge');
  }
  const arithmetic=spec.kind!=='drop';
  return {entry:cpuLabel(entry),kind:spec.kind,source_closed_to_dispatch:true,native_binding:false,
    reachable_instructions:path.length,visited:path.map(([pc])=>cpuLabel(pc)),stack_operations:spec.operations.map(o=>({...o})),
    operand_s_delta:2,operand_words_removed:1,required_readable_operand_stack_bytes:arithmetic?4:2,
    required_writable_operand_stack_bytes:arithmetic?2:0,outer_return_frames_added:0,
    minimum_protected_stack_bytes:null,external_return_assumptions:0,
    binary_arithmetic:arithmetic?{decimal_flag_required:0,carry_seed:spec.kind==='add'?0:1,
      result:spec.kind==='add'?'(right+left)&FFFF':'(left-right)&FFFF',
      carry:spec.kind==='add'?'right+left >= 65536':'left >= right (no borrow)',
      overflow:spec.kind==='add'?'(~(right^left)&(right^result)&8000)!=0':'((left^right)&(left^result)&8000)!=0',
      qualification:'Binary formulas require supplied decimal flag0; source does not execute CLD. Decimal arithmetic is not promoted to a binary result.'}:null,
    y_delta_before_next_opcode:0,y_delta_at_frontier:1,
    output_mode:{e:0,m:0,x:0,d:'entry payload D',dbr:'entry actual DBR'},
    frontier:{at:'80:F390',kind:'indexed-opcode-JMP',a:'Fresh next-opcode lowbyte',x:'Fresh next-opcode lowbyte',
      target:'80:WORD(80:F2B4+X), no ASL/parity/ID clamp; actual next handler remains source-required'},
    flags:arithmetic?'C/V from actual ADC/SBC survive STA/PLA/refetch; final N0/Z(nextOpcodeLow==0); I/decimal flag preserved.'
      :'C/V/I/decimal preserved; PLA N/Z are replaced by final N0/Z(nextOpcodeLow==0). No binary-only premise for Drop.',
    qualification:'JMP-entered local source to actual next dispatch. Operand byte counts are not a global protected stack minimum. Actual D/DBR/S/Y and readable/writable byte owners, intact code and outerstack required; no underflow/capacity guards inferred, no CPU/memory/device/scene/frame execution.'};
}

export function describeConsumerByteOwners({entry,d,bank,s,y,pointerAfter}){
  const spec=specs.get(entry);if(!spec)throw Error('Invalid consumer source entry');
  const word=v=>Number.isInteger(v)&&v>=0&&v<=65535;
  if(![d,s,y,pointerAfter].every(word)||!Number.isInteger(bank)||bank<0||bank>255)throw Error('Explicit consumer address context required');
  const owner=address=>({address:cpuLabel(address),physical_address:renderAddress(address)===null?null:cpuLabel(renderAddress(address))});
  const operations=spec.operations.map(o=>({...o,bytes:[0,1].map(byte=>({...owner((s+o.s_delta+o.offset+byte)&65535),byte:byte?'high':'low'}))}));
  const a=(bank*65536+pointerAfter+y)&0xFFFFFF;
  return {entry:cpuLabel(entry),context:{d,bank,s,y},stack_operations:operations,output_operand_s:(s+2)&65535,
    next_opcode_sources:{pointer_reads:[owner(d),owner((d+1)&65535)],word_reads:[owner(a),owner((a+1)&0xFFFFFF)]},
    next_opcode_y:y,frontier_y:(y+1)&65535,
    qualification:'Ordered low/high byte address equations only. Stack-relative and PLA sources stay in bank00 with 16bit wrap; fetch uses a separately supplied fresh pointer after stores. Known physical address is not an actual owner or write/initialization/outerstack proof. No memory read/write, plan, commit, bus/device or CPU execution.'};
}

// Pure binary data consequence, deliberately rejects missing/decimal mode.
export function binaryConsumerResult({entry,left,right,decimalFlag}){
  if(![0x80F532,0x80F53B].includes(entry))throw Error('Invalid binary consumer entry');
  if(decimalFlag!==0)throw Error('Explicit decimal flag0 required for binary result');
  if(![left,right].every(v=>Number.isInteger(v)&&v>=0&&v<=65535))throw Error('Explicit operand WORDs required');
  const add=entry===0x80F532,wide=add?right+left:left-right,value=wide&65535;
  return {value,carry:Number(add?wide>=65536:left>=right),overflow:Number(Boolean((add?~(right^left)&(right^value):(left^right)&(left^value))&0x8000))};
}
