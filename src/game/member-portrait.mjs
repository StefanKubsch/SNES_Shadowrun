// The shown member's portrait in the status and spell menus (lifted from 80:E4B3 with
// 80:E48D, 80:E433 and 80:E41F; register-level version in
// proof/replay/native-member-spell-menu.mjs).
//
// The portrait record of the member's dialog (80:94F7 by 1F54, long pointers in bank
// 8D) is unpacked to 7F:5250 (80:9F6D) with the object size 40 and no palette list
// bytes, its tiles and palette uploaded (80:8F20, 80:9022). The second portrait channel
// (palette A1, VRAM 0800, 80:8FF5) gets its HDMA words, and the NMI job lists one more
// job (81:A954). Then the colour window opens on channel 0 from the 13-byte HDMA table
// 80:E480 (copied to 1F3F): over eleven frames (81:B0A1) the left window's edges
// widen with X = 2, 5, ... 20 (1F44 = X + 39, 1F43 = (X EOR FF) + 3B with that carry).
// The live callees compose directly through their frames; 80:E48D and 80:E433
// run as the JSR bodies the original calls, so a wait takes its NMI at the same S.
//
// Registers (user decision 2026-11-17): game state only, apart from the register inputs
// of the portrait unpack 80:9F6D (record in A, bank in Y, buffer in X) and the tile
// upload 80:8FF5 (VRAM address in X), which are still register-level. The window step
// (X in the original) is a local, and no registers or flags are left.
import { dialogCallBody, segmentSequence } from '../system/native-call-continuation.mjs';
import {
  unpackPortraitRoutine,
  shiftPortraitRowsRoutine,
  uploadFirstPortraitSequence,
  uploadPortraitTilesSequence,
} from './portrait-upload.mjs';
import { frameWaitCallSequence } from '../system/live-input-calls.mjs';
import { dataBankWord, setDataBankWord } from '../system/data-bank.mjs';
import { accessorPort } from '../system/hardware-port.mjs';
import {
  DP_PORTRAIT_BANK,
  DP_PORTRAIT_POINTER,
  PORTRAIT_BUFFER,
  PORTRAIT_OBJSEL,
  PORTRAIT_RECORD_BANK_BYTE,
  PORTRAIT_WINDOW,
  SECOND_PORTRAIT_HDMA,
  SECOND_PORTRAIT_PALETTE,
  SECOND_PORTRAIT_VRAM,
} from '../system/native-dialog-portrait.mjs';
import {
  HDMAEN_SHADOW,
  MEMBER_PORTRAIT,
  NMI_JOB_LISTS,
  PALETTE_UPLOAD_LIST_BYTES,
  PORTRAIT_HDMA_TABLE,
  PORTRAIT_PALETTE_START,
  PORTRAIT_WINDOW_LEFT,
  PORTRAIT_WINDOW_RIGHT,
  TMW_SHADOW,
} from '../data/wram.mjs';
import { DIALOG_BANK_BASE, DIALOG_TABLE } from '../data/portraits.mjs';
import {
  A1B0,
  A1T0L,
  BBAD0,
  DMAP0,
  OBJSEL,
  W12SEL,
  WBGLOG,
} from '../constants/hardware-registers.mjs';
import { BYTE_BITS, BYTE_MASK, LONG_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';
import { WRAM_BANK } from '../constants/memory-map.mjs';

// The colour window's HDMA table in the ROM and its last byte.
const HDMA_TABLE_SOURCE = 0x80e480,
  HDMA_TABLE_LAST = 0x0c;
// The callees and their call sites; the instruction sites of the port writes.
const UNPACK = [0x80e4e3, 0x809f6d],
  UPLOAD_TILES = [0x80e4e6, 0x808f20],
  UPLOAD_PALETTE = [0x80e4e9, 0x809022],
  SECOND_TILES = [0x80e496, 0x808ff5],
  FRAME_WAIT = [0x80e470, 0x81b0a1],
  SECOND_CHANNEL = [0x80e4ec, 0x80e48d],
  COLOUR_WINDOW = [0x80e4ef, 0x80e433],
  SITES = Object.freeze({
    objsel: 0x80e4bf,
    window: 0x80e436,
    logic: 0x80e439,
    table: 0x80e43f,
    mode: 0x80e453,
    target: 0x80e458,
    bank: 0x80e45d,
  });

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const longWord = (mem, at) =>
  mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
// 80:E41F: the left window's edges for the step (X in the original).
function setWindowEdges(wram, step) {
  const edge = step & BYTE_MASK,
    right = edge + PORTRAIT_WINDOW.leftWindowRightBias,
    left =
      ((edge ^ BYTE_MASK) + PORTRAIT_WINDOW.leftWindowLeftBias + (right >>> BYTE_BITS)) & BYTE_MASK;
  wram[PORTRAIT_WINDOW_RIGHT] = right & BYTE_MASK;
  wram[PORTRAIT_WINDOW_LEFT] = left;
}

// 80:E4B3: the member's portrait with its opening window (see above). A sequence that
// ends with its RTS.
export function* memberPortraitSequence(h, events) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem,
    port = accessorPort(h.a);
  yield () => {
    const portrait = (dataBankWord(mem, MEMBER_PORTRAIT) << 1) & WORD_MASK,
      record = dataBankWord(mem, DIALOG_TABLE & WORD_MASK, portrait);
    port.write(OBJSEL, PORTRAIT_OBJSEL, 2, SITES.objsel);
    setDataBankWord(mem, PALETTE_UPLOAD_LIST_BYTES, 0, 0);
    wram[DP_PORTRAIT_BANK] = mem.read8((DIALOG_BANK_BASE + 2 + record) & LONG_MASK);
    setWord(wram, DP_PORTRAIT_POINTER, longWord(mem, DIALOG_BANK_BASE + record));
    const pointer = word(wram, DP_PORTRAIT_POINTER) | (wram[DP_PORTRAIT_BANK] << WORD_BITS);
    // The unpack's register inputs.
    ctx.y = mem.read8((pointer + PORTRAIT_RECORD_BANK_BYTE) & LONG_MASK);
    ctx.a = longWord(mem, pointer);
    ctx.x = PORTRAIT_BUFFER;
  };
  yield* dialogCallBody(h, ...UNPACK, () =>
    segmentSequence(() => unpackPortraitRoutine(h, events)),
  );
  yield* dialogCallBody(h, ...UPLOAD_TILES, () =>
    segmentSequence(() => shiftPortraitRowsRoutine(h)),
  );
  yield* dialogCallBody(h, ...UPLOAD_PALETTE, () => uploadFirstPortraitSequence(h, events));
  yield* dialogCallBody(h, ...SECOND_CHANNEL, () => secondChannelSequence(h, events));
  yield* dialogCallBody(h, ...COLOUR_WINDOW, () => colourWindowSequence(h, events));
  return yield* returnSequence(h);
}

