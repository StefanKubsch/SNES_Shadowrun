// The dialog's portraits in video memory (lifted from 80:9F6D, 80:8F20, 80:9022, 80:905E
// and 80:8FF5; register-level versions in src/task/native-dialog-portrait.mjs stay the
// reference).
//
// A portrait's packed stream (the pointer in A, the bank word in Y) is unpacked into
// bank 7F from the offset in X (80:9F6D, by the lifted unpacker src/system/unpack.mjs,
// which leaves the direct page state of the original). It leaves A the stream's output
// length, X and Y as the original's copy leaves them, and the status and the data bank
// restored (PLP, PLB); the bytes of its pushes (status, data bank, the bank pair and the
// length) stay below the stack, those of its bit reads' JSR frames are not reproduced.
// With recorded interrupts inside the routine (startupInterrupts) the register-level
// one runs.
//
// An unpacked portrait (7F:5250) has its eight rows of 100 bytes moved apart (80:8F20:
// rows 1 to 7 by MVP within bank 7F, from the last one up). The first portrait then goes
// to VRAM word 0000 with the palette start 91 (80:9022), the second to 0800 with A1
// (80:905E), each by the NMI's DMA job 80:8FF5 (from the routine table through its JSR
// frame). The first one also fills every fourth byte of the
// portraits' HDMA table 7E:3D08 with F0 (the lines without the sprite layer), clears the
// OAM high table copy 7E:3F08 and sets the table's first two entries; the second one sets
// its entries (the dialog flags' mirror bit 7 as bit 14 of the second), the OAM high
// table's first word 28 and counts one more NMI job list (81:A954).
//
// The registers are left as the original: the row shift A FFFF, X 534F, Y the last
// destination, the carry of its CPX and the sign and zero of the restored data bank; the
// first portrait A 3200, X FFFE; the second one A 28, the carry clear and the sign and zero
// of the job count, X 0800. Its data bank push and the job count's JSL frame are not
// reproduced (nothing waits there).
//
// The DMA job (80:8FF5) sets DMA channel 0 to move the 1000 bytes of 7F:5250 to the
// VRAM data port (mode 1, VMDATAL and VMDATAH, the address incremented after the high
// byte; Book I 2-17-1, 2-27-14), puts the VRAM word address in X into the request
// 7E:0140 and waits until the NMI has run the transfer and set the request negative. With
// the lag-free frame model the NMI arrives at the wait's branch 80:901F; otherwise the
// recorded observations or interrupts are replayed as by the register-level job. It
// leaves A the request word with its sign set and zero clear, X, Y, the carry and the
// overflow unchanged, as the original.
import { dialogCallSequence } from '../task/native-call-continuation.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { nmiAtBranch } from '../system/frame-wait.mjs';
import { lagFree } from '../task/main-wait-interrupt.mjs';
import { unpackPortrait, waitWord } from '../task/native-dialog-portrait.mjs';
import { UNPACK_7F, unpackLongRegisters } from '../system/unpack.mjs';
import {
  A1B0,
  A1T0L,
  BBAD0,
  DAS0L,
  DMAP0,
  VMAINC,
  VMDATAL,
} from '../constants/hardware-registers.mjs';
import { VMAINC_INCREMENT_AFTER_HIGH } from '../constants/ppu.mjs';
import {
  DIALOG_RECORD_FLAGS,
  NMI_JOB_LISTS,
  OAM_HIGH_TABLE,
  PORTRAIT_DMA_REQUEST,
  PORTRAIT_PALETTE_START,
} from '../task/wram.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  BYTE_SIGN,
  HIGH_BYTE_MASK,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';
import {
  FLAG_CARRY,
  FLAG_MEMORY_8BIT,
  FLAG_NEGATIVE,
  FLAG_OVERFLOW,
  FLAG_ZERO,
} from '../constants/cpu-flags.mjs';

// Bank 7F in the WRAM array, and the row shift's addresses.
const HIGH_BANK = 0x10000,
  HIGH_BANK_PAIR = 0x7f7f,
  SOURCE_END = 0x5a4f,
  DESTINATION_END = 0x624f,
  SOURCE_STOP = 0x534f,
  ROW_BYTES = 0x100;
