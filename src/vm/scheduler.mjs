// Task management and scheduler of the event interpreter (bank $80).
// The original routines are reproduced with their effects on registers,
// flags, WRAM and stack (semantics from proof/task/visit-c1ca.mjs,
// script-yield.mjs, append-c34a.mjs, native-wait.mjs, visit-tail.mjs):
//
//   $C1A6 init      free list, task list, one free heap block
//   $C1CA head      visit the head task ($C1F9), then restore the cursor
//   $C1E3 round     visit all tasks from the cursor
//   $C1F9 visit     readiness ($C3C9), continuation or entry $F378
//   $C20B tail      after a task exits: start a child, free at the end,
//                   resume a waiting parent task
//   $C2C8/$C242     create a frame (heap), $C34A append, $C36A child task,
//   $C396           free a task, $C401 native wait
//   $F488/$F495     script call and resumption after the child task
//
// Task tables (index X = 2 * slot, 48 slots, DBR = $80):
//   $0252 frame (D)   $02B2 continuation (RTS word)   $0312 next   $0372 previous
//   $0BA2 wait mask ($FFFF = waits for a child task)   $0C02 counter   $0C62 events
//   $024C list head   $024E free list   $0250 cursor (current task)
// Heap from $03D2: block header [size | $8000 used, next block], data from +4.
//
// As in the original, all return addresses live on the 65816 stack; the scheduler
// keeps no control state of its own except vm.pc. A run can therefore be
// continued after its opcode budget is spent (resume), and every intermediate
// state is a pure memory and register state.
import { VmFault } from './memory.mjs';
import { EXIT_BUDGET, EXIT_NATIVE_WAIT } from './interpreter.mjs';
import { nativeBridge, nativeResume } from './native-call.mjs';
import { nz, plb, bank80 } from './cpu.mjs';
import {
  FRAME_ARGUMENT_BYTES,
  FRAME_SIZE,
  FRAME_BANK_WORD,
  FRAME_BANK_BYTE,
  FRAME_PC,
  FRAME_RETURN,
  FRAME_RETURN_BASE,
  FRAME_OPERAND_STACK,
  FRAME_FIXED_BYTES,
  HEAP_DATA,
  HEAP_HEADER_BYTES,
  HEAP_USED,
  HEAP_SIZE_MASK,
  HEAP_INITIAL_SIZE,
  HEAP_NEXT_WORD,
  HEAP_REQUEST,
  HEAP_SIZE_WORD,
  NATIVE_BRIDGE,
  NATIVE_POINTERS,
  NATIVE_RESUME,
  OPCODE_LOOP,
  OUTER_STACK,
  SCRIPT_ARGUMENT_BYTES,
  SCRIPT_BANKS,
  SCRIPT_CALL,
  SCRIPT_POINTERS,
  SCRIPT_RESUME,
  SCRIPT_RETURN_BYTES,
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
  TASK_LAST_SLOT,
} from './layout.mjs';
import {
  WORD_MASK,
  WORD_SIGN,
  LONG_MASK,
  WORD_BITS,
  BYTE_MASK,
  BYTE_SIGN,
  HIGH_BYTE_MASK,
} from '../constants/bits.mjs';
import {
  FLAG_DECIMAL,
  FLAG_CARRY,
  FLAG_OVERFLOW,
  FLAG_ZERO,
  FLAG_NEGATIVE,
} from '../constants/cpu-flags.mjs';
import { CODE_BANK_BASE } from '../constants/memory-map.mjs';

export const STOP_RETURNED = 0; // the routine returned to its caller (vm.pc = return address+1)
export const STOP_BUDGET = 1; // opcode budget spent, VM at $F390, resumable
export const STOP_NATIVE = 2; // native without an implementation; VM at $F4F6, vm.exitId = native ID
export const STOP_FRONTIER = 3; // continuation or return outside the scheduler (vm.pc)
export const STOP_BREAK = 4; // breakpoint stopAt reached (test or oracle), resumable
export const STOP_NATIVE_WAIT = 7; // resumable native paused (work budget), the real frame stays; resume() continues

