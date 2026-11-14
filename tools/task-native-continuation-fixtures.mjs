import {taskFixture} from './task-native-fixtures.mjs';
export function taskContinuationFixture(entry,patch={}){
 const f=taskFixture(entry,{s:entry===0x80F509?0x6FF:0x3F0,savedOuterS:0x6FF,writeWindows:[[0x7E0000,0x7FFFFF]],...patch});
 const word=(address,value)=>f.data.seed(address,[value&255,value>>>8]);
 if(entry===0x80F4F6){f.context=Object.freeze({...f.context,a:0x6FF,x:4});word(0x82D7BC,0xCA3A);}
 else{word(0x800250,0x10);word(0x800262,0x200);word(0x201,0x8012);word(0x207,0x3F0);word(0x209,2);word(0x203,4);word(0x82D972,0xAA02);word(0x800000,0x1234);}
 return f;
}
