import { taskStop } from './task-stop.mjs';
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
} from '../constants/cpu-flags.mjs';

const JSR_RETURN_OFFSET = 2,
  JSL_RETURN_OFFSET = 3;

// Helpers further modules add to every accessor: the register-level ALU, compare, flag
// and push helpers of the references (proof/system/dialog-register-helpers.mjs, user
// decision 2026-11-17: the lifted code uses none of them).
const EXTENSIONS = [];
export function extendDialogAccess(extend) {
  EXTENSIONS.push(extend);
}

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
  const pla = () => load(pull(wa())),
    plx = () => index('x', pull(wi())),
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
  const h = {
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
    modify,
    rep,
    pushByte,
    pullByte,
    push,
    pull,
    pla,
    plx,
    ply,
    php,
    plp,
    phb,
    plb,
    call,
    rts,
    rtl,
    port,
    portWrite,
  };
  for (const extend of EXTENSIONS) Object.assign(h, extend(h));
  return h;
}
