// Independent whole1A5 admission: original branches, physical widths, real return/observation sequence.
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b),fail=()=>{throw Error('Whole1A5 record/audio/countdown evidence drift');};
const word=(pairs,address)=>{const m=new Map(pairs);return m.has(address)&&m.has(address+1)?m.get(address)|(m.get(address+1)<<8):null;};
const native=(id,args)=>({id,arguments:args});
export function validateRecordAndEvidence(proof,probes){
 const c=proof.record_and_contract;
 if(proof.script_id!==0x1A5||!c||!equal(c.header,[2,8])||c.argument_bytes!==2||!equal(c.byte_locals,[19,20])
  ||c.flag_record!==1596||!equal(c.flag_pointer,{address:0x8DB65C,value:0x3A99})||c.flag_word!==0x7E3A9A
  ||c.flag_getter!=='80:CB2B'||c.flag_getter_null_guard!==false||!equal(c.gate,{pc:22,skip_pc:63,active_pc:25,set:1,clear:128})
  ||!equal(c.property_call,{pc:31,target:'80:CBF7',arguments:[560,5432],pointer:{address:0x8DB250,value:0x3468},word:0x7E346B})
  ||!equal(c.or_call,{pc:38,target:'80:CBB3',arguments:[1596,128]})
  ||!equal(c.and_call,{pc:45,target:'80:CBCB',arguments:[1596,65534],width:1,contract:'analysis/render-task-native-opcode-cbcb.json'})
  ||!equal(c.audio_call,{pc:54,arguments:['freshBYTElocal0',10,255,3],sound:{address:0x80C4BD,value:5}})
  ||!equal(c.wait,{pc:60,next_pc:62,mask:1,count:60,readiness_entry:'80:C1F9',postrun_owner:false})
  ||!equal(c.release,{pc:64,target:'80:A91D',argument:'freshBYTElocal0',word_base:0x801350,value:65535})
  ||!equal(c.end,{pc:66,result_address:0x802})||!Array.isArray(probes)||probes.length!==21)fail();
 for(const [address,value]of [[0x8DB65C,0x3A99],[0x8DB250,0x3468],[0x80C4BD,5]]){
  const r=proof.rom_reads.find(r=>parseInt(r.entry.replace(':',''),16)===address);
  if(!r||parseInt(r.machine_bytes.slice(0,2),16)+(parseInt(r.machine_bytes.slice(2),16)<<8)!==value)fail();
 }
 const edges=new Set(),cases=new Set();
 for(const p of probes){const flag=p.record_initial_flag,input=p.record_input_word,high=p.record_initial_flag_high,slot=input&255,
   active=(flag&1)!==0&&(flag&128)===0,pcs=proof.instructions.filter(i=>active||i.pc<25||i.pc>=63).map(i=>i.pc),
   first=p.record_segments?.[0],last=p.record_segments?.at(-1),segments=p.record_segments,
   expectedArgs=active?[native(0xBB,[1596]),native(0x74,[560,5432]),native(0x0D,[1596,128]),native(0x4B,[1596,65534]),
    native(0x4C,[slot,10,255,3]),native(0x9F,[1,60])]:[native(0xBB,[1596]),native(0x5B,[slot])],
   targets=active?[0x80CB2B,0x80CBF7,0x80CBB3,0x80CBCB,0x80C46E,0x80C401,0x80A91D]:[0x80CB2B,0x80A91D],
   pops=active?[1,2,2,2,4,2,1]:[1,1];
  if(![0,1,3,127,128,129,255].includes(flag)||![0xAB10,0xFF11,0x80FE].includes(input)
   ||high!==[0xA5,0x80,255][[0xAB10,0xFF11,0x80FE].indexOf(input)]||p.record_active!==active
   ||p.script_id!==0x1A5||p.body_complete!==true||!equal(p.body_pcs,pcs)||p.handlers!==pcs.length||p.result_word!==0xBEEF
   ||p.record_final_flag!==((high<<8)|(active?(flag|128)&254:flag))||p.record_final_property!==(active?5432:0xABCD)
   ||p.record_final_local_byte0!==slot||p.record_final_local_byte1!==flag||p.record_final_entity_word!==65535
   ||!equal(p.record_countdown_trace,active?Array.from({length:60},(_,n)=>59-n):[])
   ||p.observed_readiness_entries!==(active?60:0)||p.observations.entries!==(active?60:0)||p.observations.event_bytes.length!==0
   ||segments.length!==(active?2:1)||first.segment!==0||last.segment!==(active?60:0)
   ||first.segment_handlers!==(active?32:18)||last.segment_handlers!==(active?4:18)
   ||!equal(first.body_pcs,active?pcs.slice(0,32):pcs)||!equal(last.body_pcs,pcs)
   ||!equal(first.native_arguments,expectedArgs)||active&&!equal(last.native_arguments,[native(0x5B,[slot])])
   ||!equal(first.caller_word,[input,flag])||!equal(first.result_phas,[flag])||active&&!equal(last.result_phas,[1])
   ||!equal(first.pointer_reads,active?[[0x8DB65C,0x3A99],[0x8DB250,0x3468],[0x8DB65C,0x3A99],[0x8DB65C,0x3A99]]:[[0x8DB65C,0x3A99]])
   ||!equal(first.flag_word_reads,[[0x7E3A9A,flag|(high<<8)]])
   ||!equal(first.flag_byte_reads,active?[[0x7E3A9A,flag,'leaf-record-BYTE'],[0x7E3A9A,flag|128,'record-and-field-BYTE']]:[])
   ||!equal(first.flag_byte_writes,active?[[0x7E3A9A,flag|128],[0x7E3A9A,(flag|128)&254]]:[])
   ||first.byte_writes.some(([a])=>a===0x7E3A9B)||active&&word(first.byte_writes,0x7E346B)!==5432
   ||word(last.byte_writes,0x7E1350+slot)!==65535
   ||active&&!equal(first.native_calls,last.native_calls.slice(0,-1))
   ||!equal(last.native_calls.map(n=>n.target),targets)||!equal(last.native_calls.map(n=>n.word_pops),pops)
   ||last.native_calls.some(n=>n.target===0x80C401?n.saved_continuation_word!==0xF508||n.raw_return_word!==0xC20A:
    n.callee_return_word!==0xF508||n.result_pushed!==(n.target===0x80CB2B)))fail();
  const audio=first.native_calls.find(n=>n.target===0x80C46E),io=first.io_records;
  if(first.io_observations_used!==io.length||first.wait_records.length||first.wait_observations_used||first.input_observations_used
   ||active&&(audio.sound!==5||audio.voice!==3||!equal(io,[{pc:0x80C44F,address:0x804217,width:1,value:17},
    {pc:0x80C45A,address:0x804217,width:1,value:34},...Array.from({length:3},(_,n)=>({pc:0x81F00E,address:0x802140,width:1,value:(p.record_audio_token+n)&255}))]))
   ||!active&&io.length||active&&(last.io_records.length||last.io_observations_used||last.wait_records.length||last.wait_observations_used||last.input_observations_used))fail();
  if(active&&(!equal(p.segments.map(s=>[s.repetitions,s.segment_handlers,s.body_complete,s.body_suspended,s.first_countdown,s.last_countdown]),
   [[1,32,false,true,null,null],[59,0,false,true,59,1],[1,4,true,false,0,0]])))fail();
  if(!active&&(p.segments.length!==1||p.segments[0].repetitions!==1||p.segments[0].body_complete!==true))fail();
  cases.add(flag+':'+input);for(let n=1;n<pcs.length;n++)edges.add(pcs[n-1]+':'+pcs[n]);
 }
 if(cases.size!==21||!equal([...edges].sort(),proof.edges.map(e=>e.from+':'+e.to).sort()))fail();
}
