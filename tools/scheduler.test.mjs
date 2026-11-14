import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createScriptScheduler } from '../proof/script/scheduler.mjs';

const original = JSON.parse(await readFile(new URL('../assets/scripts.json', import.meta.url), 'utf8'));
const script = (id, bytecode, returnBytes = 2) => ({ id, bytecode, argumentBytes: 0, returnBytes, localBytes: 0 });
const waitCode = (mask, count) => [0x14, count & 255, count >>> 8, 0x14, mask & 255, mask >>> 8, 0x58, 0x9F];
const assets = scripts => ({ format: original.format, scripts, nativeFunctions: [
  { id: 0x9F, argumentWords: 2, returnBytes: 2 },
  { id: 2, argumentWords: 0, returnBytes: 2 },
] });
const waiting = (id, count, mask = 1) => script(id, [...waitCode(mask, count), 0x56]);
const start = (scheduler, id) => {
  const taskId = scheduler.addTask(id);
  scheduler.visitTail();
  return taskId;
};

test('Append and immediate tail visit preserve the cursor; traversal begins only after priming', () => {
  const scheduler = createScriptScheduler(assets([waiting(0, 2), waiting(1, 2)]));
  const older = start(scheduler, 0);
  const newer = start(scheduler, 1);
  assert.equal(scheduler.snapshot().cursor, null);
  assert.deepEqual(scheduler.snapshot().tasks.map(t => t.checks), [0, 0]);
  assert.throws(() => scheduler.visitTail(), /newly appended/);
  assert.deepEqual(scheduler.sweep().visits, []);
  assert.deepEqual(scheduler.snapshot().cursor, { taskId: newer, depth: 0 });
  const pass = scheduler.sweep();
  assert.deepEqual(pass.visits.map(v => v.taskId), [newer, older]);
  assert.deepEqual(pass.tasks.map(t => t.wait.remaining), [1, 1]);
  const done = scheduler.sweep();
  assert.equal(done.status, 'idle');
  assert.equal(done.cursor, null);
  assert.deepEqual(done.visits.map(v => [v.taskId, v.value]), [[newer, 1], [older, 1]]);
  assert.deepEqual(scheduler.sweep().visits, []);
});

test('Newly appended roots wait for the next reset, and empty/single-node removal stays consistent', () => {
  const scheduler = createScriptScheduler(assets([waiting(0, 2), waiting(1, 2)]));
  const older = start(scheduler, 0);
  scheduler.sweep();
  const newer = start(scheduler, 1);
  assert.deepEqual(scheduler.snapshot().cursor, { taskId: older, depth: 0 });
  const pass = scheduler.sweep();
  assert.deepEqual(pass.visits.map(v => v.taskId), [older]);
  assert.deepEqual(pass.tasks.map(t => t.checks), [1, 0]);
  assert.deepEqual(pass.cursor, { taskId: newer, depth: 0 });
  const next = scheduler.sweep();
  assert.deepEqual(next.visits.map(v => [v.taskId, v.status]), [[newer, 'waiting'], [older, 'ended']]);
  assert.deepEqual(next.tasks.map(t => t.taskId), [newer]);
  assert.equal(scheduler.sweep().status, 'idle');
  const immediate = createScriptScheduler(assets([script(0, [0x00, 7, 0x56])]));
  immediate.addTask(0);
  assert.equal(immediate.visitTail().visits[0].value, 7);
  assert.equal(immediate.snapshot().status, 'idle');
});

test('Blocked parents are traversed after yielded children; child END resumes ancestors in the same visit', () => {
  const scheduler = createScriptScheduler(assets([
    waiting(0, 3),
    script(1, [0x00, 9, 0x52, 2, 0, 0x5C, 0x56]),
    waiting(2, 2),
  ]));
  const older = start(scheduler, 0);
  const parent = start(scheduler, 1);
  scheduler.sweep();
  const first = scheduler.sweep();
  assert.deepEqual(first.visits.map(v => [v.taskId, v.depth, v.status]), [
    [parent, 1, 'waiting'], [parent, 0, 'blocked_parent'], [older, 0, 'waiting'],
  ]);
  assert.equal(first.tasks[1].checks, 1);
  assert.deepEqual(first.tasks[1].frames[0].stack, [9]);
  const second = scheduler.sweep();
  assert.deepEqual(second.visits.map(v => [v.taskId, v.depth, v.status, v.value]), [
    [parent, 1, 'ended', 10], [older, 0, 'waiting', null],
  ]);
  assert.equal(scheduler.sweep().status, 'idle');
});

