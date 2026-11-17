import { taskStop } from './task-stop.mjs';

import {
  HIGH_BYTE_MASK,
  BYTE_BITS,
  BANK_WRAP,
  BANK_SIZE,
  LONG_WRAP,
  LONG_MASK,
  BYTE_MASK,
  WORD_MASK,
  BYTE_SIGN,
  WORD_SIGN,
} from '../constants/bits.mjs';
import {
  FLAG_ZERO,
  FLAG_NEGATIVE,
  FLAG_CARRY,
  FLAG_DECIMAL,
  FLAG_OVERFLOW,
} from '../constants/cpu-flags.mjs';
import { CODE_BANK_BASE } from '../constants/memory-map.mjs';
// Native equations shared only by the explicitly source-proved leaf callees.
// No ROM instructions are decoded or dispatched by this module.

// Script arguments arrive as consecutive words at the start of the direct page
// (workspace filled by runTaskScriptArguments in script-arguments.mjs).
export const FIRST_ARGUMENT = 0;
export const SECOND_ARGUMENT = 2;
export const THIRD_ARGUMENT = 4;
export const FOURTH_ARGUMENT = 6;

export function leafAccess(a) {
  if (a.ctx.d !== 0) taskStop('task_direct_page_zero_required');
  const nz = (value, width = 2) => {
    const mask = width === 1 ? BYTE_MASK : WORD_MASK,
      sign = width === 1 ? BYTE_SIGN : WORD_SIGN;
    a.ctx.status =
      (a.ctx.status & ~(FLAG_ZERO | FLAG_NEGATIVE)) |
      (value & sign ? FLAG_NEGATIVE : 0) |
      ((value & mask) === 0 ? FLAG_ZERO : 0);
    return value & mask;
  };
  const load = (value, width = 2) => {
    value = nz(value, width);
    a.ctx.a = width === 1 ? (a.ctx.a & HIGH_BYTE_MASK) | value : value;
    return value;
  };
  const index = (name, value) => {
    a.ctx[name] = nz(value);
    return value;
  };
  const dp = (offset, width = 2) =>
    width === 1 ? a.read(offset, 'leaf-DP-BYTE') : a.readWord(offset, BANK_WRAP, 'leaf-DP-WORD');
  const abs = (offset) => a.ctx.bank * BANK_SIZE + offset;
  const longRead = (address) => a.readWord(address & LONG_MASK, LONG_WRAP, 'leaf-long-WORD');
  const longWrite = (address, value, width = 2) => {
    address &= LONG_MASK;
    if (width === 1) a.write(address, value & BYTE_MASK, 'leaf-long-BYTE');
    else a.writeWord(address, value, LONG_WRAP, 'leaf-long-WORD');
  };
  // LSR A on a word: bit 0 goes to the carry; returns the halved value.
  const lsr = () => {
    a.ctx.status = (a.ctx.status & ~FLAG_CARRY) | (a.ctx.a & 1);
    return load(a.ctx.a >>> 1);
  };
  const asl = () => {
    a.ctx.status = (a.ctx.status & ~FLAG_CARRY) | Number(a.ctx.a >= WORD_SIGN);
    load((a.ctx.a * 2) & WORD_MASK);
  };
  const arithmetic = (right, subtract = false) => {
    if (a.ctx.status & FLAG_DECIMAL) taskStop('task_binary_arithmetic_required');
    const left = a.ctx.a,
      carry = a.ctx.status & FLAG_CARRY,
      sum = subtract ? left - right - 1 + carry : left + right + carry,
      result = sum & WORD_MASK;
    const overflow = subtract
      ? (left ^ right) & (left ^ result) & WORD_SIGN
      : ~(left ^ right) & (left ^ result) & WORD_SIGN;
    a.ctx.status =
      (a.ctx.status & ~(FLAG_CARRY | FLAG_OVERFLOW)) |
      (subtract ? Number(sum >= 0) : Number(sum > WORD_MASK)) |
      (overflow ? FLAG_OVERFLOW : 0);
    load(result);
  };
  // Word sum and difference as the ROM forms them (CLC, LDA, ADC and SEC, LDA, SBC):
  // the wrapped result is returned and stays in A with the resulting N, V, Z and C flags.
  const add = (left, right) => {
    a.ctx.status &= ~FLAG_CARRY;
    load(left);
    arithmetic(right);
    return a.ctx.a;
  };
  const subtract = (left, right) => {
    a.ctx.status |= FLAG_CARRY;
    load(left);
    arithmetic(right, true);
    return a.ctx.a;
  };
  const carried = () => (a.ctx.status & FLAG_CARRY) !== 0;
  // A script native returns its result word in place of the first argument.
  const result = (value, label = 'leaf-result-DP00') =>
    a.writeWord(FIRST_ARGUMENT, value, BANK_WRAP, label);
  return {
    a,
    ctx: a.ctx,
    nz,
    load,
    index,
    dp,
    abs,
    longRead,
    longWrite,
    lsr,
    asl,
    arithmetic,
    add,
    subtract,
    carried,
    result,
  };
}
export function leaf(a, run, outerReturn = true) {
  run(leafAccess(a));
  return finishLeaf(a, outerReturn);
}
// For lifted script natives (game state only): a script argument word from the direct
// page at 0, and the result word in place of the first argument.
export function leafArgument(a, offset) {
  if (a.ctx.d !== 0) taskStop('task_direct_page_zero_required');
  const { wram } = a.mem;
  return wram[offset] | (wram[offset + 1] << BYTE_BITS);
}
export function setLeafResult(a, value) {
  setLeafWord(a, FIRST_ARGUMENT, value);
}
// An argument word of the direct page at 0 replaced (as some natives leave one).
export function setLeafWord(a, offset, value) {
  const { wram } = a.mem;
  wram[offset] = value & BYTE_MASK;
  wram[offset + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
}
export function finishLeaf(a, outerReturn = true) {
  const rawReturnWord = a.readWord(
    (a.ctx.s + 1) & WORD_MASK,
    BANK_WRAP,
    'leaf-outer-RTS',
    outerReturn,
  );
  a.ctx.s = (a.ctx.s + 2) & WORD_MASK;
  a.ctx.pc = (rawReturnWord + 1) & WORD_MASK;
  return {
    rawReturnWord,
    returnTarget: CODE_BANK_BASE | a.ctx.pc,
    frontier: 'observed-outer-RTS-target',
    scope: 'manual-source-specific-native-leaf-return-target-not-executed',
    dynamicDispatchExecuted: false,
    returnTargetExecuted: false,
  };
}
