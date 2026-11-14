import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createSlotMotionDirectionData } from '../proof/state/slot-motion-direction-data.mjs';
import { prepareMotionHelperC9E0 } from '../proof/state/slot-motion-helper-c9e0.mjs';
import { createSlotState } from '../proof/state/slots.mjs';
import { createSlotMotionData } from '../proof/state/slot-motion-data.mjs';
import { createSlotActionData } from '../proof/state/slot-action-data.mjs';
import { createSlotDefinitions } from '../proof/state/slot-definitions.mjs';
import { createSlotTargetData } from '../proof/state/slot-target-data.mjs';
import { createTaskFrameAllocator, createTaskFrameProfiles } from '../proof/script/task-frames.mjs';
import { createScriptScheduler } from '../proof/script/scheduler.mjs';
import { createScriptTask } from '../proof/script/task.mjs';
import { createScriptState } from '../proof/state/script-state.mjs';
import { createACState } from '../proof/state/ac-state.mjs';
import { visitTailWithState, sweepWithState } from '../proof/state/host.mjs';

const load = async name => JSON.parse(await readFile(new URL(`../assets/${name}.json`, import.meta.url), 'utf8'));
const asset = await load('slot-motion-direction-data'), directionData = createSlotMotionDirectionData(asset);
const actionAsset = await load('slot-action-data'), actionData = createSlotActionData(actionAsset);
const profiles = createTaskFrameProfiles(await load('task-frame-profiles')), original = await load('scripts');
const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const memory = () => createTaskFrameAllocator({ profileData: profiles });
const source = overrides => ({ '7E:40E0': 1, '7E:4138': 2, '7E:4190': 120, '7E:41E8': 120,
  '0E28': 100, '0E80': 100, '0ED8': 300, '0DD0': 0, '0D20': null, '0D78': null,
  '1458': 0, '1350': 0xFFFF, '1198': 0, '1038': 0xFFFF, '10E8': 0x80, ...overrides });
const helper = (fields = source(), options = {}) => prepareMotionHelperC9E0({ offset: 0, fields, directionData, directionBank: 0x80, ...options });
const make = (fields = source(), options = {}) => {
  const slots = createSlotState({ motionDirectionData: directionData, ...options });
  slots.seedSlotFields(0, Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== null))); return slots;
};
const emptyHeads = () => { const data = createSlotMotionData(); data.seed(0x7EDEAC, Array(512).fill(255)); data.seed(0x7EE0AC, Array(512).fill(255)); return data; };
const deltaSource = (x, y, overrides = {}) => source({ '0E28': 0x8000, '0E80': 0x8000, '7E:4190': 0x8000 + x, '7E:41E8': 0x8000 + y, ...overrides });
const dir = (x, y) => Math.abs(y) >= 2 * Math.abs(x) ? (y < 0 ? 4 : 0)
  : Math.abs(x) >= 2 * Math.abs(y) ? (x < 0 ? 6 : 2) : x < 0 ? (y < 0 ? 5 : 7) : (y < 0 ? 3 : 1);
const directions = [[0, 32], [32, 32], [32, 0], [32, -32], [0, -32], [-32, -32], [-32, 0], [-32, 32]];
const word = value => [0x14, value & 255, value >>> 8];
const waitCode = (mask, timer) => [...word(timer), ...word(mask), 0x58, 0x9F, 0x56];
const fixture = (root, child = null) => ({ ...original, scripts: original.scripts.map(s => s.id === 2 ? { ...s, bytecode: root } : s.id === 0x20 && child ? { ...s, bytecode: child } : s) });

