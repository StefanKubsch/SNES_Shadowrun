import test from 'node:test';
import assert from 'node:assert/strict';
import {mainSceneSpecs} from './main-scene-source.mjs';
import {sceneIntroSpecs} from './main-scene-intro-source.mjs';
import {sceneAnimationSpecs} from './main-scene-animation-source.mjs';
import {sceneVideoSpecs} from './main-scene-video-source.mjs';
import {matrixNmiSpecs} from './main-matrix-nmi-source.mjs';
import {introNmiSpecs} from './main-intro-nmi-source.mjs';
import {matrixSetupSpecs} from './main-scene-matrix-source.mjs';
import {inputApuWindows} from './render-task-native-input-apu-source-proof.mjs';
import {decodeWindows,DialogTestMemory,rom,window} from './task-native-dialog-harness.mjs';
import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {runReference} from './w65c816-reference.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';
import {playCutscene} from '../proof/cutscene-reference/cutscene-scene.mjs';
import {playMatrixScene} from '../proof/matrix-reference/matrix-scene-loop.mjs';
import {SCENE_REFERENCE_ROUTINES as MAIN_SCENE_ROUTINES} from '../proof/scene-reference-routines.mjs';
import {finishInterruptObservations} from '../src/task/main-wait-interrupt.mjs';
import {NATIVE_CALL_CONTINUATIONS} from '../src/task/native-call-continuation.mjs';
import {WAIT_PAUSED} from '../src/task/native-wait-continuation.mjs';

const spec=(list,name)=>list.find(s=>s.name===name);
const inputWindow={start:0x809E1A,hex:inputApuWindows[0].hex.slice(0,0x23*2)};
const commonWindows=[...spec(mainSceneSpecs,'f298').windows,...spec(sceneAnimationSpecs,'eebb').windows,inputWindow];
const outerWindows=[...spec(mainSceneSpecs,'cdf8').windows,...spec(mainSceneSpecs,'c3ca').windows,...spec(sceneIntroSpecs,'dfe7').windows,
  ...matrixSetupSpecs.filter(s=>['bfd8','bff8','c029'].includes(s.name)).flatMap(s=>s.windows),
  ...spec(sceneAnimationSpecs,'eedd').windows,...spec(sceneAnimationSpecs,'eef1').windows,...commonWindows];
const outer=decodeWindows(outerWindows),observations=decodeWindows([...spec(sceneAnimationSpecs,'eebb').windows,inputWindow]);
for(const pc of [0x81CF4C,0x81CF4F])observations.set(pc,outer.get(pc));
const nmiWindows=[...matrixNmiSpecs.flatMap(s=>s.windows),...introNmiSpecs.flatMap(s=>s.windows),
  ...spec(sceneAnimationSpecs,'d479').windows,...spec(sceneVideoSpecs,'ed8b').windows];
