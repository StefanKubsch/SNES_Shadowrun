import {taskMenuFixture,menuRecords,menuCursorRead,menuTextReads,menuTextWaits,menuCounterRead,menuAudioReads} from './task-native-menu-fixtures.mjs';
import {taskRenderFixture} from './task-native-render-fixtures.mjs';import {taskRenderComposeFixture} from './task-native-render-compose-fixtures.mjs';
import {taskSelectionFixture} from './task-native-selection-roots-fixtures.mjs';import {taskLeafFixture} from './task-native-leaf-fixtures.mjs';
import {taskNativeOpcodeFixture} from './task-native-opcode-fixtures.mjs';import {modalSpecs,modalTable} from './task-native-modal-specs.mjs';
import {sampleWord} from './render-f130-fixtures.mjs';
export function taskModalFixture(id,{s=0xAFF,held=0x2000,quantity=8,low=10,high=0,pointer=0x400,value=0xBEEF,selector=0x199,...v}={}){
 const spec=modalSpecs.find(s=>s.id===id);let f;
 if(id===0x72){
  const menu=taskMenuFixture(0x80A6C7,{s,held,index:4,width:12}),render=taskRenderFixture({s,cursor:2,products:[0],waitF6:[0],waitF8:[0]}),
   remove=taskRenderComposeFixture('FA3E',{s,index:4,last:2,flags:[0,1],wait:[0]});
  f=menu;for(const source of [remove,render,menu]){const snapshot=source.data.snapshot();for(const [a,n]of snapshot.bytes)f.data.seed(a,[n]);}
  const word=(a,n)=>sampleWord(f.data,a,n);word(0,1);word(2,12);word(0x800204,2);word(0x800228,1);word(0x80022A,0);word(0x8001F6,0);word(0x8001F8,0);
  f.data.seed(modalTable.start,Buffer.from(modalTable.hex,'hex'));for(const token of [0x714D,0x7150])f.data.seed(0x9D0000+(token|0x8000),[0x40,0]);
  f.ioObservations=menuRecords([{pc:0x80FA01,address:0x802134,width:2,value:0},
   ...Array.from({length:4},()=>[menuCursorRead(),...menuTextReads()]).flat(),...(held&0x2000?[]:menuAudioReads())]);
  f.waitObservations=menuRecords([{pc:0x81ACBD,address:0x8001F6,width:2,value:0},{pc:0x81ACAF,address:0x8001F8,width:2,value:0},
   ...menuTextWaits(),...menuTextWaits(),...menuTextWaits(),menuCounterRead(1),...menuTextWaits(),{pc:0x81ACAF,address:0x8001F8,width:2,value:0}]);
  f.inputObservations=menuRecords(Array.from({length:2},()=>({pc:0x809E1A,address:0x8001CA,width:2,value:held})));
 }else if(id===0xD7){f=taskSelectionFixture(0x9A,{s,selector});f.ioObservations=menuRecords(f.ioObservations.slice(1));f.waitObservations=menuRecords(f.waitObservations.slice(1));
 }else{f=taskLeafFixture(spec.entry,{s,savedOuterS:s});const word=(a,n)=>sampleWord(f.data,a,n);
  if(id===0xBF){word(0,quantity);word(0x7E3C0D,low);word(0x7E3C0F,high);}else{word(0,16);word(2,value);word(0x8DB030,pointer);}
  f.ioObservations=menuRecords([]);f.waitObservations=menuRecords([]);
 }
 return {...f,entry:spec.entry,context:Object.freeze({...f.context,s,d:0,bank:0x80,status:4,programBank:0x80,pc:spec.entry&65535}),
  inputMode:'record-observations',inputObservations:f.inputObservations??menuRecords([]),ioMode:'record-requests',waitMode:'record-observations',maxWork:1000000,maxOutputBytes:1000000,...v};
}
export function modalOpcodeFixture(id,v={}){const spec=modalSpecs.find(s=>s.id===id),f=taskNativeOpcodeFixture(spec),source=taskModalFixture(id,v);
 for(const [a,n]of source.data.snapshot().bytes)f.data.seed(a,[n]);const word=(a,n)=>sampleWord(f.data,a,n);
 for(const [a,n]of [[0x700,0xC20A],[0x8001F2,0x6FF],[0x800250,16],[0x800262,0x600],[0x801204,id|0x1400],[0x600,0x1200],[0x601,0x8012],[0x603,4],[0x607,0x3F0],[0x609,id]])word(a,n);
 for(const [n,argument]of (id===0x72?[1,12]:id===0xBF?[v.quantity??8]:id===0x74?[16,v.value??0xBEEF]:[v.selector??0x199]).entries())word(0x3F1+2*n,argument);
 return {...f,context:Object.freeze({...f.context,d:0x600}),maxWork:source.maxWork,maxOutputBytes:source.maxOutputBytes,ioMode:source.ioMode,ioObservations:source.ioObservations,
  waitMode:source.waitMode,waitObservations:source.waitObservations,inputMode:source.inputMode,inputObservations:source.inputObservations};}
