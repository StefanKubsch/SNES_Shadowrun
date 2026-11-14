import {taskAudioFixture} from './task-native-audio-fixtures.mjs';import {randomRecords} from './task-native-random-fixtures.mjs';
import {sampleWord} from './render-f130-fixtures.mjs';import {menuRecords} from './task-native-menu-fixtures.mjs';
export const mixedBodyD2Settings=new Map([[0x1A9,[1,5]]]);
export const mixedBodyCases=()=>[false,true].flatMap(selectionEqual=>[false,true].flatMap(actionEqual=>[0,0x8034].map(cachedSound=>({
 name:`selection-${selectionEqual?'equal':'changed'}-action-${actionEqual?'equal':'changed'}-cache${cachedSound.toString(16)}`,selectionEqual,actionEqual,cachedSound}))))
 .concat([{name:'token-wrap-and-argument-high',token:254,args:[0x110]},{name:'timer-with-unrelated-event1',event:1}]);
export function expandMixedBodyFixture(spec,variant,f){
 if(spec.id!==0x1A9)throw Error('Unproved mixed body');
 const original=f.data.snapshot().bytes,audio=taskAudioFixture(0x80C46E,{sound:0x8034,selector:0x34,voice:3,
  token:variant.token??0,cachedSound:variant.cachedSound??0,directory:0x7E7000,blockPointer:0x7E7100,
  blocks:[{kind:'raw',pointer:0x7E7200,values:[0xAB]}]});
 for(const[address,value]of audio.data.snapshot().bytes)f.data.seed(address,[value]);
 for(const[address,value]of original)f.data.seed(address,[value]);
 for(const[address,value]of[[0x800E90,0x1000],[0x800E38,0],[0x800CC4,0]])sampleWord(f.data,address,value);
 f.data.seed(0x801CE8,[0]);f.data.seed(0x7E1C76,[0,26]);
 return {...f,maxWork:1000000,maxOutputBytes:1000000,ioMode:'record-requests',
  ioObservations:menuRecords([...audio.ioObservations,...randomRecords([[123,26,1],[123,143,0]])]),
  waitMode:'record-observations',waitObservations:menuRecords([]),inputMode:'record-observations',inputObservations:menuRecords([])};
}
