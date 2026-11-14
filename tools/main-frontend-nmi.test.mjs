import {withFrontendReference} from '../proof/frontend-reference/frontend.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {frontendSpecs} from './main-frontend-source.mjs';
import {decodeWindows,compareDialog,prng} from './task-native-dialog-harness.mjs';
import {FRONTEND_NMI_ROUTINES as FRONTEND_NMI_ROUTINES_TASK} from '../src/task/main-frontend-nmi.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';
const FRONTEND_NMI_ROUTINES=withFrontendReference(FRONTEND_NMI_ROUTINES_TASK);

for(const entry of [0x81DD54,0x81D93E,0x81DCAC])test(entry.toString(16)+': title callback equations match original commands including both index widths',()=>{
  const s=frontendSpecs.find(s=>s.entry===entry),map=decodeWindows(s.windows),visited=new Set();
  for(let seed=0;seed<24;seed++){const random=prng(seed),wram=Uint8Array.from({length:0x20000},()=>Math.floor(random()*256));
    const word=(at,v)=>{wram[at]=v&255;wram[at+1]=v>>>8;};
    for(let at=0x113E;at<0x115E;at+=2)word(at,0xFFFF);for(const at of [0x119E,0x11A0])word(at,0);word(0x11A2,0xFFFF);
    word(0x1A,seed%2?0xFFFF:0);word(0x1C,[0,0xFFFF,0x3FF,0xB0][seed%4]);word(0x18,seed%6*6);
    word(0x1E,[0,0xFF,0x100,0x1FF,0x200,0x300,0x400,0x401,0x3E8,0x600,0x1000,0x4000][seed%12]);
    const f={entry,wram,a:seed*931&65535,x:0x3210,y:0x4567,dbr:0,p:seed&0xC7,io:[],waits:[],inputs:[]};
    // Isolate the callback's own equations. The already proved D9D5 body
    // runs on both sides with its real frame; its external helpers return.
    const r=new Map(FRONTEND_NMI_ROUTINES);
    for(const target of [0x81ED8B,0x81EDD7,0x81E83A,0x81EE0C,0x81E900,0x81E971,0x80F290])r.set(target,h=>h.rtl());
    const result=compareDialog(map,f,{root:'RTL',native:(h,e)=>r.get(entry)(h,e,r),calls:(a,e)=>new Map([...r].filter(([target])=>!map.has(target)).map(([target,run])=>[target,()=>{
      const v=run(dialogAccess(a),e,r);return {rawReturnWord:v?.rawReturnWord??v};
    }]))});
    assert.deepEqual(result.differences,[],s.name+' seed '+seed);for(const pc of result.visited)visited.add(pc);
  }
  const own=[...map.keys()].filter(pc=>entry!==0x81D93E||pc<0x81D9D5);
  assert.deepEqual(own.filter(pc=>!visited.has(pc)).map(pc=>pc.toString(16)),[],s.name+' uncovered own instructions');
});
