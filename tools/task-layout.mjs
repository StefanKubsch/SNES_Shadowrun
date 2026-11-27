// Conversion layer between the JS scheduler (src/script/scheduler.mjs) and the original
// WRAM layout of the task tables, the heap and the task frames (docs/SCRIPT-VM-LIFT.md).
//
// loadScheduler reads a state the original scheduler left in WRAM (after C1A6) into a JS
// scheduler. Its observers replay the original heap allocator (80:C242, 80:C2BD) on a copy
// of the heap, in the order in which the JS scheduler creates and frees tasks, so that
// every task gets the frame address the original would give it. project() returns the
// live bytes of the original layout for the current JS state: the task tables, the
// headers of the heap blocks in the chain and the live bytes of each task frame. Dead
// bytes (free block data, operand stack residue below S, unused local return words, the
// call ID of a task without a pending call) are not part of the projection.
import { taskStop } from '../src/system/task-stop.mjs';
import { CALL_NATIVE, CALL_SCRIPT, scriptInfo } from './script-interpreter.mjs';
import {
  Scheduler,
  NONE,
  TASK_SLOTS,
  RESUME_CHILD,
  RESUME_WAIT,
} from '../src/script/scheduler.mjs';
import {
  FRAME_CALL_ID,
  FRAME_LOCALS,
  FRAME_OPERAND_STACK,
  FRAME_PC,
  FRAME_RETURN,
  FRAME_RETURN_BASE,
  HEAP_DATA,
  HEAP_HEADER_BYTES,
  HEAP_INITIAL_SIZE,
  HEAP_NEXT_WORD,
  HEAP_SIZE_MASK,
  HEAP_SIZE_WORD,
  HEAP_USED,
  TASK_CONTINUATION,
  TASK_COUNTER,
  TASK_CURSOR,
  TASK_EVENTS,
  TASK_FRAME,
  TASK_FREE_LIST,
  TASK_LIST_HEAD,
  TASK_NEXT,
  TASK_PREVIOUS,
  TASK_WAIT,
} from '../src/vm/layout.mjs';
import { BYTE_BITS, BYTE_MASK, HEX_RADIX, WORD_BITS, WORD_MASK } from '../src/constants/bits.mjs';

const SCRIPT_COUNT = 937;
// Return words the original saves as continuations (RTS to F495 and F509).
const CONTINUATION_WORDS = new Map([
  [null, 0],
  [RESUME_CHILD, 0xf494],
  [RESUME_WAIT, 0xf508],
]);
const CONTINUATIONS = new Map([...CONTINUATION_WORDS].map(([key, word]) => [word, key]));
// 80:C279 splits a block only if the remainder holds a header and at least one byte.
const HEAP_MIN_SPLIT_BYTES = HEAP_HEADER_BYTES + 1;
const FRAME_BANK = 2;

const slotWord = (slot) => (slot === NONE ? WORD_MASK : 2 * slot);

// Script ID per bytecode address (several IDs may share one script; the first is kept).
// Cached per memory: the ROM tables do not change.
const SCRIPTS_BY_CODE = new WeakMap();
function scriptsByCode(mem) {
  let ids = SCRIPTS_BY_CODE.get(mem);
  if (ids) return ids;
  ids = new Map();
  for (let id = SCRIPT_COUNT - 1; id >= 0; id--) ids.set(scriptInfo(mem, id).code, id);
  SCRIPTS_BY_CODE.set(mem, ids);
  return ids;
}

