import {cpuLabel} from './rom.mjs';
import {renderAddress} from '../src/render/data.mjs';
// Fixed source signatures and closed WORD/address equations, no CPU runner.
const specs=new Map([
  [0x80F735,{kind:'8A',decrement:true,body:[[0x80F735,'A2FFFF'],[0x80F738,'68'],[0x80F739,'3A'],[0x80F73A,'C301'],[0x80F73C,'B001'],[0x80F73E,'E8'],[0x80F73F,'8A'],[0x80F740,'8301'],[0x80F742,'4C89F3']]}],
  [0x80F77A,{kind:'92',decrement:false,body:[[0x80F77A,'A2FFFF'],[0x80F77D,'68'],[0x80F77E,'C301'],[0x80F780,'B001'],[0x80F782,'E8'],[0x80F783,'8A'],[0x80F784,'8301'],[0x80F786,'4C89F3']]}],
  [0x80F7BC,{kind:'9A',decrement:false,body:[[0x80F7BC,'A2FFFF'],[0x80F7BF,'68'],[0x80F7C0,'C301'],[0x80F7C2,'9001'],[0x80F7C4,'E8'],[0x80F7C5,'8A'],[0x80F7C6,'8301'],[0x80F7C8,'4C89F3']]}],
  [0x80F7FE,{kind:'A2',decrement:true,body:[[0x80F7FE,'A20000'],[0x80F801,'68'],[0x80F802,'3A'],[0x80F803,'C301'],[0x80F805,'9001'],[0x80F807,'CA'],[0x80F808,'8A'],[0x80F809,'8301'],[0x80F80B,'4C89F3']]}]
]);
const fetch=[[0x80F389,'B100'],[0x80F38B,'C8'],[0x80F38C,'29FF00'],[0x80F38F,'AA'],[0x80F390,'7CB4F2']];
const signatures={'A2FFFF':['LDX','immX'],'A20000':['LDX','immX'],'68':['PLA','i'],'3A':['DEC','A'],
  'C301':['CMP','sr'],'B001':['BCS','rel8'],'9001':['BCC','rel8'],'E8':['INX','i'],'CA':['DEX','i'],
  '8A':['TXA','i'],'8301':['STA','sr'],'4C89F3':['JMP','abs'],'B100':['LDA','diy'],'C8':['INY','i'],
  '29FF00':['AND','immM'],'AA':['TAX','i'],'7CB4F2':['JMP','indx']};
const word=v=>Number.isInteger(v)&&v>=0&&v<=65535;
function specFor(entry){const spec=specs.get(entry);if(!spec)throw Error('Invalid carry compare source entry');return spec;}
function validate(map,spec){const all=[...spec.body,...fetch];
  for(const [pc,raw]of all){const i=map.get(pc),b=Buffer.from(raw,'hex'),[op,mode]=signatures[raw],length=b.length;
    const value=length===1?0:b.readUIntLE(1,length-1),next=pc+length;
    const target=mode==='rel8'?pc+2+b.readInt8(1):op==='JMP'&&mode==='abs'?0x80F389:undefined;
    if(!i||i.cpu!==pc||i.opcode!==b[0]||i.mnemonic!==op||i.mode!==mode||i.value!==value||i.target!==target
      ||i.length!==length||i.next!==next||!i.raw.equals(b))throw Error('Renew carry compare source lemma '+cpuLabel(pc));
    if(['e','m','x'].some(flag=>i.state?.[flag]!==0))throw Error('Carry compare requires explicit E0M0X0');
    if(pc!==0x80F390){const destinations=op==='JMP'?[target]:mode==='rel8'?[next,target]:[next];
      if(destinations.some(to=>!all.some(([source])=>source===to)))throw Error('Uncovered carry compare source edge');}
  }return all;
}
function operations(spec){const b=spec.body,n=spec.decrement?1:0;return [
  {at:cpuLabel(b[1][0]),kind:'read',instruction:'WORD PLA',s_delta:0,offset:1,byte_order:['low','high'],value:'original right WORD; S then increases2'},
  {at:cpuLabel(b[2+n][0]),kind:'read',instruction:'WORD CMP01,S',s_delta:2,offset:1,byte_order:['low','high'],value:'fresh left WORD, compared against actual transformed right in A'},
  {at:cpuLabel(b[6+n][0]),kind:'write',instruction:'WORD STA01,S',s_delta:2,offset:1,byte_order:['low','high'],value:'result WORD replaces left'}];}
