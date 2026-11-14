import {taskAudioFixture} from './task-native-audio-fixtures.mjs';
import {sampleWord} from './render-f130-fixtures.mjs';
import {menuRecords} from './task-native-menu-fixtures.mjs';
export const multiAudioD2Settings=new Map([[0x16E,[6,7]]]);
export const multiAudioBodyCases=()=>[false,true].flatMap(selectionEqual=>[false,true].flatMap(actionEqual=>[0,0x8031].map(cachedSound=>({
 name:`selection-${selectionEqual?'equal':'changed'}-action-${actionEqual?'equal':'changed'}-cache${cachedSound.toString(16)}`,
 selectionEqual,actionEqual,cachedSound})))).concat([{name:'token-wrap-and-argument-high',token:254,args:[0x110]}]);
// Explicit synthetic segment samples; no timer, actor movement, child visit
// or scheduler execution is manufactured by these fixture declarations.
export function expandMultiAudioBodyFixture(spec,variant,f){
 if(spec.id!==0x16E)throw Error('Unproved multi-audio body');
 const bodyBytes=f.data.snapshot().bytes,token=variant.token??0,cachedSound=variant.cachedSound??0,
  source=taskAudioFixture(0x80C46E,{s:0xAFF,sound:0x8031,selector:0x31,voice:255,token,cachedSound,
   directory:0x7E7000,blockPointer:0x7E7100,blocks:[{kind:'raw',pointer:0x7E7200,values:[0xAB]}]});
 for(const[address,value]of source.data.snapshot().bytes)f.data.seed(address,[value]);
 for(const[address,value]of bodyBytes)f.data.seed(address,[value]);
 for(const[address,value]of[[0x800E38,12],[0x800E90,20],[0x800EE8,28],[0x800CC4,0],
  [0x7E3F7E,65535],[0x8014B0,0],[0x8014B2,16],
  [0x8003D2,0x800],[0x8003D4,0],[0x80024E,4],[0x800316,65535],[0x80024C,2]])sampleWord(f.data,address,value);
 const audio=(sound,startToken,voiceCache)=>taskAudioFixture(0x80C46E,{sound,voice:255,cachedVoice:voiceCache,
  token:startToken,cachedSound}).ioObservations;
 const secondToken=(token+3)&255,thirdToken=(secondToken+(cachedSound===0x8031?0:3)+2)&255;
 return {...f,maxWork:1000000,maxOutputBytes:1000000,ioMode:'record-requests',ioObservations:menuRecords([]),
  audioResumeByPC:Object.freeze({36:audio(0x20,token,0),66:audio(0x8031,secondToken,255),119:audio(0x1E,thirdToken,255)}),
  waitMode:'record-observations',waitObservations:menuRecords([]),inputMode:'record-observations',inputObservations:menuRecords([])};
}
