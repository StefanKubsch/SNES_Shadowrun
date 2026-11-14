import {cpuLabel} from './rom.mjs';
import {renderAddress} from '../src/render/data.mjs';
const entries=new Map([[0x80F393,{kind:'push-zero',width:0,push:0x80F393,end:0x80F398}],
  [0x80F398,{kind:'push-u8',width:1,push:0x80F39E,end:0x80F3A1}],[0x80F3B1,{kind:'push-u16',width:2,push:0x80F3B5,end:0x80F3B9}]]);
const signatures=[
  [0x80F393,'PEA',0,'word'],[0x80F396,'BRA',0x80F389,'rel8'],
  [0x80F398,'LDA',0,'diy'],[0x80F39A,'INY',0,'i'],[0x80F39B,'AND',255,'immM'],[0x80F39E,'PHA',0,'i'],[0x80F39F,'BRA',0x80F389,'rel8'],
  [0x80F3B1,'LDA',0,'diy'],[0x80F3B3,'INY',0,'i'],[0x80F3B4,'INY',0,'i'],[0x80F3B5,'PHA',0,'i'],[0x80F3B6,'JMP',0x80F389,'abs'],
  [0x80F389,'LDA',0,'diy'],[0x80F38B,'INY',0,'i'],[0x80F38C,'AND',255,'immM'],[0x80F38F,'TAX',0,'i'],[0x80F390,'JMP',0xF2B4,'indx']];

// Fixed source path and symbolic data-byte origins only. Entry is reached by
// opcode JMP with an existing operand S; no synthetic root JSR/return frame.
export function provePushToDispatch(map,entry){
  const spec=entries.get(entry);if(!spec)throw Error('Invalid push source entry');
  for(const [pc,op,value,mode]of signatures.filter(([pc])=>pc>=entry&&pc<spec.end||pc>=0x80F389&&pc<0x80F393)){const i=map.get(pc);
    if(i?.mnemonic!==op||(i.target??i.value)!==value||i.mode!==mode)throw Error('Renew push source lemma '+cpuLabel(pc));
    if(i.state.e||i.state.m||i.state.x)throw Error('Push requires explicit E0M0X0');
    const length=mode==='i'?1:['word','immM','abs','indx'].includes(mode)?3:2;
    if(i.length!==length||i.raw.length!==length||i.next!==pc+length)throw Error('Push source instruction width');}
  const visited=[],reads=[],writes=[];let pc=entry,growth=0,yDelta=0;
  while(true){
    if(visited.includes(cpuLabel(pc))||visited.length>20)throw Error('Unproved push loop');
    const i=map.get(pc);if(!i)throw Error('Uncovered push source edge');visited.push(cpuLabel(pc));
    if(i.mnemonic==='LDA')reads.push({at:cpuLabel(pc),kind:pc===0x80F389?'next-opcode':'operand',bytes:2,
      pointer_bytes:'Fresh bank00:(D+00)&FFFF/(D+01)&FFFF at each LDA; actual DBR:pointer+Y, 24bit indexed address',
      highbyte_required:true,after_push:growth===2});
    else if(i.mnemonic==='INY')yDelta++;
    else if(['PEA','PHA'].includes(i.mnemonic)){
      if(growth||pc!==spec.push)throw Error('Unproved push source stack shape');growth=2;
      const zero=spec.kind==='push-zero',masked=spec.kind==='push-u8';
      writes.push({at:cpuLabel(pc),address:'00:incomingS',byte:zero||masked?'00':'Original operand highbyte'},
        {at:cpuLabel(pc),address:'00:((incomingS-1)&FFFF)',byte:zero?'00':'Original operand lowbyte'});
    }else if(i.mnemonic==='JMP'&&i.mode==='indx'){
      if(pc!==0x80F390||growth!==2||yDelta!==spec.width+1)throw Error('Unproved push frontier');break;
    }
    pc=['BRA','JMP'].includes(i.mnemonic)?i.target:i.next;
  }
  return {entry:cpuLabel(entry),kind:spec.kind,source_closed_to_dispatch:true,native_binding:false,
    reachable_instructions:visited.length,visited,reads,stack_writes:writes,
    outer_return_frames_added:0,operand_words_added:1,required_writable_operand_stack_bytes:2,operand_s_delta:-2,
    y_delta_before_next_opcode:spec.width,y_delta_at_frontier:yDelta,
    output_mode:{e:0,m:0,x:0,d:'entry payload D',dbr:'entry actual DBR'},
    flags:'Final N0/Z(nextOpcodeLow==0) from WORD AND00FF/TAX; C/V/I/decimal flag preserved. No ADC/SBC or extra binary-only premise.',
    frontier:{at:'80:F390',kind:'indexed-opcode-JMP',a:'Fresh next-opcode lowbyte',x:'Fresh next-opcode lowbyte',
      target:'80:WORD(80:F2B4+X), no ASL/ID/parity clamp; handler target remains source-required'},
    saved_frame_cursor_write:false,external_return_assumptions:0,
    qualification:'One fixed opcode-handler path through actual next fetch/dispatch. JMP entry adds no return frame; two operand output bytes, not a root protected-stack minimum. Intact code, E0M0X0, explicit D/DBR/S/Y and source/writable byte owners including aliases. No memory/instruction/CPU/device/scene/frame execution or wholeinterpreter return proof.'};
}

// Concrete address equations for explicit synthetic/source context. No memory
// owner is opened/read/written; pointerBefore/After are separate fresh inputs.
export function describePushByteOwners({entry,d,bank,s,y,pointerBefore,pointerAfter}){
  const spec=entries.get(entry);if(!spec)throw Error('Invalid push source entry');
  const word=v=>Number.isInteger(v)&&v>=0&&v<=65535;
  if(![d,s,y,pointerAfter].every(word)||!Number.isInteger(bank)||bank<0||bank>255||spec.width&&!word(pointerBefore))
    throw Error('Explicit push address context required');
  const owner=address=>({address:cpuLabel(address),physical_address:renderAddress(address)===null?null:cpuLabel(renderAddress(address))});
  const source=(pointer,atY)=>{const a=(bank*65536+pointer+atY)&0xFFFFFF;
    return {pointer_reads:[owner(d),owner((d+1)&65535)],word_reads:[owner(a),owner((a+1)&0xFFFFFF)]};};
  const operand=spec.width?source(pointerBefore,y):null,nextY=(y+spec.width)&65535;
  const stackWrites=[{...owner(s),order:1,byte:spec.width===2?'operand highbyte':'00'},
    {...owner((s-1)&65535),order:2,byte:spec.width?'operand lowbyte':'00'}];
  return {entry:cpuLabel(entry),context:{d,bank,s,y},operand_sources:operand,stack_writes:stackWrites,
    output_operand_s:(s-2)&65535,next_opcode_sources:source(pointerAfter,nextY),
    next_opcode_y:nextY,frontier_y:(nextY+1)&65535,
    stack_writes_have_known_wram_addresses:stackWrites.every(w=>w.physical_address!==null&&parseInt(w.physical_address.replace(':',''),16)>=0x7E0000&&parseInt(w.physical_address.replace(':',''),16)<=0x7FFFFF),
    qualification:'Only source address/byte-order equations. Canonical addresses reuse existing mapping; known WRAM address is not an actual byte owner, write permission, intact frame/code/outerstack or initialization proof. Fresh pointers supplied separately; no read/write, plan, commit, bus/device or CPU execution.'};
}
