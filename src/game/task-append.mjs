// The script task append (lifted from 80:C34A with the task frame allocation 80:C2C8
// and the heap 80:C242; register-level versions in src/task/task-append.mjs and
// src/task/script-yield.mjs, which the script VM and the other natives still use).
//
// A task for a script is started at the head of the task list: a frame for the script
// is taken from the heap (the first free block that fits, merged with the free blocks
// after it, split when enough is left over), the script's arguments are copied from
// the direct page words 00 on to the frame's end, and a free task slot takes the frame.
//
// The frame allocation writes the direct page words of the original (the script header
// pointer 71, its bank word 73 and the frame 74) and the heap request, frame size and
// argument count words. The return words of the inner calls and the next word the heap
// pushes while it splits a block lie on the stack as in the original. The heap and the
// task slots are game-sized: the task and heap tables and the frames lie in bank 7E
// below 2000, where the original's data bank reads them. A full heap or no free task
// slot, after which the original writes through a meaningless frame or slot, stops at
// the frontiers `task_heap_required` and `task_slot_required`; a script with an odd
// number of argument bytes (none has one), whose copy loop never ends, at
// `script_arguments_required`.
import { taskStop } from '../task/plan.mjs';
import { NO_TASK } from '../task/wram.mjs';
import {
  FRAME_ARGUMENT_BYTES,
  FRAME_FIXED_BYTES,
  FRAME_OPERAND_STACK,
  FRAME_RETURN,
  FRAME_RETURN_BASE,
  FRAME_SIZE,
  HEAP_DATA,
  HEAP_HEADER_BYTES,
  HEAP_NEXT_WORD,
  HEAP_REQUEST,
  HEAP_SIZE_WORD,
  HEAP_USED,
  SCRIPT_ARGUMENT_BYTES,
  SCRIPT_BANKS,
  SCRIPT_POINTERS,
  TASK_CONTINUATION,
  TASK_FRAME,
  TASK_FREE_LIST,
  TASK_LIST_HEAD,
  TASK_NEXT,
  TASK_PREVIOUS,
  TASK_WAIT,
} from '../vm/layout.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';
import {
  FLAG_CARRY,
  FLAG_DECIMAL,
  FLAG_NEGATIVE,
  FLAG_OVERFLOW,
  FLAG_ZERO,
} from '../constants/cpu-flags.mjs';
// The direct page words of the frame allocation: the script header pointer, its bank
// word, and the new frame.
const DP_SCRIPT_HEADER = 0x71,
  DP_SCRIPT_HEADER_BANK = 0x73,
  DP_FRAME = 0x74;
// Frame header: the script pointer past the header's two counts, its bank, the script
// PC.
const FRAME_SCRIPT = 0,
  FRAME_SCRIPT_BANK = 2,
  FRAME_PC = 3,
  SCRIPT_HEADER_COUNTS = 2;
// A heap block is split when at least a header and one data byte are left over.
const HEAP_MIN_SPLIT_BYTES = HEAP_HEADER_BYTES + 1;
// The return words of the JSRs to C2C8 (from C34A) and C242 (from C2F5).
const FRAME_JSR_RETURN = 0xc34c,
  HEAP_JSR_RETURN = 0xc2f7;
// The append leaves Y at the frame's PC word.
const FRAME_PC_OFFSET = FRAME_PC;
// The low WRAM mirror lies in the banks 00-3F and 80-BF, and 7E holds it too.
const BANK_HIGH_HALF = 0x40,
  WRAM_BANK = 0x7e;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const readWord = (mem, at) =>
  mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
const flag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};

// Take a heap block of size bytes (80:C242): the first free block that fits, merged
// with the free blocks after it; split when enough is left over. Returns the block's
// data address.
function allocateHeapBlock(wram, a, size) {
  const full = () => taskStop('task_heap_required', { size });
  setWord(wram, HEAP_REQUEST, size);
  let x = 0;
  for (;;) {
    let blockSize = word(wram, HEAP_SIZE_WORD + x);
    if (blockSize & HEAP_USED) {
      x = word(wram, HEAP_NEXT_WORD + x);
      if (!x) return full();
      continue;
    }
    let fits = blockSize >= size;
    while (!fits) {
      const y = word(wram, HEAP_NEXT_WORD + x);
      if (!y) return full();
      const following = word(wram, HEAP_SIZE_WORD + y);
      if (following & HEAP_USED) break;
      // ADC without CLC: the carry of the first addition goes into the second.
      const sum = following + blockSize;
      blockSize = (sum + HEAP_HEADER_BYTES + (sum > WORD_MASK ? 1 : 0)) & WORD_MASK;
      setWord(wram, HEAP_SIZE_WORD + x, blockSize);
      setWord(wram, HEAP_NEXT_WORD + x, word(wram, HEAP_NEXT_WORD + y));
      fits = blockSize >= size;
    }
    if (!fits) {
      x = word(wram, HEAP_NEXT_WORD + x);
      if (!x) return full();
      continue;
    }
    if (blockSize - size >= HEAP_MIN_SPLIT_BYTES) {
      const next = word(wram, HEAP_NEXT_WORD + x),
        sum = x + size;
      a.pushWord(next);
      const y = (sum + HEAP_HEADER_BYTES + (sum > WORD_MASK ? 1 : 0)) & WORD_MASK;
      setWord(wram, HEAP_NEXT_WORD + x, y);
      setWord(wram, HEAP_SIZE_WORD + y, blockSize - size - HEAP_HEADER_BYTES);
      setWord(wram, HEAP_NEXT_WORD + y, a.pullWord());
      setWord(wram, HEAP_SIZE_WORD + x, size | HEAP_USED);
    } else setWord(wram, HEAP_SIZE_WORD + x, blockSize | HEAP_USED);
    return (x + HEAP_DATA) & WORD_MASK;
  }
}

