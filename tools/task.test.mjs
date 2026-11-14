import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createScriptTask } from '../proof/script/task.mjs';

const original = JSON.parse(await readFile(new URL('../assets/scripts.json', import.meta.url), 'utf8'));
const script = (id, bytecode, argumentBytes = 0, returnBytes = 2, localBytes = 0) => ({ id, bytecode, argumentBytes, returnBytes, localBytes });
const bundle = (scripts, nativeFunctions = []) => ({ format: original.format, scripts, nativeFunctions });
const waitProfile = { id: 0x9F, argumentWords: 2, returnBytes: 2 };
const waitCode = (mask, timer) => [0x14, timer & 255, timer >>> 8, 0x14, mask & 255, mask >>> 8, 0x58, 0x9F, 0x56];
const waitingTask = (mask, timer) => {
  const task = createScriptTask(bundle([script(0, waitCode(mask, timer))], [waitProfile]), 0);
  task.run();
  return task;
};

test('Original European $04B waits five checks and then stops at the exact sound call', () => {
  const task = createScriptTask(original, 0x04B);
  const start = task.run();
  assert.equal(start.status, 'waiting');
  assert.deepEqual(start.wait, { scriptId: 0x04B, pc: 4, mask: 1, remaining: 5, events: 0 });
  assert.equal(start.steps, 3);
  for (let n = 1; n < 5; n++) {
    const state = task.tick();
    assert.equal(state.status, 'waiting');
    assert.equal(state.wait.remaining, 5 - n);
    assert.equal(state.steps, 3);
  }
  const state = task.tick();
  assert.equal(state.status, 'native_call');
  assert.deepEqual(state.pending, {
    requestId: 1, scriptId: 0x04B, pc: 0x0F, nativeId: 0x4C,
    args: [0xFFFF, 0x0038, 0x00FF, 0x0003], returnBytes: 0,
    reason: 'native_implementation_required',
  });
  assert.equal(state.steps, 9);
  assert.equal(state.checks, 5);
  assert.equal(state.frames[0].pc, 0x11);
  assert.equal(state.result, null); // No sound implementation: not completed.
  assert.deepEqual(task.run(), state);
  assert.throws(() => task.tick(), /not waiting/);
});

test('Script calls execute the original $197 and preserve the parent local word', () => {
  const wrapper = script(0x999, [0x14, 0xEF, 0xBE, 0x34, 0, 0x14, 0xB2, 8, 0x52, 0x97, 1, 0x16, 0, 0x5C, 0x56], 0, 2, 2);
  const task = createScriptTask({ ...original, scripts: [...original.scripts, wrapper] }, 0x999);
  const state = task.run();
  assert.equal(state.status, 'ended');
  assert.equal(state.result.value, 0xBEEE);
  assert.deepEqual([...state.result.locals], [0xEF, 0xBE]);
  assert.deepEqual(state.result.stack, []);
  assert.equal(state.steps, 14); // Seven wrapper instructions, seven in $197.
});

test('Two script arguments preserve stack order, while native arguments use pop order', () => {
  const assets = bundle([
    script(0, [0x14, 0x11, 0x11, 0x14, 0x22, 0x22, 0x52, 1, 0, 0x56]),
    script(1, [0x58, 2, 0x56], 4),
  ], [{ id: 2, argumentWords: 2, returnBytes: 2 }]);
  const task = createScriptTask(assets, 0);
  const blocked = task.run();
  assert.deepEqual(blocked.pending.args, [0x2222, 0x1111]);
  assert.equal(blocked.frames.length, 2);
  assert.deepEqual(blocked.frames.map(f => f.stack), [[], []]);
  assert.throws(() => task.completeNative(1, -1), /return value/);
  assert.deepEqual(task.snapshot(), blocked);
  assert.equal(task.completeNative(1, 0x3333).result.value, 0x3333);
  assert.throws(() => task.completeNative(1, 0x3333), /matching/);

  // A child subtraction independently checks order without a native boundary.
  assets.scripts[1] = script(1, [0x5E, 0x56], 4);
  assert.equal(createScriptTask(assets, 0).run().result.value, 0xEEEF);
});

