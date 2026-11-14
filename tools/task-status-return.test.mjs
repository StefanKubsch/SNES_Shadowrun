import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectRom, cpuToOffset } from './rom.mjs';
import { decodeTaskWindows, taskRomHash } from './task-partial-source.mjs';
import { spec, prove } from './render-task-status-return-source-proof.mjs';
import { taskStatusReturnFixture as fixture } from './task-status-return-fixtures.mjs';
import { taskOpcodeSpecs } from './task-opcode-specs.mjs';
import { taskOpcodeFixture } from './task-opcode-fixtures.mjs';
import { taskVisitOpcodesFixture } from './task-visit-opcodes-fixtures.mjs';
import { prepareTaskStatusReturn as prepare } from '../proof/task/status-return.mjs';
import { prepareTaskOpcodeSequence as sequence } from '../proof/task/opcode-sequence.mjs';
import { prepareTaskVisitOpcodes } from '../proof/task/visit-opcodes.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { createRenderData, renderAddress } from '../src/render/data.mjs';
import { readProgress, validateManualTaskEvidence } from './progress.mjs';
const word = (f, a, v) => {
  f.data.seed(a & 0xffffff, [v & 255]);
  f.data.seed((a + 1) & 0xffffff, [v >>> 8]);
};
const drop = (f, ...addresses) => {
  const data = createRenderData({ writeWindows: f.data.snapshot().writeWindows }),
    omit = new Set(addresses.map(renderAddress));
  for (const [a, v] of f.data.snapshot().bytes) if (!omit.has(a)) data.seed(a, [v]);
  return { ...f, data };
};
const context = (f, patch) => ({ ...f, context: Object.freeze({ ...f.context, ...patch }) });

test('F927 pins all44 original bytes, four finite BYTE/WORD paths and the current-stack RTS independently', async () => {
  const { bytes } = inspectRom(await readFile('Shadowrun (E).smc')),
    p = prove(decodeTaskWindows(bytes, spec.windows).map);
  const r = JSON.parse(await readFile('analysis/render-task-status-return.json'));
  assert.deepEqual(r.proofs, p);
  assert.equal(r.rom_sha256, taskRomHash);
  assert.equal(p[0].paths.length, 4);
  assert.equal(p[0].visited.length, 19);
  assert.equal(p[0].operand_s_delta, 2);
  assert.equal(p[0].external_return_assumptions, 0);
  assert.equal(p[0].full_task_binding, false);
  for (let n = 0; n < 44; n++) {
    const changed = Buffer.from(bytes);
    changed[cpuToOffset(0x80f927 + n, bytes.length)] ^= 1;
    assert.throws(() => prove(decodeTaskWindows(changed, spec.windows).map));
  }
  const decoded = decodeTaskWindows(bytes, spec.windows);
  for (const pc of [0x80f92c, 0x80f93f, 0x80f952]) {
    const map = new Map(decoded.map),
      i = map.get(pc);
    map.set(pc, { ...i, state: { ...i.state, x: 1 } });
    assert.throws(() => prove(map));
  }
  const progress = await readProgress(process.cwd());
  await validateManualTaskEvidence(
    process.cwd(),
    progress.work_groups.find((g) => g.id === 'task-f378-status-return'),
    taskRomHash,
  );
});

for (const index of [0, 1, 2, 0xff, 0x100, 0x7fff, 0x8000, 0xffff])
  test(`synthetic F927 index${index} preserves fullWORD signed/equality/CPX semantics and hidden High-A`, () => {
    for (const initial of [0, 4, 0x80, 0xff])
      for (const flags of [0, 0x45, 0xcf, 0x0c]) {
        const f = context(fixture(), { a: 0xcd67, status: flags });
        word(f, f.context.d, index);
        f.data.seed(0x8001be, [initial]);
        f.data.seed(0x8001c0, [initial]);
        const p = prepared(prepare, f),
          first = index >= 0x8000 ? initial | 4 : initial & 0xfb,
          second = index === 1 ? initial | 4 : initial & 0xfb;
        assert.equal(p.index, index);
        assert.equal(p.firstValue, first);
        assert.equal(p.secondValue, second);
        assert.equal(p.outputContext.a, 0xcd00 | second);
        assert.equal(p.outputContext.x, index);
        assert.equal(
          p.outputContext.status,
          (flags & 0x4c) |
            (index > 0 ? 1 : 0) |
            (second === 0 ? 2 : 0) |
            (second >= 128 ? 0x80 : 0),
        );
        assert.equal(p.outputContext.y, f.context.y);
        assert.equal(p.outputContext.d, f.context.d);
        assert.equal(p.outputContext.bank, 0x80);
        assert.equal(p.outputContext.s, 0x701);
        assert.equal(p.returnTarget, 0x80c20b);
        assert.equal(p.targetExecuted, false);
        assert.deepEqual(
          p.accesses.map((a) => a.address),
          [0x8001be, 0x200, 0x201, 0x8001be, 0x8001c0, 0x8001c0, 0x700, 0x701],
        );
        assert.deepEqual(p.byteWrites, [
          [0x7e01be, first],
          [0x7e01c0, second],
        ]);
        assert.equal(p.work, 8);
        assert.equal(p.outputBytes, 2);
      }
  });

