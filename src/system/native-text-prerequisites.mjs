import { CODE_BANK_PAIR } from '../constants/memory-map.mjs';
import { taskStop } from './task-stop.mjs';
import {
  BYTE_MASK,
  WORD_MASK,
  BYTE_SIGN,
  WORD_SIGN,
  BYTE_BITS,
  WORD_BITS,
  BANK_SIZE,
  LONG_MASK,
  LONG_WRAP,
  BANK_WRAP,
} from '../constants/bits.mjs';
import {
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_ZERO,
  FLAG_NEGATIVE,
  FLAG_CARRY,
  FLAG_DECIMAL,
  FLAG_OVERFLOW,
} from '../constants/cpu-flags.mjs';

// Fixed byte equations used only by these individually pinned text roots.
// Actual context and stack owners belong to the shared outer Task plan.
function access(a, { entryM = 0 } = {}) {
  const { ctx } = a;
  if (ctx.d !== 0) taskStop('task_direct_page_zero_required');
  if (
    ![0, 1].includes(entryM) ||
    (ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)) !== (entryM ? FLAG_MEMORY_8BIT : 0)
  )
    taskStop(entryM ? 'task_text_byte_mode_required' : 'task_text_word_mode_required');
  const width = () => (ctx.status & FLAG_MEMORY_8BIT ? 1 : 2);
  const mask = () => (width() === 1 ? BYTE_MASK : WORD_MASK);
  const nz = (value, bytes = width()) => {
    const m = bytes === 1 ? BYTE_MASK : WORD_MASK,
      sign = bytes === 1 ? BYTE_SIGN : WORD_SIGN;
    value &= m;
    ctx.status =
      (ctx.status & ~(FLAG_ZERO | FLAG_NEGATIVE)) |
      (value & sign ? FLAG_NEGATIVE : 0) |
      (value === 0 ? FLAG_ZERO : 0);
    return value;
  };
  const load = (value, bytes = width()) => {
    const m = bytes === 1 ? BYTE_MASK : WORD_MASK;
    ctx.a = (ctx.a & ~m) | nz(value, bytes);
    return ctx.a & m;
  };
  const abs = (offset) => ctx.bank * BANK_SIZE + offset;
  const read = (address, bytes = width()) =>
    bytes === 1
      ? a.read(address & LONG_MASK, 'text-root-BYTE')
      : a.readWord(address & LONG_MASK, LONG_WRAP, 'text-root-WORD');
  const write = (address, value, bytes = width()) => {
    if (bytes === 1) a.write(address & LONG_MASK, value & BYTE_MASK, 'text-root-BYTE');
    else a.writeWord(address & LONG_MASK, value & WORD_MASK, LONG_WRAP, 'text-root-WORD');
  };
  const dp = (offset, bytes = width()) =>
    bytes === 1
      ? a.read(offset, 'text-root-DP-BYTE')
      : a.readWord(offset, BANK_WRAP, 'text-root-DP-WORD');
  const dpWrite = (offset, value, bytes = width()) => {
    if (bytes === 1) a.write(offset, value & BYTE_MASK, 'text-root-DP-BYTE');
    else a.writeWord(offset, value & WORD_MASK, BANK_WRAP, 'text-root-DP-WORD');
  };
  const compare = (left, right) => {
    ctx.status = (ctx.status & ~FLAG_CARRY) | Number(left >= right);
    nz((left - right) & mask());
  };
  const arithmetic = (right, subtract = false) => {
    if (ctx.status & FLAG_DECIMAL) taskStop('task_binary_arithmetic_required');
    const m = mask(),
      sign = width() === 1 ? BYTE_SIGN : WORD_SIGN,
      left = ctx.a & m,
      c = ctx.status & FLAG_CARRY,
      sum = subtract ? left - right - 1 + c : left + right + c,
      next = sum & m;
    const overflow =
      (subtract ? (left ^ right) & (left ^ next) : ~(left ^ right) & (left ^ next)) & sign;
    ctx.status =
      (ctx.status & ~(FLAG_CARRY | FLAG_OVERFLOW)) |
      (subtract ? Number(sum >= 0) : Number(sum > m)) |
      (overflow ? FLAG_OVERFLOW : 0);
    load(next);
  };
  const asl = () => {
    const n = ctx.a & mask();
    ctx.status =
      (ctx.status & ~FLAG_CARRY) | (n >>> (width() === 1 ? BYTE_BITS - 1 : WORD_BITS - 1));
    load(n << 1);
  };
  const lsr = () => {
    const n = ctx.a & mask();
    ctx.status = (ctx.status & ~FLAG_CARRY) | (n & 1);
    load(n >>> 1);
  };
  const xba = () => {
    ctx.a = ((ctx.a >>> BYTE_BITS) | (ctx.a << BYTE_BITS)) & WORD_MASK;
    nz(ctx.a & BYTE_MASK, 1);
  };
  const pushByte = (value, label) => {
    a.write(ctx.s, value, label);
    ctx.s = (ctx.s - 1) & WORD_MASK;
  };
  const pullByte = (label, outer = false) => {
    const value = a.read((ctx.s + 1) & WORD_MASK, label, outer);
    ctx.s = (ctx.s + 1) & WORD_MASK;
    return value;
  };
  const selectBank = () => {
    pushByte(ctx.bank, 'text-PHB');
    a.pushWord(CODE_BANK_PAIR, 'text-PEA8080');
    ctx.bank = pullByte('text-PLB-first');
    nz(ctx.bank, 1);
    ctx.bank = pullByte('text-PLB-second');
    nz(ctx.bank, 1);
  };
  const restoreBank = () => {
    ctx.bank = pullByte('text-PLB-restored-fresh');
    nz(ctx.bank, 1);
  };
  const finish = (outerReturn = true) => {
    if (ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)) taskStop('task_text_word_mode_required');
    const rawReturnWord = a.readWord(
      (ctx.s + 1) & WORD_MASK,
      BANK_WRAP,
      'text-RTL-WORD-fresh',
      outerReturn,
    );
    ctx.s = (ctx.s + 2) & WORD_MASK;
    const returnBank = pullByte('text-RTL-bank-fresh', outerReturn);
    ctx.programBank = returnBank;
    ctx.pc = (rawReturnWord + 1) & WORD_MASK;
    return {
      rawReturnWord,
      returnBank,
      returnTarget: returnBank * BANK_SIZE + ctx.pc,
      frontier: 'observed-outer-RTL-target',
      scope: 'manual-source-specific-text-root-return-target-not-executed',
      dynamicDispatchExecuted: false,
      returnTargetExecuted: false,
    };
  };
  return {
    ctx,
    nz,
    load,
    abs,
    read,
    write,
    dp,
    dpWrite,
    compare,
    arithmetic,
    asl,
    lsr,
    xba,
    pushByte,
    pullByte,
    selectBank,
    restoreBank,
    finish,
  };
}
export { access as taskTextAccess };
