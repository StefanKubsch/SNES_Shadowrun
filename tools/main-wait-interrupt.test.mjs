import test from 'node:test';
import assert from 'node:assert/strict';
import {counterWindows,prove as proveCounter} from './render-task-native-counter-b0a1-source-proof.mjs';
import {inputApuWindows,decodeSource,prove as proveInput} from './render-task-native-input-apu-source-proof.mjs';
import {gameNmiSpecs} from './main-game-nmi-source.mjs';
import {matrixNmiSpecs} from './main-matrix-nmi-source.mjs';
import {sceneAnimationSpecs,proveSceneAnimation} from './main-scene-animation-source.mjs';
import {decodeWindows,DialogTestMemory,rom,romBytes} from './task-native-dialog-harness.mjs';
import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {runReference} from './w65c816-reference.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';
import {GAME_NMI_ROUTINES} from '../src/task/main-game-nmi.mjs';
import {MAIN_LOOP_ROUTINES,runMainLoop} from '../src/vm/main-loop.mjs';
import {MAIN_MOTION_ROUTINES} from '../src/task/main-loop-motion.mjs';
import {SCENE_REFERENCE_ROUTINES as MAIN_SCENE_ROUTINES} from '../proof/scene-reference-routines.mjs';
import {finishInterruptObservations,waitForRandomStateChangeWithInterrupts,readInputWithInterrupts} from '../src/task/main-wait-interrupt.mjs';
import {inputWaitF953Window} from './task-native-input-wait-f953-source.mjs';
import {DIALOG_WINDOWS} from './task-native-936c-windows.mjs';
import {requestWindows} from './render-task-native-menu-compose-source-proof.mjs';
import {waitForConfirmKey} from '../src/task/native-input-wait.mjs';
import {waitForRandomStateChange} from '../src/task/native-frame-wait.mjs';
import {uploadPortraitTiles,openPortraitWindow,closePortraitWindow,waitWord,nmiWords} from '../src/task/native-dialog-portrait.mjs';
import {waitForWindowUpload,requestWindowUpload} from '../src/task/native-menu-compose.mjs';
import {cpuToOffset} from './rom.mjs';

