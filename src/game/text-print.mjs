import { readStateByte, writeStateByte } from '../state/objects.mjs';
// The text print of a window (lifted from 80:FE69 with its bit reader 81:AF04;
// register-level versions in proof/replay/native-text-compose.mjs and
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
// window by the live text-buffer renderer without a CPU call frame.
//
// The original reads each bit with a JSL to 81:AF04, which pushes A while it refills
// the buffer, and keeps the old data bank on the stack (PHB, PEA, PLB, PLB) while it
// prints. Live rendering addresses memory explicitly and needs neither operation.
//
// Registers (user decision 2026-11-17): game state only. FB39 sets its own registers
// before reading them, and no A, X, Y or flags are left; the data bank is restored.
import { drawTextBuffer, renderTextBuffer } from './text-draw.mjs';
import { portTextAddress } from '../data/port-extension.mjs';
import { languageText } from '../data/language.mjs';
import {
  TEXT_BIT_BUFFER,
  TEXT_BITS_REMAINING,
  TEXT_BUFFER,
  TEXT_SOURCE_BANK,
  TEXT_SOURCE_BANK_WORD,
  TEXT_SOURCE_POINTER,
} from '../data/wram.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';

const DP_WINDOW = 0x00,
  DP_TEXT = 0x02,
  // Bank 9D in the bank byte with FF below it; a negative number adds one (bank 9E).
  SOURCE_BANK_SEED = 0x9dff,
  CODE_TREE = 0x9d8000,
  CHARACTER_PAIR = 0x7f7f,
  TEXT_END = 0x0a,
  REFILL_BITS = 0x0f,
  BRANCH_BYTES = 2;

const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
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
      at = pointer | (readStateByte(wram, TEXT_SOURCE_BANK) << WORD_BITS);
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
    writeStateByte(wram, TEXT_SOURCE_BANK, port >>> WORD_BITS);
  }
}

// Decode the text into the text buffer; returns its length.
function decodeText(mem, wram) {
  let y = 0;
  for (;;) {
    let node = 0;
    do {
      const x = node,
        { bit } = readBit(mem, wram);
      const at = CODE_TREE + ((x + (bit ? BRANCH_BYTES : 0)) & WORD_MASK);
      node = mem.read8(at) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
    } while (!(node & WORD_SIGN));
    const pair = node & CHARACTER_PAIR,
      first = pair >>> BYTE_BITS,
      second = pair & BYTE_MASK;
    if (first === TEXT_END) return y;
    writeStateByte(wram, TEXT_BUFFER + y, first);
    y = (y + 1) & WORD_MASK;
    if (second === 0) continue;
    if (second === TEXT_END) return y;
    writeStateByte(wram, TEXT_BUFFER + y, second);
    y = (y + 1) & WORD_MASK;
  }
}

// Print the text in the direct page word 02 into the window in 00 (80:FE69) for lifted
// callers, without the JSR frame: the return word of the caller's JSR lies only in free
// stack bytes (game state only, user decision 2026-11-17). renderBuffer is a sequence,
// defaulting to the live renderer.
export function* printText(h, events, renderBuffer = drawTextBuffer) {
  const { mem } = h.a,
    { wram } = mem;
  yield () => {
    const id = word(wram, DP_TEXT);
    startTextSource(mem, wram, id);
    setWord(wram, TEXT_BITS_REMAINING, 0);
    let y = decodeText(mem, wram);
    const translated = languageText(mem, id);
    if (translated) {
      translated.forEach((code, i) => writeStateByte(wram, TEXT_BUFFER + i, code));
      y = translated.length;
    }
    writeStateByte(wram, TEXT_BUFFER + y, 0);
  };
  yield* renderTextBuffer(h, events, renderBuffer);
}
// The RTS form for register-level callers is printTextJsr in tools/register-forms/jsr-forms.mjs.

// Print a text into a window at its cursor.
export function* printTextIn(h, events, renderBuffer, window, text) {
  yield () => {
    const { wram } = h.a.mem;
    setWord(wram, DP_WINDOW, window);
    setWord(wram, DP_TEXT, text);
  };
  yield* printText(h, events, renderBuffer);
}
