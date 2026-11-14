import {expandParentWaitChildFixture,parentWaitCases,parentWaitChoice} from './task-script-body-child-parent-wait-fixtures.mjs';
import {sampleWord} from './render-f130-fixtures.mjs';import {bodyWord} from './task-script-body-fixtures.mjs';
import {parentAliasTextIO,parentAliasTextWait} from './task-script-body-child-parent-alias-observations.mjs';
import {menuRecords} from './task-native-menu-fixtures.mjs';
export const parentAliasCases=()=>parentWaitCases().map(v=>({...v,alias:false})).concat([false,true].flatMap(blocked=>[0x800,0x400].map(heap=>({
 name:'actual-frame-local-stack-alias-'+(blocked?'blocked-then-event':'event')+'-heap-'+heap.toString(16),counterLow:0,input:0xAB10,low:5000,high:0,blocked,heap,alias:true}))));
export const parentAliasSelector=(s,v)=>v.alias?180:(s.id===0x15F?491:495)+parentWaitChoice(v);
export const parentAliasReward=(s,v)=>v.alias?(s.id===0x15F?80:170):
 (s.id===0x15F?{1:70,2:90,0:100,3:100}:{1:150,2:180,0:200,3:200})[parentWaitChoice(v)];
export function expandAliasParentFixture(s,v,f){const base=expandParentWaitChildFixture(s,v,f),word=(a,n)=>sampleWord(base.data,a,n),selector=parentAliasSelector(s,v);
 if(v.alias){
  // Independently observed physical caller: initial argument WORD at616/617,
  // operandS615, own END result at618/619. No original allocated-caller claim.
  word(0x607,0x615);word(0x616,v.input);word(0x618,0xBEEF);
  for(const [a,n]of [[0x801458,0],[0x801400,0],[0x8012A8,0],[0x8014B0,0],[0x8014B2,8],[0x7E4400,0]])word(a,n);
  // Exact synthetic field0 geometry required by actual saved-ID-high
  // alias replacing the first C8 pop; never a fallback-filled RAM page.
  for(const [field,value]of [[0x2020,64],[0x2040,8],[0x2060,32],[0x2080,256],
   [0x20A0,256],[0x20C0,32],[0x20E0,0],[0x2100,0],[0x2120,64],[0x2140,0]])word(0x7E0000+field,value);
 }
 return {...base,parentTextIO:menuRecords(parentAliasTextIO[selector]??[]),parentTextWait:menuRecords(parentAliasTextWait[selector]??[])};
}
export function aliasParentProbeDetails(s,v,f){return {parent_alias:v.alias,parent_initial_operand_s:v.alias?0x615:0x7FF,
 parent_final_local_byte:f.data.readByte(0x613).value,parent_final_choice_word:bodyWord(f.data,0x614),parent_final_text_word:bodyWord(f.data,0x616),
 parent_expected_text:parentAliasSelector(s,v),parent_expected_reward:parentAliasReward(s,v)};}
