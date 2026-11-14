// The text cursor and the number print of a window (lifted from 80:FAAC and 80:FD80;
// register-level versions in src/task/native-list-prerequisites.mjs, which the menus
// and lists still use).
//
// A window's text cursor is a tile number: the window's first text tile plus the
// column in the direct page word 02 plus the row in the low byte of 04 times the
// window's columns less two (the border). Its pixel offset starts at 0. The window is
// the one in the direct page word 00.
//
// A number (the direct page word 02) is printed by its decimal digits: they are written
// from the right into the text buffer 7E:21A0 (ending at 21A5, which is cleared), moved
// to its start, and the buffer is drawn into the window at the cursor by 80:FB39, which
// is still register-level and runs through its frame from the routine table with the
// data bank 7E, as the original sets it.
//
// The products and quotients run on the hardware multiplier and divider through the
// port, as in the original (Book I 2-15-1; on another platform: row * (columns - 2),
// value / 10 and value % 10). Both routines push the data bank and the bank pair they
// select (PHB, PEA, PLB, PLB) and leave the bytes below the stack as the original. They
// leave X, Y and the flags as the original: the cursor A 0, X the window, Y unchanged,
// the sign and zero of the bank byte and the carry and overflow of the product's
// addition; the number the registers of 80:FB39 and the sign and zero of the bank byte.
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { nativeCallSequence } from '../task/native-call-continuation.mjs';
import {
  DP_CURSOR_ROW,
  TEXT_BUFFER,
  WINDOW_COLUMNS,
  WINDOW_CURSOR_PIXEL,
  WINDOW_CURSOR_TILE,
  WINDOW_TILE_START,
} from '../task/wram.mjs';
import {
  RDDIVL,
  RDMPYL,
  WRDIVB,
  WRDIVL,
  WRMPYA,
  WRMPYB,
} from '../constants/hardware-registers.mjs';
import { BYTE_BITS, BYTE_MASK, BYTE_SIGN, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_OVERFLOW, FLAG_ZERO } from '../constants/cpu-flags.mjs';

const DP_WINDOW = 0x00,
  DP_VALUE = 0x02,
  BORDER_COLUMNS = 2,
  DIGITS = 5,
  RADIX = 10,
  CHARACTER_ZERO = 0x30,
  PROGRAM_BANK_PAIR = 0x8080,
  WRAM_BANK_PAIR = 0x7e7e,
  WRAM_BANK = 0x7e,
  // PEA and the two PLB.
  BANK_PAIR_BYTES = 2;
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

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const flag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};
// PHB, PEA pair, PLB, PLB: the old data bank and the pair stay below the stack; the
// bank's own pull (PLB at the end) is restoreBank.
function selectBank(h, pair) {
  h.pushByte(h.ctx.bank);
  h.a.pushWord(pair);
  h.ctx.s = (h.ctx.s + BANK_PAIR_BYTES) & WORD_MASK;
}
function restoreBank(h) {
  const { ctx } = h;
  ctx.s = (ctx.s + 1) & WORD_MASK;
  ctx.bank = h.a.read(ctx.s);
  flag(ctx, FLAG_NEGATIVE, ctx.bank & BYTE_SIGN);
  flag(ctx, FLAG_ZERO, ctx.bank === 0);
}

// Set the text cursor of the window in the direct page word 00 (80:FAAC), called with JSR.
export function setTextCursorRoutine(h) {
  const { ctx } = h,
    { wram, port } = sceneRuntime(h);
  selectBank(h, PROGRAM_BANK_PAIR);
  const x = word(wram, DP_WINDOW);
  port.write(WRMPYA, wram[DP_CURSOR_ROW], 1, ROW_SITE);
  port.write(WRMPYB, (wram[WINDOW_COLUMNS + x] - BORDER_COLUMNS) & BYTE_MASK, 1, COLUMNS_SITE);
  const start = word(wram, WINDOW_TILE_START + x) + word(wram, DP_VALUE),
    left = start & WORD_MASK,
    product = port.read(RDMPYL, 2, PRODUCT_SITE),
    sum = left + product + (start > WORD_MASK ? 1 : 0),
    tile = sum & WORD_MASK;
  flag(ctx, FLAG_CARRY, sum > WORD_MASK);
  flag(ctx, FLAG_OVERFLOW, ~(left ^ product) & (left ^ tile) & WORD_SIGN);
  setWord(wram, WINDOW_CURSOR_TILE + x, tile);
  setWord(wram, WINDOW_CURSOR_PIXEL + x, 0);
  ctx.a = 0;
  ctx.x = x;
  restoreBank(h);
  return h.rts();
}

// Print the number in the direct page word 02 into the window at its cursor (80:FD80),
// a sequence for a native call continuation: routines the table with 80:FB39.
export function* printNumberSequence(h, events, routines) {
  const { ctx } = h,
    { wram, port } = sceneRuntime(h);
  yield () => {
    setWord(wram, TEXT_BUFFER + DIGITS, 0);
    let x = DIGITS,
      value = word(wram, DP_VALUE);
    do {
      port.write(WRDIVL, value, 2, DIVIDEND_SITE);
      port.write(WRDIVB, RADIX, 1, DIVISOR_SITE);
      x = (x - 1) & WORD_MASK;
      wram[TEXT_BUFFER + x] = (CHARACTER_ZERO + port.read(RDMPYL, 1, REMAINDER_SITE)) & BYTE_MASK;
      value = port.read(RDDIVL, 2, QUOTIENT_SITE);
    } while (value !== 0);
    selectBank(h, WRAM_BANK_PAIR);
    ctx.bank = WRAM_BANK;
    // The digits move to the buffer's start, up to the cleared end byte.
    if (x !== 0) {
      let y = 0;
      for (;;) {
        const byte = wram[TEXT_BUFFER + x];
        wram[TEXT_BUFFER + y] = byte;
        if (byte === 0) break;
        x = (x + 1) & WORD_MASK;
        y = (y + 1) & WORD_MASK;
      }
      ctx.y = y;
    }
    // A is the last quotient 0 (with the 0 byte in its low half). 80:FB39 reads no
    // flags, so they are not produced.
    ctx.a = 0;
    ctx.x = x;
  };
  yield* nativeCallSequence(h, events, routines, ...DRAW_CALL);
  let result;
  yield () => {
    restoreBank(h);
    result = h.rts();
  };
  return result;
}
