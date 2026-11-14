import {scriptBodySpecs} from '../proof/task/script-body-specs.mjs';
import {scriptBodyFixture,bodyWord} from './task-script-body-fixtures.mjs';
import {taskFEC1Fixture} from './task-native-fec1-fixtures.mjs';
import {taskRandomFixture,randomRecords} from './task-native-random-fixtures.mjs';
import {sampleWord} from './render-f130-fixtures.mjs';import {menuRecords} from './task-native-menu-fixtures.mjs';
import {parentWaitTextIO,parentWaitTextWait} from './task-script-body-child-parent-wait-observations.mjs';
import {renderAddress} from '../src/render/data.mjs';
// OriginalC58D[0]=1A, actual DP00Low = 1A XOR observed counter BYTE.
export const parentWaitChoice=v=>(26^v.counterLow)&3;
export const parentWaitText=(s,v)=>s.id===0x15C?485+Number(parentWaitChoice(v)>1):487+parentWaitChoice(v);
export const parentWaitReward=(s,v)=>s.id===0x15C?(parentWaitChoice(v)<=1?10:20):30+10*parentWaitChoice(v);
export function parentWaitCases(){const variants=[0,1,2,3].map((counterLow,n)=>({name:'counter-'+counterLow,counterLow,input:[0xAB10,0xFF11,0x80FE,65535][n],low:5000,high:0}));
 variants.push({name:'currency-low-carry',counterLow:3,input:0xAB10,low:65535,high:0},
  {name:'currency-high-boundary',counterLow:2,input:0xFF11,low:65535,high:32767},
  {name:'currency-high-wrap-saturation',counterLow:0,input:0x80FE,low:65535,high:65535});
 return variants.flatMap(v=>[false,true].flatMap(blocked=>[0x800,0x400].map(heap=>({...v,blocked,heap,
  name:v.name+'-'+(blocked?'blocked-then-event':'event')+'-heap-'+heap.toString(16)}))));}
// Independent original branch predicates; never executes a native/bytecode.
export function parentWaitPCs(s,v){const choice=parentWaitChoice(v),branches=s.id===0x15C?{34:choice>1,75:choice>1}:
 s.parentWaitAliasChild?{33:v.alias||choice!==0,49:v.alias||choice!==1,65:v.alias||choice!==2,
  106:v.alias||choice!==1,121:!v.alias&&choice!==1,136:choice!==2}:
 {33:choice!==0,49:choice!==1,65:choice!==2,105:choice!==0,120:choice!==1,135:choice!==2};
 const pcs=[];let pc=0;for(let n=0;n<=s.instructions.length;n++){
  const i=s.instructions.find(i=>i.pc===pc);if(!i)throw Error('Unproved expected parentwait PC');pcs.push(pc);if(i.opcode===0x56)return pcs;
  if(i.opcode===0x44){if(typeof branches[pc]!=='boolean')throw Error('Unproved parentwait branch');pc=branches[pc]?i.operand:pc+i.length;}
  else pc=i.opcode===0x48?i.operand:pc+i.length;
 }throw Error('Unbounded parentwait fixture');}
export function expandParentWaitChildFixture(s,v,f){const base=f.data.snapshot().bytes,
  audio=scriptBodyFixture(scriptBodySpecs.find(s=>s.id===0x4B)),d2=scriptBodyFixture(scriptBodySpecs.find(s=>s.id===0x31),{selectionEqual:false,actionEqual:false,slot:v.input&255}),
  notice=taskFEC1Fixture({s:0xAFF}),random=taskRandomFixture(0x80C560,{mixLow:v.counterLow,mixHigh:26,values:[[123,26,1]]});
 for(const source of [audio,d2,notice,random])for(const [a,n]of source.data.snapshot().bytes)f.data.seed(a,[n]);
 for(const [a,n]of base)f.data.seed(a,[n]);const word=(a,n)=>sampleWord(f.data,a,n),slot=v.input&255;
 for(const [a,n]of [[0x800,v.input],[0x802,0xBEEF],[0x8003D2,v.heap],[0x8003D4,0],[0x80024E,4],[0x800316,65535],
  [0x800250,2],[0x800254,0x600],[0x80024C,2],[0x800374,65535],[0x800314,65535],[0x800BA4,0],[0x8002B4,0],[0xB06,0x91D0],
  [0x7E3C0D,v.low],[0x7E3C0F,v.high],[0x801038+slot,65535],[0x801198+slot,1],
  [0x8012A0+slot,0],[0x8014B0,0],[0x8014B2,slot],[0x7E43F8+slot,0]])word(a,n);
 f.data.seed(0x801CE8,[0]);f.data.seed(0x7E1C76,[v.counterLow,26]);f.data.seed(0x7E2F37,[0]);
 for(const fieldIndex of [2,14])for(const [field,value]of [[0x2020,64],[0x2040,8],[0x2060,32],[0x2080,256],
  [0x20A0,256],[0x20C0,32],[0x20E0,0],[0x2100,0],[0x2120,64],[0x2140,0]])word(0x7E0000+field+fieldIndex,value);
 for(const r of s.romReads)word(r.address,r.value);
 return {...f,parentWaitVariant:v,entry:0x80C1CA,context:Object.freeze({...f.context,pc:0xC1CA,s:0xB05,d:0,bank:0x80}),protectedStackBytes:[0x7E0B06,0x7E0B07],
  maxHandlers:12,maxWork:2000000,maxOutputBytes:2000000,ioMode:'record-requests',ioObservations:randomRecords([[123,26,1]]),
  waitMode:'record-observations',waitObservations:menuRecords([]),inputMode:'record-observations',inputObservations:menuRecords([]),
  parentTextIO:menuRecords(parentWaitTextIO[parentWaitText(s,v)]??[]),parentTextWait:menuRecords(parentWaitTextWait[parentWaitText(s,v)]??[]),
  parentSuffixHandlers:parentWaitPCs(s,v).length-parentWaitPCs(s,v).indexOf(s.instructions.find(i=>i.opcode===0x52).pc)-1,
  childAudioObservations:audio.audioResumeObservations};}
