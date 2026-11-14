import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { slotSelectionEntry, prepareSlotSelection } from '../proof/state/slot-selection.mjs';
import { createSlotActionData } from '../proof/state/slot-action-data.mjs';
import { createSlotDefinitions } from '../proof/state/slot-definitions.mjs';
import { createSlotState } from '../proof/state/slots.mjs';
import { createScriptState } from '../proof/state/script-state.mjs';
import { createScriptScheduler } from '../proof/script/scheduler.mjs';
import { createTaskFrameAllocator, createTaskFrameProfiles } from '../proof/script/task-frames.mjs';
import { visitTailWithState } from '../proof/state/host.mjs';

const asset = JSON.parse(await readFile(new URL('../assets/slot-action-data.json', import.meta.url), 'utf8'));
const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const original = JSON.parse(await readFile(new URL('../assets/scripts.json', import.meta.url), 'utf8'));
const profiles = createTaskFrameProfiles(JSON.parse(await readFile(new URL('../assets/task-frame-profiles.json', import.meta.url), 'utf8')));
const definitions = createSlotDefinitions(JSON.parse(await readFile(new URL('../assets/slot-definitions.json', import.meta.url), 'utf8')));
const input = { selectionWord: 0, currentSelection: 0xFFFF, definitionWord: 11, currentIndex: 1 };
// Explicit byte fixtures exercise unreachable-in-this-ROM boundary values;
// original-data integration below uses the untouched extraction separately.
function fixture({ table = 0x8000, entry = 0x8000, record = 0x8100, bytes = [255, 127, 128, 0, 127, 128, 255, 255], counter = 0xBEEF, counterAddress = record + 9 } = {}) {
  const patched = structuredClone(asset);
  const putWord = (pointer, value) => {
    patched.bytes[pointer - 0x8000] = value & 255;
    if (pointer < 0xFFFF) patched.bytes[pointer - 0x8000 + 1] = value >>> 8;
  };
  putWord(0xED8A + 22, table);
  for (let i = 0; i < bytes.length; i++) patched.bytes[record - 0x8000 + i] = bytes[i];
  if (counterAddress >= 0x8000 && counterAddress < 0xFFFF) putWord(counterAddress, counter);
  putWord(entry, record);
  return createSlotActionData(patched);
}
const request = (offset, next) => ({ nativeId: 0x6A, args: [offset, next], returnBytes: 0 });

test('All 65536 selectors retain ASL bit 15 and the outgoing ADC carry, including the table carry thresholds', () => {
  for (const table of [0, 1, 0x7FFF, 0x8000, 0xFFFF]) {
    for (let selection = 0; selection <= 0xFFFF; selection++) {
      const doubled = (selection % 32768) * 2;
      const sum = table + doubled + Math.floor(selection / 32768);
      assert.deepEqual(slotSelectionEntry(table, selection), { pointer: sum % 65536, carry: Math.floor(sum / 65536) });
    }
  }
  for (const invalid of [-1, 65536, null, undefined, 1.5]) assert.throws(() => slotSelectionEntry(0, invalid), /selection word/);
});

test('A985 equality reads no provider, definition or index and leaves every field and scratch word alone', () => {
  for (let selection = 0; selection <= 0xFFFF; selection++) assert.deepEqual(prepareSlotSelection({ selectionWord: selection, currentSelection: selection, definitionWord: null, currentIndex: null, actionData: null }), { handled: true, fields: {}, workspaceWords: null });
  assert.equal(prepareSlotSelection({ ...input, currentSelection: null }).reason, 'slot_source_required');
  assert.equal(prepareSlotSelection({ ...input, actionData: null }).reason, 'slot_action_data_source_required');
  assert.equal(prepareSlotSelection({ ...input, currentIndex: null, actionData: fixture() }).reason, 'slot_source_required');
});

test('A985 performs word writes, sign extends only bytes 3..6 and applies XOR to byte 1', () => {
  const result = prepareSlotSelection({ ...input, actionData: fixture() });
  assert.deepEqual(result, {
    handled: true, workspaceWords: [0x8000, 0x8C, 0x8100, 0x8C, 0x8108, 0x8C],
    fields: { '1038': 0, '1090': 0x8108, '11F0': 0xEF, '7E:4088': 255, '10E8': 255, '7E:3FD8': 1, '1248': 128, '7E:4240': 0, '7E:4298': 127, '7E:42F0': 0xFF80, '7E:4348': 0xFFFF, '7E:43A0': 255, '7E:4030': 128, '1140': 0xFFFF },
  });
  for (let byte = 0; byte <= 255; byte++) {
    const fields = prepareSlotSelection({ ...input, actionData: fixture({ bytes: Array(8).fill(byte) }) }).fields;
    assert.equal(fields['10E8'], byte ^ 128);
    for (const key of ['7E:4240', '7E:4298', '7E:42F0', '7E:4348']) assert.equal(fields[key], byte < 128 ? byte : 0xFF00 + byte);
    for (const key of ['7E:4088', '1248', '7E:43A0']) assert.equal(fields[key], byte);
  }
});

