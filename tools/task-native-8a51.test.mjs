import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectRom,cpuToOffset} from './rom.mjs';
import {decodeTaskWindows} from './task-partial-source.mjs';
import {native8A51Spec,native8A8CSpec,prove8A51Source,prove8A8CSource} from './task-native-8ab5-source.mjs';
import {sightA25FSpec} from './task-sight-a25f-source.mjs';
import {runReference} from './w65c816-reference.mjs';
import {VmMemory} from '../src/vm/memory.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {isIoAddress,isArithmeticRegister} from '../src/vm/devices.mjs';
import {SPECIAL_NATIVES} from '../src/vm/special-natives.mjs';
import {shootAtGloveTarget,shootWithOwnWeapon,NATIVE_8AB5_ROUTINES} from '../src/task/native-object-shoot.mjs';
import {randomBelow} from '../src/task/native-random.mjs';
import {createObject} from '../src/task/native-object-create.mjs';
import {setObjectDirection} from '../src/task/native-object-action-set.mjs';

// Native58/8A51 (player shoots at the object under the glove) and Native5A/8A8C (object shoots at object):
// pinned own code with stack proof, and the equations of src/task/native-object-shoot.mjs against the original
// instructions (tools/w65c816-reference.mjs). 81:A25F runs on its pinned windows; C51F, A835 and AAAF run
// their modules on both sides with the real call frames; the hit 8691 and the sound C46E are equal stubs.
const file=readFileSync(new URL('../Shadowrun (E).smc',import.meta.url));
const {bytes}=inspectRom(file),rom=new Uint8Array(bytes);
const map8A51=decodeTaskWindows(bytes,native8A51Spec.windows).map,map8A8C=decodeTaskWindows(bytes,native8A8CSpec.windows).map;
const reference=new Map([...map8A51,...map8A8C,...decodeTaskWindows(bytes,sightA25FSpec.windows).map]);
const romWord=address=>bytes[cpuToOffset(address,bytes.length)]|bytes[cpuToOffset(address+1,bytes.length)]<<8;
// Object numbers of the weapon table $80:9700 (13 words; index 0 is Jake with his record in WRAM $7E3BFB).
const WEAPON_OBJECTS=Array.from({length:13},(_,n)=>romWord(0x809700+2*n));

test('8A51 and 8A8C pinned own code: RTS graphs with external returns, bound as special natives',()=>{
 const p51=prove8A51Source(map8A51),p8C=prove8A8CSource(map8A8C);
 assert.equal(p51.reachable_instructions,243);assert.equal(p8C.reachable_instructions,297);
 assert.equal(p51.maximum_local_stack_bytes,10);assert.equal(p8C.maximum_local_stack_bytes,10);
 assert.deepEqual(p51.external_returns,['80:8691','80:A835','80:C46E','80:C51F','81:A25F']);
 assert.deepEqual(p8C.external_returns,['80:8691','80:A835','80:AAAF','80:C46E','80:C51F','81:A25F']);
 assert.deepEqual([...new Set(p8C.inner_calls.map(c=>c.target))].sort(),['80:8497','80:8860','80:88EB','80:8904','80:8A43']);
 assert.equal(WEAPON_OBJECTS[0],0x08B2);
 for(const target of [0x808A51,0x808A8C])assert.ok(SPECIAL_NATIVES.has(target),target.toString(16));
});

// Stubs with the real frame on both sides: 8691 (hit, proved in the Native7C graph) stores A in DPB4,
// C46E (sound) records its DP arguments.
const stub=(pc,record)=>a=>{
 const raw=a.pullWord(pc.toString(16)+'-stub-RTS');a.ctx.pc=(raw+1)&0xFFFF;record(a);return {rawReturnWord:raw};
};
const hit=stub(0x808691,a=>{a.trace.push({kind:'call',pc:0x808691,address:a.ctx.x,value:(a.ctx.y<<16)|a.ctx.a});a.writeWord(0xB4,a.ctx.a,16,'8691-stub-B4');});
const sound=stub(0x80C46E,a=>a.trace.push({kind:'call',pc:0x80C46E,address:a.readWord(0,16,'s'),value:a.readWord(2,16,'s')*65536+a.readWord(4,16,'s')+a.readWord(6,16,'s')}));
const ROUTINES=Object.freeze({...NATIVE_8AB5_ROUTINES,hit:a=>hit(a),sound:a=>sound(a)});

