import {createRenderData} from '../src/render/data.mjs';

// Explicit synthetic Task/render field and event ownership; no scene initialization.
export function taskRenderFixture({cursor=0,position=0x2027,width=4,height=3,left=1,top=1,
 bank=0x80,s=0x6FF,status=0x45,products=[2],waitF6=[1,0],waitF8=[0],writeWindows=[[0x7E0000,0x7FFFFF]]}={}){
 const data=createRenderData({writeWindows}),base=bank*65536;
 const word=(address,value)=>{data.seed(address&0xFFFFFF,[value&255]);data.seed((address+1)&0xFFFFFF,[value>>>8]);};
 const stackWord=(address,value)=>{data.seed(address&65535,[value&255]);data.seed((address+1)&65535,[value>>>8]);};
 for(const [address,value] of [[0,left],[2,top],[4,width],[6,height],[8,0x800],[base+0x204,cursor],
  [base+0x212,position],[base+0x226+((cursor+2)&65535),0],[base+0x1F6,0],[base+0x1F8,0]])word(address,value);
 stackWord(s+1,0xF508);
 const freeze=values=>Object.freeze(values.map(o=>Object.freeze(o)));
 const ioObservations=freeze(products.map((value,n)=>({pc:n?0x80FA19:0x80FA01,address:base+0x2134,width:2,value})));
 const waitObservations=freeze([...waitF6.map(value=>({pc:0x81ACBD,address:base+0x1F6,width:2,value})),
  ...waitF8.map(value=>({pc:0x81ACAF,address:base+0x1F8,width:2,value}))]);
 return {data,entry:0x80F963,context:Object.freeze({a:0xBEEF,x:0x1234,y:0xABCD,s,d:0,bank,status,e:0,programBank:0x80,pc:0xF963}),
  protectedStackBytes:[0x7E0000+((s+1)&65535),0x7E0000+((s+2)&65535)],maxWork:250000,maxOutputBytes:250000,
  ioMode:'record-requests',ioObservations,waitMode:'record-observations',waitObservations};
}
