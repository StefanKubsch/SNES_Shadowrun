// The script task append (lifted from 80:C34A with the task frame allocation 80:C2C8
// and the heap 80:C242; register-level versions in proof/system/task-append.mjs and
// proof/system/script-yield.mjs, which the register-level references use).
//
// A task for a script is started at the head of the task list: a frame for the script
// is taken from the heap (the first free block that fits, merged with the free blocks
// after it, split when enough is left over), the script's arguments are copied from
// the direct page words 00 on to the frame's end, and a free task slot takes the frame.
//
// The frame allocation writes the direct page words of the original (the script header
// pointer 71, its bank word 73 and the frame 74) and the heap request, frame size and
// argument count words. The return words of the inner calls and the next word the heap
// pushes while it splits a block lie on the stack as in the original. Memory is
// reached as the original reaches it: the heap, the task tables, the frame fields and
// the argument source (FFFE plus the argument offset) through the data bank with a
// 24-bit index, the direct page words and the copied arguments (direct page plus X) in
// bank 0. In the game these all lie in WRAM below 2000; a damaged heap or task word
// reaches what the original reaches. Words the original reads again after writing are
// read again here. A full heap or no free task slot, after which the original writes
// through a meaningless frame or slot, stops at the frontiers `task_heap_required` and
// `task_slot_required`; a script with an odd number of argument bytes (none has one),
// whose copy loop never ends, at `script_arguments_required`.
import { taskStop } from '../system/task-stop.mjs';
import { NO_TASK } from '../data/wram.mjs';
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
import { BYTE_MASK, LONG_MASK, WORD_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
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
// The argument copy reads the words at FFFE plus the argument offset (2, 4, ...)
// through the data bank, which reach the next bank's first words.
const ARGUMENT_SOURCE = 0xfffe;
// A heap block is split when at least a header and one data byte are left over.
const HEAP_MIN_SPLIT_BYTES = HEAP_HEADER_BYTES + 1;
// The return words of the JSRs to C2C8 (from C34A) and C242 (from C2F5).
const FRAME_JSR_RETURN = 0xc34c,
  HEAP_JSR_RETURN = 0xc2f7;

// A word through the data bank at offset (absolute indexed: a 24-bit address).
const bankAddress = (a, offset) => ((a.ctx.bank << WORD_BITS) + offset) & LONG_MASK;
const bankWord = (a, offset) => a.mem.read16(bankAddress(a, offset));
const setBankWord = (a, offset, value) => a.mem.write16(bankAddress(a, offset), value & WORD_MASK);
// A word in bank 0 at the direct page plus offset (16-bit wrap).
const directWord = (a, offset) => a.mem.read16Bank0((a.ctx.d + offset) & WORD_MASK);
const setDirectWord = (a, offset, value) =>
  a.mem.write16Bank0((a.ctx.d + offset) & WORD_MASK, value & WORD_MASK);

// Take a heap block of size bytes (80:C242): the first free block that fits, merged
// with the free blocks after it; split when enough is left over. Returns the block's
// data address.
function allocateHeapBlock(a, size) {
  const full = () => taskStop('task_heap_required', { size }),
    request = () => bankWord(a, HEAP_REQUEST),
    next = (x) => bankWord(a, HEAP_NEXT_WORD + x),
    sizeWord = (x) => bankWord(a, HEAP_SIZE_WORD + x);
  setBankWord(a, HEAP_REQUEST, size);
  let x = 0;
  for (;;) {
    let blockSize = sizeWord(x);
    if (blockSize & HEAP_USED) {
      x = next(x);
      if (!x) return full();
      continue;
    }
    // The free block, merged with the free blocks after it until it fits; rest is what
    // is left over when it fits.
    let rest = null;
    for (;;) {
      const difference = blockSize - request();
      if (difference >= 0) {
        rest = difference;
        break;
      }
      const y = next(x);
      if (!y) return full();
      const following = sizeWord(y);
      if (following & HEAP_USED) break;
      // ADC without CLC: the carry of the first addition goes into the second.
      const sum = following + sizeWord(x);
      setBankWord(a, HEAP_SIZE_WORD + x, sum + HEAP_HEADER_BYTES + (sum > WORD_MASK ? 1 : 0));
      setBankWord(a, HEAP_NEXT_WORD + x, next(y));
      blockSize = sizeWord(x);
    }
    if (rest === null) {
      x = next(x);
      if (!x) return full();
      continue;
    }
    if (rest >= HEAP_MIN_SPLIT_BYTES) {
      a.pushWord(next(x));
      const sum = x + request(),
        y = (sum + HEAP_HEADER_BYTES + (sum > WORD_MASK ? 1 : 0)) & WORD_MASK;
      setBankWord(a, HEAP_NEXT_WORD + x, y);
      // SBC with the borrow of the first subtraction going into the second.
      const difference = sizeWord(x) - request();
      setBankWord(a, HEAP_SIZE_WORD + y, difference - HEAP_HEADER_BYTES - (difference < 0 ? 1 : 0));
      setBankWord(a, HEAP_NEXT_WORD + y, a.pullWord());
      setBankWord(a, HEAP_SIZE_WORD + x, request() | HEAP_USED);
    } else setBankWord(a, HEAP_SIZE_WORD + x, sizeWord(x) | HEAP_USED);
    return (x + HEAP_DATA) & WORD_MASK;
  }
}

// Allocate the frame of a task for script (80:C2C8) and take a free task slot for it;
// returns the slot. Game state only (user decision 2026-11-17): the carry and overflow
// of the original's last addition (the frame's end) are not produced.
function allocateTaskFrame(a, script) {
  const { mem } = a,
    frameField = (offset) => directWord(a, DP_FRAME) + offset,
    setFrameField = (offset, value) => setBankWord(a, frameField(offset), value);
  setDirectWord(a, DP_SCRIPT_HEADER_BANK, mem.read16((SCRIPT_BANKS + script) & LONG_MASK));
  setBankWord(a, FRAME_ARGUMENT_BYTES, mem.read8((SCRIPT_ARGUMENT_BYTES + script) & LONG_MASK));
  setDirectWord(
    a,
    DP_SCRIPT_HEADER,
    mem.read16((SCRIPT_POINTERS + ((script << 1) & WORD_MASK)) & LONG_MASK),
  );
  // The two counts of the script header and the fixed bytes, added in 8 bits; the
  // carry of the first addition goes into the second.
  const header =
      (mem.read8((a.ctx.d + DP_SCRIPT_HEADER_BANK) & WORD_MASK) << WORD_BITS) |
      directWord(a, DP_SCRIPT_HEADER),
    counts = mem.read8(header) + mem.read8((header + 1) & LONG_MASK),
    size = ((counts & BYTE_MASK) + FRAME_FIXED_BYTES + (counts > BYTE_MASK ? 1 : 0)) & BYTE_MASK;
  setBankWord(a, FRAME_SIZE, size);
  a.pushWord(HEAP_JSR_RETURN);
  const frame = allocateHeapBlock(a, size);
  a.pullWord();
  setDirectWord(a, DP_FRAME, frame);
  const returnBase = frame + FRAME_RETURN_BASE;
  setFrameField(FRAME_RETURN, returnBase);
  // The arguments in the direct page words from 00 go to the end of the frame, the
  // operand stack starts below them. The carry of the return base goes into the end.
  const start = directWord(a, DP_FRAME),
    frameSize = bankWord(a, FRAME_SIZE),
    end = (start + frameSize + (returnBase > WORD_MASK ? 1 : 0)) & WORD_MASK;
  let x = (end - 1) & WORD_MASK;
  const argumentBytes = bankWord(a, FRAME_ARGUMENT_BYTES);
  if (argumentBytes & 1) taskStop('script_arguments_required', { script });
  for (let y = argumentBytes; y; y -= 2) {
    const argument = bankWord(a, ARGUMENT_SOURCE + y);
    x = (x - 1) & WORD_MASK;
    mem.write16Bank0((a.ctx.d + x) & WORD_MASK, argument);
    x = (x - 1) & WORD_MASK;
  }
  setFrameField(FRAME_OPERAND_STACK, x);
  setFrameField(FRAME_SCRIPT, directWord(a, DP_SCRIPT_HEADER) + SCRIPT_HEADER_COUNTS);
  setFrameField(FRAME_SCRIPT_BANK, directWord(a, DP_SCRIPT_HEADER_BANK));
  setFrameField(FRAME_PC, 0);
  const slot = bankWord(a, TASK_FREE_LIST);
  if (slot & WORD_SIGN) taskStop('task_slot_required', { script });
  setBankWord(a, TASK_CONTINUATION + slot, 0);
  setBankWord(a, TASK_WAIT + slot, 0);
  setBankWord(a, TASK_FREE_LIST, bankWord(a, TASK_NEXT + slot));
  setBankWord(a, TASK_FRAME + slot, directWord(a, DP_FRAME));
  return slot;
}

// Start a task for script at the head of the task list (80:C34A); returns its slot and
// the list's old head.
export function appendTask(a, script) {
  a.pushWord(FRAME_JSR_RETURN);
  const slot = allocateTaskFrame(a, script);
  a.pullWord();
  setBankWord(a, TASK_NEXT + slot, bankWord(a, TASK_LIST_HEAD));
  setBankWord(a, TASK_PREVIOUS + slot, NO_TASK);
  const head = bankWord(a, TASK_LIST_HEAD);
  if (!(head & WORD_SIGN)) setBankWord(a, TASK_PREVIOUS + head, slot);
  setBankWord(a, TASK_LIST_HEAD, slot);
  return { slot, head };
}

// Start a task for script (80:C34A) below the caller's frame on the stack of a, with
// the data bank and direct page of a; returns the new task slot.
export function appendScriptTask(a, script) {
  return appendTask(a, script).slot;
}

// The task append for lifted callers, called with JSR: the script is a parameter (X in
// the original) and no registers are left (user decision 2026-11-17; the script visit
// that follows reads task state only); its arithmetic is binary, whatever the decimal
// flag. Its live callers run with the direct page at 0 and it checks no direct page
// register (the register-level caller in proof/caller/task-append-call.mjs keeps that
// check). Returns the raw return word its RTS takes.
export function appendScriptReturn(a, script) {
  const { ctx } = a;
  appendTask(a, script);
  const rawReturnWord = a.pullWord();
  ctx.pc = (rawReturnWord + 1) & WORD_MASK;
  return { rawReturnWord };
}