const STACK=0x1EF0,POINTER=0x7F4000,ACTORS=[0x00,0x02,0x04,0x0A,0x1E,0x30],FREE=[0x40,0x48,0x50,0x56],SCENARIOS=2500;
function prng(seed){let t=seed>>>0;return ()=>{t=(t+0x6D2B79F5)>>>0;let r=Math.imul(t^(t>>>15),1|t);r^=r+Math.imul(r^(r>>>7),61|r);return ((r^(r>>>14))>>>0)/4294967296;};}
function scenario(seed,player){
 const r=prng(seed),int=n=>Math.floor(r()*n),pick=list=>list[int(list.length)],wram=new Uint8Array(0x20000);
 const put=(address,v)=>{const o=address>=0x7E0000?address-0x7E0000:address;wram[o]=v&255;wram[o+1]=(v>>>8)&255;};
 const shooter=pick(ACTORS);let target=pick(ACTORS);if(target===shooter)target=ACTORS[(ACTORS.indexOf(shooter)+1)%ACTORS.length];
 const span=[0x40,0x100,0x400,0x1000][int(4)];
 for(const i of ACTORS){
  put(0x0E28+i,int(span)+0x200);put(0x0E80+i,int(span)+0x200);put(0x0ED8+i,int(Math.min(span,0x100)));put(0x7E43A0+i,int(0x40));
  put(0x1198+i,int(8));wram[0x43F8+i]=int(0x30);put(0x1458+i,int(0x10000));put(0x150A+i,pick(WEAPON_OBJECTS));
 }
 // Weapon entries $7E3C33+4X (kind, damage, range byte with sign) and Jake's record bytes 6..8.
 for(let n=0;n<13;n++){wram[0x3C33+8*n]=pick([0,1,2,3,4,5,6,7,8]);wram[0x3C34+8*n]=int(0x20);wram[0x3C35+8*n]=int(256);}
 for(let n=6;n<9;n++)wram[0x3BFB+n]=int(256);
 if(r()<0.3){const axis=pick([0x0E28,0x0E80,0x0ED8]),d=pick([0x3F,0x40,0x41])*pick([1,-1]);
  for(const field of [0x0E28,0x0E80,0x0ED8])put(field+target,(wram[field+shooter]|wram[field+shooter+1]<<8)+(field===axis?d:0));}
 for(let i=0;i<0x58;i+=2)put(0x7E3F28+i,FREE.includes(i)?0xFFFF:0);
 put(0x03D2,0x0200);put(0x03D4,0);
 put(0x024E,0x40);[0x40,0x42,0x44,0x46].forEach((x,n,l)=>put(0x0312+x,l[n+1]??0xFFFF));put(0x024C,0xFFFF);
 if(player){
  // 8A51: player $0CC2, tagged object $01DA and its slot $01DE (each negative now and then).
  put(0x0CC2,shooter);put(0x01DA,r()<0.1?0x8000|int(0x8000):int(0x40));put(0x01DE,r()<0.1?0x8000|int(0x8000):target);
  put(0,int(0x10000));put(2,int(0x10000));
 }else{put(0,shooter);put(2,target);}
 put(0xFC,POINTER&0xFFFF);wram[0xFE]=POINTER>>>16;
 const count=r()<0.6?0:1+int(3);wram[POINTER-0x7E0000]=count;
 const value=a=>wram[a]|wram[a+1]<<8,sx=0x0E28+shooter,tx=0x0E28+target;
 for(let n=0;n<count;n++){
  const t=r(),cx=(value(sx)+(value(tx)-value(sx))*t)/4,cy=(value(sx+0x58)+(value(tx+0x58)-value(sx+0x58))*t)/4,w=int(span/16)+1,base=POINTER+1+n*12;
  const lo=v=>Math.max(0,Math.min(0xFFFF,Math.round(v)));
  put(base,lo(cx-w));put(base+2,lo(cy-w));put(base+4,0);put(base+6,lo(cx+w));put(base+8,lo(cy+w));put(base+10,int(0x200));
 }
 return {wram,status:int(256)&0xC3,ppu:int(0x100000)};
}
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
 mem.write8(vm.s,0xF5);vm.s=(vm.s-1)&0xFFFF;mem.write8(vm.s,0x08);vm.s=(vm.s-1)&0xFFFF;
 const acc=new TaskAccessor(vm);acc.load();acc.trace=[];devices(acc,s.ppu);
 return {mem,acc,events:{mode:null,values:null,waitIndex:0,inputMode:null,inputs:null,inputIndex:0,calls:[],waitEvents:[]}};
}
const bytesOf=trace=>trace.flatMap(e=>(e.width??1)===2?[{kind:e.kind,pc:e.pc,address:e.address,value:e.value&255},{kind:e.kind,pc:e.pc,address:e.address+1,value:e.value>>>8}]
 :[{kind:e.kind,pc:e.pc,address:e.address,value:e.kind==='call'?e.value:e.value&255}]);
