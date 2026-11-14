// Independent source/physical trace contract; repeated equality1 is original.
export function validateParentAliasTrace(proof,p,{first,ready,prefix,last,choice,selector,reward,equal,physicalWord}){
 const c=proof.child_parent_alias_contract,id=proof.script_id,alias=p.parent_alias,base=id===0x15F?491:495;
 const fail=()=>{throw Error('Parent alias original equality/local/stack/saved-ID evidence drift');};
 if(typeof alias!=='boolean'||!equal(c,{frame:0x600,initial_operand_s:0x615,argument_address:0x616,result_address:0x618,
  saved_id_high:0x60A,repeated_comparison:[1,1,2],nominal_texts:[base,base+1,base+2,base+3],
  nominal_rewards:id===0x15F?[100,70,90,100]:[200,150,180,200],alias_reward:id===0x15F?80:170,
  alias_c8_arguments:[0,21,10,3,2048,180,180],alias_glyphs:69,alias_release_slot:8,ownership:c?.ownership})
  ||!c.ownership?.includes('secondAA true')||p.parent_initial_operand_s!==(alias?0x615:0x7FF)
  ||!equal(first.parent_operand_s_read,[p.parent_initial_operand_s])
  ||p.parent_expected_text!==selector||p.parent_expected_reward!==reward
  ||p.parent_final_local_byte!==(alias?8:p.parent_input_word&255)
  ||p.parent_final_choice_word!==(alias?1:choice)||p.parent_final_text_word!==(alias?8:selector))fail();
 const comparisons=[];
 for(let n=0;n<3;n++){comparisons.push({pc:[32,48,64][n],left:alias?[16,0,1][n]:choice,right:n,result:!alias&&choice===n?65535:0});if(!alias&&choice===n)break;}
 if(alias)comparisons.push({pc:105,left:180,right:1,result:0},{pc:120,left:1,right:1,result:65535});
 else{comparisons.push({pc:105,left:choice,right:1,result:choice===1?65535:0});
  if(choice!==1){comparisons.push({pc:120,left:choice,right:1,result:0},{pc:135,left:choice,right:2,result:choice===2?65535:0});}}
 if(!equal(prefix.parent_equalities,comparisons.filter(n=>n.pc<101))||!equal(last.parent_equalities,comparisons))fail();
 for(const segment of [first,ready,prefix,last]){
  if(!Array.isArray(segment.parent_alias_writes))fail();
  const writes=new Map(segment.byte_writes),actual=new Map(segment.parent_alias_writes.map(([a,v])=>[a,v]));
  for(const [a,v]of actual)if(writes.get(a)!==v)fail();
 }
 // Source-selected ordered writes show why each fresh read changes. Extra
 // genuine writes remain visible; these are not a synthesized final RAM view.
 const ordered=(segment,expected)=>{let next=0;for(const row of segment.parent_alias_writes)if(equal(row,expected[next]))next++;
  if(next!==expected.length)fail();};
 ordered(first,[[0x7E0613,p.parent_input_word&255,'local-BYTE'],[0x7E0614,choice,'local-WORD-low'],[0x7E0615,0,'local-WORD-high']]);
 if(alias){
  if(p.parent_input_word!==0xAB10||choice!==2)fail();
  ordered(first,[[0x7E0613,0,'Local-PHA-high'],[0x7E0614,1,'Update-PHA-low']]);
  ordered(ready,[[0x7E0614,16,'PHA-operand-low']]);
  ordered(prefix,[[0x7E0616,(base+3)&255,'local-WORD-low'],[0x7E0617,(base+3)>>8,'local-WORD-high'],
   [0x7E0616,180,'PHA-operand-low'],[0x7E0614,180,'Local-PHA-low'],[0x7E0613,8,'PHA-operand-high'],
   [0x7E060A,2,'PHA-operand-low'],[0x7E060A,0,'saved-ID-high']]);
  ordered(last,[[0x7E0616,180,'Local-PHA-low'],[0x7E0614,1,'PHA-operand-low'],[0x7E0616,0,'Truth-left-result-low'],
   [0x7E0616,1,'Local-PHA-low'],[0x7E0614,1,'PHA-operand-low'],[0x7E0616,255,'Truth-left-result-low'],
   [0x7E0616,reward,'PHA-operand-low'],[0x7E0616,8,'Local-PHA-low']]);
  if(physicalWord(last.byte_writes,0x7E0616)!==8||physicalWord(last.byte_writes,0x7E1040)!==65535
   ||physicalWord(last.byte_writes,0x7E4038)!==128||physicalWord(last.byte_writes,0x7E3F30)!==65535)fail();
 }
}
