import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scriptBodySpecs, scriptBodyNativeSources } from '../proof/task/script-body-specs.mjs';
import {
  prepareTaskScriptBody as start,
  prepareTaskScriptBodyResume as resume,
} from '../proof/task/script-bodies.mjs';
import {
  scriptBodyFixture as fixture,
  bodyCases,
  bodyWord as word,
  omitBodyBytes as omit,
} from './task-script-body-fixtures.mjs';
import {
  runWaitBodyFixture,
  resumeBodyFixture,
  waitBodyProbe,
} from './task-script-body-wait-fixtures.mjs';
import { recordLifecyclePCs } from './task-script-body-record-lifecycle-fixtures.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { bodyProbe } from './task-script-body-artifacts.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
const specs = scriptBodySpecs.filter((s) => s.recordLifecycleBody),
  freeze = (xs) => Object.freeze(xs.map(Object.freeze));
for (const s of specs) {
  test(`Whole original${s.id.toString(16)}: every actual edge to END, own record writes, full native calls and separately committed readiness phases`, async () => {
    const report = JSON.parse(
        await readFile('analysis/render-task-script-bodies-record-lifecycle-native.json'),
      ),
      edges = new Set();
    for (const v of bodyCases(s)) {
      const { fixture: f, plan: p, segments } = runWaitBodyFixture(s, v);
      assert.equal(p.bodyComplete, true);
      assert.equal(p.fullTaskBinding, false);
      assert.equal(p.returnTarget, 0x80c20b);
      assert.deepEqual(p.bodyPCs, recordLifecyclePCs(s, v));
      assert.equal(p.resultWord, s.id === 0x35d ? 0x56 : 0xbeef);
      for (let n = 1; n < p.bodyPCs.length; n++) edges.add(p.bodyPCs[n - 1] + ':' + p.bodyPCs[n]);
      for (const call of p.steps.filter((p) => p.calleeEntry && p.id !== 0x9f)) {
        assert.equal(call.calleeReturnWord, 0xf508);
        assert.equal(call.calleeReturnTarget, 0x80f509);
      }
      if (s.id === 0x224) {
        assert.equal(word(f.data, 0x801198 + 16), 7);
        assert.equal(word(f.data, 0x801350 + 16), 65535);
        assert.deepEqual(
          p.steps.filter((p) => p.id === 0x6a).map((p) => p.wordPops),
          [2, 2],
        );
        assert.equal(p.observedReadinessEntries, 410);
      }
      if (s.id === 0x25b) {
        assert.equal(word(f.data, 0x7e4001), 0xab00 | (v.flag & 2 ? v.flag : v.flag | 2));
        assert.equal(word(f.data, 0x7e3c0d), v.flag & 2 ? 0 : 0xcaff);
        const c8 = p.steps.find((p) => p.calleeEntry === 0x80fec1);
        assert.equal(c8.arguments.wordPops, 7);
        assert.equal(c8.callee.text.characters, v.flag & 2 ? 34 : v.text === 530 ? 21 : 34);
        assert.equal(p.observedReadinessEntries, 1);
        assert.equal(segments[0].inputObservationsUsed, 1);
        assert.equal(segments.at(-1).inputObservationsUsed, 0);
      }
      if (s.id === 0x2c6) {
        assert.equal(word(f.data, 0x7e4001), 0xab00 | (v.flag & 1 ? v.flag : v.flag | 1));
        if (!(v.flag & 1)) {
          assert.equal(word(f.data, 0x801458 + 16), 0xbeaf);
          assert.equal(word(f.data, 0x800d20 + 16), 0xfffe);
          assert.equal(word(f.data, 0x800d78 + 16), 0xfffb);
          assert.equal(word(f.data, 0x800dd0 + 16), 0);
          assert.equal(p.observedReadinessEntries, 61);
        } else assert.equal(p.observedReadinessEntries, undefined);
      }
      if (s.id === 0x35d) {
        assert.equal(word(f.data, 0x7e4003), 0x1538);
        assert.equal(p.observedReadinessEntries, 15);
        assert.equal(word(f.data, 0x614), ((v.localHigh ?? 0xa5) << 8) | 0x56);
        const a9 = p.steps.find((p) => p.calleeEntry === 0x80a835);
        assert.equal(a9.wordPops, 5);
        assert.equal(a9.resultPushed, true);
        // Original callback144 has an allocated frame; its body is never visited.
        assert.equal(word(f.data, word(f.data, 0x800256)), 0x9a55);
      }
      if (s.id === 0x3a6) {
        assert.equal(word(f.data, 0x7e4003), 0x1538);
        assert.equal(word(f.data, 0x7e3c0d), 3000);
        const c8 = p.steps.find((p) => p.calleeEntry === 0x80fec1);
        assert.equal(c8.arguments.wordPops, 7);
        assert.equal(c8.callee.text.characters, 12);
        assert.equal(p.observedReadinessEntries, 1);
        assert.equal(segments[0].observationsUsed, 0);
        assert.equal(segments.at(-1).observationsUsed, 2);
      }
      assert.deepEqual(
        report.probes.find((p) => p.script_id === s.id && p.case === v.name),
        waitBodyProbe(s, v),
      );
    }
    assert.deepEqual([...edges].sort(), s.edges.map((e) => e.from + ':' + e.to).sort());
  });
  test(`Original${s.id.toString(16)}: every own header/body/END/ROM-WORD high, Native metadata high, exact budget and first handler limit are atomic`, () => {
    const f = fixture(s, bodyCases(s)[0]),
      p = prepared(start, f);
    for (let n = 0; n < s.bytecode.length + 3; n++)
      unchangedFailure(start, omit(f, s.scriptEntry + n), {}, 'render_source_required');
    for (const r of s.romReads)
      unchangedFailure(start, omit(f, r.address + 1), {}, 'render_source_required');
    for (const id of new Set(
      p.bodyPCs
        .map((pc) => s.instructions.find((i) => i.pc === pc))
        .filter((i) => i.opcode === 0x58)
        .map((i) => i.operand),
    ))
      for (const a of scriptBodyNativeSources.find((n) => n.id === id).anchors)
        unchangedFailure(start, omit(f, a.address + 1), {}, 'render_source_required');
    prepared(start, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
    unchangedFailure(start, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
    unchangedFailure(
      start,
      f,
      { maxOutputBytes: p.outputBytes - 1 },
      'task_output_budget_required',
    );
    unchangedFailure(
      start,
      f,
      { maxHandlers: f.maxHandlers - 1 },
      'task_script_body_handler_count_required',
    );
  });
}
test('Original25B: whole C8/A3 chronology and reset boundary withhold preceding record/counter/text writes', () => {
  const s = specs.find((s) => s.id === 0x25b),
    f = fixture(s, bodyCases(s)[0]);
  for (let n = 0; n < f.ioObservations.length; n++)
    unchangedFailure(
      start,
      f,
      { ioObservations: freeze(f.ioObservations.filter((_, i) => n !== i)) },
      'task_io_observation_required',
    );
  for (let n = 0; n < f.waitObservations.length; n++)
    unchangedFailure(
      start,
      f,
      { waitObservations: freeze(f.waitObservations.filter((_, i) => n !== i)) },
      'task_wait_observation_required',
    );
  unchangedFailure(start, f, { inputObservations: freeze([]) }, 'task_input_observation_required');
  unchangedFailure(
    start,
    f,
    { inputObservations: freeze([...f.inputObservations, ...f.inputObservations]) },
    'task_input_observation_unused',
  );
  unchangedFailure(
    start,
    f,
    { waitObservations: freeze([f.waitObservations.at(-1), ...f.waitObservations.slice(0, -1)]) },
    'task_wait_observation_required',
  );
  unchangedFailure(
    start,
    f,
    { inputObservations: freeze([{ ...f.inputObservations[0], value: 0x3030 }]) },
    'task_reset_source_required',
  );
});
test('Original3A6: first yield is incomplete, late C5 destination/source/END faults preserve the committed first phase', () => {
  const s = specs.find((s) => s.id === 0x3a6),
    f = fixture(s, bodyCases(s)[0]),
    p = prepared(start, f);
  assert.equal(p.bodyComplete, false);
  assert.equal(p.bodySuspended, true);
  unchangedFailure(
    resume,
    resumeBodyFixture(s, f, p),
    {},
    'task_script_body_continuation_required',
  );
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  f.data.seed(0x800c64, [16, 0]);
  const next = resumeBodyFixture(s, f, p),
    q = prepared(resume, next);
  assert.equal(q.bodyComplete, true);
  unchangedFailure(
    resume,
    next,
    { protectedStackBytes: [...next.protectedStackBytes, 0x7e4004] },
    'task_stack_alias_required',
  );
  unchangedFailure(resume, next, { maxWork: q.work - 1 }, 'task_work_budget_required');
  unchangedFailure(
    resume,
    next,
    { maxOutputBytes: q.outputBytes - 1 },
    'task_output_budget_required',
  );
  unchangedFailure(
    resume,
    next,
    { continuation: { ...p } },
    'task_script_body_continuation_required',
  );
  const high = scriptBodyNativeSources.find((s) => s.id === 0xc5).anchors[0],
    value = high.bytes[1];
  f.data.seed(high.address + 1, [value ^ 1]);
  unchangedFailure(resume, next, {}, 'task_script_body_bytes_required');
  f.data.seed(high.address + 1, [value]);
  f.data.seed(s.scriptEntry + 2 + s.bytecode.length, [s.fetchTail ^ 1]);
  unchangedFailure(resume, next, {}, 'task_script_body_bytes_required');
});
test('Original25B: an unproved actual text index rejects after earlier private writes rather than reusing a cached original text', () => {
  const s = specs.find((s) => s.id === 0x25b),
    f = fixture(s, { flag: 0, args: [16, 1, 0xffff, 2] });
  const p = start(f);
  assert.equal(p.handled, false);
  assert.equal(p.reason, 'task_script_body_ROM_read_required');
  assert.equal(word(f.data, 0x7e4001), 0xab00);
});
