// The text print of a window (lifted from 80:FE69 with its bit reader 81:AF04;
// register-level versions in src/task/native-text-compose.mjs and
// native-text-prerequisites.mjs, which the other callers still use).
//
// A text number (the direct page word 02) is a bit position in the Huffman coded text
// banks: numbers below 8000 in bank 9D, the others in bank 9E, at the number with its
// top bit set. A port text (src/data/port-extension.mjs) points into its own bank. The
// source pointer lies in the direct page words CF to D1, the bit buffer in 7E:0208 and
// its bits left in 7E:0206. Each bit walks the code tree 9D:8000 (a set bit takes the
// second branch); a node with its top bit set holds up to two characters, 0A ends the
// text. The characters go into the text buffer 7E:21A0 with a 0 at the end; a text of
// the language (src/data/language.mjs) replaces them. The buffer is then drawn into the
// window by 80:FB39, still register-level, through its frame from the routine table
// with the data bank 7E.
//
// The original reads each bit with a JSL to 81:AF04, which pushes A while it refills
// the buffer; the bytes of the last frame and push stay below the stack, as the data
// bank and the bank pair the routine pushes (PHB, PEA, PLB, PLB). The routine leaves A,
// X, Y, the carry and the overflow of 80:FB39 and the sign and zero of the restored bank
// byte; it passes FB39 X and Y the text's length and A the last code tree node with its
// bytes swapped, as the original. FB39 reads no flags, so they are not produced there.
import { nativeCallSequence } from '../task/native-call-continuation.mjs';
import { portTextAddress } from '../data/port-extension.mjs';
import { languageText } from '../data/language.mjs';
import {
  TEXT_BIT_BUFFER,
  TEXT_BITS_REMAINING,
  TEXT_BUFFER,
  TEXT_SOURCE_BANK,
  TEXT_SOURCE_BANK_WORD,
  TEXT_SOURCE_POINTER,
} from '../task/wram.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  BYTE_SIGN,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';

const DP_TEXT = 0x02,
  // Bank 9D in the bank byte with FF below it; a negative number adds one (bank 9E).
  SOURCE_BANK_SEED = 0x9dff,
  CODE_TREE = 0x9d8000,
  CHARACTER_PAIR = 0x7f7f,
  TEXT_END = 0x0a,
  REFILL_BITS = 0x0f,
  BRANCH_BYTES = 2,
  WRAM_BANK_PAIR = 0x7e7e,
  WRAM_BANK = 0x7e,
  BANK_PAIR_BYTES = 2;
// The JSL frame of the bit reader (bank 80, the return word of 80:FE8D) and the call of
// the text buffer.
const BIT_CALL_BANK = 0x80,
  BIT_CALL_RETURN = 0xfe90,
  JSL_FRAME_BYTES = 3,
  PUSH_BYTES = 2,
  DRAW_CALL = [0x80febc, 0x80fb39];

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const flag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};

// The bit reader (81:AF04) as a function: the next bit of the text source, refilling
// the bit buffer with the next source word (high byte first). Returns the bit and, on a
// refill, true in refilled.
export function readBit(mem, wram) {
  const remaining = (word(wram, TEXT_BITS_REMAINING) - 1) & WORD_MASK;
  setWord(wram, TEXT_BITS_REMAINING, remaining);
  const refilled = (remaining & WORD_SIGN) !== 0;
  if (refilled) {
    setWord(wram, TEXT_BITS_REMAINING, REFILL_BITS);
    const pointer = word(wram, TEXT_SOURCE_POINTER),
      at = pointer | (wram[TEXT_SOURCE_BANK] << WORD_BITS);
    setWord(wram, TEXT_BIT_BUFFER, (mem.read8(at) << BYTE_BITS) | mem.read8((at + 1) & LONG_MASK));
    setWord(wram, TEXT_SOURCE_POINTER, pointer + BRANCH_BYTES);
  }
  const buffer = word(wram, TEXT_BIT_BUFFER);
  setWord(wram, TEXT_BIT_BUFFER, buffer << 1);
  return { bit: buffer >>> (WORD_BITS - 1), refilled };
}

// Point the text source at the text number id (bank 9D, 9E or a port text).
export function startTextSource(mem, wram, id) {
  setWord(wram, TEXT_SOURCE_BANK_WORD, SOURCE_BANK_SEED + (id & WORD_SIGN ? 1 : 0));
  setWord(wram, TEXT_SOURCE_POINTER, id | WORD_SIGN);
  const port = portTextAddress(mem, id);
  if (port !== null) {
    setWord(wram, TEXT_SOURCE_POINTER, port);
    wram[TEXT_SOURCE_BANK] = port >>> WORD_BITS;
  }
}

// Decode the text into the text buffer; returns its length and the last node with its
// bytes swapped, and the A of the last refill (or null).
function decodeText(mem, wram) {
  let y = 0,
    pushed = null;
  for (;;) {
    let node = 0;
    do {
      const x = node,
        { bit, refilled } = readBit(mem, wram);
      if (refilled) pushed = x;
      const at = CODE_TREE + ((x + (bit ? BRANCH_BYTES : 0)) & WORD_MASK);
      node = mem.read8(at) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
    } while (!(node & WORD_SIGN));
    const pair = node & CHARACTER_PAIR,
      first = pair >>> BYTE_BITS,
      second = pair & BYTE_MASK;
    const swapped = ((pair & BYTE_MASK) << BYTE_BITS) | first;
    if (first === TEXT_END) return { y, a: swapped, pushed };
    wram[TEXT_BUFFER + y] = first;
    y = (y + 1) & WORD_MASK;
    if (second === 0) continue;
    if (second === TEXT_END) return { y, a: pair, pushed };
    wram[TEXT_BUFFER + y] = second;
    y = (y + 1) & WORD_MASK;
  }
}

// Print the text in the direct page word 02 into the window in 00 (80:FE69), a sequence
// for a native call continuation: routines the table with 80:FB39.
export function* printTextSequence(h, events, routines) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem;
  yield () => {
    h.pushByte(ctx.bank);
    const id = word(wram, DP_TEXT);
    startTextSource(mem, wram, id);
    h.a.pushWord(WRAM_BANK_PAIR);
    ctx.s = (ctx.s + BANK_PAIR_BYTES) & WORD_MASK;
    ctx.bank = WRAM_BANK;
    setWord(wram, TEXT_BITS_REMAINING, 0);
    let { y, a, pushed } = decodeText(mem, wram);
    const translated = languageText(mem, id);
    if (translated) {
      translated.forEach((code, i) => (wram[TEXT_BUFFER + i] = code));
      y = translated.length;
    }
    wram[TEXT_BUFFER + y] = 0;
    // The last bit reader's frame and refill push below the stack.
    h.pushByte(BIT_CALL_BANK);
    h.a.pushWord(BIT_CALL_RETURN);
    if (pushed !== null) {
      h.a.pushWord(pushed);
      ctx.s = (ctx.s + PUSH_BYTES) & WORD_MASK;
    }
    ctx.s = (ctx.s + JSL_FRAME_BYTES) & WORD_MASK;
    ctx.a = a;
    ctx.x = y;
    ctx.y = y;
  };
  yield* nativeCallSequence(h, events, routines, ...DRAW_CALL);
  let result;
  yield () => {
    ctx.s = (ctx.s + 1) & WORD_MASK;
    ctx.bank = h.a.read(ctx.s);
    flag(ctx, FLAG_NEGATIVE, ctx.bank & BYTE_SIGN);
    flag(ctx, FLAG_ZERO, ctx.bank === 0);
    result = h.rts();
  };
  return result;
}