// The RTS that ends a sequence.
function* returnSequence(h) {
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}

// 80:E48D: the second portrait channel and one more NMI job (81:A954).
function* secondChannelSequence(h, events) {
  const { ctx } = h,
    { mem } = h.a;
  yield () => {
    setDataBankWord(mem, PORTRAIT_PALETTE_START, 0, SECOND_PORTRAIT_PALETTE);
    // The tile upload's register input.
    ctx.x = SECOND_PORTRAIT_VRAM;
  };
  yield* dialogCallBody(h, ...SECOND_TILES, () => uploadPortraitTilesSequence(h, events));
  yield () => {
    const hdma = SECOND_PORTRAIT_HDMA;
    for (const [address, value] of [
      [hdma.firstAddress, hdma.first],
      [hdma.secondAddress, hdma.second],
      [hdma.oamHighAddress, hdma.oamHigh],
    ])
      mem.write16(address, value);
    // 81:A954: one more NMI job.
    const jobs = (dataBankWord(mem, NMI_JOB_LISTS) + 1) & WORD_MASK;
    setDataBankWord(mem, NMI_JOB_LISTS, 0, jobs);
  };
  return yield* returnSequence(h);
}

// 80:E433: the colour window on HDMA channel 0, its edges widened over eleven frames.
function* colourWindowSequence(h, events) {
  const { mem } = h.a,
    { wram } = mem,
    port = accessorPort(h.a);
  yield () => {
    port.write(W12SEL, PORTRAIT_WINDOW.select, 2, SITES.window);
    port.write(WBGLOG, 0, 2, SITES.logic);
    port.write(A1T0L, PORTRAIT_HDMA_TABLE, 2, SITES.table);
    // The table and the channel's enable bit are bytes (8-bit A, TSB, whose zero the
    // next load overwrites).
    for (let n = 0; n <= HDMA_TABLE_LAST; n++)
      wram[PORTRAIT_HDMA_TABLE + n] = mem.read8(HDMA_TABLE_SOURCE + n);
    port.write(DMAP0, PORTRAIT_WINDOW.hdmaMode, 1, SITES.mode);
    port.write(BBAD0, PORTRAIT_WINDOW.hdmaTarget, 1, SITES.target);
    port.write(A1B0, WRAM_BANK, 1, SITES.bank);
    const shown = wram[HDMAEN_SHADOW];
    wram[HDMAEN_SHADOW] = shown | PORTRAIT_WINDOW.hdmaChannel;
    setDataBankWord(mem, TMW_SHADOW, 0, PORTRAIT_WINDOW.layers);
  };
  let step = PORTRAIT_WINDOW.edgeFirst;
  do {
    yield* dialogCallBody(h, ...FRAME_WAIT, () => frameWaitCallSequence(h, events), true);
    yield () => {
      setWindowEdges(wram, step);
      step = (step + PORTRAIT_WINDOW.edgeStep) & WORD_MASK;
    };
  } while (step < PORTRAIT_WINDOW.edgeEnd);
  return yield* returnSequence(h);
}
