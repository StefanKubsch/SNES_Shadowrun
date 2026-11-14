import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {findMesen} from './mesen.mjs';
import {recordLiveRoom} from './mesen-live-room.mjs';
import {originalLogoPixels} from './capture-boot-logo.mjs';
import {liveGameOver,originalPads,hash,PLAN_END,NATIVE_START,ORIGINAL_START} from './live-game-over-run.mjs';
import {BADGE_BUY_LIVE_PLAN} from './live-plans.mjs';

// Game Over im Livemodus: Jake stirbt in der Gasse (ALLEY_PLAN), die
// Hauptschleife kehrt mit RTS zu A157 zurück und der Menübesitzer A18C läuft
// als Fortsetzung weiter (Musiktakt E1BB/E515 mit lagfreiem NMI). Start im
// Hauptmenü beginnt ein neues Spiel. Ohne Eingabe läuft das Menü ab, der Titel
// D694 wartet bei gesperrtem NMI auf den Soundtreiber (nur Audiozeit) und auf
// EEC2 (außerhalb VBlank); Skyline (H-DMA) und Überblendung (Farbmathematik)
// laufen bis zurück ins Menü.
const {exe,reason}=findMesen();

test('Game Over returns to the menu owner live, and Start begins a new game',{timeout:900000},async t=>{
  const run=liveGameOver({start:NATIVE_START,until:9900});
  assert.equal(run.error,null);assert.ok(run.driver.done(),'whole plan played before '+PLAN_END);
  assert.deepEqual(run.events.map(([kind,nmi])=>[kind,nmi]),[['owner-return',8996],['game',9219]]);
  assert.ok(run.room.driver.roundsCompleted-run.bundle.rounds>run.events[1][2]+300,'new game rounds after Start');
  await t.test('the original shows the same menu and new game pictures, in order',{skip:exe?false:reason,timeout:900000},async()=>{
    const pads=[...run.pads.slice(0,PLAN_END)];
    for(let k=PLAN_END;k<ORIGINAL_START+4;k++)pads[k]=k>=ORIGINAL_START?0x1000:0;
    const shots=[...Array(51)].map((_,n)=>10300+10*n),byHash=new Map();
    for(const [k,h]of run.pictures)(byHash.get(h)??byHash.set(h,[]).get(h)).push(k);
    const original=await recordLiveRoom(exe,pads,run.room.driver.roundsCompleted-run.bundle.rounds+3000,{shots});
    const found=shots.map(k=>[k,byHash.get(hash(originalLogoPixels(original.pictures.get(k))))]).filter(([,list])=>list);
    // Menu with the cursor animation (10340-10430) and the new game from the
    // menu fade to the morgue (10560-10620): every original picture is a
    // native picture, at a native NMI that never runs backwards.
    const required=[...Array(10)].map((_,n)=>10340+10*n).concat([...Array(7)].map((_,n)=>10560+10*n));
    let last=0;const ordered=new Set();
    for(const [k,list]of found){const next=list.find(n=>n>=last);if(next!==undefined){last=next;ordered.add(k);}}
    // At most two required pictures may be Mesen's previous end-of-frame picture.
    assert.ok(required.filter(k=>!ordered.has(k)).length<=2,'required pictures without an ordered twin: '+required.filter(k=>!ordered.has(k)));
    assert.ok(ordered.size>=40,'matched pictures: '+ordered.size);
  });
});

