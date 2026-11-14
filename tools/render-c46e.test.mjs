import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRenderC46E, renderC46E } from '../proof/render/audio-c46e.mjs';
import { audioEntry as entry, audioFixture as fixture } from './render-c46e-fixtures.mjs';
import { panWord as word } from './render-c416-fixtures.mjs';

const run = (data, extra = {}) => prepareRenderC46E({ ...entry, data, ...extra });
const fail = (data, extra, reason) => {
  const before = data.snapshot(), p = run(data, extra); assert.equal(p.handled, false);
  assert.equal(p.reason, reason); assert.deepEqual(data.snapshot(), before);
  for (const key of ['operations', 'ioRequests', 'byteWrites', 'calls']) assert.equal(p[key], undefined);
  assert.throws(() => data.commit(p), /Invalid render plan/); return p;
};
test('C46E uses one atomic overlay, forced DBR80 and exact three-command parameter/voice/sound order', () => {
  const data = fixture(), before = data.snapshot(), p = run(data); assert.equal(p.handled, true);
  assert.deepEqual(data.snapshot(), before);
  assert.deepEqual([p.a, p.x, p.y, p.bank, p.status], [0x0503, 0xFF2D, 0x4C, 0x80, 0x45]);
  assert.deepEqual(p.calls.map(c => [c.name, c.role, c.command]),
    [['C416','parameters',null],['F007','parameters',6],['F007','voice',15],['F007','sound',5]]);
  assert.deepEqual(p.ioWrites.map(e => [e.address, e.value, e.bytes]), [
    [0x804202,64,2],[0x804203,64,1],[0x804203,63,1],
    [0x802142,0x1122,2],[0x802141,6,1],[0x802140,1,1],
    [0x802142,3,2],[0x802141,15,1],[0x802140,2,1],
    [0x802142,0xFF2D,2],[0x802141,5,1],[0x802140,3,1],
  ]);
  assert.deepEqual(p.ioRequests.filter(e => e.kind === 'read').map(e => [e.address,e.value,e.bytes]),
    [[0x804217,17,1],[0x804217,34,1],[0x802140,0,1],[0x802140,1,1],[0x802140,2,1]]);
  assert.deepEqual(p.byteWrites, [[0x7E1CE4,3],[0x7E1CE2,3],[0x7E1CE3,0]]);
  assert.deepEqual([p.panResultReads,p.apuPolls,p.outputBytes], [2,3,0]);
  const dp06 = p.byteOperations.findIndex(e => e.address === 6);
  assert.equal(p.byteOperations[dp06-1].address,0x801CE4); assert.equal(p.byteOperations[dp06-1].value,1);
  assert.equal(data.commit(p).handled,true); assert.equal(data.readByte(0x801CE4).value,3);
  assert.equal(data.readByte(0x801CE0).value,0); assert.equal(data.readByte(6).value,3);
});
test('sound cache equality never suppresses play and full voice cache equality suppresses only command0F', () => {
  for (const cachedSound of [0,45,0xFFFF]) {
    const data = fixture({ cachedSound, cachedVoice: 3, writeWindows: [[0x7E1CE4,0x7E1CE4]] }), p = run(data);
    assert.equal(p.handled,true); assert.equal(p.soundCacheHit,cachedSound===45); assert.equal(p.voiceCacheHit,true);
    assert.deepEqual(p.calls.map(c => c.command),[null,6,5]); assert.equal(p.apuPolls,2);
    assert.deepEqual(p.byteWrites,[[0x7E1CE4,2]]); assert.equal(p.a,0x502); assert.equal(p.carry,1);
  }
});
test('all32768 low sound WORDs preserve saved low byte and always issue sound command05', () => {
  const data = fixture({ cachedVoice: 3 });
  for (let sound = 0; sound < 32768; sound++) {
    word(data,0x80C4FF,sound); const p = run(data); assert.equal(p.handled,true);
    assert.equal(p.sound,sound); assert.equal(p.x,0xFF00 | sound); assert.equal(p.a,0x502);
    assert.equal(p.calls.at(-1).command,5); assert.equal(p.calls.at(-1).before.x,0xFF00 | sound);
  }
});
test('all65535 nonzero voice WORDs retain full cache comparison, parameter and final CPX Carry', () => {
  const data = fixture({ cachedVoice: 0x8000 });
  for (let voice = 1; voice < 65536; voice++) {
    word(data,6,voice); const p = run(data); assert.equal(p.handled,true);
    assert.equal(p.voice,voice); assert.equal(p.carry,Number(voice>=32768)); assert.equal(p.overflow,1);
    assert.equal(p.voiceCacheHit,voice===32768); assert.equal(p.calls.length,voice===32768?3:4);
    if (voice!==32768) assert.equal(p.calls[2].before.x,voice);
    assert.equal(p.status & 0x82,0); assert.equal(p.x,0xFF2D);
  }
});
test('all256 incoming DBRs including physical WRAM are replaced before every audio access', () => {
  const data = fixture(); data.seed(0x7E2140,[0]); data.seed(0x7E4217,[99]);
  for (let bank=0;bank<256;bank++) {
    const p=run(data,{bank}); assert.equal(p.handled,true); assert.equal(p.bank,128); assert.equal(p.a,0x503);
    assert.ok(p.ioRequests.every(e => e.address>>>16===128)); assert.equal(p.readAddresses.includes(0x7E2140),false);
  }
  fail(data,{bank:0x7E,ioRead2140:[]},'render_io_read_required');
});
test('shared observed results and polls use global chronology, mismatches and token wrap across calls', () => {
  const p=run(fixture({token:255}),{ioRead4217:[128,255],ioRead2140:[0,255,255,0,0,1]});
  assert.equal(p.handled,true); assert.deepEqual([p.a,p.apuPolls,p.panResultReads],[0x502,6,2]);
  assert.deepEqual(p.calls.slice(1).map(c=>[c.polls,c.apuPolls]),[[2,2],[2,4],[2,6]]);
  assert.deepEqual(p.ioWrites.filter(e=>e.address===0x802140).map(e=>e.value),[0,1,2]);
  assert.equal(p.calls[1].before.x,0x80FF);
  fail(fixture(),{ioRead2140:[0,0,0]},'render_io_read_required');
});
test('all status combinations allowed by WORD/binary entry retain V/IRQ and final WORD NZ/CPX C', () => {
  for (let status=0;status<256;status++) {
    if (status & 0x38) continue;
    const p=run(fixture({cachedVoice:5}),{status}); assert.equal(p.handled,true);
    assert.equal(p.status,status & ~0x83); assert.equal(p.overflow,status>>>6 & 1);
  }
  const p=run(fixture({index:2,position:0x7FFF,scroll:0x8000}),{status:0});
  assert.equal(p.handled,true); assert.equal(p.overflow,1); assert.equal(p.status,0x41);
});
test('odd selector and full WORD selector use actual indexed24-bit address without a table cap', () => {
  for (const selector of [0,1,0x4C,0x3B4C,0xFFFF]) {
    const data=fixture({selector}); if (selector===0x3B4C) word(data,0,0x8000);
    const p=run(data); assert.equal(p.handled,true); assert.equal(p.soundAddress,0x80C4B3+selector);
    assert.equal(p.x,0xFF2D); assert.equal(p.y,selector);
  }
  const data=fixture(); word(data,2,0x3B4D); word(data,0,0x2D);
  // DP00 is the table WORD itself; first missing position proves the fresh full index.
  const p=fail(data,{},'render_source_required'); assert.equal(p.address,0x7E0EAD);
  word(data,2,0x5B4D); fail(data,{},'render_address_required');
});
test('saved sound WORD survives the later voice-cache WORD store alias', () => {
  const data=fixture({selector:0x582F}); word(data,0x801CE2,45);
  const p=run(data); assert.equal(p.handled,true); assert.equal(p.sound,45); assert.equal(p.carry,0);
  assert.equal(p.calls[2].before.x,3); assert.equal(p.calls[3].before.x,0xFF2D);
  data.commit(p); assert.equal(data.readByte(0x811CE2).value,3);
});
test('saved sound WORD survives all token writes when table aliases token and adjacent BYTE', () => {
  const data=fixture({selector:0x5831}); word(data,0x801CE4,45);
  const p=run(data,{ioRead2140:[45,46,47]}); assert.equal(p.handled,true);
  assert.equal(p.sound,45); assert.equal(p.x,0xFF2D); assert.equal(p.a,0x530);
  data.commit(p); assert.equal(data.readByte(0x811CE4).value,48); assert.equal(data.readByte(0x811CE5).value,0);
});
test('high sound cache misses require actual loader sources while high cache hits skip loader', () => {
  for (const sound of [0x8000,0x8001,0xFFFF]) {
    const p=fail(fixture({sound,cachedSound:0,writeWindows:[[0x7E0098,0x7E0098],[0x7E1CE0,0x7E1CE4]]}),{},'render_source_required');assert.equal(p.address,0x7E008C);
    const hit=run(fixture({sound,cachedSound:sound}),{stackWindow:[0x1FF8,0x1FFF]});
    assert.equal(hit.handled,true);assert.equal(hit.loaderUsed,false);assert.equal(hit.minimumStackBytes,8);
    assert.equal(hit.x,0xFF00|sound);
  }
});
test('zero voice is reached freshly after first handshake, without exposing partial writes or requests', () => {
  fail(fixture({voice:0}),{},'render_audio_return_required');
  fail(fixture({voice:0}),{ioRead2140:[]},'render_io_read_required');
  fail(fixture({voice:0,writeWindows:[]}),{},'render_write_window_required');
});
test('every missing BYTE in the successful read set fails atomically at its original source position', () => {
  const original=fixture(), p=run(original), snapshot=original.snapshot();
  for (const missing of p.readAddresses) {
    const data=createRenderData({writeWindows:snapshot.writeWindows});
    for (const [a,v] of snapshot.bytes) if(a!==missing) data.seed(a,[v]);
    const bad=fail(data,{},'render_source_required'); assert.equal(bad.address,missing);
  }
});
test('missing second sound BYTE and full voice-cache high BYTE are mandatory even when low bytes match', () => {
  for (const missing of [0x80C500,0x7E1CE3]) {
    const snapshot=fixture({cachedVoice:3}).snapshot(),data=createRenderData({writeWindows:snapshot.writeWindows});
    for (const [a,v] of snapshot.bytes) if(a!==missing) data.seed(a,[v]);
    assert.equal(fail(data,{},'render_source_required').address,missing);
  }
});
test('each exhausted observation prefix and absent IO mode holds the entire composition back', () => {
  fail(fixture(),{ioMode:null},'render_io_context_required');
  for (let n=0;n<2;n++) fail(fixture(),{ioRead4217:entry.ioRead4217.slice(0,n)},'render_io_read_required');
  for (let n=0;n<3;n++) fail(fixture(),{ioRead2140:entry.ioRead2140.slice(0,n)},'render_io_read_required');
});
test('all work prefixes and partial token/voice windows are no-effect boundaries', () => {
  const data=fixture(),p=run(data);
  for(let maxWork=1;maxWork<p.work;maxWork++) fail(data,{maxWork},'render_work_budget_required');
  assert.equal(run(data,{maxWork:p.work}).handled,true);
  for (const writeWindows of [[],[[0x7E1CE4,0x7E1CE4]],[[0x7E1CE2,0x7E1CE2],[0x7E1CE4,0x7E1CE4]]])
    fail(fixture({writeWindows}),{},'render_write_window_required');
});
test('eight disjoint stack bytes and explicit native WORD entry are required', () => {
  const data=fixture(); assert.equal(run(data,{stackWindow:[0x1FF8,0x1FFF]}).handled,true);
  for(const stackWindow of [null,[],[0x1FF9,0x1FFF],[0x1FFF,0x1FF8]]) fail(data,{stackWindow},'render_stack_required');
  for(const extra of [{bank:null},{status:null},{status:0x20},{status:0x10},{status:8},{emulation:1},{directPage:1}])
    fail(data,extra,'render_entry_required');
  for(const stackWindow of [[0,7],[0x1CE0,0x1CE7]]) fail(data,{stackWindow},'render_stack_alias_required');
});
test('invalid context rejects malformed, sparse or non-BYTE observations and budgets', () => {
  for(const key of ['ioRead4217','ioRead2140']) for(const value of [{},[256],[-1],[0.5],[undefined],new Array(2)])
    assert.throws(()=>run(fixture(),{[key]:value}),/Invalid/);
  for(const extra of [{bank:256},{status:-1},{maxWork:0},{maxWork:Infinity},{ioMode:'simulate'}])
    assert.throws(()=>run(fixture(),extra),/Invalid/);
});
test('inner plans cannot commit; outer plans are immutable, owner-bound and stale-safe', () => {
  const data=fixture(),before=data.snapshot();
  const inner=renderC46E(prepareRenderView(data),entry,{work:0,maxWork:1000});
  assert.deepEqual(data.snapshot(),before); assert.throws(()=>data.commit(inner),/Invalid render plan/);
  const p=run(data); assert.equal(Object.isFrozen(p),true); assert.equal(Object.isFrozen(p.calls),true);
  assert.throws(()=>fixture().commit(p),/Invalid render plan/); assert.throws(()=>{p.byteWrites[0][1]=99;},TypeError);
  data.seed(0x7E1000,[99]); const changed=data.snapshot();
  assert.deepEqual(data.commit(p),{handled:false,reason:'render_plan_stale'}); assert.deepEqual(data.snapshot(),changed);
  const q=run(data); assert.equal(data.commit(q).handled,true);
  assert.equal(data.commit(q).reason,'render_plan_stale');
});
test('larger manual composition shares observation offsets, provider and work budget without a child commit', () => {
  const data=fixture({token:1}), counts={panResultReads:2,apuPolls:2}, budget={work:7,maxWork:1000};
  const p=renderC46E(prepareRenderView(data),{...entry,observations:counts,
    ioRead4217:[99,99,0xAB,0xCD],ioRead2140:[99,99,1,2,3]},budget);
  assert.equal(p.handled,true); assert.equal(p.calls[1].before.x,0xABCD);
  assert.deepEqual(counts,{panResultReads:4,apuPolls:5}); assert.equal(p.work,run(fixture()).work+7);
  assert.throws(()=>data.commit(p),/Invalid render plan/);
});
test('probe identifies synthetic all-sound evidence and leaves zero/source/exhaustion paths explicit', async () => {
  const report=JSON.parse(await readFile('analysis/render-c46e-native.json','utf8'));
  assert.match(report.scope,/synthetic/); assert.match(report.scope,/no audio\/device\/CPU/);
  assert.equal(report.stackProof.minimum_protected_stack_bytes,14); assert.equal(report.probes.length,9);
  assert.equal(report.lowStackProof.minimum_protected_stack_bytes,8);assert.equal(report.cacheHitProof.minimum_protected_stack_bytes,8);
  assert.deepEqual(report.probes.map(p=>p.handled),[true,true,true,false,false,false,true,true,true]);
  assert.deepEqual(report.probes.slice(3,6).map(p=>p.reason),
    ['render_audio_return_required','render_source_required','render_io_read_required']);
});
