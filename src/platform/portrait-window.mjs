// The portrait window on the SNES picture (presentation layer, docs/READABLE-GAME.md;
// lifted from 80:8F3A, 80:8F97 and the window edges 80:8EFE).
//
// The game describes the portrait window as a rectangle that opens and closes: its
// opening grows from 2 to 32 and shrinks back. Here the opening becomes the original's
// two PPU windows (W12SEL 22 on both halves, WBGLOG 0), whose edges an HDMA table
// drives: channel 0 writes the four edges (WH0 to WH3, mode 1) from the table 7E:0144,
// copied from 80:8F87. Beginning the window enables the channel in the HDMA shadow
// (7E:01C4 bit 0) and sets the window layers (TMW shadow 7E:01C2, 0F); ending it clears
// the layers and the channel. The edges are the table's bytes 7E:0148/0149 and
// 7E:014E/014F around the screen's centre (Book I 2-27, the window registers 2126 to
// 2129).
import { readStateByte, writeStateByte } from '../state/objects.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { videoOf } from '../video/picture-video.mjs';
import {
  DIALOG_HDMA_TABLE,
  HDMAEN_SHADOW,
  LEFT_WINDOW_LEFT_EDGE,
  LEFT_WINDOW_RIGHT_EDGE,
  RIGHT_WINDOW_LEFT_EDGE,
  RIGHT_WINDOW_RIGHT_EDGE,
  TMW_SHADOW,
} from '../data/wram.mjs';
import { WH0 } from '../constants/hardware-registers.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS } from '../constants/bits.mjs';

// The portrait windows of the dialog and of the member portrait (src/game/member-portrait.mjs):
// the W12SEL/W34SEL word and TMW layers, HDMA channel 0 in mode 1 to WH0/WH1 from bank
// 7E, and the edges' biases: the step is added to them for the right edges and its
// complement for the left edges of the left and the right window. edgeFirst, edgeStep
// and edgeEnd are the member portrait's opening steps.
export const PORTRAIT_WINDOW = Object.freeze({
  select: 0x2222,
  layers: 0x0f,
  hdmaMode: 1,
  hdmaTarget: WH0 & BYTE_MASK,
  hdmaChannel: 1,
  edgeFirst: 2,
  edgeStep: 3,
  edgeEnd: 0x21,
  leftWindowRightBias: 0x39,
  leftWindowLeftBias: 0x3b,
  rightWindowRightBias: 0xc5,
  rightWindowLeftBias: 0xc7,
});

const HDMA_SOURCE = 0x808f87,
  HDMA_LAST_BYTE = 0x0f,
  WRAM_BANK = 0x7e;
// The sites of the port writes.
const SITES = Object.freeze({
  select: 0x808f3d,
  logic: 0x808f40,
  table: 0x808f46,
  mode: 0x808f5a,
  target: 0x808f5f,
  bank: 0x808f64,
});

const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};

// Set up the portrait window, still closed: window select and logic, the edge table and
// its HDMA channel, and the window layers.
export function beginPortraitWindow(h) {
  const { mem, wram, port } = sceneRuntime(h),
    video = videoOf(port);
  video.setWindowSelect(PORTRAIT_WINDOW.select, SITES.select);
  video.setWindowLogic(0, SITES.logic);
  for (let x = HDMA_LAST_BYTE; x >= 0; x--)
    writeStateByte(wram, DIALOG_HDMA_TABLE + x, mem.read8(HDMA_SOURCE + x));
  video.setUpHdmaTable(
    PORTRAIT_WINDOW.hdmaMode,
    PORTRAIT_WINDOW.hdmaTarget,
    (WRAM_BANK << WORD_BITS) | DIALOG_HDMA_TABLE,
    SITES,
  );
  writeStateByte(
    wram,
    HDMAEN_SHADOW,
    readStateByte(wram, HDMAEN_SHADOW) | PORTRAIT_WINDOW.hdmaChannel,
  );
  setWord(wram, TMW_SHADOW, PORTRAIT_WINDOW.layers);
}

// Open the portrait window this far (80:8EFE): the left window's edges from 39 and 3B,
// the right one's from C5 and C7 around the opening and its complement, 8-bit additions
// with the carry carried along as the original.
export function setPortraitWindowOpening(h, opening) {
  const { wram } = sceneRuntime(h);
  const add = (left, right, carry) => {
    const sum = left + right + (carry ? 1 : 0);
    return { value: sum & BYTE_MASK, carry: sum > BYTE_MASK };
  };
  const step = opening & BYTE_MASK,
    inverse = step ^ BYTE_MASK;
  const leftRight = add(step, PORTRAIT_WINDOW.leftWindowRightBias, false);
  writeStateByte(wram, LEFT_WINDOW_RIGHT_EDGE, leftRight.value);
  const rightRight = add(step, PORTRAIT_WINDOW.rightWindowRightBias, leftRight.carry);
  writeStateByte(wram, RIGHT_WINDOW_RIGHT_EDGE, rightRight.value);
  writeStateByte(
    wram,
    LEFT_WINDOW_LEFT_EDGE,
    add(inverse, PORTRAIT_WINDOW.leftWindowLeftBias, rightRight.carry).value,
  );
  writeStateByte(
    wram,
    RIGHT_WINDOW_LEFT_EDGE,
    add(inverse, PORTRAIT_WINDOW.rightWindowLeftBias, false).value,
  );
}

// Take the portrait window away: no window layers, the edge channel off.
export function endPortraitWindow(h) {
  const { wram } = sceneRuntime(h);
  setWord(wram, TMW_SHADOW, 0);
  writeStateByte(
    wram,
    HDMAEN_SHADOW,
    readStateByte(wram, HDMAEN_SHADOW) & ~PORTRAIT_WINDOW.hdmaChannel,
  );
}
