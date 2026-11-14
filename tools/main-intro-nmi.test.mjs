import test from 'node:test';import assert from 'node:assert/strict';
import {introNmiSpecs,introNmiTables,proveIntroNmi} from './main-intro-nmi-source.mjs';
import {matrixNmiSpecs} from './main-matrix-nmi-source.mjs';
import {compareDialog,decodeWindows,window,prng,DialogTestMemory,rom} from './task-native-dialog-harness.mjs';
import {runReference} from './w65c816-reference.mjs';import {cpuToOffset} from './rom.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
import {INTRO_NMI_ROUTINES as INTRO_TASK_ROUTINES} from '../src/task/main-intro-nmi.mjs';
import {drawIntroSpriteGrid,startFarIntroObject} from '../proof/intro-reference/intro-sprites.mjs';
import {runObservedNmi} from '../src/task/observed-nmi.mjs';
import {SCENE_REFERENCE_ROUTINES as MAIN_SCENE_ROUTINES} from '../proof/scene-reference-routines.mjs';
// The callbacks 81:DF0E, 81:DAD6 and 81:D9D5 and the routines 81:E83A, 81:E971 and
// 81:E900 are lifted (src/intro, src/frontend); their register-level references are proved here.
const INTRO_NMI_ROUTINES=new Map([...INTRO_TASK_ROUTINES,...[0x81DF0E,0x81DAD6,0x81D9D5,0x81E83A,0x81E971,0x81E900].map(t=>[t,MAIN_SCENE_ROUTINES.get(t)])]);
const runObservedIntroNmi=(a,e=null,r=INTRO_NMI_ROUTINES)=>runObservedNmi(a,e,r);
import {setupIntroScene,clearIntroObjects} from '../proof/intro-reference/intro-setup.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';import {TaskAccessor,NATIVE_ACCESS_LIMIT} from '../src/vm/task-accessor.mjs';
const maps=introNmiSpecs.map(s=>decodeWindows(s.windows));
const animationOffsets=Array.from({length:86},(_,i)=>i*2).filter(i=>![38,58].includes(i));
const fightOffsets=Array.from({length:55},(_,i)=>i*2).filter(i=>![24,38,52].includes(i));
test('intro NMI pins both callbacks, BYTE high-X branch, real PHK banks and shared tables',()=>{
  introNmiSpecs.forEach((s,i)=>proveIntroNmi(maps[i],s));for(const t of introNmiTables)assert.equal(window(t.start,t.start+t.hex.length/2).hex,t.hex);
  for(const s of introNmiSpecs)assert.equal(MAIN_SCENE_ROUTINES.get(s.entry),INTRO_NMI_ROUTINES.get(s.entry));
  for(const target of INTRO_NMI_ROUTINES.keys())assert.equal(MAIN_SCENE_ROUTINES.has(target),true);
  assert.equal(maps[2].get(0x81E8C6).value,0);assert.equal(maps[2].get(0x81E8C6).state.m,1);
  assert.equal(maps[2].get(0x81E8D1).value,3);assert.equal(maps[2].get(0x81E8D1).state.m,1);
  const s=introNmiSpecs[0],p=proveWordStack(maps[0],0x81D9D5,'RTL',{measureStack:true,externalReturns:new Map(s.externalReturns),
    programBankPushes:new Set(s.programBankPushes),indexPulls:new Set(s.indexPulls)});
  assert.equal(p.reachable_instructions,126);assert.equal(p.minimum_protected_stack_bytes,7);assert.equal(p.external_return_assumptions,6);
  assert.deepEqual(p.returns,[{at:'81:DAD5',m:0,x:0,dbr:0x81}]);
});
function sample(entry,seed){const random=prng(seed),rnd=n=>Math.floor(random()*n),wram=new Uint8Array(0x20000);
  for(let i=0;i<wram.length;i++)wram[i]=rnd(256);const word=(at,value)=>{wram[at]=value&255;wram[at+1]=value>>>8&255;};
  const s={entry,wram,seed,word,a:seed%49,x:[0,1,4,255,256,0xFFFF,0xFFFA,128][seed%8],y:seed*13&65535,dbr:[0,0x80,0x81,0x7E][seed%4],p:rnd(256)&0xC7};
  word(0x2C,seed%16*4);word(0x24,seed%2?0x2000:0x1200);word(0x1E,seed*23);word(0x11A2,seed%16);word(0x119E,0);word(0x11A0,0);
  for(let x=0;x<0x10;x+=2){word(0x113E+x,seed%9===x/2?0xFFFF:animationOffsets[(seed+x)%animationOffsets.length]);word(0x115E+x,[0,4,0xFFFF,256,128][(seed+x)%5]);word(0x117E+x,80+x);
    word(0x114E+x,seed%9===x/2?0xFFFF:animationOffsets[(seed*3+x)%animationOffsets.length]);word(0x116E+x,seed*13);word(0x118E+x,120+x);}
  if(entry===0x81DF0E)for(let x=0;x<=0x10;x+=2){word(0x113E+x,seed%10===x/2?0xFFFF:fightOffsets[(seed+x)%fightOffsets.length]);word(0x115E+x,seed*7);word(0x117E+x,100);}
  if(entry===0x81E971)for(let x=0;x<0x10;x+=2)word(0x114E+x,seed%9===x/2?0xFFFF:0);
  if(entry===0x81DAD6){const schedule=Buffer.from(window(0x81DB8B,0x81DC43).hex,'hex');
    if(seed%3===0){const index=seed%14*6;word(0x119E,index);word(0x11A2,schedule.readUInt16LE(index));}
    if(seed%3===1){const index=seed%16*6;word(0x11A0,index);word(0x11A2,schedule.readUInt16LE(0x56+index));}}
  // F290 runs after PHK changes DBR to 81. All device values are synthetic.
  s.io=[{pc:0x809E0B,address:0x814212,width:2,value:seed%2},...(seed%2?[{pc:0x809E0B,address:0x814212,width:2,value:0}]:[]),
    {pc:0x809E13,address:0x814218,width:2,value:seed*17&65535}];return s;
}
const external=(h,e,map,r)=>new Map([...r].filter(([target])=>!map.has(target)).map(([target,run])=>[target,()=>{
  const value=run(h,e,r);return {rawReturnWord:value?.rawReturnWord??value};}]));
