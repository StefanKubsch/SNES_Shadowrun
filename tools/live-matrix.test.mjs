import test from 'node:test';
import assert from 'node:assert/strict';
import {cartridge} from './cartridge-harness.mjs';
import {loadSave} from './mesen-f390-oracle.mjs';
import {findMesen} from './mesen.mjs';
import {explore} from './mesen-explore.mjs';
import {exploreLive} from './explore-live.mjs';
import {APARTMENT,PLAN} from './live-matrix-plan.mjs';

// Matrix combat live, from the apartment save game. The entry writes are those
// of native 7D (80:E30F) in the cyberdeck path of the jack-in script $2E8 (script
// word $16 set, the decker in script word $0C): system 10, level 3, Jake's
// Computer byte 7E:3C04 as the decker's skill 1D8C and his health (state record
// byte 2) as the matrix health 1754. The script returns to entry 484 for this
// system, where guards shoot Jake after he jacks out (the original too); the
// test returns to the apartment entry 345 he jacked in from instead. Up moves the
// persona on the path to the IC group, B runs COMBAT.EXE on the node ahead
// (81:C111), A works the node ahead (81:C28C), X jacks out. Four sessions in one run:
//   1. Computer 12: the IC (type 0B) falls, B on the cleared node costs 1 health.
//   2. Computer 0: every combat fails and the IC strikes back (81:B1B5).
//   3. System 1, level 1: right, down and left along the paths to the data node
//      18 at (12, 11); A downloads it (175A bit 0, 1 memory in 1750, the node
//      becomes 42), a second A does nothing.
//   4. System 2, level 1: right runs to the CPU node 20; A costs 10 memory, B
//      opens its two gates 3F above and below into paths 02 (81:B609).
//   5. System 3, level 2 with argument 1D8E = 2 (the extra node 17): B on the
//      CPU node 21 does nothing, A costs 10 memory; along the paths around the
//      IC to node 17 at (29, 10): A downloads it (8 memory, 1758 bit 7, the node
//      becomes 40), B on it makes 41 and clears the IC around it (81:B71F).
//   6. The datajack path of $2E8 (Jake without a cyberdeck): native 7D gets
//      system 2 and level 0, 81:C3CA shows "DATAJACK MALFUNCTION" and returns
//      without the matrix loop; the health stays.
//   7. Computer 0 again: the IC's strike takes the last health, the matrix
//      ends by itself and the game returns to the menu owner (Game Over).
// Directions turn the persona to an absolute heading (141C 0 up, 4 right, 8 down,
// 12 left) and then move it; on paths (01, 02) it runs on to the next node.
// The random 80:C560 mixes the H/V counter bytes 213C/213D, which the lag-free
// port replaces with xorshift32 (counterBytes, src/vm/frame-events.mjs). At each
// matrix start both sides set its other inputs (last result 1CE8, frame counter
// 1C76) and switch to the same counter sequence; Mesen returns the bytes from its
// read callback (tools/mesen/explore.lua "counter"). Then every 4th frame of the
// original equals the native frame with the same distance from that point.
const word=(w,a)=>w[a]|w[a+1]<<8;

// The plan natively (tools/explore-live.mjs): the state record and health at
// each matrix entry, and the state after each jack-out (the end of its wait 300).
function nativeRun(plan){
  const sessions=[],outs=[];let record=0;
  const r=exploreLive(plan,{cartridge,sram:loadSave('apartment'),onCommand:(index,c,game)=>{const w=game.memory.wram;
    if(c[0]==='matrix'){record=word(w,0x1D93);sessions.push({record,health:w[record+2]});}
    if(c[0]==='wait'&&c[1]===300)outs.push({health:w[record+2],room:word(w,0x2DE2),free:game.nmis-game.controlNmi<=1});}});
  return {...r,sessions,outs,record};
}
let native=null;
const run=()=>native??=nativeRun(PLAN);
const inMatrix=values=>values[11]>>8===0xFE;
// Session k of the samples: from its counter switch to the next one.
const sessionSamples=(r,n)=>r.samples.filter(([k])=>k>=r.syncs[n]&&(n+1>=r.syncs.length||k<r.syncs[n+1]))
  .map(([k,v])=>[k-r.syncs[n],v]);
const changes=(list,column)=>list.filter(([,v],i)=>i===0||v[column]!==list[i-1][1][column]).map(([t,v])=>[t,v[column]]);

