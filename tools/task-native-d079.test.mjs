import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectRom} from './rom.mjs';
import {decodeTaskWindows} from './task-partial-source.mjs';
import {nativeD079Spec,proveD079Source} from './task-native-d079-source.mjs';
import {runReference} from './w65c816-reference.mjs';
import {VmMemory} from '../src/vm/memory.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {SPECIAL_NATIVES} from '../src/vm/special-natives.mjs';
import {restoreAllRunnersReference as restoreAllRunners} from '../proof/game-reference/runner-state.mjs';

// Native20/D079: pinned own code (with D08A) with stack proof and the equations against the original
// instructions. 81:AD92 has its own proof; both sides run the same stub with the real call frame.
const {bytes}=inspectRom(readFileSync(new URL('../Shadowrun (E).smc',import.meta.url))),rom=new Uint8Array(bytes);
const {map}=decodeTaskWindows(bytes,nativeD079Spec.windows);

test('D079 pinned own code: 47 instructions, one external return, bound as special native',()=>{
 const proof=proveD079Source(map);
 assert.equal(proof.reachable_instructions,47);assert.deepEqual(proof.external_returns,['81:AD92']);
 assert.equal(proof.maximum_local_stack_bytes,6);assert.ok(SPECIAL_NATIVES.has(0x80D079));
});

const stub=(a,target)=>{
 const raw=a.pullWord('stub-RTS');a.ctx.programBank=a.read(a.ctx.s+1&0xFFFF,'stub-bank');a.ctx.s=(a.ctx.s+1)&0xFFFF;
 a.ctx.pc=(raw+1)&0xFFFF;a.trace.push({kind:'call',pc:target,address:a.readWord(0x6B,16,'s'),value:a.ctx.s});
 a.writeWord(0x1D8,0x1111,24,'stub-mark');return {rawReturnWord:raw};
};
// Random WRAM (weapon 0 points into 7E:3BFB), random registers and flags.
function setup(seed){
 const wram=new Uint8Array(0x20000);for(let n=0;n<0x20000;n++)wram[n]=(n*seed*2654435761>>>24)&255;
 const mem=new VmMemory(rom,wram);
 const vm={mem,a:seed&0xFFFF,x:0x5678,y:0x9ABC,s:0x1EF0,d:0,dbr:0x80,p:(seed*37)&0xC3,pc:0xF4F6};
 mem.write8(vm.s,0xF5);vm.s=(vm.s-1)&0xFFFF;mem.write8(vm.s,0x08);vm.s=(vm.s-1)&0xFFFF;
 const acc=new TaskAccessor(vm);acc.load();acc.trace=[];return {mem,acc};
}
test('D079 equations match the original instructions',()=>{
 const covered=new Set();
 for(let seed=1;seed<=60;seed++){
  const native=setup(seed),a=native.acc,ref=setup(seed),r=ref.acc;
  const result=restoreAllRunners(a,null,true,{list:()=>stub(a,0x81AD92)});
  const run=runReference(map,ref.mem,r.ctx,{entry:0x80D079,root:'RTS',io:r.trace,calls:new Map([[0x81AD92,()=>stub(r,0x81AD92)]])});
  for(const k of ['a','x','y','s','status','pc','programBank','bank','d'])assert.equal(a.ctx[k],r.ctx[k],`${k} seed ${seed}`);
  assert.equal(result.rawReturnWord,run.rawReturnWord);assert.deepEqual(a.trace,r.trace);
  assert.ok(Buffer.from(native.mem.wram).equals(Buffer.from(ref.mem.wram)),`wram seed ${seed}`);
  for(const pc of run.visited)covered.add(pc);
 }
 assert.deepEqual([...map.keys()].filter(pc=>!covered.has(pc)),[]);
});
