import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareTaskNativeAAAF as root } from '../proof/task/native-aaaf.mjs';
import { prepareTaskNativeOpcodeAAAF as call } from '../proof/task/native-opcode-bindings.mjs';
import { nativeAAAFSpec as spec } from './task-native-aaaf-spec.mjs';
import { taskLeafFixture } from './task-native-leaf-fixtures.mjs';
import { taskNativeOpcodeFixture } from './task-native-opcode-fixtures.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
import { bodyWord as word, omitBodyBytes as omit } from './task-script-body-fixtures.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { inspectRom, cpuToOffset } from './rom.mjs';
import { proveNativeOpcode } from './task-native-opcode-source.mjs';
const put = (f, a, v) => sampleWord(f.data, a, v);
test('Own Native6A equality exits before action stores; slow FFFF gate keeps actual A/WORD flags and no invented selection read', () => {
  const f = taskLeafFixture(spec.entry),
    p = prepared(root, omit(f, 0x8010f8, 0x801048, 0x8010a0));
  assert.equal(p.outputBytes, 0);
  assert.equal(p.outputContext.a, 0xabcd);
  assert.equal(p.outputContext.y, 3);
  assert.equal(p.outputContext.status, 0x47);
  for (const activity of [0, 0x80, 65535]) {
    const g = taskLeafFixture(spec.entry);
    put(g, 0x8011a8, 0);
    put(g, 0x8010f8, activity);
    put(g, 0x801048, 65535);
    const q = prepared(root, g);
    assert.equal(q.outputContext.a, 65535);
    assert.equal(q.outputContext.status & 0x83, 3);
    assert.equal(commitTaskPlan(g.data, q).handled, true);
    assert.equal(word(g.data, 0x8011a8), 3);
  }
});
test('Own Native6A fast BYTE counter arithmetic preserves field highbyte and uses full WORD action indices', () => {
  for (const action of [1, 5, 0x100, 0xffff])
    for (const initial of [0, 0x7f, 0x80, 0xff]) {
      const f = taskLeafFixture(spec.entry);
      put(f, 2, action);
      put(f, 0x8011a8, 0);
      put(f, 0x8010f8, 1);
      put(f, 0x8010a0, 0x9000);
      put(f, 0x801200, 0xab00 | initial);
      f.data.seed(0x8c9000, [0x80]);
      f.data.seed(0x8c9000 + action, [0x7f]);
      const q = prepared(root, f),
        result = (((initial - 0x80) & 255) + 0x7f) & 255;
      assert.equal(q.outputContext.y, action);
      assert.equal(q.outputContext.a, 65535);
      assert.equal(q.outputContext.status & 0x30, 0);
      assert.equal(commitTaskPlan(f.data, q).handled, true);
      assert.equal(word(f.data, 0x801200), 0xab00 | result);
      assert.equal(word(f.data, 0x8011a8), action);
    }
});
test('Own Native6A slow path renews whole A985 with real AADC stack owner; late return/source/budget failures are atomic', () => {
  const f = taskLeafFixture(spec.entry);
  put(f, 2, 0);
  put(f, 0x8011a8, 3);
  put(f, 0x8010f8, 0);
  put(f, 0x801048, 2);
  put(f, 0x7e3f38, 0);
  put(f, 0x8ced8a, 0x9000);
  put(f, 0x8c9004, 0xa000);
  f.data.seed(0x8ca000, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  put(f, 0x8ca008, 0xa509);
  const p = prepared(root, f);
  assert.equal(p.accesses.find((a) => a.label === 'd2-inner-RTS-low').value, 0xdc);
  assert.equal(p.accesses.find((a) => a.label === 'd2-inner-RTS-high').value, 0xaa);
  assert.equal(p.outputContext.s, 0x701);
  assert.equal(p.returnTarget, 0x80c20b);
  prepared(root, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
  unchangedFailure(root, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(root, f, { maxOutputBytes: p.outputBytes - 1 }, 'task_output_budget_required');
  unchangedFailure(root, omit(f, 0x8ca008), {}, 'render_source_required');
  const alias = taskLeafFixture(spec.entry, { s: 0xb31, savedOuterS: 0xb31 });
  for (const [a, v] of f.data.snapshot().bytes) if (a >= 0x8c0000) alias.data.seed(a, [v]);
  put(alias, 0, 0xfaf8);
  put(alias, 2, 0);
  put(alias, 0x810c90, 3);
  put(alias, 0x810be0, 0);
  put(alias, 0x810b30, 2);
  put(alias, 0x7f3a20, 0);
  // A985 writes 1038+FAF8 onto the freshly pushed AADC return at bank00:B30.
  unchangedFailure(root, alias, {}, 'task_native_helper_return_required');
});
test('Own Native58/6A has two WORDpops/no PHA and separate table/source proof for its AAAF root and A985 child', async () => {
  const f = taskNativeOpcodeFixture(spec),
    p = prepared(call, f),
    s = p.steps[0];
  assert.equal(s.wordPops, 2);
  assert.equal(s.resultPushed, false);
  assert.equal(s.calleeEntry, 0x80aaaf);
  assert.equal(s.calleeReturnWord, 0xf508);
  assert.equal(s.calleeReturnTarget, 0x80f509);
  for (const a of spec.anchors)
    unchangedFailure(call, omit(f, a.start + 1), {}, 'render_source_required');
  const { bytes } = inspectRom(await readFile('Shadowrun (E).smc')),
    source = await proveNativeOpcode(bytes, spec);
  assert.equal(source.admitted_targets[0].proof.maximum_local_stack_bytes, 2);
  assert.equal(source.admitted_targets[0].proof.minimum_protected_stack_bytes, 4);
  for (const w of [...spec.windows, ...spec.anchors])
    for (let n = 0; n < w.hex.length / 2; n++) {
      const changed = Buffer.from(bytes);
      changed[cpuToOffset(w.start + n, bytes.length)] ^= 1;
      await assert.rejects(() => proveNativeOpcode(changed, spec));
    }
});
