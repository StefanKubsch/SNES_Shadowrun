import test from 'node:test';
import assert from 'node:assert/strict';
import {mainMotionHelperSpecs, mainBAD5Spec, mainMovementGraphSpec, proveMainMotionHelperSource} from './main-motion-helpers-source.mjs';
import {compareDialog, decodeWindows, prng} from './task-native-dialog-harness.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';
import {testUpperXEdge, testLowerXEdge, testUpperYEdge, testLowerYEdge, testHeightCells} from '../src/task/main-motion-collision.mjs';
import {moveObjectTowardsTarget} from '../src/task/main-motion-target.mjs';
import {recordFormationStep} from '../proof/game-reference/main-camera.mjs';
import {runFormationStep} from '../src/game/main-upkeep.mjs';
import {moveAndAnimateObjects, MAIN_MOTION_ROUTINES} from '../src/task/main-loop-motion.mjs';
import {MAIN_LOOP_ROUTINES} from '../src/vm/main-loop.mjs';
import {runObjectMotion} from '../src/game/main-upkeep.mjs';
import {searchUpperXEdge, searchLowerXEdge, searchUpperYEdge, searchLowerYEdge, searchHeightCells} from '../src/game/object-collision.mjs';
import {walkTowardsTarget} from '../src/game/object-target.mjs';

const functions = [testUpperXEdge, testLowerXEdge, testUpperYEdge, testLowerYEdge, testHeightCells, moveObjectTowardsTarget];
// The lifted collision tests (src/game/object-collision.mjs) and walk (object-target.mjs).
const lifted = [searchUpperXEdge, searchLowerXEdge, searchUpperYEdge, searchLowerYEdge, searchHeightCells, walkTowardsTarget];
const maps = mainMotionHelperSpecs.map(s => decodeWindows(s.windows));
test('six main-loop motion helper graphs pin original bytes, stack, widths and DBR', () => {
  mainMotionHelperSpecs.forEach((s, i) => {
    const p = proveMainMotionHelperSource(maps[i], s);
    assert.equal(p.reachable_instructions, [194, 194, 197, 197, 218, 205][i]);
    assert.equal(p.external_return_assumptions, i === 5 ? 1 : 0);
  });
});

// Shared-state fixtures with finite original lists. Every queried grid cell refers to the same
// two-record static/object lists; empty heads, rejection edges, metadata and box borders vary.
function motionScenario(entry, seed) {
  const random = prng(seed), rnd = n => Math.floor(random() * n), wram = new Uint8Array(0x20000);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(256);
  const word = (at, v) => {wram[at] = v & 255; wram[at + 1] = v >>> 8 & 255;};
  const slot = rnd(44) * 2, x = rnd(0x800), y = rnd(0x800), z = 0x100 + rnd(0x400);
  word(0xE28 + slot, x * 4); word(0xE80 + slot, y * 4); word(0xED8 + slot, z * 4);
  const loX = rnd(12), loY = rnd(12), hiX = loX + rnd(100), hiY = loY + rnd(100), hiZ = rnd(20);
  for (const [f, v] of [[0x4240,loX],[0x4298,hiX],[0x42F0,loY],[0x4348,hiY],[0x43A0,hiZ]]) word(f + slot, v);
  // Box offsets near 7FFF let the extent additions overflow (the overflow the tests leave).
  if (seed % 7 === 0) for (const f of [0x4298, 0x4348, 0x43A0]) word(f + slot, 0x7F80 + rnd(0x100));
  word(0x1458 + slot, seed % 4); word(0xCC2, 0x56);
  for (let cell = 0; cell < 0x200; cell += 2) {
    word(0xDEAC + cell, seed % 11 === 0 ? 0xFFFF : 0);
    word(0xE0AC + cell, seed % 13 === 0 ? 0xFFFF : 4);
  }
  for (let i = 0; i < 4; i++) {
    const node = i * 2, record = 0x400 + i * 12;
    word(0xEF3C + node, record); word(0xF79C + node, i % 2 ? 0xFFFF : node + 2);
    const box = [x - rnd(4), y - rnd(4), z - rnd(4), x + 20 + rnd(120), y + 20 + rnd(120), z + [0,1,2,4,5,0x40][rnd(6)]];
    // Force each early-rejection edge independently, keeping later records available.
    const reject = (seed + i) % 13;
    if (reject === 0) box[0] = x + hiX + 1;
    if (reject === 1) box[3] = x + loX - 1;
    if (reject === 2) box[1] = y + hiY + 1;
    if (reject === 3) box[4] = y + loY - 1;
    if (reject === 4) box[2] = z + hiZ + 1;
    if (reject === 5) box[5] = z - 1;
    if (reject === 6) box[0] = x + 1;
    if (reject === 7) box[3] = x;
    if (reject === 8) box[1] = y + 1;
    if (reject === 9) box[4] = y;
    if (reject === 10) box[2] = z + 1;
    box.forEach((v, n) => word(0xE2AC + record + n * 2, v));
    word(0x1E214 + (record >>> 2), i < 2 ? (seed + i) % 2 : [slot, 0x56, 0x54][(seed + i) % 3]);
  }
  return {entry, wram, a:rnd(65536), x:slot, y:rnd(65536), dbr:[0x80,0,0x7E][seed%3], p:rnd(256)&0xC7};
}

