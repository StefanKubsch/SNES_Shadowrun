import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRenderB0A1, renderB0A1 } from '../proof/render/counter-b0a1.mjs';
import { renderACAF } from '../proof/render/request-acb5.mjs';

const address = 0x7E1C76;
const entry = { bank: 0x80, status: 0xC5, x: 0x1234, y: 0xBEEF, emulation: 0,
  directPage: 0, stackWindow: [0x1FFD, 0x1FFF], waitMode: 'record-observations', waitRead1C76: [1] };
const word = (data, a, value) => data.seed(a, [value & 255, value >>> 8]);
const get = (data, a = address) => data.readByte(a).value | data.readByte(a + 1).value << 8;
function fixture(value = 0, windows = [[address, address + 1]]) {
  const data = createRenderData({ writeWindows: windows }); word(data, address, value); return data;
}
function failure(data, options, reason, phase) {
  const before = data.snapshot(), p = prepareRenderB0A1({ ...entry, data, ...options });
  assert.equal(p.handled, false); assert.equal(p.reason, reason);
  if (phase) assert.equal(p.phase, phase);
  assert.deepEqual(data.snapshot(), before);
  for (const key of ['byteWrites', 'operations', 'ioWrites', 'readAddresses']) assert.equal(p[key], undefined);
  assert.throws(() => data.commit(p), /Invalid render plan/);
}

test('B0A1 saves baseline once, polls equality and stops at first unequal full WORD', () => {
  const data = fixture(0xFF), before = data.snapshot();
  const p = prepareRenderB0A1({ ...entry, data, waitRead1C76: [0xFF, 0xFF, 0x100, 7] });
  assert.equal(p.handled, true); assert.deepEqual(data.snapshot(), before);
  assert.equal(p.a, 0xFF); assert.equal(p.baseline, 0xFF); assert.equal(p.observed, 0x100);
  assert.equal(p.polls, 3); assert.equal(p.counterPolls, 3); assert.equal(p.work, 5);
  assert.equal(p.status, 0xC4); assert.equal(p.x, entry.x); assert.equal(p.y, entry.y); assert.equal(p.bank, entry.bank);
  assert.deepEqual(p.operations.map(o => [o.kind, o.space, o.phase, o.value]), [
    ['read', 'data', 'baseline', 0xFF], ['read', 'data', 'poll', 0xFF],
    ['read', 'data', 'poll', 0xFF], ['write', 'external', 'poll', 0x100], ['read', 'data', 'poll', 0x100],
  ]);
  assert.ok(p.operations.every(o => o.address === address && o.bytes === 2));
  assert.equal(p.work, p.operations.length); assert.deepEqual(p.ioWrites, []);
  assert.deepEqual(p.readAddresses, [address, address + 1]);
  assert.equal(data.commit(p).handled, true); assert.equal(get(data), 0x100);
});

test('all65536 baselines return original A and compare unsigned against actual changed observation', () => {
  const data = fixture();
  for (let baseline = 0; baseline < 65536; baseline++) {
    word(data, address, baseline);
    const observed = (baseline + 1) % 65536;
    const p = prepareRenderB0A1({ ...entry, data, waitRead1C76: [baseline, observed] });
    assert.equal(p.handled, true); assert.equal(p.a, baseline); assert.equal(p.observed, observed);
    assert.equal(p.carry, Number(baseline >= observed)); assert.equal(p.status & 2, 0);
    // Independent signed comparison-result oracle, including FFFF -> 0000.
    const signedDifference = ((baseline - observed + 32768 + 65536) % 65536) - 32768;
    assert.equal(Boolean(p.status & 128), signedDifference < 0);
    assert.equal(p.overflow, 1); assert.equal(p.polls, 2);
  }
});

test('all65536 observed words compare full WORD against 8000; equality has no return', () => {
  const data = fixture(0x8000);
  for (let observed = 0; observed < 65536; observed++) {
    const p = prepareRenderB0A1({ ...entry, data, waitRead1C76: [observed] });
    if (observed === 0x8000) {
      assert.equal(p.handled, false); assert.equal(p.reason, 'render_wait_read_required');
    } else {
      assert.equal(p.handled, true); assert.equal(p.a, 0x8000); assert.equal(p.observed, observed);
      assert.equal(p.carry, Number(observed < 0x8000));
      assert.equal(Boolean(p.status & 128), observed === 0 || observed > 0x8000);
      assert.equal(p.status & 2, 0);
    }
  }
});

