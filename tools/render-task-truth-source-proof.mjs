import {cpuLabel} from './rom.mjs';
import {renderAddress} from '../src/render/data.mjs';
// Fixed source lemmas and closed data/address equations. No CPU/memory runner.
const specs=new Map([
  [0x80F8BF,{kind:'boolean',body:[[0x80F8BF,'A301'],[0x80F8C1,'F005'],[0x80F8C3,'A9FFFF'],[0x80F8C6,'8301'],[0x80F8C8,'4C89F3']]}],
  [0x80F843,{kind:'equal',body:[[0x80F843,'A20000'],[0x80F846,'68'],[0x80F847,'C301'],[0x80F849,'D001'],[0x80F84B,'CA'],[0x80F84C,'8A'],[0x80F84D,'8301'],[0x80F84F,'4C89F3']]}],
  [0x80F87F,{kind:'not-equal',body:[[0x80F87F,'A2FFFF'],[0x80F882,'68'],[0x80F883,'C301'],[0x80F885,'D001'],[0x80F887,'E8'],[0x80F888,'8A'],[0x80F889,'8301'],[0x80F88B,'4C89F3']]}]
]);
const fetch=[[0x80F389,'B100'],[0x80F38B,'C8'],[0x80F38C,'29FF00'],[0x80F38F,'AA'],[0x80F390,'7CB4F2']];
const signatures={'A301':['LDA','sr'],'F005':['BEQ','rel8'],'A9FFFF':['LDA','immM'],'8301':['STA','sr'],
  '4C89F3':['JMP','abs'],'A20000':['LDX','immX'],'A2FFFF':['LDX','immX'],'68':['PLA','i'],
  'C301':['CMP','sr'],'D001':['BNE','rel8'],'CA':['DEX','i'],'E8':['INX','i'],'8A':['TXA','i'],
  'B100':['LDA','diy'],'C8':['INY','i'],'29FF00':['AND','immM'],'AA':['TAX','i'],'7CB4F2':['JMP','indx']};
const word=v=>Number.isInteger(v)&&v>=0&&v<=65535;
function specFor(entry){const spec=specs.get(entry);if(!spec)throw Error('Invalid truth source entry');return spec;}
function validate(map,spec){
  const path=[...spec.body,...fetch],unary=spec.kind==='boolean';
  for(let n=0;n<path.length;n++){
    const [pc,raw]=path[n],i=map.get(pc),[op,mode]=signatures[raw],length=raw.length/2;
    const value=length===1?0:Buffer.from(raw,'hex').readUIntLE(1,length-1);
    const target=mode==='rel8'?spec.body[unary?4:5][0]:op==='JMP'&&mode==='abs'?0x80F389:undefined;
    if(!i||i.cpu!==pc||i.mnemonic!==op||i.mode!==mode||i.value!==value||i.target!==target
      ||i.opcode!==parseInt(raw.slice(0,2),16)||i.raw.toString('hex').toUpperCase()!==raw
      ||i.length!==length||i.next!==pc+length)throw Error('Renew truth source lemma '+cpuLabel(pc));
    if(['e','m','x'].some(flag=>i.state?.[flag]!==0))throw Error('Truth requires explicit E0M0X0');
    if(n<path.length-1&&(op==='JMP'?i.target:i.next)!==path[n+1][0])throw Error('Uncovered truth source edge');
  }
  return path;
}
function operations(spec,zero=false){const unary=spec.kind==='boolean';return [
  {at:cpuLabel(spec.body[unary?0:1][0]),kind:'read',instruction:unary?'WORD LDA01,S':'WORD PLA',s_delta:0,offset:1,byte_order:['low','high'],value:unary?'original top WORD':'right WORD'},
  ...(unary?[]:[{at:cpuLabel(spec.body[2][0]),kind:'read',instruction:'WORD CMP01,S',s_delta:2,offset:1,byte_order:['low','high'],value:'left WORD; compared against right in A'}]),
  ...(zero?[]:[{at:cpuLabel(spec.body[unary?3:6][0]),kind:'write',instruction:'WORD STA01,S',s_delta:unary?0:2,offset:1,byte_order:['low','high'],value:'result WORD'}])];}
