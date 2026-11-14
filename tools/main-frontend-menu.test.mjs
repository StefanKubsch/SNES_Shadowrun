import {withFrontendReference} from '../proof/frontend-reference/frontend.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {frontendSpecs} from './main-frontend-source.mjs';
import {decodeWindows,compareDialog,prng} from './task-native-dialog-harness.mjs';
import {FRONTEND_MENU_ROUTINES as FRONTEND_MENU_ROUTINES_TASK} from '../src/task/main-frontend-menu.mjs';
import {FRONTEND_ROUTINES as FRONTEND_ROUTINES_TASK} from '../src/task/main-frontend.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';
import {SRAM_SIZE} from '../src/vm/memory.mjs';
import {runMainOwnerStart} from '../src/task/main-frontend.mjs';
import {playAttractGame} from '../proof/frontend-reference/title-cycle.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {DialogTestMemory,rom} from './task-native-dialog-harness.mjs';
import {runReference} from './w65c816-reference.mjs';
const FRONTEND_ROUTINES=withFrontendReference(FRONTEND_ROUTINES_TASK);
const FRONTEND_MENU_ROUTINES=withFrontendReference(FRONTEND_MENU_ROUTINES_TASK);

const textEntries=new Set([0x81D531,0x81D555,0x81D59E,0x81D5F4,0x81EF36,0x81E32F,0x81E343,0x81E354,0x81E371,
  0x81E38D,0x81E3DA,0x81E446,0x81E50C,0x81E57E,0x81E5DB,0x81E623,0x81E684,0x81E699,0x81E6AE,0x81E788,0x81D5D0,0x81D5E4,0x81D5EC]);
// The title NMI callbacks of the reference table are proved in main-frontend-nmi.test.mjs.
const nmiEntries=new Set([0x81DD54,0x81D93E,0x81DCAC,0x81DAD6,0x81D9D5]);
// The attract demo 96F3 and its rounds 9699 need a main round owner and the outer
// owner A139 never returns; their own tests are below.
const specs=frontendSpecs.filter(s=>FRONTEND_MENU_ROUTINES.has(s.entry)&&!textEntries.has(s.entry)&&!nmiEntries.has(s.entry)&&![0x8096F3,0x809699,0x80A139].includes(s.entry));
function fixture(s,seed){const random=prng(seed),wram=Uint8Array.from({length:0x20000},()=>Math.floor(random()*256)),
  sram=Uint8Array.from({length:SRAM_SIZE},()=>Math.floor(random()*256));
  const word=(at,value)=>{wram[at]=value&255;wram[at+1]=value>>>8;};
  for(const at of [0x0E,0x18,0x1E,0x1A,0x11A4,0x11A6,0x11A8,0x11AA,0x1CA,0x1CE])word(at,0);word(0x1C,seed%3+1);
  if(s.entry===0x81DE93){wram.fill(0,0x62A8,0x62D0);if(seed%2)wram.set([0x41,0x42,0x43,0],0x62A8);word(0x1E,seed*16);}
  if(s.entry===0x81E29F){word(0x0E,seed%3);word(0x1C,seed%4?20:1);if(seed>=8)word(0x11A6,0x400);}
  if(s.entry===0x81E14A&&seed===4)sram[0x1FFE]=0;
  return {entry:s.entry,wram,sram,a:seed%2,x:s.entry===0x81D8E5?seed%24:3,y:0,dbr:s.entry===0x81DE93?0x7E:s.entry>>>16,p:seed&0xC7,io:[],waits:[],inputs:[]};
}
// Synthetic, independent callee replies isolate each root's own equations.
// Connected tests separately exercise original modules and observed NMIs.
function synthetic(s,seed){const r=new Map(FRONTEND_ROUTINES);let inputs=0,choices=0,menus=0;
  const map=decodeWindows(s.windows),calls=[...map.values()].filter(i=>['JSR','JSL'].includes(i.mnemonic)&&!map.has(i.target));
  for(const i of calls)r.set(i.target,(h)=>{const {ctx}=h,ret=h.a.stackWord(),pc=(ret-(i.mnemonic==='JSL'?3:2))&65535;
    if(i.target===0x81EEBB){
      if(pc===0xD6EC)h.dpWrite(0x1E,0x401,2);
      if(pc===0xD73F)h.dpWrite(0x1E,h.dp(0x1E,2)+0x200,2);
      if(pc===0xD766)h.dpWrite(0x1E,0xDAC,2);
      if(pc===0xD7C6)h.dpWrite(0x1E,h.dp(0x1E,2)+0x1000,2);
    }
    if(i.target===0x81DDDB){h.index('x',seed===1?1:0);h.load(0);}
    if(i.target===0x80F298){inputs++;h.write(h.abs(0x1CA),s.entry===0x81D694?(seed>1&&inputs>=([0,0,1,52,53,54,55,56,57,58,59,60][seed]??999)?0x8000:0):seed%2?0x8000:0,2);
      if(s.entry===0x81E29F)h.write(h.abs(0x1CE),inputs>1?0x9000:[0,0x800,0x2400,0x2C00][seed%4],2);
    }
    if(i.target===0x81E29F){const plans=[[0],[1,0],[1,1],[1,2,0],[2,0,1,2,3,0],[0xFFFF],[2,0xFFFF],[1,0xFFFF],[3,0]],plan=plans[seed%plans.length];
      h.dpWrite(0x0E,plan[Math.min(choices++,plan.length-1)],2);}
    if(i.target===0x81D694)h.load(seed%3?0:1);
    if(i.target===0x81E343)h.dpWrite(0x0E,ctx.a,2);
    if(i.target===0x81E14A){const plans=[[0xFFFF],[0],[1],[0xFFFE,0xFFFF],[0xFFFE,0xFFFE,0xFFFF]],plan=plans[seed%plans.length];h.load(plan[Math.min(menus++,plan.length-1)]);ctx.bank=0x81;}
    if([0x81D60F,0x81D87C,0x81DDB1,0x81E38D,0x81E3DA,0x81E446,0x81E50C].includes(i.target))ctx.bank=0x81;
    if(i.target===0x81EF63||i.target===0x8096F3)ctx.bank=0x80;
    return i.mnemonic==='JSL'?h.rtl():h.rts();
  });return r;
}
function external(a,e,r,map){return new Map([...r].filter(([target])=>!map.has(target)).map(([target,run])=>[target,()=>{
  const v=run(dialogAccess(a),e,r);return {rawReturnWord:v?.rawReturnWord??v};
}]));}
for(const s of specs)test(s.name+': own menu equations match all original paths under explicit callee replies',()=>{
  const map=decodeWindows(s.windows),visited=new Set();
  for(let seed=0;seed<16;seed++){const f=fixture(s,seed);
    if(s.entry===0x81D694){f.io=[0xD6BA,0xD782,0xD79E,0xD7B7,0xD7F7].map(pc=>({pc:0x810000|pc,address:0x812142,width:1,value:0}));
      // Only the uninterrupted title case reaches all polls and the PPU status
      // read; early exits use the consumed prefix, never fake unused replies.
      if(seed===1)f.io=[];else if(seed>1&&seed<8)f.io=f.io.slice(0,1);else if(seed>=8&&seed<12)f.io=f.io.slice(0,4);
      if(seed===0||seed>=12){f.io.splice(4,0,...[0,0x1000,0].map(value=>({pc:0x81D7DA,address:0x81213E,width:2,value})));}
    }
    if(s.entry===0x81E14A)f.io=[{pc:0x81E1B6,address:0x812142,width:1,value:2}];
    const nr=synthetic(s,seed),rr=synthetic(s,seed),result=compareDialog(map,f,{root:s.rootReturn,
      native:(h,e)=>FRONTEND_MENU_ROUTINES.get(s.entry)(h,e,nr),calls:(a,e)=>external(a,e,rr,map)});
    assert.deepEqual(result.differences,[],s.name+' seed '+seed);for(const pc of result.visited)visited.add(pc);
  }
  // Coverage is reported for the own graph, never inferred from a callee stub.
  assert.deepEqual([...map.keys()].filter(pc=>!visited.has(pc)).map(pc=>pc.toString(16)),[],s.name+' uncovered own instructions');
});