// Title of the original after its menu timeout: skyline with H-DMA and the
// half addition of BG2 (colour math). After the second timeout the attract
// game A168/96F3 runs the demo's main loop with pausable rounds. The original
// lags in the demo too; only a part of its pictures has a native twin.
const TITLE=[...Array(36)].map((_,n)=>13750+50*n),DEMO=[...Array(29)].map((_,n)=>18100+50*n);
test('without input the menu times out to the title and the attract game, with colour math and pausable demo rounds',{timeout:900000},async t=>{
  const run=liveGameOver({until:19000});
  assert.equal(run.error,null);
  assert.deepEqual(run.events.map(([kind])=>kind),['owner-return']);
  assert.ok(run.room.liveFrames.audioSamples>0,'audio time at a sound driver wait without NMI');
  assert.ok(run.widest<200,'no step runs the attract game at once: '+run.widest+' NMIs');
  await t.test('the original title and demo pictures are native pictures, in order',{skip:exe?false:reason,timeout:1700000},async()=>{
    const pads=[...run.pads.slice(0,PLAN_END)];for(let k=PLAN_END;k<19600;k++)pads[k]=0;
    const byHash=new Map();for(const [k,h]of run.pictures)(byHash.get(h)??byHash.set(h,[]).get(h)).push(k);
    // 10600 live rounds (the demo's rounds included) end the original near NMI 19600.
    const original=await recordLiveRoom(exe,pads,10600,{shots:[...TITLE,...DEMO],timeoutMs:1700000});
    let last=0;const found=new Set();
    for(const k of [...TITLE,...DEMO]){const list=byHash.get(hash(originalLogoPixels(original.pictures.get(k))));
      const next=list?.find(n=>n>=last);if(next===undefined)continue;last=next;found.add(k);}
    assert.ok(TITLE.filter(k=>!found.has(k)).length<=2,'title pictures out of order: '+TITLE.filter(k=>!found.has(k)));
    // Mesen's end-of-frame picture is sometimes still the previous one; the
    // demo match varied between 18 and 27 of 29 pictures in repeated runs.
    assert.ok(DEMO.filter(k=>found.has(k)).length>=15,'demo pictures in order: '+DEMO.filter(k=>found.has(k)));
  });
});

// Start saved game after Game Over: the same 8 KiB save memory (Spielstand
// apartment) replaces SRAM at the live start natively and in Mesen (liveSram).
// Down, Start (Start saved game), B (Resume game 1) from the menu at native NMI
// 9166 and original NMI 10400; the game resumes in apartment 6.
test('Start saved game after Game Over resumes the saved game',{timeout:900000},async t=>{
  const sram=readFileSync('tools/mesen/saves/apartment.srm');
  const run=liveGameOver({start:NATIVE_START,until:9800,sram,plan:[['press','down',20],['press','start',80],['press','b',120]]});
  assert.equal(run.error,null);
  assert.deepEqual(run.events.map(([kind])=>kind),['owner-return','game']);
  await t.test('the original shows the same load menu and apartment pictures, in order',{skip:exe?false:reason,timeout:900000},async()=>{
    const pads=[...run.pads.slice(0,PLAN_END)];for(let k=PLAN_END;k<ORIGINAL_START;k++)pads[k]=0;
    for(let k=NATIVE_START;k<run.pads.length;k++)pads[ORIGINAL_START-NATIVE_START+k]=run.pads[k];
    const shots=[...[...Array(24)].map((_,n)=>10400+10*n),11000],byHash=new Map();
    for(const [k,h]of run.pictures)(byHash.get(h)??byHash.set(h,[]).get(h)).push(k);
    const original=await recordLiveRoom(exe,pads,10300,{shots,liveSram:sram});
    let last=0;const found=new Set();
    for(const k of shots){const next=byHash.get(hash(originalLogoPixels(original.pictures.get(k))))?.find(n=>n>=last);
      if(next!==undefined){last=next;found.add(k);}}
    // Transition pictures may lack a twin (two in the reference run); the apartment must match.
    assert.ok(found.has(11000)&&shots.filter(k=>!found.has(k)).length<=4,'pictures without a native twin: '+shots.filter(k=>!found.has(k)));
  });
});

