import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRenderFA67, prepareRenderACBD, renderFA67, renderACBD } from '../proof/render/request-fa67.mjs';

const entry = { bank: 0x80, status: 0xC5, x: 0xABCD, y: 0xBEEF, emulation: 0,
  directPage: 0, stackWindow: [0x1F00, 0x1FFF], waitMode: 'record-observations', waitRead01F6: [0] };
const windows = [[0x7E020A, 0x7E020D], [0x7E01F6, 0x7E01F7]];
const word = (data, address, value) => data.seed(address, [value & 255, value >>> 8]);
const get = (data, address) => data.readByte(address).value | data.readByte(address + 1).value << 8;
function fixture({ index = 2, position = 0x2000, height = 0x1001, counter = 0,
  bank = 0x80, writeWindows = windows } = {}) {
  const data = createRenderData({ writeWindows });
  word(data, 0, index); word(data, 0x7E2060 + index, position);
  word(data, 0x7E20A0 + index, height); word(data, bank * 65536 + 0x1F6, counter);
  return data;
}
function failure(data, run, options, reason, phase) {
  const before = data.snapshot(), p = run({ ...entry, data, ...options });
  assert.equal(p.handled, false); assert.equal(p.reason, reason);
  if (phase) assert.equal(p.phase, phase);
  assert.deepEqual(data.snapshot(), before);
  for (const key of ['byteWrites', 'operations', 'ioWrites']) assert.equal(p[key], undefined);
  assert.throws(() => data.commit(p), /Invalid render plan/); return p;
}

test('FA67 orders three request stores then chronological full-WORD polls and external changes', () => {
  const data = fixture(), before = data.snapshot();
  const p = prepareRenderFA67({ ...entry, data, waitRead01F6: [1, 0x8000, 0, 7] });
  assert.equal(p.handled, true); assert.deepEqual(data.snapshot(), before);
  assert.equal(p.pointer, 0x5000); assert.equal(p.size, 16); assert.equal(p.requestCounter, 1);
  assert.equal(p.a, 0); assert.equal(p.x, 2); assert.equal(p.y, entry.y); assert.equal(p.status, 7);
  assert.equal(p.polls, 3); assert.equal(p.work, 12); assert.equal(p.work, p.operations.length);
  assert.deepEqual(p.operations.map(o => [o.kind, o.space, o.address, o.value]), [
    ['read', 'data', 0, 2], ['read', 'data', 0x7E2062, 0x2000], ['write', 'data', 0x80020A, 0x5000],
    ['read', 'data', 0x7E20A2, 0x1001], ['write', 'data', 0x80020C, 16],
    ['read', 'data', 0x8001F6, 0], ['write', 'data', 0x8001F6, 1],
    ['read', 'data', 0x8001F6, 1], ['write', 'external', 0x8001F6, 0x8000],
    ['read', 'data', 0x8001F6, 0x8000], ['write', 'external', 0x8001F6, 0], ['read', 'data', 0x8001F6, 0],
  ]);
  assert.deepEqual(p.ioWrites, []); assert.equal(data.commit(p).handled, true);
  assert.equal(get(data, 0x20A), 0x5000); assert.equal(get(data, 0x20C), 16); assert.equal(get(data, 0x1F6), 0);
});

test('all65536 position words retain third-ASL Carry into ADC4FFF and its signed overflow', () => {
  const data = fixture({ index: 0, height: 0 });
  for (let position = 0; position < 65536; position++) {
    word(data, 0x7E2060, position);
    const p = prepareRenderFA67({ ...entry, data }); assert.equal(p.handled, true);
    const shifted = position * 8 % 65536, carry = Math.floor(position / 8192) % 2;
    const sum = shifted + 20479 + carry, expected = sum % 65536;
    assert.equal(p.pointer, expected); assert.equal(p.carry, 0);
    assert.equal(p.overflow, Number(shifted < 32768 && expected >= 32768));
    assert.equal(p.status & 0x82, 2);
  }
});

test('all65536 size words retain fourth-ASL Carry while final wait sets N0Z1', () => {
  const data = fixture({ index: 0, position: 0x600 }); // 3000+4FFF=7FFF, V0.
  for (let height = 0; height < 65536; height++) {
    word(data, 0x7E20A0, height);
    const p = prepareRenderFA67({ ...entry, data }); assert.equal(p.handled, true);
    assert.equal(p.size, height * 16 % 65536); assert.equal(p.carry, Math.floor(height / 4096) % 2);
    assert.equal(p.overflow, 0); assert.equal(p.status & 0x82, 2);
  }
});

