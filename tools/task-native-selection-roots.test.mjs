import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectRom, cpuToOffset } from './rom.mjs';
import { decodeTaskWindows } from './task-partial-source.mjs';
import { selectionRoots } from './task-native-933a-bba0-specs.mjs';
import { proveSelectionRoot, selectionRootSource } from './task-native-selection-roots-source.mjs';
import { proveSelectionOpcode } from './task-native-selection-roots-opcode-source.mjs';
import {
  taskSelectionFixture,
  selectionOpcodeFixture,
  selectionRecords,
} from './task-native-selection-roots-fixtures.mjs';
import { prepareTaskSelectionRoot as root } from '../proof/task/native-933a-bba0.mjs';
import { prepareTaskSelectionOpcode as opcode } from '../proof/task/native-selection-root-opcode.mjs';
import { prepared, unchangedFailure, commit } from './task-native-test-support.mjs';
import { omitBodyBytes as omit, bodyWord as word } from './task-script-body-fixtures.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
const { bytes } = inspectRom(await readFile('Shadowrun (E).smc'));
test('Whole933A and BBA0 renew every original instruction, typed helper/return/mode and own metadata highs', async () => {
  for (const s of selectionRoots) {
    const source = await selectionRootSource(bytes, s);
    assert.deepEqual(source, JSON.parse(await readFile(`analysis/render-task-${s.name}.json`)));
    assert.equal(source.proofs[0].minimum_protected_stack_bytes, s.id === 0x9a ? 14 : 10);
    assert.equal(source.proofs[0].full_graph_closed, true);
    const { map } = decodeTaskWindows(bytes, s.windows);
    for (const [pc, i] of map) {
      const changed = new Map(map);
      changed.set(pc, { ...i, raw: [i.raw[0] ^ 1, ...i.raw.slice(1)] });
      assert.throws(() => proveSelectionRoot(changed, s));
    }
    const binding = await proveSelectionOpcode(bytes, s.id);
    assert.equal(binding.admitted_targets[0].id, s.id);
    for (const address of [
      s.entry,
      0x80f506,
      0x80f52f,
      0x80f509,
      ...s.anchors.map((a) => a.start + 1),
    ]) {
      const changed = Buffer.from(bytes);
      changed[cpuToOffset(address, bytes.length)] ^= 1;
      await assert.rejects(() => proveSelectionOpcode(changed, s.id));
    }
  }
});
test('Original9A fresh selector/DP14, chronological F6/FC/FA and product records with one atomic native return', () => {
  const f = taskSelectionFixture(0x9a),
    p = prepared(root, f);
  assert.equal(p.returnTarget, 0x80f509);
  assert.equal(p.waitObservationsUsed, 11);
  assert.equal(p.observationsUsed, 3);
  assert.equal(p.calls.filter((c) => c.pc === 0x809348).length, 1);
  assert.ok(p.accesses.some((a) => a.label === '933A-selector-PLA-fresh-low'));
  unchangedFailure(
    root,
    f,
    { waitObservations: selectionRecords(f.waitObservations.slice(0, -1)) },
    'task_wait_observation_required',
  );
  unchangedFailure(
    root,
    f,
    { ioObservations: selectionRecords(f.ioObservations.slice(0, -1)) },
    'task_io_observation_required',
  );
  unchangedFailure(
    root,
    f,
    { waitObservations: selectionRecords([...f.waitObservations, f.waitObservations[0]]) },
    'task_wait_observation_unused',
  );
  unchangedFailure(
    root,
    f,
    {
      inputObservations: selectionRecords([
        { pc: 0x809e1a, address: 0x8001ca, width: 2, value: 0 },
      ]),
    },
    'task_input_observation_unused',
  );
  const full = taskSelectionFixture(0x9a, { selector: 0x8199 }),
    q = prepared(root, full);
  assert.equal(
    q.accesses.some((a) => a.kind === 'read' && a.address === 0x80dcea),
    true,
  );
  const stale = prepared(root, f);
  sampleWord(f.data, 0x14, 4);
  assert.equal(commitTaskPlan(f.data, stale).reason, 'task_plan_stale');
});
test('Original1A carries third ASL into fresh ADC, exact match2/4 and negative WORD loop, direction wrap and full D15C', () => {
  for (const match of [0, 2, 4, -1])
    for (const base of [0, 7]) {
      const f = taskSelectionFixture(0x1a, { match, base }),
        p = commit(root, f);
      assert.equal(word(f.data, 4), (base + (match === 2 ? 1 : match === 4 ? -1 : 0)) & 7);
      assert.equal(p.calls.at(-1).target, 0x80d15c);
      assert.equal(word(f.data, 2), (base + (match === 2 ? 1 : match === 4 ? -1 : 0)) & 7);
    }
  const carry = taskSelectionFixture(0x1a, { cell: 0x2000, match: 0 });
  const p = prepared(root, carry);
  assert.ok(p.accesses.some((a) => a.address === 0x8db2a0));
  for (const a of [0x7e2de3, 0x7e2de7, 0x80151b, 0x8db2a1])
    unchangedFailure(root, omit(carry, a), {}, 'render_source_required');
  const table = taskSelectionFixture(0x1a, { match: 0 });
  sampleWord(table.data, 0x80bbfe, 0xffff);
  unchangedFailure(root, table, {}, 'task_selection_direction_table_required');
});
test('Both Native58 bindings retain0201/0000 high bytes, one actual pop, zero resultPHA, F508/F509 and atomic budgets/owners', () => {
  for (const id of [0x9a, 0x1a]) {
    const f = { ...selectionOpcodeFixture(id), nativeId: id },
      p = prepared(opcode, f),
      s = selectionRoots.find((s) => s.id === id);
    assert.equal(p.arguments.wordPops, 1);
    assert.equal(p.arguments.metadataWord, 0x0201);
    assert.equal(p.metadataWord, 0);
    assert.equal(p.resultPushed, false);
    assert.equal(p.calleeReturnWord, 0xf508);
    assert.equal(p.calleeReturnTarget, 0x80f509);
    assert.equal(p.outputContext.pc, 0xf390);
    assert.equal(p.outputContext.s, 0x3f2);
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
    unchangedFailure(
      opcode,
      f,
      { protectedStackBytes: [0x7e0800, 0x7e0801] },
      'task_outer_return_required',
    );
  }
});
