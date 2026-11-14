import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView, renderAddress } from '../src/render/data.mjs';
import { prepareRenderAD92, renderAD92 } from '../proof/render/compose-ad92.mjs';
import { ad92Entry, ad92Windows, ad92Fixture, seedWord, getWord } from './render-ad92-fixtures.mjs';

const prepare = (data, extra = {}) => prepareRenderAD92({ ...ad92Entry, data, ...extra });
const reads = (p, offset) => p.operations.filter(v => v.phase === 'list' && v.kind === 'read'
  && (v.address & 65535) === offset).map(v => v.value);
function failure(data, extra, reason) {
  const before = data.snapshot(), p = prepare(data, extra);
  assert.equal(p.handled, false, JSON.stringify(p)); assert.equal(p.reason, reason);
  assert.deepEqual(data.snapshot(), before);
  for (const key of ['byteWrites', 'operations', 'conversion', 'waitOperations', 'ioWrites']) assert.equal(p[key], undefined);
  assert.throws(() => data.commit(p), /Invalid render plan/); return p;
}
function copy(data, { omit = null, windows = data.snapshot().writeWindows } = {}) {
  const out = createRenderData({ writeWindows: windows });
  for (const [address, value] of data.snapshot().bytes) if (address !== omit) out.seed(address, [value]);
  return out;
}

test('AD92 preserves the original conversion and draws a separately calculated border in one outer commit', () => {
  const data = ad92Fixture(), before = data.snapshot(), p = prepare(data);
  assert.ok(p.handled); assert.deepEqual(data.snapshot(), before);
  assert.equal(p.entries, 1); assert.equal(p.visits, 1); assert.equal(p.outputBytes, 3736);
  assert.equal(p.entryOutputBytes, 24); assert.equal(p.x, 2); assert.equal(p.y, 0x286);
  assert.equal(p.a, 0); assert.equal(p.status, 7); assert.equal(p.polls, 1);
  assert.equal(p.byteAccesses, p.operations.length); assert.ok(p.work > p.byteAccesses);
  data.commit(p);
  const expected = [[0x200, 0x2801], [0x202, 0x2802], [0x204, 0x2802], [0x206, 0x6801],
    [0x240, 0x2803], [0x242, 0x2827], [0x244, 0x2828], [0x246, 0x6803],
    [0x280, 0xA801], [0x282, 0xA802], [0x284, 0xA802], [0x286, 0xE801]];
  for (const [offset, value] of expected) assert.equal(getWord(data, 0x7E23A0 + offset), value);
  assert.equal(getWord(data, 0x1F8), 0); assert.equal(getWord(data, 0x7E23A0), 0x2C18);
});

test('zero last index still visits entry zero and inclusive positive end visits all even indices', () => {
  for (const [last, visits, end] of [[0, 1, 2], [1, 1, 2], [2, 2, 4], [4, 3, 6]]) {
    const p = prepare(ad92Fixture({ last, flags: [0, 0, 0] })); assert.ok(p.handled);
    assert.equal(p.visits, visits); assert.equal(p.x, end); assert.equal(p.entries, 0);
    assert.equal(p.outputBytes, 3712); assert.equal(p.status, 7);
  }
});

test('signed initial max skips the list but always reaches the final counter request', () => {
  for (const last of [0x8000, 0x8001, 0xFFFE, 0xFFFF]) {
    const p = prepare(ad92Fixture({ last, counter: 0xFFFF }), { waitMode: null, waitRead01F8: null });
    assert.ok(p.handled); assert.equal(p.listSkipped, true); assert.equal(p.visits, 0);
    assert.equal(p.entries, 0); assert.equal(p.x, 0xFFFE); assert.equal(p.y, p.conversion.y);
    assert.equal(p.requestCounter, 0); assert.equal(p.polls, 1); assert.equal(p.status, 6);
  }
});

test('unsigned lower bound skips flag sources until reached and any nonzero WORD flag draws', () => {
  for (const flag of [1, 0x100, 0x8000, 0xFFFF]) {
    const data = ad92Fixture({ last: 4, first: 3, flags: [0, 0, flag] });
    const p = prepare(copy(copy(data, { omit: 0x7E0226 }), { omit: 0x7E0228 })); assert.ok(p.handled);
    assert.equal(p.visits, 3); assert.equal(p.entries, 1);
    assert.deepEqual(reads(p, 0x226), []); assert.deepEqual(reads(p, 0x228), []);
    assert.equal(p.outputBytes, 3736);
  }
  const data = ad92Fixture({ last: 4, first: 0xFFFF, flags: [] });
  assert.equal(prepare(data).entries, 0);
});

test('multiple entries share converted output, scratch and one cumulative output allowance', () => {
  const p = prepare(ad92Fixture({ last: 4, flags: [1, 1, 1] })); assert.ok(p.handled);
  assert.equal(p.entries, 3); assert.equal(p.outputBytes, 3784); assert.equal(p.entryOutputBytes, 72);
  assert.equal(p.x, 6); assert.equal(p.y, 0x486);
  assert.deepEqual(reads(p, 0x200), [0, 0, 0]);
});

