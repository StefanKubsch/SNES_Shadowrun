import {withFrontendReference} from '../proof/frontend-reference/frontend.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {ObservedNmiContinuation} from '../src/task/observed-nmi.mjs';
import {GAME_NMI_ROUTINES,GAME_NMI_CONTINUATIONS} from '../src/task/main-game-nmi.mjs';
import {WAIT_PAUSED,WAIT_RETURNED} from '../src/task/native-wait-continuation.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';
import {gameNmiSpecs,proveGameNmi} from './main-game-nmi-source.mjs';
import {matrixNmiSpecs,proveMatrixNmi} from './main-matrix-nmi-source.mjs';
import {decodeWindows,DialogTestMemory,rom} from './task-native-dialog-harness.mjs';
import {runReference} from './w65c816-reference.mjs';
import {sceneAnimationSpecs} from './main-scene-animation-source.mjs';
import {introNmiSpecs} from './main-intro-nmi-source.mjs';
import {frontendSpecs} from './main-frontend-source.mjs';
import {SCENE_REFERENCE_ROUTINES as MAIN_SCENE_ROUTINES} from '../proof/scene-reference-routines.mjs';
import {FRONTEND_NMI_ROUTINES as FRONTEND_NMI_ROUTINES_TASK} from '../src/task/main-frontend-nmi.mjs';
const FRONTEND_NMI_ROUTINES=withFrontendReference(FRONTEND_NMI_ROUTINES_TASK);

const map=decodeWindows([...matrixNmiSpecs[2].windows,...gameNmiSpecs.flatMap(s=>s.windows)]);
const pauseSites=new Set([0x80C152,0x809E0B,0x809E0E,0x809E11,0x809E13,0x809E16,0x809E19,0x80C17C,0x00C13B]);
const expand=rows=>rows.flatMap(o=>o.width===2?[{...o,width:1,value:o.value&255},{...o,width:1,address:o.address+1,value:o.value>>>8}]:[{...o,width:1}]);
function side({bank=0x80,p=0x41,s=0x1EED,busy=3}={}){
  const mem=new DialogTestMemory(new Uint8Array(0x20000),null,rom);
  for(const [at,value]of [[0x6E,0xC152],[0x1C76,0xFFFF],[0x140,0xFFFF],[0xCD8,1],[0x1CA,0x1111]])mem.write16(at,value);
  mem.write8(0x70,0x80);
  const a=new TaskAccessor({mem,a:0xBEAD,x:p&0x10?0xCD:0xABCD,y:p&0x10?0x56:0x3456,s,d:0,dbr:bank,p,pc:0xB0A5});a.load();
  a.ctx.e=0;a.ctx.programBank=0x81;const h=dialogAccess(a);a.ctx.d=0x1234;
  a.io=[...(bank===0x7E?[]:[{pc:0x00C118,address:bank<<16|0x4210,width:2,value:0xAB80}]),
    ...Array.from({length:busy},()=>({pc:0x809E0B,address:0x4212,width:2,value:0xAB81})),
    {pc:0x809E0B,address:0x4212,width:2,value:0xAB80},{pc:0x809E13,address:0x4218,width:2,value:0xC100}];
  a.trace=[];a.devices={write(){}};return {mem,a,h};
}
function snapshot(v){return {ctx:{...v.a.ctx},wram:v.mem.wram.slice(),io:v.a.ioIndex};}
function original(v){const {a,h}=v,c=a.ctx,states=[];let byte=0;const read=v.mem.read8.bind(v.mem);
  v.mem.read8=address=>{const o=a.io[a.ioIndex];if(o&&address===o.address+byte){const value=o.value>>>(8*byte++)&255;
    if(byte===o.width){a.ioIndex++;byte=0;}return value;}return read(address);};
  h.pushByte(c.programBank);h.push(c.pc,2);h.pushByte(c.status);c.status=(c.status|4)&~8;c.programBank=0;
  const before=new Map([...pauseSites].map(pc=>[pc,()=>{c.programBank=pc>>>16;c.pc=pc&65535;states.push(snapshot(v));}]));
  runReference(map,v.mem,c,{entry:0x00C112,root:'RTI',io:a.trace,before});return states;
}
test('nested joypad wait preserves every original poll boundary, callback frame, NMI stack and RTI',()=>{
  proveMatrixNmi(decodeWindows(matrixNmiSpecs[2].windows),matrixNmiSpecs[2]);
  for(const spec of gameNmiSpecs)proveGameNmi(decodeWindows(spec.windows),spec);
  // Synthetic responses test chronology; these are not PAL timing fixtures.
  for(const bank of [0,0x80,0x81,0x7E])for(const p of [0x41,0x31,0x8B])for(const s of [0x1EED,3]){
    const n=side({bank,p,s}),r=side({bank,p,s}),states=original(r),before=snapshot(n);
    const c=new ObservedNmiContinuation(n.a,null,GAME_NMI_ROUTINES,GAME_NMI_CONTINUATIONS);
    assert.equal(c.run(0),WAIT_PAUSED);assert.deepEqual(snapshot(n),before);let index=0,pauses=0;
    while(c.run(1)===WAIT_PAUSED){assert.ok(++pauses<200);
      const state=states[index];if(state&&n.a.ctx.programBank*65536+n.a.ctx.pc===state.ctx.programBank*65536+state.ctx.pc){
        assert.deepEqual(snapshot(n),state,`boundary ${state.ctx.pc.toString(16)}`);index++;
      }
    }
    assert.equal(index,states.length);assert.deepEqual(snapshot(n),snapshot(r));assert.deepEqual(expand(n.a.trace),expand(r.a.trace));
    assert.equal(n.mem.read16(0x1C76),0);assert.equal(n.mem.read16(0x1CA),0xC100);assert.equal(n.a.ioIndex,n.a.io.length);
    const after=snapshot(n);assert.equal(c.run(10),WAIT_RETURNED);assert.deepEqual(snapshot(n),after);
  }
});

