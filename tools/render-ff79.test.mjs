import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView, renderAddress } from '../src/render/data.mjs';
import { prepareRenderFF79, renderFF79, renderFA3E } from '../proof/render/clear-ff79.mjs';
import { ff79Fixture, ff79Entry, ff79Windows } from './render-ff79-fixtures.mjs';
import { seedWord, getWord } from './render-ad92-fixtures.mjs';

const prepare = (data, extra = {}) => prepareRenderFF79({ data, ...ff79Entry, ...extra });
const budget = () => ({ work: 0, maxWork: 1000000, maxOutputBytes: 65536, outputBytes: 0 });
const rootOperations = p => p.operations.filter(o => o.phase === 'FF79');
function failure(data, extra, reason) {
  const before = data.snapshot(), p = prepare(data, extra);
  assert.equal(p.handled, false, JSON.stringify(p)); assert.equal(p.reason, reason, JSON.stringify(p));
  assert.deepEqual(data.snapshot(), before);
  for (const key of ['byteWrites','operations','waitOperations','calls','stableDivisions','stableDivisionReads']) assert.equal(p[key], undefined);
  assert.throws(() => data.commit(p), /Invalid render plan/); return p;
}
function copy(data, omit, windows = data.snapshot().writeWindows) {
  const out = createRenderData({ writeWindows: windows });
  for (const [address, value] of data.snapshot().bytes) if (address !== omit) out.seed(address, [value]);
  return out;
}
function skipFixture(slots = [0xFFFF,0xFFFF,0xFFFF,0xFFFF], bank = 0x80) {
  const data = createRenderData({ writeWindows: [[0x7E0000,0x7EFFFF],[0x7F0200,0x7F0201]] });
  slots.forEach((s,i) => seedWord(data,0x7E0216+i*2,s)); return data;
}

test('FF79 releases four real buffers in reverse slot order and commits all markers and tail together', () => {
  const data = ff79Fixture(), before = data.snapshot(), p = prepare(data);
  assert.ok(p.handled, JSON.stringify(p)); assert.deepEqual(data.snapshot(), before);
  assert.deepEqual(p.calls.map(c => [c.slot,c.buffer]),[[6,6],[4,4],[2,2],[0,0]]);
  assert.ok(p.calls.every(c => c.name === 'FA3E' && c.calls[0].name === 'AD92'));
  assert.equal(p.visits,4); assert.equal(p.releases,4); assert.equal(p.x,0xFFFE); assert.equal(p.a,0xFFFF);
  assert.equal(p.y,0x2AE0); assert.equal(p.status,0x84); assert.equal(p.pollsF8,4);
  // Original conversion1856+1856 per call, plus 24-byte borders for3+2+1 entries.
  assert.equal(p.outputBytes,4*3712+24*(3+2+1));
  assert.equal(p.byteAccesses,p.byteOperations.length); assert.equal(rootOperations(p).at(-1).address,0x800200);
  assert.ok(data.commit(p).handled);
  for (let x=0;x<=6;x+=2) assert.equal(getWord(data,0x7E0216+x),0xFFFF);
  assert.equal(getWord(data,0x200),0); assert.equal(getWord(data,0x204),0xFFFE);
  assert.equal(getWord(data,0x212),0x2027); assert.equal(getWord(data,0x202),0xABCD);
  for (let x=0;x<=6;x+=2) assert.equal(getWord(data,0x21E+x),0x300+x/2);
});

test('FF79 allskip consumes only eight slotbytes and the final WORDstore, retaining incoming Y/C/V/I', () => {
  const slots = [0x8000,0x8001,0xFFFE,0xFFFF], data = skipFixture(slots);
  const p = prepare(data,{ waitMode:null,waitRead01F8:null,maxWork:10,maxOutputBytes:1 });
  assert.ok(p.handled); assert.equal(p.a,0x8000); assert.equal(p.y,0x1234); assert.equal(p.status,0xC5);
  assert.equal(p.work,10); assert.equal(p.outputBytes,0); assert.equal(p.pollsF8,0); assert.deepEqual(p.calls,[]);
  assert.deepEqual(p.byteWrites,[[0x7E0200,0],[0x7E0201,0]]);
  assert.deepEqual(rootOperations(p).filter(o=>o.kind==='read').map(o=>o.address),[0x7E021C,0x7E021A,0x7E0218,0x7E0216]);
  data.commit(p); for (let i=0;i<4;i++) assert.equal(getWord(data,0x7E0216+i*2),slots[i]);
});

