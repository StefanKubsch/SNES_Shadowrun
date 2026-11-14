import test from 'node:test';import assert from 'node:assert/strict';
import * as introTask from '../proof/intro-reference/intro-setup.mjs';
import {playIntro} from '../proof/intro-reference/intro-scene.mjs';
// The intro 81:DFE7 is lifted (src/intro); its register-level reference is proved here.
const intro={...introTask,playIntro};
import {playCutscene} from '../proof/cutscene-reference/cutscene-scene.mjs';
import {SCENE_REFERENCE_ROUTINES as MAIN_SCENE_ROUTINES} from '../proof/scene-reference-routines.mjs';
import {subtractSampleLength} from '../src/task/native-audio-compose.mjs';
import {sceneIntroSpecs,proveSceneIntro,sceneIntroTables} from './main-scene-intro-source.mjs';
import {mainSceneSpecs,proveMainScene} from './main-scene-source.mjs';
import {compareDialog,decodeWindows,prng,rom,window} from './task-native-dialog-harness.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
import {cpuToOffset} from './rom.mjs';
const maps=sceneIntroSpecs.map(s=>decodeWindows(s.windows));
const functions=[intro.loadSoundDirectory,intro.unpackIntroList,intro.placeFirstNearObjects,intro.setupIntroScene,intro.setupIntroWindow,
  intro.setupTitleAudio,intro.clearIntroObjects,intro.playNearObjectSound,intro.setupGameAudio,intro.playIntro];