test('full WORD output index carries into7F while the DP scratch remains in7E', () => {
  const data = ad92Fixture(); seedWord(data, 0x7E2000, 0xFFF0);
  const p = prepare(data); assert.ok(p.handled);
  assert.equal(p.entries, 1); data.commit(p);
  // The high output index carries into7F; it cannot corrupt low7E scratch.
  assert.equal(getWord(data, 0x7F2390), 0x2801); assert.equal(getWord(data, 0xCF), 0);
});

test('a reached table overlapping the original conversion reads its new bytes in the same overlay', () => {
  const data = ad92Fixture({ first: 0x3A0, last: 0x3A0, flags: [] });
  seedWord(data, 0x226 + 0x3A0, 1);
  const before = data.snapshot(), view = prepareRenderView(data, [0x7E1F00, 0x7E1FFF]), observed = [];
  const shared = { read(address) {
    const value = view.read(address);
    if (address === 0x7E23A0 || address === 0x7E23A1) observed.push([address, value]);
    return value;
  }, write: (address, value) => view.write(address, value) };
  assert.throws(() => renderAD92(shared, ad92Entry,
    { work: 0, maxWork: 1000000, maxOutputBytes: 4000, outputBytes: 0 }),
    e => e.reason === 'render_output_budget_required' && e.callerPhase === 'ACCF');
  assert.deepEqual(observed.slice(-2), [[0x7E23A0, 0x18], [0x7E23A1, 0x2C]]);
  assert.deepEqual(data.snapshot(), before);
});

test('entry output changes a later flag before its fresh caller read', () => {
  const data = ad92Fixture({ bank: 0x7F, last: 2, flags: [1, 1], positions: [0xDE88, 0x400] });
  seedWord(data, 0x7F0228, 0);
  const p = prepare(data, { bank: 0x7F }); assert.ok(p.handled, JSON.stringify(p));
  assert.equal(p.entries, 2); assert.deepEqual(reads(p, 0x228), [1]);
  data.commit(p); assert.equal(getWord(data, 0x7F0228), 0x2801);
});

test('entry output changes both bounds and subsequent unsigned loop tests reread them', () => {
  const data = ad92Fixture({ bank: 0x7F, positions: [0xDE60] });
  seedWord(data, 0x7F0226 + 0x2802, 0);
  const p = prepare(data, { bank: 0x7F }); assert.ok(p.handled, JSON.stringify(p));
  assert.equal(p.entries, 1); assert.equal(p.visits, 5122); assert.equal(p.x, 0x2804);
  assert.equal(reads(p, 0x200)[0], 0); assert.ok(reads(p, 0x200).slice(1).every(v => v === 1));
  data.commit(p); assert.equal(getWord(data, 0x7F0200), 0x2801); assert.equal(getWord(data, 0x7F0204), 0x2802);
});

test('a changed unsigned maximum can wrap X and remains bounded only by shared work', () => {
  const data = ad92Fixture({ bank: 0x7F, positions: [0xDE60] }); seedWord(data, 0x7E2180, 0xDFFE);
  const p = failure(data, { bank: 0x7F, maxWork: 160000 }, 'render_work_budget_required');
  assert.equal(p.callerPhase, 'list');
});

test('every mirrored DBR and physical7E/7F uses actual parameter and counter bytes', () => {
  for (let bank = 0; bank < 256; bank++) {
    if (renderAddress(bank * 65536 + 0x1FE) === null) continue;
    const data = ad92Fixture({ bank, flags: [0] }), p = prepare(data, { bank }); assert.ok(p.handled);
    assert.equal(p.bank, bank); assert.equal(p.entries, 0); assert.equal(p.status, 7); data.commit(p);
    assert.equal(getWord(data, bank * 65536 + 0x1F8), 0);
  }
});

test('active AF1F requires explicit stable-native arithmetic and contributes all output rewrites', () => {
  failure(ad92Fixture({ active: true }), {}, 'render_division_context_required');
  const p = prepare(ad92Fixture({ active: true }), { divisionMode: 'stable-native' }); assert.ok(p.handled);
  assert.equal(p.conversion.outcome, 'af1f_active'); assert.equal(p.conversion.af1f.divisions.length, 3);
  assert.equal(p.outputBytes, 3772); //18 output WORDs; three DP writes are scratch.
  failure(ad92Fixture({ active: true }), { divisionMode: 'stable-native', maxOutputBytes: 3747 }, 'render_output_budget_required');
});

test('counter observations are chronological WORDs and a nonzero or exhausted transcript cannot commit', () => {
  const data = ad92Fixture(), p = prepare(data, { waitRead01F8: [0x100, 2, 0, 9] }); assert.ok(p.handled);
  assert.equal(p.polls, 3); assert.deepEqual(p.waitOperations.filter(v => v.space === 'external').map(v => v.value), [0x100, 2, 0]);
  data.commit(p); assert.equal(getWord(data, 0x1F8), 0);
  failure(ad92Fixture(), { waitRead01F8: [0x100] }, 'render_wait_read_required');
  failure(ad92Fixture(), { waitRead01F8: [] }, 'render_wait_read_required');
  failure(ad92Fixture(), { waitMode: null }, 'render_wait_context_required');
  failure(ad92Fixture(), { waitRead01F8: null, maxWork: 15000 }, 'render_work_budget_required');
});