test('Waiting child preserves parent state and resumes its parent in the waking pass', () => {
  const assets = bundle([
    script(0, [0x00, 7, 0x2C, 0, 0x00, 9, 0x52, 1, 0, 0xC2, 0x5C, 0x5C, 0x56], 0, 2, 1),
    script(1, waitCode(1, 2)),
  ], [waitProfile]);
  const task = createScriptTask(assets, 0);
  const suspended = task.run();
  assert.equal(suspended.frames.length, 2);
  assert.deepEqual(suspended.frames[0].stack, [9]);
  assert.deepEqual([...suspended.frames[0].locals], [7]);
  assert.equal(task.tick().status, 'waiting');
  const completed = task.tick();
  assert.equal(completed.status, 'ended');
  assert.equal(completed.result.value, 17); // 9 + timeout result 1 + local 7.
  assert.equal(completed.checks, 2);
});

test('Event and timer results combine; disabled events do not wake a waiter', () => {
  const task = waitingTask(0x0003, 2);
  const disabled = task.tick(0x4000);
  assert.equal(disabled.status, 'waiting');
  assert.equal(disabled.wait.remaining, 1);
  assert.equal(task.tick(2).result.value, 3); // Event and timer become ready together.
  const eventOnly = waitingTask(0x2002, 123);
  assert.equal(eventOnly.tick(0x6002).result.value, 0x2002);
  const disabledOnly = waitingTask(0x4000, 123);
  assert.equal(disabledOnly.tick(2).status, 'waiting');
  assert.equal(disabledOnly.snapshot().wait.remaining, 123); // Bit 0 disables the timer.
  assert.equal(disabledOnly.tick(0x4000).result.value, 0x4000);
  const earlyEvent = waitingTask(3, 10);
  assert.equal(earlyEvent.tick(2).result.value, 2);
});

test('Timer zero wraps and wakes only on its 65536th check', () => {
  const task = waitingTask(1, 0);
  assert.equal(task.tick().wait.remaining, 0xFFFF);
  for (let n = 1; n < 65535; n++) assert.equal(task.tick().status, 'waiting');
  assert.equal(task.snapshot().wait.remaining, 1);
  const finished = task.tick();
  assert.equal(finished.status, 'ended');
  assert.equal(finished.result.value, 1);
  assert.equal(finished.checks, 65536);
});

test('Reserved blocking bits skip timer and events, and zero mask removes the frame before any check', () => {
  for (const mask of [0x8003, 0x1003]) {
    const task = waitingTask(mask, 1);
    const state = task.tick(2);
    assert.equal(state.status, 'waiting');
    assert.equal(state.wait.remaining, 1);
    assert.equal(state.wait.events, 2);
  }
  const zero = waitingTask(0, 5).snapshot();
  assert.equal(zero.status, 'removed');
  assert.equal(zero.pending, null);
  assert.equal(zero.result, null);
  assert.equal(zero.checks, 0);
  assert.deepEqual(zero.frames, []);
  assert.deepEqual(zero.removedFrames, [{ scriptId: 0, pc: 6, reason: 'zero_mask_wait', workspaceWord: 0, parentReturnBytes: null }]);
});

test('Native completions require the current request ID and correct return profile', () => {
  const task = createScriptTask(bundle([script(0, [0x58, 2, 0x58, 2, 0x56], 0, 0)], [{ id: 2, argumentWords: 0, returnBytes: 0 }]), 0);
  const first = task.run();
  assert.throws(() => task.completeNative(first.pending.requestId, 0), /return value/);
  assert.deepEqual(task.snapshot(), first);
  const second = task.completeNative(1);
  assert.equal(second.pending.requestId, 2);
  assert.throws(() => task.completeNative(1), /matching/);
  assert.equal(task.completeNative(2).status, 'ended');
});

