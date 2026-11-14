import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectRom} from './rom.mjs';
import {decodeTaskWindows} from './task-partial-source.mjs';
import {native8AB5Spec,prove8AB5Source} from './task-native-8ab5-source.mjs';
import {sightA25FSpec} from './task-sight-a25f-source.mjs';
import {runReference} from './w65c816-reference.mjs';
import {VmMemory} from '../src/vm/memory.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {isIoAddress,isArithmeticRegister} from '../src/vm/devices.mjs';
import {SPECIAL_NATIVES} from '../src/vm/special-natives.mjs';
import {ORACLE_NATIVES} from '../proof/vm/oracle-natives.mjs';
import {shootAtObject,NATIVE_8AB5_ROUTINES} from '../src/task/native-object-shoot.mjs';
import {randomBelow} from '../src/task/native-random.mjs';
import {createObject} from '../src/task/native-object-create.mjs';
import {setObjectDirection} from '../src/task/native-object-action-set.mjs';

// Native10/8AB5: pinned own code with stack proof, and the equations of src/task/native-object-shoot.mjs
// against the original instructions (tools/w65c816-reference.mjs). 81:A25F runs on its pinned
// windows; C51F, A835 and AAAF run their modules on both sides with the real call frames.
const file=readFileSync(new URL('../Shadowrun (E).smc',import.meta.url));
const {bytes}=inspectRom(file),rom=new Uint8Array(bytes);
const {map}=decodeTaskWindows(bytes,native8AB5Spec.windows);
const reference=new Map([...map,...decodeTaskWindows(bytes,sightA25FSpec.windows).map]);

test('8AB5 pinned own code: RTS graph with five external returns, bound as special native',()=>{
 const proof=prove8AB5Source(map);
 assert.equal(proof.reachable_instructions,234);assert.equal(proof.maximum_local_stack_bytes,6);
 assert.deepEqual(proof.external_returns,['80:8691','80:A835','80:AAAF','80:C51F','81:A25F']);
 assert.deepEqual([...new Set(proof.inner_calls.map(c=>c.target))].sort(),['80:8497','80:8904','80:8A43']);
 assert.ok(SPECIAL_NATIVES.has(0x808AB5));assert.ok(!ORACLE_NATIVES.has(0x808AB5));
});

// 8691 (hit, proved in the Native7C graph) needs the whole text state: both sides use the same stub
// that takes the JSR frame back, marks the call with X/Y/A in the trace and stores A in DPB4.
const hit=a=>{
 const raw=a.pullWord('8691-stub-RTS');a.ctx.pc=(raw+1)&0xFFFF;
 a.trace.push({kind:'call',pc:0x808691,address:a.ctx.x,value:(a.ctx.y<<16)|a.ctx.a});a.writeWord(0xB4,a.ctx.a,16,'8691-stub-B4');
 return {rawReturnWord:raw};
};
const ROUTINES=Object.freeze({...NATIVE_8AB5_ROUTINES,hit:a=>hit(a)});

