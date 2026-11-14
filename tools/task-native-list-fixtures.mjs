import {textMaskWords} from './render-text-compose-fixtures.mjs';
import {listFixture} from './render-list-fixtures.mjs';
const freeze=values=>Object.freeze(values.map(v=>Object.freeze(v)));
export function taskListFixture(entry=0x80A617,{bank=0x80,s=0x6FF,status=0x45,
 writeWindows=[[0x7E0000,0x7FFFFF]],...patch}={}){
 const data=listFixture({bank,tokens:[0],count:1,writeWindows,...patch}),word=(a,v)=>data.seed(a,[v&255,v>>>8]);
 for(const [n,v] of [8,0xF5].entries())data.seed((s+1+n)&65535,[v]);
 const cursor={pc:0x80FACD,address:0x804216,width:2,value:0},text=[
  {pc:0x81ADDD,address:0x804216,width:2,value:0},{pc:0x81AE39,address:0x804216,width:2,value:0}];
 const isMark=[0x80A5DB,0x80A5F9].includes(entry),isNumber=entry===0x80FD80;
 if(entry===0x80FAAC){word(2,patch.column??1);word(4,patch.row??1);}
 if(isNumber)word(2,5);
 const io=isNumber?[{pc:0x80FD9E,address:bank*65536+0x4216,width:1,value:5},
  {pc:0x80FDA7,address:bank*65536+0x4214,width:2,value:0},...text]:isMark?[cursor,...text]:[cursor];
 return {data,entry,context:Object.freeze({a:0xBEEF,x:0x1234,y:2,s,d:0,bank,status,e:0,programBank:0x80,pc:entry&65535}),
  protectedStackBytes:[1,2].map(n=>0x7E0000+((s+n)&65535)),maxWork:1000000,maxOutputBytes:1000000,
  ioMode:'record-requests',ioObservations:freeze(io),waitMode:'record-observations',
  waitObservations:freeze(isMark||isNumber?[
   {pc:0x81ACC9,address:0x7E01FC,width:2,value:0},...textMaskWords(),{pc:0x81ACC3,address:0x7E01FA,width:2,value:0}]:[])};
}

// Independently declared source paths, including each fresh device/wait read.
export function taskListCase(name){
 const cursor=()=>({pc:0x80FACD,address:0x804216,width:2,value:0});
 const text=()=>[{pc:0x81ADDD,address:0x804216,width:2,value:0},{pc:0x81AE39,address:0x804216,width:2,value:0}];
 const cases={
  one:{patch:{tokens:[16,0]},ops:[cursor(),...text()],texts:1},
  more:{patch:{tokens:[16,16,0]},ops:[cursor(),...text(),cursor(),...text()],texts:2},
  previous:{patch:{scroll:2,tokens:[16,16,0]},ops:[cursor(),...text(),cursor(),...text()],texts:2},
  'zero-count':{patch:{count:0,tokens:[16,0]},ops:[cursor(),...text(),cursor()],texts:1},
  two:{patch:{count:2,tokens:[16,16,0]},ops:[cursor(),...text(),cursor(),...text()],texts:2},
  'zero-number':{patch:{tokens:[16,0],numberFlag:1,numbers:[0]},ops:[cursor(),...text()],texts:1},
  number:{patch:{tokens:[16,0],numberFlag:1,numbers:[5]},ops:[cursor(),...text(),...text(),
   {pc:0x80FD9E,address:0x804216,width:1,value:5},{pc:0x80FDA7,address:0x804214,width:2,value:0},...text()],texts:3},
  'fresh-number-alias':{patch:{bank:0x7E,tokens:[16,0],numbers:[5],numberFlag:1,numberPointer:0x21A0},
   ops:[cursor(),...text(),...text(),...text()],texts:3}
 };
 const c=cases[name];if(!c)throw Error('Unknown declared list case');
 const f=taskListFixture(0x80A617,c.patch);
 if(name==='fresh-number-alias'){f.data.seed(0x9DF07D,[0x80,0]);f.data.seed(0x7E4214,[0,0]);f.data.seed(0x7E4216,[0]);}
 return {...f,ioObservations:freeze(c.ops),waitObservations:freeze(Array.from({length:c.texts},()=>[
  {pc:0x81ACC9,address:0x7E01FC,width:2,value:0},...textMaskWords(),{pc:0x81ACC3,address:0x7E01FA,width:2,value:0}]).flat())};
}
