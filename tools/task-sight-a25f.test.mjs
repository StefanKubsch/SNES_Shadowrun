import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectRom} from './rom.mjs';
import {decodeTaskWindows} from './task-partial-source.mjs';
import {sightA25FSpec,proveSightSource} from './task-sight-a25f-source.mjs';
import {runReference} from './w65c816-reference.mjs';
import {VmMemory} from '../src/vm/memory.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {leaf} from '../src/task/native-leaf-support.mjs';
import {testLineOfSight,lineOfSightDevices} from '../src/task/line-of-sight.mjs';

// 81:A25F: pinned source with closed stack proof, and the fixed equations of src/task/line-of-sight.mjs
// against the original instructions (test-only reference tools/w65c816-reference.mjs) over seeded
// scenarios that together reach every one of the 716 instructions.
const file=readFileSync(new URL('../Shadowrun (E).smc',import.meta.url));
const {bytes}=inspectRom(file),rom=new Uint8Array(bytes);
const {map}=decodeTaskWindows(bytes,sightA25FSpec.windows);

test('81:A25F pinned windows: closed JSL graph, two local stack bytes, three RTL exits',()=>{
 const proof=proveSightSource(map);
 assert.equal(proof.reachable_instructions,716);assert.equal(proof.maximum_local_stack_bytes,2);
 assert.deepEqual(proof.inner_calls.map(c=>c.target),['81:A32D','81:A344','81:A55C']);
 // Device contract of the module: exactly the pinned hardware reads (PCs) and the arithmetic registers.
 const reads=proof.hardware_accesses.filter(a=>a.operation!=='STA');
 assert.deepEqual([...lineOfSightDevices.observationPcs],reads.map(a=>parseInt(a.at.replace(':',''),16)));
 assert.ok(proof.hardware_accesses.every(a=>(a.operation==='STA'?lineOfSightDevices.writes:lineOfSightDevices.reads).includes(parseInt(a.register,16))));
 assert.deepEqual(sightA25FSpec.windows.map(w=>w.initialM??0),[0,1,1]);
 // Linear decoding with M0 at A60B reads EOR #$1AFF; the pinned window must reject it.
 const wrong=sightA25FSpec.windows.map(w=>({...w,initialM:0}));
 assert.throws(()=>proveSightSource(decodeTaskWindows(bytes,wrong).map,{...sightA25FSpec,windows:wrong}));
});

