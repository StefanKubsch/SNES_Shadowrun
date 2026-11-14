import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {decodeTaskWindows} from './task-partial-source.mjs';
import {decode} from './disassemble.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
import {proveInput9E1A} from './render-9e1a-proof.mjs';
import {proveAudioStack} from './render-audio-stack-proof.mjs';
export const inputApuWindows=[
 {start:0x809E1A,hex:'ADCA014DCC012DCA018DCE01ADCA018DCC01C93030F00C290F00F0069CCA019CCE0160F48080ABABA900002207F081F48080ABABE2309C004238FB5C82E380'},
 {start:0x81F007,hex:'08E220EBADE41CCD4021D0FB8E42211AEB8D4121EB8D40218DE41C286B'},
 {start:0x80C416,hex:'8D0242A98000A6003025BD800E38FD280E186900061003A9000038EDC40C900C4A4AC9FF009008A9FF008003A90000E2204A8D0342497F48EAAD1742EB688D0342EAEAEAAD1742C220AA60'}];
const [input,apu,pan]=inputApuWindows;
const pinWindows=[{start:input.start,hex:input.hex.slice(0,-8),finalM:1,finalX:1},
 {start:0x809E55,hex:input.hex.slice(-8),initialM:1,initialX:1,finalM:1,finalX:1},
 {start:apu.start,hex:apu.hex.slice(0,-2),finalM:1},{start:0x81F023,hex:'6B'},pan];

// Fixed source decode only. These two original status transitions are
// individually pinned; this tool never executes runtime CPU instructions.
export function decodeSource(bytes){
 const d=decodeTaskWindows(bytes,pinWindows);
 d.map.set(0x809E55,decode(bytes,0x809E55,{e:1,m:1,x:1}));return d;
}
export function prove(all,entry){
 if(![input.start,apu.start,pan.start].includes(entry))throw Error('Unproved input/APU root');
 const roots=entry===input.start?[input,apu]:[entry===apu.start?apu:pan];
 const map=new Map([...all].filter(([pc])=>roots.some(w=>pc>=w.start&&pc<w.start+w.hex.length/2)));
 const e1=map.get(0x809E55),pins=pinWindows.filter(w=>roots.some(r=>w.start>=r.start&&w.start<r.start+r.hex.length/2));
 if(entry===input.start&&(e1?.state.e!==1||e1.state.m!==1||e1.state.x!==1))throw Error('Original reset E1 mode required');
 const normalized=new Map(map);if(e1)normalized.set(0x809E55,{...e1,state:{...e1.state,e:0}});
 assertPinnedTaskSource(normalized,pins);
 const p=entry===input.start?proveInput9E1A(map):proveWordStack(map,entry,entry===apu.start?'RTL':'RTS',{measureStack:true});
 if(p.reachable_instructions!==map.size||p.external_return_assumptions!==0)throw Error('Input/APU whole local source drift');
 if(entry===input.start&&(p.protected_with_root_jsr_bytes!==6||p.terminals.length!==1||p.terminals[0].to!=='80:E382'))throw Error('Reset boundary drift');
 if(entry!==input.start&&p.minimum_protected_stack_bytes!==(entry===apu.start?4:3))throw Error('Input/APU local stack drift');
 const byteEntry=entry===apu.start?proveAudioStack(map,entry,'RTL',{entryM:1}):null;
 if(byteEntry&&(byteEntry.reachable_instructions!==15||byteEntry.minimum_protected_stack_bytes!==4
  ||byteEntry.returns.some(r=>r.m!==1||r.x!==0||r.dbr!=='entry')))throw Error('Original F007 BYTE-entry restore drift');
 return {...p,...(byteEntry?{byte_entry_proof:byteEntry}:{}),native_binding:false,local_source_complete:true,full_graph_closed:entry!==input.start,
  normal_graph_closed:true,full_task_binding:false,global_stack_minimum:null,root_return:entry===apu.start?'RTL':'RTS',
  return_target_executed:false,source_closed_to_dispatch:false,
  ...(entry===input.start?{native_reset_completed:false,native_reset_boundary:{at:'80:9E2F',to:'80:9E3D',startup:'80:E382',predicate:'fresh full WORD01CA equals3030',preceding_effects_published:false}}:{}),
  qualification:'Individually pinned full original local source, actual bank00 status/data/RTS/RTL bytes on one private Task owner/budget/commit. F007 complete BYTEtoken/freshBYTEack/WORDX/command/token/PHP/PLP/RTL; C416 full wrapping coordinate/clamp graph and physical BYTE-PHA/PLA with individually observed products.9E1A complete normal filtering/return paths; exact3030 rejects all preceding effects before nonreturn reset/startup, not an assumed RTS. Original caller/input/device/time/audio/wholeTask/scene/frames and scriptbodies remain separate; intact stack structural proof is not alias exclusion.'};
}