const FIRST_PALETTE = 0x91,
  SECOND_PALETTE = 0xa1,
  SECOND_VRAM = 0x800,
  HDMA_TABLE = 0x3d08,
  HDMA_FILL = 0xf0,
  HDMA_FILL_LAST = 0x1fd,
  HDMA_STRIDE = 4,
  OAM_HIGH_LAST = 0x1e,
  // The clearing loop counts X down past 0.
  OAM_LOOP_END = 0xfffe,
  FIRST_ENTRIES = Object.freeze([
    [0x3d0c, 0x83a6],
    [0x3d0e, 0x3200],
  ]),
  SECOND_FIRST = [0x3d10, 0x1a1a],
  SECOND_SECOND = [0x3d12, 0x3480],
  SECOND_OAM_HIGH = 0x28,
  // The mirror bit 7 of the dialog flags, moved to bit 14 (XBA, LSR).
  MIRROR_SHIFT = 7;
// The DMA job: the transfer's byte count, source and mode, its port write sites, and the
// request's load and wait branch.
const TILE_BYTES = 0x1000,
  TILE_SOURCE = 0x5250,
  TILE_BANK = 0x7f,
  TILE_MODE = 1,
  DMA_SITES = Object.freeze({
    bytes: 0x808ff8,
    source: 0x808ffe,
    bank: 0x809005,
    target: 0x80900a,
    increment: 0x80900f,
    mode: 0x809014,
  }),
  REQUEST_LOAD = 0x80901c,
  REQUEST_BRANCH = 0x80901f;
const FIRST_UPLOAD = [0x80902b, 0x808ff5],
  SECOND_UPLOAD = [0x809067, 0x808ff5];

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const flag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};

// Unpack a portrait into bank 7F (80:9F6D), called with JSR.
export function unpackPortraitRoutine(h, events) {
  if (events?.startupInterrupts) return unpackPortrait(h, events);
  const { ctx } = h;
  // PHP, PHB, PEA 7F7F, PLB, PLB.
  h.pushByte(ctx.status);
  h.pushByte(ctx.bank);
  h.a.pushWord(HIGH_BANK_PAIR);
  ctx.s = (ctx.s + 2) & WORD_MASK;
  const registers = unpackLongRegisters(h.a.mem, ctx.a, ctx.y, ctx.x, UNPACK_7F);
  // The length the routine pushes and pulls again (PHA, PLA).
  h.a.pushWord(registers.a);
  ctx.s = (ctx.s + 2) & WORD_MASK;
  Object.assign(ctx, registers);
  // PLB, PLP: the data bank and the status as on entry.
  ctx.s = (ctx.s + 2) & WORD_MASK;
  return h.rts();
}

// Move the portrait rows apart (80:8F20), called with JSR.
export function shiftPortraitRowsRoutine(h) {
  const { ctx } = h,
    { wram } = h.a.mem;
  let x = SOURCE_END,
    y = DESTINATION_END;
  while (x !== SOURCE_STOP) {
    y = (y - ROW_BYTES) & WORD_MASK;
    for (let n = 0; n < ROW_BYTES; n++) {
      wram[HIGH_BANK + y] = wram[HIGH_BANK + x];
      x = (x - 1) & WORD_MASK;
      y = (y - 1) & WORD_MASK;
    }
  }
  ctx.a = WORD_MASK;
  ctx.x = x;
  ctx.y = y;
  // The last SBC overflows never; CPX equal; PLB restores the data bank.
  flag(ctx, FLAG_OVERFLOW, false);
  flag(ctx, FLAG_CARRY, true);
  flag(ctx, FLAG_NEGATIVE, ctx.bank & BYTE_SIGN);
  flag(ctx, FLAG_ZERO, ctx.bank === 0);
  return h.rts();
}