// Allocate the frame of a task for script (80:C2C8) and take a free task slot for it;
// returns the slot with the carry and overflow of the frame's end (the frame plus its
// size and the carry of the return base), the original's last addition.
function allocateTaskFrame(mem, wram, a, script) {
  setWord(wram, DP_SCRIPT_HEADER_BANK, readWord(mem, SCRIPT_BANKS + script));
  const argumentBytes = mem.read8((SCRIPT_ARGUMENT_BYTES + script) & LONG_MASK);
  setWord(wram, FRAME_ARGUMENT_BYTES, argumentBytes);
  const pointer = readWord(mem, SCRIPT_POINTERS + ((script << 1) & WORD_MASK));
  setWord(wram, DP_SCRIPT_HEADER, pointer);
  // The two counts of the script header and the fixed bytes, added in 8 bits; the
  // carry of the first addition goes into the second.
  const header = (wram[DP_SCRIPT_HEADER_BANK] << WORD_BITS) | pointer,
    counts = mem.read8(header) + mem.read8((header + 1) & LONG_MASK),
    size = ((counts & BYTE_MASK) + FRAME_FIXED_BYTES + (counts > BYTE_MASK ? 1 : 0)) & BYTE_MASK;
  setWord(wram, FRAME_SIZE, size);
  a.pushWord(HEAP_JSR_RETURN);
  const frame = allocateHeapBlock(wram, a, size);
  a.pullWord();
  setWord(wram, DP_FRAME, frame);
  const returnBase = frame + FRAME_RETURN_BASE;
  setWord(wram, frame + FRAME_RETURN, returnBase);
  // The arguments in the direct page words from 00 go to the end of the frame, the
  // operand stack starts below them. The carry of the return base goes into the end.
  if (argumentBytes & 1) taskStop('script_arguments_required', { script });
  const end = frame + size + (returnBase > WORD_MASK ? 1 : 0),
    endValue = end & WORD_MASK,
    carry = end > WORD_MASK,
    overflow = (~(frame ^ size) & (frame ^ endValue) & WORD_SIGN) !== 0;
  let x = (endValue - 1) & WORD_MASK;
  for (let y = argumentBytes; y; y -= 2) {
    x = (x - 1) & WORD_MASK;
    setWord(wram, x, word(wram, y - 2));
    x = (x - 1) & WORD_MASK;
  }
  setWord(wram, frame + FRAME_OPERAND_STACK, x);
  setWord(wram, frame + FRAME_SCRIPT, pointer + SCRIPT_HEADER_COUNTS);
  setWord(wram, frame + FRAME_SCRIPT_BANK, word(wram, DP_SCRIPT_HEADER_BANK));
  setWord(wram, frame + FRAME_PC, 0);
  const slot = word(wram, TASK_FREE_LIST);
  if (slot & WORD_SIGN) taskStop('task_slot_required', { script });
  setWord(wram, TASK_CONTINUATION + slot, 0);
  setWord(wram, TASK_WAIT + slot, 0);
  setWord(wram, TASK_FREE_LIST, word(wram, TASK_NEXT + slot));
  setWord(wram, TASK_FRAME + slot, frame);
  return { slot, carry, overflow };
}

// Start a task for script at the head of the task list (80:C34A); returns its slot,
// the list's old head and the carry and overflow the frame allocation leaves.
function appendTask(mem, wram, a, script) {
  a.pushWord(FRAME_JSR_RETURN);
  const { slot, carry, overflow } = allocateTaskFrame(mem, wram, a, script);
  a.pullWord();
  const head = word(wram, TASK_LIST_HEAD);
  setWord(wram, TASK_NEXT + slot, head);
  setWord(wram, TASK_PREVIOUS + slot, NO_TASK);
  if (!(head & WORD_SIGN)) setWord(wram, TASK_PREVIOUS + head, slot);
  setWord(wram, TASK_LIST_HEAD, slot);
  return { slot, head, carry, overflow };
}

// Start a task for script (80:C34A) below the caller's frame on the stack of a; returns
// the new task slot.
export function appendScriptTask(mem, wram, a, script) {
  return appendTask(mem, wram, a, script).slot;
}

// The task append as called with JSR, with the script in X: the return word lies on the
// stack, direct page 0 and binary arithmetic. Leaves A the new task slot, X the list's
// old head with its sign and zero, Y at the frame's PC word and the carry and overflow
// of the frame's end, as the original; returns the raw return word its RTS takes.
export function appendScriptTaskCall(a) {
  const { ctx, mem } = a;
  if (ctx.d !== 0) taskStop('task_direct_page_zero_required');
  if (ctx.status & FLAG_DECIMAL) taskStop('task_binary_arithmetic_required');
  if (ctx.bank & BANK_HIGH_HALF && ctx.bank !== WRAM_BANK)
    taskStop('task_data_bank_required', { bank: ctx.bank });
  const { slot, head, carry, overflow } = appendTask(mem, mem.wram, a, ctx.x);
  ctx.a = slot;
  ctx.x = head;
  ctx.y = FRAME_PC_OFFSET;
  flag(ctx, FLAG_NEGATIVE, head & WORD_SIGN);
  flag(ctx, FLAG_ZERO, head === 0);
  flag(ctx, FLAG_CARRY, carry);
  flag(ctx, FLAG_OVERFLOW, overflow);
  const rawReturnWord = a.pullWord();
  ctx.pc = (rawReturnWord + 1) & WORD_MASK;
  return { rawReturnWord };
}
