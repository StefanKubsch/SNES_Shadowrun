import test from 'node:test';
import assert from 'node:assert/strict';
import {mainCameraSpecs,proveMainCameraSource} from './main-loop-camera-source.mjs';
import {compareDialog,decodeWindows,prng} from './task-native-dialog-harness.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';
import {clampToCameraBox,updateCameraTileBuffers} from '../src/task/main-loop-camera.mjs';
import {projectPlayerAndMoveCamera} from '../proof/game-reference/main-camera.mjs';
import {passGloveActionToTask} from '../proof/game-reference/main-glove-action.mjs';
import {updateTimeLimit} from '../proof/game-reference/main-timer.mjs';
import {applyColourRequest,animatePalettes,releaseExpiredWindows} from '../proof/game-reference/main-upkeep.mjs';
import {runCameraFollow,runColourEffect,runNoticeTimeouts,runPaletteCycles,runTileBuffers,runTimeLimit,runGloveAction,runFrameWait,runPadPresses} from '../src/game/main-upkeep.mjs';
import {MAIN_LOOP_ROUTINES,MAIN_LOOP_LIFTED_TOP} from '../src/vm/main-loop.mjs';
import {MAIN_UPKEEP_ROUTINES} from '../src/task/main-loop-upkeep.mjs';

// The camera, the colour effect, the palette cycles, the notice time limits, the time limit and the glove action are proven as references; the main loop
// binds their lifted entries (src/game/main-upkeep.mjs).
const bound=[null,runCameraFollow,runTileBuffers,runColourEffect,runPaletteCycles,runNoticeTimeouts,runTimeLimit,runGloveAction];
const functions=[clampToCameraBox,projectPlayerAndMoveCamera,updateCameraTileBuffers,applyColourRequest,animatePalettes,releaseExpiredWindows,updateTimeLimit,passGloveActionToTask];
const maps=mainCameraSpecs.map(s=>decodeWindows(s.windows));
test('camera and upkeep pin every own original instruction, return width, DBR and local stack',()=>{
  mainCameraSpecs.forEach((s,i)=>{
    const p=proveMainCameraSource(maps[i],s);
    assert.equal(p.reachable_instructions,[79,142,164,77,34,41,64,132][i]);
    if(i>0)assert.equal(MAIN_LOOP_ROUTINES.get(s.entry),bound[i]);
  });
  // The table keeps the register-level word wait and pad word; the loop runs its lifted
  // entries in their place (lifted with lag-free frames, else register-level).
  for(const t of [0x81B0A1,0x809E1A])assert.equal(MAIN_LOOP_ROUTINES.get(t),MAIN_UPKEEP_ROUTINES.get(t));
  assert.equal(MAIN_LOOP_LIFTED_TOP.get(0x81B0A1),runFrameWait);assert.equal(MAIN_LOOP_LIFTED_TOP.get(0x809E1A),runPadPresses);
  for(const t of [0x80B8DE,0x80BE6D])assert.equal(typeof MAIN_LOOP_ROUTINES.get(t),'function');
});