// Fixed states in bank $80; return words below are saved on the original
// stack, one byte before the address resumed by RTS.
const SCHEDULER_PC = Object.freeze({
  INIT: 0xc1a6,
  HEAD: 0xc1ca,
  HEAD_RETURN: 0xc1d9,
  ROUND: 0xc1e3,
  ROUND_RETURN: 0xc1eb,
  VISIT: 0xc1f9,
  RESUME: 0xc1fe,
  ENTER: 0xc208,
  AFTER_TASK: 0xc20b,
  APPEND: 0xc34a,
  RELEASE: 0xc396,
  READY: 0xc3c9,
});
const RETURN_WORD = Object.freeze({
  HEAD_VISIT: 0xc1d8,
  ROUND_VISIT: 0xc1ea,
  VISIT_READY: 0xc1fb,
  TASK: 0xc20a,
  AFTER_TASK_RELEASE: 0xc220,
  FRAME_ALLOCATE_HEAP: 0xc2f7,
  APPEND_ALLOCATE_FRAME: 0xc34c,
  CHILD_ALLOCATE_FRAME: 0xc36c,
  RELEASE_FREE_HEAP: 0xc39f,
  SCRIPT_CHILD: 0xf494,
});
// $C2C8 temporary long script pointer and new frame pointer in direct page.
// $C3C9 reuses $71 for its saved wait mask.
const SCRIPT_HEADER_POINTER = 0x71,
  SCRIPT_HEADER_BANK = 0x73,
  NEW_FRAME_POINTER = 0x74,
  SAVED_WAIT_MASK = 0x71;
// $C279 only splits if the remainder can hold a header and at least one byte.
const HEAP_MIN_SPLIT_BYTES = HEAP_HEADER_BYTES + 1;
// $C30F reads DBR:FFFE+Y with full address carry, not a wrapped negative offset.
const ARGUMENT_COPY_BASE = 0xfffe;
// $C3C9: bit 12 halts a task; bits selected by $6FFE are external events.
const WAIT_HALTED = 0x1000,
  WAIT_EVENTS = 0x6ffe,
  NO_TASK = WORD_MASK,
  WAIT_FOR_CHILD = WORD_MASK;

// Entry points that call() accepts as if by JSR.
const SCHEDULER_ENTRIES = Object.freeze([
  SCHEDULER_PC.INIT,
  SCHEDULER_PC.HEAD,
  SCHEDULER_PC.ROUND,
  SCHEDULER_PC.VISIT,
  SCHEDULER_PC.AFTER_TASK,
  SCHEDULER_PC.APPEND,
  SCHEDULER_PC.RELEASE,
  SCHEDULER_PC.READY,
]);

const WAIT_NATIVE = 0xc401;
// Upper limit for loop passes per call. Cyclic lists hang forever in the
// original; the VM core reports them instead.
const SCHEDULER_LOOP_LIMIT = 0x10000;

// --- 65816 building blocks (16 bits, binary) -----------------------------------

function adc(vm, value) {
  if (vm.p & FLAG_DECIMAL) throw new VmFault('decimal_mode');
  const left = vm.a,
    sum = left + value + (vm.p & FLAG_CARRY),
    result = sum & WORD_MASK;
  vm.p =
    (vm.p & ~(FLAG_CARRY | FLAG_OVERFLOW)) |
    (sum > WORD_MASK ? FLAG_CARRY : 0) |
    (~(left ^ value) & (left ^ result) & WORD_SIGN ? FLAG_OVERFLOW : 0);
  vm.a = nz(vm, result);
}
function sbc(vm, value) {
  if (vm.p & FLAG_DECIMAL) throw new VmFault('decimal_mode');
  const left = vm.a,
    diff = left - value - 1 + (vm.p & FLAG_CARRY),
    result = diff & WORD_MASK;
  vm.p =
    (vm.p & ~(FLAG_CARRY | FLAG_OVERFLOW)) |
    (diff >= 0 ? FLAG_CARRY : 0) |
    ((left ^ value) & (left ^ result) & WORD_SIGN ? FLAG_OVERFLOW : 0);
  vm.a = nz(vm, result);
}
function compare(vm, register, value) {
  vm.p = (vm.p & ~FLAG_CARRY) | (register >= value ? FLAG_CARRY : 0);
  nz(vm, (register - value) & WORD_MASK);
}
const sec = (vm) => {
  vm.p |= FLAG_CARRY;
};
const clc = (vm) => {
  vm.p &= ~FLAG_CARRY;
};
const carry = (vm) => (vm.p & FLAG_CARRY) !== 0;
const negative = (value) => (value & WORD_SIGN) !== 0;

