import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView, renderAddress } from '../src/render/data.mjs';
import { prepareRenderBE6D, prepareRenderBCBE, renderBE6D } from '../proof/render/held-be6d.mjs';
import { heldEntry, heldWindows, heldFixture, heldWord as word, heldGet as get } from './render-be6d-fixtures.mjs';
import { seedOriginalAF1FData } from '../proof/render/original-af1f-data.mjs';
const prepare = (data, extra = {}, run = prepareRenderBE6D) => run({ ...heldEntry, data, ...extra });
function failure(data, extra, reason, run = prepareRenderBE6D) {
  const before = data.snapshot(), p = prepare(data, extra, run);
  assert.equal(p.handled, false, `${p.reason ?? p.outcome} at ${p.address}`); assert.equal(p.reason, reason);
  assert.deepEqual(data.snapshot(), before);
  for (const key of ['operations', 'byteOperations', 'byteWrites', 'ioWrites', 'calls', 'waitOperations']) assert.equal(p[key], undefined);
  assert.throws(() => data.commit(p), /Invalid render plan/); return p;
}
function copy(data, { omit = null, windows = data.snapshot().writeWindows } = {}) {
  const out = createRenderData({ writeWindows: windows });
  for (const [a, n] of data.snapshot().bytes) if (a !== omit) out.seed(a, [n]); return out;
}
const callNames = p => p.calls.map(v => v.name);
const dataReads = (p, address) => p.operations.filter(v => v.kind === 'read' && v.space === 'data' && v.address === address);
function movement({ bank = 0x80, gate = 1, input = 0x500, vx = 0, vy = 0, px = 0x1000, py = 0x1000 } = {}) {
  const base = bank * 65536, data = createRenderData({ writeWindows: [[0x7E01D0, 0x7E01D7], [0x7F01D0, 0x7F01D7]] });
  for (const [offset, value] of [[0x1D8, gate], [0x1CA, input], [0x1D0, vx], [0x1D2, vy],
    [0x1D4, px], [0x1D6, py], [0x1DA, 65535]]) word(data, base + offset, value);
  return data;
}
// Separate arithmetic oracle: mathematical modulo and signed overflow,
// source-domain unsigned clamps. No native helper or opcode execution.
function axisOracle(old, positive, negative) {
  if (positive) return Math.min((old >= 32768 ? 0 : old) + 48, 768);
  if (negative) return Math.max(((old < 32768 ? 0 : old) - 48 + 65536) % 65536, 64768);
  return 0;
}
function motionOracle(vx, vy, px, py, nibble) {
  const sx = axisOracle(vx, nibble & 1, nibble & 2), sy = axisOracle(vy, nibble & 4, nibble & 8);
  const wrapX = (px + sx) % 65536, wrapY = (py + sy) % 65536;
  const signed = v => v >= 32768 ? v - 65536 : v;
  const totalY = signed(py) + signed(sy);
  return { sx, sy, px: Math.max(768, Math.min(wrapX, 61184)), py: Math.max(768, Math.min(wrapY, 52736)),
    status: 0x84 | Number(wrapY > 52736) | (totalY < -32768 || totalY > 32767 ? 64 : 0) };
}

