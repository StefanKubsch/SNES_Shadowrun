import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTaskNativeOpcodeC46E as prepare } from '../proof/task/native-audio-opcode.mjs';
import { prepareTaskNativeAudioCompose as audio } from '../proof/task/native-audio-compose.mjs';
import { prepareTaskNativeArguments } from '../proof/task/native-arguments.mjs';
import { prepareTaskNativeBridge } from '../proof/task/native-bridge.mjs';
import { prepareTaskNativeResume } from '../proof/task/native-resume.mjs';
import { taskNativeAudioOpcodeFixture as fixture } from './task-native-audio-opcode-fixtures.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
const freeze = (values) => Object.freeze(values.map((r) => Object.freeze(r)));
const word = (p, address) => {
  const map = new Map(p.byteWrites);
  return map.get(address) | (map.get(address + 1) << 8);
};

test('Original Native58/4C: whole low/high/cache audio and genuine four pops/actual F508/F509/no result PHA; separate observed plans reproduce one owner', () => {
  for (const sound of [45, 0x8007])
    for (const cachedSound of [0, sound])
      for (const cachedVoice of [0, 3])
        for (const token of [0, 254, 255]) {
          const inputs = { sound, cachedSound, cachedVoice, token },
            f = fixture(inputs),
            p = prepared(prepare, f);
          assert.equal(p.arguments.wordPops, 4);
          assert.equal(p.arguments.metadataWord, 0x0104);
          assert.equal(p.arguments.id, 0x4c);
          assert.equal(p.arguments.freshId, 0x4c);
          assert.equal(p.callee.sound, sound);
          assert.equal(p.callee.loaderUsed, sound >= 32768 && cachedSound !== sound);
          assert.equal(p.callee.voiceCacheHit, cachedVoice === 3);
          assert.equal(p.calleeEntry, 0x80c46e);
          assert.equal(p.calleeReturnWord, 0xf508);
          assert.equal(p.calleeReturnTarget, 0x80f509);
          assert.equal(p.metadataWord, 0);
          assert.equal(p.resultPushed, false);
          assert.equal(p.outputContext.s, 0x3f8);
          assert.equal(p.outputContext.d, 0x1000);
          assert.equal(p.outputContext.bank, 0x80);
          assert.equal(p.frontier, '80:F390');
          assert.equal(word(p, 0x7e1003), 5);
          assert.equal(word(p, 0x7e1007), 0x3f8);
          assert.equal(word(p, 0x7e1009), 0x4c);
          assert.equal(
            p.accesses.some((r) => r.label === 'resume-result-PHA-low'),
            false,
          );
          assert.equal(commitTaskPlan(f.data, p).handled, true);
          assert.equal(f.data.readByte(0x700).value, 0x0a);
          assert.equal(f.data.readByte(0x701).value, 0xc2);
          const g = fixture(inputs),
            prefix = prepared(prepareTaskNativeArguments, {
              ...g,
              ioMode: null,
              ioObservations: null,
              entry: 0x80f4cb,
              context: Object.freeze({ ...g.context, pc: 0xf4cb }),
            });
          assert.equal(commitTaskPlan(g.data, prefix).handled, true);
          const bridge = prepared(prepareTaskNativeBridge, {
            ...g,
            ioMode: null,
            ioObservations: null,
            entry: 0x80f4f6,
            context: prefix.outputContext,
          });
          assert.equal(commitTaskPlan(g.data, bridge).handled, true);
          const callee = prepared(audio, {
            ...g,
            entry: 0x80c46e,
            protectedStackBytes: [0x7e06fe, 0x7e06ff],
            context: Object.freeze({ ...bridge.outputContext, pc: 0xc46e }),
          });
          assert.equal(commitTaskPlan(g.data, callee).handled, true);
          const resume = prepared(prepareTaskNativeResume, {
            ...g,
            ioMode: null,
            ioObservations: null,
            entry: 0x80f509,
            context: callee.outputContext,
          });
          assert.deepEqual(resume.outputContext, p.outputContext);
          assert.equal(p.work, prefix.work + bridge.work + callee.work + resume.work + 4);
        }
});
test('Original4C: full-X and both original metadata bytes, actual bridge A2 stores and fresh saved-ID after audio writes reject atomically', () => {
  const f = fixture();
  unchangedFailure(
    prepare,
    f,
    { context: Object.freeze({ ...f.context, x: 0xff58 }) },
    'task_native4c_opcode_required',
  );
  for (const [address, value, reason] of [
    [0x80f30c, 0xf398, 'task_opcode_target_required'],
    [0x801204, 0x144d, 'task_native4c_argument_source_required'],
    [0x82da98, 0, 'task_native4c_argument_source_required'],
    [0x82da98, 4, 'task_native4c_argument_source_required'],
    [0x82d850, 0xc46f, 'task_native4c_target_required'],
    [0x82d9bc, 1, 'task_native4c_return_source_required'],
    [0x82d9bc, 0x100, 'task_native4c_return_source_required'],
  ]) {
    const g = fixture();
    sampleWord(g.data, address, value);
    if (address === 0x801204) sampleWord(g.data, 0x82da99, 0);
    unchangedFailure(prepare, g, {}, reason);
  }
  const alias = unchangedFailure(
    prepare,
    fixture({ s: 0xa3 }),
    {},
    'task_native4c_target_required',
  );
  assert.equal(alias.tablePointerWord, 0xc46e);
  assert.equal(alias.pointerWord, 0xf508);
  const g = fixture({ frame: 0x1cd9 });
  const changed = unchangedFailure(prepare, g, {}, 'task_native_resume_id_required');
  assert.equal(changed.expectedNativeId, 0x4c);
  assert.equal(changed.nativeId, 3);
});
test('Whole4C: global frozen ordered APU/product samples and cumulative budgets, missing highs and late source failures publish no effects', () => {
  const f = fixture({ sound: 0x8007 }),
    p = prepared(prepare, f);
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
    { ioObservations: freeze(f.ioObservations.slice(0, -1)) },
    'task_io_observation_required',
  );
  unchangedFailure(
    prepare,
    f,
    { ioObservations: freeze([...f.ioObservations, f.ioObservations.at(-1)]) },
    'task_io_observation_unused',
  );
  for (const changed of [{ width: 2 }, { pc: 0x80c45a }, { address: 0x002140 }]) {
    const records = f.ioObservations.map((r, n) => (n === 0 ? { ...r, ...changed } : r));
    unchangedFailure(
      prepare,
      f,
      { ioObservations: freeze(records) },
      'task_io_observation_required',
    );
  }
  unchangedFailure(
    prepare,
    f,
    { ioObservations: Object.freeze(Array(1)) },
    'task_io_observations_required',
  );
  for (const omit of [
    0x80f30d, 0x801205, 0x82da99, 0x82d851, 0x82d9bd, 0x7e0263, 0x7e1002, 0x801206, 0x7e03f8,
    0x80c500,
  ])
    unchangedFailure(prepare, fixture({ omit, sound: 0x8007 }), {}, 'render_source_required');
  unchangedFailure(
    prepare,
    f,
    { protectedStackBytes: [0x7e0700, 0x7e0702] },
    'task_outer_return_required',
  );
  unchangedFailure(prepare, fixture({ writeWindows: [] }), {}, 'render_write_window_required');
  assert.equal(commitTaskPlan(fixture().data, p).reason, 'task_plan_owner_required');
  assert.equal(commitTaskPlan(f.data, { ...p }).reason, 'task_plan_owner_required');
  f.data.seed(0, [1]);
  const before = f.data.snapshot();
  assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
  assert.deepEqual(f.data.snapshot(), before);
});
test('Whole4C: actual forced PHK bank and separate script/workspace owners; real positive-entity pan sources stay fresh', () => {
  for (const frame of [0x1000, 0x1100, 0x1800])
    for (const scriptBank of [0x80, 0x83, 0x7f]) {
      const f = fixture({ frame, scriptBank }),
        p = prepared(prepare, f);
      assert.equal(p.outputContext.d, frame);
      assert.equal(p.outputContext.bank, scriptBank);
      assert.equal(p.outputContext.s, 0x3f8);
      assert.equal(p.calleeReturnTarget, 0x80f509);
      assert.equal(
        p.ioRequests.every((r) => r.address >>> 16 === 0x80),
        true,
      );
    }
  const physical = fixture({ scriptBank: 0x7f, soundIndex: 0x12, pan: 0xabcd, voice: 255 });
  sampleWord(physical.data, 6, 3);
  const q = prepared(prepare, physical);
  assert.equal(word(q, 0x7f0002), 0x12);
  assert.equal(word(q, 0x7f0004), 0xabcd);
  assert.equal(q.callee.sound, 45);
  assert.equal(q.callee.voice, 3); // Native uses actual DP00/7E, no bankcopy.
  const f = fixture({ entity: 1, pan: 0x80 });
  for (const [address, value] of [
    [0x800e81, 0x1000],
    [0x800e29, 0],
    [0x800cc4, 0],
  ])
    sampleWord(f.data, address, value);
  const p = prepared(prepare, f);
  assert.equal(p.callee.calls.find((r) => r.target === 0x80c416).returnTarget, 0x80c48c);
});
test('Original4C: zeroVoice consumes saved sound, and a late token store corrupts the actual C4B1 RTL; neither publishes preceding audio writes', () => {
  const zero = unchangedFailure(prepare, fixture({ voice: 0 }), {}, 'task_audio_return_required');
  assert.equal(zero.rawReturnWord, 45);
  assert.equal(zero.returnTarget, 0x80002e);
  const f = fixture({ s: 0x1ce7 });
  f.ioObservations = freeze([
    ...f.ioObservations.slice(0, 2),
    ...[45, 46, 0xc4].map((value) => ({ pc: 0x81f00e, address: 0x802140, width: 1, value })),
  ]);
  const alias = unchangedFailure(prepare, f, {}, 'task_native_helper_return_required');
  assert.equal(alias.pc, 0x80c4ae);
  assert.equal(alias.raw, 0xc5b1);
});
