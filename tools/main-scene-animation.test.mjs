import test from 'node:test';import assert from 'node:assert/strict';
import {sceneAnimationSpecs,proveSceneAnimation,sceneNmiChronology} from './main-scene-animation-source.mjs';
import {compareDialog,decodeWindows,prng,window,DialogTestMemory} from './task-native-dialog-harness.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {sendOamBuffer} from '../src/task/main-scene-video.mjs';
import {animateCutscene,SCENE_ANIMATION_TARGETS} from '../proof/cutscene-reference/cutscene-animation.mjs';
import {startSong} from '../proof/apu-reference/audio-routines.mjs';
import {playCutscene,fillCutsceneTextMap,drawCutsceneSprites,scrollCutsceneBackground} from '../proof/cutscene-reference/cutscene-scene.mjs';
import {SCENE_REFERENCE_ROUTINES as MAIN_SCENE_ROUTINES} from '../proof/scene-reference-routines.mjs';
import {mainSceneSpecs} from './main-scene-source.mjs';
import {waitForFrame,waitFrames,fadeInScreen,fadeOutScreen} from '../src/task/main-scene-wait.mjs';
const maps=sceneAnimationSpecs.map(s=>decodeWindows(s.windows));
test('animation and wait graphs pin actual table, mode join, protected stack and external calls',()=>{
  sceneAnimationSpecs.forEach((s,i)=>proveSceneAnimation(maps[i],s));const s=sceneAnimationSpecs[0];
  assert.equal(s.table.hex,window(0x81D41F,0x81D42B).hex);
  const b=Buffer.from(s.table.hex,'hex');assert.deepEqual(Array.from({length:6},(_,i)=>0x810000|b.readUInt16LE(i*2)),[...SCENE_ANIMATION_TARGETS.keys()]);
  assert.throws(()=>proveWordStack(maps[0],s.entry,'RTS',{externalReturns:new Map(s.externalReturns)}),/Unproved indirect jump/);
  assert.throws(()=>proveWordStack(maps[0],s.entry,'RTS',{externalReturns:new Map(s.externalReturns),indirectTargets:new Map(s.indirectTargets)}),/Mode mismatch 81:D2DB/);
  for(const w of sceneNmiChronology)assert.equal(window(w.start,w.start+w.hex.length/2).hex,w.hex);
});
function sample(entry,seed){const random=prng(seed),rnd=n=>Math.floor(random()*n),wram=new Uint8Array(0x20000);
  for(let i=0;i<wram.length;i++)wram[i]=rnd(256);const word=(at,v)=>{wram[at]=v&255;wram[at+1]=v>>>8&255;};
  word(0x1E,seed%6|(seed&8?0x8000:0));word(0x16,[0,1,6,7,0xFF,0x3FF,0x8000][seed%7]);word(0x1C,seed*977);
  word(0x1C76,seed%2?0:seed);word(0x119E,seed%2?0x80:0);word(0x115E,seed*139);
  word(0x11A0,[0,1,2,28,63,64,65,0x1B4,0x1B5,0x1F4,0xFFFF][Math.floor(seed/6)%11]);
  if(seed%6===5&&wram[0x11A0]===0&&wram[0x11A1]===0){word(0x119E,0);const lines=Math.floor(seed/6)%3+1;let at=0x62A8;wram[at++]=Math.floor(seed/66)%2?lines:0;
    for(let n=0;n<lines;n++){for(let j=0;j<(seed+n)%8;j++)wram[at++]=32+(seed+n+j)%94;wram[at++]=0;}}
  return {entry,wram,a:rnd(65536),x:rnd(65536),y:rnd(65536),dbr:[0x80,0x81,0,0x7E][Math.floor(seed/6)%4],p:rnd(256)&0xC7};
}
const shared=h=>new Map([[0x81D37D,()=>fillCutsceneTextMap(h)],[0x81D4E8,()=>drawCutsceneSprites(h)],
  [0x81F007,()=>h.rtl()],[0x81F130,()=>h.rtl()],[0x81F1FA,()=>h.rts()]]);
