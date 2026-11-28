// Decode a text into the shared named buffer and render it at the window cursor.
// Encoded content and its source-bank selection remain the phase 4 data boundary.
import { textDecodingState } from '../state/text-decoding.mjs';
import { windowManagerState } from '../state/windows.mjs';
import { drawTextBuffer, renderTextBuffer } from './text-draw.mjs';
import { portTextAddress } from '../data/port-extension.mjs';
import { languageText } from '../data/language.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';

// Bank 9D in the bank byte with FF below it; a negative number adds one (bank 9E).
const SOURCE_BANK_SEED = 0x9dff,
  CODE_TREE = 0x9d8000,
  CHARACTER_PAIR = 0x7f7f,
  TEXT_END = 0x0a,
  REFILL_BITS = 0x0f,
  BRANCH_BYTES = 2;

// The bit reader (81:AF04) as a function: the next bit of the text source, refilling
// the bit buffer with the next source word (high byte first). Returns the bit and, on a
// refill, true in refilled.
export function readBit(mem, wram) {
  const state = textDecodingState(wram);
  const remaining = (state.bitsRemaining - 1) & WORD_MASK;
  state.bitsRemaining = remaining;
  const refilled = (remaining & WORD_SIGN) !== 0;
  if (refilled) {
    state.bitsRemaining = REFILL_BITS;
    const pointer = state.sourcePointer,
      at = pointer | (state.sourceBank << WORD_BITS);
    state.bitBuffer = (mem.read8(at) << BYTE_BITS) | mem.read8((at + 1) & LONG_MASK);
    state.sourcePointer = pointer + BRANCH_BYTES;
  }
  const buffer = state.bitBuffer;
  state.bitBuffer = buffer << 1;
  return { bit: buffer >>> (WORD_BITS - 1), refilled };
}

// Point the text source at the text number id (bank 9D, 9E or a port text).
export function startTextSource(mem, wram, id) {
  const state = textDecodingState(wram);
  state.sourceBankWord = SOURCE_BANK_SEED + (id & WORD_SIGN ? 1 : 0);
  state.sourcePointer = id | WORD_SIGN;
  const port = portTextAddress(mem, id);
  if (port !== null) {
    state.sourcePointer = port;
    state.sourceBank = port >>> WORD_BITS;
  }
}

// Decode the text into the text buffer; returns its length.
function decodeText(mem, wram) {
  const state = textDecodingState(wram);
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
    state.buffer.writeTextByte(y, first);
    y = (y + 1) & WORD_MASK;
    if (second === 0) continue;
    if (second === TEXT_END) return y;
    state.buffer.writeTextByte(y, second);
    y = (y + 1) & WORD_MASK;
  }
}

// Decode and translate before the renderer starts; caller arguments retain their bridge.
export function* printText(h, events, renderBuffer = drawTextBuffer) {
  const { mem } = h.a,
    { wram } = mem;
  yield () => {
    const state = textDecodingState(wram),
      id = state.textArgument;
    startTextSource(mem, wram, id);
    state.bitsRemaining = 0;
    let y = decodeText(mem, wram);
    const translated = languageText(mem, id);
    if (translated) {
      translated.forEach((code, i) => state.buffer.writeTextByte(i, code));
      y = translated.length;
    }
    state.buffer.writeTextByte(y, 0);
  };
  yield* renderTextBuffer(h, events, renderBuffer);
}

// Print a text into a window at its cursor.
export function* printTextIn(h, events, renderBuffer, window, text) {
  yield () => {
    const state = windowManagerState(h.a.mem);
    state.windowArgument = window;
    state.valueArgument = text;
  };
  yield* printText(h, events, renderBuffer);
}