// Absolute addresses via DBR (24-bit wrap as with abs,X across the bank boundary).
const abs = (vm, offset) => ((vm.dbr << WORD_BITS) + offset) & LONG_MASK;
const load = (vm, offset) => vm.mem.read16(abs(vm, offset));
const store = (vm, offset, value) => vm.mem.write16(abs(vm, offset), value);
// Direct page (bank 0, 16-bit wrap).
const dp = (vm, offset) => vm.mem.read16Bank0((vm.d + offset) & WORD_MASK);
const dpStore = (vm, offset, value) => vm.mem.write16Bank0((vm.d + offset) & WORD_MASK, value);
// ($nn),Y: pointer from the direct page, bank DBR.
const indirectY = (vm, offset, y) => ((vm.dbr << WORD_BITS) + dp(vm, offset) + y) & LONG_MASK;

// PEI ($01) / PLB / PLB: DBR = bank of the bytecode pointer in the task frame.
function frameBank(vm) {
  vm.push16(dp(vm, FRAME_BANK_WORD));
  plb(vm);
  plb(vm);
}
// RTS: return word from the stack, PC = word + 1.
function rts(vm) {
  vm.pc = (vm.pull16() + 1) & WORD_MASK;
}
// JSR to a subroutine with a fixed return within the same routine.
function callSubroutine(vm, returnWord, routine) {
  vm.push16(returnWord);
  routine(vm);
  const raw = vm.pull16();
  if (raw !== returnWord)
    throw new VmFault('scheduler_return_target', CODE_BANK_BASE | ((raw + 1) & WORD_MASK));
}

// --- Task management ---------------------------------------------------------

// $C1A6: free list 0 -> 2 -> ... -> $5E, empty task list, heap = one free block.
function initTasks(vm) {
  store(vm, TASK_FREE_LIST, 0);
  vm.a = nz(vm, NO_TASK);
  store(vm, TASK_LIST_HEAD, vm.a);
  store(vm, TASK_CURSOR, vm.a);
  store(vm, TASK_PREVIOUS, vm.a);
  vm.x = nz(vm, TASK_LAST_SLOT);
  do {
    store(vm, TASK_NEXT + vm.x, vm.a);
    vm.a = nz(vm, vm.x);
    vm.x = nz(vm, (vm.x - 2) & WORD_MASK);
  } while (!negative(vm.x));
  vm.a = nz(vm, HEAP_INITIAL_SIZE);
  store(vm, HEAP_SIZE_WORD, vm.a);
  store(vm, HEAP_NEXT_WORD, 0);
  rts(vm);
}

// $C242: allocate the first fitting free block (adjacent free blocks are
// merged on the way). A = size; result A = data address, on failure without allocation.
function allocateHeap(vm) {
  const size = vm.a;
  store(vm, HEAP_REQUEST, size);
  vm.x = nz(vm, 0);
  let guard = 0;
  for (;;) {
    if (++guard > SCHEDULER_LOOP_LIMIT) throw new VmFault('original_endless_loop', 0x80c248);
    vm.a = nz(vm, load(vm, HEAP_SIZE_WORD + vm.x));
    if (negative(vm.a)) {
      // $C24D: used, on to the next block
      vm.a = nz(vm, load(vm, HEAP_NEXT_WORD + vm.x));
      if (vm.a === 0) return;
      vm.x = nz(vm, vm.a);
      continue;
    }
    // $C255: does the block fit? Otherwise merge it with its free successor.
    let merged = true;
    for (;;) {
      if (++guard > SCHEDULER_LOOP_LIMIT) throw new VmFault('original_endless_loop', 0x80c255);
      sec(vm);
      sbc(vm, load(vm, HEAP_REQUEST));
      if (carry(vm)) break;
      vm.y = nz(vm, load(vm, HEAP_NEXT_WORD + vm.x));
      if (vm.y === 0) return;
      vm.a = nz(vm, load(vm, HEAP_SIZE_WORD + vm.y));
      if (negative(vm.a)) {
        merged = false;
        break;
      }
      adc(vm, load(vm, HEAP_SIZE_WORD + vm.x));
      adc(vm, HEAP_HEADER_BYTES);
      store(vm, HEAP_SIZE_WORD + vm.x, vm.a);
      vm.a = nz(vm, load(vm, HEAP_NEXT_WORD + vm.y));
      store(vm, HEAP_NEXT_WORD + vm.x, vm.a);
      vm.a = nz(vm, load(vm, HEAP_SIZE_WORD + vm.x));
    }
    if (!merged) {
      vm.a = nz(vm, load(vm, HEAP_NEXT_WORD + vm.x));
      if (vm.a === 0) return;
      vm.x = nz(vm, vm.a);
      continue;
    }
    // $C279: split off a remainder >= 5, otherwise allocate the whole block.
    compare(vm, vm.a, HEAP_MIN_SPLIT_BYTES);
    if (carry(vm)) {
      vm.a = nz(vm, load(vm, HEAP_NEXT_WORD + vm.x));
      vm.push16(vm.a);
      clc(vm);
      vm.a = nz(vm, vm.x);
      adc(vm, load(vm, HEAP_REQUEST));
      adc(vm, HEAP_HEADER_BYTES);
      store(vm, HEAP_NEXT_WORD + vm.x, vm.a);
      vm.y = nz(vm, vm.a);
      sec(vm);
      vm.a = nz(vm, load(vm, HEAP_SIZE_WORD + vm.x));
      sbc(vm, load(vm, HEAP_REQUEST));
      sbc(vm, HEAP_HEADER_BYTES);
      store(vm, HEAP_SIZE_WORD + vm.y, vm.a);
      vm.a = nz(vm, vm.pull16());
      store(vm, HEAP_NEXT_WORD + vm.y, vm.a);
      vm.a = nz(vm, load(vm, HEAP_REQUEST) | HEAP_USED);
      store(vm, HEAP_SIZE_WORD + vm.x, vm.a);
    } else {
      vm.a = nz(vm, load(vm, HEAP_SIZE_WORD + vm.x) | HEAP_USED);
      store(vm, HEAP_SIZE_WORD + vm.x, vm.a);
    }
    clc(vm);
    vm.a = nz(vm, vm.x);
    adc(vm, HEAP_DATA);
    return;
  }
}

