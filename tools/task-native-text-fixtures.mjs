import {textMaskWords} from './render-text-compose-fixtures.mjs';
import {createRenderData} from '../src/render/data.mjs';
export function taskTextFixture(name,{bank=0x7E,s=0x6FF,x=2,y=0xABCD,status=0x45,a=0xBEEF,remaining=0,
 buffer=0xAAAA,pointer=0x9D9000,raw=0x4080,width=10,height=8,cursor=0x30,base=0x20,offset=0,limit=0x100,minimum=0,
 results=[0],quotients=[0,1],maskIndex=1,mask=0x1234,maskCursor=0,waitValues=[1,0],counter=0,
 writeWindows=[[0x7E0000,0x7FFFFF]]}={}){
 const data=createRenderData({writeWindows}),word=(address,value)=>data.seed(address,[value&255,value>>>8]);
 const entry={AF04:0x81AF04,ADBA:0x81ADBA,AE14:0x81AE14,AE4D:0x81AE4D,AEC8:0x81AEC8,
  AEF4:0x81AEF4,AEFC:0x81AEFC,ACC3:0x81ACC3,ACC9:0x81ACC9}[name];if(!entry)throw Error('Unknown text fixture');
 for(const [address,value] of [[bank*65536+0x206,remaining],[bank*65536+0x208,buffer],
  [0x7E2020+x,width],[0x7E2040+x,height],[0x7E2060+x,base],[0x7E20C0+x,cursor],
  [0x7E20E0+x,offset],[0x7E2080+x,limit],[0x7E2100+x,minimum],[0xCF,pointer&65535],[pointer,raw]])word(address,value);
 data.seed(0xD1,[pointer>>>16]);
 if(name==='AEC8'){
  word(0xAB,maskCursor);word(0xB7,maskIndex);word(0x81AC8D+((maskIndex<<1)&65535),mask);
  let position=(maskCursor+16)&65535;for(let n=0;n<8;n++){word((bank*65536+0x2ADE+position)&0xFFFFFF,0xAA00);position=(position-2)&65535;}
 }
 const waits=['AEF4','AEFC','ACC3','ACC9'].includes(name),first=name==='AEF4'||name==='ACC3';
 if(waits)word(bank*65536+(first?0x1FA:0x1FC),counter);
 for(const [n,value] of [0xF508&255,0xF508>>>8,0x80].entries())data.seed((s+1+n)&65535,[value]);
 const observations=name==='AF04'||name==='AEC8'||waits?[]:name==='AE4D'?[...quotients.map((value,n)=>({pc:n?0x81AE7D:0x81AE73,address:0x804214,width:1,value})),
  ...results.map(value=>({pc:0x81AE94,address:0x804216,width:2,value}))]:results.map(value=>({pc:name==='ADBA'?0x81ADDD:0x81AE39,address:0x804216,width:2,value}));
 return {data,entry,context:Object.freeze({a,x,y,s,d:0,bank,status,e:0,programBank:0x81,pc:entry&65535}),
  protectedStackBytes:[1,2,3].map(n=>0x7E0000+((s+n)&65535)),maxWork:10000,maxOutputBytes:10000,
  ioMode:'record-requests',ioObservations:Object.freeze(observations.map(o=>Object.freeze(o))),
  ...(waits?{waitMode:'record-observations',waitObservations:Object.freeze([...waitValues.map(value=>({pc:first?0x81ACC3:0x81ACC9,address:bank*65536+(first?0x1FA:0x1FC),width:2,value})),
   ...(first?[]:textMaskWords())].map(o=>Object.freeze(o)))}:{})};
}
