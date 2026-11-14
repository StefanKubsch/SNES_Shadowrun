import {parentWaitChoice,parentWaitPCs,parentWaitText,parentWaitReward} from './task-script-body-child-parent-wait-fixtures.mjs';
import {parentAliasSelector,parentAliasReward} from './task-script-body-child-parent-alias-fixtures.mjs';
import {validateParentAliasTrace} from './task-script-child-parent-alias-evidence.mjs';
import {validateParentAddProbe} from './task-script-child-parent-add-evidence.mjs';
export function validateParentWaitChildProbe(proof,p,{equal,physicalWord}){
 if(proof.child_parent_add_contract)return validateParentAddProbe(proof,p,{equal,physicalWord});
 const c=proof.child_parent_wait_contract,aliasBody=!!proof.child_parent_alias_contract,
  s={id:proof.script_id,instructions:proof.instructions,parentWaitAliasChild:aliasBody},v={counterLow:p.parent_counter_low,alias:p.parent_alias},
  choice=parentWaitChoice(v),selector=aliasBody?parentAliasSelector(s,v):parentWaitText(s,v),reward=aliasBody?parentAliasReward(s,v):parentWaitReward(s,v),slot=p.parent_input_word&255,
  alias=aliasBody&&v.alias,releaseSlot=alias?8:slot,
  all=p.child_segments,first=all?.[0],last=all?.at(-1),callIndex=all?.findIndex(n=>n.script_child_suspended),prefix=all?.[callIndex],
  events=p.parent_event_blocked?[0,16]:[16],eventIndex=p.parent_event_blocked?5:4,
  table=proof.rom_reads.find(r=>parseInt(r.entry.replace(':',''),16)===0x80C58D+p.parent_counter_low),
  raw=(26^p.parent_counter_low)|((parseInt(table?.machine_bytes.slice(0,2),16)^26)<<8),
  prior=[0,2,4,6,7,9,10,11,12,14,16,17],second=[19,20,21,23,24,26],
  expectedPCs=parentWaitPCs(s,v),sum=p.parent_initial_low+reward,carry=sum>65535,
  saturated=carry&&p.parent_initial_high===65535,low=saturated?65535:sum&65535,high=saturated?65535:(p.parent_initial_high+Number(carry))&65535;
 const fail=message=>{throw Error('Parentwait '+message+' evidence drift');};
 if(![0x15C,0x15E,0x15F,0x164].includes(s.id)||aliasBody!==[0x15F,0x164].includes(s.id)||!c||!equal(c.parent_waits,[{pc:17,next_pc:19,mask:1,count:1},{pc:26,next_pc:28,mask:16,count:0}])
  ||!equal(c.caller_header,[5,14])||c.readiness_entry!=='80:C1CA'||c.postrun_export!=='prepareTaskScriptBodyParentPostrun'
  ||![0,1,2,3].includes(p.parent_counter_low)||!table||typeof p.parent_event_blocked!=='boolean'
  ||!Number.isInteger(p.parent_input_word)||p.parent_input_word<0||p.parent_input_word>65535
  ||p.parent_choice_local!==(alias?1:choice)||p.parent_text_local!==(alias?8:selector)||p.parent_final_entity_count!==0
  ||![p.parent_initial_low,p.parent_initial_high].every(n=>Number.isInteger(n)&&n>=0&&n<=65535)
  ||p.parent_currency_low!==low||p.parent_currency_high!==high||!equal(p.body_pcs,expectedPCs)
  ||callIndex!==eventIndex||all.length!==eventIndex+9||first.script_id!==s.id||last.script_id!==s.id
  ||all.some((n,k)=>n.segment!==k||n.io_observations_used!==n.io_records.length||n.wait_observations_used!==n.wait_records.length
   ||n.input_observations_used!==n.input_records.length)||p.child_observed_entries.length!==all.length-1)
  fail('whole original source/case/segments');
 const arg=[{id:0x63,arguments:[]},{id:0xD2,arguments:[slot,0,0]},{id:0x9F,arguments:[1,1]}];
 if(!equal(first.body_pcs,prior)||first.segment_handlers!==12||first.next_pc!==19||!first.body_suspended
  ||first.script_child_suspended||!equal(first.parent_native_arguments,arg)||first.parent_argument_word!==p.parent_input_word
  ||!equal(first.parent_counter_bytes,[[0x7E1C76,p.parent_counter_low],[0x7E1C77,26]])||!equal(first.parent_result_phas,[raw])
  ||new Map(first.byte_writes).get(0x7E0613)!==(alias?0:slot)||physicalWord(first.byte_writes,0x7E0614)!==(alias?1:choice)
  ||!equal(first.parent_wait_mask_write,[1])||!equal(first.parent_wait_count_write,[1])
  ||!equal(first.io_records.map(r=>[r.pc,r.address,r.width,r.value]),[[0x80C566,0x802137,1,123],[0x80C572,0x80213C,1,26],[0x80C57F,0x80213D,1,1]])
  ||first.wait_records.length||first.input_records.length)fail('actual caller/random/D2/first9F');
 const posts=[all[1],all[3]],ready=all[2],blocked=p.parent_event_blocked?all[4]:null;
 for(const [n,post]of posts.entries())if(!post.parent_postrun_returned||post.segment_handlers!==0||!post.body_suspended
  ||post.next_pc!==(n?28:19)||!equal(post.body_pcs,n?[...prior,...second]:prior)||post.parent_native_arguments.length
  ||post.output_context.s!==0xB07||post.output_context.d!==0||post.output_context.bank!==0x80||post.output_context.pc!==0x91D1
  ||post.io_records.length||post.wait_records.length||post.input_records.length)fail('actual C20B/C1D9 parent postrun');
 const resumed=r=>r?.frontier==='80:F390'&&r.continuationTarget===0x80F509&&r.continuationOccurrenceProven===true
  &&r.metadataWord===2&&r.resultPushed===true&&r.stackMigrationExecuted===true&&r.readinessEntryObserved===true&&r.automaticReadiness===false
  &&r.scope==='manual-observed-whole-C1CA-readiness-native9F-resume';
 if(ready.segment_handlers!==6||!equal(ready.body_pcs,[...prior,...second])||!resumed(ready.parent_readiness)
  ||!equal(ready.parent_result_phas,[1])||ready.parent_countdown!==0||!equal(ready.parent_status_reads,[0])
  ||!equal(ready.parent_native_arguments,[{id:0x49,arguments:[alias?0:slot]},{id:0x9F,arguments:[16,0]}])
  ||!equal(ready.parent_wait_mask_write,[16])||!equal(ready.parent_wait_count_write,[0])||ready.next_pc!==28
  ||ready.io_records.length||ready.wait_records.length||ready.input_records.length)fail('whole C1CA countdown/F509/second9F');
 if(blocked&&(blocked.segment_handlers!==0||!blocked.body_suspended||blocked.parent_countdown!==null||!equal(blocked.parent_status_reads,[0])
  ||blocked.parent_native_arguments.length||blocked.parent_result_phas.length||blocked.parent_readiness?.returnTarget!==0x8091D1
  ||blocked.parent_readiness?.visitReturned!==true||blocked.parent_readiness?.automaticReadiness!==false
  ||blocked.output_context.s!==0xB07||physicalWord(blocked.byte_writes,0x7E0250)!==2
  ||blocked.io_records.length||blocked.wait_records.length||blocked.input_records.length))fail('blocked event actual visit/outerreturn');
 if(!equal(p.parent_status_samples,events.map((value,n)=>({segment:4+n,address:0x800C64,width:2,value,synthetic:true})))
  ||!resumed(prefix.parent_readiness)||prefix.parent_countdown!==null||!equal(prefix.parent_status_reads,[16])
  ||!equal(prefix.parent_result_phas,[16])||!equal(prefix.parent_native_arguments,[{id:0xC8,arguments:[alias?0:2,21,10,3,2048,selector,180]}])
  ||physicalWord(prefix.byte_writes,0x7E0616)!==selector||!prefix.script_child_suspended
  ||!equal(prefix.body_pcs,expectedPCs.slice(0,expectedPCs.indexOf(proof.child_call_pc)+1))
  ||prefix.segment_handlers!==prefix.body_pcs.length-18)fail('observed event/actual F509/text/52');
 const c8=prefix.native_calls?.at(-1);
 if(c8?.target!==0x80FEC1||c8.word_pops!==7||c8.glyphs!==(alias?69:10)||c8.newlines!==0||c8.wait_observations_used!==10
  ||c8.callee_return_word!==0xF508||c8.result_pushed!==false
  ||!equal(prefix.io_records.map(r=>[r.pc,r.address,r.width,r.value]),[[0x81ADDD,0x804216,2,0],[0x81AE39,0x804216,2,0]])
  ||!equal(prefix.wait_records.map(r=>[r.pc,r.address,r.width,r.value]),[[0x81ACC9,0x7E01FC,2,0],...Array.from({length:8},(_,n)=>[0x81ACC9,0x7E2AE0+2*n,2,0xAAAA]),[0x81ACC3,0x7E01FA,2,0]])
  ||prefix.input_records.length)fail('own original text/typed ledger');
 const targets=[0x80C560,0x80D15C,0x80C401,0x80D0D3,0x80C401,0x80FEC1,0x80CCDB,0x80A8F5];
 if(!equal(last.parent_native_arguments,[{id:0x99,arguments:[reward]},{id:0xB9,arguments:[releaseSlot]}])
  ||!equal(last.native_calls?.map(n=>n.target),targets)||!equal(last.native_calls?.map(n=>n.word_pops),[0,3,2,1,2,7,1,1])
  ||!equal(first.native_calls,ready.native_calls.slice(0,3))||!equal(ready.native_calls,prefix.native_calls.slice(0,5))
  ||!equal(prefix.native_calls,last.native_calls.slice(0,6))
  ||last.native_calls.some(n=>n.target===0x80C401?n.saved_continuation_word!==0xF508||n.raw_return_word!==0xC20A:
   n.callee_return_word!==0xF508||n.result_pushed!==(n.target===0x80C560))
  ||!equal(last.parent_currency_reads,[[0x7E3C0D,p.parent_initial_low],...(carry?[[0x7E3C0F,p.parent_initial_high]]:[])])
  ||physicalWord(last.byte_writes,0x7E3C0D)!==low||carry&&physicalWord(last.byte_writes,0x7E3C0F)!==high
  ||last.io_records.length||last.wait_records.length||last.input_records.length)fail('fresh reward/B9/source calls/physical currency');
 if(aliasBody)validateParentAliasTrace(proof,p,{first,ready,prefix,last,choice,selector,reward,equal,physicalWord});
 const entries=p.child_observed_entries;
 if(!equal(entries.slice(0,eventIndex).map(n=>n.entry),[0x80C20B,0x80C1CA,0x80C20B,...events.map(()=>0x80C1CA)])
  ||entries.slice(0,eventIndex).some(n=>n.synthetic!==true))fail('independent whole parent entries');
 // Feed the existing complete allocator/child/heap/return verifier a view
 // after the individually verified parentwait chain. The original report
 // retains every real segment and event above; this does not merge effects.
 return {...p,child_segments:[prefix,...all.slice(callIndex+1)].map((n,k)=>({...n,segment:k,
  ...(k===0?{segment_handlers:n.body_pcs.length}:{})})),child_observed_entries:entries.slice(callIndex)};
}
