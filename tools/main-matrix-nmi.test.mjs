import test from 'node:test';import assert from 'node:assert/strict';
import {matrixNmiSpecs,matrixNmiTables,proveMatrixNmi} from './main-matrix-nmi-source.mjs';
import {compareDialog,decodeWindows,window,prng,DialogTestMemory,rom} from './task-native-dialog-harness.mjs';
import {runReference} from './w65c816-reference.mjs';
import {MATRIX_NMI_ROUTINES,sendMatrixDmaRecords,handleMatrixNmi,runObservedMatrixNmi} from '../proof/matrix-reference/main-matrix-nmi.mjs';
import {SCENE_REFERENCE_ROUTINES as MAIN_SCENE_ROUTINES} from '../proof/scene-reference-routines.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';import {TaskAccessor,NATIVE_ACCESS_LIMIT} from '../src/vm/task-accessor.mjs';
import {waitForFrame} from '../src/task/main-scene-wait.mjs';
import {resetMatrixTextWindow,queueMatrixText,typeMatrixText} from '../proof/matrix-reference/main-scene-matrix.mjs';
import {queueMapEdit} from '../proof/matrix-reference/main-matrix-objects.mjs';
const maps=matrixNmiSpecs.map(s=>decodeWindows(s.windows));
test('Matrix NMI pins native vector, bank-00 handler, indirect long tail, queue stack and palette',()=>{
  for(const [i,s]of matrixNmiSpecs.entries())proveMatrixNmi(maps[i],s);
  for(const t of matrixNmiTables)assert.equal(window(t.start,t.start+t.hex.length/2).hex,t.hex);
  for(const [target,run]of MATRIX_NMI_ROUTINES)assert.equal(MAIN_SCENE_ROUTINES.get(target),run);
});
function sample(entry,seed){const random=prng(seed),rnd=n=>Math.floor(random()*n),wram=new Uint8Array(0x20000);
  for(let i=0;i<wram.length;i++)wram[i]=rnd(256);
  const word=(at,value)=>{wram[at]=value&255;wram[at+1]=value>>>8&255;};
  const s={entry,seed,wram,word,a:rnd(65536),x:rnd(65536),y:rnd(65536),dbr:0,p:rnd(256)&0xC7};
  word(0x6E,0xBEC3);wram[0x70]=0x81;word(0x174A,seed%4===0?0:1);word(0x1748,seed%4*8);
  word(0x133E,seed%2*2);word(0x1340,Math.floor(seed/2)%2*2);word(0x1C76,seed%32);
  for(let i=0;i<seed%4;i++){const at=0x113E+i*8;word(at,[1,2,0xFFFF][i%3]);wram[at+2]=seed+i;wram[at+3]=0x7F;
    word(at+4,0x19A+i*2);word(at+6,0x2000+i);}
  word(0x113E+seed%4*8,0);
  s.io=[{pc:0x809E0B,address:0x004212,width:2,value:seed%2},...(seed%2?[{pc:0x809E0B,address:0x004212,width:2,value:0}]:[]),
    {pc:0x809E13,address:0x004218,width:2,value:seed*17&65535}];return s;
}
function side(s){const mem=new DialogTestMemory(s.wram.slice(),null,s.rom),a=new TaskAccessor({mem,a:s.a,x:s.x,y:s.y,s:0x1EF0,d:0,dbr:s.dbr,p:s.p,pc:s.entry&65535});
  a.load();a.ctx.programBank=s.entry>>>16;a.trace=[];a.devices={write(){}};a.io=s.io??[];return {mem,a,h:dialogAccess(a)};}
const expand=trace=>trace.flatMap(e=>e.width===2?[{...e,width:1,value:e.value&255},{...e,width:1,address:e.address+1,value:e.value>>>8}]:[{...e,width:1}]);
const external=(h,e)=>new Map([[0x81ED8B,()=>({rawReturnWord:MATRIX_NMI_ROUTINES.get(0x81ED8B)(h,e)})],
  [0x80F290,()=>({rawReturnWord:MATRIX_NMI_ROUTINES.get(0x80F290)(h,e)})]]);
