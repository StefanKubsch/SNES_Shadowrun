import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectRom} from './rom.mjs';
import {decodeTaskWindows} from './task-partial-source.mjs';
import {combatSpecs,combatSpec,proveCombatSource} from './task-native-combat-source.mjs';
import {sightA25FSpec} from './task-sight-a25f-source.mjs';
import {runReference} from './w65c816-reference.mjs';
import {VmMemory} from '../src/vm/memory.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {isIoAddress,isArithmeticRegister} from '../src/vm/devices.mjs';
import {SPECIAL_NATIVES} from '../src/vm/special-natives.mjs';
import * as combat from '../src/task/native-combat.mjs';
import {randomBelow} from '../src/task/native-random.mjs';

// Combat natives (src/task/native-combat.mjs): pinned own code with stack proof, and the equations
// against the original instructions (tools/w65c816-reference.mjs). 81:A25F runs on its pinned windows,
// C51F as its module on both sides, the notice FEC1 as the same stub with the real frame.
const {bytes}=inspectRom(readFileSync(new URL('../Shadowrun (E).smc',import.meta.url))),rom=new Uint8Array(bytes);
const maps=new Map(combatSpecs.map(s=>[s.name.slice(12),decodeTaskWindows(bytes,s.windows).map]));
const reference=new Map([...[...maps.values()].flatMap(m=>[...m]),...decodeTaskWindows(bytes,sightA25FSpec.windows).map]);

test('Combat natives: pinned own code with RTS proofs, bound as special natives',()=>{
 const figures={'8b43':31,'8c08':64,'8c8d':33,'8ccf':27,'8d7f':92,'8d3f':97,'8d4e':115};
 for(const spec of combatSpecs){
  const name=spec.name.slice(12),proof=proveCombatSource(maps.get(name),spec);
  assert.equal(proof.reachable_instructions,figures[name],name);assert.ok(SPECIAL_NATIVES.has(spec.entry),name);
 }
 // Without the pinned lemmas: the PHY WORD of 8C9C does not match the PLA at 8CA8, REP 8B5F has two widths.
 assert.throws(()=>proveCombatSource(maps.get('8c8d'),{...combatSpec('8c8d'),indexPulls:[]}),/Stack mismatch 80:8CA8/);
 assert.throws(()=>proveCombatSource(maps.get('8b43'),{...combatSpec('8b43'),widthJoins:[]}),/Mode mismatch 80:8B5F/);
});

// FEC1 (notice with waits, proved separately): the same stub on both sides records DP00..DP0C.
const notice=a=>{
 const raw=a.pullWord('fec1-stub-RTS');a.ctx.pc=(raw+1)&0xFFFF;
 a.trace.push({kind:'call',pc:0x80FEC1,address:a.readWord(0,16,'s'),value:[2,4,6,8,0xA,0xC].reduce((v,o)=>v*7+a.readWord(o,16,'s'),0)});
 return {rawReturnWord:raw};
};
const ROUTINES=Object.freeze({...combat.NATIVE_COMBAT_ROUTINES,notice:a=>notice(a)});
const RUN={
 '8b43':(a,o)=>combat.spendMagicPoints(a,null,o,ROUTINES),'8c08':combat.findNearestVisibleMember,
 '8c8d':(a,o)=>combat.chooseRandomFightTarget(a,o,ROUTINES),'8ccf':combat.canObjectAttack,
 '8d7f':combat.moveObjectTowardsObject,'8d3f':combat.jumpObjectTowardsObject,'8d4e':combat.jumpObjectTowardsPoint,
};

