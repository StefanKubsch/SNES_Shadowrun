import {task8E36Fixture,seed8E36Fixture,freeze8E36} from './task-native-8e36-fixtures.mjs';
import {taskAudioFixture} from './task-native-audio-fixtures.mjs';
import {sampleWord} from './render-f130-fixtures.mjs';
import {randomRecords} from './task-native-random-fixtures.mjs';
export const blastBodyCases=s=>[
 {name:'no-nearby-slot',active:null},
 {name:'nearby-normal-counter',flags:0x8000},
 {name:'damage-original-record',flags:0xA000},
 {name:'strict-x60-boundary',flags:0xA000,dx:96},
 {name:'damage-original-task-fallback',flags:0xA000,health:1},
 {name:'negative-task-WORD-store',flags:0xA000,record:0,task:65535}
];
export function expandBlastBodyFixture(s,v,f){
 const body=f.data.snapshot().bytes,random=task8E36Fixture({active:v.active===null?null:0x20,center:0x10,limit:s.id===0x136?8:15,...v});
 random.ioObservations=v.flags&0x2000&&Math.abs(v.dx??0)<96?randomRecords([[0x7B,0,0]]):freeze8E36([]);
 for(const [a,n]of random.data.snapshot().bytes)f.data.seed(a,[n]);
 const audio=taskAudioFixture(0x80C46E,{s:0xAFF,sound:10,voice:3});
 if(s.id===0x1E8)for(const [a,n]of audio.data.snapshot().bytes)f.data.seed(a,[n]);
 for(const [a,n]of body)f.data.seed(a,[n]);
 seed8E36Fixture(f,{active:v.active===null?null:0x20,center:0x10,limit:s.id===0x136?8:15,...v});
 const word=(a,n)=>sampleWord(f.data,a,n);for(const r of s.romReads)word(r.address,r.value);
 f.data.seed(0x7E1C76,[0x1A,0x1A]);
 word(0x800,16);word(0x802,0xBEEF);
 for(const [o,n]of [[0x1038,0],[0x1198,0],[0x10E8,1],[0x11F0,0xAB31],[0x1090,0x8000],[0x1458,0],
  [0x1400,0x8000],[0x12A0,0],[0x1350,65535]])word(0x800000+o+16,n);
 word(0x7E3F38,11);word(0x8014B0,0);word(0x8014B2,16);word(0x7E43F8+16,0);word(0x801FD0,0);word(0x800CC4,0);
 word(0x800314,2);word(0x80024E,4);word(0x80024C,2);word(0x800316,6);word(0x800318,8);word(0x80031A,65535);
 // NativeA9's five real pops reuse the returned coordinate WORDs and the
 // original136 callback0382; no child visit is inferred from the append.
 return {...f,maxWork:1000000,maxOutputBytes:1000000,ioMode:'record-requests',ioObservations:s.id===0x136?freeze8E36([]):
  freeze8E36([...random.ioObservations,...audio.ioObservations]),waitMode:'record-observations',waitObservations:freeze8E36([]),
  inputMode:'record-observations',inputObservations:freeze8E36([]),
  blastResumeObservations:{ioObservations:random.ioObservations,waitObservations:freeze8E36([]),inputObservations:freeze8E36([])}};
}