test('matrix combat, nodes and death: COMBAT.EXE wins and fails, A and B work data and CPU nodes, X jacks out, zero health ends the game',{timeout:900000},()=>{
  // Up to "JACKED OUT" (81:C4D6 sets 1524 to 8000); the rooms use 1754 otherwise.
  const persona=list=>{const from=list.findIndex(([,v])=>v[9]!==0x8000);
    return list.slice(from,list.findIndex(([,v],i)=>i>from&&v[9]===0x8000));};
  const r=run(),[first,second,third,cpu,node17,,last]=[0,1,2,3,4,5,6].map(n=>persona(sessionSamples(r,n)));
  assert.deepEqual(r.sessions.map(s=>s.health),[30,29,5,5,5,5,5],'each session starts with the health the last one wrote back');
  // Session 1: the IC type 0B ahead falls at the first B (1744 = 0B, its node
  // becomes 07); B on the cleared node costs 1 health (B1B5 with A = 1).
  assert.deepEqual(changes(first,5).map(([,v])=>v),[0,0x0B]);
  assert.deepEqual(changes(first,0).map(([,v])=>v),[30,29]);
  // Session 2: every combat fails and the IC strikes back for 19 and 5.
  assert.deepEqual(changes(second,0).map(([,v])=>v),[29,10,5]);
  // Jacked out: the health is back in Jake's record, the apartment is loaded
  // again and Jake moves freely (player control 80:E014 in the last picture).
  for(const n of [0,1,2,3,4,5]){const out=r.outs[n];
    assert.deepEqual([out.health,out.room,out.free],[[29,5,5,5,5,5][n],APARTMENT,true],'after session '+(n+1));}
  // Session 3: one download, its memory and flag stay; no health is lost.
  assert.deepEqual(changes(third,13).map(([,v])=>v&0x3FF),[0x18,0x42]);
  assert.deepEqual([changes(third,1).map(([,v])=>v),changes(third,8).map(([,v])=>v),changes(third,0).map(([,v])=>v)],[[0,1],[0,1],[5]]);
  // Session 4: A on the CPU node 20 costs 10 memory, B opens the gate.
  assert.deepEqual([changes(cpu,1).map(([,v])=>v),changes(cpu,14).map(([,v])=>v&0x3FF)],[[0,10],[0x3F,0x02]]);
  // Session 5: 10 memory at node 21, 8 more and bit 7 at node 17, which turns 40 and then 41.
  assert.deepEqual([changes(node17,1).map(([,v])=>v),changes(node17,7).map(([,v])=>v),changes(node17,15).map(([,v])=>v&0x3FF)],
    [[0,10,18],[0,0x80,0x685],[0x17,0x40,0x41]]);
  assert.deepEqual(changes(node17,0).map(([,v])=>v),[5],'no health lost on the way around the IC');
  // Session 6 never reaches the grid: no persona position (1524 stays 8000).
  assert.ok(sessionSamples(r,5).every(([,v])=>v[9]===0x8000||!inMatrix(v)),'no matrix grid on the datajack path');
  // Session 7: the strike takes the last 5 health; the record gets 0 and the
  // main loop returns to the menu owner.
  assert.deepEqual(changes(last,0).map(([,v])=>v),[5,0]);
  assert.equal(r.game.memory.wram[r.record+2],0);assert.equal(r.game.driver.ownsGame,false,'Game Over: back at the menu owner');
});

const {exe,reason}=findMesen();
test('the original runs the seven matrix sessions frame by frame like the native port',{skip:exe?false:reason,timeout:1200000},async()=>{
  const r=run(),lines=[];
  await explore(exe,PLAN,{start:10,limit:26000,sram:loadSave('apartment'),timeoutMs:1100000,onLine:line=>{
    if(/^(W|CTR) /.test(line))lines.push(line.split(' '));}});
  const syncs=lines.filter(t=>t[0]==='CTR').map(t=>Number(t[1]));
  assert.equal(syncs.length,7,'seven counter switches in the original');
  let compared=0;
  for(const [n,at]of syncs.entries()){
    // The sample of the original lies at the end of its frame, the native one
    // at the pad read in the next NMI, after its 1C76 increment: the native
    // frame counter is one ahead, and a value changing there may show one frame apart.
    const nativeAt=new Map(sessionSamples(r,n).map(([t,v])=>[t,v.map((x,i)=>i===12?x-1&65535:x).join()]));
    for(const t of lines.filter(t=>t[0]==='W'&&Number(t[1])>=at&&(n+1>=syncs.length||Number(t[1])<syncs[n+1]))){
      // With the persona on the grid: after "JACKED OUT" (1524 = 8000) the
      // matrix words are free, and the rooms around the matrix use them as well.
      const values=t.slice(5).map(x=>parseInt(x,16));if(!inMatrix(values)||values[9]===0x8000)continue;
      const d=Number(t[1])-at,key=values.join();
      assert.ok([d,d-1,d+1].some(e=>nativeAt.get(e)===key),`session ${n+1}, frame ${d}: original ${key}, native ${nativeAt.get(d)}`);
      compared++;
    }
  }
  assert.ok(compared>1000,'compared matrix frames: '+compared);
});