test('zero held gate preserves X/Y/C/V/I and needs no input, speed, position or callee bytes', () => {
  const data = createRenderData(); word(data, 0x1D8, 0);
  const p = prepare(data, { ioMode: null, waitMode: null }); assert.ok(p.handled);
  assert.equal(p.outcome, 'held_disabled'); assert.equal(p.a, 0); assert.equal(p.status, 0x47);
  assert.equal(p.x, 0xBEEF); assert.equal(p.y, 0x1234); assert.equal(p.work, 2);
  assert.deepEqual(p.byteWrites, []); assert.deepEqual(p.calls, []);
});
test('all65536 speeds on both directional paths agree with an independent wrapping arithmetic oracle', () => {
  for (const nibble of [5, 10]) for (let vx = 0; vx < 65536; vx++) {
    const vy = vx ^ 0x8000, px = 0xFF00, py = 0x7F00, data = movement({ input: nibble << 8, vx, vy, px, py });
    const p = prepare(data), expected = motionOracle(vx, vy, px, py, nibble); assert.ok(p.handled);
    assert.equal(p.x, nibble >>> 1); assert.equal(p.y, heldEntry.y); assert.equal(p.status, expected.status);
    data.commit(p); assert.equal(get(data, 0x1D0), expected.sx); assert.equal(get(data, 0x1D2), expected.sy);
    assert.equal(get(data, 0x1D4), expected.px); assert.equal(get(data, 0x1D6), expected.py);
  }
});
test('all inputnibbles preserve firstbit priority and zero directions need no old speed sources', () => {
  for (let nibble = 1; nibble < 16; nibble++) for (const high of [0, 0xF000]) {
    const vx = 0x8000, vy = 0xFFFF, data = movement({ input: high | nibble << 8 | 0xFF, vx, vy });
    let selected = data;
    if (!(nibble & 3)) selected = copy(selected, { omit: 0x7E01D0 });
    if (!(nibble & 12)) selected = copy(selected, { omit: 0x7E01D2 });
    const p = prepare(selected), expected = motionOracle(vx, vy, 0x1000, 0x1000, nibble); assert.ok(p.handled);
    selected.commit(p); assert.equal(get(selected, 0x1D0), expected.sx); assert.equal(get(selected, 0x1D2), expected.sy);
  }
});
test('original movement clamps wrapping sums at all four inclusive position boundaries', () => {
  for (const [px, py] of [[0, 0], [0x2D0, 0x2D0], [0x300, 0x300], [0xEED0, 0xCDD0],
    [0xEF00, 0xCE00], [0xFFF0, 0xFFF0], [0x7FFF, 0x7FFF], [0x8000, 0x8000]]) {
    const data = movement({ px, py }), p = prepare(data), e = motionOracle(0, 0, px, py, 5); assert.ok(p.handled);
    data.commit(p); assert.equal(get(data, 0x1D4), e.px); assert.equal(get(data, 0x1D6), e.py); assert.equal(p.status, e.status);
  }
});
test('every supported DBR uses actual unindexed held/position bytes and preserves return bank', () => {
  for (let bank = 0; bank < 256; bank++) {
    if (renderAddress(bank * 65536 + 0x1D8) === null) continue;
    const data = movement({ bank }), p = prepare(data, { bank }); assert.ok(p.handled); assert.equal(p.bank, bank);
    data.commit(p); assert.equal(get(data, bank * 65536 + 0x1D4), 0x1030);
  }
});
test('held tail freshly rereads input after both speed/position writes before selecting or releasing', () => {
  const p = prepare(heldFixture()); assert.ok(p.handled); assert.equal(p.outcome, 'target_text_composed');
  const indices = p.operations.flatMap((v, i) => v.kind === 'read' && v.address === 0x8001CA ? [i] : []);
  assert.equal(indices.length, 2);
  const positions = p.operations.flatMap((v, i) => v.kind === 'write' && [0x8001D4, 0x8001D6].includes(v.address) ? [i] : []);
  assert.ok(positions.every(i => i > indices[0] && i < indices[1]));
  assert.deepEqual(callNames(p), ['FADD', 'F963', 'FE69']);
});
test('matching type/slot tracks with no text/transfer calls and actual shared geometry words', () => {
  const data = heldFixture({ tracked: true }), p = prepare(data, {}, prepareRenderBCBE); assert.ok(p.handled);
  assert.equal(p.outcome, 'target_tracked'); assert.equal(p.visits, 1); assert.equal(p.x, 2); assert.equal(p.y, 0);
  assert.equal(p.a, 0x1000); assert.equal(p.status, 6); assert.equal(p.outputBytes, 0); assert.deepEqual(p.calls, []);
  data.commit(p); for (const [address, value] of [[0x14, 16], [0x17, 32], [0xE, 16], [0x11, 16],
    [0x1D4, 0x1000], [0x1D6, 0x1000]]) assert.equal(get(data, address), value);
});
test('new selection composes width/allocation/text in original order and saves the selected textword', () => {
  const data = heldFixture(), before = data.snapshot(), p = prepare(data); assert.ok(p.handled);
  assert.deepEqual(data.snapshot(), before); assert.deepEqual(callNames(p), ['FADD', 'F963', 'FE69']);
  assert.equal(p.outputBytes, 84); assert.equal(p.productReads, 1); assert.equal(p.pollsF6, 1); assert.equal(p.pollsF8, 1);
  assert.equal(p.pollsFA, 1); assert.equal(p.pollsFC, 1); assert.equal(p.quotientReads, 0); assert.equal(p.resultReads, 2);
  assert.deepEqual(p.ioRequests.filter(v => v.kind === 'read' && (v.address & 65535) === 0x2134).map(v => v.value), [1]);
  data.commit(p); assert.equal(get(data, 0x1DA), 1); assert.equal(get(data, 0x1DE), 2);
  assert.equal(get(data, 0x1E0), 0); assert.equal(get(data, 0x1E2), 16);
  assert.equal(get(data, 0x1DC), 2); assert.equal(get(data, 2), 0x10); assert.equal(data.readByte(0x7E21A0).value, 65);
});
test('changed target resets atomically, restores selected X and then freshly reads shared geometry scratch', () => {
  const data = heldFixture({ currentType: 2 }), p = prepare(data, {}, prepareRenderBCBE); assert.ok(p.handled);
  assert.deepEqual(callNames(p), ['AD92', 'FADD', 'F963', 'FE69']); assert.equal(p.pollsF8, 2); assert.equal(p.outputBytes, 3796);
  const lastReset = p.operations.findLastIndex(v => v.kind === 'write' && v.address === 0x8001DE && v.value === 65535);
  assert.ok(p.operations.findIndex((v, i) => i > lastReset && v.kind === 'read' && v.address === 0x14) > lastReset);
  data.commit(p); assert.equal(get(data, 0x1DE), 2); assert.equal(get(data, 0x1DA), 1);
});
test('action scan uses all13 fullWORD entries and unmatched FFFE reads actual819780', () => {
  for (const fallback of [false, true]) {
    const data = heldFixture({ action: true, fallback }), p = prepare(data, {}, prepareRenderBCBE); assert.ok(p.handled);
    const tableReads = p.operations.filter(v => v.kind === 'read' && v.address >= 0x809700 && v.address <= 0x809718);
    assert.equal(tableReads.length, fallback ? 13 : 1);
    assert.equal(dataReads(p, fallback ? 0x819780 : 0x80979A).length, 1);
    assert.equal(dataReads(p, 0x809780).length, 0);
  }
  const missing = copy(heldFixture({ action: true, fallback: true }), { omit: 0x819781 });
  failure(missing, {}, 'render_source_required', prepareRenderBCBE);
});
test('slot/head WORDs remain unaligned and can carry into the next data bank without slot clamps', () => {
  for (const slot of [1, 3, 0xFFFF]) {
    const data = heldFixture({ slot, head: 3, tracked: true, currentSlot: slot }), p = prepare(data, {}, prepareRenderBCBE);
    assert.ok(p.handled, JSON.stringify(p)); assert.equal(p.x, slot); assert.equal(p.y, 3); assert.equal(p.outcome, 'target_tracked');
  }
});
test('type index retains secondASL carry and uses full wrapping WORD type', () => {
  for (const type of [0, 1, 0x8000, 0xFFFF]) {
    const data = heldFixture({ type, tracked: true }), p = prepare(data, {}, prepareRenderBCBE); assert.ok(p.handled);
    assert.equal(p.outcome, type & 0x8000 ? 'target_text_composed' : 'target_tracked');
    assert.equal(dataReads(p, 0x8CEFB0 + ((type * 6 + (type >>> 14 & 1)) & 65535)).length, type & 0x8000 ? 2 : 1);
  }
  failure(heldFixture({ type: 0x4000, tracked: true }), {}, 'render_address_required', prepareRenderBCBE);
});
test('special type000B accepts FFFD or the fresh WORD OR and otherwise rejects without table reads', () => {
  for (const gate of [0xFFFD, 1]) {
    const data = heldFixture({ type: 11, gate, tracked: true });
    if (gate !== 0xFFFD) { word(data, 0x1D5F, 0); word(data, 0x1D6D, 0x100); }
    const p = prepare(data, {}, prepareRenderBCBE); assert.ok(p.handled); assert.equal(p.outcome, 'target_tracked');
    if (gate === 0xFFFD) assert.equal(dataReads(p, 0x801D5F).length, 0);
  }
  const data = heldFixture({ type: 11 }); word(data, 0x1D5F, 0); word(data, 0x1D6D, 0);
  const p = prepare(data, {}, prepareRenderBCBE); assert.ok(p.handled); assert.equal(p.outcome, 'selection_exhausted');
  assert.equal(dataReads(p, 0x8CEFF2).length, 0);
});
test('negative listhead bypasses all geometry and release occurs only for nonnegative currenttype', () => {
  for (const currentType of [0xFFFF, 0x8000, 0]) {
    const data = heldFixture({ head: 0xFFFF, currentType }), p = prepare(data, {}, prepareRenderBCBE); assert.ok(p.handled);
    assert.equal(p.visits, 0); assert.equal(p.y, currentType & 0x8000 ? 0xFFFF : p.calls[0].y); assert.equal(dataReads(p, 0x8001D4).length, 0);
    assert.deepEqual(callNames(p), currentType & 0x8000 ? [] : ['AD92']);
  }
});
test('rejected records decrement Y twice, and zero recordgate never reads type or table bytes', () => {
  const data = heldFixture({ head: 2 }); word(data, 0x14B4, 4); word(data, 0x1094, 0); word(data, 0x14B2, 2);
  const p = prepare(data, {}, prepareRenderBCBE); assert.ok(p.handled); assert.equal(p.visits, 2); assert.equal(p.y, 0);
  assert.equal(dataReads(p, 0x7E3F2C).length, 0); assert.equal(p.outcome, 'target_text_composed');
});
test('negative geometry uses two SEC/ROR then two LSR, rather than a signed coordinate approximation', () => {
  const data = heldFixture({ tracked: true }); word(data, 0x1E4, 0xFFC0); word(data, 0x7E429A, 0x8000); word(data, 0x1E0, 0x3FEC);
  const p = prepare(data, {}, prepareRenderBCBE); assert.ok(p.handled); assert.equal(p.outcome, 'target_tracked');
  data.commit(p); assert.equal(get(data, 0x14), 0x3FFC); assert.equal(get(data, 0x1D4), 0x1000);
});
test('geometry rejects signed first difference, upper/lower comparisons and FFFF text before later sources', () => {
  for (const [address, value] of [[0x8CEFB6, 65535], [0x1E6, 0x8000], [0x7E4242, 0x80],
    [0x1D6, 0x2100], [0x7E429A, 0], [0x1E4, 0], [0x1D4, 0x1100]]) {
    const data = heldFixture(); word(data, address, value);
    const p = prepare(data, {}, prepareRenderBCBE); assert.ok(p.handled, JSON.stringify(p)); assert.equal(p.outcome, 'selection_exhausted');
    assert.deepEqual(p.calls, []);
  }
});
test('tracking accepts254, rejects255/borrrow, and second failure retains earlier position store only on outer success', () => {
  for (const [first, second, outcome] of [[254, 254, 'target_tracked'], [255, 16, 'tracking_released'],
    [65535, 16, 'tracking_released'], [254, 255, 'tracking_released']]) {
    const data = heldFixture({ tracked: true }); word(data, 0x1E0, 16 - first & 65535); word(data, 0x1E2, 32 - second & 65535);
    const p = prepare(data, {}, prepareRenderBCBE); assert.ok(p.handled); assert.equal(p.outcome, outcome);
    data.commit(p); assert.equal(get(data, 0x1D4), first < 255 ? first << 8 : 0x1000);
    if (outcome === 'tracking_released') assert.equal(get(data, 0x1DA), 65535);
  }
  const data = heldFixture({ tracked: true }); word(data, 0x1E0, 16 - 254 & 65535); word(data, 0x1E2, 32 - 255 & 65535);
  failure(data, { waitRead01F8: [] }, 'render_wait_read_required', prepareRenderBCBE);
});
test('FA3E trims only matching lastindex, reads each backwards flag and preserves full odd/wrapping indices', () => {
  for (const oldIndex of [0, 1, 0xFFFF]) {
    const data = heldFixture({ input: 0x100, currentType: 1, oldIndex, cursor: oldIndex });
    word(data, 0x7E2060 + oldIndex, 0x3456);
    const p = prepare(data); assert.ok(p.handled, JSON.stringify(p)); assert.equal(p.outcome, 'held_released');
    assert.deepEqual(callNames(p), ['AD92']); data.commit(p);
    assert.equal(get(data, 0x204), oldIndex - 2 & 65535); assert.equal(get(data, 0x212), 0x3456);
    assert.equal(get(data, 0x1DA), 65535); assert.equal(get(data, 0x1DE), 65535);
  }
  const data = heldFixture({ input: 0x100, currentType: 1, oldIndex: 4, cursor: 4 });
  word(data, 0x226, 0x100); word(data, 0x228, 0); word(data, 0x22A, 1); word(data, 0x200, 1); word(data, 0x7E2062, 0x1234);
  const p = prepare(data); assert.ok(p.handled); data.commit(p);
  assert.equal(get(data, 0x204), 0); assert.equal(get(data, 0x212), 0x1234); assert.equal(get(data, 0x22A), 0);
});
test('F963 capacity end still stores fresh DP00 and runs FE69 with the saved textword', () => {
  const data = heldFixture({ cursor: 0x1E });
  // No allocation result is invented: existing DP00=27 selects preexisting
  // full, odd table fields, and those explicit fields permit the later text.
  for (const [offset, value] of [[0x2020, 3], [0x2040, 3], [0x2060, 0x20], [0x2080, 0x100],
    [0x20C0, 0x20], [0x20E0, 0], [0x2100, 0], [0x2140, 0]]) word(data, 0x7E0000 + offset + 27, value);
  const p = prepare(data, { ioRead2134: null }); assert.ok(p.handled); assert.equal(p.calls[1].outcome, 'capacity_end');
  assert.equal(p.productReads, 0); assert.equal(p.pollsF6, 0); assert.equal(p.pollsF8, 0);
  data.commit(p); assert.equal(get(data, 0x1DC), 27); assert.equal(get(data, 2), 0x10);
});
test('global wait transcripts are consumed across release and allocation in original order', () => {
  const data = heldFixture({ currentType: 2 }), p = prepare(data, {
    waitRead01F8: [3, 0, 4, 0, 9], waitRead01F6: [2, 0], waitRead01FA: [0x100, 0], waitRead01FC: [5, 0],
  }, prepareRenderBCBE); assert.ok(p.handled);
  assert.equal(p.pollsF8, 4); assert.equal(p.pollsF6, 2); assert.equal(p.pollsFA, 2); assert.equal(p.pollsFC, 2);
  assert.deepEqual(p.calls.map(v => v.pollsF8), [2, 2, 4, 4]);
  const observed = p.operations.filter(v => v.kind === 'read' && v.bytes === 2 && v.address === 0x8001F8);
  assert.deepEqual(observed.filter(v => v.phase === 'wait').map(v => v.value), [4, 0]);
  assert.deepEqual(p.waitOperations.filter(v => v.kind === 'read' && v.phase === 'wait' && (v.address & 65535) === 0x1F8).map(v => v.value), [3, 0, 4, 0]);
  failure(heldFixture({ currentType: 2 }), { waitRead01F8: [0] }, 'render_wait_read_required', prepareRenderBCBE);
});
test('real product and text arithmetic reads retain chronological explicitly supplied values', () => {
  const data = heldFixture(); word(data, 0x212, 0x23FF);
  const p = prepare(data, { ioRead2134: [1, 7] }); assert.ok(p.handled);
  assert.equal(p.productReads, 2); assert.deepEqual(p.ioRequests.filter(v => v.kind === 'read' && (v.address & 65535) === 0x2134).map(v => v.value), [1, 7]);
  failure(heldFixture(), { ioRead2134: [] }, 'render_io_read_required');
  assert.equal(prepare(heldFixture(), { ioRead4214: [] }).quotientReads, 0);
  failure(heldFixture(), { ioRead4216: [0] }, 'render_io_read_required');
});
test('capacity fallthrough and wordwrap distribute all BYTEquotients/WORDresults in actual original order', () => {
  const data = heldFixture({ wrap: true }), p = prepare(data, { ioRead4214: [7, 8, 9], ioRead4216: [0, 0, 1, 0, 0] });
  assert.ok(p.handled); assert.equal(p.productReads, 0); assert.equal(p.quotientReads, 2); assert.equal(p.resultReads, 5);
  assert.deepEqual(p.ioRequests.filter(v => v.kind === 'read').map(v => v.value), [0, 0, 7, 8, 1, 0, 0]);
  assert.equal(p.ioRequests.find(v => v.kind === 'write' && v.address === 0x804202).value, 9);
  failure(heldFixture({ wrap: true }), { ioRead4214: [7], ioRead4216: [0, 0, 1, 0, 0] }, 'render_io_read_required');
  failure(heldFixture({ wrap: true }), { ioRead4216: [0, 0, 1, 0] }, 'render_io_read_required');
});
test('physical7E/7F multiplication register bytes are actual data and consume no declared MMIOproduct values', () => {
  for (const bank of [0x7E, 0x7F]) {
    const data = heldFixture({ bank }); word(data, bank * 65536 + 0x2134, 1);
    const p = prepare(data, { bank, ioRead2134: [] }); assert.ok(p.handled, `${p.reason} ${p.address}`);
    assert.equal(p.productReads, 1); assert.equal(p.ioRequests.some(v => (v.address & 65535) === 0x2134), false);
    data.commit(p); assert.equal(get(data, bank * 65536 + 0x1DC), 2);
  }
});
test('active AF1F inside release retains explicit stable arithmetic and shares all output limits', async () => {
  const asset = JSON.parse(await readFile('assets/render-af1f-data.json', 'utf8'));
  const fixture = () => {
    const data = heldFixture({ currentType: 2 }); seedOriginalAF1FData(data, asset);
    for (const [address, value] of [[0x1D61, 1], [0x7E2DE6, 0], [0x7E3C00, 60], [0x7E33DE, 0]]) word(data, address, value);
    return data;
  };
  failure(fixture(), {}, 'render_division_context_required', prepareRenderBCBE);
  const p = prepare(fixture(), { divisionMode: 'stable-native' }, prepareRenderBCBE); assert.ok(p.handled);
  assert.equal(p.calls[0].stableDivisions.length, 3); assert.equal(p.outputBytes, 3832);
  failure(fixture(), { divisionMode: 'stable-native', maxOutputBytes: 3831 }, 'render_output_budget_required', prepareRenderBCBE);
});
test('empty dictionary or nonterminating text keeps all selected state pending until the global work boundary', () => {
  const data = heldFixture(); word(data, 0x9D8000, 0); word(data, 0x9D8002, 0); data.seed(0x9D8010, Array(100).fill(0));
  failure(data, { maxWork: 3000 }, 'render_work_budget_required');
});
test('late output/work/wait boundaries discard held movement, selection, reset and all inner effects', () => {
  for (const extra of [{ maxOutputBytes: 83 }, { maxWork: 1330 }, { waitRead01F6: [] },
    { waitRead01F8: [] }, { waitRead01FC: [] }, { waitRead01FA: [] }, { ioMode: null }, { waitMode: null }])
    failure(heldFixture(), extra, extra.maxOutputBytes ? 'render_output_budget_required' : extra.maxWork ? 'render_work_budget_required'
      : extra.ioMode === null ? 'render_io_context_required' : extra.waitMode === null ? 'render_wait_context_required' : 'render_wait_read_required');
  failure(heldFixture({ currentType: 2 }), { maxOutputBytes: 3795 }, 'render_output_budget_required', prepareRenderBCBE);
  const nominal = prepare(heldFixture()); assert.ok(prepare(heldFixture(), { maxOutputBytes: nominal.outputBytes, maxWork: nominal.work }).handled);
});
test('every initially needed sourcebyte and final resetmarker/window remains mandatory', () => {
  const data = heldFixture(), p = prepare(data), initial = new Map(data.snapshot().bytes);
  const written = new Set(), required = new Set();
  for (const event of p.byteOperations) {
    const address = renderAddress(event.address);
    if (event.kind === 'write') written.add(address);
    else if (!written.has(address) && initial.has(address)) required.add(address);
  }
  for (const address of required) failure(copy(data, { omit: address }), {}, 'render_source_required');
  const changed = heldFixture({ currentType: 2 });
  failure(copy(changed, { windows: heldWindows.map(w => w[0] === 0x7E0000 ? [0x7E0000, 0x7E01D9] : w) }),
    {}, 'render_write_window_required', prepareRenderBCBE);
});
test('root32-byte and standalone30-byte stack protection includes transitive text/reset aliases', () => {
  failure(heldFixture(), { stackWindow: [0x1000, 0x101E] }, 'render_stack_required');
  failure(heldFixture(), { stackWindow: [0x1000, 0x101C] }, 'render_stack_required', prepareRenderBCBE);
  assert.ok(prepare(heldFixture(), { stackWindow: [0x1000, 0x101F] }).handled);
  assert.ok(prepare(heldFixture(), { stackWindow: [0x1000, 0x101D] }, prepareRenderBCBE).handled);
  for (const stackWindow of [[0x1D0, 0x1EF], [0, 31], [0x2AE0, 0x2AFF]])
    failure(heldFixture(), { stackWindow }, 'render_stack_alias_required');
});
test('entry context, sparse transcripts and malformed budgets fail before shared writes', () => {
  for (const extra of [{ bank: null }, { status: 0x20 }, { status: 0x10 }, { status: 8 }, { directPage: 1 }, { emulation: 1 }, { x: null }, { y: null }])
    failure(heldFixture(), extra, 'render_entry_required');
  for (const extra of [{ x: -1 }, { y: 65536 }, { ioRead2134: [65536] }, { ioRead4214: [256] },
    { waitRead01F8: Array(1) }, { divisionMode: 'guess' }, { ioMode: 'guess' }, { waitMode: 'guess' }, { maxWork: 0 }])
    assert.throws(() => prepare(heldFixture(), extra), /Invalid render/);
});
test('all calls remain manual children of one immutable outer plan; stale and foreign payloads fail', () => {
  const data = heldFixture(), p = prepare(data); data.seed(0x7E1000, [1]);
  assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' });
  assert.throws(() => heldFixture().commit(p), /Invalid render plan/);
  const other = heldFixture(), view = prepareRenderView(other, [0x7E1F00, 0x7E1FFF]);
  const r = renderBE6D(view, heldEntry, { work: 0, maxWork: 1000000, maxOutputBytes: 65536, outputBytes: 0 });
  assert.ok(r.handled); assert.throws(() => other.commit(r), /Invalid render plan/);
  for (const call of r.calls) assert.throws(() => other.commit(call), /Invalid render plan/);
  assert.ok(other.commit(view.finish(r)).handled);
});
test('eight recorded probes are independently reproduced from explicit synthetic fixtures', async () => {
  const report = JSON.parse(await readFile('analysis/render-be6d-native.json', 'utf8'));
  assert.equal(report.probes.length, 8); assert.match(report.scope, /synthetic/); assert.equal(report.progress_reference, 'docs/PORTIERUNGSSTAND.json');
  for (const saved of report.probes) {
    const p = prepare(heldFixture(saved.fixture), saved.extra, saved.helper === 'BE6D' ? prepareRenderBE6D : prepareRenderBCBE);
    const { operations, byteOperations, ioRequests, ioWrites, readAddresses, byteWrites, ...result } = p;
    assert.deepEqual(result, Object.fromEntries(Object.entries(saved).filter(([k]) => !['helper', 'fixture', 'extra'].includes(k))));
  }
});
