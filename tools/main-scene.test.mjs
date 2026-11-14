import test from 'node:test';import assert from 'node:assert/strict';
import {mainSceneSpecs,proveMainScene} from './main-scene-source.mjs';
import {sceneVideoSpecs} from './main-scene-video-source.mjs';
import {compareDialog,decodeWindows,prng,DialogTestMemory,rom} from './task-native-dialog-harness.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
import {playMatrixScene as liftedMatrixScene,playCutscene as liftedCutscene} from '../src/task/main-scene.mjs';
import {readInputLong} from '../src/task/main-scene.mjs';
import {playCutscene,fillCutsceneTextMap,drawCutsceneSprites,sendMirroredCutscenePicture} from '../proof/cutscene-reference/cutscene-scene.mjs';
import {playMatrixScene} from '../proof/matrix-reference/matrix-scene-loop.mjs';
import {SCENE_REFERENCE_ROUTINES as MAIN_SCENE_ROUTINES} from '../proof/scene-reference-routines.mjs';
import {MAIN_MOTION_ROUTINES} from '../src/task/main-loop-motion.mjs';
const functions=[playCutscene,playMatrixScene,fillCutsceneTextMap,drawCutsceneSprites,sendMirroredCutscenePicture,readInputLong];
const maps=mainSceneSpecs.map(s=>decodeWindows(s.windows));
test('scene entry own code pins PHK, conditional external tails and all local stack frames',()=>{
  mainSceneSpecs.forEach((s,i)=>proveMainScene(maps[i],s));
  assert.equal(MAIN_MOTION_ROUTINES.get(0x81CDF8),liftedCutscene);assert.equal(MAIN_MOTION_ROUTINES.get(0x81C3CA),liftedMatrixScene);
  for(const i of [0,1]){const s=mainSceneSpecs[i];assert.throws(()=>proveWordStack(maps[i],s.entry,'RTL',{externalReturns:new Map(s.externalReturns),externalTailReturns:new Map(s.externalTailReturns??[])}),/Unproved stack operation/);}
  const s=mainSceneSpecs[0];assert.throws(()=>proveWordStack(maps[0],s.entry,'RTL',{externalReturns:new Map(s.externalReturns),programBankPushes:new Set(s.programBankPushes)}),/Unproved external tail/);
  const cmd=sceneVideoSpecs.find(s=>s.name==='ec16');assert.throws(()=>proveWordStack(decodeWindows(cmd.windows),cmd.entry,'RTL'),/Unproved indirect call/);
});
// Synthetic complete own-code comparisons. Callees with their own proofs are identical stubs;
// these cases establish no complete cutscene, Matrix program, DMA or original NMI execution.
function scenario(entry,seed){const random=prng(seed),rnd=n=>Math.floor(random()*n),wram=new Uint8Array(0x20000);
  for(let i=0;i<wram.length;i++)wram[i]=rnd(256);const word=(at,v)=>{wram[at]=v&255;wram[at+1]=v>>>8&255;};
  word(0x1E,seed%2?0x8000:0);word(0x1CA,seed%3?0x9000:0);word(0x1D90,seed%2);word(0x1CE,seed%4?0:0x40);
  return {entry,wram,a:entry===0x81CDF8?seed%6|(seed&8?0x8000:0):rnd(65536),x:rnd(65536),y:rnd(65536),dbr:[0x80,0x81,0,0x7E][seed%4],p:rnd(256)&0xC7,
    waits:entry===0x81CDF8?[{pc:0x81CF4C,address:0x8011A3,width:1,value:0}]:[]};}
function stubs(h,seed,spec){let polls=0;return new Map(spec.externalReturns.map(([target,op])=>[target,()=>{
  h.a.trace.push({kind:'scene-call',pc:target,address:h.ctx.x,value:h.ctx.y*65536+h.ctx.a});
  h.dpWrite(0x70,h.dp(0x70)+h.ctx.a+h.ctx.x+h.ctx.y);h.load(seed*17);h.index('x',seed*2);h.index('y',seed*3);
  h.ctx.status^=0x41;if(target===0x81B2D1){h.ctx.status=(h.ctx.status&~1)|Number(seed%2&&polls++===0);}
  return {rawReturnWord:op==='RTL'?h.rtl():h.rts()};
}]));}
mainSceneSpecs.forEach((spec,i)=>test(`${spec.name}: all own scene equations match original instructions`,()=>{
  const covered=new Set();
  for(let seed=1;seed<=60;seed++){
    const s=scenario(spec.entry,seed),result=compareDialog(maps[i],s,{root:spec.rootReturn,waits:[0x81CF4C],native:(h,e)=>{
      const calls=stubs(h,seed,spec),routines=new Map([...calls].map(([t,run])=>[t,()=>run()]));return functions[i](h,e,routines);
    },calls:a=>stubs(dialogAccess(a),seed,spec)});
    assert.deepEqual(result.differences,[],`seed ${seed}`);for(const pc of result.visited)covered.add(pc);
  }
  // JML DFE7 is an intentionally stopped external tail, separately checked below.
  assert.deepEqual([...maps[i].keys()].filter(pc=>pc!==0x81CDFD&&!covered.has(pc)).map(pc=>pc.toString(16)),[]);
}));

test('scene entries reach BYTE observations; an unbound special tail creates no extra frame',()=>{
  const side=s=>{const mem=new DialogTestMemory(s.wram),a=new TaskAccessor({mem,a:s.a,x:s.x,y:s.y,s:0x1EF0,d:0,dbr:s.dbr,p:s.p,pc:s.entry&65535});
    a.load();a.ctx.programBank=s.entry>>>16;a.devices={write(){}};return {a,h:dialogAccess(a),mem};};
  const special=scenario(0x81CDF8,1);special.a=0x14;const n=side(special),before=n.mem.wram.slice(),stack=n.a.ctx.s;
  const incomplete=new Map(MAIN_SCENE_ROUTINES);incomplete.delete(0x81DFE7);
  assert.throws(()=>playCutscene(n.h,null,incomplete),e=>e.taskBoundary&&e.target===0x81DFE7);
  assert.deepEqual(n.mem.wram,before);assert.equal(n.a.ctx.s,stack);assert.equal(n.a.ctx.status&0x83,3);
  for(const entry of [0x81CDF8,0x81C3CA]){
    const s=scenario(entry,1);s.a=0;s.dbr=0x80;s.p=0;const state=side(s),routines=new Map(MAIN_SCENE_ROUTINES);
    // The exact init/command/decompression graphs run here; only audio is stubbed to avoid hardware replies.
    for(const target of [0x81EF47,0x81F007,0x81F130])routines.set(target,h=>h.rtl());
    assert.throws(()=>functions[entry===0x81CDF8?0:1](state.h,{mode:'record-observations',values:[],waitIndex:0,waitEvents:[]},routines),
      e=>e.taskBoundary&&e.reason==='task_wait_observation_required'&&e.pc===0x81EECD&&e.width===1);
  }
});
