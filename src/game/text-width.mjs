import { readStateByte, writeStateByte } from '../state/objects.mjs';
// The pixel width of a text (lifted from 80:FADD with its glyph width step 80:FB2A;
// register-level version in proof/replay/native-glove-target-support.mjs, which the glove
// natives still use).
//
// The text number in the direct page word 00 is decoded as by the text print
// (text-print.mjs: the bit reader 81:AF04 and the code tree 9D:8000), and the widths of
// its characters (81:AC0C) are summed in the direct page word BA; a text of the language
// gives the width of its translation (src/data/language.mjs). The width is left in A.
//
// As in the original, the second character of a node is looked up with the high byte of
// the running sum in its table index (the step loads the character into A's low byte
// only): for sums of 256 and more it reads a later table entry. The bytes of the inner
// calls (the bit reader's JSL frame and refill push, the width steps' JSR frames) lie
// only in free stack bytes and are not reproduced (game state only, user decision
// 2026-11-17).
//
// Registers (user decision 2026-11-17): measureTextWidth leaves no registers; its
// callers read the width from the direct page word BA. The register form for
// register-level callers is in tools/register-forms/text-width.mjs.
import { languageTextWidth } from '../data/language.mjs';
import { readBit, startTextSource } from './text-print.mjs';
import { TEXT_BITS_REMAINING, TEXT_CHARACTER_INDEX, TEXT_WORK_WORD } from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, HIGH_BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

const DP_TEXT = 0x00,
  DP_WIDTH = TEXT_WORK_WORD,
  GLYPH_WIDTHS = 0x81ac0c,
  CODE_TREE = 0x9d8000,
  CHARACTER_PAIR = 0x7f7f,
  TEXT_END = 0x0a,
  BRANCH_BYTES = 2;

const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};

// Measure the text in the direct page word 00 into the direct page word BA (80:FADD),
// called with JSR: h the caller's access (direct page 0). Returns with its RTS.
export function measureTextWidth(h) {
  measure(h, 0);
  return h.rts();
}
// The measurement; returns the last tree or table index (X in the original), from x.
export function measure(h, x) {
  const { mem } = h.a,
    { wram } = mem,
    id = word(wram, DP_TEXT);
  startTextSource(mem, wram, id);
  setWord(wram, DP_WIDTH, 0);
  setWord(wram, TEXT_BITS_REMAINING, 0);
  let a = 0;
  // The width step (80:FB2A): X the character in A, its width added to the sum.
  const step = () => {
    x = a;
    a = (((a & HIGH_BYTE_MASK) | mem.read8(GLYPH_WIDTHS + x)) + word(wram, DP_WIDTH)) & WORD_MASK;
    setWord(wram, DP_WIDTH, a);
  };
  for (;;) {
    a = 0;
    do {
      x = a;
      const { bit } = readBit(mem, wram);
      if (bit) x = (x + BRANCH_BYTES) & WORD_MASK;
      a = mem.read8(CODE_TREE + x) | (mem.read8(CODE_TREE + x + 1) << BYTE_BITS);
    } while (!(a & WORD_SIGN));
    const pair = a & CHARACTER_PAIR;
    setWord(wram, TEXT_CHARACTER_INDEX, pair);
    a = pair >>> BYTE_BITS;
    if (a === TEXT_END) break;
    step();
    a = (a & HIGH_BYTE_MASK) | (pair & BYTE_MASK);
    if ((a & BYTE_MASK) === 0) continue;
    if ((a & BYTE_MASK) === TEXT_END) break;
    step();
  }
  const translated = languageTextWidth(mem, id);
  if (translated !== null) setWord(wram, DP_WIDTH, translated);
  return x;
}