function compare(s,run,entry){
 const native=setup(s);
 const result=run(native.acc,native.events,true,ROUTINES);
 const ref=setup(s),ctx=ref.acc.ctx,a=ref.acc;
 const calls=new Map([[0x80C51F,()=>randomBelow(a,false)],[0x80A835,()=>createObject(a,false)],
  [0x80AAAF,()=>setObjectDirection(a,false)],[0x808691,()=>hit(a)],[0x80C46E,()=>sound(a)]]);
 const trace=runReference(reference,ref.mem,ctx,{entry,root:'RTS',calls,io:a.trace});
 for(const k of ['a','x','y','s','status','pc','programBank','bank','d'])assert.equal(native.acc.ctx[k],ctx[k],`${k} seed ${s.seed}`);
 assert.equal(result.rawReturnWord,trace.rawReturnWord);
 assert.deepEqual(bytesOf(native.acc.trace),bytesOf(a.trace),`io seed ${s.seed}`);
 assert.ok(Buffer.from(native.mem.wram).equals(Buffer.from(ref.mem.wram)),`wram seed ${s.seed}`);
 for(const k of ['multiplicand','dividend','quotient','product'])assert.equal(native.mem[k],ref.mem[k],`${k} seed ${s.seed}`);
 const calledHit=native.acc.trace.some(e=>e.pc===0x808691),calledSound=native.acc.trace.some(e=>e.pc===0x80C46E);
 return {visited:trace.visited,result:native.mem.read16Bank0(0),hit:calledHit,sound:calledSound};
}

for(const [name,run,entry,map,player,blocked] of [['8A51',shootAtGloveTarget,0x808A51,map8A51,true,1],['8A8C',shootWithOwnWeapon,0x808A8C,map8A8C,false,0xFFFF]])
 test(`${name} equations match the original instructions on every own instruction`,()=>{
  const covered=new Set(),outcomes={blocked:0,hit:0,other:0,sound:0};
  for(let seed=1;seed<=SCENARIOS;seed++){
   const c=compare({...scenario(seed,player),seed},run,entry);for(const pc of c.visited)covered.add(pc);
   outcomes[c.hit?'hit':c.result===blocked?'blocked':'other']++;if(c.sound)outcomes.sound++;
  }
  assert.deepEqual([...map.keys()].filter(pc=>!covered.has(pc)).map(pc=>pc.toString(16)),[]);
  assert.ok(outcomes.blocked>50&&outcomes.hit>200&&outcomes.other>200&&outcomes.sound>500,JSON.stringify(outcomes));
 });