const inputWindow={start:0x809E1A,hex:inputApuWindows[0].hex.slice(0,0x23*2)};
const counter=decodeWindows(counterWindows),input=decodeWindows([inputWindow]);
const byteSpec=sceneAnimationSpecs.find(s=>s.name==='eebb'),byteWait=decodeWindows(byteSpec.windows);
const nmi=decodeWindows([...matrixNmiSpecs[2].windows,...gameNmiSpecs.flatMap(s=>s.windows)]);
const freeze=list=>Object.freeze(list.map(o=>Object.freeze({...o})));
const expand=t=>t.flatMap(o=>o.width===2?[{...o,width:1,value:o.value&255},{...o,width:1,address:o.address+1,value:o.value>>>8}]:[{...o,width:1}]);
function side({baseline=0,previous=0,current=0,dbr=0x80,p=0x41,s=0x1EF0,dp30=0x80,x=0xDEAD}={}){
  const mem=new DialogTestMemory(new Uint8Array(0x20000),null,rom);
  for(const [at,v]of [[0x6E,0xC152],[0x1C76,baseline],[0x1CA,current],[0x1CC,previous],[0x140,0xFFFF],[0xCD8,1]])mem.write16(at,v);
  mem.write8(0x70,0x80);
  mem.write8(0x30,dp30);
  const a=new TaskAccessor({mem,a:0xA55A,x,y:0xBEEF,s,d:0,dbr,p,pc:0x96AB});a.load();a.trace=[];a.io=[];a.devices={write(){}};
  if(p&0x10){a.ctx.x&=255;a.ctx.y&=255;}
  return {mem,a,h:dialogAccess(a)};
}
function devices(dbr,value){return [
  ...(dbr===0x7E?[]:[{pc:0x00C118,address:dbr<<16|0x4210,width:2,value:0xAB80}]),
  {pc:0x809E0B,address:0x4212,width:2,value:1},{pc:0x809E0B,address:0x4212,width:2,value:0},
  {pc:0x809E13,address:0x4218,width:2,value},
];}
// Independent hardware entry followed by the complete pinned original handler
// and callback, ending at RTI. No native NMI implementation on this side.
function originalNmi(v,value){const {a,h,mem}=v,before={...a.ctx};a.io.push(...devices(a.ctx.bank,value));
  h.pushByte(a.ctx.programBank);h.push(a.ctx.pc,2);h.pushByte(a.ctx.status);
  a.ctx.status=(a.ctx.status|4)&~8;a.ctx.programBank=0;
  runReference(nmi,mem,a.ctx,{entry:0x00C112,root:'RTI',io:a.trace});
  assert.deepEqual(a.ctx,before);
}
function referenceIo(v){let byte=0;const read=v.mem.read8.bind(v.mem);
  v.mem.read8=address=>{const o=v.a.io[v.a.ioIndex];if(o&&address===o.address+byte){
    const value=o.value>>>(8*byte++)&255;if(byte===o.width){v.a.ioIndex++;byte=0;}return value;}return read(address);};
}
function compare(options,entry,choose,graph=null){const r=side(options),n=side(options),map=graph?.map??(entry===0x81B0A1?counter:entry===0x809E1A?input:byteWait),root=graph?.root??(entry===0x809E1A?'RTS':'RTL');
  if(graph?.setup)for(const v of [r,n])graph.setup(v);
  const records=[],hits=new Map();referenceIo(r);
  const hooks=new Map([...(graph?.observations??map).keys()].map(pc=>[pc,()=>{
    const hit=(hits.get(pc)??0)+1;hits.set(pc,hit);const value=choose(pc,hit),nmi=value!==null;
    records.push({pc,nmi});r.a.ctx.programBank=pc>>>16;r.a.ctx.pc=pc&65535;if(nmi)originalNmi(r,value);
    if(pc===0x81EEC2)r.a.io.push({pc,address:r.a.ctx.bank<<16|0x4212,width:1,value:hit<3?0x80:0});
  }]));
  // Both original caller frames, including the bank byte of the B0A1 JSL.
  for(const v of [n,r]){if(root==='RTL')v.h.pushByte(0x80);v.h.push(entry===0x81B0A1?0x96AE:0x96B9,2);
    v.a.ctx.programBank=entry>>>16;v.a.ctx.pc=entry&65535;}
  const stop=Symbol('inline fallthrough');if(graph?.stopAt)hooks.set(graph.stopAt,()=>{throw stop;});
  try{runReference(map,r.mem,r.a.ctx,{entry,root,io:r.a.trace,before:hooks});}
  catch(error){if(error!==stop)throw error;}
  n.a.io=r.a.io;const e={interrupts:freeze(records),interruptIndex:0,interruptRoutines:GAME_NMI_ROUTINES,startupInterrupts:graph?.startupInterrupts,
    values:freeze([]),waitIndex:0,waitEvents:[],calls:[],inputs:freeze([]),inputIndex:0};
  const result=graph?graph.run(n,e):(MAIN_LOOP_ROUTINES.get(entry)??MAIN_SCENE_ROUTINES.get(entry))(n.h,e);finishInterruptObservations(e);
  assert.deepEqual(n.a.ctx,r.a.ctx);assert.deepEqual(n.mem.wram,r.mem.wram);assert.deepEqual(expand(n.a.trace),expand(r.a.trace));
  assert.equal(n.a.ioIndex,r.a.io.length);assert.equal(r.a.ioIndex,r.a.io.length);
  assert.equal(e.waitIndex,0);assert.equal(e.inputIndex,0);assert.deepEqual(e.waitEvents,[]);
  return {n,r,e,records,result};
}

test('AC2F retains the full stream WORD across an original NMI before AC8F AND',()=>{
  const at=cpuToOffset(0x80AC2F,romBytes.length),map=decodeWindows([{start:0x80AC2F,hex:romBytes.subarray(at,at+453).toString('hex')}]);
  assert.equal(map.get(0x80AC8D).mnemonic,'LDA');assert.equal(map.get(0x80AC8F).mnemonic,'AND');
  assert.equal(map.get(0x80AC8F).value,255);
  for(const dbr of [0,0x80,0x81])for(const interrupt of [false,true]){
    const {records,n}=compare({dbr,x:0},0x80AC2F,()=>interrupt?0x4000:null,{
      map,root:'RTS',observations:new Map([[0x80AC8F,map.get(0x80AC8F)]]),startupInterrupts:true,
      setup:v=>{for(const [address,value]of [[0x4088,0x80],[0x3FD8,1],[0x1090,0x8000],[0x10E8,2],[0x1198,0],[0x82,0x100],[0x40,0x8C]])v.mem.write16(0x7E0000+address,value);},
      run:(v,e)=>MAIN_MOTION_ROUTINES.get(0x80AC2F)(v.h,e),
    });
    assert.deepEqual(records,[{pc:0x80AC8F,nmi:interrupt}]);
    assert.equal(n.mem.read16(0x1C76),interrupt?1:0);
    if(interrupt)assert.equal(n.mem.read16(0x1C78),0x800A,'NMI saves the full pre-AND accumulator');
  }
});

