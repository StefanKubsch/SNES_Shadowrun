import test from 'node:test';
import assert from 'node:assert/strict';
import { sendApuCommand } from '../src/task/native-input-apu.mjs';
import { prepareTaskNativeInputApu as prepare } from '../proof/task/native-input-apu.mjs';
import { prepareTaskPlan, commitTaskPlan } from '../proof/task/plan.mjs';
import { taskInputApuFixture as fixture } from './task-native-input-apu-fixtures.mjs';
import { createRenderData, renderAddress } from '../src/render/data.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
const records = (values) => Object.freeze(values.map((r) => Object.freeze(r)));
const omit = (f, ...addresses) => {
  const set = new Set(addresses.map(renderAddress)),
    data = createRenderData({ writeWindows: f.data.snapshot().writeWindows });
  for (const [a, v] of f.data.snapshot().bytes) if (!set.has(a)) data.seed(a, [v]);
  return { ...f, data };
};
test('Own9E1A: full WORDedges/copy/filter/CMP, every nibble and threshold, all actual banks/statuses; exact3030 publishes nothing', () => {
  const values = [
    0,
    ...Array.from({ length: 15 }, (_, i) => i + 1),
    0x302f,
    0x3030,
    0x3031,
    0x3040,
    0x8000,
    0xffff,
  ];
  for (const bank of [0, 0x3f, 0x80, 0xbf, 0x7e, 0x7f])
    for (const status of [0, 1, 0xc5, 0xcc])
      for (const current of values) {
        const f = fixture(0x809e1a, { bank, status, current, previous: 0x4567 });
        if (current === 0x3030) {
          const r = unchangedFailure(prepare, f, {}, 'task_reset_source_required');
          assert.equal(r.startupTarget, 0x80e382);
          continue;
        }
        const p = prepared(prepare, f),
          n = current % 16;
        assert.equal(p.edge, current & ~0x4567);
        assert.equal(p.outputContext.a, n);
        assert.equal(
          p.outputContext.status,
          (status & 0x7c) | Number(current >= 0x3030) | (n ? 0 : 2),
        );
        assert.equal(p.outputContext.x, f.context.x);
        assert.equal(p.outputContext.y, f.context.y);
        assert.equal(p.outputContext.bank, bank);
        assert.equal(p.rawReturnWord, 0xf508);
        assert.equal(p.returnTarget, 0x80f509);
        assert.equal(p.returnTargetExecuted, false);
        assert.deepEqual(
          p.accesses
            .filter((a) => a.kind === 'read' && a.label === 'text-root-WORD-low')
            .map((a) => a.address & 65535),
          [0x1ca, 0x1cc, 0x1ca, 0x1ca],
        );
        assert.equal(commitTaskPlan(f.data, p).handled, true);
        const word = (a) =>
          f.data.readByte(bank * 65536 + a).value |
          (f.data.readByte(bank * 65536 + a + 1).value << 8);
        assert.equal(word(0x1cc), current);
        assert.equal(word(0x1ce), n ? 0 : current & ~0x4567);
        assert.equal(word(0x1ca), n ? 0 : current);
      }
});
test('OwnF007: all BYTEtokens wrap, full WORDparameter and hidden commandHigh; actual status and three RTL bytes survive', () => {
  for (let token = 0; token < 256; token++)
    for (const a of [0, 255, 0xab34])
      for (const status of [0, 1, 0xc5, 0xc8]) {
        const f = fixture(0x81f007, { token, a, status }),
          p = prepared(prepare, f);
        assert.equal(p.outputContext.a, ((a & 255) << 8) | ((token + 1) & 255));
        assert.equal(p.outputContext.status, status);
        assert.equal(p.outputContext.x, 0xbeef);
        assert.equal(p.outputContext.y, 0x1234);
        assert.equal(p.outputContext.s, 0x702);
        assert.equal(p.rawReturnWord, 0xf508);
        assert.equal(p.returnBank, 0x80);
        assert.equal(p.returnTarget, 0x80f509);
        assert.deepEqual(
          p.ioRequests.map((r) => [r.kind, r.address & 65535, r.width, r.value]),
          [
            ['read', 0x2140, 1, token],
            ['write', 0x2142, 2, 0xbeef],
            ['write', 0x2141, 1, a & 255],
            ['write', 0x2140, 1, (token + 1) & 255],
          ],
        );
        assert.equal(p.accesses.filter((r) => r.label === 'F007-token').length, 1);
      }
});
test('OwnF007: repeated fresh ACKs, actual PHP token alias/PLP changes, physical WRAM and innerM1 caller', () => {
  const f = fixture(0x81f007);
  f.ioObservations = records(
    [0, 255, 0x12].map((value) => ({ pc: 0x81f00e, address: 0x802140, width: 1, value })),
  );
  assert.equal(prepared(prepare, f).polls, 3);
  const alias = fixture(0x81f007, { s: 0x1ce4, status: 0xc5 });
  alias.ioObservations = records([{ pc: 0x81f00e, address: 0x802140, width: 1, value: 0xc5 }]);
  const changed = prepared(prepare, alias);
  assert.equal(changed.token, 0xc5);
  assert.equal(changed.outputContext.status, 0xc6);
  assert.equal(changed.accesses.find((r) => r.label === 'F007-PLP-fresh').value, 0xc6);
  const narrow = fixture(0x81f007, { s: 0x1ce4, status: 15 });
  narrow.ioObservations = records([{ pc: 0x81f00e, address: 0x802140, width: 1, value: 15 }]);
  const n = prepared(prepare, narrow);
  assert.equal(n.outputContext.status, 16);
  assert.equal(n.outputContext.x, 0xef);
  assert.equal(n.outputContext.y, 0x34);
  for (const bank of [0x7e, 0x7f]) {
    const g = fixture(0x81f007, { bank, token: 255 });
    const p = prepared(prepare, g);
    assert.equal(p.ioRequests.length, 0);
    assert.equal(p.outputContext.a, 0x3400);
    g.data.seed(bank * 65536 + 0x2140, [0]);
    unchangedFailure(prepare, g, { maxWork: 50 }, 'task_work_budget_required');
  }
  const inner = (options) =>
    prepareTaskPlan(
      options,
      [0x81f007],
      (a) => {
        a.ctx.status |= 32;
        return sendApuCommand(a);
      },
      { writes: [0x2140, 0x2141, 0x2142, 0x2143], reads: [0x2140], observationPcs: [0x81f00e] },
    );
  assert.equal(prepared(inner, fixture(0x81f007)).outputContext.status, 0xe5);
});
test('OwnC416: original wrapping coordinate/clamp branches, BYTE PHA/PLA, independently observed products and full index', () => {
  const cases = [
    [65535, 0, 0, 0, 128, false, false, false],
    [2, 0, 0, 0, 255, false, false, true],
    [3, 0, 0, 1537, 0, false, true, false],
    [2, 0x7fff, 0, 0, 0, true, false, false],
    [2, 0, 0, 1535, 0, false, false, false],
    [2, 0, 0, 1024, 128, false, false, false],
    [0x7fff, 0, 0, 1536, 0, false, false, false],
  ];
  for (const [index, position, other, scroll, pan, signed, borrow, upper] of cases) {
    const f = fixture(0x80c416, { index, position, other, scroll }),
      p = prepared(prepare, f);
    assert.deepEqual(
      [p.pan, p.signedClamp, p.borrowClamp, p.upperClamp],
      [pan, signed, borrow, upper],
    );
    assert.equal(p.outputContext.a, 0x1122);
    assert.equal(p.outputContext.x, 0x1122);
    assert.equal(p.outputContext.y, 0x1234);
    const saved = p.accesses.find((r) => r.label === 'C416-BYTE-PHA'),
      pulled = p.accesses.find((r) => r.label === 'C416-BYTE-PLA-fresh');
    assert.equal(saved.address, 0x6ff);
    assert.equal(saved.value, 127 - (pan >>> 1));
    assert.equal(pulled.address, saved.address);
    assert.equal(pulled.value, saved.value);
    assert.equal(p.returnTarget, 0x80f509);
    assert.equal(p.outputContext.s, 0x701);
  }
  const full = fixture(0x80c416, { index: 65535 });
  for (const value of [0, 1, 255, 256, 32768, 65535]) {
    full.ioObservations = records([
      { pc: 0x80c44f, address: 0x804217, width: 1, value: value >>> 8 },
      { pc: 0x80c45a, address: 0x804217, width: 1, value: value & 255 },
    ]);
    const p = prepared(prepare, full);
    assert.equal(p.outputContext.a, value);
    assert.equal(p.outputContext.status, 0x44 | (value === 0 ? 2 : 0) | (value >= 32768 ? 128 : 0));
  }
});
test('Input/APU: every source/actual return byte, chronological record and late owner/budget failure is atomic', () => {
  for (const entry of [0x809e1a, 0x81f007, 0x80c416]) {
    const f = fixture(entry),
      p = prepared(prepare, f);
    prepared(prepare, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
    unchangedFailure(prepare, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
    unchangedFailure(
      prepare,
      f,
      { maxOutputBytes: p.outputBytes - 1 },
      'task_output_budget_required',
    );
    for (const addr of entry === 0x81f007
      ? [0x700, 0x701, 0x702, 0x801ce4]
      : entry === 0x809e1a
        ? [0x700, 0x701, 0x801cb, 0x801cd]
        : [0x700, 0x701, 1])
      unchangedFailure(prepare, omit(f, addr), {}, 'render_source_required');
    unchangedFailure(
      prepare,
      fixture(entry, { writeWindows: [] }),
      {},
      'render_write_window_required',
    );
    const wrong = fixture(entry);
    assert.equal(commitTaskPlan(wrong.data, p).reason, 'task_plan_owner_required');
    f.data.seed(0x100, [1]);
    assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
    if (entry !== 0x809e1a) {
      unchangedFailure(
        prepare,
        f,
        { ioObservations: Object.freeze(f.ioObservations.slice(0, -1)) },
        'task_io_observation_required',
      );
      unchangedFailure(
        prepare,
        f,
        { ioObservations: records([...f.ioObservations, f.ioObservations.at(-1)]) },
        'task_io_observation_unused',
      );
      unchangedFailure(
        prepare,
        f,
        {
          ioObservations: records([
            { ...f.ioObservations[0], width: 2 },
            ...f.ioObservations.slice(1),
          ]),
        },
        'task_io_observation_required',
      );
    }
  }
});
