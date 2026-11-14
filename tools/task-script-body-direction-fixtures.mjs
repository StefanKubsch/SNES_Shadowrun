import {taskAudioFixture} from './task-native-audio-fixtures.mjs';
import {taskFEC1Fixture} from './task-native-fec1-fixtures.mjs';
import {sampleWord} from './render-f130-fixtures.mjs';import {menuRecords} from './task-native-menu-fixtures.mjs';
export const directionVectors=[[0,8],[4,4],[8,0],[4,-4],[0,-8],[-4,-4],[-8,0],[-4,4]];
export const directionBodyCases=s=>[
 ...(s.id===0x21B?[{name:'empty-original-global',guard:0}]:[]),
 ...directionVectors.map(([dx,dy],direction)=>({name:`original-direction-${direction}`,guard:0x8000,dx,dy,direction}))
];
export const directionBodyPCs=(s,v)=>s.id===0x21B&&v.guard===0?[0,2,4,6,7,41,42,44]:s.instructions.filter(i=>s.id!==0x21B||i.pc<41||i.pc===44).map(i=>i.pc);
export function expandDirectionBodyFixture(s,v,f){
 const word=(a,n)=>sampleWord(f.data,a,n),body=f.data.snapshot().bytes,slot=v.slot??16;
 const sound=s.id===0x21B?s.romReads.find(r=>r.address===0x80C4B3+0x3A)?.value??0:0;
 const audio=taskAudioFixture(0x80C46E,{s:0xAFF,sound,voice:3,cachedVoice:3,token:3,selector:sound&255,
  directory:0x7E7000,blockPointer:0x7E7100,blocks:[{kind:'raw',pointer:0x7E7200,values:[0xAB]}]});
 const notice=taskFEC1Fixture({s:0xAFF});
 const support=s.id===0x21B?audio:notice;
 for(const [a,n]of support.data.snapshot().bytes)f.data.seed(a,[n]);
 for(const [a,n]of body)f.data.seed(a,[n]);for(const r of s.romReads)word(r.address,r.value);
 word(0x800,slot);word(0x802,0xBEEF);word(0x7E3BE7,v.guard??0x8000);
 word(0x800CC2,0x20);word(0x800E28+slot,0);word(0x800E80+slot,0x1000);word(0x800E48,(v.dx??0)&65535);word(0x800EA0,(0x1000+(v.dy??8))&65535);
 for(const [o,n]of [[0x1038,65535],[0x1198,0],[0x10E8,1],[0x11F0,0xAB31],[0x1090,0x8000],[0x12A0,0]])word(0x800000+o+slot,n);
 word(0x7E3F28+slot,11);word(0x8014B0,0);word(0x8014B2,slot);word(0x7E43F8+slot,0);word(0x801FD0,0);
 word(0x800E90,0x1000);word(0x800E38,0);word(0x800CC4,0);
 if(s.id===0x229)for(const [o,n]of [[0x2020,64],[0x2040,8],[0x2060,32],[0x2080,256],[0x20C0,32],[0x20E0,0],[0x2100,0],[0x2140,0]])word(0x7E0000+o+14,n);
 const c8IO=notice.ioObservations,c8Wait=notice.waitObservations;
 const pcs=directionBodyPCs(s,v),first=pcs.findIndex(pc=>{const i=s.instructions.find(i=>i.pc===pc);return i.opcode===0x58&&i.operand===0x9F;});
 return {...f,directionPCs:pcs,maxHandlers:first<0?pcs.length:first+1,maxWork:1000000,maxOutputBytes:1000000,
  ioMode:'record-requests',ioObservations:menuRecords([]),waitMode:'record-observations',waitObservations:menuRecords([]),
  inputMode:'record-observations',inputObservations:menuRecords([]),audioResumeAtCountdown:1,audioResumeObservations:audio.ioObservations,
  c8ResumeObservations:{ioObservations:c8IO,waitObservations:c8Wait}};
}
