import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {decodeTaskWindows} from './task-partial-source.mjs';
import {proveAudioStack} from './render-audio-stack-proof.mjs';
import {inputApuWindows} from './render-task-native-input-apu-source-proof.mjs';
export const audioComposeWindows=[
 {start:0x80C46E,hex:'4BABA402B9B3C448CDE01CF00CC9008090078DE01C2230F181A5042016C4A906002207F081A606F01BECE21CF00A8EE21CA90F002207F081680900FFAAA905002207F08160'},
 {start:0x81F130,hex:'08890080D003827E00C210E2208598A00500B78CC9FFF06FC598F007C8C8C8C84C42F1C8C220B78C8589C8B78C858AA00000B7893A3A8592C8C8B7898596C8C8A592F043B789304185942000F1C8C8B789858FC8B78985905AA00000E220A910A6982207F0819CE61CA596203AF0A597203AF0B78F203AF0E696C8C494D0F4203AF0C2207A80B7286B29FF7F85940A482000F1FAE220A9102207F0819CE61CC220A5962022F1C8C8B7898598A59820E8F1C694D0F78286FF'},
 {start:0x81F100,hex:'8598A59238E598859260'},
 {start:0x81F122,hex:'48E22068203AF068203AF0C22060'},
 {start:0x81F1E8,hex:'48E22068203AF068203AF0C220E696E69660'},
 {start:0x81F03A,hex:'48ADE61CF01F9CE61CADE41CCD4021D0FB1AEBADE71C8D4121688D4221EB8D40218DE41C60688DE71CCEE61C60',initialM:1,finalM:1},
 inputApuWindows.find(w=>w.start===0x80C416),inputApuWindows.find(w=>w.start===0x81F007)];
const entries=[0x80C46E,0x81F130,0x81F100,0x81F122,0x81F1E8];
const apu=audioComposeWindows.at(-1);
export const pinWindows=[...audioComposeWindows.slice(0,-1),{start:apu.start,hex:apu.hex.slice(0,-2),finalM:1},{start:0x81F023,hex:'6B'}];
export const decodeSource=bytes=>decodeTaskWindows(bytes,pinWindows);
export function rootWindows(entry){
 if(!entries.includes(entry))throw Error('Unproved audio root');
 const starts=entry===0x80C46E?audioComposeWindows.map(w=>w.start):entry===0x81F130?[0x81F130,0x81F100,0x81F122,0x81F1E8,0x81F03A,0x81F007]:
  entry===0x81F100?[entry]:[entry,0x81F03A];
 return pinWindows.filter(w=>starts.includes(w.start)||(starts.includes(0x81F007)&&w.start===0x81F023));
}
export function prove(all,entry){
 const windows=rootWindows(entry),map=new Map([...all].filter(([pc])=>windows.some(w=>pc>=w.start&&pc<w.start+w.hex.length/2)));
 assertPinnedTaskSource(map,windows);
 const p=proveAudioStack(map,entry,entry===0x81F130?'RTL':'RTS',entry===0x80C46E?{anySoundNonzeroVoice:true}:{});
 if(p.reachable_instructions!==map.size||p.external_return_assumptions!==0
  ||p.minimum_protected_stack_bytes!==({[0x80C46E]:14,[0x81F130]:10,[0x81F100]:2,[0x81F122]:6,[0x81F1E8]:6})[entry])throw Error('Whole audio graph/stack drift');
 return {...p,native_binding:false,local_source_complete:true,full_graph_closed:entry!==0x80C46E,
  conditional_graph_closed:true,full_task_binding:false,global_stack_minimum:null,source_closed_to_dispatch:false,
  root_return:entry===0x81F130?'RTL':'RTS',return_target_executed:false,
  ...(entry===0x80C46E?{zero_voice_boundary:{at:'80:C4B2',predicate:'fresh DP06 WORD is zero',raw_return:'actual saved sound WORD, not root return',preceding_effects_published:false}}:{}),
  qualification:'Every original audio root and actual reached helper byte individually pinned, including whole F03A BYTE pair and F007 M0/M1. Physical WORD-PHA/two BYTE-PLAs, PHY/PLY, PHP/PLP, JSR/JSL/RTS/RTL on one Task owner/budget/commit; fresh pointer/header/payload/length/count/token/voice/cache reads and matching actual inner return frames. No count/directory bounds or repaired carry/WORD/BYTE wraps. C46E normal return graph conditional on fresh nonzero voice; zero voice actual saved-sound RTS remains an atomic boundary, never assumed to be root RTS. MMIO acknowledgements/products individually chronological. Synthetic fixtures and original source bytes do not prove original initialization/audio/clock/caller/menu/Native13/wholeTask/scene/frames or scriptbodies.'};
}
