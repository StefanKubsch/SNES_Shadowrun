// The portraits on the SNES picture (presentation layer, docs/READABLE-GAME.md; lifted
// from 80:9F6D, 80:8F20, 80:9022, 80:905E and 80:8FF5).
//
// The game asks for two portraits by number (Jake's on the left, the partner's on the
// right, perhaps mirrored). Here a portrait's packed stream is unpacked into bank 7F at
// 5250 (80:9F6D, by src/system/unpack.mjs), its eight rows of 100 bytes moved apart
// (80:8F20: rows 1 to 7 by MVP within bank 7F, from the last one up), and its tiles sent
// to VRAM: the first portrait to word 0000 with the palette start 91 (80:9022), the
// second to 0800 with A1 (80:905E), each by the NMI's DMA job 80:8FF5. The NMI also
// uploads the portrait's palette from its record (src/game/game-nmi.mjs), whose address
// the direct page long pointer F6 holds. Sprites show the portraits (OBJSEL 40).
//
// The first upload also fills every fourth byte of the portraits' HDMA table 7E:3D08
// with F0 (the lines without the sprite layer), clears the OAM high table copy 7E:3F08
// and sets the table's first two entries; the second one sets its entries (the mirror
// as bit 14 of the second), the OAM high table's first word 28 and counts one more NMI
// job list (81:A954).
//
// The DMA job (80:8FF5) sets DMA channel 0 to move the 1000 bytes of 7F:5250 to the
// VRAM data port (mode 1, VMDATAL and VMDATAH, the address incremented after the high
// byte; Book I 2-17-1, 2-27-14), puts the VRAM word address into the request 7E:0140
// and waits until the NMI has run the transfer and set the request negative. With the
// lag-free frame model the NMI arrives at the wait's branch 80:901F.
import { waitStatus } from '../system/wait-status.mjs';
import { readStateByte, writeStateByte } from '../state/objects.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { nmiAtBranch } from '../system/frame-wait.mjs';
import { UNPACK_7F, unpackLong } from '../system/unpack.mjs';
import { videoOf } from '../video/picture-video.mjs';
import { dialogContent } from '../content/dialogs.mjs';
import { romAddress } from '../data/rom-bytes.mjs';
import {
  NMI_JOB_LISTS,
  OAM_HIGH_TABLE,
  PALETTE_UPLOAD_LIST_BYTES,
  PORTRAIT_DMA_REQUEST,
  PORTRAIT_PALETTE_START,
  WRAM,
} from '../data/wram.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';
import { FLAG_MEMORY_8BIT, FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';

// OBJSEL for the portraits, the record pointer [F6] (byte 2 the bank) and the unpack
// buffer 7F:5250.
export const PORTRAIT_OBJSEL = 0x40,
  DP_PORTRAIT_POINTER = 0xf6,
  DP_PORTRAIT_BANK = 0xf8,
  PORTRAIT_RECORD_BANK_BYTE = 2,
  PORTRAIT_BUFFER = 0x5250;
// The second portrait's palette start and VRAM word address.
export const SECOND_PORTRAIT_PALETTE = 0xa1,
  SECOND_PORTRAIT_VRAM = 0x800;
// The second portrait's HDMA words and OAM high table byte, as the member portrait
// (80:E48D, src/game/member-portrait.mjs) sets them.
export const SECOND_PORTRAIT_HDMA = Object.freeze({
  firstAddress: 0x7e3d10,
  first: 0x1a1a,
  secondAddress: 0x7e3d12,
  second: 0x3480,
  oamHighAddress: WRAM + OAM_HIGH_TABLE,
  oamHigh: 0x28,
});

// Bank 7F in the WRAM array, and the row shift's addresses.
const HIGH_BANK = 0x10000,
  SOURCE_END = 0x5a4f,
  DESTINATION_END = 0x624f,
  SOURCE_STOP = 0x534f,
  ROW_BYTES = 0x100;
const FIRST_PALETTE = 0x91,
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
  // The mirror as bit 14 of the second HDMA word.
  MIRROR_BIT = 0x4000;
// The DMA job: the transfer's byte count, source and mode, its port write sites, and the
// request's wait branch.
const TILE_BYTES = 0x1000,
  TILE_SOURCE = 0x5250,
  TILE_BANK = 0x7f,
  DMA_SITES = Object.freeze({
    bytes: 0x808ff8,
    source: 0x808ffe,
    bank: 0x809005,
    target: 0x80900a,
    increment: 0x80900f,
    mode: 0x809014,
  }),
  REQUEST_BRANCH = 0x80901f,
  OBJSEL_SITE = 0x809412,
  MEMBER_OBJSEL_SITE = 0x80e4bf;

const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};
const longWord = (mem, at) =>
  mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);

// Unpack the portrait stream (pointer, bank word) into bank 7F from the offset
// (80:9F6D); returns the unpacker's result (src/system/unpack.mjs).
export function unpackPortraitStream(h, source, bank, offset) {
  return unpackLong(h.a.mem, source, bank, offset, UNPACK_7F);
}
// Move the portrait rows apart (80:8F20).
export function shiftPortraitRowsInPlace(h) {
  const { wram } = h.a.mem;
  let x = SOURCE_END,
    y = DESTINATION_END;
  while (x !== SOURCE_STOP) {
    y = (y - ROW_BYTES) & WORD_MASK;
    for (let n = 0; n < ROW_BYTES; n++) {
      writeStateByte(wram, HIGH_BANK + y, readStateByte(wram, HIGH_BANK + x));
      x = (x - 1) & WORD_MASK;
      y = (y - 1) & WORD_MASK;
    }
  }
}

