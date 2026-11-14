import {expandParentWaitChildFixture} from './task-script-body-child-parent-wait-fixtures.mjs';
import {parentAddTextIO,parentAddTextWait} from './task-script-body-child-parent-add-observations.mjs';
import {sampleWord} from './render-f130-fixtures.mjs';import {menuRecords} from './task-native-menu-fixtures.mjs';import {bodyWord} from './task-script-body-fixtures.mjs';
export const parentAddCases=()=>[
 {input:0xAB10,text:491,reward:170,increment:0xAB00,total:65535,low:5000,high:0},
 {input:0xFF11,text:498,reward:1,increment:0xFF01,total:65535,low:65535,high:0},
 {input:0x80FE,text:491,reward:1,increment:0x80FF,total:65520,low:65535,high:32767},
 {input:65535,text:498,reward:1,increment:65535,total:32768,low:65535,high:65535},
 {input:0xAB10,text:491,reward:0,increment:0xABFF,total:32767,low:0,high:65535},
 {input:0xFF11,text:498,reward:65535,increment:0xFF01,total:0xF000,low:32767,high:0}
].flatMap((v,n)=>[false,true].flatMap(blocked=>[0x800,0x400].map(heap=>({...v,counterLow:0,blocked,heap,name:'original-four-arguments-'+n+'-'+(blocked?'blocked-event':'event')+'-heap-'+heap.toString(16)}))));
export function expandAddParentFixture(s,v,f){const base=expandParentWaitChildFixture(s,v,f),word=(a,n)=>sampleWord(base.data,a,n);
 for(const [a,n]of [[0x800,v.input],[0x802,v.text],[0x804,v.reward],[0x806,v.increment],[0x808,0xBEEF],[0x7E3C11,v.total]])word(a,n);
 return {...base,maxHandlers:11,ioObservations:menuRecords([]),waitObservations:menuRecords([]),
  parentTextIO:menuRecords(parentAddTextIO[v.text]??[]),parentTextWait:menuRecords(parentAddTextWait[v.text]??[]),
  parentSuffixIO:menuRecords(parentAddTextIO[v.text]??[]),parentSuffixWait:menuRecords(parentAddTextWait[v.text]??[]),parentSuffixHandlers:9};
}
export function parentAddProbeDetails(s,v,f){return {parent_input_word:v.input,parent_event_blocked:v.blocked,
 parent_text_argument:v.text,parent_reward_argument:v.reward,parent_increment_argument:v.increment,parent_initial_total:v.total,parent_final_total:bodyWord(f.data,0x7E3C11),
 parent_initial_low:v.low,parent_initial_high:v.high,parent_currency_low:bodyWord(f.data,0x7E3C0D),parent_currency_high:bodyWord(f.data,0x7E3C0F),
 parent_final_byte0:f.data.readByte(0x613).value,parent_final_word1:bodyWord(f.data,0x614),parent_final_word3:bodyWord(f.data,0x616),parent_final_byte5:f.data.readByte(0x618).value};}