test('counterFFFF wraps to0 and immediate static wait succeeds without observation or completion claim', () => {
  const data = fixture({ counter: 0xFFFF }), p = prepareRenderFA67({ ...entry, data, waitMode: null, waitRead01F6: null });
  assert.equal(p.handled, true); assert.equal(p.requestCounter, 0); assert.equal(p.polls, 1); assert.equal(p.work, 8);
  assert.equal(p.operations.filter(o => o.space === 'external').length, 0); assert.equal(p.outcome, 'request_wait_prepared');
});

test('static nonzero wait rereads actual WRAM until budget, never invents clearing', () => {
  for (const maxWork of [8, 16, 100]) failure(fixture(), prepareRenderFA67,
    { waitMode: null, waitRead01F6: null, maxWork }, 'render_work_budget_required', 'wait');
});

test('a long explicit unchanged poll transcript composes without an argument-stack limit', () => {
  const count = 150000, waitRead01F6 = Array(count).fill(1); waitRead01F6.push(0);
  const p = prepareRenderFA67({ ...entry, data: fixture(), waitRead01F6, maxWork: count + 9 });
  assert.equal(p.handled, true); assert.equal(p.polls, count + 1); assert.equal(p.work, count + 9);
  assert.equal(p.operations.length, p.work);
});

test('all system DBRs mirror WRAM, unsupported DBRs reject instead of treating wait values as I/O', () => {
  for (let bank = 0; bank < 256; bank++) {
    if (!(bank & 0x40)) {
      const p = prepareRenderFA67({ ...entry, bank, data: fixture() }); assert.equal(p.handled, true);
      assert.equal(p.operations.find(o => o.kind === 'write').address, bank * 65536 + 0x20A);
    } else if (![0x7E, 0x7F].includes(bank)) {
      failure(fixture(), prepareRenderFA67, { bank }, 'render_address_required', 'request');
    }
  }
});

test('full XFFFF carries both parameter WORDs into7F; DP00 stays fixed bank00', () => {
  const data = fixture({ index: 0xFFFF, position: 1, height: 2 });
  const p = prepareRenderFA67({ ...entry, data }); assert.equal(p.handled, true);
  assert.equal(p.pointer, 0x5007); assert.equal(p.size, 32); assert.equal(p.x, 0xFFFF);
  assert.ok(p.readAddresses.includes(0x7F205F)); assert.ok(p.readAddresses.includes(0x7F209F));
});

test('DBR7F request state and counter differ from fixed7E tables and DP00', () => {
  const data = fixture({ bank: 0x7F, writeWindows: [[0x7F020A, 0x7F020D], [0x7F01F6, 0x7F01F7]] });
  const p = prepareRenderFA67({ ...entry, data, bank: 0x7F }); assert.equal(p.handled, true);
  data.commit(p); assert.equal(get(data, 0x7F020A), 0x5000); assert.equal(get(data, 0x7F01F6), 0);
  assert.equal(data.readByte(0x7E020A).available, false);
});

test('ACBD static zero read needs no write permission and preserves C/V/I/X/Y', () => {
  const data = createRenderData(); word(data, 0x1F6, 0);
  for (let status = 0; status < 256; status++) if (!(status & 0x38)) {
    const p = prepareRenderACBD({ ...entry, data, status, waitMode: null, waitRead01F6: null });
    assert.equal(p.handled, true); assert.equal(p.status, status & ~0x82 | 2);
    assert.equal(p.x, entry.x); assert.equal(p.y, entry.y); assert.equal(p.a, 0); assert.equal(p.work, 1);
    assert.deepEqual(p.byteWrites, []);
  }
});

test('ACBD observes external transition in shared overlay and subsequent reads retain final0', () => {
  const data = fixture({ counter: 3 }), view = prepareRenderView(data), budget = { work: 0, maxWork: 20 };
  const p = renderACBD(view, { ...entry, waitRead01F6: [3, 2, 0] }, budget);
  assert.equal(p.polls, 3); assert.equal(p.work, 5); assert.equal(view.read(0x1F6), 0);
  assert.throws(() => data.commit(p), /Invalid render plan/);
  const outer = view.finish(p); assert.equal(data.commit(outer).handled, true); assert.equal(get(data, 0x1F6), 0);
});

for (const [options, reason] of [
  [{ waitRead01F6: [] }, 'render_wait_read_required'], [{ waitRead01F6: [1] }, 'render_wait_read_required'],
  [{ waitRead01F6: [1, 0x8000] }, 'render_wait_read_required'], [{ waitMode: null }, 'render_wait_context_required'],
]) test(`FA67 late wait boundary ${JSON.stringify(options)}`, () => {
  failure(fixture(), prepareRenderFA67, options, reason, 'wait');
});

