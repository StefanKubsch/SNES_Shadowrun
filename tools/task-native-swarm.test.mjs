import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectRom} from './rom.mjs';
import {decodeTaskWindows} from './task-partial-source.mjs';
import {m1dLeafSpecs} from './task-native-m1d-specs.mjs';
import {proveLeafSource} from './task-native-leaf-source.mjs';
import {runReference} from './w65c816-reference.mjs';
import {VmMemory} from '../src/vm/memory.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {startPathSwarm,startWaveSwarm,circleSwarmLeader} from '../src/task/native-swarm-start.mjs';

// Swarm natives D7DD, D260 and D63C against the original instructions of their own windows. The object
// creation A835 and the action AAAF have their own proofs (whole graphs pinned in the leaf specs); here both
// sides run the same stubs with the real JSR frames, A835 returning a scenario slot in DP00.
const {bytes}=inspectRom(readFileSync(new URL('../Shadowrun (E).smc',import.meta.url))),rom=new Uint8Array(bytes);
const spec=name=>m1dLeafSpecs.find(s=>s.name===name);
const stub=(a,target,slots)=>{
 const raw=a.pullWord('stub-RTS');a.ctx.pc=(raw+1)&0xFFFF;
 a.trace.push({kind:'call',pc:target,address:[0,2,4,6,8].reduce((v,o)=>v*31+a.readWord(o,16,'s'),0)%0x1000000,value:a.ctx.s});
 if(target===0x80A835)a.writeWord(0,slots.shift()??0x1234,16,'stub-slot');
 a.ctx.a=(raw*7+target)&0xFFFF;a.ctx.status=(a.ctx.status&~0x83)|(a.ctx.a&0x8000?0x80:0)|(raw&1);
 return {rawReturnWord:raw};
};
function setup(seed,entry){
 let t=seed*2654435761>>>0;const int=n=>{t=(t*1103515245+12345)>>>0;return (t>>>8)%n;};
 const wram=new Uint8Array(0x20000);for(let n=0;n<0x4000;n++)wram[n]=int(256);
 const put=(o,v)=>{wram[o]=v&255;wram[o+1]=v>>>8&255;};
 // D7DD indexes 0E28+DP00 with the full word: object numbers only (bit 7 selects the type).
 put(0,int(4)||entry===0x80D7DD?2*int(0x60)|(int(2)?0x80:0)|int(2):int(0x10000));
 if(entry===0x80D63C){put(0x1D35,int(3)?int(0x30)-0x18&0xFFFF:int(0x10000));put(0x1D33,[1,1,2,0x8000|int(0x8000),int(9)][int(5)]);
  put(0x1D31,2*int(8));put(0x1D4D,2*int(0x60));}
 const mem=new VmMemory(rom,wram);
 const vm={mem,a:int(0x10000),x:0x5678,y:0x9ABC,s:0x1EF0,d:0,dbr:0x80,p:int(256)&0xC7,pc:0xF4F6};
 mem.write8(vm.s,0xF5);vm.s=(vm.s-1)&0xFFFF;mem.write8(vm.s,0x08);vm.s=(vm.s-1)&0xFFFF;
 const acc=new TaskAccessor(vm);acc.load();acc.trace=[];
 return {mem,acc,slots:Array.from({length:16},()=>int(4)?2*int(0x60):int(0x10000))};
}
for(const [name,entry,run,instructions] of [['native-d7dd',0x80D7DD,startPathSwarm,257],['native-d260',0x80D260,startWaveSwarm,253],['native-d63c',0x80D63C,circleSwarmLeader,400]]){
 test(`${name.slice(7).toUpperCase()} whole graph proof and equations against the original instructions`,()=>{
  const s=spec(name),whole=decodeTaskWindows(bytes,s.windows).map;
  assert.equal(proveLeafSource(whole,s).reachable_instructions,instructions);
  const {map}=decodeTaskWindows(bytes,[s.windows[0]]),covered=new Set();
  for(let seed=1;seed<=400;seed++){
   const native=setup(seed,entry),a=native.acc,ref=setup(seed,entry),r=ref.acc;
   run(a,true,{create:x=>stub(x,0x80A835,native.slots),action:x=>stub(x,0x80AAAF,native.slots)});
   const reference=runReference(map,ref.mem,r.ctx,{entry,root:'RTS',io:r.trace,
    calls:new Map([[0x80A835,()=>stub(r,0x80A835,ref.slots)],[0x80AAAF,()=>stub(r,0x80AAAF,ref.slots)]])});
   for(const k of ['a','x','y','s','status','pc','bank','d'])assert.equal(a.ctx[k],r.ctx[k],`${k} seed ${seed}`);
   assert.deepEqual(a.trace,r.trace,`trace seed ${seed}`);
   assert.ok(Buffer.from(native.mem.wram).equals(Buffer.from(ref.mem.wram)),`wram seed ${seed}`);
   for(const pc of reference.visited)covered.add(pc);
  }
  assert.deepEqual([...map.keys()].filter(pc=>!covered.has(pc)).map(pc=>pc.toString(16)),[]);
 });
}
