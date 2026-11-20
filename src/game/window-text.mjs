import { readStateByte, writeStateByte } from '../state/objects.mjs';
// The text cursor and the number print of a window (lifted from 80:FAAC and 80:FD80;
// register-level references remain in proof/replay/native-list-prerequisites.mjs).
//
// A window's text cursor is a tile number: the window's first text tile plus the
// column in the direct page word 02 plus the row in the low byte of 04 times the
// window's columns less two (the border). Its pixel offset starts at 0. The window is
// the one in the direct page word 00.
//
// A number (the direct page word 02) is printed by its decimal digits: they are written
// from the right into the text buffer 7E:21A0 (ending at 21A5, which is cleared), moved
// to its start, and the buffer is drawn into the window at the cursor by 80:FB39, which
// runs through its call frame with the
// data bank 7E, as the original sets it.
//
// The products and quotients run on the hardware multiplier and divider through the
// port, as in the original (Book I 2-15-1; on another platform: row * (columns - 2),
// value / 10 and value % 10). Both routines push the data bank and the bank pair they
// select (PHB, PEA, PLB, PLB) and restore the data bank; those bytes lie only in free
// stack bytes, and the old data bank is kept in a local (game state only, user decision
// 2026-11-17). The cursor's bank 80 is read by none of its accesses.
//
// Registers (user decision 2026-11-17): game state only. A, X, Y and the flags the
// original leaves are not kept; every caller sets its own before reading them.
import { drawTextBufferSequence } from './text-draw.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { dialogCallBody } from '../system/native-call-continuation.mjs';
import {
  DP_CURSOR_ROW,
  TEXT_BUFFER,
  WINDOW_COLUMNS,
  WINDOW_CURSOR_PIXEL,
  WINDOW_CURSOR_TILE,
  WINDOW_TILE_START,
} from '../data/wram.mjs';
import {
  RDDIVL,
  RDMPYL,
  WRDIVB,
  WRDIVL,
  WRMPYA,
  WRMPYB,
} from '../constants/hardware-registers.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK } from '../constants/bits.mjs';

const DP_WINDOW = 0x00,
  DP_VALUE = 0x02,
  BORDER_COLUMNS = 2,
  DIGITS = 5,
  RADIX = 10,
  CHARACTER_ZERO = 0x30,
  WRAM_BANK = 0x7e;
// Original instructions of the multiplier and divider accesses, the sites of the device
// model, and the call of the text buffer.
const ROW_SITE = 0x80fab8,
  COLUMNS_SITE = 0x80fac1,
  PRODUCT_SITE = 0x80facd,
  DIVIDEND_SITE = 0x80fd8c,
  DIVISOR_SITE = 0x80fd93,
  REMAINDER_SITE = 0x80fd9e,
  QUOTIENT_SITE = 0x80fda7,
  DRAW_CALL = [0x80fdca, 0x80fb39];

const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};

// Set the text cursor of the window in the direct page word 00 (80:FAAC) for lifted
// callers, without the JSR frame (the caller's return word lies only in free stack
// bytes).
export function setTextCursor(h) {
  const { wram, port } = sceneRuntime(h);
  const x = word(wram, DP_WINDOW);
  port.write(WRMPYA, readStateByte(wram, DP_CURSOR_ROW), 1, ROW_SITE);
  port.write(
    WRMPYB,
    (readStateByte(wram, WINDOW_COLUMNS + x) - BORDER_COLUMNS) & BYTE_MASK,
    1,
    COLUMNS_SITE,
  );
  const start = word(wram, WINDOW_TILE_START + x) + word(wram, DP_VALUE),
    left = start & WORD_MASK,
    product = port.read(RDMPYL, 2, PRODUCT_SITE),
    tile = (left + product + (start > WORD_MASK ? 1 : 0)) & WORD_MASK;
  setWord(wram, WINDOW_CURSOR_TILE + x, tile);
  setWord(wram, WINDOW_CURSOR_PIXEL + x, 0);
}
// The RTS form for register-level callers is setTextCursorJsr in
// proof/caller/jsr-forms.mjs.

// Print the number in the direct page word 02 into the window at its cursor (80:FD80)
// for lifted callers, without the JSR frame (the caller's return word lies only in free
// stack bytes); renderBuffer is the renderer sequence.
export function* printNumber(h, events, renderBuffer = drawTextBufferSequence) {
  const { ctx } = h,
    { wram, port } = sceneRuntime(h);
  let bank;
  yield () => {
    setWord(wram, TEXT_BUFFER + DIGITS, 0);
    let x = DIGITS,
      value = word(wram, DP_VALUE);
    do {
      port.write(WRDIVL, value, 2, DIVIDEND_SITE);
      port.write(WRDIVB, RADIX, 1, DIVISOR_SITE);
      x = (x - 1) & WORD_MASK;
      writeStateByte(
        wram,
        TEXT_BUFFER + x,
        (CHARACTER_ZERO + port.read(RDMPYL, 1, REMAINDER_SITE)) & BYTE_MASK,
      );
      value = port.read(RDDIVL, 2, QUOTIENT_SITE);
    } while (value !== 0);
    bank = ctx.bank;
    ctx.bank = WRAM_BANK;
    // The digits move to the buffer's start, up to the cleared end byte.
    if (x !== 0) {
      let y = 0;
      for (;;) {
        const byte = readStateByte(wram, TEXT_BUFFER + x);
        writeStateByte(wram, TEXT_BUFFER + y, byte);
        if (byte === 0) break;
        x = (x + 1) & WORD_MASK;
        y = (y + 1) & WORD_MASK;
      }
    }
  };
  yield* dialogCallBody(h, ...DRAW_CALL, () => renderBuffer(h, events));
  yield () => {
    ctx.bank = bank;
  };
}
// The RTS form for register-level callers is printNumberJsr in proof/caller/jsr-forms.mjs.
