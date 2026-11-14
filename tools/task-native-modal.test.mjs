import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectRom, cpuToOffset } from './rom.mjs';
import { decodeTaskWindows } from './task-partial-source.mjs';
import { modalSpecs } from './task-native-modal-specs.mjs';
import { modalSource, proveModalRoot } from './task-native-modal-source.mjs';
import { proveModalOpcode } from './task-native-modal-opcode-source.mjs';
import { taskModalFixture, modalOpcodeFixture } from './task-native-modal-fixtures.mjs';
import { menuRecords } from './task-native-menu-fixtures.mjs';
import { prepareTaskModalRoot as root } from '../proof/task/native-modal.mjs';
import { prepareTaskModalOpcode as opcode } from '../proof/task/native-modal-opcode.mjs';
import { prepared, commit, unchangedFailure } from './task-native-test-support.mjs';
import { omitBodyBytes as omit, bodyWord as word } from './task-script-body-fixtures.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
const { bytes } = inspectRom(await readFile('Shadowrun (E).smc'));
test('Four whole modal roots renew each original instruction, stack/mode/return and own Native58 metadata highs', async () => {
  for (const s of modalSpecs) {
    const source = await modalSource(bytes, s);
    assert.deepEqual(source, JSON.parse(await readFile(`analysis/render-task-${s.name}.json`)));
    const p = source.proofs[0];
    assert.equal(p.external_return_assumptions, 0);
    assert.equal(p.minimum_protected_stack_bytes, { 0x72: 28, 0xbf: 2, 0x74: 2, 0xd7: 14 }[s.id]);
    const { map } = decodeTaskWindows(bytes, s.windows);
    assert.equal(p.reachable_instructions, map.size);
    for (const [pc, i] of map) {
      const changed = new Map(map);
      changed.set(pc, { ...i, raw: [i.raw[0] ^ 1, ...i.raw.slice(1)] });
      assert.throws(() => proveModalRoot(changed, s));
    }
    const proof = await proveModalOpcode(bytes, s.id);
    assert.equal(proof.admitted_targets[0].id, s.id);
    for (const address of [
      s.entry,
      0x80f506,
      0x80f509,
      0x80f52f,
      ...s.anchors.map((a) => a.start + 1),
    ]) {
      const changed = Buffer.from(bytes);
      changed[cpuToOffset(address, bytes.length)] ^= 1;
      await assert.rejects(() => proveModalOpcode(changed, s.id));
    }
  }
});
test('Native72 actual choice PEA spans whole removal then fresh PLA; confirm/cancel have two independent input observations', () => {
  for (const held of [0x40, 0x2000]) {
    const f = taskModalFixture(0x72, { held }),
      p = prepared(root, f);
    assert.equal(p.returnTarget, 0x80f509);
    assert.equal(p.inputObservationsUsed, 2);
    assert.equal(p.waitObservationsUsed, 44);
    assert.deepEqual(
      p.calls.filter((c) => [0x80cd52, 0x80cd6f, 0x80cd8a].includes(c.pc)).map((c) => c.pc),
      [0x80cd52, 0x80cd6f, 0x80cd8a],
    );
    assert.ok(p.accesses.some((a) => a.label === 'CD43-choice-PLA-fresh-low'));
    for (const [key, reason] of [
      ['inputObservations', 'task_input_observation_required'],
      ['waitObservations', 'task_wait_observation_required'],
      ['ioObservations', 'task_io_observation_required'],
    ])
      unchangedFailure(root, f, { [key]: menuRecords(f[key].slice(0, -1)) }, reason);
    unchangedFailure(
      root,
      f,
      { inputObservations: menuRecords([...f.inputObservations, f.inputObservations[0]]) },
      'task_input_observation_unused',
    );
    commit(root, f);
    assert.equal(word(f.data, 0), held === 0x40 ? 65535 : 0);
  }
  const bad = taskModalFixture(0x72);
  sampleWord(bad.data, 0x80cd93, 0x7151);
  unchangedFailure(root, bad, {}, 'task_modal_original_table_required');
});
test('NativeBF full WORD debit, exact balance, borrow and failed highzero preserve currency atomically', () => {
  for (const [quantity, low, high] of [
    [150, 150, 0],
    [150, 149, 0],
    [150, 0, 1],
    [65535, 0, 65535],
    [0, 65535, 0],
  ]) {
    const f = taskModalFixture(0xbf, { quantity, low, high }),
      p = commit(root, f),
      paid = low >= quantity || high !== 0;
    assert.equal(word(f.data, 0), paid ? 65535 : 0);
    assert.equal(word(f.data, 0x7e3c0d), paid ? (low - quantity) & 65535 : low);
    assert.equal(word(f.data, 0x7e3c0f), paid && low < quantity ? (high - 1) & 65535 : high);
    assert.equal(p.waitObservationsUsed, 0);
  }
});
test('Native74 null skips DP02, while full LongX table and WORD store carry into physical bank7F', () => {
  const zero = omit(taskModalFixture(0x74, { pointer: 0 }), 2, 3),
    p = prepared(root, zero);
  assert.equal(
    p.accesses.some((a) => a.address === 2),
    false,
  );
  const f = taskModalFixture(0x74, { value: 0xabcd });
  sampleWord(f.data, 0, 0xffff);
  sampleWord(f.data, 0x8eb01f, 0xffff);
  commit(root, f);
  assert.equal(word(f.data, 0x7f0002), 0xabcd);
});
test('NativeD7 owns full WORD selector ASL and FE69 with fresh DP14, products and FC/FA waits', () => {
  const f = taskModalFixture(0xd7, { selector: 0x8199 }),
    p = prepared(root, f);
  assert.equal(p.calls.filter((c) => c.pc === 0x809368).length, 1);
  assert.equal(p.waitObservationsUsed, 10);
  assert.equal(p.observationsUsed, 2);
  assert.ok(p.accesses.some((a) => a.address === 0x80dcea));
  unchangedFailure(root, omit(f, 0x80dceb), {}, 'render_source_required');
  unchangedFailure(
    root,
    f,
    { waitObservations: menuRecords(f.waitObservations.slice(0, -1)) },
    'task_wait_observation_required',
  );
});
test('Four separate Native58 bindings retain own pop/result conditions, real F508/F509 and exact budget boundaries', () => {
  for (const s of modalSpecs) {
    const f = { ...modalOpcodeFixture(s.id), nativeId: s.id },
      p = prepared(opcode, f);
    assert.equal(p.arguments.wordPops, [0x72, 0x74].includes(s.id) ? 2 : 1);
    assert.equal(p.resultPushed, [0x72, 0xbf].includes(s.id));
    assert.equal(p.calleeReturnWord, 0xf508);
    assert.equal(p.calleeReturnTarget, 0x80f509);
    assert.equal(p.outputContext.pc, 0xf390);
    for (const a of s.anchors)
      unchangedFailure(opcode, omit(f, a.start + 1), {}, 'render_source_required');
    prepared(opcode, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
    unchangedFailure(opcode, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
    unchangedFailure(
      opcode,
      f,
      { maxOutputBytes: p.outputBytes - 1 },
      'task_output_budget_required',
    );
  }
});
