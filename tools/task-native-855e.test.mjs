import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectRom} from './rom.mjs';
import {decodeTaskWindows} from './task-partial-source.mjs';
import {native855ESpec,prove855ESource} from './task-native-855e-source.mjs';
import {runReference} from './w65c816-reference.mjs';
import {VmMemory} from '../src/vm/memory.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {SPECIAL_NATIVES} from '../src/vm/special-natives.mjs';
import {removeFromFightList,FIGHT_LIST_REMOVE_ROUTINES} from '../src/task/native-fight-list-remove.mjs';

// NativeC0/855E: pinned own code with stack proof, and the equations of src/task/native-fight-list-remove.mjs
// against the original instructions (tools/w65c816-reference.mjs). The six called routines have their
// own proofs and need the whole window and audio state: both sides use the same stubs with the real
// JSR/JSL frames; each stub records the DP parameters and returns a value derived from them in A.
const file=readFileSync(new URL('../Shadowrun (E).smc',import.meta.url));
const {bytes}=inspectRom(file),rom=new Uint8Array(bytes);
const {map}=decodeTaskWindows(bytes,native855ESpec.windows);

test('855E pinned own code: RTS graph with six external returns, bound as special native',()=>{
 const proof=prove855ESource(map);
 assert.equal(proof.reachable_instructions,89);assert.equal(proof.maximum_local_stack_bytes,0);
 assert.deepEqual(proof.external_returns,['80:C46E','80:FAAC','80:FD80','80:FE69','80:FEC1','81:EF47']);
 assert.ok(SPECIAL_NATIVES.has(0x80855E));
});

const TARGETS={notice:0x80FEC1,cursor:0x80FAAC,number:0x80FD80,text:0x80FE69,sound:0x80C46E,music:0x81EF47};
const stub=(target,a)=>{
 const {ctx}=a,raw=a.pullWord('855E-stub-return');
 if(target>>>16!==0x80){ctx.programBank=a.read((ctx.s+1)&0xFFFF,'855E-stub-bank');ctx.s=(ctx.s+1)&0xFFFF;}
 ctx.pc=(raw+1)&0xFFFF;const dp=[0,2,4,6,8,0xA,0xC].map(o=>a.readWord(o,16,'855E-stub-DP'));
 a.trace.push({kind:'call',pc:target,address:dp[0]|dp[1]<<16,value:dp.slice(2).reduce((v,w)=>v*31+w,ctx.a)%0x1000000});
 ctx.a=(dp[0]+7*dp[4]+target)&0xFFFF;return {rawReturnWord:raw,returnTarget:ctx.programBank*65536+ctx.pc};
};
const ROUTINES=Object.freeze(Object.fromEntries(Object.keys(FIGHT_LIST_REMOVE_ROUTINES).map(k=>[k,a=>stub(TARGETS[k],a)])));

const STACK=0x1EF0,SCENARIOS=4000;
function prng(seed){let t=seed>>>0;return ()=>{t=(t+0x6D2B79F5)>>>0;let r=Math.imul(t^(t>>>15),1|t);r^=r+Math.imul(r^(r>>>7),61|r);return ((r^(r>>>14))>>>0)/4294967296;};}
function scenario(seed){
 const r=prng(seed),int=n=>Math.floor(r()*n),pick=list=>list[int(list.length)],wram=new Uint8Array(0x20000);
 const put=(address,v)=>{const o=address>=0x7E0000?address-0x7E0000:address;wram[o]=v&255;wram[o+1]=(v>>>8)&255;};
 const object=pick([0x20,0x44,0x88,int(0x10000)]),count=int(6),ids=[0x20,0x44,0x88,0x1234];
 put(0,object);put(0x1FB0,count===0?pick([0xFFFE,0]):2*(count-1));
 for(let n=0;n<count+1;n++)put(0x1FB2+2*n,pick(ids));
 if(count&&r()<0.7)put(0x1FB2+2*int(count),object);
 put(0x1FCE,pick([0,0,int(0x10000)]));put(0x1D6B,pick([0,0x10,0x8000,int(0x10000)]));
 put(0x7E2DE6,pick([0,2,5,0x10,0x8000+int(0x8000)]));
 for(let n=0;n<0x12;n+=2)put(0x7E2DF8+n,pick([0,1,int(0x10000)]));
 const gain=int(0x10000);put(0x7E3C11,gain);put(0x1FCC,pick([gain>>>3,(gain>>>3)-int(12),int(0x10000)]));
 put(0x1FD6,int(0x10000));put(0x1FCA,pick([0xFFFF,0,6,int(0x10000)]));
 return {wram,status:int(256)&0xC7};
}
function setup(s){
 const mem=new VmMemory(rom,s.wram.slice());
 const vm={mem,a:0x1234,x:0x5678,y:0x9ABC,s:STACK,d:0,dbr:0x80,p:s.status,pc:0xF4F6};
 mem.write8(vm.s,0xF5);vm.s=(vm.s-1)&0xFFFF;mem.write8(vm.s,0x08);vm.s=(vm.s-1)&0xFFFF; // Native58 return word F508
 const acc=new TaskAccessor(vm);acc.load();acc.trace=[];
 return {mem,acc};
}
function compare(s){
 const native=setup(s),result=removeFromFightList(native.acc,{calls:[]},true,ROUTINES);
 const ref=setup(s),ctx=ref.acc.ctx,a=ref.acc;
 const run=runReference(map,ref.mem,ctx,{entry:0x80855E,root:'RTS',io:a.trace,
  calls:new Map(Object.values(TARGETS).map(t=>[t,()=>stub(t,a)]))});
 for(const k of ['a','x','y','s','status','pc','programBank','bank','d'])assert.equal(native.acc.ctx[k],ctx[k],`${k} seed ${s.seed}`);
 assert.deepEqual(native.acc.trace,a.trace,`calls seed ${s.seed}`);
 assert.ok(Buffer.from(native.mem.wram).equals(Buffer.from(ref.mem.wram)),`wram seed ${s.seed}`);
 return {visited:run.visited,outcome:result.outcome};
}

test('855E equations match the original instructions on every own instruction',()=>{
 const covered=new Set(),outcomes={};
 for(let seed=1;seed<=SCENARIOS;seed++){const c=compare({...scenario(seed),seed});for(const pc of c.visited)covered.add(pc);
  outcomes[c.outcome]=(outcomes[c.outcome]??0)+1;}
 assert.deepEqual([...map.keys()].filter(pc=>!covered.has(pc)).map(pc=>pc.toString(16)),[]);
 // Not vacuous: every exit occurs.
 for(const o of ['fight_entry_missing','fight_entry_removed','fight_ended','fight_ended_notice','fight_ended_music','fight_ended_notice_music'])
  assert.ok((outcomes[o]??0)>25,JSON.stringify(outcomes));
});
