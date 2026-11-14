import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareSlotMotion} from '../proof/state/slot-motion.mjs';
import {createSlotState} from '../proof/state/slots.mjs';
import {createSlotDefinitions} from '../proof/state/slot-definitions.mjs';
import {createSlotActionData} from '../proof/state/slot-action-data.mjs';
import {createSlotTargetData} from '../proof/state/slot-target-data.mjs';
import {createACState} from '../proof/state/ac-state.mjs';
import {createScriptState} from '../proof/state/script-state.mjs';
import {createScriptScheduler} from '../proof/script/scheduler.mjs';
import {createTaskFrameAllocator,createTaskFrameProfiles} from '../proof/script/task-frames.mjs';
import {visitTailWithState,sweepWithState} from '../proof/state/host.mjs';
const source=(overrides={})=>({'7E:40E0':0,'1458':0,'0E28':0,'0E80':0,'0ED8':0x100,'0D20':0,'0D78':0,'0DD0':0,...overrides});
const make=(fields=source(),offset=0)=>{const slots=createSlotState();slots.seedSlotFields(offset,Object.fromEntries(Object.entries(fields).filter(([,value])=>value!==null)));return slots;};
const load=async name=>JSON.parse(await readFile(new URL(`../assets/${name}.json`,import.meta.url),'utf8'));
const original=await load('scripts');const profiles=createTaskFrameProfiles(await load('task-frame-profiles'));

test('All first/second motion words add modulo65536 with independent carries and fresh sum before logical half',()=>{
 for(let n=0;n<=0xFFFF;n++){
  const fields=source({'0E28':0xFFFF,'0E80':0x8000,'0D20':n,'0D78':n^0xFFFF});const plan=prepareSlotMotion(fields);assert.equal(plan.handled,true);
  const first=Number((65535n+BigInt(n))%65536n);const second=Number((32768n+BigInt(n^0xFFFF))%65536n);
  assert.equal(plan.fields['0E28']??fields['0E28'],first);assert.equal(plan.fields['0E80']??fields['0E80'],second);
  assert.equal(plan.fields['0F30'],Number(((BigInt(first)+BigInt(second))%65536n)/2n));
 }
});

test('Every third-word result observes the unsigned0100 boundary, restores old value and handles decrement before addition',()=>{
 for(const flags of [0,0x20])for(let target=0;target<=0xFFFF;target++){
  const motion=Number((BigInt(target)-257n+65536n+BigInt(flags?1:0))%65536n);
  const plan=prepareSlotMotion(source({'1458':flags,'0ED8':257,'0DD0':motion}));assert.equal(plan.handled,true);
  assert.equal(plan.fields['0ED8']??257,target<256?257:target);
  assert.equal(plan.fields['0DD0']??motion,target<256?0:flags?Number((BigInt(motion)+65535n)%65536n):motion);
  assert.equal(plan.scratchWord6B,257);
 }
 for(const old of [0,1,64,255]){const plan=prepareSlotMotion(source({'0ED8':old,'0DD0':0}));assert.equal(plan.fields['0ED8'],old);assert.equal(plan.fields['0DD0'],0);}
});

test('All flag words clear only0008;0040 is supported when no helper is reached,0400 does not skip the body',()=>{
 for(let flags=0;flags<=0xFFFF;flags++){
  const plan=prepareSlotMotion(source({'1458':flags,'0ED8':0x200}));
  if((flags&0x60)===0x60)assert.deepEqual(plan,{handled:false,reason:'slot_motion_helper_required',requiredHelper:'80:82BC'});
  else{assert.equal(plan.handled,true);assert.equal(plan.fields['1458'],flags&0xFFF7);}
 }
 const fields=source({'1458':0x408,'0D20':4});assert.equal(prepareSlotMotion(fields).fields['0E28'],4);
});

test('Each exact prelude/axis/helper boundary retains every live slot and global field, including carry-selected helper IDs',()=>{
 const cases=[['80:80B2',{'1458':0x40,'0D20':1}],['80:8133',{'1458':0x40,'0E28':1,'0D20':0xFFFF}],['80:81B4',{'1458':0x40,'0D78':1}],['80:8238',{'1458':0x40,'0E80':1,'0D78':0xFFFF}],['80:82BC',{'1458':0x40,'0DD0':1}]];
 for(const [entry,overrides]of cases){const slots=make(source(overrides));const before=slots.snapshot();assert.deepEqual(slots.stepMotion(0),{handled:false,reason:'slot_motion_helper_required',requiredHelper:entry});assert.deepEqual(slots.snapshot(),before);}
 const prelude=make(source({'7E:40E0':1}));const unchanged=prelude.snapshot();assert.deepEqual(prelude.stepMotion(0),{handled:false,reason:'slot_motion_source_required',field:'7E:4138'});assert.deepEqual(prelude.snapshot(),unchanged);
 const slots=make(source({'1458':0x40,'0ED8':255}));assert.deepEqual(slots.stepMotion(0),{handled:true});assert.equal(slots.snapshot().columns['0DD0'][0],0);
});

