// Shared runtime of the lifted matrix (docs/MATRIX-LIFT.md): plain word access to
// the game state in WRAM, reads of the cartridge tables, the VRAM transfer queue
// the matrix NMI sends, and the video, hardware, sound and random interfaces.
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { matrixTables } from './matrix-tables.mjs';
import {
  DMA_RECORD_BANK,
  DMA_RECORD_BYTES,
  DMA_RECORD_COUNT,
  DMA_RECORD_SOURCE,
  DMA_RECORD_VMAINC,
  DMA_RECORD_VRAM,
  MATRIX_DMA_END,
  MATRIX_DMA_RECORDS,
} from '../task/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';
import { VMAINC_INCREMENT_AFTER_HIGH } from '../constants/ppu.mjs';

const WRAM_START = 0x7e0000,
  LONG_MASK = 0xffffff;

// Words of the game state. at is a WRAM offset: 0-1FFF for the low RAM that bank 81
// addresses directly, 7E:xxxx and 7F:xxxx minus WRAM_START otherwise.
export const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
export const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
export const wramOffset = (address) => address - WRAM_START;

// Words at a long CPU address (cartridge tables, the map in bank 7F, texts); the
// second byte follows across a bank end as on the CPU.
export const longWord = (mem, address) =>
  mem.read8(address & LONG_MASK) | (mem.read8((address + 1) & LONG_MASK) << BYTE_BITS);
export const setLongWord = (mem, address, value) => {
  mem.write8(address & LONG_MASK, value & BYTE_MASK);
  mem.write8((address + 1) & LONG_MASK, (value >>> BYTE_BITS) & BYTE_MASK);
};

// Queue a copy of bytes from source (long address) to VRAM word address for the NMI.
// The record keeps the original eight-byte layout; a zero count ends the list.
export function queueVramCopy(wram, bytes, source, address) {
  const at = word(wram, MATRIX_DMA_END);
  setWord(wram, DMA_RECORD_COUNT + at, bytes);
  wram[DMA_RECORD_VMAINC + at] = VMAINC_INCREMENT_AFTER_HIGH;
  wram[DMA_RECORD_BANK + at] = source >>> WORD_BITS;
  setWord(wram, DMA_RECORD_SOURCE + at, source & WORD_MASK);
  setWord(wram, DMA_RECORD_VRAM + at, address);
  setWord(wram, DMA_RECORD_COUNT + DMA_RECORD_BYTES + at, 0);
  setWord(wram, MATRIX_DMA_END, at + DMA_RECORD_BYTES);
}
// The queued copies one after another for VideoPort.copyToVram, then an empty queue.
export function sendVramCopies(wram, video) {
  if (word(wram, MATRIX_DMA_RECORDS) !== 0) {
    let at = 0;
    const transfer = { bytes: 0, increment: 0, source: 0, address: 0 };
    video.copyToVram(() => {
      transfer.bytes = word(wram, DMA_RECORD_COUNT + at);
      if (transfer.bytes === 0) return null;
      transfer.increment = wram[DMA_RECORD_VMAINC + at];
      transfer.source =
        (wram[DMA_RECORD_BANK + at] << WORD_BITS) | word(wram, DMA_RECORD_SOURCE + at);
      transfer.address = word(wram, DMA_RECORD_VRAM + at);
      at += DMA_RECORD_BYTES;
      return transfer;
    });
    setWord(wram, MATRIX_DMA_END, 0);
    setWord(wram, MATRIX_DMA_RECORDS, 0);
  }
}

// h is the native call accessor of the running scene or NMI.
export function matrixRuntime(h) {
  const scene = sceneRuntime(h);
  // The control tables of bank 81 by name (src/matrix/matrix-tables.mjs).
  return { ...scene, tables: matrixTables(scene.mem) };
}