test('FF79 every WORD is classified by sign alone, including zero and odd nonnegative bufferwords', () => {
  for (let value=0;value<=65535;value++) {
    const data=skipFixture([value,0x8000,0x8000,value],0x7E), p=prepare(data,
      {bank:0x7E,waitMode:null,waitRead01F8:null,stackWindow:[0xD000,0xD01B]});
    if (value&0x8000) { assert.ok(p.handled); assert.equal(p.a,value); assert.equal(p.releases,0); }
    else { assert.equal(p.handled,false); assert.equal(p.reason,'render_source_required'); assert.equal(p.address,0x7E0204); }
    assert.equal(data.readByte(0x7E0000).available,false); assert.equal(data.readByte(0x7E0200).available,false);
  }
});

test('FF79 all sixteen occupancy combinations preserve skippedwords and call each nonnegative slot exactly once', () => {
  for (let mask=0;mask<16;mask++) {
    const slots=Array.from({length:4},(_,i)=>mask&1<<i?i*2:0x8000+i);
    const data=ff79Fixture({slots}), p=prepare(data); assert.ok(p.handled);
    assert.deepEqual(p.calls.map(c=>c.slot),[6,4,2,0].filter(x=>mask&1<<(x/2)));
    assert.equal(p.a,mask&1?0xFFFF:0x8000); assert.equal(p.status&0x82,0x80);
    data.commit(p); slots.forEach((s,i)=>assert.equal(getWord(data,0x7E0216+i*2),mask&1<<i?0xFFFF:s));
  }
});

test('FF79 restores only outer X around real FA3E, with marker after AD92 wait and final flags from DEX', () => {
  const p=prepare(ff79Fixture());
  for (const call of p.calls) {
    const marker=p.byteOperations.findIndex(o=>o.kind==='write'&&o.phase==='FF79'&&o.address===0x7E0216+call.slot);
    const clear=p.byteOperations.findIndex(o=>o.kind==='write'&&o.phase==='FA3E'&&o.address===0x800226+call.buffer);
    assert.ok(marker>clear); assert.equal(p.byteOperations[marker].value,255);
  }
  assert.notEqual(p.calls[0].after.y,p.calls[0].before.y);
  assert.equal(p.calls.at(-1).after.x,0xFFFE); assert.equal(p.x,0xFFFE);
  assert.equal(p.status&0x82,128);
});

test('FF79 unequal-end releases still execute full AD92 and duplicate bufferindices remain real calls', () => {
  const data=ff79Fixture({slots:[0x8000,4,4,4],last:6}), p=prepare(data);
  assert.ok(p.handled); assert.equal(p.releases,3); assert.ok(p.calls.every(c=>!c.trimmed));
  assert.ok(p.calls.every(c=>c.buffer===4&&c.calls[0].name==='AD92')); assert.equal(p.a,0x8000);
  data.commit(p); assert.equal(getWord(data,0x204),6); assert.equal(getWord(data,0x226+4),0);
});

test('FF79 tailtrimming scans fresh preceding flags and obtains the new cursor from fixed7E table', () => {
  const data=ff79Fixture({slots:[0x8000,0x8000,0x8000,6],flags:[1,0,0,1]});
  seedWord(data,0x7E2062,0x4567);
  const p=prepare(data); assert.ok(p.handled); assert.equal(p.calls[0].trimVisits,3);
  assert.deepEqual(p.operations.filter(o=>o.phase==='FA3E'&&o.kind==='read'&&o.address>=0x800226).map(o=>o.address),
    [0x80022A,0x800228,0x800226]);
  data.commit(p); assert.equal(getWord(data,0x204),0); assert.equal(getWord(data,0x212),0x4567);
});

test('FF79 odd bufferindex remains unmasked and retains WORD table/index behavior', () => {
  const data=ff79Fixture({slots:[0x8000,0x8000,0x8000,3],first:0xFFFF,last:3,flags:[0,0,0,0]});
  seedWord(data,0x226+1,1); seedWord(data,0x7E2060+3,0x4567);
  const p=prepare(data); assert.ok(p.handled); assert.equal(p.calls[0].buffer,3); assert.equal(p.calls[0].trimVisits,1);
  data.commit(p); assert.equal(getWord(data,0),3); assert.equal(getWord(data,0x204),1); assert.equal(getWord(data,0x212),0x4567);
});

