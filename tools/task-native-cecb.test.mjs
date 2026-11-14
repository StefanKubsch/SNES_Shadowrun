import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectRom} from './rom.mjs';
import {decodeTaskWindows} from './task-partial-source.mjs';
import {nativeCECBSpec,proveCECBSource} from './task-native-cecb-source.mjs';
import {runReference} from './w65c816-reference.mjs';
import {VmMemory} from '../src/vm/memory.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {SPECIAL_NATIVES} from '../src/vm/special-natives.mjs';
import {raiseMemberStateCountReference as raiseMemberStateCount} from '../proof/game-reference/runner-state.mjs';

// Native27/CECB: pinned own code with stack proof and the equations against the original instructions.
// 81:AD92 has its own proof; both sides run the same stub with the real call frame.
const {bytes}=inspectRom(readFileSync(new URL('../Shadowrun (E).smc',import.meta.url))),rom=new Uint8Array(bytes);
const {map}=decodeTaskWindows(bytes,nativeCECBSpec.windows);
const romWord=address=>{const o=((address>>16)&0x7F)*0x8000+(address&0x7FFF);return rom[o]|rom[o+1]<<8;};

test('CECB pinned own code: 43 instructions, one external return, bound as special native',()=>{
 const proof=proveCECBSource(map);
 assert.equal(proof.reachable_instructions,43);assert.deepEqual(proof.external_returns,['81:AD92']);
 assert.ok(SPECIAL_NATIVES.has(0x80CECB));
});

const stub=(a,target)=>{
 const raw=a.pullWord('stub-RTS');a.ctx.programBank=a.read(a.ctx.s+1&0xFFFF,'stub-bank');a.ctx.s=(a.ctx.s+1)&0xFFFF;
 a.ctx.pc=(raw+1)&0xFFFF;a.trace.push({kind:'call',pc:target,address:a.readWord(0x04,16,'s'),value:a.ctx.s});
 a.writeWord(0x1D8,0x1111,24,'stub-mark');return {rawReturnWord:raw};
};
// Seed classes: item found for the object, found only for the leader 0CC2 (kind 4), nowhere (kind 5, endless in the
// original); weapon number in 9700 or not; record 0 or a WRAM record; amount below or above the maximum.
function setup(seed){
 const wram=new Uint8Array(0x20000);for(let n=0;n<0x4000;n++)wram[n]=(n*seed*2654435761>>>24)&255;
 const put=(address,value)=>{wram[address]=value&255;wram[address+1]=value>>>8&255;};
 const r=k=>(seed*(k*2+1)*2654435761>>>(k%8))&0xFFFF;
 const object=(r(1)&0x3E),leader=(r(2)&0x3E)|0x40,count=(r(3)&0x0E);
 put(0,object);put(2,r(4)&(seed%3?0x0F:0xFFFF));put(0x0CC2,leader);put(0x2DE6,count);
 const weapon=seed%4?romWord(0x809700+((r(5)%13)*2)):0x1234+seed,kind=seed%6;
 for(let n=0;n<=count;n+=2)put(0x2DF0+n,weapon^0x8000^n);
 put(0x150A+object,kind>=4?weapon^0x4000:weapon);put(0x150A+leader,weapon);
 if(kind===3)put(0x2DF0+count,weapon);else if(kind<5)put(0x2DF0+(r(6)%(count+2)&0xFFFE),weapon);
 put(0x13A8+object,(seed>>1)%5?0x2000+(r(7)&0x0FFE):0);put(0x13A8+leader,0x3000);
 const mem=new VmMemory(rom,wram);
 const vm={mem,a:seed&0xFFFF,x:0x5678,y:0x9ABC,s:0x1EF0,d:0,dbr:0x80,p:(seed*37)&0xC3,pc:0xF4F6};
 mem.write8(vm.s,0xF5);vm.s=(vm.s-1)&0xFFFF;mem.write8(vm.s,0x08);vm.s=(vm.s-1)&0xFFFF;
 const acc=new TaskAccessor(vm);acc.load();acc.trace=[];return {mem,acc};
}
test('CECB equations match the original instructions, endless search is a boundary',()=>{
 const covered=new Set();let endless=0,faults=0;
 for(let seed=1;seed<=300;seed++){
  const native=setup(seed),a=native.acc,ref=setup(seed),r=ref.acc;
  const run=()=>runReference(map,ref.mem,r.ctx,{entry:0x80CECB,root:'RTS',io:r.trace,limit:20000,
   calls:new Map([[0x81AD92,()=>stub(r,0x81AD92)]])});
  let result;
  try{result=raiseMemberStateCount(a,null,true,{list:()=>stub(a,0x81AD92)});}
  catch(error){
   if(error.reason==='task_cecb_endless_search'){assert.throws(run,/Reference step limit/);endless++;continue;}
   // A number outside 9700 reads the entry FFFE beyond the table: an unmapped pointer faults on both sides.
   assert.equal(error.reason,'unmapped_read',`seed ${seed}`);assert.throws(run,e=>e.reason==='unmapped_read'&&e.address===error.address);faults++;continue;
  }
  const reference=run();
  for(const k of ['a','x','y','s','status','pc','programBank','bank','d'])assert.equal(a.ctx[k],r.ctx[k],`${k} seed ${seed}`);
  assert.equal(result.rawReturnWord,reference.rawReturnWord);assert.deepEqual(a.trace,r.trace);
  assert.ok(Buffer.from(native.mem.wram).equals(Buffer.from(ref.mem.wram)),`wram seed ${seed}`);
  for(const pc of reference.visited)covered.add(pc);
 }
 assert.ok(endless>0&&faults>0);
 assert.deepEqual([...map.keys()].filter(pc=>!covered.has(pc)),[]);
});