test('Any missing required source keeps all data unchanged, with early prelude source and helper precedence',()=>{
 for(const key of Object.keys(source())){const slots=make(source({[key]:null}));const before=slots.snapshot();assert.deepEqual(slots.stepMotion(0),{handled:false,reason:'slot_motion_source_required',field:key});assert.deepEqual(slots.snapshot(),before);}
 const unknown=Object.fromEntries(Object.keys(source()).map(k=>[k,null]));assert.deepEqual(prepareSlotMotion({...unknown,'7E:40E0':1}),{handled:false,reason:'slot_motion_helper_required',requiredHelper:'80:C9E0'});
});

test('All44 offsets update exactly the source columns and global6B, with no occupancy, list, pool, workspace or D9-scratch effects',()=>{
 const fields=source({'1458':0x28,'0E28':0x100,'0D20':0xFFFF,'0E80':0xFFFF,'0D78':2,'0ED8':300,'0DD0':10});
 for(let offset=0;offset<=0x56;offset+=2){const slots=make(fields,offset);const expected=slots.snapshot();for(const [key,value]of Object.entries({'1458':0x20,'0E28':255,'0E80':1,'0ED8':309,'0DD0':9,'0F30':128}))expected.columns[key][offset/2]=value;expected.motionSource.scratchWord6B=300;assert.deepEqual(slots.stepMotion(offset),{handled:true});assert.deepEqual(slots.snapshot(),expected);}
});

test('Motion plans and snapshots are copied; invalid fields/offsets fail before effects',()=>{
 const fields=source();const before={...fields};const plan=prepareSlotMotion(fields);plan.fields['1458']=123;assert.deepEqual(fields,before);
 for(const bad of [undefined,null,[],{...fields,'0D20':-1},{...fields,'0DD0':65536},{...fields,'0E28':undefined}])assert.throws(()=>prepareSlotMotion(bad),/Invalid slot motion fields/);
 const slots=make();const snapshot=slots.snapshot();for(const offset of [-1,65536,1.5,undefined,'0'])assert.throws(()=>slots.stepMotion(offset),/Invalid slot motion offset/);for(const offset of [1,0x57,0x58,0xFFFF])assert.deepEqual(slots.stepMotion(offset),{handled:false,reason:'slot_window_required'});assert.deepEqual(slots.snapshot(),snapshot);
 slots.stepMotion(0);const copy=slots.snapshot();copy.motionSource.scratchWord6B=123;assert.equal(slots.snapshot().motionSource.scratchWord6B,0x100);
});

test('Real A9/252/217/D9 slot needs8133; explicit clear0040 fixture permits body steps without touching waiting tasks or their allocator',async()=>{
 const definitions=createSlotDefinitions(await load('slot-definitions'));const actionData=createSlotActionData(await load('slot-action-data'));const targetData=createSlotTargetData(await load('slot-target-data'));
 const slots=createSlotState({definitionData:definitions,actionData,targetData});slots.seedTargetPointer(targetData.deriveF3From9D(0x99807E).pointer);
 const parent=slots.applyNative({nativeId:0xA9,args:[11,123,456,64,0xFFFF],returnBytes:2});const ac=createACState();ac.seed(38,[0,0]);const state=createScriptState({byteLength:0x58,slotState:slots,acState:ac});state.seed(0x56,[0x38,0x12]);
 const allocator=createTaskFrameAllocator({profileData:profiles});const scheduler=createScriptScheduler(original,{frameAllocator:allocator});scheduler.addTask(0x252,[0,0,0,0,parent.value]);visitTailWithState(scheduler,state);sweepWithState(scheduler,state);sweepWithState(scheduler,state);
 const tasks=scheduler.snapshot();const memory=allocator.snapshot();const before=slots.snapshot();assert.equal(before.columns['1458'][42],0x61);
 assert.deepEqual(slots.stepMotion(0x54),{handled:false,reason:'slot_motion_helper_required',requiredHelper:'80:8133'});assert.deepEqual(slots.snapshot(),before);
 // Explicit synthetic flag fixture, not an original scene or collision result.
 slots.seedSlotFields(0x54,{'1458':0x21});assert.deepEqual(slots.stepMotion(0x54),{handled:true});
 const first=slots.snapshot();assert.deepEqual(['0E28','0E80','0ED8','0DD0','0F30'].map(k=>first.columns[k][42]),[330,1496,1725,1453,913]);assert.equal(first.motionSource.scratchWord6B,272);
 for(const [id,value]of [[0x4F,82],[0x50,374],[0x51,431]])assert.equal(slots.applyNative({nativeId:id,args:[0x54],returnBytes:2}).value,value);
 slots.stepMotion(0x54);const second=slots.snapshot();assert.deepEqual(['0E28','0E80','0ED8','0DD0','0F30'].map(k=>second.columns[k][42]),[176,1168,3177,1452,672]);assert.equal(second.motionSource.scratchWord6B,1725);
 assert.deepEqual(second.targetSource,before.targetSource);assert.deepEqual(scheduler.snapshot(),tasks);assert.deepEqual(allocator.snapshot(),memory);
 for(const key of ['0E28','0E80','0ED8'])assert.equal(second.columns[key][43],before.columns[key][43]);
});
