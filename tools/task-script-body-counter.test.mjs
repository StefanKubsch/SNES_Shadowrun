import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scriptBodySpecs, scriptBodyNativeSources } from '../proof/task/script-body-specs.mjs';
import { prepareTaskScriptBody as prepare } from '../proof/task/script-bodies.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import {
  scriptBodyFixture as fixture,
  bodyCases,
  bodyWord as word,
  omitBodyBytes as omit,
} from './task-script-body-fixtures.mjs';
import { counterBodyPCs } from './task-script-body-counter-fixtures.mjs';
import { bodyProbe } from './task-script-body-artifacts.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
const specs = scriptBodySpecs.filter((s) => s.counterBody && !s.eventCounterBody),
  at = (id) => specs.find((s) => s.id === id);
for (const s of specs)
  test(`Original${s.id.toString(16)} whole END: all field/CMP/branch paths, actual WORD stores and BYTE high preservation, genuine native callers`, async () => {
    const report = JSON.parse(
        await readFile('analysis/render-task-script-bodies-counter-native.json'),
      ),
      edges = new Set();
    for (const v of bodyCases(s)) {
      const f = fixture(s, v),
        p = prepared(prepare, f),
        active = s.id === 0x171 || !!(v.flag & 1),
        value = s.id === 0x171 ? 8 : 2;
      assert.equal(p.bodyComplete, true);
      assert.equal(p.fullTaskBinding, false);
      assert.deepEqual(p.bodyPCs, counterBodyPCs(s, v));
      assert.equal(p.handlersExecuted, p.bodyPCs.length);
      assert.equal(p.returnTarget, 0x80c20b);
      assert.equal(p.resultWord, 0xbeef);
      assert.equal(p.outputContext.s, 0xb01);
      assert.equal(p.outputContext.d, 0);
      assert.equal(p.outputContext.bank, 0x82);
      assert.equal(p.steps.filter((p) => p.calleeEntry === 0x80cca4).length, Number(active));
      for (const call of p.steps.filter((p) => p.calleeEntry)) {
        assert.equal(call.calleeReturnWord, 0xf508);
        assert.equal(call.calleeReturnTarget, 0x80f509);
      }
      assert.deepEqual(
        report.probes.find((p) => p.script_id === s.id && p.case === v.name),
        bodyProbe(s, v),
      );
      for (let n = 1; n < p.bodyPCs.length; n++) edges.add(p.bodyPCs[n - 1] + ':' + p.bodyPCs[n]);
      assert.equal(commitTaskPlan(f.data, p).handled, true);
      assert.equal(word(f.data, 0x7e2de4), active ? Math.max(v.previous, value) : v.previous);
      if (active) {
        assert.equal(word(f.data, 0x801ce9), s.id === 0x171 ? 0x8001 : 0x8000);
        assert.equal(word(f.data, 0x801ceb), 0);
        assert.equal(word(f.data, 0x7e2de2), s.id === 0x171 ? 122 : 149);
      }
      if (s.id === 0x150) {
        assert.equal(word(f.data, 0x7e318a), v.flag);
        for (const [a, old] of [
          [0x7e31b2, 0xab21],
          [0x7e31b7, 0xab42],
          [0x7e31bc, 0xab04],
        ])
          assert.equal(word(f.data, a), active ? old | 128 : old);
      }
    }
    assert.deepEqual([...edges].sort(), s.edges.map((e) => e.from + ':' + e.to).sort());
  });
test('Original150/171: each byte/header/END ignored high, ROM pointer high and every reached original native metadata high is mandatory atomically', () => {
  for (const s of specs) {
    const f = fixture(s, { flag: 1 }),
      p = prepared(prepare, f);
    for (let n = 0; n < s.bytecode.length + 3; n++)
      unchangedFailure(prepare, omit(f, s.scriptEntry + n), {}, 'render_source_required');
    for (const r of s.romReads)
      unchangedFailure(prepare, omit(f, r.address + 1), {}, 'render_source_required');
    for (const id of new Set(s.instructions.filter((i) => i.opcode === 0x58).map((i) => i.operand)))
      for (const a of scriptBodyNativeSources.find((n) => n.id === id).anchors)
        unchangedFailure(prepare, omit(f, a.address + 1), {}, 'render_source_required');
    prepared(prepare, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
    unchangedFailure(prepare, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
    unchangedFailure(
      prepare,
      f,
      { maxOutputBytes: p.outputBytes - 1 },
      'task_output_budget_required',
    );
    unchangedFailure(
      prepare,
      f,
      { maxHandlers: f.maxHandlers - 1 },
      'task_script_body_handler_count_required',
    );
  }
});
test('Original150: field-reader BB consumes its full WORD before low mask; three 0D BYTE writers retain high bytes and missing late inputs withhold DB and preceding effects', () => {
  const s = at(0x150),
    f = fixture(s, { flag: 1 });
  for (const a of [0x7e318b, 0x7e31b2, 0x7e31b7, 0x7e31bc])
    unchangedFailure(prepare, omit(f, a), {}, 'render_source_required');
  const p = prepared(prepare, f);
  for (const a of [0x7e31b3, 0x7e31b8, 0x7e31bd])
    assert.equal(
      p.accesses.some((r) => r.kind === 'write' && r.address === a),
      false,
    );
  const g = fixture(s, { flag: 256 }),
    q = prepared(prepare, g);
  assert.deepEqual(q.bodyPCs, [0, 3, 5, 7, 8, 9, 45]);
  assert.equal(
    q.steps.some((s) => s.calleeEntry === 0x80cca4),
    false,
  );
});
test('Original171: actual late state-store/frame-bank/PC alias is rejected before END and exposes none of DB or state effects', () => {
  const s = at(0x171),
    f = fixture(s),
    frame = 0x1ce7;
  sampleWord(f.data, frame, 0xf780);
  sampleWord(f.data, frame + 1, 0x82f7);
  sampleWord(f.data, frame + 3, 0);
  sampleWord(f.data, frame + 7, 0x7ff);
  sampleWord(f.data, frame + 9, s.id);
  sampleWord(f.data, 0x800254, frame);
  f.context = Object.freeze({ ...f.context, d: frame });
  const boundary = unchangedFailure(prepare, f, {}, 'render_source_required');
  assert.equal(boundary.address, 0x81f800);
  sampleWord(f.data, 0x81f800, 0x0056);
  unchangedFailure(prepare, f, {}, 'task_script_body_edge_required');
});
