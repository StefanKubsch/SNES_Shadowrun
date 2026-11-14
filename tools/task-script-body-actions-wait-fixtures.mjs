import {taskActionsFixture} from './task-native-actions-fixtures.mjs';import {menuRecords} from './task-native-menu-fixtures.mjs';
import {seedWord} from './render-ad92-fixtures.mjs';
export const actionsWaitCases=()=>[
 {name:'wait-event10',enabled:0,event:16},{name:'wait-event80',enabled:0,event:128},{name:'wait-event90',enabled:256,event:144},
 {name:'menu-cancel',enabled:1,flags:0,held:0x2000,result:0},
 {name:'menu-base-confirm',enabled:128,flags:0,held:64,result:0},
 {name:'menu-action',enabled:65535,flags:0,held:32,result:128},
 {name:'menu-other-action',enabled:1,flags:16,held:16,result:16},
 {name:'menu-all-flags',enabled:1,flags:65535,held:32,result:128}];
export const actionsWaitPCs=v=>v.enabled&255?[0,2,4,6,9,11,13,14,16,18,28,30]:[0,2,4,6,21,22,24,26,28,30];
export function expandActionsWaitFixture(spec,variant,f){
 const enabled=variant.enabled??0,flags=variant.flags??0,menuPath=Boolean(enabled&255),bodyBytes=f.data.snapshot().bytes;
 const menu=taskActionsFixture(0x809BA0,{s:0xAFF,mask:flags|128,held:variant.held??0x2000});
 for(const [address,value] of menu.data.snapshot().bytes)f.data.seed(address,[value]);
 for(const [address,value] of bodyBytes)f.data.seed(address,[value]);
 seedWord(f.data,0x800,enabled);seedWord(f.data,0x802,flags);seedWord(f.data,0x800314,2);
 // Readiness event belongs to a later owner version, never the yield plan.
 const controls=menuPath?[variant.held??0x2000,variant.held??0x2000]:[];
 return {...f,maxHandlers:menuPath?12:7,maxWork:1000000,maxOutputBytes:1000000,
  ioMode:'record-requests',ioObservations:menuPath?menu.ioObservations:menuRecords([]),
  waitMode:'record-observations',waitObservations:menuPath?menu.waitObservations:menuRecords([]),
  inputMode:'record-observations',inputObservations:menuRecords(controls.map(value=>({pc:0x809E1A,address:0x8001CA,width:2,value})))};
}
