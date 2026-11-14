import test from 'node:test';
import assert from 'node:assert/strict';
import {createRenderData,prepareRenderView} from '../src/render/data.mjs';
import {prepareRenderC46E,renderC46E} from '../proof/render/audio-c46e.mjs';
import {audioFixture,highAudioFixture,highAudioEntry} from './render-c46e-fixtures.mjs';
import {panWord as word} from './render-c416-fixtures.mjs';
const run=(data,options={})=>prepareRenderC46E({...highAudioEntry,data,...options});
const fail=(data,options,reason)=>{const before=data.snapshot(),p=run(data,options);
  assert.equal(p.handled,false);assert.equal(p.reason,reason);assert.deepEqual(data.snapshot(),before);
  for(const key of ['byteWrites','operations','ioRequests','calls','byteOperations'])assert.equal(p[key],undefined);
  return p;};
const commands=p=>p.ioWrites.filter(e=>e.phase==='command'&&e.address===0x802141).map(e=>e.value);

test('C46E every32768 high cached WORDs skip loader without directory sources and retain eight-byte contract',()=>{
  const data=audioFixture({cachedVoice:3});
  for(let sound=0x8000;sound<=65535;sound++){
    word(data,0x80C4FF,sound);word(data,0x801CE0,sound);
    const p=run(data,{stackWindow:[0x1FF8,0x1FFF]});assert.ok(p.handled);
    assert.equal(p.loaderUsed,false);assert.equal(p.soundCacheHit,true);assert.equal(p.minimumStackBytes,8);
    assert.equal(p.x,0xFF00|sound);assert.equal(p.a,0x502);assert.equal(p.y,0x4C);
    assert.deepEqual(commands(p),[6,5]);assert.ok(!p.readAddresses.includes(0x7E008C));
    assert.ok(!p.byteWrites.some(([a])=>a===0x7E1CE0||a===0x7E1CE1));
  }
});
test('C46E every32768 high misses preserve original saved sound and actual F130 selector/header returns',()=>{
  const data=highAudioFixture({cachedVoice:3,blocks:[]});
  for(let sound=0x8000;sound<=65535;sound++){
    word(data,0x80C4FF,sound);const p=run(data);assert.ok(p.handled);
    assert.equal(p.loaderUsed,true);assert.equal(p.sound,sound);assert.equal(p.minimumStackBytes,14);
    assert.equal(p.calls[0].name,'F130');assert.equal(p.calls[0].before.a,sound);
    assert.equal(p.calls[0].after.a,sound%256===7?0:(sound&0xFF00)|255);
    assert.equal(p.y,sound%256===7?4:9);assert.equal(p.x,0xFF00|sound);assert.equal(p.a,0x502);
    assert.deepEqual(commands(p),[6,5]);
  }
});
test('C46E high raw load precedes parameters/voice/play with one global token sequence and real F130 registers',()=>{
  const data=highAudioFixture(),before=data.snapshot(),p=run(data);assert.ok(p.handled);assert.deepEqual(data.snapshot(),before);
  assert.deepEqual(p.calls.map(c=>[c.name,c.role,c.command]),
    [['F130','load',null],['C416','parameters',null],['F007','parameters',6],['F007','voice',15],['F007','sound',5]]);
  assert.deepEqual(commands(p),[16,6,15,5]);assert.deepEqual(p.calls[0].after,{a:0,x:1,y:9,bank:128,status:p.calls[0].before.status});
  assert.equal(p.calls[1].before.y,9);assert.equal(p.y,9);assert.equal(p.x,0xFF07);assert.equal(p.a,0x506);
  assert.equal(p.apuPolls,6);assert.equal(p.panResultReads,2);assert.equal(p.status,0x45);
  assert.deepEqual(p.ioWrites.filter(e=>e.address===0x802140).map(e=>e.value),[1,2,3,4,5,6]);
  assert.deepEqual(data.commit(p),{handled:true});assert.equal(data.readByte(0x1CE0).value,7);assert.equal(data.readByte(0x1CE1).value,128);
});
test('C46E high repeated and mixed payloads retain native WORD senders and actual final Y without selector restore',()=>{
  for(const [blocks,expectedY,requested]of [
    [[{kind:'repeat',count:2,value:0xBEEF}],8,[4]],
    [[{kind:'raw',values:[0xAA]},{kind:'repeat',count:2,value:0xBEEF},{kind:'raw',values:[0x12,0x34]}],18,[1,4,2]],
  ]){
    const p=run(highAudioFixture({blocks}));assert.ok(p.handled);assert.equal(p.y,expectedY);
    assert.equal(p.calls[1].before.y,expectedY);assert.deepEqual(p.ioWrites.filter(e=>e.bytes===2&&e.address===0x802142)
      .map(e=>e.value).slice(0,requested.length),requested);assert.equal(p.calls.at(-1).before.x,0xFF07);
  }
});
test('C46E high cache miss versus hit and full channel cache compare independently select loader and0F',()=>{
  for(const cachedSound of [0,0x8007])for(const cachedVoice of [0,3,0x0103]){
    const p=run(highAudioFixture({cachedSound,cachedVoice}));assert.ok(p.handled);
    assert.equal(p.loaderUsed,cachedSound!==0x8007);assert.equal(p.voiceCacheHit,cachedVoice===3);
    assert.deepEqual(commands(p),[...(cachedSound===0? [16]:[]),6,...(cachedVoice===3?[]:[15]),5]);
    assert.equal(p.carry,Number(3>=cachedVoice));
  }
});
test('C46E high path all allowed entry statuses and all DBRs retain forced80, actual loader status and final CPX/V',()=>{
  for(let status=0;status<256;status++){if(status&0x38)continue;
    for(const cachedVoice of [0,0x8000]){
      const p=run(highAudioFixture({cachedVoice}),{status});assert.ok(p.handled);
      assert.equal(p.calls[0].after.status,p.calls[0].before.status);
      assert.equal(p.status,(status&~0x83)|Number(3>=cachedVoice));assert.equal(p.overflow,status>>>6&1);
    }
  }
  const data=highAudioFixture();for(let bank=0;bank<256;bank++){
    const p=run(data,{bank});assert.ok(p.handled);assert.equal(p.bank,128);assert.ok(p.ioRequests.every(e=>e.address>>>16===128));
  }
});
test('C46E high load respects full selector/bankcarry and saved sound despite later voice-cache table alias',()=>{
  for(const selector of [1,0xFFFF,0x582F]){
    const data=highAudioFixture({selector}),p=run(data);assert.ok(p.handled);assert.equal(p.soundAddress,0x80C4B3+selector);
    assert.equal(p.sound,0x8007);assert.equal(p.y,9);assert.equal(p.x,0xFF07);
    if(selector===0x582F){assert.equal(p.cachedVoice,0x8007);assert.equal(p.carry,0);
      data.commit(p);assert.equal(data.readByte(p.soundAddress).value,3);}
  }
});
test('C46E high saved sound survives every loader/parent token store when table aliases token and highBYTE',()=>{
  const data=highAudioFixture({selector:0x5831});word(data,0x811CE4,0x8007);
  const p=run(data);assert.ok(p.handled);assert.equal(p.sound,0x8007);assert.equal(p.x,0xFF07);
  assert.equal(p.a,0x50D);assert.equal(p.apuPolls,13);data.commit(p);
  assert.equal(data.readByte(p.soundAddress).value,13);assert.equal(data.readByte(p.soundAddress+1).value,128);
});
test('C46E high shared provider consumes global loader and parent polls once alongside independent pan results',()=>{
  const data=highAudioFixture(),before=data.snapshot(),counts={apuPolls:2,panResultReads:2},budget={work:7,maxWork:10000};
  const p=renderC46E(prepareRenderView(data),{...highAudioEntry,observations:counts,
    ioRead2140:[99,99,0,1,2,3,4,5],ioRead4217:[99,99,0xAB,0xCD]},budget);
  assert.equal(p.apuPolls,8);assert.equal(p.panResultReads,4);assert.equal(p.calls[0].apuPolls,5);
  assert.equal(p.calls[2].before.x,0xABCD);assert.deepEqual(counts,{apuPolls:8,panResultReads:4});
  assert.equal(p.work,run(highAudioFixture()).work+7);assert.deepEqual(data.snapshot(),before);assert.throws(()=>data.commit(p));
});
test('C46E high tokenwrap and misspolls flow through loader and subsequent command handshakes chronologically',()=>{
  const observations=[99,255,99,0,99,1,99,2,99,3,99,4],p=run(highAudioFixture({token:255}),{ioRead2140:observations});
  assert.ok(p.handled);assert.equal(p.apuPolls,12);assert.equal(p.a,0x505);
  assert.deepEqual(p.ioWrites.filter(e=>e.address===0x802140).map(e=>e.value),[0,1,2,3,4,5]);
  assert.deepEqual(p.ioRequests.filter(e=>e.kind==='read'&&e.address===0x802140).map(e=>e.value),observations);
});
test('C46E high miss requires14 protected bytes; low and any high cache hit retain8 bytes',()=>{
  for(let count=8;count<14;count++){
    const p=fail(highAudioFixture(),{stackWindow:[0x2000-count,0x1FFF]},'render_stack_required');assert.equal(p.minimumStackBytes,14);
  }
  assert.ok(run(highAudioFixture(),{stackWindow:[0x1FF2,0x1FFF]}).handled);
  assert.ok(run(audioFixture(),{stackWindow:[0x1FF8,0x1FFF]}).handled);
  assert.ok(run(audioFixture({sound:0x8007,cachedSound:0x8007}),{stackWindow:[0x1FF8,0x1FFF]}).handled);
  for(const stackWindow of [[0x89,0x96],[0x1CE0,0x1CED]])fail(highAudioFixture(),{stackWindow},'render_stack_alias_required');
});
test('C46E high zero channel fails only after actual loader/parameter work and withholds all cache/scratch/token effects',()=>{
  fail(highAudioFixture({voice:0}),{},'render_audio_return_required');
  fail(highAudioFixture({voice:0}),{ioRead2140:[0,1]},'render_io_read_required');
  fail(highAudioFixture({voice:0}),{ioRead4217:[]},'render_io_read_required');
});
test('C46E high every initially read sourceBYTE including directory/payload/late voice cache is mandatory and atomic',()=>{
  const data=highAudioFixture(),p=run(data);assert.ok(p.handled);const initial=data.snapshot();
  const writes=new Set(),required=new Set();for(const e of p.byteOperations){
    // byteOperations keeps original addresses; source bytes in system WRAM
    // mirrors resolve to the owner's physical addresses.
    const bank=e.address>>>16,offset=e.address&65535;
    const a=!(bank&0x40)&&offset<0x2000?0x7E0000+offset:e.address;
    if(e.kind==='write')writes.add(a);else if(!writes.has(a))required.add(a);
  }
  for(const missing of required){const copy=createRenderData({writeWindows:initial.writeWindows});
    for(const[a,v]of initial.bytes)if(a!==missing)copy.seed(a,[v]);
    const bad=fail(copy,{},'render_source_required');assert.equal(bad.address,missing);
  }
});
test('C46E high all budget and observation prefixes discard early cache store and all loader/parent requests',()=>{
  const data=highAudioFixture(),p=run(data);assert.ok(p.handled);
  for(let maxWork=1;maxWork<p.work;maxWork++)fail(data,{maxWork},'render_work_budget_required');
  assert.ok(run(data,{maxWork:p.work}).handled);
  for(let n=0;n<p.apuPolls;n++)fail(data,{ioRead2140:highAudioEntry.ioRead2140.slice(0,n)},'render_io_read_required');
  for(let n=0;n<2;n++)fail(data,{ioRead4217:highAudioEntry.ioRead4217.slice(0,n)},'render_io_read_required');
  fail(data,{ioMode:null},'render_io_context_required');
});
test('C46E high every WORDcache/scratch/token/channel destinationBYTE needs ownership with no partial effects',()=>{
  const data=highAudioFixture(),p=run(data);assert.ok(p.handled);
  for(const[missing]of p.byteWrites){const writeWindows=p.byteWrites.filter(([a])=>a!==missing).map(([a])=>[a,a]);
    fail(highAudioFixture({writeWindows}),{},'render_write_window_required');
  }
});
test('C46E high inner/foreign/stale plans cannot commit and later loader failure preserves earlier outer writes',()=>{
  const data=highAudioFixture(),before=data.snapshot(),view=prepareRenderView(data);view.write(0x1CE0,0xAA);
  assert.throws(()=>renderC46E(view,{...highAudioEntry,ioRead2140:[0,1]},{work:0,maxWork:10000}),e=>e.reason==='render_io_read_required');
  assert.deepEqual(data.snapshot(),before);const p=run(data);assert.ok(Object.isFrozen(p.calls));
  assert.throws(()=>highAudioFixture().commit(p));data.seed(0x99,[0]);assert.equal(data.commit(p).reason,'render_plan_stale');
  const q=run(data);assert.deepEqual(data.commit(q),{handled:true});assert.equal(data.commit(q).reason,'render_plan_stale');
});
