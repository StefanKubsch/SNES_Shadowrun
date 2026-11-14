import test from 'node:test';import assert from 'node:assert/strict';
import {sceneCollisionSpecs,proveSceneCollision} from './main-scene-collision-source.mjs';
import {sceneGraphicsSpecs,sceneGraphicsDataWindows,proveSceneGraphics} from './main-scene-graphics-source.mjs';
import {transitionSpecs,proveTransition} from './main-transition-source.mjs';
import {sceneLoadSpecs} from './main-scene-load-source.mjs';
import {TRANSITION_ROUTINES,enterRoom} from '../src/task/main-transition.mjs';
// The lifted room entry (src/game/room-entry.mjs) is compared in tools/room-entry-lift*.test.mjs;
// these proofs keep its register-level reference against the original instructions.
import {enterRoomReference,withRoomEntryReference} from '../proof/game-reference/room-entry.mjs';
import {appendScriptTask} from '../src/task/task-append.mjs';
// The callers 8000 and CC4B with the register-level room entry.
const referenceGate={c34a:a=>appendScriptTask(a,false),a4bf:enterRoomReference},referenceMotion=withRoomEntryReference(MAIN_MOTION_ROUTINES);
const ownRoutine=entry=>entry===0x80A4BF?enterRoomReference:TRANSITION_ROUTINES.get(entry);
import {compareDialog,decodeWindows,rom,prng,DialogTestMemory} from './task-native-dialog-harness.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {taskUnpackWindows} from './task-native-unpack-spec.mjs';
import {encodedStream,lengthBits} from './task-native-unpack-fixtures.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
import {mainInitializeSpecs} from './main-initialize-source.mjs';
import {cpuToOffset} from './rom.mjs';
import {checkPlayerZones} from '../src/task/main-zone-gate.mjs';
import {MAIN_MOTION_ROUTINES} from '../src/task/main-loop-motion.mjs';
import { processSceneRequestReference } from '../proof/game-reference/scene-request.mjs';
import {mainGate8000Spec} from './main-gate-8000-source.mjs';
import {mainLoopMotionSpecs} from './main-loop-motion-source.mjs';
import {MAIN_SCENE_ROUTINES} from '../src/task/main-scene.mjs';
import {NATIVE_CALL_CONTINUATIONS} from '../src/task/native-call-continuation.mjs';
import {WAIT_PAUSED} from '../src/task/native-wait-continuation.mjs';
import {MAIN_STARTUP_ROUTINES} from '../src/task/main-startup.mjs';
import {finishInterruptObservations} from '../src/task/main-wait-interrupt.mjs';
const specs=[...sceneCollisionSpecs,...sceneGraphicsSpecs,...transitionSpecs],maps=specs.map(s=>decodeWindows(s.windows));
const graph=new Map([...maps,...sceneLoadSpecs.map(s=>decodeWindows(s.windows)),...mainInitializeSpecs.filter(s=>[0x818CB9,0x818000].includes(s.entry)).map(s=>decodeWindows(s.windows)),decodeWindows(taskUnpackWindows.slice(1,3))].flatMap(m=>[...m]));
const external=(a,e,map,r)=>new Map([...r].filter(([target])=>!map.has(target)).map(([target,run])=>[target,()=>{const v=run(dialogAccess(a),e,r);return {rawReturnWord:v?.rawReturnWord??v};}]));
function base(entry,seed=0){const wram=new Uint8Array(0x20000),word=(at,v)=>{wram[at]=v&255;wram[(at+1)%wram.length]=v>>>8&255;};return{entry,wram,word,a:seed*71&65535,x:0,y:0,dbr:0x80,p:seed&0xC7};}
const stubRoutines=spec=>new Map(spec.externalReturns.map(([target,op])=>[target,h=>{
 h.a.trace.push({kind:'transition-call',pc:target,address:h.ctx.x,value:h.ctx.a+h.ctx.y*65536});
 if(target===0x81A1E1)h.index('y',0);else if(target===0x80A835)h.dpWrite(0,0x10,2);
 return op==='RTL'?h.rtl():h.rts();
}]));
test('transition, graphics and collision source pins preserve actual stack and return modes',()=>{
 for(const [collection,prove]of [[sceneCollisionSpecs,proveSceneCollision],[sceneGraphicsSpecs,proveSceneGraphics],[transitionSpecs,proveTransition]])for(const s of collection){assert.equal(prove(decodeWindows(s.windows),s).reachable_instructions,s.instructions);assert.equal(MAIN_SCENE_ROUTINES.get(s.entry),TRANSITION_ROUTINES.get(s.entry));}
 assert.equal(MAIN_MOTION_ROUTINES.get(0x80A4BF),enterRoom);
 for(const w of sceneGraphicsDataWindows){const offset=cpuToOffset(w.start,rom.length);assert.equal(Buffer.from(rom.subarray(offset,offset+w.hex.length/2)).toString('hex').toUpperCase(),w.hex);}
 const unp=proveWordStack(graph,0x809E7E,'RTL',{measureStack:true});assert.equal(unp.external_return_assumptions,0);assert.equal(unp.minimum_protected_stack_bytes,13);
});
function fixture(s,seed){const f=base(s.entry,seed),{word,wram}=f,random=prng(seed),rnd=n=>Math.floor(random()*n);
 for(let at=0;at<0x2000;at++)wram[at]=rnd(256);f.dbr=0x7E;
 f.a=[0,1,0x3FFF,0x4001,0x8002,0xC003,0xFFFF][seed%7];f.x=f.a;
 word(0xA0,0);word(0xE,0xF000);wram[0x10]=0x7F;word(0x77,0xF000);wram[0x79]=0x7F;word(0x9A,0xF000);wram[0x9C]=0x7F;
 word(0x5F,seed&1?0xFFFF:0);word(0x7C,0);word(0x7E,seed&1?0xFFFF:0);word(0x80,0);
 word(0x1F000,seed%3);for(let i=0;i<30;i++)word(0x1F001+i*2,[0,0x40,0x80,0x100][seed%4]);
 word(0xE2AC+f.x%0x40,seed*3&0x3FF);for(let i=0;i<6;i++)word(0xE2AC+i*2,[0,0x40,0x3C0,0xFFFF][(seed+i)%4]);
 if(s.entry===0x81840E)f.x=0;
 if(s.entry===0x8184CF)f.y=seed%3;
 if(s.entry===0x8184DE){word(0x1F001,[0,0x2000,0x4000,0x8000][seed%4]);wram[0x1F003]=seed&4?0x80:0;f.x=0;}
 if(s.entry===0x818701)f.x=0;
 if(s.entry===0x819490||s.entry===0x819AE6){
  for(let at=0xDFA8;at<0xDFA8+32;at++)wram[at]=rnd(256);
  for(let x=0;x<0x800;x+=2){word(0xCEA8+x,0xFFFF);word(0xA6A8+x,f.a);word(0xAEA8+x,seed&1?f.a:0);word(0xB6A8+x,seed&2?f.a:0);}
  for(let x=0;x<8;x+=2)word(0xCEA8+x,0);f.dbr=seed&1?0x80:0x7E;
 }
 if(s.entry===0x81A1E1){word(0xDF28,seed&1?f.a&0x3FFC:0xFFFF);word(0xDEA8,seed&1?0xFFFF:2);word(0xDEAA,0);word(0xDF2A,f.a&0x3FFC);}
 if(s.entry===0x809E7E){f.a=0xF000;f.y=0x7F;f.x=0x4000;wram.set(encodedStream(0xFFFF,Array.from({length:128},(_,i)=>i*7&255),lengthBits(128)),0x1F000);}
 if(s.entry===0x80A4BF){f.a=[0,1,0x2000,0x8000,0xFFFF,0xAAAA,0x5555][seed%7];word(0x9D,0x8000);word(0x1FD6,seed&1?2:0);word(0x1FB0,seed&2?0xFFFF:0);word(0x1CDE,[0xFFFF,0,0xFF][seed%3]);
  if(seed%5===0&&f.a<0x2000){f.rom=rom.slice();const at=cpuToOffset(0x8D929D+9*f.a,rom.length),raw=rom[at]|rom[at+1]<<8;f.rom[cpuToOffset(((raw&0x8000?0x9A:0x99)<<16)+(raw|0x8000)+1,rom.length)]=0xFF;word(0x1FD6,2);word(0x1FB0,0xFFFF);word(0x1CDE,0xFFFF);}
 }
 if(s.entry===0x80A2FA){word(0x2DE6,seed%4===0?0xFFFF:seed%4===2?2:0);word(0x2DE8,seed&1?0xB:3);word(0x2DEA,0xB);word(0x2DF0,0);word(0x2DF2,0);word(0x9700,0);word(0x3C18,seed&2?1:0);}
 if(s.entry===0x80A3B6){word(0x86,0xF000);wram[0x88]=0x7F;wram[0x1F004]=seed%3;for(let i=0;i<3;i++)word(0x1F009+i*6,seed%8*6);word(0x2DE4,seed&1?1:0);}
 return f;
}
const covered=new Set();
for(const[i,s]of specs.entries())test(`${s.name}: synthetic equations match original instructions`,()=>{
 for(let seed=0;seed<40;seed++){const f=fixture(s,seed),r=new Map([...TRANSITION_ROUTINES,...stubRoutines(s)]),map=s.entry===0x809E7E?graph:maps[i];if(s.entry===0x80A4BF)r.set(0x80A44D,TRANSITION_ROUTINES.get(0x80A44D));
  const result=compareDialog(map,f,{root:s.rootReturn,native:(h,e)=>ownRoutine(s.entry)(h,e,r),calls:(a,e)=>external(a,e,map,r)});assert.deepEqual(result.differences,[],`seed ${seed}`);for(const pc of result.visited)covered.add(pc);}
});
test('connected A4BF stack proof retains the actual DBR-changing callees',()=>{
 const externalReturns=new Map([...graph.values()].filter(i=>['JSR','JSL'].includes(i.mnemonic)&&!graph.has(i.target)).map(i=>[i.target,i.mnemonic==='JSL'?'RTL':'RTS']));
 const p=proveWordStack(graph,0x80A4BF,'RTS',{measureStack:true,externalReturns,indexPulls:new Set([0x818EFC,0x80A428]),dataPulls:new Set([0x81A22B]),statusRestoreJoins:new Set([0x818073,0x818074])});
 assert.equal(p.returns.length,1);assert.equal(p.returns[0].dbr,'entry');assert.equal(p.minimum_protected_stack_bytes,25);assert.equal(p.external_return_assumptions,13);
});
test('original scene loaders compose into real tile cache, PPU requests and geometry',()=>{
 for(let scene=0;scene<8;scene++){
  const f=base(0x81A117,scene);f.a=scene;f.dbr=0x80;
  const mem=new DialogTestMemory(f.wram),a=new TaskAccessor({mem,a:f.a,x:0,y:0,s:0x1EF0,d:0,dbr:f.dbr,p:f.p,pc:f.entry&65535});a.load();a.ctx.programBank=0x81;a.trace=[];a.devices={write(){}};
  const h=dialogAccess(a);h.pushByte(0x80);h.push(0x1234,2);TRANSITION_ROUTINES.get(f.entry)(h,null);assert.equal(h.ctx.pc,0x1235);
  f.entry=0x819AE6;f.a=h.ctx.a;f.x=h.ctx.x;f.y=h.ctx.y;f.p=h.ctx.status;
  const graphics=compareDialog(graph,f,{root:'RTL',referenceLimit:8_000_000,native:(h,e)=>TRANSITION_ROUTINES.get(f.entry)(h,e),calls:(a,e)=>external(a,e,graph,TRANSITION_ROUTINES)});
  assert.deepEqual(graphics.differences,[],`graphics scene ${scene}`);for(const pc of graphics.visited)covered.add(pc);
  f.entry=0x818756;f.word(0x9A,0xF800);f.wram[0x9C]=0x7F;f.word(0x1F800,0);f.word(0x1F802,0);
  const collision=compareDialog(graph,f,{root:'RTL',native:(h,e)=>TRANSITION_ROUTINES.get(f.entry)(h,e),calls:(a,e)=>external(a,e,graph,TRANSITION_ROUTINES)});
  assert.deepEqual(collision.differences,[],`collision scene ${scene}`);for(const pc of collision.visited)covered.add(pc);
 }
});
function syntheticAck(h){const read=h.a.absoluteRead;h.a.absoluteRead=(offset,width,pc)=>{
 if(offset!==0x2140)return read(offset,width,pc);assert.equal(width,1);assert.ok([0x81F00E,0x81F046].includes(pc));const value=h.read(h.abs(0x1CE4),1);h.a.trace.push({kind:'read',pc,address:h.abs(offset),width,value});return value;
};}
function initialized(seed){const f=base(0x80A4BF,seed);f.dbr=0x80;f.a=seed;f.p=0;
 const mem=new DialogTestMemory(f.wram),a=new TaskAccessor({mem,a:0,x:0,y:0,s:0x1EF0,d:0,dbr:0x80,p:0,pc:0x9629});a.load();a.ctx.programBank=0x80;a.trace=[];a.devices={write(){}};
 const h=dialogAccess(a);h.push(0x1234,2);TRANSITION_ROUTINES.get(0x809629)(h,null);assert.equal(h.ctx.pc,0x1235);
 f.word(0x2DE6,0);f.word(0x2DE8,0xB);f.word(0x2DF0,mem.read16(0x809700));return f;
}
for(const resumable of [false,true])test(`complete A4BF ${resumable?'across finite budgets':'synchronously'} returns with original actors, scene data, graphics, collision, camera, audio and render helpers`,()=>{
 for(let scene=0;scene<4;scene++){
  const f=initialized(scene);let counter=0;
  const result=compareDialog(graph,f,{referenceLimit:12_000_000,feed:missing=>missing.pc===0x81ACAF?0:++counter&65535,
   native:(h,e)=>{syntheticAck(h);
    if(resumable){const c=NATIVE_CALL_CONTINUATIONS.get(enterRoomReference).create({h,events:e});let pauses=0;
      while(c.run(1)===WAIT_PAUSED)assert.ok(++pauses<1000);assert.ok(pauses>100);
    }else enterRoomReference(h,e);
    assert.equal(h.ctx.pc,0x1235);assert.equal(h.ctx.s,0x1EF0);assert.equal(h.ctx.bank,0x80);assert.equal(h.read(h.abs(0x1D61)),0xFFFF);},
   calls:(a,e)=>{syntheticAck(dialogAccess(a));return external(a,e,graph,TRANSITION_ROUTINES);}});
  assert.deepEqual(result.differences,[],`transition ${scene}`);for(const pc of result.visited)covered.add(pc);assert.ok(result.events.waitIndex>0);
 }
});
test('new own instruction coverage',()=>{assert.deepEqual([...new Map(maps.flatMap(m=>[...m])).keys()].filter(pc=>!covered.has(pc)).map(pc=>pc.toString(16)),[]);});
for(const resumable of [false,true])test(`both original main-loop callers ${resumable?'across finite budgets':'synchronously'} return through the bound full transition`,()=>{
 for(const entry of [0x808000,0x80CC4B]){
  const f=initialized(0);f.entry=entry;f.word(0x1CE9,0x7FFF);f.word(0x2DE2,0);
  f.word(0xCC2,0);for(const at of [0xE28,0xE80,0xED8])f.word(at,0);
  f.word(0x9D,0xF000);f.wram[0x9F]=0x7F;f.wram[0x1F000]=0;f.wram[0x1F001]=1;
  for(let i=0;i<7;i++)f.word(0x1F002+i*2,0);
  const map=new Map(graph),caller=entry===0x808000?mainGate8000Spec:mainLoopMotionSpecs[0];for(const item of decodeWindows(caller.windows))map.set(...item);
  let counter=0;const result=compareDialog(map,f,{referenceLimit:12_000_000,feed:missing=>missing.pc===0x81ACAF?0:++counter&65535,
   native:(h,e)=>{syntheticAck(h);
    if(resumable){const c=NATIVE_CALL_CONTINUATIONS.get(entry===0x80CC4B?processSceneRequestReference:entry).create({h,events:e,gateRoutines:referenceGate,routines:referenceMotion});let pauses=0;
      while(c.run(1)===WAIT_PAUSED)assert.ok(++pauses<1000);assert.ok(pauses>100);
    }else if(entry===0x808000)checkPlayerZones(h,e,referenceGate);else processSceneRequestReference(h,e,referenceMotion);
    assert.equal(h.ctx.status&1,1);},calls:(a,e)=>{syntheticAck(dialogAccess(a));return external(a,e,map,TRANSITION_ROUTINES);}});
  assert.deepEqual(result.differences,[],`caller ${entry.toString(16)}`);
 }
});