test('Zero-mask registration discards the root continuation and never fabricates an END result', () => {
  for (const timer of [0, 1, 0xFFFF]) {
    for (const returnBytes of [0, 2]) {
      const code = [0x14, 0xEF, 0xBE, ...waitCode(0, timer).slice(0, -1), 0x18, 0, 0, 0x56];
      const task = createScriptTask(bundle([script(0, code, 0, returnBytes)], [waitProfile]), 0);
      const state = task.run();
      assert.equal(state.status, 'removed');
      assert.equal(state.steps, 4);
      assert.equal(state.checks, 0);
      assert.equal(state.result, null); // The pre-existing $BEEF is not a return value.
      assert.equal(state.pending, null);
      assert.equal(state.removedFrames[0].pc, 9);
      assert.deepEqual(task.run(), state);
      assert.throws(() => task.tick(), /not waiting/);
      assert.throws(() => task.completeNative(1, 0), /matching/);
    }
  }
  // $9F yields out of the entire script frame, including local subroutines.
  const local = createScriptTask(bundle([script(0, [0x4C, 4, 0, 0x56, ...waitCode(0, 5).slice(0, -1), 0x50])], [waitProfile]), 0).run();
  assert.equal(local.status, 'removed');
  assert.equal(local.result, null);
  assert.equal(local.removedFrames[0].pc, 10);
});

test('Zero-mask child returns the written shared zero, preserves parent state and skips its own continuation', () => {
  const assets = bundle([
    script(0, [0x00, 7, 0x2C, 0, 0x00, 9, 0x00, 42, 0x52, 1, 0, 0xC2, 0x5C, 0x5C, 0x56], 0, 2, 1),
    // The child's argument remains on its stack; $0000 is instead set by
    // the native pop-argument mask. The unsupported continuation must not run.
    script(1, [...waitCode(0, 0xFFFF).slice(0, -1), 0x18, 0, 0, 0x56], 2, 2),
  ], [waitProfile]);
  const state = createScriptTask(assets, 0).run();
  assert.equal(state.status, 'ended');
  assert.equal(state.result.value, 16); // Saved 9 + child's shared zero + local 7.
  assert.deepEqual([...state.result.locals], [7]);
  assert.equal(state.checks, 0);
  assert.deepEqual(state.removedFrames, [{ scriptId: 1, pc: 6, reason: 'zero_mask_wait', workspaceWord: 0, parentReturnBytes: 2 }]);
});

test('A removed child with no return profile leaves the parent stack untouched', () => {
  const task = createScriptTask(bundle([
    script(0, [0x00, 42, 0x52, 1, 0, 0x56]),
    script(1, waitCode(0, 5), 0, 0),
  ], [waitProfile]), 0);
  const state = task.run();
  assert.equal(state.status, 'ended');
  assert.equal(state.result.value, 42);
  assert.equal(state.removedFrames[0].parentReturnBytes, 0);
});

test('A child removed after waking resumes its parent in that same check; request IDs remain intact', () => {
  const task = createScriptTask(bundle([
    script(0, [0x52, 1, 0, 0x58, 2, 0x5C, 0x56]),
    script(1, [...waitCode(1, 1).slice(0, -1), 0xBC, ...waitCode(0, 0).slice(0, -1), 0x18, 0, 0, 0x56]),
  ], [waitProfile, { id: 2, argumentWords: 0, returnBytes: 2 }]), 0);
  assert.equal(task.run().status, 'waiting');
  const state = task.tick();
  assert.equal(state.status, 'native_call');
  assert.equal(state.pending.scriptId, 0);
  assert.equal(state.pending.requestId, 1);
  assert.equal(state.checks, 1);
  assert.deepEqual(state.frames[0].stack, [0]);
  assert.equal(state.removedFrames[0].pc, 15);
  assert.equal(task.completeNative(1, 7).result.value, 7);
});

test('Removal records are snapshot copies, and a malformed wait ABI still faults before removal', () => {
  const task = waitingTask(0, 5);
  const state = task.snapshot();
  state.removedFrames[0].workspaceWord = 0xFFFF;
  state.removedFrames.length = 0;
  assert.equal(task.snapshot().removedFrames[0].workspaceWord, 0);
  const invalid = createScriptTask(bundle([script(0, waitCode(0, 5))], [{ ...waitProfile, returnBytes: 0 }]), 0);
  assert.throws(() => invalid.run(), /profile mismatch/);
  assert.equal(invalid.snapshot().frames.length, 1);
  assert.deepEqual(invalid.snapshot().removedFrames, []);
});