// The original heap allocator over a copy of the heap from 7E:03D2 (header bytes
// first): 80:C242 (first fit; free successors are merged into a block that is too small),
// 80:C2BD (release) and the heap of 80:C1A6 (one free block).
function heapModel(heap) {
  const word = (offset) => heap[offset] | (heap[offset + 1] << BYTE_BITS);
  const setWord = (offset, value) => {
    heap[offset] = value & BYTE_MASK;
    heap[offset + 1] = value >>> BYTE_BITS;
  };
  function allocate(size) {
    let offset = 0;
    for (let guard = 0; ; guard++) {
      if (guard > WORD_MASK) taskStop('original_endless_loop', { heap: offset });
      let free = word(offset);
      if (free & HEAP_USED) {
        offset = word(offset + 2);
        if (offset === 0) taskStop('task_heap_required', { size });
        continue;
      }
      let fits = true;
      while (free < size) {
        const next = word(offset + 2);
        if (next === 0) taskStop('task_heap_required', { size });
        const nextSize = word(next);
        if (nextSize & HEAP_USED) {
          offset = next;
          fits = false;
          break;
        }
        free = (free + nextSize + HEAP_HEADER_BYTES) & WORD_MASK;
        setWord(offset, free);
        setWord(offset + 2, word(next + 2));
      }
      if (!fits) continue;
      const remainder = free - size;
      if (remainder >= HEAP_MIN_SPLIT_BYTES) {
        const split = offset + size + HEAP_HEADER_BYTES;
        setWord(split, remainder - HEAP_HEADER_BYTES);
        setWord(split + 2, word(offset + 2));
        setWord(offset + 2, split);
        setWord(offset, size | HEAP_USED);
      } else setWord(offset, free | HEAP_USED);
      return offset + HEAP_DATA;
    }
  }
  const release = (frame) => {
    const offset = frame - HEAP_DATA;
    setWord(offset, word(offset) & HEAP_SIZE_MASK);
  };
  const reset = () => {
    setWord(0, HEAP_INITIAL_SIZE);
    setWord(2, 0);
  };
  return { word, allocate, release, reset };
}
const HEAP_BYTES = HEAP_HEADER_BYTES + HEAP_INITIAL_SIZE;

// The frame of a JS task in the original's terms. The decompiled scripts keep no PC,
// operand stack or locals, so only a task that has not run yet has one: PC 0, its
// arguments on the operand stack and zeroed locals.
function frameView(mem, task) {
  if (task.run !== null) throw Error(`script ${task.script} has run; its frame is gone`);
  const info = scriptInfo(mem, task.script);
  return {
    code: info.code,
    frameBytes: info.frameBytes,
    pc: 0,
    locals: new Uint8Array(info.localBytes),
    stack: task.args.slice().reverse(),
    returns: [],
    call: task.call,
  };
}

// Live bytes of the original layout as a map from WRAM offset to byte value.
// includeLocal(task, index) can leave out locals (a test's unwritten fresh locals).
function projectLayout(scheduler, frames, unknown, heapWord, { includeLocal = () => true } = {}) {
  const bytes = new Map();
  const put8 = (at, value) => bytes.set(at, value & BYTE_MASK);
  const put16 = (at, value) => {
    put8(at, value);
    put8(at + 1, value >>> BYTE_BITS);
  };
  put16(TASK_LIST_HEAD, slotWord(scheduler.head));
  put16(TASK_FREE_LIST, slotWord(scheduler.free));
  put16(TASK_CURSOR, slotWord(scheduler.cursor));
  scheduler.slots.forEach((entry, slot) => {
    const x = 2 * slot;
    put16(TASK_FRAME + x, frames[slot]);
    put16(TASK_NEXT + x, slotWord(entry.next));
    if (!unknown.has(`previous:${slot}`)) put16(TASK_PREVIOUS + x, slotWord(entry.previous));
    if (!unknown.has(`continuation:${slot}`))
      put16(TASK_CONTINUATION + x, CONTINUATION_WORDS.get(entry.continuation));
    put16(TASK_WAIT + x, entry.wait);
    put16(TASK_COUNTER + x, entry.counter);
    put16(TASK_EVENTS + x, entry.events);
  });
  for (let offset = 0, n = 0; ; n++) {
    if (n > WORD_MASK) throw Error('cyclic heap');
    put16(HEAP_SIZE_WORD + offset, heapWord(offset));
    put16(HEAP_NEXT_WORD + offset, heapWord(offset + 2));
    offset = heapWord(offset + 2);
    if (offset === 0) break;
  }
  scheduler.slots.forEach(({ task: running }, slot) => {
    if (running === null) return;
    const task = frameView(scheduler.mem, running),
      frame = frames[slot],
      end = frame + task.frameBytes;
    put16(frame, task.code);
    put8(frame + FRAME_BANK, task.code >>> WORD_BITS);
    put16(frame + FRAME_PC, task.pc);
    put16(frame + FRAME_RETURN, frame + FRAME_RETURN_BASE - 2 * task.returns.length);
    put16(frame + FRAME_OPERAND_STACK, end - 1 - 2 * task.stack.length);
    if (task.call !== null) put16(frame + FRAME_CALL_ID, task.call.id);
    task.returns.forEach((value, n) => put16(frame + FRAME_RETURN_BASE - 2 * n, value));
    task.locals.forEach((value, n) => {
      if (includeLocal(running, n)) put8(frame + FRAME_LOCALS + n, value);
    });
    task.stack.forEach((value, n) => put16(end - 2 - 2 * n, value));
  });
  return bytes;
}

