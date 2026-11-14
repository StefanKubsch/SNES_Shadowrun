import test from 'node:test';
import assert from 'node:assert/strict';
import {startupSpecs,startupDataWindows,proveStartup} from './main-startup-source.mjs';
import {decodeWindows,compareDialog,prng,window} from './task-native-dialog-harness.mjs';
import {MAIN_STARTUP_ROUTINES} from '../src/task/main-startup.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';
import {SRAM_SIZE} from '../src/vm/memory.mjs';

test('startup pins the original endless owner, logo/notice data, BYTE SPC transfer and actual returns',()=>{
  for(const s of startupSpecs){const map=decodeWindows(s.windows),p=proveStartup(map,s);assert.equal(map.size,s.instructions);assert.equal(p.reachable_instructions,s.instructions);
    assert.equal(p.minimum_protected_stack_bytes,s.stackBytes);assert.deepEqual(p.returns,s.returns);assert.deepEqual(p.external_returns??[],s.externalReturns);}
  for(const w of startupDataWindows)assert.equal(window(w.start,w.start+w.hex.length/2).hex,w.hex);
  for(const start of [0x8A8000,0x89EC26])assert.equal(startupDataWindows.find(w=>w.start===start).hex.slice(0,10),'0239E88100');
});
function fixture(s,seed){const random=prng(seed),wram=Uint8Array.from({length:0x20000},()=>Math.floor(random()*256)),sram=new Uint8Array(SRAM_SIZE);
  return {entry:s.entry,wram,sram,a:0xAB97,x:3,y:0x8000,dbr:seed%2?0x81:0x80,p:(seed&0xC7)|(s.initialM?0x20:0),io:[],waits:[],inputs:[]};}
function external(a,e,r,map){return new Map([...r].filter(([target])=>!map.has(target)).map(([target,run])=>[target,()=>{
  const v=run(dialogAccess(a),e,r);return {rawReturnWord:v?.rawReturnWord??v};
}]));}
for(const s of startupSpecs.filter(s=>s.entry!==0x80A133))test(s.name+': native startup equations match original instructions',()=>{
  const map=decodeWindows(s.windows),visited=new Set();
  for(let seed=0;seed<8;seed++){const f=fixture(s,seed),r=new Map(MAIN_STARTUP_ROUTINES),obs=(pc,port,value)=>f.io.push({pc,address:f.dbr<<16|port,width:1,value});
    if(s.entry===0x81EFA5){f.x=[1,2,257,0][seed%4];if(f.x===0){f.a=0xAB7E;f.y=0;}
      for(const value of [0,0xAA])obs(0x81EFAA,0x2140,value);obs(0x81EFB1,0x2141,0);obs(0x81EFAA,0x2140,0xAA);obs(0x81EFB1,0x2141,0xBB);obs(0x81EFB8,0x2141,0xBB);
      obs(0x81F001,0x2140,0);obs(0x81F001,0x2140,0xCC);
      for(let i=0;i<(f.x||65536);i++){if(f.x)obs(0x81F001,0x2140,(i^255)&255);obs(0x81F001,0x2140,i&255);}
      obs(0x81EFED,0x2141,0);obs(0x81EFED,0x2141,0xCA);
    }else if(s.entry===0x81EFFA){f.y=0x1234;obs(0x81F001,0x2140,0);obs(0x81F001,0x2140,0x34);}
    else if(s.entry===0x81F001){obs(0x81F001,0x2140,0);obs(0x81F001,0x2140,0x97);}
    else for(const i of map.values())if(['JSR','JSL'].includes(i.mnemonic)&&!map.has(i.target))r.set(i.target,h=>{
      if(i.target===0x81D5EC)h.load(seed&1);if(i.target===0x81E7BC)h.ctx.bank=0x81;return i.mnemonic==='JSL'?h.rtl():h.rts();});
    const result=compareDialog(map,f,{root:s.rootReturn,referenceLimit:2_000_000,
      native:(h,e)=>r.get(s.entry)(h,e,r),calls:(a,e)=>external(a,e,r,map)});
    assert.deepEqual(result.differences,[],s.name+' seed '+seed);for(const pc of result.visited)visited.add(pc);
  }assert.deepEqual([...map.keys()].filter(pc=>!visited.has(pc)).map(pc=>pc.toString(16)),[],s.name+' uncovered instructions');
});
