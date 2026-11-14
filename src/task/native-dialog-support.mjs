import { taskStop } from './plan.mjs';
import {
  HIGH_BYTE_MASK,
  LONG_MASK,
  BANK_SIZE,
  LONG_WRAP,
  BYTE_MASK,
  WORD_MASK,
  BANK_WRAP,
  WORD_BITS,
  BYTE_BITS,
  BYTE_SIGN,
  WORD_SIGN,
} from '../constants/bits.mjs';
import {
  FLAG_MEMORY_8BIT,
  FLAG_INDEX_8BIT,
  FLAG_ZERO,
  FLAG_NEGATIVE,
  FLAG_CARRY,
  FLAG_DECIMAL,
  FLAG_OVERFLOW,
} from '../constants/cpu-flags.mjs';

const JSR_RETURN_OFFSET = 2,
  JSL_RETURN_OFFSET = 3;

// Register and memory equations for the dialog routines ($936C and its subroutines).
// Widths follow M/X in the current status; subcalls push the real JSR/JSL frame and
// check the return. Hardware accesses go through absoluteRead/absoluteWrite with the original PC.
export function dialogAccess(a) {
  const { ctx } = a;
  if (ctx.d !== 0) taskStop('task_direct_page_zero_required');
  const m = () => (ctx.status & FLAG_MEMORY_8BIT) !== 0,
    xw = () => (ctx.status & FLAG_INDEX_8BIT) !== 0;
  const nz = (value, bytes) => {
    const mask = bytes === 1 ? BYTE_MASK : WORD_MASK,
      sign = bytes === 1 ? BYTE_SIGN : WORD_SIGN;
    value &= mask;
    ctx.status =
      (ctx.status & ~(FLAG_ZERO | FLAG_NEGATIVE)) |
      (value & sign ? FLAG_NEGATIVE : 0) |
      (value === 0 ? FLAG_ZERO : 0);
    return value;
  };
  // A and the index registers with the width from M or X; a BYTE A keeps the high byte.
  const load = (value) => {
    if (m()) ctx.a = (ctx.a & HIGH_BYTE_MASK) | nz(value, 1);
    else ctx.a = nz(value, 2);
    return ctx.a;
  };
  const index = (name, value) => {
    ctx[name] = nz(value, xw() ? 1 : 2);
    return ctx[name];
  };
  const wa = () => (m() ? 1 : 2),
    wi = () => (xw() ? 1 : 2);
  const abs = (offset) => (ctx.bank * BANK_SIZE + offset) & LONG_MASK;
  const read = (address, bytes = wa()) =>
    bytes === 1 ? a.read(address & LONG_MASK) : a.readWord(address & LONG_MASK, LONG_WRAP);
  const write = (address, value, bytes = wa()) => {
    if (bytes === 1) a.write(address & LONG_MASK, value & BYTE_MASK);
    else a.writeWord(address & LONG_MASK, value & WORD_MASK, LONG_WRAP);
  };
  const dp = (offset, bytes = wa()) =>
    bytes === 1 ? a.read(offset & WORD_MASK) : a.readWord(offset & WORD_MASK, BANK_WRAP);
  const dpWrite = (offset, value, bytes = wa()) => {
    if (bytes === 1) a.write(offset & WORD_MASK, value & BYTE_MASK);
    else a.writeWord(offset & WORD_MASK, value & WORD_MASK, BANK_WRAP);
  };
  // [dp] and [dp],Y: pointer afresh from three DP bytes, effective address with bank carry.
  const pointer = (offset) =>
    a.readWord(offset & WORD_MASK, BANK_WRAP) | (a.read((offset + 2) & WORD_MASK) << WORD_BITS);
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
  // Memory INC/DEC/ASL with the A width.
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
  const rep = (bits) => {
    ctx.status &= ~bits;
  };
  const pushByte = (value) => {
    a.write(ctx.s, value & BYTE_MASK);
    ctx.s = (ctx.s - 1) & WORD_MASK;
  };
  const pullByte = () => {
    ctx.s = (ctx.s + 1) & WORD_MASK;
    return a.read(ctx.s);
  };
  const push = (value, bytes) => {
    if (bytes === 2) pushByte(value >>> BYTE_BITS);
    pushByte(value);
  };
  const pull = (bytes) => {
    const lo = pullByte();
    return bytes === 2 ? lo | (pullByte() << BYTE_BITS) : lo;
  };
  const pha = () => push(ctx.a, wa()),
    pla = () => load(pull(wa()));
  const phx = () => push(ctx.x, wi()),
    plx = () => index('x', pull(wi()));
  const phy = () => push(ctx.y, wi()),
    ply = () => index('y', pull(wi()));
  const php = () => pushByte(ctx.status);
  const plp = () => {
    ctx.status = pullByte();
    if (ctx.status & FLAG_INDEX_8BIT) {
      ctx.x &= BYTE_MASK;
      ctx.y &= BYTE_MASK;
    }
  };
  const phb = () => pushByte(ctx.bank),
    plb = () => {
      ctx.bank = nz(pullByte(), 1);
    };
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
  // Subcall with a real frame: run() ends with rts()/rtl() of the called routine.
  const call = (pc, target, run, long = false) => {
    const bank = ctx.programBank,
      raw = (pc + (long ? JSL_RETURN_OFFSET : JSR_RETURN_OFFSET)) & WORD_MASK;
    if (long) pushByte(bank);
    a.pushWord(raw);
    ctx.programBank = target >>> WORD_BITS;
    ctx.pc = target & WORD_MASK;
    const result = run();
    if (ctx.programBank !== bank || ctx.pc !== ((raw + 1) & WORD_MASK))
      taskStop('task_native_helper_return_required', {
        pc,
        target,
        bank: ctx.programBank,
        returnPc: ctx.pc,
      });
    return result;
  };
  const rts = () => {
    const raw = a.pullWord();
    ctx.pc = (raw + 1) & WORD_MASK;
    return raw;
  };
  const rtl = () => {
    const raw = a.pullWord();
    ctx.programBank = pullByte();
    ctx.pc = (raw + 1) & WORD_MASK;
    return raw;
  };
  const port = (offset, bytes, pc) => a.absoluteRead(offset, bytes, pc);
  const portWrite = (offset, value, bytes, pc) => a.absoluteWrite(offset, value, bytes, pc);
  return {
    a,
    ctx,
    m,
    xw,
    nz,
    load,
    index,
    abs,
    read,
    write,
    dp,
    dpWrite,
    pointer,
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
    modify,
    testBits,
    bit,
    sep,
    rep,
    pushByte,
    pullByte,
    push,
    pull,
    pha,
    pla,
    phx,
    plx,
    phy,
    ply,
    php,
    plp,
    phb,
    plb,
    move,
    call,
    rts,
    rtl,
    port,
    portWrite,
  };
}
