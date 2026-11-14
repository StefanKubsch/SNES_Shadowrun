import {readFile} from 'node:fs/promises';import {createOriginalRenderData} from '../proof/render/original-data.mjs';
import {createRenderData} from '../src/render/data.mjs';import {seedOriginalAF1FData} from '../proof/render/original-af1f-data.mjs';
const asset=JSON.parse(await readFile(new URL('../assets/render-unpack-data.json',import.meta.url)));
const afAsset=JSON.parse(await readFile(new URL('../assets/render-af1f-data.json',import.meta.url)));
export const lengthBits=n=>[...n.toString(2).slice(1)].flatMap(c=>[0,Number(c)]).concat(1);
export const fixedBits=(value,width)=>Array.from({length:width},(_,i)=>value>>>(width-1-i)&1);
export function encodedStream(header,payload,bits){
 const out=[header&255,header>>>8,(payload.length+2)&255,(payload.length+2)>>>8,...payload];bits=[...bits];
 while(bits.length%16)bits.push(0);for(let i=0;i<bits.length;i+=8)out.push(bits.slice(i,i+8).reduce((a,b)=>a*2+b,0));return out;
}
export function taskUnpackFixture({compose=false,original=null,header=4,payload=[1,2,3,4],bits=lengthBits(header),destination=0x23A0,
 bank=0x80,s=0x6FF,status=0x45,sourceBankWord=0x80,firstGate=1,secondGate=0,row=61,parameter=5,
 values=[3,1,3,1,0,14],omit=null,writeWindows=[[0x7E0000,0x7FFFFF]]}={}){
 let data=createOriginalRenderData(asset,{writeWindows});seedOriginalAF1FData(data,afAsset);
 const word=(address,value)=>data.seed(address,[value&255,value>>>8]);
 const sourceOffset=original===null?0x9000:asset.sources[original].address&65535;
 if(original===null)data.seed(0x809000,encodedStream(header,payload,bits));else sourceBankWord=asset.sources[original].address>>>16;
 if(compose){word(bank*65536+0x1FE,sourceOffset);word(bank*65536+0x1F4,sourceBankWord);}
 for(const [address,value] of [[0x801D61,firstGate],[0x7E2DE6,secondGate],[0x7E3C00,row],[0x7E33DE,parameter]])word(address,value);
 const returns=compose?[0x95,0xAD,0x81]:[0xBF,0xA9,0x81];for(const [n,value] of returns.entries())data.seed(0x7E0000+((s+1+n)&65535),[value]);
 const entry=compose?0x81A9B2:0x809F49;
 const context=Object.freeze({a:compose?0xBEEF:sourceOffset,x:compose?0x1234:destination,y:compose?0xABCD:sourceBankWord,
  s,d:0,bank,status,e:0,programBank:entry>>>16,pc:entry&65535});
 if(omit!==null){const owner=createRenderData({writeWindows});for(const [address,value] of data.snapshot().bytes)if(address!==omit)owner.seed(address,[value]);data=owner;}
 const pcs=[0x81AF56,0x81AF73,0x81AFC9,0x81AFCE,0x81AFEC,(values[3]??0)!==0&&(parameter&255)<11?0x81B009:0x81B016];
 return {data,entry,context,protectedStackBytes:[1,2,3].map(n=>0x7E0000+((s+n)&65535)),maxWork:1000000,maxOutputBytes:1000000,
  ...(compose?{ioMode:'record-requests',ioObservations:Object.freeze(values.map((value,n)=>Object.freeze({pc:pcs[n],address:0x800000+(n%2===0?0x4214:0x4216),width:2,value})))}:{})};
}
