import {cpuLabel} from './rom.mjs';
import {renderAddress} from '../src/render/data.mjs';
// Source signatures, symbolic WORD-count induction and address/value equations.
// No instruction/CPU/memory runner, bus trace or elapsed-time model.
const specs=new Map([
  [0x80F6F4,{kind:'negate',body:[[0x80F6F4,'68'],[0x80F6F5,'49FFFF'],[0x80F6F8,'1A'],[0x80F6F9,'48'],[0x80F6FA,'4C89F3']]}],
  [0x80F6FD,{kind:'shift-left',body:[[0x80F6FD,'FA'],[0x80F6FE,'F006'],[0x80F700,'68'],[0x80F701,'0A'],[0x80F702,'CA'],[0x80F703,'D0FC'],[0x80F705,'48'],[0x80F706,'4C89F3']]}],
  [0x80F709,{kind:'shift-right',body:[[0x80F709,'FA'],[0x80F70A,'F006'],[0x80F70C,'68'],[0x80F70D,'4A'],[0x80F70E,'CA'],[0x80F70F,'D0FC'],[0x80F711,'48'],[0x80F712,'4C89F3']]}]
]);
const fetch=[[0x80F389,'B100'],[0x80F38B,'C8'],[0x80F38C,'29FF00'],[0x80F38F,'AA'],[0x80F390,'7CB4F2']];
const signatures={'68':['PLA','i',0],'49FFFF':['EOR','immM',65535],'1A':['INC','A',0],'48':['PHA','i',0],
  '4C89F3':['JMP','abs',0x80F389],'FA':['PLX','i',0],'0A':['ASL','A',0],'4A':['LSR','A',0],'CA':['DEX','i',0],
  'B100':['LDA','diy',0],'C8':['INY','i',0],'29FF00':['AND','immM',255],'AA':['TAX','i',0],'7CB4F2':['JMP','indx',0xF2B4]};