// `wram` is the original's 128 KiB; `mem` reads the ROM tables and is the JS tasks'
// memory. `onCreate` and `native` are passed on to the scheduler.
export function loadScheduler(mem, wram, { native = null, onCreate = null } = {}) {
  const word = (at) => wram[at] | (wram[at + 1] << BYTE_BITS);
  // The heap from 03D2: one header and HEAP_INITIAL_SIZE bytes after C1A6.
  const heapRange = [HEAP_SIZE_WORD, HEAP_SIZE_WORD + HEAP_BYTES],
    heap = wram.slice(...heapRange),
    model = heapModel(heap);
  const frames = [];
  // Table words the original never wrote (C1A6 leaves PREVIOUS and CONTINUATION of the
  // unused slots stale) and that name no slot or continuation: not projected until the
  // slot is allocated.
  const unknown = new Set();

  const scheduler = new Scheduler(mem, {
    native,
    onCreate(slot, task) {
      frames[slot] = model.allocate(scriptInfo(mem, task.script).frameBytes);
      unknown.delete(`previous:${slot}`);
      unknown.delete(`continuation:${slot}`);
      onCreate?.(slot, task);
    },
    onRelease: (slot) => model.release(frames[slot]),
    onReset: model.reset,
  });

  const readSlot = (at, field) => {
    const value = word(at);
    if (value === WORD_MASK) return NONE;
    if (value & 1 || value >>> 1 >= TASK_SLOTS) {
      if (field === null)
        throw Error(`task table word ${at.toString(HEX_RADIX)}: ${value.toString(HEX_RADIX)}`);
      unknown.add(field);
      return NONE;
    }
    return value >>> 1;
  };
  const ids = scriptsByCode(mem);
  // Reads the tables, the heap and the live tasks from the WRAM. keep(slot, task, read)
  // may keep a task object the scheduler already holds for the same frame.
  function read(keep = () => false) {
    heap.set(wram.subarray(...heapRange));
    unknown.clear();
    scheduler.head = readSlot(TASK_LIST_HEAD, null);
    scheduler.free = readSlot(TASK_FREE_LIST, null);
    scheduler.cursor = readSlot(TASK_CURSOR, null);
    const before = scheduler.slots.map(({ task }, slot) => ({ task, frame: frames[slot] }));
    scheduler.slots.forEach((entry, slot) => {
      const x = 2 * slot;
      entry.next = readSlot(TASK_NEXT + x, null);
      entry.previous = readSlot(TASK_PREVIOUS + x, `previous:${slot}`);
      entry.wait = word(TASK_WAIT + x);
      entry.counter = word(TASK_COUNTER + x);
      entry.events = word(TASK_EVENTS + x);
      const continuation = word(TASK_CONTINUATION + x);
      if (CONTINUATIONS.has(continuation)) entry.continuation = CONTINUATIONS.get(continuation);
      else unknown.add(`continuation:${slot}`);
      frames[slot] = word(TASK_FRAME + x);
      entry.task = null;
    });
    // The live tasks: the frames of the slots in the task list.
    for (let slot = scheduler.head, n = 0; slot !== NONE; n++) {
      if (n >= TASK_SLOTS) throw Error('cyclic task list');
      const entry = scheduler.slots[slot],
        old = before[slot];
      if (unknown.has(`continuation:${slot}`)) throw Error(`continuation of slot ${slot}`);
      const task = readTask(slot, entry.continuation);
      entry.task =
        old.task !== null && old.frame === frames[slot] && keep(slot, old.task, task)
          ? old.task
          : task;
      slot = entry.next;
    }
  }
  read();
  function readTask(slot, continuation) {
    const frame = frames[slot],
      code = word(frame) | (wram[frame + FRAME_BANK] << WORD_BITS),
      id = ids.get(code);
    if (id === undefined) throw Error(`slot ${slot}: no script at ${code.toString(HEX_RADIX)}`);
    const info = scriptInfo(mem, id),
      top = frame + info.frameBytes - 1,
      returns = [],
      stack = [];
    for (let at = frame + FRAME_RETURN_BASE; at > word(frame + FRAME_RETURN); at -= 2)
      returns.push(word(at));
    for (let at = top - 1; at > word(frame + FRAME_OPERAND_STACK); at -= 2) stack.push(word(at));
    const callId = word(frame + FRAME_CALL_ID);
    // A decompiled script starts at its beginning; a frame past it cannot be loaded.
    if (word(frame + FRAME_PC) !== 0 || returns.length)
      throw Error(`slot ${slot}: script ${id} has run; its frame cannot be loaded`);
    return {
      script: id,
      args: stack.slice().reverse(),
      run: null,
      input: undefined,
      call:
        continuation === RESUME_CHILD
          ? { kind: CALL_SCRIPT, id: callId }
          : continuation === RESUME_WAIT
            ? { kind: CALL_NATIVE, id: callId }
            : null,
    };
  }

  const project = (options) => projectLayout(scheduler, frames, unknown, model.word, options);
  // Writes the projection into the WRAM (live bytes only).
  function store(options) {
    const bytes = project(options);
    for (const [at, value] of bytes) wram[at] = value;
    return bytes;
  }

  return { scheduler, frames, project, store, reload: read };
}

