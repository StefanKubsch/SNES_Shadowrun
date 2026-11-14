import {taskTextComposeFixture} from './task-native-text-compose-fixtures.mjs';
import {taskLeafFixture} from './task-native-leaf-fixtures.mjs';import {taskNativeOpcodeFixture} from './task-native-opcode-fixtures.mjs';
import {selectionRoots,directionTable} from './task-native-933a-bba0-specs.mjs';
import {sampleWord} from './render-f130-fixtures.mjs';
export const selectionRecords=values=>Object.freeze(values.map(o=>Object.freeze(o)));
export function taskSelectionFixture(id,{s=0xAFF,selector=0x199,cell=0,match=2,base=2,actor=16,...v}={}){
 const entry=id===0x9A?0x80933A:0x80BBA0;
 const f=id===0x9A?taskTextComposeFixture('FE69',{s,width:250,writeWindows:[[0x7E0000,0x7FFFFF]]}):taskLeafFixture(entry,{s,savedOuterS:s});
 const word=(a,n)=>sampleWord(f.data,a,n);
 if(id===0x9A){word(0,selector);word(0x14,2);word(0x7E20A2,0);word(0x8001F6,0);word(0x80D9B8+((selector<<1)&65535),0x10);
  f.ioObservations=selectionRecords([{pc:0x80FACD,address:0x804216,width:2,value:0},...f.ioObservations]);
  f.waitObservations=selectionRecords([{pc:0x81ACBD,address:0x8001F6,width:2,value:0},...f.waitObservations]);
 }else{
  word(0,actor);word(0x7E2DE2,cell);word(0x7E2DE6,4);word(0x8D929F+(((cell<<3)+cell+((cell>>>13)&1))&65535),base);
  word(0x80150A+actor,0x1234);for(const offset of [0,2,4])word(0x7E2DF0+offset,offset===match?0x1234:0x5678);
  f.data.seed(directionTable.start,Buffer.from(directionTable.hex,'hex'));word(0x801038+actor,2);
  word(0x801198+actor,(base+(match===2?1:match===4?-1:0))&7);word(0x8010E8+actor,1);
  f.ioObservations=selectionRecords([]);f.waitObservations=selectionRecords([]);
 }
 return {...f,entry,context:Object.freeze({...f.context,s,d:0,bank:0x80,status:4,programBank:0x80,pc:entry&65535}),
  maxWork:1000000,maxOutputBytes:1000000,ioMode:'record-requests',waitMode:'record-observations',inputMode:'record-observations',inputObservations:selectionRecords([]),...v};
}
export function selectionOpcodeFixture(id,v={}){const spec=selectionRoots.find(s=>s.id===id),f=taskNativeOpcodeFixture(spec),source=taskSelectionFixture(id,v);
 for(const [a,n]of source.data.snapshot().bytes)f.data.seed(a,[n]);const word=(a,n)=>sampleWord(f.data,a,n);
 for(const [a,n]of [[0x700,0xC20A],[0x8001F2,0x6FF],[0x800250,16],[0x800262,0x600],[0x801204,id|0x1400],[0x600,0x1200],[0x601,0x8012],[0x603,4],[0x607,0x3F0],[0x609,id]])word(a,n);
 word(0x3F1,id===0x9A?v.selector??0x199:v.actor??16);
 return {...f,context:Object.freeze({...f.context,d:0x600}),maxWork:source.maxWork,maxOutputBytes:source.maxOutputBytes,ioMode:source.ioMode,ioObservations:source.ioObservations,
  waitMode:source.waitMode,waitObservations:source.waitObservations,inputMode:source.inputMode,inputObservations:source.inputObservations};}