test('C9E0 direction asset pins all64 original bytes; all inherited banks and65536 selection words preserve exact table choice', () => {
  assert.deepEqual(asset.bytes, Array.from(rom.subarray(0x47CC, 0x480C)));
  for (let bank = 0; bank < 256; bank++) for (let direction = 0; direction < 8; direction++) for (const selection of [0, 2, 0x8002, 0xFFFF]) for (const axis of [0, 1]) {
    const read = directionData.readMotionWord(direction, selection, axis, bank);
    if (bank === 0 || bank === 0x80) assert.equal(read.value, rom.readUInt16LE(0x47CC + (selection === 2 ? 32 : 0) + axis * 16 + direction * 2));
    else assert.deepEqual(read, { available: false, reason: 'slot_motion_direction_bank_required' });
  }
  for (let selection = 0; selection <= 0xFFFF; selection++) assert.equal(directionData.readMotionWord(2, selection, 0, 0).value, selection === 2 ? 4 : 2);
  assert.equal(directionData.readMotionWord(0, 2, 1, null).available, false);
  assert.notDeepEqual(rom.subarray(0x47CC, 0x480C), rom.subarray(0xC7CC, 0xC80C)); // Bank81 high ROM is a different page.
  for (const bad of [null, {}, { ...asset, bytes: Array(64) }, { ...asset, bytes: asset.bytes.slice(1) }, { ...asset, sourceCpu: '7E:C7CC' }]) assert.throws(() => createSlotMotionDirectionData(bad), /Invalid/);
  const copy = structuredClone(asset), data = createSlotMotionDirectionData(copy); copy.bytes.fill(0); assert.equal(data.readMotionWord(2, 2, 0, 0x80).value, 4);
});

test('Every timer word wraps exactly; early C9E0 returns need only4138/40E0 and body zero bypasses dispatch', () => {
  for (let timer = 0; timer <= 0xFFFF; timer++) {
    const fields = { '7E:4138': timer, '7E:40E0': timer }, result = helper(fields);
    if (timer === 1) assert.deepEqual(result, { handled: false, reason: 'slot_motion_source_required', field: '7E:4190' });
    else assert.deepEqual(result, { handled: true, fields: { '7E:40E0': Number((BigInt(timer) + 65535n) % 65536n) } });
  }
  const slots = make(source({ '7E:40E0': 0, '7E:4138': null, '0D20': 0, '0D78': 0 }));
  assert.deepEqual(slots.stepMotion(0), { handled: true });
  assert.equal(slots.snapshot().columns['7E:4138'][0], null);
  const minimal = createSlotState(); minimal.seedSlotFields(0, { '7E:40E0': 2, '7E:4138': 1 });
  assert.deepEqual(minimal.stepMotionHelperC9E0(0), { handled: true }); assert.equal(minimal.snapshot().columns['7E:40E0'][0], 1);
  assert.deepEqual(minimal.stepMotion(0), { handled: false, reason: 'slot_motion_source_required', field: '7E:4190' });
});

test('C80C covers every signed word including8000 and wrapped distance; D9 sign words retain negative differences', () => {
  for (let current = 0; current <= 0xFFFF; current++) {
    const difference = Number((32768n - BigInt(current) + 65536n) % 65536n);
    const magnitude = difference < 32768 ? difference : 65536 - difference;
    const plan = helper(source({ '0E28': current, '0E80': current, '7E:4190': 0x8000, '7E:41E8': 0x8000 }));
    assert.equal(plan.handled, true);
    assert.deepEqual(plan.targetScratchWords, { A8: difference >= 32768 ? difference : 0, AB: difference >= 32768 ? difference : 0, A2: magnitude, A5: magnitude });
    if ((magnitude * 2) % 65536 < 16) { assert.equal(plan.fields['0D20'], 0); assert.equal(plan.fields['7E:40E0'], 0); }
  }
  const wrapped = helper(deltaSource(0, 0, { '0E28': 0, '0E80': 0 })); assert.equal(wrapped.fields['0D78'], 0); assert.equal(wrapped.targetScratchWords.A2, 0x8000);
});

test('Targetslot mode reads each coordinate at source order, supports all44 slots and leaves unknown/outside targets atomic', () => {
  for (let offset = 0; offset <= 0x56; offset += 2) {
    const reads = []; const plan = helper(source({ '7E:4190': 0, '7E:41E8': offset }), { readTargetSlot: (target, field) => { reads.push([target, field]); return { available: true, value: field === '0E28' ? 132 : 100 }; } });
    assert.equal(plan.fields['0D20'], 2); assert.deepEqual(reads, [[offset, '0E28'], [offset, '0E80']]);
  }
  const calls = [];
  assert.equal(helper(source({ '0E28': null, '7E:4190': 0, '7E:41E8': 2 }), { readTargetSlot: (_, field) => { calls.push(field); return { available: true, value: 100 }; } }).field, '0E28');
  assert.deepEqual(calls, ['0E28']);
  for (const offset of [1, 0x58, 0xFFFF]) assert.equal(helper(source({ '7E:4190': 0, '7E:41E8': offset })).reason, 'slot_motion_target_window_required');
  const slots = make(source({ '7E:4190': 0, '7E:41E8': 2 })), before = slots.snapshot();
  assert.deepEqual(slots.stepMotion(0), { handled: false, reason: 'slot_motion_target_source_required', offset: 2, field: '0E28' }); assert.deepEqual(slots.snapshot(), before);
  slots.seedSlotFields(2, { '0E28': 132, '0E80': 100 }); const allocator = memory();
  assert.equal(slots.stepMotion(0, { directionBank: 0x80, frameAllocator: allocator }).handled, true);
});

