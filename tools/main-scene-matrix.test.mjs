import test from 'node:test';import assert from 'node:assert/strict';
import {matrixSetupSpecs,proveMatrixSetup,matrixSetupTables} from './main-scene-matrix-source.mjs';
import {compareDialog,decodeWindows,prng,window,rom,DialogTestMemory} from './task-native-dialog-harness.mjs';
import {MATRIX_SETUP_ROUTINES,typeMatrixText,queueMatrixText,queueMatrixMessages} from '../proof/matrix-reference/main-scene-matrix.mjs';
import {playMatrixScene} from '../proof/matrix-reference/matrix-scene-loop.mjs';
import {SCENE_REFERENCE_ROUTINES as MAIN_SCENE_ROUTINES} from '../proof/scene-reference-routines.mjs';
import {mainSceneSpecs} from './main-scene-source.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
const maps=matrixSetupSpecs.map(s=>decodeWindows(s.windows));
test('Matrix setup pins all own instructions, crossed WORD pulls and the admitted text dispatch table',()=>{
  matrixSetupSpecs.forEach((s,i)=>proveMatrixSetup(maps[i],s));for(const t of matrixSetupTables)assert.equal(window(t.start,t.start+t.hex.length/2).hex,t.hex);
  const s=matrixSetupSpecs.find(s=>s.name==='b282');assert.throws(()=>proveWordStack(decodeWindows(s.windows),s.entry,'RTS'),/Stack mismatch 81:B287/);
  const t=matrixSetupSpecs.find(s=>s.name==='b2d1');assert.throws(()=>proveWordStack(decodeWindows(t.windows),t.entry,'RTS',{externalReturns:new Map(t.externalReturns)}),/Unproved indirect call/);
  for(const [target,run]of MATRIX_SETUP_ROUTINES)assert.equal(MAIN_SCENE_ROUTINES.get(target),run);
});
function sample(entry,seed){const random=prng(seed),rnd=n=>Math.floor(random()*n),wram=new Uint8Array(0x20000);
  for(let i=0;i<wram.length;i++)wram[i]=rnd(256);const word=(at,v)=>{wram[at]=v&255;wram[at+1]=v>>>8&255;};
  const s={entry,wram,a:rnd(65536),x:rnd(65536),y:rnd(65536),dbr:[0x80,0x81,0,0x7E][seed%4],p:rnd(256)&0xC7,word};
  word(0x1748,seed%4*8);word(0x1710,seed%8*4);word(0x1712,seed%9*4);
  word(0x1752,seed%101);word(0x174E,seed%65);word(0x1750,seed%65);word(0x1754,seed%101);
  if(entry===0x81B3BC){word(0x34,0x6000);word(0x36,0x7E);}
  if(entry===0x81B4D3){s.a=0x6000;s.y=seed%2?0x7E:0x7F;s.x=seed%2?0x2000:0x2400;
    for(let n=0;n<1024;n++)word((s.y===0x7F?0x10000:0)+0x6000+n*2,n%15+0x1F|(seed%4)<<14);}
  if(entry===0x81C39F){s.dbr=0x81;word(0x1D90,seed%6);}
  if(entry===0x81B2D1){word(0x170E,seed%2);word(0x1354,seed%7?1:2);word(0x1342,seed%3?4:0);word(0x34,0x6000);word(0x36,0x7E);
    word(0x1712,0);word(0x1710,seed%2?0:4);word(0x1714,0x6000);word(0x1716,0x7E);
    const sequences=[[0],[0x41,0],[1,2,3,0x41,0x42,4,0],[5,0,0],[6,0],[4,0]];wram.set(sequences[seed%6],0x6000);
    word(0x134A,seed%2?0:0xFFFF);word(0x134C,1);}
  if(entry===0x81B3D3){s.a=seed%7?seed%13:64;s.x=0x200;word(0x101DC,64);}
  if(entry===0x81B473){s.x=seed%2*4;word(0x1750+s.x,seed%3);word(0x174E+s.x,1);}
  if(entry===0x81B818){word(0x175C,0x2000);for(let n=0;n<1024;n++)word(0x12000+n*2,n===(seed%3?seed%1024:-1)?0x59:0x58);}
  if(entry===0x81B84A){word(0x1734,seed*5);word(0x1736,seed*3);word(0x1524,seed*5+[0,0x60,0x90,0x91,0xFFFF][seed%5]);word(0x1566,seed*3+[0xFFFF,0x91,0x90,0x60,0][seed%5]);}
  return s;
}
function routines(h,e,spec){const map=new Map(MAIN_SCENE_ROUTINES);
  // The independently pinned helpers run with their real call frames. Only the
  // BYTE wait is replaced in these own-code cases; no interrupt effect is inferred.
  map.set(0x81EEBB,h=>{h.a.trace.push({kind:'matrix-wait',pc:0x81EEBB,address:h.ctx.x,value:h.ctx.a});return h.rtl();});return map;
}
matrixSetupSpecs.forEach((spec,i)=>test(`${spec.name}: Matrix equations agree with the original at every own instruction`,()=>{
  const covered=new Set();for(let seed=1;seed<=72;seed++){
    const s=sample(spec.entry,seed),result=compareDialog(maps[i],s,{native:(h,e)=>MATRIX_SETUP_ROUTINES.get(spec.entry)(h,e,routines(h,e,spec)),
      calls:(a,e)=>{const h=dialogAccess(a);return new Map([...routines(h,e,spec)].filter(([t])=>!maps[i].has(t)).map(([t,run])=>[t,()=>({rawReturnWord:run(h,e,routines(h,e,spec))})]));}});
    assert.deepEqual(result.differences,[],`seed ${seed}`);for(const pc of result.visited)covered.add(pc);
  }
  assert.deepEqual([...maps[i].keys()].filter(pc=>!covered.has(pc)).map(pc=>pc.toString(16)),[]);
}));
function side(s){const mem=new DialogTestMemory(s.wram),a=new TaskAccessor({mem,a:s.a,x:s.x,y:s.y,s:0x1EF0,d:0,dbr:s.dbr,p:s.p,pc:s.entry&65535});
  a.load();a.ctx.programBank=0x81;a.devices={write(){}};return {mem,a,h:dialogAccess(a)};}
