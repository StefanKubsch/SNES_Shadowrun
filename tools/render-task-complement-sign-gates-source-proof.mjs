import {cpuLabel} from './rom.mjs';
import {renderAddress} from '../src/render/data.mjs';
// Fixed ROM signatures, finite paths and pure WORD/address equations. No CPU runner.
const specs=new Map([
  [0x80F7CB,{kind:'9C',leftGate:true,decrement:false,body:[[0x80F7CB,'A303'],[0x80F7CD,'1009'],[0x80F7CF,'68'],[0x80F7D0,'A90000'],[0x80F7D3,'8301'],[0x80F7D5,'4C89F3'],[0x80F7D8,'A2FFFF'],[0x80F7DB,'68'],[0x80F7DC,'C301'],[0x80F7DE,'9001'],[0x80F7E0,'E8'],[0x80F7E1,'8A'],[0x80F7E2,'8301'],[0x80F7E4,'4C89F3']]}],
  [0x80F7E7,{kind:'9E',leftGate:false,decrement:false,body:[[0x80F7E7,'A2FFFF'],[0x80F7EA,'68'],[0x80F7EB,'3005'],[0x80F7ED,'C301'],[0x80F7EF,'9001'],[0x80F7F1,'E8'],[0x80F7F2,'8A'],[0x80F7F3,'8301'],[0x80F7F5,'4C89F3']]}],
  [0x80F80E,{kind:'A4',leftGate:true,decrement:true,body:[[0x80F80E,'A303'],[0x80F810,'1009'],[0x80F812,'68'],[0x80F813,'A90000'],[0x80F816,'8301'],[0x80F818,'4C89F3'],[0x80F81B,'A2FFFF'],[0x80F81E,'68'],[0x80F81F,'3A'],[0x80F820,'C301'],[0x80F822,'9001'],[0x80F824,'E8'],[0x80F825,'8A'],[0x80F826,'8301'],[0x80F828,'4C89F3']]}],
  [0x80F82B,{kind:'A6',leftGate:false,decrement:true,body:[[0x80F82B,'A2FFFF'],[0x80F82E,'68'],[0x80F82F,'3006'],[0x80F831,'3A'],[0x80F832,'C301'],[0x80F834,'9001'],[0x80F836,'E8'],[0x80F837,'8A'],[0x80F838,'8301'],[0x80F83A,'4C89F3']]}]
]);
const fetch=[[0x80F389,'B100'],[0x80F38B,'C8'],[0x80F38C,'29FF00'],[0x80F38F,'AA'],[0x80F390,'7CB4F2']];
const signatures={'A303':['LDA','sr'],'1009':['BPL','rel8'],'68':['PLA','i'],'A90000':['LDA','immM'],
  '8301':['STA','sr'],'4C89F3':['JMP','abs'],'A2FFFF':['LDX','immX'],'3A':['DEC','A'],
  'C301':['CMP','sr'],'9001':['BCC','rel8'],'E8':['INX','i'],'8A':['TXA','i'],'3005':['BMI','rel8'],
  '3006':['BMI','rel8'],'B100':['LDA','diy'],'C8':['INY','i'],'29FF00':['AND','immM'],'AA':['TAX','i'],'7CB4F2':['JMP','indx']};
const word=v=>Number.isInteger(v)&&v>=0&&v<=65535;
function specFor(entry){const s=specs.get(entry);if(!s)throw Error('Invalid complement sign gate source entry');return s;}
function validate(map,spec){const all=[...spec.body,...fetch];
  for(const [pc,raw]of all){const i=map.get(pc),b=Buffer.from(raw,'hex'),[op,mode]=signatures[raw],length=b.length;
    const value=length===1?0:b.readUIntLE(1,length-1),next=pc+length;
    const target=mode==='rel8'?pc+2+b.readInt8(1):op==='JMP'&&mode==='abs'?0x80F389:undefined;
    if(!i||i.cpu!==pc||i.opcode!==b[0]||i.mnemonic!==op||i.mode!==mode||i.value!==value||i.target!==target
      ||i.length!==length||i.next!==next||!i.raw.equals(b))throw Error('Renew complement sign gate source lemma '+cpuLabel(pc));
    if(['e','m','x'].some(flag=>i.state?.[flag]!==0))throw Error('Complement sign gates require explicit E0M0X0');
    if(pc!==0x80F390){const destinations=op==='JMP'?[target]:mode==='rel8'?[next,target]:[next];
      if(destinations.some(to=>!all.some(([source])=>source===to)))throw Error('Uncovered complement sign gate source edge');}
  }return all;
}
function indices(spec){const n=spec.decrement?1:0;return spec.leftGate?
  {sign:1,origin:0,pla:7,cmp:8+n,branch:9+n,update:10+n,store:12+n}:
  {sign:2,origin:1,pla:1,cmp:3+n,branch:4+n,update:5+n,store:7+n};}
