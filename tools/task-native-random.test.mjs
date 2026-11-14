import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareTaskNativeRandom as root } from '../proof/task/native-random.mjs';
import { prepareTaskNativeOpcodeC51F as caller } from '../proof/task/native-random-opcode.mjs';
import {
  taskRandomFixture as fixture,
  taskNativeRandomOpcodeFixture as opcodeFixture,
  randomRecords,
} from './task-native-random-fixtures.mjs';
import { prepared, unchangedFailure } from './task-native-test-support.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
import { bodyWord, omitBodyBytes } from './task-script-body-fixtures.mjs';
import { prepareTaskNativeArguments } from '../proof/task/native-arguments.mjs';
import { prepareTaskNativeBridge } from '../proof/task/native-bridge.mjs';
import { prepareTaskNativeResume } from '../proof/task/native-resume.mjs';
import { inspectRom, cpuToOffset } from './rom.mjs';
import {
  randomWindows,
  randomTables,
  randomAnchors,
} from './render-task-native-random-source-proof.mjs';
import { proveTaskNativeRandomOpcode } from './task-native-random-opcode-source.mjs';
test('Whole original3E: original one pop/0201/C51F/actualF508-F509/0002-resultPHA, zero/normal/retry and separate observed plans agree', () => {
  for (const options of [
    { limit: 0 },
    {},
    {
      limit: 16,
      values: [
        [123, 26, 0],
        [123, 143, 1],
      ],
    },
  ]) {
    const f = opcodeFixture(options),
      p = prepared(caller, f),
      expected = options.limit === 0 ? 0 : options.limit === 16 ? 15 : 26;
    assert.equal(p.arguments.wordPops, 1);
    assert.equal(p.arguments.metadataWord, 0x0201);
    assert.equal(p.arguments.freshId, 0x3e);
    assert.equal(p.metadataWord, 2);
    assert.equal(p.resultPushed, true);
    assert.equal(p.calleeEntry, 0x80c51f);
    assert.equal(p.calleeReturnWord, 0xf508);
    assert.equal(p.calleeReturnTarget, 0x80f509);
    assert.equal(p.outputContext.s, 0x3f0);
    assert.equal(p.outputContext.d, 0x1000);
    assert.equal(p.frontier, '80:F390');
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    assert.equal(bodyWord(f.data, 0x3f1), expected);
    assert.equal(bodyWord(f.data, 0x7e1007), 0x3f2);
    assert.equal(bodyWord(f.data, 0x700), 0xc20a);
    const g = opcodeFixture(options),
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
    const callee = prepared(root, {
      ...g,
      entry: 0x80c51f,
      context: Object.freeze({ ...bridge.outputContext, pc: 0xc51f }),
      protectedStackBytes: [0x7e06fe, 0x7e06ff],
    });
    assert.equal(commitTaskPlan(g.data, callee).handled, true);
    const resumed = prepared(prepareTaskNativeResume, {
      ...g,
      ioMode: null,
      ioObservations: null,
      entry: 0x80f509,
      context: callee.outputContext,
    });
    assert.deepEqual(resumed.outputContext, p.outputContext);
    assert.equal(p.work, prefix.work + bridge.work + callee.work + resumed.work + 4);
  }
});
test('Original C51F: full WORD bounds/masks; zero limit skips all PPU reads; repeated rejection is governed by actual observations and budget', () => {
  for (const limit of [0, 1, 2, 3, 4, 255, 256, 32767, 32768, 65535]) {
    const f = fixture(0x80c51f, { limit, mixLow: 26, values: limit ? [[123, 0, 0]] : [] }),
      p = prepared(root, f);
    assert.equal(p.zeroLimit, limit === 0);
    assert.equal(p.attempts, limit ? 1 : 0);
    assert.equal(p.observationsUsed, limit ? 3 : 0);
    assert.equal(
      p.mask,
      limit ? Math.min(65535, 2 ** (Math.floor(Math.log2(limit)) + 1) - 1) : null,
    );
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    assert.equal(bodyWord(f.data, 0), 0);
  }
  const values = Array.from({ length: 40 }, (_, n) => (n % 2 ? [0, 0x5d, 0] : [0, 1, 2])),
    f = fixture(0x80c51f, { limit: 1, mixLow: 27, values });
  unchangedFailure(root, f, { maxWork: 150 }, 'task_work_budget_required');
  unchangedFailure(
    root,
    fixture(0x80c51f, { limit: 0 }),
    { ioObservations: randomRecords([[0, 0, 0]]) },
    'task_io_observation_unused',
  );
});
test('C560: discarded latch is still observed, BYTE X/Y truncation, preserved accumulator high/status and equal-state FF->00 increment', () => {
  for (const latch of [0, 255]) {
    const f = fixture(0x80c560, { values: [[latch, 26, 0]] }),
      p = prepared(root, f);
    assert.equal(p.outputContext.x, 0xef);
    assert.equal(p.outputContext.y, 0);
    assert.equal(p.outputContext.a, 0xab01);
    assert.equal(p.outputContext.status, 0x45);
    assert.equal(p.incremented, true);
    assert.equal(p.ioRequests.length, 3);
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    assert.equal(bodyWord(f.data, 0), 26);
    assert.equal(f.data.readByte(0x801ce8).value, 1);
  }
  const f = fixture(0x80c560, { seed: 255, mixLow: 0x64, values: [[0, 0, 255]] }),
    p = prepared(root, f);
  assert.equal(p.incremented, true);
  assert.equal(p.outputContext.a, 0xab00);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  assert.equal(f.data.readByte(0x801ce8).value, 0);
});
test('Original3E: fresh JSR stack bytes replace mask and limit; late helper/root return aliases publish no effects', () => {
  const f = opcodeFixture({ s: 7 }),
    p = prepared(caller, f);
  assert.equal(p.callee.mask, 63);
  assert.equal(commitTaskPlan(f.data, p).handled, true);
  assert.equal(bodyWord(f.data, 0x3f1), 16);
  assert.equal(
    p.accesses.some((a) => a.kind === 'read' && a.address === 4 && a.value === 0x34),
    true,
  );
  unchangedFailure(caller, opcodeFixture({ s: 0xa3 }), {}, 'task_native3e_target_required');
  unchangedFailure(
    caller,
    opcodeFixture({ s: 0x1ce9, limit: 65535 }),
    {},
    'task_native_resume_target_required',
  );
  unchangedFailure(
    caller,
    opcodeFixture({ s: 0x1cea, limit: 65535 }),
    {},
    'task_native_helper_return_required',
  );
});
test('Original3E: each frozen ordered PPU sample, table/metadata high, exact cumulative budget and owner is mandatory atomically', () => {
  const f = opcodeFixture(),
    p = prepared(caller, f);
  prepared(caller, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
  unchangedFailure(caller, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(caller, f, { maxOutputBytes: p.outputBytes - 1 }, 'task_output_budget_required');
  for (let n = 0; n < 3; n++)
    unchangedFailure(
      caller,
      f,
      { ioObservations: Object.freeze(f.ioObservations.filter((_, i) => i !== n)) },
      'task_io_observation_required',
    );
  unchangedFailure(
    caller,
    f,
    { ioObservations: Object.freeze([...f.ioObservations, f.ioObservations[0]]) },
    'task_io_observation_unused',
  );
  for (const address of [0x82d835, 0x82da8b, 0x82d9af, 0x80c555, 0x80c58d, 0x7e1c77])
    unchangedFailure(caller, omitBodyBytes(f, address), {}, 'render_source_required');
  for (const address of [0x80c554, 0x80c555, 0x80c58d]) {
    const g = opcodeFixture();
    g.data.seed(address, [g.data.readByte(address).value ^ 1]);
    unchangedFailure(caller, g, {}, 'task_random_table_source_required');
  }
  for (const [address, value, reason] of [
    [0x82da8a, 1, 'task_native3e_argument_source_required'],
    [0x82d9ae, 0, 'task_native3e_return_source_required'],
    [0x82d834, 0xc560, 'task_native3e_target_required'],
  ]) {
    const g = opcodeFixture();
    sampleWord(g.data, address, value);
    unchangedFailure(caller, g, {}, reason);
  }
  const before = f.data.snapshot();
  assert.equal(commitTaskPlan(f.data, { ...p }).reason, 'task_plan_owner_required');
  assert.deepEqual(f.data.snapshot(), before);
  f.data.seed(0, [1]);
  assert.equal(commitTaskPlan(f.data, p).reason, 'task_plan_stale');
});
test('Native3E source: every original code/table/anchor byte and each bridge/resume window remains independently mandatory', async () => {
  const { bytes } = inspectRom(await readFile('Shadowrun (E).smc')),
    p = await proveTaskNativeRandomOpcode(bytes);
  assert.deepEqual(
    JSON.parse(await readFile('analysis/render-task-native-opcode-c51f.json')).proofs,
    [p],
  );
  assert.equal(p.admitted_targets[0].proof.minimum_protected_stack_bytes, 5);
  assert.equal(p.full_task_binding, false);
  const addresses = [...randomWindows, ...randomTables, ...randomAnchors].flatMap((w) =>
    Array.from({ length: w.hex.length / 2 }, (_, n) => w.start + n),
  );
  for (const part of p.parts)
    for (const w of part.windows) {
      const a = parseInt(w.entry.replace(':', ''), 16);
      addresses.push(a, a + w.covered_bytes - 1);
    }
  for (const address of new Set(addresses)) {
    const changed = Buffer.from(bytes);
    changed[cpuToOffset(address, bytes.length)] ^= 1;
    await assert.rejects(() => proveTaskNativeRandomOpcode(changed));
  }
});
