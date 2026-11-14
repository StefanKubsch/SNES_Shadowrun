import {taskFEC1Fixture} from './task-native-fec1-fixtures.mjs';
import {sampleWord} from './render-f130-fixtures.mjs';

// Named original paths only. Geometry, record/caller bytes and future entries
// are synthetic; no Script52, device, time or scheduler is generated here.
export function recordLifecycleCases(s){
 if(s.id===0x224)return [false,true].flatMap(selectionEqual=>[false,true].map(actionEqual=>({name:`selection-${selectionEqual}-action-${actionEqual}`,selectionEqual,actionEqual})));
 if(s.id===0x25B)return [0,1,2,0x80,0xFF].flatMap(flag=>[530,531].map(text=>({name:`flag-${flag}-text-${text}`,flag,text,args:[16,0xCAFF,text,0xAB02]})));
 if(s.id===0x2C6)return [0,1,0x40,0xFF].flatMap(flag=>[false,true].map(equal=>({name:`flag-${flag}-equal-${equal}`,flag,selectionEqual:equal,actionEqual:equal})));
 if(s.id===0x35D)return [0,0xA5,0xFF].map(localHigh=>({name:`local-high-${localHigh}`,localHigh}));
 return [false,true].flatMap(selectionEqual=>[false,true].map(actionEqual=>({name:`selection-${selectionEqual}-action-${actionEqual}`,selectionEqual,actionEqual})));
}
export function recordLifecyclePCs(s,v={}){
 if(s.id===0x25B)return [0,2,4,6,8,9,11,13,14,15,...((v.flag??0)&2?[18,21,23]:[26,28,29,31,33]),35,37,39,40,42,44,46,48,50,52,54,55,57,58];
 if(s.id===0x2C6)return [0,2,3,5,7,8,9,...((v.flag??0)&1?[12]:s.instructions.filter(i=>i.pc>=13).map(i=>i.pc))];
 return s.instructions.map(i=>i.pc);
}
export function expandRecordLifecycleFixture(s,v,f){
 const word=(a,n)=>sampleWord(f.data,a,n),slot=v.slot??16;
 if(s.c8Observations){
  const body=f.data.snapshot().bytes,notice=taskFEC1Fixture({s:0xAFF});
  for(const [a,n]of notice.data.snapshot().bytes)f.data.seed(a,[n]);
  for(const [a,n]of body)f.data.seed(a,[n]);
  const allocation=s.id===0x25B?8:11;
  for(const [o,n]of [[0x2020,64],[0x2040,8],[0x2060,32],[0x2080,256],[0x20C0,32],[0x20E0,0],[0x2100,0],[0x2140,0]])word(0x7E0000+o+allocation,n);
  f={...f,ioMode:notice.ioMode,waitMode:notice.waitMode,
   ioObservations:s.id===0x25B?notice.ioObservations:Object.freeze([]),
   waitObservations:s.id===0x25B?Object.freeze([...notice.waitObservations,Object.freeze({pc:0x81B0A5,address:0x7E1C76,width:2,value:6})]):Object.freeze([]),
   ...(s.id===0x3A6?{c8ResumeObservations:{ioObservations:notice.ioObservations,waitObservations:notice.waitObservations}}:{}),
   ...(s.id===0x25B?{inputMode:'record-observations',inputObservations:Object.freeze([Object.freeze({pc:0x809E1A,address:0x8001CA,width:2,value:0x40})])}:{}),
  };
 }
 for(const r of s.romReads)word(r.address,r.value);
 word(0x800,v.args?.[0]??slot);
 if(s.id===0x25B){for(const [n,arg]of (v.args??[slot,0xCAFF,530,2]).entries())word(0x800+2*n,arg);}
 word(0x8013A8+slot,0x4000);word(0x7E4001,0xAB00|(v.flag??0));word(0x7E4003,0xCAFE);
 for(const [o,n]of [[0xE28,12],[0xE80,20],[0xED8,28],[0x1458,0xBEEF],[0x1400,0x1234],[0x150A,0x3456],
  [0x12A0,0],[0x1198,v.actionEqual?4:0],[0x1038,v.selectionEqual?2:65535],[0x10E8,1],[0x11F0,0xAB31],[0x1090,0x8000]])word(0x800000+o+slot,n);
 word(0x7E3F28+slot,11);word(0x8014B0,0);word(0x8014B2,slot);word(0x7E43F8+slot,0);word(0x801FD0,0);
 word(0x7E3C0D,0);word(0x7E3C0F,0);
 word(0x800CC2,0x2345);f.data.seed(0xF3,[0,0x90,0x8D]);
 if(s.id===0x3A6){word(0x801038+slot,v.selectionEqual?0:65535);word(0x801198+slot,v.actionEqual?0:1);}
 if(s.id===0x224){word(0x801038+slot,v.selectionEqual?0:65535);word(0x801198+slot,v.actionEqual?7:0);}
 if([0x224,0x2C6,0x3A6].includes(s.id)){
  const base=s.romReads.find(r=>r.address===0x8CEDA0)?.value;
  const record=s.romReads.find(r=>r.address===0x8C0000+base+(s.id===0x2C6?4:0))?.value;
  if(record!==undefined)word(0x801090+slot,record+8);
 }
 if(s.id===0x35D){
  word(0x7E3F7E,65535);word(0x8003D2,0xC00);word(0x8003D4,0);word(0x80024E,4);word(0x800316,65535);word(0x80024C,2);
  f.data.seed(0x615,[v.localHigh??0xA5]);
 }
 if(s.id===0x25B){for(const [a,n]of [[0x7E1C76,5],[0x8001CA,0],[0x8001CC,0],[0x8001CE,0]])word(a,n);}
 const pcs=recordLifecyclePCs(s,v),wait=pcs.findIndex(pc=>{const i=s.instructions.find(i=>i.pc===pc);return i.opcode===0x58&&i.operand===0x9F;});
 return {...f,maxHandlers:wait<0?pcs.length:wait+1,maxWork:1000000,maxOutputBytes:1000000};
}
