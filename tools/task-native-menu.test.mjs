import test from 'node:test';
import assert from 'node:assert/strict';
import { runTaskMenuCompose, taskMenuDevices } from '../src/task/native-menu-compose.mjs';
import { prepareTaskNativeMenuCompose as prepare } from '../proof/task/native-menu-compose.mjs';
import { prepareTaskPlan, commitTaskPlan } from '../proof/task/plan.mjs';
import {
  taskMenuFixture as fixture,
  menuRecords,
  menuCursorRead as cursor,
  menuTextReads as text,
  menuTextWaits as wait,
  menuCounterRead as counter,
  menuAudioReads as audio,
} from './task-native-menu-fixtures.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { createRenderData, renderAddress } from '../src/render/data.mjs';
const row = () => [cursor(), ...text()];
const input = (values) =>
  menuRecords(values.map((value) => ({ pc: 0x809e1a, address: 0x8001ca, width: 2, value })));
const traceWord = (p, address, kind = 'write') =>
  p.accesses.filter((r) => r.kind === kind && r.address === address).map((r) => r.value);
const omit = (f, ...addresses) => {
  const set = new Set(addresses.map(renderAddress)),
    data = createRenderData({ writeWindows: f.data.snapshot().writeWindows });
  for (const [a, v] of f.data.snapshot().bytes) if (!set.has(a)) data.seed(a, [v]);
  return { ...f, data };
};
function declared(f, reads, waits, controls = null) {
  return {
    ...f,
    ioObservations: menuRecords(reads),
    waitObservations: menuRecords(waits),
    ...(controls === null
      ? {}
      : { inputMode: 'record-observations', inputObservations: input(controls) }),
  };
}
const roots = [0x80a6a5, 0x80a6ad, 0x80a6b8, 0x80a6c7];
test('Own menu: all four original prefix/confirm/cancel paths, full incoming A doubling and cancel priority', () => {
  for (const entry of roots)
    for (const a of [0, 1, 32767, 32768, 32769, 65535])
      for (const held of [0x40, 0x2040]) {
        const f = fixture(entry, { a, held }),
          p = prepared(prepare, f),
          selected = entry === 0x80a6b8 ? a % 32768 : 0;
        assert.equal(p.selection, held & 0x2000 ? 65535 : selected);
        assert.equal(p.iterations, 1);
        assert.equal(p.outcome, held & 0x2000 ? 'menu_cancelled' : 'menu_confirmed');
        assert.equal(p.outputContext.a, 0);
        assert.equal(p.rawReturnWord, 0xf508);
        assert.equal(p.returnTarget, 0x80f509);
        assert.equal(p.returnTargetExecuted, false);
        assert.equal(p.outputContext.s, 0x701);
        assert.equal(
          p.calls.some((c) => c.role === 'confirm-audio'),
          !(held & 0x2000),
        );
        const prefix = p.accesses
          .filter((r) => r.kind === 'write' && [0x801da7, 0x801da5, 0x801d97].includes(r.address))
          .slice(0, 3)
          .map((r) => [r.address, r.value]);
        assert.deepEqual(
          prefix,
          entry === 0x80a6a5
            ? [
                [0x801da7, 255],
                [0x801da5, 0],
                [0x801d97, 0],
              ]
            : entry === 0x80a6ad
              ? [
                  [0x801da5, 255],
                  [0x801da7, 0],
                  [0x801d97, 0],
                ]
              : entry === 0x80a6b8
                ? [
                    [0x801d97, (a * 2) & 255],
                    [0x801da5, 255],
                    [0x801da7, 0],
                  ]
                : [
                    [0x801da7, 0],
                    [0x801da5, 0],
                    [0x801d97, 0],
                  ],
        );
        assert.equal(commitTaskPlan(f.data, p).handled, true);
      }
});
test('Own menu: down-before-up and first hotkey match, physical move PHY/PLY, PEI00/06 plus mixed hotkey PHY/PLA', () => {
  const f = declared(
    fixture(0x80a6a5, { held: 0xc00, tokens: [16, 16, 0], count: 2, numbers: [0, 0xc00, 0] }),
    [...row(), ...row(), ...row(), ...row(), ...row(), ...row(), ...audio()],
    [...wait(), ...wait(), ...wait(), counter(1), ...wait(), ...wait(), ...wait()],
  );
  const p = prepared(prepare, f);
  assert.equal(p.moves, 1);
  assert.equal(p.pages, 0);
  assert.equal(p.selection, 1);
  assert.equal(p.hotkeyReads, 2);
  assert.equal(p.accesses.find((r) => r.label === 'menu-move-PHY-low').value, 2);
  assert.equal(p.accesses.find((r) => r.label === 'menu-move-PLY-fresh-low').value, 2);
  assert.equal(p.accesses.find((r) => r.label === 'menu-PEI00-low').value, 2);
  assert.equal(p.accesses.find((r) => r.label === 'menu-PEI06-low').value, 2);
  assert.equal(p.accesses.find((r) => r.label === 'menu-PLA06-fresh-low').value, 2);
  assert.equal(p.accesses.find((r) => r.label === 'menu-PLA00-fresh-low').value, 2);
  assert.equal(p.accesses.find((r) => r.label === 'menu-hotkey-PHY-low').value, 2);
  assert.equal(p.accesses.find((r) => r.label === 'menu-hotkey-PLA-fresh-low').value, 2);
  assert.equal(p.calls.filter((c) => c.role === 'confirm-audio').length, 1);
  assert.equal(p.calls.filter((c) => c.target === 0x80c46e).length, 1);
  for (const held of [0x400, 0x800, 0x100]) {
    const first = declared(
      fixture(0x80a6a5, { held, tokens: [16, 0], count: 1, numbers: [held, held] }),
      [...row(), ...row(), ...row(), ...audio()],
      [...wait(), ...wait(), counter(1), ...wait()],
    );
    const q = prepared(prepare, first);
    assert.equal(q.moves, 0);
    assert.equal(q.hotkeyReads, 1);
    assert.equal(q.selection, 0);
  }
});
test('Own menu: scroll down then up, fresh full fields, request wait and one globally chronological record stream', () => {
  const f = fixture(0x80a6c7, { held: 0, tokens: [16, 16, 0], count: 1, numbers: [0, 0] });
  // Initial row+more, initial mark; both scroll lists contain row+one marker.
  const request = () => ({ pc: 0x81acbd, address: 0x8001f6, width: 2, value: 0 });
  const p = prepared(
    prepare,
    declared(
      f,
      [
        ...row(),
        ...row(),
        ...row(),
        ...row(),
        ...row(),
        ...row(),
        ...row(),
        ...row(),
        ...row(),
        ...row(),
        ...audio(),
      ],
      [
        ...wait(),
        ...wait(),
        ...wait(),
        counter(1),
        request(),
        ...wait(),
        ...wait(),
        ...wait(),
        counter(2),
        request(),
        ...wait(),
        ...wait(),
        ...wait(),
        counter(3),
        ...wait(),
      ],
      [0x400, 0x800, 0x40, 0x40],
    ),
  );
  assert.equal(p.pages, 2);
  assert.equal(p.moves, 2);
  assert.equal(p.selection, 0);
  assert.equal(p.iterations, 3);
  assert.equal(p.inputObservationsUsed, 4);
  assert.deepEqual(
    p.calls.filter((c) => c.role === 'scroll-request').map((c) => c.pc),
    [0x80a7f7, 0x80a7f7],
  );
  assert.deepEqual(traceWord(p, 0x801d95), [0, 2, 0]);
  assert.equal(p.accesses.filter((r) => r.label === 'menu-PEI06-low').length, 2);
});
test('Own menu: page-next is a WORD do-loop, hotkey prefixes suppress paging and changing counters never create held input', () => {
  const f = fixture(0x80a6c7, { held: 0, tokens: [16, 16, 0], count: 1, numbers: [0, 0] });
  const p = prepared(
    prepare,
    declared(
      f,
      [...row(), ...row(), ...row(), ...row(), ...row(), ...row(), ...row(), ...audio()],
      [
        ...wait(),
        ...wait(),
        ...wait(),
        counter(1),
        { pc: 0x81acbd, address: 0x8001f6, width: 2, value: 0 },
        ...wait(),
        ...wait(),
        ...wait(),
        counter(2),
        ...wait(),
      ],
      [16, 0x40, 0x40],
    ),
  );
  assert.equal(p.pages, 1);
  assert.equal(p.selection, 1);
  const suppressed = prepared(
    prepare,
    declared(
      fixture(0x80a6a5, { tokens: [16, 16, 0], count: 1, numbers: [16, 0] }),
      [...row(), ...row(), ...row(), ...row(), ...audio()],
      [...wait(), ...wait(), ...wait(), counter(1), ...wait()],
      [16, 16],
    ),
  );
  assert.equal(suppressed.pages, 0);
  assert.equal(suppressed.moves, 0);
  assert.equal(suppressed.selection, 0);
  assert.equal(suppressed.hotkeyReads, 1);
  const noInput = fixture(0x80a6c7, { held: 0 });
  noInput.ioObservations = menuRecords([cursor(), ...row()]);
  noInput.waitObservations = menuRecords([...wait(), counter(1), counter(2)]);
  unchangedFailure(prepare, noInput, {}, 'task_wait_observation_required');
});
test('Own menu: fresh external count fixture proves WORDwrap and exact20 repeat, never an inferred timer or >=20 rule', () => {
  for (const count of [65535, 19, 20]) {
    const f = fixture(0x80a6c7, { held: 0, previous: 0xc00 });
    f.data.seed(0x7e1802, [0, 0]);
    const declaredCase = declared(
      f,
      f.ioObservations,
      [...wait(), counter(1), counter(2), ...wait()],
      [0xc00, 0x40, 0x40],
    );
    // Explicit independent fixture writer at the first9E1A WORDread. It does
    // not derive a menu field value from a counter change or emulate an NMI.
    const observed = (options) =>
      prepareTaskPlan(
        options,
        roots,
        (a) => {
          let applied = false;
          const provider = {
            ...a,
            readWord(address, wrap, label, outer) {
              if (!applied && address === 0x8001ca && label === 'text-root-WORD') {
                applied = true;
                a.writeWord(0x801da1, count, 24, 'explicit-fixture-repeat-writer');
              }
              return a.readWord(address, wrap, label, outer);
            },
          };
          const events = {
            mode: options.waitMode,
            values: options.waitObservations,
            waitIndex: 0,
            calls: [],
            inputMode: options.inputMode,
            inputs: options.inputObservations,
            inputIndex: 0,
          };
          const result = runTaskMenuCompose(provider, events, options.entry);
          assert.equal(events.waitIndex, options.waitObservations.length);
          assert.equal(events.inputIndex, options.inputObservations.length);
          return result;
        },
        taskMenuDevices,
      );
    const p = prepared(observed, declaredCase);
    assert.equal(p.repeats, count === 19 ? 1 : 0);
    assert.equal(p.iterations, 2);
    assert.deepEqual(traceWord(p, 0x801da1), [
      0,
      count & 255,
      (count + 1) & 255,
      ...(count === 19 ? [19] : []),
      0,
    ]);
  }
});
test('Own menu: exact reset, late final reset, missing/unused/wrong ordered records, owner and budgets are atomic', () => {
  for (const entry of roots) {
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
    unchangedFailure(prepare, omit(f, 0x701), {}, 'render_source_required');
    unchangedFailure(
      prepare,
      f,
      { ioObservations: Object.freeze(f.ioObservations.slice(0, -1)) },
      'task_io_observation_required',
    );
    unchangedFailure(
      prepare,
      f,
      { waitObservations: Object.freeze(f.waitObservations.slice(0, -1)) },
      'task_wait_observation_required',
    );
    unchangedFailure(
      prepare,
      f,
      { waitObservations: menuRecords([...f.waitObservations, f.waitObservations.at(-1)]) },
      'task_wait_observation_unused',
    );
    unchangedFailure(
      prepare,
      f,
      { inputMode: 'record-observations', inputObservations: input([0x3030]) },
      'task_reset_source_required',
    );
    unchangedFailure(
      prepare,
      f,
      { inputMode: 'record-observations', inputObservations: input([0x40, 0x3030]) },
      'task_reset_source_required',
    );
    unchangedFailure(
      prepare,
      f,
      { inputMode: 'record-observations', inputObservations: input([0x40]) },
      'task_input_observation_required',
    );
    unchangedFailure(
      prepare,
      f,
      { inputMode: 'record-observations', inputObservations: input([0x40, 0x40, 0]) },
      'task_input_observation_unused',
    );
  }
  const f = fixture(),
    ordered = [...f.waitObservations];
  [ordered[0], ordered[2]] = [ordered[2], ordered[0]];
  unchangedFailure(
    prepare,
    f,
    { waitObservations: Object.freeze(ordered) },
    'task_wait_observation_required',
  );
  unchangedFailure(
    prepare,
    f,
    { inputMode: 'record-observations', inputObservations: Object.freeze(Array(1)) },
    'task_input_observations_required',
  );
  unchangedFailure(
    prepare,
    f,
    { waitObservations: Object.freeze(Array(1)) },
    'task_wait_observations_required',
  );
  const alias = unchangedFailure(
    prepare,
    fixture(0x80a6a5, { s: 0xd8 }),
    {},
    'task_native_helper_return_required',
  );
  assert.equal(alias.at, 0x80febc);
  assert.equal(alias.actual, 6);
});
test('Own menu: cancellation preserves actual bank, confirmation refetches selection/input from original forced80 owner', () => {
  for (const bank of [0x80, 0x7e, 0x7f]) {
    const f = fixture(0x80a6c7, { bank, held: 0x2000 }),
      p = prepared(prepare, f);
    assert.equal(p.outputContext.bank, bank);
    assert.equal(p.selection, 65535);
  }
  const f = fixture(0x80a6c7, { bank: 0x7f });
  const missing = unchangedFailure(prepare, f, {}, 'render_source_required');
  assert.equal(missing.address, 0x7e1d97);
  f.data.seed(0x801d97, [6, 0]);
  f.data.seed(0x8001ca, [0x40, 0]);
  f.data.seed(0x8001cc, [0, 0]);
  const p = prepared(prepare, f);
  assert.equal(p.selection, 3);
  assert.equal(p.outputContext.bank, 0x80);
  assert.ok(p.accesses.some((r) => r.kind === 'read' && r.address === 0x801d97));
  assert.ok(p.accesses.some((r) => r.kind === 'read' && r.address === 0x7f1d97));
});