test('C913 direction priority covers all four signs, inclusive half-ratio thresholds, distance15/16 and both original table pairs', () => {
  for (let x = -33; x <= 33; x++) for (let y = -33; y <= 33; y++) for (const selection of [2, 0xFFFF]) {
    const plan = helper(deltaSource(x, y, { '1038': selection })); assert.equal(plan.handled, true);
    if (Math.abs(x) + Math.abs(y) < 16) { assert.equal(plan.fields['0D20'], 0); assert.equal(plan.fields['0D78'], 0); continue; }
    const direction = dir(x, y), base = selection === 2 ? 0x47EC : 0x47CC;
    assert.equal(plan.fields['0D20'], rom.readUInt16LE(base + direction * 2));
    assert.equal(plan.fields['0D78'], rom.readUInt16LE(base + 16 + direction * 2));
    assert.equal(plan.fields['7E:40E0'], 2);
  }
});

test('Every even4138 word preserves asymmetric C9136A gate and saved direction independent of workspace', () => {
  for (let old = 0; old <= 0xFFFF; old += 2) for (const [direction, [x, y]] of directions.entries()) {
    const plan = helper(deltaSource(x, y, { '7E:4138': old, '1198': 9 })), call = old === 0 || Math.floor(old / 4) === direction;
    assert.equal(plan.handled, true); assert.equal(plan.fields['1198'], call ? direction : undefined);
    assert.equal(plan.fields['7E:4138'], old !== 0 && call ? undefined : direction * 4 + 2);
    assert.deepEqual(plan.workspaceWrites, [{ index: 0, value: 0 }, { index: 1, value: direction }]);
  }
});

test('All65536 prior flags affect only C84D bit8; thresholds11/12 switch axes without altering mode bit0', () => {
  for (let flags = 0; flags <= 0xFFFF; flags++) {
    const plan = helper(deltaSource(20, 20, { '7E:4138': 1, '1458': flags, '1198': 9 }));
    assert.equal(plan.fields['7E:40E0'], flags & 8 ? 30 : 2);
    assert.equal(plan.fields['7E:4138'], undefined); assert.equal(plan.fields['1198'], flags & 8 ? 0 : 2);
  }
  for (const mode of [1, 3, 0x8001, 0xFFFF]) for (const magnitude of [11, 12]) for (const sign of [-1, 1]) {
    const plan = helper(deltaSource(mode & 2 ? 40 : magnitude * sign, mode & 2 ? magnitude * sign : 40, { '7E:4138': mode, '1198': 9 }));
    assert.equal(plan.fields['7E:4138'], magnitude === 11 ? mode ^ 2 : undefined);
    assert.equal(plan.fields['1198'], magnitude === 11 ? (mode & 2 ? 2 : 0) : mode & 2 ? (sign < 0 ? 4 : 0) : (sign < 0 ? 6 : 2));
  }
});

test('C9E06A equality bypasses unused fields; byte path preserves unknown high byte and workspace gaps', () => {
  const allocator = memory(); allocator.writeWorkspaceWords([10, 11, 12, 13, 14, 15, 16, 17]);
  const slots = make(deltaSource(32, 32, { '7E:4138': 0, '1198': 0, '10E8': 1, '1090': 0x8000 }), { actionData });
  slots.seedSlotFieldByte(0, '11F0', 0, 200);
  assert.equal(slots.stepMotion(0, { directionBank: 0x80, frameAllocator: allocator }).handled, true);
  assert.deepEqual(allocator.snapshot().workspace, [0, 1, 12, 13, 0x8000, 0x8C, 16, 17]);
  assert.deepEqual(slots.snapshot().fieldBytes['11F0'][0], [(200 - rom[0x60000] + rom[0x60001]) & 255, null]);
  assert.equal(slots.snapshot().columns['11F0'][0], null);
  const equal = helper(deltaSource(32, 32, { '7E:4138': 0, '1198': 1, '10E8': null })); assert.equal(equal.handled, true); assert.equal(equal.fields['1198'], undefined);
});

