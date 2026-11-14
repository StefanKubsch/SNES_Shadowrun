// The carry and overflow of 16-bit arithmetic as the original leaves them, for the lifted
// routines that hand A, X, Y and the flags on to their callers or callees.
import { WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_OVERFLOW, FLAG_ZERO } from '../constants/cpu-flags.mjs';

const flag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};

// The carry and overflow of the last addition, subtraction, shift or comparison,
// starting with those of the status register ctx.
export class CarryArithmetic {
  constructor(ctx) {
    this.carry = (ctx.status & FLAG_CARRY) !== 0;
    this.overflow = (ctx.status & FLAG_OVERFLOW) !== 0;
  }
  // SEC; SBC
  sub(left, right) {
    const value = (left - right) & WORD_MASK;
    this.carry = left >= right;
    this.overflow = ((left ^ right) & (left ^ value) & WORD_SIGN) !== 0;
    return value;
  }
  // ADC with the carry given
  add(left, right, carry = false) {
    const sum = left + right + (carry ? 1 : 0),
      value = sum & WORD_MASK;
    this.carry = sum > WORD_MASK;
    this.overflow = (~(left ^ right) & (left ^ value) & WORD_SIGN) !== 0;
    return value;
  }
  // CMP
  compare(left, right) {
    this.carry = left >= right;
  }
  // LSR, count times
  shiftRight(value, count) {
    this.carry = ((value >>> (count - 1)) & 1) !== 0;
    return value >>> count;
  }
  // ASL
  shiftLeft(value) {
    this.carry = (value & WORD_SIGN) !== 0;
    return (value << 1) & WORD_MASK;
  }
  // Leave them in the status register with sign and zero of value.
  apply(ctx, value) {
    flag(ctx, FLAG_CARRY, this.carry);
    flag(ctx, FLAG_OVERFLOW, this.overflow);
    flag(ctx, FLAG_NEGATIVE, value & WORD_SIGN);
    flag(ctx, FLAG_ZERO, value === 0);
  }
}
