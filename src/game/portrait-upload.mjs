// The dialog's portraits in video memory (lifted from 80:9F6D, 80:8F20, 80:9022, 80:905E
// and 80:8FF5; register-level versions in src/system/native-dialog-portrait.mjs stay the
// reference).
//
// A portrait's packed stream (the pointer in A, the bank word in Y) is unpacked into
// bank 7F from the offset in X (80:9F6D, by the lifted unpacker src/system/unpack.mjs,
// which leaves the direct page state of the original). It leaves A the stream's output
// length, X and Y as the original's copy leaves them, and the status and the data bank
// restored (PLP, PLB); the bytes of its pushes (status, data bank, the bank pair and the
// length) stay below the stack, those of its bit reads' JSR frames are not reproduced.
// A startup recording runs the register-level one (src/system/recorded-routines.mjs).
// Lifted callers use unpackPortrait and uploadPortraitTiles, which take the stream, its
// bank word, the offset and the VRAM address as parameters and leave no registers (user
// decision 2026-11-17); the routine forms keep the register interface for
// register-level callers.
//
// An unpacked portrait (7F:5250) has its eight rows of 100 bytes moved apart (80:8F20:
// rows 1 to 7 by MVP within bank 7F, from the last one up). The first portrait then goes
// to VRAM word 0000 with the palette start 91 (80:9022), the second to 0800 with A1
// (80:905E), each by the NMI's DMA job 80:8FF5, composed directly through its JSR
// frame. The first one also fills every fourth byte of the
// portraits' HDMA table 7E:3D08 with F0 (the lines without the sprite layer), clears the
// OAM high table copy 7E:3F08 and sets the table's first two entries; the second one sets
// its entries (the dialog flags' mirror bit 7 as bit 14 of the second), the OAM high
// table's first word 28 and counts one more NMI job list (81:A954).
//
// Registers (user decision 2026-11-17): the row shift and both uploads leave no
// registers or flags. The second upload's data bank push and the job count's JSL frame
// are not reproduced (nothing waits there).
//
// The DMA job (80:8FF5) sets DMA channel 0 to move the 1000 bytes of 7F:5250 to the
// VRAM data port (mode 1, VMDATAL and VMDATAH, the address incremented after the high
// byte; Book I 2-17-1, 2-27-14), puts the VRAM word address in X into the request
// 7E:0140 and waits until the NMI has run the transfer and set the request negative. With
// the lag-free frame model the NMI arrives at the wait's branch 80:901F.
// The independent former caller retains recorded polls. It
// leaves A the request word with its sign set and zero clear, X, Y, the carry and the
// overflow unchanged, as the original.
import { dialogCallBody } from '../system/native-call-continuation.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { nmiAtBranch } from '../system/frame-wait.mjs';
import { recordedRoutine } from '../system/recorded-routines.mjs';
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
} from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, BYTE_SIGN, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_MEMORY_8BIT, FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';

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
  REQUEST_BRANCH = 0x80901f;
const FIRST_UPLOAD = [0x80902b, 0x808ff5],
  SECOND_UPLOAD = [0x809067, 0x808ff5];

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};

// Unpack the portrait stream (pointer, bank word) into bank 7F from the offset
// (80:9F6D, called with JSR); returns the registers the original leaves, which only the
// register form (proof/caller/portrait-routines.mjs) uses.
export function unpackPortraitStream(h, source, bank, offset) {
  const { ctx } = h;
  // PHP, PHB, PEA 7F7F, PLB, PLB: their bytes stay below the stack.
  h.pushByte(ctx.status);
  h.pushByte(ctx.bank);
  h.a.pushWord(HIGH_BANK_PAIR);
  ctx.s = (ctx.s + 2) & WORD_MASK;
  const registers = unpackLongRegisters(h.a.mem, source, bank, offset, UNPACK_7F);
  // The length the routine pushes and pulls again (PHA, PLA).
  h.a.pushWord(registers.a);
  ctx.s = (ctx.s + 2) & WORD_MASK;
  // PLB, PLP: the data bank and the status as on entry.
  ctx.s = (ctx.s + 2) & WORD_MASK;
  return registers;
}
export function unpackPortrait(h, events, source, bank, offset) {
  const recorded = recordedRoutine(events, 'portrait-unpack');
  if (recorded) {
    Object.assign(h.ctx, { a: source, y: bank, x: offset });
    return recorded(h, events);
  }
  unpackPortraitStream(h, source, bank, offset);
  return h.rts();
}
// Move the portrait rows apart (80:8F20), called with JSR.
export function shiftPortraitRowsRoutine(h) {
  const { wram } = h.a.mem;
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
  return h.rts();
}

