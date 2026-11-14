import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTaskNative9D98 as prepare } from '../proof/task/native-9d98.mjs';
import { prepareTaskNativeOpcode9D98 as call } from '../proof/task/native-opcode-bindings.mjs';
import { taskLeafFixture } from './task-native-leaf-fixtures.mjs';
import { taskNativeOpcodeFixture } from './task-native-opcode-fixtures.mjs';
import { native9D98Spec } from './task-native-9d98-spec.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { createRenderData, renderAddress } from '../src/render/data.mjs';
const word = (f, a, v) => f.data.seed(a, [v & 255, v >>> 8]);
const omit = (f, address) => {
  const data = createRenderData({ writeWindows: f.data.snapshot().writeWindows });
  for (const [a, v] of f.data.snapshot().bytes) if (a !== renderAddress(address)) data.seed(a, [v]);
  return { ...f, data };
};
test('Whole originalC6: pointer zero and full WORD signs, STZ preserves actual A/N/Z/C/V; both typed RTS paths', () => {
  for (const index of [0, 16, 255, 32768, 65535])
    for (const pointer of [0, 1, 0x400, 65535])
      for (const flag of [0, 1, 0x7fff, 0x8000, 0x8001, 65535])
        for (const cv of [0, 1, 64, 65]) {
          const f = taskLeafFixture(0x809d98, { status: cv }),
            a = 0xbeef;
          f.context = Object.freeze({ ...f.context, a });
          word(f, 0, index);
          word(f, 0x8013a8 + index, pointer);
          if (pointer) word(f, 0x7e0003 + pointer, flag);
          const p = prepared(prepare, f),
            truth = pointer !== 0 && flag < 32768;
          assert.equal(p.outputContext.a, truth ? 65535 : pointer ? flag : a);
          assert.equal(p.outputContext.x, pointer);
          assert.equal(p.outputContext.y, index);
          assert.equal(p.outputContext.status, cv | (truth || (pointer && flag & 32768) ? 128 : 2));
          const data = new Map(p.byteWrites);
          assert.equal(data.get(0x7e0000), truth ? 255 : 0);
          assert.equal(data.get(0x7e0001), truth ? 255 : 0);
          assert.equal(p.rawReturnWord, 0xc20a);
          assert.equal(p.returnTarget, 0x80c20b);
          assert.equal(p.returnTargetExecuted, false);
          if (!pointer)
            assert.equal(
              p.accesses.some((r) => r.label === 'leaf-long-WORD-low' && r.address === 0x7e0003),
              false,
            );
        }
});
test('Whole C6: real actualDBR/full-index bankcarry, long record highbytes and source-only data owners', () => {
  for (const bank of [0x80, 0x7e, 0x7f]) {
    const f = taskLeafFixture(0x809d98, { bank });
    word(f, 0, 65535);
    word(f, bank * 65536 + 0x13a8 + 65535, 65535);
    word(f, 0x7f0002, 0x1234);
    const p = prepared(prepare, f);
    assert.equal(p.outputContext.a, 65535);
    assert.equal(p.outputContext.bank, bank);
    assert.equal(p.outputContext.x, 65535);
    assert.ok(p.readAddresses.includes(renderAddress(bank * 65536 + 0x113a8)));
    assert.ok(p.readAddresses.includes(0x7f0003));
    unchangedFailure(prepare, omit(f, 0x7f0003), {}, 'render_source_required');
  }
  const f = taskLeafFixture(0x809d98);
  word(f, 0x8013b8, 0);
  unchangedFailure(prepare, omit(f, 0x8013b9), {}, 'render_source_required');
});
test('OriginalC6 wholeNative58: genuine one pop/actualF508/F509/WORD result PHA/Taskframe/PC/nextF390 and late failures', () => {
  for (const flag of [0, 0x7fff, 0x8000, 65535]) {
    const f = taskNativeOpcodeFixture(native9D98Spec);
    word(f, 0x7e0403, flag);
    const p = prepared(call, f),
      s = p.steps[0];
    assert.equal(s.id, 0xc6);
    assert.equal(s.wordPops, 1);
    assert.equal(s.metadataWord, 0x0202);
    assert.equal(s.resultPushed, true);
    assert.equal(s.calleeEntry, 0x809d98);
    assert.equal(s.calleeReturnWord, 0xf508);
    assert.equal(s.calleeReturnTarget, 0x80f509);
    assert.equal(
      p.accesses.find((r) => r.label === 'resume-fresh-result-low').value,
      flag < 32768 ? 255 : 0,
    );
    assert.equal(p.frontier, '80:F390');
    unchangedFailure(call, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
    unchangedFailure(call, f, { maxOutputBytes: p.outputBytes - 1 }, 'task_output_budget_required');
    for (const address of [0x82d945, 0x82db13, 0x82da37, 0x801206])
      unchangedFailure(call, omit(f, address), {}, 'render_source_required');
  }
});
