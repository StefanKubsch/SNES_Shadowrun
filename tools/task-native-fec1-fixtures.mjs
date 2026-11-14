import {readFile} from 'node:fs/promises';import {textMaskWords} from './render-text-compose-fixtures.mjs';import {noticeFixture} from './render-fec1-fixtures.mjs';import {heldWord} from './render-be6d-fixtures.mjs';
import {createRenderData} from '../src/render/data.mjs';import {seedOriginalAF1FData} from '../proof/render/original-af1f-data.mjs';
const afAsset=JSON.parse(await readFile(new URL('../assets/render-af1f-data.json',import.meta.url)));
export function taskFEC1Fixture({bank=0x80,s=0x6FF,status=0x45,cursor=30,occupied=[],lifetimes=[60,60,60,60],
 activeAF1F=false,afValues=[3,1,3,1,0,14],waitF6=[0],waitF8=[0],waitFC=[0],waitFA=[0],waitReplacement=[0],
 products=cursor===30?[]:[1],omit=null,writeWindows=[[0x7E0000,0x7FFFFF]]}={}){
 let data=noticeFixture({bank,cursor,occupied,lifetimes,writeWindows});
 if(activeAF1F){seedOriginalAF1FData(data,afAsset);for(const [address,value] of [[0x801D61,1],[0x7E2DE6,0],[0x7E3C00,61],[0x7E33DE,5]])heldWord(data,address,value);}
 for(const [n,value] of [0x08,0xF5].entries())data.seed(0x7E0000+((s+1+n)&65535),[value]);
 if(omit!==null){const owner=createRenderData({writeWindows});for(const [address,value] of data.snapshot().bytes)if(address!==omit)owner.seed(address,[value]);data=owner;}
 const replacement=[0,1,2,3].every(i=>!((occupied[i]??65535)&32768));
 const reads=[...products.map((value,n)=>({pc:n?0x80FA19:0x80FA01,address:bank*65536+0x2134,width:2,value})),
  {pc:0x81ADDD,address:0x804216,width:2,value:0},{pc:0x81AE39,address:0x804216,width:2,value:0},
  ...(replacement&&activeAF1F?afValues.map((value,n)=>({pc:[0x81AF56,0x81AF73,0x81AFC9,0x81AFCE,0x81AFEC,0x81B009][n],address:0x800000+(n%2===0?0x4214:0x4216),width:2,value})):[])];
 const waits=[...(products.length?[...waitF6.map(value=>({pc:0x81ACBD,address:bank*65536+0x1F6,width:2,value})),
  ...waitF8.map(value=>({pc:0x81ACAF,address:bank*65536+0x1F8,width:2,value}))]:[]),
  ...waitFC.map(value=>({pc:0x81ACC9,address:0x7E01FC,width:2,value})),...(waitFC.length?textMaskWords():[]),...waitFA.map(value=>({pc:0x81ACC3,address:0x7E01FA,width:2,value})),
  ...(replacement?waitReplacement.map(value=>({pc:0x81ACAF,address:bank*65536+0x1F8,width:2,value})):[])];
 const freeze=values=>Object.freeze(values.map(o=>Object.freeze(o)));
 return {data,entry:0x80FEC1,context:Object.freeze({a:0xBEEF,x:0x1234,y:0xABCD,s,d:0,bank,status,e:0,programBank:0x80,pc:0xFEC1}),
  protectedStackBytes:[1,2].map(n=>0x7E0000+((s+n)&65535)),maxWork:1000000,maxOutputBytes:1000000,
  ioMode:'record-requests',ioObservations:freeze(reads),waitMode:'record-observations',waitObservations:freeze(waits)};
}
