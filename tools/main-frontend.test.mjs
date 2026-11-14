import test from 'node:test';
import assert from 'node:assert/strict';
import {frontendSpecs,frontendDataWindows,proveFrontend} from './main-frontend-source.mjs';
import {decodeWindows,compareDialog,prng,rom,window} from './task-native-dialog-harness.mjs';
// The start menu texts are lifted (src/frontend); their register-level reference is proved here.
import {START_MENU_TEXT_REFERENCE as FRONTEND_TEXT_ROUTINES} from '../proof/frontend-reference/start-menu-text.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
import {decodeTaskWindows} from './task-partial-source.mjs';
import {SRAM_SIZE} from '../src/vm/memory.mjs';

const maps=new Map(frontendSpecs.map(s=>[s.entry,decodeWindows(s.windows)]));
test('frontend sources retain complete pinned paths, stack protection and path-specific mode/bank returns',()=>{
  for(const s of frontendSpecs){const map=maps.get(s.entry),p=proveFrontend(map,s);
    assert.equal(p.reachable_instructions,s.instructions,s.name);assert.equal(map.size,s.instructions,s.name);
    assert.equal(p.minimum_protected_stack_bytes,s.stackBytes,s.name);assert.deepEqual(p.returns,s.returns,s.name);
    assert.deepEqual(p.external_returns??[],s.externalReturns,s.name);
  }
  assert.deepEqual(frontendSpecs.find(s=>s.entry===0x81E6AE).returns.map(r=>r.x).sort(),[0,1]);
  for(const w of frontendDataWindows)assert.equal(window(w.start,w.start+w.hex.length/2).hex,w.hex);
});
test('proof preserves BRL control flow and rejects unproved widths or invalid bank/control lemmas',()=>{
  const bytes=rom.slice();bytes.set([0x82,1,0,0x48,0x60],0); // BRL over an unreachable unbalanced PHA.
  const map=decodeTaskWindows(bytes,[{start:0x808000,hex:'8201004860'}]).map;
  const p=proveWordStack(map,0x808000,'RTS');assert.equal(p.reachable_instructions,2);assert.equal(p.returns.length,1);
  const checksum=maps.get(0x81D5D0);
  assert.throws(()=>proveWordStack(checksum,0x81D5D0,'RTS'),/Mode mismatch/);
  assert.throws(()=>proveWordStack(map,0x808000,'RTS',{initialM:2}),/Invalid initial/);
  assert.throws(()=>proveWordStack(map,0x808000,'RTS',{controlWidthJoins:new Set([0x808003])}),/Invalid control/);
  assert.throws(()=>proveWordStack(map,0x808000,'RTS',{externalReturnBanks:new Map([[0x809000,0x81]])}),/Invalid external return bank/);
  const nmi=maps.get(0x81E6AE),externalReturns=new Map([...nmi.values()].filter(i=>['JSR','JSL'].includes(i.mnemonic)).map(i=>[i.target,i.mnemonic==='JSL'?'RTL':'RTS']));
  assert.throws(()=>proveWordStack(nmi,0x81E6AE,'RTL',{externalReturns}),/Mode mismatch 81:E783/);
});
function scenario(s,seed){const random=prng(seed),wram=Uint8Array.from({length:0x20000},()=>Math.floor(random()*256)),
  sram=Uint8Array.from({length:SRAM_SIZE},()=>Math.floor(random()*256));
  const word=(at,value)=>{wram[at]=value&255;wram[at+1]=value>>>8;};
  word(0x0E,seed%4);word(0x18,seed&1?0x400:0);word(0x10,0);word(0x12,0);word(0x1C,0);
  for(const at of [0x113E,0x1140,0x1142,0x1144])word(at,0x17);
  word(0x11A2,[0,1,7,8,0xFFFF][seed%5]);
  return {entry:s.entry,wram,sram,word,a:s.entry===0x81D531?0:s.entry===0x81B1AB?seed%4:seed*997&65535,x:s.entry===0x81E5DB?seed%12:0x200,
    y:s.entry===0x81D531?0xD582:0,dbr:0x81,p:(seed&0xC7)|(s.initialM?0x20:0),io:[],waits:[],inputs:[]};
}
function routines(s){const r=new Map(FRONTEND_TEXT_ROUTINES);
  // Synthetic independent wait/APU replies isolate the own equations. The
  // connected NMI/menu cases use the real helpers and explicit observations.
  r.set(0x81EEBB,h=>h.rtl());r.set(0x81F007,h=>h.rtl());
  if(s.entry===0x81E6AE)r.set(0x81E788,h=>{h.load(0);return h.rts();});return r;
}
const calls=(a,e,r,map)=>new Map([...r].filter(([target])=>!map.has(target)).map(([target,run])=>[target,()=>{
  const result=run(dialogAccess(a),e,r);return {rawReturnWord:result?.rawReturnWord??result};
}]));
for(const s of frontendSpecs.filter(s=>FRONTEND_TEXT_ROUTINES.has(s.entry)))test(s.name+': frontend native equations match original source',()=>{
  const map=maps.get(s.entry);for(let seed=0;seed<12;seed++){const f=scenario(s,seed),r=routines(s);
    if(s.entry===0x81E50C)f.io=[{pc:0x81E510,address:0x812142,width:1,value:3}];
    if(s.entry===0x81E6AE)f.io=[{pc:0x809E0B,address:0x814212,width:2,value:0},{pc:0x809E13,address:0x814218,width:2,value:0x8000}];
    const result=compareDialog(map,f,{root:s.rootReturn,native:(h,e)=>FRONTEND_TEXT_ROUTINES.get(s.entry)(h,e,r),calls:(a,e)=>calls(a,e,r,map)});
    assert.deepEqual(result.differences,[],s.name+' seed '+seed);
  }
});
