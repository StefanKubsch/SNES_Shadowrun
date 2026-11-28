// Sum glyph widths with the original second-character high-byte index alias.
// The encoded content reader remains a phase 4 boundary.
import { textDecodingState } from '../state/text-decoding.mjs';
import { languageTextWidth } from '../data/language.mjs';
import { readBit, startTextSource } from './text-print.mjs';
import { BYTE_BITS, BYTE_MASK, HIGH_BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

const GLYPH_WIDTHS = 0x81ac0c,
  CODE_TREE = 0x9d8000,
  CHARACTER_PAIR = 0x7f7f,
  TEXT_END = 0x0a,
  BRANCH_BYTES = 2;

// The measurement; returns the last tree or table index (X in the original), from x.
export function measure(h, x) {
  const { mem } = h.a,
    { wram } = mem,
    state = textDecodingState(wram),
    id = state.widthTextArgument;
  startTextSource(mem, wram, id);
  state.width = 0;
  state.bitsRemaining = 0;
  let a = 0;
  // The width step (80:FB2A): X the character in A, its width added to the sum.
  const step = () => {
    x = a;
    a = (((a & HIGH_BYTE_MASK) | mem.read8(GLYPH_WIDTHS + x)) + state.width) & WORD_MASK;
    state.width = a;
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
    state.characterPair = pair;
    a = pair >>> BYTE_BITS;
    if (a === TEXT_END) break;
    step();
    a = (a & HIGH_BYTE_MASK) | (pair & BYTE_MASK);
    if ((a & BYTE_MASK) === 0) continue;
    if ((a & BYTE_MASK) === TEXT_END) break;
    step();
  }
  const translated = languageTextWidth(mem, id);
  if (translated !== null) state.width = translated;
  return x;
}
