import {
  HEAP_REQUEST,
  HEAP_SIZE_WORD,
  HEAP_NEXT_WORD,
  HEAP_DATA,
  HEAP_USED,
  HEAP_HEADER_BYTES,
  FRAME_ARGUMENT_BYTES,
  FRAME_SIZE,
  TASK_FREE_LIST,
  TASK_CONTINUATION,
  TASK_WAIT,
  TASK_NEXT,
  TASK_FRAME,
  TASK_CURSOR,
  TASK_PREVIOUS,
  TASK_LIST_HEAD,
  SCRIPT_BANKS,
  SCRIPT_ARGUMENT_BYTES,
  SCRIPT_POINTERS,
  FRAME_FIXED_BYTES,
  FRAME_RETURN_BASE,
  FRAME_RETURN,
  FRAME_OPERAND_STACK,
} from '../vm/layout.mjs';
import { taskStop } from './plan.mjs';
import { renderAddress } from '../render/data.mjs';
import { runTaskScriptArguments } from './script-arguments.mjs';
import {
  FLAG_ZERO,
  FLAG_NEGATIVE,
  FLAG_CARRY,
  FLAG_OVERFLOW,
  FLAG_MEMORY_8BIT,
  FLAG_DECIMAL,
} from '../constants/cpu-flags.mjs';
import {
  BYTE_MASK,
  WORD_MASK,
  HIGH_BYTE_MASK,
  LONG_MASK,
  BANK_SIZE,
  LONG_WRAP,
  BANK_WRAP,
  WORD_BITS,
  BYTE_SIGN,
  WORD_SIGN,
} from '../constants/bits.mjs';
import { CODE_BANK_BASE, CODE_BANK_PAIR } from '../constants/memory-map.mjs';

// C2C8 scratch pointers and C30F argument source retain the original address carry.
const SCRIPT_HEADER_POINTER = 0x71,
  SCRIPT_HEADER_BANK = 0x73,
  NEW_FRAME_POINTER = 0x74;
const ARGUMENT_COPY_BASE = 0xfffe;
// C279 leaves room for a new block header and at least one data byte.
const HEAP_MIN_SPLIT_BYTES = HEAP_HEADER_BYTES + 1;
const FRAME_HEAP_RETURN_WORD = 0xc2f7,
  FRAME_HEAP_RESUME = 0xc2f8;
const CHILD_FRAME_RETURN_WORD = 0xc36c,
  CHILD_FRAME_RESUME = 0xc36d;
const SCRIPT_CHILD_RETURN_WORD = 0xf494;
const WAIT_FOR_CHILD = WORD_MASK;