const nmi=decodeWindows(nmiWindows);
const freeze=rows=>Object.freeze(rows.map(o=>Object.freeze({...o})));
const expand=trace=>trace.flatMap(o=>o.width===2?[{...o,width:1,value:o.value&255},{...o,width:1,address:o.address+1,value:o.value>>>8}]:[{...o,width:1}]);
function side(kind,option){const mem=new DialogTestMemory(new Uint8Array(0x20000),null,rom);
  const a=new TaskAccessor({mem,a:kind==='intro'?0x14:0,x:0,y:0,s:0x1EF0,d:0,dbr:0x80,p:0x43,pc:kind==='intro'?0xCDF8:0xC3CA});
  a.load();a.ctx.programBank=0x81;a.trace=[];a.io=[];a.devices={write(){}};const h=dialogAccess(a);h.pushByte(0x80);h.push(0x1234,2);
  if(kind==='matrix'){mem.write16(0x1D90,option);mem.write16(0x1D8E,0xFE);mem.write8(0x1D8F,0);
    mem.wram.set(Buffer.from(window(0x98FFFA,0x98FFFD).hex,'hex'),0x8C);}
  return {mem,a,h,installed:[],callbacks:[]};
}
// Explicit synthetic test replies, recorded in the trace. APU replies match
// the current command token; no audio/time/PPU behavior is being implemented.
function testReplies(v){const read=v.a.absoluteRead;v.a.absoluteRead=(offset,width,pc)=>{
  if(![0x2140,0x2137,0x213C,0x213D].includes(offset))return read(offset,width,pc);
  assert.equal(width,1);if(offset===0x2140)assert.ok([0x81F00E,0x81F046].includes(pc));
  const value=offset===0x2140?v.mem.read8(v.h.abs(0x1CE4)):offset===0x2137?0x7B:0;
  v.a.trace.push({kind:'read',pc,address:v.h.abs(offset),width,value});return value;
};}
function routinesFor(v){const routines=new Map(MAIN_SCENE_ROUTINES),install=routines.get(0x81EC16);
  routines.set(0x81EC16,(h,e,r)=>{const program=h.ctx.x,result=install(h,e,r);v.installed.push([program,h.pointer(0x6E)]);return result;});
  for(const target of [0x81BEC3,0x81DAD6,0x81DF0E,0x81D479]){const run=routines.get(target);
    routines.set(target,(h,e,r)=>{v.callbacks.push(target);return run(h,e,r);});}
  return routines;
}
function referenceIo(v){let byte=0;const read=v.mem.read8.bind(v.mem);
  v.mem.read8=address=>{const o=v.a.io[v.a.ioIndex];if(o&&address===o.address+byte){const value=o.value>>>(byte++*8)&255;
    if(byte===o.width){v.a.ioIndex++;byte=0;}return value;}return read(address);};
}
const calls=(v,e,routines,map)=>new Map([...routines].filter(([target])=>!map.has(target)).map(([target,run])=>[target,()=>{
  const result=run(v.h,e,routines);return {rawReturnWord:result?.rawReturnWord??result};
}]));
function originalNmi(v,e,routines,key){const {h,a,mem}=v,before={...a.ctx};
  assert.ok(mem.read8(0x30)&0x80,'the actual program has enabled NMI before this occurrence');
  const target=h.pointer(0x6E),inputBank=[0x81DAD6,0x81DF0E].includes(target)?0x810000:0;
  v.callbacks.push(target);a.io.push({pc:0x00C118,address:before.bank<<16|0x4210,width:2,value:0x80},
    {pc:0x809E0B,address:inputBank|0x4212,width:2,value:1},{pc:0x809E0B,address:inputBank|0x4212,width:2,value:0},
    {pc:0x809E13,address:inputBank|0x4218,width:2,value:key});
  h.pushByte(before.programBank);h.push(before.pc,2);h.pushByte(before.status);a.ctx.status=(before.status|4)&~8;a.ctx.programBank=0;
  runReference(nmi,mem,a.ctx,{entry:0x00C112,root:'RTI',io:a.trace,calls:calls(v,e,routines,nmi)});assert.deepEqual(a.ctx,before);
}
function compare(kind,option,resumable=false){const r=side(kind,option),n=side(kind,option),rr=routinesFor(r),nr=routinesFor(n),records=[],states=[];
  testReplies(r);testReplies(n);referenceIo(r);
  const re={values:freeze([]),waitIndex:0,waitEvents:[],inputs:freeze([]),inputIndex:0,calls:[]},hits=new Map();
  const hooks=new Map([...observations.keys()].map(pc=>[pc,()=>{
    const hit=(hits.get(pc)??0)+1;hits.set(pc,hit);
    const take=pc===0x81EECD||pc===0x81CF4C||resumable&&(pc===0x81CF4F||pc===0x809E26);
    records.push({pc,nmi:take});r.a.ctx.programBank=pc>>>16;r.a.ctx.pc=pc&65535;
    if(take)originalNmi(r,re,rr,kind==='intro'?(option?0x9000:0):0x40);
    if(resumable&&take)states.push({ctx:{...r.a.ctx},wram:r.mem.wram.slice(),io:r.a.ioIndex});
  }]));
  hooks.set(0x81E07E,()=>hits.set(0x81E07E,(hits.get(0x81E07E)??0)+1));
  const entry=kind==='intro'?0x81CDF8:0x81C3CA;
  const result=runReference(outer,r.mem,r.a.ctx,{entry,root:'RTL',before:hooks,io:r.a.trace,calls:calls(r,re,rr,outer),limit:5_000_000});
  n.a.io=r.a.io;const events={...re,waitEvents:[],calls:[],interrupts:freeze(records),interruptIndex:0,interruptRoutines:nr};
  let pauses=0,matched=0;
  if(resumable){const factory=NATIVE_CALL_CONTINUATIONS.get(kind==='intro'?playCutscene:playMatrixScene);
    assert.equal(factory.run,kind==='intro'?playCutscene:playMatrixScene);const c=factory.create({h:n.h,events,routines:nr}),before=n.mem.wram.slice();
    assert.equal(c.run(0),WAIT_PAUSED);assert.deepEqual(n.mem.wram,before);
    // Each recorded boundary can now include a complete nested NMI, caller
    // frame checks and the wait instruction. Bound test work by the actual
    // finite reference records rather than the former atomic-helper count.
    while(c.run(1)===WAIT_PAUSED){assert.ok(++pauses<records.length*32+1000,
      `pause bound: option=${option}, pc=${n.a.ctx.pc.toString(16)}, record=${events.interruptIndex}/${records.length}, matched=${matched}/${states.length}`);
      const state=states[matched];
      if(state&&n.a.ctx.pc===state.ctx.pc&&n.a.ctx.programBank===state.ctx.programBank&&n.a.ioIndex===state.io){
        assert.deepEqual(n.a.ctx,state.ctx);assert.deepEqual(n.mem.wram,state.wram);matched++;
      }
    }
    assert.equal(matched,states.length);assert.ok(matched>=33);
  }else (kind==='intro'?playCutscene:playMatrixScene)(n.h,events,nr);
  finishInterruptObservations(events);
  assert.deepEqual(n.a.ctx,r.a.ctx);assert.deepEqual(n.mem.wram,r.mem.wram);assert.deepEqual(expand(n.a.trace),expand(r.a.trace));
  assert.deepEqual(n.installed,r.installed);assert.deepEqual(n.callbacks,r.callbacks);assert.equal(n.a.ioIndex,r.a.io.length);assert.equal(r.a.ioIndex,r.a.io.length);
  assert.equal(n.a.ctx.s,0x1EF0);assert.equal(n.a.ctx.pc,0x1235);assert.equal(n.a.ctx.bank,0x80);assert.equal(n.a.ctx.status,0x43);
  assert.equal(events.waitIndex,0);assert.equal(events.inputIndex,0);assert.deepEqual(events.waitEvents,[]);
  return {n,r,records,hits,visited:result.visited,pauses};
}
test('combined scene and callback execution retains each pinned original root',()=>{
  // EEBB appears with multiple incoming M/X states in its callers. Pin each
  // original window separately rather than conflating their decoder metadata.
  for(const windows of [...mainSceneSpecs.map(s=>s.windows),...sceneIntroSpecs.map(s=>s.windows),
    ...sceneAnimationSpecs.map(s=>s.windows),...matrixSetupSpecs.filter(s=>['bfd8','bff8','c029'].includes(s.name)).map(s=>s.windows),
    ...matrixNmiSpecs.map(s=>s.windows),...introNmiSpecs.map(s=>s.windows),[inputWindow]])
    assertPinnedTaskSource(decodeWindows(windows),windows);
});
test('DFE7 special tail and nested CDF8 execute the actually installed callbacks through complete original NMI/RTI',()=>{
  for(const early of [false,true]){const {n,visited,hits}=compare('intro',early);
    assert.deepEqual(n.installed.map(o=>o[1]),[0x81DAD6,0x81DF0E,0x81D479]);
    assert.deepEqual([...new Set(n.callbacks)],[0x81DF0E,0x81D479]);
    // DAD6 is installed while NMI is disabled, then overwritten before the
    // first wait. It must not be fabricated as an executed callback here.
    assert.equal(hits.get(0x809E1A)>0,true);assert.ok(visited.has(0x81CDFD));assert.ok(visited.has(0x81E120));
    assert.equal(hits.get(0x81E07E),early?1:300);
    assert.equal(n.mem.read8(0x11A3),0);
  }
});
test('whole C3CA returns through real Matrix queue producers, BEC3 consumption, control and fade',()=>{
  for(const option of [0,1]){const {n,visited}=compare('matrix',option);
    assert.deepEqual(n.installed.map(o=>o[1]),[0x81BEC3]);assert.deepEqual([...new Set(n.callbacks)],[0x81BEC3]);
    assert.equal(n.mem.read16(0x1748),0);assert.equal(n.mem.read16(0x174A),0);
    if(option)for(const pc of [0x81C4B4,0x81C4B7,0x81C4BA,0x81C4EA,0x81C4FA])assert.ok(visited.has(pc));
    assert.ok(n.a.trace.some(o=>o.pc===0x81B213&&o.value===1));
  }
});
test('C3CA preserves both complete fades, every live wait frame and actual Matrix effects across finite budgets',()=>{
  for(const option of [0,1]){const {pauses,n}=compare('matrix',option,true);assert.ok(pauses>500);
    assert.equal(n.mem.read16(0x1748),0);assert.equal(n.mem.read16(0x174A),0);}
});
test('CDF8 transfers its actual frame to DFE7 and preserves nested CDF8, input and direct fade polls across finite budgets',()=>{
  for(const early of [false,true]){const {pauses,n,hits}=compare('intro',early,true);assert.ok(pauses>500);
    assert.equal(hits.get(0x81E07E),early?1:300);assert.equal(n.mem.read8(0x11A3),0);}
});
test('both resumable brightness loops retain BYTE hardware polls and their actual PHP/PLP frames',()=>{
  for(const name of ['eedd','eef1']){
    const s=spec(sceneAnimationSpecs,name),wait=decodeWindows(spec(sceneAnimationSpecs,'eebb').windows);
    const graph=decodeWindows([...s.windows,...spec(sceneAnimationSpecs,'eebb').windows]);
    const n=side('matrix',0),r=side('matrix',0),records=[];let polls=0;
    for(const v of [n,r]){v.a.ctx.pc=s.entry&65535;v.a.ctx.a=0xA55A;v.mem.write8(0x30,0);}
    referenceIo(r);
    const before=new Map([...wait.keys()].map(pc=>[pc,()=>{records.push({pc,nmi:false});
      if(pc===0x81EEC2)r.a.io.push({pc,address:0x804212,width:1,value:++polls%3?0x80:0});}]));
    runReference(graph,r.mem,r.a.ctx,{entry:s.entry,root:'RTL',before,io:r.a.trace});
    n.a.io=r.a.io;const events={interrupts:freeze(records),interruptIndex:0};
    const c=NATIVE_CALL_CONTINUATIONS.get(s.entry).create({h:n.h,events}),wram=n.mem.wram.slice();
    assert.equal(c.run(0),WAIT_PAUSED);assert.deepEqual(n.mem.wram,wram);let pauses=0;
    while(c.run(1)===WAIT_PAUSED)assert.ok(++pauses<records.length*4+100);
    finishInterruptObservations(events);assert.deepEqual(n.a.ctx,r.a.ctx);assert.deepEqual(n.mem.wram,r.mem.wram);
    assert.deepEqual(expand(n.a.trace),expand(r.a.trace));assert.equal(n.a.ioIndex,48);
    assert.equal(n.mem.read16(0x1C76),0);assert.equal(n.a.ctx.status,0x43);
  }
});