test('The first carry survives into record+8 and the second result wraps as a word before long indexing', () => {
  const carry = prepareSlotSelection({ ...input, selectionWord: 0x4800, actionData: fixture({ table: 0xF000, counterAddress: 0x810A }) });
  assert.equal(carry.fields['1090'], 0x8109);
  assert.equal(carry.fields['11F0'], 0xEF);
  const wrap = prepareSlotSelection({ ...input, selectionWord: 0x4800, currentIndex: 0x8000, actionData: fixture({ table: 0xF000, record: 0xFFF7, counterAddress: null }) });
  assert.equal(wrap.handled, true);
  assert.equal(wrap.fields['1090'], 0);
  assert.equal(wrap.fields['11F0'], 0xF7); // Long read at 8C:0000 + 8000.
  const shiftedCarry = prepareSlotSelection({ ...input, selectionWord: 0x8000, actionData: fixture({ entry: 0x8001 }) });
  assert.equal(shiftedCarry.workspaceWords[0], 0x8001);
});

test('All 44 slots mask 1038, use NEW 1198 for the helper and change exactly the covered fields', () => {
  for (let offset = 0; offset <= 0x56; offset += 2) {
    const slots = createSlotState({ actionData: fixture() });
    slots.seedSlot(offset, { definitionWord: 11, count: 2, head: 4, fields: { '1198': 0, '10E8': 0, '1038': 0x8000 } });
    slots.seedSlotFieldByte(offset, '11F0', 1, 0xCA);
    const before = slots.snapshot();
    const plan = prepareSlotSelection({ ...input, actionData: fixture() });
    const expected = structuredClone(before);
    expected.columns['1198'][offset / 2] = 1;
    for (const [key, value] of Object.entries(plan.fields)) expected.columns[key][offset / 2] = value;
    expected.fieldBytes['11F0'][offset / 2] = [0xEF, 0];
    assert.deepEqual(slots.applyNative(request(offset, 1)), { handled: true, value: null, workspaceWords: plan.workspaceWords });
    assert.deepEqual(slots.snapshot(), expected);
  }
});

test('Missing table, pointer, counter or final second word byte retains all original slot effects as pending', () => {
  const cases = [
    { definitionWord: 0xFFFF },
    { actionData: fixture({ table: 0xFFFF, entry: 0xFFFF }) },
    { actionData: fixture({ record: 0xFFF7 }), next: 1 }, // Counter at FFFF lacks its high byte.
    { actionData: fixture({ record: 0xFFF8 }), next: 0x8000 }, // Counter wraps; final record word is FFFF.
    { actionData: fixture(), next: 0xFFFF },
  ];
  for (const c of cases) {
    const slots = createSlotState({ actionData: c.actionData ?? fixture() });
    slots.seedSlot(0, { definitionWord: c.definitionWord ?? 11, count: 0, head: 0, fields: { '1198': 0, '10E8': 0, '1038': 0 } });
    const before = slots.snapshot();
    assert.deepEqual(slots.applyNative(request(0, c.next ?? 1)), { handled: false, reason: 'slot_action_data_window_required' });
    assert.deepEqual(slots.snapshot(), before);
  }
});

test('Actual A9 creation plus explicit selection fields runs original 318 through A985 to the next 63 boundary', () => {
  const slots = createSlotState({ definitionData: definitions, actionData: createSlotActionData(asset) });
  const created = slots.applyNative({ nativeId: 0xA9, args: [11, 123, 456, 64, 0xFFFF], returnBytes: 2 });
  slots.seedSlotFields(created.value, { '10E8': 0, '1038': 0 }); // Explicit fixture, not scene startup.
  const table = rom.readUInt16LE(0x66D8A + 22);
  const record = rom.readUInt16LE(0x60000 + table - 0x8000);
  const counter = rom[0x60000 + record - 0x8000 + 8 + 5];
  const memory = createTaskFrameAllocator({ profileData: profiles });
  const scheduler = createScriptScheduler(original, { frameAllocator: memory });
  scheduler.addTask(0x318, [created.value]);
  memory.writeWorkspaceWords([1, 2, 3, 4, 5, 6, 7, 8]);
  const result = visitTailWithState(scheduler, createScriptState({ byteLength: 0x32, slotState: slots }));
  assert.deepEqual(result.actions.map(a => [a.nativeId, a.requestId]), [[0x6A, 1]]);
  assert.deepEqual(result.boundary, { nativeId: 0x63, reason: 'native_implementation_required' });
  assert.equal(result.execution.pending.pc, 77);
  assert.equal(slots.snapshot().columns['11F0'][43], counter);
  assert.deepEqual(memory.snapshot().workspace, [table, 0x8C, record, 0x8C, record + 8, 0x8C, 7, 8]);
});

test('Malformed helper scratch profiles are rejected before suspended request and allocator mutations', () => {
  const memory = createTaskFrameAllocator({ profileData: profiles });
  const scheduler = createScriptScheduler(original, { frameAllocator: memory });
  scheduler.addTask(0x318, [0]);
  const first = scheduler.visitTail();
  const before = memory.snapshot();
  for (const workspaceWords of [new Array(6), [1, 0x8C, 2, 0x8C, 3, 0], [1, 0x8C, 2, 0x8C, -1, 0x8C], [1, 0x8C, 2, 0x8C, 3, 0x8C, 4]]) {
    assert.throws(() => scheduler.completeNative(first.pending.taskId, first.pending.requestId, null, { workspaceWords }), /workspace/);
    assert.deepEqual(scheduler.snapshot(), first);
    assert.deepEqual(memory.snapshot(), before);
  }
  assert.throws(() => scheduler.completeNative(first.pending.taskId, first.pending.requestId, null, { workspaceWords: [1, 0x8C, 2, 0x8C, 3, 0x8C], workspaceWrites: [{ index: 4, value: 3 }, { index: 5, value: 0x8C }] }), /workspace/);
  assert.deepEqual(memory.snapshot(), before);
});