// AAAF has its own source/differential proof. This stub preserves its calling convention but
// deliberately changes shared state and flags, so the caller cannot rely on cached register values.
const action = h => {
  h.a.trace.push({kind:'action', x:h.ctx.x, y:h.ctx.y, direction:h.dp(2), s:h.ctx.s});
  h.load(h.dp(2) * 17); h.write(h.abs(0x1038) + h.ctx.x, h.dp(2) & 2 ? 2 : 0);
  h.ctx.status ^= 0x41;
  return {rawReturnWord:h.rts()};
};

function targetScenario(seed) {
  const s = motionScenario(0x80C9E0, seed), random = prng(seed * 3), rnd = n => Math.floor(random()*n);
  const word = (at,v) => {s.wram[at]=v&255;s.wram[at+1]=v>>>8&255;}, x=s.x;
  const currentX=0x400+rnd(0x100), currentY=0x400+rnd(0x100);
  word(0xE28+x,currentX);word(0xE80+x,currentY);word(0x1038+x,seed%2?2:0);
  const dx=[0,1,8,11,12,15,16,20,80,0x7FFF,0x8000][rnd(11)]*(seed&4?-1:1);
  const dy=[0,1,8,11,12,15,16,20,80,0x7FFF,0x8000][rnd(11)]*(seed&8?-1:1);
  word(0x1458+x,seed&16?8:0);word(0x40E0+x,[1,1,1,2,0,0xFFFF][Math.floor(seed/32)%6]);
  word(0x4138+x,seed%32);
  if(seed%3){word(0x4190+x,currentX+dx||1);word(0x41E8+x,currentY+dy);}
  else{word(0x4190+x,0);word(0x41E8+x,x===0x56?0x54:0x56);word(0xE28+(x===0x56?0x54:0x56),currentX+dx);word(0xE80+(x===0x56?0x54:0x56),currentY+dy);}
  // Task chain: no task, direct task, or one resumed child link.
  word(0x1350+x,seed%3===0?0xFFFF:0x20);word(0xBA2+0x20,seed%3===1?0x8000:0);word(0x372+0x20,0x40);word(0xBA2+0x40,0);
  return s;
}

for(const [kind,list] of [['',functions],['lifted ',lifted]])
mainMotionHelperSpecs.forEach((spec,i)=>i<list.length&&test(`${kind}${spec.name}: all own equations match the original instruction graph`,()=>{
  const covered=new Set();
  for(let seed=1;seed<=1800;seed++){
    const s=i===5?targetScenario(seed):motionScenario(spec.entry,seed);
    const result=compareDialog(maps[i],s,{native:h=>i===5?list[i](h,action):list[i](h),
      calls:acc=>new Map([[0x80AAAF,()=>action(dialogAccess(acc))]])});
    assert.deepEqual(result.differences,[],`seed ${seed}`);
    for(const pc of result.visited)covered.add(pc);
  }
  assert.deepEqual([...maps[i].keys()].filter(pc=>!covered.has(pc)).map(pc=>pc.toString(16)),[]);
}));

