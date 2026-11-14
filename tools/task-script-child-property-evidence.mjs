import {propertyParentPCs} from './task-script-body-child-property-fixtures.mjs';
export function validatePropertyChildParent(proof,p,{first,last,equal,physicalWord}){
 const c=proof.child_property_contract,index=p.parent_record_index,pointer=p.parent_record_pointer,
  called=pointer===0||p.parent_initial_property!==2226,selector=called?528:529,
  rom=proof.rom_reads.find(r=>parseInt(r.entry.replace(':',''),16)===0x8DB020+index),
  pointerWord=rom?parseInt(rom.machine_bytes.slice(0,2),16)|(parseInt(rom.machine_bytes.slice(2),16)<<8):null,
  firstTargets=called?[0x809DAE]:[0x809DAE,0x80FEC1,0x80F953],
  lastTargets=called?[0x809DAE,0x80CBF7,0x80FEC1,0x80F953]:firstTargets,
  text=last,c8=text.native_calls?.find(n=>n.target===0x80FEC1),a3=text.native_calls?.find(n=>n.target===0x80F953),
  args=called?[6,2,16,3,0,528,1]:[5,2,21,3,0,529,1],
  expectedFirst=[{id:0x42,arguments:[2226,index]},...(called?[]:[{id:0xC8,arguments:args},{id:0xA3,arguments:[]}])],
  expectedLast=called?[{id:0x74,arguments:[index,2226],property_writes:pointer?[[0x7E0003+pointer,178],[0x7E0004+pointer,8]]:[]},
   {id:0xC8,arguments:args},{id:0xA3,arguments:[]}]:expectedFirst;
 if(proof.script_id!==0xD1||c?.comparison_word!==2226||c.caller_argument_bytes!==2||c.caller_local_offset!==0x13
  ||!Number.isInteger(index)||index<0||index>65535||pointerWord!==pointer
  ||(pointer===0?p.parent_initial_property!==null:!Number.isInteger(p.parent_initial_property)||p.parent_initial_property<0||p.parent_initial_property>65535)
  ||p.parent_local_word!==index||p.parent_called_child!==called||p.parent_text_selector!==selector||typeof p.parent_repeated!=='boolean'
  ||!equal(p.body_pcs,propertyParentPCs({index,property:p.parent_initial_property}))
  ||first.parent_local_write_address!==0x7E0613||physicalWord(first.byte_writes,first.parent_local_write_address)!==index
  ||!equal(first.parent_getter_results,[called?0:65535])||!equal(last.parent_getter_results,called?[]:[65535])
  ||!equal(first.parent_native_arguments,expectedFirst)||!equal(last.parent_native_arguments,expectedLast)
  ||!equal(first.native_calls?.map(n=>n.target),firstTargets)||!equal(last.native_calls?.map(n=>n.target),lastTargets)
  ||called&&!equal(first.native_calls,last.native_calls.slice(0,1))
  ||!equal(last.native_calls?.map(n=>n.word_pops),called?[2,2,7,0]:[2,7,0])
  ||last.native_calls.some(n=>n.callee_return_word!==0xF508||n.result_pushed!==(n.target===0x809DAE))
  ||c8?.glyphs!==(called?19:25)||c8.newlines!==0||c8.wait_observations_used!==10||a3?.word_pops!==0
  ||a3.iterations!==(p.parent_repeated?2:1)||a3.wait_observations_used!==(p.parent_repeated?4:1)
  ||a3.input_observations_used!==(p.parent_repeated?2:1))
  throw Error('Parent0D1 actual fullWORD getter/property/child/text/native return evidence drift');
 const io=text.io_records,wait=text.wait_records,input=text.input_records,counters=p.parent_repeated?[5,6,6,7]:[6];
 if(!equal(io.map(r=>[r.pc,r.address,r.width,r.value]),[[0x81ADDD,0x804216,2,0],[0x81AE39,0x804216,2,0]])
  ||!equal(wait.map(r=>[r.pc,r.address,r.width,r.value]),[[0x81ACC9,0x7E01FC,2,0],...Array.from({length:8},(_,n)=>[0x81ACC9,0x7E2AE0+2*n,2,0xAAAA]),[0x81ACC3,0x7E01FA,2,0],
   ...counters.map(value=>[0x81B0A5,0x7E1C76,2,value])])
  ||!equal(input.map(r=>[r.pc,r.address,r.width,r.value]),(p.parent_repeated?[0,0x40]:[0x40]).map(value=>[0x809E1A,0x8001CA,2,value]))
  ||called&&(first.io_records.length||first.wait_records.length||first.input_records.length))
  throw Error('Parent0D1 actual segment text/counter/input ledger evidence drift');
}
