import {taskFixture} from './task-native-fixtures.mjs';
import {taskVisitFixture,visitWord as word} from './task-visit-fixtures.mjs';
export function nativeWaitFixture(entry,patch={}){
 if(entry===0x80C1F9){
  const f=taskVisitFixture(entry,'ready');word(f,0x8002B4,0xF508);word(f,0x209,159);
  word(f,0x82DA0F,2);word(f,0x800000,0x1234);
  return {...f,...patch};
 }
 if(entry===0x80F390){
  const f=taskFixture(entry,{d:0x600,s:0x7FF,savedOuterS:0xAFF,y:1,bank:0x82,status:4,
   writeWindows:[[0x7E0000,0x7FFFFF]],...patch});
  f.context=Object.freeze({...f.context,a:0x58,x:0x58});
  word(f,0x80F30C,0xF4CB);f.data.seed(0x821200,[0x58,0x9F,0x56,0xA5]);
  word(f,0x800,patch.mask??1);word(f,0x802,patch.count??1);
  word(f,0x82DAEB,0x0202);word(f,0x82D8F6,0xC401);word(f,0x820250,2);
  word(f,0x820254,0x600);word(f,0x601,0x8212);
  return {...f,maxOutputBytes:256};
 }
 const f=taskFixture(entry,{d:0,s:0x6FD,savedOuterS:0x6FF,status:4,
  writeWindows:[[0x7E0000,0x7FFFFF]],...patch});
 word(f,(f.context.s+1)&65535,patch.discard??0xF508);word(f,0,patch.mask??1);word(f,2,patch.count??1);
 word(f,f.context.bank*65536+0x250,patch.slot??2);
 return {...f,maxOutputBytes:256};
}
