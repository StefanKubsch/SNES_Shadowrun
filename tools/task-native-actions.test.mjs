import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTaskNativeActions as prepare } from '../proof/task/native-actions.mjs';
import { taskActionsFixture as fixture, actionsOptions } from './task-native-actions-fixtures.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import {
  menuRecords,
  menuCursorRead as cursor,
  menuTextReads as text,
  menuTextWaits as wait,
  menuCounterRead as counter,
  menuAudioReads as audio,
} from './task-native-menu-fixtures.mjs';
import { seedWord } from './render-ad92-fixtures.mjs';
import { createRenderData, renderAddress } from '../src/render/data.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
const word = (p, address) => {
  const last = (a) => p.byteWrites.findLast((r) => r[0] === renderAddress(a))?.[1];
  return last(address) | (last(address + 1) << 8);
};
const omit = (f, address) => {
  const data = createRenderData({ writeWindows: f.data.snapshot().writeWindows });
  for (const [a, v] of f.data.snapshot().bytes) if (a !== renderAddress(address)) data.seed(a, [v]);
  return { ...f, data };
};
test('Own actions: every option bit/combined0600/order/table/CPY3 gate and complete allocation/menu/release on both roots', () => {
  for (const entry of [0x8099eb, 0x809ba0])
    for (const mask of [
      0,
      ...Array.from({ length: 16 }, (_, n) => 2 ** n),
      0x600,
      0x630,
      0x67f2,
      0xffff,
    ]) {
      const f = fixture(entry, { mask }),
        p = prepared(prepare, f),
        rows = actionsOptions(mask);
      assert.equal(p.optionCount, rows.length);
      assert.equal(p.outputContext.a, 0);
      assert.equal(p.outputContext.s, 0x701);
      assert.equal(p.rawReturnWord, 0xf508);
      assert.equal(p.returnTarget, 0x80f509);
      assert.equal(p.returnTargetExecuted, false);
      rows.forEach(([token, flag, key], n) => {
        assert.equal(word(p, 0x801f6a + n * 2), token);
        // Slot7 is the actual1FA6 override alias; original final STZ clears it.
        assert.equal(word(p, 0x801f98 + n * 2), n === 7 ? 0 : flag);
        assert.equal(word(p, 0x801f82 + n * 2), key);
      });
      if (rows.length > 7) {
        const writes = p.accesses.filter((r) => r.kind === 'write' && r.address === 0x801fa7);
        assert.equal(writes.at(-2).value, rows[7][1] >>> 8);
        assert.equal(writes.at(-1).value, 0);
      }
      if (rows.length === 1) {
        assert.equal(p.outcome, 'no_optional_actions');
        assert.equal(
          p.calls.some((c) => c.role === 'actions-window-allocation'),
          false,
        );
        assert.equal(p.ioRequests.length, 0);
        assert.equal(p.waitObservationsUsed, 0);
      } else {
        assert.equal(p.outcome, 'action_selected');
        assert.equal(p.menu, 'menu_cancelled');
        assert.equal(p.release, 'entry_removed');
        assert.equal(word(p, 0x801f6a + rows.length * 2), 0);
        assert.equal(word(p, 0x801fa6), 0);
        assert.equal(word(p, 0x800204), 65534);
        assert.deepEqual(
          p.calls.filter((c) => c.role?.startsWith('actions-')).map((c) => c.pc),
          [0x809b5b, 0x809b7d, 0x809b94],
        );
      }
      if (entry === 0x809ba0) assert.equal(word(p, 0), 0);
    }
});
test('Own actions: real positive flag survives FA3E and fresh PLA; direct override vs Native13 clear/DP00, hotkey precedence', () => {
  for (const [mask, held] of [
    [0x10, 16],
    [0x80, 32],
    [0x200, 16],
    [0x400, 16],
    [0x90, 16],
  ])
    for (const entry of [0x8099eb, 0x809ba0]) {
      const f = fixture(entry, { mask, held }),
        p = prepared(prepare, f),
        flag = held === 32 ? 0x80 : mask === 0x90 ? 0x10 : mask;
      assert.equal(p.selectedFlag, flag);
      assert.equal(p.outputContext.a, flag);
      assert.equal(p.menu, 'menu_confirmed');
      assert.equal(
        p.accesses.find((r) => r.label === 'actions-selected-flag-PHA-low').value,
        flag & 255,
      );
      assert.equal(
        p.accesses.find((r) => r.label === 'actions-selected-flag-PLA-fresh-low').value,
        flag & 255,
      );
      assert.equal(
        p.accesses.find((r) => r.label === 'actions-selected-flag-PLA-fresh-high').value,
        flag >>> 8,
      );
      if (entry === 0x809ba0) {
        assert.equal(p.nativeResult, flag);
        assert.equal(word(p, 0), flag);
      }
      assert.equal(commitTaskPlan(f.data, p).handled, true);
    }
  const direct = prepared(prepare, fixture(0x8099eb, { mask: 2, a: 4, override: 0x10, held: 16 }));
  assert.equal(direct.selectedFlag, 16);
  const native = prepared(prepare, fixture(0x809ba0, { mask: 2, a: 0xffff, override: 16 }));
  assert.equal(native.optionCount, 2);
  assert.equal(native.outputContext.a, 0);
  const early = prepared(prepare, fixture(0x8099eb, { mask: 0, a: 0, override: 4 }));
  assert.equal(early.optionCount, 1);
  assert.equal(word(early, 0x65), 4);
  assert.equal(
    early.accesses.some((r) => r.kind === 'write' && r.address === 0x801fa6),
    false,
  );
});
test('Own actions: navigation selects combined0600, all source-ordered counter/text/APU/product/wait observations', () => {
  const f = fixture(0x809ba0, { mask: 0x600, held: 0 }),
    row = () => [cursor(), ...text()];
  const io = [
    { pc: 0x80fa01, address: 0x802134, width: 2, value: 18 },
    ...row(),
    ...row(),
    cursor(),
    ...row(),
    ...row(),
    ...row(),
    ...row(),
    ...audio(),
  ];
  const waits = [
    { pc: 0x81acbd, address: 0x8001f6, width: 2, value: 0 },
    { pc: 0x81acaf, address: 0x8001f8, width: 2, value: 0 },
    ...wait(),
    ...wait(),
    ...wait(),
    counter(1),
    ...wait(),
    ...wait(),
    counter(2),
    ...wait(),
    { pc: 0x81acaf, address: 0x8001f8, width: 2, value: 0 },
  ];
  const controls = menuRecords(
    [0x400, 0x40, 0x40].map((value) => ({ pc: 0x809e1a, address: 0x8001ca, width: 2, value })),
  );
  const options = {
    ...f,
    ioObservations: menuRecords(io),
    waitObservations: menuRecords(waits),
    inputMode: 'record-observations',
    inputObservations: controls,
  };
  const p = prepared(prepare, options);
  assert.equal(p.selectedFlag, 0x600);
  assert.equal(p.nativeResult, 0x600);
  assert.equal(p.inputObservationsUsed, 3);
  assert.equal(p.waitObservationsUsed, waits.length);
  assert.equal(p.observationsUsed, io.length);
  unchangedFailure(
    prepare,
    options,
    { inputObservations: menuRecords(controls.slice(0, -1)) },
    'task_input_observation_required',
  );
  unchangedFailure(
    prepare,
    options,
    {
      inputObservations: menuRecords([
        ...controls.slice(0, -1),
        { ...controls.at(-1), value: 0x3030 },
      ]),
    },
    'task_reset_source_required',
  );
});
test('Own actions: real stack alias, physical bank/owner, no inferred capacity recovery and every late failure stays atomic', () => {
  const alias = fixture(0x809ba0, { mask: 0, s: 0x66 }),
    q = unchangedFailure(prepare, alias, {}, 'task_native_helper_return_required');
  assert.equal(q.pc, 0x809ba5);
  assert.equal(q.raw, 0);
  assert.equal(q.target, 0x800001);
  const wrap = fixture(0x8099eb, { mask: 0, s: 65534 });
  wrap.data.seed(65535, [8]);
  wrap.data.seed(0, [0xf5]);
  // Bank00:FFFF is physical original ROM, not a bank7E stack byte. This
  // observed stack cannot satisfy the explicit WRAM return owner contract.
  unchangedFailure(prepare, wrap, {}, 'task_outer_return_required');
  const other = fixture(0x809ba0, { bank: 0x7f });
  seedWord(other.data, 0x7f2134, 18);
  other.ioObservations = menuRecords(other.ioObservations.slice(1));
  const missing = unchangedFailure(prepare, other, {}, 'render_source_required');
  assert.equal(missing.address, 0x7e1f6a);
  const capacity = fixture();
  seedWord(capacity.data, 0x800204, 30);
  capacity.ioObservations = menuRecords(capacity.ioObservations.slice(1));
  capacity.waitObservations = menuRecords(capacity.waitObservations.slice(2));
  unchangedFailure(prepare, capacity, {}, 'render_source_required');
  const f = fixture(),
    p = prepared(prepare, f);
  prepared(prepare, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
  unchangedFailure(prepare, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(
    prepare,
    f,
    { maxOutputBytes: p.outputBytes - 1 },
    'task_output_budget_required',
  );
  unchangedFailure(
    prepare,
    fixture(0x809ba0, { writeWindows: [] }),
    {},
    'render_write_window_required',
  );
  unchangedFailure(prepare, omit(f, 0x701), {}, 'render_source_required');
  unchangedFailure(
    prepare,
    f,
    { ioObservations: menuRecords(f.ioObservations.slice(0, -1)) },
    'task_io_observation_required',
  );
  unchangedFailure(
    prepare,
    f,
    { waitObservations: menuRecords(f.waitObservations.slice(0, -1)) },
    'task_wait_observation_required',
  );
  unchangedFailure(
    prepare,
    f,
    {
      waitObservations: menuRecords([
        ...f.waitObservations,
        { pc: 0x81acaf, address: 0x8001f8, width: 2, value: 0 },
      ]),
    },
    'task_wait_observation_unused',
  );
  unchangedFailure(
    prepare,
    f,
    { waitObservations: Object.freeze(Array(1)) },
    'task_wait_observations_required',
  );
  unchangedFailure(
    prepare,
    f,
    {
      waitObservations: menuRecords([
        ...f.waitObservations.slice(0, -1),
        { ...f.waitObservations.at(-1), pc: 0x81acbd },
      ]),
    },
    'task_wait_observation_required',
  );
  const before = f.data.snapshot();
  assert.equal(commitTaskPlan(fixture().data, p).reason, 'task_plan_owner_required');
  assert.equal(commitTaskPlan(f.data, { ...p }).reason, 'task_plan_owner_required');
  assert.deepEqual(f.data.snapshot(), before);
  f.data.seed(0x100, [1]);
  const stale = f.data.snapshot();
  assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
  assert.deepEqual(f.data.snapshot(), stale);
});

test('Own actions: selecting original flag7/1FA6 retains0600 in actual stack bytes while final STZ clears the table alias', () => {
  const f = fixture(0x809ba0, { mask: 65535, held: 0 }),
    row = () => [cursor(), ...text()];
  const io = [
    { pc: 0x80fa01, address: 0x802134, width: 2, value: 90 },
    ...Array.from({ length: 25 }, row).flat(),
    ...audio(),
  ];
  const waits = [
    { pc: 0x81acbd, address: 0x8001f6, width: 2, value: 0 },
    { pc: 0x81acaf, address: 0x8001f8, width: 2, value: 0 },
    ...Array.from({ length: 10 }, wait).flat(),
  ];
  for (let n = 1; n <= 14; n++) {
    waits.push(counter(n));
    if (n % 2 && n <= 13) waits.push(...wait(), ...wait());
    else if (n === 14) waits.push(...wait());
  }
  waits.push({ pc: 0x81acaf, address: 0x8001f8, width: 2, value: 0 });
  const values = [...Array.from({ length: 13 }, (_, n) => (n % 2 ? 0 : 0x400)), 0x40, 0x40];
  const p = prepared(prepare, {
    ...f,
    ioObservations: menuRecords(io),
    waitObservations: menuRecords(waits),
    inputMode: 'record-observations',
    inputObservations: menuRecords(
      values.map((value) => ({ pc: 0x809e1a, address: 0x8001ca, width: 2, value })),
    ),
  });
  assert.equal(p.selectedFlag, 0x600);
  assert.equal(p.nativeResult, 0x600);
  assert.equal(word(p, 0x801fa6), 0);
  assert.equal(word(p, 0), 0x600);
  assert.equal(p.accesses.find((r) => r.label === 'actions-selected-flag-PHA-high').value, 6);
  assert.equal(p.accesses.find((r) => r.label === 'actions-selected-flag-PLA-fresh-high').value, 6);
});