test('edge comparison grid retains V/I and distinguishes CMP flags from returned A', () => {
  for (const baseline of [0, 1, 255, 256, 0x7FFF, 0x8000, 0x8001, 0xFFFF])
    for (const observed of [0, 1, 255, 256, 0x7FFF, 0x8000, 0x8001, 0xFFFF]) {
      if (baseline === observed) continue;
      for (let status = 0; status < 256; status++) if (!(status & 0x38)) {
        const p = prepareRenderB0A1({ ...entry, data: fixture(baseline), status, waitRead1C76: [observed] });
        assert.equal(p.handled, true); assert.equal(p.a, baseline);
        const wrapped = (baseline - observed + 65536) % 65536;
        assert.equal(p.status, (status & 0x7C) + Number(baseline >= observed) + (wrapped >= 32768 ? 128 : 0));
        assert.equal(p.x, entry.x); assert.equal(p.y, entry.y);
      }
    }
  const p = prepareRenderB0A1({ ...entry, data: fixture(0), waitRead1C76: [0xFFFF] });
  assert.equal(p.a, 0); assert.equal(p.status & 0x83, 0); // A0 with Z0/N0/C0 is intentional.
});

test('every DBR including physical and unsupported data banks preserves bank and reads fixed long7E source', () => {
  for (let bank = 0; bank < 256; bank++) {
    const data = fixture(0x100); word(data, 0x7F1C76, 0xBEEF);
    const p = prepareRenderB0A1({ ...entry, data, bank, waitRead1C76: [0] });
    assert.equal(p.handled, true); assert.equal(p.bank, bank); assert.equal(p.a, 0x100);
    assert.deepEqual(p.readAddresses, [address, address + 1]);
    data.commit(p); assert.equal(get(data), 0); assert.equal(get(data, 0x7F1C76), 0xBEEF);
  }
});

test('unchanged actual bytes never release with or without explicit observations', () => {
  failure(fixture(0), { waitRead1C76: [0, 0, 0] }, 'render_wait_read_required', 'poll');
  failure(fixture(0x100), { waitRead1C76: null, maxWork: 12 }, 'render_work_budget_required', 'poll');
  failure(fixture(0), { waitRead1C76: null, waitMode: null, maxWork: 12 }, 'render_work_budget_required', 'poll');
});

test('missing/empty/equality prefixes and observation context fail atomically', () => {
  for (const waitRead1C76 of [[], [0], [0, 0]])
    failure(fixture(), { waitRead1C76 }, 'render_wait_read_required', 'poll');
  failure(fixture(), { waitMode: null }, 'render_wait_context_required', 'poll');
  failure(fixture(), { waitRead1C76: null, waitRead01F8: [1], ioRead2140: [1], maxWork: 5 },
    'render_work_budget_required', 'poll');
});

test('each source byte and changed-observation write byte require ownership', () => {
  for (const missing of [address, address + 1]) {
    const data = createRenderData({ writeWindows: [[address, address + 1]] });
    data.seed(missing === address ? address + 1 : address, [0]);
    failure(data, {}, 'render_source_required', 'baseline');
  }
  for (const windows of [[], [[address, address]], [[address + 1, address + 1]]])
    failure(fixture(0, windows), {}, 'render_write_window_required', 'poll');
  const data = fixture(0, []);
  failure(data, { waitRead1C76: [0] }, 'render_wait_read_required', 'poll');
});

test('exact three RTL stack bytes suffice and either source byte alias fails before polling', () => {
  assert.equal(prepareRenderB0A1({ ...entry, data: fixture() }).handled, true);
  failure(fixture(), { stackWindow: [0x1FFE, 0x1FFF] }, 'render_stack_required');
  for (const stackWindow of [[0x1C74, 0x1C76], [0x1C77, 0x1C79]])
    failure(fixture(), { stackWindow }, 'render_stack_alias_required', 'baseline');
});

test('every cumulative work prefix withholds the counter update', () => {
  const options = { waitRead1C76: [0, 0, 0xFFFF] };
  for (let maxWork = 1; maxWork < 5; maxWork++)
    failure(fixture(), { ...options, maxWork }, 'render_work_budget_required');
  const p = prepareRenderB0A1({ ...entry, data: fixture(), ...options, maxWork: 5 });
  assert.equal(p.handled, true); assert.equal(p.work, 5);
});

test('invalid values and missing WORD entry prerequisites remain explicit', () => {
  for (const options of [{ waitRead1C76: Array(1) }, { waitRead1C76: [65536] }, { waitRead1C76: [-1] },
    { waitRead1C76: [NaN] }, { waitRead1C76: new Uint16Array([1]) }, { waitRead1C76: 1 },
    { waitMode: 'execute' }, { x: -1 }, { y: 65536 }, { maxWork: 0 }, { data: {} }])
    assert.throws(() => prepareRenderB0A1({ ...entry, data: fixture(), ...options }), /Invalid/);
  for (const options of [{ bank: null }, { status: null }, { status: 0x20 }, { status: 0x10 },
    { status: 8 }, { directPage: 1 }, { emulation: 1 }]) failure(fixture(), options, 'render_entry_required');
  const p = prepareRenderB0A1({ ...entry, data: fixture(), x: null, y: null });
  assert.equal(p.x, null); assert.equal(p.y, null);
});

