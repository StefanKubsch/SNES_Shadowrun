import {taskAudioFixture} from './task-native-audio-fixtures.mjs';
import {taskFEC1Fixture} from './task-native-fec1-fixtures.mjs';
import {sampleWord} from './render-f130-fixtures.mjs';
import {menuRecords} from './task-native-menu-fixtures.mjs';
import {localWaitSeedBytes} from './task-script-body-local-wait-seeds.mjs';
import {localWaitC8Streams,localWaitC8WaitStreams} from './task-script-body-local-wait-observations.mjs';
export function localWaitBodyCases(s){return s.id===0x210?
 [{name:'four-audio-returns',token:0},{name:'audio-token-wrap',token:254},{name:'cached-voice',token:0,cachedVoice:3}]:
 [{name:'five-countdown-returns',pointer:0},{name:'original-record-property',pointer:0x4000}];}
export function localWaitBodyPCs(s){
 const pcs=[],returns=[];let pc=0;
 for(let n=0;n<1000;n++){const i=s.instructions.find(i=>i.pc===pc);if(!i)throw Error('Uncovered local-wait PC');pcs.push(pc);
  if(i.opcode===0x56){if(returns.length)throw Error('Pending local-wait return');return pcs;}
  if(i.opcode===0x4C){returns.push(pc+i.length);pc=i.operand;}
  else if(i.opcode===0x50){if(!returns.length)throw Error('Unmatched local-wait return');pc=returns.pop();}
  else if(i.flow==='conditional')throw Error('Unproved local-wait predicate');
  else pc=i.opcode===0x48?i.operand:pc+i.length;
 }throw Error('Unbounded local-wait PC fixture');
}
export function expandLocalWaitFixture(s,v,f){
 const original=f.data.snapshot().bytes,notice=taskFEC1Fixture({s:0xAFF}),audio=taskAudioFixture(0x80C46E,{s:0xAFF,sound:0x28,voice:3,token:v.token??0,cachedVoice:v.cachedVoice??0});
 for(const source of [notice,audio])for(const [a,n]of source.data.snapshot().bytes)f.data.seed(a,[n]);
 for(const [a,n]of original)f.data.seed(a,[n]);for(const [a,n]of localWaitSeedBytes[s.id]??[])f.data.seed(a,[n]);
 const word=(a,n)=>sampleWord(f.data,a,n);
 for(const [a,n]of [[0x800,16],[0x802,0xBEEF],[0x605,v.returnPointer??0x900],[0x900,0xA5A5],
  [0x8013B8,v.pointer??0],[0x800E38,12],[0x800E90,20],[0x800EE8,28],[0x800CC4,0],
  [0x7E3F7E,65535],[0x8014B0,0],[0x8014B2,16],[0x8003D2,0x800],[0x8003D4,0],
  [0x80024E,4],[0x800316,65535],[0x80024C,2],[0x8012B0,0],[0x7E4408,0]])word(a,n);
 if(s.id===0x2D0)for(const allocation of[2,8,6])for(const [offset,n]of [[0x2020,10],[0x2040,8],[0x2060,32],[0x2080,256],[0x20C0,32],[0x20E0,0],[0x2100,0],[0x2140,0]])word(0x7E0000+offset+allocation,n);
 // Individual original ROM pins take precedence over synthetic base fixtures.
 for(const r of s.romReads)word(r.address,r.value);
 const pcs=localWaitBodyPCs(s),first=pcs.findIndex(pc=>{const i=s.instructions.find(i=>i.pc===pc);return i.opcode===0x58&&i.operand===0x9F;}),
  audioStreams=Array.from({length:4},(_,n)=>taskAudioFixture(0x80C46E,{sound:0x28,voice:3,token:((v.token??0)+(v.cachedVoice===3?2:3)+(n-1)*2)&255,cachedVoice:3}).ioObservations);
 audioStreams[0]=audio.ioObservations;
 return {...f,localWaitPCs:pcs,localAudioStreams:audioStreams,localVariantName:v.name,
  localC8Observations:{ioObservations:notice.ioObservations,waitObservations:notice.waitObservations},
  maxHandlers:first+1,maxWork:2000000,maxOutputBytes:2000000,ioMode:'record-requests',ioObservations:menuRecords([]),
  waitMode:'record-observations',waitObservations:menuRecords([]),inputMode:'record-observations',inputObservations:menuRecords([])};
}
export function localWaitResumePatch(s,f,continuation){
 const following=f.localWaitPCs.slice(continuation.bodyPCs.length),nextWait=following.findIndex(pc=>{const i=s.instructions.find(i=>i.pc===pc);return i.opcode===0x58&&i.operand===0x9F;}),
  maxHandlers=nextWait<0?following.length:nextWait+1,segment=following.slice(0,maxHandlers),
  count=f.data.readByte(0x800C04).value|(f.data.readByte(0x800C05).value<<8),mask=f.data.readByte(0x800BA4).value|(f.data.readByte(0x800BA5).value<<8),ready=mask!==1||count===1;
 let io=[],wait=[];
 if(ready){for(const pc of segment){const i=s.instructions.find(i=>i.pc===pc);if(i.opcode!==0x58)continue;
  if(i.operand===0xC8){const key=`${s.id}:${f.localVariantName}:${pc}`;io.push(...(localWaitC8Streams[key]??f.localC8Observations.ioObservations));wait.push(...(localWaitC8WaitStreams[key]??[]));}
  else if(i.operand===0x4C){const previous=continuation.bodyPCs.filter(pc=>{const i=s.instructions.find(i=>i.pc===pc);return i.opcode===0x58&&i.operand===0x4C;}).length;io.push(...f.localAudioStreams[previous]);}
 }}
 return {maxHandlers,ioObservations:menuRecords(io),waitObservations:menuRecords(wait),inputObservations:menuRecords([])};
}
