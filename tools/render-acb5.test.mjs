import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRenderACB5, prepareRenderACAF, renderACB5, renderACAF } from '../proof/render/request-acb5.mjs';
import { renderFA67 } from '../proof/render/request-fa67.mjs';

const entry = { bank: 0x80, status: 0xC5, x: 0x1234, y: 0xBEEF, emulation: 0,
  directPage: 0, stackWindow: [0x1F00, 0x1FFF], waitMode: 'record-observations', waitRead01F8: [0] };
const word = (data, address, value) => data.seed(address, [value & 255, value >>> 8]);
const get = (data, address) => data.readByte(address).value | data.readByte(address + 1).value << 8;
function fixture(counter = 0, bank = 0x80, windows = [[0x7E01F8, 0x7E01F9]]) {
  const data = createRenderData({ writeWindows: windows }); word(data, bank * 65536 + 0x1F8, counter); return data;
}
function failure(data, run, options, reason, phase) {
  const before = data.snapshot(), p = run({ ...entry, data, ...options });
  assert.equal(p.handled, false); assert.equal(p.reason, reason);
  if (phase) assert.equal(p.phase, phase);
  assert.deepEqual(data.snapshot(), before);
  for (const key of ['byteWrites', 'operations', 'ioWrites']) assert.equal(p[key], undefined);
  assert.throws(() => data.commit(p), /Invalid render plan/);
}

test('ACB5 records full WORD increment, external transitions and first-zero return in one atomic plan', () => {
  const data = fixture(), before = data.snapshot();
  const p = prepareRenderACB5({ ...entry, data, waitRead01F8: [1, 0x100, 0, 9] });
  assert.equal(p.handled, true); assert.deepEqual(data.snapshot(), before); assert.equal(p.requestCounter, 1);
  assert.equal(p.a, 0); assert.equal(p.x, entry.x); assert.equal(p.y, entry.y); assert.equal(p.status, 0x47);
  assert.equal(p.polls, 3); assert.equal(p.work, 7);
  assert.deepEqual(p.operations.map(o => [o.kind, o.space, o.value, o.phase]), [
    ['read', 'data', 0, 'request'], ['write', 'data', 1, 'request'], ['read', 'data', 1, 'wait'],
    ['write', 'external', 0x100, 'wait'], ['read', 'data', 0x100, 'wait'],
    ['write', 'external', 0, 'wait'], ['read', 'data', 0, 'wait'],
  ]);
  assert.ok(p.operations.every(o => o.address === 0x8001F8 && o.bytes === 2));
  assert.deepEqual(p.ioWrites, []); assert.equal(p.work, p.operations.length);
  assert.equal(data.commit(p).handled, true); assert.equal(get(data, 0x1F8), 0);
});

test('all65536 counter words increment as WORD, retaining incoming C/V and preserved X/Y', () => {
  const data = fixture();
  for (let counter = 0; counter < 65536; counter++) {
    word(data, 0x1F8, counter);
    const p = prepareRenderACB5({ ...entry, data }); assert.equal(p.handled, true);
    assert.equal(p.requestCounter, (counter + 1) % 65536); assert.equal(p.status, 0x47);
    assert.equal(p.x, entry.x); assert.equal(p.y, entry.y);
    assert.equal(p.work, counter === 65535 ? 3 : 4);
  }
});

test('all65536 wait words branch on full WORD zero, including high-byte-only busy values', () => {
  const data = fixture();
  for (let value = 0; value < 65536; value++) {
    word(data, 0x1F8, value);
    const p = prepareRenderACAF({ ...entry, data, waitRead01F8: [value] });
    if (value) { assert.equal(p.handled, false); assert.equal(p.reason, 'render_wait_read_required'); }
    else { assert.equal(p.handled, true); assert.equal(p.polls, 1); assert.equal(p.work, 1); }
  }
});

