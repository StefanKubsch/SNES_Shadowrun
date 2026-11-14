import {taskAudioFixture} from './task-native-audio-fixtures.mjs';
import {taskActionsFixture} from './task-native-actions-fixtures.mjs';
import {taskFEC1Fixture} from './task-native-fec1-fixtures.mjs';
import {sampleWord} from './render-f130-fixtures.mjs';
import {menuRecords} from './task-native-menu-fixtures.mjs';
export const audioBodyCases=spec=>spec.id===0x396?
 [{name:'high-loader',cachedSound:0},{name:'high-cache',cachedSound:0x8031},
  {name:'high-loader-token-wrap',cachedSound:0,token:254}]:
 [{name:'cancel',held:0x2000},{name:'base-confirm',held:64},
  {name:'action-hotkey',held:32},{name:'action-hotkey-replacement',held:32,occupied:[4,4,4,4]}];
export const audioBodyPCs=(spec,v)=>spec.id===0x396?[0,2,4,6,8,10,12]:
 [0,2,4,6,8,9,...(v.held===32?[12,14,16,18,19,21,23,26,29,31,33,35,37]:[]),39,40,42];
export function expandAudioBodyFixture(spec,variant,f){
 const bodyBytes=f.data.snapshot().bytes;
 if(spec.id===0x396){
  const audio=taskAudioFixture(0x80C46E,{s:0xAFF,sound:0x8031,selector:0x31,
   cachedSound:variant.cachedSound??0,token:variant.token??0,directory:0x7E7000,blockPointer:0x7E7100,
   blocks:[{kind:'raw',pointer:0x7E7200,values:[0xAB]}]});
  for(const [address,value]of audio.data.snapshot().bytes)f.data.seed(address,[value]);
  for(const [address,value]of bodyBytes)f.data.seed(address,[value]);
  return {...f,maxHandlers:7,maxWork:1000000,maxOutputBytes:1000000,ioMode:'record-requests',
   ioObservations:audio.ioObservations,waitMode:'record-observations',waitObservations:menuRecords([]),
   inputMode:'record-observations',inputObservations:menuRecords([])};
 }
 if(spec.id!==0x1D3)throw Error('Unproved original audio body fixture');
 const held=variant.held??0x2000,hasAudio=held===32,
  audio=taskAudioFixture(0x80C46E,{s:0xAFF,sound:0x1C,voice:3,cachedVoice:3,token:3}),
  notice=taskFEC1Fixture({s:0xAFF,...variant}),menu=taskActionsFixture(0x809BA0,{s:0xAFF,mask:0x80,held});
 for(const owner of[audio.data,notice.data,menu.data])for(const [address,value]of owner.snapshot().bytes)f.data.seed(address,[value]);
 for(const [address,value]of bodyBytes)f.data.seed(address,[value]);
 // Positive entity16 takes the actual pan position/camera WORD reads.
 for(const[address,value]of[[0x800E90,0x1000],[0x800E38,0],[0x800CC4,0],
  [0x80D9B8+0x1FB*2,0x10],[0x8012B0,0],[0x8014B0,0],[0x8014B2,16],[0x7E4408,0]])sampleWord(f.data,address,value);
 const c8Reads=hasAudio?[{pc:0x80FA01,address:0x802134,width:2,value:21},...notice.ioObservations]:[];
 const c8Waits=hasAudio?[{pc:0x81ACBD,address:0x8001F6,width:2,value:0},
  {pc:0x81ACAF,address:0x8001F8,width:2,value:0},...notice.waitObservations]:[];
 return {...f,maxHandlers:audioBodyPCs(spec,{held}).length,maxWork:1000000,maxOutputBytes:1000000,
  ioMode:'record-requests',ioObservations:menuRecords([...menu.ioObservations,...(hasAudio?audio.ioObservations:[]),...c8Reads]),
  waitMode:'record-observations',waitObservations:menuRecords([...menu.waitObservations,...c8Waits]),
  inputMode:'record-observations',inputObservations:menuRecords([held,held].map(value=>({pc:0x809E1A,address:0x8001CA,width:2,value})))};
}