// $C2BD: free a heap block (A = block offset).
function freeHeap(vm) {
  vm.y = nz(vm, vm.a);
  vm.a = nz(vm, load(vm, HEAP_SIZE_WORD + vm.y) & HEAP_SIZE_MASK);
  store(vm, HEAP_SIZE_WORD + vm.y, vm.a);
}

// $C2C8: create a task frame for script X. Frame: [0..2] bytecode pointer with bank,
// +3 PC, +5 local return pointer, +7 operand stack; arguments from DBR:0000.
// Afterwards X = new slot (from the free list), or negative if none is free.
function allocateFrame(vm) {
  const mem = vm.mem;
  vm.a = nz(vm, mem.read16(SCRIPT_BANKS + vm.x));
  dpStore(vm, SCRIPT_HEADER_BANK, vm.a);
  vm.a = nz(vm, mem.read16(SCRIPT_ARGUMENT_BYTES + vm.x) & BYTE_MASK);
  store(vm, FRAME_ARGUMENT_BYTES, vm.a);
  vm.a = nz(vm, vm.x);
  vm.p = (vm.p & ~FLAG_CARRY) | (vm.a >>> (WORD_BITS - 1));
  vm.a = nz(vm, (vm.a << 1) & WORD_MASK);
  vm.x = nz(vm, vm.a);
  vm.a = nz(vm, mem.read16(SCRIPT_POINTERS + vm.x));
  dpStore(vm, SCRIPT_HEADER_POINTER, vm.a);
  // Frame size = header bytes [0] + [1] of the script + $17 (8-bit addition).
  vm.a = nz(vm, 0);
  const header =
    dp(vm, SCRIPT_HEADER_POINTER) |
    (mem.read8((vm.d + SCRIPT_HEADER_BANK) & WORD_MASK) << WORD_BITS);
  clc(vm);
  vm.a = mem.read8(header);
  vm.y = nz(vm, 1);
  adc8(vm, mem.read8((header + vm.y) & LONG_MASK));
  adc8(vm, FRAME_FIXED_BYTES);
  store(vm, FRAME_SIZE, vm.a);
  callSubroutine(vm, RETURN_WORD.FRAME_ALLOCATE_HEAP, allocateHeap);
  dpStore(vm, NEW_FRAME_POINTER, vm.a);
  clc(vm);
  adc(vm, FRAME_RETURN_BASE);
  vm.y = nz(vm, FRAME_RETURN);
  mem.write16(indirectY(vm, NEW_FRAME_POINTER, vm.y), vm.a);
  vm.a = nz(vm, dp(vm, NEW_FRAME_POINTER));
  adc(vm, load(vm, FRAME_SIZE));
  vm.a = nz(vm, (vm.a - 1) & WORD_MASK);
  vm.y = nz(vm, load(vm, FRAME_ARGUMENT_BYTES));
  if (vm.y !== 0) {
    // $C30F: copy argument words from top to bottom into the frame.
    vm.x = nz(vm, vm.a);
    do {
      vm.a = nz(vm, load(vm, ARGUMENT_COPY_BASE + vm.y));
      vm.x = nz(vm, (vm.x - 1) & WORD_MASK);
      dpStore(vm, vm.x, vm.a);
      vm.x = nz(vm, (vm.x - 1) & WORD_MASK);
      vm.y = nz(vm, (vm.y - 2) & WORD_MASK);
    } while (vm.y !== 0);
    vm.a = nz(vm, vm.x);
  }
  vm.y = nz(vm, FRAME_OPERAND_STACK);
  mem.write16(indirectY(vm, NEW_FRAME_POINTER, vm.y), vm.a);
  vm.a = nz(vm, (dp(vm, SCRIPT_HEADER_POINTER) + 2) & WORD_MASK);
  mem.write16(indirectY(vm, NEW_FRAME_POINTER, 0), vm.a);
  vm.y = nz(vm, FRAME_BANK_BYTE);
  vm.a = nz(vm, dp(vm, SCRIPT_HEADER_BANK));
  mem.write16(indirectY(vm, NEW_FRAME_POINTER, vm.y), vm.a);
  vm.y = nz(vm, FRAME_PC);
  vm.a = nz(vm, 0);
  mem.write16(indirectY(vm, NEW_FRAME_POINTER, vm.y), vm.a);
  vm.x = nz(vm, load(vm, TASK_FREE_LIST));
  if (!negative(vm.x)) {
    store(vm, TASK_CONTINUATION + vm.x, 0);
    store(vm, TASK_WAIT + vm.x, 0);
    vm.a = nz(vm, load(vm, TASK_NEXT + vm.x));
    store(vm, TASK_FREE_LIST, vm.a);
    vm.a = nz(vm, dp(vm, NEW_FRAME_POINTER));
    store(vm, TASK_FRAME + vm.x, vm.a);
  }
}
// ADC in the 8-bit accumulator (SEP #$20): only the low byte, B stays.
function adc8(vm, value) {
  if (vm.p & FLAG_DECIMAL) throw new VmFault('decimal_mode');
  const left = vm.a & BYTE_MASK,
    sum = left + value + (vm.p & FLAG_CARRY),
    result = sum & BYTE_MASK;
  vm.p =
    (vm.p & ~(FLAG_CARRY | FLAG_ZERO | FLAG_OVERFLOW | FLAG_NEGATIVE)) |
    (sum > BYTE_MASK ? FLAG_CARRY : 0) |
    (~(left ^ value) & (left ^ result) & BYTE_SIGN ? FLAG_OVERFLOW : 0) |
    (result & BYTE_SIGN) |
    (result === 0 ? FLAG_ZERO : 0);
  vm.a = (vm.a & HIGH_BYTE_MASK) | result;
}

