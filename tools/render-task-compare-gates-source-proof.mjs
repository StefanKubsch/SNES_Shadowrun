import {cpuLabel} from './rom.mjs';
import {renderAddress} from '../src/render/data.mjs';
// Fixed source signatures, finite branch paths and pure byte/value equations.
// No CPU/memory runner; distinct fresh read values are explicit observations.
const specs=new Map([
  [0x80F852,{kind:'AC',leftGate:true,body:[[0x80F852,'A303'],[0x80F854,'1009'],[0x80F856,'68'],[0x80F857,'A90000'],[0x80F85A,'8301'],[0x80F85C,'4C89F3'],[0x80F85F,'A20000'],[0x80F862,'68'],[0x80F863,'C301'],[0x80F865,'F001'],[0x80F867,'CA'],[0x80F868,'8A'],[0x80F869,'8301'],[0x80F86B,'4C89F3']]}],
  [0x80F86E,{kind:'AE',leftGate:false,body:[[0x80F86E,'A20000'],[0x80F871,'68'],[0x80F872,'3005'],[0x80F874,'C301'],[0x80F876,'F000'],[0x80F878,'CA'],[0x80F879,'8A'],[0x80F87A,'8301'],[0x80F87C,'4C89F3']]}],
  [0x80F88E,{kind:'B4',leftGate:true,body:[[0x80F88E,'A303'],[0x80F890,'1009'],[0x80F892,'68'],[0x80F893,'A9FFFF'],[0x80F896,'8301'],[0x80F898,'4C89F3'],[0x80F89B,'A2FFFF'],[0x80F89E,'68'],[0x80F89F,'C301'],[0x80F8A1,'D001'],[0x80F8A3,'E8'],[0x80F8A4,'8A'],[0x80F8A5,'8301'],[0x80F8A7,'4C89F3']]}],
  [0x80F8AA,{kind:'B6',leftGate:false,body:[[0x80F8AA,'A2FFFF'],[0x80F8AD,'68'],[0x80F8AE,'3005'],[0x80F8B0,'C301'],[0x80F8B2,'D001'],[0x80F8B4,'E8'],[0x80F8B5,'8A'],[0x80F8B6,'8301'],[0x80F8B8,'4C89F3']]}]
]);
const fetch=[[0x80F389,'B100'],[0x80F38B,'C8'],[0x80F38C,'29FF00'],[0x80F38F,'AA'],[0x80F390,'7CB4F2']];
const signatures={'A303':['LDA','sr'],'1009':['BPL','rel8'],'68':['PLA','i'],'A90000':['LDA','immM'],
  'A9FFFF':['LDA','immM'],'8301':['STA','sr'],'4C89F3':['JMP','abs'],'A20000':['LDX','immX'],'A2FFFF':['LDX','immX'],
  'C301':['CMP','sr'],'F001':['BEQ','rel8'],'F000':['BEQ','rel8'],'D001':['BNE','rel8'],'CA':['DEX','i'],
  'E8':['INX','i'],'8A':['TXA','i'],'3005':['BMI','rel8'],'B100':['LDA','diy'],'C8':['INY','i'],
  '29FF00':['AND','immM'],'AA':['TAX','i'],'7CB4F2':['JMP','indx']};