test('counterFFFF wraps to0 with static wait; persistent nonzero never becomes inferred acknowledgment', () => {
  const data = fixture(0xFFFF), p = prepareRenderACB5({ ...entry, data, waitMode: null, waitRead01F8: null });
  assert.equal(p.handled, true); assert.equal(p.work, 3); assert.equal(p.requestCounter, 0);
  assert.equal(p.operations.filter(o => o.space === 'external').length, 0);
  failure(fixture(), prepareRenderACB5, { waitMode: null, waitRead01F8: null, maxWork: 20 }, 'render_work_budget_required', 'wait');
  failure(fixture(0x100), prepareRenderACAF, { waitMode: null, waitRead01F8: null, maxWork: 20 }, 'render_work_budget_required', 'wait');
});

test('01F6 evidence cannot clear01F8; other counters and their bytes remain untouched', () => {
  const data = fixture(); word(data, 0x1F6, 0xBEEF); word(data, 0x1FA, 0xCAFE);
  failure(data, prepareRenderACB5, { waitRead01F8: null, waitRead01F6: [0], maxWork: 10 }, 'render_work_budget_required', 'wait');
  const p = prepareRenderACB5({ ...entry, data, waitRead01F6: [0] }); assert.equal(p.handled, true);
  assert.equal(data.commit(p).handled, true); assert.equal(get(data, 0x1F6), 0xBEEF); assert.equal(get(data, 0x1FA), 0xCAFE);
  assert.deepEqual(p.readAddresses, [0x7E01F8, 0x7E01F9]);
});

test('all valid statuses preserve C/V/I/X/Y while both root routines return A0/N0Z1', () => {
  for (let status = 0; status < 256; status++) if (!(status & 0x38)) {
    for (const run of [prepareRenderACB5, prepareRenderACAF]) {
      const p = run({ ...entry, data: fixture(), status }); assert.equal(p.handled, true);
      assert.equal(p.status, (status & ~0x82) | 2); assert.equal(p.x, entry.x); assert.equal(p.y, entry.y);
    }
  }
});

test('standalone static zero needs no write window; differing observations require both source bytes and write ownership', () => {
  assert.equal(prepareRenderACAF({ ...entry, data: fixture(0, 0x80, []), waitRead01F8: null }).handled, true);
  failure(fixture(1, 0x80, []), prepareRenderACAF, {}, 'render_write_window_required', 'wait');
  failure(createRenderData({ writeWindows: [[0x7E01F8, 0x7E01F9]] }), prepareRenderACAF, {}, 'render_source_required', 'wait');
  for (const missing of [0x1F8, 0x1F9]) {
    const data = createRenderData({ writeWindows: [[0x7E01F8, 0x7E01F9]] }); data.seed(missing === 0x1F8 ? 0x1F9 : 0x1F8, [0]);
    failure(data, prepareRenderACB5, {}, 'render_source_required', 'request');
  }
  for (const address of [0x7E01F8, 0x7E01F9])
    failure(fixture(0, 0x80, [[address, address]]), prepareRenderACB5, {}, 'render_write_window_required', 'request');
});

test('all system banks alias7E while actual DBR7E/7F state remains distinct and unsupported banks fail', () => {
  for (let bank = 0; bank < 256; bank++) {
    if (!(bank & 0x40) || [0x7E, 0x7F].includes(bank)) {
      const base = bank === 0x7F ? 0x7F0000 : 0x7E0000;
      const data = fixture(0, bank, [[base + 0x1F8, base + 0x1F9]]);
      const p = prepareRenderACB5({ ...entry, data, bank }); assert.equal(p.handled, true);
      assert.equal(p.operations[0].address, bank * 65536 + 0x1F8); data.commit(p); assert.equal(get(data, base + 0x1F8), 0);
      if (bank === 0x7F) assert.equal(data.readByte(0x7E01F8).available, false);
    } else failure(fixture(), prepareRenderACB5, { bank }, 'render_address_required', 'request');
  }
});

test('six root/child stack bytes and three standalone bytes suffice; aliases and smaller windows fail', () => {
  assert.equal(prepareRenderACB5({ ...entry, data: fixture(), stackWindow: [0x1FFA, 0x1FFF] }).handled, true);
  assert.equal(prepareRenderACAF({ ...entry, data: fixture(), stackWindow: [0x1FFD, 0x1FFF] }).handled, true);
  failure(fixture(), prepareRenderACB5, { stackWindow: [0x1FFB, 0x1FFF] }, 'render_stack_required');
  failure(fixture(), prepareRenderACAF, { stackWindow: [0x1FFE, 0x1FFF] }, 'render_stack_required');
  failure(fixture(), prepareRenderACB5, { stackWindow: [0x1F8, 0x1FD] }, 'render_stack_alias_required', 'request');
  failure(fixture(), prepareRenderACAF, { stackWindow: [0x1F7, 0x1F9] }, 'render_stack_alias_required', 'wait');
});

