import {scriptBodySpecs} from '../proof/task/script-body-specs.mjs';
import {scriptBodyFixture,bodyWord} from './task-script-body-fixtures.mjs';
import {taskFEC1Fixture} from './task-native-fec1-fixtures.mjs';
import {sampleWord} from './render-f130-fixtures.mjs';
import {menuRecords} from './task-native-menu-fixtures.mjs';
import {renderAddress} from '../src/render/data.mjs';
import {propertyParentIO,propertyParentWait} from './task-script-body-child-property-observations.mjs';
export const propertyParentCalled=v=>v.index===14||v.property!==2226;
export const propertyParentSelector=v=>propertyParentCalled(v)?528:529;
export function propertyParentPCs(v){return propertyParentCalled(v)?
 [0,2,4,7,9,33,36,39,41,43,45,48,49,51,53,55,57,59,61]:
 [0,2,4,7,9,12,14,17,18,20,22,24,26,28,30,61];}
export function propertyParentCases(){const cases=[{name:'equal',index:16,property:2226},
 {name:'different',index:16,property:0},{name:'full-property-high',index:16,property:0x18B2},
 {name:'odd-record',index:17,property:0},{name:'full-word-record',index:0x1001,property:0},
 {name:'max-word-record',index:65535,property:0},{name:'original-null-record',index:14,property:null}];
 return cases.flatMap(v=>[false,true].flatMap(repeated=>[0x800,0x400].map(heap=>({...v,repeated,heap,
  name:v.name+'-'+(repeated?'repeat':'ready')+'-heap-'+heap.toString(16)}))));}
export function expandPropertyChildFixture(s,v,f){
 const base=f.data.snapshot().bytes,audio=scriptBodyFixture(scriptBodySpecs.find(s=>s.id===0x4B)),notice=taskFEC1Fixture({s:0xAFF});
 for(const source of [audio,notice])for(const [a,n]of source.data.snapshot().bytes)f.data.seed(a,[n]);
 for(const [a,n]of base)f.data.seed(a,[n]);const word=(a,n)=>sampleWord(f.data,a,n);
 for(const [a,n]of [[0x800,v.index],[0x802,0xBEEF],[0x8003D2,v.heap],[0x8003D4,0],[0x80024E,4],[0x800316,65535],
  [0x800250,2],[0x800254,0x600],[0x80024C,2],[0x800374,65535],[0x800314,65535],[0x800BA4,0],[0x8002B4,0],[0xB06,0x91D0],
  [0x7E1C76,5],[0x8001CA,0],[0x8001CC,0],[0x8001CE,0]])word(a,n);
 f.data.seed(0x7E2F37,[0]);
 for(const fieldIndex of [5,6,14])for(const [field,value]of [[0x2020,64],[0x2040,8],[0x2060,32],[0x2080,256],
  [0x20A0,256],[0x20C0,32],[0x20E0,0],[0x2100,0],[0x2120,64],[0x2140,0]])word(0x7E0000+field+fieldIndex,value);
 for(const r of s.romReads)word(r.address,r.value);
 const pointer=s.romReads.find(r=>r.address===0x8DB020+v.index)?.value;
 if(pointer)word(0x7E0003+pointer,v.property);
 const selector=propertyParentSelector(v),io=menuRecords(propertyParentIO[selector]??[]),
  wait=menuRecords([...(propertyParentWait[selector]??[]),...(v.repeated?[5,6,6,7]:[6]).map(value=>({pc:0x81B0A5,address:0x7E1C76,width:2,value}))]),
  input=menuRecords((v.repeated?[0,0x40]:[0x40]).map(value=>({pc:0x809E1A,address:0x8001CA,width:2,value}))),called=propertyParentCalled(v);
 return {...f,entry:0x80C1CA,context:Object.freeze({...f.context,pc:0xC1CA,s:0xB05,d:0,bank:0x80}),protectedStackBytes:[0x7E0B06,0x7E0B07],
  maxHandlers:called?6:16,parentSuffixHandlers:13,maxWork:2000000,maxOutputBytes:2000000,
  ioMode:'record-requests',ioObservations:called?menuRecords([]):io,
  waitMode:'record-observations',waitObservations:called?menuRecords([]):wait,
  inputMode:'record-observations',inputObservations:called?menuRecords([]):input,
  parentSuffixIO:io,parentSuffixWait:wait,parentSuffixInput:input,childAudioObservations:audio.audioResumeObservations};
}
export function propertyParentProbeDetails(s,v,f){return {parent_record_index:v.index,parent_initial_property:v.property,
 parent_record_pointer:s.romReads.find(r=>r.address===0x8DB020+v.index).value,parent_local_word:bodyWord(f.data,0x613),
 parent_called_child:propertyParentCalled(v),parent_text_selector:propertyParentSelector(v),parent_repeated:v.repeated};}
export function propertyParentSegmentDetails(p){
 const records=[];
 for(let n=0;n<p.accesses.length;n++)if(p.accesses[n].kind==='write'&&p.accesses[n].label==='saved-ID-low'){
  const id=p.accesses[n].value,next=p.accesses.findIndex((a,k)=>k>n&&a.kind==='write'&&a.label==='saved-ID-low'),
   accesses=p.accesses.slice(n,next<0?undefined:next),args=accesses.filter(a=>a.kind==='write'&&a.label.startsWith('native-argument-workspace-'));
  if(![0x42,0x74,0xC8,0xA3].includes(id))continue;
  records.push({id,arguments:args.filter((_,k)=>k%2===0).map((a,k)=>a.value|(args[2*k+1].value<<8)),
   ...(id===0x74?{property_writes:accesses.filter(a=>a.kind==='write'&&a.label.startsWith('text-root-WORD-')).map(a=>[a.address,a.value])}:{})});
 }
 const local=p.accesses.find(a=>a.kind==='write'&&a.label==='local-WORD-low');
 return {parent_local_write_address:local?renderAddress(local.address):null,
  parent_native_arguments:records,parent_getter_results:p.accesses.flatMap((a,n)=>a.kind==='write'&&a.label==='resume-result-PHA-low'?
  [a.value|(p.accesses[n-1].value<<8)]:[])};
}
