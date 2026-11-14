import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {decodeTaskWindows} from './task-partial-source.mjs';
import {proveAudioStack} from './render-audio-stack-proof.mjs';
import {taskRandomTableSources} from '../src/task/native-random-tables.mjs';
export const randomWindows=[
 {start:0x80C51F,hex:'A500F01C8502A2FEFFE8E80A90FBBD40C585042060C5A5002504C502B0F5850060'},
 {start:0x80C560,hex:'08E230ACE81CAD3721B98DC54F761C7E85004D3C21A8B98DC54F771C7E85014D3D21CDE81CD0011A8DE81C28',finalM:1,finalX:1},
 {start:0x80C58C,hex:'60'}];
export const randomTables=taskRandomTableSources;
export const randomAnchors=[{kind:'pointer',start:0x82D834,hex:'1FC5'},
 {kind:'argument-metadata',start:0x82DA8A,hex:'0102'},{kind:'return-metadata',start:0x82D9AE,hex:'0200'}];
export const random63Anchors=[{kind:'pointer',start:0x82D87E,hex:'60C5'},
 {kind:'argument-metadata',start:0x82DAAF,hex:'0001'},{kind:'return-metadata',start:0x82D9D3,hex:'0200'}];
export const decodeSource=bytes=>decodeTaskWindows(bytes,randomWindows);
export function prove(all,entry){
 if(![0x80C51F,0x80C560].includes(entry))throw Error('Unproved random root');
 const windows=entry===0x80C560?randomWindows.slice(1):randomWindows;
 const map=new Map([...all].filter(([pc])=>windows.some(w=>pc>=w.start&&pc<w.start+w.hex.length/2)));
 assertPinnedTaskSource(map,windows);const p=proveAudioStack(map,entry,'RTS');
 if(p.reachable_instructions!==map.size||p.external_return_assumptions!==0||p.minimum_protected_stack_bytes!==(entry===0x80C51F?5:3))
  throw Error('Whole random graph/stack drift');
 return {...p,native_binding:false,local_source_complete:true,full_graph_closed:true,full_task_binding:false,global_stack_minimum:null,
  root_return:'RTS',source_closed_to_dispatch:false,return_target_executed:false,
  qualification:'Pinned whole original C51F range and C560 BYTE helper, both original tables separately pinned. Real JSR C534/PHP/PLP/RTS, X/Y truncation and fresh WORD comparison/limit/mask/DP result/state reads. Each discarded2137 latch read and213C/213D BYTE value is an independent external observation per reached attempt; no RNG/device/time/termination inference. Budget exhaustion withholds all effects; source structural minimum assumes intact disjoint stack and is not alias exclusion. Originalcaller/initialization/Task/scene/frames and scriptbodies remain separate.'};
}