test('missing, empty and exhausted transcripts or context discard the increment and all observations', () => {
  for (const waitRead01F8 of [[], [1], [1, 0x100]])
    failure(fixture(), prepareRenderACB5, { waitRead01F8 }, 'render_wait_read_required', 'wait');
  failure(fixture(), prepareRenderACB5, { waitMode: null }, 'render_wait_context_required', 'wait');
  for (let maxWork = 1; maxWork < 7; maxWork++) failure(fixture(), prepareRenderACB5,
    { waitRead01F8: [1, 0x100, 0], maxWork }, 'render_work_budget_required');
  assert.equal(prepareRenderACB5({ ...entry, data: fixture(), waitRead01F8: [1, 0x100, 0], maxWork: 7 }).handled, true);
});

test('invalid and unknown entry contexts retain explicit boundaries', () => {
  for (const options of [{ waitRead01F8: Array(1) }, { waitRead01F8: [65536] }, { waitRead01F8: [-1] },
    { waitRead01F8: 0 }, { waitMode: 'execute' }, { x: -1 }, { y: 65536 }, { maxWork: 0 }])
    assert.throws(() => prepareRenderACB5({ ...entry, data: fixture(), ...options }), /Invalid/);
  for (const options of [{ bank: null }, { status: null }, { status: 0x20 }, { status: 0x10 },
    { status: 8 }, { directPage: 1 }, { emulation: 1 }]) failure(fixture(), prepareRenderACB5, options, 'render_entry_required');
});

test('inner routines are not independently committable and stale outer payload discards external clearing', () => {
  for (const run of [renderACB5, renderACAF]) {
    const data = fixture(), p = run(prepareRenderView(data), entry, { work: 0, maxWork: 10 });
    assert.equal(p.handled, true); assert.throws(() => data.commit(p), /Invalid render plan/);
  }
  const data = fixture(), p = prepareRenderACB5({ ...entry, data }); word(data, 0x1F8, 3); const before = data.snapshot();
  assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' }); assert.deepEqual(data.snapshot(), before);
});

test('synthetic FA67 then ACB5 composition shares actual byte changes, budget and one outer commit', () => {
  const data = createRenderData({ writeWindows: [[0x7E01F6, 0x7E01F9], [0x7E020A, 0x7E020D]] });
  for (const [address, value] of [[0, 0], [0x7E2060, 0x600], [0x7E20A0, 0x1000], [0x1F6, 0], [0x1F8, 0]]) word(data, address, value);
  const before = data.snapshot(), view = prepareRenderView(data, [0x7E1F00, 0x7E1FFF]), budget = { work: 0, maxWork: 20 };
  const first = renderFA67(view, { ...entry, waitRead01F6: [1, 0] }, budget);
  const second = renderACB5(view, { ...entry, status: first.status, x: first.x, waitRead01F8: [1, 0] }, budget);
  assert.equal(first.work, 10); assert.equal(second.work, 15); assert.equal(second.status, first.status);
  assert.equal(view.read(0x1F6), 0); assert.equal(view.read(0x1F8), 0); assert.deepEqual(data.snapshot(), before);
  const outer = view.finish({ ...second, operations: Object.freeze([...first.operations, ...second.operations]) });
  assert.equal(data.commit(outer).handled, true); assert.equal(get(data, 0x1F6), 0); assert.equal(get(data, 0x1F8), 0);
});

test('native probes pin synthetic chronology, wrap and exhausted observations', async () => {
  const r = JSON.parse(await readFile('analysis/render-acb5-native.json', 'utf8'));
  assert.match(r.scope, /synthetic/); assert.match(r.scope, /No device\/time\/interrupt/);
  assert.deepEqual(r.probes.map(p => p.handled), [true, true, false]);
  assert.equal(r.probes[2].reason, 'render_wait_read_required'); assert.equal(r.probes[2].byteWrites, undefined);
});