function isolated(spec){return new Map(spec.externalReturns.map(([target])=>[target,h=>{
  h.a.trace.push({kind:'intro-nmi-call',pc:target,address:h.ctx.x,value:h.ctx.a+h.ctx.y*65536});return h.rtl();}]));}
introNmiSpecs.forEach((spec,i)=>test(`${spec.name}: all own equations match original instructions`,()=>{
  const scenarios=Array.from({length:240},(_,i)=>sample(spec.entry,i+1));
  if(spec.name==='df0e')for(const offset of [22,36,50,108]){const s=sample(spec.entry,1);s.word(0x11A2,0);s.word(0x113E,offset);scenarios.push(s);}
  const covered=new Set();for(const s of scenarios){s.io=[];
    const r=isolated(spec),result=compareDialog(maps[i],s,{root:'RTL',native:(h,e)=>INTRO_NMI_ROUTINES.get(spec.entry)(h,e,r),
      calls:(a,e)=>external(dialogAccess(a),e,maps[i],r)});
    assert.deepEqual(result.differences,[],`seed ${s.seed}`);for(const pc of result.visited)covered.add(pc);
  }assert.deepEqual([...maps[i].keys()].filter(pc=>!covered.has(pc)).map(pc=>pc.toString(16)),[]);
}));
function matchingAck(a){const read=a.absoluteRead;a.absoluteRead=(offset,width,pc)=>{if(offset!==0x2140)return read(offset,width,pc);
  assert.equal(width,1);assert.equal(pc,0x81F00E);const address=a.ctx.bank<<16|0x1CE4,value=a.read(address);
  a.trace.push({kind:'read',pc,address:a.ctx.bank<<16|offset,width,value});return value;};}
