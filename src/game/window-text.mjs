// Text cursor and decimal digits over named window/buffer fields. Hardware
// arithmetic stays at the existing presentation boundary until phase 5.
import { windowState, windowManagerState } from '../state/windows.mjs';
import { renderTextBuffer, drawTextBuffer } from './text-draw.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import {
  RDDIVL,
  RDMPYL,
  WRDIVB,
  WRDIVL,
  WRMPYA,
  WRMPYB,
} from '../constants/hardware-registers.mjs';
import { BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
const BORDER_COLUMNS = 2,
  DIGITS = 5,
  RADIX = 10,
  CHARACTER_ZERO = 0x30;
const ROW_SITE = 0x80fab8,
  COLUMNS_SITE = 0x80fac1,
  PRODUCT_SITE = 0x80facd,
  DIVIDEND_SITE = 0x80fd8c,
  DIVISOR_SITE = 0x80fd93,
  REMAINDER_SITE = 0x80fd9e,
  QUOTIENT_SITE = 0x80fda7;
export function setTextCursor(h) {
  const { mem, port } = sceneRuntime(h),
    state = windowManagerState(mem),
    record = windowState(mem, state.windowArgument);
  port.write(WRMPYA, state.cursorRowArgument & BYTE_MASK, 1, ROW_SITE);
  port.write(WRMPYB, ((record.columns & BYTE_MASK) - BORDER_COLUMNS) & BYTE_MASK, 1, COLUMNS_SITE);
  const start = record.firstTile + state.valueArgument,
    left = start & WORD_MASK,
    product = port.read(RDMPYL, 2, PRODUCT_SITE);
  record.cursorTile = left + product + (start > WORD_MASK ? 1 : 0);
  record.cursorPixel = 0;
}
export function* printNumber(h, events, renderBuffer = drawTextBuffer) {
  const { mem, port } = sceneRuntime(h),
    state = windowManagerState(mem);
  yield () => {
    state.writeTextWord(DIGITS, 0);
    let index = DIGITS,
      value = state.valueArgument;
    do {
      port.write(WRDIVL, value, 2, DIVIDEND_SITE);
      port.write(WRDIVB, RADIX, 1, DIVISOR_SITE);
      index = (index - 1) & WORD_MASK;
      state.writeTextByte(index, CHARACTER_ZERO + port.read(RDMPYL, 1, REMAINDER_SITE));
      value = port.read(RDDIVL, 2, QUOTIENT_SITE);
    } while (value !== 0);
    if (index !== 0) {
      let target = 0;
      for (;;) {
        const value = state.readTextByte(index);
        state.writeTextByte(target, value);
        if (value === 0) break;
        index = (index + 1) & WORD_MASK;
        target = (target + 1) & WORD_MASK;
      }
    }
  };
  yield* renderTextBuffer(h, events, renderBuffer);
}
export function setTextCursorAt(h, window, column = 0, row = 0) {
  const state = windowManagerState(h.a.mem);
  state.windowArgument = window;
  state.valueArgument = column;
  state.cursorRowArgument = row;
  setTextCursor(h);
}
export function setWindowTextArea(h, window, leftPixel, width) {
  const record = windowState(h.a.mem, window);
  record.leftPixel = leftPixel;
  if (width === 0 || width & WORD_SIGN)
    width = (width + record.columns - BORDER_COLUMNS) & WORD_MASK;
  record.widthPixels = width;
}