// Manually transcribed fixed C242/C2C8/C36A equations. No instruction dispatch.
export function scriptAllocationEquations(a) {
  const c = a.ctx;
  const nz = (v, w = 2) => {
    v &= w === 1 ? BYTE_MASK : WORD_MASK;
    c.status =
      (c.status & ~(FLAG_ZERO | FLAG_NEGATIVE)) |
      (v & (w === 1 ? BYTE_SIGN : WORD_SIGN) ? FLAG_NEGATIVE : 0) |
      (v === 0 ? FLAG_ZERO : 0);
    return v;
  };
  const load = (v, w = 2) => {
    v = nz(v, w);
    c.a = w === 1 ? (c.a & HIGH_BYTE_MASK) | v : v;
    return v;
  };
  const ix = (r, v) => (c[r] = nz(v));
  const abs = (n) => (c.bank * BANK_SIZE + n) & LONG_MASK;
  const rw = (n) => a.readWord(abs(n), LONG_WRAP, 'script-actualDBR-WORD');
  const ww = (n, v) => a.writeWord(abs(n), v, LONG_WRAP, 'script-actualDBR-WORD');
  const dp = (n) => a.readWord((c.d + n) & WORD_MASK, BANK_WRAP, 'script-fresh-DP-WORD');
  const dw = (n, v) => a.writeWord((c.d + n) & WORD_MASK, v, BANK_WRAP, 'script-DP-WORD');
  const pointer = (n, long = false) =>
    dp(n) |
    (long
      ? a.read((c.d + n + 2) & WORD_MASK, 'script-fresh-pointer-bank') << WORD_BITS
      : c.bank << WORD_BITS);
  const arithmetic = (right, subtract = false, w = 2) => {
    const mask = w === 1 ? BYTE_MASK : WORD_MASK,
      sign = w === 1 ? BYTE_SIGN : WORD_SIGN,
      left = c.a & mask,
      carry = c.status & FLAG_CARRY;
    const sum = subtract ? left - right - 1 + carry : left + right + carry,
      result = sum & mask;
    const overflow = subtract
      ? (left ^ right) & (left ^ result) & sign
      : ~(left ^ right) & (left ^ result) & sign;
    c.status =
      (c.status & ~(FLAG_CARRY | FLAG_OVERFLOW)) |
      (subtract ? Number(sum >= 0) : Number(sum > mask)) |
      (overflow ? FLAG_OVERFLOW : 0);
    load(result, w);
  };
  const cmp = (v) => {
    const result = (c.a - v) & WORD_MASK;
    c.status = (c.status & ~FLAG_CARRY) | Number(c.a >= v);
    nz(result);
  };
  const rts = (expected = null, outer = false) => {
    const raw = a.readWord(
      (c.s + 1) & WORD_MASK,
      BANK_WRAP,
      outer ? 'script-outer-RTS' : 'script-inner-RTS',
      outer,
    );
    c.s = (c.s + 2) & WORD_MASK;
    c.pc = (raw + 1) & WORD_MASK;
    if (expected !== null && c.pc !== expected)
      taskStop('task_script_return_target_required', { returnTarget: CODE_BANK_BASE | c.pc });
    return raw;
  };
  return { c, nz, load, ix, abs, rw, ww, dp, dw, pointer, arithmetic, cmp, rts };
}
function heap(a, h) {
  const { c, load, ix, rw, ww, arithmetic, cmp } = h;
  ww(HEAP_REQUEST, c.a);
  ix('x', 0);
  while (true) {
    load(rw(HEAP_SIZE_WORD + c.x));
    if (c.a & HEAP_USED) {
      load(rw(HEAP_NEXT_WORD + c.x));
      if (c.a === 0) return;
      ix('x', c.a);
      continue;
    }
    while (true) {
      c.status |= FLAG_CARRY;
      arithmetic(rw(HEAP_REQUEST), true);
      if (c.status & FLAG_CARRY) break;
      ix('y', rw(HEAP_NEXT_WORD + c.x));
      if (c.y === 0) return;
      load(rw(HEAP_SIZE_WORD + c.y));
      if (c.a & HEAP_USED) {
        load(rw(HEAP_NEXT_WORD + c.x));
        if (c.a === 0) return;
        ix('x', c.a);
        break;
      }
      arithmetic(rw(HEAP_SIZE_WORD + c.x));
      arithmetic(HEAP_HEADER_BYTES);
      ww(HEAP_SIZE_WORD + c.x, c.a);
      load(rw(HEAP_NEXT_WORD + c.y));
      ww(HEAP_NEXT_WORD + c.x, c.a);
      load(rw(HEAP_SIZE_WORD + c.x));
    }
    if (!(c.status & FLAG_CARRY)) continue;
    cmp(HEAP_MIN_SPLIT_BYTES);
    if (c.status & FLAG_CARRY) {
      load(rw(HEAP_NEXT_WORD + c.x));
      a.pushWord(c.a, 'heap-next-PHA');
      c.status &= ~FLAG_CARRY;
      load(c.x);
      arithmetic(rw(HEAP_REQUEST));
      arithmetic(HEAP_HEADER_BYTES);
      ww(HEAP_NEXT_WORD + c.x, c.a);
      ix('y', c.a);
      c.status |= FLAG_CARRY;
      load(rw(HEAP_SIZE_WORD + c.x));
      arithmetic(rw(HEAP_REQUEST), true);
      arithmetic(HEAP_HEADER_BYTES, true);
      ww(HEAP_SIZE_WORD + c.y, c.a);
      load(a.pullWord('heap-next-PLA'));
      ww(HEAP_NEXT_WORD + c.y, c.a);
      load(rw(HEAP_REQUEST));
      load(c.a | HEAP_USED);
      ww(HEAP_SIZE_WORD + c.x, c.a);
    } else {
      load(rw(HEAP_SIZE_WORD + c.x));
      load(c.a | HEAP_USED);
      ww(HEAP_SIZE_WORD + c.x, c.a);
    }
    c.status &= ~FLAG_CARRY;
    load(c.x);
    arithmetic(HEAP_DATA);
    return;
  }
}
export function runTaskFrameAllocation(a, h = scriptAllocationEquations(a)) {
  const { c, load, ix, rw, ww, dp, dw, pointer, arithmetic, rts } = h;
  load(a.readWord(SCRIPT_BANKS + c.x, LONG_WRAP, 'script-bank-table-WORD'));
  dw(SCRIPT_HEADER_BANK, c.a);
  load(a.readWord(SCRIPT_ARGUMENT_BYTES + c.x, LONG_WRAP, 'script-frame-argument-metadata-WORD'));
  load(c.a & BYTE_MASK);
  ww(FRAME_ARGUMENT_BYTES, c.a);
  load(c.x);
  c.status = (c.status & ~FLAG_CARRY) | Number(c.a >= WORD_SIGN);
  load(c.a * 2);
  ix('x', c.a);
  load(a.readWord(SCRIPT_POINTERS + c.x, LONG_WRAP, 'script-pointer-table-WORD'));
  dw(SCRIPT_HEADER_POINTER, c.a);
  load(0);
  c.status |= FLAG_MEMORY_8BIT;
  c.status &= ~FLAG_CARRY;
  load(a.read(pointer(SCRIPT_HEADER_POINTER, true), 'script-header-BYTE'), 1);
  ix('y', 1);
  arithmetic(
    a.read((pointer(SCRIPT_HEADER_POINTER, true) + c.y) & LONG_MASK, 'script-header-indexed-BYTE'),
    false,
    1,
  );
  arithmetic(FRAME_FIXED_BYTES, false, 1);
  c.status &= ~FLAG_MEMORY_8BIT;
  ww(FRAME_SIZE, c.a);
  a.pushWord(FRAME_HEAP_RETURN_WORD, 'frame-JSR-heap');
  heap(a, h);
  rts(FRAME_HEAP_RESUME);
  dw(NEW_FRAME_POINTER, c.a);
  c.status &= ~FLAG_CARRY;
  arithmetic(FRAME_RETURN_BASE);
  ix('y', FRAME_RETURN);
  a.writeWord(
    (pointer(NEW_FRAME_POINTER) + c.y) & LONG_MASK,
    c.a,
    LONG_WRAP,
    'script-frame-operand-base',
  );
  load(dp(NEW_FRAME_POINTER));
  arithmetic(rw(FRAME_SIZE));
  load(c.a - 1);
  ix('y', rw(FRAME_ARGUMENT_BYTES));
  if (c.y !== 0) {
    ix('x', c.a);
    do {
      load(rw(ARGUMENT_COPY_BASE + c.y));
      ix('x', c.x - 1);
      a.writeWord((c.d + c.x) & WORD_MASK, c.a, BANK_WRAP, 'script-frame-argument-copy');
      ix('x', c.x - 1);
      ix('y', c.y - 1);
      ix('y', c.y - 1);
    } while (c.y !== 0);
    load(c.x);
  }
  ix('y', FRAME_OPERAND_STACK);
  a.writeWord(
    (pointer(NEW_FRAME_POINTER) + c.y) & LONG_MASK,
    c.a,
    LONG_WRAP,
    'script-frame-saved-operand-S',
  );
  load(dp(SCRIPT_HEADER_POINTER));
  load(c.a + 1);
  load(c.a + 1);
  a.writeWord(pointer(NEW_FRAME_POINTER), c.a, LONG_WRAP, 'script-frame-stream-pointer');
  ix('y', 2);
  load(dp(SCRIPT_HEADER_BANK));
  a.writeWord(
    (pointer(NEW_FRAME_POINTER) + c.y) & LONG_MASK,
    c.a,
    LONG_WRAP,
    'script-frame-bank-WORD',
  );
  ix('y', c.y + 1);
  load(0);
  a.writeWord(
    (pointer(NEW_FRAME_POINTER) + c.y) & LONG_MASK,
    c.a,
    LONG_WRAP,
    'script-frame-PC-WORD',
  );
  ix('x', rw(TASK_FREE_LIST));
  if (!(c.x & WORD_SIGN)) {
    ww(TASK_CONTINUATION + c.x, 0);
    ww(TASK_WAIT + c.x, 0);
    load(rw(TASK_NEXT + c.x));
    ww(TASK_FREE_LIST, c.a);
    load(dp(NEW_FRAME_POINTER));
    ww(TASK_FRAME + c.x, c.a);
  }
}
function child(a, h) {
  const { c, load, ix, rw, ww, rts } = h;
  a.pushWord(CHILD_FRAME_RETURN_WORD, 'child-JSR-frame');
  runTaskFrameAllocation(a, h);
  rts(CHILD_FRAME_RESUME);
  load(rw(TASK_CURSOR));
  ww(TASK_NEXT + c.x, c.a);
  ix('y', c.a);
  load(rw(TASK_PREVIOUS + c.y));
  ww(TASK_PREVIOUS + c.x, c.a);
  load(c.x);
  ww(TASK_PREVIOUS + c.y, c.a);
  load(WAIT_FOR_CHILD);
  ww(TASK_WAIT + c.y, c.a);
  load(a.pullWord('child-PLA-caller-return'));
  ww(TASK_CONTINUATION + c.y, c.a);
  ix('y', rw(TASK_PREVIOUS + c.x));
  if (c.y & WORD_SIGN) ww(TASK_LIST_HEAD, c.x);
  else {
    load(c.x);
    ww(TASK_NEXT + c.y, c.a);
  }
  const outerReturnWord = rts(null, true);
  return {
    outerReturnWord,
    returnTarget: CODE_BANK_BASE | c.pc,
    frontier: 'actual-outer-yield-target',
    returnTargetExecuted: false,
    scope: 'manual-script52-arguments-frame-heap-child-outer-yield',
    stackMigrationExecuted: true,
    fullTaskBinding: false,
  };
}
function runTaskScriptYield(a, options) {
  if (a.ctx.status & FLAG_DECIMAL) taskStop('task_binary_arithmetic_required');
  if (
    ![1, 2].every((n) =>
      options.protectedStackBytes.includes(renderAddress((a.ctx.a + n) & WORD_MASK)),
    )
  )
    taskStop('task_outer_return_required');
  const h = scriptAllocationEquations(a);
  a.ctx.s = a.ctx.a;
  h.load(0);
  a.ctx.d = h.nz(0);
  a.pushWord(CODE_BANK_PAIR, 'script-bridge-PEA');
  for (let n = 0; n < 2; n++) {
    a.ctx.bank = h.nz(a.read((a.ctx.s + 1) & WORD_MASK, 'script-bridge-PLB'), 1);
    a.ctx.s = (a.ctx.s + 1) & WORD_MASK;
  }
  a.pushWord(SCRIPT_CHILD_RETURN_WORD, 'script-JSR-child');
  return child(a, h);
}
export function runTaskScriptOpcode(a, options) {
  const prefix = runTaskScriptArguments(a);
  if (options.expectedScriptId !== undefined && prefix.id !== options.expectedScriptId)
    taskStop('task_script_ID_required');
  return { ...prefix, ...runTaskScriptYield(a, options), argumentPrefixExecuted: true };
}

export { runTaskScriptYield };