const STACK=0x1EF0,POINTER=0x7F4000,ACTORS=[0x00,0x02,0x04,0x0A,0x1E,0x30],FREE=[0x40,0x48,0x50,0x56],SCENARIOS=3000;
function prng(seed){let t=seed>>>0;return ()=>{t=(t+0x6D2B79F5)>>>0;let r=Math.imul(t^(t>>>15),1|t);r^=r+Math.imul(r^(r>>>7),61|r);return ((r^(r>>>14))>>>0)/4294967296;};}
function scenario(seed){
 const r=prng(seed),int=n=>Math.floor(r()*n),pick=list=>list[int(list.length)],wram=new Uint8Array(0x20000);
 const put=(address,v)=>{const o=address>=0x7E0000?address-0x7E0000:address;wram[o]=v&255;wram[o+1]=(v>>>8)&255;};
 const shooter=pick(ACTORS);let target=pick(ACTORS);if(target===shooter)target=ACTORS[(ACTORS.indexOf(shooter)+1)%ACTORS.length];
 const span=[0x40,0x100,0x400,0x1000][int(4)];
 for(const i of ACTORS){
  put(0x0E28+i,int(span)+0x200);put(0x0E80+i,int(span)+0x200);put(0x0ED8+i,int(Math.min(span,0x100)));put(0x7E43A0+i,int(0x40));
  put(0x1198+i,int(8));wram[0x43F8+i]=int(0x30);
 }
 // Distance limit 40 of 8904: some targets exactly 3F/40/41 away (either sign) on one axis.
 if(r()<0.3){const axis=pick([0x0E28,0x0E80,0x0ED8]),d=pick([0x3F,0x40,0x41])*pick([1,-1]);
  for(const field of [0x0E28,0x0E80,0x0ED8])put(field+target,(wram[field+shooter]|wram[field+shooter+1]<<8)+(field===axis?d:0));}
 // Free object slots for A835, one free task heap block at 03D2 and free task slots 40..46 for its appended frame.
 for(let i=0;i<0x58;i+=2)put(0x7E3F28+i,FREE.includes(i)?0xFFFF:0);
 put(0x03D2,0x0200);put(0x03D4,0);
 put(0x024E,0x40);[0x40,0x42,0x44,0x46].forEach((x,n,l)=>put(0x0312+x,l[n+1]??0xFFFF));put(0x024C,0xFFFF);
 put(0,shooter);put(2,r()<0.08?0x8000|int(0x8000):target);
 put(4,int(9));put(6,pick([0,1,2,3,4,5,6,7,8]));put(8,int(0x20));put(0x0A,int(5));
 put(0xFC,POINTER&0xFFFF);wram[0xFE]=POINTER>>>16;
 const count=r()<0.6?0:1+int(3);wram[POINTER-0x7E0000]=count;
 const value=a=>wram[a]|wram[a+1]<<8,sx=0x0E28+shooter,tx=0x0E28+target;
 for(let n=0;n<count;n++){
  // Cell boxes (12 bytes, >>2 units) on the line, so that A25F also reports low boxes (DP68).
  const t=r(),cx=(value(sx)+(value(tx)-value(sx))*t)/4,cy=(value(sx+0x58)+(value(tx+0x58)-value(sx+0x58))*t)/4,w=int(span/16)+1,base=POINTER+1+n*12;
  const lo=v=>Math.max(0,Math.min(0xFFFF,Math.round(v)));
  put(base,lo(cx-w));put(base+2,lo(cy-w));put(base+4,0);put(base+6,lo(cx+w));put(base+8,lo(cy+w));put(base+10,int(0x200));
 }
 return {wram,status:int(256)&0xC3,ppu:int(0x100000)};
}
// PPU counters for C51F from a seeded sequence (the same on both sides).
function devices(acc,seed){
 const next=prng(seed),original=acc.absoluteRead;
 acc.absoluteRead=(offset,width,pc,label)=>{
  const address=(acc.ctx.bank*65536+offset)&0xFFFFFF;
  if(!isIoAddress(address)||isArithmeticRegister(address,false))return original(offset,width,pc,label);
  const value=Math.floor(next()*(width===1?256:65536));acc.trace.push({kind:'read',pc,address,width,value});return value;
 };
}
function setup(s){
 const mem=new VmMemory(rom,s.wram.slice());
 const vm={mem,a:0x1234,x:0x5678,y:0x9ABC,s:STACK,d:0,dbr:0x80,p:s.status,pc:0xF4F6};
 mem.write8(vm.s,0xF5);vm.s=(vm.s-1)&0xFFFF;mem.write8(vm.s,0x08);vm.s=(vm.s-1)&0xFFFF; // Native58 return word F508
 const acc=new TaskAccessor(vm);acc.load();acc.trace=[];devices(acc,s.ppu);
 return {mem,acc,events:{mode:null,values:null,waitIndex:0,inputMode:null,inputs:null,inputIndex:0,calls:[],waitEvents:[]}};
}
const bytesOf=trace=>trace.flatMap(e=>(e.width??1)===2?[{kind:e.kind,pc:e.pc,address:e.address,value:e.value&255},{kind:e.kind,pc:e.pc,address:e.address+1,value:e.value>>>8}]
 :[{kind:e.kind,pc:e.pc,address:e.address,value:e.kind==='call'?e.value:e.value&255}]);
function compare(s){
 const native=setup(s);
 const result=shootAtObject(native.acc,native.events,true,ROUTINES);
 const ref=setup(s),ctx=ref.acc.ctx,a=ref.acc;
 const calls=new Map([[0x80C51F,()=>randomBelow(a,false)],[0x80A835,()=>createObject(a,false)],
  [0x80AAAF,()=>setObjectDirection(a,false)],[0x808691,()=>hit(a)]]);
 const run=runReference(reference,ref.mem,ctx,{entry:0x808AB5,root:'RTS',calls,io:a.trace});
 for(const k of ['a','x','y','s','status','pc','programBank','bank','d'])assert.equal(native.acc.ctx[k],ctx[k],`${k} seed ${s.seed}`);
 assert.equal(result.rawReturnWord,run.rawReturnWord);
 assert.deepEqual(bytesOf(native.acc.trace),bytesOf(a.trace),`io seed ${s.seed}`);
 assert.ok(Buffer.from(native.mem.wram).equals(Buffer.from(ref.mem.wram)),`wram seed ${s.seed}`);
 for(const k of ['multiplicand','dividend','quotient','product'])assert.equal(native.mem[k],ref.mem[k],`${k} seed ${s.seed}`);
 return {visited:run.visited,result:native.mem.read16Bank0(0),hit:native.acc.trace.some(e=>e.kind==='call')};
}

test('8AB5 equations match the original instructions on every own instruction',()=>{
 const covered=new Set(),outcomes={blocked:0,hit:0,miss:0};
 for(let seed=1;seed<=SCENARIOS;seed++){
  const c=compare({...scenario(seed),seed});for(const pc of c.visited)covered.add(pc);
  outcomes[c.hit?'hit':c.result===0xFFFF?'blocked':'miss']++;
 }
 assert.deepEqual([...map.keys()].filter(pc=>!covered.has(pc)).map(pc=>pc.toString(16)),[]);
 // Not vacuous: blocked sight, hits and misses all occur.
 assert.ok(outcomes.blocked>50&&outcomes.hit>200&&outcomes.miss>200,JSON.stringify(outcomes));
});
