import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRenderB0D1, renderB0D1 } from '../proof/render/fade-b0d1.mjs';
import { renderC06B } from '../proof/render/object-c06b.mjs';

const entry = { bank: 0x80, status: 0xC5, x: 0x1234, y: 0xBEEF,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF] };
const seedWord = (d, a, v) => d.seed(a, [v & 255, v >>> 8]);
const word = (d, a) => d.readByte(a).value | d.readByte(a + 1).value << 8;
function fixture({ gate = 0xFFFE, countdown = 1, brightness = 0x8F, bank = 0x80,
  writeWindows = [[0x7E01BC, 0x7E01BC], [0x7E01C6, 0x7E01C9]], missing = [] } = {}) {
  const base = bank * 65536, data = createRenderData({ writeWindows });
  for (const [a, v] of [[base + 0x1C6, gate & 255], [base + 0x1C7, gate >>> 8],
    [base + 0x1C8, countdown & 255], [base + 0x1C9, countdown >>> 8], [base + 0x1BC, brightness]])
    if (!missing.includes(a)) data.seed(a, [v]);
  return data;
}
const prepare = (data, options = {}) => prepareRenderB0D1({ ...entry, data, ...options });
const commit = (data, p) => { assert.ok(p.handled, JSON.stringify(p)); assert.deepEqual(data.commit(p), { handled: true }); };
function unchanged(data, options, reason, phase) {
  const before = data.snapshot(), p = prepare(data, options);
  assert.equal(p.handled, false); assert.equal(p.reason, reason);
  if (phase) assert.equal(p.phase, phase);
  for (const key of ['operations', 'ioWrites', 'byteWrites']) assert.equal(p[key], undefined);
  assert.deepEqual(data.snapshot(), before); return p;
}
test('B0D1 probes pin73/33 originalsource separately from nine syntheticfixtures', async () => {
  const source = JSON.parse(await readFile(new URL('../analysis/render-b0d1.json', import.meta.url), 'utf8'));
  const report = JSON.parse(await readFile(new URL('../analysis/render-b0d1-native.json', import.meta.url), 'utf8'));
  assert.equal(report.source.sha256, '811110aca0601f2335cdf40a7e876bf3e56020e25f205a9cfc675ff8dbf757af');
  assert.deepEqual(report.source, source.windows[0]); assert.equal(report.probes.length, 9); assert.match(report.scope, /synthetic/);
  for (const old of report.probes) {
    const f = old.fixture, missing = f.gate === 0 ? [0x1C8, 0x1C9, 0x1BC] : f.countdown !== 1 ? [0x1BC] : [];
    const data = fixture({ ...f, writeWindows: old.writeWindows, missing: missing.map(a => f.bank * 65536 + a) });
    assert.deepEqual(prepare(data, { bank: f.bank }), Object.fromEntries(Object.entries(old).filter(([key]) => !['fixture', 'writeWindows'].includes(key))));
  }
});
test('Gate0 needs just two sourcebytes, no countdown/brightness or writeownership', () => {
  const data = createRenderData(); seedWord(data, 0x1C6, 0); const p = prepare(data);
  assert.equal(p.outcome, 'gate_zero'); assert.equal(p.a, 0); assert.equal(p.status, 0x47); assert.equal(p.work, 1);
  assert.deepEqual(p.byteWrites, []); assert.deepEqual(p.ioWrites, []); assert.deepEqual(p.readAddresses, [0x7E01C6, 0x7E01C7]);
});
test('All65536 countdown WORDs wrap, expire only1, retain gateA and DECmemoryNZ on earlyreturn', () => {
  const data = fixture({ gate: 0xFFFF, brightness: 2 });
  for (let countdown = 0; countdown <= 65535; countdown++) {
    seedWord(data, 0x1C8, countdown); const p = prepare(data), decremented = (countdown + 65535) % 65536;
    assert.ok(p.handled);
    if (countdown === 1) { assert.equal(p.outcome, 'brightness_decreased'); assert.equal(p.a, 1); assert.equal(p.period, 1); }
    else {
      assert.equal(p.outcome, 'countdown_prepared'); assert.equal(p.a, 65535);
      assert.equal(p.status, 0x45 | (decremented >= 32768 ? 128 : 0)); assert.equal(p.work, 3);
      assert.deepEqual(p.byteWrites, [[0x7E01C8, decremented & 255], [0x7E01C9, decremented >>> 8]]);
    }
  }
});
test('All65536 gates retain signedperiod negation/highA including8000 without absolutevalue clamp', () => {
  const data = fixture();
  for (let gate = 0; gate <= 65535; gate++) {
    seedWord(data, 0x1C6, gate); data.seed(0x1BC, [gate >= 32768 ? 1 : 0]); const p = prepare(data);
    assert.ok(p.handled);
    if (gate === 0) { assert.equal(p.outcome, 'gate_zero'); continue; }
    const magnitude = gate >= 32768 ? 65536 - gate : gate;
    assert.equal(p.period, magnitude); assert.equal(p.a, (Math.floor(magnitude / 256) * 256) + (gate >= 32768 ? 0 : 1));
    assert.equal(p.status, gate >= 32768 ? 0x47 : 0x44); assert.equal(p.x, entry.x); assert.equal(p.y, entry.y);
  }
});
test('Every brightnessBYTE chooses nibble endpoints but modifies fullfreshBYTE with asymmetric masks', () => {
  for (const gate of [0x8000, 0x7FFF]) {
    const data = fixture({ gate });
    for (let brightness = 0; brightness <= 255; brightness++) {
      data.seed(0x1BC, [brightness]); const p = prepare(data), nibble = brightness % 16;
      const endpoint = gate === 0x8000 ? nibble === 0 : nibble === 15;
      assert.equal(p.outcome, endpoint ? 'fade_stopped' : gate === 0x8000 ? 'brightness_decreased' : 'brightness_increased');
      const low = endpoint ? nibble : gate === 0x8000 ? brightness - 1 : (brightness + 1) % 128;
      assert.equal(p.a, (gate === 0x8000 ? 0x8000 : 0x7F00) + low);
      assert.equal(p.status, endpoint ? gate === 0x8000 ? 0x47 : 0x47 : gate === 0x8000 ? 0x45 | (low === 0 ? 2 : 0) | (low >= 128 ? 128 : 0) : 0x44 | (low === 0 ? 2 : 0));
      assert.equal(p.operations.filter(e => e.kind === 'read' && (e.address & 65535) === 0x1BC).length, endpoint ? 1 : 2);
    }
  }
});
test('Positive nibbleF returns nonzeroA withZ1 and clearsgate only after reloadingcount', () => {
  const data = fixture({ gate: 1, brightness: 0xFF }), p = prepare(data);
  assert.equal(p.a, 15); assert.equal(p.status, 0x47); assert.equal(p.carry, 1); assert.equal(p.work, 7);
  assert.equal(p.operations.at(-1).address, 0x8001C6); assert.equal(p.operations.at(-1).value, 0);
  commit(data, p); assert.equal(word(data, 0x1C6), 0); assert.equal(word(data, 0x1C8), 1); assert.equal(data.readByte(0x1BC).value, 255);
});
test('Negative8000/brightness80 stop returnsA8000 withN0/Z1 and leaves fullBYTEbrightness intact', () => {
  const data = fixture({ gate: 0x8000, brightness: 0x80 }), p = prepare(data);
  assert.equal(p.a, 0x8000); assert.equal(p.status, 0x47); commit(data, p);
  assert.equal(word(data, 0x1C8), 0x8000); assert.equal(data.readByte(0x1BC).value, 128);
});
test('All valid incoming statuses preserveV/I and negativeCarry; positive replacesCarry only onexpiration', () => {
  for (let status = 0; status <= 255; status++) {
    if (status & 0x38) continue;
    for (const [gate, countdown, brightness, nz, carry] of [[0, 1, 0, 2, status & 1], [0xFFFF, 2, 0, 0, status & 1],
      [0xFFFF, 0, 0, 128, status & 1], [0xFFFE, 1, 0x8F, 128, status & 1], [0xFFFE, 1, 0, 2, status & 1],
      [1, 1, 15, 2, 1], [1, 1, 0, 0, 0]]) {
      const p = prepare(fixture({ gate, countdown, brightness }), { status });
      assert.equal(p.status, (status & 0x7C) | nz | carry); assert.equal(p.overflow, status >>> 6 & 1);
    }
  }
});
test('Fresh gate/countdown/reload/BYTEreads interleave writes and require no brightnesshighbyte', () => {
  const data = fixture(), before = data.snapshot(), p = prepare(data);
  assert.deepEqual(data.snapshot(), before); assert.deepEqual(p.operations.map(e => [e.kind, e.address & 65535, e.value, e.bytes]),
    [['read', 0x1C6, 0xFFFE, 2], ['read', 0x1C8, 1, 2], ['write', 0x1C8, 0, 2], ['read', 0x1C6, 0xFFFE, 2],
      ['write', 0x1C8, 2, 2], ['read', 0x1BC, 0x8F, 1], ['read', 0x1BC, 0x8F, 1], ['write', 0x1BC, 0x8E, 1]]);
  assert.equal(data.readByte(0x1BD).available, false); assert.deepEqual(p.ioWrites, []); assert.equal(p.work, 8);
});
test('All128 systembanks and physical7E/7F read/write actual shared sourceowners withoutIOmode', () => {
  for (let bank = 0; bank < 256; bank++) {
    if (bank & 0x40 && bank !== 0x7E && bank !== 0x7F) continue;
    const base = bank === 0x7F ? 0x7F0000 : 0x7E0000;
    const data = fixture({ bank, writeWindows: [[base + 0x1BC, base + 0x1BC], [base + 0x1C6, base + 0x1C9]] });
    const p = prepare(data, { bank }); assert.ok(p.handled); assert.equal(p.operations[0].address, bank * 65536 + 0x1C6);
    commit(data, p); assert.equal(word(data, base + 0x1C8), 2); assert.equal(data.readByte(base + 0x1BC).value, 0x8E);
  }
});
test('Every reached missing sourcebyte leaves decrement/reload and all other data uncommitted', () => {
  for (const a of [0x8001C6, 0x8001C7, 0x8001C8, 0x8001C9, 0x8001BC])
    unchanged(fixture({ missing: [a] }), {}, 'render_source_required', a >= 0x8001C6 && a <= 0x8001C7 ? 'gate' : a === 0x8001BC ? 'brightness' : 'countdown');
});
test('Countdown and BYTEbrightness ownership failures roll back at their exact reached phase', () => {
  for (const writeWindows of [[], [[0x7E01C8, 0x7E01C8]], [[0x7E01C9, 0x7E01C9]]])
    unchanged(fixture({ writeWindows }), {}, 'render_write_window_required', 'countdown');
  unchanged(fixture({ writeWindows: [[0x7E01C8, 0x7E01C9]] }), {}, 'render_write_window_required', 'brightness');
});
test('Both stoppinggate bytes require ownership, while endpoint does not writebrightness', () => {
  for (const gate of [1, 0xFFFF]) for (const permitted of [[], [0x7E01C6], [0x7E01C7]]) {
    const writeWindows = [[0x7E01C8, 0x7E01C9], ...permitted.map(a => [a, a])];
    unchanged(fixture({ gate, brightness: gate === 1 ? 15 : 0, writeWindows }), {}, 'render_write_window_required', 'stop');
  }
  assert.ok(prepare(fixture({ gate: 1, brightness: 15, writeWindows: [[0x7E01C6, 0x7E01C9]] })).handled);
});
test('Exactwork thresholds1/3/7/8 include every read/write; all lowerbudgets withhold previouswrites', () => {
  for (const [gate, countdown, brightness, work] of [[0, 1, 0, 1], [1, 2, 0, 3], [1, 1, 15, 7], [1, 1, 0, 8], [0xFFFF, 1, 0, 7], [0xFFFF, 1, 1, 8]]) {
    const data = fixture({ gate, countdown, brightness });
    for (let maxWork = 1; maxWork < work; maxWork++) unchanged(data, { maxWork }, 'render_work_budget_required');
    assert.equal(prepare(data, { maxWork: work }).work, work);
  }
});
test('Three protectedJSLbytes and source/write stackexclusion are required at reachedphases', () => {
  assert.ok(prepare(fixture(), { stackWindow: [0x1FFD, 0x1FFF] }).handled);
  for (const stackWindow of [null, [0x1FFE, 0x1FFF]]) unchanged(fixture(), { stackWindow }, 'render_stack_required');
  for (const [stackWindow, phase] of [[[0x1C5, 0x1C7], 'gate'], [[0x1C8, 0x1CA], 'countdown'], [[0x1BA, 0x1BC], 'brightness']])
    unchanged(fixture(), { stackWindow }, 'render_stack_alias_required', phase);
});
test('Explicitentry, malformed arguments and unsupportedbanks stop without writing', () => {
  for (const options of [{ bank: null }, { status: null }, { status: 0x20 }, { status: 0x10 }, { status: 8 }, { emulation: 1 }, { directPage: 1 }])
    unchanged(fixture(), options, 'render_entry_required');
  for (const options of [{ x: -1 }, { y: 65536 }, { maxWork: 0 }]) assert.throws(() => prepare(fixture(), options));
  unchanged(fixture(), { bank: 0x40 }, 'render_address_required', 'gate');
});
test('Explicit repeated commits decrement loadedperiod and reach stop onfollowing expiration', () => {
  const data = fixture({ gate: 0xFFFE, brightness: 1 });
  const first = prepare(data); commit(data, first); assert.equal(word(data, 0x1C8), 2); assert.equal(data.readByte(0x1BC).value, 0);
  const second = prepare(data); assert.equal(second.outcome, 'countdown_prepared'); commit(data, second);
  const third = prepare(data); assert.equal(third.outcome, 'fade_stopped'); commit(data, third);
  assert.equal(prepare(data).outcome, 'gate_zero'); assert.equal(word(data, 0x1C8), 2);
});
test('Shared outer WORD01BC/period/countdown writes feed fresh bytes and sole privatecommit', () => {
  const data = fixture({ writeWindows: [[0x7E01BC, 0x7E01BD], [0x7E01C6, 0x7E01C9]] });
  const view = prepareRenderView(data, [0x7E1F00, 0x7E1FFF]), budget = { work: 0, maxWork: 8 };
  view.write(0x1C6, 0); view.write(0x1C7, 1); view.write(0x1BC, 0x80); view.write(0x1BD, 0xAB);
  const inner = renderB0D1(view, entry, budget); assert.equal(inner.gate, 0x100); assert.equal(inner.a, 0x101);
  assert.throws(() => data.commit(inner)); commit(data, view.finish(inner)); assert.equal(word(data, 0x1BC), 0xAB01);
});
test('LateB0D1 source/budget failures withhold earlierC06B requests and its gateclear', () => {
  for (const missing of [true, false]) {
    const data = fixture({ missing: missing ? [0x8001BC] : [], writeWindows: [[0x7E01BC, 0x7E01BC], [0x7E01C6, 0x7E01C9], [0x7E01E8, 0x7E01E9]] });
    seedWord(data, 0x1E8, 1); seedWord(data, 0x1D8, 0); data.seed(0x1D5, [0x80]);
    const before = data.snapshot(), view = prepareRenderView(data, [0x7E1F00, 0x7E1FFF]), budget = { work: 0, maxWork: missing ? 100 : 25 };
    const first = renderC06B(view, { ...entry, ioMode: 'record-requests' }, budget); assert.equal(first.ioWrites.length, 14);
    assert.throws(() => renderB0D1(view, { ...entry, status: first.status }, budget), e => e.renderBoundary
      && e.reason === (missing ? 'render_source_required' : 'render_work_budget_required') && e.phase === 'brightness');
    assert.deepEqual(data.snapshot(), before);
  }
});
test('Successful C06B/B0D1 sharedplan applies both clears/data and propagates flags', () => {
  const data = fixture({ gate: 1, brightness: 15, writeWindows: [[0x7E01C6, 0x7E01C9], [0x7E01E8, 0x7E01E9]] });
  seedWord(data, 0x1E8, 1); seedWord(data, 0x1D8, 0); data.seed(0x1D5, [128]);
  const view = prepareRenderView(data, [0x7E1F00, 0x7E1FFF]), budget = { work: 0, maxWork: 25 };
  const first = renderC06B(view, { ...entry, ioMode: 'record-requests' }, budget);
  const last = renderB0D1(view, { ...entry, status: first.status }, budget);
  assert.equal(last.status, 0x47); commit(data, view.finish(last)); assert.equal(word(data, 0x1E8), 0); assert.equal(word(data, 0x1C6), 0);
});
test('Immutable publicplans, owner/revision validation and two preparedplans retain commitownership', () => {
  const data = fixture(), p = prepare(data); assert.throws(() => fixture().commit(p)); assert.ok(Object.isFrozen(p.operations[0]));
  assert.throws(() => { p.byteWrites[0][1] = 255; }); data.seed(0x1BC, [1]); assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' });
  const first = prepare(data), second = prepare(data); commit(data, first); assert.deepEqual(data.commit(second), { handled: false, reason: 'render_plan_stale' });
});