// Upload the first portrait (80:9022), including the tile upload wait.
export function* uploadFirstPortrait(h, events) {
  const { wram } = h.a.mem;
  yield () => {
    setWord(wram, PORTRAIT_PALETTE_START, FIRST_PALETTE);
  };
  yield* transferPortraitTiles(h, events, 0);
  yield () => {
    for (let x = HDMA_FILL_LAST; !(x & WORD_SIGN); x = (x - HDMA_STRIDE) & WORD_MASK)
      writeStateByte(wram, HDMA_TABLE + x, HDMA_FILL);
    for (let x = OAM_HIGH_LAST; x >= 0; x -= 2) setWord(wram, OAM_HIGH_TABLE + x, 0);
    for (const [at, value] of FIRST_ENTRIES) setWord(wram, at, value);
  };
}

// Upload the second portrait (80:905E), perhaps mirrored, including the tile upload wait.
export function* uploadSecondPortrait(h, events, mirrored = false) {
  const { wram } = h.a.mem;
  yield () => {
    setWord(wram, PORTRAIT_PALETTE_START, SECOND_PORTRAIT_PALETTE);
  };
  yield* transferPortraitTiles(h, events, SECOND_PORTRAIT_VRAM);
  yield () => {
    setWord(wram, SECOND_FIRST[0], SECOND_FIRST[1]);
    setWord(wram, SECOND_SECOND[0], (mirrored ? MIRROR_BIT : 0) | SECOND_SECOND[1]);
    setWord(wram, OAM_HIGH_TABLE, SECOND_OAM_HIGH);
    setWord(wram, NMI_JOB_LISTS, word(wram, NMI_JOB_LISTS) + 1);
  };
}
// The portrait job's DMA channel 0 setup of 80:8FF5: 1000 bytes from 7F:5250 to VMDATA
// in word mode, with the VRAM address incremented after the high byte. The game NMI
// (src/game/game-nmi.mjs) repeats it when the palette cycle step took channel 0 first.
export function writePortraitTileChannel(port) {
  videoOf(port).setUpVramTransfer((TILE_BANK << WORD_BITS) | TILE_SOURCE, TILE_BYTES, DMA_SITES);
}

// Upload the unpacked portrait to the VRAM word address (80:8FF5), through the request
// wait.
export function* transferPortraitTiles(h, events, vram) {
  const { wram, port } = sceneRuntime(h);
  yield () => {
    writePortraitTileChannel(port);
    setWord(wram, PORTRAIT_DMA_REQUEST, vram);
  };
  // The wait's branch sees the request word's zero in 16-bit mode.
  const done = (value) => (value & WORD_SIGN) !== 0;
  for (let value; !done((value = word(wram, PORTRAIT_DMA_REQUEST)));) {
    const status = waitStatus(
      h,
      events,
      FLAG_MEMORY_8BIT | FLAG_NEGATIVE | FLAG_ZERO,
      value === 0 ? FLAG_ZERO : 0,
    );
    yield* nmiAtBranch(h, events, REQUEST_BRANCH, status);
  }
}

// Load a portrait into the unpack buffer: its record (for the NMI's palette upload) into
// the pointer F6, its packed picture unpacked and its rows spread apart.
function* loadPortrait(h, portrait) {
  const { mem } = h.a,
    { wram } = mem,
    record = romAddress(dialogContent(mem).portraits[portrait].address);
  let stream;
  yield () => {
    setWord(wram, DP_PORTRAIT_POINTER, record & WORD_MASK);
    writeStateByte(wram, DP_PORTRAIT_BANK, record >>> WORD_BITS);
    stream = [longWord(mem, record), mem.read8((record + 2) & LONG_MASK)];
  };
  yield () => unpackPortraitStream(h, ...stream, PORTRAIT_BUFFER);
  yield () => shiftPortraitRowsInPlace(h);
}

// Show the dialog's portraits: the left one, and the right one perhaps mirrored.
export function* showDialogPortraits(h, events, left, right, mirrored) {
  yield () => {
    videoOf(sceneRuntime(h).port).setObjectSelect(PORTRAIT_OBJSEL, OBJSEL_SITE);
    setWord(h.a.mem.wram, PALETTE_UPLOAD_LIST_BYTES, 0);
  };
  yield* loadPortrait(h, left);
  yield* uploadFirstPortrait(h, events);
  yield* loadPortrait(h, right);
  yield* uploadSecondPortrait(h, events, mirrored);
}

// Show a party member's portrait (80:E4B3 with 80:E48D): one portrait, uploaded as both
// the first and the second portrait.
export function* showMemberPortrait(h, events, portrait) {
  yield () => {
    videoOf(sceneRuntime(h).port).setObjectSelect(PORTRAIT_OBJSEL, MEMBER_OBJSEL_SITE);
    setWord(h.a.mem.wram, PALETTE_UPLOAD_LIST_BYTES, 0);
  };
  yield* loadPortrait(h, portrait);
  yield* uploadFirstPortrait(h, events);
  yield* uploadSecondPortrait(h, events);
}