// $C34A: create a task for script X and link it in as the new list head.
function appendTask(vm) {
  callSubroutine(vm, RETURN_WORD.APPEND_ALLOCATE_FRAME, allocateFrame);
  vm.a = nz(vm, load(vm, TASK_LIST_HEAD));
  store(vm, TASK_NEXT + vm.x, vm.a);
  vm.a = nz(vm, NO_TASK);
  store(vm, TASK_PREVIOUS + vm.x, vm.a);
  vm.a = nz(vm, vm.x);
  vm.x = nz(vm, load(vm, TASK_LIST_HEAD));
  if (!negative(vm.x)) store(vm, TASK_PREVIOUS + vm.x, vm.a);
  store(vm, TASK_LIST_HEAD, vm.a);
  rts(vm);
}

// $C36A: link a child task in before the current task; the parent task waits
// ($0BA2 = $FFFF) and receives the caller's return word as its continuation.
function childTask(vm) {
  callSubroutine(vm, RETURN_WORD.CHILD_ALLOCATE_FRAME, allocateFrame);
  vm.a = nz(vm, load(vm, TASK_CURSOR));
  store(vm, TASK_NEXT + vm.x, vm.a);
  vm.y = nz(vm, vm.a);
  vm.a = nz(vm, load(vm, TASK_PREVIOUS + vm.y));
  store(vm, TASK_PREVIOUS + vm.x, vm.a);
  vm.a = nz(vm, vm.x);
  store(vm, TASK_PREVIOUS + vm.y, vm.a);
  vm.a = nz(vm, WAIT_FOR_CHILD);
  store(vm, TASK_WAIT + vm.y, vm.a);
  vm.a = nz(vm, vm.pull16());
  store(vm, TASK_CONTINUATION + vm.y, vm.a);
  vm.y = nz(vm, load(vm, TASK_PREVIOUS + vm.x));
  if (negative(vm.y)) store(vm, TASK_LIST_HEAD, vm.x);
  else {
    vm.a = nz(vm, vm.x);
    store(vm, TASK_NEXT + vm.y, vm.a);
  }
  rts(vm);
}

