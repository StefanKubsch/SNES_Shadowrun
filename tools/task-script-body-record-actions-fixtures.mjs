import {taskActionsFixture} from './task-native-actions-fixtures.mjs';
import {taskFEC1Fixture} from './task-native-fec1-fixtures.mjs';
import {menuRecords,menuCursorRead,menuTextReads,menuTextWaits,menuCounterRead,menuAudioReads} from './task-native-menu-fixtures.mjs';
import {sampleWord} from './render-f130-fixtures.mjs';
export const recordActionsCases=()=>[
 {name:'null-record',pointer:0},{name:'negative-record',record:0x8000},{name:'negative-full-high',record:0xFFFF},
 {name:'cancel',held:0x2000,selected:0},{name:'base-confirm',held:0x40,selected:0},
 {name:'first-action',held:0x20,selected:0x80},{name:'second-action',held:0,selected:0x100}
];
export function recordActionsPCs(s,v={}){
 const prefix=[0,2,3,5],last=[87,88,90];
 if(v.pointer===0||(v.record??0)&0x8000)return [...prefix,...last];
 const menu=[...prefix,8,11,13,14,16,18,19,20];
 if(v.selected===0x80)return [...menu,23,25,27,30,32,34,36,38,40,...last];
 const next=[...menu,43,45,48,49,50];
 return v.selected===0x100?[...next,53,55,57,58,60,61,63,65,68,70,72,73,75,77,79,82,84,85,...last]:[...next,...last];
}
export function expandRecordActionsFixture(s,v,f){
 const word=(a,n)=>sampleWord(f.data,a,n),body=f.data.snapshot().bytes;
 const menu=taskActionsFixture(0x809BA0,{s:0xAFF,mask:0x180,held:v.held??0x2000}),notice=taskFEC1Fixture({s:0xAFF});
 for(const [a,n]of notice.data.snapshot().bytes)f.data.seed(a,[n]);
 for(const [a,n]of menu.data.snapshot().bytes)f.data.seed(a,[n]);
 for(const [a,n]of body)f.data.seed(a,[n]);
 for(const r of s.romReads)word(r.address,r.value);
 const hasMenu=v.pointer!==0&&!((v.record??0)&0x8000),first=v.selected===0x80,second=v.selected===0x100;
 const slot=v.slot??16;word(0x800,slot);word(0x802,0xBEEF);word(0x804,0xD00D);
 word(0x8013A8+(slot&255),v.pointer??0x4000);word(0x7E4003,v.record??0x1538);
 for(const [a,n]of [[0x8012A0+(slot&255),0],[0x8014B0,0],[0x8014B2,slot&255],[0x7E43F8+(slot&255),0],[0x801FD0,0]])word(a,n);
 word(0x7E2FC8,0xAB40);
 // Original C8 allocations2 use independently declared product samples and
 // geometry after the real menu release. Notice159/160 sources are ROM-pinned;
 // Menu and notices share individually pinned original ROM roots; mutable
 // cache, allocation and geometry remain synthetic observations.
 for(const [o,n]of [[0x2020,64],[0x2040,8],[0x2060,32],[0x2080,256],[0x20C0,32],[0x20E0,0],[0x2100,0],[0x2140,0]])word(0x7E0000+o+2,n);
 const row=()=>[menuCursorRead(),...menuTextReads()],wait=menuTextWaits;
 const navIO=[{pc:0x80FA01,address:0x802134,width:2,value:27},...Array.from({length:3},row).flat(),menuCursorRead(),...row(),...row(),...row(),...row(),...row(),...row(),...menuAudioReads()];
 const navWait=[{pc:0x81ACBD,address:0x8001F6,width:2,value:0},{pc:0x81ACAF,address:0x8001F8,width:2,value:0},
  ...Array.from({length:3},wait).flat(),...wait(),menuCounterRead(1),...wait(),...wait(),menuCounterRead(2),menuCounterRead(3),...wait(),...wait(),menuCounterRead(4),...wait(),{pc:0x81ACAF,address:0x8001F8,width:2,value:0}];
 const c8IO=[{pc:0x80FA01,address:0x802134,width:2,value:120},...notice.ioObservations],c8Wait=[{pc:0x81ACBD,address:0x8001F6,width:2,value:0},{pc:0x81ACAF,address:0x8001F8,width:2,value:0},...notice.waitObservations];
 const controls=hasMenu?(second?[0x400,0,0x400,0x40,0x40]:[v.held??0x2000,v.held??0x2000]):[];
 const pcs=recordActionsPCs(s,v),yieldAt=pcs.findIndex(pc=>s.instructions.find(i=>i.pc===pc).operand===0x9F&&s.instructions.find(i=>i.pc===pc).opcode===0x58);
 return {...f,maxHandlers:yieldAt<0?pcs.length:yieldAt+1,maxWork:1000000,maxOutputBytes:1000000,
  ioMode:'record-requests',ioObservations:menuRecords([...(hasMenu?(second?navIO:menu.ioObservations):[]),...(first?c8IO:[])]),
  waitMode:'record-observations',waitObservations:menuRecords([...(hasMenu?(second?navWait:menu.waitObservations):[]),...(first?c8Wait:[])]),
  inputMode:'record-observations',inputObservations:menuRecords(controls.map(value=>({pc:0x809E1A,address:0x8001CA,width:2,value}))),
  c8ResumeObservations:{ioObservations:menuRecords(c8IO),waitObservations:menuRecords(c8Wait)}};
}
