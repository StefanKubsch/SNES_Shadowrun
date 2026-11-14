const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b),fail=()=>{throw Error('Whole3A2 property pair evidence drift');};
const word=(pairs,address)=>{const m=new Map(pairs);return m.has(address)&&m.has(address+1)?m.get(address)|(m.get(address+1)<<8):null;};
export function validatePropertyPairEvidence(proof,probes){const c=proof.property_pair_contract,
 pointers=[{address:0x8DC5DD,value:0x3A3F},{address:0x8DC3C2,value:0x31F2},{address:0x8DB250,value:0x3468}],fields=[0x7E3A42,0x7E31F5,0x7E346B];
 if(proof.script_id!==0x3A2||!c||!equal(c.header,[0,6])||c.argument_bytes!==0||c.result_address!==0x800
  ||!equal(c.query_pcs,[6,14])||c.query_target!=='80:9DAE'||!equal(c.query_arguments,[[2226,5565],[2226,5026]])
  ||!equal(c.pointers,pointers)||!equal(c.fields,fields)||c.branch_pc!==17||c.skip_pc!==44||c.active_pc!==20
  ||!equal(c.store_pcs,[26,34,42])||c.store_target!=='80:CBF7'||!equal(c.store_arguments,[[5565,5432],[5026,5432],[560,2226]])
  ||!Array.isArray(probes)||probes.length!==8)fail();
 for(const {address,value}of pointers){const r=proof.rom_reads.find(r=>parseInt(r.entry.replace(':',''),16)===address);
  if(!r||parseInt(r.machine_bytes.slice(0,2),16)+(parseInt(r.machine_bytes.slice(2),16)<<8)!==value)fail();}
 const cases=new Set(),edges=new Set();for(const p of probes){const [first,second]=p.property_pair_input??[],active=first===2226&&second===2226,
  pcs=proof.instructions.filter(i=>active||i.pc<=17||i.pc===44).map(i=>i.pc),q=p.property_pair_native_calls;
  if(![0,2226,0x18B2,65535].includes(first)||![0,2226,0x18B2,65535].includes(second)||p.body_complete!==true||p.script_id!==0x3A2
   ||!equal(p.body_pcs,pcs)||p.handlers!==pcs.length||p.result_word!==0xBEEF
   ||!equal(p.property_pair_final,active?[5432,5432,2226]:[first,second,0xABCD])
   ||!equal(p.property_pair_arguments,[{id:0x42,arguments:[2226,5565]},{id:0x42,arguments:[2226,5026]},
    ...(active?c.store_arguments.map(arguments_=>({id:0x74,arguments:arguments_})):[])])
   ||!equal(p.property_pair_pointer_reads,[...pointers.slice(0,2),...(active?pointers:[])].map(p=>[p.address,p.value]))
   ||!equal(p.property_pair_field_reads,[[fields[0],first],[fields[1],second]])
   ||!equal(p.property_pair_result_phas,[first===2226?65535:0,second===2226?65535:0])
   ||!equal(q?.map(n=>n.target),[0x809DAE,0x809DAE,...(active?[0x80CBF7,0x80CBF7,0x80CBF7]:[])])
   ||q.some((n,k)=>n.word_pops!==2||n.return_word!==0xF508||n.result_pushed!==(k<2))
   ||p.property_pair_io_used||p.property_pair_wait_used||p.property_pair_input_used)fail();
  for(let k=0;k<fields.length;k++){const stored=word(p.byte_writes,fields[k]);if(active?stored!==[5432,5432,2226][k]:stored!==null)fail();}
  cases.add(first+':'+second);for(let n=1;n<pcs.length;n++)edges.add(pcs[n-1]+':'+pcs[n]);
 }
 if(!equal([...cases].sort(),[[2226,2226],[2226,0],[0,2226],[0,0],[0x18B2,2226],[2226,0x18B2],[65535,2226],[2226,65535]].map(p=>p.join(':')).sort())
  ||!equal([...edges].sort(),proof.edges.map(e=>e.from+':'+e.to).sort()))fail();
}