test('A new waiting child created during a waking visit is not checked again in the same sweep', () => {
  const scheduler = createScriptScheduler(assets([
    script(0, [0x52, 1, 0, 0xBC, 0x52, 2, 0, 0x56]),
    waiting(1, 1), waiting(2, 1),
  ]));
  const parent = start(scheduler, 0);
  scheduler.sweep();
  const switched = scheduler.sweep();
  assert.deepEqual(switched.visits.map(v => [v.depth, v.status]), [[1, 'waiting'], [0, 'blocked_parent']]);
  assert.equal(switched.tasks[0].checks, 1);
  assert.equal(switched.tasks[0].wait.remaining, 1);
  assert.equal(switched.tasks[0].frames[1].id, 2);
  const ended = scheduler.sweep();
  assert.deepEqual(ended.visits.map(v => [v.taskId, v.value]), [[parent, 1]]);
  assert.equal(ended.status, 'idle');
});

test('Events target a waiting leaf without advancing it; simultaneous timeout, bit-12 block and zero wrap remain exact', () => {
  const scheduler = createScriptScheduler(assets([waiting(0, 1, 3), waiting(1, 0), waiting(2, 1, 0x1003)]));
  const event = start(scheduler, 0);
  start(scheduler, 1);
  const blocked = start(scheduler, 2);
  scheduler.signalEvents(event, 2);
  scheduler.signalEvents(blocked, 2);
  assert.deepEqual(scheduler.snapshot().tasks.map(t => t.checks), [0, 0, 0]);
  scheduler.sweep();
  const pass = scheduler.sweep();
  assert.equal(pass.visits.at(-1).value, 3);
  assert.deepEqual(pass.tasks.map(t => [t.wait.remaining, t.wait.events]), [[0xFFFF, 0], [1, 2]]);
  assert.throws(() => scheduler.signalEvents(event, 2), /not found/);
});

test('An unknown native suspends the whole pass; completion continues without rechecking an earlier waiter', () => {
  const scheduler = createScriptScheduler(assets([
    waiting(0, 2), script(1, [...waitCode(1, 1), 0xBC, 0x58, 2, 0x56]), waiting(2, 3),
  ]));
  const older = start(scheduler, 0);
  const native = start(scheduler, 1);
  const newer = start(scheduler, 2);
  scheduler.sweep();
  const stopped = scheduler.sweep();
  assert.deepEqual(stopped.visits.map(v => v.taskId), [newer, native]);
  assert.equal(stopped.status, 'native_call');
  assert.equal(stopped.tasks[0].checks, 0);
  assert.equal(stopped.tasks[2].checks, 1);
  assert.equal(stopped.pending.taskId, native);
  assert.deepEqual(scheduler.sweep(), stopped);
  assert.deepEqual(scheduler.visitTail(), stopped);
  assert.throws(() => scheduler.addTask(0), /suspended/);
  assert.throws(() => scheduler.completeNative(older, 1, 7), /matching suspended/);
  assert.throws(() => scheduler.completeNative(native, 2, 7), /matching pending/);
  assert.throws(() => scheduler.completeNative(native, 1, -1), /return value/);
  assert.deepEqual(scheduler.snapshot(), stopped);
  assert.equal(scheduler.completeNative(native, 1, 7).visits.at(-1).value, 7);
  assert.deepEqual(scheduler.snapshot().cursor, { taskId: older, depth: 0 });
  const continued = scheduler.sweep();
  assert.deepEqual(continued.visits.map(v => v.taskId), [older]);
  assert.deepEqual(continued.tasks.map(t => t.checks), [1, 1]);
  assert.deepEqual(continued.cursor, { taskId: newer, depth: 0 });
});

test('Two original $04B tasks reach sound in newest-first order and preserve the unvisited older timer', () => {
  const scheduler = createScriptScheduler(original);
  const older = start(scheduler, 0x04B);
  const newer = start(scheduler, 0x04B);
  scheduler.sweep();
  for (let n = 0; n < 4; n++) scheduler.sweep();
  const sound = scheduler.sweep();
  assert.equal(sound.pending.taskId, newer);
  assert.equal(sound.pending.nativeId, 0x4C);
  assert.deepEqual(sound.pending.args, [0xFFFF, 0x38, 0xFF, 3]);
  assert.deepEqual(sound.tasks.map(t => [t.taskId, t.checks, t.wait?.remaining ?? null]), [[older, 4, 1], [newer, 5, null]]);
  assert.equal(sound.tasks[1].result, null);
});

test('An immediate native completion preserves the older cursor, even when another request follows', () => {
  const scheduler = createScriptScheduler(assets([
    waiting(0, 2), script(1, [0x58, 2, 0xBC, 0x58, 2, 0x56]),
  ]));
  const older = start(scheduler, 0);
  scheduler.sweep();
  const newer = scheduler.addTask(1);
  const stopped = scheduler.visitTail();
  assert.equal(stopped.pending.operation, 'tail');
  assert.deepEqual(stopped.cursor, { taskId: older, depth: 0 });
  const again = scheduler.completeNative(newer, 1, 7);
  assert.equal(again.pending.requestId, 2);
  assert.deepEqual(again.cursor, stopped.cursor);
  assert.throws(() => scheduler.completeNative(newer, 1, 7), /matching pending/);
  scheduler.completeNative(newer, 2, 8);
  const continued = scheduler.sweep();
  assert.deepEqual(continued.visits.map(v => v.taskId), [older]);
  assert.equal(continued.tasks[0].checks, 1);
});

