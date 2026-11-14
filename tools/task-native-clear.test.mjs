import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareTaskNativeClearFF79 as root } from '../proof/task/native-clear-ff79.mjs';
import { prepareTaskNativeOpcodeFF79 as call } from '../proof/task/native-clear-opcode.mjs';
import { prepareRenderFF79 } from '../proof/render/clear-ff79.mjs';
import { taskClearFixture, taskNativeClearOpcodeFixture } from './task-native-clear-fixtures.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { bodyWord, omitBodyBytes } from './task-script-body-fixtures.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { inspectRom, cpuToOffset } from './rom.mjs';
import { proveTaskNativeA7, nativeA7Anchors } from './task-native-clear-opcode-source.mjs';
import { taskClearFF79Window } from './task-native-clear-ff79-source.mjs';
const freeze = (values) => Object.freeze(values.map((v) => Object.freeze(v)));
test('NativeA7 allskip retains fresh signed slots and Y/C/V; STZ uses actual DBR and actual protected root RTS', () => {
  for (const bank of [0x80, 0x7f]) {
    const f = taskClearFixture(0x80ff79, { bank, slots: [0x8000, 0x8001, 0xfffe, 0xffff] }),
      p = prepared(root, f);
    assert.equal(p.visits, 4);
    assert.equal(p.calls.length, 0);
    assert.equal(p.waitObservationsUsed, 0);
    assert.equal(p.outputContext.a, 0x8000);
    assert.equal(p.outputContext.x, 0xfffe);
    assert.equal(p.outputContext.y, 0xabcd);
    assert.equal(p.outputContext.status, 0xc5);
    assert.equal(p.rawReturnWord, 0xc20a);
    assert.equal(p.returnTarget, 0x80c20b);
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    assert.equal(bodyWord(f.data, bank * 65536 + 0x200), 0);
    assert.equal(bodyWord(f.data, 0x7e0216), 0x8000);
  }
});
test('NativeA7 actual four whole FA3E calls match independent inactive FF79 data equations with real additional stack frames', () => {
  const f = taskClearFixture(0x80ff79, { slots: [0, 2, 4, 6], last: 8, flags: [0, 0, 0, 0, 0] }),
    p = prepared(root, f);
  const q = prepareRenderFF79({
    data: f.data,
    bank: 128,
    status: 69,
    y: 0xabcd,
    emulation: 0,
    directPage: 0,
    stackWindow: [0x6e6, 0x701],
    waitMode: 'record-observations',
    waitRead01F8: [0, 0, 0, 0],
  });
  assert.equal(q.handled, true);
  assert.equal(p.calls.length, 4);
  assert.equal(p.waitObservationsUsed, 4);
  assert.deepEqual(
    p.byteWrites.filter(([a]) => a < 0x7e06e6 || a > 0x7e0701),
    q.byteWrites,
  );
  assert.deepEqual(
    [p.outputContext.a, p.outputContext.x, p.outputContext.y, p.outputContext.status],
    [q.a, q.x, q.y, q.status],
  );
  assert.equal(p.accesses.filter((a) => a.label === 'FF79-PLX-fresh-low').length, 4);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  for (let n = 0; n < 4; n++) assert.equal(bodyWord(f.data, 0x7e0216 + 2 * n), 65535);
});
test('NativeA7 positive zero slot needs whole original AF1F IO and every chronological wait; late failures are private', () => {
  const f = taskClearFixture(0x80ff79, {
      slots: [65535, 65535, 65535, 0],
      active: true,
      last: 4,
      flags: [0, 0, 0],
      wait: [7, 0],
    }),
    p = prepared(root, f);
  assert.equal(p.calls.length, 1);
  assert.equal(p.observationsUsed, 5);
  assert.equal(p.waitObservationsUsed, 2);
  for (let n = 0; n < f.ioObservations.length; n++)
    unchangedFailure(
      root,
      f,
      { ioObservations: freeze(f.ioObservations.filter((_, i) => i !== n)) },
      'task_io_observation_required',
    );
  unchangedFailure(
    root,
    f,
    { waitObservations: freeze(f.waitObservations.slice(0, -1)) },
    'task_wait_observation_required',
  );
  assert.equal(
    prepared(root, { ...f, waitObservations: freeze(f.waitObservations.slice(1)) })
      .waitObservationsUsed,
    1,
  ); // A separately observed zero is already ready; no fixed poll count.
  unchangedFailure(
    root,
    f,
    { ioObservations: freeze([...f.ioObservations, f.ioObservations.at(-1)]) },
    'task_io_observation_unused',
  );
  unchangedFailure(
    root,
    f,
    { waitObservations: freeze([...f.waitObservations, f.waitObservations.at(-1)]) },
    'task_wait_observation_unused',
  );
  unchangedFailure(root, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(root, f, { maxOutputBytes: p.outputBytes - 1 }, 'task_output_budget_required');
  unchangedFailure(root, omitBodyBytes(f, 0x701), {}, 'render_source_required');
  prepared(root, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
  const before = f.data.snapshot();
  assert.equal(commitTaskPlan(f.data, { ...p }).reason, 'task_plan_owner_required');
  assert.deepEqual(f.data.snapshot(), before);
});
test('Own Native58/A7 has zero actual pops/no PHA, real F508/F509 and fresh high metadata; STZ frame alias is refetched', () => {
  const f = taskNativeClearOpcodeFixture({ slots: [65535, 65535, 65535, 0] }),
    p = prepared(call, f);
  assert.equal(p.arguments.wordPops, 0);
  assert.equal(p.arguments.metadataWord, 0x100);
  assert.equal(p.resultPushed, false);
  assert.equal(p.calleeReturnWord, 0xf508);
  assert.equal(p.calleeReturnTarget, 0x80f509);
  assert.equal(p.outputContext.s, 0x3f0);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  assert.equal(bodyWord(f.data, 0x3f1), 0xbeef);
  const g = taskNativeClearOpcodeFixture();
  for (const a of nativeA7Anchors)
    unchangedFailure(call, omitBodyBytes(g, a.start + 1), {}, 'render_source_required');
  const alias = taskNativeClearOpcodeFixture({ frame: 0x200 });
  const failed = unchangedFailure(call, alias, {}, 'render_source_required');
  assert.equal(failed.address, 0x7e0005);
  alias.data.seed(0x800005, [0x14, 0xa5]);
  const q = prepared(call, alias);
  assert.equal(q.outputContext.x, 0x14);
  assert.ok(q.accesses.some((a) => a.address === 0x800005 && a.kind === 'read'));
});
test('A7 root all31 bytes and original metadata are pinned to complete862-byte/401-instruction graph and typed nested returns', async () => {
  const { bytes } = inspectRom(await readFile('Shadowrun (E).smc')),
    p = await proveTaskNativeA7(bytes),
    graph = p.admitted_targets[0].proof;
  assert.equal(graph.reachable_instructions, 401);
  assert.equal(graph.minimum_protected_stack_bytes, 28);
  assert.equal(graph.external_return_assumptions, 0);
  assert.deepEqual(
    JSON.parse(await readFile('analysis/render-task-native-opcode-ff79.json')).proofs,
    [p],
  );
  for (const w of [taskClearFF79Window, ...nativeA7Anchors])
    for (let n = 0; n < w.hex.length / 2; n++) {
      const b = Buffer.from(bytes);
      b[cpuToOffset(w.start + n, bytes.length)] ^= 1;
      await assert.rejects(() => proveTaskNativeA7(b));
    }
});
