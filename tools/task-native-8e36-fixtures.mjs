import {textMaskWords} from './render-text-compose-fixtures.mjs';
import {readFile} from 'node:fs/promises';
import {inspectRom,cpuToOffset} from './rom.mjs';
import {taskRandomFixture,randomRecords} from './task-native-random-fixtures.mjs';
import {sampleWord} from './render-f130-fixtures.mjs';
import {heldFixture} from './render-be6d-fixtures.mjs';
const {bytes}=inspectRom(await readFile('Shadowrun (E).smc'));
export const freeze8E36=v=>Object.freeze(v.map(Object.freeze));
// Explicit synthetic slots, coordinates, records and mutable caller state;
// only the separately selected immutable table bytes come from the ROM.
export function seed8E36Fixture(f,{active=0x10,flags=0x8000,center=0x20,limit=1,counter=0,currency=0,
 dx=0,dy=0,dz=0,record=0x4000,health=5,timer=0,task=0,free=0x56}={}){
 const word=(a,v)=>sampleWord(f.data,a,v),bank=0x800000;
 word(0,center);word(2,limit);word(bank+0x1FD4,counter);word(0x7E3C11,currency);
 for(let x=0;x<=0x56;x+=2){word(0x7E3F28+x,65535);word(bank+0x1458+x,0);}
 if(active!==null){word(0x7E3F28+active,11);word(bank+0x1458+active,flags);}
 for(const [o,d]of [[0xE28,dx],[0xE80,dy],[0xED8,dz]]){word(bank+o+center,0x1000);if(active!==null)word(bank+o+active,(0x1000+d)&65535);}
 if(active!==null){word(0x7E43F8+active,timer);word(0x7E43A0+active,0);word(bank+0x13A8+active,record);word(bank+0x1350+active,task);}
 if(record)word(0x7E0002+record,health);if(task>=0){word(bank+0xBA2+task,0);word(bank+0xC62+task,0x1234);}
 word(bank+0xCC2,0x44);word(bank+0x14B0,0);word(8,65535);
 if(free!==null){if(free!==active)word(0x7E3F28+free,65535);}
 else for(let x=0;x<=0x56;x+=2)word(0x7E3F28+x,x===active?11:0);
 for(const id of [0xA1,0xE7]){const a=0x8CEFB4+id*6,off=cpuToOffset(a,bytes.length);f.data.seed(a,bytes.subarray(off,off+2));}
 for(const id of [0x10F,0x80]){
  const value=a=>bytes.readUInt16LE(cpuToOffset(a,bytes.length));
  for(const a of [0x82DB28+id,0x82E9CC+id,0x82DED1+id*2])word(a,value(a));
  const header=(value(0x82DB28+id)&255)*65536+value(0x82DED1+id*2),off=cpuToOffset(header,bytes.length);
  f.data.seed(header,bytes.subarray(off,off+2));
 }
 word(bank+0x3D2,0x400);word(bank+0x3D4,0);word(bank+0x24E,2);word(bank+0x24C,65535);word(bank+0x314,65535);
 const off=cpuToOffset(0x808840,bytes.length);f.data.seed(0x808840,bytes.subarray(off,off+32));
 return f;
}
export function task8E36Fixture(variant={}){
 const f=taskRandomFixture(0x808E36,{limit:variant.limit??1,values:variant.flags&0x2000?[[0x7B,0x1A,0]]:[]});
 seed8E36Fixture(f,variant);
 return {...f,context:Object.freeze({...f.context,x:0xABCD,y:0xBEEF,pc:0x8E36}),maxWork:1000000,maxOutputBytes:1000000,
  ioObservations:variant.flags&0x2000?randomRecords([[0x7B,0x1A,0]]):freeze8E36([]),
  waitMode:'record-observations',waitObservations:freeze8E36([]),inputMode:'record-observations',inputObservations:freeze8E36([])};
}
export function task8E36NoticeFixture(counter=3,currency=8){
 const f=task8E36Fixture({counter,currency}),support=heldFixture({writeWindows:[[0x7E0000,0x7FFFFF]]});
 for(const [a,v]of support.snapshot().bytes)f.data.seed(a,[v]);seed8E36Fixture(f,{counter,currency});
 sampleWord(f.data,0x801CA,0);sampleWord(f.data,0x8001CA,0);sampleWord(f.data,0x8001CC,0);sampleWord(f.data,0x8001D3,0);
 sampleWord(f.data,0x8001EA,0);sampleWord(f.data,0x8001EC,0);sampleWord(f.data,0x8001F0,0);
 sampleWord(f.data,0x801FD4,counter);sampleWord(f.data,0x7E3C11,currency);
 for(const p of [0x74BA,0x74D2])f.data.seed(0x9D0000+(p|0x8000),[0x40,0]);
 f.ioObservations=freeze8E36([{pc:0x80FA01,address:0x802134,width:2,value:counter===3?72:92},
  {pc:0x81ADDD,address:0x804216,width:2,value:0},{pc:0x81AE39,address:0x804216,width:2,value:0}]);
 f.waitObservations=freeze8E36([{pc:0x81ACBD,address:0x8001F6,width:2,value:0},{pc:0x81ACAF,address:0x8001F8,width:2,value:0},
  {pc:0x81ACC9,address:0x7E01FC,width:2,value:0},...textMaskWords(),{pc:0x81ACC3,address:0x7E01FA,width:2,value:0},
  ...Array.from({length:31},(_,n)=>({pc:0x81B0A5,address:0x7E1C76,width:2,value:n+1})),{pc:0x81ACAF,address:0x8001F8,width:2,value:0}]);
 f.inputObservations=freeze8E36([{pc:0x809E1A,address:0x8001CA,width:2,value:64}]);return f;
}
