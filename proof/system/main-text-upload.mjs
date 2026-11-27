// The register-level text upload 81:A9E1 of the game NMI (lifted in
// src/game/game-nmi.mjs, which the live game and its instant text option run).
// The register-level game NMI and scene initialization references list it in
// their routine tables.
import { BYTE_MASK, WORD_MASK } from '../../src/constants/bits.mjs';
import { applyObservedTextDma } from './main-dma-readback.mjs';
import { LagFreeFrames } from '../../src/vm/frame-events.mjs';
import { isIoAddress } from '../../src/vm/devices.mjs';
import { VRAM_WORD_BYTES, VMAINC_INCREMENT_AFTER_HIGH } from '../../src/constants/ppu.mjs';
import { FLAG_ZERO, FLAG_CARRY, FLAG_MEMORY_8BIT } from '../../src/constants/cpu-flags.mjs';
import {
  TEXT_TILE_UPLOAD,
  TEXT_TILE_UPLOAD_BYTES,
  TEXT_TILE_UPLOAD_ADDRESS,
  TEXT_MAP_UPLOAD,
  WINDOW_MAP_BUFFER,
  TEXT_BUFFER_UPLOAD,
  TEXT_MASK_BUFFER,
  TEXT_BUFFER_BYTES,
  TEXT_BUFFER_VRAM_ADDRESS,
  TEXT_BUFFER_READBACK,
} from '../../src/data/wram.mjs';
import {
  DMAP0,
  DMA_CHANNEL_STRIDE,
  A1T6L,
  DAS6L,
  VMADDL,
  VMAINC,
  MDMAEN,
  DMAP6,
  A1T7L,
  DAS7L,
  DMAP7,
  DAS5L,
  A1T5L,
  RDVRAMH,
  DMAP5,
} from '../../src/constants/hardware-registers.mjs';
import '../../tools/register-forms/dialog-register-helpers.mjs';

// Original text-upload routine. Port stores are requests; channel-5 readback
// can additionally consume an explicitly observed transfer.
const ports = (h, rows) => {
  for (const [pc, offset, value] of rows) {
    h.load(value);
    h.portWrite(offset, h.ctx.a & (h.m() ? BYTE_MASK : WORD_MASK), h.m() ? 1 : 2, pc);
  }
};
// MDMAEN bit of the DMA channel whose DMAPx register is given.
const channel = (dmap) => 1 << ((dmap - DMAP0) / DMA_CHANNEL_STRIDE);
const sourceOffset = (source) => source & WORD_MASK;
// The fixed zero source of the text tile clear (81:AB2C sets its bank) and the BG3 map.
export const TEXT_CLEAR_SOURCE = 0x81ac8c,
  BG3_MAP_VRAM = 0x7800;
// 81:A9E1: text tiles are cleared in chunks of at most 1400 bytes per frame; the window
// map fills 0740 bytes of the BG3 map; the readback takes 16 bytes of text mask.
const TEXT_TILE_CHUNK = 0x1400,
  WINDOW_MAP_BYTES = 0x740,
  TEXT_READBACK_BYTES = 0x10;

