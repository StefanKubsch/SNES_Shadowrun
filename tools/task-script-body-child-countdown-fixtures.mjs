import {scriptBodySpecs} from '../proof/task/script-body-specs.mjs';
import {scriptBodyFixture,bodyWord} from './task-script-body-fixtures.mjs';
import {sampleWord} from './render-f130-fixtures.mjs';
import {menuRecords} from './task-native-menu-fixtures.mjs';
import {taskFEC1Fixture} from './task-native-fec1-fixtures.mjs';
import {countdownParentIO,countdownParentWait} from './task-script-body-child-countdown-observations.mjs';
import {branchCountdownParent,branchCountdownCases,countdownParentHasText,countdownParentSelector,countdownTextKey,countdownRecord,countdownParentPCs} from './task-script-child-countdown-parent-paths.mjs';
export const countdownChildIds=Object.freeze([0x6F,0xD2]);
export function countdownChildCases(s){
 if(branchCountdownParent(s))return branchCountdownCases(s);
 const cases=s.childId===0x6F?
  [0,4,0x80,0x41].map((flags,n)=>({name:'record-flags-'+flags,input:[0xAB10,0xFF11,0x80FE,65535][n],flags})):
  [{name:'target-first',input:0xAB10,nodes:0,free:0,position:0},
   {name:'linked-first',input:0xFF11,nodes:3,free:0x7FFF,position:0},
   {name:'linked-last',input:0x80FE,nodes:3,free:0xFFFE,position:2},
   {name:'zero-tail',input:65535,nodes:0,free:65535,position:0,tail:0}];
 return cases.flatMap(v=>[0x800,0x400].map(heap=>({...v,heap,name:v.name+'-heap-'+heap.toString(16)})));
}
export function expandCountdownChildFixture(s,v,f){
 const base=f.data.snapshot().bytes,child=scriptBodySpecs.find(c=>c.id===s.childId),source=scriptBodyFixture(child,{slot:v.input&255}),
  text=countdownParentHasText(s,v)?taskFEC1Fixture({s:0xAFF}):null;
 for(const fixture of [source,text].filter(Boolean))for(const [a,n]of fixture.data.snapshot().bytes)f.data.seed(a,[n]);
 for(const [a,n]of base)f.data.seed(a,[n]);
 const word=(a,n)=>sampleWord(f.data,a,n);
 for(const [a,n]of [[0x800,v.input],[0x802,0xBEEF],[0x8003D2,v.heap],[0x8003D4,0],[0x80024E,4],[0x800316,65535],
  [0x800250,2],[0x800254,0x600],[0x80024C,2],[0x800374,65535],[0x800314,65535],[0x800BA4,0],[0x8002B4,0],[0xB06,0x91D0]])word(a,n);
 // Explicit pre-entry synthetic physical stale BYTE, already used by the
 // earlier allocated Child4B fixture. No initialized original caller claim.
 f.data.seed(0x7E2F37,[0]);
 // C2 performs its actual WORD read before masking the BYTE local. The
 // following stale BYTE is independently observed before allocation.
 if(s.childId===0xD2)f.data.seed(0x7E03EA,[0xA5]);
 // Narrow pre-entry synthetic geometry for actual field8 and field14
 // accesses, including the original newline helper's retained X=14.
 if(text)for(const fieldIndex of [branchCountdownParent(s)?11:8,14])for(const [field,value]of [[0x2020,10],[0x2040,8],[0x2060,0x20],[0x2080,0x100],[0x20A0,0x100],
  [0x20C0,0x20],[0x20E0,0],[0x2100,0],[0x2120,64],[0x2140,0]])word(0x7E0000+field+fieldIndex,value);
 if(branchCountdownParent(s)){word(0x800CC2,v.globalIndex);word(0x800E28+v.globalIndex,v.xRaw);word(0x800E80+v.globalIndex,v.yRaw);
  word(0x80150A+(v.input&255),v.property);word(0x801350+(v.input&255),0xBEEF);}
 if(s.childId===0x6F){const record=countdownRecord(s),
  pointer=child.romReads.find(r=>r.address===0x8DB020+record)?.value;
  if(Number.isInteger(pointer))f.data.seed(0x7E0001+pointer,[v.flags]);
 }else{
  const slot=v.input&255,tail=v.tail??4,list=tail===0?[slot]:v.position===0?[slot,0x20,0x30]:[0x20,0x30,slot];
  word(0x8012A0+slot,v.nodes);word(0x8014B0,tail);list.forEach((n,i)=>word(0x8014B2+2*i,n));
  word(0x800D1C,v.free);word(0x800D1E,0x500);
  if(v.nodes){word(0x8012F8+slot,0x200);for(const [node,next]of [[0x200,0x300],[0x300,0x400],[0x400,65535]])word(0x801564+node,next);}
 }
 for(const r of s.romReads)word(r.address,r.value);
 return {...f,entry:0x80C1CA,context:Object.freeze({...f.context,pc:0xC1CA,s:0xB05,d:0,bank:0x80}),protectedStackBytes:[0x7E0B06,0x7E0B07],
  maxHandlers:countdownParentPCs(s,v).indexOf(s.instructions.find(i=>i.opcode===0x52).pc)+1,maxWork:2000000,maxOutputBytes:2000000,
  parentSuffixHandlers:branchCountdownParent(s)?3:1,
  ioMode:'record-requests',ioObservations:menuRecords(text?countdownParentIO[countdownTextKey(s,v)]??[]:[]),
  waitMode:'record-observations',waitObservations:menuRecords(text?countdownParentWait[countdownTextKey(s,v)]??[]:[]),
  inputMode:'record-observations',inputObservations:menuRecords([]),childIO:menuRecords([]),childWait:menuRecords([]),childInput:menuRecords([]),
  childHandlers:child.instructions.findIndex(i=>i.opcode===0x58&&i.operand===0x9F)+1,
  childRemainingHandlers:child.instructions.length-child.instructions.findIndex(i=>i.opcode===0x58&&i.operand===0x9F)-1};
}
export function countdownChildProbeDetails(s,v,f){const frame=0x3D6,slot=v.input&255;
 if(s.childId===0x6F){const record=countdownRecord(s),
  pointer=scriptBodySpecs.find(c=>c.id===0x6F).romReads.find(r=>r.address===0x8DB020+record)?.value;
  return {parent_input_word:v.input,parent_local_byte:f.data.readByte(0x613).value,child_argument_word:record,
   child_local_word:bodyWord(f.data,frame+0x13),child_record_pointer:pointer,child_initial_flags:v.flags,
   child_record_flags:f.data.readByte(0x7E0001+pointer).value,
   ...(branchCountdownParent(s)?{parent_global_index:v.globalIndex,parent_x_raw:v.xRaw,parent_y_raw:v.yRaw,parent_property:v.property,
    parent_has_text:countdownParentHasText(s,v),parent_text_selector:countdownParentHasText(s,v)?countdownParentSelector(s,v):null,
    parent_text_local:countdownParentHasText(s,v)?bodyWord(f.data,0x614):null,
    parent_property_local:countdownParentHasText(s,v)?bodyWord(f.data,0x616):null,parent_final_field:bodyWord(f.data,0x801350+(v.input&255))}:{})};
 }
 return {parent_input_word:v.input,parent_local_byte:f.data.readByte(0x613).value,child_argument_word:slot,
  child_local_byte:f.data.readByte(frame+0x13).value,child_global_word:bodyWord(f.data,0x801D6B),
  child_entity_slot:slot,child_initial_node_count:v.nodes,child_initial_free_count:v.free,child_initial_list_tail:v.tail??4,
  child_target_position:v.position,child_node_count:bodyWord(f.data,0x8012A0+slot),child_free_count:bodyWord(f.data,0x800D1C),
  child_free_head:bodyWord(f.data,0x800D1E),child_node_head:v.nodes?bodyWord(f.data,0x8012F8+slot):null,
  child_node_links:v.nodes?[0x200,0x300,0x400].map(n=>bodyWord(f.data,0x801564+n)):[],
  child_list_tail:bodyWord(f.data,0x8014B0),child_list_words:Array.from({length:(v.tail??4)===0?1:3},(_,n)=>bodyWord(f.data,0x8014B2+2*n)),
  child_released_words:[0x4240,0x4298,0x42F0,0x4348,0x43A0,0x40E0,0x3F80].map(n=>bodyWord(f.data,0x7E0000+n+slot)),
  child_released_selection:bodyWord(f.data,0x801038+slot),child_released_field:bodyWord(f.data,0x7E3F28+slot),
  child_release_flag:bodyWord(f.data,0x7E4030+slot),child_release_state:bodyWord(f.data,0x7E3FD8+slot)};
}
