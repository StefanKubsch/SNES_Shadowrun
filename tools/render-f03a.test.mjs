import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRenderF03A, renderF03A } from '../proof/render/pair-f03a.mjs';
import { prepareRenderF007 } from '../proof/render/apu-f007.mjs';
import { pairEntry, pairFixture } from './render-f03a-fixtures.mjs';
const prepare = (data, options = {}) => prepareRenderF03A({ ...pairEntry, data, ...options });
function fail(data, options, reason, phase) {
  const before = data.snapshot(), p = prepare(data, options);
  assert.equal(p.handled, false); assert.equal(p.reason, reason); if (phase) assert.equal(p.phase, phase);
  for (const key of ['byteWrites', 'operations', 'ioReads', 'ioWrites', 'ioRequests']) assert.equal(p[key], undefined);
  assert.deepEqual(data.snapshot(), before); return p;
}
const bytes = p => p.operations.map(e => [e.kind, e.space, e.address & 65535, e.value, e.bytes]);

test('F03A buffers all65536 fullA values preserving hiddenhighA and original DEC BYTEflags', () => {
  const data = pairFixture({ flag: 0 });
  for (let a = 0; a < 65536; a++) {
    const p = prepare(data, { a, ioMode: null, ioRead2140: null });
    assert.ok(p.handled); assert.equal(p.a, a); assert.equal(p.status, pairEntry.status & ~0x82 | 0x80);
    assert.equal(p.x, pairEntry.x); assert.equal(p.y, pairEntry.y); assert.equal(p.bank, pairEntry.bank);
    assert.equal(p.work, 4); assert.equal(p.polls, 0); assert.deepEqual(p.ioRequests, []);
    assert.deepEqual(p.byteWrites, [[0x7E1CE7, a & 255], [0x7E1CE6, 255]]);
  }
});
test('F03A sends all65536 fullA values with saved incomingBYTE and actual XBA return', () => {
  const data = pairFixture();
  for (let a = 0; a < 65536; a++) {
    const p = prepare(data, { a }); assert.ok(p.handled);
    assert.equal(p.a, (a & 255) * 256 + 0x13); assert.equal(p.status, pairEntry.status & ~0x83 | 1);
    assert.equal(p.x, pairEntry.x); assert.equal(p.y, pairEntry.y); assert.equal(p.bank, pairEntry.bank);
    assert.deepEqual(p.ioWrites.map(e => [e.address & 65535, e.value, e.bytes]),
      [[0x2141, 0x56, 1], [0x2142, a & 255, 1], [0x2140, 0x13, 1]]);
  }
});
test('F03A all256 tokens and buffered bytes preserve wrap/NZ and no WORD write to2143', () => {
  for (let token = 0; token < 256; token++) {
    const data = pairFixture({ token });
    for (let buffer = 0; buffer < 256; buffer++) {
      data.seed(0x1CE7, [buffer]); const p = prepare(data, { a: 0xEF00, ioRead2140: [token] });
      assert.ok(p.handled); const next = (token + 1) % 256;
      assert.equal(p.a, next); assert.equal(p.status, 0x65 | (next === 0 ? 2 : next >= 128 ? 128 : 0));
      assert.equal(p.firstByte, buffer); assert.equal(p.nextToken, next); assert.equal(p.work, 9);
      assert.ok(p.operations.every(e => e.bytes === 1)); assert.equal(data.readByte(0x2143).available, false);
    }
  }
});
test('F03A every nonzero BYTEflag selects pair path and clears only lowflag', () => {
  for (let flag = 1; flag < 256; flag++) {
    const data = pairFixture({ flag }); data.seed(0x1CE8, [0xBC]); data.seed(0x1CE5, [0xDE]);
    const p = prepare(data); assert.equal(p.buffered, false); assert.equal(p.pairFlag, flag);
    assert.deepEqual(data.commit(p), { handled: true });
    assert.equal(data.readByte(0x1CE6).value, 0); assert.equal(data.readByte(0x1CE7).value, 0x56);
    assert.equal(data.readByte(0x1CE8).value, 0xBC); assert.equal(data.readByte(0x1CE5).value, 0xDE);
  }
});
test('F03A all admissible BYTEstatuses preserve V/I/M and actual C/N/Z per branch', () => {
  for (let status = 0; status < 256; status++) {
    if ((status & 0x38) !== 0x20) continue;
    for (const token of [0, 127, 254, 255]) for (const flag of [0, 1]) {
      const p = prepare(pairFixture({ token, flag }), { status, a: 0, ioRead2140: [255 - token, token] });
      assert.ok(p.handled); const next = (token + 1) % 256;
      assert.equal(p.status, flag ? (status & ~0x83 | 1 | (next === 0 ? 2 : next >= 128 ? 128 : 0))
        : (status & ~0x82 | 128)); assert.equal(p.overflow, status >>> 6 & 1);
    }
  }
});
test('F03A original access order retains one tokenread and only reads buffer after actual matching poll', () => {
  const data = pairFixture(), before = data.snapshot(), p = prepare(data, { ioRead2140: [0, 255, 0x12, 0] });
  assert.deepEqual(data.snapshot(), before); assert.equal(p.polls, 3); assert.equal(p.apuPolls, 3);
  assert.deepEqual(bytes(p), [['read','data',0x1CE6,1,1], ['write','data',0x1CE6,0,1],
    ['read','data',0x1CE4,0x12,1], ['read','io',0x2140,0,1], ['read','io',0x2140,255,1],
    ['read','io',0x2140,0x12,1], ['read','data',0x1CE7,0x56,1],
    ['write','io',0x2141,0x56,1], ['write','io',0x2142,0x34,1], ['write','io',0x2140,0x13,1],
    ['write','data',0x1CE4,0x13,1]]);
});
test('F03A buffer branch needs only flag source, window and no token/buffer/device source', () => {
  const data = createRenderData({ writeWindows: [[0x7E1CE6, 0x7E1CE7]] }); data.seed(0x1CE6, [0]);
  const p = prepare(data, { ioMode: null, ioRead2140: null }); assert.ok(p.handled);
  assert.deepEqual(bytes(p), [['read','data',0x1CE6,0,1], ['write','data',0x1CE7,0x34,1],
    ['read','data',0x1CE6,0,1], ['write','data',0x1CE6,255,1]]);
  assert.deepEqual(p.readAddresses, [0x7E1CE6]); assert.equal(p.a, 0xAB34);
});
test('F03A every required source byte including late buffer leaves no prior clear/requests', () => {
  for (const missing of [0x1CE6, 0x1CE4, 0x1CE7]) {
    const data = createRenderData({ writeWindows: [[0x7E1CE4, 0x7E1CE7]] });
    for (const [address, value] of [[0x1CE6,1], [0x1CE4,0x12], [0x1CE7,0x56]])
      if (address !== missing) data.seed(address, [value]);
    const p = fail(data, {}, 'render_source_required'); assert.equal(p.address, 0x7E0000 + missing);
  }
});
test('F03A exhausted/missing BYTEpolls and IOcontext discard early flagclear', () => {
  for (const ioRead2140 of [null, [], [0], [0, 255]]) fail(pairFixture(), { ioRead2140 }, 'render_io_read_required', 'poll');
  fail(pairFixture(), { ioMode: null }, 'render_io_context_required', 'poll');
});
test('F03A all cumulative work prefixes and exact budgets for both branches', () => {
  for (const flag of [0, 1]) {
    const work = flag ? 11 : 4;
    for (let maxWork = 1; maxWork < work; maxWork++)
      fail(pairFixture({ flag }), { maxWork, ioRead2140: [0, 255, 0x12] }, 'render_work_budget_required');
    assert.ok(prepare(pairFixture({ flag }), { maxWork: work, ioRead2140: [0, 255, 0x12] }).handled);
  }
});
test('F03A each writewindow including late tokenstore discards all effects', () => {
  for (const [flag, targets] of [[0,[0x1CE6,0x1CE7]], [1,[0x1CE6,0x1CE4]]]) {
    for (const missing of targets) {
      const writeWindows = targets.filter(a => a !== missing).map(a => [0x7E0000+a, 0x7E0000+a]);
      fail(pairFixture({ flag, writeWindows }), {}, 'render_write_window_required');
    }
  }
});
test('F03A all256 DBRs preserve actual entrybank and use only source-supported mapping', () => {
  for (let bank = 0; bank < 256; bank++) {
    if (bank & 0x40 && bank !== 0x7E && bank !== 0x7F) {
      fail(pairFixture(), { bank }, 'render_address_required', 'flag'); continue;
    }
    const p = prepare(pairFixture({ bank }), { bank }); assert.ok(p.handled); assert.equal(p.bank, bank);
    assert.equal(p.operations[0].address, bank * 65536 + 0x1CE6);
    if (bank !== 0x7E && bank !== 0x7F) assert.equal(p.ioReads[0].address, bank * 65536 + 0x2140);
  }
});
test('F03A physical7E/7F registers use actual BYTEsources/windows and consume no external polls', () => {
  for (const bank of [0x7E, 0x7F]) {
    const data = pairFixture({ bank, token: 255 }), p = prepare(data, { bank, ioMode: null, ioRead2140: [0] });
    assert.ok(p.handled); assert.equal(p.apuPolls, 0); assert.equal(p.polls, 1); assert.equal(p.a, 0x3400);
    assert.equal(p.status, 0x67); assert.deepEqual(p.ioRequests, []); assert.deepEqual(data.commit(p), { handled: true });
    const base = bank * 65536;
    assert.deepEqual([0x1CE4,0x1CE6,0x1CE7,0x2140,0x2141,0x2142].map(a => data.readByte(base+a).value),
      [0,0,0x56,0,0x56,0x34]); assert.equal(data.readByte(base+0x2143).available, false);
  }
});
test('F03A physical mismatched poll rereads real source until budget, samples cannot rescue it', () => {
  for (const bank of [0x7E, 0x7F]) fail(pairFixture({ bank, poll: 0 }),
    { bank, maxWork: 12, ioRead2140: [0x12] }, 'render_work_budget_required', 'poll');
  const data = createRenderData({ writeWindows: [[0x7E1CE6,0x7E1CE6]] });
  data.seed(0x1CE6,[1]); data.seed(0x1CE4,[0x12]);
  fail(data, { bank: 0x7E }, 'render_source_required', 'poll');
});
test('F03A each physical register window including late2140/store is atomic', () => {
  for (const bank of [0x7E,0x7F]) for (const missing of [0x1CE6,0x2141,0x2142,0x2140,0x1CE4]) {
    const base = bank * 65536, writeWindows = [0x1CE6,0x2141,0x2142,0x2140,0x1CE4]
      .filter(a => a !== missing).map(a => [base+a,base+a]);
    fail(pairFixture({ bank, writeWindows }), { bank }, 'render_write_window_required');
  }
});
test('F03A three protected stackbytes include root RTS/PHA and every accessed stack alias rejects', () => {
  assert.ok(prepare(pairFixture(), { stackWindow: [0x1FFD,0x1FFF] }).handled);
  fail(pairFixture(), { stackWindow: [0x1FFE,0x1FFF] }, 'render_stack_required');
  for (const address of [0x1CE4,0x1CE6,0x1CE7])
    fail(pairFixture(), { stackWindow: [address,address+2] }, 'render_stack_alias_required');
  fail(pairFixture({ bank: 0x7E }), { bank: 0x7E, stackWindow: [0x2140,0x2142] }, 'render_stack_alias_required', 'poll');
});
test('F03A inner pairs share fresh overlay/global poll positions/cumulative budget with one outer commit', () => {
  const data = pairFixture({ flag: 0, token: 255 }), before = data.snapshot();
  const view = prepareRenderView(data, [0x7E1F00,0x7E1FFF]), budget = { work: 7, maxWork: 100 };
  const observations = { apuPolls: 1 }, context = { ...pairEntry, observations, ioRead2140: [255,0,255] };
  const first = renderF03A(view, { ...context, a: 0xAB78 }, budget); assert.equal(first.a, 0xAB78);
  view.write(0x1CE7, 0x9A); view.write(0x1CE4, 255);
  const second = renderF03A(view, { ...context, ...first, a: 0xCD56 }, budget);
  assert.equal(second.firstByte, 0x9A); assert.equal(second.a, 0x5600); assert.equal(second.polls, 2);
  assert.equal(observations.apuPolls, 3); assert.equal(second.work, 21);
  assert.deepEqual(data.snapshot(), before); assert.throws(() => data.commit(first)); assert.throws(() => data.commit(second));
  assert.deepEqual(data.commit(view.finish(second)), { handled: true }); assert.equal(data.readByte(0x1CE4).value, 0);
});
test('F03A late inner boundary withholds outer writes and buffered firstBYTE', () => {
  const data = pairFixture({ flag: 0 }), before = data.snapshot(), view = prepareRenderView(data);
  const budget = { work: 0, maxWork: 100 };
  renderF03A(view, pairEntry, budget); view.write(0x1CE4,255);
  assert.throws(() => renderF03A(view, { ...pairEntry, ioRead2140: [0] }, budget),
    e => e.reason === 'render_io_read_required' && e.phase === 'poll'); assert.deepEqual(data.snapshot(), before);
});
test('F03A stale/foreign/repeated plans cannot commit; consecutive public BYTE calls use new flag/token', () => {
  const data = pairFixture({ flag: 0 }), first = prepare(data);
  assert.throws(() => pairFixture().commit(first)); assert.deepEqual(data.commit(first), { handled: true });
  assert.deepEqual(data.commit(first), { handled: false, reason: 'render_plan_stale' });
  const second = prepare(data, { a: 0x5678 }); assert.equal(second.firstByte,0x34);
  assert.equal(second.a,0x7813); assert.deepEqual(data.commit(second),{handled:true});
  const third = prepare(data); assert.equal(third.buffered,true); data.seed(0x1CE7,[0]);
  assert.deepEqual(data.commit(third), { handled:false,reason:'render_plan_stale' });
});
test('F03A BYTE-only entry remains explicit and existing public F007 still requires WORD entry', () => {
  for (const options of [{a:null},{x:null},{y:null},{bank:null},{status:null},{status:0},{status:16},
    {status:0x28},{status:0x30},{emulation:1},{directPage:1}]) fail(pairFixture(),options,'render_entry_required');
  const old = prepareRenderF007({ ...pairEntry, data: pairFixture() }); assert.equal(old.reason,'render_entry_required');
  for (const options of [{a:-1},{x:65536},{y:0.5},{bank:256},{status:256},{status:32.5},{maxWork:0},
    {ioMode:'execute'},{ioRead2140:[256]},{ioRead2140:Array(1)},{ioRead2140:0}])
    assert.throws(() => prepare(pairFixture(),options));
});
test('F03A probe records explicitly synthetic BYTE/stack/poll evidence and atomic late boundaries', async () => {
  const report = JSON.parse(await readFile('analysis/render-f03a-native.json', 'utf8'));
  assert.match(report.scope, /explicitly synthetic/); assert.match(report.scope, /No audio\/device\/CPU\/clock/);
  assert.equal(report.source.covered_bytes,45); assert.equal(report.source.instruction_count,21);
  assert.equal(report.stackProof.entry_m,1); assert.equal(report.stackProof.minimum_protected_stack_bytes,3);
  assert.equal(report.stackProof.external_return_assumptions,0); assert.equal(report.probes.length,6);
  assert.deepEqual(report.probes.map(p=>p.handled),[true,true,true,true,false,false]);
  assert.equal(report.probes[0].a,0xAB00); assert.equal(report.probes[2].a,0xFF00);
  assert.equal(report.probes[3].ioWrites.length,0);
  for (const p of report.probes.slice(4)) assert.equal(p.operations,undefined);
});
