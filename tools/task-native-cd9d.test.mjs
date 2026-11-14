import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectRom} from './rom.mjs';
import {decodeTaskWindows} from './task-partial-source.mjs';
import {nativeCD9DSpec,proveCD9DSource} from './task-native-cd9d-source.mjs';
import {runReference} from './w65c816-reference.mjs';
import {VmMemory} from '../src/vm/memory.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {SPECIAL_NATIVES} from '../src/vm/special-natives.mjs';
import {releaseGlove} from '../src/task/native-glove-release.mjs';

// Native45/CD9D: pinned own code with stack proof and the equations against the original instructions.
// BCB2 and 81:AD92 have their own proofs; both sides run the same stubs with the real call frames.
const {bytes}=inspectRom(readFileSync(new URL('../Shadowrun (E).smc',import.meta.url))),rom=new Uint8Array(bytes);
const {map}=decodeTaskWindows(bytes,nativeCD9DSpec.windows);

test('CD9D pinned own code: four instructions, two external returns, bound as special native',()=>{
 const proof=proveCD9DSource(map);
 assert.equal(proof.reachable_instructions,4);assert.deepEqual(proof.external_returns,['80:BCB2','81:AD92']);
 assert.ok(SPECIAL_NATIVES.has(0x80CD9D));
});

const stub=(a,target,long)=>{
 const raw=a.pullWord('stub-RTS');if(long){a.ctx.programBank=a.read(a.ctx.s+1&0xFFFF,'stub-bank');a.ctx.s=(a.ctx.s+1)&0xFFFF;}
 a.ctx.pc=(raw+1)&0xFFFF;a.trace.push({kind:'call',pc:target,address:a.readWord(0x1D61,24,'s'),value:a.ctx.s});
 a.writeWord(0x1D8,long?0x1111:0x2222,24,'stub-mark');return {rawReturnWord:raw};
};
function setup(seed){
 const wram=new Uint8Array(0x20000);for(let n=0;n<0x2000;n++)wram[n]=(n*seed*2654435761>>>24)&255;
 const mem=new VmMemory(rom,wram);
 const vm={mem,a:seed&0xFFFF,x:0x5678,y:0x9ABC,s:0x1EF0,d:0,dbr:0x80,p:(seed*37)&0xC3,pc:0xF4F6};
 mem.write8(vm.s,0xF5);vm.s=(vm.s-1)&0xFFFF;mem.write8(vm.s,0x08);vm.s=(vm.s-1)&0xFFFF;
 const acc=new TaskAccessor(vm);acc.load();acc.trace=[];return {mem,acc};
}
test('CD9D equations match the original instructions',()=>{
 const covered=new Set();
 for(let seed=1;seed<=200;seed++){
  const native=setup(seed),a=native.acc;
  const result=releaseGlove(a,null,true,{bcb2:()=>stub(a,0x80BCB2,false),list:()=>stub(a,0x81AD92,true)});
  const ref=setup(seed),r=ref.acc;
  const run=runReference(map,ref.mem,r.ctx,{entry:0x80CD9D,root:'RTS',io:r.trace,
   calls:new Map([[0x80BCB2,()=>stub(r,0x80BCB2,false)],[0x81AD92,()=>stub(r,0x81AD92,true)]])});
  for(const k of ['a','x','y','s','status','pc','programBank','bank','d'])assert.equal(a.ctx[k],r.ctx[k],`${k} seed ${seed}`);
  assert.equal(result.rawReturnWord,run.rawReturnWord);assert.deepEqual(a.trace,r.trace);
  assert.ok(Buffer.from(native.mem.wram).equals(Buffer.from(ref.mem.wram)),`wram seed ${seed}`);
  for(const pc of run.visited)covered.add(pc);
 }
 assert.deepEqual([...map.keys()].filter(pc=>!covered.has(pc)),[]);
});