function atPad(v){const c=new ObservedNmiContinuation(v.a,null,GAME_NMI_ROUTINES,GAME_NMI_CONTINUATIONS);
  for(let n=0;n<100;n++){assert.equal(c.run(1),WAIT_PAUSED);if(v.a.ctx.pc===0x9E0B)return c;}assert.fail('pad call not reached');}
test('busy observations never imply a completed pad; zero budget and foreign owners have no effects',()=>{
  const v=side({busy:100}),c=atPad(v);
  assert.equal(v.a.ctx.s,0x1CAC);assert.equal(v.mem.read16(0x1CAD),0xC17B);
  assert.equal(v.mem.read16(0x1CAF),0xC13A);assert.equal(v.mem.read8(0x1CB1),0);
  assert.equal(v.mem.read16(0x7E1C7A),0x1EE9);assert.equal(v.mem.read16(0x1CA),0x1111);
  const before=snapshot(v);assert.equal(c.run(0),WAIT_PAUSED);assert.deepEqual(snapshot(v),before);
  for(const budget of [-1,0.5,Infinity,NaN])assert.throws(()=>c.run(budget),e=>e.reason==='native_call_budget_required');
  for(const key of Object.keys(v.a.ctx)){const saved=v.a.ctx[key];v.a.ctx[key]^=1;
    assert.throws(()=>c.run(1),e=>e.reason==='native_call_owner_required');v.a.ctx[key]=saved;assert.deepEqual(snapshot(v),before);}
  assert.equal(c.run(150),WAIT_PAUSED);assert.equal(v.mem.read16(0x1CA),0x1111);
  assert.equal(v.a.trace.some(o=>o.pc===0x809E13),false);assert.equal(v.mem.read16(0x1C76),0);
});
test('missing pad data and modified real child returns keep their frontier and cannot replay effects',()=>{
  const missing=side(),c=atPad(missing);missing.a.io=missing.a.io.slice(0,1);
  assert.throws(()=>c.run(100),e=>e.reason==='device_observation_required');
  const failed=snapshot(missing);assert.throws(()=>c.run(100),e=>e.reason==='native_call_failed');assert.deepEqual(snapshot(missing),failed);
  assert.equal(missing.a.trace.some(o=>o.pc===0x80C0CF),false);
  const alias=side({busy:0}),a=atPad(alias);alias.mem.write16(0x1CAD,0xFFFF);
  assert.throws(()=>a.run(100),e=>e.reason==='task_native_helper_return_required'&&e.returnPc===0);
  assert.equal(alias.a.ctx.pc,0);assert.equal(alias.a.ctx.programBank,0x80);assert.equal(alias.a.ctx.s,0x1CAE);
  assert.equal(alias.a.trace.some(o=>o.pc===0x80C0CF),false);
});
test('a configured callback override executes its own routine instead of a registered continuation',()=>{
  const v=side(),routines=new Map(GAME_NMI_ROUTINES);let calls=0;
  routines.set(0x80C152,h=>{calls++;return h.rtl();});
  const c=new ObservedNmiContinuation(v.a,null,routines,GAME_NMI_CONTINUATIONS);
  while(c.run(1)===WAIT_PAUSED){}assert.equal(calls,1);assert.equal(v.a.ioIndex,1);assert.equal(v.mem.read16(0x1CA),0x1111);
});

