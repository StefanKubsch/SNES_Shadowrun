import {createRenderData} from '../src/render/data.mjs';
import {sampleFixture,sampleWord} from './render-f130-fixtures.mjs';
import {wordFixture} from './render-f122-fixtures.mjs';
const freeze=v=>Object.freeze(v.map(r=>Object.freeze(r)));
export function taskAudioFixture(entry=0x80C46E,{bank=0x80,s=0x6FF,status=0xC5,a=entry===0x81F130?0x8007:0xAB34,
 x=0xBEEF,y=0x1234,writeWindows=[[0x7E0000,0x7FFFFF]],sound=45,voice=3,cachedSound=0,cachedVoice=0,token=0,...sample}={}){
 const long=entry===0x81F130,base=bank*65536;
 const data=long||entry===0x80C46E?sampleFixture({bank:entry===0x80C46E?0x80:bank,token,writeWindows,...sample}):
  [0x81F122,0x81F1E8].includes(entry)?wordFixture({bank,token,writeWindows,...sample}):createRenderData({writeWindows});
 for(const [n,v] of [8,0xF5,...(long?[0x80]:[])].entries())data.seed((s+1+n)&65535,[v]);
 let io=[];
 if(entry===0x80C46E){
  for(const [address,value] of [[0,65535],[2,0x4C],[4,0x40],[6,voice],[0x80C4FF,sound],[0x801CE0,cachedSound],[0x801CE2,cachedVoice]])sampleWord(data,address,value);
  const loader=sound>=32768&&sound!==cachedSound;
  if(loader)io=[{pc:0x81F00E,address:0x802140,width:1,value:token},{pc:0x81F046,address:0x802140,width:1,value:(token+1)&255},
   {pc:0x81F046,address:0x802140,width:1,value:(token+2)&255}];
  io.push({pc:0x80C44F,address:0x804217,width:1,value:17},{pc:0x80C45A,address:0x804217,width:1,value:34});
  const t=(token+(loader?3:0))&255;
  io.push({pc:0x81F00E,address:0x802140,width:1,value:t});
  if(voice){if(voice!==cachedVoice)io.push({pc:0x81F00E,address:0x802140,width:1,value:(t+1)&255});
   io.push({pc:0x81F00E,address:0x802140,width:1,value:(t+(voice!==cachedVoice?2:1))&255});}
 }else if(long){
  // Default one-byte raw block: parameter ACK, address pair, payload pair.
  io=[{pc:0x81F00E,address:base+0x2140,width:1,value:token},{pc:0x81F046,address:base+0x2140,width:1,value:(token+1)&255},
   {pc:0x81F046,address:base+0x2140,width:1,value:(token+2)&255}];
 }else if(entry===0x81F100)sampleWord(data,0x92,0x7FFF);
 else io=[{pc:0x81F046,address:base+0x2140,width:1,value:token}];
 if([0x7E,0x7F].includes(bank)&&entry!==0x80C46E)io=[];
 return {data,entry,context:Object.freeze({a,x,y,s,d:0,bank,status,e:0,programBank:entry>>>16,pc:entry&65535}),
  protectedStackBytes:Array.from({length:long?3:2},(_,n)=>0x7E0000+((s+n+1)&65535)),maxWork:1000000,maxOutputBytes:1000000,
  ioMode:'record-requests',ioObservations:freeze(io)};
}
export function declaredAudioReads(operations,bank=0x80){return freeze(operations.map(([pc,value])=>({pc,address:bank*65536+0x2140,width:1,value})));}
