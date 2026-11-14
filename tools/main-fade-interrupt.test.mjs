import test from 'node:test';
import assert from 'node:assert/strict';
import {matrixNmiSpecs} from './main-matrix-nmi-source.mjs';
import {sceneAnimationSpecs,proveSceneAnimation} from './main-scene-animation-source.mjs';
import {sceneVideoSpecs} from './main-scene-video-source.mjs';
import {mainSceneSpecs} from './main-scene-source.mjs';
import {inputApuWindows} from './render-task-native-input-apu-source-proof.mjs';
import {decodeWindows,DialogTestMemory,rom,window} from './task-native-dialog-harness.mjs';
import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {runReference} from './w65c816-reference.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';
import {runObservedNmi} from '../src/task/observed-nmi.mjs';
import {runInterruptFadePoll,finishInterruptObservations} from '../src/task/main-wait-interrupt.mjs';
import {playCutscene} from '../proof/cutscene-reference/cutscene-scene.mjs';
import {SCENE_REFERENCE_ROUTINES as MAIN_SCENE_ROUTINES} from '../proof/scene-reference-routines.mjs';

const fadeWindow={start:0x81CF4C,hex:'ADA311D0FB',initialM:1,initialX:0,finalM:1,finalX:0};
const callback=sceneAnimationSpecs.find(s=>s.name==='d479');
const nmiWindows=[...matrixNmiSpecs[2].windows,...callback.windows,...sceneVideoSpecs.find(s=>s.name==='ed8b').windows];
const nmi=decodeWindows(nmiWindows),poll=decodeWindows([fadeWindow]);
const freeze=list=>Object.freeze(list.map(o=>Object.freeze({...o})));
const expand=trace=>trace.flatMap(o=>o.width===2?[{...o,width:1,value:o.value&255},{...o,width:1,address:o.address+1,value:o.value>>>8}]:[{...o,width:1}]);
function side({dbr=0x80,p=0x61,brightness=2,target=0,s=0x1EF0,scroll=3,step=2,goal=9,position=0xFFFE,direction=0}={}){
  const mem=new DialogTestMemory(new Uint8Array(0x20000),null,rom);
  for(const [at,value]of [[0x6E,0xD479],[0x14,0x1234],[0x16,scroll],[0x18,step],[0x1A,goal],[0x1C,position],[0x1E,direction],[0x1C76,0xFFFF]])mem.write16(at,value);
  mem.write8(0x70,0x81);mem.write8(0x11A2,target);mem.write8(0x11A3,brightness);mem.write8(0x11A4,0xB9);
  const a=new TaskAccessor({mem,a:0xA55A,x:0xDEAD,y:0xBEEF,s,d:0,dbr,p,pc:0xCF4C});a.load();
  if(p&0x10){a.ctx.x&=255;a.ctx.y&=255;}
  a.ctx.programBank=0x81;a.trace=[];a.io=[];a.devices={write(){}};return {mem,a,h:dialogAccess(a)};
}
function deviceValues(dbr,value){return [
  ...(dbr===0x7E?[]:[{pc:0x00C118,address:dbr<<16|0x4210,width:2,value:0xAB80}]),
  {pc:0x809E0B,address:0x4212,width:2,value:0x8101},{pc:0x809E0B,address:0x4212,width:2,value:0xFF00},
  {pc:0x809E13,address:0x4218,width:2,value},
];}
function referenceIo(v){let byte=0;const read=v.mem.read8.bind(v.mem);
  v.mem.read8=address=>{const o=v.a.io[v.a.ioIndex];if(o&&address===o.address+byte){const value=o.value>>>(byte++*8)&255;
    if(byte===o.width){v.a.ioIndex++;byte=0;}return value;}return read(address);};
}
function originalNmi(v,value){const {a,h}=v,before={...a.ctx};a.io.push(...deviceValues(a.ctx.bank,value));
  h.pushByte(a.ctx.programBank);h.push(a.ctx.pc,2);h.pushByte(a.ctx.status);a.ctx.status=(a.ctx.status|4)&~8;a.ctx.programBank=0;
  runReference(nmi,v.mem,a.ctx,{entry:0x00C112,root:'RTI',io:a.trace});assert.deepEqual(a.ctx,before);
}
function comparePoll(options,choose){const r=side(options),n=side(options),records=[],hits=new Map();referenceIo(r);
  const stop=Symbol('CF51 fallthrough'),hooks=new Map([...poll.keys()].map(pc=>[pc,()=>{
    const hit=(hits.get(pc)??0)+1;hits.set(pc,hit);const value=choose(pc,hit);records.push({pc,nmi:value!==null});
    r.a.ctx.programBank=0x81;r.a.ctx.pc=pc&65535;if(value!==null)originalNmi(r,value);
  }]));hooks.set(0x81CF51,()=>{throw stop;});
  // The fallthrough is an actual original instruction, not an invented return.
  const map=new Map([...decodeWindows(mainSceneSpecs[0].windows)]);
  try{runReference(map,r.mem,r.a.ctx,{entry:0x81CF4C,before:hooks,io:r.a.trace});assert.fail('missing stop');}catch(e){if(e!==stop)throw e;}
  n.a.io=r.a.io;const e={interrupts:freeze(records),interruptIndex:0,interruptRoutines:MAIN_SCENE_ROUTINES,
    values:freeze([{pc:0x81CF4C,address:n.h.abs(0x11A3),width:1,value:77}]),waitIndex:0,waitEvents:[]};
  runInterruptFadePoll(n.h,e);finishInterruptObservations(e);
  assert.deepEqual(n.a.ctx,r.a.ctx);assert.deepEqual(n.mem.wram,r.mem.wram);assert.deepEqual(expand(n.a.trace),expand(r.a.trace));
  assert.equal(n.a.ioIndex,r.a.io.length);assert.equal(r.a.ioIndex,r.a.io.length);assert.equal(e.waitIndex,0);assert.deepEqual(e.waitEvents,[]);
  return {n,r,e,records};
}
test('fade poll and full callback retain pinned original BYTE loop, helper frames and NMI vector graph',()=>{
  assertPinnedTaskSource(poll,[fadeWindow]);assertPinnedTaskSource(nmi,nmiWindows);proveSceneAnimation(decodeWindows(callback.windows),callback);
  assert.equal(poll.get(0x81CF4C).mnemonic,'LDA');assert.equal(poll.get(0x81CF4F).target,0x81CF4C);
});
test('D479 completes the whole observed NMI to RTI across caller modes, banks and scroll branches',()=>{
  for(const dbr of [0,0x80,0x81,0x7E])for(const p of [0,0x20,0x30,0xB7])for(const [scroll,goal,step]of [[5,5,3],[3,9,2],[3,9,7],[9,3,2],[9,3,7],[9,3,10],[65534,65535,2]]){
    const options={dbr,p,scroll,goal,step,direction:scroll&1?0x8000:0},n=side(options),r=side(options);referenceIo(r);
    // Include original hardware stack wrap and an interrupted nonzero DP.
    n.a.ctx.s=r.a.ctx.s=scroll&1?3:0x1EF0;n.a.ctx.d=r.a.ctx.d=0x1234;
    originalNmi(r,0x8000);n.a.io=r.a.io;const before={...n.a.ctx};runObservedNmi(n.a,null,MAIN_SCENE_ROUTINES);
    assert.deepEqual(n.a.ctx,before);assert.deepEqual(n.a.ctx,r.a.ctx);assert.deepEqual(n.mem.wram,r.mem.wram);
    assert.deepEqual(expand(n.a.trace),expand(r.a.trace));assert.equal(n.a.ioIndex,r.a.io.length);
    assert.equal(n.mem.read8(0x11A3),1);assert.equal(n.mem.read8(0x11A4),0xB9);assert.equal(n.mem.read16(0x1CA),0x8000);
  }
});
test('BYTE fade preserves high A, fresh callback values and pre-interrupt LDA/BNE flags',()=>{
  for(const dbr of [0,0x80,0x81,0x7E])for(const phase of [0x81CF4C,0x81CF4F])for(const brightness of [0,1,3,0x80,0xFF]){
    const {n,records}=comparePoll({dbr,brightness,p:0x61},(pc,hit)=>pc===phase&&hit<=brightness+1?hit&1?0x8000:0x4000:null);
    assert.equal(n.mem.read8(0x11A3),0);assert.equal(n.mem.read8(0x11A4),0xB9);assert.equal(n.a.ctx.a,0xA500);
    assert.equal(n.a.ctx.status&0x82,2);assert.equal(n.a.ctx.s,0x1EF0);
    assert.equal(records.filter(o=>o.pc===0x81CF4C).length,phase===0x81CF4F?brightness+1:Math.max(1,brightness));
  }
});
test('fade refuses absent occurrences and device values without accepting old BYTE writers',()=>{
  const v=side({p:0x20});const old=freeze([{pc:0x81CF4C,address:0x8011A3,width:1,value:0}]);
  for(const interrupts of [undefined,[],freeze([{pc:0x81CF4F,nmi:true}]),[{pc:0x81CF4C,nmi:false}]]){
    const e={interrupts,interruptIndex:0,values:old,waitIndex:0,waitEvents:[]};
    assert.throws(()=>runInterruptFadePoll(v.h,e),error=>error.reason==='wait_interrupt_observation_required');assert.equal(v.mem.read8(0x11A3),2);
  }
  assert.throws(()=>runInterruptFadePoll(v.h,{interrupts:freeze([{pc:0x81CF4C,nmi:true}]),interruptIndex:0,interruptRoutines:MAIN_SCENE_ROUTINES}),e=>e.reason==='device_observation_required');
  assert.equal(v.mem.read8(0x11A3),2);
});
for(const resumable of [false,true])test(`complete CDF8 ${resumable?'across finite budgets':'synchronously'} uses its installed D479 for BYTE counters, fade and fresh input on the original caller frame`,async()=>{
  const {NATIVE_CALL_CONTINUATIONS}=await import('../src/task/native-call-continuation.mjs');
  const {WAIT_PAUSED}=await import('../src/task/native-wait-continuation.mjs');
  const inputWindow={start:0x809E1A,hex:inputApuWindows[0].hex.slice(0,0x23*2)};
  const windows=[...mainSceneSpecs[0].windows,...mainSceneSpecs.find(s=>s.name==='f298').windows,
    ...sceneAnimationSpecs.find(s=>s.name==='eebb').windows,inputWindow];
  const map=decodeWindows(windows),observed=decodeWindows([fadeWindow,...sceneAnimationSpecs.find(s=>s.name==='eebb').windows,inputWindow]);
  assertPinnedTaskSource(map,windows);
  for(const selection of [0,1,5,0x8002])for(const key of [0,0x9000]){
    const r=side({p:0,dbr:0x80}),n=side({p:0,dbr:0x80}),records=[],hits=new Map();referenceIo(r);
    for(const v of [n,r]){v.a.ctx.a=selection;v.a.ctx.x=0x2468;v.a.ctx.pc=0xCDF8;v.h.pushByte(0x80);v.h.push(0x1234,2);
      // Explicit pre-existing directory from F092, which CDF8 does not set up.
      v.mem.wram.set(Buffer.from(window(0x98FFFA,0x98FFFD).hex,'hex'),0x8C);}
    // Synthetic matching APU replies only; NMI/Joypad observations remain explicit
    // and run the complete original interrupt handler on the reference side.
    const bind=(v,e)=>{const routines=new Map(MAIN_SCENE_ROUTINES),read=v.a.absoluteRead;
      v.a.absoluteRead=(offset,width,pc)=>{if(offset!==0x2140)return read(offset,width,pc);
        assert.equal(width,1);const value=v.h.read(v.h.abs(0x1CE4),1);
        v.a.trace.push({kind:'read',pc,address:v.h.abs(offset),width,value});return value;};
      return new Map([...routines].filter(([target])=>!map.has(target)).map(([target,run])=>[target,()=>{
        const result=run(v.h,e,routines);return {rawReturnWord:result?.rawReturnWord??result};}]));};
    const hooks=new Map([...observed.keys()].map(pc=>[pc,()=>{
      const hit=(hits.get(pc)??0)+1;hits.set(pc,hit);const take=pc===0x81EECD||pc===0x81CF4C;
      records.push({pc,nmi:take});r.a.ctx.programBank=pc>>>16;r.a.ctx.pc=pc&65535;
      if(take){assert.equal(r.h.pointer(0x6E),0x81D479);originalNmi(r,key);}
    }]));
    const re={values:freeze([]),waitIndex:0,waitEvents:[],calls:[],inputs:freeze([]),inputIndex:0};
    runReference(map,r.mem,r.a.ctx,{entry:0x81CDF8,root:'RTL',before:hooks,io:r.a.trace,calls:bind(r,re)});
    n.a.io=r.a.io;const e={...re,waitEvents:[],calls:[],interrupts:freeze(records),interruptIndex:0,interruptRoutines:MAIN_SCENE_ROUTINES};
    bind(n,e);
    if(resumable){const c=NATIVE_CALL_CONTINUATIONS.get(playCutscene).create({h:n.h,events:e});let pauses=0;
      while(c.run(1)===WAIT_PAUSED)assert.ok(++pauses<records.length*32+1000);assert.ok(pauses>100);
    }else playCutscene(n.h,e,MAIN_SCENE_ROUTINES);
    finishInterruptObservations(e);
    assert.deepEqual(n.a.ctx,r.a.ctx);assert.deepEqual(n.mem.wram,r.mem.wram);assert.deepEqual(expand(n.a.trace),expand(r.a.trace));
    assert.equal(n.a.ioIndex,r.a.io.length);assert.equal(r.a.ioIndex,r.a.io.length);
    assert.equal(n.a.ctx.s,0x1EF0);assert.equal(n.a.ctx.pc,0x1235);assert.equal(n.mem.read8(0x11A3),0);
    assert.equal(e.waitIndex,0);assert.equal(e.inputIndex,0);assert.deepEqual(e.waitEvents,[]);
    assert.ok(records.some(o=>o.pc===0x81CF4C&&o.nmi));assert.equal(n.h.pointer(0x6E),0x81D479);
  }
});