// $C396: free task X (heap block, slot into the free list, unlink from the task list).
function releaseTask(vm) {
  sec(vm);
  vm.a = nz(vm, load(vm, TASK_FRAME + vm.x));
  sbc(vm, HEAP_DATA);
  callSubroutine(vm, RETURN_WORD.RELEASE_FREE_HEAP, freeHeap);
  vm.y = nz(vm, load(vm, TASK_NEXT + vm.x));
  vm.a = nz(vm, load(vm, TASK_FREE_LIST));
  store(vm, TASK_NEXT + vm.x, vm.a);
  store(vm, TASK_FREE_LIST, vm.x);
  compare(vm, vm.x, load(vm, TASK_CURSOR));
  if (vm.p & FLAG_ZERO) store(vm, TASK_CURSOR, vm.y);
  vm.a = nz(vm, load(vm, TASK_PREVIOUS + vm.x));
  vm.x = nz(vm, vm.y);
  if (!negative(vm.x)) store(vm, TASK_PREVIOUS + vm.y, vm.a);
  vm.y = nz(vm, vm.a);
  if (negative(vm.y)) store(vm, TASK_LIST_HEAD, vm.x);
  else {
    vm.a = nz(vm, vm.x);
    store(vm, TASK_NEXT + vm.y, vm.a);
  }
}

// $C3C9: is task X ready? Carry = ready. Wait mask: 0 ready, negative waits
// for a child task, bit 12 halted, otherwise event bits ($0C62) and/or counter (bit 0).
function readyCheck(vm) {
  vm.a = nz(vm, load(vm, TASK_WAIT + vm.x));
  if (vm.a === 0) {
    sec(vm);
    return;
  }
  if (negative(vm.a) || vm.a & WAIT_HALTED) {
    clc(vm);
    return;
  } // Z stays 0 (A != 0)
  vm.p |= FLAG_ZERO; // BIT #$1000 without a hit
  dpStore(vm, 0, 0);
  dpStore(vm, SAVED_WAIT_MASK, vm.a);
  vm.a = nz(vm, vm.a & WAIT_EVENTS);
  vm.a = nz(vm, vm.a & load(vm, TASK_EVENTS + vm.x));
  if (vm.a !== 0) dpStore(vm, 0, vm.a);
  vm.a = nz(vm, dp(vm, SAVED_WAIT_MASK));
  vm.p = (vm.p & ~FLAG_ZERO) | (vm.a & 1 ? 0 : FLAG_ZERO);
  if (vm.a & 1) {
    const count = nz(vm, (load(vm, TASK_COUNTER + vm.x) - 1) & WORD_MASK);
    store(vm, TASK_COUNTER + vm.x, count);
    if (count === 0) {
      vm.a = nz(vm, 1);
      const pending = dp(vm, 0);
      vm.p = (vm.p & ~FLAG_ZERO) | (pending & vm.a ? 0 : FLAG_ZERO);
      dpStore(vm, 0, pending | vm.a);
      vm.a = nz(vm, dp(vm, SAVED_WAIT_MASK));
    }
  }
  vm.a = nz(vm, dp(vm, 0));
  if (vm.a === 0) {
    clc(vm);
    return;
  }
  store(vm, TASK_WAIT + vm.x, 0);
  sec(vm);
}

// --- Transitions between scheduler and interpreter -----------------------------

// $F378: enter task X: D = frame, DBR = script bank, save the outer stack,
// load the operand stack and PC, fetch the first opcode ($F389).
function enterTask(vm) {
  vm.a = nz(vm, load(vm, TASK_FRAME + vm.x));
  vm.d = nz(vm, vm.a);
  frameBank(vm);
  vm.a = nz(vm, vm.s);
  store(vm, OUTER_STACK, vm.a);
  vm.a = nz(vm, dp(vm, FRAME_OPERAND_STACK));
  vm.s = vm.a;
  vm.y = nz(vm, dp(vm, FRAME_PC));
  vm.fetch();
}

