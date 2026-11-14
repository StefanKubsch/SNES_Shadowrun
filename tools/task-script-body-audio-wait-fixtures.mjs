import {taskAudioFixture} from './task-native-audio-fixtures.mjs';
import {sampleWord} from './render-f130-fixtures.mjs';
import {menuRecords} from './task-native-menu-fixtures.mjs';
export const audioWaitD2Settings=new Map([[0x8A,[0,5]],[0x99,[0,0]],[0x149,[0,5]],[0x21A,[0,4]],[0x37A,[0,0]]]);
export function audioWaitBodyCases(spec){
 if(spec.id===0x4B)return [{name:'observed-countdown'},{name:'observed-countdown-token-wrap',token:254},
  {name:'unrelated-event1-countdown',event:1}];
 const sound=spec.romReads.find(r=>r.address>=0x80C4B3&&r.address<0x80C520).value;
 return [false,true].flatMap(selectionEqual=>[false,true].flatMap(actionEqual=>(sound&32768?[0,sound]:[0]).map(cachedSound=>({
  name:`selection-${selectionEqual?'equal':'changed'}-action-${actionEqual?'equal':'changed'}-cache${cachedSound.toString(16)}`,
  selectionEqual,actionEqual,cachedSound}))));
}
export function expandAudioWaitBodyFixture(spec,variant,f){
 const bodyBytes=f.data.snapshot().bytes,sound=spec.romReads.find(r=>r.address>=0x80C4B3&&r.address<0x80C520).value,
  voice=[0x99,0x21A,0x37A].includes(spec.id)?255:3,
  audio=taskAudioFixture(0x80C46E,{s:0xAFF,sound,selector:sound&255,voice,
   cachedSound:variant.cachedSound??0,token:variant.token??0,directory:0x7E7000,blockPointer:0x7E7100,
   blocks:[{kind:'raw',pointer:0x7E7200,values:[0xAB]}]});
 for(const[address,value]of audio.data.snapshot().bytes)f.data.seed(address,[value]);
 for(const[address,value]of bodyBytes)f.data.seed(address,[value]);
 for(const[address,value]of[[0x800E90,0x1000],[0x800E38,0],[0x800CC4,0]])sampleWord(f.data,address,value);
 const firstWait=spec.instructions.find(i=>i.opcode===0x58&&i.operand===0x9F),
  audioAfterWait=spec.instructions.find(i=>i.opcode===0x58&&i.operand===0x4C).pc>firstWait.pc;
 return {...f,maxWork:1000000,maxOutputBytes:1000000,ioMode:'record-requests',
  ioObservations:audioAfterWait?menuRecords([]):audio.ioObservations,
  audioResumeObservations:audioAfterWait?audio.ioObservations:menuRecords([]),
  audioResumeAtCountdown:audioAfterWait?1:null,
  waitMode:'record-observations',waitObservations:menuRecords([]),inputMode:'record-observations',inputObservations:menuRecords([])};
}
