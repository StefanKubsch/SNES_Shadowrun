import test from 'node:test';
import assert from 'node:assert/strict';
import { taskOpcodeSpecs } from './task-opcode-specs.mjs';
import { taskOpcodeFixture } from './task-opcode-fixtures.mjs';
import { arithmeticObservations } from './task-arithmetic-native-fixtures.mjs';
import { prepareTaskOpcodeSequence as sequence } from '../proof/task/opcode-sequence.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { createRenderData, renderAddress } from '../src/render/data.mjs';
const fixture = (opcode, patch = {}) =>
  taskOpcodeFixture(
    taskOpcodeSpecs.find((s) => s.opcode === opcode),
    patch,
  );
const word = (f, a, v) => {
  f.data.seed(a, [v & 255]);
  f.data.seed((a + 1) & 0xffffff, [v >>> 8]);
};
const drop = (f, ...addresses) => {
  const data = createRenderData({ writeWindows: f.data.snapshot().writeWindows }),
    omit = new Set(addresses.map(renderAddress));
  for (const [a, v] of f.data.snapshot().bytes) if (!omit.has(a)) data.seed(a, [v]);
  return { ...f, data };
};
const context = (f, patch) => ({ ...f, context: Object.freeze({ ...f.context, ...patch }) });

for (const opcode of [0x2c, 0x34])
  test(`synthetic local ${opcode.toString(16)} latches full index/PLA, wraps D+13, preserves exact store width`, () => {
    const f = fixture(opcode, { d: 0xfff0, opcodeWord: 0x9900, top: 0xabcd });
    f.data.seed(3, [0x55, 0x66]);
    const p = prepared(sequence, f),
      step = p.steps[0];
    assert.equal(step.indexWord, 0x9900);
    assert.equal(step.index, 0);
    assert.equal(step.localAddress, 3);
    assert.equal(step.localWriteBytes, opcode === 0x2c ? 1 : 2);
    assert.equal(p.outputContext.s, 0x3f2);
    assert.deepEqual(
      p.accesses.filter((a) => a.kind === 'write').map((a) => [a.address, a.value]),
      opcode === 0x2c
        ? [[3, 0xcd]]
        : [
            [3, 0xcd],
            [4, 0xab],
          ],
    );
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    assert.equal(new Map(f.data.snapshot().bytes).get(0x7e0004), opcode === 0x2c ? 0x66 : 0xab);
    unchangedFailure(sequence, drop(f, 0x801205), {}, 'render_source_required');
    unchangedFailure(sequence, drop(f, 0x3f2), {}, 'render_source_required');
  });

test('synthetic local WORD store replaces later operand read on the common overlay', () => {
  const f = fixture(0x34, { d: 0x300, top: 0x9a80, opcodeWord: 0xa511 });
  f.data.seed(0x801205, [0x16, 0x11, 0xa5, 0xbe]);
  const p = prepared(sequence, { ...f, maxHandlers: 2 });
  assert.deepEqual(
    p.steps.map((s) => s.opcode),
    [0x34, 0x16],
  );
  assert.equal(p.steps[1].localWord, 0x9a80);
  assert.equal(p.steps[1].value, 0x9a80);
  assert.equal(p.outputContext.s, 0x3f0);
  unchangedFailure(sequence, drop(f, 0x801208), { maxHandlers: 2 }, 'render_source_required');
});

test('synthetic call return store aliases DP05 before its mandatory fresh reload; target stays latched', () => {
  const f = fixture(0x4c);
  word(f, 0x205, 0x205);
  const p = prepared(sequence, f),
    s = p.steps[0];
  assert.equal(s.targetWord, 0x20);
  assert.equal(s.destination, 0x205);
  assert.equal(s.freshPointer, 6);
  assert.equal(s.newPointer, 4);
  assert.equal(p.outputContext.y, 0x21);
  assert.equal(p.outputContext.s, f.context.s);
  assert.deepEqual(
    p.accesses.filter((a) => a.kind === 'write').map((a) => [a.address, a.value]),
    [
      [0x800205, 6],
      [0x800206, 0],
      [0x205, 4],
      [0x206, 0],
    ],
  );
  assert.equal(p.outputContext.status & 0x4d, f.context.status & 0x4d);
});

