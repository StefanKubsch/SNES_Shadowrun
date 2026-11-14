// The shown member's portrait in the status and spell menus (lifted from 80:E4B3 with
// 80:E48D, 80:E433 and 80:E41F; register-level version in
// src/task/native-member-spell-menu.mjs).
//
// The portrait record of the member's dialog (80:94F7 by 1F54, long pointers in bank
// 8D) is unpacked to 7F:5250 (80:9F6D) with the object size 40 and no palette list
// bytes, its tiles and palette uploaded (80:8F20, 80:9022). The second portrait channel
// (palette A1, VRAM 0800, 80:8FF5) gets its HDMA words, and the NMI job lists one more
// job (81:A954). Then the colour window opens on channel 0 from the 13-byte HDMA table
// 80:E480 (copied to 1F3F): over eleven frames (81:B0A1) the left window's edges
// widen with X = 2, 5, ... 20 (1F44 = X + 39, 1F43 = (X EOR FF) + 3B with that carry).
// The callees run through their frames from the routine table; 80:E48D and 80:E433
// run as the JSR bodies the original calls, so a wait takes its NMI at the same S.
import { dialogCallBody, nativeCallSequence } from '../task/native-call-continuation.mjs';
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
} from '../task/native-dialog-portrait.mjs';
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
} from '../task/wram.mjs';
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
import {
  BYTE_BITS,
  BYTE_MASK,
  HIGH_BYTE_MASK,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';
import { WRAM_BANK } from '../constants/memory-map.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';

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
const setFlag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};
const setSignZero = (ctx, value) => {
  setFlag(ctx, FLAG_NEGATIVE, value & WORD_SIGN);
  setFlag(ctx, FLAG_ZERO, value === 0);
};
const call = (h, events, routines, [pc, target], long = false) =>
  nativeCallSequence(h, events, routines, pc, target, long, false);

// 80:E41F: the left window's edges for X; the flags stay (PHP/PLP), A's low byte is the
// left edge.
function setWindowEdges(h) {
  const { ctx } = h,
    { wram } = h.a.mem,
    edge = ctx.x & BYTE_MASK,
    right = edge + PORTRAIT_WINDOW.leftWindowRightBias,
    left =
      ((edge ^ BYTE_MASK) + PORTRAIT_WINDOW.leftWindowLeftBias + (right >>> BYTE_BITS)) & BYTE_MASK;
  wram[PORTRAIT_WINDOW_RIGHT] = right & BYTE_MASK;
  wram[PORTRAIT_WINDOW_LEFT] = left;
  ctx.a = (ctx.a & HIGH_BYTE_MASK) | left;
}

// 80:E4B3: the member's portrait with its opening window (see above). A sequence that
// ends with its RTS.
export function* memberPortraitSequence(h, events, routines) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem,
    port = accessorPort(h.a);
  yield () => {
    const portrait = (dataBankWord(mem, MEMBER_PORTRAIT) << 1) & WORD_MASK,
      record = dataBankWord(mem, DIALOG_TABLE & WORD_MASK, portrait);
    setFlag(ctx, FLAG_CARRY, dataBankWord(mem, MEMBER_PORTRAIT) & WORD_SIGN);
    port.write(OBJSEL, PORTRAIT_OBJSEL, 2, SITES.objsel);
    setDataBankWord(mem, PALETTE_UPLOAD_LIST_BYTES, 0, 0);
    wram[DP_PORTRAIT_BANK] = mem.read8((DIALOG_BANK_BASE + 2 + record) & LONG_MASK);
    setWord(wram, DP_PORTRAIT_POINTER, longWord(mem, DIALOG_BANK_BASE + record));
    const pointer = word(wram, DP_PORTRAIT_POINTER) | (wram[DP_PORTRAIT_BANK] << WORD_BITS);
    ctx.y = mem.read8((pointer + PORTRAIT_RECORD_BANK_BYTE) & LONG_MASK);
    ctx.a = longWord(mem, pointer);
    ctx.x = PORTRAIT_BUFFER;
    setSignZero(ctx, PORTRAIT_BUFFER);
  };
  yield* call(h, events, routines, UNPACK);
  yield* call(h, events, routines, UPLOAD_TILES);
  yield* call(h, events, routines, UPLOAD_PALETTE);
  yield* dialogCallBody(h, ...SECOND_CHANNEL, () => secondChannelSequence(h, events, routines));
  yield* dialogCallBody(h, ...COLOUR_WINDOW, () => colourWindowSequence(h, events, routines));
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
function* secondChannelSequence(h, events, routines) {
  const { ctx } = h,
    { mem } = h.a;
  yield () => {
    ctx.a = SECOND_PORTRAIT_PALETTE;
    setDataBankWord(mem, PORTRAIT_PALETTE_START, 0, SECOND_PORTRAIT_PALETTE);
    ctx.x = SECOND_PORTRAIT_VRAM;
    setSignZero(ctx, SECOND_PORTRAIT_VRAM);
  };
  yield* call(h, events, routines, SECOND_TILES);
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
function* colourWindowSequence(h, events, routines) {
  const { ctx } = h,
    { mem } = h.a,
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
    ctx.a = PORTRAIT_WINDOW.layers;
    setDataBankWord(mem, TMW_SHADOW, 0, PORTRAIT_WINDOW.layers);
    ctx.x = PORTRAIT_WINDOW.edgeFirst;
    setSignZero(ctx, ctx.x);
  };
  // X counts the edges (the word wait keeps it).
  let more;
  do {
    yield* call(h, events, routines, FRAME_WAIT, true);
    yield () => {
      setWindowEdges(h);
      const edge = (ctx.x + PORTRAIT_WINDOW.edgeStep) & WORD_MASK;
      ctx.x = edge;
      setSignZero(ctx, (edge - PORTRAIT_WINDOW.edgeEnd) & WORD_MASK);
      more = edge < PORTRAIT_WINDOW.edgeEnd;
      setFlag(ctx, FLAG_CARRY, !more);
    };
  } while (more);
  return yield* returnSequence(h);
}
