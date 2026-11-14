import {createRenderData} from '../src/render/data.mjs';
export function taskInputApuFixture(entry=0x809E1A,{bank=0x80,s=0x6FF,status=0xC5,a=0xAB34,x=0xBEEF,y=0x1234,
 current=0x8000,previous=0x4000,token=0x12,index=65535,position=0,other=0,scroll=0,
 writeWindows=[[0x7E0000,0x7FFFFF]]}={}){
 const data=createRenderData({writeWindows}),word=(address,n)=>data.seed(address,[n&255,n>>>8]),base=bank*65536;
 const long=entry===0x81F007;for(const [n,v] of [8,0xF5,...(long?[0x80]:[])].entries())data.seed((s+1+n)&65535,[v]);
 const io=[];
 if(entry===0x809E1A){word(base+0x1CA,current);word(base+0x1CC,previous);}
 else if(long){data.seed(base+0x1CE4,[token]);if([0x7E,0x7F].includes(bank))data.seed(base+0x2140,[token]);
  else io.push({pc:0x81F00E,address:base+0x2140,width:1,value:token});}
 else{word(0,index);if(index<32768){word(base+0x0E80+index,position);word(base+0x0E28+index,other);word(base+0x0CC4,scroll);}
  if([0x7E,0x7F].includes(bank))data.seed(base+0x4217,[17]);
  else io.push({pc:0x80C44F,address:base+0x4217,width:1,value:17},{pc:0x80C45A,address:base+0x4217,width:1,value:34});}
 return {data,entry,context:Object.freeze({a,x,y,s,d:0,bank,status,e:0,programBank:entry>>>16,pc:entry&65535}),
  protectedStackBytes:Array.from({length:long?3:2},(_,n)=>0x7E0000+((s+n+1)&65535)),maxWork:1000000,maxOutputBytes:1000000,
  ioMode:'record-requests',ioObservations:Object.freeze(io.map(r=>Object.freeze(r)))};
}