test('C9E0 reuses full A985 writes and clobbered workspace, then chooses motion from the resulting1038/extents', () => {
  const slots = make(deltaSource(32, 0, { '7E:4138': 0, '1198': 0, '10E8': 0, '1038': 0x8002, '1458': 0x40 }), { actionData, motionData: emptyHeads() });
  slots.seedSlot(0, { definitionWord: 11, count: 0, head: 0 });
  const expected6A = createSlotState({ actionData }); expected6A.seedSlot(0, { definitionWord: 11, count: 0, head: 0, fields: { '1198': 0, '10E8': 0, '1038': 0x8002 } });
  const response = expected6A.applyNative({ nativeId: 0x6A, args: [0, 2], returnBytes: 0 }); assert.equal(response.handled, true);
  const allocator = memory(); allocator.writeWorkspaceWords([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(slots.stepMotion(0, { directionBank: 0x80, frameAllocator: allocator }).handled, true);
  assert.deepEqual(allocator.snapshot().workspace, [...response.workspaceWords, 7, 8]);
  const after = slots.snapshot(), expected = expected6A.snapshot();
  for (const key of ['1038', '1090', '11F0', '7E:4088', '10E8', '7E:3FD8', '1248', '7E:4240', '7E:4298', '7E:42F0', '7E:4348', '7E:43A0', '7E:4030', '1140']) assert.equal(after.columns[key][0], expected.columns[key][0]);
  assert.equal(after.columns['1038'][0], 2); assert.equal(after.columns['0D20'][0], 4); assert.equal(after.columns['0E28'][0], 0x8004);
  const lowerFirst = Number((BigInt(0x8004 / 4) + BigInt(expected.columns['7E:4240'][0])) % 65536n);
  assert.equal(after.motionSource.helperScratchWords['11'], lowerFirst); // Later80B2 uses the actual A985 extent, not the original unknown field.
});

test('Missing bank, tables, workspace or late action bytes prevent every C9E0 slot/scratch/byte/workspace effect', () => {
  for (const [options, context, reason] of [[{}, {}, 'slot_motion_direction_bank_required'], [{ motionDirectionData: null }, { directionBank: 0x80 }, 'slot_motion_direction_data_source_required'], [{}, { directionBank: 0x7E }, 'slot_motion_direction_bank_required'], [{}, { directionBank: 0x80 }, 'slot_motion_workspace_required']]) {
    const slots = make(source(), options), before = slots.snapshot(); assert.equal(slots.stepMotion(0, context).reason, reason); assert.deepEqual(slots.snapshot(), before);
  }
  for (const pointer of [0x7FFF, 0xFFFF]) {
    const slots = make(deltaSource(32, 32, { '7E:4138': 0, '1198': 0, '10E8': 1, '1090': pointer, '11F0': 20 }), { actionData });
    const allocator = memory(), before = slots.snapshot(), task = allocator.snapshot();
    assert.equal(slots.stepMotion(0, { directionBank: 0x80, frameAllocator: allocator }).reason, 'slot_action_data_window_required');
    assert.deepEqual(slots.snapshot(), before); assert.deepEqual(allocator.snapshot(), task);
  }
});

test('All44 C9E0 slots merge actual scratch/workspace writes with later five-helper body; prior bit8 is read before clearing', () => {
  for (let offset = 0; offset <= 0x56; offset += 2) {
    const slots = createSlotState({ motionDirectionData: directionData, motionData: emptyHeads() }), allocator = memory();
    const fields = deltaSource(32, 32, { '7E:4138': 1, '1198': 9, '1458': 0x48,
      '7E:4240': 0, '7E:4298': 0, '7E:42F0': 0, '7E:4348': 0, '7E:43A0': 0 });
    slots.seedSlotFields(offset, Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null)));
    assert.equal(slots.stepMotion(offset, { directionBank: 0x80, frameAllocator: allocator }).handled, true);
    const after = slots.snapshot(), i = offset / 2;
    assert.equal(after.columns['7E:40E0'][i], 30); assert.equal(after.columns['1458'][i], 0x40);
    assert.equal(after.columns['0D20'][i], 0); assert.equal(after.columns['0D78'][i], 2); assert.equal(after.columns['0E80'][i], 0x8002);
    assert.equal(after.motionSource.helperScratchWords['3E'], offset); assert.equal(after.targetSource.scratchWords.A2, 32);
    assert.equal(after.targetSource.scratchWords.AE, null); assert.deepEqual(allocator.snapshot().workspace.slice(0, 2), [offset, 0]);
    const negative = createSlotState({ motionDirectionData: directionData, motionData: emptyHeads() });
    negative.seedSlotFields(offset, Object.fromEntries(Object.entries({ ...fields, '7E:4138': 2, '1458': 0x40, '7E:4190': 0x7FE0, '7E:41E8': 0x7FE0 }).filter(([, v]) => v !== null)));
    assert.equal(negative.stepMotion(offset, { directionBank: 0, frameAllocator: allocator }).handled, true);
    const n = negative.snapshot();
    assert.equal(n.columns['0E28'][i], 0x7FFE); assert.equal(n.columns['0E80'][i], 0x7FFE);
    assert.equal(n.motionSource.helperScratchWords['32'], 30); assert.equal(n.motionSource.helperScratchWords['29'], 480); //8133 followed by8238.
    assert.equal(n.targetSource.scratchWords.A8, 0xFFE0); assert.equal(n.targetSource.scratchWords.AB, 0xFFE0);
  }
});

