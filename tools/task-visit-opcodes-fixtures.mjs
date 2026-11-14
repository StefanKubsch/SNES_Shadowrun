import {taskVisitFixture,visitWord as word} from './task-visit-fixtures.mjs';
import {taskFixture} from './task-native-fixtures.mjs';
import {scriptOpcodeSpecs} from './task-script-opcode-fixtures.mjs';
export function taskVisitTailFixture(){
 const f=taskFixture(0x80C1D9,{d:0,s:0x6FD,savedOuterS:0x6FF,outerWord:0x91D0,writeWindows:[[0x7E0000,0x7FFFFF]]});
 word(f,0x6FE,0x4567);return {...f,maxOutputBytes:32};
}
export function taskVisitOpcodesFixture(kind='end',entry=0x80C1CA){
 const f=taskVisitFixture(entry,'ready');
 for(const [address,value]of [[0x800254,0x3D6],[0x3D6,0x1200],[0x3D7,0x8012],[0x3D9,4],[0x3DD,0x3F0],
  [0x3DF,0],[0x3F1,0xBEEF],[0x8003D2,0x100],[0x8003D4,0],[0x801204,0xA556],[0x80F30A,0xF4BE]])word(f,address,value);
 if(kind==='push-end'){
  word(f,0x801204,0xA514);word(f,0x80F2C8,0xF3B1);word(f,0x801205,0x5678);word(f,0x801207,0xA556);
 }
 if(kind==='native-end'){
  word(f,0x801204,0xA558);word(f,0x80F30C,0xF4CB);word(f,0x801205,68);word(f,0x801206,0xA556);
  word(f,0x82DA4C+68,0);word(f,0x82D7B8+136,0xA941);word(f,0x82D970+68,0);
  word(f,0,2);word(f,0x800D22,0x1357);
 }
 if(kind==='yield'||kind==='yield-resume-end'){
  const s=scriptOpcodeSpecs[0];word(f,0x801204,0xA552);word(f,0x80F306,0xF460);word(f,0x801205,s.id);word(f,0x801207,0xA514);
  word(f,0x82E9CC+s.id,s.argument);word(f,0x82DB28+s.id,s.bank);word(f,0x82DED1+2*s.id,s.pointer);
  f.data.seed(parseInt(s.entry.replace(':',''),16),s.header);
  word(f,parseInt(s.entry.replace(':',''),16)+2,0xA514);
  word(f,0x80024E,4);word(f,0x800316,6);word(f,0x800376,65535);word(f,0x800BA2,0);
  if(kind==='yield-resume-end'){
   for(const [address,value]of [[0x800254,0x600],[0x600,0x1200],[0x601,0x8012],[0x603,4],[0x607,0x3F0],
    [0x609,0],[0x8005FC,0x8060],[0x82E623,0],[0x80F2C8,0xF3B1]])word(f,address,value);
   f.data.seed(parseInt(s.entry.replace(':',''),16)+2,[0x14,0x21,0x43,0x56,0xA5]);
   f.data.seed(0x801207,[0x14,0x76,0x98,0x56,0xA5]);
  }
 }
 return {...f,maxHandlers:kind==='yield-resume-end'?5:['push-end','native-end'].includes(kind)?2:1,maxWork:10000,maxOutputBytes:2048};
}
