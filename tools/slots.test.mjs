import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSlotState } from '../proof/state/slots.mjs';
import { createScriptState } from '../proof/state/script-state.mjs';
import { createScriptTask } from '../proof/script/task.mjs';
import { createScriptScheduler } from '../proof/script/scheduler.mjs';
import { runTaskWithState, visitTailWithState, sweepWithState } from '../proof/state/host.mjs';

const original = JSON.parse(await readFile(new URL('../assets/scripts.json', import.meta.url), 'utf8'));
const request = offset => ({ nativeId: 0xB9, args: [offset], returnBytes: 0 });
const seed = (slots, offset, count = 0, head = 0) => slots.seedSlot(offset, { definitionWord: 1, count, head });

test('Source initialization writes 44 free slots, exact list sentinel and non-contiguous pool links; other fields stay unknown', () => {
  const slots = createSlotState();
  const snapshot = slots.snapshot();
  assert.deepEqual(snapshot.definitions, Array(44).fill(0xFFFF));
  assert.deepEqual(snapshot.counts, Array(44).fill(null));
  assert.deepEqual(snapshot.heads, Array(44).fill(null));
  assert.ok(Object.values(snapshot.columns).every(column => column.every(value => value === null)));
  assert.equal(snapshot.activeList.lastOffset, 0xFFFE);
  assert.ok(snapshot.activeList.entries.every(value => value === null));
  assert.equal(snapshot.pool.freeCount, 64);
  assert.equal(snapshot.pool.freeHead, 2);
  assert.equal(snapshot.pool.links.length, 120);
  const chain = [];
  let node = 2;
  while (node <= 0xEE) { chain.push(node); node = snapshot.pool.links[node / 2]; }
  assert.equal(chain.length, 63);
  assert.deepEqual(chain.slice(0, 9), [2, 4, 6, 8, 10, 12, 14, 32, 34]);
  assert.equal(chain.at(-1), 0xEE);
  assert.equal(node, 0x100);
  snapshot.definitions[0] = 0;
  snapshot.pool.links[1] = 0;
  snapshot.columns['1090'][0] = 0;
  assert.equal(slots.snapshot().definitions[0], 0xFFFF);
  assert.equal(slots.snapshot().pool.links[1], 4);
  assert.equal(slots.snapshot().columns['1090'][0], null);
});

test('All 44 supported offsets reset the exact twelve columns and remove a sole entry without clearing stale storage', () => {
  const expected = { '7E:4240': 0, '7E:4298': 0, '7E:42F0': 0, '7E:4348': 0, '7E:43A0': 0, '7E:40E0': 0, '1140': 0, '7E:3F80': 0, '1090': 0, '1038': 0xFFFF, '7E:4030': 0x80, '7E:3FD8': 1 };
  for (let offset = 0; offset <= 0x56; offset += 2) {
    const slots = createSlotState();
    slots.seedSlot(offset, { definitionWord: 3, count: 0, head: 0xABCD, fields: Object.fromEntries(Object.keys(expected).map(key => [key, 0xCAFE])) });
    slots.seedActiveList([offset]);
    const pool = slots.snapshot().pool;
    assert.deepEqual(slots.applyNative(request(offset)), { handled: true, value: null });
    const after = slots.snapshot();
    assert.deepEqual(after.pool, pool); // Zero-count branch never touches pool/head.
    assert.equal(after.heads[offset / 2], 0xABCD);
    assert.equal(after.counts[offset / 2], 0);
    assert.equal(after.definitions[offset / 2], 0xFFFF);
    assert.equal(after.activeList.lastOffset, 0xFFFE);
    assert.equal(after.activeList.entries[0], offset);
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(after.columns[key][offset / 2], value);
      assert.ok(after.columns[key].every((entry, i) => i === offset / 2 || entry === null));
    }
  }
});

test('Reverse-search removal preserves prefix, shifts the original suffix and removes the newest matching duplicate', () => {
  for (const [remove, expected] of [[0, [2, 4, 6, 6]], [2, [0, 4, 6, 6]], [4, [0, 2, 6, 6]], [6, [0, 2, 4, 6]]]) {
    const slots = createSlotState();
    seed(slots, remove);
    slots.seedActiveList([0, 2, 4, 6]);
    slots.applyNative(request(remove));
    assert.equal(slots.snapshot().activeList.lastOffset, 4);
    assert.deepEqual(slots.snapshot().activeList.entries.slice(0, 4), expected);
  }
  const slots = createSlotState();
  seed(slots, 2);
  slots.seedActiveList([2, 0, 2, 4]);
  slots.applyNative(request(2));
  assert.deepEqual(slots.snapshot().activeList.entries.slice(0, 4), [2, 0, 4, 4]);
});