export function proveTruthToDispatch(map,entry){
  const spec=specFor(entry),path=validate(map,spec),unary=spec.kind==='boolean';
  const full=path.map(([pc])=>cpuLabel(pc)),taken=path.filter(([pc])=>unary?![0x80F8C3,0x80F8C6].includes(pc):pc!==spec.body[4][0]).map(([pc])=>cpuLabel(pc));
  return {entry:cpuLabel(entry),kind:spec.kind,source_closed_to_dispatch:true,native_binding:false,
    reachable_instructions:path.length,visited:full,operand_s_delta:unary?0:2,outer_return_frames_added:0,
    minimum_protected_stack_bytes:null,external_return_assumptions:0,decimal_flag_required:null,
    branch:{at:cpuLabel(spec.body[unary?1:3][0]),flag_origin:cpuLabel(spec.body[unary?0:2][0]),
      condition:unary?'BEQ on full top WORD Z; taken iff top==0000':'BNE on WORD CMP right,left Z; taken iff right!=left',
      taken:cpuLabel(spec.body[unary?4:5][0]),fallthrough:cpuLabel(spec.body[unary?2:4][0])},
    paths:[{condition:unary?'top==0000':'right!=left',visited:taken,executed_instructions:taken.length,
      stack_operations:operations(spec,unary),required_readable_operand_stack_bytes:unary?2:4,required_writable_operand_stack_bytes:unary?0:2,
      result:unary?'unchanged zero WORD; no store':spec.kind==='equal'?'0000 from LDX0000/TXA':'FFFF from LDXFFFF/TXA'},
      {condition:unary?'top!=0000':'right==left',visited:full,executed_instructions:full.length,
        stack_operations:operations(spec),required_readable_operand_stack_bytes:unary?2:4,required_writable_operand_stack_bytes:2,
        result:unary?'FFFF from LDAFFFF':spec.kind==='equal'?'FFFF from LDX0000/WORD DEX/TXA':'0000 from LDXFFFF/WORD INX/TXA'}],
    y_delta_before_next_opcode:0,y_delta_at_frontier:1,
    output_mode:{e:0,m:0,x:0,d:'entry payload D',dbr:'entry actual DBR'},
    frontier:{at:'80:F390',kind:'indexed-opcode-JMP',a:'Fresh next-opcode lowbyte',x:'Fresh next-opcode lowbyte',
      target:'80:WORD(80:F2B4+X), no ASL/parity/ID clamp; actual next handler remains source-required'},
    flags:unary?'C/V/I/decimal preserved on both paths; final N0/Z(nextOpcodeLow==0).'
      :'C from actual WORD CMP right,left: C1 iff unsigned right>=left; independent of equality result, incoming C and decimal. V/I/decimal preserved; final N0/Z(nextOpcodeLow==0).',
    qualification:'Local JMP-entered WORD source through actual fresh fetch/dispatch. Operand bytes are not global protected stack minima; E0M0X0, actual D/DBR/S/Y, intact code/outerstack and real byte owners required. No underflow/capacity guards, CPU/memory/device/scene/frame execution.'};
}
export function truthWordConsequence({entry,value,left,right,incomingCarry}){
  const spec=specFor(entry);
  if(spec.kind==='boolean'){
    if(!word(value)||![0,1].includes(incomingCarry))throw Error('Explicit top WORD and incoming Carry required');
    return {value:value===0?0:65535,carry:incomingCarry,operand_store:value!==0};
  }
  if(!word(left)||!word(right))throw Error('Explicit left/right WORDs required');
  return {value:(spec.kind==='equal'?left===right:left!==right)?65535:0,carry:right>=left?1:0,operand_store:true};
}
export function describeTruthByteOwners({entry,d,bank,s,y,pointerAfter,value,left,right,incomingCarry}){
  const spec=specFor(entry),unary=spec.kind==='boolean';
  if(![d,s,y,pointerAfter].every(word)||!Number.isInteger(bank)||bank<0||bank>255)throw Error('Explicit truth address context required');
  const consequence=truthWordConsequence({entry,value,left,right,incomingCarry});
  const owner=address=>({address:cpuLabel(address),physical_address:renderAddress(address)===null?null:cpuLabel(renderAddress(address))});
  const ordered=operations(spec,!consequence.operand_store).map(o=>({...o,bytes:o.byte_order.map(byte=>({...owner((s+o.s_delta+o.offset+(byte==='high'?1:0))&65535),byte}))}));
  const a=(bank*65536+pointerAfter+y)&0xFFFFFF;
  return {entry:cpuLabel(entry),context:{d,bank,s,y,...(unary?{value,incomingCarry}:{left,right})},stack_operations:ordered,
    s_after_pla:unary?null:(s+2)&65535,output_operand_s:(s+(unary?0:2))&65535,operand_store:consequence.operand_store,
    next_opcode_sources:{pointer_reads:[owner(d),owner((d+1)&65535)],word_reads:[owner(a),owner((a+1)&0xFFFFFF)]},
    next_opcode_y:y,frontier_y:(y+1)&65535,
    qualification:'Ordered address equations only. Boolean zero reads full top WORD but performs no store; comparison pops right before left CMP/store. Reads/stores low/high, bank00 byte/S wrap16bits. Fresh pointer supplied separately after stores; known physical address is not an owner/write/initialization/outerstack proof. No memory read/write, plan, commit, bus/device or CPU execution.'};
}