test('BAD5 formation history matches every original instruction, including unchanged and wrapped entries',()=>{
  const map=decodeWindows(mainBAD5Spec.windows),covered=new Set();
  proveMainMotionHelperSource(map,mainBAD5Spec);
  assert.equal(MAIN_LOOP_ROUTINES.get(0x80BAD5),runFormationStep);
  for(let seed=1;seed<=120;seed++){
    const s=motionScenario(0x80BAD5,seed),word=(at,v)=>{s.wram[at]=v&255;s.wram[at+1]=v>>>8&255;};
    word(0xCC2,s.x);word(0x1D65,seed%3?0:1);const head=[0,2,0x7E,0x8000,0xFFFF][seed%5];word(0xD18,head);
    for(const [n,f] of [0xE28,0xE80,0xED8].entries()){
      const at=f+s.x,v=s.wram[at]|s.wram[at+1]<<8;
      word([0x44A8,0x4528,0x45A8][n]+head,n<seed%4?v:v^1);
    }
    const result=compareDialog(map,s,{native:h=>recordFormationStep(h)});assert.deepEqual(result.differences,[],`seed ${seed}`);
    for(const pc of result.visited)covered.add(pc);
  }
  assert.deepEqual([...map.keys()].filter(pc=>!covered.has(pc)),[]);
});

// The register-level equations (the reference) and the lifted pass (src/game/object-motion.mjs).
for(const [name,run] of [['AFC4',moveAndAnimateObjects],['lifted AFC4',runObjectMotion]])
test(`${name} combines grid, all six bound motion helpers and animation with real nested frames`,()=>{
  const spec=mainMovementGraphSpec,map=decodeWindows(spec.windows),proof=proveMainMotionHelperSource(map,spec);
  assert.equal(proof.reachable_instructions,1242);assert.equal(proof.maximum_local_stack_bytes,19);
  const animation=h=>{h.a.trace.push({kind:'animation',x:h.ctx.x,y:h.ctx.y,bank:h.ctx.bank,s:h.ctx.s});h.load(0xABCD);return {rawReturnWord:h.rts()};};
  const walk=name==='AFC4'?moveObjectTowardsTarget:walkTowardsTarget;
  const routines=new Map(MAIN_MOTION_ROUTINES);routines.set(0x80C9E0,h=>walk(h,action));routines.set(0x80AC2F,animation);
  const covered=new Set(),events=new Set();
  for(let seed=1;seed<=240;seed++){
    const s=motionScenario(0x80AFC4,seed),word=(at,v)=>{s.wram[at]=v&255;s.wram[at+1]=v>>>8&255;},x=s.x;
    word(0x14B0,0);word(0x14B2,x);word(0xDEAA,8);
    word(0x1458+x,[0x100,0x140,0x160,0x163,0x400][seed%5]);
    word(0xD20+x,[0,4,0xFFFC][seed%3]);word(0xD78+x,[4,0xFFFC,0][seed%3]);word(0xDD0+x,[0,4,0xFFFC][seed%3]);
    // Heights at the floor 0100 after the fall step (reached at 0100, not below).
    if(seed%6===5){word(0xED8+x,[0x104,0x105,0x100][Math.floor(seed/6)%3]);word(0xDD0+x,0xFFFC);}
    word(0x40E0+x,seed%4===0?1:0);word(0x4138+x,seed%32);word(0x4190+x,0x600);word(0x41E8+x,0x700);word(0x1350+x,0xFFFF);
    const result=compareDialog(map,s,{native:(h,e)=>run(h,e,routines),calls:acc=>new Map([
      [0x80AAAF,()=>action(dialogAccess(acc))],[0x80AC2F,()=>animation(dialogAccess(acc))],
    ])});
    assert.deepEqual(result.differences,[],`seed ${seed}`);for(const pc of result.visited)covered.add(pc);
    // The graph proves callsites; observed native traces also show both external interfaces were exercised.
    if(result.visited.has(0x80C990)||result.visited.has(0x80C8A6))events.add('action');
    if(result.visited.has(0x80AFF4))events.add('animation');
  }
  for(const helper of mainMotionHelperSpecs)assert.ok(covered.has(helper.entry),`missing helper ${helper.entry.toString(16)}`);
  assert.deepEqual([...events].sort(),['action','animation']);
});