test('Nonempty owned chain is prepended to the free chain in exact source order, restoring canonical links', () => {
  const slots = createSlotState();
  const initial = slots.snapshot().pool;
  seed(slots, 0x34, 2, 4);
  slots.seedActiveList([0, 0x34, 0x56]);
  slots.seedPool({ count: 62, head: 6, linkWords: [{ offset: 4, next: 2 }, { offset: 2, next: 0 }] });
  slots.applyNative(request(0x34));
  assert.deepEqual(slots.snapshot().pool, initial);
  assert.equal(slots.snapshot().heads[0x1A], 0);
  assert.equal(slots.snapshot().counts[0x1A], 0);
  assert.deepEqual(slots.snapshot().activeList.entries.slice(0, 3), [0, 0x56, 0x56]);
});

test('Releasing all 63 reachable nodes preserves the original counter of 64 and outside final link 0100', () => {
  const slots = createSlotState();
  const initial = slots.snapshot().pool;
  const chain = [];
  for (let node = 2; node <= 0xEE; node = initial.links[node / 2]) chain.push(node);
  slots.seedPool({ count: 1, head: 0x100, linkWords: chain.map((offset, i) => ({ offset, next: i ? chain[i - 1] : 0 })) });
  seed(slots, 0, 63, 0xEE);
  slots.seedActiveList([0]);
  slots.applyNative(request(0));
  assert.deepEqual(slots.snapshot().pool, initial);
  assert.equal(slots.snapshot().heads[0], 0);
});

test('Freed counter wraps as a word, while the final owned-head link is retained rather than normalized', () => {
  const slots = createSlotState();
  slots.seedPool({ count: 0xFFFF, head: 0x20, linkWords: [{ offset: 2, next: 0xABCD }] });
  seed(slots, 0, 1, 2);
  slots.seedActiveList([0]);
  slots.applyNative(request(0));
  assert.equal(slots.snapshot().pool.freeCount, 0);
  assert.equal(slots.snapshot().pool.freeHead, 2);
  assert.equal(slots.snapshot().pool.links[1], 0x20);
  assert.equal(slots.snapshot().heads[0], 0xABCD);
});

test('Unknown counts, absent membership, unsupported offsets and uncovered chain reads retain all data without partial resets', () => {
  const slots = createSlotState();
  let before = slots.snapshot();
  assert.equal(slots.applyNative(request(0)).reason, 'slot_source_required');
  assert.deepEqual(slots.snapshot(), before);
  for (const offset of [1, 0x57, 0x58, 0xFFFF]) assert.equal(slots.applyNative(request(offset)).reason, 'slot_window_required');
  seed(slots, 0, 0);
  before = slots.snapshot();
  assert.equal(slots.applyNative(request(0)).reason, 'slot_membership_required');
  assert.deepEqual(slots.snapshot(), before);
  slots.seedActiveList([0]);
  for (const [count, head, linkWords] of [[1, 0x100, []], [1, 3, []], [2, 2, [{ offset: 2, next: 0x100 }]]]) {
    seed(slots, 0, count, head);
    slots.seedPool({ count: 10, head: 6, linkWords });
    before = slots.snapshot();
    assert.equal(slots.applyNative(request(0)).reason, 'pool_window_required');
    assert.deepEqual(slots.snapshot(), before);
  }
});

test('Malformed native/seed profiles and aliased script windows fail before mutating the supplied slot state', () => {
  const slots = createSlotState();
  const before = slots.snapshot();
  for (const args of [[], [1, 2], [-1], [65536], new Array(1)]) assert.throws(() => slots.applyNative({ nativeId: 0xB9, args, returnBytes: 0 }), /ABI mismatch/);
  assert.throws(() => slots.applyNative({ ...request(0), returnBytes: 2 }), /ABI mismatch/);
  assert.throws(() => slots.seedSlot(1, { definitionWord: 1, count: 0, head: 0 }), /slot seed/);
  assert.throws(() => slots.seedSlot(0, { definitionWord: 1, count: 0, head: 0, fields: { unknown: 3 } }), /slot seed/);
  assert.throws(() => slots.seedActiveList([0, 0x58]), /active-list seed/);
  assert.throws(() => slots.seedActiveList(new Array(1)), /active-list seed/);
  assert.throws(() => slots.seedPool({ count: 1, head: 2, linkWords: [{ offset: 0x100, next: 0 }] }), /pool seed/);
  assert.throws(() => createScriptState({ byteLength: 0x36E, slotState: slots }), /overlaps/);
  assert.throws(() => createScriptState({ byteLength: 2, slotState: {} }), /Invalid slot state/);
  assert.equal(slots.applyNative({ nativeId: 0xAE }).reason, 'native_implementation_required');
  assert.deepEqual(slots.snapshot(), before);
});