test('every incomplete budget discards prior request stores and external observations', () => {
  for (let maxWork = 1; maxWork < 12; maxWork++) failure(fixture(), prepareRenderFA67,
    { waitRead01F6: [1, 0x8000, 0], maxWork }, 'render_work_budget_required');
  assert.equal(prepareRenderFA67({ ...entry, data: fixture(), waitRead01F6: [1, 0x8000, 0], maxWork: 12 }).handled, true);
});

test('every source and destination byte is required, including the counter high byte', () => {
  for (const missing of [0, 1, 0x7E2062, 0x7E2063, 0x7E20A2, 0x7E20A3, 0x7E01F6, 0x7E01F7]) {
    const initial = fixture().snapshot(), data = createRenderData({ writeWindows: windows });
    for (const [a, v] of initial.bytes) if (a !== (missing < 2 ? 0x7E0000 + missing : missing)) data.seed(a, [v]);
    failure(data, prepareRenderFA67, {}, 'render_source_required', 'request');
  }
  for (const address of [0x7E020A, 0x7E020B, 0x7E020C, 0x7E020D, 0x7E01F6, 0x7E01F7]) {
    const allowed = windows.flatMap(([lo, hi]) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i))
      .filter(a => a !== address).map(a => [a, a]);
    failure(fixture({ writeWindows: allowed }), prepareRenderFA67, {}, 'render_write_window_required', 'request');
  }
});

test('external observation needs known source, write permission and stack protection', () => {
  const data = createRenderData(); word(data, 0x1F6, 1);
  failure(data, prepareRenderACBD, {}, 'render_write_window_required', 'wait');
  failure(createRenderData({ writeWindows: windows }), prepareRenderACBD, {}, 'render_source_required', 'wait');
  failure(fixture(), prepareRenderACBD, { stackWindow: [0x1F5, 0x1F7] }, 'render_stack_alias_required', 'wait');
});

test('correct minimum root/child stacks and late aliases remain explicit', () => {
  assert.equal(prepareRenderFA67({ ...entry, data: fixture(), stackWindow: [0x1FFA, 0x1FFE] }).handled, true);
  assert.equal(prepareRenderACBD({ ...entry, data: fixture(), stackWindow: [0x1FFA, 0x1FFC] }).handled, true);
  failure(fixture(), prepareRenderFA67, { stackWindow: [0x1FFA, 0x1FFD] }, 'render_stack_required');
  failure(fixture(), prepareRenderACBD, { stackWindow: [0x1FFA, 0x1FFB] }, 'render_stack_required');
  for (const stackWindow of [[0, 4], [0x20A, 0x20E], [0x1F6, 0x1FA]])
    failure(fixture(), prepareRenderFA67, { stackWindow }, 'render_stack_alias_required', 'request');
});

test('invalid/sparse/nonWORD contexts throw; unknown entry remains a boundary', () => {
  for (const options of [{ waitRead01F6: Array(1) }, { waitRead01F6: [65536] }, { waitRead01F6: [null] },
    { waitRead01F6: 0 }, { waitMode: 'execute' }, { x: -1 }, { y: 65536 }, { maxWork: 0 }])
    assert.throws(() => prepareRenderFA67({ ...entry, data: fixture(), ...options }), /Invalid/);
  for (const options of [{ bank: null }, { status: null }, { status: 0x20 }, { status: 8 }, { directPage: 1 }, { emulation: 1 }])
    failure(fixture(), prepareRenderFA67, options, 'render_entry_required');
});

test('inner request cannot commit and stale final payload cannot apply observations', () => {
  const data = fixture(), p = renderFA67(prepareRenderView(data), entry, { work: 0, maxWork: 100 });
  assert.throws(() => data.commit(p), /Invalid render plan/);
  const plan = prepareRenderFA67({ ...entry, data }); word(data, 0x1F6, 5); const before = data.snapshot();
  assert.deepEqual(data.commit(plan), { handled: false, reason: 'render_plan_stale' }); assert.deepEqual(data.snapshot(), before);
});

test('native probe separates chronological success, wrap success and atomic exhaustion', async () => {
  const r = JSON.parse(await readFile('analysis/render-fa67-native.json', 'utf8'));
  assert.match(r.scope, /synthetic/); assert.match(r.scope, /No device\/time\/interrupt/);
  assert.deepEqual(r.probes.map(p => p.handled), [true, true, false]);
  assert.equal(r.probes[2].reason, 'render_wait_read_required'); assert.equal(r.probes[2].byteWrites, undefined);
});
