import test from 'node:test';import assert from 'node:assert/strict';
import {rom,decodeWindows,compareDialog,prng} from './task-native-dialog-harness.mjs';
import {nativeCE6DSpec,proveCE6DSource} from './task-native-ce6d-source.mjs';
import {openMainMenu,MAIN_MENU_ROUTINES} from '../src/task/native-main-menu.mjs';
import {SPECIAL_NATIVES} from '../src/vm/special-natives.mjs';
import {SRAM_SIZE} from '../src/vm/memory.mjs';

// Native3C/CE6D (main menu with saving and the karma menu) against the original instructions. Every external
// routine has its own proof and runs as the same stub with its real frame on both sides; the stubs of F963
// (window) and A6C7/A6B8 (choices) take the scenario values. Saving copies WRAM to SRAM (compared too).
const map=decodeWindows(nativeCE6DSpec.windows);
const EXTERNAL=nativeCE6DSpec.externalReturns.map(([target])=>target);

test('CE6D pinned own code: 551 instructions, 14 external returns, bound as special native',()=>{
 const proof=proveCE6DSource(map);
 assert.equal(proof.reachable_instructions,551);assert.equal(proof.external_return_assumptions,14);
 assert.equal(proof.maximum_local_stack_bytes,13);assert.ok(SPECIAL_NATIVES.has(0x80CE6D));
 assert.deepEqual(EXTERNAL.filter(t=>!MAIN_MENU_ROUTINES.has(t)),[]);
});

function stub(target,acc,s){
 const {ctx}=acc,raw=acc.pullWord();ctx.pc=(raw+1)&0xFFFF;const dp=[0,2,4,6,8,0xA].map(o=>acc.readWord(o,16));
 acc.trace.push({kind:'call',pc:target,address:dp[0]|dp[1]<<16,value:(dp.slice(2).reduce((v,w)=>v*31+w,ctx.a)+ctx.x*7+ctx.y)%0x1000000});
 if(target===0x80F963)acc.writeWord(0,s.window,16);
 if(target===0x80A6C7)acc.writeWord(0,s.menus.shift()??0,16);
 if(target===0x80A6B8)acc.writeWord(0,s.lists.shift()??0,16);
 const a=(dp[0]*5+dp[2]+target)&0xFFFF;ctx.a=a;ctx.status=(ctx.status&~0x83)|(a&0x8000?0x80:0)|(a===0?2:0)|(dp[3]&1);
 return {rawReturnWord:raw};
}
const side=s=>({...s,menus:[...s.menus],lists:[...s.lists]});
const nativeRoutines=s=>{const c=side(s);return new Map(EXTERNAL.map(t=>[t,h=>stub(t,h.a,c)]));};
const referenceCalls=(acc,e,s)=>{const c=side(s);return new Map(EXTERNAL.map(t=>[t,()=>stub(t,acc,c)]));};

test('CE6D equations match the original instructions on every instruction',()=>{
 const covered=new Set();
 for(let seed=1;seed<=600;seed++){
  const r=prng(seed*7919+0xCE6D),int=n=>Math.floor(r()*n),pick=list=>list[int(list.length)],wram=new Uint8Array(0x20000);
  for(let n=0;n<0x20000;n++)wram[n]=int(256);
  const sram=new Uint8Array(SRAM_SIZE);for(let n=0;n<SRAM_SIZE;n++)sram[n]=int(256);
  const put=(address,v)=>{const o=address>=0x7E0000?address-0x7E0000:address&0xFFFF;wram[o]=v&255;wram[o+1]=(v>>>8)&255;};
  put(0x1D89,pick([0x8000,0xFFFF,1,0]));put(0x7E3C11,int(0x400));
  // Karma values (the list pointers point into 7E:3Bxx) small, some at their limits.
  for(let o=0x3BF0;o<0x3C20;o++)wram[o]=pick([0,1,2,3,5,9,int(16)]);
  // Column 1E2D also holds valid list indices where a choice exceeds the listed rows (stale rows).
  for(let o=2;o<0x20;o+=2)put(0x1E2D+o,2*int(4));
  // Main menu: saves (1) and karma (2); karma: rows 1..3 with list choices, 0 or FFFF ends.
  const menus=[],lists=[];
  for(let n=1+int(3);n>0;n--){const c=pick([1,2,2]);menus.push(c);
   if(c===1){if(int(3))menus.push(pick([0,1,2,3,0x8000]));}
   else{for(let k=int(3);k>0;k--){menus.push(1+int(4));for(let j=int(3);j>0;j--)lists.push(1+int(4));lists.push(pick([0,0xFFFF]));}
    menus.push(pick([0,0xFFFF]));}}
  menus.push(pick([0,0xFFFF]));
  const s={entry:0x80CE6D,wram,sram,a:int(0x10000),x:int(0x10000),y:int(0x10000),dbr:0x80,p:int(256)&0xC7,window:int(0x10000),menus,lists};
  const result=compareDialog(map,s,{native:(h,e,s)=>openMainMenu(h.a,e,true,nativeRoutines(s)),calls:referenceCalls});
  assert.deepEqual(result.differences,[],`seed ${seed}`);
  for(const pc of result.visited)covered.add(pc);
 }
 assert.deepEqual([...map.keys()].filter(pc=>!covered.has(pc)).map(pc=>pc.toString(16)),[]);
});