function paths(spec){const b=spec.body,k=indices(spec),f=fetch.map(([pc])=>pc),p=ns=>[...ns.map(n=>b[n][0]),...f];
  const compared=carry=>Array.from({length:b.length},(_,n)=>n).filter(n=>(!spec.leftGate||n<2||n>=6)&&(carry!==0||n!==k.update));
  return [{condition:spec.leftGate?'leftGateWORD bit15==1':'original rightWORD bit15==1',compared:false,branch_taken:[!spec.leftGate],
      visited:p(spec.leftGate?[0,1,2,3,4,5]:[0,1,2,k.update+1,k.store,k.store+1]),result:spec.leftGate?'0000':'FFFF',carry:'incoming Carry; no CMP'},
    ...[0,1].map(carry=>({condition:(spec.leftGate?'leftGateWORD':'original rightWORD')+' bit15==0; actual CMP C'+carry,
      compared:true,branch_taken:[spec.leftGate,!carry],visited:p(compared(carry)),result:carry?'0000':'FFFF',carry}))];
}
function operations(spec,compared){const b=spec.body,k=indices(spec);return [
  ...(spec.leftGate?[{at:cpuLabel(b[0][0]),kind:'read',instruction:'WORD LDA03,S',s_delta:0,offset:3,byte_order:['low','high'],value:'leftGateWORD before right PLA'}]:[]),
  {at:cpuLabel(b[spec.leftGate&&!compared?2:k.pla][0]),kind:'read',instruction:'WORD PLA',s_delta:0,offset:1,byte_order:['low','high'],value:'original right WORD; S then increases2'},
  ...(compared?[{at:cpuLabel(b[k.cmp][0]),kind:'read',instruction:'WORD CMP01,S',s_delta:2,offset:1,byte_order:['low','high'],value:'fresh leftCompareWORD, not cached gate; A actual transformed right'}]:[]),
  {at:cpuLabel(b[spec.leftGate&&!compared?4:k.store][0]),kind:'write',instruction:'WORD STA01,S',s_delta:2,offset:1,byte_order:['low','high'],value:'result WORD replaces left'}];}
