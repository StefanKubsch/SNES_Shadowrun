// Canonical admission of complete actual allocated Child6F/0D2 paths.
// Values describe explicit synthetic initial observations, never timing or
// an initialized original scene. Execution writes must support projections.
import {validateCountdownBranchParent} from './task-script-child-countdown-branch-evidence.mjs';
export function validateCountdownChildEvidence(proof,p,child,{first,body,children,equal,physicalWord}){
 const c=proof.child_countdown_contract,isRecord=proof.child_id===0x6F,frameBytes=isRecord?29:28,
  arg=isRecord?proof.instructions[proof.instructions.findIndex(i=>i.pc===proof.child_call_pc)-1].operand:p.parent_input_word&255,
  wait=children[0],count=isRecord?1:2,calls=body.native_calls,
  prefixPCs=child.instructions.slice(0,4).map(i=>i.pc),readiness=children.slice(2),
  word=(address,value)=>physicalWord(body.byte_writes,address)===value;
 if(!c||c.frame_bytes!==frameBytes||c.local_offset!==0x13||c.local_width!==(isRecord?2:1)||c.count!==count||c.mask!==1||c.prefix_handlers!==4
  ||!equal(c.native_ids,child.native_ids)||c.argument!==(isRecord?arg:null)
  ||!Number.isInteger(p.parent_input_word)||p.parent_input_word<0||p.parent_input_word>65535
  ||p.parent_local_byte!==(p.parent_input_word&255)||p.child_argument_word!==arg
  ||new Map(first.byte_writes).get(first.parent_frame+0x7E0013)!==p.parent_local_byte
  ||physicalWord(first.byte_writes,first.child_frame+0x7E0000+frameBytes-2)!==arg
  ||physicalWord(wait.byte_writes,0x7E0BA2+first.child_slot)!==1
  ||physicalWord(wait.byte_writes,0x7E0C02+first.child_slot)!==count
  ||physicalWord(wait.byte_writes,0x7E02B2+first.child_slot)!==0xF508
  ||!equal(wait.body_pcs,prefixPCs)||children.some(s=>s.io_records.length||s.wait_records.length||s.input_records.length)
  ||readiness.some((s,n)=>physicalWord(s.byte_writes,0x7E0C02+first.child_slot)!==count-n-1
   ||physicalWord(s.byte_writes,0x7E0250)!==(n===readiness.length-1?first.child_slot:first.parent_slot))
  ||!Array.isArray(calls)||!equal(calls.map(n=>n.target),[0x80C401,isRecord?0x80CBB3:0x80A8F5])
  ||!equal(calls.map(n=>n.word_pops),[2,isRecord?2:1])
  ||calls[0].saved_continuation_word!==0xF508||calls[0].raw_return_word!==0xC20A
  ||calls[0].callee_return_word!==null||calls[0].result_pushed!==null
  ||children.slice(0,-1).some(s=>!equal(s.native_calls,[calls[0]]))
  ||calls[1].callee_return_word!==0xF508||calls[1].result_pushed!==false)
  throw Error('Countdown child argument/yield/cursor/native evidence drift');
 if(isRecord){
  if(p.child_local_word!==arg||physicalWord(wait.byte_writes,first.child_frame+0x7E0013)!==arg
   ||c.record_pointer?.address!==0x8DB020+arg||c.record_pointer.value!==p.child_record_pointer
   ||!child.rom_reads.some(r=>parseInt(r.entry.replace(':',''),16)===c.record_pointer.address
    &&parseInt(r.machine_bytes.slice(0,2),16)+(parseInt(r.machine_bytes.slice(2),16)<<8)===c.record_pointer.value)
   ||!Number.isInteger(p.child_initial_flags)||p.child_initial_flags<0||p.child_initial_flags>255
   ||p.child_record_flags!==(p.child_initial_flags|2)
   ||new Map(body.byte_writes).get(0x7E0001+p.child_record_pointer)!==p.child_record_flags
   ||!c.parent_branch_contract&&(first.io_records.length||first.wait_records.length||first.input_records.length))
   throw Error('Child6F fresh record/local/BYTEflag evidence drift');
  if(c.parent_branch_contract)validateCountdownBranchParent(proof,p,{first,last:p.child_segments.at(-1),equal,physicalWord});
 }else{
  const slot=p.child_entity_slot,nodes=p.child_initial_node_count,free=p.child_initial_free_count,tail=p.child_initial_list_tail,
   expectedList=tail===0?[slot]:p.child_target_position===0?[0x20,0x30,0x30]:[0x20,0x30,slot],
   recordWrites=[0x4240,0x4298,0x42F0,0x4348,0x43A0,0x40E0,0x3F80],
   expectedFree=(free+nodes)&65535;
  if(slot!==arg||p.child_local_byte!==slot||new Map(wait.byte_writes).get(first.child_frame+0x7E0013)!==slot
   ||p.child_global_word!==65535||!word(0x7E1D6B,65535)||![0,3].includes(nodes)||!Number.isInteger(free)||free<0||free>65535
   ||![0,4].includes(tail)||![0,2].includes(p.child_target_position)||p.child_node_count!==0||p.child_free_count!==expectedFree
   ||p.child_free_head!==(nodes?0x400:0x500)||p.child_node_head!==(nodes?65535:null)
   ||!equal(p.child_node_links,nodes?[0x500,0x200,0x300]:[])
   ||p.child_list_tail!==((tail-2)&65535)||!equal(p.child_list_words,expectedList)||!word(0x7E14B0,p.child_list_tail)
   ||p.child_released_words.some(n=>n!==0)||p.child_released_words.length!==recordWrites.length
   ||recordWrites.some(n=>!word(0x7E0000+n+slot,0))||[0x1140,0x1090].some(n=>!word(0x7E0000+n+slot,0))
   ||p.child_released_selection!==65535||p.child_released_field!==65535||p.child_release_flag!==128||p.child_release_state!==1
   ||!word(0x7E1038+slot,65535)||!word(0x7E3F28+slot,65535)||!word(0x7E4030+slot,128)||!word(0x7E3FD8+slot,1)
   ||nodes&&(!word(0x7E12A0+slot,0)||!word(0x7E0D1C,expectedFree)||!word(0x7E0D1E,0x400)
    ||!word(0x7E12F8+slot,65535)||[0x200,0x300,0x400].some((n,i)=>!word(0x7E1564+n,[0x500,0x200,0x300][i])))
   ||tail===4&&p.child_target_position===0&&[0x7E14B2,0x7E14B4].some((a,i)=>!word(a,expectedList[i])))
   throw Error('Child0D2 actual global/entity/free/list evidence drift');
  if(proof.script_id===0x2EE){if(first.io_records.length||first.wait_records.length||first.input_records.length)throw Error('Child0D2 text-free parent observation drift');}
  else{
   const call=first.native_calls,io=first.io_records,waits=first.wait_records,
    expectedIO=[[0x81ADDD,0x804216,2,0],[0x81AE39,0x804216,2,0],[0x81AE73,0x804214,1,0],
     [0x81AE7D,0x804214,1,1],[0x81AE94,0x804216,2,0],[0x81ADDD,0x804216,2,0],[0x81AE39,0x804216,2,0]],
    expectedWait=[0x81ACC9,...Array(8).fill(0x81ACC9),0x81ACC3,...(proof.script_id===0x18B?[0x81ACC3]:[])];
   if(![0x161,0x18B].includes(proof.script_id)||!Array.isArray(call)||call.length!==1||call[0].target!==0x80FEC1
    ||call[0].word_pops!==7||call[0].glyphs!==19||call[0].newlines!==1||call[0].callee_return_word!==0xF508||call[0].result_pushed!==false
    ||call[0].wait_observations_used!==waits.length||!equal(io.map(r=>[r.pc,r.address,r.width,r.value]),expectedIO)
    ||!equal(waits.map(r=>r.pc),expectedWait)||waits.some((r,n)=>{const mask=r.pc===0x81ACC9&&n>0&&n<9;return r.address!==(mask?0x7E2AE0+2*(n-1):r.pc===0x81ACC9?0x7E01FC:0x7E01FA)||r.width!==2||r.value!==(mask?0xAAAA:0);})
    ||first.input_records.length)throw Error('Countdown parent actual C8/text/newline ledger evidence drift');
  }
 }
}
