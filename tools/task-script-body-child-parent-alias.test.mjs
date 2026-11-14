import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { childParentAliasBodySpecs as specs } from '../proof/task/script-body-child-parent-alias-specs.mjs';
import { scriptBodySpecs } from '../proof/task/script-body-specs.mjs';
import {
  parentAliasCases,
  parentAliasReward,
  parentAliasSelector,
} from './task-script-body-child-parent-alias-fixtures.mjs';
import { parentWaitPCs } from './task-script-body-child-parent-wait-fixtures.mjs';
import {
  scriptBodyFixture,
  bodyWord as word,
  omitBodyBytes as omit,
} from './task-script-body-fixtures.mjs';
import {
  runChildFixture,
  childBodyProbe,
  childNextOptions,
} from './task-script-body-child-fixtures.mjs';
import {
  prepareTaskScriptBody as start,
  prepareTaskScriptBodyParentPostrun as post,
  prepareTaskScriptBodyResume as resume,
} from '../proof/task/script-bodies.mjs';
import { prepared, commit, unchangedFailure } from './task-native-test-support.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
import { menuRecords } from './task-native-menu-fixtures.mjs';
import { validateChildBodyEvidence } from './progress.mjs';
import { proveScriptBody } from './task-script-body-source.mjs';
import { inspectRom, cpuToOffset } from './rom.mjs';
for (const s of specs)
  test(`Whole${s.id.toString(16)} preserves repeated equality1 and reaches second reward through actual parent/text/allocated child/local stack alias`, async () => {
    const native = JSON.parse(
      await readFile('analysis/render-task-script-bodies-child-native.json'),
    );
    for (const v of parentAliasCases()) {
      const { fixture: f, plan: p, segments } = runChildFixture(s, v),
        probe = childBodyProbe(s, v),
        prefix = segments.find((p) => p.scriptChildSuspended),
        reward = parentAliasReward(s, v),
        sum = v.low + reward,
        carry = sum > 65535,
        saturated = carry && v.high === 65535;
      assert.equal(p.bodyComplete, true);
      assert.equal(p.resultWord, 0xbeef);
      assert.deepEqual(p.bodyPCs, parentWaitPCs(s, v));
      assert.equal(segments.length, v.blocked ? 14 : 13);
      assert.equal(p.childCompletion, v.heap - 35);
      assert.equal(p.childPostrun.continuationTarget, 0x80f495);
      assert.equal(word(f.data, 0x7e3c0d), saturated ? 65535 : sum & 65535);
      assert.equal(word(f.data, 0x7e3c0f), saturated ? 65535 : (v.high + Number(carry)) & 65535);
      assert.equal(prefix.steps.at(-2).callee.text.glyphs, v.alias ? 69 : 10);
      assert.equal(prefix.observationsUsed, 2);
      assert.equal(prefix.waitObservationsUsed, 10);
      assert.deepEqual(
        probe.child_segments.find((p) => p.script_child_suspended).parent_native_arguments,
        [
          {
            id: 0xc8,
            arguments: [v.alias ? 0 : 2, 21, 10, 3, 2048, parentAliasSelector(s, v), 180],
          },
        ],
      );
      assert.equal(p.outputContext.s, 0xb01);
      assert.equal(word(f.data, 0xb06), 0x91d0);
      if (v.alias) {
        assert.equal(word(f.data, 0x614), 1);
        assert.equal(word(f.data, 0x616), 8);
        assert.equal(f.data.readByte(0x613).value, 8);
        assert.deepEqual(probe.child_segments.at(-1).parent_equalities.slice(-2), [
          { pc: 105, left: 180, right: 1, result: 0 },
          { pc: 120, left: 1, right: 1, result: 65535 },
        ]);
        assert.equal(word(f.data, 0x7e1040), 65535);
        assert.equal(word(f.data, 0x7e4038), 128);
        assert.equal(word(f.data, 0x7e3f30), 65535);
      } else assert.ok(!p.bodyPCs.includes(124));
      assert.deepEqual(
        native.probes.find((p) => p.script_id === s.id && p.case === v.name),
        probe,
      );
    }
  });
