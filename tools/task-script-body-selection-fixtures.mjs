import {taskSelectionFixture,selectionRecords} from './task-native-selection-roots-fixtures.mjs';
import {sampleWord} from './render-f130-fixtures.mjs';
export const selectionBodyCases=s=>s.id===0xF8?[
 {name:'original-token19A-zero-signed',state18:1,state05:1,state19:0,flag:0},
 {name:'original-token199-negative-one',state18:1,state05:1,state19:255,flag:0},
 {name:'original-token19A-record-gate',state18:0,state05:1,state19:255,flag:1},
 {name:'original-token199-record-bit0-clear',state18:0,state05:1,state19:255,flag:2},
 {name:'original-token19A-state05-zero',state18:1,state05:0,state19:255,flag:0},
 {name:'original-token19A-negative-two',state18:1,state05:1,state19:254,flag:0}]:
 [0,2,4,-1].flatMap(match=>[[0,6],[8,0]].map(([cell,base])=>({name:`match-${match}-cell-${cell}`,match,cell,base,event:match===0?0x800:1})));
export function expandSelectionBodyFixture(s,v,f){const body=f.data.snapshot().bytes,source=taskSelectionFixture(s.id===0xF8?0x9A:0x1A,v),word=(a,n)=>sampleWord(f.data,a,n);
 for(const [a,n]of source.data.snapshot().bytes)f.data.seed(a,[n]);for(const [a,n]of body)f.data.seed(a,[n]);
 for(const r of s.romReads)word(r.address,r.value);
 if(s.id===0xF8){word(0x7E3C18,0xAB00|v.state18);word(0x7E3C05,0xCD00|v.state05);word(0x7E3C19,0xEF00|v.state19);
  const pointer=s.romReads.find(r=>r.address===0x8DC5E4)?.value??0x5000;word(0x7E0000+pointer+1,v.flag);}
 else{word(0x800,16);word(0x802,0xBEEF);word(0x801038+16,65535);word(0x801198+16,65535);
  for(const [offset,n]of [[0x10E8,1],[0x11F0,0xAB31],[0x1090,0x8000],[0x12A0,0],[0x1458,0],[0x1400,0x8000]])word(0x800000+offset+16,n);
  word(0x7E3F38,11);word(0x800314,2);}
 return {...f,maxHandlers:s.id===0xF8?(v.state19===255&&v.state05!==0&&(v.state18!==0||(v.flag&1)===0)?20:21):9,
  maxWork:1000000,maxOutputBytes:1000000,ioMode:'record-requests',ioObservations:s.id===0xF8?source.ioObservations:selectionRecords([]),
  waitMode:'record-observations',waitObservations:s.id===0xF8?source.waitObservations:selectionRecords([]),inputMode:'record-observations',inputObservations:selectionRecords([])};
}
