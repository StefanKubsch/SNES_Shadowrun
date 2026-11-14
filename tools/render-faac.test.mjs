import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRenderFAAC, renderFAAC } from '../proof/render/cursor-faac.mjs';
import { cursorEntry as entry, cursorFixture as fixture, cursorWord as word } from './render-faac-fixtures.mjs';

const get = (data, address) => data.readByte(address).value | data.readByte(address + 1).value << 8;
function fail(data, options, reason) {
  const before = data.snapshot(), p = prepareRenderFAAC({ ...entry, data, ...options });
  assert.equal(p.handled, false); assert.equal(p.reason, reason); assert.deepEqual(data.snapshot(), before);
  for (const key of ['byteWrites', 'operations', 'ioRequests']) assert.equal(p[key], undefined);
  assert.throws(() => data.commit(p), /Invalid render plan/); return p;
}
test('FAAC preserves original ordered BYTE MMIO operands, WORD pointer stores and atomic commit', () => {
  const data = fixture(), before = data.snapshot(), p = prepareRenderFAAC({ ...entry, data });
  assert.equal(p.handled, true); assert.deepEqual(data.snapshot(), before);
  assert.equal(p.cursor, 0x202B); assert.equal(p.a, 0); assert.equal(p.x, 2); assert.equal(p.y, entry.y);
  assert.equal(p.bank, 0x80); assert.equal(p.status, 0x84); assert.equal(p.carry, 0); assert.equal(p.overflow, 0);
  assert.equal(p.work, 10); assert.equal(p.byteAccesses, 12); assert.equal(p.resultReads, 1); assert.equal(p.outputBytes, 0);
  assert.deepEqual(p.operations.map(o => [o.kind, o.space, o.address, o.value, o.bytes]), [
    ['read', 'data', 0, 2, 2], ['read', 'data', 4, 10, 1], ['write', 'io', 0x804202, 10, 1],
    ['read', 'data', 0x7E2022, 6, 1], ['write', 'io', 0x804203, 4, 1],
    ['read', 'data', 0x7E2062, 0x2000, 2], ['read', 'data', 2, 3, 2],
    ['read', 'io', 0x804216, 40, 2], ['write', 'data', 0x7E20C2, 0x202B, 2],
    ['write', 'data', 0x7E20E2, 0, 2],
  ]);
  assert.deepEqual(p.byteOperations.map(o => [o.kind, o.address, o.value]), [
    ['read', 0, 2], ['read', 1, 0], ['read', 4, 10], ['read', 0x7E2022, 6],
    ['read', 0x7E2062, 0], ['read', 0x7E2063, 32], ['read', 2, 3], ['read', 3, 0],
    ['write', 0x7E20C2, 43], ['write', 0x7E20C3, 32], ['write', 0x7E20E2, 0], ['write', 0x7E20E3, 0],
  ]);
  assert.equal(data.commit(p).handled, true); assert.equal(get(data, 0x7E20C2), 0x202B);
  assert.equal(get(data, 0x7E20E2), 0); assert.equal(data.readByte(0x7E4202).available, false);
});
test('all65536 row/width words use only BYTE operands and wrap two BYTE decrements', () => {
  const data = fixture();
  for (let value = 0; value < 65536; value++) {
    word(data, 4, value); word(data, 0x7E2022, value);
    const p = prepareRenderFAAC({ ...entry, data }); assert.equal(p.handled, true);
    assert.equal(p.row, value % 256); assert.equal(p.width, value % 256);
    assert.equal(p.multiplier, (value + 254) % 256);
    assert.equal(p.cursor, 0x202B); // Explicit4216 stays40, regardless of operands.
  }
});
test('all65536 first additions preserve carry into actual result0, independently checked by integer division', () => {
  const data = fixture({ position: 0xFFFF });
  for (let delta = 0; delta < 65536; delta++) {
    word(data, 2, delta);
    const p = prepareRenderFAAC({ ...entry, data, ioRead4216: [0] });
    const first = 65535 + delta, expected = first % 65536 + Math.floor(first / 65536);
    assert.equal(p.handled, true); assert.equal(p.cursor, expected % 65536);
    assert.equal(p.carry, Math.floor(expected / 65536));
    assert.equal(p.overflow, Number(first % 65536 < 32768 && expected >= 32768));
  }
});
test('all65536 actual results preserve final carry and signed overflow, not previous ADC flags', () => {
  const data = fixture({ position: 0x7FFF, delta: 0 });
  for (let result = 0; result < 65536; result++) {
    const p = prepareRenderFAAC({ ...entry, data, ioRead4216: [result] });
    const sum = 32767 + result, cursor = sum % 65536;
    assert.equal(p.handled, true); assert.equal(p.cursor, cursor); assert.equal(p.carry, Math.floor(sum / 65536));
    assert.equal(p.overflow, Number(result < 32768 && cursor >= 32768));
  }
});
test('all entryDBRs are restored and set final BYTE NZ while arithmetic C/V and interrupt bit survive', () => {
  for (let bank = 0; bank < 256; bank++) for (const status of [0, 1, 4, 5, 0xC7]) {
    const p = prepareRenderFAAC({ ...entry, data: fixture({ position: 0x7FFF, delta: 0 }), bank, status, ioRead4216: [1] });
    assert.equal(p.handled, true); assert.equal(p.bank, bank); assert.equal(p.cursor, 0x8000);
    assert.equal(p.status, status & 4 | 64 | (bank === 0 ? 2 : bank >= 128 ? 128 : 0));
    assert.deepEqual(p.ioRequests.map(o => o.address), [0x804202, 0x804203, 0x804216]);
  }
});
test('both signed overflow directions and Carry-in corners match independent signed sums', () => {
  const values = [0, 1, 2, 0x7FFE, 0x7FFF, 0x8000, 0x8001, 0xFFFE, 0xFFFF];
  const signed = v => v < 32768 ? v : v - 65536;
  for (const position of values) for (const delta of values) for (const result of values) {
    const p = prepareRenderFAAC({ ...entry, data: fixture({ position, delta }), ioRead4216: [result] });
    const first = position + delta, intermediate = first % 65536, carryIn = Math.floor(first / 65536);
    const sum = intermediate + result + carryIn, signedSum = signed(intermediate) + signed(result) + carryIn;
    assert.equal(p.handled, true); assert.equal(p.cursor, sum % 65536);
    assert.equal(p.carry, Math.floor(sum / 65536)); assert.equal(p.overflow, Number(signedSum < -32768 || signedSum > 32767));
  }
});
test('full odd and FFFF indices carry long reads/writes into7F without truncation', () => {
  for (const index of [0, 1, 0xDFDF, 0xDFE0, 0xDFE1, 0xFFFF]) {
    const data = fixture({ index }), p = prepareRenderFAAC({ ...entry, data });
    assert.equal(p.handled, true); assert.equal(p.x, index);
    assert.ok(p.readAddresses.includes(0x7E2020 + index)); assert.ok(p.readAddresses.includes(0x7E2060 + index));
    assert.equal(data.commit(p).handled, true); assert.equal(get(data, 0x7E20C0 + index), 0x202B);
    assert.equal(get(data, 0x7E20E0 + index), 0);
  }
});
test('unused high row/width bytes need no provider source; incoming WRAM4216 cannot replace MMIO', () => {
  const complete = fixture(), data = createRenderData({ writeWindows: complete.snapshot().writeWindows });
  for (const [a, v] of complete.snapshot().bytes) if (![0x7E0005, 0x7E2023].includes(a)) data.seed(a, [v]);
  word(data, 0x7E4216, 0xABCD);
  const p = prepareRenderFAAC({ ...entry, data, bank: 0x7E }); assert.equal(p.handled, true); assert.equal(p.cursor, 0x202B);
  fail(data, { bank: 0x7E, ioRead4216: null }, 'render_io_read_required');
});
test('every actually read initial source byte is required and failure withholds all effects', () => {
  const complete = fixture(), p = prepareRenderFAAC({ ...entry, data: complete });
  for (const omitted of p.readAddresses) {
    const data = createRenderData({ writeWindows: complete.snapshot().writeWindows });
    for (const [a, v] of complete.snapshot().bytes) if (a !== omitted) data.seed(a, [v]);
    assert.equal(fail(data, {}, 'render_source_required').address, omitted);
  }
});
test('exact work budget and four separate late write boundaries remain atomic', () => {
  fail(fixture(), { maxWork: 9 }, 'render_work_budget_required');
  assert.equal(prepareRenderFAAC({ ...entry, data: fixture(), maxWork: 10, maxOutputBytes: 1 }).handled, true);
  for (let limit = 0; limit < 4; limit++) {
    const addresses = [0x7E20C2, 0x7E20C3, 0x7E20E2, 0x7E20E3];
    const data = fixture({ writeWindows: addresses.slice(0, limit).map(a => [a, a]) });
    assert.equal(fail(data, {}, 'render_write_window_required').address, addresses[limit]);
  }
});
test('missing IO mode/results and incomplete entry/stack contexts produce unappliable boundaries', () => {
  fail(fixture(), { ioMode: null }, 'render_io_context_required');
  for (const ioRead4216 of [null, []]) fail(fixture(), { ioRead4216 }, 'render_io_read_required');
  for (const options of [{ bank: null }, { status: null }, { y: null }, { emulation: 1 }, { directPage: 1 }, { status: 0x38 }])
    fail(fixture(), options, 'render_entry_required');
  for (const stackWindow of [null, [0x1F00, 0x1F03]]) fail(fixture(), { stackWindow }, 'render_stack_required');
  assert.equal(prepareRenderFAAC({ ...entry, data: fixture(), stackWindow: [0x1F00, 0x1F04] }).handled, true);
});
test('actual direct-page reads cannot alias the protected stack', () => {
  assert.equal(fail(fixture(), { stackWindow: [0, 4] }, 'render_stack_alias_required').address, 0x7E0000);
  assert.equal(fail(fixture(), { stackWindow: [2, 6] }, 'render_stack_alias_required').address, 0x7E0004);
});
test('inner FAAC shares global4216 observation index, cumulative budget and one outer owner', () => {
  const data = fixture(), before = data.snapshot(), view = prepareRenderView(data, [0x7E1F00, 0x7E1FFF]);
  const observations = { resultReads: 1 }, budget = { work: 7, maxWork: 27, outputBytes: 12, maxOutputBytes: 12 };
  const context = { ...entry, observations, ioRead4216: [999, 40, 41] };
  const first = renderFAAC(view, context, budget), second = renderFAAC(view, context, budget);
  assert.equal(first.cursor, 0x202B); assert.equal(second.cursor, 0x202C); assert.equal(observations.resultReads, 3);
  assert.equal(first.work, 17); assert.equal(second.work, 27); assert.equal(second.outputBytes, 12);
  assert.deepEqual(data.snapshot(), before); assert.throws(() => data.commit(first), /Invalid render plan/);
  const p = view.finish(second); assert.equal(data.commit(p).handled, true); assert.equal(get(data, 0x7E20C2), 0x202C);
});
test('shared view reads changed parameter bytes afresh between calls without an inner commit', () => {
  const data = fixture({ writeWindows: [[0x7E0002, 0x7E0003], [0x7E20C2, 0x7E20C3], [0x7E20E2, 0x7E20E3]] });
  const view = prepareRenderView(data), observations = { resultReads: 0 };
  const budget = { work: 0, maxWork: 30, outputBytes: 0, maxOutputBytes: 1 };
  const context = { ...entry, observations, ioRead4216: [40, 40] };
  const first = renderFAAC(view, context, budget);
  // Explicit parent overlay change; provider itself remains untouched.
  view.write(2, 4); view.write(3, 0);
  const second = renderFAAC(view, context, budget);
  assert.equal(first.cursor, 0x202B); assert.equal(second.cursor, 0x202C); assert.equal(get(data, 2), 3);
});
test('source mutation and unrelated owner reject prepared plans; immutable ledger cannot change payload', () => {
  const data = fixture(), p = prepareRenderFAAC({ ...entry, data });
  assert.throws(() => p.byteWrites.push([1, 1]), TypeError); assert.throws(() => { p.byteWrites[0][1] = 1; }, TypeError);
  assert.throws(() => { p.operations[0].value = 1; }, TypeError);
  assert.throws(() => fixture().commit(p), /Invalid render plan/);
  word(data, 2, 4); const before = data.snapshot();
  assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' }); assert.deepEqual(data.snapshot(), before);
});
test('invalid explicit parameters are rejected rather than normalized or sparsely accepted', () => {
  for (const options of [{ y: -1 }, { y: 65536 }, { ioMode: 'simulate' }, { ioRead4216: [65536] },
    { ioRead4216: [-1] }, { ioRead4216: Array(1) }, { ioRead4216: new Uint16Array([40]) }])
    assert.throws(() => prepareRenderFAAC({ ...entry, data: fixture(), ...options }), /Invalid render FAAC context/);
});
test('generated FAAC probes repeat synthetic inputs and explicit source/stack boundaries', async () => {
  const report = JSON.parse(await readFile(new URL('../analysis/render-faac-native.json', import.meta.url)));
  assert.match(report.scope, /synthetic/); assert.equal(report.source.covered_bytes, 49);
  assert.equal(report.stackProof.minimum_protected_stack_bytes, 5); assert.equal(report.probes.length, 4);
  for (const probe of report.probes) {
    const data = fixture(probe.fixture), actual = prepareRenderFAAC({ data, ...report.declaredInputs, bank: probe.fixture.bank,
      ioRead4216: probe.fixture.result === null ? [] : [probe.fixture.result] });
    const { fixture: ignored, ...expected } = probe; assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);
  }
});