test('Zero-mask roots are removed immediately without advancing other independent tasks', () => {
  const scheduler = createScriptScheduler(assets([waiting(0, 2), waiting(1, 5, 0)]));
  start(scheduler, 0);
  const zero = start(scheduler, 1);
  const removed = scheduler.snapshot();
  assert.equal(removed.status, 'ready');
  assert.equal(removed.pending, null);
  assert.deepEqual(removed.tasks.map(t => t.taskId), [1]);
  assert.equal(removed.tasks[0].checks, 0);
  assert.equal(removed.visits[0].taskId, zero);
  assert.equal(removed.visits[0].status, 'removed');
  assert.equal(removed.visits[0].value, null);
  assert.equal(removed.visits[0].removedFrames[0].reason, 'zero_mask_wait');
  assert.deepEqual(scheduler.sweep().visits, []);
  assert.equal(scheduler.sweep().tasks[0].wait.remaining, 1);
});

test('Snapshots and invalid requests cannot mutate the scheduler; unsupported negative waits and opcode failures stop it', () => {
  const scheduler = createScriptScheduler(assets([waiting(0, 2)]));
  start(scheduler, 0);
  scheduler.sweep();
  const copy = scheduler.snapshot();
  copy.cursor.depth = 99;
  copy.tasks[0].wait.remaining = 42;
  assert.equal(scheduler.snapshot().cursor.depth, 0);
  assert.equal(scheduler.sweep().tasks[0].wait.remaining, 1);
  const before = scheduler.snapshot();
  assert.throws(() => scheduler.sweep({ maxSteps: 0 }), /step budget/);
  assert.throws(() => scheduler.signalEvents(1, 0x10000), /event word/);
  assert.throws(() => scheduler.addTask(99), /not found/);
  assert.deepEqual(scheduler.snapshot(), before);
  for (const code of [[...waitCode(0x8001, 2), 0x56], [0x18, 0, 0, 0x56]]) {
    const invalid = createScriptScheduler(assets([script(0, code)]));
    invalid.addTask(0);
    assert.throws(() => invalid.visitTail(), /Negative wait mask|not implemented/);
    assert.equal(invalid.snapshot().status, 'faulted');
    assert.throws(() => invalid.sweep(), /Negative wait mask|not implemented/);
  }
});

test('Removal of a waking child continues through its parent and repairs the sweep before the older root', () => {
  const scheduler = createScriptScheduler(assets([
    waiting(0, 2),
    script(1, [0x00, 9, 0x52, 2, 0, 0x5C, 0x56]),
    script(2, [...waitCode(1, 1), 0xBC, ...waitCode(0, 0xFFFF), 0x18, 0, 0, 0x56]),
  ]));
  const older = start(scheduler, 0);
  const parent = start(scheduler, 1);
  scheduler.sweep();
  const pass = scheduler.sweep();
  assert.deepEqual(pass.visits.map(v => [v.taskId, v.status, v.value]), [[parent, 'ended', 9], [older, 'waiting', null]]);
  assert.equal(pass.visits[0].removedFrames[0].scriptId, 2);
  assert.deepEqual(pass.tasks.map(t => t.taskId), [older]);
  assert.equal(pass.tasks[0].checks, 1);
  assert.deepEqual(pass.cursor, { taskId: older, depth: 0 });
  pass.visits[0].removedFrames[0].workspaceWord = 42;
  assert.equal(scheduler.snapshot().visits[0].removedFrames[0].workspaceWord, 0);
  assert.equal(scheduler.sweep().status, 'idle');
});

test('Outer list, cursor reset, immediate visit and NMI wait are pinned to European ROM bytes', async () => {
  const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
  const signatures = [
    [0x41A6, '9C4E02A9FFFF8D4C028D50028D7203A25E009D12038ACACA10F8'],
    [0x41CA, 'AD500248AE4C028E5002300820F9C1F48080ABAB688D500260'],
    [0x41E3, 'AE5002300520F9C180F6AD4C028D5002F48080ABAB60'],
    [0x434D, 'AD4C029D1203A9FFFF9D72038AAE4C0230039D72038D4C0260'],
    [0x422F, 'AE5002BD12038D500260BD72038D5002AA80C6'],
    [0xB0A1, 'AF761C7ECF761C7EF0FA6B'],
    [0x4133, 'EE761C08224FC180'],
    [0x4109, '08866EE2108470286B'],
    [0x1663, 'A252C1A080002209C180E220A9818D0042'],
    [0x16AB, '22A1B0812277888122768081201A9E206DBE203BBF20E3C1200080B0E3'],
    [0x11D1, '204AC320CAC160'],
  ];
  for (const [offset, expected] of signatures) assert.equal(rom.subarray(offset, offset + expected.length / 2).toString('hex').toUpperCase(), expected);
});