const word=v=>Number.isInteger(v)&&v>=0&&v<=65535;
function specFor(entry){const spec=specs.get(entry);if(!spec)throw Error('Invalid compare gate source entry');return spec;}
function validate(map,spec){
  const all=[...spec.body,...fetch];
  for(const [pc,raw]of all){const i=map.get(pc),[op,mode]=signatures[raw],b=Buffer.from(raw,'hex'),length=b.length;
    const value=length===1?0:b.readUIntLE(1,length-1),next=pc+length;
    const target=mode==='rel8'?pc+2+b.readInt8(1):op==='JMP'&&mode==='abs'?0x80F389:undefined;
    if(!i||i.cpu!==pc||i.opcode!==b[0]||i.mnemonic!==op||i.mode!==mode||i.value!==value||i.target!==target
      ||i.length!==length||i.next!==next||!i.raw.equals(b))throw Error('Renew compare gate source lemma '+cpuLabel(pc));
    if(['e','m','x'].some(flag=>i.state?.[flag]!==0))throw Error('Compare gates require explicit E0M0X0');
    if(pc!==0x80F390){const destinations=op==='JMP'?[target]:mode==='rel8'?[next,target]:[next];
      if(destinations.some(to=>!all.some(([source])=>source===to)))throw Error('Uncovered compare gate source edge');}
  }
  return all;
}
function paths(spec){const b=spec.body,f=fetch.map(([pc])=>pc),p=indices=>[...indices.map(n=>b[n][0]),...f];
  if(spec.leftGate)return [
    {condition:'leftGateWORD bit15==1',compared:false,branch_taken:[false],visited:p([0,1,2,3,4,5]),result:spec.kind==='AC'?'0000':'FFFF'},
    {condition:'leftGateWORD bit15==0; right==fresh leftCompareWORD',compared:true,branch_taken:[true,spec.kind==='AC'],
      visited:p(spec.kind==='AC'?[0,1,6,7,8,9,11,12,13]:[0,1,6,7,8,9,10,11,12,13]),result:'0000'},
    {condition:'leftGateWORD bit15==0; right!=fresh leftCompareWORD',compared:true,branch_taken:[true,spec.kind!=='AC'],
      visited:p(spec.kind==='AC'?[0,1,6,7,8,9,10,11,12,13]:[0,1,6,7,8,9,11,12,13]),result:'FFFF'}];
  return [
    {condition:'rightWORD bit15==1',compared:false,branch_taken:[true],visited:p([0,1,2,6,7,8]),result:spec.kind==='AE'?'0000':'FFFF'},
    {condition:'rightWORD bit15==0; right==fresh leftCompareWORD',compared:true,branch_taken:[false,spec.kind==='AE'],
      visited:p([0,1,2,3,4,5,6,7,8]),result:spec.kind==='AE'?'FFFF':'0000'},
    {condition:'rightWORD bit15==0; right!=fresh leftCompareWORD',compared:true,branch_taken:[false,spec.kind!=='AE'],
      visited:p(spec.kind==='AE'?[0,1,2,3,4,5,6,7,8]:[0,1,2,3,4,6,7,8]),result:'FFFF'}];
}
function operations(spec,compared){const b=spec.body;return [
  ...(spec.leftGate?[{at:cpuLabel(b[0][0]),kind:'read',instruction:'WORD LDA03,S',s_delta:0,offset:3,byte_order:['low','high'],value:'leftGateWORD, before right PLA'}]:[]),
  {at:cpuLabel(b[spec.leftGate?(compared?7:2):1][0]),kind:'read',instruction:'WORD PLA',s_delta:0,offset:1,byte_order:['low','high'],value:'rightWORD; S then increases2'},
  ...(compared?[{at:cpuLabel(b[spec.leftGate?8:3][0]),kind:'read',instruction:'WORD CMP01,S',s_delta:2,offset:1,byte_order:['low','high'],value:'fresh leftCompareWORD, not cached leftGateWORD'}]:[]),
  {at:cpuLabel(b[spec.leftGate?(compared?12:4):7][0]),kind:'write',instruction:'WORD STA01,S',s_delta:2,offset:1,byte_order:['low','high'],value:'resultWORD replaces left'}];}
