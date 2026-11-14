import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {decodeTaskWindows} from './task-partial-source.mjs';
import {menuPins,decodeSource as decodeMenu} from './render-task-native-menu-compose-source-proof.mjs';
import {taskNativeRenderSpec} from './task-native-render-spec.mjs';
import {renderComposeWindows} from './task-native-render-compose-source.mjs';
import {prove as proveInput} from './render-task-native-input-apu-source-proof.mjs';
import {proveActionsStack} from './render-menu-stack-proof.mjs';
export const actionsRoots=[0x8099EB,0x809BA0];
export const actionsWindow={start:0x8099EB,hex:'8565ADA61FF0028565A988708D6A1F9C981F9C821FA00200A565898000F016A9D970996A1FA9800099981FA9200099821FC8C8A565891000F016A9C570996A1FA9100099981FA9100099821FC8C8A565890200F016A98C70996A1FA9020099981FA9000099821FC8C8A565892000F016A9D170996A1FA9200099981FA9000099821FC8C8A565894000F016A9D470996A1FA9400099981FA9000099821FC8C8A565890001F016A9E370996A1FA9000199981FA9000099821FC8C8A565290006C90006D018A90971996A1FA9000699981FA9000099821FC8C8A5658038A565890002F016A9E670996A1FA9000299981FA9100099821FC8C8A565890004F016A9F170996A1FA9000499981FA9100099821FC8C8A565890020F016A9FD70996A1FA9002099981FA9000099821FC8C8A565890040F016A90371996A1FA9004099981FA9000099821FC8C8A565C003009062A90000996A1F984A6902008506A90C008500A903008502A90B008504A9000085082063F9A5008568A9010085026404A908008506A96A1F8508A97E00850AA9821F850C20A5A6A500C9FFFFD003A900000AA8B9981F48A5688500203EFA689CA61F60A90000609CA61FA50020EB99850060'};
export const actionsPins=[...new Map([actionsWindow,...menuPins,...taskNativeRenderSpec.windows,
 ...renderComposeWindows(0x80FA3E)].map(w=>[w.start,w])).values()];
export function decodeSource(bytes){
 const d=decodeTaskWindows(bytes,actionsPins),menu=decodeMenu(bytes);
 for(const [pc,i] of menu.map)if(pc>=0x809E1A&&pc<0x809E59)d.map.set(pc,i);
 return d;
}
export function prove(map,entry){
 if(!actionsRoots.includes(entry))throw Error('Unproved actions root');
 assertPinnedTaskSource(map,actionsPins);proveInput(map,0x809E1A);
 const p=proveActionsStack(map,entry),original=proveActionsStack(map,entry,{sound:'original-002D'});
 if(map.size!==1756||[...map.values()].reduce((n,i)=>n+i.raw.length,0)!==3802
  ||p.minimum_protected_stack_bytes!==(entry===0x8099EB?28:30)
  ||p.reachable_instructions!==(entry===0x8099EB?1727:1732)||p.external_return_assumptions!==0)
  throw Error('Whole actions source/stack drift');
 return {...p,original_sound_proof:original,native_binding:false,local_source_complete:true,full_graph_closed:false,
  conditional_graph_closed:true,full_task_binding:false,root_return:'RTS',global_stack_minimum:null,source_closed_to_dispatch:false,
  return_target_executed:false,qualification:'Whole original99EB options and Native13/9BA0 including actual F963/menu/FA3E and every owned native dependency. Real WORD mask refetch/table stores, mandatory entry and CPY3 gate, full0600 combined option, actual selected flag PHA/PLA across release, actual matched JSR/JSL/RTS/RTL/PHP/PLP/bank/index frames and byte widths. One private owner/budget/outer commit; all MMIO/wait/control events explicit chronological observations. Conditional normal graph excludes fresh3030 reset and nonroot zero-voice return. No original caller/Native58 metadata/argument/result/task resume/input/audio/device/time/wholeTask/scene/frame or scriptbody claim.'};
}
