export function validateParentAddProbe(proof,p,{equal,physicalWord}){
 const c=proof.child_parent_add_contract,w=proof.child_parent_wait_contract,pcs=proof.instructions.map(i=>i.pc),all=p.child_segments,
  first=all?.[0],last=all?.at(-1),callIndex=all?.findIndex(n=>n.script_child_suspended),eventIndex=p.parent_event_blocked?3:2,prefix=all?.[callIndex],post=all?.[1],blocked=p.parent_event_blocked?all?.[2]:null,
  slot=p.parent_input_word&255,increment=p.parent_increment_argument&255,reward=p.parent_reward_argument,selector=p.parent_text_argument,
  total=(p.parent_initial_total+8*increment)&65535,sum=p.parent_initial_low+reward,carry=sum>65535,saturated=carry&&p.parent_initial_high===65535,
  low=saturated?65535:sum&65535,high=saturated?65535:(p.parent_initial_high+Number(carry))&65535,events=p.parent_event_blocked?[0,128]:[128];
 const fail=message=>{throw Error('Parent28C '+message+' evidence drift');};
 if(proof.script_id!==0x28C||!c||!w||w.kind!=='parent-add'||!equal(w.caller_header,[6,14])||w.caller_argument_bytes!==8
  ||!equal(w.local_offsets,[0x13,0x14,0x16,0x18])||!equal(w.parent_waits,[{pc:17,next_pc:19,mask:128,count:0}])
  ||w.postrun_export!=='prepareTaskScriptBodyParentPostrun'||w.readiness_entry!=='80:C1CA'
  ||!equal(c.argument_addresses,[0x800,0x802,0x804,0x806])||!equal(c.argument_widths,[1,2,2,1])||!equal(c.local_offsets,w.local_offsets)
  ||!equal(c.d2_arguments,['BYTEcaller',0,4])||c.reward_pc!==22||!equal(c.add_pcs,[26,30,34,38,42,46,50,54])
  ||c.add_target!=='80:CDB2'||c.add_field!=='7E:3C11'||c.add_native_contract!=='analysis/render-task-native-opcode-cdb2.json'
  ||c.child_pc!==56||c.parent_text_pc!==72||!equal(c.c8_arguments,[2,2,28,3,0,'freshWORDlocal1',400])
  ||![p.parent_input_word,p.parent_text_argument,p.parent_reward_argument,p.parent_increment_argument,p.parent_initial_total,p.parent_initial_low,p.parent_initial_high].every(n=>Number.isInteger(n)&&n>=0&&n<=65535)
  ||![491,498].includes(selector)||typeof p.parent_event_blocked!=='boolean'||!equal(p.body_pcs,pcs)||pcs.length!==40
  ||p.parent_final_total!==total||p.parent_currency_low!==low||p.parent_currency_high!==high
  ||p.parent_final_byte0!==slot||p.parent_final_word1!==selector||p.parent_final_word3!==reward||p.parent_final_byte5!==increment
  ||callIndex!==eventIndex||all.length!==eventIndex+9||p.child_observed_entries.length!==all.length-1
  ||all.some((s,n)=>s.segment!==n||s.io_observations_used!==s.io_records.length||s.wait_observations_used!==s.wait_records.length||s.input_observations_used!==s.input_records.length))fail('whole source/arguments/segments');
 const prior=pcs.slice(0,11),untilChild=pcs.slice(0,31),targets=[0x80D15C,0x80C401,0x80CCDB,...Array(8).fill(0x80CDB2),0x80FEC1];
 if(first.script_id!==0x28C||first.segment_handlers!==11||!equal(first.body_pcs,prior)||!first.body_suspended||first.next_pc!==19||first.script_child_suspended
  ||!equal(first.parent_argument_words,[p.parent_input_word,selector,reward,p.parent_increment_argument])
  ||!equal(first.parent_native_arguments,[{id:0xD2,arguments:[slot,0,4]},{id:0x9F,arguments:[128,0]}])
  ||new Map(first.byte_writes).get(0x7E0613)!==slot||physicalWord(first.byte_writes,0x7E0614)!==selector
  ||physicalWord(first.byte_writes,0x7E0616)!==reward||new Map(first.byte_writes).get(0x7E0618)!==increment
  ||!equal(first.parent_wait_mask_write,[128])||!equal(first.parent_wait_count_write,[0])||first.parent_result_phas.length)fail('actual fourWORD reads/BYTEstores/D2/single9F');
 if(!post.parent_postrun_returned||post.segment_handlers!==0||!post.body_suspended||post.next_pc!==19||!equal(post.body_pcs,prior)
  ||post.output_context.s!==0xB07||post.output_context.d!==0||post.output_context.bank!==0x80||post.output_context.pc!==0x91D1)fail('actual C20B/C1D9 postrun');
 const r=prefix.parent_readiness;
 if(!r||r.frontier!=='80:F390'||r.continuationTarget!==0x80F509||r.continuationOccurrenceProven!==true||r.metadataWord!==2
  ||r.resultPushed!==true||r.stackMigrationExecuted!==true||r.readinessEntryObserved!==true||r.automaticReadiness!==false
  ||r.scope!=='manual-observed-whole-C1CA-readiness-native9F-resume'||prefix.parent_countdown!==null
  ||!equal(prefix.parent_status_reads,[128])||!equal(prefix.parent_result_phas,[128])||!prefix.script_child_suspended
  ||prefix.segment_handlers!==20||!equal(prefix.body_pcs,untilChild)
  ||!equal(prefix.parent_native_arguments,[{id:0x99,arguments:[reward]},...Array.from({length:8},()=>({id:0x7B,arguments:[increment]}))])
  ||!equal(prefix.parent_accumulator_reads,Array.from({length:8},(_,n)=>[0x7E3C11,(p.parent_initial_total+n*increment)&65535]))
  ||!equal(prefix.parent_accumulator_stores,Array.from({length:8},(_,n)=>[0x7E3C11,(p.parent_initial_total+(n+1)*increment)&65535]))
  ||physicalWord(prefix.byte_writes,0x7E3C11)!==total||!equal(prefix.parent_currency_reads,[[0x7E3C0D,p.parent_initial_low],...(carry?[[0x7E3C0F,p.parent_initial_high]]:[])])
  ||physicalWord(prefix.byte_writes,0x7E3C0D)!==low||carry&&physicalWord(prefix.byte_writes,0x7E3C0F)!==high)fail('actual event/F509/reward/eight distinct fresh reads and stores');
 if(blocked&&(blocked.segment_handlers!==0||!blocked.body_suspended||blocked.parent_countdown!==null||blocked.parent_native_arguments.length
  ||blocked.parent_readiness?.visitReturned!==true||blocked.parent_readiness?.automaticReadiness!==false||blocked.parent_readiness?.returnTarget!==0x8091D1
  ||blocked.output_context.s!==0xB07||physicalWord(blocked.byte_writes,0x7E0250)!==2||!equal(blocked.parent_status_reads,[0])||blocked.parent_result_phas.length))fail('blocked whole visit/epilogue/outerreturn');
 const suffix=last.native_calls?.at(-1);
 if(last.script_id!==0x28C||!last.body_complete||last.segment_handlers!==9||!equal(last.body_pcs,pcs)
  ||!equal(last.parent_native_arguments,[{id:0xC8,arguments:[2,2,28,3,0,selector,400]}])
  ||!equal(last.native_calls?.map(n=>n.target),targets)||!equal(last.native_calls?.map(n=>n.word_pops),[3,2,1,...Array(8).fill(1),7])
  ||!equal(first.native_calls,prefix.native_calls.slice(0,2))||!equal(prefix.native_calls,last.native_calls.slice(0,11))
  ||last.native_calls.some(n=>n.target===0x80C401?n.saved_continuation_word!==0xF508||n.raw_return_word!==0xC20A:n.callee_return_word!==0xF508||n.result_pushed!==false)
  ||suffix.glyphs!==10||suffix.newlines!==0||suffix.wait_observations_used!==10
  ||!equal(last.io_records.map(r=>[r.pc,r.address,r.width,r.value]),[[0x81ADDD,0x804216,2,0],[0x81AE39,0x804216,2,0]])
  ||!equal(last.wait_records.map(r=>[r.pc,r.address,r.width,r.value]),[[0x81ACC9,0x7E01FC,2,0],...Array.from({length:8},(_,n)=>[0x81ACC9,0x7E2AE0+2*n,2,0xAAAA]),[0x81ACC3,0x7E01FA,2,0]]))fail('fresh postchild own text/typed arguments/returns');
 if(all.filter((_,n)=>n!==all.length-2&&n!==all.length-1).some(s=>s.io_records.length||s.wait_records.length||s.input_records.length)
  ||last.input_records.length||!equal(p.parent_status_samples,events.map((value,n)=>({segment:2+n,address:0x800C64,width:2,value,synthetic:true})))
  ||!equal(p.child_observed_entries.slice(0,eventIndex).map(n=>n.entry),[0x80C20B,...events.map(()=>0x80C1CA)]))fail('independent chronological entry/device/event observations');
 return {...p,child_segments:[prefix,...all.slice(callIndex+1)].map((s,n)=>({...s,segment:n,...(n===0?{segment_handlers:s.body_pcs.length}:{})})),
  child_observed_entries:p.child_observed_entries.slice(callIndex)};
}