test('FF79 every valid status and all256 DBRs retain true tail-address ownership and final C/V/I', () => {
  for (let status=0;status<256;status++) if (!(status&0x38)) {
    const p=prepare(skipFixture(),{status}); assert.ok(p.handled); assert.equal(p.status,status&~0x82|128);
  }
  for (let bank=0;bank<256;bank++) {
    const data=skipFixture(undefined,bank), p=prepare(data,{bank});
    if (renderAddress(bank*65536+0x200)===null) {assert.equal(p.handled,false);assert.equal(p.reason,'render_address_required');}
    else {assert.ok(p.handled);assert.equal(p.bank,bank);data.commit(p);assert.equal(getWord(data,bank*65536+0x200),0);}
  }
});

test('FF79 physical7F parameters remain distinct from fixed7E slots and shared DP00', () => {
  const data=ff79Fixture({bank:0x7F}), p=prepare(data,{bank:0x7F}); assert.ok(p.handled);
  data.commit(p); assert.equal(getWord(data,0x7F0200),0); assert.equal(getWord(data,0x7F0204),0xFFFE);
  assert.equal(getWord(data,0),0); for(let x=0;x<=6;x+=2)assert.equal(getWord(data,0x7E0216+x),0xFFFF);
  assert.equal(getWord(data,0x7F0202),0xABCD);
});

test('FF79 full nonnegative bufferindex reaches actual physical WRAM without a capacity or alignment clamp', () => {
  const data=ff79Fixture({bank:0x7E,slots:[0x8000,0x8000,0x8000,0x7FFF],last:0xFFFF,
    writeWindows:[...ff79Windows,[0x7E8225,0x7E8226]]});
  const p=prepare(data,{bank:0x7E});assert.ok(p.handled);assert.equal(p.calls[0].buffer,0x7FFF);
  assert.equal(p.calls[0].trimmed,false);data.commit(p);
  assert.equal(getWord(data,0),0x7FFF);assert.equal(getWord(data,0x7E8225),0);
});

test('FF79 real AD92 output crosses into7F and can change caller bounds before the final tailclear', () => {
  const data=ff79Fixture({bank:0x7F,slots:[0x8000,0x8000,0x8000,6],last:0,flags:[1],positions:[0xDE60]});
  seedWord(data,0x7F0226+0x2802,0);
  const p=prepare(data,{bank:0x7F});assert.ok(p.handled,JSON.stringify(p));
  assert.equal(p.calls[0].calls[0].entries,1);assert.equal(p.calls[0].calls[0].visits,5122);
  assert.equal(p.calls[0].after.x,0x2804);assert.equal(p.x,0xFFFE);
  assert.ok(p.byteOperations.some(o=>o.kind==='write'&&o.phase==='AD92'&&o.address===0x7F0200&&o.value===1));
  data.commit(p);assert.equal(getWord(data,0x7F0204),0x2802);assert.equal(getWord(data,0x7F0200),0);
});

test('FF79 large actual ACCF ledgers merge within default budgets without a host argument-count limit', () => {
  const data=ff79Fixture({slots:[0x8000,0x8000,0x8000,6],last:0,flags:[1]});
  seedWord(data,0x7E2020,10000);const before=data.snapshot(),p=prepare(data);
  assert.ok(p.handled,p.reason);assert.equal(p.outputBytes,3712+60000);assert.equal(p.releases,1);
  assert.ok(p.byteOperations.length>125000);assert.deepEqual(data.snapshot(),before);
  assert.ok(data.commit(p).handled);assert.equal(getWord(data,0x7E021C),0xFFFF);assert.equal(getWord(data,0x200),0);
});

test('FF79 consumes one global unequal WORD01F8 transcript across all four real requests', () => {
  const samples=[3,0,0x100,2,0,0,9,0],p=prepare(ff79Fixture(),{waitRead01F8:samples}); assert.ok(p.handled);
  assert.deepEqual(p.calls.map(c=>c.polls),[2,3,1,2]); assert.equal(p.pollsF8,8);
  assert.deepEqual(p.waitOperations.filter(o=>o.kind==='read'&&o.phase==='wait').map(o=>o.value),samples);
  assert.deepEqual(p.calls.map(c=>c.pollsF8),[2,5,6,8]);
  for(let length=0;length<samples.length;length++)failure(ff79Fixture(),{waitRead01F8:samples.slice(0,length)},'render_wait_read_required');
  failure(ff79Fixture(),{waitMode:null},'render_wait_context_required');
});

