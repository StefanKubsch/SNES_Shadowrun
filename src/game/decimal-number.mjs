import { readStateByte, writeStateByte } from '../state/objects.mjs';
// A 32-bit number as decimal text (lifted from 80:FDCF; register-level version in
// proof/replay/native-status-screen.mjs), used for Jake's money and karma lines of the
// status screen.
//
// The number DP 04:02 is divided by the powers of ten from 10^9 down to 10 (80:FE45,
// low and high words four bytes apart) by repeated subtraction; each quotient digit
// after the first non-zero one goes to the text buffer 7E:21A0, with a comma after the
// billions, millions and thousands. The remainder is the last digit; 0D and 0 end the
// text, which the text buffer routine (80:FB39) prints with the data bank 7E.
//
// Registers (user decision 2026-11-17): game state only; A, X, Y and the flags the
// original leaves are not kept (80:FB39 sets its own before reading them). Live
// rendering uses explicit memory access without changing the data bank.
import { drawTextBufferSequence, renderTextBuffer } from './text-draw.mjs';
import { dataBankWord } from '../system/data-bank.mjs';
import { TEXT_BUFFER } from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK } from '../constants/bits.mjs';

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
const DRAW_SITE = 0x80fe40;

const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};

// The digits into the text buffer; returns the offset after them.
function writeDigits(mem) {
  const { wram } = mem;
  setWord(wram, DP_DIGIT_OFFSET, 0);
  let offset = 0;
  for (let power = 0; power < POWERS_END;) {
    let quotient = 0;
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
    writeStateByte(wram, TEXT_BUFFER + offset, (quotient + CHARACTER_ZERO) & BYTE_MASK);
    offset++;
    if (COMMA_OFFSETS.includes(power))
      writeStateByte(wram, TEXT_BUFFER + offset++, CHARACTER_COMMA);
    setWord(wram, DP_DIGIT_OFFSET, offset);
  }
  return offset;
}

// 80:FDCF: the number DP 04:02 as decimal text (see above), for lifted callers without
// CPU call frames or a saved data-bank stack byte.
export function* decimalNumber(h, events, renderBuffer = drawTextBufferSequence) {
  const { mem } = h.a,
    { wram } = mem;
  yield () => {
    const offset = writeDigits(mem);
    writeStateByte(
      wram,
      TEXT_BUFFER + offset,
      (readStateByte(wram, DP_NUMBER_LOW) + CHARACTER_ZERO) & BYTE_MASK,
    );
    writeStateByte(wram, TEXT_BUFFER + offset + 1, LINE_END);
    writeStateByte(wram, TEXT_BUFFER + offset + 2, 0);
  };
  yield* renderTextBuffer(h, events, renderBuffer, DRAW_SITE);
}
// The RTS form for register-level callers is decimalNumberJsr in
// proof/caller/jsr-forms.mjs.