test('Alias parent source preserves individual ROM headers and both literal equality1 instructions', async () => {
  const { bytes } = inspectRom(await readFile('Shadowrun (E).smc'));
  for (const descriptor of specs) {
    const s = scriptBodySpecs.find((s) => s.id === descriptor.id),
      proof = await proveScriptBody(bytes, s);
    assert.deepEqual(proof.child_parent_alias_contract.repeated_comparison, [1, 1, 2]);
    for (const pc of [103, 118]) {
      const changed = Buffer.from(bytes);
      changed[cpuToOffset(s.scriptEntry + pc + 3, bytes.length)] = 0;
      await assert.rejects(() => proveScriptBody(changed, s));
    }
    await assert.rejects(() => proveScriptBody(bytes, { ...s, parentWaitAliasChild: false }));
  }
});
test('Alias text sources and own field0 geometry stay fresh; missing observations/budgets and stale commits leave current segment unchanged', () => {
  const s = specs[0],
    f = scriptBodyFixture(s, parentAliasCases()[28]);
  let p = commit(start, f);
  p = commit(post, childNextOptions(s, f, p));
  p = commit(resume, childNextOptions(s, f, p));
  p = commit(post, childNextOptions(s, f, p));
  sampleWord(f.data, 0x800c64, 16);
  const next = childNextOptions(s, f, p),
    q = prepared(resume, next);
  assert.equal(q.scriptChildSuspended, true);
  const missing = omit(scriptBodyFixture(s, parentAliasCases()[28]), 0x7e2020);
  let m = commit(start, missing);
  m = commit(post, childNextOptions(s, missing, m));
  m = commit(resume, childNextOptions(s, missing, m));
  m = commit(post, childNextOptions(s, missing, m));
  sampleWord(missing.data, 0x800c64, 16);
  unchangedFailure(resume, childNextOptions(s, missing, m), {}, 'render_source_required');
  unchangedFailure(
    resume,
    next,
    { ioObservations: menuRecords([]) },
    'task_io_observation_required',
  );
  unchangedFailure(
    resume,
    next,
    { waitObservations: menuRecords([]) },
    'task_wait_observation_required',
  );
  unchangedFailure(resume, next, { maxWork: q.work - 1 }, 'task_work_budget_required');
  assert.equal(word(f.data, 0x8003d2), 0x800);
  assert.equal(word(f.data, 0x614), 16);
  const old = f.data.readByte(0x7e2020).value;
  f.data.seed(0x7e2020, [old ^ 1]);
  assert.equal(commitTaskPlan(f.data, q).handled, false);
  f.data.seed(0x7e2020, [old]);
  const fresh = prepared(resume, next);
  assert.equal(commitTaskPlan(f.data, fresh).handled, true);
  assert.equal(word(f.data, 0x616), 180);
  assert.equal(f.data.readByte(0x613).value, 8);
});
test('Alias canonical rejects invented unreachable second branch, stale local reads, saved-ID-high/text pops and isolated phase/physical evidence drift', async () => {
  const source = JSON.parse(await readFile('analysis/render-task-script-bodies-child.json')),
    native = JSON.parse(await readFile('analysis/render-task-script-bodies-child-native.json')),
    child = JSON.parse(
      await readFile('analysis/render-task-script-bodies-audio-wait.json'),
    ).proofs.find((p) => p.script_id === 0x4b);
  for (const s of specs) {
    const proof = source.proofs.find((p) => p.script_id === s.id),
      probes = native.probes.filter((p) => p.script_id === s.id);
    validateChildBodyEvidence(proof, probes, child);
    const mutation = (change) => {
      const copy = structuredClone(probes);
      change(copy.find((p) => p.parent_alias));
      assert.throws(() => validateChildBodyEvidence(proof, copy, child));
    };
    mutation((p) => (p.parent_alias = false));
    mutation((p) => (p.parent_initial_operand_s = 0x7ff));
    mutation((p) => (p.child_segments[0].parent_operand_s_read[0] = 0x7ff));
    mutation(
      (p) => p.child_segments[0].parent_alias_writes.find((r) => r[2] === 'local-BYTE')[1]++,
    );
    mutation(
      (p) =>
        (p.child_segments
          .find((p) => p.script_child_suspended)
          .parent_alias_writes.find((r) => r[0] === 0x7e060a && r[1] === 2)[1] = 0),
    );
    mutation(
      (p) =>
        (p.child_segments.find(
          (p) => p.script_child_suspended,
        ).parent_native_arguments[0].arguments[0] = 2),
    );
    mutation((p) => (p.child_segments.at(-1).parent_equalities.at(-1).left = 180));
    mutation((p) => p.child_segments.at(-1).parent_native_arguments[0].arguments[0]++);
    mutation((p) => (p.parent_final_local_byte = 16));
    mutation((p) => p.child_header_result++);
    assert.throws(
      () =>
        validateChildBodyEvidence(
          proof,
          probes.filter((p) => !p.parent_alias),
          child,
        ),
      /edge/,
    );
    const altered = structuredClone(proof);
    altered.child_parent_alias_contract.repeated_comparison[0] = 0;
    assert.throws(() => validateChildBodyEvidence(altered, probes, child));
  }
});
