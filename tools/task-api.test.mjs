// Script VM lift phase 4 (docs/SCRIPT-VM-LIFT.md): the task API of game code
// (src/script/task-api.mjs) on the WRAM tables and on the JS scheduler. Random sequences
// of API calls (appends, wait masks with halts and child waits, events, the task that
// runs for a waiting parent, the script of a task, resets) run on WramTasks over one
// WRAM and on JsTasks over a scheduler loaded from a copy of it by the conversion layer
// (tools/task-layout.mjs). Every call must return the same value or stop at the
// same frontier, and the projection of the JS state must equal the tables and heap of the
// WRAM side after every call (frame locals excepted: C2C8 leaves heap residue there).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VmMemory } from '../src/vm/memory.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { createTask } from '../src/script/tasks.mjs';
import { TASK_SLOTS, WAIT_HALTED } from '../src/script/scheduler.mjs';
import { JsTasks, WramTasks, sendEvents, waitingTask } from '../src/script/task-api.mjs';
import { loadScheduler } from './task-layout.mjs';

const rom = new Uint8Array(readFileSync(new URL('../Shadowrun (E).smc', import.meta.url)));
const SCRIPT_COUNT = 937,
  WRAM_BYTES = 0x20000,
  OUTER_S = 0x1c80,
  CODE_BANK = 0x80,
  SEEDS = 200,
  CALLS = 120;

function prng(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Scripts a task can be created for (even argument bytes, frame size without carry).
const scratch = new VmMemory(rom, new Uint8Array(WRAM_BYTES));
const STARTABLE = [];
for (let id = 0; id < SCRIPT_COUNT; id++) {
  try {
    const args = scratch.read8(0x82e9cc + id) >>> 1;
    createTask(scratch, id, new Array(args).fill(0));
    STARTABLE.push({ id, args });
  } catch (error) {
    if (!error?.taskBoundary) throw error;
  }
}

function accessor(mem) {
  const a = new TaskAccessor({ mem });
  Object.assign(a.ctx, { e: 0, d: 0, bank: CODE_BANK, s: OUTER_S, status: 0 });
  return a;
}
// The value of a call, or the frontier it stops at.
function outcome(run) {
  try {
    return { value: run() };
  } catch (error) {
    if (!error?.taskBoundary) throw error;
    return { stop: error.reason };
  }
}

function scenario(seed) {
  const rnd = prng(seed),
    below = (n) => (rnd() * n) | 0,
    initial = new Uint8Array(WRAM_BYTES);
  for (let n = 0; n < WRAM_BYTES; n++) initial[n] = below(0x100);
  const memA = new VmMemory(rom, initial.slice()),
    memB = new VmMemory(rom, initial.slice()),
    wram = new WramTasks(accessor(memA)),
    setup = new WramTasks(accessor(memB));
  wram.reset();
  setup.reset();
  const layout = loadScheduler(memB, memB.wram),
    js = new JsTasks(layout.scheduler),
    live = [];
  const task = () =>
    below(8) === 0 ? 2 * below(TASK_SLOTS) : live.length ? live[below(live.length)] : 0;
  for (let n = 0; n < CALLS; n++) {
    const r = rnd();
    let call;
    if (r < 0.3) {
      const script = STARTABLE[below(STARTABLE.length)],
        args = Array.from({ length: script.args }, () => below(0x10000));
      call = (tasks) => tasks.append(script.id, args);
    } else if (r < 0.45) {
      const t = task(),
        mask = [0, 0xffff, 0x8000 | below(0x8000), below(0x10000)][below(4)];
      call = (tasks) => tasks.setWait(t, mask);
    } else if (r < 0.6) {
      const t = task(),
        halt = below(2) === 0;
      call = (tasks) => {
        const waiting = waitingTask(tasks, t),
          wait = tasks.wait(waiting);
        tasks.setWait(waiting, halt ? wait | WAIT_HALTED : wait & ~WAIT_HALTED);
        return waiting;
      };
    } else if (r < 0.8) {
      const t = task(),
        bits = below(0x10000);
      call = (tasks) => sendEvents(tasks, t, bits);
    } else if (r < 0.9) {
      // A free slot has no script and may keep a link word C1A6 never wrote (the WRAM
      // side reads stale words there).
      const t = task(),
        used = live.includes(t);
      call = (tasks) => [
        tasks.wait(t),
        tasks.events(t),
        used ? tasks.previous(t) : null,
        used ? tasks.code(t) : null,
      ];
    } else if (r < 0.92) {
      call = (tasks) => tasks.reset();
    } else {
      call = (tasks) => tasks.current();
    }
    const a = outcome(() => call(wram)),
      b = outcome(() => call(js));
    assert.deepEqual(b, a, `seed ${seed} call ${n}`);
    if (r < 0.3 && a.value !== undefined) live.push(a.value);
    if (r >= 0.9 && r < 0.92) live.length = 0;
    for (const [at, value] of layout.project({ includeLocal: () => false }))
      assert.equal(value, memA.wram[at], `seed ${seed} call ${n}: 7E:${at.toString(16)}`);
  }
  return live.length;
}

test('the task API gives the same results and task state on the WRAM tables and the JS scheduler', () => {
  let appended = 0;
  for (let seed = 1; seed <= SEEDS; seed++) appended += scenario(seed);
  assert.ok(appended > SEEDS * 10, `appended tasks ${appended}`);
});
