import {scriptBodySpecs} from '../proof/task/script-body-specs.mjs';import {scriptBodyFixture,bodyWord} from './task-script-body-fixtures.mjs';
import {sampleWord} from './render-f130-fixtures.mjs';import {menuRecords} from './task-native-menu-fixtures.mjs';
import {modalBodyPCs} from './task-script-body-modal-fixtures.mjs';
export function childMenuCases(s){const price=s.instructions[1].operand;
 const cases=[{name:'confirmed-funded',confirm:true,low:5000},{name:'cancel-funded',confirm:false,low:5000},
  {name:'confirmed-no-funds',confirm:true,low:0},{name:'confirmed-borrow',confirm:true,low:0,high:1},
  {name:'one-below-price',confirm:true,low:price-1},{name:'exact-price',confirm:true,low:price},{name:'one-above-price',confirm:true,low:price+1},
  {name:'full-record-byte-flags',confirm:true,low:5000,flags:0x41}];
 return cases.flatMap(v=>[0x800,0x400].map(heap=>({...v,price,heap,name:v.name+'-heap-'+heap.toString(16)})));
}
export function expandMenuChildFixture(s,v,f){
 const base=f.data.snapshot().bytes,child=scriptBodySpecs.find(s=>s.id===0xC8),source=scriptBodyFixture(child,v);
 for(const [a,n]of source.data.snapshot().bytes)f.data.seed(a,[n]);for(const [a,n]of base)f.data.seed(a,[n]);
 const word=(a,n)=>sampleWord(f.data,a,n);
 for(const [a,n]of [[0x800,0xBEEF],[0x8003D2,v.heap],[0x8003D4,0],[0x80024E,4],[0x800316,65535],
  [0x800250,2],[0x800254,0x600],[0x80024C,2],[0x800374,65535],[0x800314,65535],[0x800BA4,0],[0x8002B4,0],[0xB06,0x91D0]])word(a,n);
 for(const r of s.romReads)word(r.address,r.value);
 return {...f,entry:0x80C1CA,context:Object.freeze({...f.context,pc:0xC1CA,s:0xB05,d:0,bank:0x80}),protectedStackBytes:[0x7E0B06,0x7E0B07],
  maxHandlers:4,maxWork:2000000,maxOutputBytes:2000000,ioMode:'record-requests',ioObservations:menuRecords([]),
  waitMode:'record-observations',waitObservations:menuRecords([]),inputMode:'record-observations',inputObservations:menuRecords([]),
  childIO:source.ioObservations,childWait:source.waitObservations,
  childInput:source.inputObservations,childHandlers:modalBodyPCs(child,v).length};
}
export function childMenuProbeDetails(s,v,f){const child=scriptBodySpecs.find(s=>s.id===0xC8),record=s.instructions[2].operand,
 pointer=child.romReads.find(r=>r.address===0x8DB020+record)?.value;
 if(!Number.isInteger(pointer))throw Error('Missing original child record pointer');
 return {child_argument_words:[record,s.instructions[1].operand,s.instructions[0].operand],
  child_local_words:[0x3E9,0x3EB,0x3ED].map(a=>bodyWord(f.data,a)),child_confirm:v.confirm,child_initial_low:v.low,
  child_initial_high:v.high??0,child_currency_low:bodyWord(f.data,0x7E3C0D),child_currency_high:bodyWord(f.data,0x7E3C0F),
  child_record_pointer:pointer,child_record_flag:f.data.readByte(0x7E0001+pointer).value};
}
