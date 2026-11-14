import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createScriptTask} from '../proof/script/task.mjs';
import {createScriptScheduler} from '../proof/script/scheduler.mjs';
import {createSlotState} from '../proof/state/slots.mjs';
import {createSlotTargetData} from '../proof/state/slot-target-data.mjs';
import {createScriptState} from '../proof/state/script-state.mjs';
import {createTaskFrameAllocator,createTaskFrameProfiles} from '../proof/script/task-frames.mjs';
import {runTaskWithState,visitTailWithState,sweepWithState} from '../proof/state/host.mjs';

const load=async name=>JSON.parse(await readFile(new URL(`../assets/${name}.json`,import.meta.url),'utf8'));
const original=await load('scripts');const data=createSlotTargetData(await load('slot-target-data'));
const word=n=>[0x14,n&255,n>>>8];
const native=(id,args=[])=>[...args.toReversed().flatMap(word),0x58,id];
const bundle=bytecode=>({...original,scripts:original.scripts.map(s=>s.id===2?{...s,bytecode:[...bytecode,0x56]}:s)});
const make=()=>{const slots=createSlotState({targetData:data});slots.seedTargetPointer(0x99811A);slots.seedSlotFields(0,{'0E28':484,'0E80':1824,'0ED8':272});return {slots,state:createScriptState({byteLength:2,slotState:slots})};};

test('Every native dispatch is observed once, including wait registration, zero-mask removal and resumed script execution',()=>{
 const calls=[];const options={onNativeDispatch:id=>calls.push(id)};
 const task=createScriptTask(bundle([...native(0x11),...native(0x9F,[1,1]),0xC0,...native(0x11),0x56]),2);
 const first=task.run(options);assert.deepEqual(calls,[0x11]);task.run(options);assert.deepEqual(calls,[0x11]);
 task.completeNative(first.pending.requestId,null,options);assert.deepEqual(calls,[0x11,0x9F]);
 const next=task.tick(0,options);assert.deepEqual(calls,[0x11,0x9F,0x11]);assert.equal(next.pending.requestId,2);
 const zero=createScriptTask(bundle(native(0x9F,[0,1])),2);assert.equal(zero.run(options).status,'removed');assert.deepEqual(calls,[0x11,0x9F,0x11,0x9F]);
});

test('Host preserves D9 A2 only until a subsequent dispatch; standalone and scheduler wait paths invalidate only A2',()=>{
 for(const wait of [false,true])for(const useScheduler of [false,true]){
  const {slots,state}=make();const script=bundle([...native(0xD9,[0,0]),...(wait?[...native(0x9F,[1,1])]:native(0x11)),0x56]);
  if(useScheduler){const scheduler=createScriptScheduler(script);scheduler.addTask(2);visitTailWithState(scheduler,state);}else runTaskWithState(createScriptTask(script,2),state);
  const scratch=slots.snapshot().targetSource.scratchWords;
  assert.deepEqual(scratch,{A2:null,A5:31516,A8:0xFFFF,AB:0xFFFF,AE:0xFFFF,B1:1456,B4:51204,B7:35844,BA:4});
 }
 const {slots}=make();slots.applyNative({nativeId:0xD9,args:[0,0],returnBytes:2});assert.equal(slots.snapshot().targetSource.scratchWords.A2,14816);
});

test('Missing-source retries do not replay dispatch invalidation; invalid observers fail before task or scheduler completion mutation',()=>{
 const task=createScriptTask(bundle(native(0x11)),2);const before=task.snapshot();assert.throws(()=>task.run({onNativeDispatch:1}),/Invalid native dispatch observer/);assert.deepEqual(task.snapshot(),before);
 const pending=task.run();assert.throws(()=>task.completeNative(pending.pending.requestId,null,{onNativeDispatch:1}),/Invalid native dispatch observer/);assert.deepEqual(task.snapshot(),pending);
 const waiter=createScriptTask(bundle(native(0x9F,[1,1])),2);const waiting=waiter.run();assert.throws(()=>waiter.tick(0,{onNativeDispatch:1}),/Invalid native dispatch observer/);assert.deepEqual(waiter.snapshot(),waiting);
 const scheduler=createScriptScheduler(bundle(native(0x11)));scheduler.addTask(2);const first=scheduler.visitTail();assert.throws(()=>scheduler.completeNative(first.pending.taskId,first.pending.requestId,null,{onNativeDispatch:1}),/Invalid native dispatch observer/);assert.deepEqual(scheduler.snapshot(),first);
 const {slots,state}=make();const blocked=createScriptTask(bundle(native(0xD9,[0,1])),2);slots.seedTargetPointer(0x9B8000);const result=runTaskWithState(blocked,state);const snapshot=slots.snapshot();assert.equal(result.boundary.reason,'slot_target_data_window_required');assert.deepEqual(runTaskWithState(blocked,state).execution,result.execution);assert.deepEqual(slots.snapshot(),snapshot);
});

test('Original shared native-pointer write and indirect jump bytes are pinned, independent of instruction names',async()=>{
 const rom=await readFile(new URL('../Shadowrun (E).smc',import.meta.url));assert.equal(rom.subarray(0x7500,0x7509).toString('hex'),'bfb8d78285a2202ff5');assert.equal(rom.subarray(0x752F,0x7532).toString('hex'),'6ca200');
});

test('Initial tail and reverse sweep dispatches invalidate A2, with the real shared allocator and without external completion',async()=>{
 const profiles=createTaskFrameProfiles(await load('task-frame-profiles'));
 for(const sweep of [false,true]){
  const {slots,state}=make();slots.applyNative({nativeId:0xD9,args:[0,0],returnBytes:2});
  const allocator=createTaskFrameAllocator({profileData:profiles});const scheduler=createScriptScheduler(bundle([...native(0x9F,[1,2]),0xC0,0x56]),{frameAllocator:allocator});scheduler.addTask(2);
  if(sweep){sweepWithState(scheduler,state);assert.equal(slots.snapshot().targetSource.scratchWords.A2,14816);sweepWithState(scheduler,state);}else visitTailWithState(scheduler,state);
  assert.equal(slots.snapshot().targetSource.scratchWords.A2,null);
  slots.applyNative({nativeId:0xD9,args:[0,0],returnBytes:2});
  if(!sweep)sweepWithState(scheduler,state);
  sweepWithState(scheduler,state);assert.equal(slots.snapshot().targetSource.scratchWords.A2,14816); // A readiness check is not a dispatch.
 }
 const scheduler=createScriptScheduler(bundle(native(0x11)));scheduler.addTask(2);const before=scheduler.snapshot();
 for(const method of ['visitTail','sweep']){assert.throws(()=>scheduler[method]({onNativeDispatch:1}),/Invalid native dispatch observer/);assert.deepEqual(scheduler.snapshot(),before);}
});