const calls=h=>new Map([...shared(h)].map(([t,run])=>[t,()=>({rawReturnWord:run()})]));
for(const [i,run]of [[0,animateCutscene],[1,startSong]])test(`${sceneAnimationSpecs[i].name}: every own original instruction matches native equations`,()=>{
  const spec=sceneAnimationSpecs[i],covered=new Set();for(let seed=1;seed<=528;seed++){
    const s=sample(spec.entry,seed),r=compareDialog(maps[i],s,{root:spec.rootReturn,native:(h,e)=>run(h,e,shared(h)),calls:a=>calls(dialogAccess(a))});
    assert.deepEqual(r.differences,[],`seed ${seed}`);for(const pc of r.visited)covered.add(pc);}
  assert.deepEqual([...maps[i].keys()].filter(pc=>!covered.has(pc)).map(pc=>pc.toString(16)),[]);
});
for(const [i,run]of [[2,waitForFrame],[3,waitFrames],[4,fadeInScreen],[5,fadeOutScreen]])test(`${sceneAnimationSpecs[i].name}: fresh BYTE waits and real nested return frames`,()=>{
  const covered=new Set();for(let seed=1;seed<=40;seed++){
    const s=sample(sceneAnimationSpecs[i].entry,seed),enabled=!!(seed%2);s.wram[0x30]=enabled?0x81:1;s.x=1+seed%3;
    const polls=i===2?1:i===3?s.x:16;s.waits=[];s.io=[];let counter=s.wram[0x1C76];
    for(let n=0;n<polls;n++){if(enabled){s.waits.push({pc:0x81EECD,address:0x7E1C76,width:1,value:counter});counter=(counter+1)&255;
        s.waits.push({pc:0x81EECD,address:0x7E1C76,width:1,value:counter});}
      else for(const value of [0x80,0xFF,0x7F])s.io.push({pc:0x81EEC2,address:s.dbr<<16|0x4212,width:1,value});}
    // Only low mirrored DBRs address hardware. Other banks remain ordinary memory in the source.
    if(!enabled){s.dbr=0x81;for(const o of s.io)o.address=0x814212;}
    const r=compareDialog(maps[i],s,{root:'RTL',waits:[0x81EECD],native:run});assert.deepEqual(r.differences,[],`seed ${seed}`);
    for(const pc of r.visited)covered.add(pc);}
  assert.deepEqual([...maps[i].keys()].filter(pc=>!covered.has(pc)).map(pc=>pc.toString(16)),[]);
});
test('unknown animation tails and absent, wrong-width or invalid BYTE observations remain boundaries',()=>{
  const s=sample(0x81CF72,6);s.wram[0x1E]=6;s.wram[0x1F]=0;const mem=new DialogTestMemory(s.wram),a=new TaskAccessor({mem,a:0,x:0,y:0,s:0x1EF0,d:0,dbr:0x81,p:0,pc:0xCF72});
  a.load();a.ctx.programBank=0x81;const h=dialogAccess(a);assert.throws(()=>animateCutscene(h,null,MAIN_SCENE_ROUTINES),e=>e.reason==='main_scene_animation_frontier');assert.equal(a.ctx.s,0x1EF0);
  for(const o of [null,{width:2,value:0},{width:1,value:256},{width:1,value:-1},{width:1,value:0.5},{width:1,value:0,address:0x7E1C77}]){
    a.ctx.s=0x1EF0;a.ctx.status=0;mem.write8(0x30,0x80);const before=mem.read8(0x7E1C76);
    const events={mode:'record-observations',values:Object.freeze(o?[Object.freeze({pc:0x81EECD,address:0x7E1C76,...o})]:[]),waitIndex:0,waitEvents:[]};
    assert.throws(()=>waitForFrame(h,events),e=>e.reason==='task_wait_observation_required'&&e.width===1);assert.equal(mem.read8(0x7E1C76),before);assert.equal(events.waitIndex,0);
  }
});
test('D479: original callback equations move scroll and brightness, then read actual WORD joypad ports',()=>{
  const covered=new Set();for(let seed=1;seed<=360;seed++){
    const s=sample(0x81D479,seed),word=(at,v)=>{s.wram[at]=v&255;s.wram[at+1]=v>>>8&255;};s.dbr=[0x80,0x81,0][seed%3];
    const [current,target,step]=[[5,5,3],[3,9,2],[3,9,7],[9,3,2],[9,3,7],[9,3,10],[65535,65534,1],[65534,65535,2],[0x8000,0x7FFF,65535]][seed%9];
    word(0x16,current);word(0x1A,target);word(0x18,step);s.wram[0x11A3]=seed%4===0?0:15;s.wram[0x11A2]=seed%3===0?15:0;
    s.io=[{pc:0x809E0B,address:s.dbr<<16|0x4212,width:2,value:0x8101},{pc:0x809E0B,address:s.dbr<<16|0x4212,width:2,value:0xFF00},
      {pc:0x809E13,address:s.dbr<<16|0x4218,width:2,value:seed*97&65535}];
    const r=compareDialog(maps[6],s,{root:'RTL',native:scrollCutsceneBackground,calls:a=>new Map([[0x81ED8B,()=>({rawReturnWord:sendOamBuffer(dialogAccess(a))})]])});
    assert.deepEqual(r.differences,[],`seed ${seed}`);for(const pc of r.visited)covered.add(pc);
  }assert.deepEqual([...maps[6].keys()].filter(pc=>!covered.has(pc)).map(pc=>pc.toString(16)),[]);
});
test('all six CDF8 selections return through real shared graphs with explicit BYTE polls; audio replies remain separate',()=>{
  const map=decodeWindows(mainSceneSpecs[0].windows);
  for(let seed=0;seed<12;seed++){
    const s=sample(0x81CDF8,seed+1);s.a=seed%6|(seed>=6?0x8000:0);s.dbr=0x80;s.p=0;s.wram[0x1C76]=0;s.wram[0x1C77]=0;
    s.wram[0x1CA]=0;s.wram[0x1CB]=seed%2?0x90:0;
    const bound=h=>{const routines=new Map(MAIN_SCENE_ROUTINES);for(const target of [0x81EF47,0x81F007,0x81F130])routines.set(target,()=>h.rtl());return routines;};
    const table=Buffer.from(window(0x81D3FB,0x81D413).hex,'hex'),iterations=value=>value&0x8000?1:value+1;
    // The text animation D1F0 clears 01CA again after the input helper, so it cannot skip here.
    const polls=seed%2&&seed%6!==5?1:iterations(table.readUInt16LE(seed%6*2))+iterations(table.readUInt16LE(12+seed%6*2));
    s.inputs=Array.from({length:polls},()=>({pc:0x809E1A,address:0x8101CA,width:2,value:seed%2?0x9000:0}));
    s.waits=Array.from({length:polls},(_,i)=>({pc:0x81EECD,address:0x7E1C76,width:1,value:(i+1)&255}));
    for(let value=15;value>=0;value--)s.waits.push({pc:0x81CF4C,address:0x8011A3,width:1,value});
    s.waits.push({pc:0x81EECD,address:0x7E1C76,width:1,value:(polls+1)&255});
    const result=compareDialog(map,s,{root:'RTL',native:(h,e)=>{playCutscene(h,e,bound(h));
      assert.equal(h.dp(0x6E,2),0xD479);assert.equal(h.dp(0x70,1),0x81);
      assert.equal(h.dp(0x16,2),0);assert.equal(h.dp(0x1C,2),0);},waits:[0x81CF4C],
      calls:(a,e)=>{const h=dialogAccess(a),routines=bound(h);return new Map([...routines].map(([target,run])=>[target,()=>({rawReturnWord:run(h,e,routines)})]));}});
    assert.deepEqual(result.differences,[],`selection ${s.a.toString(16)}`);assert.equal(result.events.inputIndex,polls);
    assert.equal(result.events.waitEvents.filter(o=>o.pc===0x81CF4C).length,16);
  }
});
test('EEBB preserves incoming BYTE modes and compares only the low counter byte across FF to 00',()=>{
  for(const p of [0x20,0x30,0x71,0xB7]){const s=sample(0x81EEBB,2);s.p=p;s.dbr=0x81;s.wram[0x30]=0x80;s.wram[0x1C76]=255;s.wram[0x1C77]=0x6D;
    const windows=sceneAnimationSpecs[2].windows.map(w=>({...w,initialM:1,initialX:p&16?1:0})),map=decodeWindows(windows);
    s.waits=[{pc:0x81EECD,address:0x7E1C76,width:1,value:255},{pc:0x81EECD,address:0x7E1C76,width:1,value:0}];
    assert.deepEqual(compareDialog(map,s,{root:'RTL',waits:[0x81EECD],native:waitForFrame}).differences,[]);
  }
});
