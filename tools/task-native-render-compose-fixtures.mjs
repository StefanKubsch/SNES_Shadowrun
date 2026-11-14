import {createRenderData} from '../src/render/data.mjs';import {ad92Fixture,seedWord} from './render-ad92-fixtures.mjs';
export function taskRenderComposeFixture(helper='AD92',{bank=0x80,s=0x6FF,status=0x45,active=false,index=0,
 first=0,last=0,flags=[1],counter=0,positions=[],wait=helper==='ACCF'?[]:[0],values=active?[3,0,3,0,0]:[],omit=null,
 writeWindows=[[0x7E0000,0x7FFFFF]]}={}){
 let data=ad92Fixture({bank,active,first,last,flags,counter,positions,writeWindows});
 const entry=new Map([['ACAF',0x81ACAF],['ACB5',0x81ACB5],['ACCF',0x81ACCF],['AD92',0x81AD92],['FA3E',0x80FA3E]]).get(helper);
 if(!entry)throw Error('Unknown render helper');
 for(let n=0;n<flags.length;n++)if(!flags[n])seedWord(data,0x7E2060+n*2,0x2027);
 seedWord(data,0,index);seedWord(data,bank*65536+0x212,0xABCD);
 const returns=helper==='FA3E'?[0x08,0xF5]:[0x65,0xFA,0x80];for(const [n,value] of returns.entries())data.seed(0x7E0000+((s+1+n)&65535),[value]);
 if(omit!==null){const owner=createRenderData({writeWindows});for(const [address,value] of data.snapshot().bytes)if(address!==omit)owner.seed(address,[value]);data=owner;}
 const ioPcs=[0x81AF56,0x81AF73,0x81AFC9,0x81AFCE,0x81AFEC];
 return {data,entry,context:Object.freeze({a:0xBEEF,x:index,y:0xABCD,s,d:0,bank,status,e:0,programBank:entry>>>16,pc:entry&65535}),
  protectedStackBytes:returns.map((_,n)=>0x7E0000+((s+1+n)&65535)),maxWork:1000000,maxOutputBytes:1000000,
  ioMode:'record-requests',ioObservations:Object.freeze(values.map((value,n)=>Object.freeze({pc:ioPcs[n],address:0x800000+(n%2===0?0x4214:0x4216),width:2,value}))),
  waitMode:'record-observations',waitObservations:Object.freeze(wait.map(value=>Object.freeze({pc:0x81ACAF,address:bank*65536+0x1F8,width:2,value})))};
}
