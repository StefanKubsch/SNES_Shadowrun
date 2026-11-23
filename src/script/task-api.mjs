// The task API of game code (docs/SCRIPT-VM-LIFT.md, phase 4). Game code reaches the
// script tasks only through it: the current task, the wait mask and event bits of a
// task, the task a waiting parent waits for, the script of a task, a new task for a
// script (80:C34A) and the reset of all tasks (80:C1A6).
//
// A task is named by its task word, the value objects keep in their task field
// (7E:1350): twice its slot (0-94), negative for none. Callers test the sign before
// they name a task; any other word stops at the frontier `task_slot_required`.
//
// Two implementations:
// - JsTasks over the JS scheduler (src/script/scheduler.mjs);
// - WramTasks over the original's task tables and heap in WRAM, for compatibility
//   fixtures and the frozen register-level references. The live game uses JsTasks.
//
// tasksOf(a) gives the tasks of an accessor: the JS scheduler's when one is attached to
// it (`a.tasks`), else the WRAM tables.
import { taskStop } from '../system/task-stop.mjs';
import { WRAM } from '../data/wram.mjs';
import { appendScriptTask } from '../game/task-append.mjs';
import { NONE, TASK_SLOTS, WAIT_FOR_CHILD } from './scheduler.mjs';
import { scriptArgumentWords } from './tasks.mjs';
import {
  HEAP_INITIAL_SIZE,
  HEAP_NEXT_WORD,
  HEAP_SIZE_WORD,
  TASK_CURSOR,
  TASK_EVENTS,
  TASK_FRAME,
  TASK_FREE_LIST,
  TASK_LIST_HEAD,
  TASK_NEXT,
  TASK_PREVIOUS,
  TASK_WAIT,
} from '../vm/layout.mjs';
import { LONG_MASK, WORD_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

export const NO_TASK = WORD_MASK;
// A parent waiting for its child task: wait mask bit 15 (80:C36A writes FFFFh).
const WAITS_FOR_CHILD = WAIT_FOR_CHILD & WORD_SIGN;
// The frame byte of the script's bank (frame bytes 0-2: the bytecode address).
const FRAME_CODE_BANK = 2;

const isTask = (task) =>
  Number.isInteger(task) && !(task & 1) && task >= 0 && task < 2 * TASK_SLOTS;
function slotOf(task) {
  if (!isTask(task)) taskStop('task_slot_required', { task });
  return task >>> 1;
}
const taskWord = (slot) => (slot === NONE ? NO_TASK : 2 * slot);

// The argument words a caller leaves for a new task in the words 7E:0000.. (as the
// original's caller does for 80:C34A), in the order the script pulls them.
export const argumentWords = (mem, script) =>
  Array.from({ length: scriptArgumentWords(mem, script) }, (_, n) => mem.read16(WRAM + 2 * n));

// The task that runs for `task`: a parent that waits for its child task stands for the
// child (the child sits before it in the task list), down to a task that does not wait
// for one. A chain longer than the task slots is a cycle, which the original follows
// forever.
export function waitingTask(tasks, task) {
  for (let links = 0; tasks.wait(task) & WAITS_FOR_CHILD; links++) {
    if (links === TASK_SLOTS) taskStop('task_chain_unbounded', { task });
    task = tasks.previous(task);
  }
  return task;
}
// ORs event bits into the task that runs for `task`; returns that task and its events.
export function sendEvents(tasks, task, bits) {
  const waiting = waitingTask(tasks, task),
    events = tasks.events(waiting) | bits;
  tasks.setEvents(waiting, events);
  return { task: waiting, events };
}

// The tasks of the JS scheduler.
export class JsTasks {
  constructor(scheduler) {
    this.scheduler = scheduler;
  }
  entry(task) {
    return this.scheduler.slots[slotOf(task)];
  }
  current() {
    return taskWord(this.scheduler.cursor);
  }
  previous(task) {
    return taskWord(this.entry(task).previous);
  }
  wait(task) {
    return this.entry(task).wait;
  }
  setWait(task, mask) {
    this.entry(task).wait = mask & WORD_MASK;
  }
  events(task) {
    return this.entry(task).events;
  }
  setEvents(task, bits) {
    this.entry(task).events = bits & WORD_MASK;
  }
  // The long address of the task's bytecode.
  code(task) {
    const { task: state } = this.entry(task);
    if (state === null) taskStop('task_slot_free', { task });
    return state.code;
  }
  // 80:C34A: a new task for `script` at the head of the task list; returns its word.
  append(script, args) {
    return taskWord(this.scheduler.append(script, args));
  }
  // 80:C1A6.
  reset() {
    this.scheduler.reset();
  }
}

// The original's task tables and heap in WRAM. The append takes a frame from the heap
// on the stack of accessor `a` (src/game/task-append.mjs).
export class WramTasks {
  constructor(a) {
    this.a = a;
    this.mem = a.mem;
  }
  word(table, task) {
    return this.mem.read16(WRAM + table + 2 * slotOf(task));
  }
  setWord(table, task, value) {
    this.mem.write16(WRAM + table + 2 * slotOf(task), value & WORD_MASK);
  }
  current() {
    return this.mem.read16(WRAM + TASK_CURSOR);
  }
  previous(task) {
    return this.word(TASK_PREVIOUS, task);
  }
  wait(task) {
    return this.word(TASK_WAIT, task);
  }
  setWait(task, mask) {
    this.setWord(TASK_WAIT, task, mask);
  }
  events(task) {
    return this.word(TASK_EVENTS, task);
  }
  setEvents(task, bits) {
    this.setWord(TASK_EVENTS, task, bits);
  }
  code(task) {
    const frame = this.word(TASK_FRAME, task),
      { mem } = this;
    return (
      mem.read16(WRAM + frame) |
      (mem.read8((WRAM + frame + FRAME_CODE_BANK) & LONG_MASK) << WORD_BITS)
    );
  }
  append(script, args) {
    args.forEach((value, n) => this.mem.write16(WRAM + 2 * n, value));
    return appendScriptTask(this.a, script);
  }
  // 80:C1A6: all slots in the free list, the task list empty, the heap one free block.
  reset() {
    const set = (offset, value) => this.mem.write16(WRAM + offset, value);
    set(TASK_FREE_LIST, 0);
    for (const offset of [TASK_LIST_HEAD, TASK_CURSOR, TASK_PREVIOUS]) set(offset, NO_TASK);
    for (let slot = TASK_SLOTS - 1; slot >= 0; slot--)
      set(TASK_NEXT + 2 * slot, slot === TASK_SLOTS - 1 ? NO_TASK : 2 * (slot + 1));
    set(HEAP_SIZE_WORD, HEAP_INITIAL_SIZE);
    set(HEAP_NEXT_WORD, 0);
  }
}

const WRAM_TASKS = new WeakMap();
export function tasksOf(a) {
  if (a.tasks) return a.tasks;
  let tasks = WRAM_TASKS.get(a);
  if (!tasks) WRAM_TASKS.set(a, (tasks = new WramTasks(a)));
  return tasks;
}

// 80:C34A for lifted callers without its JSR frame: the script as a parameter and its
// arguments in the words 00..; leaves no registers.
export function appendScript(a, script) {
  tasksOf(a).append(script, argumentWords(a.mem, script));
}