test('direct counter adapter and complete F953 use real NMI/input state without old observation writers',()=>{
  const f953=decodeWindows([inputWaitF953Window,...counterWindows,inputWindow]);assertPinnedTaskSource(f953,[inputWaitF953Window,...counterWindows,inputWindow]);
  for(const dbr of [0,0x80,0x81]){
    const c=compare({baseline:0xFFFF,dbr},0x81B0A1,(pc,hit)=>pc===0x81B0A5&&hit===2?0x4000:null,
      {map:counter,root:'RTL',run:(v,e)=>waitForRandomStateChange(v.a,{interruptEvents:e},false,true)});
    assert.equal(c.result.waitObservationsUsed,0);assert.deepEqual(c.result.waitEvents,[]);
    const p=compare({baseline:0xFFFF,dbr},0x80F953,(pc,hit)=>pc===0x81B0A5&&hit===2?0:pc===0x81B0A5&&hit===4?0x4000:null,
      {map:f953,root:'RTS',observations:new Map([...counter,...input]),run:(v,e)=>waitForConfirmKey(v.a,{interruptEvents:e},false)});
    assert.equal(p.result.iterations,2);assert.equal(p.result.waitObservationsUsed,0);assert.equal(p.result.inputObservationsUsed,0);
    assert.deepEqual(p.result.waitEvents,[]);assert.equal(p.n.mem.read16(0x1C76),1);
  }
});

test('portrait open/close and portrait transfer polls keep their original callers, flags and NMI writes',()=>{
  const specs=[['8f3a',0x808F3A,openPortraitWindow],['8f97',0x808F97,closePortraitWindow],['9022',0x808FF5,uploadPortraitTiles]];
  for(const [name,entry,run]of specs){const windows=[...DIALOG_WINDOWS[name],...counterWindows],map=decodeWindows(windows);assertPinnedTaskSource(map,windows);
    const observations=entry===0x808FF5?new Map([...map].filter(([pc])=>pc===0x80901C||pc===0x80901F)):counter;
    for(const dbr of [0,0x80,0x81])compare({x:0x1234,dbr,baseline:0xFFFF},entry,(pc,hit)=>
      (pc===0x81B0A5||pc===0x80901C)&&hit%2===0?0:null,{map,root:'RTS',observations,run:(v,e)=>run(v.h,e)});
  }
});

test('inline tile polls preserve original LDA/BNE flags and consume actual A98E clear and DP82 effects',()=>{
  const source=decodeWindows(DIALOG_WINDOWS.adf4);assertPinnedTaskSource(source,DIALOG_WINDOWS.adf4);
  for(const pc of [0x80AE0C,0x80AE5E]){
    assert.equal(source.get(pc).mnemonic,'LDA');assert.equal(source.get(pc).value,0x1562);
    assert.equal(source.get(pc+3).mnemonic,'BNE');assert.equal(source.get(pc+3).target,pc);
    for(const phase of [pc,pc+3]){
      const poll=new Map([[pc,source.get(pc)],[pc+3,source.get(pc+3)]]);
      // Stop before the actual original fallthrough instruction, with its
      // caller frame still present on both sides. No synthetic instruction.
      const {n}=compare({dbr:0x80},pc,at=>at===phase?0:null,{map:source,root:'RTS',observations:poll,stopAt:pc+5,
        setup:v=>{v.mem.write16(0x1562,1);v.mem.write16(0x82,0xFFFE);},
        run:(v,e)=>{waitWord(v.h,e,pc,0x1562,x=>x===0,[0x82]);nmiWords(v.h,e,pc,[0x82,0x1562]);}});
      assert.equal(n.mem.read16(0x1562),0);assert.equal(n.mem.read16(0x82),0xFFFE);
    }
  }
});

