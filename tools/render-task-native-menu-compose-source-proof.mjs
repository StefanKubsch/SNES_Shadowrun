import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {decodeTaskWindows} from './task-partial-source.mjs';
import {taskListSpecs} from './task-native-list-specs.mjs';
import {taskTextComposeWindows} from './task-native-text-compose-spec.mjs';
import {pinWindows as audioPins} from './render-task-native-audio-compose-source-proof.mjs';
import {counterWindows} from './render-task-native-counter-b0a1-source-proof.mjs';
import {decodeSource as decodeInput,prove as proveInput} from './render-task-native-input-apu-source-proof.mjs';
import {proveMenuStack} from './render-menu-stack-proof.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
export const menuRoots=[0x80A6A5,0x80A6AD,0x80A6B8,0x80A6C7];
export const menuWindow={start:0x80A6A5,hex:'A9FFFF8DA71D801DA9FFFF8DA51D9CA71D80150A8D971DA9FFFF8DA51D9CA71D80099CA71D9CA51D9C971DA5028D991DA5048D9B1D9C951D9CA11D2017A6AC971D20F9A522A1B081201A9EADCE018DA31DADCA0129000CF019EEA11DADA11DC91400D011A913008DA11DADCA018DA31D80039CA11DADCE01890020F0034C26A889C0D0F0034CFFA7ADA31D890004F00BAC971DC8C8B708F078803B890008F009AC971DF06C8888802DADA71DD063ADCE01892000F00DAD951DF05638E506E506A88013891000F049A606AC951DC8C8B708F03ECAD0F75ACC951D90669838ED951D4AC506B052AC971D20DBA57A8C971D20F9A5D400D406A9FFFF8500A940008504A903008506A94A008502688506688500ADA71DF01FA00000B708F018B10C2DCE01D004C8C880F15AAC971D20DBA5688D971D802B4CE9A6AD951D1865066506800DAD951D38E506E506B003A900008D951D2067FA2017A68092AC971D20DBA5A9FFFF8500A940008504A903008506A94C008502206EC4AD971D4A8500201A9E60AC971D20DBA5A9FFFF8500201A9E60'};
export const requestWindows=[{start:0x80FA67,hex:'A600BF60207E0A0A0A69FF4F8D0A02BFA0207E0A0A0A0A8D0C02EEF60122BDAC8160'},
 {start:0x81ACBD,hex:'ADF601D0FB6B'}];
export const menuPins=[...new Map([menuWindow,...taskListSpecs.map(s=>s.window),...taskTextComposeWindows,
 ...audioPins,...counterWindows,...requestWindows].map(w=>[w.start,w])).values()];
export function decodeSource(bytes){
 const d=decodeTaskWindows(bytes,menuPins),input=decodeInput(bytes);
 for(const [pc,i] of input.map)if(pc>=0x809E1A&&pc<0x809E59)d.map.set(pc,i);
 return d;
}
export function prove(map,entry){
 if(!menuRoots.includes(entry))throw Error('Unproved menu root');assertPinnedTaskSource(map,menuPins);proveInput(map,0x809E1A);
 if(map.size!==1088||[...map.values()].reduce((n,i)=>n+i.raw.length,0)!==2304)throw Error('Whole menu source graph drift');
 const p=proveMenuStack(map,entry),original=proveMenuStack(map,entry,{sound:'original-002D'});
 if(p.minimum_protected_stack_bytes!==20||p.external_return_assumptions!==0
  ||p.reachable_instructions!==[1064,1064,1065,1062][menuRoots.indexOf(entry)])throw Error('Menu full conditional graph drift');
 return {...p,original_sound_proof:original,native_binding:false,local_source_complete:true,full_graph_closed:false,
  conditional_graph_closed:true,full_task_binding:false,global_stack_minimum:null,root_return:'RTS',
  source_closed_to_dispatch:false,return_target_executed:false,
  qualification:'Entire individually pinned2304byte/1088instruction original local/transitive menu graph. Conditional normal roots under fresh9E1A not3030 and original DP06=0003 writer lemma; original immutable002D and all-WORD sound profiles proved separately. Every reached own Task callee, actual PEI00/06/PHY/PLY/PHY-to-PLA/PHP/PLP/PHB/PEA/JSR/JSL/RTS/RTL and fresh matching return frames on one owner/budget/commit. Full WORD count/page/counter wraps, original Carry between paired ADC/SBC, fresh pointer/field/cache/held/edge data and chronological MMIO/wait/control records. Observed counter changes do not generate input/time/frames. Actual reset/nonroot audio return/stack mode/owner failures withhold every effect. No original caller/menu initialization/Native13/wholeTask/scene/frame or scriptbody claim.'};
}
export function requestProofs(map){return requestWindows.map(w=>{
 const subset=w.start===0x80FA67?new Map([...map].filter(([pc])=>requestWindows.some(r=>pc>=r.start&&pc<r.start+r.hex.length/2))):
  new Map([...map].filter(([pc])=>pc>=w.start&&pc<w.start+w.hex.length/2));
 return proveWordStack(subset,w.start,w.start===0x80FA67?'RTS':'RTL',{measureStack:true});
});}
