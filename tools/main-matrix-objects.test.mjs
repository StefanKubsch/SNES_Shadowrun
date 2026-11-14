import test from 'node:test';import assert from 'node:assert/strict';
import {matrixObjectSpecs,proveMatrixObjects,matrixObjectTables} from './main-matrix-objects-source.mjs';
import {compareDialog,decodeWindows,prng,window,DialogTestMemory} from './task-native-dialog-harness.mjs';
import {MATRIX_OBJECT_ROUTINES,drawMatrixObjects,addMatrixObject,openNodeGates,removeFinishedMatrixObjects} from '../proof/matrix-reference/main-matrix-objects.mjs';
import {playMatrixScene} from '../proof/matrix-reference/matrix-scene-loop.mjs';
import {SCENE_REFERENCE_ROUTINES as MAIN_SCENE_ROUTINES} from '../proof/scene-reference-routines.mjs';
import {mainSceneSpecs} from './main-scene-source.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';import {TaskAccessor} from '../src/vm/task-accessor.mjs';
const maps=matrixObjectSpecs.map(s=>decodeWindows(s.windows));
const specFor=name=>matrixObjectSpecs.find(s=>s.name===name);
test('Matrix objects pin their complete own code, actual data tables and separate helper stack contracts',()=>{
  matrixObjectSpecs.forEach((s,i)=>proveMatrixObjects(maps[i],s));for(const t of matrixObjectTables)assert.equal(window(t.start,t.start+t.hex.length/2).hex,t.hex);
  for(const [target,run]of MATRIX_OBJECT_ROUTINES)assert.equal(MAIN_SCENE_ROUTINES.get(target),run);
  assert.equal(MAIN_SCENE_ROUTINES.has(0x81BEC3),true);assert.equal(MAIN_SCENE_ROUTINES.has(0x81BD44),true);
});
function sample(entry,seed){const random=prng(seed),rnd=n=>Math.floor(random()*n),wram=new Uint8Array(0x20000);
  for(let i=0;i<wram.length;i++)wram[i]=rnd(256);const word=(at,v)=>{wram[at]=v&255;wram[at+1]=v>>>8&255;};
  const s={entry,wram,a:seed%2?0:0x400,x:seed%33*2,y:rnd(65536),dbr:[0x80,0x81,0,0x7E][seed%4],p:rnd(256)&0xC7,word};
  word(0x175C,0x2000);word(0x1748,seed%8*8);word(0x174A,0);word(0x173C,[0,0x3C,0x3E,0xFFFF][seed%4]);word(0x2C,seed%8*4);
  word(0x1734,seed%3);word(0x1736,seed%3);
  word(0x1800,0x35A0);word(0x1802,0xFFFF);word(0x1804,0xFFFE);
  for(let n=0;n<33;n++){const x=n*2;word(0x1356+x,(n+seed)%6);word(0x1398+x,((n+seed)%2?0x8000:0)|((n+seed)%3?1:0));
    word(0x1524+x,[0xFFF7,0xFFF8,0,0xF7,0xF8][(n+seed)%5]);word(0x1566+x,[0xFFF8,0xFFF9,1,0xD8,0xD9][(n+seed*3)%5]);
    word(0x14A0+x,(seed+n)%3-1);word(0x14E2+x,(seed+n)%3-1);word(0x15A8+x,0x1800);word(0x15EA+x,(n+seed)%3*2);
    word(0x162C+x,(seed+n)%3);word(0x166E+x,1+(seed+n)%7);word(0x13DA+x,0x35A0+n);}
  for(let n=0;n<7;n++){word(0x16F2+n*2,n*4+2);word(0x1700+n*2,8);}
  if(entry===0x81B54C){s.a=[0xFFC0,2,64,0xFFFE][seed%4];s.x=seed%7*2;}
  if(entry===0x81B56F){s.dbr=0x81;s.a=seed%3?0xFE:0;word(0x1756,0);if(seed%8<7)word(0x16F2+seed%8*2,0xFFFF);
    for(let n=0;n<1024;n++)word(0x12000+n*2,0);
    // Original directional offsets, with one seed class deliberately missing 7.
    const delta=[-32,1,32,-1],direction=seed%5;
    for(let n=0;n<7;n++){const cell=8*32+n*4+2;if(direction<4){word(0x12000+(cell+delta[direction])*2,7);
        const center=cell+delta[direction];for(let d=0;d<4;d++)if(d!==seed%4)word(0x12000+(center+delta[d])*2,d%2?0x3E:0x3F);}}
    for(let n=0;n<33;n++)word(0x1356+n*2,seed%4?0:1);}
  if(entry===0x81B8C8){for(let n=0;n<33;n++)word(0x1356+n*2,n===seed%34?0:1);word(0x1A,0x1234);word(0x1C,0xFEDC);word(0x1E,2+seed%3);}
  if(entry===0x81BD99)word(0x15EA+s.x,Math.floor(seed/3)%3*2);
  if(entry===0x81EE0C)word(0x2C,seed%3?0x1FC:0);
  return s;
}
function routines(h){const r=new Map(MAIN_SCENE_ROUTINES);r.set(0x81F007,h=>{
  h.a.trace.push({kind:'matrix-apu-call',pc:0x81F007,address:h.ctx.x,value:h.ctx.a});h.load(0xA55A);h.index('x',0x100);h.index('y',0x200);return h.rtl();});return r;}