test('Original $060 ends with real $B9 effects on explicit occupied-slot fixtures; pending requests resume after sourcing', () => {
  for (const argument of [0, 0x1234, 0xAB56]) {
    const slots = createSlotState();
    const state = createScriptState({ byteLength: 0x32, slotState: slots });
    const task = createScriptTask(original, 0x060, [argument]);
    const blocked = runTaskWithState(task, state);
    assert.equal(blocked.handledCalls, 1);
    assert.deepEqual(blocked.boundary, { nativeId: 0xB9, reason: 'slot_source_required' });
    assert.equal(blocked.execution.pending.requestId, 2);
    const offset = argument & 255;
    seed(slots, offset);
    slots.seedActiveList([offset]); // Synthetic occupied-slot data, not an original scene.
    const ended = runTaskWithState(task, state);
    assert.equal(ended.handledCalls, 1);
    assert.equal(ended.actions[0].requestId, 2);
    assert.equal(ended.execution.status, 'ended');
    assert.equal(ended.execution.result.endPc, 0x0A);
    assert.equal(ended.execution.result.value, null);
    assert.deepEqual(ended.state.scriptWords.bytes.slice(0x2A, 0x2C), [0, 0]);
    assert.equal(ended.state.slots.activeList.lastOffset, 0xFFFE);
    assert.equal(ended.state.slots.columns['7E:4030'][offset / 2], 0x80);
    assert.deepEqual(ended.state.action56, { argumentWord: null, markerWord: null });
  }
});

test('Shared slot removals follow original task order and do not advance another waiter twice', () => {
  const scheduler = createScriptScheduler(original);
  const slots = createSlotState();
  seed(slots, 0x54);
  seed(slots, 0x56);
  slots.seedActiveList([0x54, 0x56]);
  const state = createScriptState({ byteLength: 0x32, slotState: slots });
  const spectator = scheduler.addTask(0x04B);
  visitTailWithState(scheduler, state);
  const older = scheduler.addTask(0x060, [0x54]);
  const newer = scheduler.addTask(0x060, [0x56]);
  sweepWithState(scheduler, state);
  const result = sweepWithState(scheduler, state);
  assert.equal(result.handledCalls, 4);
  assert.deepEqual(result.actions.filter(a => a.nativeId === 0xB9).map(a => a.taskId), [newer, older]);
  assert.equal(result.state.slots.activeList.lastOffset, 0xFFFE);
  assert.equal(result.execution.tasks.length, 1);
  assert.equal(result.execution.tasks[0].taskId, spectator);
  assert.equal(result.execution.tasks[0].checks, 1);
  assert.equal(result.execution.tasks[0].wait.remaining, 4);
});

test('The host budget covers $B9 and stops before its effect; resuming completes exactly the same request', () => {
  const slots = createSlotState();
  seed(slots, 0);
  slots.seedActiveList([0]);
  const before = slots.snapshot();
  const state = createScriptState({ byteLength: 0x32, slotState: slots });
  const task = createScriptTask(original, 0x060, [0]);
  assert.throws(() => runTaskWithState(task, state, { maxNativeCalls: 1 }), /budget exhausted/);
  assert.deepEqual(slots.snapshot(), before);
  const outcome = runTaskWithState(task, state, { maxNativeCalls: 1 });
  assert.equal(outcome.actions[0].requestId, 2);
  assert.equal(outcome.execution.status, 'ended');
});

test('Slot initialization, search and complete $B9 routines are pinned to this European ROM', async () => {
  const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
  const evidence = [
    [0xA779, 'A25600A9FFFF9F283F7ECACA10F8'],
    [0xA7CB, 'A9FEFF8DB0148582A940008D1C0DA902008D1E0DA2EE00188A1A1A850E291000F004650E8002A50E9D6415CACA10E96B'],
    [0x2835, 'A25800CACA100160BF283F7E10F5'],
    [0x289F, '9EA0129EF812'],
    [0x28F5, '204CAA'],
    [0x28F8, 'A600A9FFFF9F283F7EAEB014CEB014CEB014BDB214C500F00BCACABCB2149DB2149880F160'],
    [0x2A4C, 'A600A900009F40427E9F98427E9FF0427E9F48437E9FA0437E9FE0407E9D40119F803F7E9D9010A9FFFF9D3810A980009F30407EA901009FD83F7EBDA012F0228517186D1C0D8D1C0DBCF812B964159DF812AD1E0D8C1E0D996415C617D0EA9EA01260'],
  ];
  for (const [offset, code] of evidence) assert.equal(rom.subarray(offset, offset + code.length / 2).toString('hex').toUpperCase(), code);
  assert.equal(rom.readUInt16LE(0x157B8 + 0xB9 * 2), 0xA8F5);
  assert.equal(rom[0x15A4C + 0xB9], 1);
  assert.equal(rom[0x15970 + 0xB9], 0);
});
