import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTaskDivideSS as divide } from '../proof/task/divide-ss.mjs';
import { prepareTaskRemainderUnsigned as unsigned } from '../proof/task/remainder-unsigned.mjs';
import { prepareTaskRemainderSigned as signed } from '../proof/task/remainder-signed.mjs';
import { prepareTaskScriptArguments as args } from '../proof/task/script-arguments.mjs';
import { taskPrefixFixture as fixture } from './task-prefix-native-fixtures.mjs';
import {
  taskArithmeticFixture,
  arithmeticObservations,
} from './task-arithmetic-native-fixtures.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';

test('signed/signed division counts both actual fresh signs and corrects only odd count', () => {
  for (const left of [1, 32768, 65535])
    for (const top of [1, 32768, 65535]) {
      const f = taskArithmeticFixture(0x80f5f0, { left, top }),
        p = prepared(divide, f),
        count = Number(left >= 32768) + Number(top >= 32768);
      assert.equal(p.signCount, count);
      assert.equal(p.negated, count === 1);
      assert.equal(p.outputContext.s, 0x3f2);
    }
  const f = taskArithmeticFixture(0x80f5f0, { s: 0x1e9, left: 65535, top: 1 }),
    p = prepared(divide, f);
  assert.equal(p.signCount, 1);
  assert.equal(p.scaledDivisor, 1);
  unchangedFailure(
    divide,
    f,
    { ioObservations: Object.freeze(f.ioObservations.slice(0, -1)) },
    'task_io_observation_required',
  );
});
test('remainder bypass preserves incoming Y/left and skips every scratch/PHY/sign correction', () => {
  for (const entry of [0x80f6ae, 0x80f67a, 0x80f689, 0x80f696]) {
    const p = prepared(entry === 0x80f6ae ? unsigned : signed, fixture(entry));
    assert.equal(p.bypass, true);
    assert.equal(p.outputContext.y, 5);
    assert.equal(p.outputContext.s, 0x3f2);
    assert.equal(p.outputContext.status & 1, 1);
    assert.ok(!p.accesses.some((r) => r.label === 'remainder-scratch'));
  }
});
test('remainder compares saved Y, equality clears it and fetches at changed Y0', () => {
  const f = fixture(0x80f6ae, { top: 1, left: 10 });
  f.data.seed(0x801200, [0x14, 0xa5]);
  const p = prepared(unsigned, f);
  assert.equal(p.zeroExit, true);
  assert.equal(p.outputContext.y, 1);
  assert.equal(p.outputContext.s, 0x3f2);
  assert.ok(!p.byteWrites.some(([a]) => a === 0x7e03f3 || a === 0x7e03f4));
});
test('remainder subtraction changes saved Y and preserves original dividend rather than returning modulo', () => {
  const f = fixture(0x80f6ae, { top: 3, left: 10 });
  f.data.seed(0x801201, [0x14, 0xa5]);
  const p = prepared(unsigned, f);
  assert.equal(p.zeroExit, false);
  assert.equal(p.outputContext.y, 2);
  assert.equal(p.outputContext.status & 1, 1);
  assert.ok(!p.byteWrites.some(([a]) => a === 0x7e03f3 || a === 0x7e03f4));
});
test('72 discards left normalization while76 stores it unconditionally before rightPLA', () => {
  const a = prepared(signed, fixture(0x80f67a, { left: 65535, top: 0xffff }));
  assert.equal(a.signCount, 1);
  assert.ok(!a.accesses.some((r) => r.label.startsWith('left-normalization')));
  const b = prepared(signed, fixture(0x80f696, { left: 65535, top: 3 }));
  assert.equal(b.signCount, 1);
  assert.equal(b.bypass, true);
  assert.deepEqual(b.byteWrites, [
    [0x7e03f3, 1],
    [0x7e03f4, 0],
  ]);
  const c = prepared(signed, fixture(0x80f696));
  assert.equal(c.accesses.filter((r) => r.label.startsWith('left-normalization')).length, 2);
});
test('nonterminating remainder scale and late changed-Y sources fail atomically within access budget', () => {
  unchangedFailure(
    unsigned,
    fixture(0x80f6ae, { top: 0, left: 1 }),
    { maxWork: 100 },
    'task_work_budget_required',
  );
  unchangedFailure(
    unsigned,
    fixture(0x80f6ae, { top: 3, left: 10, seedOpcode: false }),
    {},
    'render_source_required',
  );
  unchangedFailure(
    unsigned,
    fixture(0x80f6ae, { top: 3, left: 10, status: 0x4d }),
    {},
    'task_binary_arithmetic_required',
  );
});
test('script arguments count zero skips workspace and reports actual observed outerS before TCS', () => {
  const p = prepared(args, fixture(0x80f460));
  assert.equal(p.wordPops, 0);
  assert.equal(p.outputContext.a, 0x6ff);
  assert.equal(p.outputContext.pc, 0xf488);
  assert.equal(p.outputContext.x, 2);
  assert.equal(p.outputContext.y, 6);
  assert.equal(p.stackMigrationExecuted, false);
});
test('script arguments consume full PLA words and refetch saved ID after workspace aliases', () => {
  const f = fixture(0x80f460, { d: 0, top: 0x1234, left: 0x5678 });
  f.data.seed(0x801204, [2, 0]);
  f.data.seed(0x82e9ce, [4, 0xaa]);
  const p = prepared(args, f);
  assert.equal(p.wordPops, 2);
  assert.equal(p.outputContext.s, 0x3f4);
  assert.equal(p.outputContext.x, 2);
  assert.equal(p.outputContext.y, 0);
  assert.equal(p.outputContext.status & 1, 0);
  assert.deepEqual(
    p.byteWrites.filter(([a]) => a < 0x7e0004),
    [
      [0x7e0003, 0x56],
      [0x7e0000, 0x34],
      [0x7e0001, 0x12],
      [0x7e0002, 0x78],
    ],
  );
});
test('argument low1 really enters 65536 iteration loop, with protected outer stack rejection and no partialwrites', () => {
  const f = fixture(0x80f460);
  f.data.seed(0x82e9ce, [1, 0]);
  unchangedFailure(args, f, { maxWork: 15 }, 'task_work_budget_required');
  const g = fixture(0x80f460);
  g.data.seed(0x82e9ce, [2, 0]);
  unchangedFailure(args, g, { maxOutputBytes: 4 }, 'task_output_budget_required');
});