for(const [name,index]of [['bec3',0],['b1e2',1]])test(`${name}: all equations agree with original instructions including moved-stack pulls`,()=>{
  const covered=new Set();for(let seed=1;seed<=192;seed++){const s=sample(matrixNmiSpecs[index].entry,seed);
    if(name==='b1e2'){s.io=[];s.p|=(seed%4)<<4;if(s.p&0x10){s.x&=255;s.y&=255;}}
    const result=compareDialog(maps[index],s,{root:name==='bec3'?'RTL':'RTS',
      native:(h,e)=>(name==='bec3'?handleMatrixNmi(h,e):sendMatrixDmaRecords(h)),
      calls:(a,e)=>name==='bec3'?new Map([...external(dialogAccess(a),e),[0x81B1E2,()=>({rawReturnWord:sendMatrixDmaRecords(dialogAccess(a))})]]):new Map()});
    assert.deepEqual(result.differences,[],`seed ${seed}`);for(const pc of result.visited)covered.add(pc);
  }assert.deepEqual([...maps[index].keys()].filter(pc=>!covered.has(pc)),[]);
});
// This comparison supplies an actual hardware frame on the reference side.
// The production path builds that frame only on an explicit call by its owner.
function compareNmi(s,{mutate=null}={}){const n=side(s),r=side(s);
  for(const side of [n,r]){side.a.ctx.d=s.d??0;side.a.ctx.programBank=s.pb??0x81;side.a.ctx.pc=s.pc??0xEECD;
    side.a.ctx.s=s.s??0x1EF0;if(mutate){side.a.devices.write=(pc,address,value,width)=>mutate(side,pc,address,value,width);}}
  // Reference device observations are byte reads; native absoluteRead validates full records.
  let index=0,byte=0;const read=r.mem.read8.bind(r.mem);
  r.mem.read8=address=>{const o=s.io[index];if(!o||address!==o.address+byte)return read(address);
    const v=o.value>>>(byte*8)&255;if(++byte===o.width){index++;byte=0;}return v;};
  r.a.ioIndex=1;
  runObservedMatrixNmi(n.a);
  const {ctx}=r.a,h=r.h;h.pushByte(ctx.programBank);h.push(ctx.pc,2);h.pushByte(ctx.status);ctx.status=(ctx.status|4)&~8;ctx.programBank=0;
  const map=new Map([...maps[2],...maps[0],...maps[1]]),calls=external(h,null);
  // Reference I/O writes also expose the explicitly declared test device effects.
  if(mutate){const write=r.mem.write8.bind(r.mem);r.mem.write8=(address,value)=>{write(address,value);if(address===0x420B)mutate(r,0x81B213,address,value,1);};}
  const result=runReference(map,r.mem,ctx,{entry:0x00C112,root:'RTI',io:r.a.trace,calls});
  for(const k of ['a','x','y','s','d','status','pc','programBank','bank'])assert.equal(n.a.ctx[k],r.a.ctx[k],k+`, seed ${s.seed}`);
  assert.deepEqual(n.mem.wram,r.mem.wram,`WRAM seed ${s.seed}`);assert.deepEqual(expand(n.a.trace),expand(r.a.trace),`I/O seed ${s.seed}`);
  assert.equal(n.a.ioIndex,s.io.length);assert.equal(index,1); // tail device reads run through the reference accessor
  return {n,r,result};
}
test('explicit NMI follows vector bank 00, preserves interrupted registers and RTI frame, and reaches every own instruction',()=>{
  const covered=new Set();for(let seed=1;seed<=96;seed++){const s=sample(0x00C112,seed);s.p=(seed*13)&255;s.d=seed*273&65535;s.pb=[0x80,0x81,0x9F][seed%3];s.pc=seed%2?0xFFFF:0;
    s.dbr=[0,0x80,0x81][seed%3];s.io.unshift({pc:0x00C118,address:s.dbr<<16|0x4210,width:2,value:seed*71});
    if(s.p&0x10){s.x&=255;s.y&=255;}
    s.s=seed%2?3:0x1EF0;if(seed===96)s.word(0x1C76,0xFFFF);
    const {n,result}=compareNmi(s);for(const pc of result.visited)covered.add(pc);
    for(const [key,value]of Object.entries({a:s.a,x:s.x,y:s.y,d:s.d,s:s.s,bank:s.dbr,status:s.p,programBank:s.pb,pc:s.pc}))assert.equal(n.a.ctx[key],value,key);
    assert.equal(n.mem.read16(0x1C76),seed===96?0:(seed%32+1)&65535);assert.equal(n.mem.read16(0x174A),0);
  }
  assert.deepEqual([...maps[2].keys(),...maps[0].keys(),...maps[1].keys()].filter(pc=>!covered.has(pc)),[]);
});
test('B1E2 emits ordered eight-byte requests, honors zero sentinel and never reads source payload',()=>{
  const s=sample(0x81B1E2,3),{a,h,mem}=side(s);h.push(0x1234,2);sendMatrixDmaRecords(h);
  const triggers=a.trace.filter(e=>e.address===0x420B);assert.deepEqual(triggers.map(e=>[e.width,e.value]),[[1,1],[1,1],[1,1],[1,0]]);
  assert.deepEqual(a.trace.filter(e=>e.address===0x4305).map(e=>e.value),[1,2,0xFFFF]);
  assert.equal(h.ctx.s,0x1EF0);assert.equal(mem.read16(0x1748),0);assert.equal(mem.read16(0x174A),0);
  const idle=sample(0x81B1E2,4),v=side(idle);v.h.push(0x1234,2);sendMatrixDmaRecords(v.h);assert.deepEqual(v.a.trace,[]);
});
test('queue consumption sees synchronous device changes to later records and the fresh saved S',()=>{
  const s=sample(0x00C112,3);s.io.unshift({pc:0x00C118,address:0x4210,width:2,value:0});
  const {n}=compareNmi(s,{mutate:({mem},pc,address,value)=>{if(pc===0x81B213&&address===0x420B&&value===1){mem.write16(0x1146,0);}}});
  assert.equal(n.a.trace.filter(e=>e.pc===0x81B213).length,1);
  // Saved S can alias writable data. A deliberately changed saved pointer must
  // be reread, rather than a captured JS local silently restoring the old one.
  const q=sample(0x81B1E2,1),v=side(q);v.h.push(0x1234,2);v.mem.write8(0x1801,q.p);v.mem.write16(0x1802,0x5678);
  v.a.devices.write=(pc)=>{if(pc===0x81B213)v.mem.write16(0x32,0x1800);};
  sendMatrixDmaRecords(v.h);assert.equal(v.h.ctx.s,0x1803);assert.equal(v.h.ctx.pc,0x5679);
});
test('NMI preflight rejects foreign callbacks and emulation before effects; a wait value never invokes a callback',()=>{
  for(const [target,e]of [[0x81DAD6,0],[0x81BEC3,1]]){const s=sample(0x00C112,1);s.word(0x6E,target&65535);s.wram[0x70]=target>>>16;
    const v=side(s);v.a.ctx.e=e;const before=v.mem.wram.slice(),ctx={...v.a.ctx};
    assert.throws(()=>runObservedMatrixNmi(v.a),err=>err.reason=== (e?'observed_nmi_entry_required':'observed_nmi_callback_frontier'));
    assert.deepEqual(v.mem.wram,before);assert.deepEqual(v.a.ctx,ctx);assert.deepEqual(v.a.trace,[]);}
  const s=sample(0x81EEBB,1);s.wram[0x30]=0x80;s.io=[];const v=side(s);v.h.pushByte(0x80);v.h.push(0x1234,2);
  const o=Object.freeze({pc:0x81EECD,address:0x7E1C76,width:1,value:2}),events={mode:'record-observations',values:Object.freeze([o]),waitIndex:0,waitEvents:[]};
  waitForFrame(v.h,events);assert.deepEqual(v.a.trace,[]);assert.equal(v.mem.read16(0x174A),1);assert.equal(events.waitIndex,1);
});
test('NMI validates the original vector and exposes the actual callback stack, bank and counter order',()=>{
  const s=sample(0x00C112,1);s.rom=rom.slice();s.rom[0x7FEA]^=1;const v=side(s),before=v.mem.wram.slice(),ctx={...v.a.ctx};
  assert.throws(()=>runObservedMatrixNmi(v.a),e=>e.reason==='observed_nmi_entry_required');assert.deepEqual(v.mem.wram,before);assert.deepEqual(v.a.ctx,ctx);
  const q=sample(0x00C112,15);q.word(0x1C76,0xFFFF);q.io.unshift({pc:0x00C118,address:0x4210,width:2,value:0});
  const w=side(q),r=new Map(MATRIX_NMI_ROUTINES),seen=[];
  for(const target of [0x81BEC3,0x81B1E2])r.set(target,(h,e,routines)=>{seen.push(target);assert.equal(h.ctx.s,target===0x81BEC3?0x1CAE:0x1CAC);
    assert.equal(h.ctx.d,0);assert.equal(h.ctx.bank,0);assert.equal(h.ctx.status&0x30,0);assert.equal(h.read(0x7E1C76,2),0);
    return MATRIX_NMI_ROUTINES.get(target)(h,e,routines);});
  runObservedMatrixNmi(w.a,null,r);assert.deepEqual(seen,[0x81BEC3,0x81B1E2]);
});
test('original text and map producers are consumed by BEC3 on the same memory and stack',()=>{
  const s=sample(0x81B2A0,1);s.wram.fill(0);s.word(0x6E,0xBEC3);s.wram[0x70]=0x81;s.dbr=0x81;
  const {h,a,mem}=side(s),call=(target,run)=>h.call(0x811000,target,run);
  call(0x81B2A0,()=>resetMatrixTextWindow(h));h.index('x',0xC5D2);h.index('y',0x81);call(0x81B282,()=>queueMatrixText(h));
  let consumed=0,iterations=0;
  do{call(0x81B2D1,()=>typeMatrixText(h,null,MAIN_SCENE_ROUTINES));
    // An actual map-edit producer shares the same record queue with text.
    h.index('x',0);h.index('y',0x1040);h.load(0);call(0x81B6A6,()=>queueMapEdit(h,null,MAIN_SCENE_ROUTINES));
    const size=mem.read16(0x1748),records=[];for(let at=0x113E;at<0x113E+size;at+=8)records.push(mem.read16(at));
    a.io=[{pc:0x00C118,address:0x814210,width:2,value:0},{pc:0x809E0B,address:0x4212,width:2,value:0},
      {pc:0x809E13,address:0x4218,width:2,value:0}];a.ioIndex=0;const start=a.trace.length;
    const ctx={...h.ctx};runObservedMatrixNmi(a);for(const k of Object.keys(ctx))assert.equal(h.ctx[k],ctx[k],k);
    assert.deepEqual(a.trace.slice(start).filter(e=>e.pc===0x81B200).map(e=>e.value),records);
    assert.equal(mem.read16(0x1748),0);assert.equal(mem.read16(0x174A),0);consumed+=records.length;
    assert.ok(++iterations<100);
  }while(mem.read16(0x170E)!==0||mem.read16(0x1710)!==mem.read16(0x1712));
  assert.ok(consumed>1);assert.equal(h.ctx.s,0x1EF0);
});
test('unterminated stack queue retains the diagnostic access boundary',()=>{
  const s=sample(0x81B1E2,1),v=side(s);v.mem.wram.fill(1,0x113E,0x2000);v.a.accesses=NATIVE_ACCESS_LIMIT-100;
  assert.throws(()=>sendMatrixDmaRecords(v.h),e=>e.reason==='native_access_limit');
});
