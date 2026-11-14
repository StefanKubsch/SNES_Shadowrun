import {readFile} from 'node:fs/promises';import {createRenderData} from '../src/render/data.mjs';
import {seedOriginalAF1FData} from '../proof/render/original-af1f-data.mjs';
const asset=JSON.parse(await readFile(new URL('../assets/render-af1f-data.json',import.meta.url)));
export function taskAF1FFixture({bank=0x80,s=0x6FF,status=0x45,row=61,parameter=5,firstGate=1,secondGate=0,
 values=[3,1,3,1,0,14],omit=null,writeWindows=[[0x7E0000,0x7FFFFF]]}={}){
 const data=createRenderData({writeWindows});seedOriginalAF1FData(data,asset);
 const word=(address,value)=>data.seed(address,[value&255,value>>>8]);
 for(const [address,value] of [[bank*65536+0x1D61,firstGate],[0x7E2DE6,secondGate],[0x7E3C00,row],
  [0x7E33DE,parameter]])word(address,value);
 for(const [n,value] of [0xDE,0xA9,0x81].entries())data.seed((s+1+n)&65535,[value]);
 const pcs=[0x81AF56,0x81AF73,0x81AFC9,0x81AFCE,0x81AFEC,
  (values[3]??0)!==0&&(parameter&255)<11?0x81B009:0x81B016];
 const ioObservations=Object.freeze(values.map((value,n)=>Object.freeze({pc:pcs[n],address:bank*65536+(n%2===0?0x4214:0x4216),width:2,value})));
 const owner=omit===null?data:createRenderData({writeWindows});
 if(omit!==null)for(const [address,value] of data.snapshot().bytes)if(address!==omit)owner.seed(address,[value]);
 return {data:owner,entry:0x81AF1F,context:Object.freeze({a:0xBEEF,x:0xFFFE,y:0xABCD,s,d:0,bank,status,e:0,programBank:0x81,pc:0xAF1F}),
  protectedStackBytes:[1,2,3].map(n=>0x7E0000+((s+n)&65535)),maxWork:1000000,maxOutputBytes:1000000,
  ioMode:'record-requests',ioObservations};
}
