import { readStateByte, writeStateByte } from '../state/objects.mjs';
// The dialog's portrait window (lifted from 80:8F3A and 80:8F97 with the window edges
// 80:8EFE; register-level versions in src/system/native-dialog-portrait.mjs stay the
// reference).
//
// The portraits sit inside the two PPU windows (W12SEL 22 on both halves, WBGLOG 0),
// whose edges an HDMA table drives: channel 0 writes the four edges (WH0 to WH3, mode 1)
// from the table 7E:0144, copied from 80:8F87. Opening the window enables the channel
// in the HDMA shadow (7E:01C4 bit 0), sets the window layers (TMW shadow 7E:01C2, 0F)
// and widens the edges by 3 every frame from 2 to 32; closing narrows them by 3 every
// frame from 31, then clears the layers and the channel. The edges are the table's
// bytes 7E:0148/0149 and 7E:014E/014F around the screen's centre (Book I 2-27, the
// window registers 2126 to 2129).
//
// Each frame waits directly with live 81:B0A1 through its JSL frame. Registers (user
// decision 2026-11-17): game state only; the step (X in the original) is a local and no
// registers are left. The edges' JSR frame and their pushed status are not reproduced
// (nothing waits there).
import { dialogCallBody } from '../system/native-call-continuation.mjs';
import { frameWaitCallSequence } from '../system/live-input-calls.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { PORTRAIT_WINDOW } from '../system/native-dialog-portrait.mjs';
import {
  DIALOG_HDMA_TABLE,
  HDMAEN_SHADOW,
  LEFT_WINDOW_LEFT_EDGE,
  LEFT_WINDOW_RIGHT_EDGE,
  RIGHT_WINDOW_LEFT_EDGE,
  RIGHT_WINDOW_RIGHT_EDGE,
  TMW_SHADOW,
} from '../data/wram.mjs';
import { A1B0, A1T0L, BBAD0, DMAP0, W12SEL, WBGLOG } from '../constants/hardware-registers.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

const HDMA_SOURCE = 0x808f87,
  HDMA_LAST_BYTE = 0x0f,
  WRAM_BANK = 0x7e;
// The sites of the port writes and the calls.
const SITES = Object.freeze({
  select: 0x808f3d,
  logic: 0x808f40,
  table: 0x808f46,
  mode: 0x808f5a,
  target: 0x808f5f,
  bank: 0x808f64,
});
const OPEN_WAIT = [0x808f77, 0x81b0a1],
  CLOSE_WAIT = [0x808f9a, 0x81b0a1];

const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};

// The window edges for the step in X (80:8EFE): the left window from 39 and 3B, the
// right one from C5 and C7 around X and its complement, 8-bit additions with the carry
// carried along as the original.
function setWindowEdges(wram, x) {
  const add = (left, right, carry) => {
    const sum = left + right + (carry ? 1 : 0);
    return { value: sum & BYTE_MASK, carry: sum > BYTE_MASK };
  };
  const step = x & BYTE_MASK,
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

// Open the portrait window (80:8F3A) with live frame waits, for lifted callers without
// the JSR frame (the frame waits keep their JSL frames).
export function* openPortraitWindow(h, events) {
  const { mem, wram, port } = sceneRuntime(h);
  let step = PORTRAIT_WINDOW.edgeFirst;
  yield () => {
    port.write(W12SEL, PORTRAIT_WINDOW.select, 2, SITES.select);
    port.write(WBGLOG, 0, 2, SITES.logic);
    port.write(A1T0L, DIALOG_HDMA_TABLE, 2, SITES.table);
    for (let x = HDMA_LAST_BYTE; x >= 0; x--)
      writeStateByte(wram, DIALOG_HDMA_TABLE + x, mem.read8(HDMA_SOURCE + x));
    port.write(DMAP0, PORTRAIT_WINDOW.hdmaMode, 1, SITES.mode);
    port.write(BBAD0, PORTRAIT_WINDOW.hdmaTarget, 1, SITES.target);
    port.write(A1B0, WRAM_BANK, 1, SITES.bank);
    writeStateByte(
      wram,
      HDMAEN_SHADOW,
      readStateByte(wram, HDMAEN_SHADOW) | PORTRAIT_WINDOW.hdmaChannel,
    );
    setWord(wram, TMW_SHADOW, PORTRAIT_WINDOW.layers);
  };
  do {
    yield* dialogCallBody(h, ...OPEN_WAIT, () => frameWaitCallSequence(h, events), true);
    yield () => {
      setWindowEdges(wram, step);
      step = (step + PORTRAIT_WINDOW.edgeStep) & WORD_MASK;
    };
  } while (step < PORTRAIT_WINDOW.edgeEnd);
}

// Close the portrait window (80:8F97) with live frame waits, for lifted callers without
// the JSR frame (the frame waits keep their JSL frames).
export function* closePortraitWindow(h, events) {
  const { wram } = sceneRuntime(h);
  let step = PORTRAIT_WINDOW.edgeLast;
  do {
    yield* dialogCallBody(h, ...CLOSE_WAIT, () => frameWaitCallSequence(h, events), true);
    yield () => {
      setWindowEdges(wram, step);
      step = (step - PORTRAIT_WINDOW.edgeStep) & WORD_MASK;
    };
  } while (!(step & WORD_SIGN));
  yield () => {
    setWord(wram, TMW_SHADOW, 0);
    writeStateByte(
      wram,
      HDMAEN_SHADOW,
      readStateByte(wram, HDMAEN_SHADOW) & ~PORTRAIT_WINDOW.hdmaChannel,
    );
  };
}