// 81:A9E1: clear the text tiles and the window map.
export function clearTextTiles(h, e) {
  const { ctx } = h;
  h.load(h.read(h.abs(TEXT_TILE_UPLOAD)));
  if (!(ctx.status & FLAG_ZERO)) {
    ports(h, [[0x81a9e9, A1T6L, sourceOffset(TEXT_CLEAR_SOURCE)]]);
    h.load(h.read(h.abs(TEXT_TILE_UPLOAD_BYTES)));
    h.cmp(TEXT_TILE_CHUNK + 1);
    if (ctx.status & FLAG_CARRY) {
      h.sbc(TEXT_TILE_CHUNK);
      h.write(h.abs(TEXT_TILE_UPLOAD_BYTES), ctx.a);
      h.load(TEXT_TILE_CHUNK);
    } else h.write(h.abs(TEXT_TILE_UPLOAD), 0);
    h.portWrite(DAS6L, ctx.a, 2, 0x81aa02);
    h.load(h.read(h.abs(TEXT_TILE_UPLOAD_ADDRESS)));
    h.portWrite(VMADDL, ctx.a, 2, 0x81aa08);
    ctx.status &= ~FLAG_CARRY;
    h.adc(TEXT_TILE_CHUNK / VRAM_WORD_BYTES);
    h.write(h.abs(TEXT_TILE_UPLOAD_ADDRESS), ctx.a);
    h.sep(FLAG_MEMORY_8BIT);
    ports(h, [
      [0x81aa16, VMAINC, VMAINC_INCREMENT_AFTER_HIGH],
      [0x81aa1b, MDMAEN, channel(DMAP6)],
    ]);
    h.rep(FLAG_MEMORY_8BIT);
  }
  h.load(h.read(h.abs(TEXT_MAP_UPLOAD)));
  if (!(ctx.status & FLAG_ZERO)) {
    ports(h, [
      [0x81aa28, A1T7L, WINDOW_MAP_BUFFER],
      [0x81aa2e, DAS7L, WINDOW_MAP_BYTES],
      [0x81aa34, VMADDL, BG3_MAP_VRAM],
    ]);
    h.sep(FLAG_MEMORY_8BIT);
    ports(h, [
      [0x81aa3b, VMAINC, VMAINC_INCREMENT_AFTER_HIGH],
      [0x81aa40, MDMAEN, channel(DMAP7)],
    ]);
    h.rep(FLAG_MEMORY_8BIT);
    h.write(h.abs(TEXT_MAP_UPLOAD), 0);
  }
  h.load(h.read(h.abs(TEXT_BUFFER_UPLOAD)));
  if (!(ctx.status & FLAG_ZERO)) {
    ports(h, [[0x81aa50, A1T7L, TEXT_MASK_BUFFER]]);
    h.load(h.read(h.abs(TEXT_BUFFER_BYTES)));
    h.portWrite(DAS7L, ctx.a, 2, 0x81aa56);
    h.load(h.read(h.abs(TEXT_BUFFER_VRAM_ADDRESS)));
    h.portWrite(VMADDL, ctx.a, 2, 0x81aa5c);
    h.sep(FLAG_MEMORY_8BIT);
    ports(h, [
      [0x81aa63, VMAINC, VMAINC_INCREMENT_AFTER_HIGH],
      [0x81aa68, MDMAEN, channel(DMAP7)],
    ]);
    h.rep(FLAG_MEMORY_8BIT);
    h.write(h.abs(TEXT_BUFFER_UPLOAD), 0);
  }
  h.load(h.read(h.abs(TEXT_BUFFER_READBACK)));
  if (!(ctx.status & FLAG_ZERO)) {
    h.load(h.read(h.abs(TEXT_BUFFER_VRAM_ADDRESS)));
    const vmadd = ctx.a;
    h.portWrite(VMADDL, ctx.a, 2, 0x81aa78);
    ports(h, [
      [0x81aa7e, DAS5L, TEXT_READBACK_BYTES],
      [0x81aa84, A1T5L, TEXT_MASK_BUFFER],
    ]);
    h.sep(FLAG_MEMORY_8BIT);
    ports(h, [[0x81aa8b, VMAINC, VMAINC_INCREMENT_AFTER_HIGH]]);
    h.load(h.port(RDVRAMH, 1, 0x81aa8e));
    ports(h, [[0x81aa93, MDMAEN, channel(DMAP5)]]);
    // Live devices perform this transfer themselves from the PPU (frame-events.mjs).
    if (
      isIoAddress(h.abs(MDMAEN)) &&
      !(e?.interrupts instanceof LagFreeFrames) &&
      (e?.interrupts !== undefined || e?.dmaTransfers !== undefined)
    )
      applyObservedTextDma(h, e, vmadd);
    h.rep(FLAG_MEMORY_8BIT);
    h.write(h.abs(TEXT_BUFFER_READBACK), 0);
  }
  return h.rtl();
}