test('A missing later list or body field preserves planned timer, full6A fields, D9 scratch and allocator workspace', () => {
  const allocator = memory(); allocator.writeWorkspaceWords([10, 11, 12, 13, 14, 15, 16, 17]);
  const slots = make(deltaSource(32, 0, { '7E:4138': 0, '1198': 0, '10E8': 0, '1038': 2, '1458': 0x40 }), { actionData, motionData: createSlotMotionData() });
  slots.seedSlot(0, { definitionWord: 11, count: 0, head: 0 });
  const before = slots.snapshot(), task = allocator.snapshot();
  assert.equal(slots.stepMotion(0, { directionBank: 0x80, frameAllocator: allocator }).reason, 'slot_motion_data_source_required');
  assert.deepEqual(slots.snapshot(), before); assert.deepEqual(allocator.snapshot(), task);
  const stopped = make(deltaSource(0, 0, { '1350': 0, '0ED8': null })); allocator.seedMotionTaskWords(0, { statusWord: 0, eventWord: 0 });
  const stopBefore = stopped.snapshot(), stopTask = allocator.snapshot();
  assert.equal(stopped.stepMotion(0, { frameAllocator: allocator }).field, '0ED8'); assert.deepEqual(stopped.snapshot(), stopBefore); assert.deepEqual(allocator.snapshot(), stopTask);
});

test('Stop paths preserve unrelated words and OR4 at the first nonnegative linked task; negative initial1350 needs no owner', () => {
  const slots = make(deltaSource(0, 0)); assert.equal(slots.stepMotion(0).handled, true);
  const allocator = memory(); allocator.seedMotionTaskWords(0, { statusWord: 0xFFFF, successorWord: 2 }); allocator.seedMotionTaskWords(2, { statusWord: 0x8000, successorWord: 4 }); allocator.seedMotionTaskWords(4, { statusWord: 0, eventWord: 0x8002 });
  const stopped = make(deltaSource(0, 0, { '1350': 0 })), before = allocator.snapshot();
  assert.equal(stopped.stepMotion(0, { frameAllocator: allocator }).handled, true);
  const expected = structuredClone(before); expected.slots[2].eventWord = 0x8006; assert.deepEqual(allocator.snapshot(), expected);
  const after = stopped.snapshot(); assert.equal(after.columns['7E:40E0'][0], 0); assert.equal(after.columns['0D20'][0], 0); assert.equal(after.targetSource.scratchWords.A2, 0);
});