test('Snapshots cannot mutate live frames, pending arguments, wait state, or completion', () => {
  const task = waitingTask(1, 1);
  const state = task.snapshot();
  state.wait.remaining = 123;
  state.frames[0].stack.push(42);
  const done = task.tick();
  assert.equal(done.result.value, 1);
  done.result.stack.push(99);
  done.result.locals.fill(255);
  assert.deepEqual(task.snapshot().result.stack, []);
  const native = createScriptTask(bundle([script(0, [0x00, 7, 0x58, 2, 0x56], 0, 0)], [{ id: 2, argumentWords: 1, returnBytes: 0 }]), 0);
  const request = native.run();
  request.pending.args[0] = 42;
  assert.deepEqual(native.snapshot().pending.args, [7]);
});

test('Invalid IDs, profiles, missing implementations, stack underflow, and budgets fail explicitly', () => {
  const missing = createScriptTask(bundle([script(0, [0x52, 1, 0, 0x56])]), 0);
  assert.throws(() => missing.run(), /not found/);
  assert.equal(missing.snapshot().frames[0].pc, 0);
  const underflow = createScriptTask(bundle([script(0, [0x58, 2, 0x56])], [{ id: 2, argumentWords: 1, returnBytes: 2 }]), 0);
  assert.throws(() => underflow.run(), /underflow/);
  assert.equal(underflow.snapshot().frames[0].pc, 0);
  const recursive = createScriptTask(bundle([script(0, [0x52, 0, 0, 0x56], 0, 0)]), 0, [], { maxDepth: 3 });
  assert.throws(() => recursive.run(), /depth budget/);
  const loop = createScriptTask(bundle([script(0, [0x48, 0, 0], 0, 0)]), 0);
  assert.throws(() => loop.run({ maxSteps: 20 }), /instruction budget/);
  assert.equal(loop.snapshot().steps, 20);
  assert.equal(loop.snapshot().status, 'faulted');
  const unknown = createScriptTask(bundle([script(0, [0x18, 0, 0, 0x56])]), 0);
  assert.throws(() => unknown.run(), /not implemented/);
  const badWait = createScriptTask(bundle([script(0, waitCode(1, 2))], [{ ...waitProfile, returnBytes: 0 }]), 0);
  assert.throws(() => badWait.run(), /profile mismatch/);
  assert.equal(badWait.snapshot().frames[0].pc, 6);
  const invalid = waitingTask(1, 1);
  const before = invalid.snapshot();
  assert.throws(() => invalid.tick(65536), /event word/);
  assert.throws(() => invalid.tick(0, { maxSteps: 0 }), /step budget/);
  assert.deepEqual(invalid.snapshot(), before);
});

test('Wait and native ABI evidence is pinned to European machine-code bytes', async () => {
  const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
  const signatures = [
    [0x43C9, 'BDA20BF031302A890010D0256400857129FE6F3D620CF0028500A571890100F00CDE020CD007A901000400A571A500D00218609EA20B3860'],
    [0x4401, 'AE5002A5009DA20BA5029D020C9E620C689DB20260'],
    [0x74E3, '689D0000E8E888D0F7'],
    [0x430F, 'B9FEFFCA9500CA8888D0F58A'],
    [0x7526, 'AD000048'],
    [0x420B, 'AE5002BDA20B3026BD12038D5002BDA20BD0102096C3AE5002BDA20B10059EA20B80D0'],
    [0x42BD, 'A8B9D20329FF7F99D20360'],
    [0x74B2, 'AD000048A4034C89F3'],
    [0x74BE, '688D0000ADF2011BA900005B60'],
  ];
  for (const [offset, expected] of signatures) assert.equal(rom.subarray(offset, offset + expected.length / 2).toString('hex').toUpperCase(), expected);
  assert.equal(rom.readUInt16LE(0x157B8 + 0x9F * 2), 0xC401);
  assert.equal(rom[0x15A4C + 0x9F], 2);
  assert.equal(rom[0x15970 + 0x9F], 2);
  assert.equal(rom.readUInt16LE(0x157B8 + 0x4C * 2), 0xC46E);
  assert.equal(rom[0x15A4C + 0x4C], 4);
  assert.equal(rom[0x15970 + 0x4C], 0);
});