const calls=(h,e,r)=>new Map([...r].map(([t,run])=>[t,()=>{const value=run(h,e,r);return {rawReturnWord:value?.rawReturnWord??value};}]));
matrixObjectSpecs.forEach((spec,i)=>test(`${spec.name}: every Matrix object instruction agrees with the original`,()=>{
  const covered=new Set();for(let seed=1;seed<=120;seed++){
    const result=compareDialog(maps[i],sample(spec.entry,seed),{root:spec.rootReturn,native:(h,e)=>MATRIX_OBJECT_ROUTINES.get(spec.entry)(h,e,routines(h)),
      calls:(a,e)=>{const h=dialogAccess(a);return new Map([...calls(h,e,routines(h))].filter(([t])=>!maps[i].has(t)));}});
    assert.deepEqual(result.differences,[],`seed ${seed}`);for(const pc of result.visited)covered.add(pc);
  }assert.deepEqual([...maps[i].keys()].filter(pc=>!covered.has(pc)).map(pc=>pc.toString(16)),[]);
}));
function side(s){const mem=new DialogTestMemory(s.wram),a=new TaskAccessor({mem,a:s.a,x:s.x,y:s.y,s:0x1EF0,d:0,dbr:s.dbr,p:s.p,pc:s.entry&65535});
  a.load();a.ctx.programBank=0x81;a.devices={write(){}};return {mem,a,h:dialogAccess(a)};}
test('a full object array returns without creating a record or an audio call',()=>{
  const s=sample(0x81B8C8,33);for(let n=0;n<33;n++)s.word(0x1356+n*2,1);const before=s.wram.slice(),state=side(s),r=routines(state.h);state.h.push(0x1234,2);
  addMatrixObject(state.h,null,r);assert.deepEqual(state.mem.wram.subarray(0x1356,0x175C),before.subarray(0x1356,0x175C));assert.equal(state.a.trace,null);
});
test('B56F counts candidates before allocation, even when every object slot is occupied',()=>{
  const s=sample(0x81B56F,20);for(let n=0;n<33;n++)s.word(0x1356+n*2,1);const state=side(s);state.a.trace=[];state.h.push(0x1234,2);
  openNodeGates(state.h,null,routines(state.h));assert.ok(state.h.ctx.a>0);
  assert.deepEqual(state.a.trace,[]);for(let n=0;n<33;n++)assert.equal(state.h.read(0x7E1356+n*2),1);
});
test('the audio wrapper rereads saved WORD values and restores X/Y from the real stack',()=>{
  const s=sample(0x81B1C6,1);s.a=0xABCD;s.x=0x3456;s.y=0x789A;const transcripts=[];
  const bind=h=>{const seen=[];transcripts.push(seen);return new Map([[0x81F007,h=>{seen.push([h.ctx.a,h.ctx.x]);
    if(seen.length===1)h.write((h.ctx.s+4)&65535,0x1234,2);h.load(0x55AA);h.index('x',1);h.index('y',2);return h.rtl();}]]);};
  assert.deepEqual(compareDialog(decodeWindows(specFor('b1c6').windows),s,{native:(h,e)=>MATRIX_OBJECT_ROUTINES.get(s.entry)(h,e,bind(h)),
    calls:(a,e)=>{const h=dialogAccess(a),r=bind(h);return calls(h,e,r);}}).differences,[]);
  assert.deepEqual(transcripts,[[[15,15],[7,0xFF34]],[[15,15],[7,0xFF34]]]);
});
test('sprite clipping retains the original CLC/SBC vertical borrow and negative-X high bits',()=>{
  for(const [x,y,visible]of [[0,0,true],[0,0xD8,true],[0,0xD9,false],[0,0xFFF9,true],[0,0xFFF8,false],[0xFFF8,1,true],[0xFFF7,1,false],[0xF7,1,true],[0xF8,1,false]]){
    const s=sample(0x81BD99,1);s.x=0;s.dbr=0x81;s.word(0x1524,x);s.word(0x1566,y);s.word(0x14A0,0);s.word(0x14E2,0);s.word(0x1734,0);s.word(0x1736,0);
    s.word(0x1398,0x8000);s.word(0x162C,2);s.word(0x2C,0);s.word(0x111E,0);
    const result=compareDialog(maps[matrixObjectSpecs.indexOf(specFor('bd99'))],s,{native:h=>{drawMatrixObjects(h);
      assert.equal(h.dp(0x10,2),(y-1)&65535);assert.equal(h.dp(0x2C,2),visible?4:0);
      if(visible){assert.equal(h.read(h.abs(0xF1F),1),(y-1)&255);if(x===0xFFF8)assert.equal(h.read(h.abs(0x111E)),1);}}});
    assert.deepEqual(result.differences,[],`${x.toString(16)},${y.toString(16)}`);
  }
});
test('FFFF restarts an animation, FFFE clears activity and an unterminated reset loop hits the existing access limit',()=>{
  for(const ending of [0xFFFF,0xFFFE]){const s=sample(0x81BD99,2);s.x=0;s.dbr=0x81;s.word(0x1398,0x8001);s.word(0x162C,1);s.word(0x15EA,2);s.word(0x1802,ending);
    assert.deepEqual(compareDialog(decodeWindows(specFor('bd99').windows),s,{native:h=>{drawMatrixObjects(h);assert.equal(h.read(h.abs(0x1398))&1,0);
      if(ending===0xFFFF){assert.equal(h.read(h.abs(0x13DA)),0x35A0);assert.equal(h.read(h.abs(0x15EA)),2);}}}).differences,[]);}
  const s=sample(0x81BD99,2);s.x=0;s.dbr=0x81;s.word(0x1398,0x8000);s.word(0x162C,1);s.word(0x1800,0xFFFF);s.word(0x15EA,0);const {h}=side(s);
  assert.throws(()=>drawMatrixObjects(h),e=>e.reason==='native_access_limit');
});
test('sprite shadow helpers preserve incoming status and use the real BYTE/WORD return modes',()=>{
  for(const name of ['edd7','ee0c'])for(const p of [0x10,0x20,0x30,0x71,0xB7]){const spec=specFor(name),s=sample(spec.entry,3);s.p=p;s.word(0x2C,0x1FC);
    assert.deepEqual(compareDialog(decodeWindows(spec.windows),s,{root:'RTL',native:h=>MATRIX_OBJECT_ROUTINES.get(spec.entry)(h)}).differences,[]);}
});
function matchingAck(h){const read=h.a.absoluteRead;h.a.absoluteRead=(offset,width,pc)=>{
  if(offset!==0x2140)return read(offset,width,pc);assert.equal(width,1);assert.ok([0x81F00E,0x81F046].includes(pc));const value=h.read(h.abs(0x1CE4),1);
  h.a.trace.push({kind:'read',pc,address:h.abs(offset),width,value});return value;};}