test('FF79 fresh FFFF counterwrap reads actualzero without inventing an external observation', () => {
  const data=ff79Fixture({slots:[0x8000,0x8000,0x8000,0],counter:0xFFFF,first:0xFFFF,last:0xFFFF});
  const p=prepare(data,{waitMode:null,waitRead01F8:null}); assert.ok(p.handled); assert.equal(p.pollsF8,1);
  assert.ok(!p.waitOperations.some(o=>o.space==='external')); data.commit(p); assert.equal(getWord(data,0x1F8),0);
});

test('FF79 unobserved nonzero wait remains pending until the shared work limit without any live release', () => {
  const p=failure(ff79Fixture(),{waitMode:null,waitRead01F8:null,maxWork:40000},'render_work_budget_required');
  assert.equal(p.phase,'wait');assert.equal(p.callerPhase,'ACB5');assert.equal(p.completedReleases,0);
});

test('FF79 active AF1F keeps global stable divisions separate from chronological transfer polls', () => {
  failure(ff79Fixture({active:true}),{},'render_division_context_required');
  const p=prepare(ff79Fixture({active:true}),{divisionMode:'stable-native'}); assert.ok(p.handled);
  assert.equal(p.stableDivisions.length,12); assert.equal(p.stableDivisionReads.length,20); assert.equal(p.pollsF8,4);
  assert.deepEqual(p.stableDivisions.map(d=>d.division),Array.from({length:12},(_,i)=>i+1));
  assert.deepEqual(p.stableDivisions.map(d=>d.release),[1,1,1,2,2,2,3,3,3,4,4,4]);
  assert.deepEqual(p.stableDivisionReads.map(d=>d.division),[1,1,2,2,3,4,4,5,5,6,7,7,8,8,9,10,10,11,11,12]);
  assert.equal(p.outputBytes,4*3748+24*6);
  failure(ff79Fixture({active:true}),{divisionMode:'stable-native',maxOutputBytes:p.outputBytes-1},'render_output_budget_required');
});

test('FF79 cumulative work and output limits reject late releases and preserve all earlier effects', () => {
  const p=prepare(ff79Fixture());
  for(const limit of new Set([1,1855,1856,3711,3712,...p.calls.flatMap(c=>[c.outputBytes-1,c.outputBytes]),p.outputBytes-1]))
    if(limit<p.outputBytes)failure(ff79Fixture(),{maxOutputBytes:limit},'render_output_budget_required');
  assert.ok(prepare(ff79Fixture(),{maxOutputBytes:p.outputBytes}).handled);
  for(const maxWork of [1,10,...p.calls.map(c=>c.work),p.work-1])failure(ff79Fixture(),{maxWork},'render_work_budget_required');
  assert.ok(prepare(ff79Fixture(),{maxWork:p.work}).handled);
  for(let maxWork=1;maxWork<10;maxWork++)failure(skipFixture(),{maxWork},'render_work_budget_required');
});

test('FF79 late missing slotbytes hold earlier conversions, releases, markers and observed counters', () => {
  const data=ff79Fixture();
  for(let x=0;x<=6;x+=2)for(const byte of [0,1]){
    const p=failure(copy(data,0x7E0216+x+byte),{},'render_source_required');
    assert.equal(p.completedReleases,(6-x)/2);
  }
  for(const address of [0x7E01FE,0x7E01FF,0x7E0204,0x7E0205,0x7E2060,0x7E2061])
    failure(copy(data,address),{},'render_source_required');
});

test('FF79 every marker and both tailbytes require exact write windows after real prior calls', () => {
  const data=ff79Fixture();
  for(const omitted of [0x7E0000,0x7E0001,0x7E0200,0x7E0201,...Array.from({length:8},(_,i)=>0x7E0216+i)]){
    const windows=ff79Windows.flatMap(([lo,hi])=>omitted<lo||omitted>hi?[[lo,hi]]:
      [...(omitted>lo?[[lo,omitted-1]]:[]),...(omitted<hi?[[omitted+1,hi]]:[])]);
    const p=failure(copy(data,null,windows),{},'render_write_window_required');
    if(omitted===0x7E0200||omitted===0x7E0201)assert.equal(p.completedReleases,4);
  }
});

test('FF79 source-proved28 stackbytes and all reached source/output aliases are protected before commit', () => {
  assert.ok(prepare(ff79Fixture(),{stackWindow:[0x1000,0x101B]}).handled);
  failure(ff79Fixture(),{stackWindow:[0x1000,0x101A]},'render_stack_required');
  for(const stackWindow of [[0,27],[0x200,0x21B],[0x216,0x231],[0x23A0,0x23BB]])
    failure(ff79Fixture(),{stackWindow},'render_stack_alias_required');
  for(const extra of [{y:null},{bank:null},{status:0x20},{status:0x10},{status:8},{emulation:1},{directPage:1}])
    failure(ff79Fixture(),extra,'render_entry_required');
});