test('menu request and poll wrappers use the shared interrupt set and original request frame',()=>{
  const request=decodeWindows(requestWindows);assertPinnedTaskSource(request,requestWindows);
  compare({},0x80FA67,(pc,hit)=>pc===0x81ACBD&&hit===2?0:null,{map:request,root:'RTS',observations:decodeWindows([requestWindows[1]]),
    setup:v=>{v.mem.write16(0,0);v.mem.write16(0x7E2060,1);v.mem.write16(0x7E20A0,1);},run:(v,e)=>requestWindowUpload(v.a,e,false)});
  compare({},0x81ACBD,()=>null,{map:decodeWindows([requestWindows[1]]),root:'RTL',run:(v,e)=>waitForWindowUpload(v.a,e,false)});
});

test('interrupt wait roots retain pinned source, long counter stack and original input reset boundary',()=>{
  proveCounter(counter);assertPinnedTaskSource(input,[inputWindow]);
  // The existing complete input proof also includes the nonreturning reset tail.
  const decoded=decodeSource(romBytes);proveInput(decoded.map,0x809E1A);
  proveSceneAnimation(byteWait,byteSpec);
  assert.equal(counter.size,4);assert.equal(input.size,13);
  for(const target of [0x81B0A1,0x809E1A])assert.equal(MAIN_LOOP_ROUTINES.get(target),MAIN_SCENE_ROUTINES.get(target));
});
test('EEBB preserves PHP/PLP, BYTE baseline, high A, WORD counter wrap and branch flags across interrupts',()=>{
  for(const baseline of [0,0xFF,0xFFFF])for(const p of [0,0x20,0x30,0xB7])for(const dbr of [0,0x80,0x81,0x7E]){
    compare({baseline,p,dbr},0x81EEBB,(pc,hit)=>pc===0x81EECD&&hit===3?0x8000:pc===0x81EED1&&hit===1?0:null);
  }
  for(const pc of [0x81EEBB,0x81EEBC,0x81EEBE,0x81EEC0,0x81EEC9,0x81EECD,0x81EED1,0x81EED3,0x81EED4]){
    compare({baseline:0xFF,p:0x30},0x81EEBB,(at,hit)=>at===pc&&hit===1?0:at===0x81EECD&&hit===4?0x4000:null);
  }
});
test('EEBB hardware branch keeps BYTE width and original poll PC with explicit device and interrupt order',()=>{
  for(const dbr of [0,0x80,0x81])for(const p of [0,0x20,0x30,0xB7])for(const phase of [0x81EEC2,0x81EEC5,0x81EEC7,0x81EEC8]){
    compare({dp30:0,dbr,p},0x81EEBB,(pc,hit)=>pc===phase&&hit===1?0x2000:null);
  }
});
test('B0A1 compares real NMI writes across unchanged polls, pre-baseline interrupts, branch interrupts and WORD wrap',()=>{
  for(const baseline of [0,0x7FFF,0xFFFF])for(const dbr of [0,0x80,0x81,0x7E])for(const phase of [0x81B0A1,0x81B0A5,0x81B0A9,0x81B0AB]){
    const {n,records}=compare({baseline,dbr},0x81B0A1,(pc,hit)=>
      pc===phase&&(pc!==0x81B0A5||hit===3)?0x8000:pc===0x81B0A5&&hit===4?0x4000:null);
    assert.ok(records.length>=4);assert.notEqual(n.mem.read16(0x1C76),baseline);
  }
});
test('input keeps each fresh edge/copy/filter read when NMI interrupts every possible original instruction',()=>{
  for(const pc of input.keys())for(const dbr of [0,0x80,0x81,0x7E])for(const current of [0,0x8000,0x8001]){
    compare({current,previous:0x4000,dbr},0x809E1A,at=>at===pc?0x4000:null);
  }
  compare({current:0x8000},0x809E1A,pc=>pc===0x809E20?0x4000:pc===0x809E26?0x2000:null);
});
test('real main-loop caller shares one interrupt stream, counter, joypad and original call frames',()=>{
  const v=side({baseline:0xFFFF}),records=[
    [0x81B0A1,false],[0x81B0A5,false],[0x81B0A9,false],[0x81B0A5,true],[0x81B0A9,false],[0x81B0AB,false],
    ...[0x809E1A,0x809E1D,0x809E20,0x809E23,0x809E26,0x809E29,0x809E2C,0x809E2F,0x809E31,0x809E34,0x809E3C].map(pc=>[pc,false])
  ];v.a.io=devices(0x80,0x8000);v.a.ctx.pc=0x96C3;
  const e={interrupts:freeze(records.map(([pc,nmi])=>({pc,nmi}))),interruptIndex:0,interruptRoutines:GAME_NMI_ROUTINES};
  // Unrelated helpers are synthetic here, as in main-loop.test. No R-to-C oracle claim.
  const routines=new Map(MAIN_LOOP_ROUTINES);routines.set(0x808000,h=>{h.ctx.status|=1;return h.rts();});
  for(const target of [0x818877,0x818076])routines.set(target,h=>h.rtl());
  for(const target of [0x80BE6D,0x80BF3B])routines.set(target,h=>h.rts());
  assert.equal(runMainLoop(v.a,e,routines),0x96C0);finishInterruptObservations(e);
  assert.equal(v.mem.read16(0x1C76),0);assert.equal(v.mem.read16(0x1CA),0x8000);assert.equal(v.mem.read16(0x1CE),0x8000);
  assert.equal(v.a.ctx.s,0x1EF0);assert.equal(v.a.ioIndex,4);
  const m=side();m.a.io=devices(0x80,0x4000);const em={interrupts:freeze([[0x81B0A1,false],[0x81B0A5,true],[0x81B0A9,false],[0x81B0AB,false]].map(([pc,nmi])=>({pc,nmi}))),interruptIndex:0,interruptRoutines:GAME_NMI_ROUTINES};
  m.h.call(0x80CC5C,0x81B0A1,()=>MAIN_MOTION_ROUTINES.get(0x81B0A1)(m.h,em),true);finishInterruptObservations(em);
  assert.equal(m.a.ctx.pc,0xCC60);assert.equal(m.mem.read16(0x1C76),1);
});
test('missing, mutable, wrong-PC and exhausted interrupt records stop without a fabricated counter change',()=>{
  for(const interrupts of [undefined,[],freeze([{pc:0x81B0A5,nmi:true}]),[{pc:0x81B0A1,nmi:false}],Object.freeze([{pc:0x81B0A1,nmi:false}])]){
    const v=side(),e={interrupts,interruptIndex:0,interruptRoutines:GAME_NMI_ROUTINES};v.a.ctx.programBank=0x81;
    const before=v.mem.wram.slice();assert.throws(()=>waitForRandomStateChangeWithInterrupts(v.h,e),e=>e.reason==='wait_interrupt_observation_required');
    assert.deepEqual(v.mem.wram,before);
  }
  const v=side(),e={interrupts:freeze([{pc:0x81B0A1,nmi:false}]),interruptIndex:0};v.a.ctx.programBank=0x81;
  assert.throws(()=>waitForRandomStateChangeWithInterrupts(v.h,e),e=>e.reason==='wait_interrupt_observation_required'&&e.pc===0x81B0A5);
  assert.equal(v.mem.read16(0x1C76),0);assert.throws(()=>finishInterruptObservations({interruptIndex:0,interrupts:[{}]}),e=>e.reason==='wait_interrupt_observation_unused');
});
test('missing NMI callback/device values and corrupt interrupted return remain explicit boundaries',()=>{
  for(const kind of ['callback','device','alias']){const v=side({s:kind==='alias'?0x1C7D:0x1EF0});v.a.ctx.programBank=0x81;
    const e={interrupts:freeze([{pc:0x81B0A1,nmi:true}]),interruptIndex:0,interruptRoutines:kind==='callback'?new Map():GAME_NMI_ROUTINES};
    if(kind==='alias')v.a.io=devices(0x80,0);
    assert.throws(()=>waitForRandomStateChangeWithInterrupts(v.h,e),err=>err.reason===(kind==='callback'?'observed_nmi_callback_frontier':kind==='device'?'device_observation_required':'wait_interrupt_return_required'));
  }
});
test('fresh exact 3030 reset after an NMI retains preceding direct effects and never assumes a return',()=>{
  const v=side(),pcs=[0x809E1A,0x809E1D,0x809E20,0x809E23,0x809E26,0x809E29,0x809E2C,0x809E2F];
  v.a.io=devices(0x80,0x3030);const e={interrupts:freeze(pcs.map(pc=>({pc,nmi:pc===0x809E1A}))),interruptIndex:0,interruptRoutines:GAME_NMI_ROUTINES};
  assert.throws(()=>readInputWithInterrupts(v.h,e),err=>err.reason==='task_reset_source_required'&&err.pc===0x809E2F);
  assert.equal(v.mem.read16(0x1CC),0x3030);assert.equal(v.mem.read16(0x1CE),0x3030);assert.equal(v.mem.read16(0x1C76),1);
});
