// The pixel width of a text (lifted from 80:FADD with its glyph width step 80:FB2A;
// register-level version in src/task/native-glove-target-support.mjs, which the glove
// natives still use).
//
// The text number in the direct page word 00 is decoded as by the text print
// (text-print.mjs: the bit reader 81:AF04 and the code tree 9D:8000), and the widths of
// its characters (81:AC0C) are summed in the direct page word BA; a text of the language
// gives the width of its translation (src/data/language.mjs). The width is left in A.
//
// As in the original, the second character of a node is looked up with the high byte of
// the running sum in its table index (the step loads the character into A's low byte
// only): for sums of 256 and more it reads a later table entry. The original's
// registers are left: A the width with its sign and zero, X the last tree index or table
// index and Y unchanged; the object search replaces the carry and the overflow. The bytes of the last calls (the bit reader's JSL frame and refill push, a
// later width step's JSR frame) stay below the stack, as the original leaves them.
import { languageTextWidth } from '../data/language.mjs';
import { readBit, startTextSource } from './text-print.mjs';
import { TEXT_BITS_REMAINING, TEXT_CHARACTER_INDEX, TEXT_WORK_WORD } from '../task/wram.mjs';
import { BYTE_BITS, BYTE_MASK, HIGH_BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';

const DP_TEXT = 0x00,
  DP_WIDTH = TEXT_WORK_WORD,
  GLYPH_WIDTHS = 0x81ac0c,
  CODE_TREE = 0x9d8000,
  CHARACTER_PAIR = 0x7f7f,
  TEXT_END = 0x0a,
  BRANCH_BYTES = 2;
// The return words of the bit reader's JSL (bank 80) and of the two width steps' JSRs.
const BIT_CALL_BANK = 0x80,
  BIT_CALL_RETURN = 0xfafb,
  FIRST_STEP_RETURN = 0xfb17,
  SECOND_STEP_RETURN = 0xfb22,
  JSL_FRAME_BYTES = 3,
  PUSH_BYTES = 2;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const flag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};

// Measure the text in the direct page word 00 (80:FADD), called with JSR: h the caller's
// access (direct page 0).
export function measureTextWidthRoutine(h) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem,
    id = word(wram, DP_TEXT);
  startTextSource(mem, wram, id);
  setWord(wram, DP_WIDTH, 0);
  setWord(wram, TEXT_BITS_REMAINING, 0);
  let a = 0,
    x = ctx.x,
    pushed = null;
  // The return word of a width step after the last bit reader's call, or null.
  const last = { step: null };
  // The width step (80:FB2A): X the character in A, its width added to the sum.
  const step = (returnWord) => {
    x = a;
    a = (((a & HIGH_BYTE_MASK) | mem.read8(GLYPH_WIDTHS + x)) + word(wram, DP_WIDTH)) & WORD_MASK;
    setWord(wram, DP_WIDTH, a);
    last.step = returnWord;
  };
  for (;;) {
    a = 0;
    do {
      x = a;
      const { bit, refilled } = readBit(mem, wram);
      if (refilled) pushed = a;
      last.step = null;
      if (bit) x = (x + BRANCH_BYTES) & WORD_MASK;
      a = mem.read8(CODE_TREE + x) | (mem.read8(CODE_TREE + x + 1) << BYTE_BITS);
    } while (!(a & WORD_SIGN));
    const pair = a & CHARACTER_PAIR;
    setWord(wram, TEXT_CHARACTER_INDEX, pair);
    a = pair >>> BYTE_BITS;
    if (a === TEXT_END) break;
    step(FIRST_STEP_RETURN);
    a = (a & HIGH_BYTE_MASK) | (pair & BYTE_MASK);
    if ((a & BYTE_MASK) === 0) continue;
    if ((a & BYTE_MASK) === TEXT_END) break;
    step(SECOND_STEP_RETURN);
  }
  // The last calls' bytes below the stack: the bit reader's frame and refill push, then
  // a width step's return word over the frame's top.
  h.pushByte(BIT_CALL_BANK);
  h.a.pushWord(BIT_CALL_RETURN);
  if (pushed !== null) {
    h.a.pushWord(pushed);
    ctx.s = (ctx.s + PUSH_BYTES) & WORD_MASK;
  }
  ctx.s = (ctx.s + JSL_FRAME_BYTES) & WORD_MASK;
  if (last.step !== null) {
    h.a.pushWord(last.step);
    ctx.s = (ctx.s + PUSH_BYTES) & WORD_MASK;
  }
  const translated = languageTextWidth(mem, id);
  if (translated !== null) setWord(wram, DP_WIDTH, translated);
  ctx.a = word(wram, DP_WIDTH);
  ctx.x = x;
  flag(ctx, FLAG_NEGATIVE, ctx.a & WORD_SIGN);
  flag(ctx, FLAG_ZERO, ctx.a === 0);
  return h.rts();
}