test('synthetic return pointer store becomes its own fresh return WORD and full Y, without host target guard', () => {
  const f = fixture(0x50);
  word(f, 0x205, 0x203);
  word(f, 0x801405, 0xa5bc);
  const p = prepared(sequence, f),
    s = p.steps[0];
  assert.equal(s.originalPointer, 0x203);
  assert.equal(s.newPointer, 0x205);
  assert.equal(s.freshPointer, 0x205);
  assert.equal(s.returnWord, 0x205);
  assert.equal(p.outputContext.y, 0x206);
  assert.equal(p.outputContext.x, 0xbc);
  assert.equal(p.outputContext.s, f.context.s);
  unchangedFailure(sequence, drop(f, 0x801406), {}, 'render_source_required');
});

const nestedCalls = () => {
  const f = fixture(0x4c);
  f.data.seed(0x801206, [0xbc, 0xa5]);
  f.data.seed(0x801220, [0x4c, 0x30, 0, 0x50, 0xa5]);
  f.data.seed(0x801230, [0x50, 0xa5]);
  return { ...f, maxHandlers: 4 };
};
test('synthetic two nested local calls return through real DP05 memory in order, with one commit', () => {
  const f = nestedCalls(),
    p = prepared(sequence, f);
  assert.deepEqual(
    p.steps.map((s) => s.opcode),
    [0x4c, 0x4c, 0x50, 0x50],
  );
  assert.deepEqual(
    p.steps.filter((s) => s.returnWord !== undefined).map((s) => s.returnWord),
    [0x23, 6],
  );
  assert.equal(p.outputContext.y, 7);
  assert.equal(p.outputContext.x, 0xbc);
  assert.equal(p.outputContext.s, 0x3f0);
  assert.equal(p.outputContext.status & 0x4d, f.context.status & 0x4d);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  const bytes = new Map(f.data.snapshot().bytes);
  assert.equal(bytes.get(0x7e0205), 0);
  assert.equal(bytes.get(0x7e0206), 5);
  for (const missing of [0x801231, 0x801224, 0x801207, 0x80f305])
    unchangedFailure(sequence, drop(nestedCalls(), missing), {}, 'render_source_required');
  unchangedFailure(sequence, nestedCalls(), { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(
    sequence,
    nestedCalls(),
    { maxOutputBytes: p.outputBytes - 1 },
    'task_output_budget_required',
  );
  unchangedFailure(
    sequence,
    nestedCalls(),
    { protectedStackBytes: [...f.protectedStackBytes, 0x7e04fe] },
    'task_stack_alias_required',
  );
});

for (const opcode of [0x60, 0x62, 0x64, 0x66, 0x68, 0x6a, 0x6c, 0x6e])
  test(`synthetic arithmetic ${opcode.toString(16)} preserves observation PC/address/width order through dispatch`, () => {
    const f = fixture(opcode, { top: 0xffff, left: 0x8000 }),
      p = prepared(sequence, f);
    const observed = p.ioRequests.filter((r) => r.kind === 'read');
    assert.deepEqual(
      observed.map(({ kind, ...r }) => r),
      f.ioObservations,
    );
    assert.equal(p.observationsUsed, 4);
    assert.equal(p.outputContext.s, 0x3f2);
    assert.equal(p.outputContext.y, 5);
    for (const n of [0, 1, 2, 3]) {
      const bad = Object.freeze(
        f.ioObservations.map((o, i) => (i === n ? Object.freeze({ ...o, pc: o.pc + 1 }) : o)),
      );
      unchangedFailure(sequence, f, { ioObservations: bad }, 'task_io_observation_required');
    }
    unchangedFailure(sequence, f, { ioMode: null }, 'task_io_mode_required');
    unchangedFailure(
      sequence,
      f,
      { ioObservations: Object.freeze(f.ioObservations.slice(0, -1)) },
      'task_io_observation_required',
    );
    unchangedFailure(
      sequence,
      f,
      { ioObservations: Object.freeze([...f.ioObservations, f.ioObservations[0]]) },
      'task_io_observation_unused',
    );
    unchangedFailure(sequence, drop(f, 0x801205), {}, 'render_source_required');
  });

const arithmeticChain = () => {
  const f = fixture(0x60);
  f.data.seed(0x801204, [0x68, 0xbe, 0xa5]);
  word(f, 0x3f5, 0xa123);
  return {
    ...f,
    maxHandlers: 2,
    ioObservations: Object.freeze([...f.ioObservations, ...arithmeticObservations(0x80f609)]),
  };
};
test('synthetic multiply then division consumes a single chronological stream and fresh previous result', () => {
  const f = arithmeticChain(),
    p = prepared(sequence, f);
  assert.deepEqual(
    p.steps.map((s) => s.opcode),
    [0x60, 0x68],
  );
  assert.equal(p.observationsUsed, 8);
  assert.equal(p.outputContext.s, 0x3f4);
  assert.equal(p.outputContext.x, 0xbe);
  assert.equal(p.steps[1].scaledDivisor, 0xe0);
  const afterFirst = p.accesses.findIndex((a) => a.label === 'fresh-next-opcode-high');
  assert.deepEqual(
    p.accesses
      .slice(afterFirst + 1)
      .filter((a) => a.label === 'fresh-right-PLA-low' || a.label === 'fresh-right-PLA-high')
      .map((a) => a.value),
    [0x34, 0xe0],
  );
  unchangedFailure(
    sequence,
    arithmeticChain(),
    { ioObservations: Object.freeze(f.ioObservations.slice(0, 7)) },
    'task_io_observation_required',
  );
  unchangedFailure(
    sequence,
    arithmeticChain(),
    { maxWork: p.work - 1 },
    'task_work_budget_required',
  );
  unchangedFailure(
    sequence,
    arithmeticChain(),
    { maxOutputBytes: p.outputBytes - 1 },
    'task_output_budget_required',
  );
  assert.equal(commitTaskPlan(f.data, p).handled, true);
});

for (const opcode of [0x70, 0x72, 0x74, 0x76])
  test(`synthetic remainder ${opcode.toString(16)} retains saved-Y exit and refuses infinite shift attempts by access budget`, () => {
    const f = fixture(opcode, { top: 1, left: 10 });
    word(f, 0x801200, 0xa5bc);
    const p = prepared(sequence, f);
    assert.equal(p.steps[0].zeroExit, true);
    assert.equal(p.outputContext.y, 1);
    assert.equal(p.outputContext.s, 0x3f2);
    const g = fixture(opcode, { top: 0, left: 10 });
    unchangedFailure(sequence, g, { maxWork: 200 }, 'task_work_budget_required');
  });

for (const opcode of [0x52, 0x58, 0x56, 0x54, 0x90, 0x98, 0xa0, 0xa8])
  test(`synthetic terminal ${opcode.toString(16)} exposes only its proved frontier and atomically rejects extra continuation`, () => {
    const spec = taskOpcodeSpecs.find((s) => s.opcode === opcode),
      f = fixture(opcode),
      p = prepared(sequence, f);
    assert.equal(p.frontier, spec.frontier);
    assert.equal(p.handlersExecuted, 1);
    assert.equal(p.nextTargetExecuted, false);
    unchangedFailure(sequence, f, { maxHandlers: 2 }, 'task_opcode_continuation_source_required');
    if (spec.family === 'trap-prefix') {
      assert.deepEqual(p.outputContext, { ...f.context, pc: 0xf927 });
      assert.equal(p.work, 2);
      assert.equal(p.outputBytes, 0);
      assert.deepEqual(
        p.accesses.map((a) => a.address),
        [0x80f2b4 + opcode, 0x80f2b5 + opcode],
      );
    }
    if (opcode === 0x56) {
      assert.equal(p.outputContext.pc, 0xc20b);
      assert.equal(p.outputContext.d, 0);
      assert.equal(p.steps[0].targetExecuted, false);
    }
    if (opcode === 0x52 || opcode === 0x58) {
      assert.equal(p.steps[0].stackMigrationExecuted, false);
      assert.equal(p.outputContext.s, f.context.s);
    }
  });

test('synthetic earlier pushes followed by terminal END preserve real outer owner and discard attempted following step', () => {
  const f = fixture(0xc0);
  f.data.seed(0x801204, [0x56, 0xa5]);
  const p = prepared(sequence, { ...f, maxHandlers: 2 });
  assert.deepEqual(
    p.steps.map((s) => s.opcode),
    [0xc0, 0x56],
  );
  assert.equal(p.steps[1].resultWord, 0);
  assert.equal(p.frontier, 'actual-outer-return-target');
  unchangedFailure(sequence, f, { maxHandlers: 3 }, 'task_opcode_continuation_source_required');
  unchangedFailure(sequence, drop(f, 0x1f1), { maxHandlers: 2 }, 'render_source_required');
});

for (const opcode of [0x52, 0x58])
  test(`synthetic argument opcode ${opcode.toString(16)} consumes actual metadata and all pops on one overlay`, () => {
    const f = fixture(opcode),
      metadata = opcode === 0x52 ? 0x82e9ce : 0x82da4e;
    f.data.seed(metadata, [opcode === 0x52 ? 5 : 2, 0xa5]);
    const p = prepared(sequence, f);
    assert.equal(p.steps[0].wordPops, 2);
    assert.equal(p.outputContext.s, 0x3f4);
    assert.equal(p.outputContext.pc, opcode === 0x52 ? 0xf488 : 0xf4f6);
    assert.deepEqual(
      p.accesses
        .filter(
          (a) =>
            a.kind === 'write' &&
            (a.label.endsWith('workspace-low') || a.label.endsWith('workspace-high')),
        )
        .map((a) => a.value),
      [0x78, 0x56, 0x34, 0x12],
    );
    unchangedFailure(sequence, drop(f, metadata + 1), {}, 'render_source_required');
    unchangedFailure(sequence, drop(f, 0x3f4), {}, 'render_source_required');
    unchangedFailure(
      sequence,
      f,
      { maxOutputBytes: p.outputBytes - 1 },
      'task_output_budget_required',
    );
  });

test('synthetic separately pinned B8 inequality alias carries its own table bytes and actual comparison flags', () => {
  const f = fixture(0xb8, { top: 0x8000, left: 0x8000, status: 0x4d }),
    p = prepared(sequence, f);
  assert.equal(p.steps[0].target, 0x80f87f);
  assert.equal(p.steps[0].tableAddress, 0x80f36c);
  assert.equal(p.steps[0].result, 0);
  assert.equal(p.outputContext.status & 0x4d, 0x4d);
  unchangedFailure(sequence, drop(f, 0x80f36d), {}, 'render_source_required');
});

for (const opcode of [0x54, 0x90, 0x98, 0xa0, 0xa8])
  test(`synthetic earlier writes before F927 slot ${opcode.toString(16)} remain private on extra continuation`, () => {
    const f = fixture(0xc0);
    f.data.seed(0x801204, [opcode, 0xa5]);
    const p = prepared(sequence, { ...f, maxHandlers: 2 });
    assert.deepEqual(
      p.steps.map((s) => s.opcode),
      [0xc0, opcode],
    );
    assert.equal(p.frontier, '80:F927');
    assert.equal(p.outputContext.s, 0x3ee);
    assert.equal(p.outputBytes, 2);
    unchangedFailure(sequence, f, { maxHandlers: 3 }, 'task_opcode_continuation_source_required');
    unchangedFailure(
      sequence,
      drop(f, 0x80f2b5 + opcode),
      { maxHandlers: 2 },
      'render_source_required',
    );
  });

for (const opcode of [0x60, 0x68])
  test(`synthetic arithmetic ${opcode.toString(16)} in actual WRAM uses fresh provider bytes, with no MMIO observation inference`, () => {
    const f = fixture(opcode, { bank: 0x7e, writeWindows: [[0x7e0000, 0x7fffff]] });
    for (const o of f.ioObservations) {
      if (o.width === 1) f.data.seed(o.address, [o.value]);
      else word(f, o.address, o.value);
    }
    const p = prepared(sequence, { ...f, ioMode: null, ioObservations: null });
    assert.equal(p.ioRequests, undefined);
    assert.equal(
      p.accesses.some((a) => a.kind === 'io-read' || a.kind === 'io-write'),
      false,
    );
    assert.ok(
      p.accesses.some(
        (a) =>
          (a.kind === 'write' && a.address === 0x7e4204) ||
          (a.kind === 'write' && a.address === 0x7e4202),
      ),
    );
    unchangedFailure(
      sequence,
      drop(f, 0x7e4216),
      { ioMode: null, ioObservations: null },
      'render_source_required',
    );
  });