test('real Matrix allocation audio helpers require matching APU observations',()=>{
  const s=sample(0x81B8C8,1);s.dbr=0x81;s.wram[0x1CE4]=0;
  s.io=[{pc:0x81F00E,address:0x812140,width:1,value:0},{pc:0x81F00E,address:0x812140,width:1,value:1}];
  assert.deepEqual(compareDialog(decodeWindows(specFor('b8c8').windows),s,{native:(h,e)=>addMatrixObject(h,e,MAIN_SCENE_ROUTINES),calls:(a,e)=>calls(dialogAccess(a),e,MAIN_SCENE_ROUTINES)}).differences,[]);
  for(const io of [[],s.io.slice(0,1),[{...s.io[0],width:2}]])assert.throws(()=>compareDialog(decodeWindows(specFor('b8c8').windows),{...s,io},{native:(h,e)=>addMatrixObject(h,e,MAIN_SCENE_ROUTINES)}),e=>e.reason==='device_observation_required');
});
test('C3CA reaches a deliberately removed BD44 before its frame through real object and OAM graphs',()=>{
  const s=sample(0x81C3CA,8);s.dbr=0x80;s.p=0;s.word(0x1D90,1);s.word(0x1D8E,0xFE);s.wram[0x1CE4]=0;
  s.wram.set(Buffer.from(window(0x98FFFA,0x98FFFD).hex,'hex'),0x8C);s.wram[0x1D8F]=0;
  s.inputs=[{pc:0x809E1A,address:0x8101CA,width:2,value:0}];const map=decodeWindows(mainSceneSpecs.find(s=>s.name==='c3ca').windows);let counter=0;
  const routines=new Map(MAIN_SCENE_ROUTINES);routines.delete(0x81BD44);
  assert.throws(()=>compareDialog(map,s,{root:'RTL',feed:()=>++counter&255,native:(h,e)=>{matchingAck(h);
    try{playMatrixScene(h,e,routines);}catch(error){if(error.reason==='main_loop_frontier'){
      assert.equal(error.target,0x81BD44);assert.equal(h.ctx.s,0x1EEB);assert.equal(h.dp(0x6E,2),0xBEC3);assert.equal(e.inputIndex,1);
      assert.ok(h.a.trace.some(o=>o.pc===0x81C00A)); // real fade-in has finished
    }throw error;}}}),e=>e.taskBoundary&&e.reason==='main_loop_frontier'&&e.target===0x81BD44);
});
