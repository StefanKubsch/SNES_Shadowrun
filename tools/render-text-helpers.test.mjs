import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRenderADBA, prepareRenderAE14, prepareRenderAE4D, renderADBA, renderAE14, renderAE4D } from '../proof/render/text-geometry.mjs';
import { prepareRenderAEC8 } from '../proof/render/text-mask-aec8.mjs';
import { prepareRenderAEF4, prepareRenderAEFC, prepareRenderACC3, prepareRenderACC9,
  renderAEF4, renderAEFC } from '../proof/render/request-aef4.mjs';

const entry = { bank: 0x7E, status: 0xC5, x: 2, y: 0xBEEF, emulation: 0, directPage: 0,
  stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests', ioRead4214: [0, 3], ioRead4216: [1] };
const windows = [[0x7E00AB, 0x7E00C1], [0x7E01FA, 0x7E0211], [0x7E20C0, 0x7E20E3], [0x7E2AE0, 0x7E2AFF]];
const word = (data, address, value) => data.seed(address, [value & 255, value >>> 8]);
const get = (data, address) => data.readByte(address).value | data.readByte(address + 1).value << 8;
function geometry({ x = 2, cursor = 0x20, base = 0x20, offset = 0, origin = 12, width = 6,
  height = 5, limit = 0x21, omit = null, writeWindows = windows } = {}) {
  const data = createRenderData({ writeWindows });
  for (const [address, value] of [[0x20C0, cursor], [0x2060, base], [0x20E0, offset],
    [0x2100, origin], [0x2020, width], [0x2040, height], [0x2080, limit]]) {
    for (let i = 0; i < 2; i++) if (0x7E0000 + address + x + i !== omit)
      data.seed(0x7E0000 + address + x + i, [value >>> (8 * i) & 255]);
  }
  return data;
}
const prepare = (fn, data, extra = {}) => fn({ ...entry, data, ...extra });
function failure(fn, data, extra, reason) {
  const before = data.snapshot(), p = prepare(fn, data, extra);
  assert.equal(p.handled, false); assert.equal(p.reason, reason); assert.deepEqual(data.snapshot(), before);
  for (const key of ['byteWrites', 'operations', 'ioWrites', 'ioRequests']) assert.equal(p[key], undefined);
  assert.throws(() => data.commit(p), /Invalid render plan/); return p;
}
const requests = p => p.ioRequests.map(e => [e.kind, e.address, e.value, e.bytes]);

test('ADBA/AE14/AE4D restore all entryDBRs while arithmetic always requests actual bank80', () => {
  for (let bank = 0; bank < 256; bank++) for (const fn of [prepareRenderADBA, prepareRenderAE14, prepareRenderAE4D]) {
    const data = geometry(), before = data.snapshot(), p = prepare(fn, data, { bank }); assert.ok(p.handled);
    assert.equal(p.bank, bank); assert.equal(p.x, 2); assert.equal(p.y, 0xBEEF); assert.deepEqual(data.snapshot(), before);
    assert.equal(p.status & 0x82, (bank & 0x80) | (bank === 0 ? 2 : 0)); assert.equal(p.status & 4, 4);
    assert.ok(p.ioRequests.every(e => e.address >>> 16 === 0x80)); assert.equal(p.work, p.operations.length);
  }
});

test('ADBA nonborrow returns actual difference without positionwrites and reads BYTE divisor only', () => {
  const data = geometry({ origin: 1, width: 0xAB06, offset: 0 }), p = prepare(prepareRenderADBA, data);
  assert.ok(p.handled); assert.equal(p.adjusted, false); assert.equal(p.a, 7); assert.equal(p.carry, 1);
  assert.deepEqual(p.byteWrites, []);
  assert.deepEqual(requests(p), [['write', 0x804204, 0, 2], ['write', 0x804206, 4, 1], ['read', 0x804216, 1, 2]]);
  const onlyLow = geometry({ origin: 1, omit: 0x7E2023 }); assert.ok(prepare(prepareRenderADBA, onlyLow).handled);
});

test('ADBA borrow keeps magnitude, fresh offset and CMPcarry across protected shifts', () => {
  for (const [offset, origin, position, finalOffset, finalCursor, a, carry] of [
    [0, 12, 0x20, 4, 0x20, 0x20, 0], [7, 16, 0x20, 0, 0x21, 0x21, 0],
    [0, 24, 0xFFFF, 0, 1, 1, 1], [0, 0x8009, 0, 1, 0x1000, 0x1000, 0],
  ]) {
    const data = geometry({ offset, origin, cursor: position, base: position }), p = prepare(prepareRenderADBA, data);
    assert.ok(p.handled); assert.equal(p.adjusted, true); assert.equal(p.a, a); assert.equal(p.carry, carry);
    data.commit(p); assert.equal(get(data, 0x7E20E2), finalOffset); assert.equal(get(data, 0x7E20C2), finalCursor);
    assert.deepEqual(p.operations.filter(e => e.kind === 'read' && e.address === 0x7E20E2).map(e => e.value), [offset, offset]);
  }
});

test('ADBA fifth/third-shiftCarry and final add/subtract own C/V independently of PLB N/Z', () => {
  for (const [extra, options, expectedA, expectedCarry, expectedV] of [
    [{ origin: 0, offset: 0 }, { ioRead4216: [0x2000] }, 1, 1, 0],
    [{ origin: 1, offset: 0 }, { ioRead4216: [0x1000] }, 0x7FFF, 1, 1],
    [{ origin: 16, offset: 7, cursor: 0x7FFF }, { ioRead4216: [1] }, 0x8000, 0, 1],
  ]) {
    const p = prepare(prepareRenderADBA, geometry(extra), options); assert.ok(p.handled);
    assert.equal(p.a, expectedA); assert.equal(p.carry, expectedCarry); assert.equal(p.overflow, expectedV);
  }
});

test('AE14 full WORD width survives BYTE divisor write, with retained remainderASLcarry and fresh BD/C0', () => {
  for (const width of [0, 1, 2, 6, 0x106, 0x8006, 0xFFFF]) {
    const data = geometry({ width, offset: 3 }), p = prepare(prepareRenderAE14, data, { ioRead4216: [0x2000] });
    assert.ok(p.handled); const pixels = ((width - 2) * 8) & 65535;
    assert.equal(p.a, pixels - 4 & 65535); assert.equal(p.carry, pixels >= 4 ? 1 : 0);
    data.commit(p); assert.equal(get(data, 0xBD), pixels); assert.equal(get(data, 0xC0), 4);
    assert.equal(p.ioWrites[1].value, width - 2 & 255);
    assert.deepEqual(p.operations.slice(-2).map(e => [e.kind, e.address]), [['read', 0xBD], ['read', 0xC0]]);
  }
});

test('AE14 all65536 supplied remainders preserve the shiftCarry before remaining-space subtraction', () => {
  for (let remainder = 0; remainder < 65536; remainder++) {
    const data = geometry({ width: 6, offset: 0 }), p = prepare(prepareRenderAE14, data, { ioRead4216: [remainder] });
    assert.ok(p.handled);
    const used = remainder * 8 % 65536 + (Math.floor(remainder / 8192) % 2);
    const difference = 32 - used;
    assert.equal(p.a, (difference + 65536) % 65536); assert.equal(p.carry, difference >= 0 ? 1 : 0);
    const signedUsed = used >= 32768 ? used - 65536 : used;
    assert.equal(p.overflow, 32 - signedUsed > 32767 || 32 - signedUsed < -32768 ? 1 : 0);
  }
});

test('AE4D conditional fresh second BYTEquotient can differ from first; actual result remains independent', () => {
  const data = geometry(), p = prepare(prepareRenderAE4D, data, { ioRead4214: [0, 3], ioRead4216: [0x1234] });
  assert.ok(p.handled); assert.equal(p.quotientReads, 2); assert.equal(p.resultReads, 1); assert.equal(p.newlineReset, false);
  assert.equal(p.a, 0x1254); data.commit(p); assert.equal(get(data, 0x7E20C2), 0x1254); assert.equal(get(data, 0x7E20E2), 0);
  assert.deepEqual(requests(p), [['write', 0x804204, 0, 2], ['write', 0x804206, 4, 1],
    ['read', 0x804214, 0, 1], ['read', 0x804214, 3, 1], ['write', 0x804202, 4, 1],
    ['write', 0x804203, 4, 1], ['read', 0x804216, 0x1234, 2]]);
});

test('AE4D unsigned height-low minus4 gate and BYTE incrementwrap select original multiplierwrites', () => {
  for (const [height, samples, reset, value] of [[5, [2], true, 0], [5, [1, 7], false, 8],
    [3, [255, 255], false, 0], [0x105, [0, 255], false, 0]]) {
    const p = prepare(prepareRenderAE4D, geometry({ height }), { ioRead4214: samples }); assert.ok(p.handled);
    assert.equal(p.newlineReset, reset); assert.equal(p.quotientReads, reset ? 1 : 2);
    assert.equal(p.ioWrites.find(e => e.address === 0x804202).value, value);
  }
});

test('AE4D final compare overrides carry while ADCbase/result retains V; equal AE4C is literal noop', () => {
  for (const [base, sample, limit, a, c, v] of [[0x7FFF, 1, 0x8000, 0x8000, 1, 1],
    [0xFFFF, 1, 1, 0, 0, 0], [0, 1, 2, 1, 0, 0]]) {
    const data = geometry({ base, limit }), p = prepare(prepareRenderAE4D, data, { ioRead4216: [sample] });
    assert.ok(p.handled); assert.equal(p.a, a); assert.equal(p.carry, c); assert.equal(p.overflow, v);
    assert.equal(p.operations.at(-1).address, 0x7E2082); assert.equal(p.status & 0x82, 0);
  }
});

test('missing conditional arithmetic observations never guess results or expose earlier requests', () => {
  for (const fn of [prepareRenderADBA, prepareRenderAE14, prepareRenderAE4D]) {
    failure(fn, geometry(), { ioMode: null }, 'render_io_context_required');
    failure(fn, geometry(), { ioRead4216: [] }, 'render_io_read_required');
  }
  failure(prepareRenderAE4D, geometry(), { ioRead4214: [] }, 'render_io_read_required');
  failure(prepareRenderAE4D, geometry(), { ioRead4214: [0] }, 'render_io_read_required');
  assert.ok(prepare(prepareRenderAE4D, geometry(), { ioRead4214: [2] }).handled);
});

test('full odd X and WORDbankcrossing use actual Long byteaddresses for textgeometry', () => {
  for (const x of [0xFFFF, 0xDF3F]) {
    const data = geometry({ x, writeWindows: [[0x7E0000, 0x7FFFFF]] }), p = prepare(prepareRenderAE4D, data, { x });
    assert.ok(p.handled); assert.equal(p.x, x); data.commit(p);
    assert.equal(get(data, 0x7E20C0 + x), 0x21);
    assert.ok(p.byteWrites.some(([address]) => address >= 0x7F0000));
  }
});

test('every reached geometry sourcebyte and writebyte has an atomic explicit boundary', () => {
  for (const fn of [prepareRenderADBA, prepareRenderAE14, prepareRenderAE4D]) {
    const seeded = geometry(), p = prepare(fn, seeded); assert.ok(p.handled);
    const sources = new Set(p.readAddresses.filter(a => seeded.readByte(a).available));
    for (const omit of sources) {
      const data = createRenderData({ writeWindows: windows });
      for (const [address, value] of seeded.snapshot().bytes) if (address !== omit) data.seed(address, [value]);
      failure(fn, data, {}, 'render_source_required');
    }
    for (const [missing] of p.byteWrites) {
      const writeWindows = windows.flatMap(([first, last]) => missing < first || missing > last ? [[first, last]]
        : [...(missing > first ? [[first, missing - 1]] : []), ...(missing < last ? [[missing + 1, last]] : [])]);
      failure(fn, geometry({ writeWindows }), {}, 'render_write_window_required');
    }
  }
});

test('geometry stacks, exact budgets, invalid samples and stale revisions remain unappliable', () => {
  for (const [fn, bytes] of [[prepareRenderADBA, 6], [prepareRenderAE14, 6], [prepareRenderAE4D, 7]]) {
    const p = prepare(fn, geometry()); assert.ok(p.handled);
    for (let maxWork = 1; maxWork < p.work; maxWork++) failure(fn, geometry(), { maxWork }, 'render_work_budget_required');
    assert.ok(prepare(fn, geometry(), { maxWork: p.work, stackWindow: [0x1000, 0x1000 + bytes - 1] }).handled);
    failure(fn, geometry(), { stackWindow: [0x1000, 0x1000 + bytes - 2] }, 'render_stack_required');
    failure(fn, geometry(), { stackWindow: [0x20C0, 0x20D0] }, 'render_stack_alias_required');
    const data = geometry(), plan = prepare(fn, data); word(data, 0x7E2062, 0x1234);
    const before = data.snapshot(); assert.deepEqual(data.commit(plan), { handled: false, reason: 'render_plan_stale' });
    assert.deepEqual(data.snapshot(), before);
  }
  for (const extra of [{ x: null }, { status: 8 }, { emulation: 1 }, { directPage: 1 }])
    failure(prepareRenderADBA, geometry(), extra, 'render_entry_required');
  for (const extra of [{ ioRead4214: [256] }, { ioRead4216: [65536] }, { ioRead4216: Array(2) }, { ioMode: 'calculate' }])
    assert.throws(() => prepare(prepareRenderAE4D, geometry(), extra), /Invalid render/);
});

function mask({ ab = 0, b7 = 1, bits = 0xFF00, bank = 0x7E, writeWindows = windows } = {}) {
  const data = createRenderData({ writeWindows }); word(data, 0xAB, ab); word(data, 0xB7, b7);
  if (b7 !== 0) {
    word(data, 0x81AC8D + (b7 * 2 & 65535), bits);
    let y = ab + 16 & 65535;
    for (let n = 0; n < 8; n++) { word(data, bank * 65536 + 0x2ADE + y, n + 1); y = y - 2 & 65535; }
  }
  return data;
}

test('AEC8 zeroB7 needs no masktable/output bytes, preserves Y/C/V and returns LDXzero N/Z', () => {
  const data = mask({ ab: 0x8000, b7: 0, bank: 0x80 }), p = prepare(prepareRenderAEC8, data, { bank: 0x80 });
  assert.ok(p.handled); assert.equal(p.a, 0x8000); assert.equal(p.x, 0); assert.equal(p.y, entry.y);
  assert.equal(p.status, 0x47); assert.equal(p.visits, 0); data.commit(p); assert.equal(get(data, 0x210), 0x8000);
});

test('AEC8 active maskOR visits exactly eight fresh words and reloads AB for transfer size', () => {
  const data = mask(), p = prepare(prepareRenderAEC8, data); assert.ok(p.handled);
  assert.equal(p.a, 16); assert.equal(p.x, 0); assert.equal(p.y, 0); assert.equal(p.status, 4); assert.equal(p.visits, 8);
  assert.deepEqual(p.operations.filter(e => e.kind === 'read' && e.address === 0xBA).map(e => e.value), Array(8).fill(0xFF00));
  data.commit(p); assert.equal(get(data, 0xBA), 0xFF00); assert.equal(get(data, 0x210), 16);
  for (let n = 0; n < 8; n++) assert.equal(get(data, 0x7E2AEE - n * 2), 0xFF00 | n + 1);
});

test('AEC8 fullB7 wraps doubled index without cap; AB/Ywordwrap and original ASLcarry survive', () => {
  const writeWindows = [[0x7E0000, 0x7FFFFF]], data = mask({ ab: 0xFFF8, b7: 0xFFFF, writeWindows }),
    p = prepare(prepareRenderAEC8, data); assert.ok(p.handled);
  assert.equal(p.a, 8); assert.equal(p.x, 0); assert.equal(p.y, 0xFFF8); assert.equal(p.carry, 1);
  assert.ok(p.readAddresses.includes(0x82AC8B)); assert.ok(p.byteWrites.some(([a]) => a >= 0x7F0000));
  data.commit(p); assert.equal(get(data, 0xAB), 8);
});

test('AEC8 WORDhigh at7EFFFF crosses bank, while final flags follow freshAB and additionV', () => {
  const data = mask({ ab: 0xD511, writeWindows: [[0x7E0000, 0x7FFFFF]] }), p = prepare(prepareRenderAEC8, data);
  assert.ok(p.handled); assert.ok(p.readAddresses.includes(0x7F0000)); data.commit(p);
  assert.equal(get(data, 0x7EFFFF), 0xFF01); assert.equal(data.readByte(0x7F0000).value, 255);
  const overflow = prepare(prepareRenderAEC8, mask({ ab: 0x7FFF, writeWindows: [[0x7E0000, 0x7FFFFF]] }));
  assert.ok(overflow.handled); assert.equal(overflow.a, 0x800F); assert.equal(overflow.status, 0xC4);
});

test('AEC8 required masksource/outputbytes, writewindows, stack and exact budgets are atomic', () => {
  const seeded = mask(), p = prepare(prepareRenderAEC8, seeded); assert.ok(p.handled);
  for (const omit of p.readAddresses.filter(a => seeded.readByte(a).available)) {
    const data = createRenderData({ writeWindows: windows });
    for (const [address, value] of seeded.snapshot().bytes) if (address !== omit) data.seed(address, [value]);
    failure(prepareRenderAEC8, data, {}, 'render_source_required');
  }
  for (const [missing] of p.byteWrites) {
    const writeWindows = windows.flatMap(([first, last]) => missing < first || missing > last ? [[first, last]]
      : [...(missing > first ? [[first, missing - 1]] : []), ...(missing < last ? [[missing + 1, last]] : [])]);
    failure(prepareRenderAEC8, mask({ writeWindows }), {}, 'render_write_window_required');
  }
  for (let maxWork = 1; maxWork < p.work; maxWork++) failure(prepareRenderAEC8, mask(), { maxWork }, 'render_work_budget_required');
  assert.ok(prepare(prepareRenderAEC8, mask(), { maxWork: p.work, stackWindow: [0x1000, 0x1002] }).handled);
  failure(prepareRenderAEC8, mask(), { stackWindow: [0x1000, 0x1001] }, 'render_stack_required');
  failure(prepareRenderAEC8, mask(), { stackWindow: [0xAB, 0xAD] }, 'render_stack_alias_required');
});

const waitCases = [[prepareRenderAEF4, prepareRenderACC3, 0x1FA, 'waitRead01FA'],
  [prepareRenderAEFC, prepareRenderACC9, 0x1FC, 'waitRead01FC']];
function waitFixture(offset, value, bank = 0x7E, writeWindows = windows) {
  const data = createRenderData({ writeWindows }); word(data, bank * 65536 + offset, value); return data;
}
test('AEF4/AEFC request actual fullWORDcounters, finish on observed zero and preserve X/Y/C/V', () => {
  for (const [request, wait, offset, key] of waitCases) {
    const data = waitFixture(offset, 0xFF), p = prepare(request, data, { waitMode: 'record-observations', [key]: [0x100, 1, 0] });
    assert.ok(p.handled); assert.equal(p.requestCounter, 0x100); assert.equal(p.polls, 3);
    assert.equal(p.a, 0); assert.equal(p.x, 2); assert.equal(p.y, entry.y); assert.equal(p.status, 0x47);
    assert.deepEqual(p.operations.filter(e => e.space === 'external').map(e => e.value), [1, 0]); data.commit(p);
    assert.equal(get(data, offset), 0);
    const clear = prepare(wait, waitFixture(offset, 0)); assert.ok(clear.handled); assert.equal(clear.polls, 1);
  }
});

test('text counterWORDwrap reaches zero without observation or transfercompletion claim', () => {
  for (const [request, , offset] of waitCases) {
    const data = waitFixture(offset, 0xFFFF), p = prepare(request, data); assert.ok(p.handled);
    assert.equal(p.requestCounter, 0); assert.equal(p.polls, 1); assert.equal(p.status, 0x47); data.commit(p);
    assert.equal(get(data, offset), 0);
  }
});

test('both text wait gates consider every nonzeroWORD busy, including0100 and8000', () => {
  for (const [, wait, offset] of waitCases) for (let value = 1; value < 65536; value++) {
    const data = waitFixture(offset, value), p = prepare(wait, data, { maxWork: 1 });
    assert.equal(p.handled, false); assert.equal(p.reason, 'render_work_budget_required');
    assert.equal(get(data, offset), value);
  }
});

test('both text waits need complete own observations; neighbor counter cannot acknowledge them', () => {
  for (const [request, , offset, key] of waitCases) {
    const otherKey = key === 'waitRead01FA' ? 'waitRead01FC' : 'waitRead01FA';
    failure(request, waitFixture(offset, 0), { waitMode: 'record-observations', [key]: [1] }, 'render_wait_read_required');
    failure(request, waitFixture(offset, 0), { [key]: [0] }, 'render_wait_context_required');
    failure(request, waitFixture(offset, 0), { waitMode: 'record-observations', [otherKey]: [0], maxWork: 5 }, 'render_work_budget_required');
  }
});

test('text waits use actual DBR7Fbytes and require matching physical windows and stack', () => {
  for (const [request, , offset, key] of waitCases) {
    const bank = 0x7F, data = waitFixture(offset, 0, bank, [[0x7F01FA, 0x7F01FD]]);
    const p = prepare(request, data, { bank, waitMode: 'record-observations', [key]: [0] }); assert.ok(p.handled);
    assert.ok(p.byteWrites.every(([address]) => address >= 0x7F0000)); data.commit(p); assert.equal(get(data, bank * 65536 + offset), 0);
    failure(request, waitFixture(offset, 0, bank), { bank }, 'render_write_window_required');
    failure(request, waitFixture(offset, 0xFFFF), { stackWindow: [0x1000, 0x1004] }, 'render_stack_required');
    assert.ok(prepare(request, waitFixture(offset, 0xFFFF), { stackWindow: [0x1000, 0x1005] }).handled);
    failure(request, waitFixture(offset, 0xFFFF), { stackWindow: [0x1FA, 0x1FF] }, 'render_stack_alias_required');
  }
});

test('geometry and both requestwaits share one provider, workbudget and outer commit', () => {
  const data = geometry(), budget = { work: 0, maxWork: 1000 };
  word(data, 0x1FA, 0xFFFF); word(data, 0x1FC, 0xFFFF);
  // Source revision is captured only after explicitly seeding all inputs.
  const shared = prepareRenderView(data), first = renderADBA(shared, entry, budget);
  const second = renderAE14(shared, { ...entry, status: first.status }, budget);
  const third = renderAE4D(shared, { ...entry, status: second.status }, budget);
  const fourth = renderAEF4(shared, third, budget), fifth = renderAEFC(shared, fourth, budget);
  const p = shared.finish({ ...fifth }); assert.equal(data.commit(p).handled, true);
  assert.equal(get(data, 0x7E20C2), 0x21); assert.equal(get(data, 0x1FA), 0); assert.equal(get(data, 0x1FC), 0);
  assert.throws(() => data.commit(third), /Invalid render plan/);
  assert.equal(budget.work, first.operations.length + second.operations.length + third.operations.length
    + fourth.operations.length + fifth.operations.length);
});

test('late inner geometry/transfer boundary leaves all shared prior effects unapplied', () => {
  for (const failAt of ['geometry', 'wait']) {
    const data = geometry(); word(data, 0x1FA, 0); const before = data.snapshot();
    const view = prepareRenderView(data), budget = { work: 0, maxWork: 1000 };
    renderADBA(view, entry, budget);
    if (failAt === 'geometry') assert.throws(() => renderAE4D(view, { ...entry, ioRead4214: [0] }, budget),
      e => e.reason === 'render_io_read_required');
    else {
      const previous = renderAE4D(view, entry, budget);
      assert.throws(() => renderAEF4(view, { ...previous, waitMode: 'record-observations', waitRead01FA: [1] }, budget),
        e => e.reason === 'render_wait_read_required');
    }
    assert.deepEqual(data.snapshot(), before);
  }
});

test('text waits and mask reject missing bytes, malformed input and stale plans', () => {
  for (const [request, wait, offset, key] of waitCases) {
    for (const omitted of [offset, offset + 1]) {
      const data = createRenderData({ writeWindows: windows }); data.seed(omitted === offset ? offset + 1 : offset, [0]);
      failure(request, data, {}, 'render_source_required'); failure(wait, data, {}, 'render_source_required');
    }
    const data = waitFixture(offset, 0), p = prepare(request, data, { waitMode: 'record-observations', [key]: [0] });
    assert.ok(p.handled);
    for (let maxWork = 1; maxWork < p.work; maxWork++) failure(request, waitFixture(offset, 0),
      { waitMode: 'record-observations', [key]: [0], maxWork }, 'render_work_budget_required');
    word(data, offset, 7); const before = data.snapshot(); assert.equal(data.commit(p).reason, 'render_plan_stale');
    assert.deepEqual(data.snapshot(), before);
    assert.throws(() => prepare(request, waitFixture(offset, 0), { [key]: Array(1) }), /Invalid render/);
  }
  const data = mask(), p = prepare(prepareRenderAEC8, data); word(data, 0xAB, 4);
  const before = data.snapshot(); assert.equal(data.commit(p).reason, 'render_plan_stale'); assert.deepEqual(data.snapshot(), before);
  assert.throws(() => prepare(prepareRenderAEC8, mask(), { y: 65536 }), /Invalid render/);
});

test('synthetic texthelper evidence identifies separately supplied FE69/FB39 and retains hardware boundary', async () => {
  const report = JSON.parse(await readFile('analysis/render-text-helpers-native.json', 'utf8'));
  assert.match(report.scope, /synthetic/); assert.match(report.scope, /FE69\/FB39 binding supplied separately/);
  assert.deepEqual(report.probes.map(p => p.handled), [true, true, true, true, true, true, false]);
  assert.equal(report.probes.at(-1).reason, 'render_io_read_required');
});