test('synthetic F927 latches DP00 before its own alias store, reads both index bytes and uses actualDBR', () => {
  for (const bank of [0x80, 0x7e, 0x7f]) {
    const f = fixture({ bank, d: 0x1be, writeWindows: [[0x7e0000, 0x7fffff]] });
    word(f, 0x1be, 4);
    f.data.seed(bank * 65536 + 0x1c0, [0xff]);
    const p = prepared(prepare, f);
    assert.equal(p.index, 4);
    assert.equal(p.outputContext.x, 4);
    assert.equal(p.secondValue, 0xfb);
    assert.equal(p.outputContext.a, 0xabfb);
    assert.equal(p.accesses[0].address, bank * 65536 + 0x1be);
    assert.equal(p.accesses[4].address, bank * 65536 + 0x1c0);
    unchangedFailure(prepare, drop(f, 0x1bf), {}, 'render_source_required');
  }
});

test('F927 uses current protected return rather than savedOuterS, including rawWORD wrap and late missingHigh', () => {
  for (const raw of [0, 0xc20a, 0xffff]) {
    const f = fixture();
    word(f, 0x700, raw);
    word(f, 0x8001f2, 0x500);
    const p = prepared(prepare, drop(f, 0x8001f2, 0x8001f3));
    assert.equal(p.returnS, 0x6ff);
    assert.equal(p.outerReturnWord, raw);
    assert.equal(p.outputContext.pc, (raw + 1) & 65535);
    assert.equal(p.outputContext.s, 0x701);
    unchangedFailure(prepare, drop(f, 0x701), {}, 'render_source_required');
  }
  const f = fixture();
  unchangedFailure(
    prepare,
    f,
    { protectedStackBytes: [0x7e0501, 0x7e0502] },
    'task_outer_return_required',
  );
});

test('synthetic F927 DP WORD wraps FFFF to0000, while absolute DBR and current stack stay independent', () => {
  const f = fixture({ d: 0xffff });
  f.data.seed(0xffff, [1]);
  f.data.seed(0, [0]);
  const p = prepared(prepare, f);
  assert.equal(p.index, 1);
  assert.equal(p.secondValue, 0x44);
  assert.deepEqual(
    p.accesses.slice(1, 3).map((a) => a.address),
    [0xffff, 0],
  );
  unchangedFailure(prepare, drop(f, 0), {}, 'render_source_required');
});

test('synthetic F927 return owners cannot alias its status stores and no BYTE-only index assumption permits a missing highbyte', () => {
  const f = fixture();
  unchangedFailure(prepare, drop(f, 0x201), {}, 'render_source_required');
  for (const s of [0x1bd, 0x1bf]) {
    const g = fixture({ s, savedOuterS: s });
    unchangedFailure(prepare, g, {}, 'task_stack_alias_required');
  }
});

