import {assertPinnedTaskSource,taskFetchWindow} from './pinned-task-source.mjs';
import {taskOwner,taskStream,taskWord} from './task-control-source.mjs';
import {cpuLabel} from './rom.mjs';

// Static control/width/operand-stack accounting only. No values, memory,
// device registers or processor instructions are executed by this walker.
const pulls=new Set(['PLA','PLX','PLY']),pushes=new Set(['PHA','PHX','PHY']);
const rmw=new Set(['LSR','ROR']);
export function proveArithmeticSource(map,spec){
  assertPinnedTaskSource(map,spec.windows);
  const pending=[{pc:spec.entry,delta:0,m:0}],seen=new Map(),edges=[],events=[];
  while(pending.length){
    const s=pending.pop(),i=map.get(s.pc);if(!i)throw Error('Missing arithmetic edge');
    const old=seen.get(s.pc);
    if(old){if(old.delta!==s.delta||old.m!==s.m)throw Error('Incompatible arithmetic join');continue;}
    if(i.state.e!==0||i.state.x!==0||i.state.m!==s.m)throw Error('Arithmetic width edge');
    seen.set(s.pc,s);if(seen.size>200)throw Error('Arithmetic source bound');
    const width=['PLX','PLY','PHX','PHY'].includes(i.mnemonic)?2:s.m?1:2;
    let delta=s.delta,m=s.m;
    if(pulls.has(i.mnemonic)){
      events.push({at:cpuLabel(s.pc),kind:'stack-pull',width,read_offsets:Array.from({length:width},(_,n)=>delta+n+1),write_offsets:[]});delta+=width;
    }else if(pushes.has(i.mnemonic)){
      events.push({at:cpuLabel(s.pc),kind:'stack-push',width,read_offsets:[],write_offsets:Array.from({length:width},(_,n)=>delta-n)});delta-=width;
    }else if(i.mode==='sr'){
      const offsets=Array.from({length:width},(_,n)=>delta+i.value+n);
      events.push({at:cpuLabel(s.pc),kind:i.mnemonic,width,read_offsets:i.mnemonic==='STA'?[]:offsets,write_offsets:i.mnemonic==='STA'?offsets:[]});
    }else if(i.mode==='abs'&&['LDA','STA','STZ','ADC','SBC','LSR','ROR'].includes(i.mnemonic)){
      events.push({at:cpuLabel(s.pc),kind:i.mnemonic,width,absolute:i.value,reads:!['STA','STZ'].includes(i.mnemonic),writes:['STA','STZ'].includes(i.mnemonic)||rmw.has(i.mnemonic)});
    }
    if(i.mnemonic==='SEP')m=1;if(i.mnemonic==='REP')m=0;
    if(s.pc===0x80F390)continue;
    if(['JSR','JSL','RTS','RTL','TCS','PLP','XCE'].includes(i.mnemonic))throw Error('Unproved arithmetic control');
    const targets=['JMP','BRA'].includes(i.mnemonic)?[i.target]:i.mode==='rel8'?[i.next,i.target]:[i.next];
    for(const to of targets){edges.push({from:cpuLabel(s.pc),to:cpuLabel(to),m,operand_s_delta:delta});pending.push({pc:to,delta,m});}
  }
  if(!seen.has(0x80F390)||seen.get(0x80F390).delta!==2)throw Error('Arithmetic stack/frontier drift');
  return [{entry:cpuLabel(spec.entry),local_source_complete:true,source_closed_to_dispatch:false,full_graph_closed:false,native_binding:false,
    operand_s_delta:2,outer_return_frames_added:0,minimum_protected_stack_bytes:null,
    visited:[...seen.keys()].sort((a,b)=>a-b).map(cpuLabel),edges:edges.sort((a,b)=>a.from.localeCompare(b.from)||a.to.localeCompare(b.to)),
    conditional_data_events:events.sort((a,b)=>a.at.localeCompare(b.at)),contract:spec.contract,
    qualification:spec.qualification}];
}
export function arithmeticOwners(proof,{s,d,bank,y,pointerAfter}){
  if(![s,d,y,pointerAfter].every(taskWord)||!Number.isInteger(bank)||bank<0||bank>255)throw Error('Explicit arithmetic address context');
  return {conditional_events:proof.conditional_data_events.map(e=>({...e,...(e.absolute===undefined?{
    reads:e.read_offsets.map(n=>taskOwner((s+n)&65535)),writes:e.write_offsets.map(n=>taskOwner((s+n)&65535))}:{
    owners:Array.from({length:e.width},(_,n)=>taskOwner((bank*65536+e.absolute+n)&0xFFFFFF))})})),
    next_opcode:taskStream(d,bank,pointerAfter,y),output_s:(s+2)&65535,
    qualification:'Synthetic address equations for conditional source events; events ordered by PC, not a runtime trace. Fresh sources and effective physical byte owners remain explicit; no execution or initialization.'};
}
export function signMagnitude(word){if(!taskWord(word))throw Error('Explicit WORD');return word&0x8000?(-word)&65535:word;}
export function signCorrection(count){if(!Number.isInteger(count)||count<0||count>2)throw Error('Actual sign count0..2');return {x_after_dex:(count-1)&65535,negate_result:count===1};}
export function divisionScale(divisor){if(!taskWord(divisor))throw Error('Explicit divisor WORD');let shifts=0;while((divisor>>>shifts)>=256)shifts++;return {shifts,scaled:divisor>>>shifts,
  qualification:'Closed register LSR/CMP induction, maximum8 iterations; no scratch-memory or division-device value computed.'};}
export function multiplyObserved({firstLow,secondLow,secondHigh,scratchAtFirstAdc,thirdLow,scratchAtSecondAdc}){
  const values=[firstLow,secondLow,secondHigh,scratchAtFirstAdc,thirdLow,scratchAtSecondAdc];
  if(!values.every(v=>Number.isInteger(v)&&v>=0&&v<=255))throw Error('Six explicit fresh BYTE observations');
  const firstSum=secondHigh+scratchAtFirstAdc,finalSum=thirdLow+scratchAtSecondAdc;
  return {first_scratch_store:firstLow,low_result_store:secondLow,second_scratch_store:firstSum&255,
    high_result_store:finalSum&255,final_carry:Number(finalSum>255),final_overflow:Number(((~(thirdLow^scratchAtSecondAdc)&(thirdLow^(finalSum&255)))&128)!==0),
    qualification:'Binary BYTE ADC equations with two explicit CLC seeds. Each register/scratch read is independently supplied; no multiply-device result, stable scratch or actual instruction execution inferred.'};
}
export function divisionCorrection({observedWord,stackAtCompare,stackAtCorrection,signCount}){
  if(![observedWord,stackAtCompare].every(taskWord))throw Error('Fresh comparison WORDs');
  const decrement=observedWord<stackAtCompare,sign=signCorrection(signCount);
  if((decrement||sign.negate_result)&&!taskWord(stackAtCorrection))throw Error('Fresh correction PLA WORD');
  return {carry:Number(!decrement),decrement,sign,
    qualification:'CMP Carry and optional DEC/negation branch equations only. Correcting PLA values may differ from prior CMP bytes; all actual reads/writes remain in source events. No device quotient or return proof.'};
}
export {taskFetchWindow};