// $F488: script call after the argument prefix (A = outer stack, X = script ID):
// activate the outer stack, create a child task; RTS returns to the scheduler.
function scriptCall(vm) {
  vm.s = vm.a;
  vm.a = nz(vm, 0);
  vm.d = nz(vm, vm.a);
  bank80(vm);
  vm.push16(RETURN_WORD.SCRIPT_CHILD);
  childTask(vm);
}

// $C401 native wait (after the bridge, D = 0): wait mask and counter from the
// arguments, save return $F508 as the continuation, back to the scheduler.
export function nativeWait(vm) {
  vm.x = nz(vm, load(vm, TASK_CURSOR));
  vm.a = nz(vm, dp(vm, 0));
  store(vm, TASK_WAIT + vm.x, vm.a);
  vm.a = nz(vm, dp(vm, 2));
  store(vm, TASK_COUNTER + vm.x, vm.a);
  store(vm, TASK_EVENTS + vm.x, 0);
  vm.a = nz(vm, vm.pull16());
  store(vm, TASK_CONTINUATION + vm.x, vm.a);
  rts(vm);
}

// --- Execution ---------------------------------------------------------------

export class TaskScheduler {
  constructor(vm) {
    this.vm = vm;
    this.returnS = 0; // stack pointer after the RTS to the caller of call()
    this.opcodesRun = 0; // opcodes since the last call()/resume()
    this.stopAt = -1; // optional breakpoint (scheduler address, for example $C20B), -1 = none
  }

  // Calls a scheduler routine as if by JSR: the return word lies at S+1.
  call(entry, budget = Infinity) {
    if (!SCHEDULER_ENTRIES.includes(entry))
      throw new VmFault('scheduler_entry_unknown', CODE_BANK_BASE | entry);
    this.returnS = (this.vm.s + 2) & WORD_MASK;
    this.vm.pc = entry;
    return this.resume(budget);
  }

