import {textFixture,textMaskWords} from './render-text-compose-fixtures.mjs';
export function taskTextComposeFixture(helper,{s=0x6FF,bank=helper==='FE69'?0x80:0x7E,status=0x45,
 io=null,waitFC=[0],waitFA=[0],mask=0xAAAA,writeWindows=[[0x7E0000,0x7FFFFF]],...text}={}){
 const data=textFixture({...text,writeWindows}),entry=helper==='FE69'?0x80FE69:0x80FB39;
 data.seed((s+1)&65535,[0x08]);data.seed((s+2)&65535,[0xF5]);
 const ioValues=io??[{pc:0x81ADDD,address:0x804216,width:2,value:0},{pc:0x81AE39,address:0x804216,width:2,value:0}];
 const freeze=values=>Object.freeze(values.map(o=>Object.freeze(o)));
 return {data,entry,context:Object.freeze({a:0xBEEF,x:0x1234,y:0xABCD,s,d:0,bank,status,e:0,programBank:0x80,pc:entry&65535}),
  protectedStackBytes:[1,2].map(n=>0x7E0000+((s+n)&65535)),maxWork:1000000,maxOutputBytes:1000000,
  ioMode:'record-requests',ioObservations:freeze(ioValues),waitMode:'record-observations',
  waitObservations:freeze([...waitFC.map(value=>({pc:0x81ACC9,address:0x7E01FC,width:2,value})),...(waitFC.length?textMaskWords(mask):[]),
   ...waitFA.map(value=>({pc:0x81ACC3,address:0x7E01FA,width:2,value}))])};
}