const STACK=0x1EF0,POINTER=0x7F4000,TABLE=0x7F5000,ACTORS=[0x00,0x02,0x04,0x0A,0x1E,0x30];
function prng(seed){let t=seed>>>0;return ()=>{t=(t+0x6D2B79F5)>>>0;let r=Math.imul(t^(t>>>15),1|t);r^=r+Math.imul(r^(r>>>7),61|r);return ((r^(r>>>14))>>>0)/4294967296;};}
function scenario(seed){
 const r=prng(seed),int=n=>Math.floor(r()*n),pick=list=>list[int(list.length)],wram=new Uint8Array(0x20000);
 const put=(address,v)=>{const o=address>=0x7E0000?address-0x7E0000:address;wram[o]=v&255;wram[o+1]=(v>>>8)&255;};
 const span=[0x10,0x40,0x100,0x400,0x1000][int(5)];
 for(const i of ACTORS){
  for(const o of [0x0E28,0x0E80,0x0ED8])put(o+i,int(4)?int(span)+0x200:int(0x10000));put(0x7E43A0+i,int(0x40));
  put(0x1458+i,pick([0,0x0004,0x1004,0x1000,0x8004,0x0005,0x0004]));put(0x0DD0+i,int(0x10000));
 }
 // Group 1FA8 (index 7E2DE6), fight list 1FB2 (index 1FB0), member counters 7E3C96.
 const group=2*int(6);put(0x7E2DE6,group);for(let n=0;n<=group;n+=2)put(0x1FA8+n,pick(ACTORS));put(0x1D6B,r()<0.25?1+int(3):0);
 put(0x1FB0,r()<0.15?0xFFFE:2*int(6));for(let n=0;n<12;n+=2)put(0x1FB2+n,pick(ACTORS));
 put(0x1F60,2*int(13));for(let n=0;n<16;n++)wram[0x3C96+n]=int(256);
 put(0,pick(ACTORS));put(2,r()<0.5?pick(ACTORS):int(16));put(4,int(0x10000));
 // Point list [F3] (6 bytes per point) for 8D4E.
 put(0xF3,TABLE&0xFFFF);wram[0xF5]=TABLE>>>16;for(let n=0;n<0x80;n++)wram[TABLE-0x7E0000+n]=int(256);
 if(r()<0.5)wram[0]=int(256); // 8B43: arbitrary DP00 byte
 put(0xFC,POINTER&0xFFFF);wram[0xFE]=POINTER>>>16;
 const cells=r()<0.5?0:1+int(3);wram[POINTER-0x7E0000]=cells;
 for(let n=0;n<cells;n++){
  const base=POINTER+1+n*12,x=(0x200+int(span))/4,y=(0x200+int(span))/4,w=int(span/8)+1;
  put(base,x-w);put(base+2,y-w);put(base+4,0);put(base+6,x+w);put(base+8,y+w);put(base+10,int(0x200));
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
 return {mem,acc};
}
const bytesOf=trace=>trace.flatMap(e=>(e.width??1)===2?[{kind:e.kind,pc:e.pc,address:e.address,value:e.value&255},{kind:e.kind,pc:e.pc,address:e.address+1,value:e.value>>>8}]
 :[{kind:e.kind,pc:e.pc,address:e.address,value:e.kind==='call'?e.value:e.value&255}]);

for(const spec of combatSpecs){
 const name=spec.name.slice(12);
 test(`${name.toUpperCase()} equations match the original instructions on every own instruction`,()=>{
  const covered=new Set(),results=new Set();
  for(let seed=1;seed<=2500;seed++){
   const s={...scenario(seed*31+spec.id),seed},native=setup(s),result=RUN[name](native.acc,true);
   const ref=setup(s),ctx=ref.acc.ctx,a=ref.acc;
   const calls=new Map([[0x80C51F,()=>randomBelow(a,false)],[0x80FEC1,()=>notice(a)]]);
   const run=runReference(reference,ref.mem,ctx,{entry:spec.entry,root:'RTS',calls,io:a.trace});
   for(const k of ['a','x','y','s','status','pc','programBank','bank','d'])assert.equal(native.acc.ctx[k],ctx[k],`${name} ${k} seed ${seed}`);
   assert.equal(result.rawReturnWord,run.rawReturnWord);
   assert.deepEqual(bytesOf(native.acc.trace),bytesOf(a.trace),`${name} io seed ${seed}`);
   assert.ok(Buffer.from(native.mem.wram).equals(Buffer.from(ref.mem.wram)),`${name} wram seed ${seed}`);
   for(const k of ['multiplicand','dividend','quotient','product'])assert.equal(native.mem[k],ref.mem[k],`${name} ${k} seed ${seed}`);
   for(const pc of run.visited)if(maps.get(name).has(pc))covered.add(pc);
   results.add(native.mem.read16Bank0(0));
  }
  // 8D3F and 8D4E clear DP04 first: INC DP04 never gives 0, the extra LSR at 8DDB is dead for them.
  const dead=['8d3f','8d4e'].includes(name)?['808ddb']:[];
  assert.deepEqual([...maps.get(name).keys()].filter(pc=>!covered.has(pc)).map(pc=>pc.toString(16)),dead);
  assert.ok(results.size>=2,name);
 });
}