test('Unknown task status/link/flags, odd offsets, negative follow-up links and cycles abort the complete body without partial writes', () => {
  for (const [seed, reason] of [[[], 'slot_motion_task_word_source_required'], [[{ statusWord: 0xFFFF, successorWord: 2 }, { statusWord: 0xFFFF }], 'slot_motion_task_word_source_required'], [[{ statusWord: 0 }], 'slot_motion_task_word_source_required'], [[{ statusWord: 0xFFFF, successorWord: 0xFFFF }], 'slot_motion_task_window_required'], [[{ statusWord: 0xFFFF, successorWord: 0 }], 'slot_motion_task_cycle_required'], [[{ statusWord: 0xFFFF, successorWord: 2 }, { statusWord: 0xFFFF, successorWord: 0 }], 'slot_motion_task_cycle_required']]) {
    const allocator = memory(); seed.forEach((words, i) => allocator.seedMotionTaskWords(i * 2, words));
    const slots = make(deltaSource(0, 0, { '1350': 0 })), before = slots.snapshot(), task = allocator.snapshot();
    assert.equal(slots.stepMotion(0, { frameAllocator: allocator }).reason, reason); assert.deepEqual(slots.snapshot(), before); assert.deepEqual(allocator.snapshot(), task);
  }
  for (const offset of [1, 0x60]) assert.equal(helper(deltaSource(0, 0, { '1350': offset }), { frameAllocator: memory() }).reason, 'slot_motion_task_window_required');
  assert.equal(helper(deltaSource(0, 0, { '1350': 0 })).reason, 'slot_motion_task_source_required');
});

test('Actual task allocator0C62 owns wait events; C9E0 follows blocked parent to waiting child and wakes it only on the next readiness check', () => {
  const allocator = memory(), scheduler = createScriptScheduler(fixture([0x52, 0x20, 0, 0x56], waitCode(4, 10)), { frameAllocator: allocator });
  scheduler.addTask(2); scheduler.visitTail();
  const start = scheduler.snapshot(); assert.equal(start.tasks[0].checks, 0); assert.equal(allocator.snapshot().slots[0].statusWord, 0xFFFF);
  const slots = make(deltaSource(0, 0, { '1350': 0 })); assert.equal(slots.stepMotion(0, { frameAllocator: allocator }).handled, true);
  const after = scheduler.snapshot(); assert.equal(after.tasks[0].wait.events, 4); assert.equal(after.tasks[0].checks, 0); assert.equal(after.tasks[0].status, 'waiting');
  assert.equal(allocator.snapshot().slots[1].eventWord, 4); assert.deepEqual(allocator.snapshot().workspace, start.memory.workspace);
  const primed = scheduler.sweep(); assert.equal(primed.tasks[0].checks, 0);
  const done = scheduler.sweep(); assert.equal(done.tasks.length, 0); assert.equal(done.visits.at(-1).checks, 1);
  assert.equal(allocator.snapshot().slots[1].eventWord, 4); // Readiness clears status, not events.
  assert.equal(rom.subarray(0x4401, 0x4411).toString('hex'), 'ae5002a5009da20ba5029d020c9e620c');
  assert.equal(rom.subarray(0x43DC, 0x43DF).toString('hex'), '3d620c');
});

test('Shared task events preserve signals, blocking bits and timeout interactions; every new9F registration resets the actual event word', () => {
  for (const mask of [4, 5, 0x1004]) {
    const allocator = memory(), task = createScriptTask(fixture(waitCode(mask, 1)), 2, [], { frameAllocator: allocator }); task.run();
    task.signalEvents(2); allocator.writeMotionTaskEvents(0, allocator.readWaitEvents(0) | 4);
    assert.equal(task.snapshot().wait.events, 6); assert.equal(allocator.snapshot().slots[0].eventWord, 6);
    const after = task.tick();
    if (mask & 0x1000) { assert.equal(after.status, 'waiting'); assert.equal(after.wait.remaining, 1); }
    else assert.equal(after.status, 'ended');
  }
  const allocator = memory(), created = allocator.createFrame(0x10A); allocator.appendRoot(created.taskOffset);
  assert.equal(allocator.snapshot().slots[0].eventWord, null); allocator.registerWait(0, 4); allocator.signalWaitEvents(0, 7);
  allocator.registerWait(0, 0); assert.equal(allocator.snapshot().slots[0].eventWord, 0);
});

