import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { recordAndBodySpecs } from '../proof/task/script-body-record-and-specs.mjs';
import {
  recordAndCases,
  recordAndActive,
  recordAndPCs,
} from './task-script-body-record-and-fixtures.mjs';
import {
  scriptBodyFixture,
  bodyWord as word,
  omitBodyBytes,
} from './task-script-body-fixtures.mjs';
import {
  runWaitBodyFixture,
  waitBodyProbe,
  resumeBodyFixture,
} from './task-script-body-wait-fixtures.mjs';
import {
  prepareTaskScriptBody as start,
  prepareTaskScriptBodyResume as resume,
} from '../proof/task/script-bodies.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { commit, prepared, unchangedFailure } from './task-native-test-support.mjs';
import { menuRecords } from './task-native-menu-fixtures.mjs';
import { validateRecordAndEvidence } from './task-script-record-and-evidence.mjs';
const s = recordAndBodySpecs[0],
  active = recordAndCases()[3];
test('Whole1A5 all21 original gate paths retain full caller/flag reads, BYTE OR/AND, propertyWORD/audio, real60 visits and own5B/END', async () => {
  const n = JSON.parse(await readFile('analysis/render-task-script-bodies-record-and-native.json'));
  for (const v of recordAndCases()) {
    const { fixture: f, plan: p, segments, observations } = runWaitBodyFixture(s, v),
      on = recordAndActive(v);
    assert.equal(p.bodyComplete, true);
    assert.deepEqual(p.bodyPCs, recordAndPCs(s, v));
    assert.equal(p.resultWord, 0xbeef);
    assert.equal(segments.length, on ? 61 : 1);
    assert.equal(p.observedReadinessEntries ?? 0, on ? 60 : 0);
    assert.equal(observations.filter((o) => o.kind === 'synthetic-provider-event-byte').length, 0);
    assert.equal(word(f.data, 0x7e3a9a), (v.flagHigh << 8) | (on ? (v.flag | 128) & 254 : v.flag));
    assert.equal(word(f.data, 0x7e346b), on ? 5432 : 0xabcd);
    assert.equal(word(f.data, 0x801350 + (v.input & 255)), 65535);
    if (on) {
      assert.equal(segments[0].bodyComplete, false);
      assert.equal(segments[0].bodySuspended, true);
      assert.deepEqual(
        segments
          .slice(1)
          .map(
            (p) =>
              p.accesses.find(
                (a) =>
                  a.kind === 'write' && a.address === 0x800c04 && a.label === 'visit-DBR-WORD-low',
              ).value,
          ),
        Array.from({ length: 60 }, (_, n) => 59 - n),
      );
    }
    assert.deepEqual(
      n.probes.find((p) => p.case === v.name),
      waitBodyProbe(s, v),
    );
  }
});
test('1A5 late audio/provider/budget failures withhold earlier property and BYTE stores; inactive branch requires no audio', () => {
  const f = scriptBodyFixture(s, active),
    p = prepared(start, f);
  unchangedFailure(start, f, { ioObservations: menuRecords([]) }, 'task_io_observation_required');
  unchangedFailure(start, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(start, f, { maxOutputBytes: p.outputBytes - 1 }, 'task_output_budget_required');
  const missing = omitBodyBytes(f, 0x7e3a9b),
    before = missing.data.snapshot();
  assert.equal(start(missing).handled, false);
  assert.deepEqual(missing.data.snapshot(), before);
  assert.equal(word(f.data, 0x7e346b), 0xabcd);
  assert.equal(word(f.data, 0x7e3a9a), active.flag | (active.flagHigh << 8));
  const idle = scriptBodyFixture(s, recordAndCases()[0]);
  assert.equal(idle.ioObservations.length, 0);
  assert.equal(prepared(start, idle).bodyComplete, true);
});
test('1A5 actual59 blocked entries then readiness refetches local caller; late budget leaves committed prefix, stale plan fails', () => {
  const f = scriptBodyFixture(s, active);
  let p = commit(start, f);
  for (let n = 0; n < 59; n++) {
    p = commit(resume, resumeBodyFixture(s, f, p));
    assert.equal(p.segmentHandlers, 0);
    assert.equal(word(f.data, 0x800c04), 59 - n);
  }
  const next = resumeBodyFixture(s, f, p),
    q = prepared(resume, next);
  assert.equal(q.bodyComplete, true);
  assert.equal(q.segmentHandlers, 4);
  unchangedFailure(resume, next, { maxWork: q.work - 1 }, 'task_work_budget_required');
  assert.equal(word(f.data, 0x7e346b), 5432);
  assert.equal(word(f.data, 0x800c04), 1);
  f.data.seed(0x613, [0xfe]);
  const fresh = prepared(resume, next);
  assert.equal(commitTaskPlan(f.data, q).handled, false);
  assert.equal(commitTaskPlan(f.data, fresh).handled, true);
  assert.equal(word(f.data, 0x801350 + 0xfe), 65535);
  assert.equal(word(f.data, 0x801350 + 0x10), 0xabcd);
  assert.equal(word(f.data, 0x800c04), 0);
});
test('1A5 canonical rejects prefixes, invented BB guard, cached flags, WORD masking, missing countdown/high/return/audio/END', async () => {
  const source = JSON.parse(await readFile('analysis/render-task-script-bodies-record-and.json')),
    n = JSON.parse(await readFile('analysis/render-task-script-bodies-record-and-native.json')),
    proof = source.proofs[0];
  validateRecordAndEvidence(proof, n.probes);
  const mutate = (fn) => {
    const probes = structuredClone(n.probes);
    fn(probes[3]);
    assert.throws(() => validateRecordAndEvidence(proof, probes));
  };
  mutate((p) => (p.body_complete = false));
  mutate((p) => (p.record_input_word &= 255));
  mutate((p) => (p.record_final_flag &= 255));
  mutate((p) => p.record_segments[0].pointer_reads.splice(2, 1));
  mutate((p) => (p.record_segments[0].flag_byte_reads[1][1] = 1));
  mutate((p) => (p.record_segments[0].native_arguments[3].arguments[1] = 254));
  mutate((p) => p.record_segments[0].native_calls[3].callee_return_word++);
  mutate((p) => p.record_countdown_trace.splice(0, 59));
  mutate((p) => p.record_segments[0].io_records[0].value++);
  mutate((p) => (p.result_word ^= 256));
  mutate((p) => (p.record_segments[1].result_phas[0] = 60));
  const changed = structuredClone(proof);
  changed.record_and_contract.flag_getter_null_guard = true;
  assert.throws(() => validateRecordAndEvidence(changed, n.probes));
});
