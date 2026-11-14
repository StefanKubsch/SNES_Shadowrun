import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareTaskNativeInputWaitF953 as root } from '../proof/task/native-input-wait-f953.mjs';
import { prepareTaskNativeOpcodeF953 as call } from '../proof/task/native-input-wait-opcode.mjs';
import {
  taskInputWaitFixture as fixture,
  taskNativeInputWaitOpcodeFixture as caller,
} from './task-native-input-wait-f953-fixtures.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { bodyWord as word, omitBodyBytes as omit } from './task-script-body-fixtures.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
import { inspectRom, cpuToOffset } from './rom.mjs';
import {
  decodeSource,
  proveTaskInputWaitF953,
  inputWaitF953Window,
} from './task-native-input-wait-f953-source.mjs';
import { proveTaskNativeA3, nativeA3Anchors } from './task-native-input-wait-opcode-source.mjs';
const freeze = (xs) => Object.freeze(xs.map(Object.freeze));
test('A3 original counter and normal input: exact ready mask, actual mixed calls/returns, full WORD wrap and independent repeated observations', () => {
  for (const mask of [0x40, 0x80, 0x2000, 0x4000, 0x8000]) {
    const f = fixture(0x80f953, { controls: [mask] }),
      p = prepared(root, f);
    assert.equal(p.iterations, 1);
    assert.equal(p.outputContext.a, mask);
    assert.equal(p.outputContext.s, 0x701);
    assert.equal(p.rawReturnWord, 0xc20a);
    assert.equal(p.returnTarget, 0x80c20b);
    assert.equal(p.inputObservationsUsed, 1);
    assert.equal(p.waitObservationsUsed, 1);
    assert.deepEqual(
      p.calls.map((c) => [c.pc, c.target, c.rawReturnWord, c.returnTarget]),
      [
        [0x80f953, 0x81b0a1, 0xf956, 0x80f957],
        [0x80f957, 0x809e1a, 0xf959, 0x80f95a],
      ],
    );
    commitTaskPlan(f.data, p);
    assert.equal(word(f.data, 0x8001cc), mask);
    assert.equal(word(f.data, 0x8001ce), mask);
    assert.equal(word(f.data, 0x7e1c76), 6);
  }
  const f = fixture(0x80f953, {
      baseline: 65535,
      polls: [65535, 0, 0, 1, 2],
      previous: 0x40,
      controls: [0x40, 0x41, 0x80],
    }),
    p = prepared(root, f);
  assert.equal(p.iterations, 3);
  assert.equal(p.waitObservationsUsed, 5);
  assert.equal(p.inputObservationsUsed, 3);
  assert.equal(p.outputContext.a, 0x80);
  assert.equal(p.calls.length, 6);
  commitTaskPlan(f.data, p);
  assert.equal(word(f.data, 0x8001cc), 0x80);
});
test('A3 reset, absent/wrong/unused samples, mode/context and exact budget boundaries reject every private effect', () => {
  const f = fixture(),
    p = prepared(root, f);
  unchangedFailure(
    root,
    fixture(0x80f953, { controls: [0x3030] }),
    {},
    'task_reset_source_required',
  );
  for (const key of ['waitObservations', 'inputObservations']) {
    unchangedFailure(
      root,
      f,
      { [key]: freeze([]) },
      key === 'waitObservations'
        ? 'task_wait_observation_required'
        : 'task_input_observation_required',
    );
    unchangedFailure(
      root,
      f,
      { [key]: freeze([...f[key], f[key][0]]) },
      key === 'waitObservations' ? 'task_wait_observation_unused' : 'task_input_observation_unused',
    );
    const bad = freeze([
      { ...f[key][0], ...(key === 'waitObservations' ? { pc: 0x81acc3 } : { address: 0x8001cb }) },
    ]);
    unchangedFailure(
      root,
      f,
      { [key]: bad },
      key === 'waitObservations'
        ? 'task_wait_observation_required'
        : 'task_input_observation_required',
    );
    unchangedFailure(
      root,
      f,
      { [key]: [...f[key]] },
      key === 'waitObservations'
        ? 'task_wait_observations_required'
        : 'task_input_observations_required',
    );
  }
  unchangedFailure(root, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(root, f, { maxOutputBytes: p.outputBytes - 1 }, 'task_output_budget_required');
  prepared(root, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
  unchangedFailure(
    root,
    f,
    { context: Object.freeze({ ...f.context, d: 1 }) },
    'task_input_wait_entry_required',
  );
  unchangedFailure(root, omit(f, 0x7e1c77), {}, 'render_source_required');
  // Explicit counter writer can overwrite a just pushed real JSL return.
  unchangedFailure(
    root,
    fixture(0x80f953, { s: 0x1c78 }),
    {},
    'task_native_helper_return_required',
  );
  unchangedFailure(root, fixture(0x80f953, { s: 0x1c75 }), {}, 'task_stack_alias_required');
});
test('A3 own Native58 caller: zero pops/no result PHA, original high metadata, actual F508/F509 and stale owner checks', () => {
  const f = caller(),
    p = prepared(call, f);
  assert.equal(p.arguments.metadataWord, 0x100);
  assert.equal(p.arguments.wordPops, 0);
  assert.equal(p.metadataWord, 0x200);
  assert.equal(p.resultPushed, false);
  assert.equal(p.calleeReturnWord, 0xf508);
  assert.equal(p.outputContext.s, 0x3f0);
  assert.equal(p.outputContext.y, 6);
  assert.equal(p.outputContext.x, 0x14);
  for (const a of nativeA3Anchors)
    unchangedFailure(call, omit(f, a.start + 1), {}, 'render_source_required');
  const missing = omit(f, 0x801206);
  unchangedFailure(call, missing, {}, 'render_source_required');
  assert.equal(commitTaskPlan(f.data, { ...p }).reason, 'task_plan_owner_required');
  sampleWord(f.data, 0x7e1c76, 9);
  assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
});
test('A3 source renews whole counter and full input/reset bytes, conditional23-instruction graph, and every original root/metadata byte', async () => {
  const { bytes } = inspectRom(await readFile('Shadowrun (E).smc')),
    d = decodeSource(bytes),
    p = proveTaskInputWaitF953(d.map);
  assert.equal(p.reachable_instructions, 23);
  assert.equal(p.minimum_protected_stack_bytes, 5);
  assert.equal(p.external_return_assumptions, 0);
  assert.equal(p.full_graph_closed, false);
  assert.equal(p.conditional_graph_closed, true);
  assert.deepEqual(
    JSON.parse(await readFile('analysis/render-task-native-opcode-f953.json')).proofs,
    [await proveTaskNativeA3(bytes)],
  );
  for (const w of [inputWaitF953Window, ...nativeA3Anchors])
    for (let n = 0; n < w.hex.length / 2; n++) {
      const changed = Buffer.from(bytes);
      changed[cpuToOffset(w.start + n, bytes.length)] ^= 1;
      await assert.rejects(() => proveTaskNativeA3(changed));
    }
  for (const window of d.windows) {
    const a = parseInt(window.entry.replace(':', ''), 16),
      changed = Buffer.from(bytes);
    changed[cpuToOffset(a + window.covered_bytes - 1, bytes.length)] ^= 1;
    assert.throws(() => proveTaskInputWaitF953(decodeSource(changed).map));
  }
});