  // Continues execution at vm.pc until the routine returns or halts.
  resume(budget = Infinity) {
    const vm = this.vm;
    let remaining = budget;
    this.opcodesRun = 0;
    // A paused native owns the bridge, frame and observation set; only after
    // its real return do $F509 and the next opcode follow.
    if (vm.natives?.pending && vm.natives.continuePending()) return STOP_NATIVE_WAIT;
    for (let guard = 0; ; guard++) {
      if (guard > SCHEDULER_LOOP_LIMIT)
        throw new VmFault('original_endless_loop', CODE_BANK_BASE | vm.pc);
      if (vm.pc === this.stopAt && guard > 0) return STOP_BREAK;
      switch (vm.pc) {
        case OPCODE_LOOP: {
          if (remaining <= 0) return STOP_BUDGET;
          const exit = vm.run(remaining);
          this.opcodesRun += vm.opcodesRun;
          remaining -= vm.opcodesRun;
          if (exit === EXIT_BUDGET) return STOP_BUDGET;
          if (exit === EXIT_NATIVE_WAIT) return STOP_NATIVE_WAIT;
          break; // script call ($F488), native ($F4F6), END/status return (RTS executed)
        }
        case SCRIPT_CALL:
          scriptCall(vm);
          break;
        case NATIVE_BRIDGE:
          if (vm.mem.read16(NATIVE_POINTERS + vm.x) === WAIT_NATIVE) {
            nativeBridge(vm);
            vm.pc = WAIT_NATIVE;
            nativeWait(vm);
          } else if (vm.natives !== null && vm.natives.canCall()) {
            // A formerly missing observation set may now be available. The
            // opcode's arguments are already consumed at F4F6; resume only
            // its real bridge/native/F509, without executing the opcode again.
            if (vm.natives.call()) return STOP_NATIVE_WAIT;
          } else return STOP_NATIVE;
          break;
        case SCRIPT_RESUME:
          nativeResume(vm, SCRIPT_RETURN_BYTES);
          break;
        case NATIVE_RESUME:
          nativeResume(vm);
          break;
        case SCHEDULER_PC.INIT:
          initTasks(vm);
          break;
        case SCHEDULER_PC.HEAD:
          vm.a = nz(vm, load(vm, TASK_CURSOR));
          vm.push16(vm.a);
          vm.x = nz(vm, load(vm, TASK_LIST_HEAD));
          store(vm, TASK_CURSOR, vm.x);
          if (negative(vm.x)) {
            this.restoreCursor();
            break;
          }
          vm.push16(RETURN_WORD.HEAD_VISIT);
          vm.pc = SCHEDULER_PC.VISIT;
          break;
        case SCHEDULER_PC.HEAD_RETURN:
          bank80(vm);
          this.restoreCursor();
          break;
        case SCHEDULER_PC.ROUND_RETURN:
        case SCHEDULER_PC.ROUND:
          vm.x = nz(vm, load(vm, TASK_CURSOR));
          if (!negative(vm.x)) {
            vm.push16(RETURN_WORD.ROUND_VISIT);
            vm.pc = SCHEDULER_PC.VISIT;
            break;
          }
          vm.a = nz(vm, load(vm, TASK_LIST_HEAD));
          store(vm, TASK_CURSOR, vm.a);
          bank80(vm);
          rts(vm);
          break;
        case SCHEDULER_PC.VISIT:
          callSubroutine(vm, RETURN_WORD.VISIT_READY, readyCheck);
          if (!carry(vm)) {
            vm.x = nz(vm, load(vm, TASK_CURSOR));
            vm.a = nz(vm, load(vm, TASK_NEXT + vm.x));
            store(vm, TASK_CURSOR, vm.a);
            rts(vm);
            break;
          }
          vm.pc = SCHEDULER_PC.RESUME;
          break;
        case SCHEDULER_PC.RESUME:
          // Saved continuation ($F494 script call, $F508 native wait) or a new entry.
          vm.a = nz(vm, load(vm, TASK_CONTINUATION + vm.x));
          if (vm.a === 0) {
            vm.pc = SCHEDULER_PC.ENTER;
            break;
          }
          vm.push16(RETURN_WORD.TASK);
          vm.push16(vm.a);
          rts(vm);
          break;
        case SCHEDULER_PC.ENTER:
          vm.push16(RETURN_WORD.TASK);
          enterTask(vm);
          break;
        case SCHEDULER_PC.AFTER_TASK:
          this.afterTask();
          break;
        case SCHEDULER_PC.APPEND:
          appendTask(vm);
          break;
        case SCHEDULER_PC.RELEASE:
          releaseTask(vm);
          rts(vm);
          break;
        case SCHEDULER_PC.READY:
          readyCheck(vm);
          rts(vm);
          break;
        default:
          return vm.s === this.returnS ? STOP_RETURNED : STOP_FRONTIER;
      }
      if (vm.s === this.returnS && vm.pc !== OPCODE_LOOP) return STOP_RETURNED;
    }
  }

  // $C1DE: cursor back from the stack, RTS.
  restoreCursor() {
    const vm = this.vm;
    vm.a = nz(vm, vm.pull16());
    store(vm, TASK_CURSOR, vm.a);
    rts(vm);
  }

  // $C20B: tail after a task has returned to the scheduler.
  afterTask() {
    const vm = this.vm;
    vm.x = nz(vm, load(vm, TASK_CURSOR));
    vm.a = nz(vm, load(vm, TASK_WAIT + vm.x));
    if (negative(vm.a)) {
      // $C239: waits for a new child task, start it at once.
      vm.a = nz(vm, load(vm, TASK_PREVIOUS + vm.x));
      store(vm, TASK_CURSOR, vm.a);
      vm.x = nz(vm, vm.a);
      vm.pc = SCHEDULER_PC.ENTER;
      return;
    }
    vm.a = nz(vm, load(vm, TASK_NEXT + vm.x));
    store(vm, TASK_CURSOR, vm.a);
    vm.a = nz(vm, load(vm, TASK_WAIT + vm.x));
    if (vm.a !== 0) {
      rts(vm);
      return;
    }
    // Task finished: free it; if the next (parent) task waits, resume it.
    callSubroutine(vm, RETURN_WORD.AFTER_TASK_RELEASE, releaseTask);
    vm.x = nz(vm, load(vm, TASK_CURSOR));
    vm.a = nz(vm, load(vm, TASK_WAIT + vm.x));
    if (!negative(vm.a)) {
      rts(vm);
      return;
    }
    store(vm, TASK_WAIT + vm.x, 0);
    vm.pc = SCHEDULER_PC.RESUME;
  }
}