test('unproved text commands stop before an indirect call frame, without an invented return',()=>{
  for(const command of [7,8,31]){const s=sample(0x81B2D1,1);s.word(0x1354,1);s.word(0x170E,1);s.wram[0x6000]=command;const {h}=side(s),stack=h.ctx.s;
    assert.throws(()=>typeMatrixText(h,null,MAIN_SCENE_ROUTINES),e=>e.taskBoundary&&e.reason==='matrix_text_command_frontier'&&e.commandIndex===command*2);
    assert.equal(h.ctx.s,stack);assert.equal(h.dp(0x34,2),0x6001);}
});
const realCalls=(h,e,r=MAIN_SCENE_ROUTINES)=>new Map([...r].map(([t,run])=>[t,()=>{const value=run(h,e,r);return {rawReturnWord:value?.rawReturnWord??value};}]));
function matchingAck(h){const read=h.a.absoluteRead;h.a.absoluteRead=(offset,width,pc)=>{
  if(offset!==0x2140)return read(offset,width,pc);assert.equal(width,1);assert.ok([0x81F00E,0x81F046].includes(pc));
  const value=h.read(h.abs(0x1CE4),1);h.a.trace.push({kind:'read',pc,address:h.abs(offset),width,value});return value;};}
test('C3CA initial text path returns through the real map, decompression, audio and queue helpers',()=>{
  const s=sample(0x81C3CA,7);s.dbr=0x80;s.p=0x43;s.word(0x1D90,0);s.word(0x1D8B,0xFE37);s.word(0x1D8D,0xFE28);s.wram[0x1CE4]=0;
  // Explicit existing audio-directory state: the first original F092 entry.
  // C3CA does not initialize this pointer; the fixture supplies its prerequisite.
  s.wram.set(Buffer.from(window(0x98FFFA,0x98FFFD).hex,'hex'),0x8C);
  const installed=[],r=new Map(MAIN_SCENE_ROUTINES),ec16=r.get(0x81EC16);r.set(0x81EC16,(h,e)=>{const result=ec16(h,e);installed.push(h.dp(0x6E,2)|h.dp(0x70,1)<<16);return result;});
  const map=decodeWindows(mainSceneSpecs.find(s=>s.name==='c3ca').windows);let counter=0;
  const result=compareDialog(map,s,{root:'RTL',feed:()=>++counter&255,native:(h,e)=>{installed.length=0;matchingAck(h);playMatrixScene(h,e,r);
    assert.equal(h.ctx.bank,0x80);assert.equal(h.ctx.status,0x43);assert.equal(h.ctx.s,0x1EF0);assert.equal(h.read(0x7E1754,2),0x37);
    assert.equal(h.read(0x7E174C,2),0x28);assert.equal(h.read(0x7E170E,2),0);assert.equal(h.read(0x7E1710,2),h.read(0x7E1712,2));},
    calls:(a,e)=>{const h=dialogAccess(a);matchingAck(h);return realCalls(h,e,r);}});
  assert.deepEqual(result.differences,[]);assert.equal(result.events.waitIndex,s.waits.length);assert.ok(s.waits.length>32);
  assert.deepEqual(installed,[0x81BEC3,0x81BEC3]); // once on each side; installation never executes the callback
  assert.equal(MAIN_SCENE_ROUTINES.has(0x81BEC3),true); // binding does not schedule it
});
test('all six original initial text programs finish via real queue helpers and original B2D1 instructions',()=>{
  for(let selector=0;selector<6;selector++){const s=sample(0x81B2D1,selector+1);s.dbr=0x81;s.p=0;s.word(0x1D90,selector);
    const setup=side(s);setup.h.push(0x1234,2);MATRIX_SETUP_ROUTINES.get(0x81B2A0)(setup.h);
    setup.h.push(0x1234,2);queueMatrixMessages(setup.h,null,MAIN_SCENE_ROUTINES);s.wram=setup.mem.wram.slice();
    let iterations=0;for(;;){let next=null,done=false;const spec=matrixSetupSpecs.find(s=>s.name==='b2d1');
      const result=compareDialog(decodeWindows(spec.windows),s,{native:(h,e)=>{typeMatrixText(h,e,MAIN_SCENE_ROUTINES);next=h.a.mem.wram.slice();done=!(h.ctx.status&1);},
        calls:(a,e)=>new Map([[0x81B259,()=>({rawReturnWord:MATRIX_SETUP_ROUTINES.get(0x81B259)(dialogAccess(a),e,MAIN_SCENE_ROUTINES)})]])});
      assert.deepEqual(result.differences,[],`selector ${selector}, iteration ${iterations}`);s.wram=next;
      // Synthetic queue draining between calls is explicit here. It replaces no
      // instruction in B2D1 and supplies no original NMI or DMA evidence.
      s.wram[0x1748]=s.wram[0x1749]=s.wram[0x174A]=s.wram[0x174B]=0;
      if(done)break;assert.ok(++iterations<4096);}
    assert.ok(iterations>0);
  }
});
test('B282 uses the real crossed WORD stack values and wraps its ring at 20',()=>{
  for(const index of [0,4,0x1C,0xFFFF]){const s=sample(0x81B282,1);s.dbr=0x81;s.x=0x6123;s.y=0x7E;s.word(0x1710,index);
    assert.deepEqual(compareDialog(decodeWindows(matrixSetupSpecs.find(s=>s.name==='b282').windows),s,{native:h=>queueMatrixText(h)}).differences,[]);}
});
test('text pointers wrap their low WORD without carrying the bank, and glyph data can alias the output buffer',()=>{
  for(const at of [0xFFFF,0x15A]){const s=sample(0x81B2D1,1);s.word(0x170E,1);s.word(0x1354,1);s.word(0x34,at);s.word(0x36,at===0xFFFF?0x7E:0x7F);
    s.word(0x1342,1);s.wram[(at===0xFFFF?0:0x10000)+at]=0x41;
    assert.deepEqual(compareDialog(decodeWindows(matrixSetupSpecs.find(s=>s.name==='b2d1').windows),s,{native:(h,e)=>typeMatrixText(h,e,MAIN_SCENE_ROUTINES)}).differences,[]);}
});
test('C3CA stops before the call frame of a deliberately removed B56F helper',()=>{
  const s=sample(0x81C3CA,8);s.dbr=0x80;s.p=0;s.word(0x1D90,1);s.wram[0x1CE4]=0;
  s.wram.set(Buffer.from(window(0x98FFFA,0x98FFFD).hex,'hex'),0x8C);
  const routines=new Map(MAIN_SCENE_ROUTINES);routines.delete(0x81B56F);
  const map=decodeWindows(mainSceneSpecs.find(s=>s.name==='c3ca').windows);let counter=0;
  assert.throws(()=>compareDialog(map,s,{root:'RTL',feed:()=>++counter&255,native:(h,e)=>{matchingAck(h);
    try{playMatrixScene(h,e,routines);}catch(error){if(error.reason==='main_loop_frontier'){
      assert.equal(h.ctx.s,0x1EEB);assert.equal(h.ctx.programBank,0x81);assert.equal(h.dp(0x6E,2),0xBEC3);
      assert.equal(h.read(h.abs(0x1356)),1); // the real C029 setup has already run
    }throw error;}}}),e=>e.taskBoundary&&e.reason==='main_loop_frontier'&&e.target===0x81B56F);
});