test('shared output limit includes unpack, conversion and all repeated entry writes', () => {
  for (const maxOutputBytes of [1, 1855, 1856, 3711, 3712, 3735])
    failure(ad92Fixture(), { maxOutputBytes }, 'render_output_budget_required');
  assert.ok(prepare(ad92Fixture(), { maxOutputBytes: 3736 }).handled);
  failure(ad92Fixture({ last: 2, flags: [1, 1] }), { maxOutputBytes: 3759 }, 'render_output_budget_required');
  assert.ok(prepare(ad92Fixture({ last: 2, flags: [1, 1] }), { maxOutputBytes: 3760 }).handled);
});

test('exact shared work allowance accepts one plan and one fewer unit rolls back even the final wait', () => {
  const work = prepare(ad92Fixture()).work;
  assert.ok(prepare(ad92Fixture(), { maxWork: work }).handled);
  failure(ad92Fixture(), { maxWork: work - 1 }, 'render_work_budget_required');
});

test('each initially required source byte is checked independently, including the second flag/counter byte', () => {
  const data = ad92Fixture(), p = prepare(data), original = new Map(data.snapshot().bytes);
  for (const address of p.readAddresses.filter(v => original.has(v)))
    failure(copy(data, { omit: address }), {}, 'render_source_required');
});

test('scratch, output and final counter write windows are independently required with no partial effects', () => {
  for (const windows of [ad92Windows.slice(1), ad92Windows.filter(v => v[0] !== 0x7E01F8),
    [[0x7E00C3, 0x7E00D3], [0x7E01F8, 0x7E01F8], [0x7E23A0, 0x7F2ADF]],
    [[0x7E00C3, 0x7E00D3], [0x7E01F8, 0x7E01F9], [0x7E23A0, 0x7E25E4]]])
    failure(ad92Fixture({ writeWindows: windows }), {}, 'render_write_window_required');
});

test('closed22-byte stack protection and entry modes precede all writes', () => {
  failure(ad92Fixture(), { stackWindow: [0x1000, 0x1014] }, 'render_stack_required');
  assert.ok(prepare(ad92Fixture(), { stackWindow: [0x1000, 0x1015] }).handled);
  for (const stackWindow of [[0x1F4, 0x210], [0xC3, 0xD8], [0x23A0, 0x23B5]])
    failure(ad92Fixture(), { stackWindow }, 'render_stack_alias_required');
  for (const extra of [{ status: 0x20 }, { status: 0x10 }, { status: 8 }, { emulation: 1 }, { directPage: 1 }, { bank: null }])
    failure(ad92Fixture(), extra, 'render_entry_required');
});

test('stale and foreign plans cannot commit; nested composition has no independently applicable payload', () => {
  const data = ad92Fixture(), p = prepare(data); data.seed(0x7E1000, [1]);
  assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' });
  assert.throws(() => ad92Fixture().commit(p), /Invalid render plan/);
  const other = ad92Fixture(), view = prepareRenderView(other, [0x7E1F00, 0x7E1FFF]);
  const budget = { work: 0, maxWork: 1000000, maxOutputBytes: 65536, outputBytes: 0 };
  const r = renderAD92(view, ad92Entry, budget); assert.ok(r.handled);
  assert.throws(() => other.commit(r), /Invalid render plan/); assert.throws(() => other.commit(r.conversion), /Invalid render plan/);
  assert.ok(other.commit(view.finish(r)).handled);
});

test('malformed arithmetic, observation and budget contexts fail validation', () => {
  for (const extra of [{ divisionMode: 'guess' }, { waitMode: 'guess' }, { waitRead01F8: [65536] },
    { waitRead01F8: Array(1) }, { waitRead01F8: [-1] }, { maxWork: 0 }, { maxOutputBytes: 0 }])
    assert.throws(() => prepare(ad92Fixture(), extra), /Invalid render/);
});

test('six reproducible probes agree with fresh plans and preserve explicit fixture scope', async () => {
  const report = JSON.parse(await readFile('analysis/render-ad92-native.json', 'utf8'));
  assert.match(report.scope, /explicit synthetic/); assert.equal(report.progress_reference, 'docs/PORTIERUNGSSTAND.json');
  assert.equal(report.probes.length, 6);
  for (const saved of report.probes) {
    const p = prepare(ad92Fixture(saved.fixture), saved.extra);
    const { operations, byteWrites, readAddresses, ...result } = p;
    assert.deepEqual(result, Object.fromEntries(Object.entries(saved).filter(([k]) => !['fixture', 'extra'].includes(k))));
  }
});