// From the saved game on, a closed live plan (tools/live-plans.mjs) walks by
// position and waits in main loop rounds, so the original's lag frames do not
// shift the way: apartment, the Beretta from the alley (the orc keeps
// shooting), Grim Reaper Club, Iced Tea, Lone Star, the Beretta sold to the
// business man for 200 nuyen, the Lone Star badge bought for 150 and used.
// The original plays the same plan on its own WRAM.
test('from the saved game a closed live plan sells the Beretta and buys the Lone Star badge',{timeout:1700000},async t=>{
  const sram=readFileSync('tools/mesen/saves/apartment.srm');
  const run=liveGameOver({start:NATIVE_START,until:30000,sram,plan:BADGE_BUY_LIVE_PLAN});
  assert.equal(run.error,null);assert.ok(run.after.done(),'whole closed plan played');
  assert.deepEqual(run.events.map(([kind])=>kind),['owner-return','game']);
  const wram=run.room.memory.wram;
  assert.equal(wram[0x3C0D]|wram[0x3C0E]<<8|wram[0x3C0F]<<16,70,'20 + 200 - 150 nuyen');
  await t.test('the original ends every command at the same position, with the same dialog pictures',{skip:exe?false:reason,timeout:1700000},async()=>{
    const original=await recordLiveRoom(exe,originalPads(run),1e6,{liveSram:sram,livePlan:BADGE_BUY_LIVE_PLAN,
      livePlanFrom:ORIGINAL_START,shotEnds:true,timeoutMs:1700000});
    const position=([,slot,x,y])=>[slot,x>>2,y>>2];
    assert.equal(original.ends.length,run.after.ends.length);
    // In the alley the orc's hits (random) may push Jake by a pixel at a
    // command end that is not a walk; every other end is at the same position.
    const alley=[BADGE_BUY_LIVE_PLAN.findIndex(([kind,,x,y])=>kind==='walk'&&x===219&&y===509),
      BADGE_BUY_LIVE_PLAN.findIndex(([kind,,x,y])=>kind==='walk'&&x===207&&y===369)];
    const moved=[...original.ends.keys()].map(i=>[i,position(original.ends[i]),position(run.after.ends[i])])
      .filter(([,a,b])=>a.some((v,n)=>v!==b[n]));
    assert.ok(moved.every(([i,a,b])=>i>alley[0]&&i<alley[1]&&a[0]===b[0]&&Math.abs(a[1]-b[1])<=2&&Math.abs(a[2]-b[2])<=2)&&moved.length<=4,
      'other positions: '+JSON.stringify(moved));
    const same=new Set([...original.ends.keys()].filter(i=>
      run.pictures.get(run.after.ends[i][0]+1)===hash(originalLogoPixels(original.pictures.get(original.ends[i][0]+1)))));
    // The guest's Lone Star dialog and the business man's dialog from the
    // sale ("I'll give ya... 200") to "Impersonating a cop is risky" are
    // pixel-equal at the same command end; at most two may be Mesen's
    // previous end-of-frame picture. Walking pictures differ: passers-by
    // draw other random numbers, and after a scene load the original's
    // NMI-counted timers include its lag frames. The orc's hits are random
    // too, so Jake's health differs from the alley on: the status screen
    // (Body line) and the health box at the top right of the field.
    // The guest's dialog shows from the third command after the second glove
    // on him (Talk), the business man's after the glove of "Give".
    const guest=BADGE_BUY_LIVE_PLAN.findLastIndex(([kind,x,y])=>kind==='glove'&&x===91&&y===107)+5;
    const sale=BADGE_BUY_LIVE_PLAN.findIndex(([kind,x,y])=>kind==='glove'&&x===140&&y===106)+2;
    const dialog=[...Array(12)].map((_,n)=>guest+n).concat([...Array(10)].map((_,n)=>sale+n));
    assert.ok(dialog.filter(i=>!same.has(i)).length<=2,'dialog pictures without a twin: '+dialog.filter(i=>!same.has(i)));
    assert.ok(same.size>=30,'pictures equal at command ends: '+[...same]);  });
});