function scenario(entry,seed){
  const random=prng(seed),rnd=n=>Math.floor(random()*n),wram=new Uint8Array(0x20000);
  for(let i=0;i<wram.length;i++)wram[i]=rnd(256);
  const word=(at,v)=>{wram[at]=v&255;wram[at+1]=v>>>8&255;};
  const x=0x20,choice=a=>a[seed%a.length];
  // Valid camera pointer into shared WRAM; each early exit and clamp is varied independently.
  word(0xCDA,0);word(0xCDB,0);
  if(seed%3){word(0xCDA,0x6000);word(0xCDB,0x7E60);}
  for(const [i,v] of [choice([0,0x20,0xFFFF]),choice([0xFF,0x100,0x400]),choice([0,0x100,0x200]),choice([0x300,0x400,0x7FF])].entries())word(0x6001+i*2,v);
  word(0xCC2,seed%17===0?0xFFFF:x);
  word(0xCC4,choice([0,0x20,0x3FF,0x400,0x7FF,0x800,0x8001,rnd(0x1000)]));
  word(0xCC6,choice([0,0x20,0x23F,0x240,0x47B,0x47C,0x8001,rnd(0x1000)]));
  word(0xCC8,choice([0,4,0x20,0xFFFC,0xFFE0,0x8000,0x7FFF]));
  word(0xCCA,choice([0,0xFFE0,0xFFFC,0x20,4,0x8000,0x7FFF]));
  word(0xE28+x,choice([0,0x400,0x500,rnd(65536)]));word(0xE80+x,choice([0,0x400,0x500,rnd(65536)]));
  word(0xF30+x,choice([0x10,0x20,0x40,rnd(65536)]));word(0xED8+x,choice([0,0x200,0x800,rnd(65536)]));
  word(0x1FDC,choice([0,1,2,4,8,0x8000,0xFFFF,6]));word(0x1FDE,choice([0x140,0x1F0,0x100,0xFFFF,rnd(65536)]));
  for(let slot=0;slot<4;slot++){
    word(0x1CBE+slot*2,choice([0,1,0x80,0x8000,0xFFFF]));
    word(0x1CC6+slot*2,choice([0,0xFFFF]));word(0x1CD6+slot*2,choice([0,1,0xFFFF,0x8000]));word(0x1CD2+slot*2,choice([0,2,0x8000]));
    word(0x216+slot*2,(seed+slot)%3?slot:0xFFFF);word(0x21E+slot*2,(seed+slot)%3);
  }
  word(0x202,seed%2);
  if(entry===0x818076&&seed%11===0){word(0x1CBE,0x80);word(0x1CC2,0);word(0x1CC6,0);word(0x1CD6,1);word(0x1CD2,2);}
  word(0x1D89,choice([0xFFFF,0,1,2,0x10]));word(0x1D87,choice([0,1,0x21,0x41,0xE00,0xE10,0xE41]));
  // A finite task chain, optional resumed child, valid target and controlled distance.
  word(0x1D5D,seed%19===0?1:0);word(0x1D5F,seed%23===0?1:0);word(0x1DA,seed%13===0?0xFFFF:0x10);word(0x1DE,0x10);
  word(0x1CE,choice([0,0x10,0x20,0x8000,0x8010,0x8020]));word(0x1350+0x10,seed%29===0?0xFFFF:0x40);
  word(0xBA2+0x40,seed%2?0x8000:choice([0,2,0x600,0x80,0x67F2]));word(0x372+0x40,0x60);word(0xBA2+0x60,choice([0,2,0x600,0x80,0x67F2]));
  word(0x4450+0x10,seed%2?0:0x1234);
  if(entry===0x80BF3B){word(0xCC2,x);for(const [i,at]of [0xE28,0xE80,0xED8].entries()){
    const v=rnd(0x800);word(at+x,v);word(at+0x10,v+(i===2?choice([0,0x80,0x81,0xA0,0xA1,-0x200,0x10000-0x80]):[0,1,-1][Math.floor(seed/7)%3]));}}
  return {entry,wram,a:rnd(65536),x,y:rnd(65536),dbr:choice([0x80,0,0x7E]),p:rnd(256)&0xC7,seed,word};
}
// Separate callee proofs are not repeated here. The same stubs on both sides vary registers,
// flags and shared scratch while retaining the original frame/return type.
function stubs(h,seed){
  return new Map(mainCameraSpecs.flatMap(s=>s.externalReturns).map(([target])=>[target,()=>{
    h.dpWrite(0x70,(h.dp(0x70)+h.ctx.a+h.ctx.x+h.ctx.y)&65535);
    if(target===0x80C560)h.dpWrite(0,[0,0x3332,0x3333,0xFFFF][seed%4]);
    if(target===0x80C51F)h.dpWrite(0,seed%3);
    h.load(target===0x8099EB?[0,2,0x80,0x600][Math.floor(seed/6)%4]:seed*13);
    h.index('x',seed*2);h.index('y',seed*3);h.ctx.status^=0x41;
    return {rawReturnWord:h.rts()};
  }]));
}
mainCameraSpecs.forEach((spec,i)=>test(`${spec.name}: native equations match the original and cover every own instruction`,()=>{
  const covered=new Set();
  for(let seed=1;seed<=1000;seed++){
    const s=scenario(spec.entry,seed);
    const result=compareDialog(maps[i],s,{root:spec.rootReturn,native:(h,e)=>{
      const routines=new Map([...stubs(h,seed)].map(([t,run])=>[t,()=>run()]));return functions[i](h,e,routines);
    },calls:a=>stubs(dialogAccess(a),seed)});
    assert.deepEqual(result.differences,[],`seed ${seed}`);for(const pc of result.visited)covered.add(pc);
  }
  assert.deepEqual([...maps[i].keys()].filter(pc=>!covered.has(pc)).map(pc=>pc.toString(16)),[]);
}));
