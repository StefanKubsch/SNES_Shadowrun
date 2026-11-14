import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareTaskNativeA985 as prepare } from '../proof/task/native-a985.mjs';
import { scriptBodySpecs } from '../proof/task/script-body-specs.mjs';
import {
  scriptBodyFixture,
  bodyWord as word,
  omitBodyBytes,
} from './task-script-body-fixtures.mjs';
import { prepared, commit, unchangedFailure } from './task-native-test-support.mjs';
import { createSlotActionData } from '../proof/state/slot-action-data.mjs';
import { prepareSlotSelection } from '../proof/state/slot-selection.mjs';
const actionData = createSlotActionData(JSON.parse(await readFile('assets/slot-action-data.json')));
const put = (f, a, v) => f.data.seed(a, [v & 255, v >>> 8]);
function fixture(equal = false) {
  const spec = scriptBodySpecs.find((s) => s.id === 0x91),
    f = scriptBodyFixture(spec, { selectionEqual: equal, actionEqual: true });
  f.entry = 0x80a985;
  f.context = Object.freeze({
    ...f.context,
    pc: 0xa985,
    bank: 0x80,
    d: 0,
    s: 0x6ff,
    a: 0xabcd,
    status: 0x45,
  });
  f.protectedStackBytes = [0x7e0700, 0x7e0701];
  put(f, 0x700, 0xc20a);
  put(f, 0, 16);
  put(f, 2, 1);
  return { f, spec };
}
test('D1 positive standalone root independently matches original selection fields and leaves actual pointer workspace unrestored', () => {
  const { f, spec } = fixture(),
    expected = prepareSlotSelection({
      selectionWord: 1,
      currentSelection: 65535,
      definitionWord: 11,
      currentIndex: 0,
      actionData,
    });
  assert.equal(expected.handled, true);
  const p = commit(prepare, f);
  for (const [key, value] of Object.entries(expected.fields)) {
    const address =
      (key.startsWith('7E:')
        ? 0x7e0000 + parseInt(key.slice(3), 16)
        : 0x800000 + parseInt(key, 16)) + 16;
    assert.equal(word(f.data, address), value, key);
  }
  const table = spec.romReads.find((r) => r.address === 0x8ceda0).value,
    pointer = table + 2,
    record = spec.romReads.find((r) => r.address === 0x8c0000 + pointer).value;
  assert.equal(word(f.data, 0), pointer);
  assert.equal(word(f.data, 2), 0x8c);
  assert.equal(word(f.data, 4), record);
  assert.equal(word(f.data, 6), 0x8c);
  assert.equal(word(f.data, 8), record + 8);
  assert.equal(word(f.data, 10), 0x8c);
  assert.equal(p.outputContext.x, 16);
  assert.equal(p.outputContext.y, 7);
  assert.equal(p.rawReturnWord, 0xc20a);
  assert.equal(p.outputContext.s, 0x701);
  assert.ok(
    !p.accesses.some(
      (a) =>
        a.label.startsWith('d2-PEI') ||
        a.label === 'd2-restored-slot-low' ||
        a.label.startsWith('d2-inner-JSR'),
    ),
  );
});
test('D1 equality follows original AA4B RTS without data writes, preserving true compare carry and WORD A', () => {
  const { f } = fixture(true),
    p = prepared(prepare, f);
  assert.equal(p.outputBytes, 0);
  assert.equal(p.outputContext.a, 1);
  assert.equal(p.outputContext.y, 16);
  assert.equal(p.outputContext.status, 0x47);
  assert.equal(p.outputContext.x, 0x2c);
  assert.equal(word(f.data, 0), 16);
});
test('D1 root rejects missing original ignored highbytes, late budget/window/return aliases without publishing any earlier effects', () => {
  const { f, spec } = fixture(),
    p = prepared(prepare, f),
    base = spec.romReads.find((r) => r.address === 0x8ceda0).value;
  unchangedFailure(prepare, omitBodyBytes(f, 0x8ceda1), {}, 'render_source_required');
  unchangedFailure(prepare, omitBodyBytes(f, 0x8c0000 + base + 3), {}, 'render_source_required');
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
    { protectedStackBytes: [...f.protectedStackBytes, 0x7e0004] },
    'task_stack_alias_required',
  );
  prepared(prepare, { ...f, maxWork: p.work, maxOutputBytes: p.outputBytes });
});
