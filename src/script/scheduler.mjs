// Task scheduler of the script VM over JS tasks (docs/SCRIPT-VM-LIFT.md, phase 2), lifted
// from bank 80 (register-level form: proof/vm/scheduler.mjs):
//
//   C1A6 init     C1CA head visit   C1E3 round      C1F9 visit     C20B after a task
//   C2C8 frame    C34A append       C36A child      C396 release   C3C9 ready check
//   C401 native wait                F488 script call  F495/F509 resumption
//
// The 48 slots keep the original's tables as plain fields: the task, the links of the
// task list (the free list reuses `next`), the wait mask, the frame counter, the event
// bits and the continuation. Slots are numbered 0-47 (the original indexes with 2 * slot)
// and NONE stands for FFFFh. A slot keeps its counter and events when it is reused, as
// the original does; game code addresses tasks by slot (objects, events, halts).
//
// The game needs no heap: the frame of a task is its JS state. The optional observers
// onCreate(slot, task) and onRelease(slot, task) let the conversion layer in proof/
// replay the original heap allocation in the same order.
//
// Natives may pause (phase 3): the native callback then returns a pending call, which
// becomes the slot's `native` until it finishes. The round, the nested visit and the
// task run are generators that yield while a native pauses; round() and visitHead() run
// them to the end, beginRound() and continueRound() hand each pause to the caller.
import { taskStop } from '../system/task-stop.mjs';
import { createTask, finishCall, stepTask, EXIT_END, CALL_SCRIPT } from './tasks.mjs';
import { SCRIPTS } from '../scripts/index.mjs';
import { NATIVE_POINTERS } from '../vm/layout.mjs';
import { BYTE_SIGN, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

export const TASK_SLOTS = 48;
export const NONE = -1;
// Wait mask (C3C9): 0 ready, bit 15 waits for a child task (C36A writes FFFFh), bit 12
// halts the task, bit 0 waits for the counter, the bits of 6FFEh wait for events.
export const WAIT_FOR_CHILD = WORD_MASK;
export const WAIT_HALTED = 0x1000;
export const WAIT_COUNTER = 1;
export const WAIT_EVENTS = 0x6ffe;
// Continuations: the original saves the return word F494 (resume after a child task,
// F495) or F508 (resume after the native wait, F509); null enters the task at its PC.
export const RESUME_CHILD = 'child';
export const RESUME_WAIT = 'wait';

// Native C401 suspends the task until its wait mask is met.
const WAIT_NATIVE = 0xc401;
// A ready check that leaves the task suspended.
const NOT_READY = -1;
// Cyclic task lists hang the original; stop instead.
const LOOP_LIMIT = 0x10000;

const isWaitNative = (mem, id) => mem.read16(NATIVE_POINTERS + 2 * id) === WAIT_NATIVE;

// A pending native call: resume() continues it and returns true once it has returned,
// with its result word in `result`.
export const isPendingNative = (value) =>
  value !== null && typeof value === 'object' && typeof value.resume === 'function';

// Runs a scheduler generator to its end; a native that pauses here has no caller to
// hand the pause to.
function finish(steps) {
  for (;;) {
    const { done, value } = steps.next();
    if (done) return value;
    taskStop('script_native_paused_synchronously');
  }
}

// C1A6: every slot free (free list 0, 1, ..., 47), the task list empty.
function freeSlot(next) {
  return {
    task: null,
    next,
    previous: NONE,
    wait: 0,
    counter: 0,
    events: 0,
    continuation: null,
    native: null, // the pending call of a native that paused
  };
}

export class Scheduler {
  // native(id, args, scheduler, slot) runs a script native other than the wait and
  // returns its result word (null when it leaves none) or a pending call when it paused.
  // scripts: the script generators by number (the decompiled scripts by default).
  constructor(
    mem,
    { native = null, onCreate = null, onRelease = null, onReset = null, scripts = SCRIPTS } = {},
  ) {
    this.mem = mem;
    this.scripts = scripts;
    this.native = native;
    this.onCreate = onCreate;
    this.onRelease = onRelease;
    this.onReset = onReset;
    this.slots = Array.from({ length: TASK_SLOTS }, (_, n) =>
      freeSlot(n + 1 < TASK_SLOTS ? n + 1 : NONE),
    );
    this.head = NONE;
    this.free = 0;
    this.cursor = NONE; // the task being visited
    this.running = new Set(); // slots whose script runs (a native may visit others)
    this.job = null; // a round paused by a native (beginRound)
    // A task keeps its JS generator across child and counter/event suspension.
    // Weak keys also let reset, release and proof-import replacement discard it.
    this.coroutines = new WeakMap();
    this.tasks = null; // the task API over this scheduler (task-api.mjs JsTasks)
  }

  // C1A6: every slot free (free list 0, 1, ..., 47), the task list empty. The wait
  // masks, counters and events stay, as do the links C1A6 does not write; slot 0 has no
  // previous task. A task whose bytecode runs would go on in a freed slot.
  reset() {
    if (this.running.size !== 0 || this.job !== null) taskStop('task_reset_while_running');
    this.slots.forEach((entry, n) => {
      entry.task = null;
      entry.next = n + 1 < TASK_SLOTS ? n + 1 : NONE;
    });
    this.slots[0].previous = NONE;
    this.head = this.cursor = NONE;
    this.free = 0;
    this.onReset?.();
  }

  // A round that hands native pauses to the caller: true while it is paused;
  // continueRound() goes on with it.
  beginRound() {
    if (this.job !== null) taskStop('script_round_paused');
    this.job = this.rounds();
    return this.continueRound();
  }
  continueRound() {
    if (this.job === null) taskStop('script_round_not_paused');
    if (!this.job.next().done) return true;
    this.job = null;
    return false;
  }

  // C34A: a new task for `script` at the head of the task list; returns its slot.
  // `args` in the order a calling script pulls them (args[0] is the word at 7E:0000).
  append(script, args = []) {
    const slot = this.allocate(script, args),
      entry = this.slots[slot];
    entry.next = this.head;
    entry.previous = NONE;
    if (this.head !== NONE) this.slots[this.head].previous = slot;
    this.head = slot;
    return slot;
  }

  // C1E3: visit the tasks from the cursor to the end of the list, then rewind the cursor.
  round() {
    finish(this.rounds());
  }
  *rounds() {
    for (let n = 0; this.cursor !== NONE; n++) {
      if (n >= LOOP_LIMIT) taskStop('original_endless_loop', { slot: this.cursor });
      yield* this.visit(this.cursor);
    }
    this.cursor = this.head;
  }

  // C1CA: visit the head task (natives such as the dialog run it at once after C34A),
  // then restore the cursor.
  visitHead() {
    finish(this.headVisit());
  }
  *headVisit() {
    const saved = this.cursor;
    this.cursor = this.head;
    if (this.head !== NONE) yield* this.visit(this.head);
    this.cursor = saved;
  }

  // C1F9: run the task if it is ready, otherwise move the cursor on.
  *visit(slot) {
    if (this.running.has(slot)) taskStop('task_reentered', { slot });
    const value = this.ready(slot);
    if (value === NOT_READY) this.cursor = this.slots[slot].next;
    else yield* this.resume(slot, this.slots[slot].continuation, value);
  }

  // C3C9: NOT_READY, or the word the original leaves at 7E:0000 for a waiting native's
  // result: the met event bits, bit 0 for an expired counter. A wait mask cleared
  // outside the scheduler leaves that word undefined (null).
  ready(slot) {
    const entry = this.slots[slot],
      wait = entry.wait;
    if (wait === 0) return null;
    if (wait & (WORD_SIGN | WAIT_HALTED)) return NOT_READY;
    let value = wait & WAIT_EVENTS & entry.events;
    if (wait & WAIT_COUNTER) {
      // Bit 0 counts down on every check, also after the events are met.
      entry.counter = (entry.counter - 1) & WORD_MASK;
      if (entry.counter === 0) value |= WAIT_COUNTER;
    }
    if (value === 0) return NOT_READY;
    entry.wait = 0;
    return value;
  }

  // C1FE with the tail C20B: run the task, start the child task it called at once, and
  // after a task ends, free it and resume the parent task waiting behind it.
  *resume(slot, continuation, value) {
    let current = slot,
      how = continuation,
      input = value;
    for (let n = 0; ; n++) {
      if (n >= LOOP_LIMIT) taskStop('original_endless_loop', { slot: current });
      const exit = yield* this.run(current, how, input);
      // C20B reads the cursor; a native's nested visit restores it.
      const at = this.cursor,
        entry = this.slots[at];
      if (entry.wait & WORD_SIGN) {
        // C239: the task called a script; its child sits before it.
        this.cursor = current = entry.previous;
        how = null;
        continue;
      }
      this.cursor = entry.next;
      if (entry.wait !== 0) {
        // A task that ended while its wait mask was set (a halt from a native) stays in
        // the list; the original would resume it after its last call.
        if (exit.ended) taskStop('task_ended_waiting', { slot: at });
        return;
      }
      // C21E: the task ended (or waited with mask 0): free it.
      this.release(at);
      const next = this.cursor;
      if (next === NONE) {
        // C224 reads the word at 7E:0BA1 instead: the last heap byte and the low byte of
        // slot 0's wait mask. Its sign would resume a task at slot FFFFh.
        if (this.slots[0].wait & BYTE_SIGN) taskStop('task_list_end_resume', { slot: at });
        return;
      }
      const parent = this.slots[next];
      if (!(parent.wait & WORD_SIGN)) return;
      parent.wait = 0;
      current = next;
      how = parent.continuation;
      input = exit.word;
    }
  }

  // Drive the same coroutine on every visit. `how` remains diagnostic metadata
  // for the frozen projection and observers; it does not select a resume path.
  *run(slot, how, input) {
    const entry = this.slots[slot],
      task = entry.task;
    if (task === null) taskStop('task_slot_free', { slot });
    let coroutine = this.coroutines.get(task);
    if (!coroutine) {
      // A proof adapter can import a task already suspended at F495/F509.
      if (task.call !== null && how === null) taskStop('task_call_pending', { slot });
      coroutine = this.taskCoroutine(slot, task, input);
      this.coroutines.set(task, coroutine);
    }
    this.running.add(slot);
    try {
      let next = coroutine.next(input);
      while (!next.done) {
        // Native work-budget pauses yield undefined. Script waits and child
        // calls yield their scheduler result and retain their generator position.
        if (next.value !== undefined) return next.value;
        yield;
        next = coroutine.next();
      }
      this.coroutines.delete(task);
      return next.value;
    } finally {
      this.running.delete(slot);
    }
  }

  *taskCoroutine(slot, task, importedInput) {
    const entry = this.slots[slot];
    if (task.call !== null) finishCall(this.mem, task, importedInput);
    for (;;) {
      const exit = stepTask(this.mem, task, this.scripts);
      if (exit.kind === EXIT_END) return { ended: true, word: exit.result };
      if (exit.kind === CALL_SCRIPT) {
        this.child(exit.id, exit.args);
        const result = yield { ended: false, word: null };
        finishCall(this.mem, task, result);
        continue;
      }
      if (isWaitNative(this.mem, exit.id)) {
        // C401: the mask and counter from the words 00 and 02, events cleared.
        const [mask, counter] = exit.args;
        if (counter === undefined) taskStop('task_wait_arguments', { slot });
        const waiting = this.slots[this.cursor];
        waiting.wait = mask;
        waiting.counter = counter;
        waiting.events = 0;
        waiting.continuation = RESUME_WAIT;
        const result = yield { ended: false, word: mask };
        finishCall(this.mem, task, result);
        continue;
      }
      if (this.native === null) taskStop('script_native_required', { native: exit.id });
      finishCall(this.mem, task, yield* this.callNative(entry, exit.id, exit.args, slot));
    }
  }

  // A native call; a native that pauses stays the slot's continuation until it returns.
  *callNative(entry, id, args, slot) {
    const result = this.native(id, args, this, slot);
    if (!isPendingNative(result)) return result;
    entry.native = result;
    try {
      while (!result.resume()) yield;
    } finally {
      entry.native = null;
    }
    return result.result;
  }

  // C36A (from F488): a child task for `script` linked in before the current task,
  // which waits for it and resumes at F495.
  child(script, args) {
    const slot = this.allocate(script, args),
      entry = this.slots[slot],
      parent = this.slots[this.cursor];
    entry.next = this.cursor;
    entry.previous = parent.previous;
    parent.previous = slot;
    parent.wait = WAIT_FOR_CHILD;
    parent.continuation = RESUME_CHILD;
    if (entry.previous === NONE) this.head = slot;
    else this.slots[entry.previous].next = slot;
  }

  // C2C8: a task in the first free slot; its wait mask and continuation start cleared,
  // its counter and events stay as the slot's last task left them.
  allocate(script, args) {
    const task = createTask(this.mem, script, args),
      slot = this.free;
    if (slot === NONE) taskStop('task_slot_required', { script });
    this.onCreate?.(slot, task);
    const entry = this.slots[slot];
    this.free = entry.next;
    entry.task = task;
    entry.wait = 0;
    entry.continuation = null;
    return slot;
  }

  // C396: free the slot (to the front of the free list) and unlink it.
  release(slot) {
    const entry = this.slots[slot],
      next = entry.next,
      previous = entry.previous;
    this.onRelease?.(slot, entry.task);
    entry.task = null;
    entry.next = this.free;
    this.free = slot;
    if (slot === this.cursor) this.cursor = next;
    if (next !== NONE) this.slots[next].previous = previous;
    if (previous === NONE) this.head = next;
    else this.slots[previous].next = next;
  }
}
