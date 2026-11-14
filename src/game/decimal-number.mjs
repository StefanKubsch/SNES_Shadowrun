// A 32-bit number as decimal text (lifted from 80:FDCF; register-level version in
// src/task/native-status-screen.mjs), used for Jake's money and karma lines of the
// status screen.
//
// The number DP 04:02 is divided by the powers of ten from 10^9 down to 10 (80:FE45,
// low and high words four bytes apart) by repeated subtraction; each quotient digit
// after the first non-zero one goes to the text buffer 7E:21A0, with a comma after the
// billions, millions and thousands. The remainder is the last digit; 0D and 0 end the
// text, which the text buffer routine (80:FB39) prints with the data bank 7E.
import { nativeCallSequence } from '../task/native-call-continuation.mjs';
import { dataBankWord } from '../system/data-bank.mjs';
import { TEXT_BUFFER } from '../task/wram.mjs';
import { BYTE_BITS, BYTE_MASK, BYTE_SIGN, HIGH_BYTE_MASK } from '../constants/bits.mjs';
import { WRAM_BANK_PAIR } from '../constants/memory-map.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_OVERFLOW, FLAG_ZERO } from '../constants/cpu-flags.mjs';

// The powers' table, its stride and end; the power offsets followed by a comma; the
// characters of the digit 0, the comma and the line end.
const POWERS_LOW = 0xfe45,
  POWERS_HIGH = 0xfe47,
  POWER_BYTES = 4,
  POWERS_END = 0x21,
  COMMA_OFFSETS = Object.freeze([4, 0x10, 0x1c]),
  CHARACTER_ZERO = 0x30,
  CHARACTER_COMMA = 0x2c,
  LINE_END = 0x0d;
// The number, the low word of the last subtraction and the text offset.
const DP_NUMBER_LOW = 2,
  DP_NUMBER_HIGH = 4,
  DP_REMAINDER_LOW = 0xa2,
  DP_DIGIT_OFFSET = 0xa5;
const DRAW_TEXT = [0x80fe40, 0x80fb39];

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const setFlag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};

// The digits into the text buffer; returns the offset after them and the last
// quotient (which leaves A's high byte) and the power offset past the last.
function writeDigits(mem) {
  const { wram } = mem;
  setWord(wram, DP_DIGIT_OFFSET, 0);
  let offset = 0,
    quotient = 0,
    power = 0;
  while (power < POWERS_END) {
    quotient = 0;
    for (;;) {
      const low = word(wram, DP_NUMBER_LOW) - dataBankWord(mem, POWERS_LOW, power),
        high =
          word(wram, DP_NUMBER_HIGH) - dataBankWord(mem, POWERS_HIGH, power) - (low < 0 ? 1 : 0);
      setWord(wram, DP_REMAINDER_LOW, low);
      if (high < 0) break;
      setWord(wram, DP_NUMBER_HIGH, high);
      setWord(wram, DP_NUMBER_LOW, low);
      quotient++;
    }
    power += POWER_BYTES;
    if (!offset && !quotient) continue;
    wram[TEXT_BUFFER + offset] = (quotient + CHARACTER_ZERO) & BYTE_MASK;
    offset++;
    if (COMMA_OFFSETS.includes(power)) wram[TEXT_BUFFER + offset++] = CHARACTER_COMMA;
    setWord(wram, DP_DIGIT_OFFSET, offset);
  }
  return { offset, quotient, power };
}

// 80:FDCF: the number DP 04:02 as decimal text (see above). A sequence that ends with
// its RTS.
export function* decimalNumberSequence(h, events, routines) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem;
  yield () => {
    const { offset, quotient, power } = writeDigits(mem),
      last = wram[DP_NUMBER_LOW],
      digit = last + CHARACTER_ZERO;
    wram[TEXT_BUFFER + offset] = digit & BYTE_MASK;
    wram[TEXT_BUFFER + offset + 1] = LINE_END;
    wram[TEXT_BUFFER + offset + 2] = 0;
    ctx.x = offset;
    ctx.y = power;
    // The data bank 7E for the text routine; the old bank waits on the stack.
    h.phb();
    h.push(WRAM_BANK_PAIR, 2);
    h.plb();
    h.plb();
    // The last digit's 8-bit addition leaves the carry and overflow; the line end's
    // load the sign and zero.
    // A's high byte is the last quotient's (always 0, a digit).
    ctx.a = (quotient & HIGH_BYTE_MASK) | LINE_END;
    setFlag(ctx, FLAG_CARRY, digit > BYTE_MASK);
    setFlag(ctx, FLAG_OVERFLOW, (~(last ^ CHARACTER_ZERO) & (last ^ digit) & BYTE_SIGN) !== 0);
    setFlag(ctx, FLAG_NEGATIVE, false);
    setFlag(ctx, FLAG_ZERO, false);
  };
  yield* nativeCallSequence(h, events, routines, ...DRAW_TEXT, false, false);
  let result;
  yield () => {
    h.plb();
    result = h.rts();
  };
  return result;
}
