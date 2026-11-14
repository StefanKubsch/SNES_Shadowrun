import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectRom} from './rom.mjs';
import {decodeTaskWindows} from './task-partial-source.mjs';
import {native8521Spec,prove8521Source} from './task-native-8521-source.mjs';
import {runReference} from './w65c816-reference.mjs';
import {VmMemory} from '../src/vm/memory.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {SPECIAL_NATIVES} from '../src/vm/special-natives.mjs';
import {appendToFightListReference as appendToFightList} from '../proof/game-reference/fight-list-append.mjs';
import {loadSampleData} from '../src/task/native-audio-compose.mjs';
import {sendApuCommand} from '../src/task/native-input-apu.mjs';

// NativeAC/8521: pinned own code with stack proof, and the equations of proof/game-reference/fight-list-append.mjs and
// of EF47/F25A/F1FA (src/task/native-audio-compose.mjs) against the original instructions
// (tools/w65c816-reference.mjs). F007 and F130 run their modules on both sides with the real frames.
const file=readFileSync(new URL('../Shadowrun (E).smc',import.meta.url));
const {bytes}=inspectRom(file),rom=new Uint8Array(bytes);
const {map}=decodeTaskWindows(bytes,native8521Spec.windows);
const audioWindows=[
 {start:0x81EF47,hex:'8DDE1C225AF281A90D00A220202207F081A90200A27F7F2207F0816B'},
 {start:0x81F25A,hex:'08C210E22048A904A200002207F08168F02120FAF1C22029FF004849FFFF186900812230F18168090001AAE220A9042207F081286B'},
 {start:0x81F1FA,hex:'8DE51C08A00000C220B78CA8E220B78CF018C8CDE51CD00FA980EBB78CC2205A2230F1817AE220C880E228ADE51C60',initialM:1},
];
const audio=decodeTaskWindows(bytes,audioWindows).map,reference=new Map([...map,...audio]);

test('8521 pinned own code: RTS graph with the external EF47 return, bound as special native',()=>{
 const proof=prove8521Source(map);
 assert.equal(proof.reachable_instructions,25);assert.equal(proof.maximum_local_stack_bytes,0);
 assert.deepEqual(proof.external_returns,['81:EF47']);
 assert.ok(SPECIAL_NATIVES.has(0x808521));
});

const STACK=0x1EF0,LIST=0x7F4000,SCENARIOS=2000;
function prng(seed){let t=seed>>>0;return ()=>{t=(t+0x6D2B79F5)>>>0;let r=Math.imul(t^(t>>>15),1|t);r^=r+Math.imul(r^(r>>>7),61|r);return ((r^(r>>>14))>>>0)/4294967296;};}
function scenario(seed){
 const r=prng(seed),int=n=>Math.floor(r()*n),pick=list=>list[int(list.length)],wram=new Uint8Array(0x20000);
 const put=(address,v)=>{const o=address>=0x7E0000?address-0x7E0000:address;wram[o]=v&255;wram[o+1]=(v>>>8)&255;};
 put(0x1FB0,pick([0xFFFE,0xFFFE,0xFFFE,0,2,0x10]));put(0,int(0x10000));put(0x7E3C11,int(0x10000));
 put(0x1FD6,int(0x10000));put(0x1CDE,pick([6,6,0x0600,4,0x0100,int(0x10000)]));wram[0x1CE4]=int(256);
 // F1FA list behind DP8C: WORD header = index of BYTE pairs (mode, song), zero ends; F130 finds FF
 // at directory offset 5 and returns without loading.
 put(0x8C,LIST&0xFFFF);wram[0x8E]=LIST>>>16;const base=LIST-0x7E0000,start=8+int(8);
 put(base,start);wram[base+5]=0xFF;const pairs=int(5);
 for(let n=0;n<pairs;n++){wram[base+start+2*n]=pick([6,6,1+int(255)]);wram[base+start+2*n+1]=int(256);}
 wram[base+start+2*pairs]=0;
 return {wram,status:int(256)&0xC3};
}
// APU port 2140 answers with the token the caller waits for (low A at the poll), on both sides.
function devices(acc){
 const original=acc.absoluteRead;
 acc.absoluteRead=(offset,width,pc,label)=>{
  if(offset!==0x2140)return original(offset,width,pc,label);
  const value=acc.ctx.a&255;acc.trace.push({kind:'read',pc,address:0x802140,width,value});return value;
 };
 const write=acc.absoluteWrite;
 acc.absoluteWrite=(offset,value,width,pc,label)=>{
  if(offset>=0x2140&&offset<=0x2143){acc.trace.push({kind:'write',pc,address:0x800000+offset,width,value});return;}
  return write(offset,value,width,pc,label);
 };
}
function setup(s){
 const mem=new VmMemory(rom,s.wram.slice());
 const vm={mem,a:0x1234,x:0x5678,y:0x9ABC,s:STACK,d:0,dbr:0x80,p:s.status,pc:0xF4F6};
 mem.write8(vm.s,0xF5);vm.s=(vm.s-1)&0xFFFF;mem.write8(vm.s,0x08);vm.s=(vm.s-1)&0xFFFF; // Native58 return word F508
 const acc=new TaskAccessor(vm);acc.load();acc.trace=[];devices(acc);
 return {mem,acc};
}
const bytesOf=trace=>trace.flatMap(e=>(e.width??1)===2?[{kind:e.kind,pc:e.pc,address:e.address,value:e.value&255},{kind:e.kind,pc:e.pc,address:e.address+1,value:e.value>>>8}]
 :[{kind:e.kind,pc:e.pc,address:e.address,value:e.value&255}]);
function compare(s){
 const native=setup(s);appendToFightList(native.acc,true);
 const ref=setup(s),ctx=ref.acc.ctx,a=ref.acc;
 const run=runReference(reference,ref.mem,ctx,{entry:0x808521,root:'RTS',io:a.trace,calls:new Map([
  [0x81F007,()=>sendApuCommand(a,false)],[0x81F130,()=>loadSampleData(a,{calls:[]},false)]])});
 for(const k of ['a','x','y','s','status','pc','programBank','bank','d'])assert.equal(native.acc.ctx[k],ctx[k],`${k} seed ${s.seed}`);
 assert.deepEqual(bytesOf(native.acc.trace),bytesOf(a.trace),`io seed ${s.seed}`);
 assert.ok(Buffer.from(native.mem.wram).equals(Buffer.from(ref.mem.wram)),`wram seed ${s.seed}`);
 return {visited:run.visited,music:native.acc.trace.length>0};
}

test('8521 and EF47/F25A/F1FA equations match the original instructions on every own instruction',()=>{
 const covered=new Set();let music=0;
 for(let seed=1;seed<=SCENARIOS;seed++){const c=compare({...scenario(seed),seed});for(const pc of c.visited)covered.add(pc);music+=c.music;}
 assert.deepEqual([...reference.keys()].filter(pc=>!covered.has(pc)).map(pc=>pc.toString(16)),[]);
 assert.ok(music>100&&music<SCENARIOS-100,String(music));
});