export function proveCompareGatesToDispatch(map,entry){const spec=specFor(entry),all=validate(map,spec),b=spec.body;
  const sign=map.get(b[spec.leftGate?1:2][0]),comparison=map.get(b[spec.leftGate?9:4][0]);
  return {entry:cpuLabel(entry),opcode_kind:spec.kind,source_closed_to_dispatch:true,native_binding:false,
    reachable_instructions:all.length,visited:all.map(([pc])=>cpuLabel(pc)),operand_s_delta:2,outer_return_frames_added:0,
    minimum_protected_stack_bytes:null,external_return_assumptions:0,decimal_flag_required:null,
    gates:[{at:cpuLabel(sign.cpu),kind:sign.mnemonic,flag_origin:cpuLabel(b[spec.leftGate?0:1][0]),
      condition:spec.leftGate?'BPL on leftGateWORD LDA N; taken iff bit15==0':'BMI on rightWORD PLA N; taken iff bit15==1',
      taken:cpuLabel(sign.target),fallthrough:cpuLabel(sign.next)},
      {at:cpuLabel(comparison.cpu),kind:comparison.mnemonic,flag_origin:cpuLabel(b[spec.leftGate?8:3][0]),
        condition:comparison.mnemonic==='BEQ'?'CMP Z1 iff right==fresh leftCompareWORD':'CMP Z0 iff right!=fresh leftCompareWORD',
        taken:cpuLabel(comparison.target),fallthrough:cpuLabel(comparison.next),taken_equals_fallthrough:comparison.target===comparison.next}],
    paths:paths(spec).map(p=>({...p,visited:p.visited.map(cpuLabel),executed_instructions:p.visited.length,stack_operations:operations(spec,p.compared),
      readable_operand_byte_accesses:(spec.leftGate?4:2)+(p.compared?2:0),required_readable_operand_stack_bytes:spec.leftGate||p.compared?4:2,
      required_writable_operand_stack_bytes:2,carry:p.compared?'CMP Carry: unsigned right>=fresh leftCompareWORD':'incoming Carry; no CMP'})),
    y_delta_before_next_opcode:0,y_delta_at_frontier:1,
    output_mode:{e:0,m:0,x:0,d:'entry payload D',dbr:'entry actual DBR'},
    frontier:{at:'80:F390',kind:'indexed-opcode-JMP',a:'Fresh next-opcode lowbyte',x:'Fresh next-opcode lowbyte',
      target:'80:WORD(80:F2B4+X), no ASL/parity/ID clamp; actual next handler remains source-required'},
    flags:'Sign gate uses actual LDA/PLA N. Compared paths C1 iff unsigned right>=fresh leftCompareWORD, skip paths preserve incoming C. V/I/decimal preserved; final N0/Z(nextOpcodeLow==0).',
    qualification:'Fixed local JMP-entered source and twelve finite branch lemmas only. Actual fresh WORD observations/byte owners, E0M0X0/D/DBR/S/Y and intact code/outerstack required. No familiar comparison operator, global stack minimum, original initialization, CPU/memory/device/scene/frame execution inferred.'};
}
export function compareGateWordConsequence({entry,leftGateWord,leftCompareWord,right,incomingCarry}){
  const spec=specFor(entry);if(!word(right)||spec.leftGate&&!word(leftGateWord))throw Error('Explicit gate/right WORDs required');
  const skipped=spec.leftGate?leftGateWord>=32768:right>=32768;
  if(skipped){if(![0,1].includes(incomingCarry))throw Error('Explicit incoming Carry required on no-CMP path');
    return {value:['AC','AE'].includes(spec.kind)?0:65535,carry:incomingCarry,left_compare_word_read:false};}
  if(!word(leftCompareWord))throw Error('Explicit fresh leftCompareWORD required');
  return {value:spec.kind==='AE'||right!==leftCompareWord?65535:0,carry:right>=leftCompareWord?1:0,left_compare_word_read:true};
}
export function describeCompareGateByteOwners({entry,d,bank,s,y,pointerAfter,leftGateWord,leftCompareWord,right,incomingCarry}){
  const spec=specFor(entry);
  if(![d,s,y,pointerAfter].every(word)||!Number.isInteger(bank)||bank<0||bank>255)throw Error('Explicit compare gate address context required');
  const consequence=compareGateWordConsequence({entry,leftGateWord,leftCompareWord,right,incomingCarry});
  const owner=a=>({address:cpuLabel(a),physical_address:renderAddress(a)===null?null:cpuLabel(renderAddress(a))});
  const ordered=operations(spec,consequence.left_compare_word_read).map(o=>({...o,bytes:o.byte_order.map(byte=>({...owner((s+o.s_delta+o.offset+(byte==='high'?1:0))&65535),byte}))}));
  const a=(bank*65536+pointerAfter+y)&0xFFFFFF;
  return {entry:cpuLabel(entry),context:{d,bank,s,y,right,...(spec.leftGate?{leftGateWord}:{}),
      ...(consequence.left_compare_word_read?{leftCompareWord}:{incomingCarry})},stack_operations:ordered,
    s_after_pla:(s+2)&65535,output_operand_s:(s+2)&65535,left_compare_word_read:consequence.left_compare_word_read,
    next_opcode_sources:{pointer_reads:[owner(d),owner((d+1)&65535)],word_reads:[owner(a),owner((a+1)&0xFFFFFF)]},
    next_opcode_y:y,frontier_y:(y+1)&65535,
    qualification:'Ordered byte equations only. AC/B4 leftGate read precedes right PLA, compared path rereads left freshly; AE/B6 negative right does not read left. All paths still write left low/high after S+2; bank00 byte/S wrap16bits. Fresh poststore pointer supplied separately; physical mapping is not an owner/write/initialization/outerstack proof. No memory read/write, plan, commit, bus/device or CPU execution.'};
}
