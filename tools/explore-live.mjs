// The command list of tools/mesen/explore.lua on the native live game (test tool only), so that
// one plan runs in Mesen (tools/mesen-explore.mjs) and natively. Frame commands (hold, press, wait,
// walk, exit, glove, aim) run one at a time through livePlanDriver, which has the same rules as
// explore.lua: a command ends in its frame and the next one starts in the frame after. The first
// command, a wait, counts from frame 10 like explore.lua's START. No-frame commands run before the
// frame's command:
//   poke, counter, clock, matrix, watch, readwatch, until (as in explore.lua).
// Mesen applies writes at the joypad auto-read, before the NMI handler increments the frame counter
// 1C76 (80:C112 ff.); the native pad is read at 80:9E13 after that increment, so the native side
// writes 1C76 one higher ("poke" 1C76 and "clock"). With "clock" both sides then count NMIs in
// blocking wait loops, which are the only NMIs of the lag-free port.
// Result: samples [k, words of "watch"] for every pad read after the first "counter", syncs (k of
// each "counter"), reads [k, address, value] in the "readwatch" ranges, ends [k] per command.
import assert from 'node:assert/strict';
import {LiveGame} from '../src/video/live-game.mjs';
import {counterBytes} from '../src/vm/frame-events.mjs';
import {livePlanDriver} from './live-plan-driver.mjs';

const word=(w,a)=>w[a]|w[a+1]<<8;
export function exploreLive(plan,{cartridge,sram,onCommand=()=>{},onGame=()=>{}}){
  const base=counterBytes();let armed=null,index=0,driver=null,watch=[],ranges=[],start=null;
  const samples=[],syncs=[],reads=[],ends=[];
  const game=new LiveGame(cartridge,{sram:new Uint8Array(sram),counter:()=>armed?armed():base(),pad:k=>{
    const w=game.memory.wram,set=(at,value,byte)=>{w[at]=value&255;if(!byte)w[at+1]=value>>8&255;};
    for(;;){const c=plan[index];if(!c)return 0;const [kind]=c;
      if(kind==='poke')set(c[1],c[1]===0x1C76?c[2]+1:c[2],c[3]===1);
      else if(kind==='clock')set(0x1C76,c[1]+1);
      else if(kind==='counter'){armed=counterBytes(c[1]);syncs.push(k);}
      else if(kind==='watch')watch=c.slice(1);
      else if(kind==='readwatch')for(let n=1;n<c.length;n+=2)ranges.push([c[n],c[n+1]]);
      else if(kind==='matrix'){
        // The writes of native 7D (80:E30F) for Jake, as explore.lua "matrix".
        set(0x1CE9,0xFFFE);set(0x2DE2,c[2]);set(0x1D8D,0x40,true);set(0x1D8F,c[1],true);set(0x1D8E,c[3],true);
        set(0x1D90,c[4],true);set(0x1D8C,w[0x3C04],true);const record=word(w,0x13A8+word(w,0xCC2));
        assert.notEqual(record,0,'Jake has a state record');set(0x1D8B,w[record+2],true);set(0x1D93,record);}
      else break;
      onCommand(index,c,game);index++;}
    const c=plan[index],[kind]=c;let input=0,done=false;
    if(index===0&&kind==='wait')done=k+1>=10+c[1];
    else if(kind==='until'){start??=k;assert.ok(k-start<=3000,'until '+c[1].toString(16));done=word(w,c[1])===c[2];}
    else{driver??=livePlanDriver([c],w,()=>game.driver.roundsCompleted);input=driver.pad(k);done=driver.done();}
    if(syncs.length)samples.push([k,watch.map(a=>word(w,a))]);
    if(done){ends[index]=k;onCommand(index,c,game);index++;driver=null;start=null;}
    return input;}});
  onGame(game);
  const read8=game.memory.read8.bind(game.memory);
  game.memory.read8=address=>{const value=read8(address);
    if(ranges.some(([from,to])=>address>=from&&address<=to))reads.push([game.nmis,address,value]);return value;};
  while(plan[index])game.step();
  return {game,samples,syncs,reads,ends};
}
