import test from 'node:test';
import assert from 'node:assert/strict';
import { taskOpcodeSpecs } from './task-opcode-specs.mjs';
import { taskOpcodeFixture } from './task-opcode-fixtures.mjs';
import { prepareTaskOpcodeSequence as sequence } from '../proof/task/opcode-sequence.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { createRenderData, renderAddress } from '../src/render/data.mjs';
const fixture = (opcode, patch = {}) =>
  taskOpcodeFixture(
    taskOpcodeSpecs.find((s) => s.opcode === opcode),
    patch,
  );
const drop = (f, ...addresses) => {
  const data = createRenderData({ writeWindows: f.data.snapshot().writeWindows }),
    omit = new Set(addresses.map(renderAddress));
  for (const [a, v] of f.data.snapshot().bytes) if (!omit.has(a)) data.seed(a, [v]);
  return { ...f, data };
};
const seedWord = (f, address, value) => {
  f.data.seed(address, [value & 255]);
  f.data.seed((address + 1) & 0xffffff, [value >>> 8]);
};
const context = (f, patch) => ({ ...f, context: Object.freeze({ ...f.context, ...patch }) });

for (const opcode of [0x44, 0x46])
  for (const condition of [0, 0x0100, 0xffff]) {
    test(`synthetic ${opcode.toString(16)} tests full condition ${condition}, reads target only on taken path`, () => {
      const f = fixture(opcode, { top: condition });
      seedWord(f, 0x801204, 0x20);
      seedWord(f, 0x801206, 0xa514);
      seedWord(f, 0x801220, 0xa586);
      const taken = opcode === 0x44 ? condition === 0 : condition !== 0,
        p = prepared(sequence, f);
      assert.equal(p.steps[0].taken, taken);
      assert.equal(p.steps[0].conditionWord, condition);
      assert.equal(p.outputContext.y, taken ? 0x21 : 7);
      assert.equal(p.outputContext.x, taken ? 0x86 : 0x14);
      assert.equal(p.outputContext.s, f.context.s + 2);
      assert.equal(p.outputContext.status & 0x4d, f.context.status & 0x4d);
      assert.equal(p.outputBytes, 0);
      assert.deepEqual(p.byteWrites, []);
      assert.equal(
        p.accesses.filter((a) => a.label.startsWith('jump-target-WORD')).length,
        taken ? 4 : 0,
      );
      const missing = drop(f, 0x801204, 0x801205);
      if (taken) unchangedFailure(sequence, missing, {}, 'render_source_required');
      else prepared(sequence, missing);
      unchangedFailure(
        sequence,
        drop(f, taken ? 0x801221 : 0x801207),
        {},
        'render_source_required',
      );
    });
  }

test('synthetic jump wraps WORD Y and native S independently of DBR and uses required opcode highbyte', () => {
  const f = fixture(0x46, {
    top: 1,
    s: 0xfffe,
    y: 0xffff,
    bank: 0x7f,
    pointer: 0xffff,
    writeWindows: [[0x7e0000, 0x7fffff]],
  });
  // PLA reads bank00 FFFF and 0000, separate from stream 7F:FFFF+FFFF.
  f.data.seed(0xffff, [1]);
  f.data.seed(0, [0]);
  seedWord(f, 0x80fffe, 0xffff);
  const p = prepared(sequence, f);
  assert.equal(p.outputContext.s, 0);
  assert.equal(p.outputContext.y, 0);
  assert.equal(p.outputContext.x, 0xff);
  assert.equal(p.steps[0].targetWord, 0xffff);
  assert.deepEqual(
    p.accesses
      .filter((a) => a.label === 'jump-condition-PLA-low' || a.label === 'jump-condition-PLA-high')
      .map((a) => a.address),
    [0xffff, 0],
  );
  unchangedFailure(sequence, drop(f, 0x80ffff), {}, 'render_source_required');
});

test('synthetic unconditional backward self-jump executes exactly the explicit count and no next target read', () => {
  const f = fixture(0x48);
  f.data.seed(0x801203, [0x48, 3, 0]);
  const p = prepared(sequence, { ...f, maxHandlers: 20, maxWork: 200, maxOutputBytes: 0 });
  assert.equal(p.handlersExecuted, 20);
  assert.equal(p.work, 200);
  assert.equal(p.outputBytes, 0);
  assert.equal(p.outputContext.y, 4);
  assert.equal(p.outputContext.x, 0x48);
  assert.ok(p.steps.every((s) => s.targetWord === 3));
  assert.equal(p.nextTargetExecuted, false);
  unchangedFailure(sequence, f, { maxHandlers: 20, maxWork: 199 }, 'task_work_budget_required');
});

