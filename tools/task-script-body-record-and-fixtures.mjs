import {expandAudioWaitBodyFixture} from './task-script-body-audio-wait-fixtures.mjs';
import {sampleWord} from './render-f130-fixtures.mjs';import {menuRecords} from './task-native-menu-fixtures.mjs';
import {bodyWord} from './task-script-body-fixtures.mjs';import {renderAddress} from '../src/render/data.mjs';
export const recordAndActive=v=>(v.flag&1)!==0&&(v.flag&128)===0;
export const recordAndCases=()=>[0,1,3,127,128,129,255].flatMap((flag,n)=>[0xAB10,0xFF11,0x80FE].map((input,k)=>({
 name:'flag-'+flag+'-full-arg-'+input.toString(16),flag,flagHigh:[0xA5,0x80,255][k],input,args:[input],token:(n+k)&255})));
export const recordAndPCs=(s,v)=>s.instructions.filter(i=>recordAndActive(v)||i.pc<25||i.pc>=63).map(i=>i.pc);
export function expandRecordAndFixture(s,v,f){const base=expandAudioWaitBodyFixture(s,v,f),word=(a,n)=>sampleWord(base.data,a,n),
  flagPointer=s.romReads.find(r=>r.address===0x8DB65C).value,propertyPointer=s.romReads.find(r=>r.address===0x8DB250).value,slot=v.input&255;
 base.data.seed(0x7E0001+flagPointer,[v.flag,v.flagHigh]);word(0x7E0003+propertyPointer,0xABCD);
 for(const [a,n]of [[0x800E28+slot,0],[0x800E80+slot,0x1000],[0x801350+slot,0xABCD]])word(a,n);
 return {...base,recordAndVariant:v,maxHandlers:recordAndActive(v)?s.instructions.findIndex(i=>i.opcode===0x58&&i.operand===0x9F)+1:recordAndPCs(s,v).length,
  ioObservations:recordAndActive(v)?base.ioObservations:menuRecords([]),audioResumeObservations:menuRecords([]),audioResumeAtCountdown:null};
}
export function recordAndProbeDetails(s,v,f,segments){const flag=0x7E3A9A,property=0x7E346B;
 return {record_input_word:v.input,record_initial_flag:v.flag,record_initial_flag_high:v.flagHigh,record_active:recordAndActive(v),record_audio_token:v.token,
  record_final_flag:bodyWord(f.data,flag),record_final_property:bodyWord(f.data,property),record_final_local_byte0:f.data.readByte(0x613).value,
  record_final_local_byte1:f.data.readByte(0x614).value,record_final_entity_word:bodyWord(f.data,0x801350+(v.input&255)),
  record_countdown_trace:segments.slice(1).flatMap(p=>p.accesses.flatMap((a,n)=>a.kind==='write'&&a.address===0x800C04&&a.label==='visit-DBR-WORD-low'?[a.value|(p.accesses[n+1].value<<8)]:[])),
  record_segments:segments.flatMap((p,segment)=>{if(!(p.segmentHandlers??p.handlersExecuted))return [];const calls=[];
   for(let n=0;n<p.accesses.length;n++)if(p.accesses[n].kind==='write'&&p.accesses[n].label==='saved-ID-low'){
    const id=p.accesses[n].value,next=p.accesses.findIndex((a,k)=>k>n&&a.kind==='write'&&a.label==='saved-ID-low'),
     args=p.accesses.slice(n,next<0?undefined:next).filter(a=>a.kind==='write'&&a.label.startsWith('native-argument-workspace-'));
    calls.push({id,arguments:args.filter((_,k)=>k%2===0).map((a,k)=>a.value|(args[k*2+1].value<<8))});
   }
   return [{segment,body_pcs:p.bodyPCs,segment_handlers:p.segmentHandlers??p.handlersExecuted,native_arguments:calls,
    caller_word:p.accesses.flatMap((a,n)=>a.kind==='read'&&a.label==='local-value-PLA-low'?[a.value|(p.accesses[n+1].value<<8)]:[]),
    result_phas:p.accesses.flatMap((a,n)=>a.kind==='write'&&a.label==='resume-result-PHA-low'?[a.value|(p.accesses[n-1].value<<8)]:[]),
    pointer_reads:p.accesses.flatMap((a,n)=>a.kind==='read'&&[0x8DB65C,0x8DB250].includes(a.address)&&['leaf-long-WORD-low','text-root-WORD-low'].includes(a.label)?[[a.address,a.value|(p.accesses[n+1].value<<8)]]:[]),
    flag_word_reads:p.accesses.flatMap((a,n)=>a.kind==='read'&&renderAddress(a.address)===flag&&a.label==='leaf-long-WORD-low'?[[flag,a.value|(p.accesses[n+1].value<<8)]]:[]),
    flag_byte_reads:p.accesses.filter(a=>a.kind==='read'&&renderAddress(a.address)===flag&&['leaf-record-BYTE','record-and-field-BYTE'].includes(a.label)).map(a=>[flag,a.value,a.label]),
    flag_byte_writes:p.accesses.filter(a=>a.kind==='write'&&renderAddress(a.address)===flag).map(a=>[flag,a.value]),
    byte_writes:p.byteWrites,
    native_calls:p.steps.filter(n=>n.calleeEntry).map(n=>({target:n.calleeEntry,word_pops:n.arguments?.wordPops??n.wordPops,
     sound:n.callee?.sound??null,voice:n.callee?.voice??null,
     result_pushed:n.resultPushed??null,callee_return_word:n.calleeReturnWord??null,saved_continuation_word:n.savedContinuationWord??null,raw_return_word:n.rawReturnWord??null})),
    io_records:(p.ioRequests??[]).filter(r=>r.kind==='read').map(({kind,...r})=>r),io_observations_used:p.observationsUsed??0,
    wait_records:p.waitEvents??[],wait_observations_used:p.waitObservationsUsed??0,input_observations_used:p.inputObservationsUsed??0}];})};
}
