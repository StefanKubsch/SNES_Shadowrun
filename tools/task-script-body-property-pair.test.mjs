import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scriptBodySpecs } from '../proof/task/script-body-specs.mjs';
import {
  scriptBodyFixture,
  bodyWord as word,
  omitBodyBytes,
} from './task-script-body-fixtures.mjs';
import { propertyPairCases, propertyPairPCs } from './task-script-body-property-pair-fixtures.mjs';
import { bodyProbe } from './task-script-body-artifacts.mjs';
import { prepareTaskScriptBody as start } from '../proof/task/script-bodies.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { prepared, commit, unchangedFailure } from './task-native-test-support.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
import { validatePropertyPairEvidence } from './task-script-property-pair-evidence.mjs';
const s = scriptBodySpecs.find((s) => s.id === 0x3a2);
test('Whole3A2 all8 fullWORD property pairs execute both actual42 calls then own conditional three74 stores and END', async () => {
  const n = JSON.parse(await readFile('analysis/render-task-script-bodies-modal-native.json'));
  for (const v of propertyPairCases()) {
    const f = scriptBodyFixture(s, v),
      p = commit(start, f),
      on = v.first === 2226 && v.second === 2226;
    assert.equal(p.bodyComplete, true);
    assert.equal(p.resultWord, 0xbeef);
    assert.deepEqual(p.bodyPCs, propertyPairPCs(s, v));
    assert.equal(word(f.data, 0x7e3a42), on ? 5432 : v.first);
    assert.equal(word(f.data, 0x7e31f5), on ? 5432 : v.second);
    assert.equal(word(f.data, 0x7e346b), on ? 2226 : 0xabcd);
    assert.equal(p.observationsUsed, 0);
    assert.equal(p.waitObservationsUsed, 0);
    assert.equal(p.inputObservationsUsed, 0);
    const calls = p.steps.filter((n) => n.calleeEntry);
    assert.equal(calls.length, on ? 5 : 2);
    assert.ok(calls.every((n) => n.calleeReturnWord === 0xf508));
    assert.ok(calls.slice(0, 2).every((n) => n.resultPushed === true));
    assert.deepEqual(
      n.probes.find((p) => p.script_id === s.id && p.case === v.name),
      bodyProbe(s, v),
    );
  }
});
test('3A2 first false never short-circuits second getter/high; late budgets and fresh changed property keep whole plan atomic', () => {
  const idle = scriptBodyFixture(s, propertyPairCases()[2]),
    missing = omitBodyBytes(idle, 0x7e31f6),
    before = missing.data.snapshot();
  assert.equal(start(missing).handled, false);
  assert.deepEqual(missing.data.snapshot(), before);
  const f = scriptBodyFixture(s, propertyPairCases()[0]),
    p = prepared(start, f);
  unchangedFailure(start, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(start, f, { maxOutputBytes: p.outputBytes - 1 }, 'task_output_budget_required');
  assert.equal(word(f.data, 0x7e3a42), 2226);
  assert.equal(word(f.data, 0x7e31f5), 2226);
  assert.equal(word(f.data, 0x7e346b), 0xabcd);
  sampleWord(f.data, 0x7e31f5, 0x18b2);
  const pcs = propertyPairPCs(s, { first: 2226, second: 0x18b2 }),
    q = prepared(start, { ...f, maxHandlers: pcs.length });
  assert.deepEqual(q.bodyPCs, pcs);
  assert.equal(commitTaskPlan(f.data, p).handled, false);
  assert.equal(commitTaskPlan(f.data, q).handled, true);
  assert.equal(word(f.data, 0x7e3a42), 2226);
});
test('3A2 canonical rejects cached/short-circuited/BYTE queries, partial stores, missing result/typedreturn/END and changed source ownership', async () => {
  const proof = JSON.parse(
      await readFile('analysis/render-task-script-bodies-modal.json'),
    ).proofs.find((p) => p.script_id === s.id),
    probes = JSON.parse(
      await readFile('analysis/render-task-script-bodies-modal-native.json'),
    ).probes.filter((p) => p.script_id === s.id);
  validatePropertyPairEvidence(proof, probes);
  const mutate = (fn) => {
    const copy = structuredClone(probes);
    fn(copy[0]);
    assert.throws(() => validatePropertyPairEvidence(proof, copy));
  };
  mutate((p) => p.property_pair_field_reads.pop());
  mutate((p) => p.property_pair_pointer_reads.splice(2, 1));
  mutate((p) => (p.property_pair_result_phas[0] = 255));
  mutate((p) => p.property_pair_native_calls[4].return_word++);
  mutate((p) => (p.property_pair_arguments[4].arguments[1] = 5432));
  mutate((p) => (p.byte_writes = p.byte_writes.filter(([a]) => a !== 0x7e346c)));
  mutate((p) => (p.property_pair_final[2] = 5432));
  mutate((p) => (p.body_complete = false));
  mutate((p) => (p.result_word ^= 256));
  const changed = structuredClone(proof);
  changed.property_pair_contract.query_arguments[1][0] = 0xb2;
  assert.throws(() => validatePropertyPairEvidence(changed, probes));
});
