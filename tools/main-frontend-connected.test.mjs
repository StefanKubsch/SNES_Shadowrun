import {withFrontendReference} from '../proof/frontend-reference/frontend.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {frontendSpecs} from './main-frontend-source.mjs';
import {sceneAnimationSpecs} from './main-scene-animation-source.mjs';
import {mainSceneSpecs} from './main-scene-source.mjs';
import {inputApuWindows} from './render-task-native-input-apu-source-proof.mjs';
import {decodeWindows,DialogTestMemory,rom,window} from './task-native-dialog-harness.mjs';
import {runReference} from './w65c816-reference.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';
import {FRONTEND_ROUTINES as FRONTEND_ROUTINES_TASK} from '../src/task/main-frontend.mjs';
import {runObservedNmi} from '../src/task/observed-nmi.mjs';
import {finishInterruptObservations} from '../src/task/main-wait-interrupt.mjs';
import {isIoAddress,isArithmeticRegister} from '../src/vm/devices.mjs';
import {SRAM_SIZE} from '../src/vm/memory.mjs';
import {saveGameSlot} from '../src/task/native-main-menu.mjs';
const FRONTEND_ROUTINES=withFrontendReference(FRONTEND_ROUTINES_TASK);

const select=(list,name)=>list.find(s=>s.name===name).windows;
const inputWindow={start:0x809E1A,hex:inputApuWindows[0].hex.slice(0,0x23*2)};
const observationWindows=[...select(sceneAnimationSpecs,'eebb'),inputWindow];
const map=decodeWindows([...frontendSpecs.flatMap(s=>s.windows),...select(mainSceneSpecs,'f298'),
  ...['eebb','eed5','eedd','eef1'].flatMap(name=>select(sceneAnimationSpecs,name)),inputWindow]);