// Upload the first portrait (80:9022), a sequence: routines the table with 80:8FF5.
export function* uploadFirstPortraitSequence(h, events, routines) {
  const { ctx } = h,
    { wram } = h.a.mem;
  yield () => {
    ctx.a = FIRST_PALETTE;
    setWord(wram, PORTRAIT_PALETTE_START, ctx.a);
    ctx.x = 0;
  };
  yield* dialogCallSequence(h, events, routines, ...FIRST_UPLOAD);
  yield () => {
    for (let x = HDMA_FILL_LAST; !(x & WORD_SIGN); x = (x - HDMA_STRIDE) & WORD_MASK)
      wram[HDMA_TABLE + x] = HDMA_FILL;
    for (let x = OAM_HIGH_LAST; x >= 0; x -= 2) setWord(wram, OAM_HIGH_TABLE + x, 0);
    for (const [at, value] of FIRST_ENTRIES) setWord(wram, at, value);
    ctx.a = FIRST_ENTRIES[1][1];
    ctx.x = OAM_LOOP_END;
    flag(ctx, FLAG_NEGATIVE, false);
    flag(ctx, FLAG_ZERO, false);
  };
  return yield* rts(h);
}

// Upload the second portrait (80:905E), a sequence: routines the table with 80:8FF5.
export function* uploadSecondPortraitSequence(h, events, routines) {
  const { ctx } = h,
    { wram } = h.a.mem;
  yield () => {
    ctx.a = SECOND_PALETTE;
    setWord(wram, PORTRAIT_PALETTE_START, ctx.a);
    ctx.x = SECOND_VRAM;
  };
  yield* dialogCallSequence(h, events, routines, ...SECOND_UPLOAD);
  yield () => {
    setWord(wram, SECOND_FIRST[0], SECOND_FIRST[1]);
    const mirror = (word(wram, DIALOG_RECORD_FLAGS) & BYTE_SIGN) << MIRROR_SHIFT;
    setWord(wram, SECOND_SECOND[0], mirror | SECOND_SECOND[1]);
    setWord(wram, OAM_HIGH_TABLE, SECOND_OAM_HIGH);
    ctx.a = SECOND_OAM_HIGH;
    flag(ctx, FLAG_CARRY, false);
    const jobs = (word(wram, NMI_JOB_LISTS) + 1) & WORD_MASK;
    setWord(wram, NMI_JOB_LISTS, jobs);
    flag(ctx, FLAG_NEGATIVE, jobs & WORD_SIGN);
    flag(ctx, FLAG_ZERO, jobs === 0);
  };
  return yield* rts(h);
}
// Upload the unpacked portrait to the VRAM word address in X (80:8FF5), a sequence for a
// native call continuation, called with JSR.
export function* uploadPortraitTilesSequence(h, events) {
  const { ctx } = h,
    { wram, port } = sceneRuntime(h);
  yield () => {
    port.write(DAS0L, TILE_BYTES, 2, DMA_SITES.bytes);
    port.write(A1T0L, TILE_SOURCE, 2, DMA_SITES.source);
    port.write(A1B0, TILE_BANK, 1, DMA_SITES.bank);
    port.write(BBAD0, VMDATAL & BYTE_MASK, 1, DMA_SITES.target);
    port.write(VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 1, DMA_SITES.increment);
    port.write(DMAP0, TILE_MODE, 1, DMA_SITES.mode);
    // The 8-bit loads keep the source's high byte.
    ctx.a = (TILE_SOURCE & HIGH_BYTE_MASK) | TILE_MODE;
    setWord(wram, PORTRAIT_DMA_REQUEST, ctx.x);
  };
  const done = (value) => (value & WORD_SIGN) !== 0;
  if (!lagFree(events)) yield () => waitWord(h, events, REQUEST_LOAD, PORTRAIT_DMA_REQUEST, done);
  else
    for (let value; !done((value = word(wram, PORTRAIT_DMA_REQUEST)));) {
      ctx.a = value;
      const status =
        (ctx.status & ~(FLAG_MEMORY_8BIT | FLAG_NEGATIVE | FLAG_ZERO)) |
        (value === 0 ? FLAG_ZERO : 0);
      yield* nmiAtBranch(h, events, REQUEST_BRANCH, status);
    }
  let result;
  yield () => {
    ctx.a = word(wram, PORTRAIT_DMA_REQUEST);
    flag(ctx, FLAG_NEGATIVE, true);
    flag(ctx, FLAG_ZERO, false);
    result = h.rts();
  };
  return result;
}

function* rts(h) {
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