export function parentWaitProbeDetails(s,v,f){return {parent_input_word:v.input,parent_counter_low:v.counterLow,
 parent_choice_local:bodyWord(f.data,0x614),parent_text_local:bodyWord(f.data,0x616),parent_initial_low:v.low,parent_initial_high:v.high,
 parent_currency_low:bodyWord(f.data,0x7E3C0D),parent_currency_high:bodyWord(f.data,0x7E3C0F),parent_event_blocked:v.blocked,
 parent_final_entity_count:bodyWord(f.data,0x8012A0+(v.input&255))};}
export function parentWaitSegmentDetails(p){const calls=[];
 for(let n=0;n<p.accesses.length;n++)if(p.accesses[n].kind==='write'&&p.accesses[n].label==='saved-ID-low'){
  const id=p.accesses[n].value;if(![0x63,0xD2,0x9F,0x49,0xC8,0x99,0xB9,0x7B].includes(id))continue;
  const next=p.accesses.findIndex((a,k)=>k>n&&a.kind==='write'&&a.label==='saved-ID-low'),accesses=p.accesses.slice(n,next<0?undefined:next),
   args=accesses.filter(a=>a.kind==='write'&&a.label.startsWith('native-argument-workspace-'));
  calls.push({id,arguments:args.filter((_,k)=>k%2===0).map((a,k)=>a.value|(args[k*2+1].value<<8))});
 }
 const initial=p.accesses.some(a=>a.kind==='write'&&a.label==='local-BYTE'),argument=initial?p.accesses.findIndex(a=>a.kind==='read'&&a.label==='local-value-PLA-low'):-1;
 return {parent_native_arguments:calls,parent_argument_word:argument<0?null:p.accesses[argument].value|(p.accesses[argument+1].value<<8),
  ...(p.scriptId===0x28C?{parent_accumulator_reads:p.accesses.flatMap((a,n)=>a.kind==='read'&&a.address===0x7E3C11&&a.label==='leaf-long-WORD-low'?
   [[a.address,a.value|(p.accesses[n+1].value<<8)]]:[]),parent_accumulator_stores:p.accesses.flatMap((a,n)=>a.kind==='write'&&a.address===0x7E3C11&&a.label==='leaf-long-WORD-low'?
   [[a.address,a.value|(p.accesses[n+1].value<<8)]]:[]),parent_argument_words:p.accesses.flatMap((a,n)=>a.kind==='read'&&a.label==='local-value-PLA-low'?[a.value|(p.accesses[n+1].value<<8)]:[])}:{}),
  ...([0x15F,0x164].includes(p.scriptId)?{parent_operand_s_read:p.accesses.flatMap((a,n)=>a.kind==='read'&&a.label==='visit-F378-operand-S-low'?[a.value|(p.accesses[n+1].value<<8)]:[]),
   parent_alias_writes:p.accesses.filter(a=>a.kind==='write'&&[0x7E0613,0x7E0614,0x7E0615,0x7E0616,0x7E0617,0x7E060A].includes(renderAddress(a.address))).map(a=>[renderAddress(a.address),a.value,a.label]),
   parent_equalities:p.steps.flatMap((n,k)=>n.opcode===0xAA?[{pc:p.bodyPCs[k],left:n.left,right:n.right,result:n.result}]:[])}:{}),
  parent_result_phas:p.accesses.flatMap((a,n)=>a.kind==='write'&&a.label==='resume-result-PHA-low'?[a.value|(p.accesses[n-1].value<<8)]:[]),
  parent_counter_bytes:p.accesses.filter(a=>a.kind==='read'&&[0x7E1C76,0x7E1C77].includes(a.address)&&a.label==='text-root-BYTE').map(a=>[a.address,a.value]),
  parent_currency_reads:p.accesses.flatMap((a,n)=>a.kind==='read'&&[0x7E3C0D,0x7E3C0F].includes(a.address)&&a.label==='leaf-long-WORD-low'?
   [[a.address,a.value|(p.accesses[n+1].value<<8)]]:[])};
}
