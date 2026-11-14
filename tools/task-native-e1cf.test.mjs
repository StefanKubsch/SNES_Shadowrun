import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectRom} from './rom.mjs';
import {decodeTaskWindows} from './task-partial-source.mjs';
import {nativeE1CFSpec,nativeC461Spec,proveE1CFSource,proveC461Source} from './task-native-e1cf-source.mjs';
import {runReference} from './w65c816-reference.mjs';
import {VmMemory} from '../src/vm/memory.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';
import {SPECIAL_NATIVES} from '../src/vm/special-natives.mjs';
import {chooseSpell} from '../src/task/native-spell-choice.mjs';
import {panSongLevelToObjectReference as panSongLevelToObject} from '../proof/apu-reference/sound-stereo.mjs';

// Native8A/E1CF (spell choice) and Native52/C461 (sound command 0D) against the original instructions. F963,
// A6C7, FA3E, C416 and 81:F007 have their own proofs; both sides run the same stubs with the real frames: F963
// returns a window number, A6C7 a scenario choice, each stub records its DP arguments.
const {bytes}=inspectRom(readFileSync(new URL('../Shadowrun (E).smc',import.meta.url))),rom=new Uint8Array(bytes);
const maps={e1cf:decodeTaskWindows(bytes,nativeE1CFSpec.windows).map,c461:decodeTaskWindows(bytes,nativeC461Spec.windows).map};

test('E1CF and C461 pinned own code with external returns, bound as special natives',()=>{
 assert.equal(proveE1CFSource(maps.e1cf).reachable_instructions,56);assert.equal(proveC461Source(maps.c461).reachable_instructions,5);
 assert.throws(()=>proveE1CFSource(maps.e1cf,{...nativeE1CFSpec,pullKinds:[]}),/Stack mismatch 80:E24A/);
 for(const target of [0x80E1CF,0x80C461])assert.ok(SPECIAL_NATIVES.has(target));
});

function prng(seed){let t=seed>>>0;return ()=>{t=(t+0x6D2B79F5)>>>0;let r=Math.imul(t^(t>>>15),1|t);r^=r+Math.imul(r^(r>>>7),61|r);return ((r^(r>>>14))>>>0)/4294967296;};}
const stub=(a,target,long,result)=>{
 const raw=a.pullWord('stub-RTS');if(long){a.ctx.programBank=a.read((a.ctx.s+1)&0xFFFF,'stub-bank');a.ctx.s=(a.ctx.s+1)&0xFFFF;}
 a.ctx.pc=(raw+1)&0xFFFF;
 a.trace.push({kind:'call',pc:target,address:a.ctx.a,value:[0,2,4,6,8,0xA].reduce((v,o)=>v*3+a.readWord(o,16,'s'),0)});
 if(result!==undefined)a.writeWord(0,result,16,'stub-DP00');a.ctx.a=(a.ctx.a*7+target)&0xFFFF;return {rawReturnWord:raw};
};
function setup(s){
 const mem=new VmMemory(rom,s.wram.slice());
 const vm={mem,a:s.a,x:0x5678,y:0x9ABC,s:0x1EF0,d:0,dbr:0x80,p:s.p,pc:0xF4F6};
 mem.write8(vm.s,0xF5);vm.s=(vm.s-1)&0xFFFF;mem.write8(vm.s,0x08);vm.s=(vm.s-1)&0xFFFF;
 const acc=new TaskAccessor(vm);acc.load();acc.trace=[];return {mem,acc};
}
function scenario(seed){
 const r=prng(seed),int=n=>Math.floor(r()*n),wram=new Uint8Array(0x20000);
 const put=(o,v)=>{wram[o]=v&255;wram[o+1]=(v>>>8)&255;};
 const spells=int(5)===0?0:1+int(8);for(let n=0;n<spells;n++)put(0x3C1C+2*n,1+int(0x30));put(0x3C1C+2*spells,0);
 for(let o=0;o<0x10;o++)wram[o]=int(256);
 return {wram,a:int(0x10000),p:int(256)&0xC3,window:int(0x10000),choice:[0xFFFF,0,1,2,1+int(Math.max(spells,1)),int(0x10000)][int(6)]};
}
const compare=(name,entry,s,native,calls)=>{
 const n=setup(s),result=native(n.acc);
 const r=setup(s),run=runReference(maps[name],r.mem,r.acc.ctx,{entry,root:'RTS',io:r.acc.trace,calls:calls(r.acc)});
 for(const k of ['a','x','y','s','status','pc','programBank','bank','d'])assert.equal(n.acc.ctx[k],r.acc.ctx[k],`${name} ${k}`);
 assert.equal(result.rawReturnWord,run.rawReturnWord);assert.deepEqual(n.acc.trace,r.acc.trace,name);
 assert.ok(Buffer.from(n.mem.wram).equals(Buffer.from(r.mem.wram)),name+' wram');return run.visited;
};
test('E1CF and C461 equations match the original instructions on every own instruction',()=>{
 const covered={e1cf:new Set(),c461:new Set()};
 for(let seed=1;seed<=1500;seed++){
  const s=scenario(seed);
  const e1cfStubs=a=>({allocate:()=>stub(a,0x80F963,false,s.window),menu:()=>stub(a,0x80A6C7,false,s.choice),release:()=>stub(a,0x80FA3E,false)});
  for(const pc of compare('e1cf',0x80E1CF,s,a=>chooseSpell(a,null,true,e1cfStubs(a)),
   a=>new Map([[0x80F963,()=>stub(a,0x80F963,false,s.window)],[0x80A6C7,()=>stub(a,0x80A6C7,false,s.choice)],[0x80FA3E,()=>stub(a,0x80FA3E,false)]])))covered.e1cf.add(pc);
  for(const pc of compare('c461',0x80C461,s,a=>panSongLevelToObject(a,true,{pan:()=>stub(a,0x80C416,false),apu:()=>stub(a,0x81F007,true)}),
   a=>new Map([[0x80C416,()=>stub(a,0x80C416,false)],[0x81F007,()=>stub(a,0x81F007,true)]])))covered.c461.add(pc);
 }
 for(const name of ['e1cf','c461'])assert.deepEqual([...maps[name].keys()].filter(pc=>!covered[name].has(pc)).map(pc=>pc.toString(16)),[],name);
});
void dialogAccess;
