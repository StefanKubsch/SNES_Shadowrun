import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTaskNativeCB06 as prepare } from '../proof/task/native-cb06.mjs';
import { prepareTaskNativeOpcodeCB06 as call } from '../proof/task/native-opcode-bindings.mjs';
import { taskLeafFixture } from './task-native-leaf-fixtures.mjs';
import { taskNativeOpcodeFixture } from './task-native-opcode-fixtures.mjs';
import { nativeCB06Spec } from './task-native-cb06-spec.mjs';
import { createRenderData, renderAddress } from '../src/render/data.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
const word = (f, a, v) => f.data.seed(a, [v & 255, v >>> 8]);
const omit = (f, address) => {
  const data = createRenderData({ writeWindows: f.data.snapshot().writeWindows });
  for (const [a, v] of f.data.snapshot().bytes) if (a !== renderAddress(address)) data.seed(a, [v]);
  return { ...f, data };
};

test('CB06: independent WORD carry/overflow quadrants, full indices and distinct EFB4 field', () => {
  for (const input of [
    0, 1, 0x1234, 0x3fff, 0x4000, 0x4001, 0x5555, 0x7fff, 0x8000, 0xbfff, 0xc000, 0xd000, 0xffff,
  ])
    for (const index of [0x10, 0xffff])
      for (const result of [0, 0x8001, 0xffff]) {
        const f = taskLeafFixture(0x80cb06),
          expectedIndex = (6 * input + Number(!!(input & 0x4000))) & 65535;
        word(f, 0, index);
        word(f, 0x8db022 + index, input);
        if (renderAddress(0x8cefb4 + expectedIndex) === null) {
          unchangedFailure(prepare, f, {}, 'render_address_required');
          continue;
        }
        word(f, 0x8cefb4 + expectedIndex, result);
        const p = prepared(prepare, f);
        assert.equal(p.outputContext.x, expectedIndex);
        assert.equal(p.outputContext.a, result);
        const left = (4 * input) & 65535,
          right = (2 * input) & 65535,
          sum = left + right + Number(!!(input & 0x4000));
        const signed = (v) => (v < 32768 ? v : v - 65536),
          signedSum = signed(left) + signed(right) + Number(!!(input & 0x4000));
        assert.equal(
          p.outputContext.status & 0x41,
          Number(sum > 65535) | (signedSum > 32767 || signedSum < -32768 ? 0x40 : 0),
        );
        assert.equal(
          p.outputContext.status & 0x82,
          (result & 0x8000 ? 0x80 : 0) | (result === 0 ? 2 : 0),
        );
        assert.deepEqual(
          p.accesses.filter((a) => a.label === 'leaf-long-WORD-low').map((a) => a.address),
          [0x8db022 + index, 0x8cefb4 + expectedIndex],
        );
        const store = p.accesses.findIndex((a) => a.label === 'leaf-scaled-word-high');
        assert.equal(p.accesses[store + 1].label, 'leaf-DP-WORD-low');
        assert.equal(p.accesses[store + 1].value, (2 * input) & 255);
        assert.equal(p.accesses[store + 2].value, ((2 * input) >>> 8) & 255);
      }
});

test('Native5C: full call pushes full result after actual F508 RTS and fresh metadata; late missing bytes discard effects', () => {
  const f = taskNativeOpcodeFixture(nativeCB06Spec);
  word(f, 0x8db032, 0xd000);
  word(f, 0x8dcfb5, 0xfedc);
  const p = prepared(call, f);
  assert.equal(p.steps[0].calleeReturnWord, 0xf508);
  assert.equal(p.steps[0].resultPushed, true);
  assert.equal(p.accesses.find((a) => a.label === 'resume-fresh-result-low').value, 0xdc);
  assert.equal(p.accesses.find((a) => a.label === 'resume-fresh-result-high').value, 0xfe);
  assert.equal(p.outputContext.s, 0x3f0);
  assert.deepEqual(
    p.byteWrites.filter(([a]) => a === 0x7e03f1 || a === 0x7e03f2),
    [
      [0x7e03f2, 0xfe],
      [0x7e03f1, 0xdc],
    ],
  );
  for (const address of [0x8db033, 0x8dcfb6, 0x82daa9, 0x82d9cd, 0x801206])
    unchangedFailure(call, omit(f, address), {}, 'render_source_required');
  unchangedFailure(call, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(
    prepare,
    taskLeafFixture(0x80cb06),
    { context: Object.freeze({ ...taskLeafFixture(0x80cb06).context, status: 8 }) },
    'task_binary_arithmetic_required',
  );
});