test('callbacks compose actual OAM, allocation, input and sprite helpers',()=>{
  for(const i of [0,1])for(let seed=1;seed<=40;seed++){const s=sample(introNmiSpecs[i].entry,seed);
    const r=compareDialog(maps[i],s,{root:'RTL',native:(h,e)=>{matchingAck(h.a);return INTRO_NMI_ROUTINES.get(s.entry)(h,e,MAIN_SCENE_ROUTINES);},
      calls:(a,e)=>{matchingAck(a);return external(dialogAccess(a),e,maps[i],MAIN_SCENE_ROUTINES);}});assert.deepEqual(r.differences,[],`entry ${i} seed ${seed}`);
  }
});
const expand=trace=>trace.flatMap(e=>e.width===2?[{...e,width:1,value:e.value&255},{...e,width:1,address:e.address+1,value:e.value>>>8}]:[{...e,width:1}]);
function side(s){const mem=new DialogTestMemory(s.wram.slice(),null,s.rom),a=new TaskAccessor({mem,a:s.a,x:s.x,y:s.y,s:s.s??0x1EF0,d:0,dbr:s.dbr,p:s.p,pc:0xEECD});
  a.load();a.ctx.programBank=0x81;a.trace=[];a.io=s.io;a.devices={write(){}};return {mem,a,h:dialogAccess(a)};}