test('outer owner prefix matches the original endless owner through its actual JSR A154 with a fresh choice and SRAM word',()=>{
  const s=frontendSpecs.find(s=>s.entry===0x80A139),map=decodeWindows(s.windows),stop=Symbol('game entry');
  function side(pc){const mem=new DialogTestMemory(new Uint8Array(0x20000),new Uint8Array(SRAM_SIZE),rom),
    a=new TaskAccessor({mem,a:0x7654,x:0,y:0,s:0x1EF0,d:0,dbr:0x80,p:0x43,pc});a.load();mem.write16(0x701FFE,0xAB03);return {mem,a,h:dialogAccess(a)};}
  for(const pc of [0xA139,0xA157]){const n=side(pc),r=side(pc),calls=()=>{const rs=new Map(FRONTEND_ROUTINES);
      rs.set(0x80A18C,h=>{assert.equal(h.ctx.a,pc===0xA139?0x7654:0);assert.equal(h.read(h.abs(0x1FD6)),3);h.load(1);return h.rts();});rs.set(0x81EF63,h=>h.rtl());return rs;};
    const nr=calls(),rr=calls();runMainOwnerStart(n.a,null,nr);
    const targets=external(r.a,null,rr,new Map());targets.set(0x809688,()=>{r.a.ctx.pc=0x9688;throw stop;});
    assert.throws(()=>runReference(map,r.mem,r.a.ctx,{entry:0x800000|pc,root:'RTS',calls:targets}),e=>e===stop);
    assert.deepEqual(n.a.ctx,r.a.ctx);assert.deepEqual(n.mem.wram,r.mem.wram);assert.equal(n.mem.read16(0),1);assert.equal(n.mem.read16(0x1FD6),0xAB03);assert.equal(n.mem.read16(0x1EEF),0xA156);
  }
});
test('96F3 attract game owns the shared scene AB and both actual main RTS before its RTL',()=>{
  const s=frontendSpecs.find(s=>s.entry===0x8096F3),map=decodeWindows(s.windows);
  for(const offset of [0x1FDA,0x1FD8]){const f=fixture(s,0),make=(h,e)=>{const rs=new Map(FRONTEND_ROUTINES);
      for(const i of map.values())if(['JSR','JSL'].includes(i.mnemonic)&&![0x80C1E3,0x80E24E,0x80960D].includes(i.target)&&!map.has(i.target))rs.set(i.target,h=>{
        if(i.target===0x80A4BF)assert.equal(h.ctx.a,0xAB);h.ctx.status&=~1;return i.mnemonic==='JSL'?h.rtl():h.rts();});
      const round=()=>{assert.equal(h.a.stackWord(),0x96C2);assert.equal(h.a.stackWord(3),0x96FE);h.write(h.abs(offset),1,2);return h.rts();};
      e.round=round;rs.set(0x80C1E3,round);return rs;};
    f.dbr=0x80;const result=compareDialog(map,f,{root:'RTL',native:(h,e)=>playAttractGame(h,e,make(h,e)),calls:(a,e)=>external(a,e,make(dialogAccess(a),e),map)});
    assert.deepEqual(result.differences,[]);assert.ok(result.visited.has(offset===0x1FDA?0x8096EC:0x8096F2));assert.ok(result.visited.has(0x8096FF));
  }
});