test('C9E0 inputs, branded providers, snapshots and field plans are validated/copied before effects', () => {
  const fields = source(), before = structuredClone(fields), plan = helper(fields); plan.fields['0D20'] = 999; plan.targetScratchWords.A2 = 999; assert.deepEqual(fields, before);
  for (const options of [{ directionData: {} }, { actionData: {} }, { frameAllocator: {} }, { directionBank: -1 }, { directionBank: 256 }, { lowByte: 256 }, { definitionWord: -1 }, { readTargetSlot: {} }]) assert.throws(() => helper(fields, options), /Invalid/);
  for (const key of ['7E:40E0', '7E:4138', '7E:4190', '7E:41E8', '0E28', '0E80']) assert.throws(() => helper(source({ [key]: -1 })), /Invalid/);
  assert.throws(() => createSlotState({ motionDirectionData: {} }), /Invalid/);
  const slots = make(source({ '7E:40E0': 2 })), state = slots.snapshot();
  for (const offset of [-1, 1.5, 65536]) assert.throws(() => slots.stepMotionHelperC9E0(offset), /Invalid/);
  for (const offset of [1, 0x58, 0xFFFF]) assert.deepEqual(slots.stepMotionHelperC9E0(offset), { handled: false, reason: 'slot_window_required' });
  assert.deepEqual(slots.snapshot(), state);
  const allocator = memory(); assert.throws(() => allocator.seedMotionTaskWords(0, { statusWord: 1, bogus: 2 }), /Invalid/); assert.equal(allocator.snapshot().slots[0].statusWord, null);
});

test('Task traversal covers all48 bounded offsets and every event WORD OR4 without treating negative links as termination', () => {
  const allocator = memory();
  for (let i = 0; i < 48; i++) allocator.seedMotionTaskWords(i * 2, { statusWord: i === 47 ? 0 : 0xFFFF, successorWord: (i + 1) * 2, eventWord: 0 });
  assert.deepEqual(helper(deltaSource(0, 0, { '1350': 0 }), { frameAllocator: allocator }).taskEventWrite, { offset: 94, value: 4 });
  for (let value = 0; value <= 0xFFFF; value++) {
    allocator.seedMotionTaskWords(94, { eventWord: value });
    const plan = helper(deltaSource(0, 0, { '1350': 94 }), { frameAllocator: allocator });
    assert.equal(plan.taskEventWrite.value, value + (Math.floor(value / 4) % 2 ? 0 : 4));
    assert.equal(allocator.snapshot().slots[47].eventWord, value); // Pure helper never commits the planned flag.
  }
});

test('C9E0 conditional missing fields and timer expiry followed by late body failure preserve every live owner', () => {
  const allocator = memory(); allocator.writeWorkspaceWords([1, 2, 3, 4, 5, 6, 7, 8]);
  for (const [fields, expected] of [
    [source({ '7E:4138': null }), '7E:4138'], [source({ '7E:4190': null }), '7E:4190'],
    [source({ '0E28': null, '7E:41E8': null }), '0E28'],
    [source({ '7E:41E8': null }), '7E:41E8'], [source({ '0E28': null }), '0E28'], [source({ '0E80': null }), '0E80'],
    [source({ '7E:4138': 1, '1458': null }), '1458'], [source({ '7E:4138': 0, '1198': null }), '1198'],
    [source({ '7E:4138': 0, '1198': 9, '10E8': null }), '10E8'], [source({ '1038': null }), '1038'],
    [deltaSource(0, 0, { '1350': null }), '1350'], [source({ '7E:40E0': 2, '1458': null }), '1458'],
  ]) {
    const slots = make(fields), before = slots.snapshot(), mem = allocator.snapshot();
    assert.deepEqual(slots.stepMotion(0, { directionBank: 0x80, frameAllocator: allocator }), { handled: false, reason: 'slot_motion_source_required', field: expected });
    assert.deepEqual(slots.snapshot(), before); assert.deepEqual(allocator.snapshot(), mem);
  }
  const low = helper(deltaSource(32, 32, { '7E:4138': 0, '1198': 0, '10E8': 1, '1090': 0x8000 }), { actionData });
  assert.equal(low.reason, 'slot_source_required');
});