test('both installed callbacks share the original native NMI frame through DBR81 exits and RTI',()=>{
  const covered=new Set();for(const target of [0x81DAD6,0x81DF0E])for(let seed=1;seed<=24;seed++){
    const s=sample(target,seed);s.dbr=[0,0x80,0x81][seed%3];s.word(0x6E,target&65535);s.wram[0x70]=0x81;s.p=seed*13&255;if(s.p&0x10){s.x&=255;s.y&=255;}s.s=seed%2?3:0x1EF0;
    s.io.unshift({pc:0x00C118,address:s.dbr<<16|0x4210,width:2,value:seed*123});const n=side(s),r=side(s);
    for(const v of [n,r]){v.a.ctx.d=seed*257;matchingAck(v.a);}
    let bytes=0;const read=r.mem.read8.bind(r.mem),o=s.io[0];r.mem.read8=address=>{if(bytes<2&&address===o.address+bytes)return o.value>>>(8*bytes++)&255;return read(address);};r.a.ioIndex=1;
    runObservedIntroNmi(n.a);const {h,a}=r;h.pushByte(a.ctx.programBank);h.push(a.ctx.pc,2);h.pushByte(a.ctx.status);a.ctx.status=(a.ctx.status|4)&~8;a.ctx.programBank=0;
    const map=new Map([...decodeWindows(matrixNmiSpecs[2].windows),...maps[0],...maps[1],...maps[2],...maps[3]]);
    const result=runReference(map,r.mem,a.ctx,{entry:0x00C112,root:'RTI',calls:external(h,null,map,MAIN_SCENE_ROUTINES),io:a.trace});
    for(const pc of result.visited)covered.add(pc);
    for(const key of ['a','x','y','s','d','status','pc','programBank','bank'])assert.equal(n.a.ctx[key],a.ctx[key],key);
    assert.deepEqual(n.mem.wram,r.mem.wram);assert.deepEqual(expand(n.a.trace),expand(a.trace));assert.equal(n.a.ioIndex,s.io.length);assert.equal(a.ioIndex,s.io.length);assert.equal(bytes,2);
    assert.equal(n.a.ctx.bank,s.dbr);assert.equal(n.a.ctx.status,s.p);assert.equal(n.a.ctx.s,s.s);assert.equal(n.a.ctx.d,seed*257);
  }assert.ok(covered.has(0x00C14E));assert.ok(covered.has(0x81DAD5));assert.ok(covered.has(0x81DF76));
});
test('BYTE high-X updates use the original mask and preserve incoming DBR',()=>{
  for(const x of [0xFFFF,0,255,256]){const s=sample(0x81E83A,1);s.a=0;s.x=x;s.y=100;s.word(0x2C,0);s.wram.fill(0,0x111E,0x113E);const {h}=side(s);h.pushByte(0x80);h.push(0x1234,2);
    drawIntroSpriteGrid(h);assert.equal(h.ctx.bank,s.dbr);if(x===0||x===0xFFFF)assert.equal(h.read(0x111E,1),1);
  }
});
test('missing and wrongly addressed device values retain an explicit boundary',()=>{
  for(const target of [0x81DAD6,0x81DF0E])for(const io of [[],[{pc:0x809E0B,address:0x004212,width:2,value:0}],[{pc:0x809E0B,address:0x814212,width:1,value:0}]]){
    const s=sample(target,1);s.io=io;const {h}=side(s);h.pushByte(0x80);h.push(0x1234,2);
    assert.throws(()=>INTRO_NMI_ROUTINES.get(target)(h,null,MAIN_SCENE_ROUTINES),e=>e.reason==='device_observation_required');}
});
test('hardware-frame alias of 006E dispatches the fresh proved callback and rejects a fresh helper target',()=>{
  for(const next of [0xDF0E,0xE83A]){const s=sample(0x81DAD6,1);s.dbr=0x81;s.p=0;s.word(0x6E,0xDAD6);s.wram[0x70]=0x81;
    for(let x=0;x<=0x10;x+=2)s.word(0x113E+x,0xFFFF);
    s.io.unshift({pc:0x00C118,address:0x814210,width:2,value:0});const {a,h}=side(s);a.ctx.s=0x70;a.ctx.pc=next;
    // PB/PC/P pushed at 0070..006D replace the already admitted pointer.
    const seen=[],r=new Map(INTRO_NMI_ROUTINES);
    for(const target of [0x81DAD6,0x81DF0E])r.set(target,(h,e,routines)=>{seen.push(target);return INTRO_NMI_ROUTINES.get(target)(h,e,routines);});
    if(next===0xDF0E){runObservedIntroNmi(a,null,r);assert.deepEqual(seen,[0x81DF0E]);assert.equal(h.ctx.s,0x70);assert.equal(h.ctx.pc,next);}
    else{assert.throws(()=>runObservedIntroNmi(a,null,r),e=>e.reason==='observed_nmi_callback_frontier'&&e.target===0x81E83A);assert.deepEqual(seen,[]);}
  }
});
test('original scene setup installs DAD6 and its native callbacks advance the same animation state',()=>{
  const s=sample(0x81D60F,1);s.dbr=0x81;s.p=0;s.wram[0x1CE4]=0;const {a,h,mem}=side(s);matchingAck(a);
  h.call(0x811000,0x81E8E5,()=>clearIntroObjects(h),true);h.call(0x811004,0x81D60F,()=>setupIntroScene(h,null,MAIN_SCENE_ROUTINES));
  assert.equal(h.pointer(0x6E),0x81DAD6);assert.equal(mem.read16(0x11A2),0);
  // Sixteen expressly supplied interrupt occurrences; no elapsed-frame claim.
  for(let n=0;n<16;n++){a.io=[{pc:0x00C118,address:0x814210,width:2,value:0},{pc:0x809E0B,address:0x814212,width:2,value:0},
      {pc:0x809E13,address:0x814218,width:2,value:0}];a.ioIndex=0;const before={...a.ctx};runObservedIntroNmi(a);
    assert.deepEqual(a.ctx,before);assert.equal(mem.read16(0x11A2),n+1);assert.equal(a.ioIndex,3);}
  assert.equal(mem.read16(0x119E),6);assert.equal(mem.read16(0x11A0),6);assert.equal(h.ctx.s,0x1EF0);
});
test('sprite writes can alias the fresh grid X scratch word across a bank boundary',()=>{
  const s=sample(0x81E83A,1);s.a=0;s.x=16;s.y=100;s.dbr=0x81;s.word(0x2C,0xF100);s.word(0x24,0x2000);s.io=[];
  const r=compareDialog(maps[2],s,{root:'RTL',native:h=>{drawIntroSpriteGrid(h);assert.equal(h.dp(0x20,2),0x2008);assert.equal(h.dp(0x2C,2),0xF104);}});
  assert.deepEqual(r.differences,[]);
});
test('zero sprite width retains the original do-loop and diagnostic access boundary',()=>{
  // A zero width is a full WORD do-loop, not an empty grid. Redirect only test
  // data, keeping the pinned original helper instructions intact.
  const s=sample(0x81E83A,1);s.a=0;s.x=16;s.rom=rom.slice();s.rom.set([0,0],cpuToOffset(0x81E9F3,rom.length));const v=side(s);v.a.accesses=NATIVE_ACCESS_LIMIT-100;
  assert.throws(()=>drawIntroSpriteGrid(v.h),e=>e.reason==='native_access_limit');
});
