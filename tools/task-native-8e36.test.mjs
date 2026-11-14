import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectRom } from './rom.mjs';
import { decodeTaskWindows } from './task-partial-source.mjs';
import { native8E36Spec } from './task-native-8e36-spec.mjs';
import { renew8E36Helpers, prove8E36Local, source8E36 } from './task-native-8e36-source.mjs';
import {
  task8E36Fixture,
  task8E36NoticeFixture,
  freeze8E36,
} from './task-native-8e36-fixtures.mjs';
import { randomRecords } from './task-native-random-fixtures.mjs';
import { hitObject, hitObjectsInBlastDevices } from '../src/task/native-object-hit.mjs';
import { prepareTaskNative8E36 as prepare } from '../proof/task/native-8e36.mjs';
import { prepareTaskPlan } from '../proof/task/plan.mjs';
import { taskAudioFixture } from './task-native-audio-fixtures.mjs';
import { ad92Fixture } from './render-ad92-fixtures.mjs';
import { seed8E36Fixture } from './task-native-8e36-fixtures.mjs';
import { prepared, unchangedFailure, commit } from './task-native-test-support.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
import { omitBodyBytes as omit, bodyWord as word } from './task-script-body-fixtures.mjs';
const { bytes } = inspectRom(await readFile('Shadowrun (E).smc'));
test('Native7C source renews all local bytes, nine complete helper graphs and actual BYTE/WORD86C4 under32 stackbytes', async () => {
  const source = await source8E36(bytes),
    p = source.proofs[0];
  assert.equal(p.reachable_instructions, 234);
  assert.equal(p.minimum_protected_stack_bytes, 32);
  assert.deepEqual(
    p.modes.filter((m) => m.at === '80:86C4').map((m) => m.m),
    [0, 1],
  );
  assert.equal(source.helpers.length, 9);
  assert.equal(p.external_return_assumptions, 0);
  assert.deepEqual(JSON.parse(await readFile('analysis/render-task-native-8e36.json')), source);
  const d = decodeTaskWindows(bytes, native8E36Spec.windows),
    helpers = renew8E36Helpers(bytes);
  for (const [pc, i] of d.map) {
    const missing = new Map(d.map);
    missing.delete(pc);
    assert.throws(() => prove8E36Local(missing, helpers));
    const raw = Buffer.from(i.raw);
    raw[0] ^= 1;
    for (const patch of [
      { raw },
      { value: i.value ^ 1 },
      { next: i.next + 1 },
      { state: { ...i.state, m: 1 - i.state.m } },
      ...(i.target ? [{ target: i.target + 1 }] : []),
    ]) {
      const bad = new Map(d.map);
      bad.set(pc, { ...i, ...patch });
      assert.throws(() => prove8E36Local(bad, helpers));
    }
  }
  const broken = helpers.map((h, n) =>
    n ? h : { ...h, proof: { ...h.proof, external_return_assumptions: 1 } },
  );
  assert.throws(() => prove8E36Local(d.map, broken));
});
test('Native7C full56..0 scan preserves every strict60 WORD-difference gate and unsigned8000 magnitude', () => {
  for (const axis of ['dx', 'dy', 'dz'])
    for (const delta of [0, 95, -95, 96, -96, 32768]) {
      const f = task8E36Fixture({ [axis]: delta }),
        p = prepared(prepare, f);
      assert.equal(p.visits, 44);
      assert.equal(p.affected, Math.abs(delta) < 96 ? 1 : 0);
      assert.equal(p.returnTarget, 0x80f509);
      assert.equal(p.outputContext.x, 65534);
      assert.equal(p.outputContext.y, 0x20);
    }
  for (const v of [
    { active: null },
    { flags: 0 },
    { flags: 0x4000 },
    { active: 0x56 },
    { active: 0 },
  ]) {
    const p = prepared(prepare, task8E36Fixture(v));
    assert.equal(p.visits, 44);
    assert.equal(p.affected, v.active === null || v.flags !== undefined ? 0 : 1);
  }
});
test('Native7C record damage uses BYTE stores, WORD task fallback and hiddenA-high on the negative-index WORD store', () => {
  const f = task8E36Fixture({ flags: 0xa000 }),
    p = commit(prepare, f);
  assert.equal(p.affected, 1);
  assert.equal(word(f.data, 0x7e4002), 4);
  assert.equal(p.observationsUsed, 3);
  assert.equal(word(f.data, 0x7e3f7e), 0xa1);
  assert.equal(word(f.data, 0x7e444e), 0);
  const dead = task8E36Fixture({ flags: 0xa000, health: 1 });
  commit(prepare, dead);
  assert.equal(word(dead.data, 0x7e4002), 0);
  assert.equal(word(dead.data, 0x800c62), 0x1a34);
  const negative = task8E36Fixture({ flags: 0xa000, record: 0, task: 65535, limit: 0x200 });
  negative.data.seed(0x7e1c76, [0x1a, 0x1b]);
  negative.ioObservations = randomRecords([[0x7b, 0, 0]]);
  const n = commit(prepare, negative);
  assert.equal(word(negative.data, 0x7f0001), 0x0101);
  assert.equal(
    n.accesses.some((a) => a.kind === 'read' && a.address === 0x7e4003),
    false,
  );
  for (const timer of [1, 2, 128]) {
    const q = prepared(prepare, task8E36Fixture({ flags: 0xa000, timer }));
    assert.equal(
      q.calls.some((c) => c.target === 0x80a835),
      false,
    );
  }
});
test('Native7C failures after earlier damage/callback writes remain atomic; budgets, protected aliases and stale source are enforced', () => {
  const f = task8E36Fixture({ flags: 0xa000 }),
    p = prepared(prepare, f);
  prepared(prepare, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
  unchangedFailure(prepare, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(
    prepare,
    f,
    { maxOutputBytes: p.outputBytes - 1 },
    'task_output_budget_required',
  );
  unchangedFailure(prepare, f, { ioObservations: freeze8E36([]) }, 'task_io_observation_required');
  unchangedFailure(prepare, omit(f, 0x82dc37), {}, 'render_source_required');
  unchangedFailure(
    prepare,
    f,
    { protectedStackBytes: [...f.protectedStackBytes, 0x7e4002] },
    'task_stack_alias_required',
  );
  const pending = prepared(prepare, f);
  sampleWord(f.data, 0x800e38, 0x1001);
  const before = f.data.snapshot();
  assert.equal(commitTaskPlan(f.data, pending).reason, 'task_plan_stale');
  assert.deepEqual(f.data.snapshot(), before);
});
test('Native7C both original notices perform allocation/text, thirty distinct counter entries, input and removal before the actual RTS', () => {
  for (const counter of [3, 7]) {
    const f = task8E36NoticeFixture(counter),
      p = commit(prepare, f);
    assert.equal(p.calls.filter((c) => c.target === 0x81b0a1).length, 30);
    assert.equal(p.calls.filter((c) => c.target === 0x80f953).length, 1);
    assert.equal(p.waitObservationsUsed, 44);
    assert.equal(p.inputObservationsUsed, 1);
    assert.equal(p.observationsUsed, 3);
    assert.equal(word(f.data, 0xb4), 1);
    assert.equal(word(f.data, 0x7e3c11), counter === 3 ? 8 : 0);
    assert.equal(word(f.data, 0x801fd4), counter === 3 ? 4 : 0);
  }
  const f = task8E36NoticeFixture(),
    last = f.waitObservations.length - 1;
  unchangedFailure(
    prepare,
    f,
    { waitObservations: freeze8E36(f.waitObservations.slice(0, last)) },
    'task_wait_observation_required',
  );
  unchangedFailure(
    prepare,
    f,
    { inputObservations: freeze8E36([{ ...f.inputObservations[0], value: 0x3030 }]) },
    'task_reset_source_required',
  );
});
const prepare8691 = (f) =>
  prepareTaskPlan(
    f,
    [0x808691],
    (a) =>
      hitObject(a, {
        mode: f.waitMode,
        values: f.waitObservations,
        waitIndex: 0,
        inputMode: f.inputMode,
        inputs: f.inputObservations,
        inputIndex: 0,
        calls: [],
        waitEvents: [],
      }),
    hitObjectsInBlastDevices,
  );
test('Original8691 alternate caller keeps full savedB7, executes its second real creation and direction tables', () => {
  const f = task8E36Fixture({ flags: 0xa000, timer: 1 });
  f.entry = 0x808691;
  f.context = Object.freeze({ ...f.context, a: 1, x: 16, y: 2, pc: 0x8691 });
  sampleWord(f.data, 0x80119a, 0);
  const p = commit(prepare8691, f);
  assert.equal(word(f.data, 0x7e3f7e), 0xe7);
  assert.equal(word(f.data, 0x7e444e), 4);
  assert.equal(p.outputContext.y, 16);
  assert.equal(word(f.data, 0xb7), 2);
});
test('Original8691 current-actor881C performs its own audio and mixed-bank AD92 return; wrong late wait is atomic', () => {
  const f = task8E36Fixture({ flags: 0xa000, timer: 1 }),
    audio = taskAudioFixture(0x80c46e, { sound: 12, voice: 7 }),
    render = ad92Fixture({ flags: [], last: 65534, writeWindows: [[0x7e0000, 0x7fffff]] });
  for (const data of [audio.data, render])
    for (const [a, v] of data.snapshot().bytes) f.data.seed(a, [v]);
  seed8E36Fixture(f, { flags: 0xa000, timer: 1 });
  f.entry = 0x808691;
  f.context = Object.freeze({ ...f.context, a: 1, x: 16, y: 65535, pc: 0x8691 });
  sampleWord(f.data, 0x800cc2, 16);
  sampleWord(f.data, 0x80c4d3, 12);
  sampleWord(f.data, 0x700, 0xf508);
  sampleWord(f.data, 0x800cc4, 0);
  f.ioObservations = freeze8E36([...randomRecords([[0x7b, 0x1a, 0]]), ...audio.ioObservations]);
  f.waitObservations = freeze8E36([{ pc: 0x81acaf, address: 0x8001f8, width: 2, value: 0 }]);
  const p = prepare8691(f);
  assert.equal(p.handled, true, JSON.stringify(p.handled ? {} : p));
  unchangedFailure(
    prepare8691,
    f,
    { waitObservations: freeze8E36([]) },
    'task_wait_observation_required',
  );
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  assert.equal(p.observationsUsed, 8);
  assert.equal(word(f.data, 0x801d65), 11);
  assert.equal(p.outputContext.programBank, 0x80);
});