// Upload the first portrait (80:9022), a sequence with a direct live DMA job.
export function* uploadFirstPortraitSequence(h, events) {
  const { wram } = h.a.mem;
  yield () => {
    setWord(wram, PORTRAIT_PALETTE_START, FIRST_PALETTE);
  };
  yield* dialogCallBody(h, ...FIRST_UPLOAD, () => uploadPortraitTiles(h, events, 0));
  yield () => {
    for (let x = HDMA_FILL_LAST; !(x & WORD_SIGN); x = (x - HDMA_STRIDE) & WORD_MASK)
      wram[HDMA_TABLE + x] = HDMA_FILL;
    for (let x = OAM_HIGH_LAST; x >= 0; x -= 2) setWord(wram, OAM_HIGH_TABLE + x, 0);
    for (const [at, value] of FIRST_ENTRIES) setWord(wram, at, value);
  };
  return yield* rts(h);
}

// Upload the second portrait (80:905E), a sequence with a direct live DMA job.
export function* uploadSecondPortraitSequence(h, events) {
  const { wram } = h.a.mem;
  yield () => {
    setWord(wram, PORTRAIT_PALETTE_START, SECOND_PALETTE);
  };
  yield* dialogCallBody(h, ...SECOND_UPLOAD, () => uploadPortraitTiles(h, events, SECOND_VRAM));
  yield () => {
    setWord(wram, SECOND_FIRST[0], SECOND_FIRST[1]);
    const mirror = (word(wram, DIALOG_RECORD_FLAGS) & BYTE_SIGN) << MIRROR_SHIFT;
    setWord(wram, SECOND_SECOND[0], mirror | SECOND_SECOND[1]);
    setWord(wram, OAM_HIGH_TABLE, SECOND_OAM_HIGH);
    setWord(wram, NMI_JOB_LISTS, word(wram, NMI_JOB_LISTS) + 1);
  };
  return yield* rts(h);
}
// The portrait job's DMA channel 0 setup of 80:8FF5: 1000 bytes from 7F:5250 to VMDATA
// in word mode, with the VRAM address incremented after the high byte. The game NMI
// (src/game/game-nmi.mjs) repeats it when the palette cycle step took channel 0 first.
export function writePortraitTileChannel(port) {
  port.write(DAS0L, TILE_BYTES, 2, DMA_SITES.bytes);
  port.write(A1T0L, TILE_SOURCE, 2, DMA_SITES.source);
  port.write(A1B0, TILE_BANK, 1, DMA_SITES.bank);
  port.write(BBAD0, VMDATAL & BYTE_MASK, 1, DMA_SITES.target);
  port.write(VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 1, DMA_SITES.increment);
  port.write(DMAP0, TILE_MODE, 1, DMA_SITES.mode);
}

// Upload the unpacked portrait to the VRAM word address (80:8FF5), a sequence for a
// native call continuation, called with JSR. Leaves no registers.
export function* uploadPortraitTiles(h, events, vram) {
  const { ctx } = h,
    { wram, port } = sceneRuntime(h);
  yield () => {
    writePortraitTileChannel(port);
    setWord(wram, PORTRAIT_DMA_REQUEST, vram);
  };
  // The wait's branch sees the request word's zero in 16-bit mode.
  const done = (value) => (value & WORD_SIGN) !== 0;
  for (let value; !done((value = word(wram, PORTRAIT_DMA_REQUEST)));) {
    const status =
      (ctx.status & ~(FLAG_MEMORY_8BIT | FLAG_NEGATIVE | FLAG_ZERO)) |
      (value === 0 ? FLAG_ZERO : 0);
    yield* nmiAtBranch(h, events, REQUEST_BRANCH, status);
  }
  return yield* rts(h);
}
function* rts(h) {
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