test('FF79 inner synthetic provider changes a later slot before its fresh read, with actual FA3E still executed', () => {
  const data=ff79Fixture(), before=data.snapshot(), view=prepareRenderView(data,[0x7E1F00,0x7E1FFF]);let changed=false;
  // Explicit synthetic INNER caller effect, absent from the public entry.
  const shared={read:a=>view.read(a),write(a,v){view.write(a,v);if(a===0x7E23A0&&!changed){
    changed=true;view.write(0x7E021A,0);view.write(0x7E021B,128);}}};
  const result=renderFF79(shared,ff79Entry,budget());assert.ok(result.handled);
  assert.deepEqual(result.calls.map(c=>c.slot),[6,2,0]); assert.equal(result.releases,3);
  assert.deepEqual(data.snapshot(),before);assert.ok(data.commit(view.finish(result)).handled);
  assert.equal(getWord(data,0x7E021A),0x8000);
});

test('FF79 inner results and real FA3E/AD92 results have no independently committable payload', () => {
  const data=ff79Fixture(), view=prepareRenderView(data,[0x7E1F00,0x7E1FFF]), before=data.snapshot();
  const result=renderFF79(view,ff79Entry,budget());assert.ok(result.handled);assert.deepEqual(data.snapshot(),before);
  assert.throws(()=>data.commit(result),/Invalid render plan/);assert.throws(()=>data.commit(result.calls[0]),/Invalid render plan/);
  assert.ok(data.commit(view.finish(result)).handled);
  const other=ff79Fixture();seedWord(other,0,6);const inner=prepareRenderView(other,[0x7E1F00,0x7E1FFF]);
  const released=renderFA3E(inner,ff79Entry,budget());assert.ok(released.handled);
  assert.throws(()=>other.commit(released),/Invalid render plan/);assert.throws(()=>other.commit(released.conversion),/Invalid render plan/);
});

test('FF79 immutable plans, stale/foreign owners and duplicate commits retain every effect', () => {
  const data=ff79Fixture(),p=prepare(data);assert.ok(Object.isFrozen(p));
  for(const key of ['calls','operations','byteOperations','waitOperations','stableDivisions','byteWrites'])assert.ok(Object.isFrozen(p[key]));
  assert.throws(()=>ff79Fixture().commit(p),/Invalid render plan/);
  data.seed(0x7E1000,[1]);const before=data.snapshot();assert.deepEqual(data.commit(p),{handled:false,reason:'render_plan_stale'});
  assert.deepEqual(data.snapshot(),before);
  const other=ff79Fixture(),q=prepare(other);other.commit(q);const done=other.snapshot();
  assert.deepEqual(other.commit(q),{handled:false,reason:'render_plan_stale'});assert.deepEqual(other.snapshot(),done);
});

test('FF79 malformed modes, observations, registers and budgets throw before any live effect', () => {
  for(const extra of [{y:-1},{y:65536},{divisionMode:'guess'},{waitMode:'guess'},
    {waitRead01F8:[65536]},{waitRead01F8:[null]},{waitRead01F8:Array(1)},
    {maxWork:0},{maxOutputBytes:0},{stackWindow:[0x2000,0x1000]}]){
    const data=ff79Fixture(),before=data.snapshot();
    if(extra.stackWindow)assert.equal(prepare(data,extra).reason,'render_stack_required');
    else assert.throws(()=>prepare(data,extra),/Invalid render/);
    assert.deepEqual(data.snapshot(),before);
  }
});

test('FF79 recorded public probes match fresh plans and keep all fixtures explicitly synthetic', async () => {
  const report=JSON.parse(await readFile(new URL('../analysis/render-ff79-native.json',import.meta.url)));
  assert.equal(report.probes.length,8);assert.ok(report.probes.every(p=>/synthetic/.test(p.qualification)));
  for(const row of report.probes){const data=ff79Fixture(row.fixture),p=prepare(data,row.extra);
    assert.equal(p.handled,row.result.handled);assert.equal(p.a,row.result.a);assert.equal(p.reason,row.result.reason);
    assert.equal(p.work,row.result.work);assert.equal(p.outputBytes,row.result.outputBytes);
    assert.equal(p.byteWrites?.length??0,row.plannedBytes);}
});
