import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareTaskNativeD15C as prepare } from '../proof/task/native-d15c.mjs';
import { prepareTaskScriptBody as body } from '../proof/task/script-bodies.mjs';
import { taskLeafFixture } from './task-native-leaf-fixtures.mjs';
import { prepared, commit, unchangedFailure } from './task-native-test-support.mjs';
import {
  bodyWord as word,
  omitBodyBytes as omit,
  scriptBodyFixture,
  bodyCases,
  bodyD2Settings,
} from './task-script-body-fixtures.mjs';
import { scriptBodySpecs } from '../proof/task/script-body-specs.mjs';
import { prepareSlotSelection } from '../proof/state/slot-selection.mjs';
import { prepareSlotAction6A } from '../proof/state/slot-action-6a.mjs';
import { createSlotActionData } from '../proof/state/slot-action-data.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
const put = (f, a, v) => f.data.seed(a, [v & 255, v >>> 8]);
const fixture = ({
  slot = 0x10,
  selection = 3,
  action = 5,
  table = 0x9000,
  record = 0xa000,
  bytes = [0x12, 0x84, 0x34, 0x7f, 0x80, 0xff, 1, 0x56],
  oldIndex = 0,
  oldSelection = 65535,
} = {}) => {
  const f = taskLeafFixture(0x80d15c);
  put(f, 0, slot);
  put(f, 2, selection);
  put(f, 4, action);
  put(f, 0x801038 + slot, oldSelection);
  put(f, 0x801198 + slot, oldIndex);
  put(f, 0x7e3f28 + slot, 0);
  put(f, 0x8ced8a, table);
  const sum = table + ((selection * 2) & 65535) + (selection >>> 15),
    pointer = sum & 65535,
    counter = (record + 8 + Number(sum > 65535)) & 65535;
  put(f, 0x8c0000 + pointer, record);
  f.data.seed(0x8c0000 + record, [...bytes, 0xa5]);
  // Explicit synthetic WORD counter sources, distinct from record bytes.
  put(f, 0x8c0000 + counter + oldIndex, 0xab31);
  put(f, 0x8c0000 + counter + action, 0xcd19);
  return {
    ...f,
    counter,
    record,
    pointer,
    slot,
    selection,
    action,
    maxWork: 20000,
    maxOutputBytes: 2048,
  };
};
test('D2 full physical helper equations independently match existing original-data state contracts for each new body and unaligned slot', async () => {
  const data = createSlotActionData(JSON.parse(await readFile('assets/slot-action-data.json')));
  for (const spec of scriptBodySpecs.filter((s) => bodyD2Settings.has(s.id)))
    for (const v of bodyCases(spec))
      for (const slot of [0x10, 0x11]) {
        const [selection, action] = bodyD2Settings.get(spec.id),
          f = scriptBodyFixture(spec, { ...v, slot });
        const initial = Object.fromEntries(
          ['1038', '1198', '10E8', '1090', '11F0'].map((k) => [
            k,
            word(f.data, 0x800000 + parseInt(k, 16) + slot),
          ]),
        );
        const first = prepareSlotSelection({
          selectionWord: selection,
          currentSelection: initial['1038'],
          definitionWord: 11,
          currentIndex: initial['1198'],
          actionData: data,
        });
        assert.equal(first.handled, true);
        const fields = { ...initial, ...first.fields },
          second = prepareSlotAction6A({
            offset: slot,
            nextWord: action,
            definitionWord: 11,
            fields,
            lowByte: fields['11F0'] & 255,
            actionData: data,
          });
        assert.equal(second.handled, true);
        const expected = { ...first.fields, ...second.fields };
        const p = commit(body, f);
        assert.equal(p.bodyComplete, true);
        assert.equal(p.resultWord, 0xbeef);
        for (const [key, value] of Object.entries(expected)) {
          const address =
            (key.startsWith('7E:')
              ? 0x7e0000 + parseInt(key.slice(3), 16)
              : 0x800000 + parseInt(key, 16)) + slot;
          // AAAF writes a single low byte; the other path's masked store is WORD.
          if (key === '11F0' && second.lowByte !== undefined) continue;
          assert.equal(word(f.data, address), value, `${spec.id.toString(16)}/${v.name}/${key}`);
        }
        if (second.lowByte !== undefined)
          assert.equal(f.data.readByte(0x8011f0 + slot).value, second.lowByte);
        if (spec.id !== 0xae && spec.id !== 0x245)
          assert.equal(word(f.data, 0x801350 + slot), 65535);
        if (spec.id === 0x18f) assert.equal(word(f.data, 0x801458 + slot), 0);
        if (spec.id === 0x0b8) assert.equal(word(f.data, 0x801458 + slot), 0xbfef);
        if (spec.id === 0x32f) {
          assert.equal(word(f.data, 0x801400 + slot), 0x9235);
          assert.equal(word(f.data, 0x801458 + slot), 0x1eef);
        }
      }
});
test('D2 keeps original bit15 carry, prior ADC carry, signed bytes, both ignored WORD highbytes and BYTE arithmetic', () => {
  for (const selection of [3, 0x8003, 0x6000]) {
    const f = fixture({ selection, table: selection === 0x6000 ? 0xd000 : 0x9000 }),
      p = commit(prepare, f);
    assert.equal(word(f.data, 0x801048), selection);
    assert.equal(word(f.data, 0x8010a0), f.counter);
    assert.equal(word(f.data, 0x7e4250), 0x7f);
    assert.equal(word(f.data, 0x7e42a8), 0xff80);
    assert.equal(word(f.data, 0x7e4300), 65535);
    assert.equal(word(f.data, 0x7e4358), 1);
    assert.equal(word(f.data, 0x801258), 0x34);
    assert.equal(word(f.data, 0x7e43b0), 0x56);
    assert.equal(word(f.data, 0x8011a8), 5);
    assert.equal(word(f.data, 0x801200), 0x19);
    assert.equal(p.outputContext.status & 0x30, 0);
    assert.equal(p.outputContext.status & 1, 0);
    assert.ok(
      p.accesses.some(
        (r) => r.label === 'd2-indirect-WORD-high' && r.address === 0x8c0000 + f.record + 8,
      ),
    );
    assert.equal(word(f.data, 0), 0x10);
    assert.equal(word(f.data, 2), 5);
    assert.equal(word(f.data, 4), f.record);
    assert.equal(p.outputContext.s, 0x701);
    assert.equal(p.returnTarget, 0x80c20b);
  }
});
test('D2 equality and every slow AAAF branch retain observed state without invented reads', () => {
  const equal = taskLeafFixture(0x80d15c),
    p = commit(prepare, equal);
  assert.equal(p.outputContext.a, 5);
  assert.equal(p.outputContext.status & 0x83, 3);
  assert.equal(p.accesses.filter((r) => r.label === 'd2-inner-RTS-low').length, 2);
  for (const branch of [0, 0x80, 0xffff]) {
    const f = taskLeafFixture(0x80d15c);
    put(f, 0x8011a8, 0);
    put(f, 0x8010f8, branch);
    put(f, 0x801048, 65535);
    put(f, 2, 65535);
    const q = commit(prepare, f);
    assert.equal(word(f.data, 0x8011a8), 5);
    assert.equal(q.outputContext.a, 65535);
  }
});
test('AAAF BYTE SBC/CLC/ADC covers carry and overflow boundaries while preserving the field highbyte and WORD Y', () => {
  for (const initial of [0, 1, 0x7f, 0x80, 0xff])
    for (const oldByte of [0, 1, 0x7f, 0x80, 0xff])
      for (const newByte of [0, 1, 0x7f, 0x80, 0xff]) {
        const f = fixture({ oldSelection: 3 });
        put(f, 0x8010f8, 1);
        put(f, 0x801200, 0xab00 | initial);
        put(f, 0x8010a0, f.counter);
        f.data.seed(0x8c0000 + f.counter, [oldByte]);
        f.data.seed(0x8c0000 + f.counter + 5, [newByte]);
        const intermediate = (initial - oldByte) & 255,
          sum = intermediate + newByte,
          result = sum & 255;
        const p = commit(prepare, f);
        assert.equal(word(f.data, 0x801200), 0xab00 | result);
        assert.equal(p.outputContext.status & 1, Number(sum > 255));
        assert.equal(
          p.outputContext.status & 64,
          ~(intermediate ^ newByte) & (intermediate ^ result) & 128 ? 64 : 0,
        );
        assert.equal(p.outputContext.y, 5);
        assert.equal(p.outputContext.a, 65535);
        assert.equal(p.outputContext.status & 0xb2, 0x80);
      }
});
test('D2 rejects every accessed source highbyte and late work/output/window/return failures without partial effects', () => {
  const f = fixture(),
    p = prepared(prepare, f),
    written = new Set();
  for (const access of p.accesses) {
    if (access.kind === 'write') written.add(access.address);
    else if (!written.has(access.address))
      unchangedFailure(prepare, omit(f, access.address), {}, 'render_source_required');
  }
  unchangedFailure(prepare, f, { maxWork: p.work - 1 }, 'task_work_budget_required');
  unchangedFailure(
    prepare,
    f,
    { maxOutputBytes: p.outputBytes - 1 },
    'task_output_budget_required',
  );
  prepared(prepare, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
  unchangedFailure(
    prepare,
    f,
    { context: Object.freeze({ ...f.context, status: f.context.status | 8 }) },
    'task_binary_arithmetic_required',
  );
  // STAs replace an inner JSR frame: continue only after the freshly popped
  // actual RTS agrees with D162. The earlier output remains private.
  const alias = fixture({ slot: 0xfaf8 });
  alias.context = Object.freeze({ ...alias.context, s: 0xb35 });
  put(alias, 0xb36, 0xc20a);
  alias.protectedStackBytes = [0x7e0b36, 0x7e0b37];
  unchangedFailure(prepare, alias, {}, 'task_native_helper_return_required');
  const g = fixture(),
    q = prepared(prepare, g);
  g.data.seed(0x100, [1]);
  const before = g.data.snapshot();
  assert.equal(commitTaskPlan(g.data, q).reason, 'task_plan_stale');
  assert.deepEqual(g.data.snapshot(), before);
});
test('original D2 bodies reject changed dynamic ROM ownership and local ignored highbytes atomically', () => {
  for (const spec of scriptBodySpecs.filter((s) => bodyD2Settings.has(s.id))) {
    const f = scriptBodyFixture(spec);
    unchangedFailure(body, omit(f, 0x614), {}, 'render_source_required');
    put(f, 0x7e3f38, 12);
    unchangedFailure(body, f, {}, 'task_script_body_ROM_read_required');
  }
});
test('0AE END opcode highbyte is the real fresh83:0000 workspace alias, never adjacent LoROM data', () => {
  const spec = scriptBodySpecs.find((s) => s.id === 0xae);
  assert.equal(spec.fetchTail, null);
  assert.equal(spec.scriptEntry + 2 + spec.bytecode.length, 0x830000);
  for (const initial of [0, 0xab, 0xff])
    for (const selectionEqual of [false, true]) {
      const f = scriptBodyFixture(spec, { selectionEqual });
      f.data.seed(0x830000, [initial]);
      const p = prepared(body, f),
        read = p.accesses.find(
          (r) => r.address === 0x830000 && r.label === 'fresh-next-opcode-high',
        );
      assert.equal(read.value, selectionEqual ? 0x10 : 0xc6);
      assert.equal(p.resultWord, 0xbeef);
      assert.ok(
        !p.accesses.some((r) => r.address === 0x830000 && r.label === 'original-body-source'),
      );
    }
  const f = scriptBodyFixture(spec);
  prepared(body, omit(f, 0x830000));
});
