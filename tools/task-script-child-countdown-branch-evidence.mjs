import {countdownParentPCs} from './task-script-child-countdown-parent-paths.mjs';
export function validateCountdownBranchParent(proof,p,{first,last,equal,physicalWord}){
 const isX=proof.script_id===0x1CF,isY=proof.script_id===0x1D2,c=proof.child_countdown_contract?.parent_branch_contract,
  props=isX?[3955,3843,3920,3934]:[3458,3430,3283],
  text=isX?(p.parent_x_raw>>>2)>540&&(p.parent_y_raw>>>2)>490:(p.parent_y_raw>>>2)>515,
  selection=props.indexOf(p.parent_property),selector=435+(selection<0?props.length:selection),
  expectedGetters=isX?[p.parent_global_index,p.parent_x_raw>>>2,p.parent_global_index,p.parent_y_raw>>>2]:[p.parent_global_index,p.parent_y_raw>>>2],
  targets=isX?[0x80D18A,0x80A959,0x80D18A,0x80A963]:[0x80D18A,0x80A963],pops=isX?[0,1,0,1]:[0,1],
  calls=first.native_calls,suffix=last.native_calls?.at(-1),s={id:proof.script_id};
 if(!isX&&!isY||!c||![p.parent_global_index,p.parent_x_raw,p.parent_y_raw,p.parent_property].every(n=>Number.isInteger(n)&&n>=0&&n<=65535)
  ||!equal(c.native_ids,[0x28,...(isX?[0x4F]:[]),0x50,0xCC,0xC8,0x5B])||p.parent_has_text!==text
  ||!equal(p.body_pcs,countdownParentPCs(s,{xRaw:p.parent_x_raw,yRaw:p.parent_y_raw,property:p.parent_property}))
  ||!equal(p.parent_getter_results,[...expectedGetters,...(text?[p.parent_property]:[])])
  ||!Array.isArray(calls)||!equal(calls.map(n=>n.target),[...targets,...(text?[0x80D1CA,0x80FEC1]:[])])
  ||!equal(calls.map(n=>n.word_pops),[...pops,...(text?[1,7]:[])])
  ||calls.some(n=>n.callee_return_word!==0xF508||n.result_pushed!==(n.target!==0x80FEC1))
  ||!equal(last.native_calls?.slice(0,-1),calls)||suffix?.target!==0x80A91D||suffix.word_pops!==1
  ||suffix.callee_return_word!==0xF508||suffix.result_pushed!==false||p.parent_final_field!==65535
  ||physicalWord(last.byte_writes,0x7E1350+p.parent_local_byte)!==65535)
  throw Error('Countdown branch parent fullWORD getter/condition/selector/return/suffix evidence drift');
 if(!text){if(p.parent_text_selector!==null||p.parent_text_local!==null||p.parent_property_local!==null
  ||first.io_records.length||first.wait_records.length||first.input_records.length)throw Error('Countdown parent skipped-text evidence drift');}
 else{
  const call=calls.at(-1),io=first.io_records,wait=first.wait_records;
  if(p.parent_text_selector!==selector||p.parent_text_local!==selector||p.parent_property_local!==p.parent_property
   ||physicalWord(first.byte_writes,first.parent_frame+0x7E0014)!==selector
   ||physicalWord(first.byte_writes,first.parent_frame+0x7E0016)!==p.parent_property
   ||call.glyphs!==10||call.newlines!==0||call.wait_observations_used!==10||first.input_records.length
   ||!equal(io.map(r=>[r.pc,r.address,r.width,r.value]),[[0x81ADDD,0x804216,2,0],[0x81AE39,0x804216,2,0]])
   ||!equal(wait.map(r=>[r.pc,r.address,r.width,r.value]),[[0x81ACC9,0x7E01FC,2,0],...Array.from({length:8},(_,n)=>[0x81ACC9,0x7E2AE0+2*n,2,0xAAAA]),[0x81ACC3,0x7E01FA,2,0]]))
   throw Error('Countdown branch parent own original text/local/typed ledger evidence drift');
 }
}