test('all F290 callback owners retain the original long frames, saved widths and tail jump through RTI',()=>{
  const callbacks=[0x81BEC3,0x81D479,0x81DAD6,0x81DF0E,0x81DD54,0x81D93E,0x81DCAC,0x81E6AE];
  const d479=sceneAnimationSpecs.find(s=>s.entry===0x81D479);
  const graph=decodeWindows([...matrixNmiSpecs[2].windows,...matrixNmiSpecs[0].windows,...matrixNmiSpecs[1].windows,
    ...d479.windows,...introNmiSpecs.slice(0,2).flatMap(s=>s.windows),
    ...frontendSpecs.filter(s=>callbacks.includes(s.entry)).flatMap(s=>s.windows)]);
  const routines=new Map([...FRONTEND_NMI_ROUTINES,...MAIN_SCENE_ROUTINES]);
  const busySites=new Set([0x809E0B,0x809E0E,0x809E11,0x809E13,0x809E16,0x809E19]);
  // Unchanged leaf helpers are already proved independently. All changed
  // callback equations, both F290 widths and the entire pad wait execute as
  // original instructions on the reference side, including D93E's tail jump.
  for(const target of callbacks)for(const p of [0x41,0x31]){
    const padBank=[0x81DAD6,0x81DF0E,0x81D93E,0x81DCAC].includes(target)?0x81:0;
    const prepare=()=>{const v=side({p});v.mem.write16(0x6E,target&65535);v.mem.write8(0x70,0x81);
      for(let at=0x113E;at<0x115E;at+=2)v.mem.write16(at,0xFFFF);
      v.mem.write16(0x11A2,target===0x81E6AE?0:0xFFFF);v.mem.write16(0x1E,target===0x81D93E?0x401:0);
      v.a.io=v.a.io.map(o=>[0x809E0B,0x809E13].includes(o.pc)?{...o,address:padBank<<16|o.address&65535}:o);return v;};
    const n=prepare(),r=prepare(),states=[];let byte=0;const read=r.mem.read8.bind(r.mem);
    r.mem.read8=address=>{const o=r.a.io[r.a.ioIndex];if(o&&address===o.address+byte){const value=o.value>>>(8*byte++)&255;
      if(byte===o.width){r.a.ioIndex++;byte=0;}return value;}return read(address);};
    const c=r.a.ctx;r.h.pushByte(c.programBank);r.h.push(c.pc,2);r.h.pushByte(c.status);c.status=(c.status|4)&~8;c.programBank=0;
    const calls=new Map([...routines].filter(([entry])=>!graph.has(entry)).map(([entry,run])=>[entry,()=>{
      const result=run(dialogAccess(r.a),null,routines);return {rawReturnWord:result?.rawReturnWord??result};}]));
    const before=new Map([...busySites].map(pc=>[pc,()=>{c.programBank=pc>>>16;c.pc=pc&65535;states.push(snapshot(r));}]));
    runReference(graph,r.mem,c,{entry:0x00C112,root:'RTI',calls,before,io:r.a.trace});
    const continuation=new ObservedNmiContinuation(n.a,null,routines);let index=0,pauses=0;
    while(continuation.run(1)===WAIT_PAUSED){assert.ok(++pauses<150);
      const state=states[index];if(state&&n.a.ctx.programBank===0x80&&n.a.ctx.pc===state.ctx.pc){
        assert.deepEqual(snapshot(n),state,`${target.toString(16)} at ${state.ctx.pc.toString(16)}`);index++;
      }
    }
    assert.equal(index,states.length);assert.ok(index>=15);assert.deepEqual(snapshot(n),snapshot(r));
    assert.deepEqual(expand(n.a.trace),expand(r.a.trace));assert.equal(n.mem.read16(0x1CA),0xC100);
    assert.equal(n.a.ioIndex,n.a.io.length);
  }
});
