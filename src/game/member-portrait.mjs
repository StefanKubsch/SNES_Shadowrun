import { readStateByte, writeStateByte } from '../state/objects.mjs';
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
// Live unpacking, both tile transfers and all window waits compose without CPU
// call frames. Instruction-level recordings retain their unpack adapter.
//
// Registers (user decision 2026-11-17): game state only. The portrait unpack 80:9F6D
// and the tile upload 80:8FF5 take their stream, offset and VRAM address as parameters
// (A, Y and X in the original); the window step (X) is a local, and no registers or
// flags are left.
import {
  unpackPortraitStream,
  shiftPortraitRowsInPlace,
  uploadFirstPortrait,
  transferPortraitTiles,
  DP_PORTRAIT_BANK,
  DP_PORTRAIT_POINTER,
  PORTRAIT_BUFFER,
  PORTRAIT_OBJSEL,
  PORTRAIT_RECORD_BANK_BYTE,
  SECOND_PORTRAIT_HDMA,
  SECOND_PORTRAIT_PALETTE,
  SECOND_PORTRAIT_VRAM,
} from '../platform/portrait-tiles.mjs';
import { waitForCounterWord } from '../system/frame-wait.mjs';
import { dataBankWord, setDataBankWord } from '../system/data-bank.mjs';
import { accessorPort } from '../system/hardware-port.mjs';
import { videoOf } from '../video/picture-video.mjs';
import { PORTRAIT_WINDOW } from '../platform/portrait-window.mjs';
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
import { BYTE_BITS, BYTE_MASK, LONG_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';
import { WRAM_BANK } from '../constants/memory-map.mjs';

// The colour window's HDMA table in the ROM and its last byte.
const HDMA_TABLE_SOURCE = 0x80e480,
  HDMA_TABLE_LAST = 0x0c;
// The callees and their call sites; the instruction sites of the port writes.
const SITES = Object.freeze({
  objsel: 0x80e4bf,
  window: 0x80e436,
  logic: 0x80e439,
  table: 0x80e43f,
  mode: 0x80e453,
  target: 0x80e458,
  bank: 0x80e45d,
});

const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};
const longWord = (mem, at) =>
  mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
// 80:E41F: the left window's edges for the step (X in the original).
function setWindowEdges(wram, step) {
  const edge = step & BYTE_MASK,
    right = edge + PORTRAIT_WINDOW.leftWindowRightBias,
    left =
      ((edge ^ BYTE_MASK) + PORTRAIT_WINDOW.leftWindowLeftBias + (right >>> BYTE_BITS)) & BYTE_MASK;
  writeStateByte(wram, PORTRAIT_WINDOW_RIGHT, right & BYTE_MASK);
  writeStateByte(wram, PORTRAIT_WINDOW_LEFT, left);
}

// 80:E4B3: the member's portrait with its opening window (see above), for lifted
// callers without the JSR frame (the caller's return word lies only in free stack
// bytes). Instruction-level recordings alone retain the unpacker's caller frame.
export function* memberPortrait(h, events) {
  const { mem } = h.a,
    { wram } = mem,
    port = accessorPort(h.a);
  let stream;
  yield () => {
    const portrait = (dataBankWord(mem, MEMBER_PORTRAIT) << 1) & WORD_MASK,
      record = dataBankWord(mem, DIALOG_TABLE & WORD_MASK, portrait);
    videoOf(port).setObjectSelect(PORTRAIT_OBJSEL, SITES.objsel);
    setDataBankWord(mem, PALETTE_UPLOAD_LIST_BYTES, 0, 0);
    writeStateByte(wram, DP_PORTRAIT_BANK, mem.read8((DIALOG_BANK_BASE + 2 + record) & LONG_MASK));
    setWord(wram, DP_PORTRAIT_POINTER, longWord(mem, DIALOG_BANK_BASE + record));
    const pointer =
      word(wram, DP_PORTRAIT_POINTER) | (readStateByte(wram, DP_PORTRAIT_BANK) << WORD_BITS);
    stream = [longWord(mem, pointer), mem.read8((pointer + PORTRAIT_RECORD_BANK_BYTE) & LONG_MASK)];
  };
  yield () => unpackPortraitStream(h, ...stream, PORTRAIT_BUFFER);
  yield () => shiftPortraitRowsInPlace(h);
  yield* uploadFirstPortrait(h, events);
  yield* secondChannel(h, events);
  yield* colourWindow(h, events);
}

// 80:E48D: the second portrait channel and one more NMI job (81:A954), without the JSR
// frame, including its tile transfer.
function* secondChannel(h, events) {
  const { mem } = h.a;
  yield () => {
    setDataBankWord(mem, PORTRAIT_PALETTE_START, 0, SECOND_PORTRAIT_PALETTE);
  };
  yield* transferPortraitTiles(h, events, SECOND_PORTRAIT_VRAM);
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
}

// 80:E433: the colour window on HDMA channel 0, its edges widened over eleven frames,
// without CPU call frames, including the counter waits.
function* colourWindow(h, events) {
  const { mem } = h.a,
    { wram } = mem,
    port = accessorPort(h.a);
  yield () => {
    const video = videoOf(port);
    video.setWindowSelect(PORTRAIT_WINDOW.select, SITES.window);
    video.setWindowLogic(0, SITES.logic);
    // The table and the channel's enable bit are bytes (8-bit A, TSB, whose zero the
    // next load overwrites).
    for (let n = 0; n <= HDMA_TABLE_LAST; n++)
      writeStateByte(wram, PORTRAIT_HDMA_TABLE + n, mem.read8(HDMA_TABLE_SOURCE + n));
    video.setUpHdmaTable(
      PORTRAIT_WINDOW.hdmaMode,
      PORTRAIT_WINDOW.hdmaTarget,
      (WRAM_BANK << WORD_BITS) | PORTRAIT_HDMA_TABLE,
      SITES,
    );
    const shown = readStateByte(wram, HDMAEN_SHADOW);
    writeStateByte(wram, HDMAEN_SHADOW, shown | PORTRAIT_WINDOW.hdmaChannel);
    setDataBankWord(mem, TMW_SHADOW, 0, PORTRAIT_WINDOW.layers);
  };
  let step = PORTRAIT_WINDOW.edgeFirst;
  do {
    yield* waitForCounterWord(h, events);
    yield () => {
      setWindowEdges(wram, step);
      step = (step + PORTRAIT_WINDOW.edgeStep) & WORD_MASK;
    };
  } while (step < PORTRAIT_WINDOW.edgeEnd);
}
