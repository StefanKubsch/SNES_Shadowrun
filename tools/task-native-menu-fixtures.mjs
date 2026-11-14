import {menuFixture} from './render-menu-fixtures.mjs';import {textMaskWords} from './render-text-compose-fixtures.mjs';
const freeze=v=>Object.freeze(v.map(r=>Object.freeze(r)));
export const menuCursorRead=()=>({pc:0x80FACD,address:0x804216,width:2,value:0});
export const menuTextReads=()=>[{pc:0x81ADDD,address:0x804216,width:2,value:0},{pc:0x81AE39,address:0x804216,width:2,value:0}];
export const menuTextWaits=()=>[{pc:0x81ACC9,address:0x7E01FC,width:2,value:0},...textMaskWords(),{pc:0x81ACC3,address:0x7E01FA,width:2,value:0}];
export const menuCounterRead=value=>({pc:0x81B0A5,address:0x7E1C76,width:2,value});
export const menuAudioReads=(token=0)=>[{pc:0x80C44F,address:0x804217,width:1,value:17},{pc:0x80C45A,address:0x804217,width:1,value:34},
 ...[0,1,2].map(n=>({pc:0x81F00E,address:0x802140,width:1,value:(token+n)&255}))];
export function taskMenuFixture(entry=0x80A6A5,{bank=0x80,s=0x6FF,status=0xC5,a=0,held=0x40,token=0,
 writeWindows=[[0x7E0000,0x7FFFFF]],...patch}={}){
 const data=menuFixture({tokens:[0],count:1,held,bank,token,writeWindows,...patch});
 for(const [n,v] of [8,0xF5].entries())data.seed((s+1+n)&65535,[v]);
 // Independently declared minimal empty-list/mark/confirm-or-cancel path.
 const io=[menuCursorRead(),menuCursorRead(),...menuTextReads(),menuCursorRead(),...menuTextReads(),...(held&0x2000?[]:menuAudioReads(token))];
 const waits=[...menuTextWaits(),menuCounterRead(1),...menuTextWaits()];
 return {data,entry,context:Object.freeze({a,x:0x1234,y:0xBEEF,s,d:0,bank,status,e:0,programBank:0x80,pc:entry&65535}),
  protectedStackBytes:[1,2].map(n=>0x7E0000+((s+n)&65535)),maxWork:1000000,maxOutputBytes:1000000,
  ioMode:'record-requests',ioObservations:freeze(io),waitMode:'record-observations',waitObservations:freeze(waits)};
}
export const menuRecords=freeze;