const word=v=>Number.isInteger(v)&&v>=0&&v<=65535;
function validate(map,spec){
  const path=[...spec.body,...fetch],shift=spec.kind!=='negate';
  for(let n=0;n<path.length;n++){
    const [pc,raw]=path[n],i=map.get(pc),length=raw.length/2;
    const [op,mode,value]=raw==='F006'?['BEQ','rel8',spec.body[7][0]]:raw==='D0FC'?['BNE','rel8',spec.body[3][0]]:signatures[raw];
    if(!i||i.cpu!==pc||i.mnemonic!==op||i.mode!==mode||(i.target??i.value)!==value
      ||i.opcode!==parseInt(raw.slice(0,2),16)||i.raw.toString('hex').toUpperCase()!==raw
      ||i.length!==length||i.next!==pc+length)throw Error('Renew negate/shift source lemma '+cpuLabel(pc));
    if(['e','m','x'].some(flag=>i.state?.[flag]!==0))throw Error('Negate/shift requires explicit E0M0X0');
    if(n<path.length-1&&(op==='JMP'?i.target:i.next)!==path[n+1][0])throw Error('Uncovered negate/shift source edge');
  }
  if(shift&&(map.get(spec.body[1][0]).next!==spec.body[2][0]||map.get(spec.body[5][0]).next!==spec.body[6][0]))throw Error('Unproved shift gate/loop fallthrough');
  return path;
}
function operations(spec,zero){
  const negate=spec.kind==='negate';return [
    {at:cpuLabel(spec.body[0][0]),kind:'read',instruction:negate?'WORD PLA':'WORD PLX',s_delta:0,offset:1,byte_order:['low','high'],value:negate?'original top WORD':'full WORD count'},
    ...(!negate&&!zero?[{at:cpuLabel(spec.body[2][0]),kind:'read',instruction:'WORD PLA',s_delta:2,offset:1,byte_order:['low','high'],value:'left value WORD'}]:[]),
    ...(!zero?[{at:cpuLabel(spec.body[negate?3:6][0]),kind:'write',instruction:'WORD PHA',s_delta:negate?2:4,offset:-1,byte_order:['high','low'],value:'result WORD'}]:[])];
}
export function proveNegateShiftToDispatch(map,entry){
  const spec=specs.get(entry);if(!spec)throw Error('Invalid negate/shift source entry');const path=validate(map,spec),negate=spec.kind==='negate';
  const common={entry:cpuLabel(entry),kind:spec.kind,source_closed_to_dispatch:true,native_binding:false,
    reachable_instructions:path.length,visited:path.map(([pc])=>cpuLabel(pc)),operand_s_delta:negate?0:2,
    outer_return_frames_added:0,minimum_protected_stack_bytes:null,external_return_assumptions:0,decimal_flag_required:null,
    y_delta_before_next_opcode:0,y_delta_at_frontier:1,
    output_mode:{e:0,m:0,x:0,d:'entry payload D',dbr:'entry actual DBR'},
    frontier:{at:'80:F390',kind:'indexed-opcode-JMP',a:'Fresh next-opcode lowbyte',x:'Fresh next-opcode lowbyte',
      target:'80:WORD(80:F2B4+X), no ASL/parity/ID clamp; actual next handler remains source-required'},
    flags:negate?'C/V/I/decimal preserved, even WORD8000 negation. EOR/INC local N/Z replaced by fresh opcode N0/Z(low==0).'
      :'Count0 preserves incoming C; positive count C is last actual ASL/LSR bit. V/I/decimal preserved. DEX N/Z drive BNE; fresh fetch replaces N/Z and X with opcode lowbyte.',
    qualification:'Local JMP-entered source through actual fetch/dispatch under E0M0X0/intact code and real D/DBR/S/Y/read/write owners. Operand byte counts are not a global protected stack minimum. Symbolic finite-count lemma, not CPU/memory/device/timing/scene/frame execution.'};
  if(negate)return {...common,stack_operations:operations(spec,false),required_readable_operand_stack_bytes:2,required_writable_operand_stack_bytes:2,
    result:'(original top WORD XOR FFFF)+1 modulo65536',executed_instructions:10};
  const zeroPath=[spec.body[0][0],spec.body[1][0],spec.body[7][0],...fetch.map(([pc])=>pc)];
  return {...common,
    zero_count:{visited:zeroPath.map(cpuLabel),executed_instructions:8,stack_operations:operations(spec,true),
      required_readable_operand_stack_bytes:2,required_writable_operand_stack_bytes:0,value_word_read:false,carry:'incoming C',operand_s_delta:2},
    positive_count:{visited:path.map(([pc])=>cpuLabel(pc)),stack_operations:operations(spec,false),required_readable_operand_stack_bytes:4,
      required_writable_operand_stack_bytes:2,iterations:'exact full WORD count, 1..65535',executed_instructions:'10+3*count',
      x_at_loop_exit:0,carry:'last ASL/LSR output bit',operand_s_delta:2},
    loop_lemma:{guard:{at:cpuLabel(spec.body[1][0]),flag_origin:cpuLabel(spec.body[0][0]),condition:'PLX WORD Z==1 iff count==0',zero_target:cpuLabel(spec.body[7][0])},
      shift:cpuLabel(spec.body[3][0]),decrement:cpuLabel(spec.body[4][0]),backedge:cpuLabel(spec.body[5][0]),
      invariant:'For supplied count n in1..65535, before iteration k+1, X=n-k with0<=k<n. WORD DEX produces n-k-1, no premature WORD wrap; BNE tests DEX Z, exits iff k+1=n.',
      finite_iterations:'n; no host clamp at16/32, signed limit, or repeated zero-count underflow',
      qualification:'Instruction/data induction under intact code/modes/stack context only. Counts give neither elapsed time, interpreter return nor original device/frame evidence.'}};
}
export function describeNegateShiftByteOwners({entry,d,bank,s,y,count,pointerAfter}){
  const spec=specs.get(entry);if(!spec)throw Error('Invalid negate/shift source entry');const negate=spec.kind==='negate';
  if(![d,s,y,pointerAfter].every(word)||!Number.isInteger(bank)||bank<0||bank>255||!negate&&!word(count))throw Error('Explicit negate/shift address context required');
  const owner=address=>({address:cpuLabel(address),physical_address:renderAddress(address)===null?null:cpuLabel(renderAddress(address))}),zero=!negate&&count===0;
  const ordered=operations(spec,zero).map(o=>({...o,bytes:o.byte_order.map(byte=>({...owner((s+o.s_delta+o.offset+(byte==='high'?1:0))&65535),byte}))}));
  const a=(bank*65536+pointerAfter+y)&0xFFFFFF;return {entry:cpuLabel(entry),context:{d,bank,s,y,...(!negate?{count}:{})},stack_operations:ordered,
    s_after_first_pull:(s+2)&65535,s_before_pha:zero?null:(s+(negate?2:4))&65535,
    output_operand_s:(s+(negate?0:2))&65535,value_word_read:!zero,
    next_opcode_sources:{pointer_reads:[owner(d),owner((d+1)&65535)],word_reads:[owner(a),owner((a+1)&0xFFFFFF)]},
    next_opcode_y:y,frontier_y:(y+1)&65535,
    qualification:'Ordered byte address equations only. Count0 pulls only count, no operand-value PLA/store; aliased valuebytes can still be F389 DP/fetch sources requiring separate owners. Pulls low/high, PHA high/low at actual raised S. Bank00 byte/S wrap16bits; fresh poststore pointer supplied separately. Known physical address is not an owner/write/initialization/outerstack proof. No memory read/write, plan, commit, bus/device or CPU execution.'};
}
// Closed WORD data equations; no instruction loop, flag runner or timing model.
export function negateWord(value){if(!word(value))throw Error('Explicit operand WORD required');return (65536-value)%65536;}
export function shiftWordConsequence({entry,count,value,incomingCarry}){
  if(![0x80F6FD,0x80F709].includes(entry))throw Error('Invalid shift source entry');if(!word(count))throw Error('Explicit WORD count required');
  if(count===0){if(![0,1].includes(incomingCarry))throw Error('Explicit incoming Carry required for zero count');
    return {value:null,value_word_read:false,original_value_preserved:true,carry:incomingCarry,iterations:0};}
  if(!word(value))throw Error('Explicit operand WORD required');const left=entry===0x80F6FD;
  return {value:count>=16?0:left?(value*2**count)%65536:Math.floor(value/2**count),value_word_read:true,original_value_preserved:false,
    carry:count>16?0:Math.floor(value/2**(left?16-count:count-1))%2,iterations:count};
}