const controlChain = () => {
  const f = taskOpcodeFixture();
  f.data.seed(0x801204, [0x86, 0x44, 0xff, 0xff, 0xb0, 0x48, 4, 0]);
  return { ...f, maxHandlers: 5 };
};
test('synthetic push/update/conditional/alias/backjump share fresh values and discard late jump failures', () => {
  const f = controlChain(),
    p = prepared(sequence, f);
  assert.deepEqual(
    p.steps.map((s) => s.opcode),
    [0xc0, 0x86, 0x44, 0xb0, 0x48],
  );
  assert.equal(p.steps[2].conditionWord, 1);
  assert.equal(p.steps[2].taken, false);
  assert.equal(p.steps[3].right, 2);
  assert.equal(p.steps[3].result, 0);
  assert.equal(p.outputContext.s, 0x3f2);
  assert.equal(p.outputContext.y, 5);
  assert.equal(p.outputContext.x, 0x86);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  const bytes = new Map(f.data.snapshot().bytes);
  assert.equal(bytes.get(0x7e03f3), 0);
  assert.equal(bytes.get(0x7e03f4), 0);
  const missing = drop(controlChain(), 0x80120b);
  unchangedFailure(sequence, missing, {}, 'render_source_required');
  const table = controlChain();
  table.data.seed(0x80f2fc, [0]);
  unchangedFailure(sequence, table, {}, 'task_opcode_target_required');
  unchangedFailure(sequence, controlChain(), { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(
    sequence,
    controlChain(),
    { maxOutputBytes: p.outputBytes - 1 },
    'task_output_budget_required',
  );
  // First skipped target byte is also the preceding opcode's required high.
  prepared(sequence, drop(controlChain(), 0x801207));
  unchangedFailure(sequence, drop(controlChain(), 0x801206), {}, 'render_source_required');
});

for (const opcode of [0x04, 0x18, 0x0e]) {
  test(`synthetic state ${opcode.toString(16)} keeps full offset and highbyte across 7E/7F boundary`, () => {
    for (const state of [0, 0xab7f, 0xab80, 0xabff]) {
      const f = fixture(opcode);
      seedWord(f, 0x801204, 0xffff);
      seedWord(f, 0x7effff, state);
      const p = prepared(sequence, f),
        low = state & 255;
      const expected = opcode === 0x18 ? state : opcode === 0x0e && low >= 128 ? 0xff00 | low : low;
      assert.equal(p.steps[0].value, expected);
      assert.equal(p.steps[0].offsetWord, 65535);
      assert.deepEqual(
        p.accesses.filter((a) => a.label.startsWith('state-WORD')).map((a) => a.address),
        [0x7effff, 0x7f0000],
      );
      assert.equal(p.outputContext.s, 0x3ee);
      assert.equal(p.outputContext.y, 7);
      if (opcode === 0x0e) assert.equal(p.outputContext.status & 1, Number(low >= 128));
      unchangedFailure(sequence, drop(f, 0x7f0000), {}, 'render_source_required');
    }
  });
}

test('synthetic full WORD State write rewrites own pointer before later dispatch and reads', () => {
  const f = fixture(0x36, { top: 0x1300 });
  seedWord(f, 0x801204, f.context.d);
  // Old-pointer next opcode is unsupported. Only fresh pointer1300 is valid.
  f.data.seed(0x801206, [0x54, 0xa5]);
  f.data.seed(0x801306, [0x18, 0x10, 3, 0x86, 0xa5]);
  const p = prepared(sequence, { ...f, maxHandlers: 2 });
  assert.deepEqual(
    p.steps.map((s) => s.opcode),
    [0x36, 0x18],
  );
  assert.equal(p.steps[0].value, 0x1300);
  assert.equal(p.steps[1].value, 0xabcd);
  assert.equal(p.outputContext.x, 0x86);
  assert.equal(p.outputContext.y, 10);
  assert.equal(p.outputContext.s, 0x3f0);
  assert.deepEqual(
    p.accesses.filter((a) => a.label === 'fresh-next-opcode-pointer-low').map((a) => a.value),
    [0, 0],
  );
  assert.deepEqual(
    p.accesses.filter((a) => a.label === 'fresh-next-opcode-pointer-high').map((a) => a.value),
    [0x13, 0x13],
  );
  assert.deepEqual(
    p.accesses.filter((a) => a.label === 'fresh-next-opcode-low').map((a) => a.address),
    [0x801306, 0x801309],
  );
  unchangedFailure(sequence, drop(f, 0x80130a), { maxHandlers: 2 }, 'render_source_required');
  unchangedFailure(
    sequence,
    f,
    { maxHandlers: 2, protectedStackBytes: [...f.protectedStackBytes, 0x7e0310] },
    'task_stack_alias_required',
  );
});

test('synthetic byte State write changes only lowbyte, later sign-read sees its fresh value and Carry', () => {
  const f = fixture(0x2e, { top: 0xab80 });
  f.data.seed(0x801206, [0x0e, 0x10, 3, 0xac, 0xa5]);
  const p = prepared(sequence, { ...f, maxHandlers: 2 });
  assert.deepEqual(
    p.steps.map((s) => s.opcode),
    [0x2e, 0x0e],
  );
  assert.equal(p.steps[0].stateWriteBytes, 1);
  assert.equal(p.steps[1].stateWord, 0xab80);
  assert.equal(p.steps[1].value, 0xff80);
  assert.equal(p.outputContext.status & 1, 1);
  assert.deepEqual(
    p.accesses
      .filter((a) => a.kind === 'write' && a.address >= 0x7e0000)
      .map((a) => [a.address, a.value]),
    [[0x7e0310, 0x80]],
  );
  unchangedFailure(sequence, drop(f, 0x7e0311), { maxHandlers: 2 }, 'render_source_required');
});

test('synthetic State write keeps WRAM separate from programbank opcode table and rejects a late changed target', () => {
  const f = fixture(0x36, { top: 0x1234, writeWindows: [[0x7e0000, 0x7fffff]] });
  seedWord(f, 0x801204, 0xf2b4);
  f.data.seed(0x7ef2b4, [0x98, 0xf3]);
  f.data.seed(0x801206, [0, 0xa5]);
  const g = context(f, { programBank: 0x80 });
  // F390 always reads bank80 ROM addresses, not the WRAM State address.
  const p = prepared(sequence, { ...g, maxHandlers: 2 });
  assert.equal(p.steps[1].target, 0x80f398);
  assert.equal(p.steps[0].stateAddress, 0x7ef2b4);
  // Deliberately corrupt the actual bank80 provider to demonstrate separation.
  f.data.seed(0x80f2b4, [0x34, 0x12]);
  unchangedFailure(sequence, g, { maxHandlers: 2 }, 'task_opcode_target_required');
});

for (const opcode of [
  0xac, 0xae, 0xb4, 0xb6, 0x8a, 0x92, 0x9a, 0xa2, 0x8c, 0x8e, 0x94, 0x96, 0x9c, 0x9e, 0xa4, 0xa6,
]) {
  test(`synthetic compare ${opcode.toString(16)} preserves original sign gate, wrap and carry through next handler`, () => {
    for (const [right, left] of [
      [0, 0],
      [0, 1],
      [1, 1],
      [0x7fff, 0x8000],
      [0x8000, 0x7fff],
      [0xffff, 0xffff],
    ]) {
      const f = fixture(opcode, { top: right, left, status: 0x4d });
      f.data.seed(0x801204, [0xbe, 0xa5, 0x14, 0xa5]);
      const p = prepared(sequence, { ...f, maxHandlers: 2 }),
        step = p.steps[0];
      const leftGate = [0xac, 0xb4, 0x8c, 0x94, 0x9c, 0xa4].includes(opcode);
      const signGate = [
        0xac, 0xae, 0xb4, 0xb6, 0x8c, 0x8e, 0x94, 0x96, 0x9c, 0x9e, 0xa4, 0xa6,
      ].includes(opcode);
      const negative = signGate && Boolean((leftGate ? left : right) & 0x8000);
      const decremented = [0x8a, 0xa2, 0x8c, 0x8e, 0xa4, 0xa6].includes(opcode);
      const transformed = decremented ? (right + 65535) & 65535 : right;
      const carry = negative ? 1 : Number(transformed >= left);
      let expected;
      if ([0xac, 0xae, 0xb4, 0xb6].includes(opcode))
        expected = negative
          ? [0xac, 0xae].includes(opcode)
            ? 0
            : 65535
          : opcode === 0xae
            ? 65535
            : right === left
              ? 0
              : 65535;
      else if ([0x8a, 0x92, 0x9a, 0xa2].includes(opcode))
        expected = (opcode === 0x9a ? !carry : carry) ? 65535 : 0;
      else if ([0x8c, 0x8e, 0x94, 0x96].includes(opcode))
        expected = negative ? (leftGate ? 65535 : 0) : carry ? 65535 : 0;
      else expected = negative ? (leftGate ? 0 : 65535) : carry ? 0 : 65535;
      assert.equal(step.value, expected);
      assert.equal(p.steps[1].value, expected);
      assert.equal(p.outputContext.status & 1, carry);
      assert.equal(p.outputContext.status & 0x4c, 0x4c);
      assert.equal(p.outputContext.s, 0x3f2);
      assert.equal(p.handlersExecuted, 2);
      assert.equal(p.steps[1].operandStore, expected !== 0);
      assert.equal(p.steps[1].result, expected ? 65535 : 0);
    }
  });
}

test('synthetic separately admitted B0 alias retains actual slot and changed newly admitted targets fail', () => {
  const f = fixture(0xb0),
    p = prepared(sequence, f);
  assert.equal(p.steps[0].tableAddress, 0x80f364);
  assert.equal(p.steps[0].target, 0x80f843);
  unchangedFailure(sequence, drop(f, 0x80f365), {}, 'render_source_required');
  for (const opcode of [0xb8, 0x4c, 0x50, 0x52, 0x54, 0x56, 0x58]) {
    const g = context(f, { x: opcode });
    g.data.seed(0x80f2b4 + opcode, [0x7e, 0xf8]);
    unchangedFailure(sequence, g, {}, 'task_opcode_target_required');
  }
});