const observationPcs=new Set(decodeWindows(observationWindows).keys());
const freeze=rows=>Object.freeze(rows.map(o=>Object.freeze({...o})));
const expand=trace=>trace.flatMap(o=>o.width===2?[{...o,width:1,value:o.value&255},{...o,width:1,address:o.address+1,value:o.value>>>8}]:[{...o,width:1}]);
function side(entry,initialA=0,save=false){const mem=new DialogTestMemory(new Uint8Array(0x20000),new Uint8Array(SRAM_SIZE),rom),
  vm={mem,a:initialA,x:0,y:0,s:0x1EF0,d:0,dbr:entry>>>16,p:0x43,pc:entry&65535},a=new TaskAccessor(vm);
  a.load();a.ctx.programBank=entry>>>16;a.trace=[];a.io=[];a.devices={write(){}};const h=dialogAccess(a);
  if(frontendSpecs.find(s=>s.entry===entry).rootReturn==='RTL')h.pushByte(0x80);h.push(0x1234,2);
  // Explicit initial audio-directory pointer, as in the other connected
  // fixtures. This is a supplied state, not a claim about reset/boot values.
  mem.wram.set(Buffer.from(window(0x98FFFA,0x98FFFD).hex,'hex'),0x8C);
  if(save){const before={...a.ctx};for(let at=0x2DE0;at<0x3D08;at++)mem.wram[at]=at*17&255;
    h.load(1);h.call(0x80CE19,0x81B17D,()=>saveGameSlot(h),true);Object.assign(a.ctx,before);}
  return {mem,vm,a,h};
}
function compare(entry,keys,initialA=0,save=false){const r=side(entry,initialA,save),n=side(entry,initialA,save),records=[],io=[],installed=[],callbacks=[],visits=new Set();
  const routines=new Map(FRONTEND_ROUTINES),ec16=routines.get(0x81EC16);let key=0,menuTicks=0;
  routines.set(0x81EC16,(h,e,rs)=>{const result=ec16(h,e,rs);installed.push(h.pointer(0x6E));return result;});
  const valueFor=(pc,address)=>{const port=address&65535;
    if(port===0x2140)return r.mem.read8(0x1CE4);
    if(port===0x2142)return pc===0x81E1B6?2:pc===0x81E510?3:0;
    if(port===0x4210)return 0x80;if(port===0x4212)return 0;if(port===0x4218)return key;
    if([0x2137,0x213C,0x213D].includes(port))return 0;
    assert.fail('unexpected frontend device '+pc.toString(16)+' '+address.toString(16));};
  const absoluteRead=r.a.absoluteRead;
  r.a.absoluteRead=(offset,width,pc)=>{const address=r.h.abs(offset);if(!isIoAddress(address)||isArithmeticRegister(address,false))return absoluteRead(offset,width,pc);
    const value=valueFor(pc,address);io.push({pc,address,width,value});r.a.trace.push({kind:'read',pc,address,width,value});return value;};
  // Only own LDA operands use the reference memory's byte reads. Shared
  // helper modules use absoluteRead above. Keep each WORD as one observation.
  const read=r.mem.read8.bind(r.mem);let pending=null;
  r.mem.read8=address=>{if(!isIoAddress(address)||isArithmeticRegister(address,false))return read(address);
    if(pending){assert.equal(address,pending.address+1);const value=pending.value>>>8;pending=null;return value;}
    const pc=r.a.ctx.programBank<<16|r.a.ctx.pc,width=r.a.ctx.status&0x20?1:2,value=valueFor(pc,address),o={pc,address,width,value};io.push(o);if(width===2)pending=o;return value&255;};
  const re={values:freeze([]),waitIndex:0,waitEvents:[],calls:[],inputs:freeze([]),inputIndex:0};
  const hooks=new Map([...map.keys()].map(pc=>[pc,()=>{r.a.ctx.programBank=pc>>>16;r.a.ctx.pc=pc&65535;visits.add(pc);
    if(!observationPcs.has(pc))return;const nmi=pc===0x81EECD;records.push({pc,nmi});if(!nmi)return;
    assert.ok(r.mem.read8(0x30)&0x80,'NMI after original enable');const caller=r.a.stackWord(2);
    key=caller===0xE2AA?(keys[menuTicks++]??(menuTicks%2?0:0x8000)):[0x80A18C,0x81D694,0x81DDDB].includes(entry)&&caller===0xDE3C?0x8000:0;
    callbacks.push(r.h.pointer(0x6E));const before={...r.a.ctx};runObservedNmi(r.a,re,routines);assert.deepEqual(r.a.ctx,before);
  }]));
  const calls=new Map([...routines].filter(([target])=>!map.has(target)).map(([target,run])=>[target,()=>{const result=run(r.h,re,routines);return {rawReturnWord:result?.rawReturnWord??result};}]));
  const original=runReference(map,r.mem,r.a.ctx,{entry,root:frontendSpecs.find(s=>s.entry===entry).rootReturn,calls,before:hooks,io:r.a.trace,limit:5_000_000});
  n.a.io=io;const e={...re,calls:[],waitEvents:[],interrupts:freeze(records),interruptIndex:0,interruptRoutines:FRONTEND_ROUTINES};
  FRONTEND_ROUTINES.get(entry)(n.h,e,FRONTEND_ROUTINES);finishInterruptObservations(e);
  assert.equal(n.a.ioIndex,io.length);assert.deepEqual(n.a.ctx,r.a.ctx);assert.deepEqual(n.mem.wram,r.mem.wram);assert.deepEqual(n.mem.sram,r.mem.sram);assert.deepEqual(expand(n.a.trace),expand(r.a.trace));
  assert.equal(n.a.ctx.s,0x1EF0);assert.equal(e.waitIndex,0);assert.equal(e.inputIndex,0);
  return {n,installed,callbacks,visits:original.visited,menuTicks,records,io};
}
test('whole frontend new game, disabled save rows and settings use real text, checksums, helpers and installed E6AE NMI',()=>{
  for(const keys of [[0x8000],[0x400,0,0x8000],[0x400,0,0x400,0,0x8000,0,0x8000,0,0x400,0,0x8000,0,0x400,0,0x8000,0,0x400,0,0x8000,0,0x8000]]){
    const {n,callbacks,menuTicks}=compare(0x81E14A,keys);assert.ok(callbacks.includes(0x81E6AE));assert.equal(n.a.ctx.a,0xFFFF,JSON.stringify({keys,menuTicks}));
  }
});
test('original credit/title early exits and A18C selection use the installed DD54 callback before the menu',()=>{
  for(const entry of [0x81DDDB,0x81D694,0x80A18C]){const {n,callbacks}=compare(entry,[0x8000],entry===0x80A18C?1:0);
    assert.ok(callbacks.includes(0x81DD54));assert.equal(n.a.ctx.a,entry===0x81DDDB?0x8000:entry===0x81D694?1:0xFFFF);
  }
});
test('load selection enables only the slot whose real B17D save passes B1AB and returns its original index',()=>{
  const {n,visits}=compare(0x81E14A,[0x400,0,0x8000,0,0x8000],0,true);assert.equal(n.a.ctx.a,1);
  assert.ok(visits.has(0x81B1AB));assert.equal(n.mem.read16(0x11A4),0x400);assert.equal(n.mem.read16(0x11A6),0);
});
