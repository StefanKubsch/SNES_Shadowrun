// A nested scheduler round from a resumable native in live mode: the weapon menu
// (F254/E693, JSR C1CA at 80:E78E) visits the appended script as its own pausable round
// (NativeCalls, NestedRoundContinuation). Compared with the same round run
// synchronously (NativeCalls.round): the same inputs and budgets give the same state.
// The input sequence comes from a fixed random generator; without the round it ended at
// task_f254_visit_open. The step budget of 1024 makes the round pause (with 4096 the
// lifted game NMI leaves enough work for the whole round in one step).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {rom} from './task-native-dialog-harness.mjs';
import {ObservedRoom} from '../proof/video/room-observed.mjs';

const bundle=JSON.parse(gunzipSync(readFileSync('assets/room-observations.json.gz')));
function randomPads(seed,length){
  let state=seed*2654435761>>>0;
  const next=()=>{state^=state<<13;state>>>=0;state^=state>>>17;state^=state<<5;state>>>=0;return state;};
  const buttons=[0x8000,0x4000,0x2000,0x1000,0x0800,0x0400,0x0200,0x0100,0x0080,0x0040,0x0020,0x0010,0,0,0,0x0800,0x0400,0x0200,0x0100];
  const pads=[];
  while(pads.length<length){const pad=buttons[next()%buttons.length],count=1+next()%20;for(let n=0;n<count;n++)pads.push(pad);}
  return pads;
}
// Snapshots at the entry of the NMIs in at: WRAM, PPU memory, picture and APU port 0.
function run(pads,at,sync){
  const room=new ObservedRoom(rom,bundle);room.finish();
  const shots=new Map();
  const frames=room.live({pad:k=>pads[k]??0,onFrame:f=>{if(at.includes(f.nmi))shots.set(f.nmi,{wram:room.memory.wram.slice(),
    vram:room.bus.ppu.vram.slice(),oam:room.bus.ppu.oam.slice(),cgram:room.bus.ppu.cgram.slice(),pixels:f.pixels,apu:room.apu.cpuRead(0)});}});
  const natives=room.vm.natives;if(sync)natives.customRounds=true;
  let nestedPauses=0;
  while(frames.nmis<=Math.max(...at)){room.stepLive({mainBudget:1024,opcodeBudget:1024});if(natives.pending?.nested)nestedPauses++;}
  return {nestedPauses,shots};
}
test('the weapon menu visits its script as a pausable nested round, equal to the synchronous round',()=>{
  // Sequence 2: the menu visits its script in rounds around live NMI 1584.
  const pads=randomPads(2,1650);
  const at=[1580,1588,1600,1650],paused=run(pads,at,false),sync=run(pads,at,true);
  assert.ok(paused.nestedPauses>0,'the nested round paused at least once');
  assert.equal(sync.nestedPauses,0);
  for(const k of at)for(const name of ['wram','vram','oam','cgram','pixels','apu'])
    assert.deepEqual(paused.shots.get(k)[name],sync.shots.get(k)[name],name+' at NMI '+k);
});
