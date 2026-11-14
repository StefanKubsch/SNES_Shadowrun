import {taskFixture} from './task-native-fixtures.mjs';
export function taskCounterFixture(entry=0x81B0A1,patch={}){
 const f=taskFixture(entry,{d:0,s:0x6FF,savedOuterS:0x6FF,writeWindows:[[0x7E0000,0x7FFFFF]],...patch});
 f.context=Object.freeze({...f.context,programBank:0x81});
 for(const [n,value] of [8,0xF5,0x80].entries())f.data.seed((f.context.s+1+n)&65535,[value]);
 f.data.seed(0x7E1C76,[255,255]);
 return {...f,protectedStackBytes:[1,2,3].map(n=>0x7E0000+((f.context.s+n)&65535)),
  waitMode:'record-observations',waitObservations:Object.freeze([65535,0].map(value=>Object.freeze({pc:0x81B0A5,address:0x7E1C76,width:2,value})))};
}