test('F927 shares owner, write windows and exact cumulative budgets; every late failure has no effects', () => {
  const f = fixture(),
    p = prepared(prepare, f),
    r = p.outputContext;
  prepared(prepare, { ...f, maxWork: 8, maxOutputBytes: 2 });
  unchangedFailure(prepare, f, { maxWork: 7 }, 'task_work_budget_required');
  unchangedFailure(prepare, f, { maxOutputBytes: 1 }, 'task_output_budget_required');
  for (const address of [0x8001be, 0x201, 0x8001c0, 0x701])
    unchangedFailure(prepare, drop(f, address), {}, 'render_source_required');
  for (const address of [0x7e01be, 0x7e01c0, 0x7e0200])
    unchangedFailure(
      prepare,
      f,
      { protectedStackBytes: [...f.protectedStackBytes, address] },
      'task_stack_alias_required',
    );
  const data = createRenderData({ writeWindows: [[0x7e01be, 0x7e01be]] });
  for (const [a, v] of f.data.snapshot().bytes) data.seed(a, [v]);
  unchangedFailure(prepare, { ...f, data }, {}, 'render_write_window_required');
  assert.equal(commitTaskPlan(fixture().data, p).reason, 'task_plan_owner_required');
  assert.equal(commitTaskPlan(f.data, { ...p }).reason, 'task_plan_owner_required');
  f.data.seed(0x100, [1]);
  assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
  const g = fixture(),
    q = prepared(prepare, g);
  assert.equal(commitTaskPlan(g.data, q).handled, true);
  assert.equal(q.outputContext.s, r.s);
  assert.equal(commitTaskPlan(g.data, q).reason, 'task_plan_stale');
});

test('synthetic preceding state36 store and F927 consume exact current return on one overlay; extra handler rejects all writes', () => {
  const s = taskOpcodeSpecs.find((s) => s.opcode === 0x36),
    f = taskOpcodeFixture(s, { s: 0x6fd, savedOuterS: 0x6ff, top: 0xbeef });
  f.data.seed(0x801206, [6, 0xa5]);
  f.data.seed(0x8001be, [0]);
  f.data.seed(0x8001c0, [0]);
  const p = prepared(sequence, { ...f, maxHandlers: 2 });
  assert.deepEqual(
    p.steps.map((s) => s.opcode),
    [0x36, 6],
  );
  assert.equal(p.steps[1].returnS, 0x6ff);
  assert.equal(p.steps[1].returnTarget, 0x80c20b);
  assert.equal(p.outputContext.s, 0x701);
  assert.equal(p.outputBytes, 4);
  unchangedFailure(sequence, f, { maxHandlers: 3 }, 'task_opcode_continuation_source_required');
  unchangedFailure(sequence, drop(f, 0x701), { maxHandlers: 2 }, 'render_source_required');
  unchangedFailure(
    sequence,
    f,
    { maxHandlers: 2, maxOutputBytes: 3 },
    'task_output_budget_required',
  );
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  const bytes = new Map(f.data.snapshot().bytes);
  assert.equal(bytes.get(0x7e0310), 0xef);
  assert.equal(bytes.get(0x7e0311), 0xbe);
});

test('F927 Visit join remains explicitly source-required even with existing END-compatible inner ownership', () => {
  const f = taskVisitOpcodesFixture();
  f.data.seed(0x801204, [6, 0xa5]);
  word(f, 0x80f2ba, 0xf927);
  unchangedFailure(prepareTaskVisitOpcodes, f, {}, 'task_opcode_status_return_source_required');
});

test('current hundred-block batch has exactly F927,24 direct slot and25 next original-ID source/native pairs', async () => {
  const p = await readProgress(process.cwd());
  if (!p.autonomous_batch.authorization.includes('ab 0e95af7')) return;
  const g = p.work_groups.find((g) => g.id === 'task-f378-opcode-dispatch');
  const slots = g.dispatch_blocks.filter((b) => b.handler === '80:F927').map((b) => b.id),
    ids = g.script52_blocks
      .filter((b) => b.script_id >= 135 && b.script_id <= 159)
      .map((b) => b.id);
  assert.equal(slots.length, 24);
  assert.equal(ids.length, 25);
  assert.equal(g.dispatch_blocks.length, 98);
  assert.deepEqual(
    new Set(g.dispatch_blocks.map((b) => b.opcode)),
    new Set(Array.from({ length: 98 }, (_, n) => n * 2)),
  );
  const expected = ['task-f378-status-return', ...slots, ...ids].flatMap((id) => [
    id,
    id + ':manual-native',
  ]);
  assert.equal(expected.length, 100);
  assert.equal(p.autonomous_batch.authorized_blocks, 100);
  if (p.autonomous_batch.completed_groups.length)
    assert.deepEqual(p.autonomous_batch.completed_groups, expected);
});