test('intro graphs pin original code, crossed index pulls, real DBR exits and the CDF8 external tail bank',()=>{
  sceneIntroSpecs.forEach((s,i)=>proveSceneIntro(maps[i],s));const c=mainSceneSpecs[0],m=decodeWindows(c.windows);
  for(const w of sceneIntroTables)assert.equal(window(w.start,w.start+w.hex.length/2).hex,w.hex);
  const p=proveMainScene(m,c),exit=proveSceneIntro(maps[9],sceneIntroSpecs[9]).returns[0];
  assert.deepEqual(exit,{at:'81:E129',m:0,x:0,dbr:0x80});assert.equal(p.returns.find(r=>r.at==='81:CDFD').dbr,exit.dbr);
  assert.deepEqual(c.externalTailBanks,[[0x81CDFD,exit.dbr]]);
  assert.equal(maps[9].get(0x81E11D).value,0x8005); // nested CDF8 takes the normal path, never DFE7 again
  assert.throws(()=>proveWordStack(m,c.entry,'RTL',{externalTailBanks:new Map(c.externalTailBanks)}),/Invalid external tail bank lemma/);
  for(const bank of [-1,256,0.5])assert.throws(()=>proveWordStack(m,c.entry,'RTL',{externalTailReturns:new Map(c.externalTailReturns),externalTailBanks:new Map([[0x81CDFD,bank]])}),/Invalid external tail bank lemma/);
});
function sample(entry,seed){const random=prng(seed),rnd=n=>Math.floor(random()*n),wram=new Uint8Array(0x20000);
  for(let i=0;i<wram.length;i++)wram[i]=rnd(256);
  const word=(at,v)=>{wram[at]=v&255;wram[at+1]=v>>>8&255;};
  let x=rnd(65536);if(entry===0x81D83E)x=seed%6*6;
  if(entry===0x81E900){for(let n=0;n<8;n++)word(0x113E+n*2,n===seed%9?0xFFFF:1);}
  return {entry,wram,a:rnd(65536),x,y:rnd(65536),dbr:[0x80,0x81,0,0x7E][seed%4],p:rnd(256)&0xC7,word};
}
// Synthetic directory/streams only. Pinned instruction bytes remain original; data pointers
// are redirected to WRAM to exercise fresh reads, block boundaries and writable aliases.
function audioSample(seed,sections=null){const s=sample(0x81F092,seed);s.a=seed%2?0:3;s.rom=rom.slice();
  s.rom.set([0,0x68,0x7E],cpuToOffset(0x98FFFA+s.a,rom.length));s.wram.set([0,0,0,0x70,0x7E],0x6800);
  sections??=[{repeat:seed%3===0,n:1+seed%13},{repeat:seed%3!==0,n:1+seed%7}];
  const bytes=[],byte=v=>bytes.push(v&255),word=v=>{byte(v);byte(v>>>8);};word(2+sections.reduce((n,b)=>n+b.n*(b.repeat?2:1),0));word(seed*103);
  for(const b of sections){word(b.n|(b.repeat?0x8000:0));if(b.repeat)word(seed*391);else{byte(0);byte(0x74);byte(0x7E);}}
  s.wram.set(bytes,0x7000);for(let n=0;n<64;n++)s.wram[0x7400+n]=(seed+n*17)&255;return s;
}
function routines(h,seed,spec){let waits=0;const map=new Map(spec.externalReturns.map(([target,op])=>[target,()=>{
  h.a.trace.push({kind:'intro-call',pc:target,address:h.ctx.x,value:h.ctx.a+h.ctx.y*65536});
  if(target===0x81F100)return subtractSampleLength(h.a,null,false).rawReturnWord;
  if(target===0x81EEBB){const n=waits++;h.write(h.abs(0x11A2),[0,1,8,63,64,99,100,101,0xFFFF][(seed+n)%9]);
    h.write(h.abs(0x114E),n%2?0xFFFF:0);h.write(h.abs(0x1142),n%2?0:0xFFFF);h.write(h.abs(0x1CA),seed%4&&n>=seed%3?0x9000:0);}
  return op==='RTL'?h.rtl():h.rts();
 }]));
 map.set(0x81D83E,()=>intro.unpackIntroList(h,null,map));map.set(0x81EF63,()=>intro.setupGameAudio(h,null,map));return map;
}
sceneIntroSpecs.forEach((spec,i)=>test(`${spec.name}: every own instruction agrees with the original, including real inner frames`,()=>{
  const covered=new Set();for(let seed=1;seed<=360;seed++){
    const s=i===0?audioSample(seed):sample(spec.entry,seed);
    const result=compareDialog(maps[i],s,{root:spec.rootReturn,native:(h,e)=>functions[i](h,e,routines(h,seed,spec)),
      calls:a=>new Map([...routines(dialogAccess(a),seed,spec)].filter(([t])=>!maps[i].has(t)).map(([t,run])=>[t,()=>({rawReturnWord:run()})]))});
    assert.deepEqual(result.differences,[],`seed ${seed}`);for(const pc of result.visited)covered.add(pc);
  }assert.deepEqual([...maps[i].keys()].filter(pc=>!covered.has(pc)).map(pc=>pc.toString(16)),[]);
}));
test('F092 rereads the raw source pointer and count after an external call',()=>{
  const s=audioSample(4,[{repeat:false,n:3}]);s.wram.set([0xA1,0xA2,0xA3],0x7400);s.wram.set([0xB1,0xB2],0x7500);const transcripts=[];
  const bind=h=>{const bytes=[];transcripts.push(bytes);return new Map([[0x81F007,()=>h.rtl()],[0x81F100,()=>subtractSampleLength(h.a,null,false).rawReturnWord],
    [0x81F122,()=>h.rts()],[0x81F03A,()=>{if(h.a.stackWord()===0xF0EE){bytes.push(h.ctx.a&255);if(bytes.length===1){h.dpWrite(0x8F,0x7500,2);h.dpWrite(0x98,2,2);}}return h.rts();}]]);};
  assert.deepEqual(compareDialog(maps[0],s,{root:'RTL',native:h=>intro.loadSoundDirectory(h,null,bind(h)),calls:a=>new Map([...bind(dialogAccess(a))].map(([t,run])=>[t,()=>({rawReturnWord:run()})]))}).differences,[]);
  assert.deepEqual(transcripts,[[0xA1,0xB2],[0xA1,0xB2]]);
});
test('F092 zero raw/repeat counts take the original full 16-bit loop before the next record',()=>{
  for(const repeat of [false,true]){const s=audioSample(1,[{repeat,n:0},{repeat:false,n:1}]),counts=[];
    const bind=h=>{const countsForSide={raw:0,word:0};counts.push(countsForSide);return new Map([[0x81F007,()=>h.rtl()],
      [0x81F100,()=>subtractSampleLength(h.a,null,false).rawReturnWord],
      [0x81F122,()=>{countsForSide.word++;return h.rts();}],
      [0x81F03A,()=>{if(h.a.stackWord()===0xF0EE)countsForSide.raw++;return h.rts();}]]);};
    const r=compareDialog(maps[0],s,{root:'RTL',native:h=>intro.loadSoundDirectory(h,null,bind(h)),calls:a=>new Map([...bind(dialogAccess(a))].map(([t,run])=>[t,()=>({rawReturnWord:run()})]))});
    assert.deepEqual(r.differences,[]);assert.deepEqual(counts,[{raw:repeat?1:65537,word:repeat?65537:1},{raw:repeat?1:65537,word:repeat?65537:1}]);
  }
});
const realCalls=(h,e,routines=MAIN_SCENE_ROUTINES)=>new Map([...routines].map(([t,run])=>[t,()=>{
  const result=run(h,e,routines);return {rawReturnWord:result?.rawReturnWord??result};
}]));
test('F092 composes real APU helpers with explicit matching-token observations',()=>{
  const s=audioSample(7,[{repeat:false,n:1},{repeat:true,n:2},{repeat:false,n:2}]);s.dbr=0x80;s.wram[0x1CE4]=0;
  s.io=[{pc:0x81F00E,address:0x802140,width:1,value:0},...Array.from({length:5},(_,i)=>({pc:0x81F046,address:0x802140,width:1,value:i+1}))];
  assert.deepEqual(compareDialog(maps[0],s,{root:'RTL',native:(h,e)=>intro.loadSoundDirectory(h,e,MAIN_SCENE_ROUTINES),calls:(a,e)=>realCalls(dialogAccess(a),e)}).differences,[]);
  for(const io of [[],s.io.slice(0,-1),[{...s.io[0],width:2}]])assert.throws(()=>compareDialog(maps[0],{...s,io},{root:'RTL',native:(h,e)=>intro.loadSoundDirectory(h,e,MAIN_SCENE_ROUTINES)}),e=>e.reason==='device_observation_required');
});
// A test-only immediate matching ACK, with every read recorded. It provides no APU timing,
// audio playback or original hardware evidence. Used for large unchanged ROM streams.
function matchingAck(h){const read=h.a.absoluteRead;h.a.absoluteRead=(offset,width,pc)=>{
  if(offset!==0x2140)return read(offset,width,pc);assert.equal(width,1);assert.ok([0x81F00E,0x81F046].includes(pc));
  const value=h.read(h.abs(0x1CE4),1);h.a.trace.push({kind:'read',pc,address:h.abs(offset),width,value});return value;
};}
test('F092 reads both original directory streams through the real APU byte/word helpers',()=>{
  for(const [a,length]of [[0,49541],[3,29055]]){const s=sample(0x81F092,a+1);s.a=a;s.dbr=0x81;s.wram[0x1CE4]=0;
    const r=compareDialog(maps[0],s,{root:'RTL',native:(h,e)=>{matchingAck(h);intro.loadSoundDirectory(h,e,MAIN_SCENE_ROUTINES);assert.equal(h.dp(0x92,2),0);
      const writes=h.a.trace.filter(o=>o.kind==='write');assert.equal(writes.find(o=>o.pc===0x81F013).value,length-2);
      assert.deepEqual(writes.filter(o=>[0x81F050,0x81F054].includes(o.pc)).slice(0,2).map(o=>o.value),[0xFE,0x0E]);},
      calls:(acc,e)=>{const h=dialogAccess(acc);matchingAck(h);return realCalls(h,e);}});assert.deepEqual(r.differences,[]);
  }
});
test('special CDF8 tail shares its caller frame through real DFE7, all scene helpers and nested CDF8',()=>{
  const tables=Buffer.from(window(0x81D3FB,0x81D413).hex,'hex'),count=tables.readUInt16LE(10)+tables.readUInt16LE(22)+2;
  for(const introPolls of [1,300]){const s=sample(0x81DFE7,introPolls);s.a=0x14;s.p=introPolls===1?3:0x47;s.wram[0x1C76]=0;s.wram[0x1C77]=0;s.wram[0x1CE4]=0;
  s.inputs=Array.from({length:introPolls+count},()=>({pc:0x809E1A,address:0x8101CA,width:2,value:introPolls===1?0x9000:0}));
  let counter=0;const waits=n=>Array.from({length:n},()=>({pc:0x81EECD,address:0x7E1C76,width:1,value:(++counter)&255}));
  s.waits=[...waits(16+introPolls+16+count),...Array.from({length:16},(_,i)=>({pc:0x81CF4C,address:0x8011A3,width:1,value:15-i})),...waits(1)];
  const installed=[],routines=new Map(MAIN_SCENE_ROUTINES),ec16=routines.get(0x81EC16);
  routines.set(0x81EC16,(h,e)=>{const at=h.ctx.x,result=ec16(h,e);installed.push([at,h.dp(0x6E,2)|h.dp(0x70,1)<<16]);return result;});
  const cdf8Program=Buffer.from(window(0x81F497,0x81F499).hex,'hex').readUInt16LE();
  const r=compareDialog(maps[9],s,{root:'RTL',native:(h,e)=>{matchingAck(h);playCutscene(h,e,routines);assert.equal(h.ctx.bank,0x80);assert.equal(h.ctx.s,0x1EF0);assert.equal(h.ctx.pc,0x1235);
      assert.deepEqual(installed,[[0xF6EF,0x81DAD6],[0xF79F,0x81DF0E],[cdf8Program,0x81D479]]);assert.equal(h.dp(0x1C,2),0);assert.equal(h.dp(0x16,2),0);},
    calls:(acc,e)=>{const h=dialogAccess(acc);matchingAck(h);return new Map([...realCalls(h,e)].filter(([t])=>!maps[9].has(t)));}});
  assert.deepEqual(r.differences,[]);assert.equal(r.events.inputIndex,s.inputs.length);assert.equal(r.events.waitIndex,s.waits.length);
  }
});
test('F092 long directory and raw payload pointers carry into the next WRAM bank',()=>{
  for(const mode of ['directory','raw']){const s=audioSample(4,[{repeat:false,n:2}]);
    if(mode==='directory'){s.rom.set([0xFD,0xFF,0x7E],cpuToOffset(0x98FFFA+s.a,rom.length));s.wram.set([0,0x70,0x7E],0xFFFF);}
    else{s.wram.set([0xFF,0xFF,0x7E],0x7006);s.wram.set([0xAA,0xBB],0xFFFF);}
    const spec=sceneIntroSpecs[0];assert.deepEqual(compareDialog(maps[0],s,{root:'RTL',native:(h,e)=>intro.loadSoundDirectory(h,e,routines(h,4,spec)),
      calls:a=>new Map([...routines(dialogAccess(a),4,spec)].map(([t,run])=>[t,()=>({rawReturnWord:run()})]))}).differences,[]);
  }
});