test('inner, foreign and stale plans cannot commit; public report and payload are immutable', () => {
  const data = fixture(), inner = renderB0A1(prepareRenderView(data), entry, { work: 0, maxWork: 10 });
  assert.throws(() => data.commit(inner), /Invalid render plan/);
  const p = prepareRenderB0A1({ ...entry, data });
  assert.throws(() => fixture().commit(p), /Invalid render plan/);
  assert.throws(() => { p.byteWrites[0][1] = 99; }, TypeError);
  assert.throws(() => { p.operations[0].value = 99; }, TypeError);
  word(data, address, 9); const before = data.snapshot();
  assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' });
  assert.deepEqual(data.snapshot(), before);
});

test('synthetic two-call composition refetches baseline and consumes one global counter list', () => {
  const data = fixture(), before = data.snapshot(), view = prepareRenderView(data);
  const observations = { counterPolls: 0, apuPolls: 7, panResultReads: 9 };
  const context = { ...entry, observations, waitRead1C76: [0, 1, 1, 0x100, 9] };
  const budget = { work: 2, maxWork: 10 };
  const first = renderB0A1(view, context, budget), second = renderB0A1(view, context, budget);
  assert.equal(first.a, 0); assert.equal(second.a, 1); assert.equal(second.observed, 0x100);
  assert.equal(first.counterPolls, 2); assert.equal(second.counterPolls, 4);
  assert.deepEqual(observations, { counterPolls: 4, apuPolls: 7, panResultReads: 9 });
  assert.equal(budget.work, 10); assert.deepEqual(data.snapshot(), before);
  assert.throws(() => data.commit(first), /Invalid render plan/);
  const outer = view.finish({ handled: true, first, second });
  assert.equal(data.commit(outer).handled, true); assert.equal(get(data), 0x100);
});

test('earlier native writes feed fresh baseline; late inner failure discards all effects', () => {
  for (const lateFailure of [false, true]) {
    const data = fixture(), before = data.snapshot(), view = prepareRenderView(data);
    view.write(address, 0xFF); view.write(address + 1, 0xFF);
    const context = { ...entry, observations: {}, waitRead1C76: [0] }, budget = { work: 0, maxWork: 10 };
    const first = renderB0A1(view, context, budget);
    assert.equal(first.a, 0xFFFF); assert.equal(first.carry, 1); assert.deepEqual(data.snapshot(), before);
    if (lateFailure) {
      assert.throws(() => renderB0A1(view, context, budget), e => e.reason === 'render_wait_read_required');
      assert.deepEqual(data.snapshot(), before);
    } else {
      data.commit(view.finish(first)); assert.equal(get(data), 0);
    }
  }
});

test('B0A1 and ACAF share bytes and budget but retain separate counter evidence', () => {
  const data = createRenderData({ writeWindows: [[address, address + 1], [0x7E01F8, 0x7E01F9]] });
  word(data, address, 0xFFFF); word(data, 0x1F8, 7);
  const view = prepareRenderView(data), budget = { work: 0, maxWork: 5 };
  const context = { ...entry, observations: {}, waitRead1C76: [0], waitRead01F8: [0] };
  const counter = renderB0A1(view, context, budget), transfer = renderACAF(view, context, budget);
  assert.equal(counter.a, 0xFFFF); assert.equal(transfer.a, 0); assert.equal(budget.work, 5);
  assert.equal(context.observations.counterPolls, 1);
  data.commit(view.finish({ handled: true, counter, transfer }));
  assert.equal(get(data), 0); assert.equal(get(data, 0x1F8), 0);
});

test('manual report retains original11/4 source, three-byte proof and synthetic limitations', async () => {
  const report = JSON.parse(await readFile('analysis/render-b0a1-native.json', 'utf8'));
  assert.equal(report.source.covered_bytes, 11); assert.equal(report.source.instruction_count, 4);
  assert.equal(report.stackProof.minimum_protected_stack_bytes, 3);
  assert.match(report.scope, /synthetic/); assert.match(report.scope, /No CPU\/device\/time\/interrupt/);
  assert.deepEqual(report.probes.map(p => p.handled), [true, true, true, true, false, false, false]);
  assert.ok(report.probes.slice(4).every(p => !p.byteWrites));
});
