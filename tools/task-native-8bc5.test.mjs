import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectRom} from './rom.mjs';
import {decodeTaskWindows} from './task-partial-source.mjs';
import {native8BC5Spec,prove8BC5Source} from './task-native-8bc5-source.mjs';
import {sightA25FSpec} from './task-sight-a25f-source.mjs';
import {runReference} from './w65c816-reference.mjs';
import {VmMemory} from '../src/vm/memory.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {isIoAddress,isArithmeticRegister} from '../src/vm/devices.mjs';
import {SPECIAL_NATIVES} from '../src/vm/special-natives.mjs';
import {ORACLE_NATIVES} from '../proof/vm/oracle-natives.mjs';
import {chooseEnemyTarget} from '../proof/game-reference/enemy-target-choice.mjs';
import {randomBelow} from '../src/task/native-random.mjs';

// Native07/8BC5: pinned own code with stack proof, and the equations of proof/game-reference/enemy-target-choice.mjs
// against the original instructions (tools/w65c816-reference.mjs). 81:A25F runs on its pinned
// windows; C51F runs its module on both sides with the real JSR frame.
const file=readFileSync(new URL('../Shadowrun (E).smc',import.meta.url));
const {bytes}=inspectRom(file),rom=new Uint8Array(bytes);
const {map}=decodeTaskWindows(bytes,native8BC5Spec.windows);
const reference=new Map([...map,...decodeTaskWindows(bytes,sightA25FSpec.windows).map]);

test('8BC5 pinned own code: RTS graph with two external returns and the PHY/PLA lemma, bound as special native',()=>{
 const proof=prove8BC5Source(map);
 assert.equal(proof.reachable_instructions,32);assert.equal(proof.maximum_local_stack_bytes,2);
 assert.deepEqual(proof.external_returns,['80:C51F','81:A25F']);
 // Without the pinned PLA lemma the PHY WORD at 8BCF does not match the PLA at 8BE9.
 assert.throws(()=>prove8BC5Source(map,{...native8BC5Spec,indexPulls:[]}),/Stack mismatch 80:8BE9/);
 assert.ok(SPECIAL_NATIVES.has(0x808BC5));assert.ok(!ORACLE_NATIVES.has(0x808BC5));
});

const STACK=0x1EF0,POINTER=0x7F4000,ACTORS=[0x00,0x02,0x04,0x0A,0x1E,0x30],SCENARIOS=2000;
function prng(seed){let t=seed>>>0;return ()=>{t=(t+0x6D2B79F5)>>>0;let r=Math.imul(t^(t>>>15),1|t);r^=r+Math.imul(r^(r>>>7),61|r);return ((r^(r>>>14))>>>0)/4294967296;};}
function scenario(seed){
 const r=prng(seed),int=n=>Math.floor(r()*n),pick=list=>list[int(list.length)],wram=new Uint8Array(0x20000);
 const put=(address,v)=>{const o=address>=0x7E0000?address-0x7E0000:address;wram[o]=v&255;wram[o+1]=(v>>>8)&255;};
 const span=[0x40,0x100,0x400,0x1000][int(4)];
 for(const i of ACTORS){
  put(0x0E28+i,int(span)+0x200);put(0x0E80+i,int(span)+0x200);put(0x0ED8+i,int(0x100));put(0x7E43A0+i,int(0x40));
  put(0x1458+i,pick([0,0x0004,0x1004,0x1000,0x8004,0x0005]));
 }
 // Object list 1FA8 with count 7E2DE6 (the random index lies below (count >> 1) + 1).
 const count=1+int(6);put(0x7E2DE6,count);for(let n=0;n<=count;n++)put(0x1FA8+2*n,pick(ACTORS));
 put(0x1D6B,r()<0.3?1+int(3):0);
 put(0,pick(ACTORS));
 put(0xFC,POINTER&0xFFFF);wram[0xFE]=POINTER>>>16;
 const cells=r()<0.5?0:1+int(3);wram[POINTER-0x7E0000]=cells;
 for(let n=0;n<cells;n++){
  const base=POINTER+1+n*12,x=(0x200+int(span))/4,y=(0x200+int(span))/4,w=int(span/8)+1;
  put(base,x-w);put(base+2,y-w);put(base+4,0);put(base+6,x+w);put(base+8,y+w);put(base+10,int(0x200));
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
 return {mem,acc};
}
const bytesOf=trace=>trace.flatMap(e=>(e.width??1)===2?[{kind:e.kind,pc:e.pc,address:e.address,value:e.value&255},{kind:e.kind,pc:e.pc,address:e.address+1,value:e.value>>>8}]
 :[{kind:e.kind,pc:e.pc,address:e.address,value:e.value&255}]);
function compare(s){
 const native=setup(s),result=chooseEnemyTarget(native.acc,true);
 const ref=setup(s),ctx=ref.acc.ctx,a=ref.acc;
 const run=runReference(reference,ref.mem,ctx,{entry:0x808BC5,root:'RTS',calls:new Map([[0x80C51F,()=>randomBelow(a,false)]]),io:a.trace});
 for(const k of ['a','x','y','s','status','pc','programBank','bank','d'])assert.equal(native.acc.ctx[k],ctx[k],`${k} seed ${s.seed}`);
 assert.equal(result.rawReturnWord,run.rawReturnWord);
 assert.deepEqual(bytesOf(native.acc.trace),bytesOf(a.trace),`io seed ${s.seed}`);
 assert.ok(Buffer.from(native.mem.wram).equals(Buffer.from(ref.mem.wram)),`wram seed ${s.seed}`);
 return {visited:run.visited,result:native.mem.read16Bank0(0)};
}

test('8BC5 equations match the original instructions on every own instruction',()=>{
 const covered=new Set(),outcomes={none:0,target:0};
 for(let seed=1;seed<=SCENARIOS;seed++){
  const c=compare({...scenario(seed),seed});for(const pc of c.visited)covered.add(pc);
  outcomes[c.result===0xFFFF?'none':'target']++;
 }
 assert.deepEqual([...map.keys()].filter(pc=>!covered.has(pc)).map(pc=>pc.toString(16)),[]);
 assert.ok(outcomes.none>100&&outcomes.target>100,JSON.stringify(outcomes));
});
