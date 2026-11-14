import { taskStop } from './plan.mjs';
import { TEXT_MASK_BUFFER, WRAM } from './wram.mjs';
import { BYTE_MASK, WORD_MASK, WORD_BITS } from '../constants/bits.mjs';
import { MDMAEN, RDVRAML } from '../constants/hardware-registers.mjs';
import { WRAM_BANK } from '../constants/memory-map.mjs';
import { DMAP_B_TO_A, DMAP_TWO_PORTS, VMAINC_INCREMENT_AFTER_HIGH } from '../constants/ppu.mjs';

const TEXT_DMA_PC = 0x81aa93;
const TEXT_DMA_CHANNEL_MASK = 0x20;
const TEXT_DMA_BYTES = 16;
const TEXT_DMA_B_ADDRESS = RDVRAML & BYTE_MASK;

// One explicitly observed channel-5 occurrence at STA $420B in A9E1.
// DMAP/BBAD/A1B are retained device state, supplied by the observer, never
// assumed from an earlier AB2C call. The other registers were just written
// by A9E1. This contract accepts only its original 16-byte reverse mode-1
// transfer: alternating BYTE $2139/$213A -> incrementing $7E2AE0..$7E2AEF.
// Bytes are observations, not a VRAM/PPU model or a transfer schedule.
export function applyObservedTextDma(h, events, vmadd) {
  const index = events.dmaIndex ?? 0,
    list = events.dmaTransfers,
    o = list?.[index];
  const address = h.abs(MDMAEN),
    pc = TEXT_DMA_PC;
  h.ctx.programBank = TEXT_DMA_PC >>> WORD_BITS;
  h.ctx.pc = TEXT_DMA_PC & WORD_MASK;
  const expected = {
    pc,
    address,
    width: 1,
    value: TEXT_DMA_CHANNEL_MASK,
    dmap: DMAP_B_TO_A | DMAP_TWO_PORTS,
    bbad: TEXT_DMA_B_ADDRESS,
    a1b: WRAM_BANK,
    a1t: TEXT_MASK_BUFFER,
    das: TEXT_DMA_BYTES,
    vmain: VMAINC_INCREMENT_AFTER_HIGH,
    vmadd,
  };
  if (
    !Array.isArray(list) ||
    !Object.isFrozen(list) ||
    !o ||
    !Object.isFrozen(o) ||
    Object.entries(expected).some(([key, value]) => o[key] !== value) ||
    !Array.isArray(o.bytes) ||
    !Object.isFrozen(o.bytes) ||
    o.bytes.length !== TEXT_DMA_BYTES ||
    Array.from(o.bytes).some((v) => !Number.isInteger(v) || v < 0 || v > BYTE_MASK)
  )
    taskStop('text_dma_observation_required', { pc, address, width: 1, observationIndex: index });
  // Validate the whole occurrence before any data write or record consumption.
  // No CPU flags, registers, or stack bytes change as part of the DMA effect.
  for (let i = 0; i < TEXT_DMA_BYTES; i++) h.a.write(WRAM + TEXT_MASK_BUFFER + i, o.bytes[i]);
  events.dmaIndex = index + 1;
}

export function finishTextDmaObservations(events) {
  if (events.dmaTransfers === undefined) return;
  if (!Array.isArray(events.dmaTransfers) || !Object.isFrozen(events.dmaTransfers))
    taskStop('text_dma_observation_required', { observationIndex: events.dmaIndex ?? 0 });
  if ((events.dmaIndex ?? 0) !== events.dmaTransfers.length)
    taskStop('text_dma_observation_unused', { observationIndex: events.dmaIndex ?? 0 });
}