// Follows the JS scheduler of a live game from its start (src/script/game-loop.mjs): the
// heap is replayed from the first reset C1A6 on, in the order in which the scheduler
// creates and frees tasks. Before that reset the original's tables hold the boot's
// zeros and nothing is projected. The words C1A6 leaves stale (PREVIOUS of slots 1-47)
// are projected once the slot is allocated. onCreate(slot, task) observes new tasks.
export function followScheduler(scheduler, { onCreate = null } = {}) {
  const model = heapModel(new Uint8Array(HEAP_BYTES)),
    frames = new Array(TASK_SLOTS).fill(0),
    unknown = new Set(Array.from({ length: TASK_SLOTS - 1 }, (_, n) => `previous:${n + 1}`));
  let started = false;
  const chain = (observer, own) =>
    observer
      ? (...args) => {
          own(...args);
          observer(...args);
        }
      : own;
  scheduler.onCreate = chain(scheduler.onCreate, (slot, task) => {
    if (!started) taskStop('task_created_before_reset', { slot });
    frames[slot] = model.allocate(scriptInfo(scheduler.mem, task.script).frameBytes);
    unknown.delete(`previous:${slot}`);
    onCreate?.(slot, task);
  });
  scheduler.onRelease = chain(scheduler.onRelease, (slot) => model.release(frames[slot]));
  scheduler.onReset = chain(scheduler.onReset, () => {
    started = true;
    model.reset();
  });
  return {
    frames,
    get started() {
      return started;
    },
    project: (options) =>
      started ? projectLayout(scheduler, frames, unknown, model.word, options) : new Map(),
  };
}
