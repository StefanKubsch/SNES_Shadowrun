import test from 'node:test';import assert from 'node:assert/strict';
import {rom,decodeWindows,compareDialog,prng} from './task-native-dialog-harness.mjs';
import {nativeF254Spec,proveF254Source} from './task-native-f254-source.mjs';
import {openWeaponMenu,WEAPON_MENU_ROUTINES} from '../src/task/native-member-spell-menu.mjs';
import {SPECIAL_NATIVES} from '../src/vm/special-natives.mjs';

// Native01/F254 (weapon menu E693 with E4B3, E433, E41F, E48D, 81:A954, E9C5, E9A8) against the original
// instructions. Every external routine has its own proof and runs as the same stub with its real frame on
// both sides; the stubs of F963 (window), A6C7 (choice) and C1CA (nested round) write the scenario values.
// Only a round can reach E9C5 (1F68 = 0) and E4B3 (1F58 set) and make the object the leader for E9C5.
const map=decodeWindows(nativeF254Spec.windows);
const romOffset=address=>((address>>>16)&0x1F)<<15|(address&0x7FFF);
const romWord=address=>rom[romOffset(address)]|rom[romOffset(address+1)]<<8;
const weapons=Array.from({length:13},(_,k)=>romWord(0x809700+2*k));
// Records 94F7+2*1F54 whose long pointer 8D:record (portrait data for 9F6D) reaches ROM or WRAM.
const romByte=address=>rom[romOffset(address)];
const portraits=Array.from({length:0x60},(_,k)=>k).filter(k=>{const record=0x8D0000|romWord(0x8094F7+2*k),bank=romByte(record+2),pointer=romWord(record);
 return bank>=0x80&&bank<0xA0&&pointer>=0x8000||bank===0x7E||bank===0x7F;});
// Item numbers for E9A8 whose text pointer 8C:EFB0+6*(8D:B022+n) stays in the ROM half of bank 8C.
const items=Array.from({length:0x100},(_,n)=>n).filter(n=>{const t=romWord(0x8DB022+n);return t<0x2000&&0xEFB0+6*t<=0xFFFE;});
const EXTERNAL=nativeF254Spec.externalReturns.map(([target])=>target);

test('F254 pinned own code: 328 instructions, 16 external returns, bound as special native',()=>{
 const proof=proveF254Source(map);
 assert.equal(proof.reachable_instructions,328);assert.equal(proof.external_return_assumptions,16);
 assert.equal(proof.maximum_local_stack_bytes,12);assert.ok(SPECIAL_NATIVES.has(0x80F254));
 assert.deepEqual(EXTERNAL.filter(t=>!WEAPON_MENU_ROUTINES.has(t)),[]);
});

function stub(target,acc,s){
 const {ctx}=acc,raw=acc.pullWord();if(target>>>16===0x81){ctx.programBank=acc.read((ctx.s+1)&0xFFFF);ctx.s=(ctx.s+1)&0xFFFF;}
 ctx.pc=(raw+1)&0xFFFF;const dp=[0,2,4,6,8,0xA].map(o=>acc.readWord(o,16));
 acc.trace.push({kind:'call',pc:target,address:dp[0]|dp[1]<<16,value:(dp.slice(2).reduce((v,w)=>v*31+w,ctx.a)+ctx.x*7+ctx.y)%0x1000000});
 if(target===0x80F963)acc.writeWord(0,s.window,16);
 if(target===0x80A6C7)acc.writeWord(0,s.choice,16);
 if(target===0x80C1CA)for(const [address,value] of s.round)acc.writeWord(address,value,16);
 const a=(dp[0]*5+dp[2]+target)&0xFFFF;ctx.a=a;ctx.status=(ctx.status&~0x83)|(a&0x8000?0x80:0)|(a===0?2:0)|(dp[3]&1);
 return {rawReturnWord:raw};
}
const nativeRoutines=s=>new Map(EXTERNAL.map(t=>[t,h=>stub(t,h.a,s)]));
const referenceCalls=(acc,e,s)=>new Map(EXTERNAL.map(t=>[t,()=>stub(t,acc,s)]));

test('F254 equations match the original instructions on every instruction',()=>{
 const covered=new Set();
 for(let seed=1;seed<=1500;seed++){
  const r=prng(seed*7919+0xF254),int=n=>Math.floor(r()*n),pick=list=>list[int(list.length)],wram=new Uint8Array(0x20000);
  for(let n=0;n<0x20000;n++)wram[n]=int(256);
  const put=(address,v)=>{const o=address>=0x7E0000?address-0x7E0000:address&0xFFFF;wram[o]=v&255;wram[o+1]=(v>>>8)&255;};
  const object=pick([0x10,0x20,0x30,0x56]),weapon=pick(weapons);
  put(0,object);put(0x150A+object,weapon);put(0xCC2,int(3)?object:pick([0x10,0x40]));
  // Weapon 0 points to 7E:3C01: slots with zeros, small entries or none.
  for(let y=6;y<12;y++)wram[0x3C01+y]=pick([0,0,1,2,3,int(8)+1]);
  put(0x1F54,pick(portraits));put(0x1F4C,int(0x10000));put(0x7E3C18,pick([0,0x100,1]));
  for(let x=0;x<8;x+=2)put(0x7E0216+x,pick([0x8000,0xFFFF,int(0x8000)]));
  // Weapon entry 7E3C2E+4*index (index 2k of the weapon): item word, ammunition byte, item word at +3.
  const entry=0x3C2E+4*2*weapons.indexOf(weapon),item=()=>pick([...items.slice(0,8),pick(items),0x8000|int(0x8000)]);
  const first=item(),second=item();
  wram[entry]=first&255;wram[entry+1]=first>>>8;wram[entry+2]=int(256);wram[entry+3]=second&255;wram[entry+4]=second>>>8;
  const count=[6,7,8,9,10,11].filter(y=>(weapon===weapons[0]?wram[0x3C01+y]:0)!==0).length;
  const s={entry:0x80F254,wram,a:int(0x10000),x:int(0x10000),y:int(0x10000),dbr:0x80,p:int(256)&0xC7,
   window:int(0x10000),choice:pick([0,0xFFFF,0x8001,1,1,2,3,1+int(Math.max(count,1))]),
   round:[[0x1D63,pick([0,0,0,1])],[0x1F58,pick([0,1])],...(int(4)?[]:[[0x1F68,0]]),...(int(2)?[]:[[0xCC2,object]])]};
  const result=compareDialog(map,s,{native:(h,e,s)=>openWeaponMenu(h.a,e,true,nativeRoutines(s)),calls:referenceCalls});
  assert.deepEqual(result.differences,[],`seed ${seed}`);
  for(const pc of result.visited)covered.add(pc);
 }
 assert.deepEqual([...map.keys()].filter(pc=>!covered.has(pc)).map(pc=>pc.toString(16)),[]);
});