test('Original252/217/D9 remains unchanged at zero timer and gains explicit synthetic C9E0 direction/stop probes without implicit waiter checks', async () => {
  const targetData = createSlotTargetData(await load('slot-target-data')), data = emptyHeads();
  const slots = createSlotState({ definitionData: createSlotDefinitions(await load('slot-definitions')), actionData, targetData, motionData: data, motionDirectionData: directionData });
  slots.seedTargetPointer(targetData.deriveF3From9D(0x99807E).pointer);
  const parent = slots.applyNative({ nativeId: 0xA9, args: [11, 123, 456, 64, 0xFFFF], returnBytes: 2 });
  const ac = createACState(); ac.seed(38, [0, 0]); const state = createScriptState({ byteLength: 0x58, slotState: slots, acState: ac }); state.seed(0x56, [0x38, 0x12]);
  const allocator = memory(), scheduler = createScriptScheduler(original, { frameAllocator: allocator }); scheduler.addTask(0x252, [0, 0, 0, 0, parent.value]);
  visitTailWithState(scheduler, state); sweepWithState(scheduler, state); sweepWithState(scheduler, state);
  const tasks = scheduler.snapshot(), mem = allocator.snapshot(); assert.equal(slots.stepMotion(0x54).handled, true);
  assert.deepEqual(scheduler.snapshot(), tasks); assert.deepEqual(allocator.snapshot(), mem);
  let s = slots.snapshot(); const x = s.columns['0E28'][42], y = s.columns['0E80'][42];
  slots.seedSlotFields(0x54, { '7E:40E0': 1, '7E:4138': 0, '7E:4190': x + 32, '7E:41E8': y + 32 });
  const previousChecks = scheduler.snapshot().tasks.map(t => t.checks), heap = allocator.snapshot().heap;
  assert.equal(slots.stepMotion(0x54, { directionBank: 0x80, frameAllocator: allocator }).handled, true);
  s = slots.snapshot(); assert.equal(s.columns['7E:40E0'][42], 2); assert.equal(s.columns['7E:4138'][42], 6);
  assert.deepEqual(scheduler.snapshot().tasks.map(t => t.checks), previousChecks); assert.deepEqual(allocator.snapshot().heap, heap);
  slots.seedSlotFields(0x54, { '7E:40E0': 1, '7E:4190': s.columns['0E28'][42], '7E:41E8': s.columns['0E80'][42] });
  assert.equal(slots.stepMotion(0x54, { frameAllocator: allocator }).handled, true);
  const linked = s.columns['1350'][42]; assert.equal(allocator.snapshot().slots[linked / 2].eventWord & 4, 4);
  assert.deepEqual(scheduler.snapshot().tasks.map(t => t.checks), previousChecks); assert.deepEqual(allocator.snapshot().heap, heap);
});

test('CLI labels synthetic C9E0 direction/stop fixtures, pins original-task results and rejects conflicting/missing dependencies', () => {
  const base = ['tools/run-slot-action-ac.mjs', '--fixture-no-audio', '--visit-spawned', '--fixture-target-9d', '--step-motion'];
  const run = flags => JSON.parse(execFileSync(process.execPath, [...base, ...flags], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  for (const stop of [false, true]) {
    const flag = stop ? '--fixture-motion-c9e0-stop' : '--fixture-motion-c9e0';
    const result = run(['--fixture-motion-empty-heads', flag]), p = result.motionProbe;
    assert.equal(p.response.handled, true); assert.match(p.c9e0Fixture.scope, /Synthetic/); assert.equal(p.c9e0Fixture.directionBank, 0x80);
    assert.deepEqual(['0E28', '0E80', '0ED8', '0F30'].map(k => p.after.fields[k]), stop ? [484, 1824, 1725, 1154] : [486, 1826, 1725, 1156]);
    assert.deepEqual(result.tasks.map(t => [t.wait.remaining, t.checks, t.wait.events]), [[19, 1, 0], [2912, 0, stop ? 4 : 0]]);
    assert.deepEqual(result.slots.targetSource.scratchWords, { A2: stop ? 0 : 32, A5: stop ? 0 : 32, A8: 0, AB: 0, AE: 0xFFFF, B1: 1456, B4: 51204, B7: 35844, BA: 4 });
    const failed = run([flag]).motionProbe; assert.equal(failed.response.reason, 'slot_motion_data_source_required'); assert.deepEqual(failed.after, failed.before);
  }
  for (const flags of [['--fixture-motion-c9e0', '--fixture-motion-c9e0-stop'], ['--fixture-motion-c9e0', '--fixture-motion-first-no-carry'], ['--fixture-motion-c9e0', '--fixture-motion-no-helpers']]) {
    assert.throws(() => run(flags), error => error.stderr.toString().includes('Usage:'));
  }
  assert.throws(() => execFileSync(process.execPath, ['tools/run-slot-action-ac.mjs', '--fixture-motion-c9e0'], { stdio: ['ignore', 'pipe', 'pipe'] }), error => error.stderr.toString().includes('Usage:'));
});
