import {cpuLabel} from './rom.mjs';
import {renderAddress} from '../src/render/data.mjs';
// Fixed source lemmas and address/value equations; no CPU/memory runner.
const specs=new Map([
  [0x80F715,{kind:'and',body:[[0x80F715,'68'],[0x80F716,'2301'],[0x80F718,'8301'],[0x80F71A,'4C89F3']]}],
  [0x80F71D,{kind:'or',body:[[0x80F71D,'68'],[0x80F71E,'0301'],[0x80F720,'8301'],[0x80F722,'4C89F3']]}],
  [0x80F725,{kind:'xor',body:[[0x80F725,'68'],[0x80F726,'4301'],[0x80F728,'8301'],[0x80F72A,'4C89F3']]}],
  [0x80F72D,{kind:'not',body:[[0x80F72D,'68'],[0x80F72E,'49FFFF'],[0x80F731,'48'],[0x80F732,'4C89F3']]}]
]);
const fetch=[[0x80F389,'B100'],[0x80F38B,'C8'],[0x80F38C,'29FF00'],[0x80F38F,'AA'],[0x80F390,'7CB4F2']];
const signatures={'68':['PLA','i',0],'2301':['AND','sr',1],'0301':['ORA','sr',1],'4301':['EOR','sr',1],
  '8301':['STA','sr',1],'49FFFF':['EOR','immM',65535],'48':['PHA','i',0],'4C89F3':['JMP','abs',0x80F389],
  'B100':['LDA','diy',0],'C8':['INY','i',0],'29FF00':['AND','immM',255],'AA':['TAX','i',0],'7CB4F2':['JMP','indx',0xF2B4]};
// s_delta is the actual S change before this instruction; offset locates
// the WORD lowbyte relative to that S. PHA's lowbyte is at current S-1.
function operations(spec){const unary=spec.kind==='not';return [
  {at:cpuLabel(spec.body[0][0]),kind:'read',s_delta:0,offset:1,byte_order:['low','high'],value:unary?'original top WORD':'right WORD',pull:true},
  ...(unary?[]:[{at:cpuLabel(spec.body[1][0]),kind:'read',s_delta:2,offset:1,byte_order:['low','high'],value:'left WORD',pull:false}]),
  {at:cpuLabel(spec.body[2][0]),kind:'write',s_delta:2,offset:unary?-1:1,byte_order:unary?['high','low']:['low','high'],
    value:'result WORD',instruction:unary?'WORD PHA after PLA raised S2':'WORD STA01,S after PLA raised S2'}];}
export function proveBitLogicToDispatch(map,entry){
  const spec=specs.get(entry);if(!spec)throw Error('Invalid bit logic source entry');const path=[...spec.body,...fetch];
  for(let n=0;n<path.length;n++){
    const [pc,raw]=path[n],i=map.get(pc),[op,mode,value]=signatures[raw],length=raw.length/2;
    if(!i||i.cpu!==pc||i.mnemonic!==op||i.mode!==mode||(i.target??i.value)!==value
      ||i.opcode!==parseInt(raw.slice(0,2),16)||i.raw.toString('hex').toUpperCase()!==raw
      ||i.length!==length||i.next!==pc+length)throw Error('Renew bit logic source lemma '+cpuLabel(pc));
    if(['e','m','x'].some(flag=>i.state?.[flag]!==0))throw Error('Bit logic requires explicit E0M0X0');
    if(n<path.length-1&&(op==='JMP'?i.target:i.next)!==path[n+1][0])throw Error('Uncovered bit logic source edge');
  }
  const unary=spec.kind==='not';return {entry:cpuLabel(entry),kind:spec.kind,source_closed_to_dispatch:true,native_binding:false,
    reachable_instructions:path.length,visited:path.map(([pc])=>cpuLabel(pc)),stack_operations:operations(spec),
    result:unary?'original top WORD XOR FFFF':`right WORD ${spec.kind.toUpperCase()} left WORD`,
    operand_s_delta:unary?0:2,operand_words_removed:unary?0:1,required_readable_operand_stack_bytes:unary?2:4,
    required_writable_operand_stack_bytes:2,outer_return_frames_added:0,minimum_protected_stack_bytes:null,external_return_assumptions:0,
    decimal_flag_required:null,y_delta_before_next_opcode:0,y_delta_at_frontier:1,
    output_mode:{e:0,m:0,x:0,d:'entry payload D',dbr:'entry actual DBR'},
    frontier:{at:'80:F390',kind:'indexed-opcode-JMP',a:'Fresh next-opcode lowbyte',x:'Fresh next-opcode lowbyte',
      target:'80:WORD(80:F2B4+X), no ASL/parity/ID clamp; actual next handler remains source-required'},
    flags:'C/V/I/decimal preserved; no Carry seed or binary-only premise. PLA/AND/ORA/EOR N/Z replaced by final N0/Z(nextOpcodeLow==0).',
    qualification:'JMP-entered local WORD source through actual next fetch/dispatch. Operand byte counts are not a global protected stack minimum. Actual D/DBR/S/Y, intact code/outerstack and real readable/writable byte owners required; no underflow/capacity guards, CPU/memory/device/scene/frame execution inferred.'};
}
export function describeBitLogicByteOwners({entry,d,bank,s,y,pointerAfter}){
  const spec=specs.get(entry);if(!spec)throw Error('Invalid bit logic source entry');const word=v=>Number.isInteger(v)&&v>=0&&v<=65535;
  if(![d,s,y,pointerAfter].every(word)||!Number.isInteger(bank)||bank<0||bank>255)throw Error('Explicit bit logic address context required');
  const owner=address=>({address:cpuLabel(address),physical_address:renderAddress(address)===null?null:cpuLabel(renderAddress(address))});
  const ordered=operations(spec).map(o=>({...o,bytes:o.byte_order.map(byte=>({...owner((s+o.s_delta+o.offset+(byte==='high'?1:0))&65535),byte}))}));
  const a=(bank*65536+pointerAfter+y)&0xFFFFFF;return {entry:cpuLabel(entry),context:{d,bank,s,y},stack_operations:ordered,
    s_after_pla:(s+2)&65535,output_operand_s:(s+(spec.kind==='not'?0:2))&65535,
    next_opcode_sources:{pointer_reads:[owner(d),owner((d+1)&65535)],word_reads:[owner(a),owner((a+1)&0xFFFFFF)]},
    next_opcode_y:y,frontier_y:(y+1)&65535,
    qualification:'Ordered address equations only. Full operand WORDs precede stores; binary STA writes low/high, NOT PHA high/low. Stack bytes and S wrap16bits in bank00; fresh poststore pointer supplied separately. Known physical address is not an owner/write/initialization/outerstack proof. No memory read/write, plan, commit, bus/device or CPU execution.'};
}
// Pure WORD value consequence, independent of Carry/decimal; no flag runner.
export function bitLogicWord(entry,left,right){
  const spec=specs.get(entry);if(!spec)throw Error('Invalid bit logic source entry');const word=v=>Number.isInteger(v)&&v>=0&&v<=65535;
  if(!word(left)||spec.kind!=='not'&&!word(right))throw Error('Explicit operand WORDs required');
  if(spec.kind==='not')return left^65535;if(spec.kind==='and')return right&left;if(spec.kind==='or')return right|left;return right^left;
}