test('A4BF and nested 8BD9 retain both actual B0A1 frames through observed NMI and finite budgets',()=>{
 const spec=transitionSpecs.find(s=>s.entry===0x80A4BF),camera=transitionSpecs.find(s=>s.entry===0x818BD9);
 const map=decodeWindows([...spec.windows,...camera.windows]),routines=new Map(TRANSITION_ROUTINES);
 for(const [target,op]of [...spec.externalReturns,...camera.externalReturns])if(![0x818BD9,0x81B0A1].includes(target))
   routines.set(target,h=>op==='RTL'?h.rtl():h.rts());
 const f=base(0x80A4BF);f.word(0x6E,0xE839);f.wram[0x70]=0x81;f.word(0xCC4,0x400);
 const records=Object.freeze(Array.from({length:2},()=>[0x81B0A1,0x81B0A5,0x81B0A9,0x81B0AB]
   .map(pc=>Object.freeze({pc,nmi:pc===0x81B0A5}))).flat());
 f.io=Array.from({length:2},()=>({pc:0x00C118,address:0x804210,width:2,value:0x80}));
 const bind=e=>{e.interrupts=records;e.interruptIndex=0;e.interruptRoutines=MAIN_STARTUP_ROUTINES;};
 const result=compareDialog(map,f,{
   native:(h,e)=>{bind(e);const c=NATIVE_CALL_CONTINUATIONS.get(enterRoomReference).create({h,events:e,routines});let pauses=0,waits=0;
     while(c.run(1)===WAIT_PAUSED){assert.ok(++pauses<1000);
       if(h.ctx.programBank===0x81&&h.ctx.pc===0xB0A5){const raw=h.a.stackWord();
         assert.ok([0xA523,0x8BE0].includes(raw));waits++;}
     }
     assert.ok(waits>=2);finishInterruptObservations(e);assert.equal(h.ctx.pc,0x1235);assert.equal(h.ctx.s,0x1EF0);
   },
   calls:(a,e)=>{bind(e);return external(a,e,map,routines);},
 });assert.deepEqual(result.differences,[]);
});
test('A4BF requires observed waits and reports missing callees before adding their frame',()=>{
 const f=initialized(0),s=transitionSpecs[0],r=new Map(TRANSITION_ROUTINES);r.delete(0x81B0A1);
 assert.throws(()=>compareDialog(maps[specs.indexOf(s)],f,{native:(h,e)=>{syntheticAck(h);enterRoom(h,e,r);}}),e=>e.reason==='main_loop_frontier'&&e.target===0x81B0A1);
 assert.throws(()=>compareDialog(graph,f,{native:(h,e)=>{syntheticAck(h);enterRoom(h,e);}}),e=>e.reason==='task_wait_observation_required'&&e.pc===0x81B0A5);
 assert.throws(()=>compareDialog(graph,f,{native:(h,e)=>enterRoom(h,e)}),e=>e.reason==='device_observation_required'&&e.details.pc===0x81F00E);
});