export function proveComplementSignGatesToDispatch(map,entry){const spec=specFor(entry),all=validate(map,spec),b=spec.body,k=indices(spec);
  const sign=map.get(b[k.sign][0]),branch=map.get(b[k.branch][0]);
  return {entry:cpuLabel(entry),opcode_kind:spec.kind,source_closed_to_dispatch:true,native_binding:false,
    reachable_instructions:all.length,visited:all.map(([pc])=>cpuLabel(pc)),operand_s_delta:2,outer_return_frames_added:0,
    minimum_protected_stack_bytes:null,external_return_assumptions:0,decimal_flag_required:null,
    gates:[{at:cpuLabel(sign.cpu),kind:sign.mnemonic,flag_origin:cpuLabel(b[k.origin][0]),
      condition:spec.leftGate?'BPL on fresh leftGate LDA N0':'BMI on original right PLA N1, before DEC',taken:cpuLabel(sign.target),fallthrough:cpuLabel(sign.next)},
      {at:cpuLabel(branch.cpu),kind:'BCC',flag_origin:cpuLabel(b[k.cmp][0]),condition:'taken iff actual fresh CMP C0',taken:cpuLabel(branch.target),fallthrough:cpuLabel(branch.next)}],
    decrement:spec.decrement?{at:cpuLabel(b[k.cmp-1][0]),instruction:'WORD DEC A',only_on_compared_path:true,memory_write:false,carry_overflow:'C/V/decimal preserved; 0000->FFFF, no saturation'}:null,
    paths:paths(spec).map(p=>({...p,visited:p.visited.map(cpuLabel),executed_instructions:p.visited.length,stack_operations:operations(spec,p.compared),
      readable_operand_byte_accesses:(spec.leftGate?4:2)+(p.compared?2:0),required_readable_operand_stack_bytes:spec.leftGate||p.compared?4:2,
      required_writable_operand_stack_bytes:2,x_before_next_fetch:spec.leftGate&&!p.compared?'entry X unchanged':p.result==='FFFF'?65535:0})),
    y_delta_before_next_opcode:0,y_delta_at_frontier:1,output_mode:{e:0,m:0,x:0,d:'entry payload D',dbr:'entry actual DBR'},
    frontier:{at:'80:F390',kind:'indexed-opcode-JMP',a:'Fresh next-opcode lowbyte',x:'Fresh next-opcode lowbyte',
      target:'80:WORD(80:F2B4+X), no ASL/parity/ID clamp; next handler remains source-required'},
    flags:'LDA/PLA actual N gates; right BMI precedes DEC. No-CMP preserves incoming C; compared C1 iff unsigned transformedRight>=freshLeft. DEC/INX/TXA/STA/fetch preserve C/V/I/decimal; final N0/Z(nextOpcodeLow==0).',
    qualification:'Four JMP-entered sources, twelve finite paths to dynamic F390 only. Fresh reads/real byte owners/intact code and outerstack plus E0M0X0/D/DBR/S/Y required. No global stack minimum, conventional comparison operator, CPU/memory/task/device/scene/frame execution inferred.'};
}
export function complementSignGateWordConsequence({entry,right,leftGateWord,leftCompareWord,incomingCarry}){
  const spec=specFor(entry);if(!word(right)||spec.leftGate&&!word(leftGateWord))throw Error('Explicit original right/gate WORDs required');
  const skipped=spec.leftGate?leftGateWord>=32768:right>=32768;
  if(skipped){if(![0,1].includes(incomingCarry))throw Error('Explicit incoming Carry required on no-CMP path');
    return {value:spec.leftGate?0:65535,carry:incomingCarry,left_compare_word_read:false,decrement_executed:false,compared_right_word:null};}
  if(!word(leftCompareWord))throw Error('Explicit fresh leftCompareWORD required');
  const w=spec.decrement?(right+65535)%65536:right,carry=Number(w>=leftCompareWord);
  return {value:carry?0:65535,carry,left_compare_word_read:true,decrement_executed:spec.decrement,compared_right_word:w};
}
export function describeComplementSignGateByteOwners({entry,d,bank,s,y,pointerAfter,right,leftGateWord,leftCompareWord,incomingCarry}){
  const spec=specFor(entry);if(![d,s,y,pointerAfter].every(word)||!Number.isInteger(bank)||bank<0||bank>255)throw Error('Explicit complement sign gate address context required');
  const c=complementSignGateWordConsequence({entry,right,leftGateWord,leftCompareWord,incomingCarry});
  const owner=a=>({address:cpuLabel(a),physical_address:renderAddress(a)===null?null:cpuLabel(renderAddress(a))});
  const ordered=operations(spec,c.left_compare_word_read).map(o=>({...o,bytes:o.byte_order.map(byte=>({...owner((s+o.s_delta+o.offset+(byte==='high'?1:0))&65535),byte}))}));
  const a=(bank*65536+pointerAfter+y)&0xFFFFFF;
  return {entry:cpuLabel(entry),context:{d,bank,s,y,right,...(spec.leftGate?{leftGateWord}:{}),...(c.left_compare_word_read?{leftCompareWord}:{incomingCarry})},
    stack_operations:ordered,s_after_pla:(s+2)&65535,output_operand_s:(s+2)&65535,...c,
    next_opcode_sources:{pointer_reads:[owner(d),owner((d+1)&65535)],word_reads:[owner(a),owner((a+1)&0xFFFFFF)]},next_opcode_y:y,frontier_y:(y+1)&65535,
    qualification:'Ordered address/value equations only. Left gate before PLA, optional DEC register only, fresh CMP on compared paths, always left low/high stores then fresh pointer/opcode. Right negative has no left read or DEC. Bank00/S wrap16bits; physical mapping is not an owner/write/initialization/outerstack proof. No memory read/write, plan, commit, bus/device or CPU execution.'};
}
