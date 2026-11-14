import {taskActionsFixture} from './task-native-actions-fixtures.mjs';import {taskFEC1Fixture} from './task-native-fec1-fixtures.mjs';
import {seedWord} from './render-ad92-fixtures.mjs';import {menuRecords} from './task-native-menu-fixtures.mjs';
export const actionsBodyArguments=new Map([
 [4,[2,18,28,7,0x800,561,240]],[0x2A,[2,18,28,7,0x800,556,240]],[0x73,[3,21,26,3,0x800,479,240]],
 [0xD9,[2,18,28,7,0x800,550,240]],[0xDA,[2,18,28,8,0x800,551,240]],[0xE1,[2,18,28,7,0x800,553,240]],
 [0x11F,[2,17,28,9,0x800,560,240]],[0x1DF,[2,18,28,8,0x800,552,240]],[0x1E7,[2,18,28,7,0x800,559,240]],
 [0x266,[5,20,21,3,0x800,549,240]],[0x26A,[2,18,28,7,0x800,554,240]],[0x273,[2,18,28,7,0x800,555,240]],
 [0x339,[2,18,28,7,0x800,558,240]],[0x37F,[2,18,28,7,0x800,557,240]]]);
export const actionsBodyCases=()=>[{name:'cancel',held:0x2000},{name:'base-confirm',held:64},
 {name:'action-hotkey',held:32},{name:'action-hotkey-replacement',held:32,occupied:[4,4,4,4]}];
export const actionsBodyPCs=v=>[0,2,4,6,8,9,...(v.held===32?[12,14,17,20,22,24,26,28]:[]),30,31,33];
export function expandActionsBodyFixture(spec,variant,f){
 const held=variant.held??0x2000,bodyBytes=f.data.snapshot().bytes,menu=taskActionsFixture(0x809BA0,{mask:0x80,held,s:0xAFF});
 const notice=taskFEC1Fixture({s:0xAFF,...variant});
 for(const [address,value] of notice.data.snapshot().bytes)f.data.seed(address,[value]);
 for(const [address,value] of menu.data.snapshot().bytes)f.data.seed(address,[value]);
 for(const [address,value] of bodyBytes)f.data.seed(address,[value]);
 const args=actionsBodyArguments.get(spec.id);if(!args)throw Error('Unknown original actions body');
 // Actual allocation0 after menu removal. Real original C8 constants drive
 // its allocation; product values below are independently declared samples.
 seedWord(f.data,0x80D9B8+args[5]*2,0x10);
 seedWord(f.data,0x8012B0,0);seedWord(f.data,0x8014B0,0);seedWord(f.data,0x8014B2,16);seedWord(f.data,0x7E4408,0);
 const hasC8=held===32,product=new Map([[0x73,24],[0xDA,156],[0x11F,182],[0x1DF,156],[0x266,19]]).get(spec.id)??130;
 const c8Reads=hasC8?[{pc:0x80FA01,address:0x802134,width:2,value:product},...notice.ioObservations]:[];
 const c8Waits=hasC8?[{pc:0x81ACBD,address:0x8001F6,width:2,value:0},{pc:0x81ACAF,address:0x8001F8,width:2,value:0},...notice.waitObservations]:[];
 return {...f,maxHandlers:actionsBodyPCs({held}).length,maxWork:1000000,maxOutputBytes:1000000,
  ioMode:'record-requests',ioObservations:menuRecords([...menu.ioObservations,...c8Reads]),waitMode:'record-observations',
  waitObservations:menuRecords([...menu.waitObservations,...c8Waits]),inputMode:'record-observations',
  inputObservations:menuRecords([held,held].map(value=>({pc:0x809E1A,address:0x8001CA,width:2,value})))};
}
