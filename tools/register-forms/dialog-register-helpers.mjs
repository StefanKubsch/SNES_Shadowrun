// The register-level ALU, compare, flag, push and direct page helpers of the dialog accessor
// (moved from src/system/native-dialog-support.mjs; user decision 2026-11-17: the
// lifted code keeps no register arithmetic). Importing this module adds them to every
// accessor dialogAccess creates; the register-level references and their tests import
// it. Widths follow M and X in the current status, as before.
import { extendDialogAccess } from './native-dialog-support.mjs';
import { taskStop } from '../../src/system/task-stop.mjs';
import {
  BANK_WRAP,
  BYTE_BITS,
  BYTE_MASK,
  BYTE_SIGN,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../../src/constants/bits.mjs';
import {
  FLAG_CARRY,
  FLAG_DECIMAL,
  FLAG_INDEX_8BIT,
  FLAG_OVERFLOW,
  FLAG_ZERO,
} from '../../src/constants/cpu-flags.mjs';

extendDialogAccess((h) => {
  const { a, ctx, m, xw, nz, load, read, write, pointer, push } = h,
    wa = () => (m() ? 1 : 2),
    wi = () => (xw() ? 1 : 2);
  // The direct page (D = 0) in bank 0 with the A width.
  const dp = (offset, bytes = wa()) =>
    bytes === 1 ? a.read(offset & WORD_MASK) : a.readWord(offset & WORD_MASK, BANK_WRAP);
  const dpWrite = (offset, value, bytes = wa()) => {
    if (bytes === 1) a.write(offset & WORD_MASK, value & BYTE_MASK);
    else a.writeWord(offset & WORD_MASK, value & WORD_MASK, BANK_WRAP);
  };
  // Memory INC/DEC/ASL with the A width, of a long address or (bank0) the direct page.
  const modify = (address, op, bank0 = false) => {
    const bytes = wa(),
      mask = bytes === 1 ? BYTE_MASK : WORD_MASK;
    const get = () => (bank0 ? dp(address, bytes) : read(address, bytes)),
      put = (v) => (bank0 ? dpWrite(address, v, bytes) : write(address, v, bytes));
    let v = get();
    if (op === 'asl') {
      ctx.status =
        (ctx.status & ~FLAG_CARRY) | (v >>> (bytes === 1 ? BYTE_BITS - 1 : WORD_BITS - 1));
      v = (v << 1) & mask;
    } else v = (v + (op === 'inc' ? 1 : -1)) & mask;
    nz(v, bytes);
    put(v);
    return v;
  };
  const port = (offset, bytes, pc) => a.absoluteRead(offset, bytes, pc);
  // [dp],Y: the effective address with bank carry.
  const indirect = (offset, y = 0) => (pointer(offset) + y) & LONG_MASK;
  const compare = (left, right, bytes) => {
    const mask = bytes === 1 ? BYTE_MASK : WORD_MASK;
    left &= mask;
    right &= mask;
    ctx.status = (ctx.status & ~FLAG_CARRY) | Number(left >= right);
    nz(left - right, bytes);
  };
  const cmp = (right) => compare(ctx.a, right, wa()),
    cpx = (right) => compare(ctx.x, right, wi()),
    cpy = (right) => compare(ctx.y, right, wi());
  const arithmetic = (right, subtract = false) => {
    if (ctx.status & FLAG_DECIMAL) taskStop('task_binary_arithmetic_required');
    const bytes = wa(),
      mask = bytes === 1 ? BYTE_MASK : WORD_MASK,
      sign = bytes === 1 ? BYTE_SIGN : WORD_SIGN,
      left = ctx.a & mask,
      c = ctx.status & FLAG_CARRY;
    if (subtract) right = ~right;
    right &= mask;
    const sum = left + right + c,
      next = sum & mask;
    ctx.status =
      (ctx.status & ~(FLAG_CARRY | FLAG_OVERFLOW)) |
      Number(sum > mask) |
      (~(left ^ right) & (left ^ next) & sign ? FLAG_OVERFLOW : 0);
    load(next);
  };
  const adc = (right) => arithmetic(right, false),
    sbc = (right) => arithmetic(right, true);
  const asl = () => {
    const n = ctx.a & (m() ? BYTE_MASK : WORD_MASK);
    ctx.status = (ctx.status & ~FLAG_CARRY) | (n >>> (m() ? BYTE_BITS - 1 : WORD_BITS - 1));
    load(n << 1);
  };
  const lsr = () => {
    const n = ctx.a & (m() ? BYTE_MASK : WORD_MASK);
    ctx.status = (ctx.status & ~FLAG_CARRY) | (n & 1);
    load(n >>> 1);
  };
  const rol = () => {
    const n = ctx.a & (m() ? BYTE_MASK : WORD_MASK),
      c = ctx.status & FLAG_CARRY;
    ctx.status = (ctx.status & ~FLAG_CARRY) | (n >>> (m() ? BYTE_BITS - 1 : WORD_BITS - 1));
    load((n << 1) | c);
  };
  const xba = () => {
    ctx.a = ((ctx.a >>> BYTE_BITS) | (ctx.a << BYTE_BITS)) & WORD_MASK;
    nz(ctx.a & BYTE_MASK, 1);
  };
  // TSB/TRB: Z from A AND memory before the change.
  const testBits = (address, set, bank0 = false) => {
    const bytes = wa(),
      mask = bytes === 1 ? BYTE_MASK : WORD_MASK;
    const v = bank0 ? dp(address, bytes) : read(address, bytes),
      bits = ctx.a & mask;
    ctx.status = (ctx.status & ~FLAG_ZERO) | ((v & bits) === 0 ? FLAG_ZERO : 0);
    const next = set ? v | bits : v & ~bits & mask;
    if (bank0) dpWrite(address, next, bytes);
    else write(address, next, bytes);
  };
  const bit = (mask) => {
    ctx.status =
      (ctx.status & ~FLAG_ZERO) |
      ((ctx.a & mask & (m() ? BYTE_MASK : WORD_MASK)) === 0 ? FLAG_ZERO : 0);
  };
  const sep = (bits) => {
    ctx.status |= bits;
    if (bits & FLAG_INDEX_8BIT) {
      ctx.x &= BYTE_MASK;
      ctx.y &= BYTE_MASK;
    }
  };
  const pha = () => push(ctx.a, wa()),
    phx = () => push(ctx.x, wi()),
    phy = () => push(ctx.y, wi());
  // MVN/MVP with 16-bit indices: A+1 bytes, X/Y wrap, DBR becomes the target bank, A ends at FFFF.
  const move = (source, destination, step, beforeByte = null) => {
    if (xw()) taskStop('task_block_move_index_width_required');
    // MVN/MVP repeat the opcode for every byte. An explicitly observed NMI
    // may run before an iteration, with the genuine remaining A/X/Y/DBR.
    do {
      if (beforeByte !== null) beforeByte();
      ctx.bank = destination;
      a.write((destination << WORD_BITS) | ctx.y, a.read((source << WORD_BITS) | ctx.x));
      ctx.x = (ctx.x + step) & WORD_MASK;
      ctx.y = (ctx.y + step) & WORD_MASK;
      ctx.a = (ctx.a - 1) & WORD_MASK;
    } while (ctx.a !== WORD_MASK);
  };
  return {
    dp,
    dpWrite,
    modify,
    port,
    indirect,
    compare,
    cmp,
    cpx,
    cpy,
    adc,
    sbc,
    asl,
    lsr,
    rol,
    xba,
    testBits,
    bit,
    sep,
    pha,
    phx,
    phy,
    move,
  };
});