export function proveCarryCompareToDispatch(map,entry){const spec=specFor(entry),all=validate(map,spec),b=spec.body,n=spec.decrement?1:0;
  const branch=map.get(b[3+n][0]),update=b[4+n][0];
  return {entry:cpuLabel(entry),opcode_kind:spec.kind,source_closed_to_dispatch:true,native_binding:false,
    reachable_instructions:all.length,visited:all.map(([pc])=>cpuLabel(pc)),operand_s_delta:2,
    required_readable_operand_stack_bytes:4,required_writable_operand_stack_bytes:2,outer_return_frames_added:0,
    minimum_protected_stack_bytes:null,external_return_assumptions:0,decimal_flag_required:null,
    compared_right:spec.decrement?'(original right WORD-1) modulo65536, including0000->FFFF':'original right WORD',
    decrement:spec.decrement?{at:cpuLabel(b[2][0]),instruction:'WORD DEC A',carry_overflow:'C/V preserved; no decimal arithmetic',memory_write:false}:null,
    branch:{at:cpuLabel(branch.cpu),kind:branch.mnemonic,flag_origin:cpuLabel(b[2+n][0]),
      condition:branch.mnemonic==='BCS'?'taken iff actual CMP C1':'taken iff actual CMP C0',
      taken:cpuLabel(branch.target),fallthrough:cpuLabel(branch.next)},
    paths:[true,false].map(taken=>{const p=all.filter(([pc])=>!taken||pc!==update);return {
      branch_taken:taken,carry:branch.mnemonic==='BCS'?Number(taken):Number(!taken),
      visited:p.map(([pc])=>cpuLabel(pc)),executed_instructions:p.length,stack_operations:operations(spec),
      result:spec.kind==='A2'?(taken?'0000':'FFFF'):(taken?'FFFF':'0000'),
      x_before_next_fetch:spec.kind==='A2'?(taken?0:65535):(taken?65535:0)};}),
    y_delta_before_next_opcode:0,y_delta_at_frontier:1,
    output_mode:{e:0,m:0,x:0,d:'entry payload D',dbr:'entry actual DBR'},
    frontier:{at:'80:F390',kind:'indexed-opcode-JMP',a:'Fresh next-opcode lowbyte',x:'Fresh next-opcode lowbyte',
      target:'80:WORD(80:F2B4+X), no ASL/parity/ID clamp; actual next handler remains source-required'},
    flags:'CMP C1 iff unsigned transformedRight>=freshLeft; incomingC/decimal ignored. DEC A, INX/DEX/TXA/STA/fetch preserve C/V; V/I/decimal remain entry values. Final N0/Z(nextOpcodeLow==0), X freshOpcodeLow.',
    qualification:'Four JMP-entered local WORD sources and eight finite branch lemmas through actual fresh F389/F390 only. Actual D/DBR/S/Y/fresh operands, E0M0X0 and intact code/outerstack plus real byte owners required. No familiar comparison operator, root JSR/global stack minimum, CPU/memory/device/scene/frame execution inferred.'};
}
export function carryCompareWordConsequence({entry,right,left}){
  const spec=specFor(entry);if(!word(right)||!word(left))throw Error('Explicit original right and fresh left WORDs required');
  const comparedRight=spec.decrement?(right+65535)%65536:right,carry=Number(comparedRight>=left);
  return {compared_right_word:comparedRight,carry,value:(spec.kind==='9A'?!carry:carry)?65535:0};
}
export function describeCarryCompareByteOwners({entry,d,bank,s,y,pointerAfter,right,left}){
  const spec=specFor(entry);
  if(![d,s,y,pointerAfter].every(word)||!Number.isInteger(bank)||bank<0||bank>255)throw Error('Explicit carry compare address context required');
  const consequence=carryCompareWordConsequence({entry,right,left});
  const owner=a=>({address:cpuLabel(a),physical_address:renderAddress(a)===null?null:cpuLabel(renderAddress(a))});
  const ordered=operations(spec).map(o=>({...o,bytes:o.byte_order.map(byte=>({...owner((s+o.s_delta+o.offset+(byte==='high'?1:0))&65535),byte}))}));
  const a=(bank*65536+pointerAfter+y)&0xFFFFFF;
  return {entry:cpuLabel(entry),context:{d,bank,s,y,right,left},compared_right_word:consequence.compared_right_word,stack_operations:ordered,
    s_after_pla:(s+2)&65535,output_operand_s:(s+2)&65535,
    next_opcode_sources:{pointer_reads:[owner(d),owner((d+1)&65535)],word_reads:[owner(a),owner((a+1)&0xFFFFFF)]},
    next_opcode_y:y,frontier_y:(y+1)&65535,
    qualification:'Ordered address equations only. Original right WORD pulled low/high, optional DEC affects A only, fresh left CMP read after S+2, left resultstore low/high, then fresh pointer/opcode. Bank00 byte/S wrap16bits; physical mapping is not an owner/write/initialization/outerstack proof. No memory read/write, plan, commit, bus/device or CPU execution.'};
}