const SCENARIOS=4000,STACK=0x1FF0,POINTER=0x7F4000,OBJECTS=[0x00,0x02,0x0A,0x1E,0x56];
function prng(seed){let t=seed>>>0;return ()=>{t=(t+0x6D2B79F5)>>>0;let r=Math.imul(t^(t>>>15),1|t);r^=r+Math.imul(r^(r>>>7),61|r);return ((r^(r>>>14))>>>0)/4294967296;};}
function scenario(seed){
 const r=prng(seed),int=n=>Math.floor(r()*n),wram=new Uint8Array(0x20000);
 const put=(address,v)=>{const o=address>=0x7E0000?address-0x7E0000:address;wram[o]=v&255;wram[o+1]=(v>>>8)&255;};
 const [x,y]=(()=>{const a=OBJECTS[int(5)];let b=OBJECTS[int(5)];if(b===a)b=OBJECTS[(OBJECTS.indexOf(a)+1)%5];return [a,b];})();
 // Object positions in pixels (A25F uses >>2 for the box test and >>4 for the line terms).
 const span=[0x100,0x400,0x1000,0x4000,0x10000][int(5)];
 const pos=()=>[int(span),int(span),int(0x200)];
 const target=pos(),viewer=pos();
 for(const [i,p] of [[x,target],[y,viewer]]){put(0x0E28+i,p[0]);put(0x0E80+i,p[1]);put(0x0ED8+i,p[2]);put(0x7E43A0+i,int(0x100));}
 put(0xFC,POINTER&0xFFFF);wram[0xFE]=POINTER>>>16;
 const count=[0,1,2,3,6][int(5)];wram[POINTER-0x7E0000]=count;
 for(let n=0;n<count;n++){
  // 12-byte cell box records (x0, y0, unused, x1, y1, height) in >>2 units, mostly on the segment.
  const t=r(),cx=(r()<0.8?viewer[0]+(target[0]-viewer[0])*t:int(span))/4,cy=(r()<0.8?viewer[1]+(target[1]-viewer[1])*t:int(span))/4;
  const size=()=>int(span/[4,16,64,256][int(4)])+1,w=size(),hgt=size(),base=POINTER+1+n*12;
  const lo=v=>Math.max(0,Math.min(0xFFFF,Math.round(v)));
  put(base,lo(cx-w));put(base+2,lo(cy-hgt));put(base+4,int(0x10000));put(base+6,lo(cx+w));put(base+8,lo(cy+hgt));put(base+10,int(0x200));
 }
 return {wram,x,y,status:int(256)&0xC3};
}
function setup(s){
 const mem=new VmMemory(rom,s.wram.slice());
 const vm={mem,a:0x1234,x:s.x,y:s.y,s:STACK,d:0,dbr:0x80,p:s.status,pc:0x8BFA};
 // Outer leaf RTS word, then the JSL frame of 8BC5 (bank 80, word 8BFE).
 for(const v of [0x8B,0xF0,0x80,0x8B,0xFE]){mem.write8(vm.s,v);vm.s=(vm.s-1)&0xFFFF;}
 return {mem,vm};
}
const bytesOf=trace=>trace.flatMap(e=>e.width===2?[{kind:e.kind,pc:e.pc,address:e.address,value:e.value&255},{kind:e.kind,pc:e.pc,address:e.address+1,value:e.value>>>8}]:[{kind:e.kind,pc:e.pc,address:e.address,value:e.value}]);
function compare(s){
 const native=setup(s),acc=new TaskAccessor(native.vm);acc.load();acc.trace=[];let after,result;
 leaf(acc,h=>{result=testLineOfSight(h);after={...acc.ctx};},false);
 const ref=setup(s),ctx={programBank:0x81,a:ref.vm.a,x:ref.vm.x,y:ref.vm.y,s:ref.vm.s,d:0,bank:0x80,status:ref.vm.p,pc:0};
 const run=runReference(map,ref.mem,ctx,{entry:0x81A25F});
 for(const k of ['a','x','y','s','status','pc','programBank'])assert.equal(after[k],ctx[k],`${k} seed ${s.seed}`);
 assert.equal(result.rawReturnWord,run.rawReturnWord);
 assert.deepEqual(bytesOf(acc.trace),run.io.map(({kind,pc,address,value})=>({kind,pc,address,value})),`io seed ${s.seed}`);
 assert.ok(Buffer.from(native.mem.wram).equals(Buffer.from(ref.mem.wram)),`wram seed ${s.seed}`);
 for(const k of ['multiplicand','dividend','quotient','product'])assert.equal(native.mem[k],ref.mem[k],`${k} seed ${s.seed}`);
 return {visited:run.visited,blocked:result.blocked,low:native.mem.read16Bank0(0x68)===0xFFFF};
}

test('81:A25F equations match the original instructions and reach all 716 instructions',()=>{
 const covered=new Set(),outcomes={blocked:0,free:0,low:0};
 for(let seed=1;seed<=SCENARIOS;seed++){
  const c=compare({...scenario(seed),seed});for(const pc of c.visited)covered.add(pc);
  outcomes[c.blocked?'blocked':'free']++;if(c.low&&!c.blocked)outcomes.low++;
 }
 // Not vacuous: both results and the low-box mark (A664) occur.
 assert.ok(outcomes.blocked>100&&outcomes.free>100&&outcomes.low>10,JSON.stringify(outcomes));
 const missing=[...map.keys()].filter(pc=>!covered.has(pc)).map(pc=>pc.toString(16));
 assert.deepEqual(missing,[]);
});
